import test from "node:test";
import assert from "node:assert/strict";
import {
  createTerrain,
  isSolidAt,
  surfaceYAt,
  recomputeSurfaceColumn,
  paintColumn,
  rasterizeHeightmap,
  applyMaskAt,
  sandfallColumn,
  applyCrater,
  unionRect,
  getDirtyRect,
  colorForTheme,
} from "../../src/sim/terrain.js";

// ── createTerrain ────────────────────────────────────────────────────────────

test("createTerrain allocates correctly sized typed arrays", () => {
  const t = createTerrain({ width: 10, height: 20 });
  assert.equal(t.solid.length, 10 * 20);
  assert.equal(t.colorBuf.length, 10 * 20 * 4);
  assert.equal(t.surface.length, 10);
  assert.equal(t.width, 10);
  assert.equal(t.height, 20);
});

test("createTerrain surface defaults to height (all empty)", () => {
  const t = createTerrain({ width: 5, height: 8 });
  for (let x = 0; x < 5; x++) {
    assert.equal(t.surface[x], 8);
  }
});

test("createTerrain solid starts all zero", () => {
  const t = createTerrain({ width: 4, height: 6 });
  assert.ok(t.solid.every((v) => v === 0));
});

// ── isSolidAt ────────────────────────────────────────────────────────────────

test("isSolidAt returns false for out-of-bounds coordinates", () => {
  const t = createTerrain({ width: 10, height: 10 });
  assert.equal(isSolidAt(t, -1, 0), false);
  assert.equal(isSolidAt(t, 0, -1), false);
  assert.equal(isSolidAt(t, 10, 0), false);
  assert.equal(isSolidAt(t, 0, 10), false);
});

test("isSolidAt returns false when pixel is empty", () => {
  const t = createTerrain({ width: 5, height: 5 });
  assert.equal(isSolidAt(t, 2, 2), false);
});

test("isSolidAt returns true after manually setting solid flag", () => {
  const t = createTerrain({ width: 5, height: 5 });
  t.solid[2 * 5 + 3] = 1; // row 2, col 3
  assert.equal(isSolidAt(t, 3, 2), true);
  assert.equal(isSolidAt(t, 2, 3), false);
});

// ── surfaceYAt ───────────────────────────────────────────────────────────────

test("surfaceYAt returns height for empty column", () => {
  const t = createTerrain({ width: 5, height: 8 });
  assert.equal(surfaceYAt(t, 2), 8);
});

test("surfaceYAt clamps to valid range", () => {
  const t = createTerrain({ width: 5, height: 8 });
  t.surface[0] = 3;
  t.surface[4] = 6;
  assert.equal(surfaceYAt(t, -10), 3); // clamps to x=0
  assert.equal(surfaceYAt(t, 100), 6); // clamps to x=4
});

// ── recomputeSurfaceColumn ───────────────────────────────────────────────────

test("recomputeSurfaceColumn finds topmost solid pixel", () => {
  const t = createTerrain({ width: 4, height: 10 });
  // Set solid at y=3, y=5 for column x=1
  t.solid[3 * 4 + 1] = 1;
  t.solid[5 * 4 + 1] = 1;
  recomputeSurfaceColumn(t, 1);
  assert.equal(t.surface[1], 3);
});

test("recomputeSurfaceColumn writes height when column is empty", () => {
  const t = createTerrain({ width: 3, height: 6 });
  t.surface[2] = 0; // force wrong value
  recomputeSurfaceColumn(t, 2);
  assert.equal(t.surface[2], 6);
});

// ── paintColumn ──────────────────────────────────────────────────────────────

test("paintColumn marks solid from topY down and clears above", () => {
  const t = createTerrain({ width: 4, height: 8 });
  const colorFn = () => [100, 150, 200, 255];
  paintColumn(t, 2, 3, colorFn);

  // Above topY must be air
  for (let y = 0; y < 3; y++) {
    assert.equal(isSolidAt(t, 2, y), false, `y=${y} should be air`);
  }
  // From topY onwards must be solid
  for (let y = 3; y < 8; y++) {
    assert.equal(isSolidAt(t, 2, y), true, `y=${y} should be solid`);
  }
});

test("paintColumn updates surface cache", () => {
  const t = createTerrain({ width: 4, height: 8 });
  paintColumn(t, 1, 5, () => [0, 0, 0, 255]);
  assert.equal(t.surface[1], 5);
});

test("paintColumn writes colorBuf for solid pixels", () => {
  const t = createTerrain({ width: 2, height: 4 });
  paintColumn(t, 0, 2, () => [10, 20, 30, 255]);
  // y=2, x=0: idx=4, ci=16
  const ci = (2 * 2 + 0) * 4;
  assert.equal(t.colorBuf[ci], 10);
  assert.equal(t.colorBuf[ci + 1], 20);
  assert.equal(t.colorBuf[ci + 2], 30);
  assert.equal(t.colorBuf[ci + 3], 255);
});

// ── rasterizeHeightmap ────────────────────────────────────────────────────────

test("rasterizeHeightmap produces correct solid/empty pattern for 4×6 grid", () => {
  // width=4, height=6, heights=[2, 3, 1, 4]
  const W = 4, H = 6;
  const t = createTerrain({ width: W, height: H });
  const heights = [2, 3, 1, 4];
  rasterizeHeightmap(t, heights, () => [50, 50, 50, 255]);

  for (let x = 0; x < W; x++) {
    const topY = heights[x];
    for (let y = 0; y < H; y++) {
      const expected = y >= topY;
      assert.equal(isSolidAt(t, x, y), expected, `x=${x} y=${y}`);
    }
  }
});

test("rasterizeHeightmap surface cache matches heights", () => {
  const W = 4, H = 6;
  const t = createTerrain({ width: W, height: H });
  const heights = [2, 3, 1, 4];
  rasterizeHeightmap(t, heights, () => [0, 0, 0, 255]);
  for (let x = 0; x < W; x++) {
    assert.equal(t.surface[x], heights[x], `surface[${x}]`);
  }
});

// ── applyMaskAt ───────────────────────────────────────────────────────────────

function makeSolidTerrain(w, h, topY = 0) {
  const t = createTerrain({ width: w, height: h });
  for (let x = 0; x < w; x++) {
    paintColumn(t, x, topY, () => [80, 60, 40, 255]);
  }
  return t;
}

test("applyMaskAt clears solid pixels inside mask", () => {
  const t = makeSolidTerrain(10, 10, 0);
  // 3×3 all-clear mask centered at (5, 5)
  const mask = {
    w: 3, h: 3, ox: 1, oy: 1,
    data: new Uint8Array([1,1,1, 1,1,1, 1,1,1]),
  };
  const rect = applyMaskAt(t, mask, 5, 5);
  assert.ok(rect !== null);
  // Center pixels should be cleared
  assert.equal(isSolidAt(t, 5, 5), false);
  assert.equal(isSolidAt(t, 4, 4), false);
  assert.equal(isSolidAt(t, 6, 6), false);
});

test("applyMaskAt returns null when mask hits no solid pixels", () => {
  const t = createTerrain({ width: 10, height: 10 }); // all empty
  const mask = {
    w: 3, h: 3, ox: 1, oy: 1,
    data: new Uint8Array([1,1,1, 1,1,1, 1,1,1]),
  };
  const result = applyMaskAt(t, mask, 5, 5);
  assert.equal(result, null);
});

test("applyMaskAt updates surface cache after clearing", () => {
  // Full column height=5, width=3; clear top 2 rows of column 1
  const t = makeSolidTerrain(3, 5, 0);
  assert.equal(t.surface[1], 0);
  // Mask that clears rows 0,1 of column 1
  const mask = {
    w: 1, h: 2, ox: 0, oy: 0,
    data: new Uint8Array([1, 1]),
  };
  applyMaskAt(t, mask, 1, 0);
  assert.equal(t.surface[1], 2);
});

// ── sandfallColumn ────────────────────────────────────────────────────────────

test("sandfallColumn leaves no floaters above the compacted bottom", () => {
  // Column with a gap: solid at y=1 and y=4, empty at y=2,3
  const W = 1, H = 8;
  const t = createTerrain({ width: W, height: H });
  t.solid[1] = 1; t.colorBuf[4] = 80; t.colorBuf[7] = 255; // y=1 solid
  t.solid[4] = 1; t.colorBuf[16] = 80; t.colorBuf[19] = 255; // y=4 solid

  sandfallColumn(t, 0, 0);

  // Expect 2 solid pixels at the bottom: y=6, y=7
  assert.equal(isSolidAt(t, 0, 7), true, "bottom pixel solid");
  assert.equal(isSolidAt(t, 0, 6), true, "second-from-bottom solid");
  // Everything above 6 must be air
  for (let y = 0; y < 6; y++) {
    assert.equal(isSolidAt(t, 0, y), false, `y=${y} should be air after sandfall`);
  }
});

test("sandfallColumn updates surface cache", () => {
  const W = 1, H = 6;
  const t = createTerrain({ width: W, height: H });
  // Solid at y=1 only (floating after crater)
  t.solid[1] = 1; t.colorBuf[4] = 200; t.colorBuf[7] = 255;
  t.surface[0] = 1;

  sandfallColumn(t, 0, 0);

  // The single solid pixel should settle at y=5
  assert.equal(isSolidAt(t, 0, 5), true);
  assert.equal(t.surface[0], 5);
});

// ── applyCrater ───────────────────────────────────────────────────────────────

test("applyCrater removes pixels inside the mask and runs sandfall", () => {
  const W = 10, H = 12;
  const t = makeSolidTerrain(W, H, 2);

  const mask = {
    w: 4, h: 4, ox: 2, oy: 2,
    data: new Uint8Array(16).fill(1),
  };
  const rect = applyCrater(t, { cx: 5, cy: 4, shape: mask });
  assert.ok(rect !== null);

  // Check no floating pixels: for each column, once solid starts it must not gap
  for (let x = 0; x < W; x++) {
    let foundAir = false;
    let hasFloater = false;
    for (let y = 0; y < H; y++) {
      if (isSolidAt(t, x, y)) {
        if (foundAir) { hasFloater = true; break; }
      } else {
        if (isSolidAt(t, x, y - 1)) foundAir = true; // just crossed from solid to air
      }
    }
    // Floating means: air then solid then air again above first solid from bottom
    // Simple test: surface[x] must equal first solid row from top
    const firstSolid = t.surface[x];
    if (firstSolid < H) {
      assert.equal(isSolidAt(t, x, firstSolid), true, `x=${x} surface should be solid`);
    }
    assert.equal(hasFloater, false, `x=${x} has floater`);
  }
});

// ── unionRect ─────────────────────────────────────────────────────────────────

test("unionRect returns the other when one is null", () => {
  const r = { x: 1, y: 2, w: 3, h: 4 };
  assert.deepEqual(unionRect(null, r), r);
  assert.deepEqual(unionRect(r, null), r);
});

test("unionRect returns null for two nulls", () => {
  assert.equal(unionRect(null, null), null);
});

test("unionRect spans both rects", () => {
  const a = { x: 0, y: 0, w: 5, h: 5 };
  const b = { x: 3, y: 3, w: 5, h: 5 };
  const u = unionRect(a, b);
  assert.equal(u.x, 0);
  assert.equal(u.y, 0);
  assert.equal(u.w, 8); // 0..8
  assert.equal(u.h, 8);
});

// ── getDirtyRect ──────────────────────────────────────────────────────────────

test("getDirtyRect returns null when surface unchanged", () => {
  const t = createTerrain({ width: 5, height: 10 });
  const prev = t.surface.slice();
  assert.equal(getDirtyRect(prev, t), null);
});

test("getDirtyRect detects changed columns only", () => {
  const t = createTerrain({ width: 6, height: 10 });
  const prev = t.surface.slice();
  // Change column 2 and 4
  t.surface[2] = 3;
  t.surface[4] = 5;
  const r = getDirtyRect(prev, t);
  assert.ok(r !== null);
  assert.equal(r.x, 2);
  assert.equal(r.w, 3); // 2..4 inclusive = width 3
});

// ── colorForTheme ─────────────────────────────────────────────────────────────

test("colorForTheme returns valid RGBA with alpha=255", () => {
  const theme = { ground: "#aa7a4b", groundGlow: "#ffd88f" };
  const [r, g, b, a] = colorForTheme(theme, 0, 0, 100);
  assert.ok(r >= 0 && r <= 255);
  assert.ok(g >= 0 && g <= 255);
  assert.ok(b >= 0 && b <= 255);
  assert.equal(a, 255);
});

test("colorForTheme is deterministic for same (x, y)", () => {
  const theme = { ground: "#685d4f", groundGlow: "#cbb89f" };
  const a = colorForTheme(theme, 42, 77, 880);
  const b = colorForTheme(theme, 42, 77, 880);
  assert.deepEqual(a, b);
});

test("colorForTheme produces different values for different (x, y)", () => {
  const theme = { ground: "#8b5d3f", groundGlow: "#f0c07b" };
  const a = colorForTheme(theme, 0, 0, 100);
  const b = colorForTheme(theme, 1, 1, 100);
  // They should differ (noise makes them different with overwhelming probability)
  assert.notDeepEqual(a, b);
});
