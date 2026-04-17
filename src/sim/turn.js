/**
 * Delay-based turn manager (spec §4).
 *
 * Fixed-point: accumulatedDelay is stored in units of baseDelay × DELAY_SCALE.
 * DELAY_SCALE = 1000 so fractional multipliers (1.0, 1.3, 1.8, 0.6, 0.002·fuel)
 * stay in integer math. See docs/superpowers/plans/2026-04-17-plan-b-delay-turn-system.md.
 */
export const DELAY_SCALE = 1000;

export const ACTION_MULTIPLIERS = {
  ss1: 1000,
  ss2: 1300,
  new: 1800,
  pass: 600,
  // move uses per-fuel multiplier: 0.002 × 1000 = 2 per fuel unit
  movePerFuel: 2,
};

export function createTurnManager(tanks) {
  return {
    tanks: tanks.map((t) => ({
      id: t.id,
      baseDelay: t.baseDelay | 0,
      accumulatedDelay: 0,
      alive: true,
    })),
    history: [],
    pendingStatuses: {},
  };
}

function flushPendingStatuses(manager) {
  for (const [tankId, entries] of Object.entries(manager.pendingStatuses)) {
    const tank = manager.tanks.find((t) => t.id === tankId);
    if (!tank || !tank.alive) continue;
    for (const e of entries) {
      tank.accumulatedDelay = (tank.accumulatedDelay + e.delayBonus * DELAY_SCALE) | 0;
    }
  }
  manager.pendingStatuses = {};
}

/**
 * Pick the tank whose turn is next.
 *
 * Base rule: lowest accumulatedDelay; ties broken by lowest id.
 * Optional team-alternation tie-breaker: when `teams` and `recentTeam` are
 * provided and multiple tanks tie on delay, prefer the tank whose team differs
 * from `recentTeam`.  FFA / survival (teams omitted) behaves identically to
 * before.
 *
 * @param {object} manager
 * @param {{ teams?: object, recentTeam?: number|undefined }} [opts]
 * @returns {string|null} tankId
 */
export function pickNextTurn(manager, { teams, recentTeam } = {}) {
  flushPendingStatuses(manager);
  const useTeams = teams && Object.keys(teams).length > 0;

  let best = null;
  for (const t of manager.tanks) {
    if (!t.alive) continue;
    if (best === null) {
      best = t;
      continue;
    }

    if (t.accumulatedDelay < best.accumulatedDelay) {
      best = t;
      continue;
    }

    if (t.accumulatedDelay === best.accumulatedDelay) {
      // Team-alternation tie-breaker: prefer tank whose team ≠ recentTeam
      if (useTeams && recentTeam !== undefined && recentTeam !== null) {
        const tTeam = teams[t.id];
        const bestTeam = teams[best.id];
        const tDiffers = tTeam !== recentTeam;
        const bestDiffers = bestTeam !== recentTeam;
        if (tDiffers && !bestDiffers) { best = t; continue; }
        if (!tDiffers && bestDiffers) { continue; }
      }
      // Final tie-break: lowest id
      if (t.id < best.id) best = t;
    }
  }
  return best ? best.id : null;
}

export function applyAction(manager, { tankId, actionType, fuelUsed = 0 }) {
  const tank = manager.tanks.find((t) => t.id === tankId);
  if (!tank || !tank.alive) return manager;
  let add = 0;
  switch (actionType) {
    case "ss1": add = tank.baseDelay * ACTION_MULTIPLIERS.ss1; break;
    case "ss2": add = tank.baseDelay * ACTION_MULTIPLIERS.ss2; break;
    case "new": add = tank.baseDelay * ACTION_MULTIPLIERS.new; break;
    case "pass": add = tank.baseDelay * ACTION_MULTIPLIERS.pass; break;
    case "move": add = tank.baseDelay * ACTION_MULTIPLIERS.movePerFuel * (fuelUsed | 0); break;
    default: return manager;
  }
  tank.accumulatedDelay = (tank.accumulatedDelay + add) | 0;
  manager.history.push({ tankId, actionType, fuelUsed: fuelUsed | 0, add });
  return manager;
}

export function applyStatusDelay(manager, tankId, delayBonus) {
  if (!manager.pendingStatuses[tankId]) manager.pendingStatuses[tankId] = [];
  manager.pendingStatuses[tankId].push({ delayBonus: delayBonus | 0 });
  return manager;
}

export function removeTank(manager, tankId) {
  const tank = manager.tanks.find((t) => t.id === tankId);
  if (tank) tank.alive = false;
  return manager;
}

export function normalizeDelays(manager) {
  let min = Infinity;
  for (const t of manager.tanks) {
    if (!t.alive) continue;
    if (t.accumulatedDelay < min) min = t.accumulatedDelay;
  }
  if (!Number.isFinite(min) || min === 0) return manager;
  for (const t of manager.tanks) t.accumulatedDelay = (t.accumulatedDelay - min) | 0;
  return manager;
}

export function snapshot(manager) {
  return {
    tanks: manager.tanks.map((t) => ({
      id: t.id,
      baseDelay: t.baseDelay,
      accumulatedDelay: t.accumulatedDelay,
      alive: t.alive,
    })),
    pendingStatuses: JSON.parse(JSON.stringify(manager.pendingStatuses)),
    history: manager.history.slice(-32), // cap history for network payloads
  };
}
