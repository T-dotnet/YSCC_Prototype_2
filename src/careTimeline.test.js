import assert from "node:assert/strict";
import test from "node:test";
import { careTimelineData, timelinePosition } from "./careTimeline.js";

test("care context timeline keeps significant events together in one lane", () => {
  const timeline = careTimelineData({
    start: "2026-06-01",
    collections: [
      {
        id: "response",
        label: "Initial assessment",
        response: "Submitted",
        submittedAt: "2026-06-03T10:00:00Z",
        review: "Reviewed",
        reviewDate: "2026-06-04",
      },
      {
        id: "planned",
        label: "90-day review",
        response: "Not started",
        due: "2026-08-30",
      },
    ],
    servicePeriods: [
      {
        id: "service",
        label: "Community care",
        start: "2026-06-01",
        end: "2026-08-30",
      },
    ],
    goalMilestones: [
      {
        id: "goal",
        date: "2026-07-01",
        title: "Weekly routine",
        status: "Started",
      },
    ],
    events: [
      {
        id: "housing",
        actionType: "ADD_CARE_EVENT",
        eventType: "housing",
        eventDate: "2026-07-10",
        title: "Accommodation changed",
      },
      {
        id: "adverse",
        actionType: "ADD_CARE_EVENT",
        eventType: "medication-adverse",
        eventDate: "2026-07-12",
        title: "Medication adverse event recorded",
      },
      {
        id: "inpatient",
        actionType: "ADD_CARE_EVENT",
        eventType: "inpatient",
        eventDate: "2026-07-15",
        title: "Inpatient admission recorded",
      },
    ],
  });

  assert.equal(
    timeline.lanes.find((lane) => lane.id === "responses").entries.length,
    1,
  );
  assert.deepEqual(
    timeline.lanes.find((lane) => lane.id === "responses").entries[0],
    {
      id: "response-response",
      date: "2026-06-03",
      label: "Initial assessment",
      detail: "Submitted and reviewed",
      kind: "response",
      sourceId: "response",
      sourceType: "collection",
    },
  );
  assert.equal(
    timeline.lanes.find((lane) => lane.id === "reviews").entries.length,
    2,
  );
  assert.equal(
    timeline.lanes.find((lane) => lane.id === "services").entries[0].end,
    "2026-08-30",
  );
  assert.equal(
    timeline.riskRows.find((row) => row.id === "housing").entries.length,
    1,
  );
  assert.equal(
    timeline.riskRows.find((row) => row.id === "harm").entries.length,
    0,
  );
  assert.deepEqual(
    timeline.lanes
      .find((lane) => lane.id === "events")
      .entries.map((entry) => entry.id),
    ["event-inpatient", "event-adverse", "event-housing"],
  );
  assert.equal(
    timeline.lanes.find((lane) => lane.id === "medication").entries.length,
    0,
  );
  assert.equal(timeline.goals.length, 1);
});

test("a draft with an old submission timestamp is never plotted as submitted evidence", () => {
  const timeline = careTimelineData({
    start: "2026-06-01",
    collections: [
      {
        id: "draft",
        label: "90-day review",
        response: "Draft",
        submittedAt: "2026-06-03T10:00:00Z",
        due: "2026-08-30",
      },
    ],
  });
  assert.deepEqual(
    timeline.lanes.find((lane) => lane.id === "responses").entries,
    [],
  );
  assert.equal(
    timeline.lanes.find((lane) => lane.id === "reviews").entries[0].kind,
    "planned",
  );
});

test("timeline positions remain bounded when dates are missing or identical", () => {
  assert.equal(timelinePosition("2026-06-01", "2026-06-01", "2026-06-01"), 50);
  assert.equal(timelinePosition(null, "2026-06-01", "2026-06-10"), 0);
  assert.equal(timelinePosition("2026-06-20", "2026-06-01", "2026-06-10"), 100);
});

test("only recorded medication intervals become bars and complete K10 responses appear as dated records", () => {
  const timeline = careTimelineData({
    start: "2026-06-01",
    collections: [],
    events: [],
    medicationCourses: [
      {
        id: "course",
        label: "Medication course A",
        start: "2026-06-10",
        end: "2026-07-01",
      },
      { id: "missing-end", label: "Review only", start: "2026-07-02" },
    ],
    k10Responses: [
      {
        id: "valid",
        date: "2026-06-15",
        response: "Submitted",
        scoringMethod: "ABS NHS K10 · four-week recall · 1–5 sum",
        answers: Array(10).fill(3),
      },
      {
        id: "invalid",
        date: "2026-07-15",
        response: "Submitted",
        scoringMethod: "ABS NHS K10 · four-week recall · 1–5 sum",
        answers: Array(9).fill(3),
      },
    ],
  });
  assert.deepEqual(
    timeline.lanes
      .find((lane) => lane.id === "medication")
      .entries.map((entry) => [entry.kind, entry.end]),
    [["medication-duration", "2026-07-01"]],
  );
  assert.deepEqual(
    timeline.lanes
      .find((lane) => lane.id === "k10")
      .entries.map((entry) => entry.label),
    ["K10 raw total 30 / 50"],
  );
});
