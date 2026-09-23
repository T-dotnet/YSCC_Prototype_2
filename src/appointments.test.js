import test from "node:test";
import assert from "node:assert/strict";
import { activityEntries, changeLogEntries } from "./activity.js";
import { appointmentDetails } from "./appointments.js";
import { historyItem } from "./historyItem.js";
import {
  createSeed,
  practitionerServiceOptions,
  reducer,
  TODAY,
  upgradeSampleData,
} from "./model.js";

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
  assert.deepEqual(next.people[0].episodes[0].collections, state.people[0].episodes[0].collections);
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
  assert.equal(appointment.scope, "Appointment or service contact");
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
      "Outreach or community",
      "Other",
    ]),
  );
  assert.equal(appointments.filter((appointment) => appointment.attendance === "Planned").length, 2);
  assert.ok(appointments.some((appointment) => appointment.plannedDate < TODAY && appointment.attendance === "Planned"));
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
  assert.equal(migratedJordan.episodes[0].appointments.length, 9);
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
