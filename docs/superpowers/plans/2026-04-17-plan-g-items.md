# Plan G — In-Game Items System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Each task is a TDD cycle (red → green → commit) sized 2–5 minutes.

**Goal:** Add Phase 2 §1 "In-Game Items" system — 5 item types that drop on the battlefield, are collected by tanks, stored in a 3-slot inventory, and activated via Q/W/E. Items are fully deterministic under the lockstep multiplayer model (per-purpose RNG), integrate with the existing turn manager delay model, and require only two new network commands (`use-item`, `drop-spawn`).

**Architecture:**
- Pure data table in `src/data/items.js` (mirrors tanks.js/weapons.js style).
- Pure sim module `src/sim/items.js` with `maybeSpawnDrop`, `collectDrops`, `useItem`.
- Inventory per-player (`inventory: []` max 3). Pending drops on game state.
- Rendering in `src/render/itemsRender.js` (canvas helpers).
- Inventory strip UI in `index.html` + `styles.css`; keyboard/click in `app.js`.
- Determinism: `createPurposeRng(matchSeed, "item:drop:" + turnIndex)` and `"item:" + turnIndex`.
- Network: `use-item` (player input) + `drop-spawn` (host-broadcast, deterministic fallback).
- Turn delay: `useItem` consumes `baseDelay * 0.3` via `applyTurnAction(..., "item", ...)`.

**Tech Stack:** ES modules, `node:test`, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase2-design.md` §1.

**Depends on:** A (rng), B (turn), C (terrain), D (player schema), E (renderer), F (HUD anchors).

---

## File Structure

```
src/data/items.js                       NEW: 5-item table
src/sim/items.js                        NEW: maybeSpawnDrop, collectDrops, useItem
src/render/itemsRender.js               NEW: drawDropCapsule, drawInventoryStrip
index.html                              + #inventory-strip
styles.css                              + inventory-strip rules
app.js                                  + wiring + keybinds + physics hooks + network
test/data/items.test.js
test/sim/items.test.js
test/render/itemsRender.test.js
test/ui/inventoryStrip.test.js
```

---

## Design Notes

### Item table

| id | slot | effect |
|---|---|---|
| teleport | instant | pick walkable tile; move tank there |
| double_shot | turn | next fire queues second shot with deterministic jitter |
| ion_shield | persistent | next incoming damage halved, consumed on hit |
| repair_kit | instant | +40 HP (clamped to maxHp) |
| gravity_reverse | turn | projectile gravity this turn becomes `-0.6` |

Each record: `{ id, name, description, slot, icon, applyEffect }` where `applyEffect` is a string key resolved inside `useItem`.

### State shape
- Player: `inventory: []`, plus transient `doubleShotPending`, `shieldCharges`, `gravityOverride`.
- Game: `pendingDrops: [{ id, x, y, itemId }]` (id = `"drop:" + turnIndex + ":" + seq`).

### Network
- `{ t: "use-item", turn, tankId, itemId, slotIndex, target?, seq }`
- `{ t: "drop-spawn", turn, drop: { id, x, y, itemId } }`

### Turn delay
Item usage: `baseDelay * 0.3` via `applyTurnAction(..., "item", ...)`. Does not end turn; turn continues.

---

## Task 1: Items data table

**Files:** Add `src/data/items.js`, `test/data/items.test.js`

- [ ] Tests: exports `ITEMS` array length 5; each has `{id,name,description,slot,icon,applyEffect}`; `slot` in `{instant,turn,persistent}`; ids unique and exact: teleport, double_shot, ion_shield, repair_kit, gravity_reverse; `getItem(id)` helper.
- [ ] Implement data module.

**Commit:** `feat(data): add 5-item in-game items table`

## Task 2: `maybeSpawnDrop`

**Files:** Add `src/sim/items.js`, `test/sim/items.test.js`

- [ ] Tests: deterministic for (seed, turnIndex); ~15% over 1000 turns (±3%); returned `{id, x, y, itemId}`; null otherwise. y resolved via injected `terrain.surfaceYAt`.
- [ ] Implement using `createPurposeRng(state.matchSeed, "item:drop:" + turnIndex)`.

**Commit:** `feat(sim): maybeSpawnDrop deterministic 15% per turn`

## Task 3: `collectDrops`

- [ ] Tests: tank within 24px collects; inventory cap 3; multiple drops in id order; triggers from projectile impact and tank end-of-turn.
- [ ] Implement.

**Commit:** `feat(sim): collectDrops with 3-slot inventory cap`

## Task 4: `useItem` dispatcher + repair_kit + ion_shield

- [ ] Tests: slot removal; unknown slot throws; repair +40 HP clamped; ion sets `shieldCharges = 1`; dispatcher calls `applyTurnAction(..., "item", baseDelay * 0.3)`.
- [ ] Implement dispatcher keyed on `applyEffect`.

**Commit:** `feat(sim): useItem dispatcher + repair/shield handlers`

## Task 5: `useItem` — gravity_reverse + double_shot

- [ ] Tests: gravity sets `-0.6` override, cleared end-of-turn; double_shot sets flag; `consumeDoubleShot(state, player, turnIndex)` returns deterministic `angleJitter` from `createPurposeRng(matchSeed, "item:doubleshot:" + turnIndex + ":" + tankId)` and flips flag false; no gravity stacking.
- [ ] Implement.

**Commit:** `feat(sim): gravity_reverse + double_shot with deterministic jitter`

## Task 6: `useItem` — teleport with terrain validation

- [ ] Tests (stub terrain): valid target (non-solid with solid within 64px below) → move + consume; invalid → `{ok:false, reason:"invalid-target"}`, no consume.
- [ ] Implement teleport; settle via injected terrain helper.

**Commit:** `feat(sim): teleport item with terrain walkability check`

## Task 7: Player/game state + serialization + state hash

**Files:** Modify `app.js`, `src/sim/items.js`, `src/sim/stateHash.js`, tests

- [ ] Tests: `serializeInventory(player)` returns `{inventory, shieldCharges, gravityOverride, doubleShotPending}`; JSON roundtrip preserves; defaults sane; state hash changes when inventory changes.
- [ ] Extend player factory, game state, and state hash.

**Commit:** `feat(state): inventory + pendingDrops in player/game state + hash`

## Task 8: Renderer

**Files:** Add `src/render/itemsRender.js`, `test/render/itemsRender.test.js`

- [ ] Tests (mock ctx): `buildInventoryView(player)` returns 3 entries `{slotKey:"Q"|"W"|"E", itemId|null, icon|null, label|null}`; `drawDropCapsule(ctx, drop, time)` deterministic pulse; `drawInventoryStrip(ctx, view, origin)` 3 rect draws.
- [ ] Implement.

**Commit:** `feat(render): drop capsule + inventory strip canvas helpers`

## Task 9: UI — inventory strip markup + CSS

**Files:** Modify `index.html`, `styles.css`, add `test/ui/inventoryStrip.test.js`

- [ ] Append `<div id="inventory-strip" class="inventory-strip" aria-label="인벤토리"></div>` to appropriate anchor.
- [ ] CSS: 3 × 56×56 slots, gap 6px, hover pulse, `.slot-empty` faded, Q/W/E labels below.
- [ ] View-model smoke test.

**Commit:** `feat(ui): inventory strip markup + CSS`

## Task 10: Keybindings Q/W/E + teleport click state

**Files:** Modify `app.js`

- [ ] Q/W/E → if slot has item, enqueue `use-item` to lockstep (do NOT mutate state locally).
- [ ] For teleport: set `state.pendingTeleport = {slotIndex}`; next canvas click validates via `isSolidAt` and enqueues; ESC cancels; ghost-tank preview at cursor.

**Commit:** `feat(app): Q/W/E inventory keybinds + teleport click state`

## Task 11: Network wiring

**Files:** Modify `app.js`, `src/sim/items.js`

- [ ] Register `use-item` command: apply via `useItem(...)` + `applyTurnAction(..., baseDelay * 0.3)`; state-hash desync check after apply.
- [ ] Register `drop-spawn`: host authoritatively broadcasts at turn-start; clients reconcile by `drop.id`; desync warning on mismatch.
- [ ] Hook `collectDrops` into projectile impact + end-of-turn settle.
- [ ] Hook `consumeDoubleShot` into fire pipeline: after primary fire, if flag set, queue secondary `fire` with jittered angle.
- [ ] Hook `gravityOverride` into projectile physics (use player override for current turn, clear after).
- [ ] Hook `shieldCharges` into damage calc: halve once, decrement.

**Commit:** `feat(net): use-item + drop-spawn lockstep commands`

## Task 12: Smoke test

**Files:** Add `test/sim/items.smoke.test.js`

- [ ] Seed chosen so first 5 turns spawn drops. 2-bot walks, collects all 5 items. Subsequent turns use them: repair HP change, ion_shield halves incoming, teleport moves, double_shot produces 2 projectiles, gravity_reverse inverts trajectory. Final state hash matches snapshot.

**Commit:** `test(sim): end-to-end items smoke with deterministic 2-bot match`

---

## Risks

- Hash desync from float transient fields (`gravityOverride`): use fixed-point integer `-600`, divide in physics, include in state hash.
- Teleport into thin gap: validation walks 64px down for solid pixel; reject otherwise.
- Double-shot re-entry: single-frame flag flip before queuing secondary.
- Backwards compat: new fields default to empty; old snapshots load `[]`.
