import test from "node:test";
import assert from "node:assert/strict";
import { clinicalHistoryEntries } from "./activity.js";
import { associatedCareItems, contactCareEventFacts, historyCategory, historyItem } from "./historyItem.js";
import { measureInstrument } from "./measureQuestionnaires.js";

test("Care events list all explicitly linked assessments and appointments", () => {
  const episode = {
    appointments: [
      { id: "visit-1", attendance: "Planned", plannedDate: "2026-09-12", contactType: "Care review" },
      { id: "visit-2", attendance: "Attended", plannedDate: "2026-09-13", actualDate: "2026-09-14", contactType: "Assessment" },
    ],
    collections: [
      { id: "assessment-1", label: "90-day review", version: "Review v1", due: "2026-09-14", appointmentId: "visit-1", attempts: [{ appointmentId: "visit-2" }] },
      { id: "assessment-2", label: "Support check-in", version: "Check-in v1", due: "2026-09-12", appointmentId: "visit-1" },
    ],
  };
  const appointmentItems = associatedCareItems({ type: "appointment", id: "appointment-visit-1" }, episode);
  assert.deepEqual(appointmentItems.map((item) => item.title), ["90-day review", "Support check-in"]);
  const assessmentItems = associatedCareItems({ type: "assessment", collectionId: "assessment-1" }, episode);
  assert.deepEqual(assessmentItems.map((item) => item.id), ["visit-1", "visit-2"]);
  assert.equal(assessmentItems[1].date, "2026-09-14");
  assert.deepEqual(associatedCareItems({ type: "assessment", collectionId: "missing" }, episode), []);
});

test("Care events assessment facts use the submitted date and linked score, not a single collection method", () => {
  const collection = {
    id: "measure-1",
    label: "K10+ check-in",
    version: measureInstrument("k10-plus").version,
    due: "2026-09-10",
    submittedAt: "2026-09-08T10:00:00Z",
    response: "Submitted",
    channel: "SMS link",
  };
  const episode = {
    collections: [collection],
    reportOutcomeMeasures: [{
      key: "k10-plus",
      scoreRange: [10, 50],
      records: [{ sourceCollectionId: collection.id, status: "Complete", value: 27 }],
    }],
  };
  const entry = { type: "assessment", collectionId: collection.id, date: "2026-09-08" };
  assert.deepEqual(historyItem(entry, episode).primary, [
    { label: "Due date", value: "2026-09-10" },
    { label: "Submitted", value: "2026-09-08" },
    { label: "Score", value: "27 / 50" },
  ]);
  assert.deepEqual(historyItem(entry, {
    collections: [{ ...collection, response: "Not started", submittedAt: null }],
  }).primary.slice(1), [
    { label: "Submitted", value: "Not submitted" },
    { label: "Score", value: "Awaiting response" },
  ]);
});

test("History uses the contact date once and keeps appointment provenance available", () => {
  const appointment = {
    id: "visit-1",
    plannedDate: "2026-08-10",
    plannedTime: "10:00",
    plannedDurationMinutes: 45,
    actualDate: "2026-08-11",
    actualTime: "10:15",
    actualDurationMinutes: 40,
    attendance: "Attended",
    practitionerService: "Community team",
    deliveryMode: "In person",
    outcomeNotes: "Follow-up agreed",
    actor: "Jess Taylor",
    role: "Clinician",
    timestamp: "2026-08-12T09:00:00Z",
  };
  const episode = { appointments: [appointment], collections: [] };
  const item = historyItem({ ...appointment, id: "appointment-visit-1", type: "appointment" }, episode);
  assert.equal(item.date, "2026-08-11");
  assert.equal(historyCategory({ ...appointment, type: "appointment" }), "appointment");
  assert.deepEqual(item.primary.map(({ label }) => label), ["Practitioner or service", "Delivery mode", "Actual duration"]);
  assert.ok(![...item.primary, ...item.more].some(({ label }) => ["Actual date", "Actual time", "Attendance"].includes(label)));
  assert.ok(item.more.some(({ label, value }) => label === "Planned date" && value === "2026-08-10"));
  assert.ok(item.more.some(({ label }) => label === "Outcome notes"));
  assert.ok(item.more.some(({ label }) => label === "Recorded at"));
});

test("Care events contact summary keeps the outcome and plan differences without repeating the timeline date", () => {
  const appointment = {
    id: "visit-1",
    appointmentType: "Care review",
    plannedDate: "2026-09-08",
    plannedTime: "10:00",
    plannedDurationMinutes: 60,
    actualDate: "2026-09-08",
    actualTime: "10:05",
    actualDurationMinutes: 55,
    attendance: "Attended",
    practitionerService: "Jess Taylor",
    deliveryMode: "In person",
    notes: "Review planned with Jordan.",
    outcomeNotes: "Next review agreed.",
    timestamp: "2026-09-02T09:00:00Z",
    actor: "Jess Taylor",
  };
  const episode = { appointments: [appointment], collections: [] };
  const item = historyItem({ ...appointment, id: "appointment-visit-1", type: "appointment" }, episode);
  const summary = contactCareEventFacts(item, appointment);
  assert.deepEqual(summary.primary.map(({ label }) => label), ["Delivery mode", "Duration", "Outcome notes", "Notes"]);
  assert.equal(summary.primary.find(({ label }) => label === "Duration").value, "55 min");
  assert.deepEqual(summary.more.map(({ label }) => label), ["Planned time", "Planned duration"]);
});

test("History keeps event and record provenance while displaying the event date", () => {
  const event = {
    id: "event-1",
    title: "Housing changed",
    eventType: "housing",
    eventDate: "2026-07-20",
    timestamp: "2026-08-01T12:00:00Z",
    detail: "Temporary accommodation arranged",
    fields: { source: "Family", impact: "Contact address changed" },
    actor: "Jess Taylor",
  };
  const laterEvent = {
    id: "event-2",
    title: "Support changed",
    eventDate: "2026-07-25",
    timestamp: "2026-07-26T12:00:00Z",
  };
  const episode = { events: [event, laterEvent], appointments: [], collections: [], clinicalRecords: [] };
  const item = historyItem(event, episode);
  assert.equal(item.date, "2026-07-20");
  assert.equal(item.subtitle, "Housing instability or homelessness");
  assert.equal(historyCategory(event), "contextual-event");
  assert.ok(item.primary.some(({ label }) => label === "Impact on care"));
  assert.ok(item.more.some(({ label, value }) => label === "Recorded at" && value === event.timestamp));

  const entries = clinicalHistoryEntries({ id: "person-1", intakes: [], referrals: [] }, episode);
  assert.deepEqual(entries.map(({ id }) => id), ["event-2", "event-1"]);
});
