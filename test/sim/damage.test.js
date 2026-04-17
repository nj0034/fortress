import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyHit, HIT_MULTIPLIERS } from "../../src/sim/damage.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function mkVictim(tankType = "armor", y = 300) {
  return { id: "v1", tankType, y };
}

function mkProj(extras = {}) {
  return { kind: "single", grounded: true, damage: 50, ...extras };
}

// armor pivotY = 72, so turretWorldY = 300 + 72 = 372
const ARMOR_VICTIM = mkVictim("armor", 300);
const CRITICAL_IMPACT = { x: 400, y: 372 };   // exactly on pivot
const FAR_IMPACT = { x: 400, y: 200 };          // far above (not critical zone)

// ── HIT_MULTIPLIERS table ────────────────────────────────────────────────────

test("HIT_MULTIPLIERS: critical=1.5, aerial=1.25, normal=1.0, pierce=1.0, miss=0", () => {
  assert.equal(HIT_MULTIPLIERS.critical, 1.5);
  assert.equal(HIT_MULTIPLIERS.aerial, 1.25);
  assert.equal(HIT_MULTIPLIERS.normal, 1.0);
  assert.equal(HIT_MULTIPLIERS.pierce, 1.0);
  assert.equal(HIT_MULTIPLIERS.miss, 0);
});

// ── miss ─────────────────────────────────────────────────────────────────────

test("classifyHit: victim null → miss", () => {
  const result = classifyHit(mkProj(), null, FAR_IMPACT);
  assert.equal(result.type, "miss");
  assert.equal(result.damageMultiplier, 0);
  assert.equal(result.label, "MISS");
});

test("classifyHit: victim undefined → miss", () => {
  const result = classifyHit(mkProj(), undefined, FAR_IMPACT);
  assert.equal(result.type, "miss");
});

// ── critical ─────────────────────────────────────────────────────────────────

test("classifyHit: impact at turret pivotY → critical", () => {
  const result = classifyHit(mkProj(), ARMOR_VICTIM, CRITICAL_IMPACT);
  assert.equal(result.type, "critical");
  assert.equal(result.damageMultiplier, 1.5);
  assert.equal(result.label, "CRITICAL!");
  assert.equal(result.color, "#ff3333");
});

test("classifyHit: impact within ±10 of turret pivotY → critical", () => {
  const impact = { x: 400, y: 372 + 9 };  // 9 px inside box
  const result = classifyHit(mkProj(), ARMOR_VICTIM, impact);
  assert.equal(result.type, "critical");
});

test("classifyHit: impact outside ±10 of turret pivotY → not critical", () => {
  const impact = { x: 400, y: 372 + 11 };  // 11 px outside
  const result = classifyHit(mkProj(), ARMOR_VICTIM, impact);
  assert.notEqual(result.type, "critical");
});

test("classifyHit: uses TANK_TYPES[victim.tankType].turret.pivotY", () => {
  // bigpo pivotY=58; victim.y=200 → turretWorldY=258
  const bigpoVictim = mkVictim("bigpo", 200);
  const critImpact = { x: 400, y: 258 };
  const result = classifyHit(mkProj(), bigpoVictim, critImpact);
  assert.equal(result.type, "critical");
});

// ── aerial ───────────────────────────────────────────────────────────────────

test("classifyHit: projectile.phase==='air' → aerial", () => {
  const proj = mkProj({ phase: "air", grounded: false });
  const result = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT);
  assert.equal(result.type, "aerial");
  assert.equal(result.damageMultiplier, 1.25);
  assert.equal(result.label, "AERIAL!");
});

test("classifyHit: projectile.grounded!==true (undefined) → aerial", () => {
  const proj = mkProj({ grounded: undefined });
  const result = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT);
  assert.equal(result.type, "aerial");
});

test("classifyHit: projectile.grounded===false → aerial", () => {
  const proj = mkProj({ grounded: false });
  const result = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT);
  assert.equal(result.type, "aerial");
});

// ── pierce ───────────────────────────────────────────────────────────────────

test("classifyHit: pierce kind + isLastHit=false → pierce", () => {
  const proj = mkProj({ kind: "pierce", grounded: true });
  const result = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT, { isLastHit: false });
  assert.equal(result.type, "pierce");
  assert.equal(result.damageMultiplier, 1.0);
  assert.equal(result.label, "PIERCE");
});

test("classifyHit: pierce kind + isLastHit=true (default) → normal", () => {
  const proj = mkProj({ kind: "pierce", grounded: true });
  const result = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT, { isLastHit: true });
  assert.equal(result.type, "normal");
});

// ── normal ───────────────────────────────────────────────────────────────────

test("classifyHit: grounded projectile, far impact → normal", () => {
  const proj = mkProj({ grounded: true });
  const result = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT);
  assert.equal(result.type, "normal");
  assert.equal(result.damageMultiplier, 1.0);
  assert.equal(result.label, "HIT");
  assert.equal(result.color, "#ffffff");
});

// ── no Math.random ───────────────────────────────────────────────────────────

test("classifyHit: deterministic — same inputs give same result", () => {
  const proj = mkProj({ grounded: true });
  const r1 = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT);
  const r2 = classifyHit(proj, ARMOR_VICTIM, FAR_IMPACT);
  assert.deepEqual(r1, r2);
});
