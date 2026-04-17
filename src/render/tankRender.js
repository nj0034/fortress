/**
 * tankRender.js — SVG tank template loader and canvas renderer.
 *
 * Pure helpers (applyTeamColor, mixColors, cache key builders) are
 * unit-tested in Node. Full browser rasterization (DOMParser, Image,
 * Blob, OffscreenCanvas) is browser-only and verified by manual smoke test.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TANK_IDS = [
  "armor",
  "bigpo",
  "slingshot",
  "dike",
  "turtle",
  "mage",
  "tricot",
  "acannon",
  "lightning",
  "ice",
];

/**
 * Team color palettes.  Each entry has primary and secondary hex strings.
 */
export const TEAM_COLORS = [
  { name: "Red",    primary: "#e03030", secondary: "#801818" },
  { name: "Blue",   primary: "#3060e0", secondary: "#183080" },
  { name: "Green",  primary: "#30c040", secondary: "#186020" },
  { name: "Yellow", primary: "#e0c030", secondary: "#807018" },
];

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested in Node)
// ---------------------------------------------------------------------------

/**
 * Replace fill attributes on elements carrying class="team-primary" or
 * class="team-secondary" (handles both attribute orderings).
 *
 * @param {string} svgString  Raw SVG markup
 * @param {string} primary    Hex color for team-primary elements
 * @param {string} secondary  Hex color for team-secondary elements
 * @returns {string}
 */
export function applyTeamColor(svgString, primary, secondary) {
  return svgString
    // class comes before fill
    .replace(/(<[^>]*class="[^"]*\bteam-primary\b[^"]*"[^>]*?)fill="[^"]*"/g, `$1fill="${primary}"`)
    // fill comes before class
    .replace(/(<[^>]*?)fill="[^"]*"([^>]*class="[^"]*\bteam-primary\b)/g, `$1fill="${primary}"$2`)
    // class comes before fill
    .replace(/(<[^>]*class="[^"]*\bteam-secondary\b[^"]*"[^>]*?)fill="[^"]*"/g, `$1fill="${secondary}"`)
    // fill comes before class
    .replace(/(<[^>]*?)fill="[^"]*"([^>]*class="[^"]*\bteam-secondary\b)/g, `$1fill="${secondary}"$2`);
}

/**
 * Linearly interpolate between two hex colors.
 *
 * @param {string} a  Hex color (3 or 6 digits, with leading #)
 * @param {string} b  Hex color (3 or 6 digits, with leading #)
 * @param {number} t  Blend factor 0→a, 1→b
 * @returns {string}  6-digit hex color
 */
export function mixColors(a, b, t) {
  const expand = (hex) => {
    const h = hex.replace("#", "");
    if (h.length === 3) {
      return [
        parseInt(h[0] + h[0], 16),
        parseInt(h[1] + h[1], 16),
        parseInt(h[2] + h[2], 16),
      ];
    }
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = expand(a);
  const [br, bg, bb] = expand(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return "#" + [r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Stable cache key for (tankId, teamName) pairs.
 *
 * @param {string} tankId
 * @param {string} teamName
 * @returns {string}
 */
export function tankCacheKey(tankId, teamName) {
  return `${tankId}::${teamName}`;
}

/**
 * Resolve the team color for a player given match context.
 *
 * FFA / survival (match.teams empty or absent):
 *   color = TEAM_COLORS[joinIndex % 4]  (each player gets unique color by join order)
 *
 * Team modes (match.teams populated):
 *   color = TEAM_COLORS[teamIndex]  (0 = red, 1 = blue)
 *
 * @param {object|null} match       - match state from createMatch, or null for FFA legacy
 * @param {string}      playerId    - player id
 * @param {number}      joinIndex   - 0-based index in the player join order
 * @returns {{ name: string, primary: string, secondary: string }}
 */
export function resolveTeamColor(match, playerId, joinIndex) {
  if (match && match.teams && Object.keys(match.teams).length > 0) {
    const teamIndex = match.teams[playerId] ?? 0;
    return TEAM_COLORS[teamIndex % TEAM_COLORS.length];
  }
  return TEAM_COLORS[(joinIndex ?? 0) % TEAM_COLORS.length];
}

/**
 * Resolve the actual fill colors for a tank, using tank.visual.primaryColor in FFA
 * and blending with team palette in team mode.
 *
 * @param {object|null} match       - match state from createMatch, or null for FFA
 * @param {object}      tank        - tank definition from TANK_TYPES
 * @param {string}      playerId    - player id
 * @param {number}      joinIndex   - 0-based index in the player join order
 * @returns {{ name: string, primary: string, secondary: string }}
 */
export function resolveTankFill(match, tank, playerId, joinIndex) {
  const tankPrimary = tank?.visual?.primaryColor ?? "#ffb84f";
  const tankSecondary = tank?.visual?.secondaryColor ?? "#7a4a16";
  if (match && match.teams && Object.keys(match.teams).length > 0) {
    const teamIndex = match.teams[playerId] ?? 0;
    const team = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
    return {
      name: `${team.name}:${tankPrimary}`,
      primary: mixColors(tankPrimary, team.primary, 0.4),
      secondary: mixColors(tankSecondary, team.secondary, 0.4),
    };
  }
  return {
    name: `ffa:${tankPrimary}`,
    primary: tankPrimary,
    secondary: tankSecondary,
  };
}

/**
 * Recoil curve: piecewise — 0→0.4 ramps 0→1, 0.4→1.0 eases 1→0.
 *
 * @param {number} phase  Value in [0, 1]
 * @returns {number}      Offset multiplier in [0, 1]
 */
export function recoilCurve(phase) {
  if (phase <= 0) return 0;
  if (phase >= 1) return 0;
  if (phase <= 0.4) {
    return phase / 0.4;
  }
  // ease back: cosine interpolation from 1 → 0 over [0.4, 1.0]
  const t = (phase - 0.4) / 0.6;
  return (1 - t) * (1 - t);
}

// ---------------------------------------------------------------------------
// Browser-only: template cache and rasterization
// (Not tested under Node — require browser globals)
// ---------------------------------------------------------------------------

/** @type {Map<string, SVGSVGElement>} */
const _templateCache = new Map();

/** @type {Map<string, string>} */
const _blobUrlCache = new Map();

/** @type {Map<string, HTMLCanvasElement>} */
const _bitmapCache = new Map();

/**
 * Fetch and parse all 10 tank SVG templates.  Idempotent — subsequent calls
 * return cached results without re-fetching.
 *
 * @returns {Promise<Map<string, SVGSVGElement>>}
 */
export async function loadTankTemplates() {
  if (_templateCache.size === TANK_IDS.length) return _templateCache;

  const parser = new DOMParser();
  await Promise.all(
    TANK_IDS.map(async (id) => {
      if (_templateCache.has(id)) return;
      const res = await fetch(`src/assets/tanks/${id}.svg`);
      if (!res.ok) throw new Error(`Failed to fetch tank SVG: ${id} (${res.status})`);
      const text = await res.text();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.documentElement;
      _templateCache.set(id, svg);
    })
  );

  return _templateCache;
}

/**
 * Serialize a tank template with team colors applied and return a memoized
 * blob URL.
 *
 * @param {string} tankId
 * @param {{ name: string, primary: string, secondary: string }} team
 * @returns {string} blob URL
 */
export function getTankBlobUrl(tankId, team) {
  const key = tankCacheKey(tankId, team.name);
  if (_blobUrlCache.has(key)) return _blobUrlCache.get(key);

  const template = _templateCache.get(tankId);
  if (!template) throw new Error(`Tank template not loaded: ${tankId}`);

  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(template);
  svgString = applyTeamColor(svgString, team.primary, team.secondary);

  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  _blobUrlCache.set(key, url);
  return url;
}

/**
 * Rasterize a (tankId, team) combination into an offscreen canvas and
 * memoize it.
 *
 * @param {string} tankId
 * @param {{ name: string, primary: string, secondary: string }} team
 * @returns {Promise<HTMLCanvasElement>}
 */
export function preRasterize(tankId, team) {
  const key = tankCacheKey(tankId, team.name);
  if (_bitmapCache.has(key)) return Promise.resolve(_bitmapCache.get(key));

  return new Promise((resolve, reject) => {
    const url = getTankBlobUrl(tankId, team);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 140;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 200, 140);
      _bitmapCache.set(key, canvas);
      URL.revokeObjectURL(url);
      // replace blob url entry with a reusable data-url to avoid expired blob
      const dataUrl = canvas.toDataURL("image/png");
      _blobUrlCache.set(key, dataUrl);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error(`Failed to rasterize tank: ${tankId}`));
    img.src = url;
  });
}

/**
 * Render a tank to an existing 2D canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   tankId: string,
 *   x: number,
 *   y: number,
 *   angle?: number,
 *   teamColor: { name: string, primary: string, secondary: string },
 *   turretAngle?: number,
 *   shakeFrames?: number,
 *   recoilPhase?: number,
 *   tintFlash?: number,
 *   scale?: number,
 * }} opts
 */
export function renderTankToCanvas(ctx, opts) {
  const {
    tankId,
    x,
    y,
    angle = 0,
    teamColor,
    turretAngle = 0,
    shakeFrames = 0,
    recoilPhase = 0,
    tintFlash = 0,
    scale = 1,
  } = opts;

  // Accept both {name, primary, secondary} (old) and {primary, secondary} (new, no .name).
  // Normalize to always have a .name so cache key and bitmap lookup work correctly.
  const resolvedColor = teamColor && !teamColor.name
    ? { name: teamColor.primary, primary: teamColor.primary, secondary: teamColor.secondary }
    : teamColor;

  const key = tankCacheKey(tankId, resolvedColor.name);
  const bitmap = _bitmapCache.get(key);

  if (!bitmap) {
    // Placeholder rect while rasterization is in progress
    ctx.save();
    ctx.fillStyle = resolvedColor.primary + "88";
    ctx.fillRect(x - 20 * scale, y - 14 * scale, 40 * scale, 28 * scale);
    ctx.restore();
    // Kick off rasterization (fire-and-forget)
    preRasterize(tankId, resolvedColor).catch(() => {});
    return;
  }

  const shakeX = shakeFrames > 0 ? (Math.random() - 0.5) * 4 : 0;
  const shakeY = shakeFrames > 0 ? (Math.random() - 0.5) * 4 : 0;

  // SVG viewBox is 200×140, pivot at cx=100, cy=bottom of chassis
  const pivotX = 100;
  const pivotY = 120;
  const drawW = 200 * scale;
  const drawH = 140 * scale;

  ctx.save();
  ctx.translate(x + shakeX, y + shakeY);
  ctx.rotate(angle);
  ctx.drawImage(bitmap, -pivotX * scale, -pivotY * scale, drawW, drawH);

  // Damage tint flash: red overlay via source-atop
  if (tintFlash > 0) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = tintFlash * 0.55;
    ctx.fillStyle = "#ff2020";
    ctx.fillRect(-pivotX * scale, -pivotY * scale, drawW, drawH);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
