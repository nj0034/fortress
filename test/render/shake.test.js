import { test } from "node:test";
import assert from "node:assert/strict";
import { tickShake, applyShakeOffset } from "../../src/render/shake.js";

// ── tickShake ─────────────────────────────────────────────────────────────────

test("tickShake: decrements frames by 1", () => {
  const result = tickShake({ frames: 6, amplitude: 3 });
  assert.ok(result !== null);
  assert.equal(result.frames, 5);
  assert.equal(result.amplitude, 3);
});

test("tickShake: frames=1 returns null (no frames left after tick)", () => {
  assert.equal(tickShake({ frames: 1, amplitude: 3 }), null);
});

test("tickShake: frames=0 returns null", () => {
  assert.equal(tickShake({ frames: 0, amplitude: 3 }), null);
});

test("tickShake: null input returns null", () => {
  assert.equal(tickShake(null), null);
});

test("tickShake: does not mutate input object", () => {
  const shake = { frames: 5, amplitude: 4 };
  tickShake(shake);
  assert.equal(shake.frames, 5);
});

// ── applyShakeOffset ──────────────────────────────────────────────────────────

test("applyShakeOffset: calls ctx.translate with values within amplitude", () => {
  let dx = null;
  let dy = null;
  const ctx = {
    translate: (x, y) => { dx = x; dy = y; },
  };
  const shake = { frames: 6, amplitude: 3 };
  applyShakeOffset(ctx, shake);
  assert.ok(dx !== null, "translate should have been called");
  assert.ok(Math.abs(dx) <= shake.amplitude, `dx=${dx} exceeds amplitude`);
  assert.ok(Math.abs(dy) <= shake.amplitude, `dy=${dy} exceeds amplitude`);
});

test("applyShakeOffset: null shake does not call translate", () => {
  let called = false;
  const ctx = { translate: () => { called = true; } };
  applyShakeOffset(ctx, null);
  assert.equal(called, false);
});

test("applyShakeOffset: shake.frames=0 does not call translate", () => {
  let called = false;
  const ctx = { translate: () => { called = true; } };
  applyShakeOffset(ctx, { frames: 0, amplitude: 3 });
  assert.equal(called, false);
});

test("applyShakeOffset: deterministic — same frames produce same offset", () => {
  const calls = [];
  const ctx = { translate: (x, y) => calls.push([x, y]) };
  const shake = { frames: 4, amplitude: 5 };
  applyShakeOffset(ctx, shake);
  applyShakeOffset(ctx, shake);
  assert.deepEqual(calls[0], calls[1]);
});
