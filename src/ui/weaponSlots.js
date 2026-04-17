/**
 * Pure weapon-slots view model builder (Plan F §Task 5).
 * No DOM, no side effects — safe to import in Node test environments.
 */

const SLOT_ORDER = ["ss1", "ss2", "new"];
const SLOT_KEY_LABELS = { ss1: "1", ss2: "2", new: "3" };
const DELAY_LABELS = { ss1: "×1.0", ss2: "×1.3", new: "×1.8" };

/**
 * Build view model for weapon slot tabs.
 *
 * @param {object} player
 *   - tankTypeDef:      { weapons: { ss1, ss2, new } }  (optional; used for tooltips)
 *   - weapons:          { [weaponId]: { name, damage, delayMultiplier } }  (optional)
 *   - selectedWeapon:   'ss1' | 'ss2' | 'new'
 *   - newUsesRemaining: number
 *   - isCurrentTurn:    boolean
 * @returns {{ slots: SlotViewModel[], activeSlot: string }}
 */
export function buildWeaponSlotsView(player) {
  const selected = player.selectedWeapon ?? "ss1";
  const newLeft = player.newUsesRemaining ?? 0;
  const isTurn = player.isCurrentTurn ?? false;
  const tankDef = player.tankTypeDef ?? null;
  const weaponMap = player.weapons ?? {};

  const slots = SLOT_ORDER.map((id) => {
    const weaponId = tankDef?.weapons?.[id] ?? null;
    const weapon = weaponId ? weaponMap[weaponId] : null;
    const weaponName = weapon?.name ?? id.toUpperCase();
    const damage = weapon?.damage ?? "";
    const delay = DELAY_LABELS[id];

    const isNew = id === "new";
    const disabledForNew = isNew && newLeft <= 0;
    const disabled = !isTurn || disabledForNew;

    const label = isNew
      ? `NEW (${newLeft})`
      : weaponName;
    const subLabel = isNew
      ? `${SLOT_KEY_LABELS[id]} · ${delay}`
      : `${SLOT_KEY_LABELS[id]} · ${damage ? `${damage}dmg · ` : ""}${delay}`;
    const tooltip = weapon
      ? `${weaponName} — 피해 ${damage} · 딜레이 ${delay}`
      : weaponName;

    return {
      id,
      label,
      subLabel,
      active: id === selected,
      disabled,
      tooltip,
    };
  });

  return { slots, activeSlot: selected };
}

/**
 * Pure reducer for weapon slot selection.
 *
 * @param {string} current            - current selectedWeapon
 * @param {{ type: string, slot?: string }} action
 * @param {number} newUsesRemaining
 * @returns {string}  - new selectedWeapon
 */
export function selectedWeaponReducer(current, action, newUsesRemaining) {
  if (action.type !== "SELECT") return current;
  const slot = action.slot;
  if (slot === "new" && (newUsesRemaining ?? 0) <= 0) return current;
  if (!SLOT_ORDER.includes(slot)) return current;
  return slot;
}
