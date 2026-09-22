import test from "node:test";
import assert from "node:assert/strict";
import { sortQueueRows } from "./queueSort.js";

test("queue sorting respects direction and leaves source rows unchanged", () => {
  const rows = [{ name: "Zoe", score: 2 }, { name: "Amelia", score: 1 }];
  const accessors = { name: (row) => row.name, score: (row) => row.score };
  assert.deepEqual(sortQueueRows(rows, { key: "name", direction: "asc" }, accessors).map((row) => row.name), ["Amelia", "Zoe"]);
  assert.deepEqual(sortQueueRows(rows, { key: "score", direction: "desc" }, accessors).map((row) => row.name), ["Zoe", "Amelia"]);
  assert.deepEqual(rows.map((row) => row.name), ["Zoe", "Amelia"]);
});

test("queue sorting uses the priority tie breaker", () => {
  const rows = [{ priority: 1, name: "Zoe" }, { priority: 1, name: "Amelia" }];
  const sorted = sortQueueRows(
    rows,
    { key: "priority", direction: "asc" },
    { priority: (row) => row.priority },
    (a, b) => a.name.localeCompare(b.name),
  );
  assert.deepEqual(sorted.map((row) => row.name), ["Amelia", "Zoe"]);
});
