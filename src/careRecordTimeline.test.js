import assert from "node:assert/strict";
import test from "node:test";
import {
  careRecordTimelineEntries,
  careRecordTimelineTypes,
  filterCareRecordTimelineEntries,
} from "./careRecordTimeline.js";

const episode = {
  appointments: [
    {
      id: "appointment",
      plannedDate: "2026-09-04",
      plannedTime: "09:00",
      plannedDurationMinutes: 45,
      actualDate: "2026-09-05",
      actualTime: "09:10",
      actualDurationMinutes: 40,
      attendance: "Attended",
      practitionerService: "Northside Centre",
      deliveryMode: "In person",
      notes: "Care plan discussed",
      actor: "Jess Taylor",
    },
  ],
  clinicalRecords: [
    {
      id: "outcome",
      recordType: "outcome",
      recordDate: "2026-09-03",
      title: "Kessler 10+ (K10+)",
      detail: "Review · Complete · Completed measure",
      fields: {
        measureName: "Kessler 10+ (K10+)",
        measureVersion: "PMHC-MDS K10+ current",
        measureRespondent: "Person",
        collectionPoint: "Review",
        outcomeStatus: "Complete",
        measureValue: "24",
        source: "Completed measure",
      },
      actor: "Jess Taylor",
    },
  ],
  events: [
    {
      id: "housing",
      actionType: "ADD_CARE_EVENT",
      eventType: "housing",
      eventDate: "2026-09-02",
      title: "Accommodation changed",
      detail: "Contextual care event recorded.",
      fields: { impact: "Review transport support" },
      actor: "Jess Taylor",
    },
  ],
};

test("care timeline merges appointments, structured records and contextual events by recorded date", () => {
  const entries = careRecordTimelineEntries(episode);
  assert.deepEqual(entries.map((entry) => entry.sourceType), [
    "appointment",
    "clinical-record",
    "contextual-event",
  ]);
  assert.equal(entries[0].date, "2026-09-05");
  assert.equal(entries[0].dateLabel, "Actual contact");
  assert.equal(entries[0].scope, "structured");
});

test("structured scope includes appointments and type choices follow the selected scope", () => {
  const entries = careRecordTimelineEntries(episode);
  assert.deepEqual(
    filterCareRecordTimelineEntries(entries, { scope: "structured" }).map(
      (entry) => entry.sourceType,
    ),
    ["appointment", "clinical-record"],
  );
  assert.deepEqual(careRecordTimelineTypes(entries, "contextual"), [
    { value: "housing", label: "Housing instability or homelessness" },
  ]);
});

test("timeline filters combine type, date range and text search without changing records", () => {
  const entries = careRecordTimelineEntries(episode);
  assert.deepEqual(
    filterCareRecordTimelineEntries(entries, {
      scope: "structured",
      type: "appointment",
      startDate: "2026-09-05",
      endDate: "2026-09-05",
      query: "northside",
    }).map((entry) => entry.sourceId),
    ["appointment"],
  );
  assert.equal(
    filterCareRecordTimelineEntries(entries, { query: "transport" })[0].sourceId,
    "housing",
  );
});
