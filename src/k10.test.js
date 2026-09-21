import assert from "node:assert/strict";
import test from "node:test";
import { createSeed, upgradeSampleData } from "./model.js";
import { k10RawTotal, k10Series, K10_SCORING_METHOD } from "./k10.js";

test("fictional full-report person has independent dated courses, goals and reproducible K10 totals", () => {
  const state = createSeed();
  const jordan = state.people.find((person) => person.id === "YS-1034");
  const episode = jordan.episodes[0];
  const mia = state.people.find((person) => person.id === "YS-1029");
  assert.equal(jordan.fixtureLabel, "Fictional full-report example");
  assert.equal(
    episode.collections.filter((item) => item.response === "Submitted").length,
    8,
  );
  assert.equal(episode.medicationCourses.length, 2);
  assert.equal(episode.goalMilestones.length, 3);
  assert.deepEqual(
    episode.reportOutcomeMeasures.map((measure) => measure.key),
    ["k10-plus", "k5", "sdq", "sidas", "who-5", "iar-dst"],
  );
  assert.ok(
    episode.reportOutcomeMeasures.every((measure) => measure.records.length === 3),
  );
  assert.ok(
    episode.reportOutcomeMeasures.some((measure) =>
      measure.records.some(
        (record) => record.status === "Incomplete — follow-up required",
      ),
    ),
  );
  assert.deepEqual(
    k10Series(episode).points.map((point) => point.total),
    [33, 29, 26, 27],
  );
  assert.equal(k10Series(mia.episodes[0]).points.length, 0);
  const saved = structuredClone(state);
  saved.sampleRevision = 14;
  saved.people.find((person) => person.id === jordan.id).episodes[0].reportOutcomeMeasures = [];
  const upgraded = upgradeSampleData(saved);
  assert.equal(
    upgraded.people.filter((person) => person.id === jordan.id).length,
    1,
  );
  assert.equal(
    upgraded.people.find((person) => person.id === jordan.id).episodes[0]
      .reportOutcomeMeasures.length,
    6,
  );
  assert.equal(upgradeSampleData(upgraded), upgraded);
});

test("K10 totals require the pinned method, ten complete 1–5 items and a submitted dated response", () => {
  const record = {
    date: "2026-06-16",
    response: "Submitted",
    scoringMethod: K10_SCORING_METHOD,
    answers: Array(10).fill(3),
  };
  assert.equal(k10RawTotal(record), 30);
  assert.equal(
    k10RawTotal({ ...record, answers: [...record.answers.slice(0, 9), null] }),
    null,
  );
  assert.equal(k10RawTotal({ ...record, answers: Array(9).fill(3) }), null);
  assert.equal(k10RawTotal({ ...record, scoringMethod: "0–4 variant" }), null);
  assert.equal(k10RawTotal({ ...record, response: "Draft" }), null);
  assert.equal(k10RawTotal({ ...record, date: "2026-02-30" }), null);
});
