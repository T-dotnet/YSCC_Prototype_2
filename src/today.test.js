import test from "node:test";
import assert from "node:assert/strict";
import { TODAY, refreshToday } from "./model.js";

test("the current day refreshes in local time while a fixed test date stays fixed", () => {
  const original = TODAY;
  const [year, month, day] = original.split("-").map(Number);
  try {
    const later = new Date(year + 10, month - 1, day, 12);
    const changed = refreshToday(later);
    if (/^\d{4}-\d{2}-\d{2}$/.test(process.env.YSCC_TEST_DATE || "")) {
      assert.equal(changed, false);
      assert.equal(TODAY, original);
    } else {
      assert.equal(changed, true);
      assert.equal(TODAY, `${year + 10}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
      assert.equal(refreshToday(later), false);
    }
  } finally {
    refreshToday(new Date(year, month - 1, day, 12));
  }
});
