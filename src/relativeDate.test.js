import test from "node:test";
import assert from "node:assert/strict";
import { daysAgoLabel } from "./relativeDate.js";

test("submission age uses calendar days from the current date", () => {
  const now = new Date(2026, 8, 25, 23, 30);
  assert.equal(daysAgoLabel("2026-09-15", now), "10 days ago");
  assert.equal(daysAgoLabel("2026-09-24", now), "1 day ago");
  assert.equal(daysAgoLabel("2026-09-25", now), "Today");
  assert.equal(daysAgoLabel("2026-09-26", now), "In 1 day");
  assert.equal(daysAgoLabel("2026-02-30", now), null);
});
