/**
 * Floating damage text — Plan I §3.
 * Pure helpers + canvas draw function.
 */

/**
 * Compute alpha for a float text entry.
 * Full opacity for first 2/3 of life, linear fade last 1/3.
 */
export function floatTextAlpha(life, maxLife) {
  const fadeStart = maxLife * (2 / 3);
  if (life >= fadeStart) return 1;
  return life / fadeStart;
}

/**
 * Advance one float text entry by dt frames.
 * Returns null when expired.
 *
 * @param {{ x:number, y:number, vy:number, life:number, maxLife:number, text:string, color:string, size:number }} entry
 * @param {number} dt  frames elapsed
 * @returns {object|null}
 */
export function advanceFloatText(entry, dt) {
  const life = entry.life - dt;
  if (life <= 0) return null;
  return { ...entry, y: entry.y + entry.vy * dt, life };
}

/**
 * Spawn a new float text into game.floatTexts.
 *
 * @param {object} game  - must have .floatTexts array
 * @param {{ x:number, y:number, text:string, color:string, size?:number }} opts
 */
export function spawnFloatText(game, { x, y, text, color, size = 18 }) {
  if (!Array.isArray(game.floatTexts)) return;
  const maxLife = 36;
  game.floatTexts.push({
    x,
    y,
    vy: -1.4,
    life: maxLife,
    maxLife,
    text,
    color,
    size,
  });
}

/**
 * Advance all float texts and draw live ones onto ctx.
 * Expired entries are removed from game.floatTexts in-place.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} game  - has .floatTexts array
 */
export function drawFloatTexts(ctx, game) {
  if (!Array.isArray(game.floatTexts) || game.floatTexts.length === 0) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const next = [];
  for (const entry of game.floatTexts) {
    const advanced = advanceFloatText(entry, 1);
    if (!advanced) continue;
    next.push(advanced);

    const alpha = floatTextAlpha(advanced.life, advanced.maxLife);
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${advanced.size}px sans-serif`;

    // Drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(advanced.text, advanced.x + 1, advanced.y + 1);

    ctx.fillStyle = advanced.color;
    ctx.fillText(advanced.text, advanced.x, advanced.y);
  }

  ctx.restore();
  game.floatTexts = next;
}
