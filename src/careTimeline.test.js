import assert from "node:assert/strict";
import test from "node:test";
import { careTimelineData, timelineExtent, timelinePosition } from "./careTimeline.js";
import { createSeed, reducer, TODAY } from "./model.js";

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

test("the plotted range follows visible records and includes the ends of periods", () => {
  const timeline = careTimelineData({
    start: "2026-06-15",
    collections: [{
      id: "future-review",
      label: "Future review",
      response: "Not started",
      due: "2027-10-13",
    }],
    servicePeriods: [{ id: "care", start: "2026-06-15", end: "2026-09-15" }],
  });
  assert.equal(timeline.end, "2027-10-13");
  const plotted = timeline.lanes
    .filter((lane) => !["responses", "reviews"].includes(lane.id))
    .flatMap((lane) => lane.entries);
  assert.deepEqual(timelineExtent(plotted), {
    start: "2026-06-15",
    end: "2026-09-15",
  });
  assert.equal(timelinePosition("2026-09-15", "2026-06-15", "2026-09-15"), 100);
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

test("Add event source records feed matching Report tracks and retain their source ids", () => {
  const context = { personId: "YS-1034", episodeId: "EP-1034-01" };
  const start = new Date(`${TODAY}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 3);
  const startDate = start.toISOString().slice(0, 10);
  let state = createSeed();
  for (const action of [
    { eventType: "medication-course", eventDate: startDate, endDate: TODAY,
      courseName: "QA medication course", reportStatus: "Completed", source: "Medication log" },
    { eventType: "service-period", eventDate: startDate, endDate: TODAY,
      periodName: "QA community support", reportStatus: "Delivered", source: "Service log" },
    { eventType: "goal-milestone", eventDate: TODAY,
      goalTitle: "QA weekly routine", reportStatus: "Progressed", source: "Care plan" },
  ]) {
    const next = reducer(state, { ...context, type: "ADD_CARE_EVENT", ...action });
    assert.notEqual(next, state);
    state = next;
  }
  const episode = state.people.find((person) => person.id === context.personId).episodes[0];
  const timeline = careTimelineData(episode);
  for (const [label, entries] of [
    ["QA medication course", timeline.lanes.find((lane) => lane.id === "medication").entries],
    ["QA community support", timeline.lanes.find((lane) => lane.id === "services").entries],
    ["QA weekly routine", timeline.goals],
  ]) {
    const entry = entries.find((item) => item.label === label);
    assert.ok(entry, `${label} appears in the Report`);
    assert.equal(entry.sourceType, "event");
    assert.ok(episode.events.some((event) => event.id === entry.sourceId));
  }
  assert.equal(
    reducer(state, { ...context, type: "ADD_CARE_EVENT", eventType: "medication-course",
      eventDate: startDate, courseName: "Missing end", reportStatus: "Completed", source: "Log" }),
    state,
  );
});

test("appointments and structured records appear in Report tracks", () => {
  const episode = {
    start: "2026-06-01",
    appointments: [{ id: "contact", plannedDate: "2026-06-12", attendance: "Planned",
      practitionerService: "Community team" }],
    clinicalRecords: [
      { id: "med", recordType: "medication", recordDate: "2026-06-13", title: "Medication reviewed", detail: "Source record" },
      { id: "risk", recordType: "risk", recordDate: "2026-06-14", title: "Risk status: Low", detail: "Source record" },
      { id: "outcome", recordType: "outcome", recordDate: "2026-06-15", title: "K10+", detail: "Source record" },
    ],
  };
  const timeline = careTimelineData(episode);
  assert.equal(timeline.lanes.find((lane) => lane.id === "contacts").entries[0].sourceId, "contact");
  assert.equal(timeline.lanes.find((lane) => lane.id === "medication").entries[0].sourceId, "med");
  assert.equal(timeline.lanes.find((lane) => lane.id === "records").entries[0].sourceId, "outcome");
  assert.equal(timeline.riskRows.find((row) => row.id === "risk-status").entries[0].sourceId, "risk");
});

test("one medication record projects each documented fact to its Report track", () => {
  const episode = {
    start: "2026-06-01",
    clinicalRecords: [{
      id: "medication-one",
      recordType: "medication",
      recordDate: "2026-07-15",
      title: "Medicine A · Reviewed",
      detail: "Medication record",
      fields: {
        medicationName: "Medicine A",
        medicationChange: "Reviewed",
        courseStartDate: "2026-06-10",
        courseEndDate: "2026-07-20",
        courseStatus: "Completed",
        adverseEvent: "Rash observed",
        adverseEventDate: "2026-07-12",
      },
    }],
  };
  const timeline = careTimelineData(episode);
  const medication = timeline.lanes.find((lane) => lane.id === "medication").entries;
  assert.deepEqual(medication.map((entry) => [entry.kind, entry.date, entry.end || null]), [
    ["medication", "2026-07-15", null],
    ["medication-duration", "2026-06-10", "2026-07-20"],
  ]);
  const adverse = timeline.lanes.find((lane) => lane.id === "events").entries[0];
  assert.equal(adverse.label, "Rash observed");
  assert.equal(adverse.date, "2026-07-12");
  assert.equal(adverse.sourceId, "medication-one");
  assert.equal(timeline.riskRows.find((row) => row.id === "medication-adverse").entries[0].sourceId, "medication-one");
});

test("a care or service change can also supply a dated service period", () => {
  const timeline = careTimelineData({
    start: "2026-06-01",
    events: [{
      id: "service-change",
      actionType: "ADD_CARE_EVENT",
      eventType: "care-transition",
      eventDate: "2026-06-10",
      title: "Community programme added",
      fields: { periodName: "Community programme", endDate: "2026-07-20", status: "Delivered" },
    }],
  });
  const period = timeline.lanes.find((lane) => lane.id === "services").entries[0];
  assert.deepEqual([period.label, period.date, period.end, period.sourceId],
    ["Community programme", "2026-06-10", "2026-07-20", "service-change"]);
  assert.equal(timeline.lanes.find((lane) => lane.id === "events").entries[0].sourceId, "service-change");
});
