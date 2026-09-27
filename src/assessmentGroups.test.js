import test from "node:test";
import assert from "node:assert/strict";
import { assessmentTypeGroups, prioritizeSimpleAssessmentGroups } from "./assessmentGroups.js";
import { createSeed } from "./model.js";

test("grouped assessments compare linked raw scores with the previous scored response", () => {
  const episode = createSeed().people.find((person) => person.id === "YS-1034").episodes[0];
  const groups = assessmentTypeGroups(episode, episode.collections);
  assert.equal(groups.find((group) => group.key === "k10-plus").scoreChange, 1);
  assert.equal(groups.find((group) => group.key === "sdq").scoreChange, -2);
  assert.equal(groups.find((group) => group.key === "who-5").scoreChange, 8);
  assert.equal(groups.find((group) => group.key === "Life and care check-in").scoreChange, null);

  const latestK10 = episode.collections.find((collection) =>
    collection.id === "A-7-measure-k10-plus-latest");
  assert.equal(assessmentTypeGroups(episode, [latestK10])[0].scoreChange, 1);
});

test("no arrow value is derived when a previous linked score is unavailable", () => {
  const episode = createSeed().people.find((person) => person.id === "YS-1034").episodes[0];
  const k10 = episode.reportOutcomeMeasures.find((measure) => measure.key === "k10-plus");
  k10.records = k10.records.filter((record) => record.id.endsWith("latest"));
  const group = assessmentTypeGroups(episode, episode.collections)
    .find((item) => item.key === "k10-plus");
  assert.equal(group.score, 27);
  assert.equal(group.scoreChange, null);
});

test("created and draft assessments precede completed rows and groups", () => {
  const episode = createSeed().people.find((person) => person.id === "YS-1034").episodes[0];
  const lifeDraft = episode.collections.find((col) => col.id === "A-7-life-care-sixteen-weeks");
  lifeDraft.response = "Draft";
  const k10 = episode.collections.find((col) => col.id === "A-7-measure-k10-plus-latest");
  episode.collections.push({
    ...k10,
    id: "A-7-measure-k10-plus-created-example",
    label: "Kessler 10+ (K10+) · follow-up",
    response: "Not started",
    createdAt: "2026-09-25T09:00:00Z",
    submittedAt: null,
    attempts: [],
  });

  const display = prioritizeSimpleAssessmentGroups(
    assessmentTypeGroups(episode, episode.collections), episode.collections);
  assert.deepEqual(display.slice(0, 2).map((group) => group.key), ["Life and care check-in", "k10-plus"]);
  assert.equal(display[0].records[0].id, lifeDraft.id);
  assert.equal(display[1].records[0].id, "A-7-measure-k10-plus-created-example");
  assert.ok(display.slice(2).every((group) => group.records.every((col) => col.response === "Submitted")));

  const completed = episode.collections.filter((col) => col.response === "Submitted");
  const completedGroups = assessmentTypeGroups(episode, completed);
  const completedDisplay = prioritizeSimpleAssessmentGroups(completedGroups, completed);
  assert.deepEqual(completedDisplay.map((group) => group.key), completedGroups.map((group) => group.key));
});
