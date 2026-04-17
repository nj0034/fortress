import test from "node:test";
import assert from "node:assert/strict";
import {
  circle,
  ellipse,
  verticalTunnel,
  horizontalBurst,
  _cacheSize,
  _cacheClear,
} from "../../src/sim/craterMasks.js";

// Clear cache before each group to isolate tests
function setup() { _cacheClear(); }

// ── circle ────────────────────────────────────────────────────────────────────

test("circle: bounding box has correct dimensions", () => {
  setup();
  const m = circle(5);
  assert.equal(m.w, 11);
  assert.equal(m.h, 11);
  assert.equal(m.ox, 5);
  assert.equal(m.oy, 5);
});

test("circle: set pixels within 5% of analytical area π*r²", () => {
  setup();
  const r = 10;
  const m = circle(r);
  const setCount = m.data.reduce((s, v) => s + v, 0);
  const expected = Math.PI * r * r;
  assert.ok(
    Math.abs(setCount - expected) / expected < 0.05,
    `circle area ${setCount} vs analytical ${expected.toFixed(1)}`
  );
});

test("circle: center pixel is always set", () => {
  setup();
  const m = circle(4);
  assert.equal(m.data[m.oy * m.w + m.ox], 1);
});

test("circle: corner pixels of bounding box are clear", () => {
  setup();
  const m = circle(6);
  assert.equal(m.data[0], 0);
  assert.equal(m.data[m.w - 1], 0);
  assert.equal(m.data[(m.h - 1) * m.w], 0);
  assert.equal(m.data[m.h * m.w - 1], 0);
});

test("circle: same-radius calls return the same object reference (LRU cache)", () => {
  setup();
  const a = circle(7);
  const b = circle(7);
  assert.equal(a, b, "should be same cached object");
});

test("circle: different radii return different objects", () => {
  setup();
  const a = circle(3);
  const b = circle(4);
  assert.notEqual(a, b);
});

// ── ellipse ───────────────────────────────────────────────────────────────────

test("ellipse: bounding box has correct dimensions", () => {
  setup();
  const m = ellipse(8, 4);
  assert.equal(m.w, 17);
  assert.equal(m.h, 9);
  assert.equal(m.ox, 8);
  assert.equal(m.oy, 4);
});

test("ellipse: area within 5% of analytical π*rx*ry", () => {
  setup();
  const rx = 12, ry = 6;
  const m = ellipse(rx, ry);
  const setCount = m.data.reduce((s, v) => s + v, 0);
  const expected = Math.PI * rx * ry;
  assert.ok(
    Math.abs(setCount - expected) / expected < 0.05,
    `ellipse area ${setCount} vs analytical ${expected.toFixed(1)}`
  );
});

test("ellipse: center pixel is set", () => {
  setup();
  const m = ellipse(5, 3);
  assert.equal(m.data[m.oy * m.w + m.ox], 1);
});

test("ellipse: same args return cached reference", () => {
  setup();
  const a = ellipse(6, 3);
  const b = ellipse(6, 3);
  assert.equal(a, b);
});

// ── verticalTunnel ────────────────────────────────────────────────────────────

test("verticalTunnel: bounding box is correct", () => {
  setup();
  const m = verticalTunnel(4, 20);
  assert.equal(m.w, 9);
  assert.equal(m.h, 20);
  assert.equal(m.ox, 4);
  assert.equal(m.oy, 0);
});

test("verticalTunnel: all pixels are set", () => {
  setup();
  const m = verticalTunnel(3, 15);
  assert.ok(m.data.every((v) => v === 1));
});

test("verticalTunnel: same args return cached reference", () => {
  setup();
  const a = verticalTunnel(2, 10);
  const b = verticalTunnel(2, 10);
  assert.equal(a, b);
});

// ── horizontalBurst ───────────────────────────────────────────────────────────

test("horizontalBurst: is wider than tall", () => {
  setup();
  const m = horizontalBurst(15, 5);
  assert.ok(m.w > m.h, `w=${m.w} should be > h=${m.h}`);
});

test("horizontalBurst: area within 5% of analytical π*length*height", () => {
  setup();
  const l = 14, h = 5;
  const m = horizontalBurst(l, h);
  const setCount = m.data.reduce((s, v) => s + v, 0);
  const expected = Math.PI * l * h;
  assert.ok(
    Math.abs(setCount - expected) / expected < 0.05,
    `burst area ${setCount} vs analytical ${expected.toFixed(1)}`
  );
});

test("horizontalBurst: same args return cached reference", () => {
  setup();
  const a = horizontalBurst(10, 4);
  const b = horizontalBurst(10, 4);
  assert.equal(a, b);
});

// ── LRU eviction ─────────────────────────────────────────────────────────────

test("LRU cache does not exceed 64 entries", () => {
  setup();
  // Generate 70 different circles
  for (let r = 1; r <= 70; r++) {
    circle(r);
  }
  assert.ok(_cacheSize() <= 64, `cache size ${_cacheSize()} should be ≤ 64`);
});
