import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEMS, ITEMS_MAP, getItem } from "../../src/data/items.js";

const VALID_SLOTS = new Set(["instant", "turn", "persistent"]);
const EXPECTED_IDS = ["teleport", "double_shot", "ion_shield", "repair_kit", "gravity_reverse"];

test("ITEMS exports array of length 5", () => {
  assert.equal(ITEMS.length, 5);
});

test("each item has required fields with correct types", () => {
  for (const item of ITEMS) {
    assert.ok(typeof item.id === "string" && item.id.length > 0, `id missing or empty`);
    assert.ok(typeof item.name === "string" && item.name.length > 0, `${item.id}: name`);
    assert.ok(typeof item.description === "string" && item.description.length > 0, `${item.id}: description`);
    assert.ok(VALID_SLOTS.has(item.slot), `${item.id}: slot "${item.slot}" invalid`);
    assert.ok(typeof item.icon === "string" && item.icon.length > 0, `${item.id}: icon`);
    assert.ok(typeof item.applyEffect === "string" && item.applyEffect.length > 0, `${item.id}: applyEffect`);
  }
});

test("item ids are unique", () => {
  const ids = ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("exact expected ids are present", () => {
  const ids = new Set(ITEMS.map((i) => i.id));
  for (const expected of EXPECTED_IDS) {
    assert.ok(ids.has(expected), `Missing item id: ${expected}`);
  }
});

test("ITEMS_MAP has all 5 items keyed by id", () => {
  assert.equal(Object.keys(ITEMS_MAP).length, 5);
  for (const item of ITEMS) {
    assert.strictEqual(ITEMS_MAP[item.id], item);
  }
});

test("getItem returns correct item for known id", () => {
  for (const item of ITEMS) {
    const result = getItem(item.id);
    assert.strictEqual(result, item);
  }
});

test("getItem returns undefined for unknown id", () => {
  assert.equal(getItem("nonexistent"), undefined);
});

test("slots are correct per item", () => {
  assert.equal(getItem("teleport").slot, "instant");
  assert.equal(getItem("double_shot").slot, "turn");
  assert.equal(getItem("ion_shield").slot, "persistent");
  assert.equal(getItem("repair_kit").slot, "instant");
  assert.equal(getItem("gravity_reverse").slot, "turn");
});
