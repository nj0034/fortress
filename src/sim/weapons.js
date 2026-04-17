/**
 * Weapon execution engine — Plan D §3 / spec §8.1.
 *
 * fireWeapon(state, weaponId, origin, angleDeg, power, wind, rng)
 *   → { projectiles: Projectile[] }
 *
 * All randomness must be passed in via `rng` (no Math.random() here).
 * Shot-type handlers:
 *   single  — one projectile
 *   split   — one "split-parent" that bursts into children after airBurstTimer
 *   multi   — N simultaneous siblings (or random-fall for Meteor Swarm)
 *   pierce  — projectile with pierce count
 *   burrow  — projectile that tunnels into terrain then bursts
 *   chain   — projectile that chains to nearby tanks on hit
 *
 * resolveHit(state, projectile, victim) — applies frozen status delay
 * resolveSelfHeal(state, projectile, shooter) — applies turtle self-heal
 */

import { WEAPONS } from "../data/weapons.js";
import { sinFP, cosFP, fromFP } from "./fixedpoint.js";

export { WEAPON_SLOT_DELAY } from "../data/weapons.js";

const POWER_TO_SPEED = 0.22;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProjectile(origin, angleDeg, power, weapon, extras = {}) {
  const speed = power * POWER_TO_SPEED * (weapon.projectile.speedMultiplier ?? 1);
  const cx = fromFP(cosFP(angleDeg));
  const sy = fromFP(sinFP(angleDeg));
  return {
    x: origin.x,
    y: origin.y,
    vx: cx * speed,
    vy: -sy * speed,
    damage: weapon.projectile.damage,
    radius: weapon.projectile.radius,
    craterMultiplier: weapon.projectile.craterMultiplier ?? 1.0,
    gravityScale: weapon.projectile.gravityScale ?? 1.0,
    windFactor: weapon.projectile.windFactor ?? 1.0,
    pierce: weapon.projectile.pierce ?? 0,
    status: weapon.projectile.status ?? null,
    selfHeal: weapon.projectile.selfHeal ?? 0,
    trail: weapon.fx.trail,
    weaponId: weapon._id,
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

export function fireWeapon(state, weaponId, origin, angleDeg, power, wind, rng) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`unknown weapon: ${weaponId}`);
  const w = { ...weapon, _id: weaponId };
  switch (w.shotType) {
    case "single":  return fireSingle(state, w, origin, angleDeg, power, rng);
    case "split":   return fireSplit(state, w, origin, angleDeg, power, rng);
    case "multi":   return fireMulti(state, w, origin, angleDeg, power, rng);
    case "pierce":  return firePierce(state, w, origin, angleDeg, power, rng);
    case "burrow":  return fireBurrow(state, w, origin, angleDeg, power, rng);
    case "chain":   return fireChain(state, w, origin, angleDeg, power, rng);
    default: throw new Error(`unsupported shotType: ${w.shotType}`);
  }
}

// ---------------------------------------------------------------------------
// single
// ---------------------------------------------------------------------------

function fireSingle(_state, w, origin, angle, power) {
  return { projectiles: [makeProjectile(origin, angle, power, w)] };
}

// ---------------------------------------------------------------------------
// split — parent carries fragment descriptors; sim loop spawns children
// ---------------------------------------------------------------------------

function fireSplit(_state, w, origin, angle, power) {
  const parent = makeProjectile(origin, angle, power, w, { kind: "split-parent" });
  const frags = w.projectile.fragments ?? [];
  parent.airBurstTimer = frags[0]?.airBurstTimer ?? 24;
  parent.fragments = frags.map((f) => ({
    offsetAngle: f.offsetAngle ?? 0,
    speedMultiplier: f.speedMultiplier ?? 1,
    damage: f.damage ?? parent.damage,
    radius: f.radius ?? parent.radius,
    craterMultiplier: f.craterMultiplier ?? 0.85,
    status: parent.status,
  }));
  return { projectiles: [parent] };
}

// ---------------------------------------------------------------------------
// multi — simultaneous siblings, or random-fall (Meteor Swarm)
// ---------------------------------------------------------------------------

function fireMulti(_state, w, origin, angle, power, rng) {
  if (w.projectile.randomFall) {
    const { count, spreadX } = w.projectile.randomFall;
    const out = [];
    for (let i = 0; i < count; i++) {
      const dx = (rng() - 0.5) * spreadX;
      out.push(makeProjectile({ x: origin.x + dx, y: 0 }, 270, 40, w, { kind: "fall" }));
    }
    return { projectiles: out };
  }
  const frags = w.projectile.fragments ?? [];
  return {
    projectiles: frags.map((f) =>
      makeProjectile(origin, angle + (f.offsetAngle ?? 0), power * (f.speedMultiplier ?? 1), w, {
        kind: "multi",
        damage: f.damage ?? w.projectile.damage,
        radius: f.radius ?? w.projectile.radius,
        zigzagAmp: f.zigzagAmp ?? 0,
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// pierce — projectile retains pierce counter; sim decrements on tank hit
// ---------------------------------------------------------------------------

function firePierce(_state, w, origin, angle, power) {
  return {
    projectiles: [
      makeProjectile(origin, angle, power, w, {
        kind: "pierce",
        terrainPierceCells: w.projectile.terrainPierceCells ?? 0,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// burrow — airborne → impact → tunnel → terminal burst (with optional hSpan)
// ---------------------------------------------------------------------------

function fireBurrow(_state, w, origin, angle, power) {
  return {
    projectiles: [
      makeProjectile(origin, angle, power, w, {
        kind: "burrow",
        burrow: { ...(w.projectile.burrow ?? {}) },
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// chain — on hit, arcs to nearest alive tanks within range
// ---------------------------------------------------------------------------

function fireChain(_state, w, origin, angle, power) {
  return {
    projectiles: [
      makeProjectile(origin, angle, power, w, {
        kind: "chain",
        chain: { ...(w.projectile.chain ?? { count: 0, range: 0, falloff: 0.8 }) },
        terrainPierceCells: w.projectile.terrainPierceCells ?? 0,
        verticalStrike: w.projectile.verticalStrike ?? false,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// resolveHit — apply frozen status delay via turn manager
// ---------------------------------------------------------------------------

/**
 * Call after a projectile hits a victim tank.
 * Applies frozen status delay if the projectile carries one.
 * Prevents damage if attacker and victim are teammates.
 *
 * @param {object} state   - { turn: turnManager } (Plan B's applyStatusDelay)
 * @param {object} proj    - fired projectile (carries .damage, .status, .ownerId)
 * @param {object} victim  - player object with .id
 * @param {object} [opts]  - { attackerId?: string, match?: { teams: object } }
 * @returns {{ damage: number, reason?: string }}
 */
export function resolveHit(state, proj, victim, { attackerId, match } = {}) {
  // Team-kill prevention: zero damage if same team
  if (match && attackerId !== undefined) {
    const teams = match.teams ?? {};
    const at = teams[attackerId];
    const vt = teams[victim.id];
    if (at !== undefined && vt !== undefined && at === vt && attackerId !== victim.id) {
      return { damage: 0, reason: "teamkill-prevented" };
    }
  }

  if (proj.status?.type === "frozen" && state.turn) {
    const { applyStatusDelay } = state.turn;
    if (typeof applyStatusDelay === "function") {
      applyStatusDelay(state.turn, victim.id, proj.status.delayBonus);
    }
  }
  return { damage: proj.damage };
}

// ---------------------------------------------------------------------------
// resolveSelfHeal — apply turtle self-heal on fire
// ---------------------------------------------------------------------------

/**
 * Call after a turtle weapon is fired.
 * Adds selfHeal HP to shooter, clamped to maxHealth.
 *
 * @param {object} _state   - unused (future: network broadcast)
 * @param {object} proj     - fired projectile (carries selfHeal amount)
 * @param {object} shooter  - player object with .health / .maxHealth
 * @returns {number} amount healed
 */
export function resolveSelfHeal(_state, proj, shooter) {
  const heal = proj.selfHeal ?? 0;
  if (heal <= 0) return 0;
  const before = shooter.health;
  shooter.health = Math.min(shooter.health + heal, shooter.maxHealth);
  return shooter.health - before;
}
