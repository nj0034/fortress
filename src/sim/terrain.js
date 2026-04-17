/**
 * Pixel bitmap terrain for Fortress.
 *
 * Core data layout (per terrain object):
 *   solid    Uint8Array  [y * width + x]  1 = solid earth, 0 = air
 *   colorBuf Uint8ClampedArray  [4 * (y * width + x)]  RGBA per solid pixel
 *   surface  Int16Array  [x]  topmost solid y for column x, or worldHeight if empty
 */

// ─── Creation ───────────────────────────────────────────────────────────────

/**
 * Allocate an empty bitmap terrain.
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.height        total pixel height (WORLD_HEIGHT + VOID_TERRAIN_DEPTH)
 * @param {string} [opts.matchSeed]
 * @param {string} [opts.themeId]
 * @returns {Terrain}
 */
export function createTerrain({ width, height, matchSeed = "", themeId = "" }) {
  const solid = new Uint8Array(width * height);
  const colorBuf = new Uint8ClampedArray(width * height * 4);
  const surface = new Int16Array(width);
  // Initially no solid pixels — surface defaults to height (void)
  surface.fill(height);
  return { width, height, solid, surface, colorBuf, matchSeed, themeId };
}

// ─── Point queries ───────────────────────────────────────────────────────────

/**
 * Returns true when (x, y) is solid earth (bounds-safe).
 * @param {Terrain} terrain
 * @param {number} x  integer pixel column
 * @param {number} y  integer pixel row
 * @returns {boolean}
 */
export function isSolidAt(terrain, x, y) {
  if (x < 0 || x >= terrain.width || y < 0 || y >= terrain.height) {
    return false;
  }
  return terrain.solid[y * terrain.width + x] === 1;
}

/**
 * Returns the y of the topmost solid pixel in column x (from the surface cache).
 * Returns terrain.height when the column is fully empty.
 * @param {Terrain} terrain
 * @param {number} x  integer pixel column
 * @returns {number}
 */
export function surfaceYAt(terrain, x) {
  const xi = Math.round(x);
  if (xi < 0) return terrain.surface[0];
  if (xi >= terrain.width) return terrain.surface[terrain.width - 1];
  return terrain.surface[xi];
}

// ─── Surface cache maintenance ────────────────────────────────────────────────

/**
 * Scan column x top-down and write the result into surface[x].
 * @param {Terrain} terrain
 * @param {number} x  integer pixel column (must be in-bounds)
 */
export function recomputeSurfaceColumn(terrain, x) {
  const { width, height, solid, surface } = terrain;
  const base = x; // solid index base for column x is y*width + x
  for (let y = 0; y < height; y++) {
    if (solid[y * width + base] === 1) {
      surface[x] = y;
      return;
    }
  }
  surface[x] = height;
}

// ─── Column painter ──────────────────────────────────────────────────────────

/**
 * Paint column x: solid from topY downward (inclusive) to terrain.height-1.
 * Pixels above topY are cleared. Updates surface cache and colorBuf.
 *
 * @param {Terrain} terrain
 * @param {number} x       integer pixel column
 * @param {number} topY    first solid row (integer)
 * @param {function} colorFn  (x, y) => [r, g, b, a]  called for each solid pixel
 */
export function paintColumn(terrain, x, topY, colorFn) {
  const { width, height, solid, colorBuf, surface } = terrain;
  const topRow = Math.max(0, Math.min(height, Math.round(topY)));

  // Clear above
  for (let y = 0; y < topRow; y++) {
    const idx = y * width + x;
    solid[idx] = 0;
    const ci = idx * 4;
    colorBuf[ci] = 0;
    colorBuf[ci + 1] = 0;
    colorBuf[ci + 2] = 0;
    colorBuf[ci + 3] = 0;
  }

  // Paint from topRow to height-1
  for (let y = topRow; y < height; y++) {
    const idx = y * width + x;
    solid[idx] = 1;
    const [r, g, b, a] = colorFn(x, y);
    const ci = idx * 4;
    colorBuf[ci] = r;
    colorBuf[ci + 1] = g;
    colorBuf[ci + 2] = b;
    colorBuf[ci + 3] = a;
  }

  surface[x] = topRow < height ? topRow : height;
}

// ─── Heightmap rasterizer ─────────────────────────────────────────────────────

/**
 * Rasterize a pre-computed heights array (length === terrain.width) into the bitmap.
 * heights[x] is the topmost solid y for column x (as returned by legacy generators).
 *
 * @param {Terrain} terrain
 * @param {number[]} heights     length === terrain.width
 * @param {function} colorFn    (x, y) => [r, g, b, a]
 */
export function rasterizeHeightmap(terrain, heights, colorFn) {
  for (let x = 0; x < terrain.width; x++) {
    paintColumn(terrain, x, heights[x], colorFn);
  }
}

/**
 * High-level adapter: rasterize legacy theme heights into the bitmap terrain.
 *
 * @param {Terrain} terrain
 * @param {object} opts
 * @param {object} opts.theme          theme descriptor object
 * @param {number[]} opts.heights      legacy height array from generateTerrain()
 * @param {function} opts.colorFn     (x, y) => [r, g, b, a]
 */
export function generateFromTheme(terrain, { heights, colorFn }) {
  rasterizeHeightmap(terrain, heights, colorFn);
}

// ─── Mask blit ────────────────────────────────────────────────────────────────

/**
 * Clear solid pixels inside a mask, centered at (mx, my).
 * Updates surface cache for each affected column.
 * Returns a dirty rect {x, y, w, h} or null if nothing changed.
 *
 * @param {Terrain} terrain
 * @param {CraterMask} mask   { w, h, ox, oy, data: Uint8Array }
 * @param {number} mx   center x (integer)
 * @param {number} my   center y (integer)
 * @returns {{ x: number, y: number, w: number, h: number } | null}
 */
export function applyMaskAt(terrain, mask, mx, my) {
  const { width, height, solid, colorBuf, surface } = terrain;
  const { w, h, ox, oy, data } = mask;

  const startX = mx - ox;
  const startY = my - oy;

  let changed = false;
  let minX = width, maxX = -1, minY = height, maxY = -1;

  for (let row = 0; row < h; row++) {
    const worldY = startY + row;
    if (worldY < 0 || worldY >= height) continue;
    for (let col = 0; col < w; col++) {
      if (data[row * w + col] !== 1) continue;
      const worldX = startX + col;
      if (worldX < 0 || worldX >= width) continue;
      const idx = worldY * width + worldX;
      if (solid[idx] === 0) continue;
      solid[idx] = 0;
      const ci = idx * 4;
      colorBuf[ci] = 0;
      colorBuf[ci + 1] = 0;
      colorBuf[ci + 2] = 0;
      colorBuf[ci + 3] = 0;
      changed = true;
      if (worldX < minX) minX = worldX;
      if (worldX > maxX) maxX = worldX;
      if (worldY < minY) minY = worldY;
      if (worldY > maxY) maxY = worldY;
    }
  }

  if (!changed) return null;

  // Recompute surface for each column that had pixels cleared
  for (let x = minX; x <= maxX; x++) {
    recomputeSurfaceColumn(terrain, x);
  }

  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ─── Sandfall ─────────────────────────────────────────────────────────────────

/**
 * Collapse floating earth in column x.
 * Scans the entire column from top (surface[x]) to collect all solid pixels,
 * then compacts them at the bottom — no floating segments remain.
 * Integer-only — deterministic.
 *
 * @param {Terrain} terrain
 * @param {number} x      integer column
 * @param {number} fromY  hint: start scanning from this row (may be above surface)
 */
export function sandfallColumn(terrain, x, fromY) {
  const { width, height, solid, colorBuf, surface } = terrain;

  // Start from the topmost solid pixel (or fromY if higher) to catch floaters
  // that live above the cleared region.
  const scanStart = Math.max(0, Math.min(surface[x], Math.max(0, fromY)));

  // Collect (rgba) of all solid pixels in [scanStart .. height-1] in top-to-bottom order
  const pixels = [];
  for (let y = scanStart; y < height; y++) {
    const idx = y * width + x;
    if (solid[idx] === 1) {
      const ci = idx * 4;
      pixels.push([colorBuf[ci], colorBuf[ci + 1], colorBuf[ci + 2], colorBuf[ci + 3]]);
    }
  }

  if (pixels.length === 0) {
    // Nothing to compact; update surface if scanStart changed anything
    recomputeSurfaceColumn(terrain, x);
    return;
  }

  // Clear the entire range [scanStart .. height-1]
  for (let y = scanStart; y < height; y++) {
    const idx = y * width + x;
    solid[idx] = 0;
    const ci = idx * 4;
    colorBuf[ci] = 0;
    colorBuf[ci + 1] = 0;
    colorBuf[ci + 2] = 0;
    colorBuf[ci + 3] = 0;
  }

  // Paint pixels back compacted at the bottom — preserving top-to-bottom colour order
  const bottom = height - 1;
  for (let i = 0; i < pixels.length; i++) {
    const destY = bottom - (pixels.length - 1 - i);
    if (destY < scanStart) break; // guard (shouldn't trigger)
    const idx = destY * width + x;
    solid[idx] = 1;
    const ci = idx * 4;
    colorBuf[ci] = pixels[i][0];
    colorBuf[ci + 1] = pixels[i][1];
    colorBuf[ci + 2] = pixels[i][2];
    colorBuf[ci + 3] = pixels[i][3];
  }

  recomputeSurfaceColumn(terrain, x);
}

// ─── Crater ───────────────────────────────────────────────────────────────────

/**
 * Apply a crater: blit the mask, then run sandfall for each column.
 *
 * @param {Terrain} terrain
 * @param {object} opts
 * @param {number} opts.cx      center x (integer)
 * @param {number} opts.cy      center y (integer)
 * @param {CraterMask} opts.shape  mask object from craterMasks.js
 * @returns {{ x: number, y: number, w: number, h: number } | null}  dirty rect
 */
export function applyCrater(terrain, { cx, cy, shape }) {
  const dirtyRect = applyMaskAt(terrain, shape, cx, cy);
  if (!dirtyRect) return null;

  const { ox } = shape;
  const startX = Math.max(0, cx - ox);
  const endX = Math.min(terrain.width - 1, cx - ox + shape.w - 1);
  const fromY = dirtyRect.y;

  for (let x = startX; x <= endX; x++) {
    sandfallColumn(terrain, x, fromY);
  }

  // Re-expand dirty rect to include sandfall destination
  return unionRect(dirtyRect, {
    x: startX,
    y: fromY,
    w: endX - startX + 1,
    h: terrain.height - fromY,
  });
}

// ─── Rect utilities ───────────────────────────────────────────────────────────

/**
 * Return the union of two dirty rects. Either may be null.
 * @param {{ x, y, w, h } | null} a
 * @param {{ x, y, w, h } | null} b
 * @returns {{ x, y, w, h } | null}
 */
export function unionRect(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Compare a snapshot of surface values against current and return the dirty rect
 * covering only columns that changed. Returns null if nothing changed.
 *
 * @param {Int16Array} prevSurface  clone of terrain.surface before the operation
 * @param {Terrain} terrain
 * @returns {{ x, y, w, h } | null}
 */
export function getDirtyRect(prevSurface, terrain) {
  const { width, height, surface } = terrain;
  let minX = width, maxX = -1, minY = height;

  for (let x = 0; x < width; x++) {
    if (surface[x] !== prevSurface[x]) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      const top = Math.min(surface[x], prevSurface[x]);
      if (top < minY) minY = top;
    }
  }

  if (maxX === -1) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: height - minY };
}

// ─── Theme color sampler ──────────────────────────────────────────────────────

/**
 * Parse a 6-digit hex color string to [r, g, b].
 * @param {string} hex  e.g. "#aa7a4b"
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * Deterministic 3-bit per-pixel luminance jitter in range [-4, +4].
 * Uses a fast integer hash of (x, y) — no RNG object needed.
 * @param {number} x
 * @param {number} y
 * @returns {number}  integer in [-4, 4]
 */
function pixelNoise(x, y) {
  let h = Math.imul(x ^ 0x9e3779b9, y ^ 0x6b43a9b5);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 15;
  // Map 3 bits to [-4, 4] via (bits/7)*8 - 4
  const bits = (h >>> 0) & 0x7; // 0..7
  return Math.round((bits / 7) * 8 - 4);
}

/**
 * Return the RGBA color for a terrain pixel at (x, y).
 *
 * @param {object} theme       theme descriptor with .ground and .groundGlow hex fields
 * @param {number} x
 * @param {number} y
 * @param {number} worldHeight  total height of the terrain bitmap
 * @returns {[number, number, number, number]}  [r, g, b, 255]
 */
export function colorForTheme(theme, x, y, worldHeight) {
  const top = hexToRgb(theme.groundGlow ?? theme.ground ?? "#888888");
  const bot = hexToRgb(theme.ground ?? "#555555");

  // Blend 0 at surface-ish depth, 1 near bottom
  const t = Math.min(1, Math.max(0, y / worldHeight));

  const noise = pixelNoise(x, y);

  const r = Math.round(top[0] + (bot[0] - top[0]) * t) + noise;
  const g = Math.round(top[1] + (bot[1] - top[1]) * t) + noise;
  const b = Math.round(top[2] + (bot[2] - top[2]) * t) + noise;

  return [
    Math.max(0, Math.min(255, r)),
    Math.max(0, Math.min(255, g)),
    Math.max(0, Math.min(255, b)),
    255,
  ];
}
