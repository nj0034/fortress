import { test } from "node:test";
import assert from "node:assert/strict";
import { WEAPONS, WEAPON_SLOT_DELAY } from "../../src/data/weapons.js";

const VALID_SHOT_TYPES = new Set(["single", "split", "burrow", "multi", "pierce", "chain"]);
const TANK_IDS = ["armor", "bigpo", "slingshot", "dike", "turtle", "mage", "tricot", "acannon", "lightning", "ice"];
const SLOTS = ["ss1", "ss2", "new"];

test("WEAPONS has exactly 30 entries", () => {
  assert.equal(Object.keys(WEAPONS).length, 30);
});

test("every weapon has required fields with correct types", () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    assert.ok(typeof w.name === "string" && w.name.length > 0, `${id}: name`);
    assert.ok(VALID_SHOT_TYPES.has(w.shotType), `${id}: shotType "${w.shotType}"`);
    assert.ok(typeof w.delayMultiplier === "number", `${id}: delayMultiplier`);
    assert.ok(typeof w.projectile === "object", `${id}: projectile`);
    assert.ok(typeof w.projectile.damage === "number", `${id}: projectile.damage`);
    assert.ok(typeof w.projectile.radius === "number", `${id}: projectile.radius`);
    assert.ok(typeof w.fx === "object", `${id}: fx`);
  }
});

test("NEW slot weapons have perMatchLimit: 2, SS1/SS2 have null", () => {
  for (const tankId of TANK_IDS) {
    assert.equal(WEAPONS[`${tankId}_new`].perMatchLimit, 2, `${tankId}_new`);
    assert.equal(WEAPONS[`${tankId}_ss1`].perMatchLimit, null, `${tankId}_ss1`);
    assert.equal(WEAPONS[`${tankId}_ss2`].perMatchLimit, null, `${tankId}_ss2`);
  }
});

test("WEAPON_SLOT_DELAY has correct values", () => {
  assert.equal(WEAPON_SLOT_DELAY.ss1, 1.0);
  assert.equal(WEAPON_SLOT_DELAY.ss2, 1.3);
  assert.equal(WEAPON_SLOT_DELAY.new, 1.8);
});

test("all 10 tanks × 3 slots are present with correct key naming", () => {
  for (const tankId of TANK_IDS) {
    for (const slot of SLOTS) {
      const key = `${tankId}_${slot}`;
      assert.ok(WEAPONS[key], `Missing weapon: ${key}`);
    }
  }
});

test("split weapons have non-empty fragments with airBurstTimer", () => {
  const splitWeapons = Object.entries(WEAPONS).filter(([, w]) => w.shotType === "split");
  assert.ok(splitWeapons.length > 0, "at least one split weapon");
  for (const [id, w] of splitWeapons) {
    assert.ok(Array.isArray(w.projectile.fragments) && w.projectile.fragments.length >= 3, `${id}: fragments`);
    assert.ok(w.projectile.fragments[0].airBurstTimer > 0, `${id}: airBurstTimer`);
  }
});

test("burrow weapons have burrow params with tunnelDepth", () => {
  for (const slot of SLOTS) {
    const id = `dike_${slot}`;
    const w = WEAPONS[id];
    assert.ok(w.shotType === "burrow", `${id}: shotType`);
    assert.ok(typeof w.projectile.burrow.tunnelDepth === "number", `${id}: tunnelDepth`);
    assert.ok(w.projectile.burrow.tunnelDepth > 0, `${id}: tunnelDepth > 0`);
  }
});

test("dike_new has horizontalSpan: 260", () => {
  assert.equal(WEAPONS.dike_new.projectile.burrow.horizontalSpan, 260);
});

test("pierce weapons have correct pierce values", () => {
  assert.equal(WEAPONS.acannon_ss1.projectile.pierce, 0);
  assert.equal(WEAPONS.acannon_ss2.projectile.pierce, 1);
  assert.equal(WEAPONS.acannon_new.projectile.pierce, 2);
});

test("acannon_new damage >= 70", () => {
  assert.ok(WEAPONS.acannon_new.projectile.damage >= 70);
});

test("lightning_ss2 chain params correct", () => {
  const w = WEAPONS.lightning_ss2;
  assert.equal(w.shotType, "chain");
  assert.equal(w.projectile.chain.count, 1);
  assert.equal(w.projectile.chain.range, 220);
  assert.equal(w.projectile.chain.falloff, 0.8);
});

test("ice weapons have frozen status", () => {
  assert.equal(WEAPONS.ice_ss1.projectile.status.type, "frozen");
  assert.equal(WEAPONS.ice_ss1.projectile.status.delayBonus, 120);
  assert.equal(WEAPONS.ice_ss2.projectile.status.delayBonus, 200);
  assert.equal(WEAPONS.ice_new.projectile.status.delayBonus, 400);
});

test("slingshot_ss1 windFactor >= 1.5", () => {
  assert.ok(WEAPONS.slingshot_ss1.projectile.windFactor >= 1.5);
});

test("bigpo_new radius >= 110", () => {
  assert.ok(WEAPONS.bigpo_new.projectile.radius >= 110);
});

test("mage_new has randomFall with count 9", () => {
  const w = WEAPONS.mage_new;
  assert.equal(w.shotType, "multi");
  assert.equal(w.projectile.randomFall.count, 9);
  assert.ok(w.projectile.randomFall.spreadX > 0);
});

test("tricot_ss1 multi fragments has 3 entries", () => {
  assert.equal(WEAPONS.tricot_ss1.projectile.fragments.length, 3);
});

test("tricot_new zigzag has 9 fragments", () => {
  assert.equal(WEAPONS.tricot_new.projectile.fragments.length, 9);
});
