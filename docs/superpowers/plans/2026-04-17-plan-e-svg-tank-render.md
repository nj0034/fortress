# Plan E — SVG Tank Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc canvas shape drawing for the 10 Phase‑1 tanks with an SVG template + offscreen-rasterized sprite pipeline usable from all four existing canvas call sites (hero showcase, tank tile strip, player pill, battle renderer), with team-color tinting, recoil, and damage-tint support.

**Architecture:** Templates are authored as static SVG files in `src/assets/tanks/`, fetched once at startup and parsed into a DOM-element cache. A renderer module in `src/render/tankRender.js` owns template loading, team-color substitution, rasterization to blob-URL bitmaps keyed by `(tankId, teamColor)`, and a `renderTankToCanvas(ctx, opts)` entry point. Pure helpers (`applyTeamColor`, `mixColors`, cache key builders) are extracted and unit-tested under Node; full rasterization is browser-only and verified by manual smoke test. Existing canvas drawing is kept behind a feature flag for the duration of one commit cycle and then removed.

**Tech Stack:** Native `fetch`, `DOMParser`, `XMLSerializer`, `Blob`, `URL.createObjectURL`, `Image`, `OffscreenCanvas` (or hidden `<canvas>` fallback). Tests run under `node:test` with string-level SVG fixtures. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-17-fortress-phase1-design.md` §7 (7.1–7.6).

---

## File Structure

```
src/
  assets/tanks/
    armor.svg        bigpo.svg     slingshot.svg    dike.svg       turtle.svg
    mage.svg         tricot.svg    acannon.svg      lightning.svg  ice.svg
  render/
    tankRender.js    loadTankTemplates, renderTankToCanvas,
                     getTankBlobUrl, preRasterize,
                     applyTeamColor, mixColors, TEAM_COLORS, TANK_IDS

test/
  render/
    tankRender.test.js   applyTeamColor, mixColors, cache-key helpers
```

`app.js` imports `loadTankTemplates`, `renderTankToCanvas`, `TEAM_COLORS` from `src/render/tankRender.js`, and replaces each existing `drawTank*` call at the four canvas call sites. Offscreen rasterization is internal to the module.

---

## SVG Authoring Rules

Every tank SVG must satisfy:

- Root `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">`
- Ground contact line at y=120; chassis sits on the ground
- Only `<rect>`, `<circle>`, `<ellipse>`, `<path>`, `<g>` — no `<image>`, no external refs, no inline styles beyond `fill="…"`
- Group ids present: `#track`, `#chassis` (class `team-primary`), `#turret`, `#barrel`, `#accent` (class `team-secondary`), `#eye`
- `#turret` has `data-pivot-x` / `data-pivot-y` attributes (pivot in viewBox space)
- Each file under ~2 KB

The renderer substitutes fills for elements carrying `class="team-primary"` / `class="team-secondary"` (and their descendants) during rasterization.

---

## TDD Tasks

### 1. Author `armor.svg`

- [ ] Create `src/assets/tanks/armor.svg`. 아머 is heavy blocky: wide rectangular chassis, thick track, low stout turret, short fat barrel.
- [ ] Verify ids/classes with `grep "team-primary" src/assets/tanks/armor.svg` and `grep "data-pivot-x"`.
- [ ] Commit: `feat(tanks): add armor.svg template`

Example (keep under 2KB):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">
  <g id="track" fill="#2b2b2b">
    <rect x="18" y="104" width="164" height="18" rx="6"/>
    <circle cx="34"  cy="113" r="6" fill="#777"/>
    <circle cx="66"  cy="113" r="6" fill="#777"/>
    <circle cx="100" cy="113" r="6" fill="#777"/>
    <circle cx="134" cy="113" r="6" fill="#777"/>
    <circle cx="166" cy="113" r="6" fill="#777"/>
  </g>
  <g id="chassis" class="team-primary" fill="#8a8f9a">
    <rect x="26" y="74" width="148" height="34" rx="4"/>
  </g>
  <g id="accent" class="team-secondary" fill="#4a4f5a">
    <rect x="32" y="98" width="136" height="6"/>
  </g>
  <g id="turret" data-pivot-x="100" data-pivot-y="76">
    <rect x="78" y="58" width="44" height="22" rx="4" class="team-primary" fill="#8a8f9a"/>
    <g id="barrel">
      <rect x="118" y="66" width="38" height="8" fill="#3a3f48"/>
    </g>
    <g id="eye">
      <circle cx="96" cy="69" r="2.2" fill="#f2f2f2"/>
    </g>
  </g>
</svg>
```

### 2. Author bigpo.svg, slingshot.svg, dike.svg

- [ ] `bigpo.svg` — oversized long barrel extending past front, tall narrow turret.
- [ ] `slingshot.svg` — Y-fork barrel rendered as two angled rects, small light chassis.
- [ ] `dike.svg` — triangular drill bit path at muzzle, short wide barrel.
- [ ] Commit: `feat(tanks): add bigpo/slingshot/dike svg templates`

Slingshot barrel group example:

```svg
<g id="barrel">
  <rect x="118" y="58" width="34" height="5" transform="rotate(-18 118 60)" fill="#3a3f48"/>
  <rect x="118" y="68" width="34" height="5" transform="rotate( 18 118 70)" fill="#3a3f48"/>
</g>
```

### 3. Author turtle.svg, mage.svg, tricot.svg

- [ ] `turtle.svg` — domed shell ellipse, stubby barrel, low profile.
- [ ] `mage.svg` — pointed wizard-hat turret (triangular path), glowing eye orb accent.
- [ ] `tricot.svg` — three parallel short barrels.
- [ ] Commit: `feat(tanks): add turtle/mage/tricot svg templates`

Mage turret example:

```svg
<g id="turret" data-pivot-x="100" data-pivot-y="74">
  <path d="M80 76 L100 40 L120 76 Z" class="team-primary" fill="#6a4ab8"/>
  <g id="barrel"><rect x="118" y="70" width="34" height="7" fill="#2a1e55"/></g>
  <g id="eye"><circle cx="100" cy="62" r="3" fill="#ffe27a"/></g>
</g>
```

### 4. Author acannon.svg, lightning.svg, ice.svg

- [ ] `acannon.svg` — artillery-style high-angle default barrel, narrow base.
- [ ] `lightning.svg` — jagged zigzag lightning accent path, slim quick silhouette.
- [ ] `ice.svg` — crystalline faceted polygons, icy accent color.
- [ ] Commit: `feat(tanks): add acannon/lightning/ice svg templates`

### 5. applyTeamColor util + tests

- [ ] Write `test/render/tankRender.test.js::applyTeamColor` using a small inline SVG fixture with `class="team-primary"` and `class="team-secondary"` nodes; assert both fills are replaced and unrelated fills untouched.
- [ ] Edge cases: missing class, multiple matches, elements with inline `fill` before class attribute, self-closing tags.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { applyTeamColor } from "../../src/render/tankRender.js";

test("applyTeamColor swaps team-primary and team-secondary fills", () => {
  const svg = `<svg><rect class="team-primary" fill="#000"/><rect class="team-secondary" fill="#fff"/><rect fill="#888"/></svg>`;
  const out = applyTeamColor(svg, "#ff0000", "#00ff00");
  assert.match(out, /class="team-primary"[^>]*fill="#ff0000"/);
  assert.match(out, /class="team-secondary"[^>]*fill="#00ff00"/);
  assert.match(out, /fill="#888"/);
});

test("applyTeamColor handles fill-before-class attribute order", () => {
  const svg = `<rect fill="#000" class="team-primary"/>`;
  const out = applyTeamColor(svg, "#abc123", "#fff");
  assert.match(out, /fill="#abc123"/);
});
```

- [ ] Implement in `src/render/tankRender.js`:

```js
export function applyTeamColor(svgString, primary, secondary) {
  return svgString
    .replace(/(<[^>]*class="[^"]*\bteam-primary\b[^"]*"[^>]*?)fill="[^"]*"/g, `$1fill="${primary}"`)
    .replace(/(<[^>]*?)fill="[^"]*"([^>]*class="[^"]*\bteam-primary\b)/g, `$1fill="${primary}"$2`)
    .replace(/(<[^>]*class="[^"]*\bteam-secondary\b[^"]*"[^>]*?)fill="[^"]*"/g, `$1fill="${secondary}"`)
    .replace(/(<[^>]*?)fill="[^"]*"([^>]*class="[^"]*\bteam-secondary\b)/g, `$1fill="${secondary}"$2`);
}
```

- [ ] Commit: `feat(render): applyTeamColor SVG substitution util`

### 6. mixColors + TEAM_COLORS + tests

- [ ] Tests: `mixColors("#ff0000", "#0000ff", 0.5)` → `#800080`; `t=0` → a; `t=1` → b; short-hex `#f00` accepted.
- [ ] Implement + export `TEAM_COLORS = [ Red, Blue, Green, Yellow ]` with primary/secondary each.
- [ ] Document 60/40 blend: `chassisPrimary = mixColors(tank.visual.primaryColor, team.primary, 0.4)`.
- [ ] Commit: `feat(render): mixColors + TEAM_COLORS palette`

### 7. loadTankTemplates

- [ ] Implement `loadTankTemplates()` returning `Promise<{[tankId]: SVGSVGElement}>`. Fetch all 10 SVGs via `Promise.all`, parse with DOMParser, cache. Idempotent.
- [ ] Export `TANK_IDS` constant (10-entry array).
- [ ] Unit test: `tankCacheKey(tankId, teamName)` returns stable string.
- [ ] Commit: `feat(render): loadTankTemplates with DOMParser cache`

### 8. renderTankToCanvas + bitmap cache

- [ ] Implement `getTankBlobUrl(tankId, team)`: clones template, serializes via XMLSerializer, runs `applyTeamColor`, wraps in `Blob({type:"image/svg+xml"})`, returns memoized `URL.createObjectURL` keyed by cache key.
- [ ] Implement `preRasterize(tankId, team)`: loads blob URL into `Image`, draws into offscreen `<canvas>` (200×140), memoizes canvas by cache key. Returns Promise<HTMLCanvasElement>.
- [ ] Implement `renderTankToCanvas(ctx, { tankId, x, y, angle, teamColor, turretAngle, shakeFrames, recoilPhase, tintFlash, scale })`:
  - If bitmap not yet rasterized: placeholder rect + kickoff `preRasterize`.
  - Otherwise save/translate/scale, draw body bitmap, then rotated turret overlay, offset along barrel axis by `-8 * recoilCurve(recoilPhase)`.
  - `tintFlash > 0`: `source-atop` red overlay.
- [ ] `recoilCurve(phase)`: piecewise — 0→0.4 ramps 0→1, 0.4→1.0 eases 1→0. Pure function with tests.
- [ ] Commit: `feat(render): renderTankToCanvas with bitmap cache + recoil`

### 9. Wire hero / tile / pill call sites

- [ ] At app.js boot, `await loadTankTemplates()` before first UI render. `USE_SVG_TANKS` flag (default true) keeps legacy path reachable.
- [ ] Hero (`#hero-vehicle-canvas`, 240×170): `renderTankToCanvas(ctx, { tankId, x:120, y:100, angle:0, turretAngle:-15, teamColor:TEAM_COLORS[0], scale:1.0 })`.
- [ ] Tank tile strip (148×92): scale ≈ 0.72, centered.
- [ ] Player pill (92×68): scale ≈ 0.45.
- [ ] Pre-call `preRasterize(tankId, team)` before render to avoid placeholders.
- [ ] Commit: `feat(ui): wire SVG tanks into hero/tile/pill canvases`

### 10. Wire battle renderer

- [ ] Replace `drawTankChassis` / `drawTankHull` / `drawTankTurretDetails` calls in `drawBattle` with single `renderTankToCanvas` per tank.
- [ ] Recoil: on fire, `player.recoilPhase = 0`; advance `1/10` per frame (clamp 1) inside battle loop.
- [ ] Tint: on hit, `player.tintFlash = 1`; decay `1/7.2` per frame.
- [ ] `turretAngle` = `player.aimAngle`, `angle` = chassis terrain normal.
- [ ] Commit: `feat(battle): SVG tank renderer with recoil+tint`

### 11. Smoke test + flag removal

- [ ] `python3 -m http.server` → open index.html.
- [ ] Verify roster strip: 10 distinct silhouettes, team color cycles.
- [ ] Enter a local match; confirm battle tank fires with 8px recoil over ~10 frames.
- [ ] Confirm damage tint flashes red on hit.
- [ ] Confirm hero / tile / pill render via SVG path.
- [ ] Remove `USE_SVG_TANKS` flag and legacy `drawTankChassis`/`drawTankHull`/`drawTankTurretDetails`/`drawTankPreview`.
- [ ] Commit: `chore(render): remove legacy canvas tank drawing`

---

## Notes

- **Turret overlay:** simplest is single rasterized body + separate rotated turret overlay. If overdraw visible (double body), switch to split body-only + turret-only SVG templates. Don't over-engineer upfront.
- **Deterministic sim:** renderer is presentation-only (§7.6), never feeds `sim/*`.
- **Accessibility:** keep `#eye` static (no rotation) to preserve identity cues at small sizes.
