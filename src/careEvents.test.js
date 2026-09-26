import assert from "node:assert/strict";
import test from "node:test";
import { latestCareEventsByType } from "./careEvents.js";
import { createSeed, reducer, TODAY } from "./model.js";

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

test("a care or service change retains optional period data in one source event", () => {
  const state = createSeed();
  const action = {
    type: "ADD_CARE_EVENT",
    personId: "YS-1024",
    episodeId: "EP-1024-01",
    eventType: "care-transition",
    eventDate: state.people[0].episodes[0].start,
    summary: "Programme added",
    periodName: "Community programme",
    endDate: TODAY,
    reportStatus: "Delivered",
    source: "Service log",
    notes: "Documented programme dates.",
  };
  const next = reducer(state, action);
  assert.notEqual(next, state);
  const event = next.people[0].episodes[0].events[0];
  assert.equal(event.fields.periodName, "Community programme");
  assert.equal(event.fields.endDate, TODAY);
  assert.equal(event.fields.status, "Delivered");
  assert.equal(reducer(state, { ...action, endDate: "", periodName: "" }), state);
});

test("a care or service change saves without a factual summary", () => {
  const state = createSeed();
  const action = {
    type: "ADD_CARE_EVENT",
    personId: "YS-1024",
    episodeId: "EP-1024-01",
    eventType: "care-transition",
    eventDate: state.people[0].episodes[0].start,
    source: "Service log",
    periodName: "Community programme",
  };
  const next = reducer(state, action);
  assert.notEqual(next, state);
  assert.equal(next.people[0].episodes[0].events[0].title, "Community programme · care or service change");

  const withoutPeriod = reducer(state, { ...action, periodName: "" });
  assert.notEqual(withoutPeriod, state);
  assert.equal(withoutPeriod.people[0].episodes[0].events[0].title, "Care or service change");
});
