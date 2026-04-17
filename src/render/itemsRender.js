/**
 * Item rendering helpers — Plan G §8.
 *
 * Exports:
 *   buildInventoryView(player) → [{ slotKey, itemId|null, icon|null, label|null }, ...]
 *   drawDropCapsule(ctx, drop, time) → void
 *   drawInventoryStrip(ctx, view, origin) → void
 */

import { getItem } from "../data/items.js";

const SLOT_KEYS = ["Q", "W", "E"];
const SLOT_SIZE = 56;
const SLOT_GAP = 6;
const CAPSULE_RADIUS = 12;
const CAPSULE_PULSE_SPEED = 2; // radians per second

// ─── buildInventoryView ───────────────────────────────────────────────────────

/**
 * Build a 3-entry view-model for the inventory strip.
 * @param {object} player  with inventory: string[]
 * @returns {Array<{ slotKey: string, itemId: string|null, icon: string|null, label: string|null }>}
 */
export function buildInventoryView(player) {
  const inv = player?.inventory ?? [];
  return SLOT_KEYS.map((key, i) => {
    const itemId = inv[i] ?? null;
    const item = itemId ? getItem(itemId) : null;
    return {
      slotKey: key,
      itemId,
      icon: item?.icon ?? null,
      label: item?.name ?? null,
    };
  });
}

// ─── drawDropCapsule ──────────────────────────────────────────────────────────

/**
 * Draw a pulsing capsule icon for a pending drop on the battlefield canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, itemId: string }} drop
 * @param {number} time  elapsed seconds (for pulse animation)
 */
export function drawDropCapsule(ctx, drop, time) {
  const pulse = 0.15 * Math.sin(time * CAPSULE_PULSE_SPEED) + 0.85; // [0.7, 1.0]
  const r = Math.round(CAPSULE_RADIUS * pulse);
  const item = getItem(drop.itemId);

  ctx.save();
  ctx.translate(Math.round(drop.x), Math.round(drop.y));

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,180,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Filled capsule
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(40,40,80,0.85)";
  ctx.fill();
  ctx.strokeStyle = "rgba(180,180,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Icon text
  if (item?.icon) {
    ctx.font = `${Math.round(r * 0.9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.icon, 0, 1);
  }

  ctx.restore();
}

// ─── drawInventoryStrip ───────────────────────────────────────────────────────

/**
 * Draw the 3-slot inventory strip onto the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} view  from buildInventoryView()
 * @param {{ x: number, y: number }} origin  top-left corner
 */
export function drawInventoryStrip(ctx, view, origin) {
  const { x: ox, y: oy } = origin;
  ctx.save();

  for (let i = 0; i < 3; i++) {
    const slot = view[i];
    const sx = ox + i * (SLOT_SIZE + SLOT_GAP);
    const sy = oy;

    // Slot background
    ctx.beginPath();
    ctx.roundRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 6);
    if (slot.itemId) {
      ctx.fillStyle = "rgba(20,20,50,0.9)";
    } else {
      ctx.fillStyle = "rgba(10,10,30,0.5)";
    }
    ctx.fill();
    ctx.strokeStyle = slot.itemId ? "rgba(180,180,255,0.8)" : "rgba(80,80,120,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Key label (Q/W/E)
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(200,200,200,0.8)";
    ctx.fillText(slot.slotKey, sx + 4, sy + 4);

    // Icon
    if (slot.icon) {
      ctx.font = "22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(slot.icon, sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2 - 4);
    }

    // Item label below icon
    if (slot.label) {
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(220,220,255,0.9)";
      ctx.fillText(slot.label, sx + SLOT_SIZE / 2, sy + SLOT_SIZE - 4);
    }
  }

  ctx.restore();
}
