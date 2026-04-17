# Plan H — Modes & Team UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Each task is a TDD cycle (red → green → commit) sized 2–5 minutes.

**Goal:** Add Phase 2 §2 and §3 — mode selection (FFA / Team 2v2 / Tag Team / Survival), team-aware turn picker, tag substitution, team-kill prevention, team tint, survival round elimination, and right-click map ping.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase2-design.md` §2, §3.

**Depends on:** A (rng), B (turn), D (tanks), E (tank renderer + TEAM_COLORS), F (HUD).

---

## 0. Anchors

- `src/sim/turn.js` — `pickNextTurn` ties broken by lowest id. Extend with team-alternation preference.
- `src/sim/weapons.js::resolveHit` — today returns `proj.damage` + applies frozen. Needs teammate guard and returns `{damage, reason?}`.
- `src/render/tankRender.js::TEAM_COLORS` — Red/Blue/Green/Yellow ready.
- `app.js` — FFA only; needs match object threaded + mode selector UI.
- `src/data/` — add `modes.js`. `src/sim/` — add `match.js`.

---

## 1. Mode table

```js
// src/data/modes.js
export const MODES = {
  ffa:        { id: "ffa",        name: "Free-For-All", description: "...", minPlayers: 2, maxPlayers: 4, teamCount: 0, roundCount: 1 },
  "team-2v2": { id: "team-2v2",   name: "Team 2v2",     description: "...", minPlayers: 4, maxPlayers: 4, teamCount: 2, roundCount: 1 },
  "tag-team": { id: "tag-team",   name: "Tag Team",     description: "...", minPlayers: 4, maxPlayers: 4, teamCount: 2, roundCount: 1 },
  survival:   { id: "survival",   name: "Survival",     description: "...", minPlayers: 3, maxPlayers: 4, teamCount: 0, roundCount: 4 },
};
export const MODE_IDS = Object.keys(MODES);
```

## 2. `src/sim/match.js`

- `createMatch({ mode, players, matchSeed })` deterministic from stable player order.
- Team modes: index 0,2 → red; 1,3 → blue. Tag-team: `activeRoster=[p0,p1]`, `reserveRoster=[p2,p3]`.
- Shape: `{ mode, teams, activeRoster, reserveRoster, survivalRound, elimination, roundCount }`
- `isTeamMate(attackerId, victimId, teams)`
- `substituteIntoActiveRoster(match, deadId, tankBaseDelays)` → swap same-team reserve with lowest baseDelay, tie-break by id.
- `endSurvivalRound(match, playerHpMap)` → min HP (tie-break id) eliminated, append, increment round.

## 3. Turn picker extension

- `pickNextTurn(manager, { teams, recentTeam } = {})`:
  - Base: min `accumulatedDelay`, tie by lowest id.
  - Extra tie-breaker (if teams provided): prefer tanks whose team ≠ recentTeam.
- `recentTeam` derived from `manager.history` last entry; caller passes in, keeps turn.js pure.
- FFA/survival: no teams → unchanged behavior.

## 4. Tag substitution

- On death (already detected): call `substituteIntoActiveRoster` if tag mode.
- New network command `{ t: "tag-swap", turn, deadId, incomingId, seq }`. Can be derived deterministically too; command for explicit sync + UI cue.
- Incoming tank enters with full HP.

## 5. Team-kill prevention

- Extend signature: `resolveHit(state, proj, victim, { attackerId, match } = {})`.
- If teammate: return `{ damage: 0, reason: "teamkill-prevented" }`, skip `applyStatusDelay`.
- Return shape: `{ damage, reason? }` (was bare number).
- Update all callers in same commit.

## 6. Team tint

- FFA: player i → `TEAM_COLORS[i]`.
- Team modes: red → `TEAM_COLORS[0]`, blue → `TEAM_COLORS[1]`.
- Derive at match start: `player.teamColor = resolveTeamColor(match, playerId, joinIndex)`.
- Replace hardcoded `TEAM_COLORS[0]` usages in app.js.

## 7. UI

- Lobby `<select id="mode-select">` with 4 options + description paragraph.
- Battle top: `<div class="mode-badge">TAG TEAM</div>`.
- Player cards: team-color border + small team dot in team modes.
- Tag reserve strip under active roster (50% opacity).
- Team-kill toast "아군 보호" (1.2s).

## 8. Survival

- Round boundary: when each active alive tank has `firedThisRound === true`. Reset at boundary.
- On boundary: calc hpMap → `endSurvivalRound` → `turn.removeTank(eliminatedId)` → UI banner.
- Stop when `survivalRound >= roundCount` or only 1 alive. Winner = last standing.

## 9. Map ping

- `contextmenu` on canvas → `sendPing(x, y, kind)` where kind = `shiftKey ? "target" : "attention"`. `preventDefault()`.
- Network: `{ t: "ping", turn, tankId, x, y, kind, seq }`.
- `game.activePings = [{ id, x, y, kind, expiresAt }]` (lifetime 4000ms).
- Render: `attention` = yellow `!` + ring; `target` = red crosshair.
- Throttle client-side: 1 ping / 500ms per tank.

---

## Task list (each ends in a commit)

1. **Modes data + schema test** — `src/data/modes.js`, `test/data/modes.test.js`. Required keys, ranges, 4 ids.
   Commit: `feat(data): add mode table for FFA/team-2v2/tag-team/survival`

2. **`createMatch` + team assignment** — `src/sim/match.js`, tests: 2p FFA (no teams), 4p team-2v2, 4p tag (active/reserve split), 3p survival (roundCount=4).
   Commit: `feat(sim): createMatch with deterministic team assignment`

3. **Team-kill prevention in `resolveHit`** — extend return shape `{damage, reason?}`; update all callers; tests 0-dmg for teammate + no status delay.
   Commit: `feat(sim): prevent team-kill damage and status effects`

4. **Team-alternation in `pickNextTurn`** — optional `{teams, recentTeam}` arg; tests FFA unchanged + team-mode anti-streak.
   Commit: `feat(sim): team-alternation tie-break in turn picker`

5. **Tag roster + `substituteIntoActiveRoster`** — tests (lowest baseDelay tie-break id); non-tag returns null.
   Commit: `feat(sim): tag-team active/reserve substitution on death`

6. **Survival round elimination** — `endSurvivalRound` + `advanceSurvivalIfReady`; tests elimination order + cap.
   Commit: `feat(sim): survival round elimination (4 rounds, lowest HP out)`

7. **Team tint piping** — `resolveTeamColor(match, playerId, joinIndex)` utility; replace `TEAM_COLORS[0]` hardcodes; unit test mapping.
   Commit: `feat(render): pass team colors from match into tank renderer`

8. **Lobby mode select UI** — `#mode-select` + description; host broadcasts mode; CSS.
   Commit: `feat(ui): lobby mode selector with descriptions`

9. **Battle top mode badge** — `.mode-badge` element populated from `match.mode`.
   Commit: `feat(ui): mode badge pill in battle HUD`

10. **Player card team border + tag reserve strip** — update `buildPlayerCard`; reserve strip rendered in tag mode.
    Commit: `feat(ui): team-color borders and tag reserve strip`

11. **Team-kill banner** — transient toast via render event stream on `reason === "teamkill-prevented"`.
    Commit: `feat(ui): team-kill prevented toast`

12. **Map ping: input + render + lifetime** — `contextmenu` handler; overlay renderer; 4s expiry; glyphs.
    Commit: `feat(ui): right-click map ping with attention/target kinds`

13. **Network: tag-swap + ping + match in snapshot** — add encode/decode + lockstep apply; extend snapshot; bridge tests for serialization.
    Commit: `feat(net): tag-swap and ping lockstep commands`

14. **Smoke: 4-bot 2v2 team match** — scripted smoke verifying team assignment, 0-dmg for teammate, tag substitution, ping rendering. Full `npm test` must stay green (217+ prior).
    Commit: `test: 4-bot 2v2 smoke + full regression`

---

## Risks

- `resolveHit` return shape change load-bearing — update every caller in one commit.
- Survival round boundary: per-player `firedThisRound` counter (not global turn modulo).
- FFA codepaths unchanged: guard new behavior with `teamCount > 0` or `mode !== "ffa"`.
- Ping flood: throttle 1 / 500ms per tank.

## Regression

- All 217+ prior tests must stay green.
- `turn.js` extension backward compatible when options omitted.
- FFA via `createMatch({mode:"ffa",...})` produces `teams={}` and behaves identically.
