# Plan B — Delay-Based Turn System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Each task is a TDD cycle (red → green → commit) sized 2–5 minutes.

**Goal:** Replace the fixed round-robin turn rotation in `app.js` with an accumulated-delay-based turn manager sourced from a new pure `src/sim/turn.js` module, matching spec §4. Enable same-tank back-to-back turns, status-delay bonuses, and a HUD turn-order rail, while preserving deterministic multiplayer.

**Architecture:** `src/sim/turn.js` is a pure, DOM-free module (consistent with `src/sim/*` convention) exposing plain-data `turnManager` operations. `app.js` owns the live instance on `app.game.turnManager` and delegates all turn advancement to it. Delays are stored as fixed-point integers (base delay × 1000) so the fractional multipliers (1.0, 1.3, 1.8, 0.6, 0.002·fuel) remain integer math per spec §6.6.

**Tech Stack:** ES modules, `node:test`, PeerJS (deterministic sim). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase1-design.md` §4 (턴 시스템), with §6.5 (desync hash) and §6.6 (결정성) as constraints.

---

## Fixed-Point Convention

- `DELAY_SCALE = 1000` (declared in `src/sim/turn.js`, exported for tests).
- A tank's `baseDelay` is a plain integer from `src/data/tanks.js` (e.g. 720).
- `accumulatedDelay` is `Int32` in units of `baseDelay × 1000`.
- Action formulas apply integer multipliers:
  - SS1 fire: `+ baseDelay * 1000`              (×1.0)
  - SS2 fire: `+ baseDelay * 1300`              (×1.3)
  - NEW fire: `+ baseDelay * 1800`              (×1.8)
  - move:     `+ baseDelay * 2 * fuelUsed`      (×0.002·fuel; `fuelUsed` is integer cells)
  - pass:     `+ baseDelay * 600`               (×0.6)
- Status delay bonuses (from spec: +120 / +200 / +400 "단위") are applied as `delayBonus * 1000`. The caller passes the raw spec value (e.g. `120`); `applyStatusDelay` scales internally.

Document this convention at the top of `src/sim/turn.js` as a JSDoc block.

---

## File Structure

```
src/
  sim/
    turn.js                  createTurnManager, pickNextTurn, applyAction,
                             applyStatusDelay, removeTank, normalizeDelays,
                             snapshot, DELAY_SCALE, ACTION_MULTIPLIERS
  data/
    tanks.js                 + baseDelay field on every tank
test/
  sim/
    turn.test.js             unit tests for turn.js
    stateHash.test.js        (existing — add accumulatedDelay coverage)
app.js                       turnManager wiring; HUD rail draw
index.html                   #turn-order-rail container
styles.css                   .turn-rail, .turn-rail-slot rules
```

---

## Task 1: Add `baseDelay` to every tank

**Files:**
- Modify: `src/data/tanks.js`

**Rationale:** `createTurnManager` reads `tankType.baseDelay`. No tank currently has it.

- [ ] **Step 1.1: Write failing test** — create `test/data/tanks.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { TANK_TYPES } from "../../src/data/tanks.js";

test("every tank has an integer baseDelay in a sensible range", () => {
  for (const [id, tank] of Object.entries(TANK_TYPES)) {
    assert.ok(Number.isInteger(tank.baseDelay), `${id} baseDelay not integer`);
    assert.ok(tank.baseDelay >= 400 && tank.baseDelay <= 1000, `${id} baseDelay out of range`);
  }
});
```

Run `npm test` — expect failure.

- [ ] **Step 1.2: Add baseDelay** to each entry in `src/data/tanks.js`:
  - `ironclad: 720` (중장갑 올라운드)
  - `skyrider: 660` (곡사/빠름)
  - `twinfang: 760` (연사 압박)
  - `aegis: 840` (지속전)
  - `tempest: 700` (전설급)

  Add the field inside each tank object alongside `maxHealth`.

- [ ] **Step 1.3: Run `npm test`** — expect pass. Commit:

```
git add src/data/tanks.js test/data/tanks.test.js
git commit -m "data(tanks): add baseDelay field for delay-based turn system"
```

---

## Task 2: `createTurnManager` + `pickNextTurn` (skeleton)

**Files:**
- Create: `src/sim/turn.js`
- Create: `test/sim/turn.test.js`

- [ ] **Step 2.1: Write failing tests** in `test/sim/turn.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createTurnManager, pickNextTurn, DELAY_SCALE } from "../../src/sim/turn.js";

const tanks = [
  { id: "p1", baseDelay: 720 },
  { id: "p2", baseDelay: 660 },
  { id: "p3", baseDelay: 840 },
];

test("createTurnManager initialises accumulatedDelay=0 and preserves id/baseDelay", () => {
  const m = createTurnManager(tanks);
  assert.equal(m.tanks.length, 3);
  for (const t of m.tanks) {
    assert.equal(t.accumulatedDelay, 0);
    assert.ok(t.alive);
  }
  assert.deepEqual(m.history, []);
  assert.deepEqual(m.pendingStatuses, {});
});

test("pickNextTurn returns lowest accumulatedDelay; ties broken by ascending id", () => {
  const m = createTurnManager(tanks);
  assert.equal(pickNextTurn(m), "p1"); // all 0 → lowest id
  m.tanks.find((t) => t.id === "p1").accumulatedDelay = 100;
  assert.equal(pickNextTurn(m), "p2");
});

test("DELAY_SCALE is 1000", () => {
  assert.equal(DELAY_SCALE, 1000);
});
```

Run `npm test` — expect failure (module missing).

- [ ] **Step 2.2: Implement** `src/sim/turn.js`:

```js
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

export function pickNextTurn(manager) {
  let best = null;
  for (const t of manager.tanks) {
    if (!t.alive) continue;
    if (
      best === null ||
      t.accumulatedDelay < best.accumulatedDelay ||
      (t.accumulatedDelay === best.accumulatedDelay && t.id < best.id)
    ) {
      best = t;
    }
  }
  return best ? best.id : null;
}
```

- [ ] **Step 2.3: Run `npm test`** — expect pass. Commit:

```
git add src/sim/turn.js test/sim/turn.test.js
git commit -m "sim(turn): createTurnManager + pickNextTurn with deterministic tiebreak"
```

---

## Task 3: `applyAction`

**Files:**
- Modify: `src/sim/turn.js`
- Modify: `test/sim/turn.test.js`

- [ ] **Step 3.1: Add failing tests** appending to `test/sim/turn.test.js`:

```js
import { applyAction } from "../../src/sim/turn.js";

test("applyAction SS1 < SS2 < NEW adds correct integer delay", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "ss1" }); // 720*1000
  applyAction(m, { tankId: "p2", actionType: "ss2" }); // 660*1300
  applyAction(m, { tankId: "p3", actionType: "new" }); // 840*1800
  const p1 = m.tanks.find((t) => t.id === "p1").accumulatedDelay;
  const p2 = m.tanks.find((t) => t.id === "p2").accumulatedDelay;
  const p3 = m.tanks.find((t) => t.id === "p3").accumulatedDelay;
  assert.equal(p1, 720_000);
  assert.equal(p2, 858_000);
  assert.equal(p3, 1_512_000);
});

test("applyAction move uses fuelUsed", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "move", fuelUsed: 30 });
  assert.equal(m.tanks[0].accumulatedDelay, 720 * 2 * 30); // 43_200
});

test("applyAction pass uses 0.6 multiplier", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "pass" });
  assert.equal(m.tanks[0].accumulatedDelay, 720 * 600);
});

test("fastest tank accumulates slower → gets extra turns over time", () => {
  const m = createTurnManager(tanks);
  const picks = [];
  for (let i = 0; i < 20; i++) {
    const id = pickNextTurn(m);
    picks.push(id);
    applyAction(m, { tankId: id, actionType: "ss1" });
  }
  const counts = picks.reduce((a, id) => ((a[id] = (a[id] || 0) + 1), a), {});
  assert.ok(counts.p2 > counts.p3, "p2 (baseDelay 660) should fire more often than p3 (840)");
});

test("applyAction records history entry", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "ss2" });
  assert.equal(m.history.length, 1);
  assert.equal(m.history[0].tankId, "p1");
  assert.equal(m.history[0].actionType, "ss2");
});
```

Run tests — expect failure.

- [ ] **Step 3.2: Implement** `applyAction` in `src/sim/turn.js`:

```js
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
```

- [ ] **Step 3.3: Run `npm test`** — expect pass. Commit:

```
git add src/sim/turn.js test/sim/turn.test.js
git commit -m "sim(turn): applyAction with integer delay formulas for fire/move/pass"
```

---

## Task 4: `applyStatusDelay` + `removeTank` + `normalizeDelays`

**Files:**
- Modify: `src/sim/turn.js`
- Modify: `test/sim/turn.test.js`

- [ ] **Step 4.1: Add failing tests**:

```js
import { applyStatusDelay, removeTank, normalizeDelays } from "../../src/sim/turn.js";

test("applyStatusDelay queues bonus, flushed before pick", () => {
  const m = createTurnManager(tanks);
  applyStatusDelay(m, "p2", 120); // spec unit → 120 * 1000 when flushed
  assert.ok(m.pendingStatuses.p2?.length === 1);
  // pickNextTurn flushes pending first
  assert.equal(pickNextTurn(m), "p1"); // p2 now has 120_000 pending
  assert.equal(m.tanks.find((t) => t.id === "p2").accumulatedDelay, 120_000);
  assert.equal(m.pendingStatuses.p2, undefined);
});

test("removeTank excludes tank from future picks", () => {
  const m = createTurnManager(tanks);
  removeTank(m, "p1");
  const picks = new Set();
  for (let i = 0; i < 10; i++) {
    const id = pickNextTurn(m);
    picks.add(id);
    applyAction(m, { tankId: id, actionType: "ss1" });
  }
  assert.ok(!picks.has("p1"));
});

test("normalizeDelays preserves ordering and subtracts min", () => {
  const m = createTurnManager(tanks);
  m.tanks[0].accumulatedDelay = 500_000;
  m.tanks[1].accumulatedDelay = 200_000;
  m.tanks[2].accumulatedDelay = 900_000;
  normalizeDelays(m);
  assert.equal(m.tanks[0].accumulatedDelay, 300_000);
  assert.equal(m.tanks[1].accumulatedDelay, 0);
  assert.equal(m.tanks[2].accumulatedDelay, 700_000);
});

test("normalizeDelays ignores dead tanks for min computation", () => {
  const m = createTurnManager(tanks);
  m.tanks[0].accumulatedDelay = 500_000;
  m.tanks[1].accumulatedDelay = 100_000;
  m.tanks[2].accumulatedDelay = 900_000;
  removeTank(m, "p2"); // dead tank with the lowest value
  normalizeDelays(m);
  assert.equal(m.tanks[0].accumulatedDelay, 0);
  assert.equal(m.tanks[2].accumulatedDelay, 400_000);
});
```

- [ ] **Step 4.2: Implement** in `src/sim/turn.js`:

```js
export function applyStatusDelay(manager, tankId, delayBonus) {
  if (!manager.pendingStatuses[tankId]) manager.pendingStatuses[tankId] = [];
  manager.pendingStatuses[tankId].push({ delayBonus: delayBonus | 0 });
  return manager;
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
```

Update `pickNextTurn` to flush first:

```js
export function pickNextTurn(manager) {
  flushPendingStatuses(manager);
  // ... existing selection loop ...
}
```

- [ ] **Step 4.3: Run `npm test`** — expect pass. Commit:

```
git add src/sim/turn.js test/sim/turn.test.js
git commit -m "sim(turn): applyStatusDelay, removeTank, normalizeDelays"
```

---

## Task 5: `snapshot` (serialization roundtrip)

**Files:**
- Modify: `src/sim/turn.js`
- Modify: `test/sim/turn.test.js`

- [ ] **Step 5.1: Failing test**:

```js
import { snapshot } from "../../src/sim/turn.js";

test("snapshot is a plain JSON-roundtrippable object and preserves structure", () => {
  const m = createTurnManager(tanks);
  applyAction(m, { tankId: "p1", actionType: "ss2" });
  applyStatusDelay(m, "p2", 400);
  removeTank(m, "p3");
  const snap = snapshot(m);
  const rt = JSON.parse(JSON.stringify(snap));
  assert.deepEqual(rt, snap);
  assert.equal(rt.tanks.length, 3);
  assert.equal(rt.tanks.find((t) => t.id === "p1").accumulatedDelay, 720 * 1300);
  assert.equal(rt.tanks.find((t) => t.id === "p3").alive, false);
  assert.ok(rt.pendingStatuses.p2);
});
```

- [ ] **Step 5.2: Implement**:

```js
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
```

- [ ] **Step 5.3: Run `npm test`** — expect pass. Commit:

```
git add src/sim/turn.js test/sim/turn.test.js
git commit -m "sim(turn): snapshot for state hashing and network sync"
```

---

## Task 6: Wire `turnManager` into `app.js`

**Files:**
- Modify: `app.js`

**Scope:** Replace `app.game.currentTurnIndex` rotation with `pickNextTurn`. Keep `currentTurnIndex` for HUD compatibility in this task by resolving it from the picked id; remove it fully in Task 8 if unused.

- [ ] **Step 6.1: Import** at top of `app.js`:

```js
import {
  createTurnManager,
  pickNextTurn,
  applyAction as applyTurnAction,
  applyStatusDelay as applyTurnStatusDelay,
  removeTank as removeTurnTank,
  normalizeDelays as normalizeTurnDelays,
  snapshot as snapshotTurnManager,
} from "./src/sim/turn.js";
```

- [ ] **Step 6.2: Initialise at battle start** — in `startBattle`, after `app.game.players = readyPlayers.map(...)`, add:

```js
app.game.turnManager = createTurnManager(
  app.game.players.map((p) => ({
    id: p.id,
    baseDelay: TANK_TYPES[p.tankType]?.baseDelay ?? 720, // backward-compat default
  })),
);
const firstId = pickNextTurn(app.game.turnManager);
app.game.currentTurnIndex = app.game.players.findIndex((p) => p.id === firstId);
```

Also initialise in `createEmptyGame` so idle/preview states have a non-null manager: `turnManager: null` (guarded in advanceTurn).

- [ ] **Step 6.3: Rewrite `advanceTurn`**:

```js
function advanceTurn() {
  const alive = getAlivePlayers();
  if (alive.length <= 1) { endBattle(alive[0] ?? null); return; }

  const mgr = app.game.turnManager;
  // mark dead tanks in the manager
  for (const p of app.game.players) {
    if (!p.alive) removeTurnTank(mgr, p.id);
  }
  normalizeTurnDelays(mgr);
  const nextId = pickNextTurn(mgr);
  const nextIndex = app.game.players.findIndex((p) => p.id === nextId);
  if (nextIndex < 0) { endBattle(alive[0] ?? null); return; }

  app.game.currentTurnIndex = nextIndex;
  app.game.turnNumber += 1;
  app.game.phase = "aim";
  app.game.resolveTimer = 0;
  setupTurn();
  setTicker(`${app.game.players[nextIndex].name}의 턴입니다.`);
  broadcastSnapshot(true);
  markUiDirty();
}
```

- [ ] **Step 6.4: Call `applyTurnAction`** at each action site in `app.js`:
  - Fire handler (currently uses `player.shots`): after firing, call `applyTurnAction(mgr, { tankId: player.id, actionType: "ss1" })`. (Phase 1 uses ss1 only until weapon slots land; note as TODO.)
  - Move handler (where `MOVE_COST` is deducted): call `applyTurnAction(mgr, { tankId: player.id, actionType: "move", fuelUsed: cellsMoved })`.
  - Pass handler: call `applyTurnAction(mgr, { tankId: player.id, actionType: "pass" })`.

- [ ] **Step 6.5: Smoke-run** `npm test` and `node --check app.js`. Commit:

```
git add app.js
git commit -m "app: wire turnManager; advanceTurn now picks by accumulated delay"
```

---

## Task 7: Include `accumulatedDelay` in network snapshot

**Files:**
- Modify: `app.js`
- Create: `test/sim/turn.net.test.js`

- [ ] **Step 7.1: Failing test** ensuring snapshot-apply roundtrip preserves turn order:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createTurnManager, pickNextTurn, applyAction, snapshot } from "../../src/sim/turn.js";

test("serialized snapshot on a peer yields same pickNextTurn", () => {
  const tanks = [
    { id: "p1", baseDelay: 720 },
    { id: "p2", baseDelay: 660 },
    { id: "p3", baseDelay: 840 },
  ];
  const host = createTurnManager(tanks);
  applyAction(host, { tankId: "p2", actionType: "ss2" });
  applyAction(host, { tankId: "p1", actionType: "move", fuelUsed: 40 });
  const wire = JSON.parse(JSON.stringify(snapshot(host)));
  // Simulate peer rehydration
  const peer = createTurnManager(tanks);
  peer.tanks = wire.tanks.map((t) => ({ ...t }));
  peer.pendingStatuses = wire.pendingStatuses;
  assert.equal(pickNextTurn(peer), pickNextTurn(host));
});
```

- [ ] **Step 7.2: Update `broadcastSnapshot`** in `app.js` to embed `turnManager: snapshotTurnManager(app.game.turnManager)`. Update the apply-snapshot handler to rehydrate: `app.game.turnManager.tanks = snap.turnManager.tanks.map(...)` etc.

- [ ] **Step 7.3: Run `npm test`**, then `node --check app.js`. Commit:

```
git add app.js test/sim/turn.net.test.js
git commit -m "app(net): sync turnManager in peer snapshots"
```

---

## Task 8: HUD turn-order rail

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] **Step 8.1: Add container** in `index.html`, inside the battle HUD region:

```html
<div id="turn-order-rail" class="turn-rail" aria-label="다음 턴 순서"></div>
```

- [ ] **Step 8.2: Styles** in `styles.css`:

```css
.turn-rail { display:flex; gap:8px; padding:6px 10px; position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:20; }
.turn-rail-slot { display:flex; flex-direction:column; align-items:center; min-width:52px; background:rgba(0,0,0,0.45); border-radius:6px; padding:4px 6px; color:#fff; font-size:11px; }
.turn-rail-slot.is-next { outline:2px solid #ffcf3a; }
.turn-rail-bar { height:3px; background:#ffcf3a; margin-top:3px; border-radius:2px; }
```

- [ ] **Step 8.3: Render function** in `app.js`:

```js
function renderTurnRail() {
  const el = document.getElementById("turn-order-rail");
  if (!el || !app.game.turnManager) return;
  const mgr = app.game.turnManager;
  // project the next 4 turns deterministically without mutating mgr
  const sim = {
    tanks: mgr.tanks.map((t) => ({ ...t })),
    pendingStatuses: {},
    history: [],
  };
  const ordered = [];
  const maxBar = Math.max(1, ...sim.tanks.filter((t) => t.alive).map((t) => t.accumulatedDelay));
  for (let i = 0; i < 4; i++) {
    const id = pickNextTurn(sim);
    if (!id) break;
    const tank = sim.tanks.find((t) => t.id === id);
    ordered.push({ id, accumulatedDelay: tank.accumulatedDelay });
    applyTurnAction(sim, { tankId: id, actionType: "ss1" }); // predictive
  }
  el.innerHTML = ordered.map((s, i) => {
    const player = app.game.players.find((p) => p.id === s.id);
    const name = player?.name ?? s.id;
    const pct = Math.round((s.accumulatedDelay / maxBar) * 100);
    return `<div class="turn-rail-slot${i === 0 ? " is-next" : ""}">
      <span>${escapeHtml(name)}</span>
      <div class="turn-rail-bar" style="width:${Math.max(6, pct)}%"></div>
    </div>`;
  }).join("");
}
```

Call `renderTurnRail()` inside the existing HUD redraw path (where `markUiDirty()` consumers live).

- [ ] **Step 8.4: Manual smoke** — `npm start`, open two browsers, start a match, confirm rail updates after each action. Run `npm test`. Commit:

```
git add index.html styles.css app.js
git commit -m "ui(hud): turn-order rail showing next 4 predicted turns"
```

---

## Task 9: Desync hash includes delays (regression test)

**Files:**
- Modify: `test/sim/stateHash.test.js` (or create if absent)

`hashPlayerStates` in `src/sim/stateHash.js` already folds `accumulatedDelay`. This task only guards against regression.

- [ ] **Step 9.1: Failing test** — asserts that two player arrays differing only in `accumulatedDelay` hash differently:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { hashPlayerStates } from "../../src/sim/stateHash.js";

test("hashPlayerStates is sensitive to accumulatedDelay", () => {
  const a = [{ id: "p1", hp: 100, accumulatedDelay: 0 }, { id: "p2", hp: 100, accumulatedDelay: 0 }];
  const b = [{ id: "p1", hp: 100, accumulatedDelay: 100 }, { id: "p2", hp: 100, accumulatedDelay: 0 }];
  assert.notEqual(hashPlayerStates(a), hashPlayerStates(b));
});

test("hashPlayerStates is id-order-stable", () => {
  const a = [{ id: "a", hp: 1, accumulatedDelay: 10 }, { id: "b", hp: 2, accumulatedDelay: 20 }];
  const b = [{ id: "b", hp: 2, accumulatedDelay: 20 }, { id: "a", hp: 1, accumulatedDelay: 10 }];
  assert.equal(hashPlayerStates(a), hashPlayerStates(b));
});
```

- [ ] **Step 9.2: Ensure `broadcastSnapshot`** passes `accumulatedDelay` in the per-player shape fed to `hashPlayerStates`. Source it from `app.game.turnManager.tanks`. Commit:

```
git add test/sim/stateHash.test.js app.js
git commit -m "sim(stateHash): regression tests for accumulatedDelay sensitivity"
```

---

## Task 10: Integration smoke — 4-player turn drift

**Files:**
- Create: `test/sim/turn.integration.test.js`

- [ ] **Step 10.1: Write integration test** that exercises a realistic sequence and asserts a faster-baseDelay tank takes strictly more turns over 40 actions, and that `normalizeDelays` keeps `accumulatedDelay` bounded under `baseDelay * 2000`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createTurnManager, pickNextTurn, applyAction, normalizeDelays,
} from "../../src/sim/turn.js";

test("4-player match: fastest tank gets more turns, delays stay bounded", () => {
  const tanks = [
    { id: "a", baseDelay: 620 }, // acannon-ish
    { id: "b", baseDelay: 720 },
    { id: "c", baseDelay: 760 },
    { id: "d", baseDelay: 870 }, // bigpo-ish
  ];
  const m = createTurnManager(tanks);
  const counts = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 40; i++) {
    const id = pickNextTurn(m);
    counts[id]++;
    applyAction(m, { tankId: id, actionType: "ss1" });
    normalizeDelays(m);
  }
  assert.ok(counts.a > counts.d, `fastest a=${counts.a} slowest d=${counts.d}`);
  for (const t of m.tanks) {
    assert.ok(t.accumulatedDelay < t.baseDelay * 2000, `delay runaway for ${t.id}: ${t.accumulatedDelay}`);
  }
});
```

- [ ] **Step 10.2: Run `npm test`** — expect pass. Manual smoke: start a local 4-player match (bots allowed), confirm the HUD rail updates sensibly and the faster tank gets visibly more turns. Commit:

```
git add test/sim/turn.integration.test.js
git commit -m "test(turn): 4-player integration smoke for delay-based rotation"
```

---

## Post-implementation checklist

- [ ] `npm test` fully green.
- [ ] `node --check app.js` clean.
- [ ] Two-browser manual match: same `matchSeed` → identical turn order, no desync banner.
- [ ] HUD rail shows 4 upcoming turns, updates each action.
- [ ] Dead tanks disappear from rail within one turn.

## Risks & mitigations

- **Integer overflow.** `accumulatedDelay` is capped by frequent `normalizeDelays`. Worst case before normalize: `baseDelay * 1800 × 40 turns` ≈ 6.3e7 for baseDelay=870 — well below `Int32` range.
- **Backward compat for pre-update clients.** `createTurnManager` uses `baseDelay ?? 720` fallback so peers on older tank data still produce a valid manager; they will desync only on the delay term, surfaced by the existing hash check.
- **Weapon slot coupling.** Task 6 hardcodes `"ss1"` on fire because SS1/SS2/NEW slots are not yet wired (Phase 1 later task). Leave a `TODO` tag at each fire call site.
- **HUD rail cost.** Rail predicts 4 picks per redraw using a copied manager — O(N·4) per frame; negligible for N≤8. If rail redraws every frame becomes hot, gate behind `markUiDirty`.
