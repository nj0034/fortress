import test from "node:test";
import assert from "node:assert/strict";
import {
  createTurnManager, pickNextTurn, DELAY_SCALE,
  applyAction,
  applyStatusDelay, removeTank, normalizeDelays,
  snapshot,
} from "../../src/sim/turn.js";

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

// Task 3: applyAction tests
test("applyAction SS1 < SS2 < NEW adds correct integer delay", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "ss1" }); // 720*1000
  applyAction(m, { tankId: "p2", actionType: "ss2" }); // 660*1300
  applyAction(m, { tankId: "p3", actionType: "new" }); // 840*1800
  const p1 = m.tanks.find((t) => t.id === "p1").accumulatedDelay;
  const p2 = m.tanks.find((t) => t.id === "p2").accumulatedDelay;
  const p3 = m.tanks.find((t) => t.id === "p3").accumulatedDelay;
  assert.equal(p1, 720_000);
  assert.equal(p2, 858_000);
  assert.equal(p3, 1_512_000);
});

test("applyAction move uses fuelUsed", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "move", fuelUsed: 30 });
  assert.equal(m.tanks[0].accumulatedDelay, 720 * 2 * 30); // 43_200
});

test("applyAction pass uses 0.6 multiplier", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "pass" });
  assert.equal(m.tanks[0].accumulatedDelay, 720 * 600);
});

test("fastest tank accumulates slower → gets extra turns over time", () => {
  const m = createTurnManager(tanks);
  const picks = [];
  for (let i = 0; i < 20; i++) {
    const id = pickNextTurn(m);
    picks.push(id);
    applyAction(m, { tankId: id, actionType: "ss1" });
  }
  const counts = picks.reduce((a, id) => ((a[id] = (a[id] || 0) + 1), a), {});
  assert.ok(counts.p2 > counts.p3, "p2 (baseDelay 660) should fire more often than p3 (840)");
});

test("applyAction records history entry", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "ss2" });
  assert.equal(m.history.length, 1);
  assert.equal(m.history[0].tankId, "p1");
  assert.equal(m.history[0].actionType, "ss2");
});

// Task 4: applyStatusDelay, removeTank, normalizeDelays tests
test("applyStatusDelay queues bonus, flushed before pick", () => {
  const m = createTurnManager(tanks);
  applyStatusDelay(m, "p2", 120); // spec unit → 120 * 1000 when flushed
  assert.ok(m.pendingStatuses.p2?.length === 1);
  // pickNextTurn flushes pending first
  assert.equal(pickNextTurn(m), "p1"); // p2 now has 120_000 pending
  assert.equal(m.tanks.find((t) => t.id === "p2").accumulatedDelay, 120_000);
  assert.equal(m.pendingStatuses.p2, undefined);
});

test("removeTank excludes tank from future picks", () => {
  const m = createTurnManager(tanks);
  removeTank(m, "p1");
  const picks = new Set();
  for (let i = 0; i < 10; i++) {
    const id = pickNextTurn(m);
    picks.add(id);
    applyAction(m, { tankId: id, actionType: "ss1" });
  }
  assert.ok(!picks.has("p1"));
});

test("normalizeDelays preserves ordering and subtracts min", () => {
  const m = createTurnManager(tanks);
  m.tanks[0].accumulatedDelay = 500_000;
  m.tanks[1].accumulatedDelay = 200_000;
  m.tanks[2].accumulatedDelay = 900_000;
  normalizeDelays(m);
  assert.equal(m.tanks[0].accumulatedDelay, 300_000);
  assert.equal(m.tanks[1].accumulatedDelay, 0);
  assert.equal(m.tanks[2].accumulatedDelay, 700_000);
});

test("normalizeDelays ignores dead tanks for min computation", () => {
  const m = createTurnManager(tanks);
  m.tanks[0].accumulatedDelay = 500_000;
  m.tanks[1].accumulatedDelay = 100_000;
  m.tanks[2].accumulatedDelay = 900_000;
  removeTank(m, "p2"); // dead tank with the lowest value
  normalizeDelays(m);
  assert.equal(m.tanks[0].accumulatedDelay, 0);
  assert.equal(m.tanks[2].accumulatedDelay, 400_000);
});

// Task 5: snapshot tests
test("snapshot is a plain JSON-roundtrippable object and preserves structure", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "ss2" });
  applyStatusDelay(m, "p2", 400);
  removeTank(m, "p3");
  const snap = snapshot(m);
  const rt = JSON.parse(JSON.stringify(snap));
  assert.deepEqual(rt, snap);
  assert.equal(rt.tanks.length, 3);
  assert.equal(rt.tanks.find((t) => t.id === "p1").accumulatedDelay, 720 * 1300);
  assert.equal(rt.tanks.find((t) => t.id === "p3").alive, false);
  assert.ok(rt.pendingStatuses.p2);
});

// ── Plan H Task 4: Team-alternation tie-breaker ───────────────────────────────

const teamTanks = [
  { id: "a1", baseDelay: 700 }, // team 0
  { id: "b1", baseDelay: 700 }, // team 1
  { id: "a2", baseDelay: 700 }, // team 0
  { id: "b2", baseDelay: 700 }, // team 1
];
const teamMap = { a1: 0, b1: 1, a2: 0, b2: 1 };

test("pickNextTurn FFA (no teams): unchanged behavior — ties broken by lowest id", () => {
  const m = createTurnManager(teamTanks);
  // All delay=0, lowest id wins
  assert.equal(pickNextTurn(m), "a1");
});

test("pickNextTurn team-mode: prefers tank whose team differs from recentTeam", () => {
  const m = createTurnManager(teamTanks);
  // All still at 0 delay, last was team 0 → prefer team 1
  const next = pickNextTurn(m, { teams: teamMap, recentTeam: 0 });
  // b1 and b2 are team 1; b1 has lower id
  assert.equal(next, "b1");
});

test("pickNextTurn team-mode: when all same team as recentTeam, falls back to lowest id", () => {
  const m = createTurnManager([
    { id: "a1", baseDelay: 700 },
    { id: "a2", baseDelay: 700 },
  ]);
  const teams = { a1: 0, a2: 0 };
  const next = pickNextTurn(m, { teams, recentTeam: 0 });
  assert.equal(next, "a1"); // fallback to lowest id
});

test("pickNextTurn team-mode: when recentTeam undefined, falls back to lowest id", () => {
  const m = createTurnManager(teamTanks);
  const next = pickNextTurn(m, { teams: teamMap, recentTeam: undefined });
  assert.equal(next, "a1");
});

test("pickNextTurn team-mode: lower delay still wins regardless of team", () => {
  const m = createTurnManager(teamTanks);
  // Give b1 a large accumulated delay
  m.tanks.find((t) => t.id === "a1").accumulatedDelay = 5000;
  m.tanks.find((t) => t.id === "a2").accumulatedDelay = 5000;
  m.tanks.find((t) => t.id === "b2").accumulatedDelay = 5000;
  // b1 still at 0 — wins even though it's same team as recentTeam=1
  const next = pickNextTurn(m, { teams: teamMap, recentTeam: 1 });
  assert.equal(next, "b1");
});
