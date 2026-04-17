import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatch,
  isTeamMate,
  substituteIntoActiveRoster,
  endSurvivalRound,
} from "../../src/sim/match.js";

// ---------------------------------------------------------------------------
// createMatch
// ---------------------------------------------------------------------------

const players2 = [{ id: "p1", baseDelay: 720 }, { id: "p2", baseDelay: 660 }];
const players4 = [
  { id: "p1", baseDelay: 720 },
  { id: "p2", baseDelay: 660 },
  { id: "p3", baseDelay: 840 },
  { id: "p4", baseDelay: 600 },
];

test("createMatch ffa: 2 players, no teams", () => {
  const m = createMatch({ mode: "ffa", players: players2 });
  assert.equal(m.mode, "ffa");
  assert.deepEqual(m.teams, {});
  assert.equal(m.activeRoster, null);
  assert.equal(m.reserveRoster, null);
  assert.equal(m.roundCount, 1);
  assert.equal(m.survivalRound, 0);
  assert.deepEqual(m.elimination, []);
});

test("createMatch team-2v2: 4 players, teams 0/1 alternating", () => {
  const m = createMatch({ mode: "team-2v2", players: players4 });
  assert.equal(m.mode, "team-2v2");
  assert.equal(m.teams["p1"], 0); // index 0 → red
  assert.equal(m.teams["p2"], 1); // index 1 → blue
  assert.equal(m.teams["p3"], 0); // index 2 → red
  assert.equal(m.teams["p4"], 1); // index 3 → blue
  assert.equal(m.activeRoster, null);
  assert.equal(m.reserveRoster, null);
  assert.equal(m.roundCount, 1);
});

test("createMatch tag-team: 4 players, active=[p1,p2] reserve=[p3,p4]", () => {
  const m = createMatch({ mode: "tag-team", players: players4 });
  assert.equal(m.mode, "tag-team");
  assert.equal(m.teams["p1"], 0);
  assert.equal(m.teams["p2"], 1);
  assert.equal(m.teams["p3"], 0);
  assert.equal(m.teams["p4"], 1);
  assert.deepEqual(m.activeRoster, ["p1", "p2"]);
  assert.deepEqual(m.reserveRoster, ["p3", "p4"]);
});

test("createMatch survival: 3 players, no teams, roundCount=4", () => {
  const players3 = players4.slice(0, 3);
  const m = createMatch({ mode: "survival", players: players3 });
  assert.equal(m.mode, "survival");
  assert.deepEqual(m.teams, {});
  assert.equal(m.roundCount, 4);
  assert.equal(m.survivalRound, 0);
});

test("createMatch throws on unknown mode", () => {
  assert.throws(() => createMatch({ mode: "deathmatch", players: players2 }), /Unknown mode/);
});

// ---------------------------------------------------------------------------
// isTeamMate
// ---------------------------------------------------------------------------

test("isTeamMate: same team returns true", () => {
  const m = createMatch({ mode: "team-2v2", players: players4 });
  assert.equal(isTeamMate("p1", "p3", m.teams), true);
  assert.equal(isTeamMate("p2", "p4", m.teams), true);
});

test("isTeamMate: different team returns false", () => {
  const m = createMatch({ mode: "team-2v2", players: players4 });
  assert.equal(isTeamMate("p1", "p2", m.teams), false);
  assert.equal(isTeamMate("p3", "p4", m.teams), false);
});

test("isTeamMate: empty teams (FFA) always false", () => {
  const m = createMatch({ mode: "ffa", players: players2 });
  assert.equal(isTeamMate("p1", "p2", m.teams), false);
});

// ---------------------------------------------------------------------------
// substituteIntoActiveRoster
// ---------------------------------------------------------------------------

test("substituteIntoActiveRoster: non-tag mode returns null", () => {
  const m = createMatch({ mode: "team-2v2", players: players4 });
  const result = substituteIntoActiveRoster(m, "p1", players4);
  assert.equal(result, null);
});

test("substituteIntoActiveRoster: picks same-team reserve with lowest baseDelay", () => {
  // p1(red,720) dies → p3(red,840) is only red reserve
  const m = createMatch({ mode: "tag-team", players: players4 });
  const incoming = substituteIntoActiveRoster(m, "p1", players4);
  assert.equal(incoming, "p3");
  assert.ok(m.activeRoster.includes("p3"));
  assert.ok(!m.activeRoster.includes("p1"));
  assert.ok(!m.reserveRoster.includes("p3"));
});

test("substituteIntoActiveRoster: tie-break by lowest id when baseDelay equal", () => {
  const players = [
    { id: "p1", baseDelay: 700 },
    { id: "p2", baseDelay: 700 },
    { id: "p3", baseDelay: 700 }, // red reserve, id "p3"
    { id: "p4", baseDelay: 700 }, // blue reserve, id "p4"
  ];
  const m = createMatch({ mode: "tag-team", players });
  // Replace p1 (red) — only p3 is red reserve, so pick p3
  const incoming = substituteIntoActiveRoster(m, "p1", players);
  assert.equal(incoming, "p3");
});

test("substituteIntoActiveRoster: no same-team reserve → returns null", () => {
  const m = createMatch({ mode: "tag-team", players: players4 });
  // Exhaust red reserve first
  substituteIntoActiveRoster(m, "p1", players4); // p3 comes in
  // Now red reserve is empty; try to sub again
  const result = substituteIntoActiveRoster(m, "p3", players4);
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// endSurvivalRound
// ---------------------------------------------------------------------------

test("endSurvivalRound: eliminates player with lowest HP", () => {
  const m = createMatch({ mode: "survival", players: players4.slice(0, 3) });
  const eliminated = endSurvivalRound(m, { p1: 50, p2: 30, p3: 80 });
  assert.equal(eliminated, "p2");
  assert.deepEqual(m.elimination, ["p2"]);
  assert.equal(m.survivalRound, 1);
});

test("endSurvivalRound: tie-break by lowest id", () => {
  const m = createMatch({ mode: "survival", players: players4.slice(0, 3) });
  const eliminated = endSurvivalRound(m, { p1: 50, p2: 50, p3: 80 });
  assert.equal(eliminated, "p1"); // p1 < p2 by string
  assert.equal(m.survivalRound, 1);
});

test("endSurvivalRound: does not re-eliminate already eliminated", () => {
  const m = createMatch({ mode: "survival", players: players4.slice(0, 3) });
  endSurvivalRound(m, { p1: 20, p2: 60, p3: 80 }); // p1 out
  const second = endSurvivalRound(m, { p1: 0, p2: 40, p3: 90 }); // p1 already gone
  assert.equal(second, "p2");
  assert.equal(m.survivalRound, 2);
});
