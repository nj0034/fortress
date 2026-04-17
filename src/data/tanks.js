/**
 * 10 Korean tanks — Plan D §2.
 * Each tank references weapon ids from src/data/weapons.js via the naming
 * convention `${id}_ss1`, `${id}_ss2`, `${id}_new`.
 *
 * Stats schema (used by turn manager + sim):
 *   maxHealth   [80, 200]
 *   armor       [0.5, 1.5]  — damage-taken multiplier (lower = tougher)
 *   mobility    [0.3, 1.5]  — movement speed multiplier
 *   baseDelay   [400, 1000] — base turn-delay units
 *   precision   [0.6, 1.2]  — aim accuracy multiplier
 */

const T = (id, name, role, description, stats, primary, secondary, turretPivotY = 72) => ({
  id,
  name,
  role,
  description,
  stats,
  weapons: { ss1: `${id}_ss1`, ss2: `${id}_ss2`, new: `${id}_new` },
  turret: { pivotY: turretPivotY },
  visual: {
    svgId: id,
    primaryColor: primary,
    secondaryColor: secondary,
    trackStyle: "standard",
  },
});

export const TANK_TYPES = {
  armor: T(
    "armor", "아머", "중장갑 / 정면",
    "강철 장갑으로 무장한 정면 돌파형 탱크. 높은 체력과 강한 포격으로 전선을 압박합니다.",
    { maxHealth: 150, armor: 0.85, mobility: 0.80, baseDelay: 720, precision: 0.90 },
    "#ffb84f", "#d9772a", 72,
  ),
  bigpo: T(
    "bigpo", "빅포", "고화력 / 대포",
    "거대한 주포로 광역 피해를 퍼붓는 고화력 포격 탱크. 느리지만 한 방이 압도적입니다.",
    { maxHealth: 135, armor: 0.90, mobility: 0.60, baseDelay: 870, precision: 0.85 },
    "#ff6a4b", "#b03020", 58,
  ),
  slingshot: T(
    "slingshot", "새총", "곡사 / 바람",
    "바람을 타고 포물선을 그리는 곡사 전문 탱크. 바람 보정 없이는 예측하기 어렵습니다.",
    { maxHealth: 105, armor: 1.05, mobility: 1.10, baseDelay: 660, precision: 0.95 },
    "#9cd8ff", "#2e7fbf", 68,
  ),
  dike: T(
    "dike", "디크", "굴착 / 매몰",
    "드릴 포탄으로 지형을 뚫고 지하에서 폭발하는 매몰 전략 탱크. 지형 파괴 전문가입니다.",
    { maxHealth: 115, armor: 1.00, mobility: 1.00, baseDelay: 760, precision: 0.90 },
    "#7ec46b", "#3f7a3a", 68,
  ),
  turtle: T(
    "turtle", "터틀", "방어 / 지속전",
    "매 발사마다 자체 회복하는 방어형 탱크. 오랜 교전에서 빛을 발하는 생존 전문가.",
    { maxHealth: 170, armor: 0.80, mobility: 0.55, baseDelay: 840, precision: 0.88 },
    "#8ed6c2", "#2f6a5a", 72,
  ),
  mage: T(
    "mage", "마법사", "광역 / 분열",
    "마법 오브를 발사해 공중에서 분열시키는 광역 딜러. 예측 불가능한 궤도가 특징입니다.",
    { maxHealth: 110, armor: 1.05, mobility: 0.95, baseDelay: 720, precision: 0.92 },
    "#c48cff", "#5a2fa0", 58,
  ),
  tricot: T(
    "tricot", "트리코", "3분열 / 확산",
    "동시에 여러 발을 퍼붓는 확산 사격 탱크. 좁은 지형에서 위력이 배가됩니다.",
    { maxHealth: 110, armor: 1.00, mobility: 1.05, baseDelay: 700, precision: 0.93 },
    "#ffd24b", "#b8881a", 68,
  ),
  acannon: T(
    "acannon", "A캐논", "장거리 / 직사",
    "바람 영향을 거의 받지 않는 고속 직사 탱크. 관통탄으로 여러 적을 꿰뚫습니다.",
    { maxHealth: 95, armor: 1.15, mobility: 0.95, baseDelay: 620, precision: 1.05 },
    "#7ddcff", "#1c6ea4", 68,
  ),
  lightning: T(
    "lightning", "라이트닝", "전격 / 관통",
    "번개 탄으로 연쇄 피해를 주는 전격형 탱크. 밀집된 적에게 극도의 위협이 됩니다.",
    { maxHealth: 115, armor: 1.02, mobility: 1.00, baseDelay: 760, precision: 1.00 },
    "#fff37a", "#c89b1a", 68,
  ),
  ice: T(
    "ice", "아이스", "빙결 / 디버프",
    "빙결 상태를 부여해 적의 턴 딜레이를 늘리는 디버프 탱크. 시간 전략의 핵심.",
    { maxHealth: 120, armor: 1.00, mobility: 0.95, baseDelay: 780, precision: 0.90 },
    "#b6efff", "#3a8fb2", 68,
  ),
};
