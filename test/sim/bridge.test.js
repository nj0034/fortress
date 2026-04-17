import test from "node:test";
import assert from "node:assert/strict";
import {
  isBridgeTerrainStyle,
  getBridgeProfile,
  getCanyonBridgeTopAt,
  getSkyRuinsBridgeTopAt,
  getFrostMawBridgeTopAt,
  getFrostMawSupportTopAt,
  calculateBridgeBottomAt,
  calculateFrostMawSupportBottomAt,
  generateBridgeFloor,
  generateSupportTerrainState,
  collectBridgeLayersAt,
} from "../../src/sim/bridge.js";

const WORLD_WIDTH = 1628;
const WORLD_HEIGHT = 884;
const MID_X = Math.round(WORLD_WIDTH / 2);

// ── isBridgeTerrainStyle ─────────────────────────────────────────────────────

test("isBridgeTerrainStyle returns true for bridge styles", () => {
  assert.equal(isBridgeTerrainStyle("bridge"), true);
  assert.equal(isBridgeTerrainStyle("serpentbridge"), true);
  assert.equal(isBridgeTerrainStyle("icebridge"), true);
});

test("isBridgeTerrainStyle returns false for non-bridge styles", () => {
  assert.equal(isBridgeTerrainStyle("rolling"), false);
  assert.equal(isBridgeTerrainStyle("mesa"), false);
  assert.equal(isBridgeTerrainStyle("dunes"), false);
  assert.equal(isBridgeTerrainStyle(""), false);
});

// ── getBridgeProfile ─────────────────────────────────────────────────────────

test("getBridgeProfile returns an object with all required keys", () => {
  const p = getBridgeProfile("canyonbridge", "test", WORLD_WIDTH);
  for (const key of ["phaseA", "phaseB", "phaseC", "left", "middle", "right", "spreadA", "spreadB", "spreadC"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(p, key), `missing key: ${key}`);
  }
});

test("getBridgeProfile is deterministic for same args", () => {
  const a = getBridgeProfile("canyonbridge", "seed42", WORLD_WIDTH);
  const b = getBridgeProfile("canyonbridge", "seed42", WORLD_WIDTH);
  assert.deepEqual(a, b);
});

test("getBridgeProfile left/middle/right are within world bounds", () => {
  const p = getBridgeProfile("skyruins", "default", WORLD_WIDTH);
  assert.ok(p.left >= 0 && p.left < WORLD_WIDTH);
  assert.ok(p.middle >= 0 && p.middle < WORLD_WIDTH);
  assert.ok(p.right >= 0 && p.right < WORLD_WIDTH);
});

// ── canyonbridge: top < bottom at mid-world x ────────────────────────────────

test("canyonbridge: top < bottom at mid-world x with default seed", () => {
  const profile = getBridgeProfile("canyonbridge", "default", WORLD_WIDTH);
  const topY = getCanyonBridgeTopAt(MID_X, profile, WORLD_HEIGHT);
  const terrainY = topY;
  const bottom = calculateBridgeBottomAt(MID_X, "bridge", 30, terrainY, WORLD_WIDTH);
  assert.ok(topY < bottom, `canyonbridge top=${topY} should < bottom=${bottom}`);
});

// ── skyruins: top < bottom at mid-world x ────────────────────────────────────

test("skyruins: top < bottom at mid-world x with default seed", () => {
  const profile = getBridgeProfile("skyruins", "default", WORLD_WIDTH);
  const topY = getSkyRuinsBridgeTopAt(MID_X, profile, WORLD_HEIGHT);
  const bottom = calculateBridgeBottomAt(MID_X, "serpentbridge", 30, topY, WORLD_WIDTH);
  assert.ok(topY < bottom, `skyruins top=${topY} should < bottom=${bottom}`);
});

// ── frostmaw: top < bottom at mid-world x ────────────────────────────────────

test("frostmaw: top < bottom at mid-world x with default seed", () => {
  const profile = getBridgeProfile("frostmaw", "default", WORLD_WIDTH);
  const topY = getFrostMawBridgeTopAt(MID_X, profile, WORLD_HEIGHT);
  const bottom = calculateBridgeBottomAt(MID_X, "icebridge", 30, topY, WORLD_WIDTH);
  assert.ok(topY < bottom, `frostmaw top=${topY} should < bottom=${bottom}`);
});

// ── getFrostMawSupportTopAt ───────────────────────────────────────────────────

test("getFrostMawSupportTopAt returns a value within WORLD_HEIGHT range", () => {
  const profile = getBridgeProfile("frostmaw-support", "default", WORLD_WIDTH);
  const y = getFrostMawSupportTopAt(MID_X, profile, WORLD_HEIGHT);
  assert.ok(y > 0 && y < WORLD_HEIGHT, `support top ${y} out of range`);
});

// ── calculateFrostMawSupportBottomAt ─────────────────────────────────────────

test("calculateFrostMawSupportBottomAt returns bottom > top", () => {
  const topY = 500;
  const bottom = calculateFrostMawSupportBottomAt(MID_X, topY, WORLD_WIDTH);
  assert.ok(bottom > topY, `support bottom=${bottom} should > topY=${topY}`);
});

// ── generateBridgeFloor ───────────────────────────────────────────────────────

test("generateBridgeFloor returns null for non-bridge themes", () => {
  const theme = { id: "coral", terrainStyle: "archipelago" };
  const terrain = new Array(WORLD_WIDTH).fill(400);
  assert.equal(generateBridgeFloor(theme, terrain, WORLD_WIDTH), null);
});

test("generateBridgeFloor returns array with length === terrain.length for bridge themes", () => {
  const theme = { id: "canyonbridge", terrainStyle: "bridge", bridgeThickness: 30 };
  const terrain = new Array(WORLD_WIDTH).fill(500);
  const floor = generateBridgeFloor(theme, terrain, WORLD_WIDTH);
  assert.ok(Array.isArray(floor));
  assert.equal(floor.length, WORLD_WIDTH);
});

test("generateBridgeFloor values are all > terrain (top)", () => {
  const theme = { id: "canyonbridge", terrainStyle: "bridge", bridgeThickness: 30 };
  const terrain = new Array(WORLD_WIDTH).fill(500);
  const floor = generateBridgeFloor(theme, terrain, WORLD_WIDTH);
  for (let x = 0; x < WORLD_WIDTH; x++) {
    assert.ok(floor[x] > terrain[x], `floor[${x}]=${floor[x]} should > terrain[${x}]=${terrain[x]}`);
  }
});

// ── generateSupportTerrainState ───────────────────────────────────────────────

test("generateSupportTerrainState returns null terrain for non-frostmaw", () => {
  const result = generateSupportTerrainState("canyonbridge", "test", WORLD_WIDTH, WORLD_HEIGHT);
  assert.equal(result.terrain, null);
  assert.equal(result.bridgeFloor, null);
});

test("generateSupportTerrainState returns terrain arrays for frostmaw", () => {
  const result = generateSupportTerrainState("frostmaw", "test", WORLD_WIDTH, WORLD_HEIGHT);
  assert.ok(Array.isArray(result.terrain));
  assert.ok(Array.isArray(result.bridgeFloor));
  assert.equal(result.terrain.length, WORLD_WIDTH);
  assert.equal(result.bridgeFloor.length, WORLD_WIDTH);
});

// ── collectBridgeLayersAt ─────────────────────────────────────────────────────

test("collectBridgeLayersAt returns empty for non-bridge styles", () => {
  const ctx = {
    terrainStyle: "rolling",
    bridgeThickness: 30,
    terrain: new Array(WORLD_WIDTH).fill(400),
    bridgeFloor: null,
    WORLD_WIDTH,
    WORLD_HEIGHT,
  };
  const layers = collectBridgeLayersAt(MID_X, ctx);
  assert.deepEqual(layers, []);
});

test("collectBridgeLayersAt returns a layer with top < bottom for bridge", () => {
  const terrain = new Array(WORLD_WIDTH).fill(500);
  const theme = { id: "canyonbridge", terrainStyle: "bridge", bridgeThickness: 30 };
  const bridgeFloor = generateBridgeFloor(theme, terrain, WORLD_WIDTH);
  const ctx = {
    terrainStyle: "bridge",
    bridgeThickness: 30,
    terrain,
    bridgeFloor,
    WORLD_WIDTH,
    WORLD_HEIGHT,
  };
  const layers = collectBridgeLayersAt(MID_X, ctx);
  assert.equal(layers.length, 1);
  assert.ok(layers[0].top < layers[0].bottom, `top=${layers[0].top} < bottom=${layers[0].bottom}`);
});

test("collectBridgeLayersAt returns 2 layers for frostmaw with support", () => {
  const terrain = new Array(WORLD_WIDTH).fill(380);
  const theme = { id: "frostmaw", terrainStyle: "icebridge", bridgeThickness: 30 };
  const bridgeFloor = generateBridgeFloor(theme, terrain, WORLD_WIDTH);
  const support = generateSupportTerrainState("frostmaw", "test", WORLD_WIDTH, WORLD_HEIGHT);
  const ctx = {
    terrainStyle: "icebridge",
    bridgeThickness: 30,
    terrain,
    bridgeFloor,
    supportTerrain: support.terrain,
    supportBridgeFloor: support.bridgeFloor,
    WORLD_WIDTH,
    WORLD_HEIGHT,
  };
  const layers = collectBridgeLayersAt(MID_X, ctx);
  assert.equal(layers.length, 2);
  // Layers are sorted by top
  assert.ok(layers[0].top <= layers[1].top);
});
