import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createSeed, upgradeSampleData, TODAY } from "./model.js";
import { assessmentDueByType, assessmentDueLabel, assessmentsWithDueVisibility } from "./assessmentDue.js";
import { getInstrument, questionnaireState } from "./instruments.js";

const episode = (state) => state.people.find((person) => person.id === "YS-1034").episodes[0];
const example = (state, key) => episode(state).collections.find((collection) => collection.id === `A-7-due-example-${key}`);
const yesterday = new Date(Date.parse(`${TODAY}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);

test("mock assessments show today, past due, future and all three draft visibility cases", () => {
  const state = createSeed();
  const collections = episode(state).collections;
  const due = assessmentDueByType(collections, TODAY);
  const visible = new Set(assessmentsWithDueVisibility(collections, TODAY, due).map((collection) => collection.id));
  assert.equal(assessmentDueLabel(example(state, "k10-past"), TODAY), "Past due");
  assert.equal(assessmentDueLabel(example(state, "k5-today"), TODAY), "Due today");
  assert.equal(assessmentDueLabel(example(state, "sdq-draft"), TODAY), null);
  assert.equal(visible.has(example(state, "sdq-next").id), false);
  assert.equal(visible.has(example(state, "sidas-next").id), true);
  assert.equal(visible.has(example(state, "who5-next").id), true);
  assert.equal(assessmentDueLabel(example(state, "sidas-draft"), TODAY), "Past due");
  assert.equal(assessmentDueLabel(example(state, "who5-draft"), TODAY), "Due today");
  assert.equal(due.get("sdq").id, example(state, "sdq-draft").id);
  assert.equal(due.get("sidas").id, example(state, "sidas-next").id);
  assert.equal(due.get("who-5").id, example(state, "who5-next").id);
  for (const key of ["sdq-draft", "sidas-draft", "who5-draft"]) {
    const collection = example(state, key);
    assert.equal(questionnaireState(getInstrument(collection.version), collection.draftAnswers).answered, 2);
    assert.equal(collection.attempts.length, 1);
    assert.equal(Object.keys(collection.draftAnswerSources).length, 2);
    assert.deepEqual(collection.answers, []);
  }
  assert.equal(state.settings.scheduleAssessments, false);
  assert.equal(upgradeSampleData(state), state);
});

test("saved workspaces gain examples without resetting current records, contacts, scores or settings", () => {
  const saved = createSeed();
  const care = episode(saved);
  care.collections = care.collections.filter((collection) => !collection.sampleDueExampleDate);
  care.collections.find((collection) => collection.id === "A-7-life-care-sixteen-weeks").response = "Draft";
  saved.settings.showAssessmentDueDates = true;
  const original = structuredClone(care);
  const upgraded = upgradeSampleData(saved);
  assert.deepEqual(episode(upgraded).collections.filter((collection) => !collection.sampleDueExampleDate), original.collections);
  assert.equal(episode(upgraded).collections.filter((collection) => collection.sampleDueExampleDate).length, 8);
  assert.deepEqual(episode(upgraded).appointments, original.appointments);
  assert.deepEqual(episode(upgraded).reportOutcomeMeasures, original.reportOutcomeMeasures);
  assert.deepEqual(upgraded.settings, saved.settings);
  assert.equal(upgradeSampleData(upgraded), upgraded);
});

test("untouched examples roll with today while edited dates and saved draft work remain unchanged", () => {
  const moduleUrl = new URL("./model.js", import.meta.url).href;
  const saved = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e",
    `import {createSeed} from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(createSeed()));`],
  { env: { ...process.env, YSCC_TEST_DATE: yesterday }, encoding: "utf8" }));
  const edited = example(saved, "k10-past");
  edited.due = "2026-08-15";
  const draft = example(saved, "sdq-draft");
  draft.attempts[0].savedAt = `${yesterday}T11:30:00Z`;
  const unchanged = structuredClone([edited, draft]);
  const upgraded = upgradeSampleData(saved);
  assert.equal(example(upgraded, "k5-today").due, TODAY);
  assert.equal(example(upgraded, "who5-draft").due, TODAY);
  assert.deepEqual([example(upgraded, "k10-past"), example(upgraded, "sdq-draft")], unchanged);
  assert.equal(upgradeSampleData(upgraded), upgraded);
});

test("closed care episodes do not receive new pending examples", () => {
  const saved = createSeed();
  const care = episode(saved);
  care.collections = care.collections.filter((collection) => !collection.sampleDueExampleDate);
  care.status = "Closed";
  const count = care.collections.length;
  assert.equal(episode(upgradeSampleData(saved)).collections.length, count);
});
