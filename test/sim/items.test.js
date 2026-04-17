import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maybeSpawnDrop,
  collectDrops,
  useItem,
  consumeDoubleShot,
  serializeInventory,
} from "../../src/sim/items.js";
import { ITEMS } from "../../src/data/items.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeState(matchSeed = "testseed") {
  return { matchSeed, pendingDrops: [], worldWidth: 1600 };
}

function makeTerrain(surfaceY = 300) {
  return {
    width: 1600,
    surfaceYAt: (x) => surfaceY,
    isSolidAt: (x, y) => y >= surfaceY,
  };
}

function makePlayer(overrides = {}) {
  return {
    id: "p1",
    hp: 100,
    maxHp: 150,
    inventory: [],
    shieldCharges: 0,
    gravityOverride: 0,
    doubleShotPending: false,
    ...overrides,
  };
}

function noopDelay() {}
function captureDelay() {
  const calls = [];
  const fn = (tankId, delta) => calls.push({ tankId, delta });
  fn.calls = calls;
  return fn;
}

// ─── Task 2: maybeSpawnDrop ───────────────────────────────────────────────────

test("maybeSpawnDrop returns object with id, x, y, itemId or null", () => {
  const state = makeState("seed42");
  const terrain = makeTerrain(300);
  // Try multiple turns to get at least one drop
  let drop = null;
  for (let i = 0; i < 20; i++) {
    drop = maybeSpawnDrop(state, i, terrain);
    if (drop) break;
  }
  assert.ok(drop !== undefined, "should return null or object");
  if (drop) {
    assert.ok(typeof drop.id === "string");
    assert.ok(typeof drop.x === "number");
    assert.ok(typeof drop.y === "number");
    assert.ok(typeof drop.itemId === "string");
    assert.ok(ITEMS.some((i) => i.id === drop.itemId), "itemId must be a valid item id");
  }
});

test("maybeSpawnDrop is deterministic for same seed+turnIndex", () => {
  const terrain = makeTerrain(300);
  for (let i = 0; i < 30; i++) {
    const s1 = makeState("repeatSeed");
    const s2 = makeState("repeatSeed");
    const d1 = maybeSpawnDrop(s1, i, terrain);
    const d2 = maybeSpawnDrop(s2, i, terrain);
    assert.deepEqual(d1, d2, `turn ${i} must be deterministic`);
  }
});

test("maybeSpawnDrop produces ~15% drop rate over 1000 turns (12-18%)", () => {
  const state = makeState("rateSeed");
  const terrain = makeTerrain(300);
  let count = 0;
  for (let i = 0; i < 1000; i++) {
    if (maybeSpawnDrop(state, i, terrain)) count++;
  }
  assert.ok(count >= 120 && count <= 180, `drop count ${count} not in [120,180]`);
});

test("maybeSpawnDrop y is surfaceYAt(x) - 8", () => {
  // Use a seed that reliably spawns on turn 0
  const terrain = {
    width: 1600,
    surfaceYAt: (x) => 400,
    isSolidAt: (x, y) => y >= 400,
  };
  // Try seeds until we find one that drops on turn 0
  for (let s = 0; s < 50; s++) {
    const state = makeState("surf" + s);
    const drop = maybeSpawnDrop(state, 0, terrain);
    if (drop) {
      assert.equal(drop.y, 400 - 8, "y should be surfaceYAt(x) - 8");
      return;
    }
  }
  // If no drop found in 50 seeds on turn 0, skip (unlikely but protect against flake)
  assert.ok(true, "no drop on turn 0 across 50 seeds — skipping y check");
});

test("maybeSpawnDrop id format is 'drop:turnIndex:0'", () => {
  const terrain = makeTerrain(300);
  for (let i = 0; i < 50; i++) {
    const state = makeState("idcheck");
    const drop = maybeSpawnDrop(state, i, terrain);
    if (drop) {
      assert.equal(drop.id, `drop:${i}:0`);
      return;
    }
  }
});

// ─── Task 3: collectDrops ─────────────────────────────────────────────────────

test("collectDrops: tank within 24px collects the drop", () => {
  const state = makeState();
  state.pendingDrops = [{ id: "drop:1:0", x: 100, y: 100, itemId: "repair_kit" }];
  const player = makePlayer();
  const collected = collectDrops(state, player, 100, 100);
  assert.equal(collected.length, 1);
  assert.equal(player.inventory.length, 1);
  assert.equal(player.inventory[0], "repair_kit");
  assert.equal(state.pendingDrops.length, 0);
});

test("collectDrops: tank at exactly 24px collects", () => {
  const state = makeState();
  state.pendingDrops = [{ id: "drop:1:0", x: 124, y: 100, itemId: "ion_shield" }];
  const player = makePlayer();
  const collected = collectDrops(state, player, 100, 100);
  assert.equal(collected.length, 1);
});

test("collectDrops: tank beyond 24px does not collect", () => {
  const state = makeState();
  state.pendingDrops = [{ id: "drop:1:0", x: 200, y: 100, itemId: "repair_kit" }];
  const player = makePlayer();
  const collected = collectDrops(state, player, 100, 100);
  assert.equal(collected.length, 0);
  assert.equal(state.pendingDrops.length, 1);
});

test("collectDrops: inventory capped at 3", () => {
  const state = makeState();
  state.pendingDrops = [
    { id: "drop:1:0", x: 100, y: 100, itemId: "repair_kit" },
    { id: "drop:2:0", x: 100, y: 100, itemId: "ion_shield" },
    { id: "drop:3:0", x: 100, y: 100, itemId: "teleport" },
    { id: "drop:4:0", x: 100, y: 100, itemId: "double_shot" },
  ];
  const player = makePlayer();
  collectDrops(state, player, 100, 100);
  assert.equal(player.inventory.length, 3);
  // 1 drop remains uncollected
  assert.equal(state.pendingDrops.length, 1);
});

test("collectDrops: already-full inventory collects nothing", () => {
  const state = makeState();
  state.pendingDrops = [{ id: "drop:1:0", x: 100, y: 100, itemId: "teleport" }];
  const player = makePlayer({ inventory: ["a", "b", "c"] });
  const collected = collectDrops(state, player, 100, 100);
  assert.equal(collected.length, 0);
  assert.equal(state.pendingDrops.length, 1);
});

test("collectDrops: multiple drops collected in id-sorted order", () => {
  const state = makeState();
  state.pendingDrops = [
    { id: "drop:3:0", x: 100, y: 100, itemId: "ion_shield" },
    { id: "drop:1:0", x: 100, y: 100, itemId: "repair_kit" },
    { id: "drop:2:0", x: 100, y: 100, itemId: "teleport" },
  ];
  const player = makePlayer();
  collectDrops(state, player, 100, 100);
  assert.deepEqual(player.inventory, ["repair_kit", "teleport", "ion_shield"]);
});

// ─── Task 4: useItem dispatcher ───────────────────────────────────────────────

test("useItem: empty slot returns {ok:false, reason:'empty-slot'}", () => {
  const state = makeState();
  const player = makePlayer({ inventory: [] });
  const result = useItem(state, player, 0, null, 720, noopDelay, makeTerrain());
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty-slot");
});

test("useItem: repair_kit restores +40 HP (clamped to maxHp)", () => {
  const state = makeState();
  const player = makePlayer({ hp: 80, maxHp: 150, inventory: ["repair_kit"] });
  const d = captureDelay();
  const result = useItem(state, player, 0, null, 720, d, makeTerrain());
  assert.equal(result.ok, true);
  assert.equal(result.effect, "repair_kit");
  assert.equal(player.hp, 120); // 80 + 40
  assert.equal(player.inventory.length, 0); // consumed
  assert.equal(d.calls.length, 1);
  assert.equal(d.calls[0].tankId, "p1");
});

test("useItem: repair_kit clamps at maxHp", () => {
  const state = makeState();
  const player = makePlayer({ hp: 130, maxHp: 150, inventory: ["repair_kit"] });
  useItem(state, player, 0, null, 720, noopDelay, makeTerrain());
  assert.equal(player.hp, 150);
});

test("useItem: ion_shield sets shieldCharges=1", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["ion_shield"] });
  const result = useItem(state, player, 0, null, 720, noopDelay, makeTerrain());
  assert.equal(result.ok, true);
  assert.equal(player.shieldCharges, 1);
  assert.equal(player.inventory.length, 0);
});

test("useItem: delay is baseDelay * 0.3 (rounded)", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["repair_kit"] });
  const d = captureDelay();
  useItem(state, player, 0, null, 720, d, makeTerrain());
  assert.equal(d.calls[0].delta, Math.round(720 * 0.3)); // 216
});

test("useItem: slot index removes correct slot", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["teleport", "repair_kit", "ion_shield"] });
  const terrain = {
    isSolidAt: (x, y) => y >= 300,
    surfaceYAt: (x) => 300,
  };
  useItem(state, player, 1, null, 720, noopDelay, terrain); // repair_kit at slot 1
  assert.deepEqual(player.inventory, ["teleport", "ion_shield"]);
});

// ─── Task 5: gravity_reverse + double_shot ────────────────────────────────────

test("useItem: gravity_reverse sets gravityOverride to -600", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["gravity_reverse"] });
  const result = useItem(state, player, 0, null, 720, noopDelay, makeTerrain());
  assert.equal(result.ok, true);
  assert.equal(player.gravityOverride, -600);
  assert.equal(player.inventory.length, 0);
});

test("useItem: gravity_reverse does not stack (no override if already set)", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["gravity_reverse", "gravity_reverse"], gravityOverride: -600 });
  useItem(state, player, 0, null, 720, noopDelay, makeTerrain());
  assert.equal(player.gravityOverride, -600); // unchanged
});

test("useItem: double_shot sets doubleShotPending=true", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["double_shot"] });
  const result = useItem(state, player, 0, null, 720, noopDelay, makeTerrain());
  assert.equal(result.ok, true);
  assert.equal(player.doubleShotPending, true);
  assert.equal(player.inventory.length, 0);
});

test("consumeDoubleShot: flips doubleShotPending to false and returns angleJitter", () => {
  const state = makeState("jitterSeed");
  const player = makePlayer({ doubleShotPending: true });
  const result = consumeDoubleShot(state, player, 5, "p1");
  assert.equal(player.doubleShotPending, false);
  assert.ok(typeof result.angleJitter === "number");
  assert.ok(result.angleJitter >= -15 && result.angleJitter <= 15, `jitter ${result.angleJitter} out of range`);
});

test("consumeDoubleShot: deterministic for same inputs", () => {
  for (let i = 0; i < 10; i++) {
    const r1 = consumeDoubleShot(makeState("ds"), makePlayer({ doubleShotPending: true }), i, "tank1");
    const r2 = consumeDoubleShot(makeState("ds"), makePlayer({ doubleShotPending: true }), i, "tank1");
    assert.equal(r1.angleJitter, r2.angleJitter, `turn ${i} jitter not deterministic`);
  }
});

test("consumeDoubleShot: different tankId gives different jitter", () => {
  const r1 = consumeDoubleShot(makeState("ds"), makePlayer({ doubleShotPending: true }), 1, "tank1");
  const r2 = consumeDoubleShot(makeState("ds"), makePlayer({ doubleShotPending: true }), 1, "tank2");
  assert.notEqual(r1.angleJitter, r2.angleJitter);
});

// ─── Task 6: teleport ────────────────────────────────────────────────────────

test("useItem: teleport valid target moves tank", () => {
  const state = makeState();
  const player = makePlayer({ x: 0, y: 0, inventory: ["teleport"] });
  const terrain = {
    isSolidAt: (x, y) => y >= 300,
    surfaceYAt: (x) => 300,
  };
  const result = useItem(state, player, 0, { x: 200, y: 295 }, 720, noopDelay, terrain);
  assert.equal(result.ok, true);
  assert.equal(player.x, 200);
  assert.equal(player.y, 295);
  assert.equal(player.inventory.length, 0);
});

test("useItem: teleport into solid returns {ok:false, reason:'invalid-target'}", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["teleport"] });
  const terrain = {
    isSolidAt: (x, y) => y >= 300,
    surfaceYAt: (x) => 300,
  };
  const result = useItem(state, player, 0, { x: 200, y: 350 }, 720, noopDelay, terrain);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-target");
  assert.equal(player.inventory.length, 1); // not consumed
});

test("useItem: teleport with no ground within 64px returns {ok:false, reason:'invalid-target'}", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["teleport"] });
  const terrain = {
    isSolidAt: (x, y) => false, // no solid anywhere
    surfaceYAt: (x) => 9999,
  };
  const result = useItem(state, player, 0, { x: 200, y: 10 }, 720, noopDelay, terrain);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-target");
});

test("useItem: teleport with null target returns {ok:false, reason:'invalid-target'}", () => {
  const state = makeState();
  const player = makePlayer({ inventory: ["teleport"] });
  const result = useItem(state, player, 0, null, 720, noopDelay, makeTerrain());
  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid-target");
});

// ─── Task 7: serializeInventory ───────────────────────────────────────────────

test("serializeInventory returns all fields with sane defaults", () => {
  const player = makePlayer();
  const snap = serializeInventory(player);
  assert.deepEqual(snap.inventory, []);
  assert.equal(snap.shieldCharges, 0);
  assert.equal(snap.gravityOverride, 0);
  assert.equal(snap.doubleShotPending, false);
});

test("serializeInventory JSON roundtrip preserves values", () => {
  const player = makePlayer({
    inventory: ["repair_kit", "ion_shield"],
    shieldCharges: 1,
    gravityOverride: -600,
    doubleShotPending: true,
  });
  const snap = serializeInventory(player);
  const roundtripped = JSON.parse(JSON.stringify(snap));
  assert.deepEqual(roundtripped, snap);
});

test("serializeInventory inventory is a copy, not a reference", () => {
  const player = makePlayer({ inventory: ["repair_kit"] });
  const snap = serializeInventory(player);
  snap.inventory.push("extra");
  assert.equal(player.inventory.length, 1);
});
