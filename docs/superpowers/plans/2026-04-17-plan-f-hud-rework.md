# Plan F — HUD Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Each task is a TDD cycle (red → green → commit) sized 2–5 minutes.

**Goal:** Rework the battle HUD to match spec §8. Add a turn-order rail (4 upcoming tanks with delay bars), a weapon slot tabs row (SS1/SS2/NEW with key bindings `1`/`2`/`3`), a NEW-uses counter with ❄ badges, and canvas-drawn status effect icons over frozen tanks. Preserve the existing power-meter / fuel / wind / chat layout.

**Architecture:**
- New pure render helpers live in `src/ui/` so they can be unit tested without DOM when possible (pure helpers return view-model objects; DOM-touching renderers are thin wrappers).
- Status icons are drawn on `battle-canvas` via a new pure `src/ui/statusIcons.js` (ctx-based draw; ctx injected so it can be stubbed in tests).
- Turn order data sourced from the Plan B `turnManager` (`src/sim/turn.js`) via `snapshot()` / `peekUpcoming(n)`.
- Weapon slot state sourced from the Plan D player model (`player.tankType`, `player.selectedWeapon`, `player.newUsesRemaining`).
- Keyboard bindings integrated into the existing keydown handler in `app.js`.

**Tech Stack:** ES modules, `node:test`, no new runtime deps. Canvas 2D for status icons.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase1-design.md` §8 (HUD).

**Depends on:** Plan B (turn manager with `accumulatedDelay`), Plan D (weapon slots on player: SS1/SS2/NEW, `newUsesRemaining`).

---

## File Structure

```
index.html                          # + #turn-order-rail, #weapon-slots DOM
styles.css                          # + turn-order-rail, weapon-slots, responsive rules
app.js                              # + renderTurnOrder, renderWeaponSlots wiring; keybinds
src/ui/
  turnOrder.js                      # pure: buildTurnOrderView(manager, n=4)
  weaponSlots.js                    # pure: buildWeaponSlotsView(player)
  statusIcons.js                    # drawStatusIcons(ctx, player, statuses)
test/ui/
  turnOrder.test.js                 # normalizeDelayBar, view shape
  weaponSlots.test.js               # selectedWeaponReducer, disabled logic
  statusIcons.test.js               # resolveIconList(statuses) pure helper
```

---

## Design Notes

**Turn-order rail placement:** inside `.battle-top`, new sibling row under `.battle-top-left` / `.battle-top-right` (full-width strip).

**Weapon slots placement:** inside `.battle-power-strip`, between `#wind-pill` and `.power-meter`. On narrow viewports it wraps below the power meter.

**NEW badge in roster:** small `❄` glyphs appended to the player name cell inside `#battle-roster` entries, one per remaining NEW use (max 2).

**Status icon draw:** added inside the existing battle render loop, called after tanks are drawn. Reads from `turnManager.pendingStatuses[tankId]`. Icon is a 16×16 cyan rounded square with a snowflake glyph plus a yellow "+200" label at `tank.y - 40`.

**View-model pattern:**
- `buildTurnOrderView(manager, n)` returns `[{ tankId, tankTypeId, name, delayBarPct, isActive }]`.
- `buildWeaponSlotsView(player)` returns `{ slots: [{ id, label, subLabel, disabled, active, tooltip }], activeSlot }`.

---

## Task 1: HTML scaffold for turn-order rail

**Files:**
- Modify: `index.html`
- Modify: `styles.css` (placeholder rule)

- [ ] Append `<div id="turn-order-rail" class="turn-order-rail" aria-label="다음 턴"></div>` to the end of `.battle-top` (after `.battle-top-right`).
- [ ] Add placeholder CSS: `.turn-order-rail { display: flex; gap: 6px; min-height: 48px; }`.
- [ ] Smoke test: load battle in browser, confirm the element renders with no layout regression.

**Commit:** `feat(hud): scaffold #turn-order-rail container`

## Task 2: Turn order view builder + unit tests (pure)

**Files:**
- Add: `src/ui/turnOrder.js`
- Add: `test/ui/turnOrder.test.js`

- [ ] Write failing tests in `test/ui/turnOrder.test.js`:
  - `buildTurnOrderView` returns up to `n` entries sorted by ascending `accumulatedDelay`.
  - `delayBarPct` is normalized 0–100 relative to max in the window.
  - First entry has `isActive: true`.
  - Handles `n=0` and single-tank manager gracefully.
- [ ] Implement `buildTurnOrderView(manager, n=4)` — pure; takes `{ tanks: [{id, name, tankTypeId, accumulatedDelay}] }`.
- [ ] Run `npm test` — green.

**Commit:** `feat(hud): add pure buildTurnOrderView with delay bar math`

## Task 3: DOM renderer for turn-order rail

**Files:**
- Modify: `app.js`
- Modify: `styles.css`

- [ ] Add `renderTurnOrder(manager)`:
  - Calls `buildTurnOrderView(manager.snapshot(), 4)`.
  - Clears `#turn-order-rail`; renders one `<div class="turn-order-card">` per entry with 40×28 mini canvas (reuse `renderTankToCanvas`), name, and delay-fill bar.
  - Adds `.active` class to first card.
- [ ] Hook into render loop where `updateTurnLabel()` is called.
- [ ] Add CSS:
  ```
  .turn-order-card { width: 84px; padding: 4px; border-radius: 6px; background: #1a1d24; display: flex; flex-direction: column; align-items: center; }
  .turn-order-card.active { box-shadow: 0 0 0 2px #f2c94c; }
  .turn-order-name { font-size: 11px; line-height: 1.2; max-width: 76px; overflow: hidden; text-overflow: ellipsis; }
  .turn-order-delay { width: 76px; height: 4px; background: #333; border-radius: 2px; margin-top: 2px; }
  .turn-order-delay-fill { height: 100%; background: #4ea1ff; border-radius: 2px; }
  ```
- [ ] Smoke test: start battle, 4 cards appear in delay order, active card highlighted.

**Commit:** `feat(hud): render turn order rail from turn manager`

## Task 4: HTML + CSS scaffold for weapon slots

**Files:**
- Modify: `index.html`
- Modify: `styles.css`

- [ ] Insert between `#wind-pill` and `.power-meter` inside `.battle-power-strip`:
  ```html
  <div id="weapon-slots" class="weapon-slots" role="tablist" aria-label="무기 선택">
    <button class="weapon-slot" data-slot="ss1" role="tab">SS1</button>
    <button class="weapon-slot" data-slot="ss2" role="tab">SS2</button>
    <button class="weapon-slot" data-slot="new" role="tab">NEW <span id="new-remaining">❄❄</span></button>
  </div>
  ```
- [ ] Add CSS:
  ```
  .weapon-slots { display: flex; gap: 6px; align-items: center; }
  .weapon-slot { min-height: 38px; padding: 6px 10px; border: 1px solid #3a3f48; border-radius: 6px; background: #1a1d24; color: #e6e7ea; cursor: pointer; font-weight: 600; }
  .weapon-slot:disabled { opacity: 0.45; cursor: not-allowed; }
  .weapon-slot.active { border-color: #f2c94c; background: #3a2f12; color: #ffe58a; }
  #new-remaining { display: inline-flex; gap: 2px; margin-left: 4px; color: #8fd7ff; }
  ```
- [ ] Smoke test: three inert tabs render in place.

**Commit:** `feat(hud): scaffold weapon slot tabs in power strip`

## Task 5: Weapon slots view builder + unit tests (pure)

**Files:**
- Add: `src/ui/weaponSlots.js`
- Add: `test/ui/weaponSlots.test.js`

- [ ] Tests:
  - `buildWeaponSlotsView({tankType, selectedWeapon: 'ss1', newUsesRemaining: 2, isCurrentTurn: true})` returns 3 slots with ss1 active.
  - NEW slot `disabled: true` when `newUsesRemaining === 0`.
  - All slots `disabled: true` when `isCurrentTurn === false`.
  - Tooltip includes name + damage + delay multiplier from tankType.
  - `selectedWeaponReducer('ss1', {type:'SELECT', slot:'new'})` returns `'new'`; while `newUsesRemaining===0` returns previous value.
- [ ] Implement `buildWeaponSlotsView` and `selectedWeaponReducer`.

**Commit:** `feat(hud): add pure weapon slots view builder`

## Task 6: DOM renderer for weapon slots

**Files:**
- Modify: `app.js`

- [ ] Add `renderWeaponSlots(player, isCurrentTurn)`:
  - Builds view, sets each button's `disabled`, `.active`, `title` (tooltip), updates `#new-remaining` to repeat `❄` × `newUsesRemaining`.
- [ ] Call on every turn change and after fire-completion.

**Commit:** `feat(hud): render weapon slot state from player model`

## Task 7: Click handler for weapon slot buttons

**Files:**
- Modify: `app.js`

- [ ] Delegate clicks on `#weapon-slots`:
  ```js
  weaponSlotsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.weapon-slot');
    if (!btn || btn.disabled) return;
    selectWeapon(btn.dataset.slot);
  });
  ```
- [ ] `selectWeapon(slot)` mutates `player.selectedWeapon` via `selectedWeaponReducer` and re-renders slots.

**Commit:** `feat(hud): wire weapon slot click handlers`

## Task 8: Keyboard bindings 1 / 2 / 3

**Files:**
- Modify: `app.js`

- [ ] In the existing battle keydown handler, add `1`/`2`/`3` → `selectWeapon('ss1'|'ss2'|'new')`. Guard with the same "battle active + your turn + not typing in chat" check used by other battle keys.

**Commit:** `feat(hud): keyboard bindings 1/2/3 for weapon slots`

## Task 9: NEW counter badge in roster

**Files:**
- Modify: `app.js` (roster renderer)
- Modify: `styles.css`

- [ ] In `renderBattleRoster()`, append `<span class="roster-new-badge">` with `❄` × `player.newUsesRemaining`.
- [ ] CSS: `.roster-new-badge { color: #8fd7ff; font-size: 12px; margin-left: 6px; }`
- [ ] Smoke: fire NEW, badge + slot counter both drop by 1.

**Commit:** `feat(hud): NEW usage badge in battle roster`

## Task 10: Status effect icons on canvas

**Files:**
- Add: `src/ui/statusIcons.js`
- Add: `test/ui/statusIcons.test.js`
- Modify: `app.js` (draw loop)

- [ ] Failing tests for pure helper `resolveIconList(statuses)`:
  - `[{type:'frozen', delayBonus:200}]` → `[{glyph:'❄', label:'+200', color:'#8fd7ff'}]`.
  - Unknown status types skipped.
  - Empty array → `[]`.
- [ ] Implement `resolveIconList` and `drawStatusIcons(ctx, player, statuses)`:
  - 16×16 rounded-rect background at `(player.x - 8, player.y - 48)`, centered glyph, yellow label at `y - 40`.
- [ ] In the battle render loop, after tanks are drawn, call `drawStatusIcons(ctx, player, manager.pendingStatuses[player.id] ?? [])`.

**Commit:** `feat(hud): status effect icons on battle canvas`

## Task 11: Responsive rules for narrow viewports

**Files:**
- Modify: `styles.css`

- [ ] Add `@media (max-width: 780px)`:
  ```
  .turn-order-rail { flex-wrap: wrap; }
  .battle-power-strip { flex-wrap: wrap; }
  .weapon-slots { order: 2; flex-basis: 100%; justify-content: center; margin-top: 6px; }
  .power-meter { order: 1; }
  ```
- [ ] Smoke at 760px: rail wraps, slots stack below power meter, nothing overlaps canvas.

**Commit:** `style(hud): responsive rules for narrow viewport`

## Task 12: Manual regression checklist

- [ ] 4-player battle: turn order rail shows 4 sorted cards; active highlighted.
- [ ] Press `1` / `2` / `3` → slot selection changes; NEW disabled when counter is 0.
- [ ] Click SS1/SS2/NEW buttons → same result as keys.
- [ ] Fire NEW → `newUsesRemaining` decrements in both slot tab and roster badge.
- [ ] Hit opponent with NEW freeze → ice icon + "+200" appears above them; disappears after their next turn consumes the status.
- [ ] Resize to 760px → rail wraps, weapon slots move below power meter.
- [ ] Open chat input, type "1" → character enters chat, slot does NOT change.

---

## Determinism Notes

- All HUD logic is presentational; no new state enters the deterministic sim.
- State-hash is unaffected — no fields added to simulated state.
- Keyboard handler must continue to ignore keys when chat input is focused.
