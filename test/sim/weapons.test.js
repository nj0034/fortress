import { test } from "node:test";
import assert from "node:assert/strict";
import { fireWeapon, resolveHit, resolveSelfHeal } from "../../src/sim/weapons.js";

// ── helpers ──────────────────────────────────────────────────────────────────

const ORIGIN = { x: 400, y: 300 };
const ANGLE = 45;
const POWER = 75;
const WIND = 0;
const rngFixed = () => 0.5; // deterministic

function stubState() {
  return {
    tanks: [],
    terrain: null,
    turn: null,
  };
}

// ── Task 3: single shotType ───────────────────────────────────────────────────

test("single: armor_ss1 returns exactly 1 projectile", () => {
  const state = stubState();
  const result = fireWeapon(state, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 1);
});

test("single: projectile carries damage and radius from weapon table", () => {
  const state = stubState();
  const result = fireWeapon(state, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.ok(p.damage >= 30, `damage ${p.damage}`);
  assert.ok(p.radius >= 40, `radius ${p.radius}`);
});

test("single: unknown weaponId throws", () => {
  const state = stubState();
  assert.throws(() => fireWeapon(state, "unknown_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed), /unknown weapon/);
});

test("single: 90° angle produces mostly-vertical velocity (upward)", () => {
  const state = stubState();
  const result = fireWeapon(state, "armor_ss1", ORIGIN, 90, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  // At 90° vy should be strongly negative (upward) and |vx| small
  assert.ok(p.vy < 0, `vy should be negative (upward), got ${p.vy}`);
  assert.ok(Math.abs(p.vy) > Math.abs(p.vx) * 2, `should be mostly vertical`);
});

test("single: origin is carried onto projectile position", () => {
  const state = stubState();
  const origin = { x: 123, y: 456 };
  const result = fireWeapon(state, "armor_ss1", origin, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.equal(p.x, 123);
  assert.equal(p.y, 456);
});

// ── Task 4: split shotType ────────────────────────────────────────────────────

test("split: mage_ss1 returns 1 split-parent projectile", () => {
  const state = stubState();
  const result = fireWeapon(state, "mage_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 1);
  assert.equal(result.projectiles[0].kind, "split-parent");
});

test("split: mage_ss1 parent has fragments.length >= 3", () => {
  const state = stubState();
  const result = fireWeapon(state, "mage_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.ok(Array.isArray(p.fragments) && p.fragments.length >= 3);
});

test("split: mage_ss1 parent has airBurstTimer > 0", () => {
  const state = stubState();
  const result = fireWeapon(state, "mage_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.ok(p.airBurstTimer > 0, `airBurstTimer ${p.airBurstTimer}`);
});

test("split: mage_ss2 has 5 fragments", () => {
  const state = stubState();
  const result = fireWeapon(state, "mage_ss2", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles[0].fragments.length, 5);
});

test("split: ice_ss2 split-parent carries frozen status", () => {
  const state = stubState();
  const result = fireWeapon(state, "ice_ss2", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.equal(p.kind, "split-parent");
  // status is on the projectile itself (inherited from weapon table)
  assert.equal(p.status?.type, "frozen");
});

// ── Task 5: burrow shotType ───────────────────────────────────────────────────

test("burrow: dike_ss1 returns 1 projectile with kind=burrow", () => {
  const state = stubState();
  const result = fireWeapon(state, "dike_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 1);
  assert.equal(result.projectiles[0].kind, "burrow");
});

test("burrow: dike_ss1 carries burrow.tunnelDepth", () => {
  const state = stubState();
  const result = fireWeapon(state, "dike_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.ok(typeof p.burrow.tunnelDepth === "number" && p.burrow.tunnelDepth > 0);
});

test("burrow: dike_new has horizontalSpan: 260", () => {
  const state = stubState();
  const result = fireWeapon(state, "dike_new", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.equal(p.burrow.horizontalSpan, 260);
});

// ── Task 6: pierce shotType ───────────────────────────────────────────────────

test("pierce: acannon_ss2 returns kind=pierce with pierce=1", () => {
  const state = stubState();
  const result = fireWeapon(state, "acannon_ss2", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 1);
  assert.equal(result.projectiles[0].kind, "pierce");
  assert.equal(result.projectiles[0].pierce, 1);
});

test("pierce: acannon_new pierce=2 damage>=70", () => {
  const state = stubState();
  const result = fireWeapon(state, "acannon_new", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const p = result.projectiles[0];
  assert.equal(p.pierce, 2);
  assert.ok(p.damage >= 70, `damage ${p.damage}`);
});

test("pierce: acannon_ss1 pierce=0", () => {
  const state = stubState();
  const result = fireWeapon(state, "acannon_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles[0].pierce, 0);
});

// ── Task 7: multi shotType ────────────────────────────────────────────────────

test("multi: tricot_ss1 yields 3 sibling projectiles at different angles", () => {
  const state = stubState();
  const result = fireWeapon(state, "tricot_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 3);
  // All vx values should differ (different angles)
  const vxs = result.projectiles.map((p) => p.vx);
  const unique = new Set(vxs.map((v) => v.toFixed(4)));
  assert.ok(unique.size > 1, "projectiles should have different angles");
});

test("multi: mage_new Meteor Swarm generates 9 random-fall projectiles", () => {
  const state = stubState();
  const result = fireWeapon(state, "mage_new", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 9);
  result.projectiles.forEach((p) => assert.equal(p.kind, "fall"));
});

test("multi: mage_new uses injected rng (distinct x positions with varying rng)", () => {
  const state = stubState();
  let callCount = 0;
  const rngVarying = () => {
    callCount++;
    return callCount / 10; // produces 0.1,0.2,...,0.9
  };
  const result = fireWeapon(state, "mage_new", ORIGIN, ANGLE, POWER, WIND, rngVarying);
  const xs = result.projectiles.map((p) => p.x);
  const unique = new Set(xs.map((v) => v.toFixed(2)));
  assert.ok(unique.size > 1, "rng should produce distinct x positions");
});

test("multi: tricot_ss2 yields 5 projectiles", () => {
  const state = stubState();
  const result = fireWeapon(state, "tricot_ss2", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 5);
});

test("multi: tricot_new prism shower yields 9 projectiles", () => {
  const state = stubState();
  const result = fireWeapon(state, "tricot_new", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 9);
});

// ── Task 8: chain shotType ────────────────────────────────────────────────────

test("chain: lightning_ss2 sets chain.count=1, range=220, falloff=0.8", () => {
  const state = stubState();
  const result = fireWeapon(state, "lightning_ss2", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles.length, 1);
  const p = result.projectiles[0];
  assert.equal(p.kind, "chain");
  assert.equal(p.chain.count, 1);
  assert.equal(p.chain.range, 220);
  assert.equal(p.chain.falloff, 0.8);
});

test("chain: lightning_new has verticalStrike=true", () => {
  const state = stubState();
  const result = fireWeapon(state, "lightning_new", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  assert.equal(result.projectiles[0].verticalStrike, true);
});

// ── Task 9: freeze status + self-heal hooks ───────────────────────────────────

test("resolveHit: ice_ss1 frozen status calls applyStatusDelay on victim", () => {
  let calledWith = null;
  const mockTurn = {
    applyStatusDelay: (mgr, tankId, bonus) => { calledWith = { tankId, bonus }; },
  };
  const state = { turn: mockTurn };
  const state2 = stubState();
  const result = fireWeapon(state2, "ice_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  const victim = { id: "player2" };
  // Pass the mock turn reference as state.turn
  resolveHit({ turn: mockTurn }, proj, victim);
  assert.ok(calledWith !== null, "applyStatusDelay should have been called");
  assert.equal(calledWith.tankId, "player2");
  assert.equal(calledWith.bonus, 120);
});

test("resolveHit: returns {damage} object matching projectile damage", () => {
  const state2 = stubState();
  const result = fireWeapon(state2, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  const hit = resolveHit({ turn: null }, proj, { id: "v" });
  assert.equal(hit.damage, proj.damage);
  assert.equal(hit.reason, undefined);
});

test("resolveHit: non-frozen weapon does not call applyStatusDelay", () => {
  let called = false;
  const mockTurn = { applyStatusDelay: () => { called = true; } };
  const state2 = stubState();
  const result = fireWeapon(state2, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  resolveHit({ turn: mockTurn }, proj, { id: "v" });
  assert.equal(called, false);
});

test("resolveSelfHeal: turtle_ss1 adds 8 hp to shooter clamped to maxHealth", () => {
  const state2 = stubState();
  const result = fireWeapon(state2, "turtle_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  assert.equal(proj.selfHeal, 8);

  const shooter = { health: 100, maxHealth: 150 };
  const healed = resolveSelfHeal({}, proj, shooter);
  assert.equal(healed, 8);
  assert.equal(shooter.health, 108);
});

test("resolveSelfHeal: clamps at maxHealth", () => {
  const state2 = stubState();
  const result = fireWeapon(state2, "turtle_ss2", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  assert.equal(proj.selfHeal, 15);

  const shooter = { health: 168, maxHealth: 170 };
  const healed = resolveSelfHeal({}, proj, shooter);
  assert.equal(shooter.health, 170);
  assert.equal(healed, 2); // clamped
});

test("resolveSelfHeal: turtle_new selfHeal=40", () => {
  const state2 = stubState();
  const result = fireWeapon(state2, "turtle_new", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  assert.equal(proj.selfHeal, 40);
});

test("resolveHit: teammate attack returns damage=0 and reason='teamkill-prevented'", () => {
  const state2 = stubState();
  const result = fireWeapon(state2, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  const match = { teams: { attacker: 0, victim: 0 } };
  const hit = resolveHit({ turn: null }, proj, { id: "victim" }, { attackerId: "attacker", match });
  assert.equal(hit.damage, 0);
  assert.equal(hit.reason, "teamkill-prevented");
});

test("resolveHit: enemy attack not blocked (different teams)", () => {
  const state2 = stubState();
  const result = fireWeapon(state2, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  const match = { teams: { attacker: 0, victim: 1 } };
  const hit = resolveHit({ turn: null }, proj, { id: "victim" }, { attackerId: "attacker", match });
  assert.ok(hit.damage > 0);
  assert.equal(hit.reason, undefined);
});

test("resolveHit: no match option falls through as before", () => {
  const state2 = stubState();
  const result = fireWeapon(state2, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  const hit = resolveHit({ turn: null }, proj, { id: "victim" });
  assert.ok(hit.damage > 0);
});

test("resolveHit: teammate frozen status does not apply status delay", () => {
  let statusCalled = false;
  const mockTurn = { applyStatusDelay: () => { statusCalled = true; } };
  const state2 = stubState();
  const result = fireWeapon(state2, "ice_ss1", ORIGIN, ANGLE, POWER, WIND, rngFixed);
  const proj = result.projectiles[0];
  const match = { teams: { attacker: 0, victim: 0 } };
  const hit = resolveHit({ turn: mockTurn }, proj, { id: "victim" }, { attackerId: "attacker", match });
  assert.equal(hit.damage, 0);
  assert.equal(hit.reason, "teamkill-prevented");
  assert.equal(statusCalled, false, "status delay must not fire for teammate");
});

// ── Task 13 pre-run: smoke across all shot types ──────────────────────────────

test("smoke: eight mixed weaponIds fire without exceptions", () => {
  const state = stubState();
  const ids = ["armor_ss1", "mage_ss1", "dike_ss1", "tricot_ss1", "acannon_ss2", "lightning_ss2", "ice_ss1", "bigpo_new"];
  for (const id of ids) {
    const res = fireWeapon(state, id, ORIGIN, ANGLE, POWER, WIND, rngFixed);
    assert.ok(res.projectiles.length >= 1, `${id}: expected at least 1 projectile`);
  }
});
