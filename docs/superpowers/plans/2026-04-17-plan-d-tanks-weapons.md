# Plan D — 10 Korean Tanks + 3-Tier Weapon System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Replace the existing English-named roster with 10 Korean-named tanks, each with a 3-slot weapon loadout (SS1 / SS2 / NEW, NEW capped at 2 uses per match). Add a data-driven weapons table and a deterministic weapon execution engine supporting single / split / burrow / multi / pierce / chain / freeze shot types.

**Architecture:** Flat weapons table keyed `"<tankId>_<slot>"`. Pure `fireWeapon(state, weaponId, origin, angle, power, wind, rng)` dispatcher returns a projectile list consumed by the existing sim loop. Tanks reference weapons by id (no inline defs). All randomness through `createPurposeRng(matchSeed, "combat:<turnIndex>")`.

**Tech Stack:** ES modules, `node:test`, pure sim modules. Integrates with `src/sim/turn.js` (Plan B) and `src/sim/terrain.js` (Plan C).

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase1-design.md` §2, §3, §8.1.

**Dependencies:** Plan A (done). Plan B (`turn.applyStatusDelay`, `baseDelay`). Plan C (`terrain.applyCrater`, `terrain.applyMaskAt` for burrow).

---

## File Structure

```
src/
  data/
    tanks.js             rewritten: 10 Korean tanks referencing weapon ids
    weapons.js           NEW: 30-entry weapon table (10 × 3)
  sim/
    weapons.js           NEW: fireWeapon dispatcher + shot-type handlers

test/
  data/
    tanks.test.js
    weapons.test.js
  sim/
    weapons.test.js
```

---

## Task 1: Weapon schema + 30-weapon data table

**Files:** Create `src/data/weapons.js`, `test/data/weapons.test.js`

- [ ] Tests:
  - WEAPONS has 30 entries.
  - Every weapon has name, shotType in `{single,split,burrow,multi,pierce,chain}`, numeric delayMultiplier, projectile.damage/radius, fx.
  - NEW slot weapons have `perMatchLimit: 2`; SS1/SS2 have `null`.
  - `WEAPON_SLOT_DELAY = { ss1: 1.0, ss2: 1.3, new: 1.8 }`.
- [ ] Implement `WEAPONS` with 30 entries per spec §3.2. Helpers: `base()` schema default, `splitFan(count, airBurstTimer, damage, radius)`, `fanN(count, angleStep, damage)`, `zigzagFan(count, angleStep)`.

Example structure (full 30 entries in actual file):

```js
export const WEAPON_SLOT_DELAY = { ss1: 1.0, ss2: 1.3, new: 1.8 };

const base = (overrides) => ({
  speedMultiplier: 1.0, gravityScale: 1.0, windFactor: 1.0,
  damage: 35, radius: 44, craterMultiplier: 1.0, pierce: 0,
  fragments: [], status: null, ...overrides,
});

export const WEAPONS = {
  armor_ss1: { name: "Siege Shot", shotType: "single", delayMultiplier: 1.0, perMatchLimit: null,
    projectile: base({ damage: 38, radius: 46, craterMultiplier: 0.96 }),
    fx: { trail: "#ffb84f", hitSprite: "boom-mid" } },
  armor_ss2: { name: "Heavy Burst", ... },
  armor_new: { name: "Siege Storm", shotType: "split", delayMultiplier: 1.8, perMatchLimit: 2,
    projectile: base({ damage: 12, radius: 22, fragments: [...] }),
    fx: { trail: "#ffcf66", hitSprite: "boom-large" } },
  // ... bigpo, slingshot, dike, turtle, mage, tricot, acannon, lightning, ice (3 entries each)
};
```

Per-tank summary (see spec §3.2 for exact numbers):
- **armor**: Siege Shot / Heavy Burst / Siege Storm (3-frag split)
- **bigpo**: Big Cannon / Howitzer / Meteor (radius 110)
- **slingshot**: Lob Pebble (windFactor 1.6) / Lob Boulder / Gale Shot (3-frag multi)
- **dike**: Drill Round (burrow tunnelDepth 200) / Drill Bunker / Earth Rupture (burrow + horizontalSpan 260)
- **turtle**: Shell Bolt (+8 selfHeal) / Shell Bash (+15) / Guardian's Wall (+40 + raiseTerrainInFront)
- **mage**: Arcane Orb (3-frag split) / Star Fall (5-frag) / Meteor Swarm (randomFall count 9)
- **tricot**: Tri-Split (3-frag fan) / Tri-Burst (5-frag) / Prism Shower (zigzag 9-frag)
- **acannon**: Rail Round (windFactor 0.4) / Rail Spike (pierce 1) / Rail Hyper (pierce 2)
- **lightning**: Arc Bolt (terrainPierceCells 1) / Chain Bolt (chain range 220) / Thunder Strike (verticalStrike)
- **ice**: Frost Ball (frozen +120) / Frost Shard (3-frag + frozen +200) / Blizzard (aoeAllEnemies + frozen +400)

**Commit:** `feat(data): add 30-entry weapons table for 10 tanks × 3 slots`

## Task 2: Rewrite `src/data/tanks.js` with 10 Korean tanks

**Files:** Modify `src/data/tanks.js`, create `test/data/tanks.test.js`

- [ ] Tests:
  - Exactly 10 tanks; all 10 expected ids present.
  - Each `name` contains hangul characters.
  - Stats ranges: maxHealth [80,200], armor [0.5,1.5], mobility [0.3,1.5], baseDelay [400,1000], precision [0.6,1.2].
  - `tank.weapons[slot]` resolves in WEAPONS; naming convention `${id}_${slot}`.
  - Each tank has `visual.primaryColor` + `visual.secondaryColor` hex.
- [ ] Rewrite with helper:

```js
const T = (id, name, role, description, stats, primary, secondary) => ({
  id, name, role, description, stats,
  weapons: { ss1: `${id}_ss1`, ss2: `${id}_ss2`, new: `${id}_new` },
  visual: { svgId: id, primaryColor: primary, secondaryColor: secondary, trackStyle: "standard" },
});

export const TANK_TYPES = {
  armor:     T("armor",     "아머",     "중장갑 / 정면", "...", { maxHealth:150, armor:0.85, mobility:0.80, baseDelay:720, precision:0.90 }, "#ffb84f","#d9772a"),
  bigpo:     T("bigpo",     "빅포",     "고화력 / 대포", "...", { maxHealth:135, armor:0.90, mobility:0.60, baseDelay:870, precision:0.85 }, "#ff6a4b","#b03020"),
  slingshot: T("slingshot", "새총",     "곡사 / 바람",  "...", { maxHealth:105, armor:1.05, mobility:1.10, baseDelay:660, precision:0.95 }, "#9cd8ff","#2e7fbf"),
  dike:      T("dike",      "디크",     "굴착 / 매몰",  "...", { maxHealth:115, armor:1.00, mobility:1.00, baseDelay:760, precision:0.90 }, "#7ec46b","#3f7a3a"),
  turtle:    T("turtle",    "터틀",     "방어 / 지속전","...", { maxHealth:170, armor:0.80, mobility:0.55, baseDelay:840, precision:0.88 }, "#8ed6c2","#2f6a5a"),
  mage:      T("mage",      "마법사",   "광역 / 분열",  "...", { maxHealth:110, armor:1.05, mobility:0.95, baseDelay:720, precision:0.92 }, "#c48cff","#5a2fa0"),
  tricot:    T("tricot",    "트리코",   "3분열 / 확산", "...", { maxHealth:110, armor:1.00, mobility:1.05, baseDelay:700, precision:0.93 }, "#ffd24b","#b8881a"),
  acannon:   T("acannon",   "A캐논",    "장거리 / 직사","...", { maxHealth: 95, armor:1.15, mobility:0.95, baseDelay:620, precision:1.05 }, "#7ddcff","#1c6ea4"),
  lightning: T("lightning", "라이트닝", "전격 / 관통",  "...", { maxHealth:115, armor:1.02, mobility:1.00, baseDelay:760, precision:1.00 }, "#fff37a","#c89b1a"),
  ice:       T("ice",       "아이스",   "빙결 / 디버프","...", { maxHealth:120, armor:1.00, mobility:0.95, baseDelay:780, precision:0.90 }, "#b6efff","#3a8fb2"),
};
```

**Commit:** `feat(data): replace roster with 10 Korean tanks referencing weapon ids`

## Task 3: `fireWeapon` dispatcher + `single` shotType

**Files:** Create `src/sim/weapons.js`, `test/sim/weapons.test.js`

- [ ] Tests:
  - single returns 1 projectile with damage/radius from weapon table.
  - Unknown weaponId throws.
  - Origin/angle/power carried onto projectile initial velocity (90° → mostly vertical).
- [ ] Implement:

```js
import { WEAPONS, WEAPON_SLOT_DELAY } from "../data/weapons.js";
import { sinFP, cosFP, fromFP } from "./fixedpoint.js";

const POWER_TO_SPEED = 0.22;

function makeProjectile(origin, angleDeg, power, weapon, extras = {}) {
  const speed = power * POWER_TO_SPEED * (weapon.projectile.speedMultiplier ?? 1);
  const cx = fromFP(cosFP(angleDeg));
  const sy = fromFP(sinFP(angleDeg));
  return {
    x: origin.x, y: origin.y, vx: cx * speed, vy: -sy * speed,
    damage: weapon.projectile.damage, radius: weapon.projectile.radius,
    craterMultiplier: weapon.projectile.craterMultiplier,
    gravityScale: weapon.projectile.gravityScale, windFactor: weapon.projectile.windFactor,
    pierce: weapon.projectile.pierce ?? 0, status: weapon.projectile.status ?? null,
    trail: weapon.fx.trail, weaponId: weapon._id, ...extras,
  };
}

export function fireWeapon(state, weaponId, origin, angleDeg, power, wind, rng) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) throw new Error(`unknown weapon: ${weaponId}`);
  const w = { ...weapon, _id: weaponId };
  switch (w.shotType) {
    case "single": return fireSingle(state, w, origin, angleDeg, power, rng);
    case "split":  return fireSplit(state, w, origin, angleDeg, power, rng);
    case "multi":  return fireMulti(state, w, origin, angleDeg, power, rng);
    case "pierce": return firePierce(state, w, origin, angleDeg, power, rng);
    case "burrow": return fireBurrow(state, w, origin, angleDeg, power, rng);
    case "chain":  return fireChain(state, w, origin, angleDeg, power, rng);
    default: throw new Error(`unsupported shotType: ${w.shotType}`);
  }
}

function fireSingle(state, w, origin, angle, power) {
  return { projectiles: [makeProjectile(origin, angle, power, w)] };
}
```

Leave `fireSplit/multi/pierce/burrow/chain` as stubs (`throw new Error`) to fill in later tasks.

**Commit:** `feat(sim): fireWeapon dispatcher with single shotType`

## Task 4: `split` shotType

- [ ] Test: mage_ss1 returns parent `kind:"split-parent"` with `fragments.length ≥ 3` and `airBurstTimer > 0`.
- [ ] Implement:

```js
function fireSplit(state, w, origin, angle, power) {
  const parent = makeProjectile(origin, angle, power, w, { kind: "split-parent" });
  parent.airBurstTimer = w.projectile.fragments[0]?.airBurstTimer ?? 24;
  parent.fragments = w.projectile.fragments.map((f) => ({
    offsetAngle: f.offsetAngle,
    speedMultiplier: f.speedMultiplier ?? 1,
    damage: f.damage ?? parent.damage,
    radius: f.radius ?? parent.radius,
    craterMultiplier: f.craterMultiplier ?? 0.85,
    status: parent.status,
  }));
  return { projectiles: [parent] };
}
```

Sim loop consumes `airBurstTimer` and spawns children at parent position.

**Commit:** `feat(sim): split shotType with fragment descriptors`

## Task 5: `burrow` shotType

- [ ] Tests: dike_ss1 yields projectile kind "burrow" with burrow params. dike_new includes `horizontalSpan: 260`.
- [ ] Implement: `fireBurrow` returns single projectile with `{ kind:"burrow", burrow: w.projectile.burrow }`. Sim loop integrates airborne → impact → tunnel down (calls `terrain.applyMaskAt(verticalTunnel)` per cell step) → terminal burst (calls `terrain.applyCrater`) → optional horizontal span for `dike_new`.

**Commit:** `feat(sim): burrow shotType for dike tunneling`

## Task 6: `pierce` shotType

- [ ] Tests: acannon_ss2 pierce=1 kind="pierce"; acannon_new pierce=2 damage≥70.
- [ ] Implement: `firePierce` returns projectile with `kind:"pierce"`, `terrainPierceCells` passthrough. Sim decrements `pierce` on tank hit; destroys when `pierce < 0`.

**Commit:** `feat(sim): pierce shotType`

## Task 7: `multi` shotType

- [ ] Tests:
  - tricot_ss1 yields 3 sibling projectiles at different angles.
  - mage_new Meteor Swarm generates 9 random-fall projectiles using injected rng (distinct x positions).
- [ ] Implement:

```js
function fireMulti(state, w, origin, angle, power, rng) {
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
      makeProjectile(origin, angle + f.offsetAngle, power * (f.speedMultiplier ?? 1), w, {
        kind: "multi", damage: f.damage ?? w.projectile.damage, zigzagAmp: f.zigzagAmp ?? 0,
      })
    ),
  };
}
```

**Commit:** `feat(sim): multi shotType incl. random-fall for Meteor Swarm`

## Task 8: `chain` shotType

- [ ] Test: lightning_ss2 sets `chain.count=1, range=220, falloff=0.8` on projectile.
- [ ] Implement: `fireChain` returns `{ kind:"chain", chain: w.projectile.chain }`. Sim loop, on hit, finds alive tanks within `chain.range`, applies `damage * falloff^k` for k=1..count.

**Commit:** `feat(sim): chain shotType for lightning_ss2`

## Task 9: `freeze` status + self-heal hooks

- [ ] Test: frost_ball hit calls `state.turn.applyStatusDelay(victim.id, 120)`.
- [ ] Export `resolveHit(state, projectile, victim)` applying frozen status + returning damage.
- [ ] Export `resolveSelfHeal(state, projectile, shooter)` for turtle weapons (+8/+15/+40).
- [ ] Test turtle_ss1 self-heal adds 8 to shooter.hp (clamped).

**Commit:** `feat(sim): freeze status + self-heal hooks`

## Task 10: Integrate into `app.js`

**Files:** Modify `app.js`

- [ ] On match init: `player.selectedWeapon = "ss1"`, `player.newUsesRemaining = 2` for each player.
- [ ] Replace existing `spawnProjectile` / `fireWeapon` bodies:

```js
import { fireWeapon as simFireWeapon, resolveHit, resolveSelfHeal, WEAPON_SLOT_DELAY } from "./src/sim/weapons.js";
import { WEAPONS } from "./src/data/weapons.js";
import { createPurposeRng } from "./src/sim/rng.js";

function fireWeapon(player) {
  const tank = TANK_TYPES[player.tankType];
  const slot = player.selectedWeapon ?? "ss1";
  if (slot === "new" && player.newUsesRemaining <= 0) return;
  const weaponId = tank.weapons[slot];
  const rng = createPurposeRng(state.matchSeed, `combat:${state.turnIndex}`);
  const { projectiles } = simFireWeapon(
    { tanks: state.players, terrain: terrainAdapter, turn: turnAdapter },
    weaponId,
    { x: player.x, y: player.y - TANK_BARREL_OFFSET },
    player.angle, player.power, state.wind, rng,
  );
  state.activeProjectiles.push(...projectiles.map((p) => ({ ...p, owner: player.id })));
  if (slot === "new") player.newUsesRemaining--;
  turnManager.consumeDelay(player.id, tank.stats.baseDelay * WEAPON_SLOT_DELAY[slot]);
}
```

- [ ] Wire `resolveHit`/`resolveSelfHeal` into impact handler.
- [ ] Remove legacy `player.shots[]` handling; grep `shot.directBonus`, `shot.homingRange` etc. for cleanup.
- [ ] Smoke: `npm run check && npm test && npm start` → cycle 10 tanks, fire each SS1/SS2/NEW.

**Commit:** `feat(app): wire SS1/SS2/NEW weapons through sim/weapons.js`

## Task 11: Roster + player-pill UI (Korean names)

**Files:** Modify `app.js`, `styles.css`

- [ ] Verify tank tile list iterates `Object.values(TANK_TYPES)` (renders all 10).
- [ ] CSS grid `.tank-strip` → `repeat(5, 1fr)` to accommodate 10 entries in 2 rows on desktop.
- [ ] Grep and remove hardcoded English names ("Ironclad", "Skyrider", "Twin Fang", "Aegis", "Tempest") from help/copy.
- [ ] Replace `tank.color` reads with `tank.visual?.primaryColor` fallback.

**Commit:** `feat(ui): render 10 Korean tanks in roster + player pill`

## Task 12: Weapon slot selector stub (HUD)

**Files:** Modify `app.js`

Full HUD is Plan F; Plan D needs a functional selector.

- [ ] Keyboard: `1/2/3` → `setSelectedWeapon(currentPlayer, "ss1"|"ss2"|"new")` (guard for `newUsesRemaining > 0` on "3").
- [ ] Append minimal on-screen pill `SS1 | SS2 | NEW(2)` with active slot highlighted.
- [ ] Network note: slot selection is not networked per-keypress; only the `fire` command carries `weaponSlot` per spec §6.2.

**Commit:** `feat(hud): add SS1/SS2/NEW slot selector stub`

## Task 13: Smoke — all shot types fire

**Files:** Modify `test/sim/weapons.test.js`, manual test app.js

- [ ] Integration test:

```js
test("eight mixed weaponIds fire without exceptions", () => {
  const state = stubState();
  for (const id of ["armor_ss1","mage_ss1","dike_ss1","tricot_ss1","acannon_ss2","lightning_ss2","ice_ss1","bigpo_new"]) {
    const res = fireWeapon(state, id, { x: 400, y: 300 }, 45, 75, 0, () => 0.5);
    assert.ok(res.projectiles.length >= 1);
  }
});
```

- [ ] Manual: start 4 bots, walk through armor→SS1, bigpo→SS2, dike→SS1 tunnel, mage→SS2, tricot→NEW, acannon→SS2, lightning→SS2 chain, ice→SS1 freeze. Confirm visuals and victim delay growth for ice.

**Commit:** `test(sim): smoke coverage across all weapon shot types`

## Task 14: Remove legacy shots + Tempest hidden tank

**Files:** Modify `app.js`

- [ ] Grep `TANK_TYPES.tempest`, `TANK_TYPES.ironclad`, `shots[0]`, `shot.homingRange` — delete or port.
- [ ] Drop any "hidden/locked" random-select path for removed tanks.

**Commit:** `refactor(app): remove legacy shots array and tempest hidden tank`

---

## Plan D Definition of Done

- [ ] 10 Korean tanks with valid stats + weapon-id triples.
- [ ] 30 weapons, NEW slots have `perMatchLimit: 2`.
- [ ] `fireWeapon` handles 6 shot types purely; rng passed in.
- [ ] Tests green.
- [ ] app.js fires via dispatcher; `selectedWeapon` + `newUsesRemaining` on player; NEW locks after 2 uses.
- [ ] Lobby + roster show 10 Korean names; no legacy English names.
- [ ] Manual 4-bot smoke: every shot type lands visually.
- [ ] `grep "Math.random()" src/sim/weapons.js` → empty.

---

## Out of Scope

- Turn-order rail UI (Plan F)
- Full HUD slot pill visual (Plan F)
- SVG tank rendering (Plan E)
- Bitmap terrain / sandfall (Plan C — dependency, not re-implemented here)
- Delay turn manager internals (Plan B — dependency)
