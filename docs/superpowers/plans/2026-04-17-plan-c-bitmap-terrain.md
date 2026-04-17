# Plan C — Pixel Bitmap Terrain & Destruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Replace the height-map terrain in `app.js` with a pixel bitmap (`Uint8Array` solid mask + `Uint8ClampedArray` color buffer) that supports arbitrary crater shapes, gravity-correct sandfall, and partial-rect redraws — while preserving every existing theme, bridge overlay, and tank/projectile collision behavior.

**Architecture:** New deterministic `src/sim/terrain.js` module owns the bitmap. Bridge floors (canyonbridge / skyruins / frostmaw) remain a **separate overlay layer** drawn on top of the bitmap, so destructible solid and non-destructible decorative bridge collision stay distinct. Existing theme generators (heights) are **reused** — their heightmap output is **rasterized** into the bitmap rather than rewritten. A thin `surface: Int16Array` cache keeps surface lookups O(1). Rendering uses `putImageData` over dirty rects.

**Tech Stack:** ES modules, typed arrays, `node:test`, `putImageData`.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase1-design.md` §5 (지형), §6 (결정성).

**Out of scope (deferred):** Projectile physics module migration (Plan D).

---

## File Structure

```
src/
  sim/
    terrain.js            createTerrain, generateFromTheme, isSolidAt, surfaceYAt,
                          applyCrater, sandfallColumn, applyMaskAt, getDirtyRect,
                          rasterizeHeightmap, colorForTheme
    craterMasks.js        circle, ellipse, verticalTunnel, horizontalBurst (LRU-cached)
    bridge.js             extracted bridge overlay math (canyonbridge/skyruins/frostmaw)
  render/
    terrainRender.js      drawTerrain(ctx, terrain, dirtyRect?), markDirtyRectForCrater

test/
  sim/
    terrain.test.js
    craterMasks.test.js
    bridge.test.js
    terrainDeterminism.test.js
  render/
    terrainRender.test.js (stub ctx recording putImageData)
```

---

## Task 1: Bitmap terrain skeleton + surface cache

**Files:** Create `src/sim/terrain.js`, `test/sim/terrain.test.js`

- [ ] Implement `createTerrain({ width, height, matchSeed, themeId })` returning `{ width, height, solid, surface, colorBuf, seed, matchSeed, themeId, rng }`.
- [ ] `isSolidAt(terrain, x, y)` with bounds check.
- [ ] `surfaceYAt(terrain, x)` reading the `Int16Array` cache.
- [ ] `recomputeSurfaceColumn(terrain, x)` scanning top-down.
- [ ] Tests: allocation sizes, out-of-bounds behavior, column recomputation.

**Commit:** `feat(terrain): add bitmap terrain skeleton with surface cache`

## Task 2: Crater mask templates (LRU-cached)

**Files:** Create `src/sim/craterMasks.js`, `test/sim/craterMasks.test.js`

- [ ] Implement `circle(radius)`, `ellipse(rx, ry)`, `verticalTunnel(width, depth)`, `horizontalBurst(length, height)`.
- [ ] Each returns `{ w, h, ox, oy, data: Uint8Array }` with `data[y*w+x] = 1` meaning "clear".
- [ ] Internal LRU cache (max 64 entries).
- [ ] Tests: area within 5% of analytical expectations, deterministic re-calls return cached same-reference object.

**Commit:** `feat(terrain): add deterministic crater mask templates with LRU cache`

## Task 3: Heightmap rasterizer + `generateFromTheme`

**Files:** Modify `src/sim/terrain.js`, `test/sim/terrain.test.js`

- [ ] Add `paintColumn(terrain, x, topY, rgba)` — marks solid from y=topY down, clears above, updates surface cache + colorBuf.
- [ ] `rasterizeHeightmap(terrain, heights, colorFn)` iterates x columns.
- [ ] `generateFromTheme(terrain, { theme, seedText, generateHeights, colorForTheme })` adapter — caller injects legacy `generateTerrain` to avoid duplicating generator logic.
- [ ] Tests: 4×6 synthetic heightmap produces expected solid/empty pattern; surface cache matches.

**Commit:** `feat(terrain): rasterize heightmap into bitmap and surface cache`

## Task 4: `applyMaskAt` + `applyCrater` + `sandfallColumn`

**Files:** Modify `src/sim/terrain.js`, `test/sim/terrain.test.js`

- [ ] `applyMaskAt(terrain, mask, mx, my)` — blit mask centered at `(mx, my)`, clear solid where mask=1, update surface columns, return dirty rect or null.
- [ ] `sandfallColumn(terrain, x, fromY)` — collapse floating earth in a column; deterministic gather→compact→paint bottom.
- [ ] `applyCrater(terrain, { cx, cy, shape })` — mask + sandfall for each affected column.
- [ ] `unionRect(a, b)`, `getDirtyRect(prevSurface, terrain)`.
- [ ] Tests: crater removes inside mask, sandfall leaves no floaters, dirty rect detects columns only.

**Commit:** `feat(terrain): add mask blit, crater + sandfall, and dirty rect`

## Task 5: Terrain renderer

**Files:** Create `src/render/terrainRender.js`, `test/render/terrainRender.test.js`

- [ ] `drawTerrain(ctx, terrain, dirtyRect = null)` — full `putImageData` or sub-rect copy.
- [ ] `markDirtyRectForCrater(cx, cy, radius, bottomExtension)` helper.
- [ ] Tests with stub ctx recording `putImageData` calls; polyfill `ImageData` in node.

**Commit:** `feat(render): add bitmap terrain renderer with dirty-rect blit`

## Task 6: Theme color sampler

**Files:** Modify `src/sim/terrain.js`, `test/sim/terrain.test.js`

- [ ] Add `colorForTheme(theme, x, y, worldHeight)`:
  - Parse `theme.ground` and `theme.groundGlow` hex colors.
  - Vertical gradient blend 0..1 by depth.
  - Deterministic 3-bit noise from `(x, y)` hash, ±4 luminance jitter.
- [ ] Smoke test: iterate all THEMES, confirm RGBA returned, alpha=255.

**Commit:** `feat(terrain): add theme color sampler with deterministic shading`

## Task 7: Extract bridge overlay math

**Files:** Create `src/sim/bridge.js`, `test/sim/bridge.test.js`; modify `app.js`.

- [ ] Move these from `app.js` to `src/sim/bridge.js` verbatim:
  - `getBridgeProfile`, `getCanyonBridgeTopAt`, `getSkyRuinsBridgeTopAt`, `getFrostMawBridgeTopAt`, `getFrostMawSupportTopAt`
  - `calculateBridgeBottomAt`, `calculateFrostMawSupportBottomAt`, `isBridgeTerrainStyle`
  - `generateBridgeFloor`, `generateSupportTerrainState`
- [ ] Export `collectBridgeLayersAt(x, context)` returning `[{ top, bottom }]` for non-destructible spans at column x — replaces the bridge branches of `getTerrainLayersAt`.
- [ ] Tests: canyonbridge / skyruins / frostmaw each produce `top < bottom` at mid-world x with default seed.

**Commit:** `refactor(bridge): extract bridge overlay math to pure module`

## Task 8: Port all 8 themes to bitmap init

**Files:** Modify `src/sim/terrain.js`, `app.js`

- [ ] Add `initBitmapTerrainFromHeights({ terrain, theme, heights })`.
- [ ] Replace `createTerrainState(themeId, seedText)` body: generate heights via existing `generateTerrain` (reused), create bitmap, rasterize heightmap, keep `heightCache` for legacy callers, compute bridge/support overlays via `src/sim/bridge.js`.
- [ ] Update `getRawTerrainYAt` to handle both bitmap and legacy array.
- [ ] Manual smoke: cycle all 8 themes in map-select, visual parity.

**Commit:** `feat(terrain): initialize bitmap from existing heightmap generators for all 8 themes`

## Task 9: Runtime crater pipeline

**Files:** Modify `app.js`

- [ ] Introduce `applyExplosionCrater(cx, cy, radius, shape, extra)` dispatching to `circle`/`verticalTunnel`/`horizontalBurst` masks, calling `bitmapApplyCrater`, unioning `pendingDirtyRect`, and syncing `heightCache[x]` for each affected column.
- [ ] Replace runtime `flattenTerrain(app.game.terrain, cx, r)` calls with `applyExplosionCrater(cx, surfaceYAt(...), r)`.
- [ ] Leave generator-time `flattenTerrain` (e.g. in `generateHarborTerrain`) intact.
- [ ] Smoke: fire a shot, confirm crater + sandfall + no edge artifacts.

**Commit:** `feat(terrain): route runtime craters through bitmap applyCrater + sandfall`

## Task 10: Tank collision migration

**Files:** Modify `app.js`

- [ ] Update `isTerrainCollisionAt` to probe `isSolidAt` first, then check `collectBridgeLayersAt`.
- [ ] Update `getGroundYForPlayer` to use `surfaceYAt` for pixel-accurate ground snap with bridge-aware ordering.
- [ ] `reflowPlayersOntoTerrain` unchanged internally (its callees now route through bitmap).
- [ ] Smoke: spawn each tank, move across crater, confirm settle on new surface.

**Commit:** `feat(terrain): migrate tank collision and ground-snap to pixel bitmap`

## Task 11: Renderer wiring + dirty-rect render loop

**Files:** Modify `app.js`

- [ ] Allocate offscreen `terrainCtx` canvas sized `WORLD_WIDTH × (WORLD_HEIGHT + VOID_TERRAIN_DEPTH)`.
- [ ] In render loop, call `drawTerrain(terrainCtx, ...)` with either full or `pendingDirtyRect`, clear `pendingDirtyRect` after.
- [ ] Main game ctx composites `drawImage(terrainCanvas, ...)` per frame; bridges draw on top via existing stroked-path code.
- [ ] Remove old per-frame column polygon/path dirt rendering.
- [ ] Manual test: 8 themes + ≥8 shots, frame time not regressed.

**Commit:** `feat(render): composite bitmap terrain via offscreen canvas with dirty-rect redraw`

## Task 12: Bridge overlay compositing

**Files:** Modify `app.js`

- [ ] Ensure bridges draw *after* the bitmap composite. Tanks on bridge remain flush, projectiles pass under bridge, craters under bridge form dirt holes without damaging the bridge.

**Commit:** `feat(terrain): render bridges on top of bitmap composite`

## Task 13: Determinism + sandfall stress test

**Files:** Create `test/sim/terrainDeterminism.test.js`

- [ ] Seeded multi-crater replay (50 craters) must produce identical solid mask across runs with same seed, differ across seeds.
- [ ] Invariant: for each column, `surface[x]` equals topmost solid row after all craters + sandfall.

**Commit:** `test(terrain): determinism + no-floater invariants after crater bombardment`

## Task 14: Smoke + manual regression checklist

- [ ] `npm run check && npm test` all green.
- [ ] For each theme `{coral, mint, amber, mesa, storm, canyonbridge, skyruins, frostmaw}`:
  - 4-player match, fire ≥5 shots, craters appear pixel-correctly.
  - Tank settles into crater.
  - Bridge themes: bridge intact above craters.
  - Frame rate ≥ 55 fps on reference hardware.

**Commit:** `docs: add Plan C post-implementation manual regression checklist`

---

## Concerns

1. Bitmap height must be `WORLD_HEIGHT + VOID_TERRAIN_DEPTH` to preserve below-world falloff.
2. Memory at WORLD_WIDTH ~1920 × (WORLD_HEIGHT+VOID) ~900 ≈ 6.9 MB colorBuf + 1.7 MB solid. Fine desktop, confirm mobile.
3. `flattenTerrain` is overloaded (generator-time smoothing + runtime crater). Only runtime callers migrate.
4. `colorForTheme` pixel shading not identical to canvas gradients. Close but not perfect, acceptable per spec §5.
5. Sandfall is per-column (no angle of repose). Spec §5 only requires "no floating earth".
