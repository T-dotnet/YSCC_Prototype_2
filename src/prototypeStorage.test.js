import test from "node:test";
import assert from "node:assert/strict";
import { clearPrototypeStorage } from "./prototypeStorage.js";

test("error recovery clears prototype data without deleting unrelated origin data", () => {
  const items = new Map([
    ["yscc-prototype-v1", "workspace"],
    ["other-app-session", "unrelated"],
    ["yscc-data-dictionary-overrides-v1", "dictionary"],
  ]);
  const storage = {
    get length() { return items.size; },
    key(index) { return [...items.keys()][index] ?? null; },
    removeItem(key) { items.delete(key); },
  };
  clearPrototypeStorage(storage);
  assert.deepEqual([...items], [["other-app-session", "unrelated"]]);
});
