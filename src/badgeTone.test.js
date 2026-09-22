import test from "node:test";
import assert from "node:assert/strict";
import { badgeTone } from "./badgeTone.js";

test("badge tones follow explicit status meanings", () => {
  assert.equal(badgeTone("High"), "coral");
  assert.equal(badgeTone("Overdue"), "amber");
  assert.equal(badgeTone("Ready for review"), "purple");
  assert.equal(badgeTone("Reviewed"), "green");
  assert.equal(badgeTone("4 unresolved"), "neutral");
});
