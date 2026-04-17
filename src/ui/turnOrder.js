/**
 * Pure turn-order view model builder (Plan F §Task 2).
 * No DOM, no side effects — safe to import in Node test environments.
 */

/**
 * Build a view model for the turn-order rail.
 *
 * @param {object} manager  - turn manager (or snapshot): { tanks: [{id, name, tankTypeId, baseDelay, accumulatedDelay, alive}] }
 * @param {number} [n=4]    - number of entries to return
 * @returns {{ tankId, tankTypeId, name, delayBarPct, isActive }[]}
 */
export function buildTurnOrderView(manager, n = 4) {
  if (n <= 0) return [];

  const alive = manager.tanks.filter((t) => t.alive !== false);
  const sorted = alive.slice().sort((a, b) => {
    if (a.accumulatedDelay !== b.accumulatedDelay) return a.accumulatedDelay - b.accumulatedDelay;
    return a.id < b.id ? -1 : 1;
  });

  const window = sorted.slice(0, n);
  const maxDelay = window.length > 0 ? Math.max(...window.map((t) => t.accumulatedDelay)) : 0;
  const minDelay = window.length > 0 ? Math.min(...window.map((t) => t.accumulatedDelay)) : 0;
  const range = maxDelay - minDelay;

  return window.map((t, i) => ({
    tankId: t.id,
    tankTypeId: t.tankTypeId ?? "armor",
    name: t.name ?? t.id,
    delayBarPct: range === 0 ? 0 : Math.round(((t.accumulatedDelay - minDelay) / range) * 100),
    isActive: i === 0,
  }));
}
