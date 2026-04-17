import { test } from "node:test";
import assert from "node:assert/strict";
import { TANK_TYPES } from "../../src/data/tanks.js";
import { WEAPONS } from "../../src/data/weapons.js";

const EXPECTED_IDS = ["armor", "bigpo", "slingshot", "dike", "turtle", "mage", "tricot", "acannon", "lightning", "ice"];
const SLOTS = ["ss1", "ss2", "new"];

// Korean unicode range check (Hangul syllables + Hangul Jamo)
const hasHangul = (str) => /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(str);

test("TANK_TYPES has exactly 10 tanks", () => {
  assert.equal(Object.keys(TANK_TYPES).length, 10);
});

test("all 10 expected ids are present", () => {
  for (const id of EXPECTED_IDS) {
    assert.ok(TANK_TYPES[id], `Missing tank: ${id}`);
  }
});

test("each tank name contains hangul characters", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    assert.ok(hasHangul(tank.name), `${id}: name "${tank.name}" has no Hangul`);
  }
});

test("stats are within valid ranges", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    const s = tank.stats;
    assert.ok(s.maxHealth >= 80 && s.maxHealth <= 200, `${id}: maxHealth ${s.maxHealth}`);
    assert.ok(s.armor >= 0.5 && s.armor <= 1.5, `${id}: armor ${s.armor}`);
    assert.ok(s.mobility >= 0.3 && s.mobility <= 1.5, `${id}: mobility ${s.mobility}`);
    assert.ok(s.baseDelay >= 400 && s.baseDelay <= 1000, `${id}: baseDelay ${s.baseDelay}`);
    assert.ok(s.precision >= 0.6 && s.precision <= 1.2, `${id}: precision ${s.precision}`);
  }
});

test("each tank weapons resolve in WEAPONS with correct naming", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    for (const slot of SLOTS) {
      const weaponId = tank.weapons[slot];
      assert.equal(weaponId, `${id}_${slot}`, `${id}: weapons.${slot}`);
      assert.ok(WEAPONS[weaponId], `${id}: WEAPONS[${weaponId}] not found`);
    }
  }
});

test("each tank has visual.primaryColor and visual.secondaryColor as hex strings", () => {
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    assert.ok(hexRe.test(tank.visual.primaryColor), `${id}: primaryColor "${tank.visual.primaryColor}"`);
    assert.ok(hexRe.test(tank.visual.secondaryColor), `${id}: secondaryColor "${tank.visual.secondaryColor}"`);
  }
});

test("each tank has visual.svgId matching tank id", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    assert.equal(tank.visual.svgId, id);
  }
});

test("each tank has role and description strings", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    assert.ok(typeof tank.role === "string" && tank.role.length > 0, `${id}: role`);
    assert.ok(typeof tank.description === "string" && tank.description.length > 0, `${id}: description`);
  }
});

test("backward-compat: baseDelay accessible from stats.baseDelay", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    assert.ok(Number.isInteger(tank.stats.baseDelay), `${id} stats.baseDelay not integer`);
    assert.ok(tank.stats.baseDelay >= 400 && tank.stats.baseDelay <= 1000, `${id} stats.baseDelay out of range`);
  }
});
