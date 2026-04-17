/**
 * In-game item table — Plan G §1.
 * 5 item types that drop on the battlefield, are collected, stored in 3-slot inventory.
 *
 * Schema: { id, name, description, slot, icon, applyEffect }
 *   slot: "instant" | "turn" | "persistent"
 *   applyEffect: string key resolved inside sim/items.js useItem()
 */

export const ITEMS = [
  {
    id: "teleport",
    name: "순간이동",
    description: "선택한 지형 위치로 즉시 이동합니다.",
    slot: "instant",
    icon: "🌀",
    applyEffect: "teleport",
  },
  {
    id: "double_shot",
    name: "이중 발사",
    description: "이번 발사 후 결정론적 각도 편차로 두 번째 포탄을 자동 발사합니다.",
    slot: "turn",
    icon: "💥",
    applyEffect: "double_shot",
  },
  {
    id: "ion_shield",
    name: "이온 방패",
    description: "다음 피격 시 피해를 절반으로 줄이고 방패가 소모됩니다.",
    slot: "persistent",
    icon: "🛡️",
    applyEffect: "ion_shield",
  },
  {
    id: "repair_kit",
    name: "수리 키트",
    description: "체력을 40 회복합니다 (최대 체력 초과 불가).",
    slot: "instant",
    icon: "🔧",
    applyEffect: "repair_kit",
  },
  {
    id: "gravity_reverse",
    name: "중력 역전",
    description: "이번 발사의 중력이 반전되어 포물선이 위로 휩니다.",
    slot: "turn",
    icon: "🔄",
    applyEffect: "gravity_reverse",
  },
];

/** Map of id → item record for O(1) lookup. */
export const ITEMS_MAP = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

/**
 * Return the item record for the given id, or undefined if not found.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getItem(id) {
  return ITEMS_MAP[id];
}
