import { createSampleAnswers } from "./sampleQuestionnaires.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeed,
  reducer,
  getTasks,
  VERSION,
  TODAY,
  upgradeSampleData,
  responseEditError,
  qualityWorkflowError,
  clinicalReviewStatus,
  canCollectInEpisode,
  collectionActor,
  personEventText,
} from "./model.js";
import {
  getInstrument,
  LIKERT_INSTRUMENT,
  questionnaireState,
} from "./instruments.js";
import { careRecordTimelineEntries } from "./careRecordTimeline.js";
import { careEventEntries } from "./activity.js";
import { peopleInEpisodes } from "./people.js";
const ctx = {
  personId: "YS-1024",
  episodeId: "EP-1024-01",
  collectionId: "A-0-current",
};
const collection = (s) => s.people[0].episodes[0].collections.at(-1);
const deliver = (s) =>
  reducer(s, {
    ...ctx,
    type: "DELIVER",
    channel: "SMS link",
    respondent: "Person",
    assistance: "Independent",
  });
const submit = (s) =>
  reducer(s, {
    ...ctx,
    type: "SUBMIT",
    answers: createSampleAnswers({
      participation: "In person",
      support: "A little support",
      next: "My next steps",
    }),
  });
test("seed worklist counts represent actual open collection and review work", () => {
  const tasks = getTasks(createSeed());
  assert.equal(tasks.length, 11);
  assert.equal(tasks.filter((task) => task.person.id === "YS-DEMO-CLOSE").length, 2);
  assert.equal(tasks.filter((t) => t.status === "Overdue").length, 2);
  assert.equal(tasks.filter((t) => t.status === "Ready for review").length, 2);
});
test("archiving a person hides active work while retaining a restorable record", () => {
  const seed = createSeed();
  const jordan = seed.people.find((person) => person.id === "YS-1034");
  const originalIntakes = structuredClone(jordan.intakes);
  const originalEpisodes = structuredClone(jordan.episodes);
  const archived = reducer(seed, {
    type: "ARCHIVE_PERSON",
    personId: jordan.id,
    reason: "Remove this sample record from active work",
  });
  const archivedJordan = archived.people.find((person) => person.id === jordan.id);
  assert.ok(archivedJordan.archivedAt);
  assert.equal(peopleInEpisodes(archived.people).some((row) => row.person.id === jordan.id), false);
  assert.equal(peopleInEpisodes(archived.people, "Archived").some((row) => row.person.id === jordan.id), true);
  assert.equal(getTasks(archived).some((task) => task.person.id === jordan.id), false);
  assert.deepEqual(archivedJordan.intakes, originalIntakes);
  assert.deepEqual(archivedJordan.episodes, originalEpisodes);
  const restored = reducer(archived, {
    type: "RESTORE_PERSON",
    personId: jordan.id,
    reason: "Return this sample record to active work",
  });
  assert.equal(restored.people.find((person) => person.id === jordan.id).archivedAt, null);
  assert.equal(peopleInEpisodes(restored.people).some((row) => row.person.id === jordan.id), true);
  assert.equal(restored.audit[0].title, "Person restored");
});
test("person tags can be added and removed without duplicate labels", () => {
  const seed = createSeed();
  const personId = "YS-1025";
  const tagged = reducer(seed, { type: "ADD_PERSON_TAG", personId, tag: " Follow-up needed " });
  assert.deepEqual(tagged.people.find((person) => person.id === personId).tags, ["Follow-up needed"]);
  assert.equal(tagged.audit[0].title, "Person tag added");
  assert.equal(reducer(tagged, { type: "ADD_PERSON_TAG", personId, tag: "follow-up needed" }), tagged);
  assert.equal(reducer(tagged, { type: "ADD_PERSON_TAG", personId, tag: "Custom label" }), tagged);
  const removed = reducer(tagged, { type: "REMOVE_PERSON_TAG", personId, tag: "Follow-up needed" });
  assert.deepEqual(removed.people.find((person) => person.id === personId).tags, []);
  assert.equal(removed.audit[0].title, "Person tag removed");
});
test("sample tags match each fixture and preserve saved tag choices", () => {
  const seed = createSeed();
  const tagsFor = (state, id) => state.people.find((person) => person.id === id).tags;
  assert.deepEqual(tagsFor(seed, "YS-1034"), ["Care coordination", "Follow-up needed"]);
  assert.deepEqual(tagsFor(seed, "YS-1031"), ["Contact support"]);
  assert.deepEqual(tagsFor(seed, "YS-1028"), ["Contact support"]);

  const saved = structuredClone(seed);
  delete saved.people.find((person) => person.id === "YS-1034").tags;
  saved.people.find((person) => person.id === "YS-1031").tags = [];
  saved.people.find((person) => person.id === "YS-1028").tags = ["Review requested"];
  const upgraded = upgradeSampleData(saved);
  assert.deepEqual(tagsFor(upgraded, "YS-1034"), ["Care coordination", "Follow-up needed"]);
  assert.deepEqual(tagsFor(upgraded, "YS-1031"), []);
  assert.deepEqual(tagsFor(upgraded, "YS-1028"), ["Review requested"]);
  assert.equal(upgradeSampleData(upgraded), upgraded);
});
test("resetting intake examples restores River and Samira without changing other records", () => {
  const seed = createSeed();
  const edited = structuredClone(seed);
  edited.people.find((person) => person.id === "YS-1031").intakes[0].status = "Completed";
  edited.people.find((person) => person.id === "YS-1032").intakes[0].nextAction = "Edited locally";
  edited.people.find((person) => person.id === "YS-1024").tags = ["Review requested"];
  edited.audit.push({ id: "AUD-RIVER-LOCAL", personId: "YS-1031" });
  edited.audit.push({ id: "AUD-KAI-LOCAL", personId: "YS-1024" });
  edited.issues.push({ id: "DQ-SAMIRA-LOCAL", personId: "YS-1032", title: "Local sample issue", status: "Open" });
  edited.qualityIssueWorkflow["DQ-SAMIRA-LOCAL"] = { status: "Investigating" };
  const reset = reducer(edited, { type: "RESET_INTAKE_EXAMPLES", resetToken: "test-reset" });
  for (const id of ["YS-1031", "YS-1032"]) {
    const actual = reset.people.find((person) => person.id === id);
    const original = seed.people.find((person) => person.id === id);
    assert.deepEqual({ ...actual, intakeResetToken: undefined }, { ...original, intakeResetToken: undefined });
    assert.equal(actual.intakeResetToken, "test-reset");
  }
  assert.deepEqual(reset.people.find((person) => person.id === "YS-1024"), edited.people.find((person) => person.id === "YS-1024"));
  assert.equal(reset.audit.some((entry) => entry.id === "AUD-RIVER-LOCAL"), false);
  assert.equal(reset.audit.some((entry) => entry.id === "AUD-KAI-LOCAL"), true);
  assert.equal(reset.issues.some((issue) => issue.id === "DQ-SAMIRA-LOCAL"), false);
  assert.equal(reset.qualityIssueWorkflow["DQ-SAMIRA-LOCAL"], undefined);
  assert.equal(edited.people.find((person) => person.id === "YS-1031").intakes[0].status, "Completed");
});
test("Zoe has distinct current and closed care periods without adding historical work to the queue", () => {
  const seed = createSeed();
  const zoe = seed.people.find((p) => p.id === "YS-1027");
  const [current, previous] = zoe.episodes;
  assert.equal(current.number, "02");
  assert.equal(current.status, "Active");
  assert.equal(previous.number, "01");
  assert.equal(previous.status, "Closed");
  assert.ok(previous.end < current.start);
  assert.ok(
    previous.collections.every(
      (c) => c.response === "Submitted" && c.review === "Reviewed",
    ),
  );
  assert.equal(
    getTasks(seed).some((t) => t.episode?.id === previous.id),
    false,
  );
  assert.equal(seed.people[0].episodes.length, 1);
});
test("older mock data is replaced once with the refreshed branching scenarios", () => {
  const old = createSeed();
  old.sampleRevision = 3;
  old.people[0].name = "Old mock";
  old.people[0].episodes[0].collections[0].version = "Demo check-in v1.0";
  old.audit.push({ id: "old-edit" });
  const before = structuredClone(old);
  const updated = upgradeSampleData(old);
  assert.deepEqual(old, before);
  assert.equal(updated.people[0].name, "Kai Thompson");
  assert.equal(updated.sampleRevision, 28);
  assert.equal(
    updated.audit.some((item) => item.id === "old-edit"),
    false,
  );
  assert.equal(upgradeSampleData(updated), updated);
});
test("saved v2 check-in responses keep their answers under the clearer name", () => {
  const saved = createSeed();
  const original = saved.people[0].episodes[0].collections[0];
  const answers = structuredClone(original.answers);
  original.version = "Demo check-in v2.0";

  const upgraded = upgradeSampleData(saved);
  const restored = upgraded.people[0].episodes[0].collections[0];
  assert.equal(restored.version, VERSION);
  assert.deepEqual(restored.answers, answers);
  assert.equal(getInstrument("Demo check-in v2.0")?.version, VERSION);
});
test("Jordan's generic saved follow-ups gain instrument-specific labels", () => {
  const saved = createSeed();
  const jordan = saved.people.find((person) => person.id === "YS-1034");
  const episode = jordan.episodes[0];
  episode.collections.push({
    id: "A-jordan-follow-up",
    label: "Follow-up review",
    version: VERSION,
    due: "2026-09-24",
    channel: "Clinic tablet",
    appointmentId: "APT-jordan-follow-up",
    attempts: [],
  });
  episode.appointments.push({
    id: "APT-jordan-follow-up",
    notes: "Associated appointment for follow-up assessment (Follow-up review · Clinic tablet)",
  });
  const upgraded = upgradeSampleData(saved);
  const updatedEpisode = upgraded.people.find((person) => person.id === "YS-1034").episodes[0];
  assert.equal(updatedEpisode.collections.at(-1).label, "Your preferences and next steps · follow-up check-in");
  assert.equal(updatedEpisode.appointments.at(-1).notes,
    "Associated appointment for follow-up assessment (Your preferences and next steps · follow-up check-in · Clinic tablet)");
  assert.equal(episode.collections.at(-1).label, "Follow-up review");
  assert.equal(upgradeSampleData(upgraded), upgraded);
});
test("Jordan's saved follow-ups do not retain an appointment from another date", () => {
  const saved = createSeed();
  const episode = saved.people.find((person) => person.id === "YS-1034").episodes[0];
  episode.collections.push({
    id: "A-jordan-future",
    label: "Your preferences and next steps · follow-up check-in",
    version: VERSION,
    due: "2026-09-24",
    appointmentId: "APT-7-baseline",
    response: "Not started",
    attempts: [],
  });
  const upgraded = upgradeSampleData(saved);
  const updated = upgraded.people.find((person) => person.id === "YS-1034").episodes[0].collections.at(-1);
  assert.equal(updated.appointmentId, null);
  assert.equal(saved.people.find((person) => person.id === "YS-1034").episodes[0].collections.at(-1).appointmentId, "APT-7-baseline");
});
test("Jordan's saved 13 Oct 2027 outlier is removed without disturbing other follow-ups", () => {
  const saved = createSeed();
  const episode = saved.people.find((person) => person.id === "YS-1034").episodes[0];
  episode.collections.push({
    id: "A-jordan-2027-outlier",
    label: "Your preferences and next steps · follow-up check-in",
    due: "2027-10-13",
    response: "Not started",
    attempts: [],
  });
  episode.collections.push({
    id: "A-jordan-september-follow-up",
    label: "Your preferences and next steps · follow-up check-in",
    due: "2026-09-24",
    response: "Not started",
    attempts: [],
  });
  episode.events.push({ id: "E-jordan-2027-outlier", collectionId: "A-jordan-2027-outlier" });
  saved.audit.push({ id: "H-jordan-2027-outlier", collectionId: "A-jordan-2027-outlier" });
  const upgraded = upgradeSampleData(saved);
  const updatedEpisode = upgraded.people.find((person) => person.id === "YS-1034").episodes[0];
  assert.equal(updatedEpisode.collections.some((item) => item.id === "A-jordan-2027-outlier"), false);
  assert.equal(updatedEpisode.collections.some((item) => item.id === "A-jordan-september-follow-up"), true);
  assert.equal(updatedEpisode.events.some((item) => item.id === "E-jordan-2027-outlier"), false);
  assert.equal(upgraded.audit.some((item) => item.id === "H-jordan-2027-outlier"), false);
  assert.equal(episode.collections.some((item) => item.id === "A-jordan-2027-outlier"), true);
  assert.equal(upgradeSampleData(upgraded), upgraded);
});

test("Jordan's unstarted 15 Sep follow-up is removed without touching submitted or later work", () => {
  const saved = createSeed();
  const episode = saved.people.find((person) => person.id === "YS-1034").episodes[0];
  const label = "Your preferences and next steps · follow-up check-in";
  episode.collections.push(
    { id: "A-jordan-remove-sep15", label, due: "2026-09-15", assignment: "Active", response: "Not started", attempts: [] },
    { id: "A-jordan-submitted-sep15", label, due: "2026-09-15", assignment: "Fulfilled", response: "Submitted", attempts: [] },
    { id: "A-jordan-keep-sep24", label, due: "2026-09-24", assignment: "Active", response: "Not started", attempts: [] },
  );
  episode.events.push({ id: "E-jordan-remove-sep15", collectionId: "A-jordan-remove-sep15" });
  saved.audit.push({ id: "H-jordan-remove-sep15", collectionId: "A-jordan-remove-sep15" });

  const upgraded = upgradeSampleData(saved);
  const updatedEpisode = upgraded.people.find((person) => person.id === "YS-1034").episodes[0];
  assert.equal(updatedEpisode.collections.some((item) => item.id === "A-jordan-remove-sep15"), false);
  assert.ok(updatedEpisode.collections.some((item) => item.id === "A-jordan-submitted-sep15"));
  assert.ok(updatedEpisode.collections.some((item) => item.id === "A-jordan-keep-sep24"));
  assert.equal(updatedEpisode.events.some((item) => item.id === "E-jordan-remove-sep15"), false);
  assert.equal(upgraded.audit.some((item) => item.id === "H-jordan-remove-sep15"), false);
  assert.ok(episode.collections.some((item) => item.id === "A-jordan-remove-sep15"));
  assert.equal(upgradeSampleData(upgraded), upgraded);
});
test("saved mock inpatient admission is moved to the oldest event", () => {
  const saved = createSeed();
  const jordan = saved.people.find((person) => person.id === "YS-1034");
  const episode = jordan.episodes.find((item) => item.id === "EP-1034-01");
  const admission = episode.events.find((event) => event.id === "E-7-inpatient");
  admission.date = "2026-08-30";
  admission.eventDate = "2026-08-30";
  admission.timestamp = "2026-08-30T09:00:00Z";
  saved.sampleRevision = 22;

  const migrated = upgradeSampleData(saved);
  const migratedEpisode = migrated.people.find(
    (person) => person.id === "YS-1034",
  ).episodes[0];
  const eventEntries = careRecordTimelineEntries(migratedEpisode).filter(
    (entry) => entry.sourceType === "contextual-event",
  );
  assert.equal(admission.eventDate, "2026-08-30");
  assert.equal(eventEntries.at(-1).sourceId, "E-7-inpatient");
  assert.equal(eventEntries.at(-1).date, "2026-06-15");
  assert.equal(migrated.sampleRevision, 28);
});

test("fictional care stories keep independent assessment, contact and context records distinct", () => {
  const state = createSeed();
  const jordan = state.people.find((person) => person.id === "YS-1034");
  const episode = jordan.episodes[0];
  const independent = episode.collections.find((item) =>
    item.id === "A-7-everyday-life-twelve-weeks",
  );
  const inPerson = episode.collections.find((item) =>
    item.id === "A-7-life-care-twelve-weeks",
  );
  const appointment = episode.appointments.find((item) => item.id === "APT-7-twelve-weeks");
  assert.equal(independent.channel, "SMS link");
  assert.equal(independent.appointmentId, null);
  assert.equal(independent.attempts[0].appointmentId, undefined);
  assert.equal(inPerson.appointmentId, appointment.id);
  assert.equal(appointment.attendance, "Attended");
  const timeline = careRecordTimelineEntries(episode);
  assert.equal(timeline.filter((entry) => entry.sourceId === appointment.id).length, 1);
  assert.ok(timeline.some((entry) =>
    entry.sourceType === "contextual-event" && entry.title === "Inpatient discharge handover received",
  ));
  const kai = state.people.find((person) => person.id === "YS-1024");
  const kaiTimeline = careRecordTimelineEntries(kai.episodes[0]);
  assert.ok(kaiTimeline.some((entry) =>
    entry.sourceType === "contextual-event" && entry.title === "School timetable changed",
  ));
});

test("saved fictional scenarios upgrade without changing an edited contact", () => {
  const saved = createSeed();
  const episode = saved.people.find((person) => person.id === "YS-1034").episodes[0];
  const independent = episode.collections.find((item) =>
    item.id === "A-7-everyday-life-twelve-weeks",
  );
  independent.channel = "Clinic tablet";
  independent.appointmentId = "APT-7-twelve-weeks";
  independent.submittedAppointmentId = "APT-7-twelve-weeks";
  Object.assign(independent.attempts[0], {
    channel: "Clinic tablet",
    appointmentId: "APT-7-twelve-weeks",
    status: "Session started (sample)",
  });
  episode.appointments.find((item) => item.id === "APT-7-attended").notes = "Staff entered note";
  saved.people.find((person) => person.id === "YS-1024").episodes[0].events = [];
  saved.sampleRevision = 26;
  const upgraded = upgradeSampleData(saved);
  const updatedEpisode = upgraded.people.find((person) => person.id === "YS-1034").episodes[0];
  const updated = updatedEpisode.collections.find((item) => item.id === independent.id);
  assert.equal(updated.channel, "SMS link");
  assert.equal(updated.appointmentId, null);
  assert.equal(updatedEpisode.appointments.find((item) => item.id === "APT-7-attended").notes, "Staff entered note");
  assert.ok(upgraded.people.find((person) => person.id === "YS-1024").episodes[0].events.some(
    (item) => item.id === "E-0-context",
  ));
  assert.equal(upgradeSampleData(upgraded), upgraded);
});
test("a follow-up adds a pinned collection in the existing episode and preserves baseline answers", () => {
  const seed = createSeed();
  const next = reducer(seed, {
    ...ctx,
    type: "PLAN",
    label: "October review",
    due: "2026-10-15",
  });
  assert.equal(next.people[0].episodes.length, 1);
  assert.equal(
    next.people[0].episodes[0].collections.length,
    seed.people[0].episodes[0].collections.length + 1,
  );
  assert.equal(collection(next).version, VERSION);
  assert.deepEqual(
    next.people[0].episodes[0].collections[0],
    seed.people[0].episodes[0].collections[0],
  );
});
test("a care event retains its factual summary, source and recording dates", () => {
  const seed = createSeed();
  const next = reducer(seed, {
    ...ctx,
    type: "ADD_CARE_EVENT",
    eventType: "housing",
    eventDate: TODAY,
    summary: "Temporary accommodation ended",
    source: "Treating clinician",
    impact: "Confirm a safe route for the next review.",
    notes: "Monitor until the next review.",
  });
  const event = next.people[0].episodes[0].events[0];
  assert.equal(event.actionType, "ADD_CARE_EVENT");
  assert.equal(event.eventType, "housing");
  assert.equal(event.eventDate, TODAY);
  assert.equal(event.title, "Temporary accommodation ended");
  assert.equal(event.fields.source, "Treating clinician");
  assert.equal(
    event.fields.impact,
    "Confirm a safe route for the next review.",
  );
  assert.equal(event.actor, "Jess Taylor");
  assert.ok(event.timestamp);
  assert.deepEqual(
    next.people[0].episodes[0].collections,
    seed.people[0].episodes[0].collections,
  );
});
test("care events reject missing required data and dates outside the episode", () => {
  const seed = createSeed();
  assert.deepEqual(
    reducer(seed, {
      ...ctx,
      type: "ADD_CARE_EVENT",
      eventType: "medication-adverse",
      eventDate: TODAY,
      summary: "Adverse effects reported",
    }),
    seed,
  );
  assert.deepEqual(
    reducer(seed, {
      ...ctx,
      type: "ADD_CARE_EVENT",
      eventType: "other",
      eventDate: "2025-01-01",
      summary: "Outside the care period",
    }),
    seed,
  );
  assert.deepEqual(
    reducer(seed, {
      ...ctx,
      type: "ADD_CARE_EVENT",
      eventType: "other",
      eventDate: "2026-02-31",
      summary: "Invalid calendar date",
    }),
    seed,
  );
});
test("a correction is appended without changing the original care event", () => {
  const recorded = reducer(createSeed(), {
    ...ctx,
    type: "ADD_CARE_EVENT",
    eventType: "housing",
    eventDate: TODAY,
    summary: "Temporary accommodation ended",
  });
  const original = recorded.people[0].episodes[0].events[0];
  const corrected = reducer(recorded, {
    ...ctx,
    type: "CORRECT_CARE_EVENT",
    correctedEventId: original.id,
    eventType: "housing",
    eventDate: TODAY,
    summary: "Temporary accommodation ended and outreach arranged",
    correctionReason: "The follow-up arrangement was omitted.",
  });
  const [correction, retainedOriginal] = corrected.people[0].episodes[0].events;
  assert.equal(correction.actionType, "CORRECT_CARE_EVENT");
  assert.equal(correction.correctedEventId, original.id);
  assert.equal(
    correction.correctionReason,
    "The follow-up arrangement was omitted.",
  );
  assert.equal(retainedOriginal.id, original.id);
  assert.equal(retainedOriginal.title, "Temporary accommodation ended");
});
test("reissue adds an attempt without creating another assignment or deleting the draft", () => {
  const seed = createSeed(),
    next = deliver(seed);
  assert.equal(collection(next).attempts.length, 2);
  assert.equal(next.people[0].episodes[0].collections.length, 2);
  assert.equal(collection(next).response, "Draft");
});
test("submission is accepted once and does not complete a clinical review or alter disposition", () => {
  const sent = deliver(createSeed()),
    next = submit(sent);
  assert.equal(collection(next).response, "Submitted");
  assert.equal(collection(next).assignment, "Fulfilled");
  assert.equal(collection(next).review, "Pending");
  assert.equal(next.people[0].episodes[0].disposition, "Admitted");
  assert.deepEqual(submit(next), next);
});

test("supported tablet completion does not create a clinical review task", () => {
  const started = reducer(deliver(createSeed()), {
    ...ctx,
    type: "DELIVER",
    channel: "Clinic tablet",
    respondent: "Person",
    assistance: "Supported",
  });
  const next = reducer(started, {
    ...ctx,
    type: "SUBMIT",
    channel: "Clinic tablet",
    attemptId: collection(started).attempts.at(-1)?.id,
    answers: createSampleAnswers({
      participation: "In person",
      support: "A little support",
      next: "My next steps",
    }),
  });
  assert.equal(collection(next).review, "Not required");
  assert.equal(
    getTasks(next).some((task) => task.collection?.id === collection(next).id),
    false,
  );
});
test("withdrawal revokes active links and prevents later delivery or submission", () => {
  let s = deliver(createSeed());
  s = reducer(s, {
    ...ctx,
    type: "CONSENT",
    consent: "Withdrawn",
    contact: "Suitable",
  });
  assert.equal(collection(s).link, "Revoked");
  assert.deepEqual(deliver(s), s);
  assert.deepEqual(submit(s), s);
});

test("consent requests are sent before a participant decision and retain withdrawal history", () => {
  const state = createSeed();
  const sent = reducer(state, {
    ...ctx,
    type: "CONSENT_SEND",
    consentId: "service-improvement",
    channel: "SMS link",
  });
  const request = sent.people[0].consentRequests[0];
  assert.equal(request.status, "Sent");
  assert.equal(sent.people[0].consent, "Recorded");
  const accepted = reducer(sent, {
    ...ctx,
    type: "CONSENT_DECISION",
    consentRequestId: request.id,
    status: "Accepted",
  });
  assert.equal(accepted.people[0].consentRequests[0].status, "Accepted");
  const withdrawn = reducer(accepted, {
    ...ctx,
    type: "CONSENT_WITHDRAW",
    consentRequestId: request.id,
  });
  const finalRequest = withdrawn.people[0].consentRequests[0];
  assert.equal(finalRequest.status, "Withdrawn");
  assert.deepEqual(
    finalRequest.history.map((entry) => entry.status),
    ["Sent", "Accepted", "Withdrawn"],
  );
  assert.equal(withdrawn.people[0].consent, "Recorded");
});

test("declining assessment participation blocks only that consent's future collection", () => {
  const state = createSeed();
  state.people[0].consentRequests = [];
  const sent = reducer(state, {
    ...ctx,
    type: "CONSENT_SEND",
    consentId: "assessment-participation",
    channel: "SMS link",
  });
  const request = sent.people[0].consentRequests[0];
  const declined = reducer(sent, {
    ...ctx,
    type: "CONSENT_DECISION",
    consentRequestId: request.id,
    status: "Declined",
  });
  assert.equal(declined.people[0].consent, "Not recorded");
  assert.equal(declined.people[0].consentRequests[0].status, "Declined");
  assert.deepEqual(deliver(declined), declined);
});
test("episode closure cancels outstanding work and preserves historical responses", () => {
  const seed = deliver(createSeed());
  const closed = reducer(seed, {
    ...ctx,
    type: "EPISODE",
    status: "Closed",
    reason: "Sample handover completed",
    end: "2026-09-12",
    closureCategory: "Transferred or handed over",
    handoverStatus: "Confirmed",
    handoverDestination: "Sample receiving service",
    receivingResponsiblePerson: "Sample receiving team",
    handoverConfirmedAt: "2026-09-12T11:00",
    handoverConfirmationReference: "Sample handover confirmation",
    finalMeasureStatus: "Recorded missing",
  });
  const oldCollection = closed.people[0].episodes[0].collections.find((item) => item.id === ctx.collectionId);
  assert.equal(oldCollection.assignment, "Cancelled");
  assert.equal(closed.people[0].episodes[0].end, "2026-09-12");
  assert.equal(
    closed.people[0].episodes[0].closureCategory,
    "Transferred or handed over",
  );
  assert.equal(closed.people[0].episodes[0].handoverStatus, "Confirmed");
  assert.equal(
    closed.people[0].episodes[0].handoverDestination,
    "Sample receiving service",
  );
  assert.equal(
    closed.people[0].episodes[0].receivingResponsiblePerson,
    "Sample receiving team",
  );
  assert.equal(
    closed.people[0].episodes[0].finalMeasureStatus,
    "Recorded missing",
  );
  assert.equal(oldCollection.link, "Revoked");
  const closureCollections = closed.people[0].episodes[0].collections.filter((item) => item.closureKind);
  assert.deepEqual(closureCollections.map((item) => item.closureKind), ["assessment", "feedback"]);
  assert.ok(closureCollections.every((item) => item.assignment === "Active" && item.link === "Active"));
  assert.ok(closureCollections.every((item) => item.attempts[0].status === "Prepared (sample; not sent)"));
  assert.deepEqual(
    closed.people[0].episodes[0].collections[0],
    seed.people[0].episodes[0].collections[0],
  );
  assert.equal(
    getTasks(closed).some((t) => t.person.id === ctx.personId),
    true,
  );
  assert.deepEqual(submit(closed), closed);
});
test("a patient can answer closure questionnaires after the episode closes", () => {
  const seed = createSeed();
  const person = seed.people.find((item) => item.id === "YS-DEMO-CLOSE");
  const episode = person.episodes[0];
  assert.equal(episode.status, "Closed");
  assert.equal(person.intakes[0].consentRecorded, true);
  assert.equal(person.intakes[0].reviewer, "Jess Taylor");
  assert.equal(episode.programStream, "General");
  assert.equal(episode.carePeriods[0].careLevel, "Mid");
  assert.equal(episode.carePeriods[0].endDateExclusive, "2026-09-13");
  assert.equal(episode.collections.filter((item) => item.readOnly).length, 4);
  assert.equal(episode.reportOutcomeMeasures.find((item) => item.key === "k10-plus").records.length, 2);
  assert.equal(episode.progressReport.sources.length, 4);
  assert.ok(episode.events.some((item) => item.title === "Care plan agreed"));
  assert.deepEqual(
    careEventEntries(person, episode).filter((item) => item.actionType === "ADD_CARE_EVENT").map((item) => item.title).sort(),
    ["Care episode closed", "Care episode started", "Care plan agreed", "Care progress reviewed"].sort(),
  );
  const historical = episode.collections.find((item) => item.readOnly);
  assert.equal(responseEditError(seed, {
    type: "EDIT_RESPONSE", personId: person.id, episodeId: episode.id,
    collectionId: historical.id, expectedRevision: 0,
    answers: historical.answers, reason: "Fictional correction",
  }), "This historical assessment is view only.");
  for (const item of episode.collections.filter((candidate) => candidate.closureKind)) {
    assert.equal(canCollectInEpisode(episode, item), true);
    const instrument = getInstrument(item.version);
    const answers = instrument.questions.map((question) => question.options[0]);
    const before = seed;
    const after = reducer(before, {
      type: "SUBMIT",
      personId: person.id,
      episodeId: episode.id,
      collectionId: item.id,
      attemptId: item.attempts[0].id,
      channel: "SMS link",
      answers,
    });
    const saved = after.people.find((candidate) => candidate.id === person.id).episodes[0].collections.find((candidate) => candidate.id === item.id);
    assert.equal(saved.response, "Submitted");
    assert.equal(saved.review, item.closureKind === "feedback" ? "Not required" : "Pending");
    assert.equal(after.people.find((candidate) => candidate.id === person.id).episodes[0].status, "Closed");
    assert.deepEqual(reducer(after, {
      type: "SUBMIT", personId: person.id, episodeId: episode.id,
      collectionId: item.id, answers,
    }), after);
  }
});
test("a closed care episode completes only after both closure responses and clinical review", () => {
  const submitClosure = (state, kind) => {
    const person = state.people.find((item) => item.id === "YS-DEMO-CLOSE");
    const episode = person.episodes[0];
    const item = episode.collections.find((candidate) => candidate.closureKind === kind);
    return reducer(state, {
      type: "SUBMIT", personId: person.id, episodeId: episode.id,
      collectionId: item.id, attemptId: item.attempts.at(-1).id,
      channel: "SMS link",
      answers: getInstrument(item.version).questions.map((question) => question.options[0]),
    });
  };
  for (const order of [["assessment", "feedback"], ["feedback", "assessment"]]) {
    let state = createSeed();
    state = submitClosure(state, order[0]);
    let episode = state.people.find((item) => item.id === "YS-DEMO-CLOSE").episodes[0];
    assert.equal(episode.status, "Closed");
    state = submitClosure(state, order[1]);
    episode = state.people.find((item) => item.id === "YS-DEMO-CLOSE").episodes[0];
    assert.equal(episode.status, "Closed");
    const assessment = episode.collections.find((item) => item.closureKind === "assessment");
    assert.equal(assessment.review, "Pending");
    assert.equal(getTasks(state).some((task) => task.collection?.id === assessment.id), true);

    state = reducer(state, {
      type: "REVIEW", personId: "YS-DEMO-CLOSE", episodeId: episode.id,
      collectionId: assessment.id, note: "Fictional closure response reviewed.",
    });
    episode = state.people.find((item) => item.id === "YS-DEMO-CLOSE").episodes[0];
    assert.equal(episode.status, "Completed");
    assert.equal(episode.end, "2026-09-12");
    assert.ok(episode.completedAt);
    assert.equal(episode.events.filter((item) => item.actionType === "COMPLETE_CARE_EPISODE").length, 1);
    assert.equal(getTasks(state).some((task) => task.episode?.id === episode.id), false);
    assert.equal(canCollectInEpisode(episode, assessment), false);
  }
});
test("correcting a completed closure assessment restores review work before completing again", () => {
  const seed = createSeed();
  const person = seed.people.find((item) => item.id === "YS-DEMO-CLOSE");
  const episode = person.episodes[0];
  const assessment = episode.collections.find((item) => item.closureKind === "assessment");
  const feedback = episode.collections.find((item) => item.closureKind === "feedback");
  let state = seed;
  for (const item of [assessment, feedback]) state = reducer(state, {
    type: "SUBMIT", personId: person.id, episodeId: episode.id,
    collectionId: item.id, attemptId: item.attempts.at(-1).id, channel: "SMS link",
    answers: getInstrument(item.version).questions.map((question) => question.options[0]),
  });
  state = reducer(state, {
    type: "REVIEW", personId: person.id, episodeId: episode.id,
    collectionId: assessment.id, note: "Fictional closure response reviewed.",
  });
  const completed = state.people.find((item) => item.id === person.id).episodes[0];
  const savedAssessment = completed.collections.find((item) => item.id === assessment.id);
  const changedAnswers = [...savedAssessment.answers];
  changedAnswers[0] = getInstrument(savedAssessment.version).questions[0].options[1];
  state = reducer(state, {
    type: "EDIT_RESPONSE", personId: person.id, episodeId: episode.id,
    collectionId: assessment.id, expectedRevision: savedAssessment.revision ?? 0,
    answers: changedAnswers, reason: "Correct the fictional answer", source: "Fictional follow-up",
  });
  const pending = state.people.find((item) => item.id === person.id).episodes[0];
  assert.equal(pending.status, "Closed");
  assert.equal(pending.completedAt, null);
  assert.equal(getTasks(state).some((task) => task.collection?.id === assessment.id), true);
  state = reducer(state, {
    type: "REVIEW", personId: person.id, episodeId: episode.id,
    collectionId: assessment.id, note: "Corrected response reviewed.",
  });
  const recompleted = state.people.find((item) => item.id === person.id).episodes[0];
  assert.equal(recompleted.status, "Completed");
  assert.equal(recompleted.events.filter((item) => item.actionType === "COMPLETE_CARE_EPISODE").length, 2);
});
test("saved Leila example gains historical evidence without replacing closure activity", () => {
  const saved = createSeed();
  const person = saved.people.find((item) => item.id === "YS-DEMO-CLOSE");
  const episode = person.episodes[0];
  const closure = episode.collections.find((item) => item.closureKind === "assessment");
  closure.attempts.push({ id: "local-sample-attempt", date: TODAY, status: "Prepared (sample; not sent)", channel: "SMS link" });
  episode.collections = episode.collections.filter((item) => item.closureKind);
  episode.carePeriods = [];
  episode.reportOutcomeMeasures = [];
  delete episode.progressReport;
  person.closureFixtureRevision = 2;
  const savedEvent = episode.events.find((item) => item.id === "E-YS-DEMO-CLOSE-plan");
  delete savedEvent.actionType;
  delete savedEvent.eventDate;
  const upgraded = upgradeSampleData(saved);
  const restored = upgraded.people.find((item) => item.id === person.id).episodes[0];
  assert.equal(restored.collections.filter((item) => item.readOnly).length, 4);
  assert.equal(restored.collections.find((item) => item.id === closure.id).attempts.at(-1).id, "local-sample-attempt");
  assert.equal(restored.progressReport.sources.length, 4);
  assert.equal(restored.carePeriods[0].careLevel, "Mid");
  assert.ok(careEventEntries(upgraded.people.find((item) => item.id === person.id), restored).some((item) => item.title === "Care plan agreed"));
});
test("care-period closure rejects incomplete or invalid structured closure details", () => {
  const state = createSeed();
  const action = {
    ...ctx,
    type: "EPISODE",
    status: "Closed",
    reason: "Sample decision",
    end: TODAY,
    closureCategory: "Transferred or handed over",
    handoverStatus: "Confirmed",
    handoverDestination: "Sample receiving service",
    receivingResponsiblePerson: "Sample receiving team",
    handoverConfirmedAt: "2026-09-15T11:00",
    handoverConfirmationReference: "Sample handover confirmation",
    finalMeasureStatus: "Complete",
  };
  assert.notEqual(reducer(state, action), state);
  assert.equal(reducer(state, { ...action, closureCategory: "" }), state);
  assert.equal(reducer(state, { ...action, end: "2025-01-01" }), state);
  assert.equal(reducer(state, { ...action, end: "2026-02-31" }), state);
  assert.equal(reducer(state, { ...action, handoverDestination: "" }), state);
  assert.equal(reducer(state, { ...action, receivingResponsiblePerson: "" }), state);
  assert.equal(reducer(state, { ...action, handoverConfirmedAt: "" }), state);
  assert.equal(
    reducer(state, { ...action, handoverConfirmationReference: "" }),
    state,
  );
  assert.equal(reducer(state, { ...action, finalMeasureStatus: "" }), state);
});
test("correction retains provenance and does not reopen any collection", () => {
  const seed = submit(deliver(createSeed()));
  const corrected = reducer(seed, {
    type: "CORRECT",
    personId: ctx.personId,
    issueId: "DQ-001",
    value: "2009-04-19",
    source: "Verified sample referral",
    reason: "Transcription correction",
  });
  assert.equal(corrected.people[0].dob, "2009-04-19");
  assert.equal(corrected.issues[0].status, "Resolved");
  assert.match(corrected.audit[0].detail, /2009-04-18 → 2009-04-19/);
  assert.deepEqual(corrected.people[0].episodes, seed.people[0].episodes);
});
test("data-quality workflow assigns ownership, retains a comment and audits status progression", () => {
  const seed = createSeed();
  const action = {
    type: "UPDATE_QUALITY_ISSUE",
    personId: "YS-1024",
    issueId: "DQ-001",
    owner: "Ananya",
    status: "In Progress",
    dueDate: "2026-09-17",
    comment: "Requested the verified referral record for comparison.",
  };
  assert.equal(qualityWorkflowError(seed, action), null);
  const next = reducer(seed, action);
  const issue = next.issues.find((item) => item.id === "DQ-001");
  assert.equal(issue.status, "In Progress");
  assert.equal(issue.owner, "Ananya");
  assert.match(issue.history[0].detail, /verified referral/);
  assert.equal(next.audit[0].type, "data-quality-workflow");
  assert.match(
    qualityWorkflowError(seed, { ...action, status: "Resolved" }),
    /Correct the underlying data/,
  );
});
test("unknown participation and inappropriate family roles block collection", () => {
  const seed = createSeed();
  seed.people[0].consent = "Not recorded";
  assert.deepEqual(deliver(seed), seed);
  const next = createSeed();
  assert.deepEqual(
    reducer(next, {
      type: "DELIVER",
      personId: "YS-1026",
      episodeId: "EP-1026-01",
      collectionId: "A-2-current",
      channel: "SMS link",
      respondent: "Family respondent",
      assistance: "Independent",
    }),
    next,
  );
});
test("clinical review requires a submitted response and a review note", () => {
  let seed = createSeed();
  assert.deepEqual(
    reducer(seed, { ...ctx, type: "REVIEW", note: "Premature review" }),
    seed,
  );
  seed = submit(deliver(seed));
  assert.deepEqual(reducer(seed, { ...ctx, type: "REVIEW", note: " " }), seed);
  const reviewed = reducer(seed, {
    ...ctx,
    type: "REVIEW",
    note: "Sample response reviewed; discuss at next contact.",
  });
  assert.equal(collection(reviewed).review, "Reviewed");
  assert.equal(collection(reviewed).response, "Submitted");
});

const editAction = (overrides = {}) => ({
  ...ctx,
  type: "EDIT_RESPONSE",
  expectedRevision: 0,
  answers: createSampleAnswers({
    participation: "On my own device",
    support: "A little support",
    next: "My next steps",
  }),
  reason: "Correct a transcription error",
  source: "Sample source",
  ...overrides,
});
test("both staff roles edit with complete immutable provenance and audit records", () => {
  for (const staffId of ["jess", "ananya"]) {
    const seed = { ...submit(deliver(createSeed())), staffId };
    const before = structuredClone(seed);
    const edited = reducer(seed, editAction());
    assert.deepEqual(seed, before);
    const c = collection(edited),
      original = collection(seed),
      log = edited.audit[0];
    assert.equal(c.answers[0], "On my own device");
    assert.deepEqual(c.originalAnswers, original.answers);
    for (const key of [
      "respondent",
      "recorder",
      "assistance",
      "version",
      "submittedAt",
      "response",
      "assignment",
      "link",
      "attempts",
    ])
      assert.deepEqual(c[key], original[key]);
    assert.equal(log.actorId, staffId);
    assert.equal(log.role, staffId === "jess" ? "Clinician" : "Data Manager");
    assert.ok(log.actor);
    assert.ok(!Number.isNaN(Date.parse(log.timestamp)));
    assert.equal(log.personId, ctx.personId);
    assert.equal(log.episodeId, ctx.episodeId);
    assert.equal(log.collectionId, ctx.collectionId);
    assert.equal(log.reason, "Correct a transcription error");
    assert.equal(log.source, "Sample source");
    assert.equal(log.respondent, original.respondent);
    assert.equal(log.recorder, original.recorder);
    assert.equal(log.changes.length, 2);
    assert.equal(log.changes[1].newValue, "Yes");
    assert.equal(log.changes[0].priorValue, "In person");
    assert.equal(log.changes[0].newValue, "On my own device");
    assert.equal(log.priorRevision, 0);
    assert.equal(log.revision, 1);
  }
});
test("successive edits preserve original answers and all earlier audit events", () => {
  const seed = submit(deliver(createSeed()));
  const first = reducer(seed, editAction());
  const second = reducer(
    first,
    editAction({
      expectedRevision: 1,
      answers: createSampleAnswers({
        participation: "Prefer not to answer",
        support: "A little support",
        next: "My next steps",
      }),
    }),
  );
  assert.deepEqual(
    collection(second).originalAnswers,
    collection(seed).answers,
  );
  assert.deepEqual(second.audit[1], first.audit[0]);
  assert.equal(second.audit[0].changes[0].priorValue, "On my own device");
  assert.equal(second.audit[0].revision, 2);
});
test("invalid, unchanged, stale, missing-reason and unauthorised edits change nothing", () => {
  const seed = submit(deliver(createSeed()));
  for (const action of [
    editAction({ reason: "  " }),
    editAction({ answers: collection(seed).answers }),
    editAction({ answers: ["invalid", "A little support", "My next steps"] }),
    editAction({ answers: [] }),
    editAction({ answers: null }),
    editAction({ expectedRevision: 7 }),
    editAction({ personId: "unknown" }),
  ]) {
    assert.ok(responseEditError(seed, action));
    assert.equal(reducer(seed, action), seed);
  }
  const denied = { ...seed, staffId: "participant" };
  assert.equal(reducer(denied, editAction()), denied);
  const draft = createSeed();
  assert.equal(reducer(draft, editAction()), draft);
  const unknownVersion = structuredClone(seed);
  collection(unknownVersion).version = "Unavailable version";
  assert.equal(reducer(unknownVersion, editAction()), unknownVersion);
});
test("two editors cannot silently save over the same response revision", () => {
  const first = reducer(submit(deliver(createSeed())), editAction());
  const secondEditor = { ...first, staffId: "ananya" };
  assert.match(responseEditError(secondEditor, editAction()), /changed/);
  assert.equal(reducer(secondEditor, editAction()), secondEditor);
});
test("edited reviewed answers re-enter review work while keeping prior clinical evidence", () => {
  const reviewed = reducer(submit(deliver(createSeed())), {
    ...ctx,
    type: "REVIEW",
    note: "Original review",
  });
  const edited = reducer(reviewed, editAction());
  assert.equal(collection(edited).review, "Reviewed");
  assert.equal(collection(edited).reviewNote, "Original review");
  assert.equal(collection(edited).needsReview, true);
  assert.ok(
    getTasks(edited).some(
      (task) =>
        task.collection?.id === ctx.collectionId &&
        task.status === "Ready for review",
    ),
  );
  const reviewAction = {
    ...ctx,
    type: "REVIEW",
    note: "Re-reviewed corrected answers",
  };
  const manager = { ...edited, staffId: "ananya" };
  assert.equal(reducer(manager, reviewAction), manager);
  const rereviewed = reducer(edited, reviewAction);
  assert.equal(collection(rereviewed).needsReview, false);
  assert.equal(collection(rereviewed).reviewRevision, 1);
  assert.equal(collection(rereviewed).reviewHistory[0].note, "Original review");
  assert.equal(collection(rereviewed).reviewHistory[0].revision, 0);
  assert.deepEqual(rereviewed.audit, edited.audit);
});
test("historical submitted responses can be corrected without reopening closed care", () => {
  const seed = createSeed(),
    person = seed.people.find((p) => p.id === "YS-1027"),
    episode = person.episodes[1],
    c = episode.collections[0];
  const edited = reducer(
    seed,
    editAction({
      personId: person.id,
      episodeId: episode.id,
      collectionId: c.id,
    }),
  );
  const history = edited.people.find((p) => p.id === person.id).episodes[1];
  assert.equal(history.status, "Closed");
  assert.equal(history.collections[0].response, "Submitted");
  assert.equal(history.collections[0].assignment, "Fulfilled");
  assert.equal(history.collections[0].answers[0], "On my own device");
  assert.equal(
    getTasks(edited).some((task) => task.episode?.id === episode.id),
    false,
  );
});

test("submitted sample records have a coherent delivery and submission history", () => {
  for (const p of createSeed().people) {
    for (const episode of p.episodes) {
      for (const c of episode.collections.filter(
        (c) => c.response === "Submitted",
      )) {
        const attempt = c.attempts.find((a) => a.id === c.submittedAttemptId);
        assert.ok(attempt, c.id);
        assert.equal(attempt.channel, c.channel);
        assert.ok(episode.start <= attempt.date);
        assert.ok(attempt.date <= c.submittedAt);
        if (c.reviewDate) assert.ok(c.submittedAt <= c.reviewDate);
        assert.equal(collectionActor(p, c, "respondent"), p.name);
        assert.equal(collectionActor(p, c, "recorder"), p.name);
      }
    }
  }
});

test("reset mock responses use available questionnaire versions and coherent sample history", () => {
  const saved = createSeed();
  saved.sampleRevision = 2;
  const upgraded = upgradeSampleData(saved);
  for (const person of upgraded.people)
    for (const episode of person.episodes)
      for (const response of episode.collections) {
        const instrument = getInstrument(response.version);
        assert.ok(instrument, response.version);
        if (response.response === "Submitted") {
          assert.equal(response.answers.length, instrument.questions.length);
          assert.equal(
            questionnaireState(instrument, response.answers).complete,
            true,
          );
          assert.ok(response.submittedAt);
        }
      }
});

test("revision four mock data gains longitudinal Likert responses once", () => {
  const saved = createSeed();
  const mia = saved.people.find((person) => person.name === "Mia Robinson");
  mia.episodes[0].collections = mia.episodes[0].collections.filter(
    (collection) => collection.version !== LIKERT_INSTRUMENT.version,
  );
  saved.sampleRevision = 4;
  saved.audit.push({ id: "preserved-edit" });
  const before = structuredClone(saved);
  const migrated = upgradeSampleData(saved);
  const migratedMia = migrated.people.find(
    (person) => person.name === "Mia Robinson",
  );
  assert.deepEqual(saved, before);
  assert.equal(migrated.sampleRevision, 28);
  assert.equal(
    migratedMia.episodes[0].collections.filter(
      (collection) => collection.version === LIKERT_INSTRUMENT.version,
    ).length,
    4,
  );
  assert.ok(migrated.audit.some((entry) => entry.id === "preserved-edit"));
  assert.equal(upgradeSampleData(migrated), migrated);
});

test("new collections retain named respondents and the staff member who entered answers", () => {
  const seed = { ...createSeed(), staffId: "jess" };
  const started = reducer(seed, {
    ...ctx,
    type: "DELIVER",
    channel: "Clinician entry",
    respondent: "Family respondent",
    assistance: "Transcribed",
  });
  assert.equal(collection(started).respondentName, "Deb Thompson");
  assert.equal(collection(started).recorderName, "Jess Taylor");
  assert.equal(collection(started).recorder, "Jess Taylor");
  const completed = reducer(started, {
    ...ctx,
    type: "SUBMIT",
    answers: createSampleAnswers({}),
    channel: "Clinician entry",
    attemptId: collection(started).attempts.at(-1).id,
  });
  assert.equal(
    collection(completed).submittedAttemptId,
    collection(completed).attempts.at(-1).id,
  );
  const edited = reducer({ ...completed, staffId: "ananya" }, editAction());
  assert.equal(collection(edited).respondentName, "Deb Thompson");
  assert.equal(collection(edited).recorderName, "Jess Taylor");
});

test("review labels follow the current answers through editing and re-review", () => {
  assert.equal(
    clinicalReviewStatus(collection(createSeed())),
    "Awaiting response",
  );
  const submitted = submit(deliver(createSeed()));
  assert.equal(clinicalReviewStatus(collection(submitted)), "Pending");
  const reviewed = reducer(submitted, {
    ...ctx,
    type: "REVIEW",
    note: "Earlier review",
  });
  const edited = reducer(reviewed, editAction());
  assert.equal(clinicalReviewStatus(collection(edited)), "Re-review required");
  const completed = reducer(edited, {
    ...ctx,
    type: "REVIEW",
    note: "Reviewed current answers",
  });
  assert.equal(clinicalReviewStatus(collection(completed)), "Reviewed");
  assert.equal(collection(completed).reviewHistory[0].note, "Earlier review");
});

test("record displays resolve actual names while preserving recorded notes", () => {
  const person = createSeed().people[0];
  assert.equal(
    collectionActor(person, { respondent: "Person" }, "respondent"),
    "Kai Thompson",
  );
  assert.equal(
    collectionActor(
      person,
      { respondent: "Family respondent", respondentName: "Deb Thompson" },
      "respondent",
    ),
    "Deb Thompson",
  );
  assert.equal(
    personEventText(
      person,
      "Initial assessment · Person · clinical review pending",
    ),
    "Initial assessment · Kai Thompson · clinical review pending",
  );
  assert.equal(
    personEventText(
      person,
      "Note: Person was the wording on the original form.",
    ),
    "Note: Person was the wording on the original form.",
  );
});

test("stored participant roles upgrade without losing saved responses or authored reports", () => {
  const state = createSeed();
  delete state.terminologyRevision;
  const c = collection(state);
  c.respondent = c.recorder = "Young person";
  state.people[0].episodes[0].progressReport = {
    revision: 2,
    content: { summary: "Saved clinician summary" },
    sources: [
      {
        respondent: c.respondent,
        recorder: c.recorder,
        answers: [...c.answers],
      },
    ],
  };
  const upgraded = upgradeSampleData(state);
  assert.equal(collection(upgraded).respondent, "Person");
  assert.equal(collection(upgraded).recorder, "Person");
  assert.deepEqual(collection(upgraded).answers, c.answers);
  const report = upgraded.people[0].episodes[0].progressReport;
  assert.equal(report.revision, 2);
  assert.equal(report.content.summary, "Saved clinician summary");
  assert.equal(report.sources[0].respondent, "Person");
  assert.equal(report.sources[0].recorder, "Person");
  assert.equal(c.respondent, "Young person");
  assert.equal(upgradeSampleData(upgraded), upgraded);
});
