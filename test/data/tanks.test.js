import test from "node:test";
import assert from "node:assert/strict";
import { TANK_TYPES } from "../../src/data/tanks.js";

test("every tank has an integer baseDelay in a sensible range", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    assert.ok(Number.isInteger(tank.baseDelay), `${id} baseDelay not integer`);
    assert.ok(tank.baseDelay >= 400 && tank.baseDelay <= 1000, `${id} baseDelay out of range`);
  }
});
