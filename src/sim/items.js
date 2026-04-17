/**
 * In-game items simulation — Plan G.
 *
 * Exports:
 *   maybeSpawnDrop(state, turnIndex, terrainHelper) → drop | null
 *   collectDrops(state, player, tankX, tankY) → collected[]
 *   useItem(state, player, slotIndex, target, baseDelay, turnManager) → result
 *   consumeDoubleShot(state, player, turnIndex, tankId) → { angleJitter }
 *   serializeInventory(player) → object
 *
 * All RNG via createPurposeRng(matchSeed, "item:...").
 */

import { createPurposeRng } from "./rng.js";
import { ITEMS } from "../data/items.js";

const DROP_CHANCE = 0.15; // 15% per turn
const COLLECT_RADIUS = 24; // pixels
const INVENTORY_CAP = 3;
const REPAIR_AMOUNT = 40;

// ─── maybeSpawnDrop ───────────────────────────────────────────────────────────

/**
 * Deterministically decide whether a drop spawns this turn.
 * @param {object} state   game state with matchSeed, world dimensions
 * @param {number} turnIndex
 * @param {object} terrainHelper  { surfaceYAt(x): number, width: number }
 * @returns {{ id: string, x: number, y: number, itemId: string } | null}
 */
export function maybeSpawnDrop(state, turnIndex, terrainHelper) {
  const rng = createPurposeRng(state.matchSeed, "item:drop:" + turnIndex);
  if (rng() >= DROP_CHANCE) return null;

  const width = terrainHelper.width ?? state.worldWidth ?? 1600;
  const x = Math.floor(rng() * width);
  const y = terrainHelper.surfaceYAt(x) - 8; // 8px above surface

  const itemIndex = Math.floor(rng() * ITEMS.length);
  const itemId = ITEMS[itemIndex].id;
  const id = "drop:" + turnIndex + ":0";

  return { id, x, y, itemId };
}

// ─── collectDrops ─────────────────────────────────────────────────────────────

/**
 * Check if tank at (tankX, tankY) is within COLLECT_RADIUS of any pending drop.
 * Collects eligible drops into player.inventory (capped at INVENTORY_CAP).
 * Removes collected drops from state.pendingDrops.
 * @param {object} state   game state with pendingDrops array
 * @param {object} player  player object with inventory array
 * @param {number} tankX
 * @param {number} tankY
 * @returns {Array}  array of collected drop objects
 */
export function collectDrops(state, player, tankX, tankY) {
  if (!state.pendingDrops) state.pendingDrops = [];
  if (!player.inventory) player.inventory = [];

  // Sort by id for deterministic multi-drop collection order
  const eligible = state.pendingDrops
    .filter((drop) => {
      const dx = drop.x - tankX;
      const dy = drop.y - tankY;
      return Math.sqrt(dx * dx + dy * dy) <= COLLECT_RADIUS;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const collected = [];
  for (const drop of eligible) {
    if (player.inventory.length >= INVENTORY_CAP) break;
    player.inventory.push(drop.itemId);
    collected.push(drop);
    state.pendingDrops = state.pendingDrops.filter((d) => d.id !== drop.id);
  }

  return collected;
}

// ─── useItem ──────────────────────────────────────────────────────────────────

/**
 * Use item from player's inventory slot.
 * Removes from inventory on success, applies effect.
 * Applies turn delay via applyStatusDelay (passed as applyDelay callback).
 *
 * @param {object} state       game state
 * @param {object} player      player with inventory, hp, maxHp, etc.
 * @param {number} slotIndex   0–2
 * @param {object|null} target { x, y } for teleport; null for others
 * @param {number} baseDelay   tank's baseDelay value
 * @param {Function} applyDelay  (tankId, delayUnits) → void  — wraps applyStatusDelay
 * @param {object} terrainHelper  { isSolidAt(x,y), surfaceYAt(x) } for teleport validation
 * @returns {{ ok: boolean, reason?: string, effect?: string }}
 */
export function useItem(state, player, slotIndex, target, baseDelay, applyDelay, terrainHelper) {
  if (!player.inventory) player.inventory = [];
  const itemId = player.inventory[slotIndex];
  if (itemId === undefined) {
    return { ok: false, reason: "empty-slot" };
  }

  const delayDelta = Math.round(baseDelay * 0.3);

  switch (itemId) {
    case "repair_kit": {
      const maxHp = player.maxHp ?? player.stats?.maxHealth ?? 100;
      player.hp = Math.min(maxHp, (player.hp ?? 0) + REPAIR_AMOUNT);
      player.inventory.splice(slotIndex, 1);
      applyDelay(player.id, delayDelta);
      return { ok: true, effect: "repair_kit" };
    }

    case "ion_shield": {
      player.shieldCharges = 1;
      player.inventory.splice(slotIndex, 1);
      applyDelay(player.id, delayDelta);
      return { ok: true, effect: "ion_shield" };
    }

    case "gravity_reverse": {
      // No stacking: only set if not already reversed
      if (!player.gravityOverride) {
        player.gravityOverride = -600; // fixed-point: -600 / 1000 = -0.6
      }
      player.inventory.splice(slotIndex, 1);
      applyDelay(player.id, delayDelta);
      return { ok: true, effect: "gravity_reverse" };
    }

    case "double_shot": {
      player.doubleShotPending = true;
      player.inventory.splice(slotIndex, 1);
      applyDelay(player.id, delayDelta);
      return { ok: true, effect: "double_shot" };
    }

    case "teleport": {
      if (!target || typeof target.x !== "number" || typeof target.y !== "number") {
        return { ok: false, reason: "invalid-target" };
      }
      if (!isWalkableTarget(terrainHelper, target.x, target.y)) {
        return { ok: false, reason: "invalid-target" };
      }
      player.x = target.x;
      player.y = target.y;
      player.inventory.splice(slotIndex, 1);
      applyDelay(player.id, delayDelta);
      return { ok: true, effect: "teleport" };
    }

    default:
      return { ok: false, reason: "unknown-item" };
  }
}

/**
 * Validate that target (x, y) is walkable:
 * - Not solid at target
 * - Has solid ground within 64px below
 * @param {object} terrainHelper  { isSolidAt(x,y), surfaceYAt(x) }
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function isWalkableTarget(terrainHelper, x, y) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  // Target cell must not be solid
  if (terrainHelper.isSolidAt(xi, yi)) return false;
  // Must have solid ground within 64px below
  for (let dy = 1; dy <= 64; dy++) {
    if (terrainHelper.isSolidAt(xi, yi + dy)) return true;
  }
  return false;
}

// ─── consumeDoubleShot ────────────────────────────────────────────────────────

/**
 * Consume the double_shot flag and return deterministic angle jitter.
 * RNG key: "item:doubleshot:" + turnIndex + ":" + tankId
 * @param {object} state
 * @param {object} player
 * @param {number} turnIndex
 * @param {string} tankId
 * @returns {{ angleJitter: number }}  jitter in degrees [-15, +15]
 */
export function consumeDoubleShot(state, player, turnIndex, tankId) {
  player.doubleShotPending = false;
  const rng = createPurposeRng(state.matchSeed, "item:doubleshot:" + turnIndex + ":" + tankId);
  const angleJitter = (rng() - 0.5) * 30; // [-15, +15] degrees
  return { angleJitter };
}

// ─── serializeInventory ───────────────────────────────────────────────────────

/**
 * Return a JSON-serializable snapshot of player's item-related state.
 * @param {object} player
 * @returns {{ inventory: string[], shieldCharges: number, gravityOverride: number, doubleShotPending: boolean }}
 */
export function serializeInventory(player) {
  return {
    inventory: player.inventory ? [...player.inventory] : [],
    shieldCharges: player.shieldCharges ?? 0,
    gravityOverride: player.gravityOverride ?? 0,
    doubleShotPending: player.doubleShotPending ?? false,
  };
}
