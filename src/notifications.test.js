import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, TODAY } from "./model.js";
import { getNotifications } from "./notifications.js";

test("getNotifications extracts data quality errors, overdue assessments, overdue appointments and assessments ready for review", () => {
  const state = createSeed();
  const notifications = getNotifications(state, TODAY);

  assert.ok(Array.isArray(notifications));
  assert.ok(notifications.length > 0, "Should find notifications in seed state");

  const categories = new Set(notifications.map((n) => n.category));
  assert.ok(categories.has("data_quality"), "Should include data_quality notifications");
  assert.ok(categories.has("assessment_overdue"), "Should include assessment_overdue notifications");
  assert.ok(categories.has("appointment_overdue"), "Should include appointment_overdue notifications");
  assert.ok(categories.has("assessment_review"), "Should include assessment_review notifications");

  for (const n of notifications) {
    assert.ok(n.id, "Notification must have an id");
    assert.ok(n.title, "Notification must have a title");
    assert.ok(n.categoryLabel, "Notification must have a category label");
    assert.ok(n.href, "Notification must have a target link");
  }
});
