import assert from "node:assert/strict";
import test from "node:test";
import { assessmentSlots, availableExternalSlots, validExternalSlot } from "./externalAppointmentSlots.js";
import { createSeed, reducer, TODAY } from "./model.js";
import { collectionSetupLabel } from "./overview.js";

test("assessment slots never pass the due date and put the closest day first", () => {
  const slots = assessmentSlots("2026-10-18", TODAY);
  assert.ok(slots.length > 0);
  assert.ok(slots.every((slot) => slot.date <= "2026-10-18" && slot.date >= TODAY));
  assert.deepEqual([...new Set(slots.map((slot) => slot.date))],
    [...new Set(slots.map((slot) => slot.date))].sort().reverse());
  assert.deepEqual(assessmentSlots("2026-09-14", TODAY), []);
});

test("external slot references are canonical sample feed records", () => {
  const slot = availableExternalSlots(TODAY, TODAY)[0];
  assert.ok(validExternalSlot(slot));
  assert.equal(validExternalSlot({ ...slot, time: "23:00" }), false);
});

test("a follow-up saves an external appointment reference without creating a YSSC appointment", () => {
  const seed = createSeed();
  const episode = seed.people.find((person) => person.id === "YS-1024")
    .episodes.find((item) => item.id === "EP-1024-01");
  const before = episode.appointments?.length || 0;
  const slot = assessmentSlots("2026-09-30", TODAY)[0];
  const next = reducer(seed, {
    type: "PLAN", personId: "YS-1024", episodeId: "EP-1024-01",
    id: "external-slot-test", label: "External slot test", due: "2026-09-30",
    externalAppointment: slot,
  });
  assert.notEqual(next, seed);
  const saved = next.people.find((person) => person.id === "YS-1024")
    .episodes.find((item) => item.id === "EP-1024-01");
  assert.equal(saved.appointments?.length || 0, before);
  assert.deepEqual(saved.collections.find((item) => item.id === "external-slot-test").externalAppointment, slot);
  assert.equal(reducer(seed, {
    type: "PLAN", personId: "YS-1024", episodeId: "EP-1024-01",
    id: "late-slot-test", label: "Late slot test", due: TODAY,
    externalAppointment: assessmentSlots("2026-09-30", TODAY)[0],
  }), seed);
});

test("saving collection setup does not start a questionnaire attempt", () => {
  const seed = createSeed();
  const personId = "YS-1024";
  const episodeId = "EP-1024-01";
  const due = "2026-09-30";
  const planned = reducer(seed, {
    type: "PLAN", personId, episodeId, id: "setup-save-test",
    label: "Setup save test", due,
  });
  const slot = assessmentSlots(due, TODAY)[0];
  const saved = reducer(planned, {
    type: "SAVE_COLLECTION_SETUP", personId, episodeId,
    collectionId: "setup-save-test", channel: "Clinic tablet",
    respondent: "Person", assistance: "Independent",
    externalAppointment: slot,
  });
  assert.notEqual(saved, planned);
  const collection = saved.people.find((person) => person.id === personId)
    .episodes.find((episode) => episode.id === episodeId)
    .collections.find((item) => item.id === "setup-save-test");
  assert.equal(collection.channel, "Clinic tablet");
  assert.deepEqual(collection.externalAppointment, slot);
  assert.equal(collection.assignment, "Planned");
  assert.equal(collection.link, "Not sent");
  assert.equal(collection.attempts.length, 0);
  assert.equal(collectionSetupLabel(collection), "Review collection options");
  assert.equal(reducer(planned, {
    type: "SAVE_COLLECTION_SETUP", personId, episodeId,
    collectionId: "setup-save-test", channel: "Clinic tablet",
    respondent: "Person", assistance: "Independent",
    externalAppointment: assessmentSlots("2026-10-18", TODAY)[0],
  }), planned);
});

test("initial assessment and contextual event keep the selected external reference", () => {
  const seed = createSeed();
  const person = seed.people.find((item) => item.id === "YS-1032");
  const intake = person.intakes[0];
  const slot = assessmentSlots("2026-10-18", TODAY)[0];
  const planned = reducer(seed, {
    type: "START_ASSESSMENT", personId: person.id, intakeId: intake.id,
    revision: intake.revision, due: "2026-10-18", programStream: "General",
    externalAppointment: slot,
  });
  assert.notEqual(planned, seed);
  const episode = planned.people.find((item) => item.id === person.id).episodes.at(-1);
  assert.deepEqual(episode.collections[0].externalAppointment, slot);
  const withEvent = reducer(planned, {
    type: "ADD_CARE_EVENT", personId: person.id, episodeId: episode.id,
    eventDate: TODAY, eventType: "other", summary: "Follow-up discussion recorded",
    externalAppointment: slot,
  });
  assert.notEqual(withEvent, planned);
  const savedEvent = withEvent.people.find((item) => item.id === person.id).episodes
    .find((item) => item.id === episode.id).events[0];
  assert.deepEqual(savedEvent.fields.externalAppointment, slot);
});

test("starting clinician collection links the external slot without creating an appointment", () => {
  const seed = createSeed();
  const due = "2026-09-29";
  const slot = assessmentSlots(due, TODAY)[0];
  const personId = "YS-1024";
  const episodeId = "EP-1024-01";
  const planned = reducer(seed, {
    type: "PLAN", personId, episodeId, id: "external-deliver-test",
    label: "External collection test", due,
  });
  const before = planned.people.find((person) => person.id === personId)
    .episodes.find((episode) => episode.id === episodeId).appointments?.length || 0;
  const started = reducer(planned, {
    type: "DELIVER", personId, episodeId, collectionId: "external-deliver-test",
    channel: "Clinician entry", respondent: "Person", assistance: "Transcribed",
    externalAppointment: slot,
  });
  assert.notEqual(started, planned);
  const episode = started.people.find((person) => person.id === personId)
    .episodes.find((item) => item.id === episodeId);
  const collection = episode.collections.find((item) => item.id === "external-deliver-test");
  assert.equal(episode.appointments?.length || 0, before);
  assert.deepEqual(collection.externalAppointment, slot);
  assert.deepEqual(collection.attempts.at(-1).externalAppointment, slot);
  assert.equal(collection.appointmentId, null);
});
