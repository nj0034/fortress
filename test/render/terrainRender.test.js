import test from "node:test";
import assert from "node:assert/strict";
import { drawTerrain, markDirtyRectForCrater } from "../../src/render/terrainRender.js";
import { createTerrain, paintColumn } from "../../src/sim/terrain.js";

// ── Polyfill ImageData for Node.js ──────────────────────────────────────────

if (typeof ImageData === "undefined") {
  global.ImageData = class ImageData {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height ?? Math.round(data.length / 4 / width);
    }
  };
}

// ── Stub canvas context ───────────────────────────────────────────────────────

function makeStubCtx() {
  const calls = [];
  return {
    calls,
    putImageData(imageData, dx, dy, ...rest) {
      calls.push({ method: "putImageData", imageData, dx, dy, rest });
    },
  };
}

// ── drawTerrain (full blit) ───────────────────────────────────────────────────

test("drawTerrain full blit calls putImageData once at (0,0)", () => {
  const t = createTerrain({ width: 4, height: 6 });
  const ctx = makeStubCtx();
  drawTerrain(ctx, t);
  assert.equal(ctx.calls.length, 1);
  const call = ctx.calls[0];
  assert.equal(call.dx, 0);
  assert.equal(call.dy, 0);
  assert.equal(call.imageData.width, 4);
  assert.equal(call.imageData.height, 6);
});

test("drawTerrain full blit ImageData size matches terrain dimensions", () => {
  const t = createTerrain({ width: 8, height: 10 });
  const ctx = makeStubCtx();
  drawTerrain(ctx, t);
  const { imageData } = ctx.calls[0];
  assert.equal(imageData.data.length, 8 * 10 * 4);
});

test("drawTerrain full blit copies colorBuf data correctly", () => {
  const t = createTerrain({ width: 3, height: 3 });
  // Set a known color at pixel (1,1) via paintColumn
  paintColumn(t, 1, 1, () => [11, 22, 33, 255]);
  const ctx = makeStubCtx();
  drawTerrain(ctx, t);
  const { imageData } = ctx.calls[0];
  // Pixel (1,1): idx = 1*3+1 = 4, ci = 16
  const ci = (1 * 3 + 1) * 4;
  assert.equal(imageData.data[ci], 11);
  assert.equal(imageData.data[ci + 1], 22);
  assert.equal(imageData.data[ci + 2], 33);
  assert.equal(imageData.data[ci + 3], 255);
});

// ── drawTerrain (dirty rect partial blit) ────────────────────────────────────

test("drawTerrain with dirtyRect calls putImageData at dirty origin", () => {
  const t = createTerrain({ width: 20, height: 20 });
  const ctx = makeStubCtx();
  drawTerrain(ctx, t, { x: 5, y: 3, w: 6, h: 4 });
  assert.equal(ctx.calls.length, 1);
  const call = ctx.calls[0];
  assert.equal(call.dx, 5);
  assert.equal(call.dy, 3);
  assert.equal(call.imageData.width, 6);
  assert.equal(call.imageData.height, 4);
});

test("drawTerrain dirty rect ImageData data length matches sub-rect", () => {
  const t = createTerrain({ width: 20, height: 20 });
  const ctx = makeStubCtx();
  drawTerrain(ctx, t, { x: 2, y: 2, w: 5, h: 7 });
  const { imageData } = ctx.calls[0];
  assert.equal(imageData.data.length, 5 * 7 * 4);
});

test("drawTerrain dirty rect pixel data matches colorBuf sub-rect", () => {
  const W = 10, H = 10;
  const t = createTerrain({ width: W, height: H });
  // Paint column 5 from row 2 down with a distinctive color
  paintColumn(t, 5, 2, () => [99, 88, 77, 255]);

  const ctx = makeStubCtx();
  // Dirty rect covering column 5, rows 2..5
  drawTerrain(ctx, t, { x: 5, y: 2, w: 1, h: 4 });
  const { imageData } = ctx.calls[0];
  // Row 0 in the sub-rect = world row 2, col 5 → should be solid color
  assert.equal(imageData.data[0], 99);
  assert.equal(imageData.data[1], 88);
  assert.equal(imageData.data[2], 77);
  assert.equal(imageData.data[3], 255);
});

test("drawTerrain clamps dirty rect that extends beyond terrain bounds", () => {
  const t = createTerrain({ width: 10, height: 10 });
  const ctx = makeStubCtx();
  // Rect going past the right/bottom edge
  drawTerrain(ctx, t, { x: 8, y: 8, w: 100, h: 100 });
  assert.equal(ctx.calls.length, 1);
  const { imageData, dx, dy } = ctx.calls[0];
  // Should be clamped to within bounds
  assert.ok(dx + imageData.width <= 10);
  assert.ok(dy + imageData.height <= 10);
});

// ── markDirtyRectForCrater ────────────────────────────────────────────────────

test("markDirtyRectForCrater returns rect covering crater + sandfall", () => {
  const r = markDirtyRectForCrater(100, 50, 20, 200);
  assert.equal(r.x, 80);    // 100 - 20
  assert.equal(r.y, 30);    // 50 - 20
  assert.equal(r.w, 41);    // 20*2+1
  assert.ok(r.h >= 200 + 20, `h=${r.h} should cover sandfall extension`);
});

test("markDirtyRectForCrater with default extension returns a large h", () => {
  const r = markDirtyRectForCrater(50, 30, 15);
  assert.ok(r.h > 100, "default extension should produce large h");
});
