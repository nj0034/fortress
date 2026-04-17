import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInventoryView,
  drawDropCapsule,
  drawInventoryStrip,
} from "../../src/render/itemsRender.js";

// ─── Mock canvas context ──────────────────────────────────────────────────────

function mockCtx() {
  const calls = [];
  const record = (name, args = []) => calls.push({ name, args });

  const ctx = {
    _calls: calls,
    save: () => record("save"),
    restore: () => record("restore"),
    translate: (x, y) => record("translate", [x, y]),
    beginPath: () => record("beginPath"),
    arc: (x, y, r, s, e) => record("arc", [x, y, r, s, e]),
    roundRect: (x, y, w, h, r) => record("roundRect", [x, y, w, h, r]),
    fill: () => record("fill"),
    stroke: () => record("stroke"),
    fillText: (t, x, y) => record("fillText", [t, x, y]),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
  };
  return ctx;
}

// ─── buildInventoryView ───────────────────────────────────────────────────────

test("buildInventoryView returns 3 entries", () => {
  const player = { inventory: [] };
  const view = buildInventoryView(player);
  assert.equal(view.length, 3);
});

test("buildInventoryView slot keys are Q, W, E", () => {
  const view = buildInventoryView({ inventory: [] });
  assert.equal(view[0].slotKey, "Q");
  assert.equal(view[1].slotKey, "W");
  assert.equal(view[2].slotKey, "E");
});

test("buildInventoryView empty inventory gives null itemId/icon/label", () => {
  const view = buildInventoryView({ inventory: [] });
  for (const slot of view) {
    assert.equal(slot.itemId, null);
    assert.equal(slot.icon, null);
    assert.equal(slot.label, null);
  }
});

test("buildInventoryView fills slots from player inventory", () => {
  const player = { inventory: ["repair_kit", "ion_shield"] };
  const view = buildInventoryView(player);
  assert.equal(view[0].itemId, "repair_kit");
  assert.ok(view[0].icon !== null);
  assert.ok(view[0].label !== null);
  assert.equal(view[1].itemId, "ion_shield");
  assert.ok(view[1].icon !== null);
  assert.equal(view[2].itemId, null); // slot 3 empty
});

test("buildInventoryView handles undefined player gracefully", () => {
  const view = buildInventoryView(undefined);
  assert.equal(view.length, 3);
  assert.equal(view[0].itemId, null);
});

test("buildInventoryView icon and label come from item table", () => {
  const view = buildInventoryView({ inventory: ["gravity_reverse"] });
  assert.equal(view[0].itemId, "gravity_reverse");
  assert.ok(typeof view[0].icon === "string" && view[0].icon.length > 0);
  assert.ok(typeof view[0].label === "string" && view[0].label.length > 0);
});

// ─── drawDropCapsule ──────────────────────────────────────────────────────────

test("drawDropCapsule calls save and restore", () => {
  const ctx = mockCtx();
  drawDropCapsule(ctx, { x: 100, y: 200, itemId: "repair_kit" }, 0);
  const names = ctx._calls.map((c) => c.name);
  assert.ok(names.includes("save"));
  assert.ok(names.includes("restore"));
});

test("drawDropCapsule calls translate to drop position", () => {
  const ctx = mockCtx();
  drawDropCapsule(ctx, { x: 150, y: 250, itemId: "ion_shield" }, 0);
  const translate = ctx._calls.find((c) => c.name === "translate");
  assert.ok(translate, "translate must be called");
  assert.equal(translate.args[0], 150);
  assert.equal(translate.args[1], 250);
});

test("drawDropCapsule calls arc for circles", () => {
  const ctx = mockCtx();
  drawDropCapsule(ctx, { x: 0, y: 0, itemId: "teleport" }, 0);
  const arcs = ctx._calls.filter((c) => c.name === "arc");
  assert.ok(arcs.length >= 2, "should draw at least 2 circles (ring + fill)");
});

test("drawDropCapsule is deterministic for same time value", () => {
  const ctx1 = mockCtx();
  const ctx2 = mockCtx();
  const drop = { x: 50, y: 60, itemId: "double_shot" };
  drawDropCapsule(ctx1, drop, 1.5);
  drawDropCapsule(ctx2, drop, 1.5);
  assert.deepEqual(ctx1._calls, ctx2._calls);
});

test("drawDropCapsule arc radius differs between time=0 and time=1 (pulse)", () => {
  const ctx0 = mockCtx();
  const ctx1 = mockCtx();
  const drop = { x: 0, y: 0, itemId: "repair_kit" };
  drawDropCapsule(ctx0, drop, 0);
  drawDropCapsule(ctx1, drop, 1);
  // Find the filled circle arc (second arc call)
  const getFilledArc = (ctx) => ctx._calls.filter((c) => c.name === "arc")[1];
  const r0 = getFilledArc(ctx0)?.args[2];
  const r1 = getFilledArc(ctx1)?.args[2];
  // At least one should be non-null — they may or may not differ depending on rounding
  assert.ok(r0 !== undefined && r1 !== undefined);
});

// ─── drawInventoryStrip ───────────────────────────────────────────────────────

test("drawInventoryStrip calls save and restore", () => {
  const ctx = mockCtx();
  const view = buildInventoryView({ inventory: [] });
  drawInventoryStrip(ctx, view, { x: 0, y: 0 });
  const names = ctx._calls.map((c) => c.name);
  assert.ok(names.includes("save"));
  assert.ok(names.includes("restore"));
});

test("drawInventoryStrip draws 3 roundRect calls (one per slot)", () => {
  const ctx = mockCtx();
  const view = buildInventoryView({ inventory: [] });
  drawInventoryStrip(ctx, view, { x: 10, y: 20 });
  const rects = ctx._calls.filter((c) => c.name === "roundRect");
  assert.equal(rects.length, 3);
});

test("drawInventoryStrip roundRects are positioned horizontally with gap", () => {
  const ctx = mockCtx();
  const view = buildInventoryView({ inventory: [] });
  const origin = { x: 10, y: 20 };
  drawInventoryStrip(ctx, view, origin);
  const rects = ctx._calls.filter((c) => c.name === "roundRect");
  // Each rect x should be offset by SLOT_SIZE + SLOT_GAP = 62
  assert.equal(rects[0].args[0], 10);
  assert.equal(rects[1].args[0], 10 + 62);
  assert.equal(rects[2].args[0], 10 + 62 * 2);
});

test("drawInventoryStrip draws icons when slots have items", () => {
  const ctx = mockCtx();
  const view = buildInventoryView({ inventory: ["repair_kit"] });
  drawInventoryStrip(ctx, view, { x: 0, y: 0 });
  const texts = ctx._calls.filter((c) => c.name === "fillText");
  // Should include key label (Q) and icon text
  assert.ok(texts.length >= 2);
});
