import test from "node:test";
import assert from "node:assert/strict";
import {
  episodeOutcomeRecords,
  isCompletedScore,
  outcomeMeasureCards,
  scoreChangeLabel,
} from "./outcomeMeasures.js";

const definitions = [{ key: "k5", name: "Kessler 5 (K5)" }];

test("outcome cards retain score direction and documented interpretation separately", () => {
  const [card] = outcomeMeasureCards(definitions, [
    {
      key: "k5",
      records: [
        { date: "2026-06-16", value: 14, status: "Complete" },
        {
          date: "2026-08-14",
          value: 18,
          status: "Complete",
          change: { direction: "deteriorated", label: "Deteriorated" },
        },
      ],
    },
  ]);

  assert.equal(card.displayName, "K5");
  assert.equal(card.latestScore, 18);
  assert.equal(card.scoreChange, 4);
  assert.equal(scoreChangeLabel(card.scoreChange), "+4");
  assert.equal(card.change.direction, "deteriorated");
});

test("an incomplete latest assessment remains visibly unscored", () => {
  const [card] = outcomeMeasureCards(definitions, [
    {
      key: "k5",
      records: [
        { date: "2026-06-16", value: 14, status: "Complete" },
        {
          date: "2026-09-10",
          value: null,
          status: "Incomplete — follow-up required",
          dueState: "Overdue",
        },
      ],
    },
  ]);

  assert.equal(isCompletedScore(card.latest), false);
  assert.equal(card.latestScore, null);
  assert.equal(card.scoreChange, null);
  assert.equal(card.needsFollowUp, true);
});

test("a structured outcome record feeds Report cards with a care-record source", () => {
  const episode = {
    reportOutcomeMeasures: [{ key: "k5", scoreRange: [5, 25], records: [
      { id: "assessment", date: "2026-06-16", value: 14, status: "Complete", sourceCollectionId: "A-1" },
    ] }],
    clinicalRecords: [{
      id: "C-1", recordType: "outcome", recordDate: "2026-09-10", actor: "Jess Taylor",
      fields: { measureKey: "k5", measureValue: "18", outcomeStatus: "Complete",
        collectionPoint: "Review", source: "External measure" },
    }],
  };
  const [card] = outcomeMeasureCards(definitions, episodeOutcomeRecords(episode));
  assert.equal(card.records.length, 2);
  assert.equal(card.latestScore, 18);
  assert.equal(card.latest.sourceClinicalRecordId, "C-1");
  assert.equal(card.latest.change, null);
  assert.deepEqual(episode.reportOutcomeMeasures[0].records.map((record) => record.id), ["assessment"]);
});
