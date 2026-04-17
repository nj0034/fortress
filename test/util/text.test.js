import test from "node:test";
import assert from "node:assert/strict";
import { hashString, escapeHtml, randomId } from "../../src/util/text.js";

test("hashString is deterministic", () => {
  assert.equal(hashString("hello"), hashString("hello"));
  assert.notEqual(hashString("hello"), hashString("world"));
});

test("hashString returns a 32-bit unsigned integer", () => {
  const h = hashString("test");
  assert.ok(Number.isInteger(h));
  assert.ok(h >= 0 && h <= 0xffffffff);
});

test("escapeHtml escapes special characters", () => {
  assert.equal(escapeHtml("<b>&"), "&lt;b&gt;&amp;");
  assert.equal(escapeHtml('"\''), "&quot;&#39;");
});

test("randomId has prefix and nonempty body", () => {
  const id = randomId("room");
  assert.ok(id.startsWith("room-"));
  assert.ok(id.length > "room-".length);
});

test("randomId is unique across calls", () => {
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add(randomId("x"));
  assert.equal(ids.size, 20);
});
