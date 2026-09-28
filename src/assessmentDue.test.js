import test from "node:test";
import assert from "node:assert/strict";
import { assessmentDueByType, assessmentDueLabel, assessmentsWithDueVisibility } from "./assessmentDue.js";

const today = "2026-09-28";
const collection = (id, due, extra = {}) => ({
  id, due, version: "Life and care check-in v1.0", label: id,
  response: "Not started", assignment: "Planned", ...extra,
});
const selected = (records) => [...assessmentDueByType(records, today).values()].filter(Boolean);
const visible = (records) => assessmentsWithDueVisibility(records, today).map((item) => item.id);

test("each type exposes only its earliest due assessment, preserving completed history", () => {
  const records = [
    collection("later", "2026-11-01"), collection("first", "2026-10-01"),
    collection("history", "2026-08-01", { response: "Submitted", assignment: "Fulfilled" }),
    collection("other-type", "2026-10-05", { version: "Your preferences and next steps v2.0" }),
  ];
  assert.deepEqual(selected(records).map((item) => item.id), ["first", "other-type"]);
  assert.deepEqual(visible(records), ["first", "history", "other-type"]);
  assert.equal(records.length, 4);
});

for (const progress of [{ response: "Draft" }, { response: "In progress" }, { assignment: "Active" }]) {
  test(`a ${JSON.stringify(progress)} hides the next due before its due date`, () => {
    for (const due of ["2026-10-05", ""]) {
      const records = [collection("next", "2026-10-12"), collection("current", due, progress)];
      assert.deepEqual(visible(records), ["current"]);
      assert.deepEqual(selected(records).map((item) => item.id), due ? ["current"] : []);
    }
  });
}

test("an overdue draft retains Past due and exposes only the next assessment of its type", () => {
  const draft = collection("draft", "2026-09-27", { response: "Draft" });
  const records = [draft, collection("later", "2026-11-01"), collection("next", "2026-10-01")];
  assert.deepEqual(visible(records), ["draft", "next"]);
  assert.deepEqual(selected(records).map((item) => item.id), ["next"]);
  assert.equal(assessmentDueLabel(draft, today), "Past due");
});

test("a draft or active response due today exposes the next assessment and has a Due today label", () => {
  for (const progress of [{ response: "Draft" }, { response: "In progress" }, { assignment: "Active" }]) {
    const current = collection("current", today, progress);
    const records = [current, collection("later", "2026-11-01"), collection("next", "2026-10-01")];
    assert.deepEqual(visible(records), ["current", "next"]);
    assert.deepEqual(selected(records).map((item) => item.id), ["next"]);
    assert.equal(assessmentDueLabel(current, today), "Due today");
  }
});

test("completion reveals the next due; paused, cancelled and completed dates are never overdue", () => {
  const records = [
    collection("completed", "2026-09-27", { response: "Submitted", assignment: "Fulfilled" }),
    collection("paused", "2026-09-20", { assignment: "Paused" }),
    collection("cancelled", "2026-09-19", { assignment: "Cancelled" }),
    collection("next", "2026-10-01"),
  ];
  assert.deepEqual(selected(records).map((item) => item.id), ["next"]);
  for (const record of records.slice(0, 3)) assert.equal(assessmentDueLabel(record, today), null);
  assert.equal(assessmentDueLabel(records[3], today), null);
  assert.equal(assessmentDueLabel(collection("today", today), today), "Due today");
  assert.equal(assessmentDueLabel(collection("undated", ""), today), null);
});

test("a second unexpired draft keeps the next assessment hidden when an older draft is overdue", () => {
  const records = [
    collection("old", "2026-09-20", { response: "Draft" }),
    collection("current", "2026-10-01", { response: "Draft" }),
    collection("next", "2026-10-12"),
  ];
  assert.deepEqual(selected(records).map((item) => item.id), ["current"]);
  assert.deepEqual(visible(records), ["old", "current"]);
});
