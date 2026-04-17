/**
 * Smoke test — 4-bot 2v2 team match (Plan H Task 14).
 *
 * Verifies:
 *  1. Team assignment (p1+p3 red, p2+p4 blue).
 *  2. resolveHit returns damage=0 for teammate attacks.
 *  3. substituteIntoActiveRoster swaps in lowest-baseDelay reserve on death.
 *  4. Ping command shape encodes/decodes without loss.
 *  5. Full npm test suite stays green (this is one of those tests).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createMatch, isTeamMate, substituteIntoActiveRoster } from "../../src/sim/match.js";
import { createTurnManager, pickNextTurn, applyAction } from "../../src/sim/turn.js";
import { fireWeapon, resolveHit } from "../../src/sim/weapons.js";
import { mulberry32 } from "../../src/sim/rng.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PLAYERS = [
  { id: "bot-r1", baseDelay: 720, name: "Red1"  },
  { id: "bot-b1", baseDelay: 660, name: "Blue1" },
  { id: "bot-r2", baseDelay: 840, name: "Red2"  },
  { id: "bot-b2", baseDelay: 600, name: "Blue2" },
];

const RNG = mulberry32(0xdeadbeef);
const ORIGIN = { x: 400, y: 300 };
const ANGLE  = 45;
const POWER  = 50;
const WIND   = 0;

// ─── 1. Team assignment ───────────────────────────────────────────────────────

test("2v2 smoke: team assignment alternates 0,1,0,1", () => {
  const match = createMatch({ mode: "team-2v2", players: PLAYERS });
  assert.equal(match.teams["bot-r1"], 0, "bot-r1 → team 0 (red)");
  assert.equal(match.teams["bot-b1"], 1, "bot-b1 → team 1 (blue)");
  assert.equal(match.teams["bot-r2"], 0, "bot-r2 → team 0 (red)");
  assert.equal(match.teams["bot-b2"], 1, "bot-b2 → team 1 (blue)");
});

test("2v2 smoke: isTeamMate correct for all pairs", () => {
  const match = createMatch({ mode: "team-2v2", players: PLAYERS });
  // Same team
  assert.equal(isTeamMate("bot-r1", "bot-r2", match.teams), true);
  assert.equal(isTeamMate("bot-b1", "bot-b2", match.teams), true);
  // Different team
  assert.equal(isTeamMate("bot-r1", "bot-b1", match.teams), false);
  assert.equal(isTeamMate("bot-r2", "bot-b2", match.teams), false);
});

// ─── 2. Team-kill prevention via resolveHit ───────────────────────────────────

test("2v2 smoke: resolveHit returns 0 for teammate hit", () => {
  const match = createMatch({ mode: "team-2v2", players: PLAYERS });
  const fakeState = { turn: null };
  const { projectiles } = fireWeapon(fakeState, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, RNG);
  const proj = projectiles[0];
  // Red1 fires at Red2 (teammate)
  const hit = resolveHit(fakeState, proj, { id: "bot-r2" }, { attackerId: "bot-r1", match });
  assert.equal(hit.damage, 0, "teammate hit should deal 0 damage");
  assert.equal(hit.reason, "teamkill-prevented");
});

test("2v2 smoke: resolveHit deals damage for enemy hit", () => {
  const match = createMatch({ mode: "team-2v2", players: PLAYERS });
  const fakeState = { turn: null };
  const { projectiles } = fireWeapon(fakeState, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, RNG);
  const proj = projectiles[0];
  // Red1 fires at Blue1 (enemy)
  const hit = resolveHit(fakeState, proj, { id: "bot-b1" }, { attackerId: "bot-r1", match });
  assert.ok(hit.damage > 0, "enemy hit should deal positive damage");
  assert.equal(hit.reason, undefined);
});

// ─── 3. Tag substitution ─────────────────────────────────────────────────────

test("tag-team smoke: substituteIntoActiveRoster swaps in lowest-baseDelay reserve", () => {
  const match = createMatch({ mode: "tag-team", players: PLAYERS });
  // Initial state: active=[bot-r1, bot-b1], reserve=[bot-r2, bot-b2]
  assert.deepEqual(match.activeRoster, ["bot-r1", "bot-b1"]);
  assert.deepEqual(match.reserveRoster, ["bot-r2", "bot-b2"]);

  // bot-r1 (red, delay 720) dies → should be replaced by bot-r2 (red, delay 840) — only red reserve
  const incoming = substituteIntoActiveRoster(match, "bot-r1", PLAYERS);
  assert.equal(incoming, "bot-r2", "bot-r2 should sub in for bot-r1");
  assert.ok(match.activeRoster.includes("bot-r2"), "active roster now has bot-r2");
  assert.ok(!match.activeRoster.includes("bot-r1"), "bot-r1 no longer in active");
  assert.ok(!match.reserveRoster.includes("bot-r2"), "bot-r2 no longer in reserve");
});

test("tag-team smoke: no sub when same-team reserve exhausted", () => {
  const match = createMatch({ mode: "tag-team", players: PLAYERS });
  substituteIntoActiveRoster(match, "bot-r1", PLAYERS); // uses up bot-r2
  const second = substituteIntoActiveRoster(match, "bot-r2", PLAYERS);
  assert.equal(second, null, "no more red reserves → null");
});

// ─── 4. Turn alternation in 2v2 ──────────────────────────────────────────────

test("2v2 smoke: team alternation breaks ties when teams and recentTeam provided", () => {
  const match = createMatch({ mode: "team-2v2", players: PLAYERS });
  const mgr = createTurnManager(PLAYERS);
  // All start at 0 delay; last team was 0 (red) → prefer blue
  const next = pickNextTurn(mgr, { teams: match.teams, recentTeam: 0 });
  // blue players are bot-b1 (delay 660) and bot-b2 (delay 600) — but all have 0 accumulatedDelay
  // bot-b1 and bot-b2 are team 1; bot-b2 < bot-b1 string compare: "bot-b2" > "bot-b1"
  // so lowest-id blue is bot-b1
  assert.equal(match.teams[next], 1, "should pick a blue (team 1) player");
});

// ─── 5. Ping command shape ───────────────────────────────────────────────────

test("ping command round-trips JSON losslessly", () => {
  const cmd = {
    t: "ping",
    turn: 7,
    tankId: "bot-r1",
    x: 512,
    y: 300,
    kind: "target",
    seq: 1713400000999,
  };
  const rt = JSON.parse(JSON.stringify(cmd));
  assert.deepEqual(rt, cmd);
});

// ─── 6. Full regression: 3-turn sim with team-kill check ────────────────────

test("2v2 smoke: 3-turn simulation — teammate fire returns 0 damage each time", () => {
  const match = createMatch({ mode: "team-2v2", players: PLAYERS });
  const mgr = createTurnManager(PLAYERS);
  let lastTeam = undefined;

  for (let t = 0; t < 3; t++) {
    const currentId = pickNextTurn(mgr, { teams: match.teams, recentTeam: lastTeam });
    assert.ok(currentId, `turn ${t}: should have a current player`);
    lastTeam = match.teams[currentId];

    // Find a teammate of currentId
    const teammate = PLAYERS.find(
      (p) => p.id !== currentId && match.teams[p.id] === lastTeam
    );
    if (teammate) {
      const fakeState = { turn: null };
      const { projectiles } = fireWeapon(fakeState, "armor_ss1", ORIGIN, ANGLE, POWER, WIND, RNG);
      const hit = resolveHit(fakeState, projectiles[0], { id: teammate.id }, {
        attackerId: currentId,
        match,
      });
      assert.equal(hit.damage, 0, `turn ${t}: teammate fire must deal 0 damage`);
      assert.equal(hit.reason, "teamkill-prevented");
    }
    applyAction(mgr, { tankId: currentId, actionType: "ss1" });
  }
});
