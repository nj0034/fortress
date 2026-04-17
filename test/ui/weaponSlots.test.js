import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWeaponSlotsView, selectedWeaponReducer } from "../../src/ui/weaponSlots.js";

// Minimal tank type stub
const ARMOR_TANK = {
  id: "armor",
  weapons: { ss1: "armor_ss1", ss2: "armor_ss2", new: "armor_new" },
};

// Minimal weapons stub
const WEAPONS_STUB = {
  armor_ss1: { name: "철갑탄", damage: 45, delayMultiplier: 1.0 },
  armor_ss2: { name: "고폭탄", damage: 60, delayMultiplier: 1.3 },
  armor_new: { name: "동결탄", damage: 30, delayMultiplier: 1.8 },
};

function makePlayer(overrides = {}) {
  return {
    tankType: "armor",
    tankTypeDef: ARMOR_TANK,
    weapons: WEAPONS_STUB,
    selectedWeapon: "ss1",
    newUsesRemaining: 2,
    isCurrentTurn: true,
    ...overrides,
  };
}

describe("buildWeaponSlotsView", () => {
  it("returns 3 slots with ss1 active when selectedWeapon is ss1", () => {
    const view = buildWeaponSlotsView(makePlayer({ selectedWeapon: "ss1" }));
    assert.equal(view.slots.length, 3);
    assert.equal(view.activeSlot, "ss1");
    assert.equal(view.slots.find((s) => s.id === "ss1").active, true);
    assert.equal(view.slots.find((s) => s.id === "ss2").active, false);
    assert.equal(view.slots.find((s) => s.id === "new").active, false);
  });

  it("NEW slot disabled when newUsesRemaining === 0", () => {
    const view = buildWeaponSlotsView(makePlayer({ newUsesRemaining: 0 }));
    assert.equal(view.slots.find((s) => s.id === "new").disabled, true);
    assert.equal(view.slots.find((s) => s.id === "ss1").disabled, false);
  });

  it("all slots disabled when isCurrentTurn === false", () => {
    const view = buildWeaponSlotsView(makePlayer({ isCurrentTurn: false }));
    assert.ok(view.slots.every((s) => s.disabled === true));
  });

  it("includes label and subLabel for each slot", () => {
    const view = buildWeaponSlotsView(makePlayer());
    const ss1 = view.slots.find((s) => s.id === "ss1");
    assert.ok(typeof ss1.label === "string" && ss1.label.length > 0);
    assert.ok(typeof ss1.subLabel === "string");
  });

  it("tooltip includes weapon name for ss1 slot", () => {
    const view = buildWeaponSlotsView(makePlayer());
    const ss1 = view.slots.find((s) => s.id === "ss1");
    assert.ok(ss1.tooltip.includes("철갑탄"));
  });

  it("new slot label shows remaining count", () => {
    const view = buildWeaponSlotsView(makePlayer({ newUsesRemaining: 1 }));
    const newSlot = view.slots.find((s) => s.id === "new");
    assert.ok(newSlot.label.includes("1") || newSlot.subLabel.includes("1"));
  });
});

describe("selectedWeaponReducer", () => {
  it("returns new slot when selecting it and uses remain", () => {
    const result = selectedWeaponReducer("ss1", { type: "SELECT", slot: "new" }, 2);
    assert.equal(result, "new");
  });

  it("returns previous when selecting NEW with 0 uses remaining", () => {
    const result = selectedWeaponReducer("ss1", { type: "SELECT", slot: "new" }, 0);
    assert.equal(result, "ss1");
  });

  it("switches between ss1 and ss2 freely", () => {
    assert.equal(selectedWeaponReducer("ss1", { type: "SELECT", slot: "ss2" }, 2), "ss2");
    assert.equal(selectedWeaponReducer("ss2", { type: "SELECT", slot: "ss1" }, 0), "ss1");
  });

  it("returns current for unknown action type", () => {
    assert.equal(selectedWeaponReducer("ss2", { type: "UNKNOWN" }, 2), "ss2");
  });
});
