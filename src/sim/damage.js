/**
 * Hit classification — Plan I §1.
 * Pure functions, no Math.random(), no side effects.
 *
 * classifyHit(projectile, victim, impactPoint, opts)
 *   → { type, damageMultiplier, label, color }
 */

import { TANK_TYPES } from "../data/tanks.js";

// Damage multiplier table
export const HIT_MULTIPLIERS = {
  normal:   1.0,
  critical: 1.5,
  aerial:   1.25,
  pierce:   1.0,
  miss:     0,
};

// Half-height of the critical hit box around the turret pivot
const CRITICAL_BOX_HALF = 10;

/**
 * Classify a hit into one of: miss | critical | aerial | pierce | normal.
 *
 * Priority order:
 *   1. miss     — victim is null/undefined
 *   2. critical — impactPoint.y within victim.y + turret.pivotY ± CRITICAL_BOX_HALF
 *   3. aerial   — projectile was still airborne (phase==="air" or grounded!==true)
 *   4. pierce   — projectile kind==="pierce" and not the last hit
 *   5. normal   — everything else
 *
 * @param {object|null} projectile
 * @param {object|null} victim     - player object with .y and .tankType
 * @param {{x:number,y:number}} impactPoint
 * @param {object} [opts]
 * @param {boolean} [opts.isLastHit=true]  - false when pierce still has pierces left
 * @returns {{ type: string, damageMultiplier: number, label: string, color: string }}
 */
export function classifyHit(projectile, victim, impactPoint, opts = {}) {
  const { isLastHit = true } = opts;

  // 1. miss
  if (!victim) {
    return { type: "miss", damageMultiplier: HIT_MULTIPLIERS.miss, label: "MISS", color: "#aaaaaa" };
  }

  // 2. critical — impact near turret pivot
  const tankDef = TANK_TYPES[victim.tankType];
  const pivotY = tankDef?.turret?.pivotY ?? 72;
  const turretWorldY = victim.y + pivotY;
  if (impactPoint && Math.abs(impactPoint.y - turretWorldY) <= CRITICAL_BOX_HALF) {
    return { type: "critical", damageMultiplier: HIT_MULTIPLIERS.critical, label: "CRITICAL!", color: "#ff3333" };
  }

  // 3. aerial — projectile was still in flight when it hit
  if (projectile && (projectile.phase === "air" || projectile.grounded !== true)) {
    return { type: "aerial", damageMultiplier: HIT_MULTIPLIERS.aerial, label: "AERIAL!", color: "#ffaa00" };
  }

  // 4. pierce — not the final hit of a pierce chain
  if (projectile && projectile.kind === "pierce" && !isLastHit) {
    return { type: "pierce", damageMultiplier: HIT_MULTIPLIERS.pierce, label: "PIERCE", color: "#88ccff" };
  }

  // 5. normal
  return { type: "normal", damageMultiplier: HIT_MULTIPLIERS.normal, label: "HIT", color: "#ffffff" };
}
