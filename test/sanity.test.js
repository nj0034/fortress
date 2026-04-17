import test from "node:test";
import assert from "node:assert/strict";

test("test runner discovers tests in test/ recursively", () => {
  assert.equal(1 + 1, 2);
});
