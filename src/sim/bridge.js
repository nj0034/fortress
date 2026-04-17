/**
 * Bridge overlay math — extracted verbatim from app.js.
 *
 * All functions are pure (no global state). Callers pass WORLD_WIDTH,
 * WORLD_HEIGHT, and terrain arrays explicitly.
 *
 * Key exports:
 *   isBridgeTerrainStyle(terrainStyle)
 *   getBridgeProfile(themeId, seedText, WORLD_WIDTH)
 *   getCanyonBridgeTopAt(x, profile, WORLD_HEIGHT)
 *   getSkyRuinsBridgeTopAt(x, profile, WORLD_HEIGHT)
 *   getFrostMawBridgeTopAt(x, profile, WORLD_HEIGHT)
 *   getFrostMawSupportTopAt(x, profile, WORLD_HEIGHT)
 *   calculateBridgeBottomAt(x, terrainStyle, bridgeThickness, topY, WORLD_WIDTH)
 *   calculateFrostMawSupportBottomAt(x, topY, WORLD_WIDTH)
 *   generateBridgeFloor(themeId, terrain, WORLD_WIDTH)
 *   generateSupportTerrainState(themeId, seedText, WORLD_WIDTH, WORLD_HEIGHT)
 *   collectBridgeLayersAt(x, context)   — replaces bridge branches of getTerrainLayersAt
 */

import { hashString } from "../util/text.js";
import { mulberry32 } from "./rng.js";

// ─── Style detector ────────────────────────────────────────────────────────

/**
 * @param {string} terrainStyle
 * @returns {boolean}
 */
export function isBridgeTerrainStyle(terrainStyle) {
  return terrainStyle === "bridge" || terrainStyle === "serpentbridge" || terrainStyle === "icebridge";
}

// ─── Profile generator ────────────────────────────────────────────────────

/**
 * @param {string} themeId
 * @param {string} seedText
 * @param {number} WORLD_WIDTH
 * @returns {BridgeProfile}
 */
export function getBridgeProfile(themeId, seedText, WORLD_WIDTH) {
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  return {
    phaseA: rand() * Math.PI * 2,
    phaseB: rand() * Math.PI * 2,
    phaseC: rand() * Math.PI * 2,
    left: WORLD_WIDTH * (0.14 + rand() * 0.08),
    middle: WORLD_WIDTH * (0.46 + rand() * 0.08),
    right: WORLD_WIDTH * (0.76 + rand() * 0.08),
    spreadA: 110 + rand() * 54,
    spreadB: 130 + rand() * 70,
    spreadC: 110 + rand() * 60,
  };
}

// ─── Bridge top samplers ───────────────────────────────────────────────────

/**
 * @param {number} x
 * @param {BridgeProfile} profile
 * @param {number} WORLD_HEIGHT
 * @returns {number}
 */
export function getCanyonBridgeTopAt(x, profile, WORLD_HEIGHT) {
  const bridgeY = WORLD_HEIGHT * 0.56;
  const wave =
    Math.sin(x * 0.006 + profile.phaseA) * 4.5 +
    Math.sin(x * 0.018 + profile.phaseB) * 2.6;
  const crown =
    Math.exp(-Math.pow((x - profile.left) / profile.spreadA, 2)) * -12 +
    Math.exp(-Math.pow((x - profile.right) / profile.spreadC, 2)) * -10 +
    Math.exp(-Math.pow((x - profile.middle) / profile.spreadB, 2)) * 6;
  return Math.round(bridgeY + wave + crown);
}

/**
 * @param {number} x
 * @param {BridgeProfile} profile
 * @param {number} WORLD_HEIGHT
 * @returns {number}
 */
export function getSkyRuinsBridgeTopAt(x, profile, WORLD_HEIGHT) {
  const baseline = WORLD_HEIGHT * 0.64;
  const swell = Math.sin(x * 0.0084 + profile.phaseA) * 44;
  const ripple = Math.sin(x * 0.016 + profile.phaseB) * 10;
  const centerDip = Math.exp(-Math.pow((x - profile.middle) / 220, 2)) * 24;
  const leftLift = Math.exp(-Math.pow((x - profile.left) / 120, 2)) * 16;
  const rightLift = Math.exp(-Math.pow((x - profile.right) / 120, 2)) * 12;
  return Math.round(baseline + swell + ripple + centerDip - leftLift - rightLift);
}

/**
 * @param {number} x
 * @param {BridgeProfile} profile
 * @param {number} WORLD_HEIGHT
 * @returns {number}
 */
export function getFrostMawBridgeTopAt(x, profile, WORLD_HEIGHT) {
  const baseline = WORLD_HEIGHT * 0.43;
  const wave = Math.sin(x * 0.0088 + profile.phaseA) * 26;
  const ridge = Math.sin(x * 0.021 + profile.phaseB) * 8;
  const leftShelf = Math.exp(-Math.pow((x - profile.left) / 140, 2)) * 24;
  const centerSag = Math.exp(-Math.pow((x - profile.middle) / 170, 2)) * 26;
  const rightLift = Math.exp(-Math.pow((x - profile.right) / 190, 2)) * 38;
  const facets = Math.sin(x * 0.05 + profile.phaseC) * 2.6;
  return Math.round(baseline + wave + ridge + centerSag - leftShelf - rightLift + facets);
}

/**
 * @param {number} x
 * @param {BridgeProfile} profile
 * @param {number} WORLD_HEIGHT
 * @returns {number}
 */
export function getFrostMawSupportTopAt(x, profile, WORLD_HEIGHT) {
  const baseline = WORLD_HEIGHT * 0.76;
  const wave = Math.sin(x * 0.0064 + profile.phaseA) * 12;
  const ridge = Math.sin(x * 0.017 + profile.phaseB) * 5.5;
  const centerSag = Math.exp(-Math.pow((x - profile.middle) / 220, 2)) * 18;
  const leftLift = Math.exp(-Math.pow((x - profile.left) / 180, 2)) * 12;
  const rightLift = Math.exp(-Math.pow((x - profile.right) / 190, 2)) * 16;
  const facets = Math.sin(x * 0.043 + profile.phaseC) * 3.2;
  return Math.round(baseline + wave + ridge + centerSag - leftLift - rightLift + facets);
}

// ─── Bridge bottom calculators ─────────────────────────────────────────────

/**
 * Calculate the underside (bottom) y of a bridge span at column x.
 *
 * @param {number} x
 * @param {string} terrainStyle
 * @param {number} bridgeThickness  theme.bridgeThickness ?? 30
 * @param {number} topY             getRawTerrainYAt(x, terrain)
 * @param {number} WORLD_WIDTH
 * @returns {number}
 */
export function calculateBridgeBottomAt(x, terrainStyle, bridgeThickness, topY, WORLD_WIDTH) {
  const thickness = bridgeThickness ?? 30;
  if (terrainStyle === "icebridge") {
    const shards =
      Math.sin(x * 0.018 + 0.5) * 4.2 +
      Math.sin(x * 0.055 + 1.3) * 2.4 +
      Math.exp(-Math.pow((x - WORLD_WIDTH * 0.54) / 180, 2)) * 6;
    return Math.round(topY + thickness + shards);
  }
  if (terrainStyle === "serpentbridge") {
    const chainCurve =
      Math.sin(x * 0.012 + 0.7) * 3.4 +
      Math.sin(x * 0.038 + 1.9) * 1.8 +
      Math.exp(-Math.pow((x - WORLD_WIDTH * 0.51) / 210, 2)) * 8;
    return Math.round(topY + thickness + chainCurve);
  }
  const undercurve =
    Math.sin(x * 0.013 + 0.4) * 2.5 +
    Math.sin(x * 0.031 + 1.2) * 1.4 +
    Math.exp(-Math.pow((x - WORLD_WIDTH * 0.5) / 150, 2)) * 7;
  return Math.round(topY + thickness + undercurve);
}

/**
 * @param {number} x
 * @param {number} topY  getRawTerrainYAt(x, supportTerrain)
 * @param {number} WORLD_WIDTH
 * @returns {number}
 */
export function calculateFrostMawSupportBottomAt(x, topY, WORLD_WIDTH) {
  const shards =
    Math.sin(x * 0.014 + 0.8) * 3.2 +
    Math.sin(x * 0.048 + 2.1) * 1.9 +
    Math.exp(-Math.pow((x - WORLD_WIDTH * 0.52) / 200, 2)) * 4.2;
  return Math.round(topY + 30 + shards);
}

// ─── Floor generators ─────────────────────────────────────────────────────

/**
 * Generate the bridge floor array (bottom y per column) for bridge themes.
 * Returns null for non-bridge themes.
 *
 * @param {object} theme        theme descriptor
 * @param {number[]} terrain    legacy heightmap array (top y per column)
 * @param {number} WORLD_WIDTH
 * @returns {number[] | null}
 */
export function generateBridgeFloor(theme, terrain, WORLD_WIDTH) {
  if (!isBridgeTerrainStyle(theme.terrainStyle ?? "rolling")) {
    return null;
  }
  const terrainStyle = theme.terrainStyle ?? "rolling";
  const bridgeThickness = theme.bridgeThickness ?? 30;
  return Array.from({ length: terrain.length }, (_, x) =>
    calculateBridgeBottomAt(x, terrainStyle, bridgeThickness, terrain[x], WORLD_WIDTH)
  );
}

/**
 * Generate support terrain (frostmaw only) and its bridge floor.
 *
 * @param {string} themeId
 * @param {string} seedText
 * @param {number} WORLD_WIDTH
 * @param {number} WORLD_HEIGHT
 * @returns {{ terrain: number[] | null, bridgeFloor: number[] | null }}
 */
export function generateSupportTerrainState(themeId, seedText, WORLD_WIDTH, WORLD_HEIGHT) {
  if (themeId !== "frostmaw") {
    return { terrain: null, bridgeFloor: null };
  }
  const profile = getBridgeProfile(`${themeId}-support`, seedText, WORLD_WIDTH);
  const terrain = Array.from({ length: WORLD_WIDTH }, (_, x) =>
    getFrostMawSupportTopAt(x, profile, WORLD_HEIGHT)
  );
  return {
    terrain,
    bridgeFloor: Array.from({ length: terrain.length }, (_, x) =>
      calculateFrostMawSupportBottomAt(x, terrain[x], WORLD_WIDTH)
    ),
  };
}

// ─── collectBridgeLayersAt ────────────────────────────────────────────────

/**
 * Return non-destructible bridge span layers at column x.
 * Replaces the bridge branches of getTerrainLayersAt.
 *
 * @param {number} x
 * @param {object} context
 * @param {string}   context.terrainStyle
 * @param {number}   context.bridgeThickness
 * @param {number[]} context.terrain          main terrain (top y)
 * @param {number[]} context.bridgeFloor      main bridge floor (bottom y)
 * @param {number[]} [context.supportTerrain]
 * @param {number[]} [context.supportBridgeFloor]
 * @param {number}   context.WORLD_WIDTH
 * @param {number}   context.WORLD_HEIGHT
 * @returns {Array<{ top: number, bottom: number }>}
 */
export function collectBridgeLayersAt(x, context) {
  const {
    terrainStyle,
    bridgeThickness,
    terrain,
    bridgeFloor,
    supportTerrain,
    supportBridgeFloor,
    WORLD_WIDTH,
  } = context;

  if (!isBridgeTerrainStyle(terrainStyle)) return [];

  const layers = [];
  const xi = Math.max(0, Math.min(terrain.length - 1, Math.round(x)));
  const mainTop = terrain[xi];
  const mainBottom = Array.isArray(bridgeFloor) && bridgeFloor.length
    ? bridgeFloor[xi]
    : calculateBridgeBottomAt(x, terrainStyle, bridgeThickness ?? 30, mainTop, WORLD_WIDTH);

  if (mainTop < mainBottom - 2) {
    layers.push({ top: mainTop, bottom: mainBottom });
  }

  if (Array.isArray(supportTerrain) && supportTerrain.length && Array.isArray(supportBridgeFloor)) {
    const sxi = Math.max(0, Math.min(supportTerrain.length - 1, Math.round(x)));
    const supTop = supportTerrain[sxi];
    const supBottom = supportBridgeFloor[sxi];
    if (supTop < supBottom - 2) {
      layers.push({ top: supTop, bottom: supBottom });
    }
  }

  return layers.sort((a, b) => a.top - b.top);
}
