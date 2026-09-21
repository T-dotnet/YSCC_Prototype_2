import test from "node:test";
import assert from "node:assert/strict";
import {
  configuredMeasure,
  configuredMeasures,
  outcomeNeedsMissingReason,
} from "./measureGovernance.js";

test("the configured measure set pins standard PMHC-MDS references", () => {
  assert.deepEqual(
    configuredMeasures().map((measure) => measure.key),
    ["k10-plus", "k5", "sdq", "sidas", "who-5"],
  );
  assert.equal(configuredMeasure("sdq").version, "PC101/PC202 · PY101/PY201 · YR101/YR201");
  assert.equal(configuredMeasure("iar-dst"), null);
});

test("incomplete or unavailable outcome records require an explicit reason", () => {
  assert.equal(outcomeNeedsMissingReason("Complete"), false);
  assert.equal(outcomeNeedsMissingReason("Not applicable"), false);
  assert.equal(outcomeNeedsMissingReason("Incomplete — follow-up required"), true);
  assert.equal(outcomeNeedsMissingReason("Recorded missing"), true);
});
