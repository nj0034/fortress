/**
 * match.js — Match state factory and helpers (Plan H §2).
 *
 * createMatch({ mode, players, matchSeed })
 *   Deterministic from stable player order.
 *
 * Shape:
 *   { mode, teams, activeRoster, reserveRoster, survivalRound, elimination, roundCount }
 *
 * Team assignment:
 *   FFA / survival: teams = {} (empty)
 *   team-2v2 / tag-team: index 0,2 → team 0 (red); index 1,3 → team 1 (blue)
 *   tag-team:  activeRoster=[p0,p1], reserveRoster=[p2,p3]
 */

import { MODES } from "../data/modes.js";

/**
 * @param {{ mode: string, players: Array<{id: string, baseDelay?: number}>, matchSeed?: number }} opts
 * @returns {object} match state
 */
export function createMatch({ mode, players, matchSeed = 0 }) {
  const def = MODES[mode];
  if (!def) throw new Error(`Unknown mode: ${mode}`);

  const isTeamMode = def.teamCount > 0;
  const isTagTeam = mode === "tag-team";

  // teams: map from playerId → team index (0 = red, 1 = blue)
  const teams = {};
  if (isTeamMode) {
    players.forEach((p, i) => {
      teams[p.id] = i % 2; // 0,2 → 0 (red); 1,3 → 1 (blue)
    });
  }

  // Tag-team: split into active (first 2) and reserve (last 2)
  let activeRoster = null;
  let reserveRoster = null;
  if (isTagTeam) {
    activeRoster = players.slice(0, 2).map((p) => p.id);
    reserveRoster = players.slice(2).map((p) => p.id);
  }

  return {
    mode,
    teams,
    activeRoster,
    reserveRoster,
    survivalRound: 0,
    elimination: [], // list of eliminated playerIds in order
    roundCount: def.roundCount,
    matchSeed,
  };
}

/**
 * Returns true if attacker and victim are on the same team.
 *
 * @param {string} attackerId
 * @param {string} victimId
 * @param {object} teams  — map from playerId → teamIndex
 * @returns {boolean}
 */
export function isTeamMate(attackerId, victimId, teams) {
  if (!teams || Object.keys(teams).length === 0) return false;
  const at = teams[attackerId];
  const vt = teams[victimId];
  if (at === undefined || vt === undefined) return false;
  return at === vt;
}

/**
 * Substitute the lowest-baseDelay reserve on the same team as deadId into the
 * active roster, replacing deadId.
 *
 * Tie-break: lowest id (string compare).
 *
 * Returns the incoming player id, or null if no substitution is possible
 * (non-tag mode, no reserve on same team, etc.).
 *
 * @param {object} match
 * @param {string} deadId
 * @param {Array<{id: string, baseDelay: number}>} tankBaseDelays  — all player objects
 * @returns {string|null} incoming player id
 */
export function substituteIntoActiveRoster(match, deadId, tankBaseDelays) {
  if (match.mode !== "tag-team") return null;
  if (!match.reserveRoster || match.reserveRoster.length === 0) return null;

  const deadTeam = match.teams[deadId];
  if (deadTeam === undefined) return null;

  // Find eligible reserves on the same team
  const eligible = match.reserveRoster.filter(
    (rid) => match.teams[rid] === deadTeam,
  );
  if (eligible.length === 0) return null;

  // Pick lowest baseDelay; tie-break by id (string sort ascending)
  const delayMap = {};
  for (const p of tankBaseDelays) delayMap[p.id] = p.baseDelay ?? 0;

  eligible.sort((a, b) => {
    const da = delayMap[a] ?? 0;
    const db = delayMap[b] ?? 0;
    if (da !== db) return da - db;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const incomingId = eligible[0];

  // Swap in match state
  match.activeRoster = match.activeRoster.map((id) => (id === deadId ? incomingId : id));
  match.reserveRoster = match.reserveRoster.filter((id) => id !== incomingId);

  return incomingId;
}

/**
 * Advance survival round: eliminate the player with lowest HP (tie-break: lowest id).
 * Increments survivalRound.
 *
 * @param {object} match
 * @param {object} playerHpMap  — { [playerId]: hp }
 * @returns {string} eliminated player id
 */
export function endSurvivalRound(match, playerHpMap) {
  const eligible = Object.entries(playerHpMap).filter(
    ([id]) => !match.elimination.includes(id),
  );
  if (eligible.length === 0) return null;

  // Sort by hp ascending, then id ascending
  eligible.sort(([aId, aHp], [bId, bHp]) => {
    if (aHp !== bHp) return aHp - bHp;
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  });

  const eliminatedId = eligible[0][0];
  match.elimination.push(eliminatedId);
  match.survivalRound += 1;
  return eliminatedId;
}
