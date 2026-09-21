import test from "node:test";
import assert from "node:assert/strict";
import {
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
