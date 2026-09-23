import assert from "node:assert/strict";
import test from "node:test";
import { latestCareEventsByType } from "./careEvents.js";

test("the overview event summary lists every current type and its latest record", () => {
  const episode = {
    events: [
      {
        id: "housing-earlier",
        actionType: "ADD_CARE_EVENT",
        eventType: "housing",
        eventDate: "2026-07-10",
      },
      {
        id: "housing-latest",
        actionType: "CORRECT_CARE_EVENT",
        eventType: "housing",
        eventDate: "2026-08-10",
      },
      {
        id: "legacy-medication",
        actionType: "ADD_CARE_EVENT",
        eventType: "medication",
        eventDate: "2026-08-12",
      },
    ],
  };

  const summary = latestCareEventsByType(episode);

  assert.deepEqual(
    summary.map(({ value }) => value),
    [
      "indirect-activity",
      "harm",
      "medication-adverse",
      "housing",
      "care-transition",
      "other",
    ],
  );
  assert.equal(
    summary.find(({ value }) => value === "housing").event.id,
    "housing-latest",
  );
  assert.equal(summary.find(({ value }) => value === "harm").event, null);
});
