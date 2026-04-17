/**
 * Status effect icon rendering (Plan F §Task 10).
 * resolveIconList is pure — safe for Node tests.
 * drawStatusIcons accepts an injected ctx for testability.
 */

const ICON_REGISTRY = {
  frozen: { glyph: "❄", color: "#8fd7ff" },
};

/**
 * Convert an array of status entries to renderable icon descriptors.
 *
 * @param {{ type: string, delayBonus: number }[]} statuses
 * @returns {{ glyph: string, label: string, color: string }[]}
 */
export function resolveIconList(statuses) {
  if (!statuses || statuses.length === 0) return [];
  const result = [];
  for (const s of statuses) {
    const def = ICON_REGISTRY[s.type];
    if (!def) continue;
    result.push({
      glyph: def.glyph,
      label: `+${s.delayBonus}`,
      color: def.color,
    });
  }
  return result;
}

/**
 * Draw status effect icons on the battle canvas above a player.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} player  - world-space coords (pre-scaled by caller)
 * @param {{ type: string, delayBonus: number }[]} statuses
 */
export function drawStatusIcons(ctx, player, statuses) {
  const icons = resolveIconList(statuses);
  if (icons.length === 0) return;

  const iconSize = 16;
  const spacing = iconSize + 4;
  const totalWidth = icons.length * spacing - 4;
  let startX = player.x - totalWidth / 2;
  const iconY = player.y - 48;

  for (const icon of icons) {
    const cx = startX + iconSize / 2;

    // Background rounded rect
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    const r = 4;
    const x = cx - iconSize / 2;
    const y = iconY - iconSize / 2;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + iconSize - r, y);
    ctx.arcTo(x + iconSize, y, x + iconSize, y + r, r);
    ctx.lineTo(x + iconSize, y + iconSize - r);
    ctx.arcTo(x + iconSize, y + iconSize, x + iconSize - r, y + iconSize, r);
    ctx.lineTo(x + r, y + iconSize);
    ctx.arcTo(x, y + iconSize, x, y + iconSize - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();

    // Glyph
    ctx.fillStyle = icon.color;
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon.glyph, cx, iconY);

    // Label below icon
    ctx.fillStyle = "#ffe58a";
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(icon.label, cx, iconY + iconSize - 2);

    ctx.restore();
    startX += spacing;
  }
}
