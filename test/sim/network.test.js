/**
 * Bridge serialization tests for Plan H network commands:
 *   - tag-swap command shape
 *   - ping command shape
 *   - match object round-trips through JSON
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../../src/sim/match.js";

// ---------------------------------------------------------------------------
// tag-swap command serialization
// ---------------------------------------------------------------------------

test("tag-swap command: encodes and decodes correctly", () => {
  const cmd = {
    t: "tag-swap",
    turn: 3,
    deadId: "p1",
    incomingId: "p3",
    seq: 1713400000000,
  };
  const roundTripped = JSON.parse(JSON.stringify(cmd));
  assert.equal(roundTripped.t, "tag-swap");
  assert.equal(roundTripped.deadId, "p1");
  assert.equal(roundTripped.incomingId, "p3");
  assert.equal(roundTripped.turn, 3);
});

// ---------------------------------------------------------------------------
// ping command serialization
// ---------------------------------------------------------------------------

test("ping command: attention kind encodes/decodes correctly", () => {
  const cmd = {
    t: "ping",
    turn: 5,
    tankId: "p2",
    x: 320,
    y: 240,
    kind: "attention",
    seq: 1713400001000,
  };
  const rt = JSON.parse(JSON.stringify(cmd));
  assert.equal(rt.t, "ping");
  assert.equal(rt.kind, "attention");
  assert.equal(rt.x, 320);
  assert.equal(rt.y, 240);
  assert.equal(rt.tankId, "p2");
});

test("ping command: target kind encodes/decodes correctly", () => {
  const cmd = {
    t: "ping",
    turn: 2,
    tankId: "p1",
    x: 700,
    y: 400,
    kind: "target",
    seq: 1713400002000,
  };
  const rt = JSON.parse(JSON.stringify(cmd));
  assert.equal(rt.kind, "target");
});

// ---------------------------------------------------------------------------
// match state round-trips in snapshot
// ---------------------------------------------------------------------------

const players4 = [
  { id: "p1", baseDelay: 720 },
  { id: "p2", baseDelay: 660 },
  { id: "p3", baseDelay: 840 },
  { id: "p4", baseDelay: 600 },
];

test("match object survives JSON round-trip (team-2v2)", () => {
  const match = createMatch({ mode: "team-2v2", players: players4 });
  const rt = JSON.parse(JSON.stringify(match));
  assert.equal(rt.mode, "team-2v2");
  assert.deepEqual(rt.teams, match.teams);
  assert.equal(rt.roundCount, 1);
  assert.deepEqual(rt.elimination, []);
});

test("match object survives JSON round-trip (tag-team)", () => {
  const match = createMatch({ mode: "tag-team", players: players4 });
  const rt = JSON.parse(JSON.stringify(match));
  assert.deepEqual(rt.activeRoster, ["p1", "p2"]);
  assert.deepEqual(rt.reserveRoster, ["p3", "p4"]);
  assert.equal(rt.teams.p1, 0);
  assert.equal(rt.teams.p2, 1);
});

test("match object survives JSON round-trip (survival)", () => {
  const match = createMatch({ mode: "survival", players: players4.slice(0, 3) });
  const rt = JSON.parse(JSON.stringify(match));
  assert.equal(rt.roundCount, 4);
  assert.equal(rt.survivalRound, 0);
});

test("match object survives JSON round-trip (ffa)", () => {
  const match = createMatch({ mode: "ffa", players: players4.slice(0, 2) });
  const rt = JSON.parse(JSON.stringify(match));
  assert.deepEqual(rt.teams, {});
  assert.equal(rt.activeRoster, null);
});
