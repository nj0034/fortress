# Plan A — Foundation Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract pure utilities and data from `app.js` into tested ES modules, add deterministic primitives (purpose-scoped RNG, fixed-point math, state hashing) with zero behavior change in the running game.

**Architecture:** Incremental module extraction. `app.js` continues to own all stateful/DOM/network code. New `src/` tree holds pure modules imported by `app.js`. Unit tests run with Node's built-in `node:test` (zero deps).

**Tech Stack:** ES modules, `node:test`, browser static server via `python3 -m http.server`.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase1-design.md` §1 (architecture), §6.6 (fixed-point), §6.5 (state hash).

---

## File Structure

```
src/
  util/
    math.js              clamp, lerp, degToRad, wrapAngleRadians, distance
    text.js              hashString, escapeHtml, randomId
  sim/
    rng.js               mulberry32 + createPurposeRng(matchSeed, purpose)
    fixedpoint.js        toFP, fromFP, FP_SCALE, sinFP, cosFP (361-entry table)
    stateHash.js         hashTerrainSolid, hashPlayerStates, combineHashes
  data/
    tanks.js             TANK_TYPES (moved verbatim from app.js)
    maps.js              THEMES (moved verbatim from app.js)
  config.js              VIEW_WIDTH, VIEW_HEIGHT, TURN_FUEL, MOVE_COST, ... (constants)

test/
  util/math.test.js
  util/text.test.js
  sim/rng.test.js
  sim/fixedpoint.test.js
  sim/stateHash.test.js
```

`app.js` imports from these modules instead of re-declaring them. No logic changes.

---

## Task 1: Add test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json scripts**

Replace the `scripts` block in `package.json` with:

```json
"scripts": {
  "start": "python3 -m http.server 3002",
  "check": "node --check app.js",
  "test": "node --test test/**/*.test.js",
  "test:watch": "node --test --watch test/**/*.test.js"
}
```

Also add `"type": "module"` at the top level of `package.json` so test files and `app.js` share ESM semantics (note: `index.html` already loads `app.js` with `type="module"`, so runtime is unaffected).

- [ ] **Step 2: Create empty test directory marker**

Run: `mkdir -p test/util test/sim && touch test/.gitkeep`

- [ ] **Step 3: Verify no regressions**

Run: `npm run check`
Expected: no output (success)

Run: `npm test`
Expected: `tests 0 ... pass 0`

- [ ] **Step 4: Commit**

```bash
git add package.json test/.gitkeep
git commit -m "chore: add node:test runner and ESM module type"
```

---

## Task 2: Extract math utilities

**Files:**
- Create: `src/util/math.js`
- Test: `test/util/math.test.js`
- Modify: `app.js:501-527` (remove local declarations, add import)

- [ ] **Step 1: Write failing tests**

Create `test/util/math.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { clamp, lerp, degToRad, wrapAngleRadians, distance } from "../../src/util/math.js";

test("clamp bounds value", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(15, 0, 10), 10);
});

test("lerp interpolates linearly", () => {
  assert.equal(lerp(0, 10, 0), 0);
  assert.equal(lerp(0, 10, 1), 10);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test("degToRad converts degrees to radians", () => {
  assert.ok(Math.abs(degToRad(180) - Math.PI) < 1e-10);
  assert.equal(degToRad(0), 0);
});

test("wrapAngleRadians returns value in [-PI, PI]", () => {
  const r = wrapAngleRadians(3 * Math.PI);
  assert.ok(r > -Math.PI && r <= Math.PI);
});

test("distance computes euclidean distance", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../src/util/math.js'`

- [ ] **Step 3: Create the module**

Create `src/util/math.js`:

```js
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(value) {
  return (value * Math.PI) / 180;
}

export function wrapAngleRadians(value) {
  const TWO_PI = Math.PI * 2;
  let v = value % TWO_PI;
  if (v > Math.PI) v -= TWO_PI;
  else if (v <= -Math.PI) v += TWO_PI;
  return v;
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: `tests 5 ... pass 5`

- [ ] **Step 5: Replace app.js local declarations with import**

In `app.js`, remove the local `function clamp(...)`, `function lerp(...)`, `function degToRad(...)`, `function wrapAngleRadians(...)`, `function distance(...)` (currently around lines 501-527).

Add at the top of `app.js` (just after the `PEER_CONFIG` block at line 15 or in the import region):

```js
import { clamp, lerp, degToRad, wrapAngleRadians, distance } from "./src/util/math.js";
```

- [ ] **Step 6: Verify game still parses and runs**

Run: `npm run check`
Expected: no output

Run: `npm test`
Expected: pass 5

Manual: `npm start`, open http://localhost:3002, create a room, verify roster + battle render identical to before.

- [ ] **Step 7: Commit**

```bash
git add src/util/math.js test/util/math.test.js app.js
git commit -m "refactor: extract math utilities to src/util/math.js"
```

---

## Task 3: Extract text utilities

**Files:**
- Create: `src/util/text.js`
- Test: `test/util/text.test.js`
- Modify: `app.js:497-499, 528-551` (remove local, add import)

- [ ] **Step 1: Write failing tests**

Create `test/util/text.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { hashString, escapeHtml, randomId } from "../../src/util/text.js";

test("hashString is deterministic", () => {
  assert.equal(hashString("hello"), hashString("hello"));
  assert.notEqual(hashString("hello"), hashString("world"));
});

test("hashString returns a 32-bit unsigned integer", () => {
  const h = hashString("test");
  assert.ok(Number.isInteger(h));
  assert.ok(h >= 0 && h <= 0xffffffff);
});

test("escapeHtml escapes special characters", () => {
  assert.equal(escapeHtml("<b>&"), "&lt;b&gt;&amp;");
  assert.equal(escapeHtml('"\''), "&quot;&#39;");
});

test("randomId has prefix and nonempty body", () => {
  const id = randomId("room");
  assert.ok(id.startsWith("room-"));
  assert.ok(id.length > "room-".length);
});

test("randomId is unique across calls", () => {
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add(randomId("x"));
  assert.equal(ids.size, 20);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `src/util/text.js`:

```js
export function hashString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function randomId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
```

Match the exact algorithm currently in `app.js` (FNV-1a style). If `app.js` uses a different hash, copy its exact body here — the hash value must match so existing deterministic paths (seed → terrain) don't drift.

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: pass all 7.

- [ ] **Step 5: Replace app.js local declarations with import**

Remove `function randomId(...)`, `function hashString(...)`, `function escapeHtml(...)` from `app.js` (around lines 497-551). Add to top imports:

```js
import { hashString, escapeHtml, randomId } from "./src/util/text.js";
```

- [ ] **Step 6: Verify no regression**

Run: `npm run check && npm test`
Expected: check clean, tests pass.

Manual: reload browser, verify invite links/room IDs generate; confirm terrain seed produces same shape (same room name → same terrain) as before by creating a room, recording its name, restarting server, reentering same name → identical terrain.

- [ ] **Step 7: Commit**

```bash
git add src/util/text.js test/util/text.test.js app.js
git commit -m "refactor: extract text utilities to src/util/text.js"
```

---

## Task 4: Extract constants to src/config.js

**Files:**
- Create: `src/config.js`
- Modify: `app.js:17-52` (remove local const declarations, add import)

- [ ] **Step 1: Create the module**

Create `src/config.js` containing the constants block from `app.js:17-52`. Copy verbatim:

```js
export const VIEW_WIDTH = 1400;
export const VIEW_HEIGHT = 760;
export const FRAME_STEP = 1000 / 60;
export const SNAPSHOT_INTERVAL = 40;
export const TURN_FUEL = 100;
export const MOVE_COST = 11;
export const MOVE_STEP = 12;
export const ANGLE_STEP = 3;
export const MIN_POWER = 34;
export const MAX_POWER = 100;
export const CHARGE_RATE = 32;
export const HOLD_REPEAT_INTERVAL = 90;
export const LAUNCH_SPEED_DIVISOR = 4.5;
export const WIND_ACCELERATION = 0.35;
export const MAX_WIND = 0.18;
export const BATTLE_CAMERA_SCALE = 0.86;
export const WORLD_WIDTH = Math.round(VIEW_WIDTH / BATTLE_CAMERA_SCALE);
export const WORLD_HEIGHT = Math.round(VIEW_HEIGHT / BATTLE_CAMERA_SCALE);
export const BATTLE_CAMERA_OFFSET_X = Math.round((VIEW_WIDTH - WORLD_WIDTH * BATTLE_CAMERA_SCALE) / 2);
export const BATTLE_CAMERA_OFFSET_Y = Math.round((VIEW_HEIGHT - WORLD_HEIGHT * BATTLE_CAMERA_SCALE) / 2);
export const PLAYER_FALL_ACCELERATION = 0.44;
export const PLAYER_MAX_FALL_SPEED = 18;
export const VOID_TERRAIN_DEPTH = 140;
export const TANK_RADIUS = 21;
export const CRATER_EDGE = 22;
export const MAX_PLAYERS = 4;
export const HOLDABLE_ACTIONS = ["move-left", "move-right", "angle-up", "angle-down"];
export const OPPOSITE_HOLD_ACTION = {
  "move-left": "move-right",
  "move-right": "move-left",
  "angle-up": "angle-down",
  "angle-down": "angle-up",
};
export const BOT_NAMES = ["Rook", "Latch", "Mako", "Nova", "Torque", "Blitz", "Kite", "Beryl"];
export const DEFAULT_THEME_ID = "canyonbridge";
```

- [ ] **Step 2: Replace app.js local declarations with import**

Remove lines 17-52 of `app.js`. Add near the top of the file (below `PEER_CONFIG`):

```js
import {
  VIEW_WIDTH, VIEW_HEIGHT, FRAME_STEP, SNAPSHOT_INTERVAL, TURN_FUEL, MOVE_COST,
  MOVE_STEP, ANGLE_STEP, MIN_POWER, MAX_POWER, CHARGE_RATE, HOLD_REPEAT_INTERVAL,
  LAUNCH_SPEED_DIVISOR, WIND_ACCELERATION, MAX_WIND, BATTLE_CAMERA_SCALE,
  WORLD_WIDTH, WORLD_HEIGHT, BATTLE_CAMERA_OFFSET_X, BATTLE_CAMERA_OFFSET_Y,
  PLAYER_FALL_ACCELERATION, PLAYER_MAX_FALL_SPEED, VOID_TERRAIN_DEPTH,
  TANK_RADIUS, CRATER_EDGE, MAX_PLAYERS, HOLDABLE_ACTIONS, OPPOSITE_HOLD_ACTION,
  BOT_NAMES, DEFAULT_THEME_ID,
} from "./src/config.js";
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: no output.

Manual: reload browser, start a local battle with bot, verify battle plays identically.

- [ ] **Step 4: Commit**

```bash
git add src/config.js app.js
git commit -m "refactor: extract constants to src/config.js"
```

---

## Task 5: Extract tank data to src/data/tanks.js

**Files:**
- Create: `src/data/tanks.js`
- Modify: `app.js:54-204` (remove local TANK_TYPES, add import)

- [ ] **Step 1: Move TANK_TYPES verbatim**

Copy the entire `const TANK_TYPES = { ... }` object from `app.js` (starts at line 54) into a new file `src/data/tanks.js`:

```js
export const TANK_TYPES = {
  // ... exact object from app.js:54-204
};
```

Use `Read` to copy the exact object body unchanged, then prepend `export `. Do not refactor any field.

- [ ] **Step 2: Replace app.js local declaration with import**

Remove the `const TANK_TYPES = { ... }` block from `app.js`. Add import:

```js
import { TANK_TYPES } from "./src/data/tanks.js";
```

- [ ] **Step 3: Verify**

Run: `npm run check && npm test`
Expected: check clean, tests pass.

Manual: reload browser, cycle through tanks in roster, verify each tank card shows the same name/role/description/stats as before.

- [ ] **Step 4: Commit**

```bash
git add src/data/tanks.js app.js
git commit -m "refactor: extract tank data to src/data/tanks.js"
```

---

## Task 6: Extract map data to src/data/maps.js

**Files:**
- Create: `src/data/maps.js`
- Modify: `app.js:205-325` (approximate; remove local THEMES, add import)

- [ ] **Step 1: Move THEMES verbatim**

Copy the entire `const THEMES = { ... }` object from `app.js` (starts at line 205) into `src/data/maps.js`:

```js
export const THEMES = {
  // ... exact object from app.js
};
```

- [ ] **Step 2: Replace app.js local declaration with import**

Remove the `const THEMES = { ... }` block from `app.js`. Add import:

```js
import { THEMES } from "./src/data/maps.js";
```

- [ ] **Step 3: Verify**

Run: `npm run check`
Expected: no output.

Manual: reload browser, cycle through all maps in the lobby, verify each map label/thumbnail matches pre-refactor.

- [ ] **Step 4: Commit**

```bash
git add src/data/maps.js app.js
git commit -m "refactor: extract map data to src/data/maps.js"
```

---

## Task 7: Deterministic purpose-scoped RNG

**Files:**
- Create: `src/sim/rng.js`
- Test: `test/sim/rng.test.js`
- Modify: `app.js:537-545` (remove local `mulberry32`, add import)

- [ ] **Step 1: Write failing tests**

Create `test/sim/rng.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mulberry32, createPurposeRng } from "../../src/sim/rng.js";

test("mulberry32 is deterministic given a seed", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

test("mulberry32 outputs are in [0, 1)", () => {
  const r = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
  }
});

test("createPurposeRng derives different streams per purpose", () => {
  const terrain = createPurposeRng("match-abc", "terrain");
  const wind = createPurposeRng("match-abc", "wind");
  const t0 = terrain();
  const w0 = wind();
  assert.notEqual(t0, w0);
});

test("createPurposeRng is reproducible for same (seed, purpose)", () => {
  const a = createPurposeRng("match-abc", "terrain");
  const b = createPurposeRng("match-abc", "terrain");
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/sim/rng.js`:

```js
import { hashString } from "../util/text.js";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPurposeRng(matchSeed, purpose) {
  return mulberry32(hashString(`${matchSeed}:${purpose}`));
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: pass all new tests plus earlier ones.

- [ ] **Step 5: Replace app.js local declaration with import**

Remove `function mulberry32(...)` from `app.js` (around line 537). Add import:

```js
import { mulberry32, createPurposeRng } from "./src/sim/rng.js";
```

`createPurposeRng` is not used by existing `app.js` code yet — it exists for future plans. Do not wire it up now.

- [ ] **Step 6: Verify no regression**

Run: `npm run check && npm test`
Expected: check clean, tests pass.

Manual: create a room named "TESTSEED", note terrain shape. Reload, create "TESTSEED" again, confirm identical terrain.

- [ ] **Step 7: Commit**

```bash
git add src/sim/rng.js test/sim/rng.test.js app.js
git commit -m "refactor: extract RNG and add purpose-scoped variant"
```

---

## Task 8: Fixed-point math primitives

**Files:**
- Create: `src/sim/fixedpoint.js`
- Test: `test/sim/fixedpoint.test.js`

No `app.js` modifications in this task — the primitives are groundwork for Plan C (terrain) and do not replace existing physics yet.

- [ ] **Step 1: Write failing tests**

Create `test/sim/fixedpoint.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { FP_SCALE, toFP, fromFP, mulFP, sinFP, cosFP } from "../../src/sim/fixedpoint.js";

test("FP_SCALE is 256", () => {
  assert.equal(FP_SCALE, 256);
});

test("toFP/fromFP roundtrip integer values exactly", () => {
  for (const n of [-5, 0, 1, 100, 32000]) {
    assert.equal(fromFP(toFP(n)), n);
  }
});

test("toFP truncates fractional part toward zero", () => {
  assert.equal(toFP(1.5), 384);  // 1.5 * 256 = 384
  assert.equal(toFP(-1.5), -384);
});

test("mulFP multiplies two FP values and returns FP", () => {
  // 2.0 * 3.0 = 6.0 in FP
  assert.equal(mulFP(toFP(2), toFP(3)), toFP(6));
});

test("sinFP(0) = 0 and sinFP(90) = 256 (1.0 in FP)", () => {
  assert.equal(sinFP(0), 0);
  assert.equal(sinFP(90), 256);
});

test("cosFP(0) = 256 and cosFP(90) = 0", () => {
  assert.equal(cosFP(0), 256);
  assert.equal(cosFP(90), 0);
});

test("sinFP is deterministic and table-driven for integer degrees", () => {
  for (let d = 0; d <= 360; d++) {
    assert.equal(sinFP(d), sinFP(d));
  }
});

test("sinFP handles negative and large angles by wrapping", () => {
  assert.equal(sinFP(-90), sinFP(270));
  assert.equal(sinFP(450), sinFP(90));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/sim/fixedpoint.js`:

```js
export const FP_SCALE = 256;

export function toFP(value) {
  return (value * FP_SCALE) | 0;
}

export function fromFP(fp) {
  return fp / FP_SCALE;
}

export function mulFP(a, b) {
  return ((a * b) / FP_SCALE) | 0;
}

const SIN_TABLE = new Int16Array(361);
for (let d = 0; d <= 360; d++) {
  SIN_TABLE[d] = Math.round(Math.sin((d * Math.PI) / 180) * FP_SCALE);
}

function wrapDeg(d) {
  let w = d % 360;
  if (w < 0) w += 360;
  return w;
}

export function sinFP(degrees) {
  return SIN_TABLE[wrapDeg(degrees | 0)];
}

export function cosFP(degrees) {
  return SIN_TABLE[wrapDeg((degrees | 0) + 90)];
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/fixedpoint.js test/sim/fixedpoint.test.js
git commit -m "feat(sim): add fixed-point math and sin/cos table"
```

---

## Task 9: State hash primitives

**Files:**
- Create: `src/sim/stateHash.js`
- Test: `test/sim/stateHash.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/sim/stateHash.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  hashUint8Array,
  hashPlayerStates,
  combineHashes,
} from "../../src/sim/stateHash.js";

test("hashUint8Array is deterministic", () => {
  const a = new Uint8Array([1, 2, 3, 4, 5]);
  const b = new Uint8Array([1, 2, 3, 4, 5]);
  assert.equal(hashUint8Array(a), hashUint8Array(b));
});

test("hashUint8Array differs when any byte changes", () => {
  const a = new Uint8Array([1, 2, 3, 4, 5]);
  const b = new Uint8Array([1, 2, 3, 4, 6]);
  assert.notEqual(hashUint8Array(a), hashUint8Array(b));
});

test("hashPlayerStates captures id, hp, accumulatedDelay", () => {
  const players = [
    { id: "p1", hp: 100, accumulatedDelay: 0 },
    { id: "p2", hp: 80, accumulatedDelay: 720 },
  ];
  const other = [
    { id: "p1", hp: 100, accumulatedDelay: 0 },
    { id: "p2", hp: 79, accumulatedDelay: 720 },
  ];
  assert.equal(hashPlayerStates(players), hashPlayerStates(players));
  assert.notEqual(hashPlayerStates(players), hashPlayerStates(other));
});

test("hashPlayerStates is order-independent", () => {
  const a = [
    { id: "p1", hp: 100, accumulatedDelay: 0 },
    { id: "p2", hp: 80, accumulatedDelay: 720 },
  ];
  const b = [a[1], a[0]];
  assert.equal(hashPlayerStates(a), hashPlayerStates(b));
});

test("combineHashes is deterministic", () => {
  assert.equal(combineHashes(1, 2, 3), combineHashes(1, 2, 3));
  assert.notEqual(combineHashes(1, 2, 3), combineHashes(3, 2, 1));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `src/sim/stateHash.js`:

```js
import { hashString } from "../util/text.js";

const FNV_PRIME = 16777619;
const FNV_OFFSET = 2166136261;

export function hashUint8Array(bytes) {
  let h = FNV_OFFSET >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

export function hashPlayerStates(players) {
  const sorted = [...players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let h = FNV_OFFSET >>> 0;
  for (const p of sorted) {
    h = Math.imul(h ^ hashString(p.id), FNV_PRIME) >>> 0;
    h = Math.imul(h ^ (p.hp | 0), FNV_PRIME) >>> 0;
    h = Math.imul(h ^ (p.accumulatedDelay | 0), FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

export function combineHashes(...hashes) {
  let h = FNV_OFFSET >>> 0;
  for (const x of hashes) {
    h = Math.imul(h ^ ((x | 0) >>> 0), FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/sim/stateHash.js test/sim/stateHash.test.js
git commit -m "feat(sim): add state hashing primitives for desync detection"
```

---

## Task 10: Smoke test — full game regression check

This task has no code changes. It's a gate before declaring Plan A done.

- [ ] **Step 1: Run all automated checks**

Run: `npm run check && npm test`
Expected: `node --check` silent, all tests pass.

- [ ] **Step 2: Manual regression checklist**

Start the server: `npm start`. Open two browser tabs at http://localhost:3002.

- [ ] Host tab: name "TestHost", pick "Canyon Bridge" map, pick "Ironclad" tank, click "방 만들기". Verify invite link appears.
- [ ] Copy link into second tab. Verify second tab lands in lobby as Commander.
- [ ] Add bot, start match. Verify battle screen opens.
- [ ] Fire one shot from each player. Verify terrain crater forms, tank falls into crater if applicable, HP updates in roster.
- [ ] Move a tank, verify fuel drains, position updates.
- [ ] End match (damage until one wins), verify winner banner.
- [ ] Check browser devtools console — no errors.

- [ ] **Step 3: Line count check**

Run: `wc -l app.js`
Expected: significantly under 6,036 (target ~5,700 after Tasks 2-7 extract ~300 lines of utilities/constants/data).

- [ ] **Step 4: Commit (if any doc/script adjustments)**

If anything was tweaked during regression (e.g., an import path typo), commit that fix. Otherwise no commit.

---

## Out of Scope (Handled by later plans)

- Delay-based turn system → Plan B
- Pixel bitmap terrain → Plan C
- Weapon expansion (SS1/SS2/NEW) → Plan D
- SVG tank rendering → Plan E
- HUD rework → Plan F
- Wiring `createPurposeRng` and `fixedpoint` into existing physics (done in Plans B/C)
- Breaking apart the remaining ~5,700 lines of `app.js` (done opportunistically in B/C/D/F)

---

## Plan A Definition of Done

- [ ] `src/` tree exists with `util/`, `sim/`, `data/`, `config.js`
- [ ] `app.js` imports everything instead of re-declaring
- [ ] `test/` suite passes with `npm test`
- [ ] Manual regression checklist all green
- [ ] Zero gameplay-visible changes from a user's perspective
