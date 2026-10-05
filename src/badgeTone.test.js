import test from "node:test";
import assert from "node:assert/strict";
import { badgeTone } from "./badgeTone.js";
import { ASSESSMENT_BUNDLE_STATUS_LABELS, ASSESSMENT_BUNDLE_STATUS_TONES } from "./assessmentBundleStatus.js";

test("badge tones follow explicit status meanings", () => {
  assert.equal(badgeTone("High"), "coral");
  assert.equal(badgeTone("Overdue"), "coral");
  assert.equal(badgeTone("Ready for review"), "purple");
  assert.equal(badgeTone("Reviewed"), "green");
  assert.equal(badgeTone("4 unresolved"), "neutral");
});

test("status colours keep the same meaning across records", () => {
  for (const [status, label] of Object.entries(ASSESSMENT_BUNDLE_STATUS_LABELS))
    assert.equal(badgeTone(label), ASSESSMENT_BUNDLE_STATUS_TONES[status], label);
  for (const [label, tone] of Object.entries({
    Profiling: "purple", Assessment: "blue", "Ongoing review": "blue",
    "Not proceed": "teal", Paused: "amber", Closed: "teal",
    Completed: "green", Discharged: "teal",
    Planned: "purple", Attended: "green", Cancelled: "teal", Open: "purple",
    "Did not attend": "coral", Overdue: "coral",
    "Needs planning": "purple", Scheduled: "purple", Today: "amber", "Due today": "amber",
    "Ready for review": "purple", Reviewed: "green", "In Progress": "blue",
    "Awaiting Information": "amber", Resolved: "green",
  })) assert.equal(badgeTone(label), tone, label);
});
