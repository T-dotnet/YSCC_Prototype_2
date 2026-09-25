import test from "node:test";
import assert from "node:assert/strict";
import { changeLogEntries, clinicalHistoryEntries } from "./activity.js";
import { createSeed, reducer, TODAY } from "./model.js";

const context = {
  personId: "YS-1024",
  episodeId: "EP-1024-01",
};

const outcomeRecord = {
  ...context,
  type: "ADD_CLINICAL_RECORD",
  recordType: "outcome",
  recordDate: TODAY,
  measureKey: "k10-plus",
  measureRespondent: "Person",
  collectionPoint: "Review",
  outcomeStatus: "Complete",
  measureValue: "24",
  source: "Completed measure",
  impact: "Repeat collection planned for the next review.",
  notes: "Raw value retained pending approved scoring rules.",
};

test("a structured outcome record retains its collection occasion and source", () => {
  const next = reducer(createSeed(), outcomeRecord);
  const record = next.people[0].episodes[0].clinicalRecords[0];
  assert.equal(record.recordType, "outcome");
  assert.equal(record.recordDate, TODAY);
  assert.equal(record.fields.measureName, "Kessler 10+ (K10+)");
  assert.equal(record.fields.measureVersion, "PMHC-MDS K10+ current");
  assert.equal(record.fields.measureRespondent, "Person");
  assert.equal(record.fields.collectionPoint, "Review");
  assert.equal(record.fields.measureValue, "24");
  assert.equal(record.fields.source, "Completed measure");
  assert.equal(record.fields.impact, "Repeat collection planned for the next review.");
  assert.equal(record.actor, "Jess Taylor");
});

test("structured records appear in care-period history and the change log", () => {
  const next = reducer(createSeed(), outcomeRecord);
  const person = next.people[0];
  const episode = person.episodes[0];
  const record = clinicalHistoryEntries(person, episode, next.audit).find(
    (entry) => entry.type === "clinical-record",
  );
  assert.equal(record.title, "Kessler 10+ (K10+)");
  assert.equal(record.scope, "Structured care record");
  assert.ok(record.changes.some((change) => change.label === "Recorded value"));
  const logged = changeLogEntries(person, episode, next.audit).find(
    (entry) => entry.type === "clinical-record",
  );
  assert.ok(logged.changes.some((change) => change.label === "Source or authority"));
  assert.ok(logged.changes.some((change) => change.label === "Impact on care or coordination"));
});

test("structured records reject unsupported values, missing sources and closed care periods", () => {
  const state = createSeed();
  assert.equal(
    reducer(state, { ...outcomeRecord, source: "" }),
    state,
  );
  assert.equal(
    reducer(state, { ...outcomeRecord, outcomeStatus: "Complete", measureValue: "" }),
    state,
  );
  assert.equal(
    reducer(state, {
      ...outcomeRecord,
      measureKey: "iar-dst",
      outcomeStatus: "Complete",
    }),
    state,
  );
  assert.equal(
    reducer(state, {
      ...outcomeRecord,
      outcomeStatus: "Not collected — unavailable",
      measureValue: "",
    }),
    state,
  );
  assert.equal(
    reducer(state, { ...outcomeRecord, recordDate: "2026-02-31" }),
    state,
  );
  const closed = structuredClone(state);
  closed.people[0].episodes[0].status = "Closed";
  assert.equal(reducer(closed, outcomeRecord), closed);
});

test("a single medication form stores changes, courses and adverse observations without requiring a subtype", () => {
  const state = createSeed();
  const courseStartDate = state.people[0].episodes[0].start;
  const action = {
    ...context,
    type: "ADD_CLINICAL_RECORD",
    recordType: "medication",
    recordDate: TODAY,
    medicationName: "Medicine A",
    medicationChange: "Reviewed",
    dose: "10 mg daily",
    courseStartDate,
    courseEndDate: TODAY,
    courseStatus: "Completed",
    adverseEvent: "Rash observed",
    adverseEventDate: courseStartDate,
    source: "Medication log",
  };
  const next = reducer(state, action);
  assert.notEqual(next, state);
  const record = next.people[0].episodes[0].clinicalRecords[0];
  assert.equal(record.fields.medicationChange, "Reviewed");
  assert.equal(record.fields.courseStartDate, courseStartDate);
  assert.equal(record.fields.courseEndDate, TODAY);
  assert.equal(record.fields.adverseEvent, "Rash observed");
  assert.equal(record.fields.adverseEventDate, courseStartDate);
  assert.equal(reducer(state, { ...action, medicationChange: "", courseStartDate: "", courseEndDate: "", adverseEvent: "" }), state);
  assert.equal(reducer(state, { ...action, courseStartDate: "" }), state);
  assert.equal(reducer(state, { ...action, adverseEvent: "" }), state);
});
