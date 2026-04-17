/**
 * Crater mask templates with LRU cache.
 *
 * Each mask: { w, h, ox, oy, data: Uint8Array }
 *   w, h   pixel dimensions of the bounding box
 *   ox, oy offset from the top-left corner to the logical center
 *   data   row-major, data[row*w+col] === 1 means "clear this pixel"
 *
 * All shapes are computed with integer arithmetic only.
 * Repeated calls with identical arguments return the same cached object reference.
 */

// ─── LRU Cache ────────────────────────────────────────────────────────────────

const LRU_MAX = 64;
/** @type {Map<string, object>} */
const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const val = cache.get(key);
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, val);
  return val;
}

function cacheSet(key, val) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, val);
  if (cache.size > LRU_MAX) {
    // Evict least recently used (first entry)
    cache.delete(cache.keys().next().value);
  }
}

/** Exposed for testing only. */
export function _cacheSize() { return cache.size; }
export function _cacheClear() { cache.clear(); }

// ─── Shape generators ─────────────────────────────────────────────────────────

/**
 * Filled circle mask.
 * @param {number} radius  integer radius in pixels
 * @returns {CraterMask}
 */
export function circle(radius) {
  const r = Math.round(radius);
  const key = `circle:${r}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const side = r * 2 + 1;
  const data = new Uint8Array(side * side);
  const r2 = r * r;

  for (let row = 0; row < side; row++) {
    const dy = row - r;
    for (let col = 0; col < side; col++) {
      const dx = col - r;
      if (dx * dx + dy * dy <= r2) {
        data[row * side + col] = 1;
      }
    }
  }

  const mask = { w: side, h: side, ox: r, oy: r, data };
  cacheSet(key, mask);
  return mask;
}

/**
 * Filled axis-aligned ellipse mask.
 * @param {number} rx  integer horizontal radius
 * @param {number} ry  integer vertical radius
 * @returns {CraterMask}
 */
export function ellipse(rx, ry) {
  const rxr = Math.round(rx);
  const ryr = Math.round(ry);
  const key = `ellipse:${rxr}:${ryr}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const w = rxr * 2 + 1;
  const h = ryr * 2 + 1;
  const data = new Uint8Array(w * h);

  for (let row = 0; row < h; row++) {
    const dy = row - ryr;
    for (let col = 0; col < w; col++) {
      const dx = col - rxr;
      // Scaled Bresenham: (dx/rx)^2 + (dy/ry)^2 <= 1  → dx^2 * ry^2 + dy^2 * rx^2 <= rx^2 * ry^2
      if (dx * dx * ryr * ryr + dy * dy * rxr * rxr <= rxr * rxr * ryr * ryr) {
        data[row * w + col] = 1;
      }
    }
  }

  const mask = { w, h, ox: rxr, oy: ryr, data };
  cacheSet(key, mask);
  return mask;
}

/**
 * Vertical tunnel mask — a tall narrow rectangle.
 * @param {number} width   integer half-width (full width = width*2+1)
 * @param {number} depth   integer full depth in pixels (height)
 * @returns {CraterMask}
 */
export function verticalTunnel(width, depth) {
  const hw = Math.round(width);
  const d = Math.round(depth);
  const key = `vtunnel:${hw}:${d}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const w = hw * 2 + 1;
  const h = d;
  const data = new Uint8Array(w * h).fill(1);

  const mask = { w, h, ox: hw, oy: 0, data };
  cacheSet(key, mask);
  return mask;
}

/**
 * Horizontal burst mask — a wide shallow ellipse, wider than tall.
 * @param {number} length  integer half-length (horizontal radius)
 * @param {number} height  integer half-height (vertical radius)
 * @returns {CraterMask}
 */
export function horizontalBurst(length, height) {
  // Delegate to ellipse for consistency
  return ellipse(Math.round(length), Math.round(height));
}
