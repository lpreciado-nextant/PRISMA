import { strict as assert } from "node:assert";
import { test } from "node:test";
import { estimateLines } from "./deckTemplate.ts";

// The cover title box: 6.4 in (460.8 pt) wide, Arial bold.
test("estimateLines wraps words and splits words longer than a line", () => {
  assert.equal(estimateLines("POC Forge", 460.8, 50, true), 1);
  assert.equal(estimateLines("Agent Factory Hub", 460.8, 50, true), 2);
  assert.equal(estimateLines("Intelligent Document Processing", 460.8, 50, true), 3);
  assert.equal(estimateLines("Intelligent Document Processing", 460.8, 36, true), 2);
  assert.equal(estimateLines("A".repeat(40), 460.8, 50, true), 3);
  assert.equal(estimateLines("one\ntwo", 460.8, 50, true), 2);
});
