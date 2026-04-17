# Plan I — Hit Feedback & Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Each task TDD red→green→commit.

**Goal:** Deterministic hit classification (normal/critical/pierce/aerial/miss with damage multipliers), presentational floating damage text + screen shake, and procedural (AudioContext-based) sound layer wired to fire/hit/explode/item/turn/end events — no touch to simulation determinism or network snapshot shape.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase2-design.md` §4, §5.

**Depends on:** Plan D (weapons.js / resolveHit), Plan B (turn events), Plan F (HUD topology).

---

## Constraints

- `classifyHit` is simulation-side (affects damage). No `Math.random`. Pure function of `(projectile, victim, impactPoint)`.
- `game.floatTexts` and `game.shake` NOT in network snapshots; render-local only.
- Critical multiplier **1.5×**, aerial **1.25×**, pierce/normal **1.0×**. Miss never enters `applyDamage`.
- No binary audio assets. Sounds synthesized via AudioContext oscillators per recipe.
- Playback gated by `masterVolume > 0 && !muted`, persisted to `localStorage` (`fortress.volume`, `fortress.muted`).

## New files

- `src/sim/damage.js` — `classifyHit`, multiplier table
- `src/render/floatText.js` — pure `advanceFloatText`, `spawnFloatText`, draw
- `src/render/shake.js` — `tickShake`, `applyShakeOffset`
- `src/data/sounds.js` — manifest ids → recipes + volume
- `src/audio/synth.js` — `synth({freq,duration,type,envelope})`
- `src/audio/audio.js` — loader/pool/`play`/volume/mute/localStorage
- `src/ui/audioControls.js` — slider + mute toggle
- tests for each

## Modified files

- `src/sim/weapons.js` — `resolveHit` returns `{damage, classification}`
- `app.js` — impact handlers dispatch hit events, apply multiplier, render floats + shake, play sounds; wire audio init + settings UI + turn/victory/defeat triggers
- `index.html` / `styles.css` — audio control markup + styles

---

## Tasks (TDD, commit per task)

### Task 1 — `classifyHit` pure function + tests

**Tests** (`test/sim/damage.test.js`):
- Miss when victim null.
- Impact Y within `victim.y + turretOffsetY ± 10` → critical, multiplier 1.5, red, "CRITICAL!".
- Projectile `phase === "air"` or `grounded !== true` → aerial, 1.25×, "AERIAL!".
- Projectile `kind === "pierce"` and `isLastHit === false` → pierce, 1.0×, "PIERCE".
- Otherwise normal, 1.0×, "HIT".
- Critical uses `TANK_TYPES[victim.tankType].turret.pivotY`.
- No Math.random in implementation.

**Implement** `src/sim/damage.js`:
```
export const HIT_MULTIPLIERS = { normal: 1.0, critical: 1.5, aerial: 1.25, pierce: 1.0, miss: 0 };
export function classifyHit(projectile, victim, impactPoint, opts = {}) { ... }
```

**Commit:** `feat(sim): add classifyHit with critical/aerial/pierce branches`

### Task 2 — Integrate into resolveHit + damage pipeline

**Tests** (extend `test/sim/weapons.test.js`):
- `resolveHit(state, proj, victim, impactPoint)` returns `{damage, classification}`.
- Critical scales damage by 1.5.
- Frozen status still applied when frozen projectile (regression).

**Implement:**
- `src/sim/weapons.js`: signature `resolveHit(state, proj, victim, impactPoint)`; call `classifyHit`; `damage = proj.damage * classification.damageMultiplier`; return `{damage, classification}`.
- `app.js` `resolveExplosion`: for each affected player compute impactPoint → classify → multiply rawDamage → `applyDamage`. Push `hitEvent {playerId, x, y, damage, classification}` onto `app.game.hitEvents` (ephemeral).

**Commit:** `feat(sim): resolveHit returns damage+classification; wire into resolveExplosion`

### Task 3 — Floating text pure helper

**Tests** (`test/render/floatText.test.js`):
- `advanceFloatText({x,y,vy:-1.4,life:36,maxLife:36}, 1)` decrements life, updates y.
- life=0 returns null.
- `alpha(life,maxLife)` full for first 2/3, linear fade last 1/3.

**Implement** `src/render/floatText.js`:
- `spawnFloatText(game, {x,y,text,color,size})` pushes.
- `advanceFloatText(entry, dt)` pure.
- `drawFloatTexts(ctx, game)` iterates, advances, removes expired.

**Commit:** `feat(render): add floatText advance helper and spawn`

### Task 4 — Render float texts from hit events

- Drain `game.hitEvents` in draw loop: for each non-miss, spawn float text (label+damage, color).
- Call `drawFloatTexts(ctx, game)` after tanks, before HUD.

**Commit:** `feat(render): spawn + draw floating damage numbers`

### Task 5 — Screen shake on critical

**Tests** (`test/render/shake.test.js`):
- `tickShake({frames:6, amplitude:3})` → `{frames:5, amplitude:3}`.
- frames=0 returns null.
- `applyShakeOffset(ctx, shake, rng)` translates ctx within amplitude bounds.

**Implement** `src/render/shake.js`. In hit consumer: on critical, `game.shake = {frames:6, amplitude:3}`. Draw loop wraps world rendering in save/translate/restore, then `game.shake = tickShake(game.shake)`.

**Commit:** `feat(render): add critical-hit screen shake`

### Task 6 — Sound manifest

**Tests** (`test/data/sounds.test.js`):
- All required ids: fire, hit, hit-critical, explode, freeze, pickup, teleport, shield, double-shot, repair, gravity, ping, turn-start, ui-click, victory, defeat.
- Each has `recipe:{freq,duration,type,envelope}` + volume in [0,1].

**Implement** `src/data/sounds.js`: `SOUND_MANIFEST = {[id]: {recipe, volume}}`.

**Commit:** `feat(data): add sound manifest with procedural recipes`

### Task 7 — synth.js AudioContext oscillator

**Tests** (`test/audio/synth.test.js`):
- `synth({freq,duration,type,envelope,context})` exported.
- `isValidRecipe(recipe)` shape validator.
- No-op when context null (Node-safe).

**Implement** oscillator + gain + linear ADSR envelope. `createSynthPlayer(context)` returns `play(recipe, volume)`.

**Commit:** `feat(audio): add procedural synth for sound recipes`

### Task 8 — audio.js pool, play, volume, localStorage

**Tests** (`test/audio/audio.test.js`):
- `createAudioSystem({manifest, context?: null})` returns `{play, setMasterVolume, setMuted, getMasterVolume, getMuted}`.
- `play(id)` no-op when context null.
- `setMasterVolume(0.4)` persists `fortress.volume`; `setMuted(true)` persists `fortress.muted`.
- Initial load reads persisted, fallback 0.8 / false.

**Implement**: pool of 3 per id (polyphony); `effectiveVol = masterVolume * (muted?0:1) * entryVolume * (volume??1)`; skip if 0. localStorage guarded for Node.

**Commit:** `feat(audio): add pooled audio system with volume + mute persistence`

### Task 9 — Boot audio + wire events

- Initialize at app boot; lazy AudioContext on first user gesture (autoplay policy).
- Fire handler: `audio.play("fire")`.
- Hit consumer: `play(classification.type === "critical" ? "hit-critical" : "hit")`.
- Explode: `play("explode")`.
- Items (from Plan G hooks, stub-safe): pickup, teleport, shield, double-shot, repair, gravity.
- Turn start: `play("turn-start")`.
- Victory/defeat: per local perspective in `endBattle`.
- UI click: delegated lobby listener.

**Commit:** `feat(audio): wire sound effects into fire/hit/explode/turn/end`

### Task 10 — Settings UI

- `src/ui/audioControls.js::mountAudioControls(root, audio)` renders slider + mute button.
- Mount in lobby top-right and battle HUD.
- Two-way bind + initial read from audio system.
- Minimal CSS.

**Commit:** `feat(ui): add volume slider and mute toggle in lobby and battle`

### Task 11 — Freeze/ping/status-effect sounds

- Freeze status apply: `play("freeze")`.
- Map ping (Plan H): `play("ping")`.
- Repair self-heal: `play("repair")`.
- Plan G item triggers stubbed safely if unimplemented.

**Commit:** `feat(audio): wire status effect and ping sounds`

### Task 12 — Smoke QA checklist

Manual checklist committed (empty or docs-only):
- Fire/hit/critical/explode/freeze/pickup/turn-start/victory/defeat audibly fire.
- Volume slider attenuates; mute silences; persist across reload.
- Floating damage rises and fades; critical uses red label + shake.
- Determinism: same seed → identical HP outcomes. Shake pattern may differ (render-only).
- State hash round-trip: pre/post adding floatTexts/shake/hitEvents → hashes equal (exclude from hash).

**Commit:** `docs: smoke QA checklist for Plan I feedback+sound`

---

## Risks

- **Critical box source:** needs `TANK_TYPES[tankType].turret.pivotY`. If not present, Task 1 adds it (additive, safe).
- **Air phase flag:** `classifyHit` needs "still-in-air" signal; fall back to `grounded === false` or `impactPoint.y < terrainHeightAt(x) - EPS`.
- **Autoplay policy:** resume AudioContext on first gesture. Lazy resume in `audio.js` first `play`.
- **State hash exclusion:** double-check `src/sim/stateHash.js` doesn't serialize `floatTexts/shake/hitEvents`. Add explicit skip list if it serializes whole game.

## Non-goals

- Binary audio asset files — deferred.
- Particle system beyond floats + shake — out of scope.
- Miss-terrain visual dust puff — existing explosion code handles.
