/**
 * 30-entry weapon table — 10 Korean tanks × 3 slots (ss1 / ss2 / new).
 * NEW slot weapons always have perMatchLimit: 2; SS1/SS2 have null.
 *
 * Plan D §3.2 spec.
 */

export const WEAPON_SLOT_DELAY = { ss1: 1.0, ss2: 1.3, new: 1.8 };

/** Default projectile fields */
const base = (overrides = {}) => ({
  speedMultiplier: 1.0,
  gravityScale: 1.0,
  windFactor: 1.0,
  damage: 35,
  radius: 44,
  craterMultiplier: 1.0,
  pierce: 0,
  fragments: [],
  status: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Helpers for fragment arrays
// ---------------------------------------------------------------------------

/** Fan of N fragments evenly around centre with optional spread. */
function splitFan(count, airBurstTimer, damage, radius, spreadDeg = 30) {
  const step = spreadDeg / Math.max(count - 1, 1);
  const start = -spreadDeg / 2;
  return Array.from({ length: count }, (_, i) => ({
    airBurstTimer,
    offsetAngle: start + i * step,
    speedMultiplier: 0.85,
    damage,
    radius,
    craterMultiplier: 0.85,
  }));
}

/** Fan of N simultaneous siblings (multi shotType). */
function fanN(count, angleStep, damage, radius) {
  const start = -((count - 1) / 2) * angleStep;
  return Array.from({ length: count }, (_, i) => ({
    offsetAngle: start + i * angleStep,
    speedMultiplier: 1.0,
    damage,
    radius,
    craterMultiplier: 0.88,
  }));
}

/** Zigzag fan — alternating ±amplitude, each wider than the last. */
function zigzagFan(count, angleStep) {
  return Array.from({ length: count }, (_, i) => {
    const sign = i % 2 === 0 ? 1 : -1;
    const tier = Math.floor(i / 2);
    return {
      offsetAngle: sign * angleStep * (tier + 1),
      speedMultiplier: 0.9 + tier * 0.04,
      damage: 18,
      radius: 28,
      craterMultiplier: 0.75,
      zigzagAmp: 6 + tier * 2,
    };
  });
}

// ---------------------------------------------------------------------------
// Weapon table
// ---------------------------------------------------------------------------

export const WEAPONS = {
  // ── armor ─────────────────────────────────────────────────────────────────
  armor_ss1: {
    name: "시즈 샷",
    shotType: "single",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({ damage: 38, radius: 46, craterMultiplier: 0.96, gravityScale: 1.02, windFactor: 0.88, speedMultiplier: 0.96 }),
    fx: { trail: "#ffb84f", hitSprite: "boom-mid" },
  },
  armor_ss2: {
    name: "헤비 버스트",
    shotType: "single",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({ damage: 52, radius: 58, craterMultiplier: 1.1, gravityScale: 1.04, windFactor: 0.82, speedMultiplier: 0.90 }),
    fx: { trail: "#ff8800", hitSprite: "boom-large" },
  },
  armor_new: {
    name: "시즈 스톰",
    shotType: "split",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({
      damage: 20, radius: 30, craterMultiplier: 0.80, speedMultiplier: 0.94,
      fragments: splitFan(3, 24, 18, 28, 36),
    }),
    fx: { trail: "#ffcf66", hitSprite: "boom-large" },
  },

  // ── bigpo ─────────────────────────────────────────────────────────────────
  bigpo_ss1: {
    name: "빅 캐논",
    shotType: "single",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({ damage: 44, radius: 60, craterMultiplier: 1.05, gravityScale: 1.06, windFactor: 0.72, speedMultiplier: 0.88 }),
    fx: { trail: "#ff6a4b", hitSprite: "boom-large" },
  },
  bigpo_ss2: {
    name: "하우저",
    shotType: "single",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({ damage: 58, radius: 76, craterMultiplier: 1.2, gravityScale: 1.10, windFactor: 0.68, speedMultiplier: 0.82 }),
    fx: { trail: "#ff4422", hitSprite: "boom-xlarge" },
  },
  bigpo_new: {
    name: "메테오",
    shotType: "single",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({ damage: 70, radius: 110, craterMultiplier: 1.4, gravityScale: 1.15, windFactor: 0.60, speedMultiplier: 0.76 }),
    fx: { trail: "#ffaa00", hitSprite: "boom-meteor" },
  },

  // ── slingshot ─────────────────────────────────────────────────────────────
  slingshot_ss1: {
    name: "곡사 돌맹이",
    shotType: "single",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({ damage: 32, radius: 40, craterMultiplier: 0.88, gravityScale: 0.92, windFactor: 1.6, speedMultiplier: 1.02 }),
    fx: { trail: "#9cd8ff", hitSprite: "boom-small" },
  },
  slingshot_ss2: {
    name: "곡사 바위",
    shotType: "single",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({ damage: 46, radius: 54, craterMultiplier: 1.0, gravityScale: 0.90, windFactor: 1.5, speedMultiplier: 0.96 }),
    fx: { trail: "#4ab8ff", hitSprite: "boom-mid" },
  },
  slingshot_new: {
    name: "강풍탄",
    shotType: "multi",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({
      damage: 22, radius: 30, craterMultiplier: 0.80, windFactor: 1.6,
      fragments: fanN(3, 12, 22, 30),
    }),
    fx: { trail: "#c8eeff", hitSprite: "boom-mid" },
  },

  // ── dike ──────────────────────────────────────────────────────────────────
  dike_ss1: {
    name: "드릴탄",
    shotType: "burrow",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({
      damage: 30, radius: 38, craterMultiplier: 0.75, gravityScale: 1.04, windFactor: 0.88, speedMultiplier: 0.94,
      burrow: { tunnelDepth: 200, tunnelWidth: 12, horizontalSpan: 0, terminalRadius: 44 },
    }),
    fx: { trail: "#7ec46b", hitSprite: "boom-dirt" },
  },
  dike_ss2: {
    name: "드릴 벙커",
    shotType: "burrow",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({
      damage: 42, radius: 50, craterMultiplier: 0.85, gravityScale: 1.06, windFactor: 0.82, speedMultiplier: 0.90,
      burrow: { tunnelDepth: 260, tunnelWidth: 16, horizontalSpan: 0, terminalRadius: 55 },
    }),
    fx: { trail: "#5a9e4a", hitSprite: "boom-dirt" },
  },
  dike_new: {
    name: "지진 균열",
    shotType: "burrow",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({
      damage: 55, radius: 60, craterMultiplier: 0.90, gravityScale: 1.08, windFactor: 0.78, speedMultiplier: 0.88,
      burrow: { tunnelDepth: 240, tunnelWidth: 20, horizontalSpan: 260, terminalRadius: 68 },
    }),
    fx: { trail: "#a0d870", hitSprite: "boom-dirt-large" },
  },

  // ── turtle ────────────────────────────────────────────────────────────────
  turtle_ss1: {
    name: "쉘 볼트",
    shotType: "single",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({ damage: 28, radius: 40, craterMultiplier: 0.88, gravityScale: 1.02, windFactor: 0.86, speedMultiplier: 0.96, selfHeal: 8 }),
    fx: { trail: "#8ed6c2", hitSprite: "boom-small" },
  },
  turtle_ss2: {
    name: "쉘 배쉬",
    shotType: "single",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({ damage: 38, radius: 48, craterMultiplier: 0.92, gravityScale: 1.04, windFactor: 0.84, speedMultiplier: 0.92, selfHeal: 15 }),
    fx: { trail: "#50c0a0", hitSprite: "boom-mid" },
  },
  turtle_new: {
    name: "수호자의 벽",
    shotType: "single",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({ damage: 48, radius: 55, craterMultiplier: 0.95, gravityScale: 1.05, windFactor: 0.80, speedMultiplier: 0.88, selfHeal: 40, raiseTerrainInFront: true }),
    fx: { trail: "#98e8d0", hitSprite: "boom-large" },
  },

  // ── mage ──────────────────────────────────────────────────────────────────
  mage_ss1: {
    name: "아르카나 오브",
    shotType: "split",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({
      damage: 24, radius: 34, craterMultiplier: 0.82, speedMultiplier: 1.0, gravityScale: 0.94, windFactor: 0.92,
      fragments: splitFan(3, 20, 20, 30, 32),
    }),
    fx: { trail: "#c48cff", hitSprite: "boom-magic" },
  },
  mage_ss2: {
    name: "스타 폴",
    shotType: "split",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({
      damage: 22, radius: 30, craterMultiplier: 0.78, speedMultiplier: 1.02, gravityScale: 0.92, windFactor: 0.90,
      fragments: splitFan(5, 22, 18, 26, 50),
    }),
    fx: { trail: "#aa66ff", hitSprite: "boom-magic" },
  },
  mage_new: {
    name: "유성 폭격",
    shotType: "multi",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({
      damage: 18, radius: 28, craterMultiplier: 0.70, speedMultiplier: 1.0,
      randomFall: { count: 9, spreadX: 280 },
    }),
    fx: { trail: "#e0aaff", hitSprite: "boom-magic" },
  },

  // ── tricot ────────────────────────────────────────────────────────────────
  tricot_ss1: {
    name: "트리-스플릿",
    shotType: "multi",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({
      damage: 24, radius: 32, craterMultiplier: 0.84, speedMultiplier: 1.0,
      fragments: fanN(3, 10, 24, 32),
    }),
    fx: { trail: "#ffd24b", hitSprite: "boom-mid" },
  },
  tricot_ss2: {
    name: "트리-버스트",
    shotType: "multi",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({
      damage: 20, radius: 28, craterMultiplier: 0.80, speedMultiplier: 1.0,
      fragments: fanN(5, 9, 20, 28),
    }),
    fx: { trail: "#f0b822", hitSprite: "boom-mid" },
  },
  tricot_new: {
    name: "프리즘 샤워",
    shotType: "multi",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({
      damage: 16, radius: 24, craterMultiplier: 0.72, speedMultiplier: 0.96,
      fragments: zigzagFan(9, 8),
    }),
    fx: { trail: "#ffe880", hitSprite: "boom-mid" },
  },

  // ── acannon ───────────────────────────────────────────────────────────────
  acannon_ss1: {
    name: "레일 라운드",
    shotType: "pierce",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({ damage: 42, radius: 36, craterMultiplier: 0.82, speedMultiplier: 1.22, gravityScale: 0.94, windFactor: 0.4, pierce: 0 }),
    fx: { trail: "#7ddcff", hitSprite: "boom-rail" },
  },
  acannon_ss2: {
    name: "레일 스파이크",
    shotType: "pierce",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({ damage: 52, radius: 38, craterMultiplier: 0.85, speedMultiplier: 1.30, gravityScale: 0.92, windFactor: 0.35, pierce: 1 }),
    fx: { trail: "#44ccff", hitSprite: "boom-rail" },
  },
  acannon_new: {
    name: "레일 하이퍼",
    shotType: "pierce",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({ damage: 72, radius: 40, craterMultiplier: 0.88, speedMultiplier: 1.40, gravityScale: 0.90, windFactor: 0.28, pierce: 2 }),
    fx: { trail: "#00eeff", hitSprite: "boom-rail" },
  },

  // ── lightning ─────────────────────────────────────────────────────────────
  lightning_ss1: {
    name: "아크 볼트",
    shotType: "chain",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({
      damage: 36, radius: 40, craterMultiplier: 0.86, speedMultiplier: 1.06, gravityScale: 0.96, windFactor: 0.82,
      terrainPierceCells: 1,
      chain: { count: 0, range: 0, falloff: 0.8 },
    }),
    fx: { trail: "#fff37a", hitSprite: "boom-electric" },
  },
  lightning_ss2: {
    name: "체인 볼트",
    shotType: "chain",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({
      damage: 44, radius: 44, craterMultiplier: 0.88, speedMultiplier: 1.08, gravityScale: 0.94, windFactor: 0.78,
      chain: { count: 1, range: 220, falloff: 0.8 },
    }),
    fx: { trail: "#ffee22", hitSprite: "boom-electric" },
  },
  lightning_new: {
    name: "천둥 강타",
    shotType: "chain",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({
      damage: 56, radius: 52, craterMultiplier: 0.92, speedMultiplier: 1.10, gravityScale: 0.92, windFactor: 0.72,
      chain: { count: 2, range: 280, falloff: 0.75 },
      verticalStrike: true,
    }),
    fx: { trail: "#fffaaa", hitSprite: "boom-thunder" },
  },

  // ── ice ───────────────────────────────────────────────────────────────────
  ice_ss1: {
    name: "서리 볼",
    shotType: "single",
    delayMultiplier: 1.0,
    perMatchLimit: null,
    projectile: base({ damage: 28, radius: 42, craterMultiplier: 0.86, gravityScale: 0.98, windFactor: 0.94, speedMultiplier: 1.0, status: { type: "frozen", delayBonus: 120 } }),
    fx: { trail: "#b6efff", hitSprite: "boom-ice" },
  },
  ice_ss2: {
    name: "서리 파편",
    shotType: "split",
    delayMultiplier: 1.3,
    perMatchLimit: null,
    projectile: base({
      damage: 20, radius: 34, craterMultiplier: 0.80, gravityScale: 0.96, windFactor: 0.92, speedMultiplier: 1.02,
      status: { type: "frozen", delayBonus: 200 },
      fragments: splitFan(3, 18, 16, 26, 30),
    }),
    fx: { trail: "#80d8ff", hitSprite: "boom-ice" },
  },
  ice_new: {
    name: "블리자드",
    shotType: "multi",
    delayMultiplier: 1.8,
    perMatchLimit: 2,
    projectile: base({
      damage: 22, radius: 50, craterMultiplier: 0.78, gravityScale: 0.94, windFactor: 0.90, speedMultiplier: 0.96,
      status: { type: "frozen", delayBonus: 400 },
      aoeAllEnemies: true,
      fragments: fanN(1, 0, 22, 50),
    }),
    fx: { trail: "#c8f4ff", hitSprite: "boom-blizzard" },
  },
};
