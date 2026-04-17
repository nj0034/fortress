import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceFloatText, floatTextAlpha, spawnFloatText, drawFloatTexts } from "../../src/render/floatText.js";

// ── advanceFloatText ──────────────────────────────────────────────────────────

test("advanceFloatText: decrements life by dt and updates y", () => {
  const entry = { x: 100, y: 200, vy: -1.4, life: 36, maxLife: 36, text: "HIT", color: "#fff", size: 18 };
  const next = advanceFloatText(entry, 1);
  assert.ok(next !== null);
  assert.equal(next.life, 35);
  assert.ok(Math.abs(next.y - (200 + (-1.4 * 1))) < 0.001);
});

test("advanceFloatText: life=0 after dt returns null", () => {
  const entry = { x: 0, y: 0, vy: -1.4, life: 1, maxLife: 36, text: "X", color: "#f00", size: 18 };
  assert.equal(advanceFloatText(entry, 1), null);
});

test("advanceFloatText: life becomes negative returns null", () => {
  const entry = { x: 0, y: 0, vy: -1.4, life: 0, maxLife: 36, text: "X", color: "#f00", size: 18 };
  assert.equal(advanceFloatText(entry, 1), null);
});

test("advanceFloatText: does not mutate original entry", () => {
  const entry = { x: 0, y: 0, vy: -1.4, life: 10, maxLife: 36, text: "X", color: "#f00", size: 18 };
  advanceFloatText(entry, 1);
  assert.equal(entry.life, 10);
});

// ── floatTextAlpha ────────────────────────────────────────────────────────────

test("floatTextAlpha: returns 1 for first 2/3 of life", () => {
  // maxLife=36, fadeStart=24; at life=24 alpha=1
  assert.equal(floatTextAlpha(36, 36), 1);
  assert.equal(floatTextAlpha(24, 36), 1);
});

test("floatTextAlpha: linear fade in last 1/3", () => {
  // fadeStart=24; at life=12 (halfway into fade) alpha = 12/24 = 0.5
  const alpha = floatTextAlpha(12, 36);
  assert.ok(Math.abs(alpha - 0.5) < 0.001, `alpha should be 0.5, got ${alpha}`);
});

test("floatTextAlpha: approaches 0 at life=0", () => {
  const alpha = floatTextAlpha(0, 36);
  assert.equal(alpha, 0);
});

// ── spawnFloatText ────────────────────────────────────────────────────────────

test("spawnFloatText: pushes entry with correct fields", () => {
  const game = { floatTexts: [] };
  spawnFloatText(game, { x: 100, y: 200, text: "CRITICAL!", color: "#ff3333", size: 22 });
  assert.equal(game.floatTexts.length, 1);
  const f = game.floatTexts[0];
  assert.equal(f.x, 100);
  assert.equal(f.y, 200);
  assert.equal(f.text, "CRITICAL!");
  assert.equal(f.color, "#ff3333");
  assert.equal(f.size, 22);
  assert.ok(f.vy < 0, "vy should be negative (upward)");
  assert.equal(f.life, f.maxLife);
});

test("spawnFloatText: default size is 18", () => {
  const game = { floatTexts: [] };
  spawnFloatText(game, { x: 0, y: 0, text: "HIT", color: "#fff" });
  assert.equal(game.floatTexts[0].size, 18);
});

test("spawnFloatText: no-ops if game.floatTexts missing", () => {
  const game = {};
  assert.doesNotThrow(() => spawnFloatText(game, { x: 0, y: 0, text: "X", color: "#f00" }));
});

// ── drawFloatTexts ────────────────────────────────────────────────────────────

test("drawFloatTexts: removes expired entries", () => {
  const game = {
    floatTexts: [
      { x: 0, y: 0, vy: -1.4, life: 1, maxLife: 36, text: "X", color: "#fff", size: 18 },
    ],
  };
  const ctx = {
    save: () => {}, restore: () => {}, fillText: () => {},
    textAlign: "", textBaseline: "", globalAlpha: 1, font: "",
    fillStyle: "",
  };
  drawFloatTexts(ctx, game);
  assert.equal(game.floatTexts.length, 0);
});

test("drawFloatTexts: keeps live entries", () => {
  const game = {
    floatTexts: [
      { x: 0, y: 0, vy: -1.4, life: 10, maxLife: 36, text: "HIT", color: "#fff", size: 18 },
    ],
  };
  const ctx = {
    save: () => {}, restore: () => {}, fillText: () => {},
    textAlign: "", textBaseline: "", globalAlpha: 1, font: "",
    fillStyle: "",
  };
  drawFloatTexts(ctx, game);
  assert.equal(game.floatTexts.length, 1);
  assert.equal(game.floatTexts[0].life, 9);
});

test("drawFloatTexts: no-op on empty array", () => {
  const game = { floatTexts: [] };
  const ctx = {
    save: () => { throw new Error("should not call save"); },
    restore: () => {},
  };
  assert.doesNotThrow(() => drawFloatTexts(ctx, game));
});
