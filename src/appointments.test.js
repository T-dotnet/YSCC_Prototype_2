import test from "node:test";
import assert from "node:assert/strict";
import { activityEntries, changeLogEntries } from "./activity.js";
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
  assert.equal(appointment.title, "Appointment attended");
  assert.match(appointment.detail, /Jess Taylor · Northside Centre/);
  assert.equal(appointment.scope, "Appointment or service contact");
  const changes = changeLogEntries(person, episode, next.audit).find(
    (entry) => entry.type === "appointment",
  );
  assert.ok(changes.changes.some((change) => change.label === "Attendance"));
  assert.ok(changes.changes.some((change) => change.label === "Actual duration"));
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
    outcomeNotes: "Completed planned contact.",
  });
  const updated = next.people[0].episodes[0].appointments[0];
  assert.equal(updated.id, appointment.id);
  assert.equal(updated.attendance, "Attended");
  assert.equal(updated.actualDurationMinutes, 50);
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
  assert.equal(migrated.sampleRevision, 19);
  assert.equal(migratedJordan.episodes[0].appointments.length, 5);
  assert.equal(upgradeSampleData(migrated), migrated);
});
