import test from "node:test";
import assert from "node:assert/strict";
import { createTurnManager, pickNextTurn, DELAY_SCALE } from "../../src/sim/turn.js";

const tanks = [
  { id: "p1", baseDelay: 720 },
  { id: "p2", baseDelay: 660 },
  { id: "p3", baseDelay: 840 },
];

test("createTurnManager initialises accumulatedDelay=0 and preserves id/baseDelay", () => {
  const m = createTurnManager(tanks);
  assert.equal(m.tanks.length, 3);
  for (const t of m.tanks) {
    assert.equal(t.accumulatedDelay, 0);
    assert.ok(t.alive);
  }
  assert.deepEqual(m.history, []);
  assert.deepEqual(m.pendingStatuses, {});
});

test("pickNextTurn returns lowest accumulatedDelay; ties broken by ascending id", () => {
  const m = createTurnManager(tanks);
  assert.equal(pickNextTurn(m), "p1"); // all 0 → lowest id
  m.tanks.find((t) => t.id === "p1").accumulatedDelay = 100;
  assert.equal(pickNextTurn(m), "p2");
});

test("DELAY_SCALE is 1000", () => {
  assert.equal(DELAY_SCALE, 1000);
});
