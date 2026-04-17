import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInventoryView } from "../../src/render/itemsRender.js";

// View-model smoke tests for inventory strip
// (DOM rendering is browser-only; these tests verify the view-model contract)

test("buildInventoryView smoke: 3 slots always returned", () => {
  for (const inv of [[], ["repair_kit"], ["repair_kit", "ion_shield", "teleport"]]) {
    const view = buildInventoryView({ inventory: inv });
    assert.equal(view.length, 3, `inventory length ${inv.length} → should still give 3 slots`);
  }
});

test("buildInventoryView smoke: slot keys are Q, W, E", () => {
  const view = buildInventoryView({ inventory: ["double_shot", "gravity_reverse"] });
  assert.equal(view[0].slotKey, "Q");
  assert.equal(view[1].slotKey, "W");
  assert.equal(view[2].slotKey, "E");
});

test("buildInventoryView smoke: full inventory fills all 3 slots", () => {
  const inv = ["teleport", "ion_shield", "repair_kit"];
  const view = buildInventoryView({ inventory: inv });
  assert.equal(view[0].itemId, "teleport");
  assert.equal(view[1].itemId, "ion_shield");
  assert.equal(view[2].itemId, "repair_kit");
  for (const slot of view) {
    assert.ok(slot.icon !== null, `slot ${slot.slotKey} icon should be non-null`);
    assert.ok(slot.label !== null, `slot ${slot.slotKey} label should be non-null`);
  }
});

test("buildInventoryView smoke: partial inventory leaves trailing slots null", () => {
  const view = buildInventoryView({ inventory: ["double_shot"] });
  assert.equal(view[0].itemId, "double_shot");
  assert.equal(view[1].itemId, null);
  assert.equal(view[2].itemId, null);
});

test("buildInventoryView smoke: null player gives 3 empty slots", () => {
  const view = buildInventoryView(null);
  for (const slot of view) {
    assert.equal(slot.itemId, null);
    assert.equal(slot.icon, null);
    assert.equal(slot.label, null);
  }
});
