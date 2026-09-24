import test from "node:test";
import assert from "node:assert/strict";
import { assessmentTypeGroups } from "./assessmentGroups.js";
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
