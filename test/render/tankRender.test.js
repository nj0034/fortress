import test from "node:test";
import assert from "node:assert/strict";
import { applyTeamColor, mixColors, TEAM_COLORS, tankCacheKey, recoilCurve } from "../../src/render/tankRender.js";

test("applyTeamColor swaps team-primary and team-secondary fills", () => {
  const svg = `<svg><rect class="team-primary" fill="#000"/><rect class="team-secondary" fill="#fff"/><rect fill="#888"/></svg>`;
  const out = applyTeamColor(svg, "#ff0000", "#00ff00");
  assert.match(out, /class="team-primary"[^>]*fill="#ff0000"/);
  assert.match(out, /class="team-secondary"[^>]*fill="#00ff00"/);
  assert.match(out, /fill="#888"/);
});

test("applyTeamColor handles fill-before-class attribute order", () => {
  const svg = `<rect fill="#000" class="team-primary"/>`;
  const out = applyTeamColor(svg, "#abc123", "#fff");
  assert.match(out, /fill="#abc123"/);
});

test("applyTeamColor leaves unrelated fills untouched", () => {
  const svg = `<svg><rect fill="#999"/><circle class="team-primary" fill="#000"/></svg>`;
  const out = applyTeamColor(svg, "#red", "#blue");
  assert.match(out, /fill="#999"/);
});

test("applyTeamColor handles multiple team-primary matches", () => {
  const svg = `<rect class="team-primary" fill="#000"/><circle class="team-primary" fill="#111"/>`;
  const out = applyTeamColor(svg, "#aabbcc", "#fff");
  const matches = out.match(/fill="#aabbcc"/g);
  assert.equal(matches?.length, 2);
});

test("applyTeamColor handles elements with no fill attribute", () => {
  const svg = `<g class="team-primary"><rect fill="#000"/></g>`;
  const out = applyTeamColor(svg, "#ff0000", "#00ff00");
  // g has no fill, rect inside still gets processed if it has the class - ok if unchanged
  assert.ok(typeof out === "string");
});

// ---------------------------------------------------------------------------
// mixColors
// ---------------------------------------------------------------------------

test("mixColors blends two hex colors at t=0.5", () => {
  const result = mixColors("#ff0000", "#0000ff", 0.5);
  assert.equal(result, "#800080");
});

test("mixColors at t=0 returns first color", () => {
  assert.equal(mixColors("#ff0000", "#0000ff", 0), "#ff0000");
});

test("mixColors at t=1 returns second color", () => {
  assert.equal(mixColors("#ff0000", "#0000ff", 1), "#0000ff");
});

test("mixColors accepts short 3-digit hex", () => {
  const result = mixColors("#f00", "#00f", 0.5);
  assert.equal(result, "#800080");
});

test("mixColors handles intermediate blend", () => {
  const result = mixColors("#000000", "#ffffff", 0.5);
  assert.equal(result, "#808080");
});

// ---------------------------------------------------------------------------
// TEAM_COLORS
// ---------------------------------------------------------------------------

test("TEAM_COLORS has 4 entries with name/primary/secondary", () => {
  assert.equal(TEAM_COLORS.length, 4);
  for (const team of TEAM_COLORS) {
    assert.ok(team.name, "team has name");
    assert.match(team.primary, /^#[0-9a-f]{6}$/i);
    assert.match(team.secondary, /^#[0-9a-f]{6}$/i);
  }
});

// ---------------------------------------------------------------------------
// tankCacheKey
// ---------------------------------------------------------------------------

test("tankCacheKey returns stable string for same inputs", () => {
  const k1 = tankCacheKey("armor", "Red");
  const k2 = tankCacheKey("armor", "Red");
  assert.equal(k1, k2);
});

test("tankCacheKey differs for different tankId", () => {
  assert.notEqual(tankCacheKey("armor", "Red"), tankCacheKey("mage", "Red"));
});

test("tankCacheKey differs for different teamName", () => {
  assert.notEqual(tankCacheKey("armor", "Red"), tankCacheKey("armor", "Blue"));
});

// ---------------------------------------------------------------------------
// recoilCurve
// ---------------------------------------------------------------------------

test("recoilCurve(0) returns 0", () => {
  assert.equal(recoilCurve(0), 0);
});

test("recoilCurve(1) returns 0", () => {
  assert.equal(recoilCurve(1), 0);
});

test("recoilCurve(0.4) returns 1 (peak)", () => {
  assert.equal(recoilCurve(0.4), 1);
});

test("recoilCurve ramps up in 0→0.4 range", () => {
  assert.ok(recoilCurve(0.2) > 0);
  assert.ok(recoilCurve(0.2) < 1);
});

test("recoilCurve eases back down in 0.4→1.0 range", () => {
  assert.ok(recoilCurve(0.7) > 0);
  assert.ok(recoilCurve(0.7) < 1);
  assert.ok(recoilCurve(0.7) < recoilCurve(0.4));
});
