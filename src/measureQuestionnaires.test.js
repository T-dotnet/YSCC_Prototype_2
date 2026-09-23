import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, reducer, TODAY } from "./model.js";
import { getInstrument, INSTRUMENTS, questionnaireState } from "./instruments.js";
import { MEASURE_INSTRUMENTS, sampleMeasureTotal } from "./measureQuestionnaires.js";
import { k10Series } from "./k10.js";
import {
  measureSampleAnswers,
  measureSampleCollectionId,
  measureSampleScore,
} from "./sampleQuestionnaires.js";

test("five selectable measure forms retain the qualitative forms", () => {
  assert.deepEqual(MEASURE_INSTRUMENTS.map((item) => item.measureKey), [
    "k10-plus", "k5", "sdq", "sidas", "who-5",
  ]);
  assert.ok(INSTRUMENTS.some((item) => item.version === "Your preferences and next steps v2.0"));
  assert.ok(INSTRUMENTS.some((item) => item.version === "Everyday life v1.0"));
  for (const instrument of MEASURE_INSTRUMENTS) {
    assert.equal(getInstrument(instrument.version), instrument);
    assert.ok(instrument.description.includes("sample item capture") ||
      instrument.description.includes("sample item"));
  }
});

test("fictional measure totals are reproducible from complete linked item answers", () => {
  const expected = {
    "k10-plus": [33, 26, 27],
    k5: [11, 14, 18],
    sdq: [17, 14, 12],
    sidas: [8, 6, 4],
    "who-5": [36, 48, 56],
  };
  const phases = ["baseline", "review", "latest"];
  const episode = createSeed().people.find((person) => person.id === "YS-1034").episodes[0];
  for (const instrument of MEASURE_INSTRUMENTS) {
    const key = instrument.measureKey;
    assert.deepEqual(phases.map((phase) => measureSampleScore(key, phase)), expected[key]);
    phases.forEach((phase, index) => {
      const answers = measureSampleAnswers(key, phase);
      const collection = episode.collections.find(
        (item) => item.id === measureSampleCollectionId(key, phase),
      );
      const record = episode.reportOutcomeMeasures.find((item) => item.key === key).records[index];
      assert.equal(questionnaireState(instrument, answers).complete, true);
      assert.deepEqual(collection.answers, answers);
      assert.equal(record.sourceCollectionId, collection.id);
      assert.equal(record.value, sampleMeasureTotal(instrument, answers));
    });
  }
  assert.equal(sampleMeasureTotal(MEASURE_INSTRUMENTS[1], [null, ...measureSampleAnswers("k5", "baseline").slice(1)]), null);
});

test("a new measure response adds a linked raw score to its care-period report", () => {
  const seed = createSeed();
  const personId = seed.people[0].id;
  const episodeId = seed.people[0].episodes[0].id;
  const version = MEASURE_INSTRUMENTS.find((item) => item.measureKey === "k5").version;
  const planned = reducer(seed, {
    type: "PLAN", personId, episodeId, id: "A-live-k5", label: "K5 sample",
    due: TODAY, version,
  });
  const delivered = reducer(planned, {
    type: "DELIVER", personId, episodeId, collectionId: "A-live-k5",
    channel: "Clinic tablet", respondent: "Person", assistance: "Independent",
  });
  const saved = reducer(delivered, {
    type: "SUBMIT", personId, episodeId, collectionId: "A-live-k5",
    answers: measureSampleAnswers("k5", "baseline"),
  });
  const record = saved.people[0].episodes[0].reportOutcomeMeasures.find(
    (item) => item.key === "k5",
  ).records[0];
  assert.equal(record.value, 11);
  assert.equal(record.sourceCollectionId, "A-live-k5");
  assert.equal(record.category, null);
});

test("a submitted K10+ core response also updates the dated K10 lane", () => {
  const seed = createSeed();
  const personId = seed.people[0].id;
  const episodeId = seed.people[0].episodes[0].id;
  const version = MEASURE_INSTRUMENTS.find((item) => item.measureKey === "k10-plus").version;
  const planned = reducer(seed, {
    type: "PLAN", personId, episodeId, id: "A-live-k10", label: "K10+ sample",
    due: TODAY, version,
  });
  const delivered = reducer(planned, {
    type: "DELIVER", personId, episodeId, collectionId: "A-live-k10",
    channel: "Clinic tablet", respondent: "Person", assistance: "Independent",
  });
  const saved = reducer(delivered, {
    type: "SUBMIT", personId, episodeId, collectionId: "A-live-k10",
    answers: measureSampleAnswers("k10-plus", "baseline"),
  });
  const episode = saved.people[0].episodes[0];
  assert.equal(episode.reportOutcomeMeasures.find((item) => item.key === "k10-plus").records[0].value, 33);
  assert.equal(k10Series(episode).points[0].total, 33);
  assert.equal(k10Series(episode).points[0].sourceCollectionId, "A-live-k10");
});
