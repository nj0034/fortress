import test from "node:test";
import assert from "node:assert/strict";
import { MODES, MODE_IDS } from "../../src/data/modes.js";

const REQUIRED_KEYS = ["id", "name", "description", "minPlayers", "maxPlayers", "teamCount", "roundCount"];

test("MODE_IDS contains exactly 4 ids", () => {
  assert.equal(MODE_IDS.length, 4);
  assert.ok(MODE_IDS.includes("ffa"));
  assert.ok(MODE_IDS.includes("team-2v2"));
  assert.ok(MODE_IDS.includes("tag-team"));
  assert.ok(MODE_IDS.includes("survival"));
});

test("each mode has all required keys", () => {
  for (const id of MODE_IDS) {
    const mode = MODES[id];
    for (const key of REQUIRED_KEYS) {
      assert.ok(key in mode, `${id} missing key: ${key}`);
    }
    assert.equal(mode.id, id, `${id}: id field matches key`);
  }
});

test("player range constraints are valid", () => {
  for (const [id, mode] of Object.entries(MODES)) {
    assert.ok(mode.minPlayers >= 2, `${id}: minPlayers >= 2`);
    assert.ok(mode.maxPlayers <= 4, `${id}: maxPlayers <= 4`);
    assert.ok(mode.minPlayers <= mode.maxPlayers, `${id}: minPlayers <= maxPlayers`);
  }
});

test("ffa has teamCount=0 and roundCount=1", () => {
  assert.equal(MODES.ffa.teamCount, 0);
  assert.equal(MODES.ffa.roundCount, 1);
});

test("team-2v2 requires exactly 4 players and has 2 teams", () => {
  const m = MODES["team-2v2"];
  assert.equal(m.minPlayers, 4);
  assert.equal(m.maxPlayers, 4);
  assert.equal(m.teamCount, 2);
});

test("tag-team requires exactly 4 players and has 2 teams", () => {
  const m = MODES["tag-team"];
  assert.equal(m.minPlayers, 4);
  assert.equal(m.maxPlayers, 4);
  assert.equal(m.teamCount, 2);
});

test("survival has roundCount=4 and teamCount=0", () => {
  const m = MODES.survival;
  assert.equal(m.roundCount, 4);
  assert.equal(m.teamCount, 0);
  assert.ok(m.minPlayers >= 3);
});
