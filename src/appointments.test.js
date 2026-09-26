import test from "node:test";
import assert from "node:assert/strict";
import { activityEntries, careEventEntries, changeLogEntries } from "./activity.js";
import { appointmentDetails, appointmentMatchesCollectionDate } from "./appointments.js";
import { associatedCareItems, historyItem } from "./historyItem.js";
import { assessmentsForContact, contactsForAssessment } from "./assessmentContacts.js";
import { DEMO_INSTRUMENT, INITIAL_ASSESSMENT_INSTRUMENT } from "./instruments.js";
import { createSampleAnswers } from "./sampleQuestionnaires.js";
import {
  practitionerServiceOptions,
  reducer,
  TODAY,
  upgradeSampleData,
} from "./model.js";
import { emptyDraftSeed as createSeed } from "./testFixtures.js";

const context = {
  personId: "YS-1024",
  episodeId: "EP-1024-01",
  collectionId: "A-0-current",
};

const attendedContact = {
  ...context,
  type: "ADD_APPOINTMENT",
  plannedDate: TODAY,
  plannedTime: "09:00",
  plannedDurationMinutes: "60",
  practitionerService: "Jess Taylor · Northside Centre",
  deliveryMode: "In person",
  attendance: "Attended",
  actualDate: TODAY,
  actualTime: "09:10",
  actualDurationMinutes: "45",
  recipientType: "Related person",
  relatedPersonName: "Deb Thompson",
  contactType: "Family work",
  primaryPractitioner: "Jess Taylor",
  additionalPractitioners: "Alex Lee, Sam Chen",
  participants: "With family",
  venue: "Community",
  postcode: "3000",
  registeredUnit: "Northside Centre",
  servicingUnit: "Northside Centre",
  deliveringUnit: "Outreach pod",
  interpreter: "Yes",
  copayment: "No",
  fundingSource: "YSCC",
  finalContact: "No",
  notes: "Sample local appointment record.",
};

const plannedContact = {
  ...context,
  type: "ADD_APPOINTMENT",
  plannedDate: "2026-09-10",
  plannedTime: "09:00",
  plannedDurationMinutes: "60",
  practitionerService: "Jess Taylor · Northside Centre",
  deliveryMode: "In person",
  attendance: "Planned",
  notes: "Awaiting outcome.",
};

test("an attended appointment retains planned and actual contact details", () => {
  const state = createSeed();
  const next = reducer(state, attendedContact);
  const appointment = next.people[0].episodes[0].appointments[0];
  assert.equal(appointment.plannedDate, TODAY);
  assert.equal(appointment.plannedTime, "09:00");
  assert.equal(appointment.actualTime, "09:10");
  assert.equal(appointment.actualDurationMinutes, 45);
  assert.equal(appointment.attendance, "Attended");
  assert.equal(appointment.recipientType, "Related person");
  assert.equal(appointment.relatedPersonName, "Deb Thompson");
  assert.equal(appointment.contactType, "Family work");
  assert.equal(appointment.primaryPractitioner, "Jess Taylor");
  assert.deepEqual(appointment.additionalPractitioners, ["Alex Lee", "Sam Chen"]);
  assert.equal(appointment.deliveringUnit, "Outreach pod");
  assert.equal(appointment.interpreter, "Yes");
  assert.equal(appointment.actor, "Jess Taylor");
  assert.equal(contactsForAssessment(next.people[0].episodes[0], context.collectionId)
    .some((item) => item.id === appointment.id), true);
});

test("an SMS contact is saved and appears in the contact timeline", () => {
  const next = reducer(createSeed(), {
    ...attendedContact,
    deliveryMode: "SMS",
    contactType: "Other direct contact",
    recipientType: "Young person",
    relatedPersonName: "",
    actualDurationMinutes: "5",
  });
  const person = next.people[0];
  const episode = person.episodes[0];
  const contact = episode.appointments.find((item) => item.deliveryMode === "SMS");
  assert.ok(contact);
  assert.equal(contact.attendance, "Attended");
  assert.equal(contact.actualDurationMinutes, 5);
  assert.ok(activityEntries(person, episode, next.audit)
    .some((entry) => entry.type === "appointment" && entry.detail.includes("SMS")));
});

test("a new attended contact retains factual care context in its source details", () => {
  const next = reducer(createSeed(), {
    ...attendedContact,
    collectionId: null,
    purpose: "Review support options after the assessment.",
    impact: "Follow-up contact agreed for next week.",
  });
  const episode = next.people[0].episodes[0];
  const appointment = episode.appointments[0];
  assert.equal(appointment.purpose, "Review support options after the assessment.");
  assert.equal(appointment.impact, "Follow-up contact agreed for next week.");
  assert.ok(appointmentDetails(appointment, episode)
    .some(([label, value]) => label === "Impact on care or coordination" && value === appointment.impact));
});

test("practitioner and service choices are drawn from existing care-directory data", () => {
  const options = practitionerServiceOptions([
    {
      referrals: [{ destination: "Youth support service" }],
      episodes: [
        {
          appointments: [
            { practitionerService: "Existing clinician · Partner service" },
          ],
          servicePeriods: [{ label: "Group programme" }],
        },
      ],
    },
  ]);
  assert.ok(options.includes("Jess Taylor · Northside Centre"));
  assert.ok(options.includes("Youth support service"));
  assert.ok(options.includes("Existing clinician · Partner service"));
  assert.ok(options.includes("Group programme"));
});

test("appointment records appear in care-period history and change log", () => {
  const next = reducer(createSeed(), attendedContact);
  const person = next.people[0];
  const episode = person.episodes[0];
  const history = activityEntries(person, episode, next.audit);
  const appointment = history.find((entry) => entry.type === "appointment");
  assert.equal(appointment.title, "Service contact attended");
  assert.match(appointment.detail, /Jess Taylor · Northside Centre/);
  assert.equal(appointment.scope, "Contact");
  const changes = changeLogEntries(person, episode, next.audit).find(
    (entry) => entry.type === "appointment",
  );
  assert.ok(changes.changes.some((change) => change.label === "Attendance"));
  assert.ok(changes.changes.some((change) => change.label === "Actual duration"));
  assert.ok(changes.changes.some((change) => change.label === "Recipient"));
  assert.ok(changes.changes.some((change) => change.label === "Primary practitioner"));
});

test("appointment records reject invalid actual contacts and closed care periods", () => {
  const state = createSeed();
  assert.equal(
    reducer(state, { ...attendedContact, actualDate: "2026-02-31" }),
    state,
  );
  assert.equal(
    reducer(state, { ...attendedContact, actualDurationMinutes: "0" }),
    state,
  );
  const closed = structuredClone(state);
  closed.people[0].episodes[0].status = "Closed";
  assert.equal(reducer(closed, attendedContact), closed);
  assert.equal(reducer(state, { ...attendedContact, primaryPractitioner: "" }), state);
  assert.equal(reducer(state, { ...attendedContact, relatedPersonName: "" }), state);
});

test("appointment records reject a duplicate planned date, time and service", () => {
  const state = reducer(createSeed(), plannedContact);
  assert.equal(reducer(state, plannedContact), state);
});

test("a contact can link multiple assessments and an assessment can link multiple contacts", () => {
  const state = createSeed();
  const collections = state.people[0].episodes[0].collections;
  collections.push({
    ...collections.find((item) => item.id === "A-0-current"),
    id: "A-0-current-extra",
    label: "Support network review",
    attempts: [],
  });
  const action = {
    ...plannedContact,
    id: "APT-linked-review",
    plannedDate: "2026-09-12",
    plannedTime: "13:00",
    collectionIds: ["A-0-current", "A-0-current-extra"],
  };
  const next = reducer(state, action);
  const episode = next.people[0].episodes[0];
  const appointment = episode.appointments.find((item) => item.id === action.id);
  const assessments = episode.collections.filter((item) => action.collectionIds.includes(item.id));
  assert.ok(appointment);
  assert.equal(assessments.length, 2);
  assert.ok(assessments.every((assessment) => assessment.appointmentId === appointment.id));
  assert.ok(appointmentDetails(appointment, episode).some(([label, value]) =>
    label === "Associated assignments" && assessments.every((assessment) => value.includes(assessment.label))));
  const entry = careEventEntries(next.people[0], episode, next.audit)
    .find((item) => item.id === `assessment-${assessments[0].id}`);
  assert.ok(associatedCareItems(entry, episode).some((item) =>
    item.id === appointment.id));
  const second = reducer(next, {
    ...action, id: "APT-second-review", plannedDate: "2026-09-11", plannedTime: "14:00",
  });
  const secondEpisode = second.people[0].episodes[0];
  assert.notEqual(second, next);
  assert.equal(contactsForAssessment(secondEpisode, assessments[0].id).length, 2);
  assert.equal(assessmentsForContact(secondEpisode, "APT-second-review").length, 2);
  assert.equal(secondEpisode.collections.find((item) => item.id === assessments[0].id).appointmentId,
    "APT-linked-review");
  assert.equal(reducer(state, { ...action, collectionIds: ["A-0-current", "missing"] }), state);
  const linked = reducer(second, {
    ...context, type: "LINK_ASSESSMENT_CONTACT", collectionId: "A-0-current",
    appointmentId: secondEpisode.appointments.find((item) => item.id !== "APT-second-review" && item.id !== "APT-linked-review").id,
  });
  assert.equal(contactsForAssessment(linked.people[0].episodes[0], "A-0-current").length, 3);
});

test("a response identifies its source contact while other linked contacts remain", () => {
  const first = reducer(createSeed(), {
    ...plannedContact, id: "APT-source-first", plannedTime: "13:00",
    collectionIds: [context.collectionId],
  });
  const second = reducer(first, {
    ...plannedContact, id: "APT-source-second", plannedDate: TODAY, plannedTime: "14:00",
    collectionIds: [context.collectionId],
  });
  const cancelled = reducer(second, {
    ...context, type: "RECORD_APPOINTMENT_OUTCOME",
    appointmentId: "APT-source-first", attendance: "Cancelled",
  });
  const delivered = reducer(cancelled, {
    ...context, type: "DELIVER", channel: "Clinic tablet", respondent: "Person",
    assistance: "Independent", externalAppointment: null,
    appointmentId: "APT-source-second",
  });
  const episode = delivered.people[0].episodes[0];
  const assessment = episode.collections.find((item) => item.id === context.collectionId);
  assert.equal(assessment.attempts.at(-1).appointmentId, "APT-source-second");
  assert.deepEqual(contactsForAssessment(episode, context.collectionId)
    .filter((item) => item.id.startsWith("APT-source-")).map((item) => item.id).sort(),
    ["APT-source-first", "APT-source-second"]);
  const submitted = reducer(delivered, {
    ...context, type: "SUBMIT", answers: createSampleAnswers({}),
  });
  assert.equal(submitted.people[0].episodes[0].collections
    .find((item) => item.id === context.collectionId).submittedAppointmentId,
    "APT-source-second");
});

test("linking a contact to an unassigned attempt preserves its channel and assistance", () => {
  const state = reducer(createSeed(), {
    ...attendedContact, id: "APT-attempt-contact", plannedTime: "12:00", actualTime: "12:10",
  });
  const collection = state.people[0].episodes[0].collections.find((item) => item.id === context.collectionId);
  collection.attempts.push({
    id: "attempt-without-contact", date: TODAY, channel: "Clinic tablet",
    assistance: "Supported", status: "Session started (sample)",
  });
  collection.submittedAttemptId = "attempt-without-contact";
  collection.submittedAppointmentId = null;
  const planned = reducer(state, {
    ...plannedContact, id: "APT-not-yet-attended", plannedTime: "15:00", collectionIds: [],
  });
  assert.equal(reducer(planned, {
    ...context, type: "LINK_ASSESSMENT_CONTACT", appointmentId: "APT-not-yet-attended",
    attemptId: "attempt-without-contact",
  }), planned);
  const linked = reducer(state, {
    ...context, type: "LINK_ASSESSMENT_CONTACT", appointmentId: "APT-attempt-contact",
    attemptId: "attempt-without-contact",
  });
  const updated = linked.people[0].episodes[0].collections.find((item) => item.id === context.collectionId);
  assert.equal(updated.attempts.at(-1).appointmentId, "APT-attempt-contact");
  assert.equal(updated.attempts.at(-1).channel, "Clinic tablet");
  assert.equal(updated.attempts.at(-1).assistance, "Supported");
  assert.equal(updated.submittedAppointmentId, "APT-attempt-contact");
  assert.equal(contactsForAssessment(linked.people[0].episodes[0], context.collectionId)
    .some((item) => item.id === "APT-attempt-contact"), true);
  const anotherContact = reducer(linked, {
    ...plannedContact, id: "APT-related-only", plannedTime: "16:00", collectionIds: [],
  });
  const relatedOnly = reducer(anotherContact, {
    ...context, type: "LINK_ASSESSMENT_CONTACT", appointmentId: "APT-related-only",
  });
  const relatedCollection = relatedOnly.people[0].episodes[0].collections
    .find((item) => item.id === context.collectionId);
  assert.equal(relatedCollection.submittedAppointmentId, "APT-attempt-contact");
  assert.equal(relatedCollection.attempts.at(-1).appointmentId, "APT-attempt-contact");
  assert.equal(reducer(linked, {
    ...context, type: "LINK_ASSESSMENT_CONTACT", appointmentId: "APT-attempt-contact",
    attemptId: "attempt-without-contact",
  }), linked);
});

test("multiple contacts can contribute to the initial assessment without reassigning its questionnaire", () => {
  const state = createSeed();
  const intake = state.people[0].intakes.find((item) => item.episodeId === context.episodeId);
  assert.ok(intake);
  const first = reducer(state, {
    ...plannedContact, id: "APT-initial-one", plannedDate: "2026-09-26",
    assessmentIntakeId: intake.id, collectionIds: [],
  });
  const second = reducer(first, {
    ...plannedContact, id: "APT-initial-two", plannedDate: "2026-09-27",
    assessmentIntakeId: intake.id, collectionIds: [],
  });
  const episode = second.people[0].episodes[0];
  assert.equal(episode.appointments.filter((item) => item.assessmentIntakeId === intake.id).length, 2);
  assert.deepEqual(episode.collections, state.people[0].episodes[0].collections);
  const cancelled = reducer(second, {
    ...context, type: "RECORD_APPOINTMENT_OUTCOME", appointmentId: "APT-initial-two",
    attendance: "Cancelled", assessmentIntakeId: null,
  });
  assert.equal(cancelled.people[0].episodes[0].appointments
    .filter((item) => item.assessmentIntakeId === intake.id).length, 1);
  assert.equal(reducer(first, {
    ...plannedContact, id: "APT-invalid-assessment", plannedDate: "2026-09-28",
    assessmentIntakeId: "another-persons-intake", collectionIds: [],
  }), first);
});

test("saving a contact creates and links selected new assessments", () => {
  const state = createSeed();
  const versions = [INITIAL_ASSESSMENT_INSTRUMENT.version, DEMO_INSTRUMENT.version];
  const action = {
    ...plannedContact,
    id: "APT-new-assessments",
    plannedDate: "2026-09-13",
    plannedTime: "15:00",
    collectionIds: [],
    newAssessmentVersions: versions,
  };
  const before = state.people[0].episodes[0].collections.length;
  const next = reducer(state, action);
  const episode = next.people[0].episodes[0];
  const created = episode.collections.slice(before);
  assert.equal(created.length, 2);
  assert.deepEqual(created.map((item) => item.version), versions);
  assert.ok(created.every((item) => item.appointmentId === action.id &&
    item.due === action.plannedDate && item.assignment === "Planned"));
  assert.ok(appointmentDetails(episode.appointments[0], episode).some(([label, value]) =>
    label === "Associated assignments" && created.every((item) => value.includes(item.label))));
  const attended = reducer(state, {
    ...attendedContact,
    collectionIds: [],
    newAssessmentVersions: [versions[0]],
  });
  const attendedEpisode = attended.people[0].episodes[0];
  assert.equal(attendedEpisode.collections.at(-1).due, attendedContact.actualDate);
  assert.equal(attendedEpisode.collections.at(-1).appointmentId, attendedEpisode.appointments[0].id);
  assert.equal(reducer(state, { ...action, newAssessmentVersions: ["Unknown v1.0"] }), state);
  assert.equal(reducer(state, { ...action, newAssessmentVersions: [versions[0], versions[0]] }), state);
});

test("a planned contact can be updated once with an attendance outcome", () => {
  const plannedState = reducer(createSeed(), plannedContact);
  const appointment = plannedState.people[0].episodes[0].appointments[0];
  const next = reducer(plannedState, {
    ...context,
    type: "RECORD_APPOINTMENT_OUTCOME",
    appointmentId: appointment.id,
    attendance: "Attended",
    actualDate: TODAY,
    actualTime: "09:15",
    actualDurationMinutes: "50",
    recipientType: "Young person",
    contactType: "Care review",
    primaryPractitioner: "Jess Taylor",
    participants: "Individual",
    venue: "Clinic",
    finalContact: "No",
    outcomeNotes: "Completed planned contact.",
  });
  const updated = next.people[0].episodes[0].appointments[0];
  assert.equal(updated.id, appointment.id);
  assert.equal(updated.attendance, "Attended");
  assert.equal(updated.actualDurationMinutes, 50);
  assert.equal(updated.contactType, "Care review");
  assert.equal(updated.primaryPractitioner, "Jess Taylor");
  assert.equal(updated.outcomeNotes, "Completed planned contact.");
  assert.ok(updated.outcomeRecordedAt);
  assert.equal(
    reducer(next, {
      ...context,
      type: "RECORD_APPOINTMENT_OUTCOME",
      appointmentId: appointment.id,
      attendance: "Did not attend",
    }),
    next,
  );
});

test("cancelling an assessment-day appointment preserves its record and does not link a new session to it", () => {
  const appointmentId = "APT-assessment-day-test";
  const added = reducer(createSeed(), {
    ...plannedContact,
    id: appointmentId,
    plannedDate: TODAY,
  });
  const edited = reducer(added, {
    ...context,
    type: "UPDATE_APPOINTMENT",
    appointmentId,
    plannedTime: "11:30",
    plannedDurationMinutes: 45,
    deliveryMode: "Video",
  });
  const cancelled = reducer(edited, {
    ...context,
    type: "RECORD_APPOINTMENT_OUTCOME",
    appointmentId,
    attendance: "Cancelled",
    outcomeNotes: "Rescheduled with the family.",
  });
  const appointment = cancelled.people[0].episodes[0].appointments.find(
    (item) => item.id === appointmentId,
  );
  assert.equal(appointment.plannedTime, "11:30");
  assert.equal(appointment.plannedDurationMinutes, 45);
  assert.equal(appointment.deliveryMode, "Video");
  assert.equal(appointment.attendance, "Cancelled");
  assert.equal(appointment.outcomeNotes, "Rescheduled with the family.");

  const delivered = reducer(cancelled, {
    ...context,
    type: "DELIVER",
    channel: "Clinic tablet",
    respondent: "Person",
    assistance: "Independent",
  });
  const collection = delivered.people[0].episodes[0].collections.find(
    (item) => item.id === context.collectionId,
  );
  assert.notEqual(collection.appointmentId, appointmentId);
  assert.equal(collection.attempts.at(-1).appointmentId, collection.appointmentId);
});

test("an appointment outcome must be current and within the active care period", () => {
  const plannedState = reducer(createSeed(), plannedContact);
  const appointment = plannedState.people[0].episodes[0].appointments[0];
  const invalidActual = {
    ...context,
    type: "RECORD_APPOINTMENT_OUTCOME",
    appointmentId: appointment.id,
    attendance: "Attended",
    actualDate: "2026-09-16",
    actualTime: "09:15",
    actualDurationMinutes: "50",
  };
  assert.equal(reducer(plannedState, invalidActual), plannedState);
  const closed = structuredClone(plannedState);
  closed.people[0].episodes[0].status = "Closed";
  assert.equal(reducer(closed, { ...invalidActual, actualDate: TODAY }), closed);
});

test("Jordan's fictional full-report fixture shows every appointment status and delivery mode", () => {
  const jordan = createSeed().people.find((person) => person.id === "YS-1034");
  const appointments = jordan.episodes[0].appointments;
  assert.deepEqual(
    new Set(appointments.map((appointment) => appointment.attendance)),
    new Set(["Planned", "Attended", "Cancelled", "Did not attend"]),
  );
  assert.deepEqual(
    new Set(appointments.map((appointment) => appointment.deliveryMode)),
    new Set([
      "In person",
      "Phone",
      "Video",
      "SMS",
      "Outreach or community",
      "Other",
    ]),
  );
  assert.equal(appointments.filter((appointment) => appointment.attendance === "Planned").length, 2);
  assert.ok(appointments.some((appointment) => appointment.plannedDate < TODAY && appointment.attendance === "Planned"));
});

test("Jordan shows multiple contacts for an assessment and multiple assessments for a contact", () => {
  const episode = createSeed().people.find((person) => person.id === "YS-1034").episodes[0];
  const assessment = episode.collections.find((item) => item.id === "A-7-life-care-twelve-weeks");
  assert.deepEqual(new Set(contactsForAssessment(episode, assessment.id).map((item) => item.id)),
    new Set(["APT-7-sms-check-in", "APT-7-twelve-weeks", "APT-7-attended", "APT-7-upcoming-plan"]));
  assert.equal(assessment.submittedAppointmentId, "APT-7-twelve-weeks");
  assert.equal(assessment.due, "2026-09-08");
  assert.deepEqual(assessment.attempts.map((item) => [item.channel, item.assistance]), [
    ["SMS link", "Independent"], ["Clinic tablet", "Independent"],
  ]);
  assert.equal(assessment.attempts[0].appointmentId, "APT-7-sms-check-in");
  assert.equal(assessment.submittedAttemptId, assessment.attempts[1].id);
  const sourceIds = Object.values(assessment.answerSources);
  assert.equal(sourceIds.filter((id) => id === assessment.attempts[0].id).length, 2);
  assert.equal(sourceIds.filter((id) => id === assessment.attempts[1].id).length, 4);
  assert.deepEqual(new Set(assessmentsForContact(episode, "APT-7-attended").map((item) => item.id)),
    new Set(["A-7-life-care-twelve-weeks", "A-7-everyday-life-twelve-weeks"]));
  assert.deepEqual(assessmentsForContact(episode, "APT-7-upcoming-plan").map((item) => item.id),
    ["A-7-life-care-twelve-weeks", "A-7-life-care-sixteen-weeks"]);
  assert.equal(assessmentsForContact(episode, "APT-7-cancelled").length, 0);
  assert.equal(assessmentsForContact(episode, "APT-7-dna").length, 0);
});

test("saved Jordan data gains missing example links once without replacing custom links", () => {
  const saved = createSeed();
  const episode = saved.people.find((person) => person.id === "YS-1034").episodes[0];
  episode.assessmentContactLinks = [{
    collectionId: "A-7-life-care-eight-weeks", appointmentId: "APT-7-attended",
  }];
  const upgraded = upgradeSampleData(saved);
  const updated = upgraded.people.find((person) => person.id === "YS-1034").episodes[0];
  assert.equal(updated.assessmentContactLinks.length, 5);
  assert.equal(contactsForAssessment(updated, "A-7-life-care-eight-weeks")
    .some((item) => item.id === "APT-7-attended"), true);
  assert.equal(contactsForAssessment(updated, "A-7-life-care-twelve-weeks").length, 4);
  assert.equal(upgradeSampleData(upgraded), upgraded);
});

test("saved Jordan assessment gains the earlier delivery example without replacing custom attempts", () => {
  const saved = createSeed();
  const collection = saved.people.find((person) => person.id === "YS-1034")
    .episodes[0].collections.find((item) => item.id === "A-7-life-care-twelve-weeks");
  const submittedAttempt = collection.attempts[1];
  collection.attempts = [submittedAttempt];
  const upgraded = upgradeSampleData(saved);
  const updated = upgraded.people.find((person) => person.id === "YS-1034")
    .episodes[0].collections.find((item) => item.id === collection.id);
  assert.equal(updated.attempts.length, 2);
  assert.equal(upgradeSampleData(upgraded), upgraded);
  const custom = structuredClone(saved);
  const customCollection = custom.people.find((person) => person.id === "YS-1034")
    .episodes[0].collections.find((item) => item.id === collection.id);
  customCollection.attempts.unshift({ id: "user-attempt", date: "2026-09-05", channel: "SMS link" });
  assert.equal(upgradeSampleData(custom), custom);
});

test("Jordan's old sample source attribution is normalised to the partial SMS example", () => {
  const saved = createSeed();
  const collection = saved.people.find((person) => person.id === "YS-1034")
    .episodes[0].collections.find((item) => item.id === "A-7-life-care-twelve-weeks");
  const questionIds = Object.keys(collection.answerSources);
  for (const id of questionIds.slice(0, 3)) collection.answerSources[id] = collection.attempts[0].id;
  collection.attempts[0].status = "Progress saved (fictional example)";
  const upgraded = upgradeSampleData(saved);
  const updated = upgraded.people.find((person) => person.id === "YS-1034")
    .episodes[0].collections.find((item) => item.id === collection.id);
  assert.equal(Object.values(updated.answerSources).filter((id) => id === updated.attempts[0].id).length, 2);
  assert.equal(Object.values(updated.answerSources).filter((id) => id === updated.submittedAttemptId).length, 4);
  assert.equal(updated.attempts[0].status, "Progress saved");
  assert.equal(upgradeSampleData(upgraded), upgraded);
});

test("saved mock data gains Jordan's complete appointment fixture once", () => {
  const saved = createSeed();
  const jordan = saved.people.find((person) => person.id === "YS-1034");
  jordan.episodes[0].appointments = [];
  saved.sampleRevision = 15;
  const before = structuredClone(saved);
  const migrated = upgradeSampleData(saved);
  const migratedJordan = migrated.people.find((person) => person.id === "YS-1034");
  assert.deepEqual(saved, before);
  assert.equal(migrated.sampleRevision, 28);
  assert.equal(migratedJordan.episodes[0].appointments.length, 10);
  assert.equal(upgradeSampleData(migrated), migrated);
});

test("saved Jordan fixture corrects copied appointment notes without replacing other details", () => {
  const saved = createSeed();
  const jordan = saved.people.find((person) => person.id === "YS-1034");
  const appointments = jordan.episodes[0].appointments;
  appointments.find((item) => item.id === "APT-7-eight-weeks").outcomeNotes =
    "8-week questionnaire reviewed with Mia; agreed continuation of support plan.";
  appointments.find((item) => item.id === "APT-7-twelve-weeks").notes =
    "12-week review and longitudinal assessment battery completion.";
  appointments.find((item) => item.id === "APT-7-attended").notes = "Keep this local note.";
  const episode = jordan.episodes[0];
  const adverse = episode.events.find((item) => item.id === "E-7-med-adverse");
  Object.assign(adverse, {
    title: "Medication adverse event recorded",
    detail: "Fictional demo record of medication adverse event recorded.",
    date: "2026-08-17",
    eventDate: "2026-08-17",
    timestamp: "2026-08-17T09:00:00Z",
    fields: undefined,
  });
  episode.servicePeriods.find((item) => item.id === "SP-7-group").end = "2026-08-28";
  saved.sampleRevision = 25;

  const migrated = upgradeSampleData(saved);
  const updated = migrated.people.find((person) => person.id === "YS-1034").episodes[0].appointments;
  assert.match(updated.find((item) => item.id === "APT-7-eight-weeks").outcomeNotes, /Jordan/);
  assert.match(updated.find((item) => item.id === "APT-7-twelve-weeks").notes, /clinic tablet check-ins/);
  assert.equal(updated.find((item) => item.id === "APT-7-attended").notes, "Keep this local note.");
  const migratedEpisode = migrated.people.find((person) => person.id === "YS-1034").episodes[0];
  assert.equal(migratedEpisode.events.find((item) => item.id === "E-7-med-adverse").eventDate, "2026-08-24");
  assert.equal(migratedEpisode.servicePeriods.find((item) => item.id === "SP-7-group").end, "2026-09-12");
  assert.equal(upgradeSampleData(migrated), migrated);
});

test("Jordan's fictional events follow the recorded medication and service periods", () => {
  const episode = createSeed().people.find((person) => person.id === "YS-1034").episodes[0];
  const adverse = episode.events.find((item) => item.id === "E-7-med-adverse");
  const course = episode.medicationCourses.find((item) => item.id === "MC-7-b");
  const group = episode.servicePeriods.find((item) => item.id === "SP-7-group");
  const missed = episode.appointments.find((item) => item.id === "APT-7-dna");
  const phone = episode.appointments.find((item) => item.id === "APT-7-attended");
  assert.ok(course.start <= adverse.eventDate && adverse.eventDate <= course.end);
  assert.ok(group.start <= missed.plannedDate && missed.plannedDate <= group.end);
  assert.match(adverse.detail, /causation was not established/);
  assert.equal(phone.clinicalSummary.riskIndicator, "No risk assessment recorded in this contact");
  assert.match(phone.outcomeNotes, /23 Sep review/);
});

test("Jordan's non-SMS sample responses retain their attended source contact", () => {
  const jordan = createSeed().people.find((person) => person.id === "YS-1034");
  const episode = jordan.episodes[0];
  const entries = careEventEntries(jordan, episode);
  for (const collection of episode.collections) {
    const assessment = entries.find((entry) => entry.id === `assessment-${collection.id}`);
    const linked = associatedCareItems(assessment, episode);
    if (collection.response !== "Submitted") continue;
    if (collection.channel === "SMS link") {
      assert.equal(collection.submittedAppointmentId ?? null, null,
        `${collection.id} has no appointment response source`);
      continue;
    }
    const appointment = episode.appointments.find((item) => item.id === collection.submittedAppointmentId);
    assert.ok(appointment, `${collection.id} needs a source appointment`);
    assert.ok(linked.some((item) => item.id === appointment.id));
    assert.equal(appointment.attendance, "Attended");
    assert.ok(appointmentMatchesCollectionDate(appointment, collection));
    assert.equal(collection.appointmentId, appointment.id);
    assert.equal(collection.attempts.find((item) => item.id === collection.submittedAttemptId)?.appointmentId,
      appointment.id);
  }
  const review = entries.find((entry) => entry.id === "appointment-APT-7-twelve-weeks");
  assert.deepEqual(associatedCareItems(review, episode).map((item) => item.title),
    ["Life and care check-in · 12 weeks"]);
  assert.ok(entries.some((entry) => entry.id === "E-7-housing"));
  assert.deepEqual(associatedCareItems(entries.find((entry) => entry.id === "E-7-housing"), episode), []);
});

test("saved Jordan sample links are repaired without changing custom assessments", () => {
  const saved = createSeed();
  delete saved.jordanAssessmentAppointmentRevision;
  const episode = saved.people.find((person) => person.id === "YS-1034").episodes[0];
  const clinic = episode.collections.find((item) => item.id === "A-7-life-care-eight-weeks");
  clinic.appointmentId = null;
  clinic.submittedAppointmentId = null;
  delete clinic.attempts[0].appointmentId;
  episode.appointments = episode.appointments.filter((item) => item.id !== "APT-7-eight-weeks");
  const sms = episode.collections.find((item) => item.id === "A-7-everyday-life-four-weeks");
  sms.appointmentId = "APT-7-four-weeks";
  sms.submittedAppointmentId = "APT-7-four-weeks";
  sms.attempts[0].appointmentId = "APT-7-four-weeks";
  episode.collections.push({
    id: "A-custom", label: "Custom assessment", due: "2026-08-11",
    channel: "Clinic tablet", appointmentId: null, attempts: [],
  });

  const upgraded = upgradeSampleData(saved);
  const repaired = upgraded.people.find((person) => person.id === "YS-1034").episodes[0];
  assert.equal(repaired.collections.find((item) => item.id === clinic.id).appointmentId, "APT-7-eight-weeks");
  assert.equal(repaired.collections.find((item) => item.id === clinic.id).attempts[0].appointmentId, "APT-7-eight-weeks");
  assert.equal(repaired.appointments.filter((item) => item.id === "APT-7-eight-weeks").length, 1);
  assert.equal(repaired.collections.find((item) => item.id === sms.id).appointmentId, null);
  assert.equal(repaired.collections.find((item) => item.id === sms.id).attempts[0].appointmentId, undefined);
  assert.equal(repaired.collections.find((item) => item.id === "A-custom").appointmentId, null);
  assert.equal(clinic.appointmentId, null);
  assert.equal(upgradeSampleData(upgraded), upgraded);
});

test("Care events retain an explicit association when dates change", () => {
  const jordan = createSeed().people.find((person) => person.id === "YS-1034");
  const episode = jordan.episodes[0];
  const collection = episode.collections.find((item) => item.id === "A-7-life-care-eight-weeks");
  collection.due = "2026-09-20";
  collection.submittedAt = "2026-09-20";
  const entries = careEventEntries(jordan, episode);
  assert.ok(associatedCareItems(entries.find((item) => item.id === `assessment-${collection.id}`), episode)
    .some((item) => item.id === "APT-7-eight-weeks"));
  assert.ok(associatedCareItems(entries.find((item) => item.id === "appointment-APT-7-eight-weeks"), episode)
    .some((item) => item.id === collection.id));
});

test("delivery attempts in seeded data are linked to appointments with valid status", () => {
  const state = createSeed();
  for (const person of state.people) {
    for (const ep of person.episodes) {
      for (const c of ep.collections) {
        for (const attempt of c.attempts) {
          if (["Clinic tablet", "Clinician entry"].includes(attempt.channel)) {
            assert.ok(
              attempt.appointmentId || c.appointmentId || c.submittedAppointmentId,
              `Attempt ${attempt.id} in collection ${c.id} should have a linked appointment`,
            );
            const linkedId = attempt.appointmentId || c.appointmentId || c.submittedAppointmentId;
            const appt = (ep.appointments || []).find((a) => a.id === linkedId);
            assert.ok(appt, `Linked appointment ${linkedId} must exist in episode appointments`);
            assert.ok(appt.attendance, `Appointment ${linkedId} must have an attendance status`);
          }
        }
      }
    }
  }
});

test("planning a follow-up assessment supports linking an appointment and non-SMS channel", () => {
  const state = createSeed();
  const person = state.people[0];
  const ep = person.episodes[0];
  const apptId = "APT-followup-test-1";
  const colId = "COL-followup-test-1";

  const withAppt = reducer(state, {
    type: "ADD_APPOINTMENT",
    id: apptId,
    personId: person.id,
    episodeId: ep.id,
    plannedDate: "2026-10-20",
    plannedTime: "11:00",
    plannedDurationMinutes: 45,
    practitionerService: "Jess Taylor · Northside Centre",
    deliveryMode: "In person",
    attendance: "Planned",
    notes: "Follow-up assessment appointment",
  });

  const withFollowUp = reducer(withAppt, {
    type: "PLAN",
    id: colId,
    personId: person.id,
    episodeId: ep.id,
    label: "Mid-treatment review",
    due: "2026-10-20",
    channel: "Clinic tablet",
    assistance: "Supported",
    appointmentId: apptId,
  });

  const updatedEpisode = withFollowUp.people[0].episodes[0];
  const plannedCollection = updatedEpisode.collections.find((c) => c.id === colId);
  assert.ok(plannedCollection);
  assert.equal(plannedCollection.label, "Mid-treatment review");
  assert.equal(plannedCollection.due, "2026-10-20");
  assert.equal(plannedCollection.channel, "Clinic tablet");
  assert.equal(plannedCollection.assistance, "Supported");
  assert.equal(plannedCollection.appointmentId, apptId);
  assert.ok(updatedEpisode.appointments.some((a) => a.id === apptId));
});

test("appointment details include associated assignments if any", () => {
  const state = createSeed();
  const person = state.people[0];
  const ep = person.episodes[0];
  const appt = ep.appointments[0];
  const details = appointmentDetails(appt, ep);
  assert.ok(details.some(([label, value]) => label.includes("Associated assignment") && value.includes(ep.collections[0].label)));
});

test("same-day assessments are associated only when their appointment is recorded", () => {
  const state = createSeed();
  const jordan = state.people.find((person) => person.name === "Jordan Ellis");
  const episode = jordan.episodes[0];
  const cancelled = episode.appointments.find((item) => item.id === "APT-7-cancelled");
  const planned = episode.appointments.find((item) => item.id === "APT-7-overdue-plan");
  const completed = episode.appointments.find((item) => item.id === "APT-7-twelve-weeks");
  assert.ok(!appointmentDetails(cancelled, episode).some(([label]) => label.startsWith("Associated assignment")));
  assert.ok(!appointmentDetails(planned, episode).some(([label]) => label.startsWith("Associated assignment")));
  const linked = appointmentDetails(completed, episode).find(([label]) => label === "Associated assignment");
  assert.match(linked[1], /Life and care check-in · 12 weeks/);
  assert.doesNotMatch(linked[1], /Everyday life check-in/);
  assert.doesNotMatch(linked[1], /Kessler 10\+/);
  const history = activityEntries(jordan, episode, state.audit);
  const assessment = historyItem(history.find((item) => item.id === "appointment-APT-7-baseline"), episode);
  const cancellation = historyItem(history.find((item) => item.id === "appointment-APT-7-cancelled"), episode);
  assert.equal(assessment.subtitle, "Initial assessment");
  assert.equal(cancellation.subtitle, "Community support contact");
  assert.equal(cancellation.dateLabel, "Cancelled contact");
});
