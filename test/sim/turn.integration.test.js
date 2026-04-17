import test from "node:test";
import assert from "node:assert/strict";
import {
  createTurnManager, pickNextTurn, applyAction, normalizeDelays,
} from "../../src/sim/turn.js";

test("4-player match: fastest tank gets more turns, delays stay bounded", () => {
  const tanks = [
    { id: "a", baseDelay: 620 }, // acannon-ish
    { id: "b", baseDelay: 720 },
    { id: "c", baseDelay: 760 },
    { id: "d", baseDelay: 870 }, // bigpo-ish
  ];
  const m = createTurnManager(tanks);
  const counts = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 40; i++) {
    const id = pickNextTurn(m);
    counts[id]++;
    applyAction(m, { tankId: id, actionType: "ss1" });
    normalizeDelays(m);
  }
  assert.ok(counts.a > counts.d, `fastest a=${counts.a} slowest d=${counts.d}`);
  for (const t of m.tanks) {
    assert.ok(t.accumulatedDelay < t.baseDelay * 2000, `delay runaway for ${t.id}: ${t.accumulatedDelay}`);
  }
});
