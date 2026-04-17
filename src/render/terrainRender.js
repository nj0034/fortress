/**
 * Terrain bitmap renderer.
 *
 * drawTerrain(ctx, terrain, dirtyRect?)
 *   Full putImageData or sub-rect blit depending on dirtyRect.
 *
 * markDirtyRectForCrater(cx, cy, radius, bottomExtension)
 *   Returns a dirty rect that covers the crater + sandfall area.
 */

/**
 * Draw the terrain bitmap onto a canvas 2D context.
 *
 * When dirtyRect is null/undefined, the entire terrain is blitted.
 * When dirtyRect is provided, only the sub-rect is updated (partial redraw).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Terrain} terrain   object from createTerrain()
 * @param {{ x: number, y: number, w: number, h: number } | null} [dirtyRect]
 */
export function drawTerrain(ctx, terrain, dirtyRect = null) {
  const { width, height, colorBuf } = terrain;

  if (!dirtyRect) {
    // Full blit
    const imageData = new ImageData(new Uint8ClampedArray(colorBuf.buffer), width, height);
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  // Clamp dirty rect to terrain bounds
  const rx = Math.max(0, Math.min(width - 1, Math.round(dirtyRect.x)));
  const ry = Math.max(0, Math.min(height - 1, Math.round(dirtyRect.y)));
  const rw = Math.min(width - rx, Math.max(1, Math.round(dirtyRect.w)));
  const rh = Math.min(height - ry, Math.max(1, Math.round(dirtyRect.h)));

  if (rw <= 0 || rh <= 0) return;

  // Extract sub-rect RGBA data from colorBuf
  const subData = new Uint8ClampedArray(rw * rh * 4);
  for (let row = 0; row < rh; row++) {
    const srcRowStart = ((ry + row) * width + rx) * 4;
    const dstRowStart = row * rw * 4;
    subData.set(colorBuf.subarray(srcRowStart, srcRowStart + rw * 4), dstRowStart);
  }

  const imageData = new ImageData(subData, rw, rh);
  ctx.putImageData(imageData, rx, ry);
}

/**
 * Compute a dirty rect large enough to cover a crater + sandfall.
 *
 * @param {number} cx               crater center x
 * @param {number} cy               crater center y
 * @param {number} radius           mask radius
 * @param {number} [bottomExtension] extra pixels below crater for sandfall (default: terrainHeight)
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function markDirtyRectForCrater(cx, cy, radius, bottomExtension = 10000) {
  const x = Math.round(cx - radius);
  const y = Math.round(cy - radius);
  const w = Math.round(radius * 2 + 1);
  const h = Math.round(radius + bottomExtension);
  return { x, y, w, h };
}
