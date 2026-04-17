import { clamp, lerp, degToRad, wrapAngleRadians, distance } from "./src/util/math.js";
import { hashString, escapeHtml, randomId } from "./src/util/text.js";
import { mulberry32, createPurposeRng } from "./src/sim/rng.js";
import {
  VIEW_WIDTH, VIEW_HEIGHT, FRAME_STEP, SNAPSHOT_INTERVAL, TURN_FUEL, MOVE_COST,
  MOVE_STEP, ANGLE_STEP, MIN_POWER, MAX_POWER, CHARGE_RATE, HOLD_REPEAT_INTERVAL,
  LAUNCH_SPEED_DIVISOR, WIND_ACCELERATION, MAX_WIND, BATTLE_CAMERA_SCALE,
  WORLD_WIDTH, WORLD_HEIGHT, BATTLE_CAMERA_OFFSET_X, BATTLE_CAMERA_OFFSET_Y,
  PLAYER_FALL_ACCELERATION, PLAYER_MAX_FALL_SPEED, VOID_TERRAIN_DEPTH,
  TANK_RADIUS, CRATER_EDGE, MAX_PLAYERS, HOLDABLE_ACTIONS, OPPOSITE_HOLD_ACTION,
  BOT_NAMES, DEFAULT_THEME_ID,
} from "./src/config.js";
import { TANK_TYPES } from "./src/data/tanks.js";
import { THEMES } from "./src/data/maps.js";
import {
  loadTankTemplates,
  renderTankToCanvas,
  preRasterize,
  TANK_IDS,
  TEAM_COLORS,
} from "./src/render/tankRender.js";
import {
  createTurnManager,
  pickNextTurn,
  applyAction as applyTurnAction,
  applyStatusDelay as applyTurnStatusDelay,
  removeTank as removeTurnTank,
  normalizeDelays as normalizeTurnDelays,
  snapshot as snapshotTurnManager,
} from "./src/sim/turn.js";
import {
  fireWeapon as simFireWeapon,
  resolveHit,
  resolveSelfHeal,
  WEAPON_SLOT_DELAY,
} from "./src/sim/weapons.js";
import { WEAPONS } from "./src/data/weapons.js";
import {
  createTerrain,
  isSolidAt,
  surfaceYAt,
  rasterizeHeightmap,
  applyCrater,
  unionRect,
  colorForTheme,
} from "./src/sim/terrain.js";
import { circle, verticalTunnel, horizontalBurst } from "./src/sim/craterMasks.js";
import {
  isBridgeTerrainStyle as isBridgeStyle,
  getBridgeProfile as getBridgeProfilePure,
  getCanyonBridgeTopAt as getCanyonBridgeTopAtPure,
  getSkyRuinsBridgeTopAt as getSkyRuinsBridgeTopAtPure,
  getFrostMawBridgeTopAt as getFrostMawBridgeTopAtPure,
  getFrostMawSupportTopAt as getFrostMawSupportTopAtPure,
  generateBridgeFloor as generateBridgeFloorPure,
  generateSupportTerrainState as generateSupportTerrainStatePure,
  collectBridgeLayersAt,
} from "./src/sim/bridge.js";
import { drawTerrain as drawTerrainBitmap } from "./src/render/terrainRender.js";
import { buildTurnOrderView } from "./src/ui/turnOrder.js";
import { buildWeaponSlotsView, selectedWeaponReducer } from "./src/ui/weaponSlots.js";

// Feature flag: use SVG-based tank rendering (set false to revert to canvas drawing)
const USE_SVG_TANKS = true;

const PEER_CONFIG = {
  host: "0.peerjs.com",
  port: 443,
  path: "/",
  secure: true,
  debug: 1,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ],
  },
};



const dom = {
  launcherScreen: document.querySelector("#launcher-screen"),
  battleScreen: document.querySelector("#battle-screen"),
  statusChip: document.querySelector("#status-chip"),
  roomChip: document.querySelector("#room-chip"),
  readinessScore: document.querySelector("#readiness-score"),
  heroVehicle: document.querySelector("#hero-vehicle"),
  heroVehicleCanvas: document.querySelector("#hero-vehicle-canvas"),
  selectedTankRole: document.querySelector("#selected-tank-role"),
  selectedTankName: document.querySelector("#selected-tank-name"),
  selectedTankDescription: document.querySelector("#selected-tank-description"),
  selectedTankWeapon: document.querySelector("#selected-tank-weapon"),
  statsRadar: document.querySelector("#stats-radar"),
  tickerText: document.querySelector("#ticker-text"),
  playerCountChip: document.querySelector("#player-count-chip"),
  playerPreview: document.querySelector("#player-preview"),
  summaryKicker: document.querySelector("#summary-kicker"),
  summaryTitle: document.querySelector("#summary-title"),
  summaryText: document.querySelector("#summary-text"),
  summaryTheme: document.querySelector("#summary-theme"),
  summaryPlayers: document.querySelector("#summary-players"),
  lobbyMinimap: document.querySelector("#lobby-minimap"),
  playerNameInput: document.querySelector("#player-name-input"),
  invitePreview: document.querySelector("#invite-preview"),
  inviteLinkField: document.querySelector("#invite-link-field"),
  inviteDetected: document.querySelector("#invite-detected"),
  inviteRoomName: document.querySelector("#invite-room-name"),
  inviteRoomMeta: document.querySelector("#invite-room-meta"),
  mapCycleControl: document.querySelector("#map-cycle-control"),
  mapPrevBtn: document.querySelector("#map-prev-btn"),
  mapCycleLabel: document.querySelector("#map-cycle-label"),
  mapNextBtn: document.querySelector("#map-next-btn"),
  copyInviteBtn: document.querySelector("#copy-invite-btn"),
  addBotBtn: document.querySelector("#add-bot-btn"),
  leaveRoomBtn: document.querySelector("#leave-room-btn"),
  panelNote: document.querySelector("#panel-note"),
  mainActionBtn: document.querySelector("#main-action-btn"),
  tankStrip: document.querySelector("#tank-strip"),
  phasePill: document.querySelector("#phase-pill"),
  turnLabel: document.querySelector("#turn-label"),
  windPill: document.querySelector("#wind-pill"),
  powerLabel: document.querySelector("#power-label"),
  powerTrack: document.querySelector(".power-track"),
  powerFill: document.querySelector("#power-fill"),
  fuelLabel: document.querySelector("#fuel-label"),
  fuelTrack: document.querySelector("#fuel-track"),
  fuelFill: document.querySelector("#fuel-fill"),
  chatMessages: document.querySelector("#chat-messages"),
  chatInput: document.querySelector("#chat-input"),
  chatSendBtn: document.querySelector("#chat-send-btn"),
  battleChatMessages: document.querySelector("#battle-chat-messages"),
  battleChatInput: document.querySelector("#battle-chat-input"),
  battleChatSendBtn: document.querySelector("#battle-chat-send-btn"),
  powerManualMarker: document.querySelector("#power-manual-marker"),
  powerManualValue: document.querySelector("#power-manual-value"),
  powerPreviousMarker: document.querySelector("#power-previous-marker"),
  powerPreviousValue: document.querySelector("#power-previous-value"),
  battleLeaveBtn: document.querySelector("#battle-leave-btn"),
  battleBanner: document.querySelector("#battle-banner"),
  battleRoster: document.querySelector("#battle-roster"),
  battleCanvas: document.querySelector("#battle-canvas"),
};

const ctx = dom.battleCanvas.getContext("2d");

// Offscreen canvas for bitmap terrain (allocated once, sized to world + void)
const terrainCanvas = document.createElement("canvas");
terrainCanvas.width = WORLD_WIDTH;
terrainCanvas.height = WORLD_HEIGHT + VOID_TERRAIN_DEPTH;
const terrainCtx = terrainCanvas.getContext("2d");
let pendingDirtyRect = null;

const app = {
  selectedTheme: loadSetting("fortress_selected_theme", DEFAULT_THEME_ID),
  selectedTank: loadSetting("fortress_selected_tank", "armor"),
  draftName: loadSetting("fortress_player_name", "Commander"),
  localRole: null,
  localPlayerId: null,
  room: null,
  invitePayload: null,
  status: { text: "대기 중", tone: "sky" },
  ticker:
    "방을 만들면 초대 링크를 복사할 수 있고, 링크를 연 참가자는 승인 절차 없이 바로 로비에 입장합니다.",
  network: createNetworkState(),
  game: createEmptyGame(loadSetting("fortress_selected_theme", DEFAULT_THEME_ID)),
  input: {
    isChargeHeld: false,
    heldActions: new Set(),
    manualPowerMarker: null,
  },
  uiDirty: true,
  chatLog: [],
  lastUiRender: 0,
  lastSnapshotAt: 0,
};

function createNetworkState() {
  return {
    peer: null,
    peerId: null,
    hostConnections: new Map(),
    clientConnection: null,
    isHostReady: false,
    accepted: false,
    joinAttempts: 0,
    reconnectTimer: null,
    autoJoinTimer: null,
    snapshotFlushTimer: null,
    acceptanceTimer: null,
    helloRetryTimer: null,
    snapshotReceived: false,
  };
}

function createEmptyGame(themeId) {
  const terrainState = createTerrainState(themeId, "idle-preview");
  return {
    phase: "idle",
    theme: themeId,
    terrain: terrainState.terrain,
    bridgeFloor: terrainState.bridgeFloor,
    supportTerrain: terrainState.supportTerrain,
    supportBridgeFloor: terrainState.supportBridgeFloor,
    bitmap: terrainState.bitmap,
    players: [],
    projectiles: [],
    pendingShots: [],
    explosions: [],
    wind: 0,
    currentTurnIndex: 0,
    turnNumber: 0,
    turnManager: null,
    banner: "로비를 열면 전장을 준비합니다.",
    winnerId: null,
    resolveTimer: 0,
    botTimer: 0,
  };
}

function createHeldActionFlags() {
  return Object.fromEntries(HOLDABLE_ACTIONS.map((actionType) => [actionType, false]));
}

function createHeldActionTimers() {
  return Object.fromEntries(HOLDABLE_ACTIONS.map((actionType) => [actionType, 0]));
}

function markUiDirty() {
  app.uiDirty = true;
}

function loadSetting(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch (error) {
    return fallback;
  }
}

function persistProfile() {
  try {
    window.localStorage.setItem("fortress_player_name", app.draftName);
    window.localStorage.setItem("fortress_selected_tank", app.selectedTank);
    window.localStorage.setItem("fortress_selected_theme", app.selectedTheme);
  } catch (error) {
    void error;
  }
}

function updateStatus(text, tone = "sky") {
  app.status = { text, tone };
  markUiDirty();
}

function setTicker(text) {
  app.ticker = text;
  app.game.banner = text;
  markUiDirty();
}



function normalizeIncoming(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
  return data;
}

function cloneSimple(value) {
  return JSON.parse(JSON.stringify(value));
}

function encodePayload(payload) {
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodePayload(raw) {
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return JSON.parse(decodeURIComponent(escape(atob(padded))));
}

function parseLinkPayload(text, expectedType) {
  const value = text.trim();
  if (!value) {
    return null;
  }

  try {
    const url = value.includes("#") ? new URL(value, window.location.href) : null;
    const hash = url ? url.hash : value.startsWith("#") ? value : `#${value}`;
    const match = hash.match(/^#([a-z]+)=(.+)$/);
    if (!match) {
      return null;
    }
    const [, type, encoded] = match;
    if (expectedType && type !== expectedType) {
      return null;
    }
    return { type, payload: decodePayload(encoded) };
  } catch (error) {
    return null;
  }
}

function makeInviteLink(payload) {
  return `${window.location.origin}${window.location.pathname}#join=${encodePayload(payload)}`;
}

function getThemeByRoomId(roomId) {
  const themeIds = Object.keys(THEMES);
  return themeIds[hashString(roomId) % themeIds.length];
}

function getTheme(themeId) {
  return THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID];
}

function isBridgeTerrainStyle(terrainStyle) {
  return terrainStyle === "bridge" || terrainStyle === "serpentbridge" || terrainStyle === "icebridge";
}

function cycleSelectedTheme(step = 1) {
  if (app.room && !(app.localRole === "host" && app.game.phase === "lobby")) {
    return;
  }
  const themeIds = Object.keys(THEMES);
  const currentIndex = Math.max(themeIds.indexOf(app.selectedTheme), 0);
  app.selectedTheme = themeIds[(currentIndex + step + themeIds.length) % themeIds.length];
  const terrainState = createTerrainState(app.selectedTheme, app.room ? app.room.id : "idle-preview");
  app.game.theme = app.selectedTheme;
  app.game.terrain = terrainState.terrain;
  app.game.bridgeFloor = terrainState.bridgeFloor;
  app.game.supportTerrain = terrainState.supportTerrain;
  app.game.supportBridgeFloor = terrainState.supportBridgeFloor;
  app.game.bitmap = terrainState.bitmap;
  pendingDirtyRect = null;
  persistProfile();
  setTicker(`${getTheme(app.selectedTheme).name} 맵으로 전장을 변경했습니다.`);

  if (app.localRole === "host" && app.room) {
    app.room.theme = app.selectedTheme;
    app.room.name = createAutoRoomName(app.room.hostName, app.selectedTheme);
    app.invitePayload = buildRoomInvitePayload(app.room);
    layoutLobbyPlayers();
    broadcastSnapshot(true);
  }

  markUiDirty();
}

function createTerrainState(themeId, seedText) {
  const theme = getTheme(themeId);
  const terrain = generateTerrain(themeId, seedText);
  const supportState = generateSupportTerrainState(themeId, seedText);
  const bridgeFloor = generateBridgeFloor(themeId, terrain);

  // Build pixel bitmap terrain
  const bitmapH = WORLD_HEIGHT + VOID_TERRAIN_DEPTH;
  const bitmap = createTerrain({ width: WORLD_WIDTH, height: bitmapH, matchSeed: seedText, themeId });
  const colorFn = (x, y) => colorForTheme(theme, x, y, bitmapH);
  rasterizeHeightmap(bitmap, terrain, colorFn);

  return {
    terrain,
    bridgeFloor,
    supportTerrain: supportState.terrain,
    supportBridgeFloor: supportState.bridgeFloor,
    bitmap,
  };
}

function generateTerrain(themeId, seedText) {
  const theme = getTheme(themeId);
  const terrainStyle = theme.terrainStyle ?? "rolling";

  if (terrainStyle === "archipelago") {
    return generateArchipelagoTerrain(themeId, seedText);
  }
  if (terrainStyle === "harbor") {
    return generateHarborTerrain(themeId, seedText);
  }
  if (terrainStyle === "dunes") {
    return generateDuneTerrain(themeId, seedText);
  }
  if (terrainStyle === "mesa") {
    return generateMesaTerrain(themeId, seedText);
  }
  if (terrainStyle === "jagged") {
    return generateJaggedTerrain(themeId, seedText);
  }
  if (isBridgeTerrainStyle(terrainStyle)) {
    return generateBridgeTerrain(themeId, seedText);
  }
  return generateRollingTerrain(themeId, seedText);
}

function generateRollingTerrain(themeId, seedText) {
  const theme = getTheme(themeId);
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  const terrain = [];
  let noise = rand() * 1000;
  const baseHeight = WORLD_HEIGHT * 0.58;
  const amplitude = theme.terrainAmplitude ?? 58;

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    noise += 0.06 + rand() * 0.02;
    const layered =
      Math.sin(x * 0.007 + rand() * 0.2) * amplitude +
      Math.sin(x * 0.016 + noise) * 28 +
      Math.sin(x * 0.028 + noise * 0.5) * 14;
    const detail = (rand() - 0.5) * 9;
    terrain.push(clamp(baseHeight + layered + detail, 300, WORLD_HEIGHT - 82));
  }

  for (let pass = 0; pass < 3; pass += 1) {
    for (let x = 1; x < WORLD_WIDTH - 1; x += 1) {
      terrain[x] = (terrain[x - 1] + terrain[x] + terrain[x + 1]) / 3;
    }
  }

  return terrain.map((value) => Math.round(value));
}

function smoothTerrain(terrain, passes = 3, blend = 1 / 3) {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let x = 1; x < WORLD_WIDTH - 1; x += 1) {
      const neighbors = (terrain[x - 1] + terrain[x + 1]) * 0.5;
      terrain[x] = terrain[x] * (1 - blend) + neighbors * blend;
    }
  }
  return terrain;
}

function finalizeTerrain(terrain, minY = 250, maxY = WORLD_HEIGHT - 82) {
  return terrain.map((value) => Math.round(clamp(value, minY, maxY)));
}

function generateArchipelagoTerrain(themeId, seedText) {
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  const terrain = [];
  const baseHeight = WORLD_HEIGHT * 0.73;
  const phaseA = rand() * Math.PI * 2;
  const phaseB = rand() * Math.PI * 2;
  const phaseC = rand() * Math.PI * 2;
  const peaks = [
    { center: WORLD_WIDTH * (0.12 + rand() * 0.03), width: 120, rise: 126 },
    { center: WORLD_WIDTH * (0.31 + rand() * 0.04), width: 138, rise: 92 },
    { center: WORLD_WIDTH * (0.57 + rand() * 0.04), width: 154, rise: 108 },
    { center: WORLD_WIDTH * (0.81 + rand() * 0.03), width: 126, rise: 132 },
  ];
  const coves = [
    { center: WORLD_WIDTH * 0.22, width: 110, depth: 22 },
    { center: WORLD_WIDTH * 0.45, width: 180, depth: 34 },
    { center: WORLD_WIDTH * 0.7, width: 140, depth: 24 },
  ];

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    let y =
      baseHeight +
      Math.sin(x * 0.0043 + phaseA) * 18 +
      Math.sin(x * 0.011 + phaseB) * 11 +
      Math.sin(x * 0.021 + phaseC) * 8 +
      (rand() - 0.5) * 6;

    peaks.forEach((peak) => {
      y -= Math.exp(-Math.pow((x - peak.center) / peak.width, 2)) * peak.rise;
    });
    coves.forEach((cove) => {
      y += Math.exp(-Math.pow((x - cove.center) / cove.width, 2)) * cove.depth;
    });

    terrain.push(y);
  }

  smoothTerrain(terrain, 3, 0.38);
  return finalizeTerrain(terrain, 285, WORLD_HEIGHT - 76);
}

function generateHarborTerrain(themeId, seedText) {
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  const terrain = [];
  const baseHeight = WORLD_HEIGHT * 0.66;
  const phaseA = rand() * Math.PI * 2;
  const phaseB = rand() * Math.PI * 2;
  const leftShelf = WORLD_WIDTH * (0.2 + rand() * 0.04);
  const rightShelf = WORLD_WIDTH * (0.82 - rand() * 0.04);
  const bayCenter = WORLD_WIDTH * (0.53 + (rand() - 0.5) * 0.05);

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    const coastal =
      Math.sin(x * 0.0038 + phaseA) * 26 +
      Math.sin(x * 0.0105 + phaseB) * 15 +
      (rand() - 0.5) * 5;
    const leftRise = Math.exp(-Math.pow((x - leftShelf) / 170, 2)) * 86;
    const rightRise = Math.exp(-Math.pow((x - rightShelf) / 180, 2)) * 118;
    const harborDip = Math.exp(-Math.pow((x - bayCenter) / 250, 2)) * 58;
    const centerShelf = Math.exp(-Math.pow((x - WORLD_WIDTH * 0.42) / 130, 2)) * 22;
    terrain.push(baseHeight + coastal + harborDip - leftRise - rightRise - centerShelf);
  }

  smoothTerrain(terrain, 4, 0.34);
  flattenTerrain(terrain, WORLD_WIDTH * 0.24, 54);
  flattenTerrain(terrain, WORLD_WIDTH * 0.78, 60);
  return finalizeTerrain(terrain, 274, WORLD_HEIGHT - 82);
}

function generateDuneTerrain(themeId, seedText) {
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  const terrain = [];
  const baseHeight = WORLD_HEIGHT * 0.69;
  const phaseA = rand() * Math.PI * 2;
  const phaseB = rand() * Math.PI * 2;
  const phaseC = rand() * Math.PI * 2;

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    const dunes =
      Math.sin(x * 0.0035 + phaseA) * 44 +
      Math.sin(x * 0.0084 + phaseB) * 25 +
      Math.sin(x * 0.017 + phaseC) * 12;
    const gust = Math.sin(x * 0.0019 + phaseB * 0.7) * 18;
    const drift = (rand() - 0.5) * 4;
    terrain.push(baseHeight + dunes + gust + drift);
  }

  smoothTerrain(terrain, 3, 0.28);
  return finalizeTerrain(terrain, 298, WORLD_HEIGHT - 74);
}

function generateMesaTerrain(themeId, seedText) {
  const theme = getTheme(themeId);
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  const terrain = [];
  const baseHeight = WORLD_HEIGHT * 0.6;
  const stepHeight = 22;
  let noise = rand() * 1000;

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    noise += 0.04 + rand() * 0.012;
    const layered =
      Math.sin(x * 0.0046 + noise * 0.3) * (theme.terrainAmplitude ?? 80) +
      Math.sin(x * 0.013 + noise) * 22 +
      Math.sin(x * 0.024 + noise * 0.5) * 10;
    const stepped = Math.round((baseHeight + layered) / stepHeight) * stepHeight;
    const detail = (rand() - 0.5) * 5;
    terrain.push(clamp(stepped + detail, 280, WORLD_HEIGHT - 92));
  }

  return terrain.map((value) => Math.round(value));
}

function generateJaggedTerrain(themeId, seedText) {
  const theme = getTheme(themeId);
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  const terrain = [];
  let noise = rand() * 1000;
  const baseHeight = WORLD_HEIGHT * 0.56;

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    noise += 0.09 + rand() * 0.03;
    const layered =
      Math.sin(x * 0.01 + noise * 0.2) * (theme.terrainAmplitude ?? 88) +
      Math.sin(x * 0.032 + noise) * 34 +
      Math.sin(x * 0.065 + noise * 0.7) * 16;
    const jag = (rand() - 0.5) * 24;
    terrain.push(clamp(baseHeight + layered + jag, 250, WORLD_HEIGHT - 84));
  }

  for (let pass = 0; pass < 2; pass += 1) {
    for (let x = 1; x < WORLD_WIDTH - 1; x += 1) {
      terrain[x] = terrain[x] * 0.55 + terrain[x - 1] * 0.225 + terrain[x + 1] * 0.225;
    }
  }

  return terrain.map((value) => Math.round(value));
}

function getBridgeProfile(themeId, seedText) {
  const rand = mulberry32(hashString(`${themeId}-${seedText}`));
  return {
    phaseA: rand() * Math.PI * 2,
    phaseB: rand() * Math.PI * 2,
    phaseC: rand() * Math.PI * 2,
    left: WORLD_WIDTH * (0.14 + rand() * 0.08),
    middle: WORLD_WIDTH * (0.46 + rand() * 0.08),
    right: WORLD_WIDTH * (0.76 + rand() * 0.08),
    spreadA: 110 + rand() * 54,
    spreadB: 130 + rand() * 70,
    spreadC: 110 + rand() * 60,
  };
}

function getCanyonBridgeTopAt(x, profile) {
  const bridgeY = WORLD_HEIGHT * 0.56;
  const wave =
    Math.sin(x * 0.006 + profile.phaseA) * 4.5 +
    Math.sin(x * 0.018 + profile.phaseB) * 2.6;
  const crown =
    Math.exp(-Math.pow((x - profile.left) / profile.spreadA, 2)) * -12 +
    Math.exp(-Math.pow((x - profile.right) / profile.spreadC, 2)) * -10 +
    Math.exp(-Math.pow((x - profile.middle) / profile.spreadB, 2)) * 6;
  return Math.round(bridgeY + wave + crown);
}

function getSkyRuinsBridgeTopAt(x, profile) {
  const baseline = WORLD_HEIGHT * 0.64;
  const swell = Math.sin(x * 0.0084 + profile.phaseA) * 44;
  const ripple = Math.sin(x * 0.016 + profile.phaseB) * 10;
  const centerDip = Math.exp(-Math.pow((x - profile.middle) / 220, 2)) * 24;
  const leftLift = Math.exp(-Math.pow((x - profile.left) / 120, 2)) * 16;
  const rightLift = Math.exp(-Math.pow((x - profile.right) / 120, 2)) * 12;
  return Math.round(baseline + swell + ripple + centerDip - leftLift - rightLift);
}

function getFrostMawBridgeTopAt(x, profile) {
  const baseline = WORLD_HEIGHT * 0.43;
  const wave = Math.sin(x * 0.0088 + profile.phaseA) * 26;
  const ridge = Math.sin(x * 0.021 + profile.phaseB) * 8;
  const leftShelf = Math.exp(-Math.pow((x - profile.left) / 140, 2)) * 24;
  const centerSag = Math.exp(-Math.pow((x - profile.middle) / 170, 2)) * 26;
  const rightLift = Math.exp(-Math.pow((x - profile.right) / 190, 2)) * 38;
  const facets = Math.sin(x * 0.05 + profile.phaseC) * 2.6;
  return Math.round(baseline + wave + ridge + centerSag - leftShelf - rightLift + facets);
}

function getFrostMawSupportTopAt(x, profile) {
  const baseline = WORLD_HEIGHT * 0.76;
  const wave = Math.sin(x * 0.0064 + profile.phaseA) * 12;
  const ridge = Math.sin(x * 0.017 + profile.phaseB) * 5.5;
  const centerSag = Math.exp(-Math.pow((x - profile.middle) / 220, 2)) * 18;
  const leftLift = Math.exp(-Math.pow((x - profile.left) / 180, 2)) * 12;
  const rightLift = Math.exp(-Math.pow((x - profile.right) / 190, 2)) * 16;
  const facets = Math.sin(x * 0.043 + profile.phaseC) * 3.2;
  return Math.round(baseline + wave + ridge + centerSag - leftLift - rightLift + facets);
}

function getBridgeTopAt(x, theme = currentTheme(), profile = getBridgeProfile(theme.id, "default")) {
  if ((theme.terrainStyle ?? "rolling") === "serpentbridge") {
    return getSkyRuinsBridgeTopAt(x, profile);
  }
  if ((theme.terrainStyle ?? "rolling") === "icebridge") {
    return getFrostMawBridgeTopAt(x, profile);
  }
  return getCanyonBridgeTopAt(x, profile);
}

function calculateBridgeBottomAt(x, theme = currentTheme(), terrain = app.game.terrain) {
  const thickness = theme.bridgeThickness ?? 30;
  const topY = getRawTerrainYAt(x, terrain);
  if ((theme.terrainStyle ?? "rolling") === "icebridge") {
    const shards =
      Math.sin(x * 0.018 + 0.5) * 4.2 +
      Math.sin(x * 0.055 + 1.3) * 2.4 +
      Math.exp(-Math.pow((x - WORLD_WIDTH * 0.54) / 180, 2)) * 6;
    return Math.round(topY + thickness + shards);
  }
  if ((theme.terrainStyle ?? "rolling") === "serpentbridge") {
    const chainCurve =
      Math.sin(x * 0.012 + 0.7) * 3.4 +
      Math.sin(x * 0.038 + 1.9) * 1.8 +
      Math.exp(-Math.pow((x - WORLD_WIDTH * 0.51) / 210, 2)) * 8;
    return Math.round(topY + thickness + chainCurve);
  }

  const undercurve =
    Math.sin(x * 0.013 + 0.4) * 2.5 +
    Math.sin(x * 0.031 + 1.2) * 1.4 +
    Math.exp(-Math.pow((x - WORLD_WIDTH * 0.5) / 150, 2)) * 7;
  return Math.round(topY + thickness + undercurve);
}

function generateBridgeFloor(themeId, terrain) {
  const theme = getTheme(themeId);
  if (!isBridgeTerrainStyle(theme.terrainStyle ?? "rolling")) {
    return null;
  }
  return Array.from({ length: terrain.length }, (_, x) => calculateBridgeBottomAt(x, theme, terrain));
}

function calculateFrostMawSupportBottomAt(x, terrain) {
  const topY = getRawTerrainYAt(x, terrain);
  const shards =
    Math.sin(x * 0.014 + 0.8) * 3.2 +
    Math.sin(x * 0.048 + 2.1) * 1.9 +
    Math.exp(-Math.pow((x - WORLD_WIDTH * 0.52) / 200, 2)) * 4.2;
  return Math.round(topY + 30 + shards);
}

function generateSupportTerrainState(themeId, seedText) {
  if (themeId !== "frostmaw") {
    return {
      terrain: null,
      bridgeFloor: null,
    };
  }

  const profile = getBridgeProfile(`${themeId}-support`, seedText);
  const terrain = Array.from({ length: WORLD_WIDTH }, (_, x) => getFrostMawSupportTopAt(x, profile));
  return {
    terrain,
    bridgeFloor: Array.from({ length: terrain.length }, (_, x) => calculateFrostMawSupportBottomAt(x, terrain)),
  };
}

function getBridgeBottomAt(
  x,
  theme = currentTheme(),
  terrain = app.game.terrain,
  bridgeFloor = app.game.bridgeFloor,
) {
  if (Array.isArray(bridgeFloor) && bridgeFloor.length) {
    return bridgeFloor[clamp(Math.round(x), 0, bridgeFloor.length - 1)];
  }
  return calculateBridgeBottomAt(x, theme, terrain);
}

function generateBridgeTerrain(themeId, seedText) {
  const theme = getTheme(themeId);
  const profile = getBridgeProfile(themeId, seedText);
  return Array.from({ length: WORLD_WIDTH }, (_, x) => getBridgeTopAt(x, theme, profile));
}

function flattenTerrain(terrain, centerX, radius = 46) {
  const start = clamp(Math.round(centerX - radius), 0, terrain.length - 1);
  const end = clamp(Math.round(centerX + radius), 0, terrain.length - 1);
  const plateauHeight = terrain[Math.round(centerX)];

  for (let x = start; x <= end; x += 1) {
    const factor = Math.abs(x - centerX) / radius;
    terrain[x] = Math.round(lerp(plateauHeight, terrain[x], Math.pow(factor, 1.6)));
  }
}

/**
 * Apply a crater to the bitmap terrain and sync the legacy heightmap.
 * shape: "circle" | "verticalTunnel" | "horizontalBurst"
 */
function applyExplosionCrater(cx, cy, radius, shape = "circle") {
  const bitmap = app.game.bitmap;
  if (!bitmap) return;

  let mask;
  if (shape === "verticalTunnel") {
    mask = verticalTunnel(Math.round(radius * 0.4), Math.round(radius * 2));
  } else if (shape === "horizontalBurst") {
    mask = horizontalBurst(Math.round(radius * 1.6), Math.round(radius * 0.55));
  } else {
    mask = circle(Math.round(radius));
  }

  const dirty = applyCrater(bitmap, { cx: Math.round(cx), cy: Math.round(cy), shape: mask });
  if (!dirty) return;

  // Sync legacy heightmap for the affected columns
  const startX = clamp(dirty.x, 0, WORLD_WIDTH - 1);
  const endX = clamp(dirty.x + dirty.w - 1, 0, WORLD_WIDTH - 1);
  for (let x = startX; x <= endX; x++) {
    const sy = surfaceYAt(bitmap, x);
    app.game.terrain[x] = sy < bitmap.height ? sy : WORLD_HEIGHT - 1;
  }

  pendingDirtyRect = unionRect(pendingDirtyRect, dirty);
}

function getRawTerrainYAt(x, terrain = app.game.terrain) {
  return terrain[clamp(Math.round(x), 0, terrain.length - 1)];
}

function isTerrainSolidAt(x, terrain = app.game.terrain, theme = currentTheme()) {
  const terrainY = getRawTerrainYAt(x, terrain);
  if (isBridgeTerrainStyle(theme.terrainStyle ?? "rolling")) {
    return terrainY < getBridgeBottomAt(x, theme, terrain) - 2;
  }
  return terrainY < WORLD_HEIGHT - 1;
}

function isTerrainLayerSolidAt(x, terrain, theme = currentTheme(), bridgeFloor = null) {
  if (!Array.isArray(terrain) || !terrain.length) {
    return false;
  }
  const terrainY = getRawTerrainYAt(x, terrain);
  if (isBridgeTerrainStyle(theme.terrainStyle ?? "rolling")) {
    return terrainY < getBridgeBottomAt(x, theme, terrain, bridgeFloor) - 2;
  }
  return terrainY < WORLD_HEIGHT - 1;
}

function getTerrainLayersAt(
  x,
  terrain = app.game.terrain,
  theme = currentTheme(),
  bridgeFloor = app.game.bridgeFloor,
  supportTerrain = app.game.supportTerrain,
  supportBridgeFloor = app.game.supportBridgeFloor,
) {
  if (!isBridgeTerrainStyle(theme.terrainStyle ?? "rolling")) {
    const groundY = getRawTerrainYAt(x, terrain);
    return groundY < WORLD_HEIGHT - 1
      ? [{ top: groundY, bottom: WORLD_HEIGHT + VOID_TERRAIN_DEPTH, terrain, bridgeFloor: null }]
      : [];
  }

  const layers = [];
  const mainTop = getRawTerrainYAt(x, terrain);
  const mainBottom = getBridgeBottomAt(x, theme, terrain, bridgeFloor);
  if (mainTop < mainBottom - 2) {
    layers.push({ top: mainTop, bottom: mainBottom, terrain, bridgeFloor });
  }

  if (Array.isArray(supportTerrain) && supportTerrain.length && Array.isArray(supportBridgeFloor)) {
    const supportTop = getRawTerrainYAt(x, supportTerrain);
    const supportBottom = getBridgeBottomAt(x, theme, supportTerrain, supportBridgeFloor);
    if (supportTop < supportBottom - 2) {
      layers.push({
        top: supportTop,
        bottom: supportBottom,
        terrain: supportTerrain,
        bridgeFloor: supportBridgeFloor,
      });
    }
  }

  return layers.sort((left, right) => left.top - right.top);
}

function isTerrainCollisionAt(x, y, terrain = app.game.terrain, theme = currentTheme()) {
  // Probe bitmap first for pixel-accurate solid collision
  if (app.game.bitmap) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (isSolidAt(app.game.bitmap, xi, yi)) return true;
  }
  // Fall back to bridge layer collision (non-destructible spans)
  const bridgeCtx = {
    terrainStyle: theme.terrainStyle ?? "rolling",
    bridgeThickness: theme.bridgeThickness,
    terrain: terrain,
    bridgeFloor: app.game.bridgeFloor,
    supportTerrain: app.game.supportTerrain,
    supportBridgeFloor: app.game.supportBridgeFloor,
    WORLD_WIDTH,
    WORLD_HEIGHT,
  };
  return collectBridgeLayersAt(x, bridgeCtx).some((layer) => y >= layer.top && y <= layer.bottom);
}

function getTerrainYAt(x, terrain = app.game.terrain, referenceY = -Infinity) {
  const layers = getTerrainLayersAt(x, terrain, currentTheme());
  const layer = layers.find((entry) => referenceY <= entry.bottom - 1) ?? null;
  return layer ? layer.top : WORLD_HEIGHT + VOID_TERRAIN_DEPTH;
}

function getGroundYForPlayer(x, playerY = -Infinity, terrain = app.game.terrain) {
  const referenceY = Number.isFinite(playerY) ? playerY + 17 : -Infinity;

  // Use pixel-accurate bitmap surface if available, with bridge-aware ordering
  if (app.game.bitmap) {
    const xi = Math.round(x);
    const theme = currentTheme();
    const bitmapSurface = surfaceYAt(app.game.bitmap, xi);

    // Check bridge layers (non-destructible) — pick the one above referenceY
    const bridgeCtx = {
      terrainStyle: theme.terrainStyle ?? "rolling",
      bridgeThickness: theme.bridgeThickness,
      terrain,
      bridgeFloor: app.game.bridgeFloor,
      supportTerrain: app.game.supportTerrain,
      supportBridgeFloor: app.game.supportBridgeFloor,
      WORLD_WIDTH,
      WORLD_HEIGHT,
    };
    const bridgeLayers = collectBridgeLayersAt(x, bridgeCtx);
    const bridgeLayer = bridgeLayers.find((l) => referenceY <= l.bottom - 1) ?? null;
    const bridgeSurface = bridgeLayer ? bridgeLayer.top : Infinity;

    // Use whichever surface is closest above referenceY
    let terrainY;
    if (bridgeSurface < bitmapSurface && bridgeSurface <= referenceY + 40) {
      terrainY = bridgeSurface;
    } else {
      terrainY = bitmapSurface;
    }

    if (terrainY >= WORLD_HEIGHT - 1) return null;
    return terrainY - 17;
  }

  const terrainY = getTerrainYAt(x, terrain, referenceY);
  if (terrainY >= WORLD_HEIGHT - 1) {
    return null;
  }
  return terrainY - 17;
}

function reflowPlayersOntoTerrain() {
  app.game.players.forEach((player) => {
    player.x = clamp(player.x, 28, WORLD_WIDTH - 28);
    player.y = getGroundYForPlayer(player.x) ?? WORLD_HEIGHT + 24;
    player.fallVelocity = 0;
  });
}

function createPlayer({ id, name, tankType, isHost = false, isBot = false, connected = true }) {
  const tank = TANK_TYPES[tankType] ?? TANK_TYPES.armor;
  return {
    id,
    name,
    tankType,
    color: tank.visual?.primaryColor ?? "#ffb84f",
    maxHealth: tank.stats.maxHealth,
    health: tank.stats.maxHealth,
    shield: 0,
    aimSide: "right",
    angle: 58,
    power: 66,
    lastFiredPower: null,
    isCharging: false,
    heldActions: createHeldActionFlags(),
    heldActionTimers: createHeldActionTimers(),
    fallVelocity: 0,
    fuel: TURN_FUEL,
    x: 0,
    y: 0,
    alive: true,
    isHost,
    isBot,
    connected,
    selectedWeapon: "ss1",
    newUsesRemaining: 2,
  };
}

function serializePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    tankType: player.tankType,
    color: player.color,
    maxHealth: player.maxHealth,
    health: player.health,
    shield: player.shield,
    aimSide: player.aimSide,
    angle: player.angle,
    power: player.power,
    lastFiredPower: player.lastFiredPower,
    isCharging: player.isCharging,
    fuel: player.fuel,
    fallVelocity: Number((player.fallVelocity ?? 0).toFixed(2)),
    x: Math.round(player.x),
    y: Math.round(player.y),
    alive: player.alive,
    isHost: player.isHost,
    isBot: player.isBot,
    connected: player.connected,
  };
}

function getAlivePlayers(players = app.game.players) {
  return players.filter((player) => player.alive);
}

function resetHeldActions(player) {
  player.heldActions = createHeldActionFlags();
  player.heldActionTimers = createHeldActionTimers();
}

function getCurrentPlayer() {
  if (!app.game.players.length) {
    return null;
  }
  return app.game.players[app.game.currentTurnIndex] ?? null;
}

function getLocalPlayer() {
  if (!app.localPlayerId) {
    return null;
  }
  return app.game.players.find((player) => player.id === app.localPlayerId) ?? null;
}

function canLocalPlayerAct() {
  if (!app.localPlayerId || app.game.phase !== "aim") {
    return false;
  }
  const current = getCurrentPlayer();
  return Boolean(current && current.id === app.localPlayerId && current.alive);
}

function isBattleActive() {
  return app.game.phase === "aim" || app.game.phase === "projectile" || app.game.phase === "game-over";
}

function isEditableTarget(target) {
  return Boolean(
    target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable),
  );
}

function currentTheme() {
  return getTheme(app.room?.theme ?? app.game.theme ?? app.selectedTheme);
}

function shadeHex(hex, amount) {
  const clean = hex.replace("#", "");
  const number = Number.parseInt(clean, 16);
  const r = clamp(((number >> 16) & 255) + amount, 0, 255);
  const g = clamp(((number >> 8) & 255) + amount, 0, 255);
  const b = clamp((number & 255) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function colorWithAlpha(color, alpha) {
  if (color.startsWith("#")) {
    const clean = color.replace("#", "");
    const number = Number.parseInt(clean, 16);
    const r = (number >> 16) & 255;
    const g = (number >> 8) & 255;
    const b = number & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }

  return color;
}

function roundScore(value) {
  return `${value}`.padStart(4, "0");
}

function buildTerrainPacket() {
  const parts = [];
  parts.push({
    type: "terrain-sync",
    key: "terrain",
    data: app.game.terrain.slice(),
  });
  if (Array.isArray(app.game.bridgeFloor)) {
    parts.push({
      type: "terrain-sync",
      key: "bridgeFloor",
      data: app.game.bridgeFloor.slice(),
    });
  }
  if (Array.isArray(app.game.supportTerrain)) {
    parts.push({
      type: "terrain-sync",
      key: "supportTerrain",
      data: app.game.supportTerrain.slice(),
    });
  }
  if (Array.isArray(app.game.supportBridgeFloor)) {
    parts.push({
      type: "terrain-sync",
      key: "supportBridgeFloor",
      data: app.game.supportBridgeFloor.slice(),
    });
  }
  return parts;
}

function buildSnapshot(includeTerrain = true) {
  return {
    room: cloneSimple(app.room),
    game: {
      phase: app.game.phase,
      theme: app.game.theme,
      ...(includeTerrain
        ? {
            terrain: app.game.terrain.slice(),
            bridgeFloor: Array.isArray(app.game.bridgeFloor) ? app.game.bridgeFloor.slice() : null,
            supportTerrain: Array.isArray(app.game.supportTerrain) ? app.game.supportTerrain.slice() : null,
            supportBridgeFloor: Array.isArray(app.game.supportBridgeFloor)
              ? app.game.supportBridgeFloor.slice()
              : null,
          }
        : {}),
      players: app.game.players.map(serializePlayer),
      projectiles: app.game.projectiles.map((projectile) => ({
        ...projectile,
        x: Number(projectile.x.toFixed(2)),
        y: Number(projectile.y.toFixed(2)),
      })),
      pendingShots: app.game.pendingShots.map((shot) => ({ ...shot })),
      explosions: app.game.explosions.map((explosion) => ({ ...explosion })),
      wind: app.game.wind,
      currentTurnIndex: app.game.currentTurnIndex,
      turnNumber: app.game.turnNumber,
      turnManager: app.game.turnManager ? snapshotTurnManager(app.game.turnManager) : null,
      banner: app.game.banner,
      winnerId: app.game.winnerId,
      resolveTimer: app.game.resolveTimer,
      botTimer: app.game.botTimer,
    },
  };
}

function sendChatMessage(text) {
  const trimmed = text.trim().slice(0, 100);
  if (!trimmed || !app.room) {
    return;
  }
  const playerName = app.draftName || "???";
  if (app.localRole === "host") {
    addChatMessage(app.localPlayerId, playerName, trimmed);
    broadcastChatMessage(app.localPlayerId, playerName, trimmed);
  } else if (app.localRole === "client" && app.network.clientConnection?.open) {
    app.network.clientConnection.send({ type: "chat", text: trimmed });
  }
}

function broadcastChatMessage(playerId, playerName, text) {
  const packet = { type: "chat", playerId, playerName, text };
  app.network.hostConnections.forEach((conn) => {
    if (conn?.open) {
      conn.send(packet);
    }
  });
}

function addChatMessage(playerId, playerName, text) {
  app.chatLog.push({ playerId, playerName, text, time: Date.now() });
  if (app.chatLog.length > 50) {
    app.chatLog.shift();
  }
  renderChat();
}

function renderChat() {
  const html = app.chatLog
    .map((m) => {
      const isMe = m.playerId === app.localPlayerId;
      return `<div class="chat-bubble ${isMe ? "chat-mine" : ""}"><strong>${escapeHtml(m.playerName)}</strong> ${escapeHtml(m.text)}</div>`;
    })
    .join("");
  if (dom.chatMessages) {
    dom.chatMessages.innerHTML = html;
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }
  if (dom.battleChatMessages) {
    dom.battleChatMessages.innerHTML = html;
    dom.battleChatMessages.scrollTop = dom.battleChatMessages.scrollHeight;
  }
}

function broadcastSnapshot(force = false) {
  if (app.localRole !== "host") {
    return;
  }

  const now = performance.now();
  if (!force && now - app.lastSnapshotAt < SNAPSHOT_INTERVAL) {
    return;
  }
  app.lastSnapshotAt = now;

  const snapshot = buildSnapshot(false);
  const packet = { type: "snapshot", snapshot };
  const terrainPacket = force ? buildTerrainPacket() : null;
  app.network.hostConnections.forEach((connection) => {
    if (connection?.open) {
      if (terrainPacket) {
        for (const part of terrainPacket) {
          connection.send(part);
        }
      }
      connection.send(packet);
    }
  });
}

function buildRoomInvitePayload(room) {
  return {
    version: 2,
    roomId: room.id,
    roomName: room.name,
    hostName: room.hostName,
    hostPeerId: room.hostPeerId,
    theme: room.theme,
    maxPlayers: room.maxPlayers,
    createdAt: Date.now(),
  };
}

function createAutoRoomName(hostName, themeId) {
  return `${hostName}-${getTheme(themeId).name}`.slice(0, 24);
}

function normalizePlayerName(value, fallback = "Commander") {
  return `${value ?? ""}`.trim().slice(0, 18) || fallback;
}

function updatePlayerNickname(playerId, nextName, { syncHostIdentity = false } = {}) {
  const player = app.game.players.find((entry) => entry.id === playerId);
  if (!player) {
    return false;
  }

  const resolvedName = normalizePlayerName(nextName, player.isHost ? "Commander" : "Gunner");
  let changed = false;

  if (player.name !== resolvedName) {
    player.name = resolvedName;
    changed = true;
  }

  if (syncHostIdentity && app.room) {
    if (app.room.hostName !== resolvedName) {
      app.room.hostName = resolvedName;
      changed = true;
    }

    const nextRoomName = createAutoRoomName(resolvedName, app.room.theme);
    if (app.room.name !== nextRoomName) {
      app.room.name = nextRoomName;
      changed = true;
    }

    const inviteNeedsUpdate =
      !app.invitePayload ||
      app.invitePayload.roomId !== app.room.id ||
      app.invitePayload.roomName !== app.room.name ||
      app.invitePayload.hostName !== app.room.hostName ||
      app.invitePayload.hostPeerId !== app.room.hostPeerId ||
      app.invitePayload.theme !== app.room.theme ||
      app.invitePayload.maxPlayers !== app.room.maxPlayers;
    if (inviteNeedsUpdate) {
      const nextInvitePayload = buildRoomInvitePayload(app.room);
      app.invitePayload = nextInvitePayload;
      changed = true;
    }
  }

  if (changed) {
    markUiDirty();
  }

  return changed;
}

function sendNicknameUpdate(force = false) {
  if (app.localRole !== "client" || !app.room || !app.localPlayerId) {
    return;
  }

  const nextName = normalizePlayerName(app.draftName, "Gunner");
  const localPlayer = getLocalPlayer();
  const previousName = localPlayer?.name ?? null;

  if (!force && previousName === nextName) {
    return;
  }

  if (localPlayer) {
    updatePlayerNickname(app.localPlayerId, nextName);
  }

  if (!app.network.clientConnection?.open) {
    return;
  }

  app.network.clientConnection.send({ type: "rename", name: nextName });
}

function syncNicknameInput(rawValue) {
  app.draftName = rawValue.slice(0, 18);
  persistProfile();

  if (!app.room || !app.localPlayerId) {
    markUiDirty();
    return;
  }

  if (app.localRole === "host") {
    const changed = updatePlayerNickname(app.localPlayerId, app.draftName, { syncHostIdentity: true });
    if (changed) {
      broadcastSnapshot(true);
    }
    return;
  }

  sendNicknameUpdate();
}

function resetGameForLobby(themeId, seed) {
  const terrainState = createTerrainState(themeId, seed);
  pendingDirtyRect = null;
  app.game = {
    phase: "lobby",
    theme: themeId,
    terrain: terrainState.terrain,
    bridgeFloor: terrainState.bridgeFloor,
    supportTerrain: terrainState.supportTerrain,
    supportBridgeFloor: terrainState.supportBridgeFloor,
    bitmap: terrainState.bitmap,
    players: [],
    projectiles: [],
    pendingShots: [],
    explosions: [],
    wind: 0,
    currentTurnIndex: 0,
    turnNumber: 0,
    banner: "로비가 열렸습니다.",
    winnerId: null,
    resolveTimer: 0,
    botTimer: 0,
  };
}

function destroyNetworking() {
  const previousNetwork = app.network;

  if (previousNetwork.reconnectTimer) {
    window.clearTimeout(previousNetwork.reconnectTimer);
  }
  if (previousNetwork.autoJoinTimer) {
    window.clearTimeout(previousNetwork.autoJoinTimer);
  }
  if (previousNetwork.snapshotFlushTimer) {
    window.clearTimeout(previousNetwork.snapshotFlushTimer);
  }
  if (previousNetwork.acceptanceTimer) {
    window.clearTimeout(previousNetwork.acceptanceTimer);
  }
  if (previousNetwork.helloRetryTimer) {
    window.clearTimeout(previousNetwork.helloRetryTimer);
  }

  app.network = createNetworkState();

  if (previousNetwork.clientConnection) {
    try {
      previousNetwork.clientConnection.close();
    } catch (error) {
      void error;
    }
  }

  previousNetwork.hostConnections.forEach((connection) => {
    try {
      connection.close();
    } catch (error) {
      void error;
    }
  });

  if (previousNetwork.peer) {
    try {
      previousNetwork.peer.destroy();
    } catch (error) {
      void error;
    }
  }
}

function leaveRoom(clearInvite = true) {
  destroyNetworking();
  app.localRole = null;
  app.chatLog = [];
  app.localPlayerId = null;
  app.room = null;
  app.input.manualPowerMarker = null;
  app.game = createEmptyGame(app.selectedTheme);
  updateStatus("대기 중", "sky");
  setTicker(
    "방을 만들면 초대 링크를 복사할 수 있고, 링크를 연 참가자는 승인 절차 없이 바로 로비에 입장합니다.",
  );
  if (clearInvite) {
    app.invitePayload = null;
    window.history.replaceState({}, "", window.location.pathname);
  }
  markUiDirty();
}

async function copyInviteLink() {
  if (!dom.inviteLinkField.value) {
    setTicker("초대 링크가 아직 준비되지 않았습니다.");
    return;
  }

  try {
    await navigator.clipboard.writeText(dom.inviteLinkField.value);
    setTicker("초대 링크를 복사했습니다.");
  } catch (error) {
    setTicker("클립보드 복사에 실패했습니다. 링크를 직접 길게 눌러 복사해주세요.");
  }
}

function layoutLobbyPlayers() {
  if (!app.game.players.length) {
    return;
  }

  const spacing = (WORLD_WIDTH - 220) / Math.max(app.game.players.length - 1, 1);
  app.game.players.forEach((player, index) => {
    player.x = app.game.players.length === 1 ? WORLD_WIDTH * 0.24 : 110 + spacing * index;
    flattenTerrain(app.game.terrain, player.x, 52);
    if (app.game.bitmap) applyExplosionCrater(player.x, surfaceYAt(app.game.bitmap, Math.round(player.x)), 52);
  });
  reflowPlayersOntoTerrain();
  app.game.players.forEach((player) => {
    player.aimSide = player.x < WORLD_WIDTH * 0.5 ? "right" : "left";
    player.angle = player.aimSide === "right" ? 58 : 122;
  });
}

function layoutBattlePlayers() {
  const candidates = getAlivePlayers(app.game.players);
  if (!candidates.length) {
    return;
  }

  const spacing = (WORLD_WIDTH - 200) / Math.max(candidates.length - 1, 1);
  candidates.forEach((player, index) => {
    player.x = candidates.length === 1 ? WORLD_WIDTH / 2 : 100 + spacing * index;
    flattenTerrain(app.game.terrain, player.x, 58);
    if (app.game.bitmap) applyExplosionCrater(player.x, surfaceYAt(app.game.bitmap, Math.round(player.x)), 58);
  });
  reflowPlayersOntoTerrain();
  candidates.forEach((player) => {
    player.aimSide = player.x < WORLD_WIDTH * 0.5 ? "right" : "left";
    player.angle = player.aimSide === "right" ? 56 : 124;
    player.power = clamp(player.power, MIN_POWER, MAX_POWER);
  });
}

function getAimSide(player) {
  if (player.aimSide === "left" || player.aimSide === "right") {
    return player.aimSide;
  }
  return player.angle > 90 ? "left" : "right";
}

function setupTurn() {
  const current = getCurrentPlayer();
  if (!current) {
    return;
  }

  app.game.players.forEach((player) => {
    player.isCharging = false;
    resetHeldActions(player);
  });
  current.fuel = TURN_FUEL;
  current.power = MIN_POWER;
  if (app.game.turnNumber === 1 || (app.game.turnNumber - 1) % 4 === 0) {
    app.game.wind = Number(((Math.random() - 0.5) * 0.36).toFixed(2));
  }
  app.game.botTimer = 950;
}

function endBattle(winner) {
  app.game.phase = "game-over";
  app.game.projectiles = [];
  app.game.pendingShots = [];
  app.game.winnerId = winner?.id ?? null;
  app.game.banner = winner
    ? `${winner.name} 승리! 나가서 새 로비를 열면 다시 시작할 수 있습니다.`
    : "모든 탱크가 쓰러졌습니다.";
  setTicker(app.game.banner);
  broadcastSnapshot(true);
  markUiDirty();
}

function destroyPlayer(player, message) {
  if (!player.alive) {
    return false;
  }
  player.alive = false;
  player.health = 0;
  player.shield = 0;
  player.isCharging = false;
  player.fallVelocity = 0;
  resetHeldActions(player);
  if (message) {
    setTicker(message);
  }
  return true;
}

function advanceTurn() {
  const alive = getAlivePlayers();
  if (alive.length <= 1) {
    endBattle(alive[0] ?? null);
    return;
  }

  const mgr = app.game.turnManager;
  if (!mgr) {
    // Fallback: should not happen in battle, but guard for safety
    endBattle(alive[0] ?? null);
    return;
  }

  // Mark dead tanks in the manager
  for (const p of app.game.players) {
    if (!p.alive) removeTurnTank(mgr, p.id);
  }
  normalizeTurnDelays(mgr);
  const nextId = pickNextTurn(mgr);
  const nextIndex = app.game.players.findIndex((p) => p.id === nextId);
  if (nextIndex < 0) {
    endBattle(alive[0] ?? null);
    return;
  }

  app.game.currentTurnIndex = nextIndex;
  app.game.turnNumber += 1;
  app.game.phase = "aim";
  app.game.resolveTimer = 0;
  setupTurn();
  setTicker(`${app.game.players[nextIndex].name}의 턴입니다.`);
  broadcastSnapshot(true);
  markUiDirty();
}

function startBattle() {
  if (app.localRole !== "host" || app.game.phase !== "lobby" || !app.network.isHostReady) {
    return;
  }

  const readyPlayers = app.game.players.filter((player) => player.connected || player.isBot);
  if (readyPlayers.length < 2) {
    setTicker("최소 2대의 탱크가 있어야 전투를 시작할 수 있습니다.");
    return;
  }

  app.game.phase = "aim";
  const terrainState = createTerrainState(app.room.theme, `${app.room.id}-battle-${Date.now()}`);
  app.game.terrain = terrainState.terrain;
  app.game.bridgeFloor = terrainState.bridgeFloor;
  app.game.supportTerrain = terrainState.supportTerrain;
  app.game.supportBridgeFloor = terrainState.supportBridgeFloor;
  app.game.projectiles = [];
  app.game.pendingShots = [];
  app.game.explosions = [];
  app.game.turnNumber = 1;
  app.game.currentTurnIndex = 0;
  app.game.winnerId = null;

  app.game.players = readyPlayers.map((player) => {
    let tankId = player.tankType;
    if (!TANK_TYPES[tankId] || tankId === "random") {
      tankId = resolveRandomTank();
    }
    const tank = TANK_TYPES[tankId];
    return {
      ...player,
      tankType: tankId,
      color: tank.visual?.primaryColor ?? "#ffb84f",
      health: tank.stats.maxHealth,
      maxHealth: tank.stats.maxHealth,
      shield: 0,
      aimSide: player.aimSide ?? "right",
      power: MIN_POWER,
      lastFiredPower: null,
      isCharging: false,
      fallVelocity: 0,
      alive: true,
      fuel: TURN_FUEL,
      selectedWeapon: "ss1",
      newUsesRemaining: 2,
    };
  });

  for (let i = app.game.players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [app.game.players[i], app.game.players[j]] = [app.game.players[j], app.game.players[i]];
  }

  app.game.turnManager = createTurnManager(
    app.game.players.map((p) => ({
      id: p.id,
      baseDelay: TANK_TYPES[p.tankType]?.stats?.baseDelay ?? 720,
    })),
  );
  const firstId = pickNextTurn(app.game.turnManager);
  app.game.currentTurnIndex = app.game.players.findIndex((p) => p.id === firstId);

  layoutBattlePlayers();
  setupTurn();
  setTicker(`${getCurrentPlayer().name}의 선공입니다.`);
  broadcastSnapshot(true);
  markUiDirty();
}

function getTurretBase(player) {
  return { x: player.x, y: player.y - 6 };
}

function getMuzzle(player) {
  const base = getTurretBase(player);
  const angle = degToRad(player.angle);
  return {
    x: base.x + Math.cos(angle) * 34,
    y: base.y - Math.sin(angle) * 34,
  };
}

function getLaunchSpeed(power, shot) {
  return (power / LAUNCH_SPEED_DIVISOR) * shot.speedMultiplier;
}

function findProjectileHomingTarget(projectile, players = app.game.players) {
  if (!projectile.homingRange || !projectile.homingTurnRate) {
    projectile.lockedTargetId = null;
    projectile.homingActive = false;
    return null;
  }

  const currentAngle = Math.atan2(projectile.vy, projectile.vx);
  const coneLimit = degToRad(projectile.homingCone ?? 88);
  const closeLockRange = projectile.homingRange * 0.58;
  const retainedTarget = players.find(
    (player) =>
      player.alive &&
      player.id === projectile.lockedTargetId &&
      player.id !== projectile.ownerId &&
      distance(projectile, player) <= projectile.homingRange * 1.22,
  );

  if (retainedTarget) {
    const retainedDistance = distance(projectile, retainedTarget);
    const retainedAngle = Math.atan2(retainedTarget.y - projectile.y, retainedTarget.x - projectile.x);
    const retainedCone = retainedDistance <= closeLockRange ? degToRad(170) : coneLimit;
    if (Math.abs(wrapAngleRadians(retainedAngle - currentAngle)) <= retainedCone) {
      projectile.homingActive = true;
      return retainedTarget;
    }
  }

  let bestTarget = null;
  let bestScore = Infinity;

  players.forEach((player) => {
    if (!player.alive || player.id === projectile.ownerId) {
      return;
    }

    const targetDistance = distance(projectile, player);
    if (targetDistance > projectile.homingRange) {
      return;
    }

    const desiredAngle = Math.atan2(player.y - projectile.y, player.x - projectile.x);
    const angleOffset = Math.abs(wrapAngleRadians(desiredAngle - currentAngle));
    const lockCone = targetDistance <= closeLockRange ? degToRad(155) : coneLimit;
    if (angleOffset > lockCone) {
      return;
    }

    const score = targetDistance + angleOffset * (targetDistance <= closeLockRange ? 12 : 26);
    if (score < bestScore) {
      bestScore = score;
      bestTarget = player;
    }
  });

  projectile.lockedTargetId = bestTarget?.id ?? null;
  projectile.homingActive = Boolean(bestTarget);
  return bestTarget;
}

function applyProjectileGuidance(projectile, frameScale, players = app.game.players) {
  const target = findProjectileHomingTarget(projectile, players);
  if (!target) {
    return;
  }

  const targetDistance = distance(projectile, target);
  const proximity = 1 - clamp(targetDistance / projectile.homingRange, 0, 1);
  const desiredAngle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
  const currentAngle = Math.atan2(projectile.vy, projectile.vx);
  const turnRate = projectile.homingTurnRate * (1 + proximity * 0.95);
  const maxTurn = degToRad(turnRate) * frameScale;
  const nextAngle = currentAngle + clamp(wrapAngleRadians(desiredAngle - currentAngle), -maxTurn, maxTurn);
  const speed = Math.max(Math.hypot(projectile.vx, projectile.vy), 0.001) * (1 + proximity * 0.035);

  projectile.vx = Math.cos(nextAngle) * speed;
  projectile.vy = Math.sin(nextAngle) * speed;
}

function spawnProjectile(player, shot) {
  const muzzle = getMuzzle(player);
  const angle = degToRad(player.angle + shot.spread);
  const speed = getLaunchSpeed(player.power, shot);
  app.game.projectiles.push({
    id: randomId("proj"),
    ownerId: player.id,
    x: muzzle.x,
    y: muzzle.y,
    vx: Math.cos(angle) * speed,
    vy: -Math.sin(angle) * speed,
    damage: shot.damage,
    radius: shot.radius,
    craterMultiplier: shot.craterMultiplier,
    gravityScale: shot.gravityScale,
    windFactor: shot.windFactor,
    directBonus: shot.directBonus ?? 0,
    homingRange: shot.homingRange ?? 0,
    homingTurnRate: shot.homingTurnRate ?? 0,
    homingCone: shot.homingCone ?? 0,
    homingActive: false,
    lockedTargetId: null,
    trail: shot.trail,
  });
}

function setSelectedWeapon(player, slot) {
  if (!player || !canLocalPlayerAct()) return;
  if (slot === "new" && (player.newUsesRemaining ?? 0) <= 0) {
    setTicker("NEW 무기 사용 횟수를 모두 소진했습니다.");
    return;
  }
  player.selectedWeapon = slot;
  markUiDirty();
}

function fireWeapon(player) {
  const tank = TANK_TYPES[player.tankType] ?? TANK_TYPES.armor;
  const slot = player.selectedWeapon ?? "ss1";
  if (slot === "new" && (player.newUsesRemaining ?? 0) <= 0) return;
  player.isCharging = false;
  player.lastFiredPower = Math.round(clamp(player.power, MIN_POWER, MAX_POWER));
  player.recoilPhase = 0;
  resetHeldActions(player);
  const weaponId = tank.weapons[slot];
  const weapon = WEAPONS[weaponId];
  const rng = createPurposeRng(app.game.matchSeed ?? 0, `combat:${app.game.turnNumber ?? 0}`);
  const muzzle = getMuzzle(player);
  const { projectiles } = simFireWeapon(
    { tanks: app.game.players, terrain: null, turn: app.game.turnManager },
    weaponId,
    { x: muzzle.x, y: muzzle.y },
    player.angle,
    player.power,
    app.game.wind,
    rng,
  );
  // Convert sim projectiles to game projectile format and add to pendingShots
  app.game.pendingShots = projectiles.map((p, index) => ({
    ...p,
    id: `${player.id}-${index}`,
    ownerId: player.id,
    delay: index * 0,
    spread: 0,
    speedMultiplier: 1,
  }));
  if (slot === "new") player.newUsesRemaining = Math.max(0, (player.newUsesRemaining ?? 2) - 1);
  // Self-heal for turtle weapons
  if (weapon?.projectile?.selfHeal) {
    resolveSelfHeal({}, projectiles[0], player);
  }
  app.game.phase = "projectile";
  const weaponName = weapon?.name ?? slot.toUpperCase();
  setTicker(`${player.name}의 ${weaponName} 발사!`);
}

function applyDamage(player, amount) {
  const tank = TANK_TYPES[player.tankType] ?? TANK_TYPES.armor;
  let damage = amount * (tank.stats?.armor ?? 1.0);

  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, damage * 0.55);
    player.shield -= absorbed;
    damage -= absorbed;
  }

  player.health = clamp(player.health - damage, 0, player.maxHealth);
  player.tintFlash = 1;
}

function carveTerrain(centerX, centerY, radius) {
  const start = clamp(Math.floor(centerX - radius - CRATER_EDGE), 0, WORLD_WIDTH - 1);
  const end = clamp(Math.ceil(centerX + radius + CRATER_EDGE), 0, WORLD_WIDTH - 1);

  const carveLayer = (terrain) => {
    if (!Array.isArray(terrain) || !terrain.length) {
      return;
    }
    for (let x = start; x <= end; x += 1) {
      const dx = x - centerX;
      if (Math.abs(dx) > radius) {
        continue;
      }
      const depth = Math.sqrt(radius * radius - dx * dx);
      const holeFloor = centerY + depth;
      terrain[x] = Math.round(clamp(Math.max(terrain[x], holeFloor), 200, WORLD_HEIGHT + VOID_TERRAIN_DEPTH));
    }
  };

  carveLayer(app.game.terrain);
  carveLayer(app.game.supportTerrain);
}

function resolveExplosion(projectile, impactPoint, directHitId = null) {
  const radius = projectile.radius;
  const craterRadius = projectile.radius * projectile.craterMultiplier;
  carveTerrain(impactPoint.x, impactPoint.y, craterRadius);
  app.game.explosions.push({
    id: randomId("boom"),
    x: impactPoint.x,
    y: impactPoint.y,
    radius,
    life: 1,
    color: projectile.trail,
  });

  app.game.players.forEach((player) => {
    if (!player.alive) {
      return;
    }

    const maxReach = radius + TANK_RADIUS;
    const distanceToBlast = distance({ x: player.x, y: player.y }, impactPoint);
    if (distanceToBlast > maxReach) {
      return;
    }

    const falloff = 1 - distanceToBlast / maxReach;
    const directBonus = directHitId === player.id ? projectile.directBonus : 0;
    const rawDamage = projectile.damage * clamp(falloff, 0.18, 1) + directBonus;
    applyDamage(player, rawDamage);
  });

  app.game.players.forEach((player) => {
    if (player.alive && player.health <= 0) {
      destroyPlayer(player, `${player.name} 탱크가 파괴되었습니다.`);
    }
  });

  const alive = getAlivePlayers();
  if (alive.length <= 1) {
    endBattle(alive[0] ?? null);
    return;
  }

  app.game.resolveTimer = 820;
  broadcastSnapshot(true);
  markUiDirty();
}

function processRenameRequest(playerId, nextName) {
  if (app.localRole !== "host") {
    return;
  }

  if (updatePlayerNickname(playerId, nextName)) {
    broadcastSnapshot(true);
  }
}

function processTankChangeRequest(playerId, tankId) {
  if (app.localRole !== "host" || app.game.phase !== "lobby") {
    return;
  }
  const player = app.game.players.find((p) => p.id === playerId);
  if (!player || !TANK_TYPES[tankId]) {
    return;
  }
  const tank = TANK_TYPES[tankId];
  player.tankType = tankId;
  player.color = tank.visual?.primaryColor ?? "#ffb84f";
  player.maxHealth = tank.stats.maxHealth;
  player.health = tank.stats.maxHealth;
  broadcastSnapshot(true);
  markUiDirty();
}

function processControlAction(playerId, action) {
  if (app.localRole !== "host") {
    return;
  }

  const player = app.game.players.find((entry) => entry.id === playerId);
  const current = getCurrentPlayer();
  if (!player || !current || current.id !== playerId || app.game.phase !== "aim" || !player.alive) {
    return;
  }

  if (!player.heldActions || !player.heldActionTimers) {
    resetHeldActions(player);
  }

  if (action.type === "charge-start") {
    if (!player.isCharging) {
      player.isCharging = true;
      resetHeldActions(player);
      player.power = clamp(player.power, MIN_POWER, MAX_POWER);
      broadcastSnapshot(true);
      markUiDirty();
    }
    return;
  }

  if (action.type === "charge-release") {
    if (player.isCharging) {
      player.isCharging = false;
      fireWeapon(player);
      if (app.game.turnManager) applyTurnAction(app.game.turnManager, { tankId: player.id, actionType: player.selectedWeapon ?? "ss1" });
      broadcastSnapshot(true);
      markUiDirty();
    }
    return;
  }

  if (player.isCharging) {
    return;
  }

  if (action.type === "hold-start" && HOLDABLE_ACTIONS.includes(action.actionType)) {
    const opposite = OPPOSITE_HOLD_ACTION[action.actionType];
    if (opposite) {
      player.heldActions[opposite] = false;
      player.heldActionTimers[opposite] = 0;
    }
    if (!player.heldActions[action.actionType]) {
      applyStepAction(player, action.actionType);
      player.heldActions[action.actionType] = true;
      player.heldActionTimers[action.actionType] = 0;
      broadcastSnapshot(true);
      markUiDirty();
    }
    return;
  }

  if (action.type === "hold-stop" && HOLDABLE_ACTIONS.includes(action.actionType)) {
    player.heldActions[action.actionType] = false;
    player.heldActionTimers[action.actionType] = 0;
    return;
  }

  applyStepAction(player, action.type);
  broadcastSnapshot(true);
  markUiDirty();
}

function applyStepAction(player, actionType) {
  if (actionType === "move-left" || actionType === "move-right") {
    const newAimSide = actionType === "move-left" ? "left" : "right";
    if (player.fuel <= 0) {
      if (player.aimSide !== newAimSide) {
        player.aimSide = newAimSide;
        player.angle = newAimSide === "right" ? 56 : 124;
        setTicker(`${player.name} 방향 전환.`);
        return true;
      }
      setTicker("연료가 부족합니다.");
      return false;
    }
    const direction = actionType === "move-left" ? -1 : 1;
    const tank = TANK_TYPES[player.tankType] ?? TANK_TYPES.armor;
    player.x = clamp(player.x + direction * MOVE_STEP * (tank.stats?.mobility ?? 1.0), 32, WORLD_WIDTH - 32);
    const groundY = getGroundYForPlayer(player.x, player.y);
    if (groundY !== null) {
      player.y = Math.min(player.y, groundY);
      if (player.y >= groundY) {
        player.fallVelocity = 0;
      }
    }
    player.fuel = clamp(player.fuel - MOVE_COST, 0, TURN_FUEL);
    if (app.game.turnManager) applyTurnAction(app.game.turnManager, { tankId: player.id, actionType: "move", fuelUsed: MOVE_COST });
    if (player.aimSide !== newAimSide) {
      player.aimSide = newAimSide;
      player.angle = newAimSide === "right" ? 56 : 124;
    }
    setTicker(`${player.name} 기동 중.`);
    return true;
  }

  if (actionType === "angle-up") {
    const aimSide = getAimSide(player);
    const minAngle = aimSide === "right" ? 12 : 90;
    const maxAngle = aimSide === "right" ? 90 : 168;
    const nextAngle =
      aimSide === "right"
        ? clamp(player.angle + ANGLE_STEP, minAngle, maxAngle)
        : clamp(player.angle - ANGLE_STEP, minAngle, maxAngle);
    player.angle = nextAngle;
    setTicker(`${player.name} 각도 ${Math.round(player.angle)}도`);
    return true;
  }

  if (actionType === "angle-down") {
    const aimSide = getAimSide(player);
    const minAngle = aimSide === "right" ? 12 : 90;
    const maxAngle = aimSide === "right" ? 90 : 168;
    const nextAngle =
      aimSide === "right"
        ? clamp(player.angle - ANGLE_STEP, minAngle, maxAngle)
        : clamp(player.angle + ANGLE_STEP, minAngle, maxAngle);
    player.angle = nextAngle;
    setTicker(`${player.name} 각도 ${Math.round(player.angle)}도`);
    return true;
  }

  return false;
}

function updateFallingPlayers(dtMs) {
  if (app.game.phase === "lobby" || app.game.phase === "game-over") {
    return;
  }

  const frameScale = dtMs / FRAME_STEP;
  let changed = false;
  let currentPlayerLost = false;
  const current = getCurrentPlayer();

  app.game.players.forEach((player) => {
    if (!player.alive) {
      return;
    }

    const groundY = getGroundYForPlayer(player.x, player.y);
    if (groundY === null || player.y < groundY - 0.5) {
      player.fallVelocity = clamp(
        (player.fallVelocity ?? 0) + PLAYER_FALL_ACCELERATION * frameScale,
        0,
        PLAYER_MAX_FALL_SPEED,
      );
      player.y += player.fallVelocity * frameScale;
      changed = true;
    } else if (player.y !== groundY || player.fallVelocity) {
      player.y = groundY;
      player.fallVelocity = 0;
      changed = true;
    }

    if (player.alive && player.y >= WORLD_HEIGHT) {
      destroyPlayer(player, `${player.name} 탱크가 맵 아래로 추락했습니다.`);
      changed = true;
      if (current?.id === player.id) {
        currentPlayerLost = true;
      }
    }
  });

  if (!changed) {
    return;
  }

  const alive = getAlivePlayers();
  if (alive.length <= 1) {
    endBattle(alive[0] ?? null);
    return;
  }

  if (currentPlayerLost && app.game.phase === "aim") {
    advanceTurn();
    return;
  }

  broadcastSnapshot();
  markUiDirty();
}

function sendAction(actionType) {
  if (!canLocalPlayerAct()) {
    setTicker("지금은 당신의 턴이 아닙니다.");
    return;
  }

  if (app.localRole === "host") {
    processControlAction(app.localPlayerId, { type: actionType });
    return;
  }

  if (!app.network.clientConnection?.open) {
    setTicker("호스트와 연결 중이라 아직 조작할 수 없습니다.");
    return;
  }

  app.network.clientConnection.send({ type: "action", action: { type: actionType } });
}

function sendActionPayload(actionType, payload = {}) {
  if (!canLocalPlayerAct()) {
    setTicker("지금은 당신의 턴이 아닙니다.");
    return;
  }

  const action = { type: actionType, ...payload };
  if (app.localRole === "host") {
    processControlAction(app.localPlayerId, action);
    return;
  }

  if (!app.network.clientConnection?.open) {
    setTicker("호스트와 연결 중이라 아직 조작할 수 없습니다.");
    return;
  }

  app.network.clientConnection.send({ type: "action", action });
}

function startHoldInput(actionType) {
  if (!canLocalPlayerAct()) {
    setTicker("지금은 당신의 턴이 아닙니다.");
    return;
  }
  if (!HOLDABLE_ACTIONS.includes(actionType) || app.input.heldActions.has(actionType)) {
    return;
  }
  const opposite = OPPOSITE_HOLD_ACTION[actionType];
  if (opposite) {
    stopHoldInput(opposite);
  }
  app.input.heldActions.add(actionType);
  sendActionPayload("hold-start", { actionType });
}

function stopHoldInput(actionType) {
  if (!app.input.heldActions.has(actionType)) {
    return;
  }
  app.input.heldActions.delete(actionType);
  sendActionPayload("hold-stop", { actionType });
}

function startChargeInput() {
  if (!canLocalPlayerAct()) {
    setTicker("지금은 당신의 턴이 아닙니다.");
    return;
  }
  if (app.input.isChargeHeld) {
    return;
  }
  Array.from(app.input.heldActions).forEach((actionType) => {
    stopHoldInput(actionType);
  });
  app.input.isChargeHeld = true;
  sendAction("charge-start");
}

function releaseChargeInput() {
  if (!app.input.isChargeHeld) {
    return;
  }
  app.input.isChargeHeld = false;
  sendAction("charge-release");
}

function clearLocalHeldInputs() {
  app.input.isChargeHeld = false;
  app.input.heldActions.clear();
}

function releaseAllHeldInputs() {
  Array.from(app.input.heldActions).forEach((actionType) => {
    stopHoldInput(actionType);
  });
  releaseChargeInput();
  clearLocalHeldInputs();
}

function updateCharging(dtMs) {
  const current = getCurrentPlayer();
  if (!current || !current.alive || !current.isCharging || app.game.phase !== "aim") {
    return;
  }

  const nextPower = clamp(current.power + CHARGE_RATE * (dtMs / 1000), MIN_POWER, MAX_POWER);
  if (nextPower !== current.power) {
    current.power = nextPower;
    broadcastSnapshot();
    markUiDirty();
  }
}

function updateHeldActions(dtMs) {
  const current = getCurrentPlayer();
  if (!current || !current.alive || current.isBot || current.isCharging || app.game.phase !== "aim") {
    return;
  }

  if (!current.heldActions || !current.heldActionTimers) {
    resetHeldActions(current);
    return;
  }

  let changed = false;

  HOLDABLE_ACTIONS.forEach((actionType) => {
    if (!current.heldActions[actionType]) {
      return;
    }

    current.heldActionTimers[actionType] += dtMs;
    while (current.heldActionTimers[actionType] >= HOLD_REPEAT_INTERVAL) {
      current.heldActionTimers[actionType] -= HOLD_REPEAT_INTERVAL;
      const applied = applyStepAction(current, actionType);
      if (!applied) {
        current.heldActions[actionType] = false;
        current.heldActionTimers[actionType] = 0;
        break;
      }
      changed = true;
    }
  });

  if (changed) {
    broadcastSnapshot(true);
    markUiDirty();
  }
}

function updateProjectiles(dtMs) {
  if (app.game.phase !== "projectile") {
    return;
  }

  app.game.pendingShots.forEach((shot) => {
    shot.delay -= dtMs;
  });
  const ready = app.game.pendingShots.filter((shot) => shot.delay <= 0);
  app.game.pendingShots = app.game.pendingShots.filter((shot) => shot.delay > 0);

  ready.forEach((shot) => {
    const owner = app.game.players.find((player) => player.id === shot.ownerId);
    if (owner?.alive) {
      spawnProjectile(owner, shot);
    }
  });

  const frameScale = dtMs / FRAME_STEP;
  const survivors = [];

  app.game.projectiles.forEach((projectile) => {
    let directHitId = null;
    projectile.vx += app.game.wind * projectile.windFactor * WIND_ACCELERATION * frameScale;
    projectile.vy += 0.23 * projectile.gravityScale * frameScale;
    applyProjectileGuidance(projectile, frameScale);
    projectile.x += projectile.vx * frameScale;
    projectile.y += projectile.vy * frameScale;

    for (const player of app.game.players) {
      if (!player.alive || player.id === projectile.ownerId) {
        continue;
      }
      if (distance({ x: projectile.x, y: projectile.y }, { x: player.x, y: player.y }) <= TANK_RADIUS) {
        directHitId = player.id;
        resolveExplosion(projectile, { x: projectile.x, y: projectile.y }, directHitId);
        return;
      }
    }

    if (projectile.x < -20 || projectile.x > WORLD_WIDTH + 20 || projectile.y > WORLD_HEIGHT + 40) {
      resolveExplosion(projectile, {
        x: clamp(projectile.x, 0, WORLD_WIDTH),
        y: clamp(projectile.y, 0, WORLD_HEIGHT - 8),
      });
      return;
    }

    if (isTerrainCollisionAt(projectile.x, projectile.y)) {
      resolveExplosion(projectile, { x: projectile.x, y: projectile.y });
      return;
    }

    survivors.push(projectile);
  });

  app.game.projectiles = survivors;
  app.game.explosions = app.game.explosions
    .map((explosion) => ({ ...explosion, life: explosion.life - dtMs / 520 }))
    .filter((explosion) => explosion.life > 0);

  if (!app.game.projectiles.length && !app.game.pendingShots.length && app.game.resolveTimer > 0) {
    app.game.resolveTimer -= dtMs;
    if (app.game.resolveTimer <= 0 && app.game.phase !== "game-over") {
      advanceTurn();
    }
  }

  broadcastSnapshot();
}

function findBotShot(player, target) {
  const wind = app.game.wind;
  const tank = TANK_TYPES[player.tankType] ?? TANK_TYPES.armor;
  const weaponId = tank.weapons["ss1"];
  const weaponDef = WEAPONS[weaponId] ?? {};
  const referenceShot = {
    speedMultiplier: weaponDef.projectile?.speedMultiplier ?? 1.0,
    gravityScale: weaponDef.projectile?.gravityScale ?? 1.0,
    windFactor: weaponDef.projectile?.windFactor ?? 1.0,
    homingRange: 0,
    homingTurnRate: 0,
    homingCone: 0,
  };
  const aimSide = getAimSide(player);
  const angleStart = aimSide === "right" ? 18 : 90;
  const angleEnd = aimSide === "right" ? 90 : 162;
  let best = { angle: clamp(player.angle, angleStart, angleEnd), power: player.power, score: Infinity };

  for (let angle = angleStart; angle <= angleEnd; angle += 4) {
    for (let power = 38; power <= MAX_POWER; power += 2) {
      const simProjectile = {
        x: player.x,
        y: player.y - 28,
        vx: Math.cos(degToRad(angle)) * getLaunchSpeed(power, referenceShot),
        vy: -Math.sin(degToRad(angle)) * getLaunchSpeed(power, referenceShot),
        ownerId: player.id,
        homingRange: 0,
        homingTurnRate: 0,
        homingCone: 0,
        homingActive: false,
        lockedTargetId: null,
      };
      let minDistance = Infinity;

      for (let step = 0; step < 160; step += 1) {
        simProjectile.vx += wind * referenceShot.windFactor * WIND_ACCELERATION;
        simProjectile.vy += 0.23 * referenceShot.gravityScale;
        applyProjectileGuidance(simProjectile, 1, [target]);
        simProjectile.x += simProjectile.vx;
        simProjectile.y += simProjectile.vy;
        minDistance = Math.min(
          minDistance,
          Math.hypot(target.x - simProjectile.x, target.y - simProjectile.y),
        );
        if (
          simProjectile.x < 0 ||
          simProjectile.x >= WORLD_WIDTH ||
          isTerrainCollisionAt(simProjectile.x, simProjectile.y) ||
          simProjectile.y > WORLD_HEIGHT
        ) {
          break;
        }
      }

      if (minDistance < best.score) {
        best = { angle, power, score: minDistance };
      }
    }
  }

  return best;
}

function updateBot(dtMs) {
  const current = getCurrentPlayer();
  if (!current || !current.alive || !current.isBot || app.game.phase !== "aim") {
    return;
  }

  app.game.botTimer -= dtMs;
  if (app.game.botTimer > 0) {
    return;
  }

  const targets = getAlivePlayers(app.game.players).filter((player) => player.id !== current.id);
  if (!targets.length) {
    return;
  }

  const target = targets.reduce((best, player) => {
    if (!best) {
      return player;
    }
    return Math.abs(player.x - current.x) < Math.abs(best.x - current.x) ? player : best;
  }, null);

  const plan = findBotShot(current, target);
  current.angle = plan.angle;
  current.power = plan.power;
  setTicker(`${current.name}가 ${target.name}에게 조준합니다.`);
  fireWeapon(current);
  if (app.game.turnManager) applyTurnAction(app.game.turnManager, { tankId: current.id, actionType: current.selectedWeapon ?? "ss1" });
  broadcastSnapshot(true);
  markUiDirty();
}

function updateHostSimulation(dtMs) {
  if (!app.room) {
    return;
  }

  if (app.game.phase === "projectile") {
    updateProjectiles(dtMs);
  } else if (app.game.phase === "aim") {
    updateHeldActions(dtMs);
    updateCharging(dtMs);
    updateBot(dtMs);
  }

  if (app.game.phase !== "lobby" && app.game.phase !== "game-over") {
    updateFallingPlayers(dtMs);
  }
}

function spawnVisualExplosion(projectile, impactPoint) {
  app.game.explosions.push({
    id: randomId("vfx"),
    x: impactPoint.x,
    y: impactPoint.y,
    radius: projectile.radius,
    life: 0.7,
    color: projectile.trail,
  });
}

function updateClientVisuals(dtMs) {
  if (app.localRole !== "client" || !app.network.accepted) {
    return;
  }

  app.game.explosions = app.game.explosions
    .map((explosion) => ({ ...explosion, life: explosion.life - dtMs / 520 }))
    .filter((explosion) => explosion.life > 0);

  if (app.game.phase !== "projectile") {
    return;
  }

  app.game.pendingShots.forEach((shot) => {
    shot.delay -= dtMs;
  });
  const readyShots = app.game.pendingShots.filter((shot) => shot.delay <= 0);
  app.game.pendingShots = app.game.pendingShots.filter((shot) => shot.delay > 0);

  readyShots.forEach((shot) => {
    const owner = app.game.players.find((player) => player.id === shot.ownerId);
    if (owner?.alive) {
      spawnProjectile(owner, shot);
    }
  });

  const frameScale = dtMs / FRAME_STEP;
  const survivors = [];
  app.game.projectiles.forEach((projectile) => {
    projectile.vx += app.game.wind * projectile.windFactor * WIND_ACCELERATION * frameScale;
    projectile.vy += 0.23 * projectile.gravityScale * frameScale;
    applyProjectileGuidance(projectile, frameScale);
    projectile.x += projectile.vx * frameScale;
    projectile.y += projectile.vy * frameScale;

    if (projectile.x < -20 || projectile.x > WORLD_WIDTH + 20 || projectile.y > WORLD_HEIGHT + 40) {
      spawnVisualExplosion(projectile, {
        x: clamp(projectile.x, 0, WORLD_WIDTH),
        y: clamp(projectile.y, 0, WORLD_HEIGHT - 8),
      });
      return;
    }

    if (isTerrainCollisionAt(projectile.x, projectile.y)) {
      spawnVisualExplosion(projectile, { x: projectile.x, y: projectile.y });
      return;
    }

    survivors.push(projectile);
  });

  app.game.projectiles = survivors;
}

function addBot() {
  if (app.localRole !== "host" || app.game.phase !== "lobby" || !app.room) {
    return;
  }
  if (app.game.players.length >= app.room.maxPlayers) {
    setTicker("로비가 꽉 찼습니다.");
    return;
  }

  const availableNames = BOT_NAMES.filter(
    (name) => !app.game.players.some((player) => player.name === name),
  );
  const botName = availableNames[0] ?? `Bot-${app.game.players.length + 1}`;
  const tankIds = Object.keys(TANK_TYPES);
  const tankType = tankIds[app.game.players.length % tankIds.length];
  const bot = createPlayer({
    id: randomId("bot"),
    name: botName,
    tankType,
    isBot: true,
    connected: true,
  });
  app.game.players.push(bot);
  layoutLobbyPlayers();
  updateStatus(`호스트 · ${app.game.players.length}명`, "sand");
  setTicker(`${botName} 봇을 로비에 배치했습니다.`);
  broadcastSnapshot(true);
  markUiDirty();
}

function getPeerCtor() {
  return window.Peer;
}

function createHostRoom() {
  const PeerCtor = getPeerCtor();
  if (!PeerCtor) {
    updateStatus("연결 모듈 오류", "sand");
    setTicker("브라우저 피어 연결 모듈을 불러오지 못했습니다.");
    return;
  }

  leaveRoom(false);
  app.invitePayload = null;
  window.history.replaceState({}, "", window.location.pathname);

  const hostName = (dom.playerNameInput.value.trim() || "Commander").slice(0, 18);
  const roomId = randomId("room");
  const themeId = THEMES[app.selectedTheme] ? app.selectedTheme : getThemeByRoomId(roomId);
  const roomName = createAutoRoomName(hostName, themeId);
  const hostPeerId = `fortress-${roomId}`;

  app.draftName = hostName;
  app.localRole = "host";
  app.localPlayerId = randomId("player");
  app.room = {
    id: roomId,
    name: roomName,
    hostName,
    hostPeerId,
    theme: themeId,
    maxPlayers: MAX_PLAYERS,
  };

  resetGameForLobby(themeId, roomId);
  const hostPlayer = createPlayer({
    id: app.localPlayerId,
    name: hostName,
    tankType: app.selectedTank,
    isHost: true,
    connected: true,
  });
  hostPlayer.x = WORLD_WIDTH * 0.24;
  flattenTerrain(app.game.terrain, hostPlayer.x);
  if (app.game.bitmap) applyExplosionCrater(hostPlayer.x, surfaceYAt(app.game.bitmap, Math.round(hostPlayer.x)), 46);
  hostPlayer.y = getTerrainYAt(hostPlayer.x) - 17;
  app.game.players = [hostPlayer];

  const peer = new PeerCtor(hostPeerId, PEER_CONFIG);
  app.network.peer = peer;
  app.network.peerId = hostPeerId;
  app.network.isHostReady = false;

  updateStatus("로비 여는 중", "sky");
  setTicker("방을 만들었습니다. 연결 게이트를 여는 중입니다.");

  peer.on("open", (id) => {
    if (app.network.peer !== peer || app.localRole !== "host" || !app.room || app.room.id !== roomId) {
      return;
    }
    app.network.isHostReady = true;
    app.room.hostPeerId = id;
    app.invitePayload = buildRoomInvitePayload(app.room);
    updateStatus(`호스트 · ${app.game.players.length}명`, "sand");
    setTicker("초대 링크를 연 참가자는 별도 승인 없이 바로 로비에 입장합니다.");
    markUiDirty();
  });

  peer.on("connection", (connection) => {
    if (app.network.peer !== peer || app.localRole !== "host") {
      try {
        connection.close();
      } catch (error) {
        void error;
      }
      return;
    }
    setupIncomingConnection(connection);
  });

  peer.on("error", (error) => {
    if (app.network.peer !== peer || app.localRole !== "host") {
      return;
    }
    updateStatus("연결 오류", "sand");
    setTicker("호스트 연결을 열지 못했습니다. 잠시 후 다시 시도해주세요.");
    console.error(error);
    markUiDirty();
  });

  persistProfile();
  markUiDirty();
}

function setupIncomingConnection(connection) {

  const sendAcceptedPacket = () => {
    if (!connection.open || !app.room || !connection._pendingPlayerId) {

      return;
    }
    connection.send({
      type: "accepted",
      room: cloneSimple(app.room),
      playerId: connection._pendingPlayerId,
    });
  };

  const prepareIncomingConnection = () => {
    if (connection._joinedLobby || connection._pendingPlayerId) {
      return true;
    }
    const metadata = connection.metadata || {};
    const playerId = metadata.playerId;

    if (!app.room || metadata.roomId !== app.room.id) {
      connection.send({ type: "rejected", reason: "room-mismatch" });
      connection.close();
      return;
    }

    if (app.game.phase !== "lobby") {
      connection.send({ type: "rejected", reason: "match-running" });
      connection.close();
      return;
    }

    if (!playerId || app.game.players.some((player) => player.id === playerId)) {
      connection.send({ type: "rejected", reason: "duplicate" });
      connection.close();
      return;
    }

    if (app.game.players.length >= app.room.maxPlayers) {
      connection.send({ type: "rejected", reason: "full" });
      connection.close();
      return;
    }

    const tankType = TANK_TYPES[metadata.tankType] ? metadata.tankType : "armor";
    const playerName = (metadata.playerName || "Gunner").slice(0, 18);
    const player = createPlayer({
      id: playerId,
      name: playerName,
      tankType,
      connected: true,
    });

    connection._pendingPlayerId = playerId;
    connection._pendingPlayer = player;
    return true;
  };

  const scheduleAcceptedRetry = () => {
    if (connection._acceptRetryTimer) {
      window.clearTimeout(connection._acceptRetryTimer);
    }
    connection._acceptRetryTimer = window.setTimeout(() => {
      if (!connection._joinedLobby && connection._pendingPlayerId && connection.open) {
        sendAcceptedPacket();
        scheduleAcceptedRetry();
      }
    }, 320);
  };

  const finalizeIncomingConnection = () => {
    if (connection._joinedLobby || !connection._pendingPlayerId || !connection._pendingPlayer) {
      return;
    }

    const playerId = connection._pendingPlayerId;
    const player = connection._pendingPlayer;

    if (connection._acceptRetryTimer) {
      window.clearTimeout(connection._acceptRetryTimer);
      connection._acceptRetryTimer = null;
    }

    connection._playerId = playerId;
    connection._joinedLobby = true;
    connection._pendingPlayerId = null;
    connection._pendingPlayer = null;
    app.network.hostConnections.set(playerId, connection);
    app.game.players.push(player);
    layoutLobbyPlayers();
    updateStatus(`호스트 · ${app.game.players.length}명`, "sand");
    setTicker(`${player.name} 탱크가 로비에 입장했습니다.`);

    if (app.network.snapshotFlushTimer) {
      window.clearTimeout(app.network.snapshotFlushTimer);
    }
    app.network.snapshotFlushTimer = window.setTimeout(() => {
      if (app.network.hostConnections.get(playerId) === connection) {
        broadcastSnapshot(true);
      }
    }, 80);
    markUiDirty();
  };

  connection.on("open", () => {
    if (connection._pendingPlayerId && !connection._joinedLobby) {
      sendAcceptedPacket();
    }
  });

  connection.on("data", (data) => {
    const message = normalizeIncoming(data);
    if (!message) {
      return;
    }

    if (!connection._joinedLobby) {
      if (message.type === "hello") {
        if (!prepareIncomingConnection()) {
          return;
        }
        sendAcceptedPacket();
        scheduleAcceptedRetry();
        return;
      }
      if (message.type === "accepted-ack") {
        finalizeIncomingConnection();
      }
      if (!connection._joinedLobby) {
        return;
      }
    }

    if (!connection._playerId || app.network.hostConnections.get(connection._playerId) !== connection) {
      return;
    }

    if (message.type === "action") {
      processControlAction(connection._playerId, message.action);
      return;
    }
    if (message.type === "rename" && typeof message.name === "string") {
      processRenameRequest(connection._playerId, message.name);
    }
    if (message.type === "tank-change" && TANK_TYPES[message.tankId]) {
      processTankChangeRequest(connection._playerId, message.tankId);
    }
    if (message.type === "chat" && typeof message.text === "string") {
      const player = app.game.players.find((p) => p.id === connection._playerId);
      const name = player?.name ?? "???";
      const text = message.text.trim().slice(0, 100);
      if (text) {
        addChatMessage(connection._playerId, name, text);
        broadcastChatMessage(connection._playerId, name, text);
      }
    }
  });

  const handleClose = () => {
    if (connection._acceptRetryTimer) {
      window.clearTimeout(connection._acceptRetryTimer);
      connection._acceptRetryTimer = null;
    }
    const playerId = connection._playerId;
    if (!playerId || app.network.hostConnections.get(playerId) !== connection) {
      return;
    }
    app.network.hostConnections.delete(playerId);
    const player = app.game.players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }

    if (app.game.phase === "lobby") {
      app.game.players = app.game.players.filter((entry) => entry.id !== playerId);
      layoutLobbyPlayers();
      updateStatus(`호스트 · ${app.game.players.length}명`, "sand");
      setTicker(`${player.name}가 로비에서 나갔습니다.`);
    } else if (!player.isBot) {
      player.connected = false;
      player.isBot = true;
      setTicker(`${player.name} 연결이 끊겨 봇 전투로 전환합니다.`);
    }
    broadcastSnapshot(true);
    markUiDirty();
  };

  connection.on("close", handleClose);
  connection.on("error", (error) => {
    console.error(error);
    if (!connection.open) {
      handleClose();
    }
  });
}

function connectFromInvite() {
  const PeerCtor = getPeerCtor();
  if (!PeerCtor || !app.invitePayload) {
    return;
  }

  destroyNetworking();
  app.localRole = "client";
  app.localPlayerId = randomId("player");
  app.draftName = (dom.playerNameInput.value.trim() || "Gunner").slice(0, 18);
  persistProfile();

  app.room = {
    id: app.invitePayload.roomId,
    name: app.invitePayload.roomName,
    hostName: app.invitePayload.hostName,
    hostPeerId: app.invitePayload.hostPeerId,
    theme: app.invitePayload.theme,
    maxPlayers: app.invitePayload.maxPlayers ?? MAX_PLAYERS,
  };
  resetGameForLobby(app.room.theme, app.room.id);
  updateStatus("입장 중", "sky");
  setTicker("초대 링크를 감지했습니다. 호스트 로비에 바로 접속하는 중입니다.");

  const peer = new PeerCtor(undefined, PEER_CONFIG);
  app.network.peer = peer;
  app.network.joinAttempts = 0;
  app.network.accepted = false;
  app.network.snapshotReceived = false;

  peer.on("open", () => {
    if (app.network.peer !== peer || app.localRole !== "client") {
      return;
    }
    beginClientConnection();
  });

  peer.on("error", (error) => {
    if (app.network.peer !== peer || app.localRole !== "client") {
      return;
    }
    console.error(error);
    handleClientConnectionFailure();
  });

  markUiDirty();
}

function beginClientConnection() {
  if (!app.network.peer || !app.invitePayload || !app.room) {
    return;
  }

  app.network.accepted = false;
  app.network.snapshotReceived = false;

  const connection = app.network.peer.connect(app.invitePayload.hostPeerId, {
    reliable: true,
    serialization: "json",
    metadata: {
      roomId: app.invitePayload.roomId,
      playerId: app.localPlayerId,
      playerName: app.draftName,
      tankType: app.selectedTank,
    },
  });

  app.network.clientConnection = connection;
  app.network.joinAttempts += 1;

  const scheduleHelloRetry = (messageType = "hello") => {
    if (app.network.helloRetryTimer) {
      window.clearTimeout(app.network.helloRetryTimer);
    }
    app.network.helloRetryTimer = window.setTimeout(() => {
      const waitingForAcceptance = messageType === "hello" && !app.network.accepted;
      const waitingForSnapshot = messageType === "accepted-ack" && app.network.accepted && !app.network.snapshotReceived;
      if (
        app.network.clientConnection !== connection ||
        !connection.open ||
        (!waitingForAcceptance && !waitingForSnapshot)
      ) {
        return;
      }
      connection.send({ type: messageType });
      scheduleHelloRetry(messageType);
    }, 320);
  };

  connection.on("open", () => {
    if (app.network.clientConnection !== connection || app.localRole !== "client") {
      return;
    }
    updateStatus("입장 연결 중", "sky");
    setTicker("호스트 로비 게이트에 닿았습니다. 잠시만 기다려주세요.");
    connection.send({ type: "hello" });
    scheduleHelloRetry("hello");
    if (app.network.acceptanceTimer) {
      window.clearTimeout(app.network.acceptanceTimer);
    }
    app.network.acceptanceTimer = window.setTimeout(() => {
      if (app.network.clientConnection === connection && !app.network.accepted) {
        try {
          connection.close();
        } catch (error) {
          void error;
        }
      }
    }, 1800);
    markUiDirty();
  });

  connection.on("data", (data) => {
    if (app.network.clientConnection !== connection || app.localRole !== "client") {
      return;
    }
    handleHostMessage(normalizeIncoming(data));
  });

  connection.on("close", () => {
    if (app.network.clientConnection !== connection || app.localRole !== "client") {
      return;
    }
    handleClientConnectionFailure();
  });

  connection.on("error", () => {
    if (app.network.clientConnection !== connection || app.localRole !== "client") {
      return;
    }
    handleClientConnectionFailure();
  });
}

function scheduleAcceptedAckRetry() {
  if (app.network.helloRetryTimer) {
    window.clearTimeout(app.network.helloRetryTimer);
  }
  app.network.helloRetryTimer = window.setTimeout(() => {
    const connection = app.network.clientConnection;
    if (
      !connection ||
      !connection.open ||
      !app.network.accepted ||
      app.network.snapshotReceived
    ) {
      return;
    }
    connection.send({ type: "accepted-ack" });
    scheduleAcceptedAckRetry();
  }, 320);
}

function handleHostMessage(message) {
  if (!message) {
    return;
  }

  if (message.type === "accepted") {
    if (app.network.acceptanceTimer) {
      window.clearTimeout(app.network.acceptanceTimer);
      app.network.acceptanceTimer = null;
    }
    app.network.accepted = true;
    app.room = message.room;
    app.network.snapshotReceived = false;
    if (app.network.clientConnection?.open) {
      app.network.clientConnection.send({ type: "accepted-ack" });
      scheduleAcceptedAckRetry();
    }
    updateStatus("로비 입장 완료", "sand");
    setTicker("초대 링크만으로 바로 로비에 입장했습니다.");
    markUiDirty();
    return;
  }

  if (message.type === "rejected") {
    if (app.network.acceptanceTimer) {
      window.clearTimeout(app.network.acceptanceTimer);
      app.network.acceptanceTimer = null;
    }
    if (app.network.helloRetryTimer) {
      window.clearTimeout(app.network.helloRetryTimer);
      app.network.helloRetryTimer = null;
    }
    const map = {
      "room-mismatch": "초대 링크가 현재 열려 있는 로비와 맞지 않습니다.",
      "match-running": "이미 전투가 시작된 방입니다.",
      duplicate: "이미 사용 중인 참가 정보입니다. 다시 입장해주세요.",
      full: "방 정원이 가득 찼습니다.",
    };
    updateStatus("입장 실패", "sand");
    setTicker(map[message.reason] ?? "로비 입장에 실패했습니다.");
    markUiDirty();
    return;
  }

  if (message.type === "chat") {
    addChatMessage(message.playerId, message.playerName, message.text);
    return;
  }

  if (message.type === "terrain-sync") {
    const key = message.key;
    if (
      (key === "terrain" || key === "bridgeFloor" || key === "supportTerrain" || key === "supportBridgeFloor") &&
      Array.isArray(message.data)
    ) {
      app.game[key] = message.data;
    }
    return;
  }

  if (message.type === "snapshot") {
    app.network.snapshotReceived = true;
    if (app.network.helloRetryTimer) {
      window.clearTimeout(app.network.helloRetryTimer);
      app.network.helloRetryTimer = null;
    }
    app.room = message.snapshot.room;
    const incomingGame = message.snapshot.game;
    // Rehydrate turnManager from snapshot if present
    let rehydratedTurnManager = app.game.turnManager ?? null;
    if (incomingGame.turnManager && Array.isArray(incomingGame.turnManager.tanks)) {
      if (!rehydratedTurnManager) {
        rehydratedTurnManager = createTurnManager(incomingGame.turnManager.tanks);
      }
      rehydratedTurnManager.tanks = incomingGame.turnManager.tanks.map((t) => ({ ...t }));
      rehydratedTurnManager.pendingStatuses = incomingGame.turnManager.pendingStatuses ?? {};
      rehydratedTurnManager.history = incomingGame.turnManager.history ?? [];
    }
    const mergedTerrain = Array.isArray(incomingGame.terrain) ? incomingGame.terrain : app.game.terrain;
    const mergedThemeId = incomingGame.theme ?? app.game.theme ?? DEFAULT_THEME_ID;
    // Rebuild bitmap when terrain snapshot arrives
    let mergedBitmap = app.game.bitmap;
    if (Array.isArray(incomingGame.terrain)) {
      const mergedTheme = getTheme(mergedThemeId);
      const bitmapH = WORLD_HEIGHT + VOID_TERRAIN_DEPTH;
      mergedBitmap = createTerrain({ width: WORLD_WIDTH, height: bitmapH, matchSeed: incomingGame.seed ?? "", themeId: mergedThemeId });
      rasterizeHeightmap(mergedBitmap, mergedTerrain, (x, y) => colorForTheme(mergedTheme, x, y, bitmapH));
      pendingDirtyRect = null;
    }
    app.game = {
      ...incomingGame,
      turnManager: rehydratedTurnManager,
      terrain: mergedTerrain,
      bitmap: mergedBitmap,
      bridgeFloor:
        "bridgeFloor" in incomingGame
          ? Array.isArray(incomingGame.bridgeFloor)
            ? incomingGame.bridgeFloor
            : null
          : app.game.bridgeFloor,
      supportTerrain:
        "supportTerrain" in incomingGame
          ? Array.isArray(incomingGame.supportTerrain)
            ? incomingGame.supportTerrain
            : null
          : app.game.supportTerrain,
      supportBridgeFloor:
        "supportBridgeFloor" in incomingGame
          ? Array.isArray(incomingGame.supportBridgeFloor)
            ? incomingGame.supportBridgeFloor
            : null
          : app.game.supportBridgeFloor,
    };
    if (app.network.accepted) {
      updateStatus(app.game.phase === "lobby" ? "로비 연결됨" : "전투 연결됨", "sand");
    }
    if (app.game.banner) {
      app.ticker = app.game.banner;
    }
    markUiDirty();
  }
}

function handleClientConnectionFailure() {
  if (app.network.acceptanceTimer) {
    window.clearTimeout(app.network.acceptanceTimer);
    app.network.acceptanceTimer = null;
  }
  if (app.network.helloRetryTimer) {
    window.clearTimeout(app.network.helloRetryTimer);
    app.network.helloRetryTimer = null;
  }

  if (app.localRole !== "client" || app.network.accepted) {
    if (app.localRole === "client" && app.network.accepted) {
      updateStatus("연결 끊김", "sand");
      setTicker("호스트 연결이 끊겼습니다. 나가서 다시 입장해주세요.");
      markUiDirty();
    }
    return;
  }

  if (app.network.reconnectTimer) {
    window.clearTimeout(app.network.reconnectTimer);
  }

  if (app.network.joinAttempts < 3) {
    updateStatus("재접속 중", "sky");
    setTicker(`호스트 로비에 다시 접속하는 중입니다. (${app.network.joinAttempts}/3)`);
    app.network.reconnectTimer = window.setTimeout(() => {
      beginClientConnection();
    }, 900);
    markUiDirty();
    return;
  }

  updateStatus("입장 실패", "sand");
  setTicker("호스트와 연결하지 못했습니다. 호스트가 방을 연 뒤 링크를 다시 열어주세요.");
  markUiDirty();
}

function scheduleAutoJoin() {
  if (!app.invitePayload || app.localRole || app.room) {
    return;
  }

  if (app.network.autoJoinTimer) {
    window.clearTimeout(app.network.autoJoinTimer);
  }

  app.network.autoJoinTimer = window.setTimeout(() => {
    connectFromInvite();
  }, 420);
}

function parseInviteHashOnLoad() {
  const parsed = parseLinkPayload(window.location.hash, "join");
  if (!parsed) {
    return;
  }

  app.invitePayload = parsed.payload;
  app.game.theme = parsed.payload.theme ?? app.selectedTheme;
  const terrainState = createTerrainState(app.game.theme, parsed.payload.roomId ?? "invite-preview");
  app.game.terrain = terrainState.terrain;
  app.game.bridgeFloor = terrainState.bridgeFloor;
  app.game.supportTerrain = terrainState.supportTerrain;
  app.game.supportBridgeFloor = terrainState.supportBridgeFloor;
  updateStatus("초대 링크 감지", "sky");
  setTicker("초대 링크를 받았습니다. 잠시 후 자동으로 로비에 입장합니다.");
  scheduleAutoJoin();
}

function selectTank(tankId) {
  if (!TANK_TYPES[tankId] || app.selectedTank === tankId) {
    return;
  }
  if (app.room && app.game.phase !== "lobby") {
    return;
  }
  app.selectedTank = tankId;
  persistProfile();
  markUiDirty();

  if (app.localRole === "host" && app.room && app.localPlayerId) {
    const hostPlayer = app.game.players.find((p) => p.id === app.localPlayerId);
    if (hostPlayer) {
      const tank = TANK_TYPES[tankId];
      hostPlayer.tankType = tankId;
      hostPlayer.color = tank.visual?.primaryColor ?? "#ffb84f";
      hostPlayer.maxHealth = tank.stats.maxHealth;
      hostPlayer.health = tank.stats.maxHealth;
      broadcastSnapshot(true);
    }
  }

  if (app.localRole === "client" && app.network.clientConnection?.open) {
    app.network.clientConnection.send({ type: "tank-change", tankId });
  }

  renderUi();
}

function selectRandomTank() {
  app.selectedTank = "random";
  persistProfile();
  setTicker("랜덤 셀렉트! 게임이 시작되면 탱크가 결정됩니다.");

  if (app.localRole === "host" && app.room && app.localPlayerId) {
    const hostPlayer = app.game.players.find((p) => p.id === app.localPlayerId);
    if (hostPlayer) {
      hostPlayer.tankType = "random";
      broadcastSnapshot(true);
    }
  }

  if (app.localRole === "client" && app.network.clientConnection?.open) {
    app.network.clientConnection.send({ type: "tank-change", tankId: "random" });
  }

  markUiDirty();
  renderUi();
}

function resolveRandomTank() {
  const allTanks = Object.keys(TANK_TYPES);
  return allTanks[Math.floor(Math.random() * allTanks.length)];
}

function drawPreviewTrackSegment(context, x, y, width, height, color) {
  context.fillStyle = color;
  roundRect(context, x, y, width, height, Math.min(height * 0.45, 8), true, false);
}

function drawTankPreview(context, tankId, color, variant = "tile") {
  if (!context) {
    return;
  }

  const width = context.canvas.width;
  const height = context.canvas.height;
  const profile = {
    hero: { x: 0.48, y: 0.82, scale: 1.06, angle: -0.44 },
    tile: { x: 0.5, y: 0.82, scale: 0.82, angle: -0.38 },
    pill: { x: 0.5, y: 0.82, scale: 0.68, angle: -0.34 },
  }[variant] ?? { x: 0.5, y: 0.82, scale: 0.82, angle: -0.38 };

  const deep = shadeHex(color, -28);
  const glow = shadeHex(color, 24);
  const trim = colorWithAlpha("#ffffff", 0.74);
  const ink = "#1f3348";
  const scale = Math.min(width / 96, height / 76) * profile.scale;

  context.clearRect(0, 0, width, height);
  context.save();
  context.translate(width * profile.x, height * profile.y);
  context.scale(scale, scale);

  context.fillStyle = "rgba(17, 39, 62, 0.16)";
  context.beginPath();
  context.ellipse(0, 16, 28, 8, 0, 0, Math.PI * 2);
  context.fill();

  if (tankId === "skyrider") {
    context.fillStyle = colorWithAlpha("#dffcff", 0.45);
    context.beginPath();
    context.ellipse(0, 6, 31, 10, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ink;
    roundRect(context, -26, 2, 52, 14, 10, true, false);
    drawPreviewTrackSegment(context, -21, 6, 16, 5, "#86f7ff");
    drawPreviewTrackSegment(context, 5, 6, 16, 5, "#86f7ff");
    context.strokeStyle = trim;
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(-33, 4);
    context.lineTo(-18, -8);
    context.lineTo(-8, 4);
    context.moveTo(33, 4);
    context.lineTo(18, -8);
    context.lineTo(8, 4);
    context.stroke();
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(-24, 7);
    context.quadraticCurveTo(-14, -18, 0, -20);
    context.quadraticCurveTo(16, -18, 24, 5);
    context.quadraticCurveTo(12, 11, -18, 11);
    context.closePath();
    context.fill();
    context.strokeStyle = trim;
    context.lineWidth = 2.4;
    context.stroke();
    context.fillStyle = "#f7feff";
    roundRect(context, -10, -24, 20, 10, 5, true, false);
    context.strokeStyle = colorWithAlpha("#dbffff", 0.85);
    context.beginPath();
    context.moveTo(0, -18);
    context.lineTo(Math.cos(profile.angle) * 33, -18 + Math.sin(profile.angle) * 33);
    context.stroke();
  } else if (tankId === "twinfang") {
    context.fillStyle = ink;
    roundRect(context, -26, 1, 52, 16, 11, true, false);
    drawPreviewTrackSegment(context, -22, 4, 18, 8, "#213446");
    drawPreviewTrackSegment(context, 0, 4, 18, 8, "#213446");
    context.fillStyle = color;
    roundRect(context, -24, -15, 48, 24, 11, true, false);
    context.fillStyle = deep;
    roundRect(context, -21, -8, 18, 12, 6, true, false);
    roundRect(context, 3, -8, 18, 12, 6, true, false);
    context.fillStyle = "#fff4ff";
    roundRect(context, -16, -20, 11, 8, 4, true, false);
    roundRect(context, 5, -20, 11, 8, 4, true, false);
    context.strokeStyle = trim;
    context.lineWidth = 3.1;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-5, -18);
    context.lineTo(-5 + Math.cos(profile.angle) * 28, -18 + Math.sin(profile.angle) * 28);
    context.moveTo(5, -18);
    context.lineTo(5 + Math.cos(profile.angle) * 28, -18 + Math.sin(profile.angle) * 28);
    context.stroke();
  } else if (tankId === "mole") {
    context.fillStyle = ink;
    roundRect(context, -29, 0, 58, 18, 12, true, false);
    drawPreviewTrackSegment(context, -24, 3, 14, 9, "#213446");
    drawPreviewTrackSegment(context, -6, 3, 14, 9, "#213446");
    drawPreviewTrackSegment(context, 12, 3, 14, 9, "#213446");
    context.fillStyle = color;
    roundRect(context, -24, -13, 48, 23, 11, true, false);
    context.fillStyle = deep;
    roundRect(context, -16, -29, 32, 11, 5, true, false);
    context.fillStyle = colorWithAlpha("#f4ffe6", 0.94);
    roundRect(context, -11, -26, 7, 5, 2, true, false);
    roundRect(context, -3.5, -26, 7, 5, 2, true, false);
    roundRect(context, 4, -26, 7, 5, 2, true, false);
    context.fillStyle = colorWithAlpha("#d7ff71", 0.96);
    context.beginPath();
    context.arc(0, -17.5, 4.2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = trim;
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-3, -22);
    context.lineTo(-3 + Math.cos(profile.angle) * 28, -22 + Math.sin(profile.angle) * 28);
    context.moveTo(3, -18);
    context.lineTo(3 + Math.cos(profile.angle) * 28, -18 + Math.sin(profile.angle) * 28);
    context.stroke();
  } else if (tankId === "aegis") {
    context.fillStyle = ink;
    roundRect(context, -24, 0, 48, 16, 12, true, false);
    drawPreviewTrackSegment(context, -20, 4, 40, 7, "#273d54");
    context.fillStyle = color;
    roundRect(context, -23, -13, 46, 23, 12, true, false);
    context.fillStyle = colorWithAlpha("#eff7ff", 0.95);
    context.beginPath();
    context.arc(0, -12, 12, Math.PI, 0);
    context.fill();
    context.fillStyle = colorWithAlpha("#97b2ff", 0.5);
    context.beginPath();
    context.arc(0, -12, 16, Math.PI, 0);
    context.fill();
    context.strokeStyle = colorWithAlpha("#b8e8ff", 0.78);
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, -20, 16, Math.PI * 0.1, Math.PI * 0.9);
    context.stroke();
    context.strokeStyle = trim;
    context.lineWidth = 3.4;
    context.beginPath();
    context.moveTo(0, -20);
    context.lineTo(Math.cos(profile.angle) * 28, -20 + Math.sin(profile.angle) * 28);
    context.stroke();
  } else {
    context.fillStyle = ink;
    roundRect(context, -24, 0, 48, 18, 12, true, false);
    drawPreviewTrackSegment(context, -19, 4, 38, 8, "#223749");
    context.fillStyle = color;
    roundRect(context, -24, -17, 48, 28, 12, true, false);
    context.fillStyle = deep;
    context.beginPath();
    context.moveTo(-26, -4);
    context.lineTo(0, -18);
    context.lineTo(26, -4);
    context.lineTo(18, 10);
    context.lineTo(-18, 10);
    context.closePath();
    context.fill();
    context.fillStyle = colorWithAlpha("#fff8e0", 0.94);
    roundRect(context, -8, -27, 16, 8, 4, true, false);
    context.strokeStyle = trim;
    context.lineWidth = 4.6;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, -20);
    context.lineTo(Math.cos(profile.angle) * 34, -20 + Math.sin(profile.angle) * 34);
    context.stroke();
  }

  context.restore();
}

function renderTankPreviewCanvas(canvas, tankId, variant = "tile") {
  if (!canvas) {
    return;
  }

  if (USE_SVG_TANKS && TANK_IDS.includes(tankId)) {
    // SVG-rendered Phase-1 tank
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const profiles = {
      hero: { x: 0.5, y: 0.86, scale: 1.0 },
      tile: { x: 0.5, y: 0.86, scale: 0.72 },
      pill: { x: 0.5, y: 0.86, scale: 0.45 },
    };
    const p = profiles[variant] ?? profiles.tile;
    const team = TEAM_COLORS[0];
    preRasterize(tankId, team).catch(() => {});
    renderTankToCanvas(ctx, {
      tankId,
      x: canvas.width * p.x,
      y: canvas.height * p.y,
      angle: 0,
      turretAngle: -15 * (Math.PI / 180),
      teamColor: team,
      scale: p.scale,
    });
    return;
  }

  if (!TANK_TYPES[tankId]) {
    return;
  }
  drawTankPreview(canvas.getContext("2d"), tankId, TANK_TYPES[tankId].visual?.primaryColor ?? "#ffb84f", variant);
}

function renderLobbyTankCanvases() {
  renderTankPreviewCanvas(dom.heroVehicleCanvas, app.selectedTank, "hero");

  dom.tankStrip.querySelectorAll(".tank-tile-canvas").forEach((canvas) => {
    renderTankPreviewCanvas(canvas, canvas.dataset.tankId, "tile");
  });

  dom.playerPreview.querySelectorAll(".player-pill-canvas").forEach((canvas) => {
    renderTankPreviewCanvas(canvas, canvas.dataset.tankId, "pill");
  });
}

function drawLobbyMinimap() {
  if (!dom.lobbyMinimap) {
    return;
  }

  const minimapCtx = dom.lobbyMinimap.getContext("2d");
  const { width, height } = dom.lobbyMinimap;
  const padX = 10;
  const padY = 10;
  const theme = currentTheme();
  const terrain = app.game.terrain;

  minimapCtx.clearRect(0, 0, width, height);

  const sky = minimapCtx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  minimapCtx.fillStyle = sky;
  minimapCtx.fillRect(0, 0, width, height);

  const haze = minimapCtx.createRadialGradient(width * 0.32, height * 0.2, 10, width * 0.32, height * 0.2, width * 0.5);
  haze.addColorStop(0, colorWithAlpha(theme.haze, 0.75));
  haze.addColorStop(1, "transparent");
  minimapCtx.fillStyle = haze;
  minimapCtx.fillRect(0, 0, width, height);

  const mapX = (worldX) => padX + (worldX / WORLD_WIDTH) * (width - padX * 2);
  const mapY = (worldY) => padY + (worldY / WORLD_HEIGHT) * (height - padY * 2);
  const bridgeStyle = isBridgeTerrainStyle(theme.terrainStyle ?? "rolling");

  if (bridgeStyle) {
    const drawBridgeLayer = (terrainArray, bridgeFloor, fillColor, strokeColor) => {
      if (!Array.isArray(terrainArray) || !terrainArray.length) {
        return;
      }

      minimapCtx.fillStyle = fillColor;
      minimapCtx.strokeStyle = strokeColor;
      minimapCtx.lineWidth = 1.6;

      const drawSegment = (start, end) => {
        minimapCtx.beginPath();
        minimapCtx.moveTo(mapX(start), mapY(getRawTerrainYAt(start, terrainArray)));
        for (let sample = start + 6; sample <= end; sample += 6) {
          minimapCtx.lineTo(mapX(sample), mapY(getRawTerrainYAt(sample, terrainArray)));
        }
        minimapCtx.lineTo(mapX(end), mapY(getRawTerrainYAt(end, terrainArray)));
        for (let sample = end; sample >= start; sample -= 6) {
          minimapCtx.lineTo(mapX(sample), mapY(getBridgeBottomAt(sample, theme, terrainArray, bridgeFloor)));
        }
        minimapCtx.closePath();
        minimapCtx.fill();
        minimapCtx.stroke();
      };

      let segmentStart = null;
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const solid = isTerrainLayerSolidAt(x, terrainArray, theme, bridgeFloor);
        if (solid && segmentStart === null) {
          segmentStart = x;
          continue;
        }
        if (!solid && segmentStart !== null) {
          drawSegment(segmentStart, x - 1);
          segmentStart = null;
        }
      }

      if (segmentStart !== null) {
        drawSegment(segmentStart, WORLD_WIDTH - 1);
      }
    };

    drawBridgeLayer(terrain, app.game.bridgeFloor, colorWithAlpha(theme.ground, 0.95), colorWithAlpha(theme.dust, 0.92));
    drawBridgeLayer(
      app.game.supportTerrain,
      app.game.supportBridgeFloor,
      colorWithAlpha(theme.ground, 0.72),
      colorWithAlpha(theme.dust, 0.68),
    );
  } else if (terrain.length) {
    minimapCtx.beginPath();
    minimapCtx.moveTo(mapX(0), height - padY);
    minimapCtx.lineTo(mapX(0), mapY(terrain[0]));
    for (let x = 6; x < WORLD_WIDTH; x += 6) {
      minimapCtx.lineTo(mapX(x), mapY(terrain[x]));
    }
    minimapCtx.lineTo(mapX(WORLD_WIDTH - 1), mapY(terrain[WORLD_WIDTH - 1]));
    minimapCtx.lineTo(mapX(WORLD_WIDTH - 1), height - padY);
    minimapCtx.closePath();
    const fill = minimapCtx.createLinearGradient(0, padY, 0, height - padY);
    fill.addColorStop(0, theme.groundGlow);
    fill.addColorStop(1, theme.ground);
    minimapCtx.fillStyle = fill;
    minimapCtx.fill();
    minimapCtx.strokeStyle = colorWithAlpha(theme.dust, 0.92);
    minimapCtx.lineWidth = 1.8;
    minimapCtx.stroke();
  }

  app.game.players.forEach((player) => {
    if (!player.alive) {
      return;
    }
    minimapCtx.fillStyle = player.color;
    minimapCtx.beginPath();
    minimapCtx.arc(mapX(player.x), mapY(player.y), 3.8, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.strokeStyle = "rgba(255,255,255,0.9)";
    minimapCtx.lineWidth = 1.2;
    minimapCtx.stroke();
  });
}

function renderTankStrip() {
  const tanks = Object.values(TANK_TYPES).filter((t) => !t.hidden);
  const expectedCount = tanks.length + 1;
  if (dom.tankStrip.children.length !== expectedCount) {
    const randomBtn = `
      <button type="button" class="tank-tile tank-tile-random" data-tank-id="random">
        <div class="tank-tile-preview" style="display:flex;align-items:center;justify-content:center;font-size:2.4rem;">?</div>
        <div class="tank-tile-head">
          <strong>Random</strong>
          <span class="tank-dot" style="background:linear-gradient(135deg,#ff3c3c,#ffb84f,#78d8ff,#95f04d,#c9a5ff)"></span>
        </div>
        <p class="tank-note">랜덤 셀렉트</p>
        <p class="tank-note">행운을 시험하세요</p>
      </button>
    `;
    dom.tankStrip.innerHTML = tanks
      .map(
        (tank) => `
          <button type="button" class="tank-tile" data-tank-id="${tank.id}">
            <div class="tank-tile-preview">
              <canvas
                class="tank-tile-canvas"
                data-tank-id="${tank.id}"
                width="148"
                height="92"
              ></canvas>
            </div>
            <div class="tank-tile-head">
              <strong>${tank.name}</strong>
              <span class="tank-dot" style="background:${tank.visual?.primaryColor ?? "#ffb84f"}"></span>
            </div>
            <p class="tank-note">${tank.role}</p>
            <p class="tank-note">${WEAPONS[tank.weapons?.ss1]?.name ?? ""}</p>
          </button>
        `,
      )
      .join("") + randomBtn;
  }

  dom.tankStrip.querySelectorAll(".tank-tile").forEach((button) => {
    const tid = button.dataset.tankId;
    const isActive = tid === app.selectedTank;
    button.classList.toggle("active", isActive);
    button.disabled = Boolean(app.room) && app.game.phase !== "lobby";
  });

  renderLobbyTankCanvases();
}

function drawStatsRadar(stats) {
  const canvas = dom.statsRadar;
  if (!canvas) return;
  const c = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);

  const labels = [
    { key: "armor", label: "방어력" },
    { key: "attack", label: "공격력" },
    { key: "blast", label: "폭발범위" },
    { key: "mobility", label: "기동력" },
    { key: "precision", label: "정밀도" },
  ];
  const count = labels.length;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) / 2 - 42;
  const angleOffset = -Math.PI / 2;

  const getPoint = (i, r) => ({
    x: cx + r * Math.cos(angleOffset + (2 * Math.PI * i) / count),
    y: cy + r * Math.sin(angleOffset + (2 * Math.PI * i) / count),
  });

  for (let ring = 1; ring <= 4; ring++) {
    const r = (maxR * ring) / 4;
    c.beginPath();
    for (let i = 0; i <= count; i++) {
      const p = getPoint(i % count, r);
      i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y);
    }
    c.closePath();
    c.strokeStyle = "rgba(30,53,80,0.12)";
    c.lineWidth = 1;
    c.stroke();
  }

  for (let i = 0; i < count; i++) {
    const p = getPoint(i, maxR);
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(p.x, p.y);
    c.strokeStyle = "rgba(30,53,80,0.10)";
    c.lineWidth = 1;
    c.stroke();
  }

  c.beginPath();
  for (let i = 0; i <= count; i++) {
    const val = (stats[labels[i % count].key] ?? 0) / 100;
    const p = getPoint(i % count, maxR * val);
    i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y);
  }
  c.closePath();
  c.fillStyle = "rgba(74,180,255,0.22)";
  c.fill();
  c.strokeStyle = "rgba(40,120,220,0.7)";
  c.lineWidth = 2;
  c.stroke();

  for (let i = 0; i < count; i++) {
    const val = (stats[labels[i].key] ?? 0) / 100;
    const p = getPoint(i, maxR * val);
    c.beginPath();
    c.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    c.fillStyle = "rgba(40,120,220,0.9)";
    c.fill();
  }

  c.font = "bold 10px -apple-system, sans-serif";
  c.textAlign = "center";
  c.fillStyle = "rgba(30,53,80,0.7)";
  for (let i = 0; i < count; i++) {
    const lp = getPoint(i, maxR + 16);
    const val = stats[labels[i].key] ?? 0;
    c.fillText(`${labels[i].label} ${val}`, lp.x, lp.y + 4);
  }
}

function renderShowcase() {
  const tank = TANK_TYPES[app.selectedTank];
  if (!tank) {
    dom.selectedTankRole.textContent = "랜덤 셀렉트";
    dom.selectedTankName.textContent = "?";
    dom.selectedTankDescription.textContent = "게임이 시작되면 탱크가 무작위로 결정됩니다. 낮은 확률로 전설급 슈퍼탱크가 등장할 수 있습니다.";
    dom.selectedTankWeapon.textContent = "??? · 어떤 무기가 나올지 아무도 모릅니다.";
    drawStatsRadar({ armor: 0, attack: 0, blast: 0, mobility: 0, precision: 0 });
    dom.tickerText.textContent = app.ticker;
    const readiness = 30 + app.game.players.length * 18 + (app.network.accepted || app.network.isHostReady ? 12 : 0);
    dom.readinessScore.textContent = roundScore(readiness);
    const hc = dom.heroVehicleCanvas;
    if (hc) {
      const hctx = hc.getContext("2d");
      hctx.clearRect(0, 0, hc.width, hc.height);
      hctx.font = "bold 64px -apple-system, sans-serif";
      hctx.textAlign = "center";
      hctx.fillStyle = "rgba(30,53,80,0.25)";
      hctx.fillText("?", hc.width / 2, hc.height / 2 + 20);
    }
    drawLobbyMinimap();
    return;
  }
  dom.selectedTankRole.textContent = tank.role;
  dom.selectedTankName.textContent = tank.name;
  dom.selectedTankDescription.textContent = tank.description;
  const ss1Name = WEAPONS[tank.weapons?.ss1]?.name ?? "";
  const ss2Name = WEAPONS[tank.weapons?.ss2]?.name ?? "";
  const newName = WEAPONS[tank.weapons?.new]?.name ?? "";
  dom.selectedTankWeapon.textContent = `${ss1Name} / ${ss2Name} / ${newName}(NEW)`;
  // Map tank.stats (fractional) to 0-100 radar scale
  drawStatsRadar({
    armor:     Math.round((2.0 - (tank.stats.armor ?? 1.0)) * 100),   // lower armor = tougher
    attack:    Math.round(((tank.stats.maxHealth ?? 100) / 2.0)),
    blast:     Math.round((tank.stats.precision ?? 1.0) * 80),
    mobility:  Math.round((tank.stats.mobility ?? 1.0) * 70),
    precision: Math.round((tank.stats.precision ?? 1.0) * 90),
  });
  dom.tickerText.textContent = app.ticker;
  const readiness = 30 + app.game.players.length * 18 + (app.network.accepted || app.network.isHostReady ? 12 : 0);
  dom.readinessScore.textContent = roundScore(readiness);
  renderTankPreviewCanvas(dom.heroVehicleCanvas, tank.id, "hero");
  drawLobbyMinimap();
}

function buildPlayerCard(player, mode = "preview", activeTurn = false) {
  const tank = TANK_TYPES[player.tankType] ?? { name: "Random", visual: { primaryColor: "#aaa" } };
  const healthPercent = clamp((player.health / player.maxHealth) * 100, 0, 100);
  const tags = [
    player.isHost ? "Host" : null,
    player.isBot ? "Bot" : null,
    player.connected ? "Linked" : "Offline",
    player.alive ? "Alive" : "Out",
  ]
    .filter(Boolean)
    .join(" · ");

  const cardClass =
    mode === "battle"
      ? `battle-player-card ${activeTurn ? "active" : ""}`.trim()
      : "player-pill";
  const topClass = mode === "battle" ? "battle-player-top" : "player-pill-top";

  if (mode === "preview") {
    return `
      <article class="${cardClass}">
        <div class="player-pill-visual">
          <canvas
            class="player-pill-canvas"
            data-tank-id="${player.tankType}"
            width="92"
            height="68"
          ></canvas>
        </div>
        <div class="player-pill-body">
          <div class="${topClass}">
            <strong>${player.name}</strong>
            <span>${tank.name}</span>
          </div>
          <div class="health-bar">
            <div class="health-fill" style="width:${healthPercent}%"></div>
          </div>
          <span>${tags}</span>
        </div>
      </article>
    `;
  }

  return `
    <article class="${cardClass}">
      <div class="${topClass}">
        <strong>${player.name}</strong>
        <span>${tank.name}</span>
      </div>
      <div class="health-bar">
        <div class="health-fill" style="width:${healthPercent}%"></div>
      </div>
      <span>${tags}</span>
    </article>
  `;
}

function renderPlayers() {
  dom.playerPreview.innerHTML = "";
  dom.battleRoster.innerHTML = "";

  const players = app.game.players;
  const current = getCurrentPlayer();
  dom.playerCountChip.textContent = `${players.length} / ${app.room?.maxPlayers ?? MAX_PLAYERS}`;

  if (!players.length) {
    dom.playerPreview.innerHTML = `<article class="player-pill player-pill-empty"><strong>아직 로비에 탱크가 없습니다.</strong></article>`;
    dom.battleRoster.innerHTML = "";
    return;
  }

  players.forEach((player) => {
    dom.playerPreview.insertAdjacentHTML("beforeend", buildPlayerCard(player, "preview"));
    dom.battleRoster.insertAdjacentHTML(
      "beforeend",
      buildPlayerCard(player, "battle", current?.id === player.id),
    );
  });

  renderLobbyTankCanvases();
}

function renderSummary() {
  const isHostLobby = app.localRole === "host" && app.room;
  const isClientRoom = app.localRole === "client" && app.room;
  const pendingInvite = !app.localRole && app.invitePayload;
  const theme = currentTheme();

  if (isHostLobby) {
    dom.summaryKicker.textContent = "Host Lobby";
    dom.summaryTitle.textContent = theme.name;
    dom.summaryText.textContent = "초대 링크를 보내면 참가자가 자동으로 로비에 연결됩니다.";
    dom.summaryTheme.textContent = theme.name;
    dom.summaryPlayers.textContent = `${app.game.players.length} / ${app.room.maxPlayers} 탱크`;
  } else if (isClientRoom) {
    dom.summaryKicker.textContent = "Joined Lobby";
    dom.summaryTitle.textContent = theme.name;
    dom.summaryText.textContent = `${app.room.hostName} 호스트 방에 연결되었습니다.`;
    dom.summaryTheme.textContent = theme.name;
    dom.summaryPlayers.textContent = `${app.game.players.length} / ${app.room.maxPlayers} 탱크`;
  } else if (pendingInvite) {
    dom.summaryKicker.textContent = "Invite Found";
    dom.summaryTitle.textContent = getTheme(app.invitePayload.theme).name;
    dom.summaryText.textContent = `${app.invitePayload.hostName} 호스트 링크를 감지했습니다.`;
    dom.summaryTheme.textContent = getTheme(app.invitePayload.theme).name;
    dom.summaryPlayers.textContent = `최대 ${app.invitePayload.maxPlayers}명`;
  } else {
    const selectedTheme = getTheme(app.selectedTheme);
    dom.summaryKicker.textContent = "Launch Pad";
    dom.summaryTitle.textContent = "새 로비 열기";
    dom.summaryText.textContent = "닉네임과 맵을 고른 뒤 바로 초대 링크를 만들 수 있습니다.";
    dom.summaryTheme.textContent = selectedTheme.name;
    dom.summaryPlayers.textContent = `최대 ${MAX_PLAYERS}명`;
  }
}

function renderPanelState() {
  const isHostLobby = app.localRole === "host" && app.room && app.game.phase === "lobby";
  const isClientLobby = app.localRole === "client" && app.room && app.game.phase === "lobby";
  const pendingInvite = !app.localRole && app.invitePayload;
  const theme = currentTheme();

  if (document.activeElement !== dom.playerNameInput) {
    dom.playerNameInput.value = app.draftName;
  }

  dom.invitePreview.classList.toggle("hidden", !isHostLobby || !app.invitePayload);
  dom.inviteDetected.classList.toggle("hidden", !(pendingInvite || isClientLobby));
  dom.mapCycleControl.classList.toggle("hidden", (Boolean(app.room) && !isHostLobby) || pendingInvite || isClientLobby);
  dom.copyInviteBtn.classList.toggle("hidden", !isHostLobby);
  dom.addBotBtn.classList.toggle("hidden", !isHostLobby);
  dom.leaveRoomBtn.classList.toggle("hidden", !(isHostLobby || isClientLobby));
  dom.mapCycleLabel.textContent = theme.name;

  if (app.invitePayload && dom.inviteLinkField.value !== makeInviteLink(app.invitePayload)) {
    dom.inviteLinkField.value = makeInviteLink(app.invitePayload);
  }

  if (pendingInvite) {
    dom.inviteRoomName.textContent = `${app.invitePayload.hostName} 호스트`;
    dom.inviteRoomMeta.textContent = `${getTheme(app.invitePayload.theme).name} · 자동 입장 준비`;
  } else if (isClientLobby) {
    dom.inviteRoomName.textContent = `${app.room.hostName} 호스트`;
    dom.inviteRoomMeta.textContent = `${theme.name} · 링크 연결됨`;
  }

  if (isHostLobby) {
    dom.mainActionBtn.classList.remove("hidden");
    dom.mainActionBtn.textContent = "Game Start";
    dom.mainActionBtn.disabled = !app.network.isHostReady || app.game.players.length < 2;
    dom.panelNote.textContent =
      "초대 링크를 복사해서 공유하면 참가자가 링크만으로 바로 입장합니다.";
    return;
  }

  if (isClientLobby) {
    dom.mainActionBtn.classList.remove("hidden");
    dom.mainActionBtn.textContent = app.network.accepted ? "로비 입장 완료" : "입장 중...";
    dom.mainActionBtn.disabled = true;
    dom.panelNote.textContent =
      "호스트가 게임을 시작하면 전장이 자동으로 열립니다. 링크를 다시 주고받을 필요는 없습니다.";
    return;
  }

  if (pendingInvite) {
    dom.mainActionBtn.classList.remove("hidden");
    dom.mainActionBtn.textContent = app.localRole === "client" ? "입장 중..." : "즉시 입장";
    dom.mainActionBtn.disabled = app.localRole === "client";
    dom.panelNote.textContent = "링크를 열면 자동 입장을 시도하고, 실패하면 다시 눌러 재시도할 수 있습니다.";
    return;
  }

  dom.mainActionBtn.classList.remove("hidden");
  dom.mainActionBtn.textContent = "방 만들기";
  dom.mainActionBtn.disabled = false;
  dom.panelNote.textContent =
    "방이 열리면 복사 버튼으로 초대 링크를 보낼 수 있고, 참가자는 링크를 열기만 하면 됩니다.";
}

function renderTopBadges() {
  dom.statusChip.classList.add("hidden");
  dom.roomChip.classList.add("hidden");
}

function formatWindLabel(wind) {
  const intensity = clamp(Math.round((Math.abs(wind) / MAX_WIND) * 100), 0, 100);
  if (intensity < 4) {
    return "바람 없음";
  }
  return `바람 ${wind > 0 ? "오른쪽" : "왼쪽"} ${intensity}%`;
}

function powerToPercent(power) {
  return clamp(((power - MIN_POWER) / (MAX_POWER - MIN_POWER)) * 100, 0, 100);
}

function percentToPower(percent) {
  return Math.round(MIN_POWER + ((MAX_POWER - MIN_POWER) * clamp(percent, 0, 100)) / 100);
}

function renderBattleHud() {
  const current = getCurrentPlayer();
  const localPlayer = getLocalPlayer();
  const powerValue = localPlayer ? Math.round(localPlayer.power) : MIN_POWER;
  const powerPercent = localPlayer ? powerToPercent(localPlayer.power) : 0;
  const previousPower = localPlayer?.lastFiredPower ?? null;
  const previousPowerPercent = previousPower === null ? 0 : powerToPercent(previousPower);
  const manualPower = app.input.manualPowerMarker;
  const manualPowerPercent = manualPower === null ? 0 : powerToPercent(manualPower);
  dom.phasePill.textContent =
    app.game.phase === "aim"
      ? "조준 단계"
      : app.game.phase === "projectile"
        ? "포탄 비행"
        : app.game.phase === "game-over"
          ? "작전 종료"
          : "전투 준비";
  dom.turnLabel.textContent = current ? `TURN ${current.name.toUpperCase()}` : "TURN -";
  dom.windPill.textContent = formatWindLabel(app.game.wind);
  dom.powerLabel.textContent =
    !localPlayer
      ? "POWER -"
      : app.game.phase === "aim" && localPlayer.isCharging && canLocalPlayerAct()
      ? `CHARGING ${powerValue}`
      : `POWER ${powerValue}`;
  dom.powerFill.style.width = `${powerPercent}%`;
  const fuelValue = localPlayer ? Math.round(localPlayer.fuel ?? TURN_FUEL) : TURN_FUEL;
  const fuelPercent = (fuelValue / TURN_FUEL) * 100;
  if (dom.fuelLabel) {
    dom.fuelLabel.textContent = localPlayer ? `FUEL ${fuelValue}` : "FUEL -";
    dom.fuelLabel.classList.toggle("hidden", !isBattleActive());
  }
  if (dom.fuelFill) {
    dom.fuelFill.style.width = `${fuelPercent}%`;
    dom.fuelFill.style.background = "linear-gradient(90deg, #f59e0b 0%, #eab308 100%)";
  }
  if (dom.fuelTrack) {
    dom.fuelTrack.classList.toggle("hidden", !isBattleActive());
  }
  dom.powerManualMarker.classList.toggle("hidden", manualPower === null || !localPlayer);
  dom.powerManualMarker.style.left = `${manualPowerPercent}%`;
  dom.powerManualValue.textContent = `표시 ${Math.round(manualPower ?? 0)}`;
  dom.powerPreviousMarker.classList.toggle("hidden", previousPower === null || !localPlayer);
  dom.powerPreviousMarker.style.left = `${previousPowerPercent}%`;
  dom.powerPreviousValue.textContent = `이전 ${Math.round(previousPower ?? 0)}`;
  dom.battleBanner.textContent = app.game.banner;

  // Weapon slot tabs (Plan F)
  renderWeaponSlots(localPlayer, canLocalPlayerAct());

  if (!canLocalPlayerAct()) {
    clearLocalHeldInputs();
  }
}

function renderWeaponSlots(player, isCurrentTurn) {
  const slotsEl = document.getElementById("weapon-slots");
  if (!slotsEl) return;

  const tank = player ? (TANK_TYPES[player.tankType] ?? TANK_TYPES.armor) : null;
  const playerArg = player
    ? {
        tankType: player.tankType,
        tankTypeDef: tank,
        weapons: WEAPONS,
        selectedWeapon: player.selectedWeapon ?? "ss1",
        newUsesRemaining: player.newUsesRemaining ?? 2,
        isCurrentTurn: Boolean(isCurrentTurn),
      }
    : { tankType: "armor", tankTypeDef: TANK_TYPES.armor, weapons: WEAPONS, selectedWeapon: "ss1", newUsesRemaining: 0, isCurrentTurn: false };

  const { slots } = buildWeaponSlotsView(playerArg);

  const btns = slotsEl.querySelectorAll(".weapon-slot");
  btns.forEach((btn) => {
    const slot = slots.find((s) => s.id === btn.dataset.slot);
    if (!slot) return;
    btn.disabled = slot.disabled;
    btn.classList.toggle("active", slot.active);
    btn.title = slot.tooltip;
  });

  // Update NEW remaining badge
  const newRemainingEl = document.getElementById("new-remaining");
  if (newRemainingEl) {
    const newLeft = player?.newUsesRemaining ?? 0;
    newRemainingEl.textContent = "❄".repeat(Math.max(0, newLeft));
  }
}

function renderTurnRail() {
  const el = document.getElementById("turn-order-rail");
  if (!el || !app.game.turnManager) return;
  const mgr = app.game.turnManager;

  // Build view model from current manager state (no mutation)
  const snap = {
    tanks: mgr.tanks.map((t) => {
      const player = app.game.players.find((p) => p.id === t.id);
      return {
        id: t.id,
        name: player?.name ?? t.id,
        tankTypeId: player?.tankType ?? "armor",
        baseDelay: t.baseDelay,
        accumulatedDelay: t.accumulatedDelay,
        alive: t.alive,
      };
    }),
    pendingStatuses: {},
    history: [],
  };
  const entries = buildTurnOrderView(snap, 4);

  el.innerHTML = "";
  for (const entry of entries) {
    const card = document.createElement("div");
    card.className = "turn-order-card" + (entry.isActive ? " active" : "");

    // 40×28 mini tank canvas
    const cvs = document.createElement("canvas");
    cvs.width = 40;
    cvs.height = 28;
    const player = app.game.players.find((p) => p.id === entry.tankId);
    if (player) {
      try {
        renderTankToCanvas(cvs.getContext("2d"), {
          tankType: entry.tankTypeId,
          teamColor: player.teamColor ?? "#4ea1ff",
          facing: 1,
          width: 40,
          height: 28,
        });
      } catch (_) { /* ignore render errors for unknown tank types */ }
    }

    const nameEl = document.createElement("div");
    nameEl.className = "turn-order-name";
    nameEl.textContent = entry.name;

    const delayBar = document.createElement("div");
    delayBar.className = "turn-order-delay";
    const fill = document.createElement("div");
    fill.className = "turn-order-delay-fill";
    fill.style.width = `${entry.delayBarPct}%`;
    delayBar.appendChild(fill);

    card.appendChild(cvs);
    card.appendChild(nameEl);
    card.appendChild(delayBar);
    el.appendChild(card);
  }
}

function renderScreenState() {
  const showBattle = isBattleActive();
  dom.launcherScreen.classList.toggle("hidden", showBattle);
  dom.battleScreen.classList.toggle("hidden", !showBattle);
  document.body.classList.toggle("is-battle", showBattle);
}

function renderUi(now = performance.now()) {
  if (!app.uiDirty) {
    if (!isBattleActive()) {
      return;
    }
    if (now - app.lastUiRender < 120) {
      return;
    }
  }

  try { renderTankStrip(); } catch (e) { console.error("renderTankStrip:", e); }
  try { renderShowcase(); } catch (e) { console.error("renderShowcase:", e); }
  try { renderPlayers(); } catch (e) { console.error("renderPlayers:", e); }
  try { renderSummary(); } catch (e) { console.error("renderSummary:", e); }
  try { renderTopBadges(); } catch (e) { console.error("renderTopBadges:", e); }
  try { renderPanelState(); } catch (e) { console.error("renderPanelState:", e); }
  try { renderBattleHud(); } catch (e) { console.error("renderBattleHud:", e); }
  try { renderTurnRail(); } catch (e) { console.error("renderTurnRail:", e); }
  try { renderScreenState(); } catch (e) { console.error("renderScreenState:", e); }

  app.uiDirty = false;
  app.lastUiRender = now;
}

function drawCanyonWall(side, now, depth, fillA, fillB, highlight) {
  const width = WORLD_WIDTH * (side === "left" ? 0.34 : 0.36);
  const horizon = WORLD_HEIGHT * 0.52;
  const xStart = side === "left" ? 0 : WORLD_WIDTH - width;
  const xEnd = side === "left" ? width : WORLD_WIDTH;
  const drift = now * 0.00004 * (side === "left" ? 1 : -1);
  const gradient = ctx.createLinearGradient(xStart, horizon - 170, xEnd, WORLD_HEIGHT);
  gradient.addColorStop(0, fillA);
  gradient.addColorStop(1, fillB);

  ctx.save();
  ctx.globalAlpha = 0.82 - depth * 0.18;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(side === "left" ? 0 : WORLD_WIDTH, WORLD_HEIGHT);
  ctx.lineTo(side === "left" ? 0 : WORLD_WIDTH, horizon + 90);
  for (let i = 0; i <= 11; i += 1) {
    const t = i / 11;
    const x = side === "left" ? xStart + width * t : xEnd - width * t;
    const ridge =
      horizon -
      Math.sin(t * Math.PI * 1.15 + depth * 0.7) * (180 + depth * 28) -
      Math.sin(t * 12 + drift + depth) * 30 -
      (i % 2 === 0 ? 16 : -10);
    ctx.lineTo(x, ridge);
  }
  ctx.lineTo(side === "left" ? width + 36 : WORLD_WIDTH - width - 36, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = highlight;
  ctx.lineWidth = 2.2;
  for (let i = 1; i <= 6; i += 1) {
    const t = i / 7;
    const ridgeX = side === "left" ? xStart + width * t : xEnd - width * t;
    const ridgeTop = horizon - 100 - Math.sin(t * 6 + depth) * 70;
    ctx.beginPath();
    ctx.moveTo(ridgeX, ridgeTop);
    ctx.lineTo(ridgeX + (side === "left" ? 18 : -18), WORLD_HEIGHT * 0.86);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCanyonBridgeBackground(now, theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#8e674d");
  sky.addColorStop(0.2, theme.skyTop);
  sky.addColorStop(0.7, theme.skyBottom);
  sky.addColorStop(1, "#efe4cf");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sunGlow = ctx.createRadialGradient(WORLD_WIDTH * 0.46, 120, 30, WORLD_WIDTH * 0.46, 120, 340);
  sunGlow.addColorStop(0, "rgba(255, 247, 226, 0.92)");
  sunGlow.addColorStop(0.35, colorWithAlpha(theme.haze, 0.52));
  sunGlow.addColorStop(1, "transparent");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = "rgba(255, 245, 231, 0.7)";
  ctx.lineWidth = 12;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    for (let x = -80; x <= WORLD_WIDTH + 80; x += 24) {
      const y =
        92 +
        i * 40 +
        Math.sin(x * 0.008 + i * 0.9 + now * 0.00012) * 12 +
        Math.sin(x * 0.016 + i * 1.3) * 4;
      if (x === -80) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  const horizon = WORLD_HEIGHT * 0.55;
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = colorWithAlpha(theme.farHill, 0.78);
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  ctx.lineTo(0, horizon + 34);
  for (let x = 0; x <= WORLD_WIDTH; x += 36) {
    const y =
      horizon -
      Math.sin(x * 0.0045 + 0.8) * 34 -
      Math.sin(x * 0.011 + now * 0.00008) * 18 -
      Math.exp(-Math.pow((x - WORLD_WIDTH * 0.5) / 210, 2)) * 80;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawCanyonWall("left", now, 1, colorWithAlpha("#7b634d", 0.62), colorWithAlpha("#4d3928", 0.96), colorWithAlpha("#f5dfb8", 0.48));
  drawCanyonWall("right", now, 0, colorWithAlpha("#8e765e", 0.7), colorWithAlpha("#433224", 0.98), colorWithAlpha("#ffe5bc", 0.5));

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = colorWithAlpha("#6e563f", 0.6);
  for (let i = 0; i < 4; i += 1) {
    const centerX = WORLD_WIDTH * (0.34 + i * 0.1);
    const pillarHeight = 120 + i * 24;
    const pillarWidth = 36 + (i % 2) * 12;
    ctx.beginPath();
    ctx.moveTo(centerX - pillarWidth, horizon + 38);
    ctx.lineTo(centerX - pillarWidth * 0.7, horizon - pillarHeight * 0.3);
    ctx.lineTo(centerX - pillarWidth * 0.25, horizon - pillarHeight);
    ctx.lineTo(centerX + pillarWidth * 0.2, horizon - pillarHeight * 0.88);
    ctx.lineTo(centerX + pillarWidth, horizon + 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const waterTop = theme.waterTop ?? Math.round(WORLD_HEIGHT * 0.68);
  const water = ctx.createLinearGradient(0, waterTop, 0, WORLD_HEIGHT);
  water.addColorStop(0, "rgba(150, 146, 122, 0.16)");
  water.addColorStop(0.12, "rgba(72, 84, 108, 0.24)");
  water.addColorStop(0.55, "rgba(40, 44, 70, 0.74)");
  water.addColorStop(1, "rgba(16, 16, 28, 0.96)");
  ctx.fillStyle = water;
  ctx.fillRect(0, waterTop, WORLD_WIDTH, WORLD_HEIGHT - waterTop);

  const reflection = ctx.createLinearGradient(0, waterTop, 0, WORLD_HEIGHT);
  reflection.addColorStop(0, "rgba(255, 240, 218, 0.16)");
  reflection.addColorStop(0.2, "rgba(237, 215, 177, 0.08)");
  reflection.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = reflection;
  ctx.fillRect(0, waterTop, WORLD_WIDTH, WORLD_HEIGHT - waterTop);

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < 8; i += 1) {
    const baseY = waterTop + 40 + i * 28;
    ctx.beginPath();
    for (let x = 80; x <= WORLD_WIDTH - 80; x += 20) {
      const y = baseY + Math.sin(x * 0.015 + i + now * 0.0014) * 4;
      if (x === 80) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyRuinsBackground(now, theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#d5a44b");
  sky.addColorStop(0.16, theme.skyTop);
  sky.addColorStop(0.58, theme.skyBottom);
  sky.addColorStop(1, "#fffaf0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const sunX = WORLD_WIDTH * 0.34;
  const sunY = 120;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 24, sunX, sunY, 240);
  sunGlow.addColorStop(0, "rgba(255,255,248,0.98)");
  sunGlow.addColorStop(0.3, colorWithAlpha(theme.haze, 0.8));
  sunGlow.addColorStop(1, "transparent");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = "rgba(255, 250, 239, 0.65)";
  for (let i = 0; i < 5; i += 1) {
    const x = 180 + i * 250 + Math.sin(now * 0.00016 + i) * 16;
    const y = 110 + i * 18;
    ctx.beginPath();
    ctx.ellipse(x, y, 100, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const seaHorizon = theme.waterTop ?? 575;
  const mist = ctx.createLinearGradient(0, seaHorizon - 120, 0, seaHorizon + 20);
  mist.addColorStop(0, "rgba(255, 247, 231, 0)");
  mist.addColorStop(0.45, "rgba(255, 247, 231, 0.55)");
  mist.addColorStop(1, "rgba(255, 252, 246, 0.9)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, seaHorizon - 120, WORLD_WIDTH, 150);

  const water = ctx.createLinearGradient(0, seaHorizon - 20, 0, WORLD_HEIGHT);
  water.addColorStop(0, "rgba(255, 242, 218, 0.92)");
  water.addColorStop(0.4, "rgba(240, 214, 165, 0.52)");
  water.addColorStop(1, "rgba(228, 193, 133, 0.12)");
  ctx.fillStyle = water;
  ctx.fillRect(0, seaHorizon - 20, WORLD_WIDTH, WORLD_HEIGHT - seaHorizon + 20);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 8; i += 1) {
    const y = seaHorizon + 12 + i * 18;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += 20) {
      const wave = Math.sin(x * 0.013 + i + now * 0.001) * 3;
      if (x === 0) {
        ctx.moveTo(x, y + wave);
      } else {
        ctx.lineTo(x, y + wave);
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = colorWithAlpha("#9f8a72", 0.5);
  ctx.beginPath();
  ctx.moveTo(150, seaHorizon - 50);
  ctx.lineTo(210, 190);
  ctx.lineTo(250, 170);
  ctx.lineTo(282, 198);
  ctx.lineTo(252, 246);
  ctx.lineTo(180, 248);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(WORLD_WIDTH * 0.38, 144);
  ctx.fillStyle = colorWithAlpha("#b39d83", 0.95);
  ctx.beginPath();
  ctx.moveTo(-56, 54);
  ctx.lineTo(-34, 98);
  ctx.lineTo(-8, 88);
  ctx.lineTo(4, 114);
  ctx.lineTo(22, 82);
  ctx.lineTo(58, 60);
  ctx.lineTo(42, 12);
  ctx.lineTo(-40, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colorWithAlpha("#efe5cf", 0.98);
  roundRect(ctx, -34, -14, 68, 48, 8, true, false);
  roundRect(ctx, -20, -40, 18, 30, 6, true, false);
  roundRect(ctx, 4, -52, 16, 42, 6, true, false);
  roundRect(ctx, -48, -4, 14, 24, 6, true, false);
  roundRect(ctx, 30, 4, 14, 20, 5, true, false);
  ctx.fillRect(-32, -20, 64, 7);
  ctx.fillRect(-24, 4, 14, 20);
  ctx.fillRect(10, 0, 12, 24);
  ctx.fillStyle = colorWithAlpha("#d5c4a4", 0.95);
  ctx.fillRect(-14, 8, 10, 26);
  ctx.fillRect(2, 8, 10, 26);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = colorWithAlpha("#ad967d", 0.96);
  ctx.beginPath();
  ctx.moveTo(0, seaHorizon + 36);
  ctx.lineTo(36, 248);
  ctx.lineTo(74, 236);
  ctx.lineTo(104, 264);
  ctx.lineTo(90, 322);
  ctx.lineTo(0, 340);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colorWithAlpha("#e8dbbf", 0.9);
  roundRect(ctx, 24, 214, 20, 88, 7, true, false);
  ctx.restore();

  ctx.save();
  ctx.translate(WORLD_WIDTH * 0.82, 236);
  ctx.fillStyle = colorWithAlpha("#a0886f", 0.96);
  ctx.beginPath();
  ctx.moveTo(-240, 86);
  ctx.lineTo(-210, -26);
  ctx.lineTo(-128, -82);
  ctx.lineTo(-12, -90);
  ctx.lineTo(82, -74);
  ctx.lineTo(168, -22);
  ctx.lineTo(210, 38);
  ctx.lineTo(208, 260);
  ctx.lineTo(-240, 260);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colorWithAlpha("#e5d8c1", 0.94);
  for (let i = 0; i < 7; i += 1) {
    const x = -194 + i * 52;
    const y = -28 - (i % 2) * 18;
    roundRect(ctx, x, y, 28, 88, 7, true, false);
    roundRect(ctx, x + 8, y + 28, 12, 34, 4, false, true);
  }
  roundRect(ctx, -116, 30, 42, 110, 10, false, true);
  roundRect(ctx, 18, 12, 40, 126, 10, false, true);
  roundRect(ctx, 86, 24, 30, 92, 8, false, true);
  ctx.strokeStyle = colorWithAlpha("#6b523f", 0.9);
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(-224, -10);
  ctx.lineTo(-116, -76);
  ctx.lineTo(0, -82);
  ctx.lineTo(124, -52);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = colorWithAlpha("#8f6d4f", 0.88);
  ctx.beginPath();
  ctx.moveTo(WORLD_WIDTH * 0.56, WORLD_HEIGHT - 54);
  ctx.lineTo(WORLD_WIDTH * 0.68, WORLD_HEIGHT - 146);
  ctx.lineTo(WORLD_WIDTH * 0.74, WORLD_HEIGHT - 146);
  ctx.lineTo(WORLD_WIDTH * 0.64, WORLD_HEIGHT - 50);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFrostMawBackground(now, theme) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#3d6783");
  sky.addColorStop(0.2, theme.skyTop);
  sky.addColorStop(0.72, theme.skyBottom);
  sky.addColorStop(1, "#efffff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const lightX = WORLD_WIDTH * 0.56;
  const lightY = WORLD_HEIGHT * 0.34;
  const glow = ctx.createRadialGradient(lightX, lightY, 36, lightX, lightY, 300);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.32, colorWithAlpha(theme.haze, 0.72));
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 6;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    for (let x = -60; x <= WORLD_WIDTH + 60; x += 24) {
      const y = 86 + i * 22 + Math.sin(x * 0.008 + i + now * 0.0002) * 10;
      if (x === -60) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  const waterTop = theme.waterTop ?? 545;
  const water = ctx.createLinearGradient(0, waterTop - 20, 0, WORLD_HEIGHT);
  water.addColorStop(0, "rgba(206, 251, 255, 0.9)");
  water.addColorStop(0.24, "rgba(148, 221, 232, 0.7)");
  water.addColorStop(0.7, "rgba(79, 145, 171, 0.78)");
  water.addColorStop(1, "rgba(25, 70, 94, 0.95)");
  ctx.fillStyle = water;
  ctx.fillRect(0, waterTop - 20, WORLD_WIDTH, WORLD_HEIGHT - waterTop + 20);

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i += 1) {
    const y = waterTop + 10 + i * 16;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += 18) {
      const wave = Math.sin(x * 0.018 + i * 0.8 + now * 0.0011) * 3.8;
      if (x === 0) {
        ctx.moveTo(x, y + wave);
      } else {
        ctx.lineTo(x, y + wave);
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  const drawIceMass = (points, fillColor, strokeColor) => {
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  };

  drawIceMass(
    [
      [0, 460],
      [90, 426],
      [210, 432],
      [296, 470],
      [286, 566],
      [168, 582],
      [40, 560],
      [0, 526],
    ],
    "rgba(220, 248, 255, 0.75)",
    "rgba(139, 219, 255, 0.62)",
  );
  drawIceMass(
    [
      [WORLD_WIDTH - 320, 438],
      [WORLD_WIDTH - 178, 406],
      [WORLD_WIDTH, 398],
      [WORLD_WIDTH, 590],
      [WORLD_WIDTH - 120, 604],
      [WORLD_WIDTH - 262, 560],
    ],
    "rgba(219, 245, 255, 0.72)",
    "rgba(144, 225, 255, 0.62)",
  );

  ctx.save();
  ctx.translate(112, 378);
  ctx.fillStyle = colorWithAlpha("#7f94ab", 0.95);
  for (let i = 0; i < 14; i += 1) {
    const towerX = i * 24 + Math.sin(i * 1.4) * 7;
    const towerH = 120 + (i % 4) * 42 + (i % 2) * 18;
    roundRect(ctx, towerX, -towerH, 16, towerH + 18, 7, true, false);
    ctx.fillStyle = colorWithAlpha("#d6edf7", 0.95);
    ctx.beginPath();
    ctx.ellipse(towerX + 8, -towerH, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colorWithAlpha("#7f94ab", 0.95);
  }
  ctx.fillStyle = colorWithAlpha("#4c687d", 0.78);
  ctx.fillRect(-22, 0, 370, 54);
  ctx.restore();

  ctx.save();
  ctx.translate(WORLD_WIDTH - 186, 176);
  ctx.fillStyle = colorWithAlpha("#8d869a", 0.95);
  ctx.beginPath();
  ctx.ellipse(0, 0, 52, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-22, 84, 34, 54, 0, 0, Math.PI * 2);
  ctx.ellipse(14, 98, 28, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f8fffb";
  ctx.beginPath();
  ctx.arc(-22, -34, 18, 0, Math.PI * 2);
  ctx.arc(24, -40, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#11161d";
  ctx.beginPath();
  ctx.arc(-18, -34, 7, 0, Math.PI * 2);
  ctx.arc(20, -40, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(-12, 36);
  ctx.lineTo(-4, 72);
  ctx.lineTo(6, 36);
  ctx.lineTo(16, 76);
  ctx.lineTo(28, 38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(58, 62, 76, 0.7)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  const chainAnchors = [
    [WORLD_WIDTH - 120, 246, WORLD_WIDTH - 152, 410],
    [WORLD_WIDTH - 84, 264, WORLD_WIDTH - 64, 506],
    [46, 496, 8, 554],
    [92, 470, 80, 560],
  ];
  chainAnchors.forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const segments = 7;
    for (let i = 1; i <= segments; i += 1) {
      const t = i / segments;
      const sway = Math.sin(t * Math.PI) * 18 * (x2 > x1 ? 1 : -1);
      ctx.lineTo(lerp(x1, x2, t) + sway, lerp(y1, y2, t));
    }
    ctx.stroke();
  });
  ctx.restore();
}

function drawBackground(now) {
  const theme = currentTheme();
  if (theme.backgroundStyle === "canyonbridge") {
    drawCanyonBridgeBackground(now, theme);
    return;
  }
  if (theme.backgroundStyle === "skyruins") {
    drawSkyRuinsBackground(now, theme);
    return;
  }
  if (theme.backgroundStyle === "frostmaw") {
    drawFrostMawBackground(now, theme);
    return;
  }

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const glow = ctx.createRadialGradient(260, 110, 30, 260, 110, 260);
  glow.addColorStop(0, `${theme.haze}ee`);
  glow.addColorStop(0.35, `${theme.haze}44`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  for (let i = 0; i < 6; i += 1) {
    const x = 100 + i * 210 + Math.sin(now * 0.0002 + i) * 18;
    const y = 84 + (i % 2) * 22;
    ctx.beginPath();
    ctx.ellipse(x, y, 48, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = theme.farHill;
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  for (let x = 0; x <= WORLD_WIDTH; x += 20) {
    const y = 410 + Math.sin(x * 0.008 + now * 0.0003) * 20;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.midHill;
  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  for (let x = 0; x <= WORLD_WIDTH; x += 18) {
    const y = 500 + Math.sin(x * 0.013 + now * 0.00042) * 26;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();
  ctx.fill();
}

function drawBattleBackdrop() {
  const theme = currentTheme();
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  const haze = ctx.createRadialGradient(220, 120, 20, 220, 120, 320);
  haze.addColorStop(0, `${theme.haze}cc`);
  haze.addColorStop(0.4, `${theme.haze}36`);
  haze.addColorStop(1, "transparent");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function drawTerrain() {
  const theme = currentTheme();
  const bitmap = app.game.bitmap;

  if (bitmap) {
    // ── Bitmap path (Tasks 11 + 12) ────────────────────────────────────────
    // 1. Blit bitmap to offscreen canvas (full or dirty-rect partial)
    drawTerrainBitmap(terrainCtx, bitmap, pendingDirtyRect);
    pendingDirtyRect = null;

    // 2. Composite offscreen canvas onto main world ctx
    ctx.drawImage(terrainCanvas, 0, 0);

    // 3. Draw bridges on top (Task 12 — bridges are non-destructible overlay)
    if (isBridgeTerrainStyle(theme.terrainStyle ?? "rolling")) {
      drawBridgeTerrain(theme);
    }
    return;
  }

  // ── Legacy canvas path (fallback if bitmap not available) ──────────────
  if (isBridgeTerrainStyle(theme.terrainStyle ?? "rolling")) {
    drawBridgeTerrain(theme);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(0, WORLD_HEIGHT);
  ctx.lineTo(0, app.game.terrain[0]);
  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    ctx.lineTo(x, app.game.terrain[x]);
  }
  ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT);
  ctx.closePath();

  const fill = ctx.createLinearGradient(0, 240, 0, WORLD_HEIGHT);
  fill.addColorStop(0, theme.groundGlow);
  fill.addColorStop(0.24, theme.ground);
  fill.addColorStop(1, "#7b5a3e");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.strokeStyle = `${theme.dust}bb`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBridgeTerrain(theme) {
  const isSkyRuins = (theme.terrainStyle ?? "rolling") === "serpentbridge";
  const isFrostMaw = (theme.terrainStyle ?? "rolling") === "icebridge";
  const topHighlight = colorWithAlpha(theme.dust, 0.88);
  const fill = ctx.createLinearGradient(0, WORLD_HEIGHT * 0.48, 0, WORLD_HEIGHT);
  fill.addColorStop(0, colorWithAlpha(theme.groundGlow, 0.96));
  fill.addColorStop(0.2, colorWithAlpha(isFrostMaw ? "#5db7e5" : isSkyRuins ? "#9e6d4a" : "#8b6945", 0.98));
  fill.addColorStop(0.7, colorWithAlpha(theme.ground, 0.98));
  fill.addColorStop(1, colorWithAlpha(isFrostMaw ? "#0d3960" : isSkyRuins ? "#2c160f" : "#3c2b1e", 1));
  const supportFill = ctx.createLinearGradient(0, WORLD_HEIGHT * 0.62, 0, WORLD_HEIGHT);
  supportFill.addColorStop(0, colorWithAlpha("#a3f6ff", 0.84));
  supportFill.addColorStop(0.3, colorWithAlpha("#58acd9", 0.92));
  supportFill.addColorStop(1, colorWithAlpha("#123f63", 0.98));

  const drawSegment = (start, end, terrainArray, bridgeFloor, support = false) => {
    if (start > end || !Array.isArray(terrainArray)) {
      return;
    }

    ctx.save();
    ctx.fillStyle = support ? supportFill : fill;
    ctx.beginPath();
    ctx.moveTo(start, terrainArray[start]);
    for (let x = start + 1; x <= end; x += 1) {
      ctx.lineTo(x, terrainArray[x]);
    }
    for (let x = end; x >= start; x -= 1) {
      ctx.lineTo(x, getBridgeBottomAt(x, theme, terrainArray, bridgeFloor));
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = support ? colorWithAlpha("#16476a", 0.9) : colorWithAlpha("#2f1e13", 0.84);
    ctx.lineWidth = support ? 2.2 : 2.8;
    ctx.stroke();

    ctx.strokeStyle = support ? colorWithAlpha("#e6ffff", 0.78) : topHighlight;
    ctx.lineWidth = support ? 1.8 : 2.2;
    ctx.beginPath();
    ctx.moveTo(start, terrainArray[start] + 0.5);
    for (let x = start + 1; x <= end; x += 1) {
      ctx.lineTo(x, terrainArray[x] + 0.5);
    }
    ctx.stroke();

    if (!isFrostMaw && !support) {
      ctx.strokeStyle = colorWithAlpha("#1d120b", 0.55);
      ctx.lineWidth = 1.3;
      for (let x = start + 34; x < end; x += 70) {
        if (!isTerrainLayerSolidAt(x, terrainArray, theme, bridgeFloor)) {
          continue;
        }
        const topY = getRawTerrainYAt(x, terrainArray);
        const bottomY = getBridgeBottomAt(x, theme, terrainArray, bridgeFloor);
        ctx.beginPath();
        ctx.moveTo(x, topY + 3);
        ctx.lineTo(x - 8, bottomY - 2);
        ctx.stroke();
      }
    }

    if (isSkyRuins && !support) {
      for (let x = start + 22; x < end - 22; x += 34) {
        if (!isTerrainLayerSolidAt(x, terrainArray, theme, bridgeFloor)) {
          continue;
        }
        const prevX = Math.max(start, x - 1);
        const nextX = Math.min(end, x + 1);
        const topY = getRawTerrainYAt(x, terrainArray);
        const bottomY = getBridgeBottomAt(x, theme, terrainArray, bridgeFloor);
        const centerY = (topY + bottomY) / 2;
        const angle = Math.atan2(
          getRawTerrainYAt(nextX, terrainArray) - getRawTerrainYAt(prevX, terrainArray),
          nextX - prevX || 1,
        );
        ctx.save();
        ctx.translate(x, centerY);
        ctx.rotate(angle);
        ctx.strokeStyle = colorWithAlpha("#4d2c1a", 0.92);
        ctx.lineWidth = 1.8;
        roundRect(ctx, -12, -9, 24, 18, 8, false, true);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4.4, 7.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = colorWithAlpha("#dcc3a0", 0.7);
        ctx.beginPath();
        ctx.arc(-8, 0, 1.4, 0, Math.PI * 2);
        ctx.arc(8, 0, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (isFrostMaw) {
      ctx.strokeStyle = colorWithAlpha("#dfffff", support ? 0.8 : 0.95);
      ctx.lineWidth = support ? 1.8 : 2;
      for (let x = start + 18; x < end - 10; x += 24) {
        const topY = getRawTerrainYAt(x, terrainArray);
        ctx.beginPath();
        ctx.moveTo(x - 8, topY + 3);
        ctx.lineTo(x - 1, topY - 5);
        ctx.lineTo(x + 6, topY + 2);
        ctx.stroke();
      }

      ctx.strokeStyle = colorWithAlpha("#1c5f86", support ? 0.58 : 0.7);
      ctx.lineWidth = support ? 1.3 : 1.6;
      for (let x = start + 28; x < end - 24; x += 56) {
        const topY = getRawTerrainYAt(x, terrainArray);
        const bottomY = getBridgeBottomAt(x, theme, terrainArray, bridgeFloor);
        ctx.beginPath();
        ctx.moveTo(x - 12, topY + 5);
        ctx.lineTo(x + 4, (topY + bottomY) * 0.5);
        ctx.lineTo(x - 6, bottomY - 3);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const drawLayer = (terrainArray, bridgeFloor, support = false) => {
    if (!Array.isArray(terrainArray) || !terrainArray.length) {
      return;
    }

    let segmentStart = null;
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const solid = isTerrainLayerSolidAt(x, terrainArray, theme, bridgeFloor);
      if (solid && segmentStart === null) {
        segmentStart = x;
        continue;
      }

      if (!solid && segmentStart !== null) {
        drawSegment(segmentStart, x - 1, terrainArray, bridgeFloor, support);
        segmentStart = null;
      }
    }

    if (segmentStart !== null) {
      drawSegment(segmentStart, WORLD_WIDTH - 1, terrainArray, bridgeFloor, support);
    }
  };

  drawLayer(app.game.terrain, app.game.bridgeFloor, false);
  if (isFrostMaw) {
    drawLayer(app.game.supportTerrain, app.game.supportBridgeFloor, true);
  }
}

function fract(value) {
  return value - Math.floor(value);
}

function seededUnit(index, salt = 0) {
  return fract(Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123);
}

function getWindVisualState() {
  const intensity = clamp(Math.abs(app.game.wind) / MAX_WIND, 0, 1);
  const direction = app.game.wind === 0 ? 1 : Math.sign(app.game.wind);
  return {
    intensity,
    direction,
    angle: direction * (0.08 + intensity * 0.52),
    flow: 36 + intensity * 210,
    sway: 6 + intensity * 18,
    alpha: 0.08 + intensity * 0.46,
  };
}

function getWindFieldPoint(index, now, motion, options) {
  const margin = options.margin ?? 140;
  const travelWidth = WORLD_WIDTH + margin * 2;
  const laneSeed = seededUnit(index, 1.7);
  const phase = seededUnit(index, 2.9);
  const speedScale = options.speedScale ?? 1;
  const travel = (now * 0.001 * motion.flow * speedScale + phase * travelWidth) % travelWidth;
  const x = motion.direction > 0 ? -margin + travel : WORLD_WIDTH + margin - travel;
  const yBase = options.bandTop + laneSeed * options.bandHeight;
  const wobble =
    Math.sin(now * 0.0013 * speedScale + phase * Math.PI * 2) *
    motion.sway *
    (0.45 + seededUnit(index, 4.1) * 0.75);
  return {
    x,
    y: yBase + wobble,
    phase,
  };
}

function drawWindStreak(x, y, angle, length, width, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 18;
  ctx.shadowColor = colorWithAlpha(color, alpha * 0.95);
  ctx.strokeStyle = colorWithAlpha(color, alpha * 0.46);
  ctx.lineWidth = width * 2.35;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-length * 0.55, -width * 0.2);
  ctx.quadraticCurveTo(0, -width * 0.9, length * 0.68, width * 0.15);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = colorWithAlpha(shadeHex(color, 14), alpha * 0.92);
  ctx.lineWidth = Math.max(1.4, width * 1.08);
  ctx.beginPath();
  ctx.moveTo(-length * 0.5, -width * 0.18);
  ctx.quadraticCurveTo(0, -width * 0.82, length * 0.66, width * 0.12);
  ctx.stroke();

  ctx.strokeStyle = colorWithAlpha("#ffffff", alpha * 0.78);
  ctx.lineWidth = Math.max(1.1, width * 0.46);
  ctx.beginPath();
  ctx.moveTo(-length * 0.18, -width * 0.24);
  ctx.lineTo(length * 0.38, -width * 0.02);
  ctx.stroke();
  ctx.restore();
}

function drawWindPetal(x, y, angle, size, color, alpha, accent = "#fff8e8") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 14;
  ctx.shadowColor = colorWithAlpha(accent, alpha * 0.62);
  ctx.fillStyle = colorWithAlpha(color, alpha);
  ctx.beginPath();
  ctx.ellipse(-size * 0.22, 0, size * 0.48, size * 0.24, -0.45, 0, Math.PI * 2);
  ctx.ellipse(size * 0.18, 0, size * 0.54, size * 0.28, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colorWithAlpha(accent, alpha * 0.72);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-size * 0.52, 0);
  ctx.lineTo(size * 0.5, 0);
  ctx.stroke();
  ctx.fillStyle = colorWithAlpha("#ffffff", alpha * 0.55);
  ctx.beginPath();
  ctx.arc(size * 0.08, 0, Math.max(1.4, size * 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWindLeaf(x, y, angle, size, color, alpha, veinColor = "#f4fff0") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 14;
  ctx.shadowColor = colorWithAlpha(veinColor, alpha * 0.56);
  ctx.fillStyle = colorWithAlpha(color, alpha);
  ctx.beginPath();
  ctx.moveTo(-size * 0.62, 0);
  ctx.quadraticCurveTo(-size * 0.14, -size * 0.5, size * 0.64, 0);
  ctx.quadraticCurveTo(-size * 0.16, size * 0.46, -size * 0.62, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colorWithAlpha(veinColor, alpha * 0.68);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-size * 0.46, 0);
  ctx.lineTo(size * 0.44, 0);
  ctx.stroke();
  ctx.strokeStyle = colorWithAlpha("#ffffff", alpha * 0.42);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-size * 0.18, -size * 0.08);
  ctx.lineTo(size * 0.2, -size * 0.04);
  ctx.stroke();
  ctx.restore();
}

function drawWindShard(x, y, angle, size, color, alpha, edgeColor = "#effcff") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 16;
  ctx.shadowColor = colorWithAlpha(edgeColor, alpha * 0.7);
  ctx.fillStyle = colorWithAlpha(color, alpha);
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, 0);
  ctx.lineTo(0, -size * 0.56);
  ctx.lineTo(size * 0.7, 0);
  ctx.lineTo(0, size * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colorWithAlpha(edgeColor, alpha * 0.6);
  ctx.lineWidth = 1.35;
  ctx.stroke();
  ctx.strokeStyle = colorWithAlpha("#ffffff", alpha * 0.38);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, -size * 0.2);
  ctx.lineTo(size * 0.34, 0);
  ctx.stroke();
  ctx.restore();
}

function drawWindFlake(x, y, angle, size, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 12;
  ctx.shadowColor = colorWithAlpha(color, alpha * 0.64);
  ctx.strokeStyle = colorWithAlpha(color, alpha);
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.58, 0);
    ctx.lineTo(size * 0.58, 0);
    ctx.stroke();
    ctx.rotate(Math.PI / 3);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = colorWithAlpha("#ffffff", alpha * 0.46);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.4, size * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWindMote(x, y, radius, color, alpha) {
  ctx.save();
  ctx.shadowBlur = 12;
  ctx.shadowColor = colorWithAlpha(color, alpha * 0.8);
  ctx.fillStyle = colorWithAlpha(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = colorWithAlpha("#ffffff", alpha * 0.34);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.8, radius * 0.46), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWindStreakField(now, motion, options) {
  const count = Math.max(2, Math.round(options.count * (0.32 + motion.intensity * 1.08)));
  for (let i = 0; i < count; i += 1) {
    const point = getWindFieldPoint(i, now, motion, options);
    const sizeSeed = seededUnit(i, 6.2);
    const angle =
      motion.angle +
      (seededUnit(i, 3.8) - 0.5) * (options.angleJitter ?? 0.22) +
      Math.sin(now * 0.001 + point.phase * Math.PI * 2) * 0.05;
    drawWindStreak(
      point.x,
      point.y,
      angle,
      options.length * (0.84 + sizeSeed * 0.64 + motion.intensity * 0.34),
      options.width * (0.94 + sizeSeed * 0.52),
      options.color,
      motion.alpha * (options.alphaScale ?? 1) * (0.96 + sizeSeed * 0.4),
    );
  }
}

function drawWindShapeField(now, motion, options) {
  const count = Math.max(2, Math.round(options.count * (0.32 + motion.intensity * 1.08)));
  for (let i = 0; i < count; i += 1) {
    const point = getWindFieldPoint(i, now, motion, options);
    const sizeSeed = seededUnit(i, 8.4);
    const angle =
      motion.angle +
      (seededUnit(i, 9.1) - 0.5) * (options.angleJitter ?? 0.5) +
      Math.sin(now * 0.0016 + point.phase * Math.PI * 2) * 0.12;
    const size = options.size * (0.82 + sizeSeed * 0.78 + motion.intensity * 0.28);
    const alpha = motion.alpha * (options.alphaScale ?? 1) * (0.9 + sizeSeed * 0.46);
    options.draw(point.x, point.y, angle, size, alpha, i);
  }
}

function drawWindRibbon(now) {
  const theme = currentTheme();
  const motion = getWindVisualState();

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  if (theme.id === "coral") {
    drawWindShapeField(now, motion, {
      count: 24,
      bandTop: 90,
      bandHeight: 260,
      size: 18,
      speedScale: 0.72,
      draw: (x, y, angle, size, alpha, index) =>
        drawWindPetal(
          x,
          y,
          angle,
          size,
          index % 2 ? "#ffd9a5" : "#fff0c7",
          alpha * 0.95,
          "#fff8ef",
        ),
    });
    drawWindStreakField(now, motion, {
      count: 16,
      bandTop: 120,
      bandHeight: 220,
      length: 30,
      width: 2.6,
      speedScale: 0.58,
      color: "#fff8de",
      alphaScale: 0.82,
    });
  } else if (theme.id === "mint") {
    drawWindShapeField(now, motion, {
      count: 22,
      bandTop: 80,
      bandHeight: 280,
      size: 18,
      speedScale: 0.8,
      draw: (x, y, angle, size, alpha, index) =>
        drawWindLeaf(
          x,
          y,
          angle,
          size,
          index % 2 ? "#baf7cc" : "#ecfff0",
          alpha,
          "#fafffb",
        ),
    });
    drawWindStreakField(now, motion, {
      count: 12,
      bandTop: 104,
      bandHeight: 240,
      length: 28,
      width: 2.3,
      speedScale: 0.72,
      color: "#effff5",
      alphaScale: 0.74,
    });
  } else if (theme.id === "amber") {
    drawWindStreakField(now, motion, {
      count: 32,
      bandTop: WORLD_HEIGHT * 0.36,
      bandHeight: WORLD_HEIGHT * 0.34,
      length: 38,
      width: 2.8,
      speedScale: 1.08,
      color: "#f3c178",
      alphaScale: 1,
      angleJitter: 0.3,
    });
    drawWindShapeField(now, motion, {
      count: 16,
      bandTop: WORLD_HEIGHT * 0.44,
      bandHeight: WORLD_HEIGHT * 0.22,
      size: 12,
      speedScale: 0.92,
      draw: (x, y, angle, size, alpha) => drawWindMote(x, y, size * 0.18, "#ffd18b", alpha * 0.95),
    });
  } else if (theme.id === "mesa") {
    drawWindStreakField(now, motion, {
      count: 28,
      bandTop: WORLD_HEIGHT * 0.28,
      bandHeight: WORLD_HEIGHT * 0.32,
      length: 34,
      width: 2.6,
      speedScale: 0.95,
      color: "#f1c78f",
      alphaScale: 0.92,
    });
    drawWindShapeField(now, motion, {
      count: 14,
      bandTop: WORLD_HEIGHT * 0.34,
      bandHeight: WORLD_HEIGHT * 0.28,
      size: 14,
      speedScale: 0.76,
      draw: (x, y, angle, size, alpha, index) =>
        drawWindLeaf(x, y, angle, size * 0.82, index % 2 ? "#efcf98" : "#f8e3b0", alpha * 0.86, "#fff2d6"),
    });
  } else if (theme.id === "storm") {
    drawWindStreakField(now, motion, {
      count: 34,
      bandTop: 70,
      bandHeight: WORLD_HEIGHT * 0.5,
      length: 46,
      width: 3,
      speedScale: 1.2,
      color: "#e8efff",
      alphaScale: 1.06,
      angleJitter: 0.34,
    });
    drawWindShapeField(now, motion, {
      count: 18,
      bandTop: 90,
      bandHeight: WORLD_HEIGHT * 0.42,
      size: 14,
      speedScale: 1.04,
      draw: (x, y, angle, size, alpha, index) =>
        drawWindShard(x, y, angle, size, index % 2 ? "#cfd8e6" : "#f7fbff", alpha * 0.72, "#ffffff"),
    });
  } else if (theme.id === "canyonbridge") {
    drawWindStreakField(now, motion, {
      count: 28,
      bandTop: WORLD_HEIGHT * 0.26,
      bandHeight: WORLD_HEIGHT * 0.36,
      length: 36,
      width: 2.7,
      speedScale: 1.02,
      color: "#efc796",
      alphaScale: 0.94,
    });
    drawWindShapeField(now, motion, {
      count: 14,
      bandTop: WORLD_HEIGHT * 0.3,
      bandHeight: WORLD_HEIGHT * 0.28,
      size: 14,
      speedScale: 0.7,
      draw: (x, y, angle, size, alpha, index) =>
        drawWindPetal(x, y, angle, size * 0.78, index % 2 ? "#ddb17d" : "#f4d8b1", alpha * 0.84, "#fff0db"),
    });
  } else if (theme.id === "skyruins") {
    drawWindShapeField(now, motion, {
      count: 22,
      bandTop: 86,
      bandHeight: WORLD_HEIGHT * 0.34,
      size: 16,
      speedScale: 0.74,
      draw: (x, y, angle, size, alpha, index) =>
        drawWindLeaf(x, y, angle, size, index % 2 ? "#f1d2a4" : "#fff1d8", alpha * 0.92, "#fffaf0"),
    });
    drawWindStreakField(now, motion, {
      count: 14,
      bandTop: 120,
      bandHeight: WORLD_HEIGHT * 0.24,
      length: 34,
      width: 2.4,
      speedScale: 0.62,
      color: "#fff2d1",
      alphaScale: 0.82,
    });
  } else if (theme.id === "frostmaw") {
    drawWindShapeField(now, motion, {
      count: 22,
      bandTop: 72,
      bandHeight: WORLD_HEIGHT * 0.38,
      size: 14,
      speedScale: 0.96,
      draw: (x, y, angle, size, alpha, index) =>
        (index % 3 === 0
          ? drawWindFlake(x, y, angle, size * 0.8, "#efffff", alpha * 0.9)
          : drawWindShard(x, y, angle, size, index % 2 ? "#d5fbff" : "#9deeff", alpha * 0.8, "#efffff")),
    });
    drawWindStreakField(now, motion, {
      count: 18,
      bandTop: 88,
      bandHeight: WORLD_HEIGHT * 0.32,
      length: 28,
      width: 2.2,
      speedScale: 1.1,
      color: "#ecffff",
      alphaScale: 0.84,
    });
  }

  ctx.restore();
}

function drawProjectile(projectile) {
  const speed = Math.hypot(projectile.vx, projectile.vy);
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const shellColor = shadeHex(projectile.trail, -48);
  const glowColor = shadeHex(projectile.trail, 28);
  const coreColor = shadeHex(projectile.trail, 96);

  if (projectile.homingRange) {
    const missileLength = clamp(24 + speed * 0.36, 24, 32);
    const exhaustLength = clamp(26 + speed * 1.7, 28, 58);
    const lockPulse = projectile.homingActive ? 0.84 + Math.sin(performance.now() / 85) * 0.14 : 0.4;

    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(angle);

    const exhaust = ctx.createLinearGradient(-exhaustLength, 0, 4, 0);
    exhaust.addColorStop(0, colorWithAlpha(projectile.trail, 0));
    exhaust.addColorStop(0.34, colorWithAlpha(projectile.trail, 0.42));
    exhaust.addColorStop(0.75, colorWithAlpha(glowColor, 0.92));
    exhaust.addColorStop(1, colorWithAlpha("#fffef4", 0.96));
    ctx.fillStyle = exhaust;
    ctx.beginPath();
    ctx.moveTo(-exhaustLength, 0);
    ctx.quadraticCurveTo(-exhaustLength * 0.3, -9, 0, -5.6);
    ctx.quadraticCurveTo(4, -3.2, 7, 0);
    ctx.quadraticCurveTo(4, 3.2, 0, 5.6);
    ctx.quadraticCurveTo(-exhaustLength * 0.3, 9, -exhaustLength, 0);
    ctx.fill();

    ctx.shadowBlur = 24;
    ctx.shadowColor = colorWithAlpha(projectile.trail, 0.92);
    ctx.fillStyle = shellColor;
    roundRect(ctx, -2, -4.8, missileLength, 9.6, 4.6, true, false);
    ctx.shadowBlur = 0;

    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.moveTo(missileLength - 1, 0);
    ctx.lineTo(missileLength - 8, -6.5);
    ctx.lineTo(missileLength - 8, 6.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colorWithAlpha(coreColor, 0.9);
    ctx.beginPath();
    ctx.moveTo(4, -4.8);
    ctx.lineTo(-2.4, -10);
    ctx.lineTo(1.8, -3.3);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, 4.8);
    ctx.lineTo(-2.4, 10);
    ctx.lineTo(1.8, 3.3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f8fff2";
    ctx.beginPath();
    ctx.arc(missileLength - 7, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colorWithAlpha("#ffffff", lockPulse);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(missileLength - 7, 0, 5.8, -Math.PI * 0.26, Math.PI * 0.26);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const tailLength = clamp(24 + speed * 2.4, 28, 58);
  const bodyLength = clamp(16 + speed * 0.3, 16, 22);

  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);

  const tail = ctx.createLinearGradient(-tailLength, 0, bodyLength * 0.5, 0);
  tail.addColorStop(0, colorWithAlpha(shellColor, 0));
  tail.addColorStop(0.35, colorWithAlpha(projectile.trail, 0.45));
  tail.addColorStop(0.72, colorWithAlpha(glowColor, 0.92));
  tail.addColorStop(1, colorWithAlpha(coreColor, 0.98));
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(-tailLength, 0);
  ctx.quadraticCurveTo(-tailLength * 0.44, -7.5, bodyLength * 0.25, -6.2);
  ctx.quadraticCurveTo(bodyLength * 0.86, -4.6, bodyLength, 0);
  ctx.quadraticCurveTo(bodyLength * 0.86, 4.6, bodyLength * 0.25, 6.2);
  ctx.quadraticCurveTo(-tailLength * 0.44, 7.5, -tailLength, 0);
  ctx.fill();

  ctx.shadowBlur = 24;
  ctx.shadowColor = colorWithAlpha(projectile.trail, 0.95);
  ctx.fillStyle = colorWithAlpha(glowColor, 0.82);
  ctx.beginPath();
  ctx.ellipse(2, 0, bodyLength * 0.7, 7.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = shellColor;
  ctx.beginPath();
  ctx.ellipse(3, 0, bodyLength * 0.56, 4.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colorWithAlpha(coreColor, 0.95);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(4, 0, 6.2, -Math.PI * 0.42, Math.PI * 0.42);
  ctx.stroke();

  ctx.fillStyle = "#fffdf5";
  ctx.beginPath();
  ctx.ellipse(bodyLength * 0.34, -1.1, 4.3, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colorWithAlpha(coreColor, 0.92);
  ctx.beginPath();
  ctx.moveTo(-2.5, 0);
  ctx.lineTo(3.5, -2.1);
  ctx.lineTo(3.5, 2.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getPreviewShot(player) {
  const tank = TANK_TYPES[player.tankType] ?? TANK_TYPES.armor;
  const slot = player.selectedWeapon ?? "ss1";
  const weaponId = tank.weapons[slot];
  const weapon = WEAPONS[weaponId];
  if (!weapon) return null;
  return {
    speedMultiplier: weapon.projectile.speedMultiplier ?? 1.0,
    gravityScale: weapon.projectile.gravityScale ?? 1.0,
    windFactor: weapon.projectile.windFactor ?? 1.0,
    damage: weapon.projectile.damage,
    radius: weapon.projectile.radius,
    spread: 0,
  };
}

function drawAimPreview(player) {
  if (!player || app.game.phase !== "aim" || !canLocalPlayerAct()) {
    return;
  }

  const shot = getPreviewShot(player);
  if (!shot) {
    return;
  }

  const muzzle = getMuzzle(player);
  const angle = degToRad(player.angle + (shot.spread ?? 0));
  const directionX = Math.cos(angle);
  const directionY = -Math.sin(angle);
  const guideLength = 180 + powerToPercent(player.power) * 1.7;
  let endPoint = {
    x: muzzle.x + directionX * guideLength,
    y: muzzle.y + directionY * guideLength,
  };

  for (let distanceStep = 18; distanceStep <= guideLength; distanceStep += 10) {
    const sampleX = muzzle.x + directionX * distanceStep;
    const sampleY = muzzle.y + directionY * distanceStep;

    if (sampleX < 0 || sampleX > WORLD_WIDTH || sampleY < 0 || sampleY > WORLD_HEIGHT) {
      endPoint = {
        x: clamp(sampleX, 0, WORLD_WIDTH),
        y: clamp(sampleY, 0, WORLD_HEIGHT),
      };
      break;
    }

    if (isTerrainCollisionAt(sampleX, sampleY)) {
      endPoint = { x: sampleX, y: sampleY };
      break;
    }
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowBlur = 20;
  ctx.shadowColor = colorWithAlpha(shot.trail, 0.95);
  ctx.strokeStyle = colorWithAlpha(shot.trail, 0.3);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(muzzle.x, muzzle.y);
  ctx.lineTo(endPoint.x, endPoint.y);
  ctx.stroke();

  ctx.shadowBlur = 0;
  const line = ctx.createLinearGradient(muzzle.x, muzzle.y, endPoint.x, endPoint.y);
  line.addColorStop(0, colorWithAlpha("#ffffff", 0.95));
  line.addColorStop(0.35, colorWithAlpha(shadeHex(shot.trail, 82), 0.95));
  line.addColorStop(1, colorWithAlpha(shot.trail, 0.98));
  ctx.strokeStyle = line;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(muzzle.x, muzzle.y);
  ctx.lineTo(endPoint.x, endPoint.y);
  ctx.stroke();

  ctx.fillStyle = colorWithAlpha("#ffffff", 0.96);
  ctx.beginPath();
  ctx.arc(endPoint.x, endPoint.y, 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colorWithAlpha(shot.trail, 0.88);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(endPoint.x, endPoint.y, 8.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawExplosions() {
  app.game.explosions.forEach((explosion) => {
    const alpha = clamp(explosion.life, 0, 1);
    const radius = explosion.radius * (1.3 - alpha * 0.45);
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    const gradient = ctx.createRadialGradient(
      explosion.x,
      explosion.y,
      radius * 0.1,
      explosion.x,
      explosion.y,
      radius,
    );
    gradient.addColorStop(0, "#fffce8");
    gradient.addColorStop(0.3, explosion.color);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function roundRect(context, x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  if (fill) {
    context.fill();
  }
  if (stroke) {
    context.stroke();
  }
}

function drawTrackSegment(x, y, width, height, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, height, Math.min(height * 0.45, 8), true, false);
}

function drawRivetRow(startX, y, count, gap, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTankChassis(tankId, bodyColor, trimColor) {
  ctx.fillStyle = "#2c455d";

  if (tankId === "skyrider") {
    roundRect(ctx, -23, 1, 46, 14, 11, true, false);
    drawTrackSegment(-18, 5, 14, 5, "#87f4ff");
    drawTrackSegment(4, 5, 14, 5, "#87f4ff");
    ctx.strokeStyle = colorWithAlpha("#dffcff", 0.95);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, 2);
    ctx.lineTo(-18, -6);
    ctx.lineTo(-10, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(30, 2);
    ctx.lineTo(18, -6);
    ctx.lineTo(10, 4);
    ctx.stroke();
    return;
  }

  if (tankId === "mole") {
    roundRect(ctx, -28, 0, 56, 18, 12, true, false);
    drawTrackSegment(-22, 3, 14, 9, "#1e2f40");
    drawTrackSegment(-4, 3, 14, 9, "#1e2f40");
    drawTrackSegment(14, 3, 14, 9, "#1e2f40");
    ctx.fillStyle = shadeHex(bodyColor, -28);
    roundRect(ctx, -12, 10, 24, 5, 3, true, false);
    return;
  }

  if (tankId === "aegis") {
    roundRect(ctx, -24, 0, 48, 16, 12, true, false);
    drawTrackSegment(-20, 4, 40, 7, "#253b52");
    ctx.strokeStyle = colorWithAlpha("#a9f0ff", 0.6);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 7, 22, Math.PI * 0.08, Math.PI * 0.92);
    ctx.stroke();
    return;
  }

  if (tankId === "twinfang") {
    roundRect(ctx, -24, 1, 48, 16, 12, true, false);
    drawTrackSegment(-20, 4, 16, 8, "#213446");
    drawTrackSegment(-2, 4, 16, 8, "#213446");
    drawTrackSegment(16, 4, 4, 8, "#213446");
    ctx.fillStyle = shadeHex(bodyColor, 22);
    roundRect(ctx, -25, -2, 50, 5, 4, true, false);
    return;
  }

  roundRect(ctx, -24, 0, 48, 18, 12, true, false);
  drawTrackSegment(-19, 4, 38, 8, "#223749");
}

function drawTankHull(tankId, bodyColor, trimColor) {
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 3;

  if (tankId === "ironclad") {
    roundRect(ctx, -24, -17, 48, 28, 12, true, true);
    ctx.fillStyle = shadeHex(bodyColor, -22);
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.lineTo(0, -18);
    ctx.lineTo(26, -4);
    ctx.lineTo(18, 10);
    ctx.lineTo(-18, 10);
    ctx.closePath();
    ctx.fill();
    drawRivetRow(-14, -5, 5, 7, colorWithAlpha("#fff7d2", 0.72));
    return;
  }

  if (tankId === "skyrider") {
    ctx.beginPath();
    ctx.moveTo(-24, 6);
    ctx.quadraticCurveTo(-14, -18, 0, -20);
    ctx.quadraticCurveTo(16, -18, 24, 4);
    ctx.quadraticCurveTo(10, 10, -18, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colorWithAlpha("#ffffff", 0.9);
    roundRect(ctx, -8, -25, 16, 10, 5, true, false);
    ctx.fillStyle = colorWithAlpha("#6cf0ff", 0.92);
    roundRect(ctx, -18, -2, 9, 5, 3, true, false);
    roundRect(ctx, 9, -2, 9, 5, 3, true, false);
    return;
  }

  if (tankId === "twinfang") {
    roundRect(ctx, -24, -14, 48, 24, 11, true, true);
    ctx.fillStyle = shadeHex(bodyColor, -20);
    roundRect(ctx, -21, -7, 18, 12, 6, true, false);
    roundRect(ctx, 3, -7, 18, 12, 6, true, false);
    ctx.fillStyle = colorWithAlpha("#fff5ff", 0.9);
    roundRect(ctx, -16, -20, 11, 8, 4, true, false);
    roundRect(ctx, 5, -20, 11, 8, 4, true, false);
    return;
  }

  if (tankId === "mole") {
    roundRect(ctx, -24, -13, 48, 23, 11, true, true);
    ctx.fillStyle = shadeHex(bodyColor, -26);
    roundRect(ctx, -18, -5, 36, 8, 4, true, false);
    ctx.fillStyle = colorWithAlpha("#efffdc", 0.92);
    roundRect(ctx, -10, -14, 20, 8, 4, true, false);
    ctx.fillStyle = colorWithAlpha("#d5ff76", 0.86);
    ctx.beginPath();
    ctx.arc(0, -14, 6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (tankId === "aegis") {
    roundRect(ctx, -23, -13, 46, 23, 12, true, true);
    ctx.fillStyle = colorWithAlpha("#eff7ff", 0.95);
    ctx.beginPath();
    ctx.arc(0, -12, 12, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = colorWithAlpha("#97b2ff", 0.52);
    ctx.beginPath();
    ctx.arc(0, -12, 16, Math.PI, 0);
    ctx.fill();
    return;
  }

  roundRect(ctx, -22, -16, 44, 26, 12, true, true);
}

function drawTankTurretDetails(tankId, player, bodyColor) {
  const angle = degToRad(player.angle);
  const barrelColor = tankId === "ironclad" ? "#fff5d5" : "#f8feff";
  let barrelWidth = 5;
  let barrelLength = 34;
  let turretY = -18;

  if (tankId === "ironclad") {
    ctx.fillStyle = shadeHex(bodyColor, -18);
    roundRect(ctx, -13, -30, 26, 14, 8, true, false);
    ctx.fillStyle = colorWithAlpha("#fff8e0", 0.92);
    roundRect(ctx, -8, -26, 16, 8, 4, true, false);
    barrelWidth = 7;
    barrelLength = 38;
    turretY = -20;
  } else if (tankId === "skyrider") {
    ctx.fillStyle = shadeHex(bodyColor, 18);
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.quadraticCurveTo(0, -34, 10, -20);
    ctx.lineTo(6, -12);
    ctx.lineTo(-6, -12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha("#dbffff", 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(0, -38);
    ctx.stroke();
    barrelWidth = 4;
    barrelLength = 38;
  } else if (tankId === "twinfang") {
    ctx.fillStyle = shadeHex(bodyColor, -12);
    roundRect(ctx, -16, -25, 32, 11, 6, true, false);
    ctx.strokeStyle = "#ffe6f3";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-5, -18);
    ctx.lineTo(-5 + Math.cos(angle) * 30, -18 - Math.sin(angle) * 30);
    ctx.moveTo(5, -18);
    ctx.lineTo(5 + Math.cos(angle) * 30, -18 - Math.sin(angle) * 30);
    ctx.stroke();
    barrelWidth = 0;
  } else if (tankId === "mole") {
    ctx.fillStyle = shadeHex(bodyColor, -18);
    roundRect(ctx, -16, -29, 32, 11, 5, true, false);
    ctx.fillStyle = colorWithAlpha("#f4ffe5", 0.94);
    roundRect(ctx, -11, -26, 7, 5, 2, true, false);
    roundRect(ctx, -3.5, -26, 7, 5, 2, true, false);
    roundRect(ctx, 4, -26, 7, 5, 2, true, false);
    ctx.fillStyle = colorWithAlpha("#d6ff73", 0.95);
    ctx.beginPath();
    ctx.arc(0, -17.5, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha("#fdfff2", 0.96);
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-3, -22);
    ctx.lineTo(-3 + Math.cos(angle) * 32, -22 - Math.sin(angle) * 32);
    ctx.moveTo(3, -18);
    ctx.lineTo(3 + Math.cos(angle) * 30, -18 - Math.sin(angle) * 30);
    ctx.stroke();
    barrelWidth = 0;
  } else if (tankId === "aegis") {
    ctx.fillStyle = colorWithAlpha("#ffffff", 0.88);
    ctx.beginPath();
    ctx.arc(0, -20, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha("#b8e8ff", 0.78);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -20, 16, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    barrelWidth = 5.4;
    barrelLength = 32;
  } else {
    ctx.fillStyle = "#f9ffff";
    roundRect(ctx, -12, -28, 24, 16, 8, true, false);
  }

  if (barrelWidth > 0) {
    ctx.strokeStyle = barrelColor;
    ctx.lineWidth = barrelWidth;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, turretY);
    ctx.lineTo(Math.cos(angle) * barrelLength, turretY - Math.sin(angle) * barrelLength);
    ctx.stroke();
  }
}

function drawPlayer(player) {
  const tank = TANK_TYPES[player.tankType] ?? TANK_TYPES.armor;
  const isCurrent = getCurrentPlayer()?.id === player.id && app.game.phase !== "game-over";
  const bodyColor = player.alive ? (tank.visual?.primaryColor ?? player.color ?? "#ffb84f") : "#97a4b3";
  const trimColor = player.alive ? colorWithAlpha("#ffffff", 0.66) : colorWithAlpha("#d4dae2", 0.55);

  // Advance per-frame animation counters
  if ((player.recoilPhase ?? 1) < 1) {
    player.recoilPhase = Math.min(1, (player.recoilPhase ?? 1) + 1 / 10);
  }
  if ((player.tintFlash ?? 0) > 0) {
    player.tintFlash = Math.max(0, (player.tintFlash ?? 0) - 1 / 7.2);
  }

  if (USE_SVG_TANKS && TANK_IDS.includes(tank.id)) {
    // SVG-rendered Phase-1 tank — draw directly in world space
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 18, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isCurrent) {
      ctx.strokeStyle = "rgba(255, 170, 76, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    renderTankToCanvas(ctx, {
      tankId: tank.id,
      x: player.x,
      y: player.y,
      angle: 0,
      turretAngle: degToRad(player.angle),
      teamColor: TEAM_COLORS[0],
      recoilPhase: player.recoilPhase ?? 1,
      tintFlash: player.tintFlash ?? 0,
      scale: 0.5,
    });
  } else {
    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 18, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    drawTankChassis(tank.id, bodyColor, trimColor);
    drawTankHull(tank.id, bodyColor, trimColor);
    drawTankTurretDetails(tank.id, player, bodyColor);

    if (isCurrent) {
      ctx.strokeStyle = "rgba(255, 170, 76, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 14px Nunito";
  ctx.fillStyle = "#163450";
  ctx.fillText(player.name, player.x, player.y - 38);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(player.x - 30, player.y - 28, 60, 8);
  ctx.fillStyle = player.alive ? "#68e7c3" : "#96a5b4";
  ctx.fillRect(player.x - 30, player.y - 28, (player.health / player.maxHealth) * 60, 8);
  if (player.shield > 0) {
    const maxShield = 26;
    ctx.fillStyle = "rgba(120,216,255,0.92)";
    ctx.fillRect(player.x - 30, player.y - 18, (player.shield / maxShield) * 60, 4);
  }
  ctx.restore();
}

function drawBattle(now) {
  const localPlayer = getLocalPlayer();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawBattleBackdrop();

  ctx.save();
  ctx.translate(BATTLE_CAMERA_OFFSET_X, BATTLE_CAMERA_OFFSET_Y);
  ctx.scale(BATTLE_CAMERA_SCALE, BATTLE_CAMERA_SCALE);
  drawBackground(now);
  drawWindRibbon(now);
  drawTerrain();
  drawAimPreview(localPlayer);
  drawExplosions();
  app.game.projectiles.forEach(drawProjectile);
  app.game.players
    .slice()
    .sort((a, b) => a.y - b.y)
    .forEach(drawPlayer);
  ctx.restore();

  if (app.game.phase === "game-over" && app.game.winnerId) {
    const winner = app.game.players.find((player) => player.id === app.game.winnerId);
    if (winner) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.textAlign = "center";
      ctx.fillStyle = "#1d3752";
      ctx.font = "900 58px Paytone One";
      ctx.fillText("Victory", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 10);
      ctx.font = "900 26px Nunito";
      ctx.fillText(`${winner.name} commands the battlefield`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 38);
      ctx.restore();
    }
  }
}

function applyKeyboard(event) {
  if (!isBattleActive() || isEditableTarget(event.target)) {
    return;
  }

  if (event.repeat) {
    return;
  }

  const map = {
    ArrowLeft: "move-left",
    KeyA: "move-left",
    ArrowRight: "move-right",
    KeyD: "move-right",
    ArrowUp: "angle-up",
    KeyW: "angle-up",
    ArrowDown: "angle-down",
    KeyS: "angle-down",
  };
  if (event.code === "Space") {
    event.preventDefault();
    startChargeInput();
    return;
  }

  // Weapon slot selector: 1=SS1, 2=SS2, 3=NEW
  if (event.code === "Digit1" || event.code === "Numpad1") {
    event.preventDefault();
    setSelectedWeapon(getLocalPlayer(), "ss1");
    return;
  }
  if (event.code === "Digit2" || event.code === "Numpad2") {
    event.preventDefault();
    setSelectedWeapon(getLocalPlayer(), "ss2");
    return;
  }
  if (event.code === "Digit3" || event.code === "Numpad3") {
    event.preventDefault();
    setSelectedWeapon(getLocalPlayer(), "new");
    return;
  }

  const action = map[event.code];
  if (!action) {
    return;
  }
  event.preventDefault();
  startHoldInput(action);
}

function applyKeyup(event) {
  if (!isBattleActive() || isEditableTarget(event.target)) {
    return;
  }

  const map = {
    ArrowLeft: "move-left",
    KeyA: "move-left",
    ArrowRight: "move-right",
    KeyD: "move-right",
    ArrowUp: "angle-up",
    KeyW: "angle-up",
    ArrowDown: "angle-down",
    KeyS: "angle-down",
  };

  if (event.code === "Space") {
    event.preventDefault();
    releaseChargeInput();
    return;
  }

  const action = map[event.code];
  if (!action) {
    return;
  }
  event.preventDefault();
  stopHoldInput(action);
}

function preventBattleScroll(event) {
  if (!isBattleActive()) {
    return;
  }
  event.preventDefault();
}

function handleMainAction() {
  if (app.localRole === "host" && app.room && app.game.phase === "lobby") {
    startBattle();
    return;
  }

  if (app.localRole === "client" && app.room && app.game.phase === "lobby") {
    return;
  }

  if (app.invitePayload) {
    connectFromInvite();
    return;
  }

  createHostRoom();
}

function setManualPowerMarker(clientX) {
  if (!dom.powerTrack || !getLocalPlayer()) {
    return;
  }

  const bounds = dom.powerTrack.getBoundingClientRect();
  if (!bounds.width) {
    return;
  }

  const percent = ((clientX - bounds.left) / bounds.width) * 100;
  app.input.manualPowerMarker = percentToPower(percent);
  markUiDirty();
}

function animationLoop(now) {
  if (!animationLoop.lastTime) {
    animationLoop.lastTime = now;
  }
  const delta = Math.min(34, now - animationLoop.lastTime);
  animationLoop.lastTime = now;

  if (app.localRole === "host") {
    updateHostSimulation(delta);
  } else if (app.localRole === "client") {
    updateClientVisuals(delta);
  }

  drawBattle(now);
  renderUi(now);
  window.requestAnimationFrame(animationLoop);
}

function attachEvents() {
  dom.playerNameInput.addEventListener("input", (event) => {
    syncNicknameInput(event.target.value);
  });

  dom.copyInviteBtn.addEventListener("click", copyInviteLink);
  dom.mapPrevBtn.addEventListener("click", () => cycleSelectedTheme(-1));
  dom.mapNextBtn.addEventListener("click", () => cycleSelectedTheme(1));
  dom.addBotBtn.addEventListener("click", addBot);
  dom.leaveRoomBtn.addEventListener("click", () => leaveRoom(true));
  dom.battleLeaveBtn.addEventListener("click", () => leaveRoom(true));

  // Weapon slot tab click handler (Plan F Task 7)
  const weaponSlotsEl = document.getElementById("weapon-slots");
  if (weaponSlotsEl) {
    weaponSlotsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".weapon-slot");
      if (!btn || btn.disabled) return;
      const slot = btn.dataset.slot;
      if (slot) setSelectedWeapon(getLocalPlayer(), slot);
    });
  }

  dom.tankStrip.addEventListener("click", (event) => {
    const button = event.target.closest(".tank-tile");
    if (!button || button.disabled) {
      return;
    }
    event.preventDefault();
    const tankId = button.dataset.tankId;
    if (tankId === "random") {
      selectRandomTank();
    } else {
      selectTank(tankId);
    }
  });
  dom.mainActionBtn.addEventListener("click", handleMainAction);
  dom.powerTrack.addEventListener("pointerdown", (event) => {
    if (!isBattleActive()) {
      return;
    }
    event.preventDefault();
    setManualPowerMarker(event.clientX);
  });
  dom.powerTrack.addEventListener("contextmenu", (event) => {
    if (!isBattleActive()) {
      return;
    }
    event.preventDefault();
    app.input.manualPowerMarker = null;
    markUiDirty();
  });

  window.addEventListener("keydown", applyKeyboard, { passive: false });
  window.addEventListener("keyup", applyKeyup, { passive: false });
  window.addEventListener("wheel", preventBattleScroll, { passive: false });
  window.addEventListener("touchmove", preventBattleScroll, { passive: false });
  window.addEventListener("blur", releaseAllHeldInputs);
  window.addEventListener("pointerup", releaseAllHeldInputs);

  let minimapClickCount = 0;
  let minimapClickTimer = null;
  if (dom.lobbyMinimap) {
    dom.lobbyMinimap.addEventListener("click", () => {
      minimapClickCount++;
      if (minimapClickTimer) clearTimeout(minimapClickTimer);
      minimapClickTimer = setTimeout(() => { minimapClickCount = 0; }, 2000);
      if (minimapClickCount >= 10) {
        minimapClickCount = 0;
        // legacy tempest easter egg removed (Plan D)
      }
    });
  }

  [dom.chatInput, dom.battleChatInput].forEach((input) => {
    if (!input) {
      return;
    }
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        sendChatMessage(input.value);
        input.value = "";
      }
    });
    input.addEventListener("keyup", (e) => e.stopPropagation());
  });
  [dom.chatSendBtn, dom.battleChatSendBtn].forEach((btn) => {
    if (!btn) {
      return;
    }
    btn.addEventListener("click", () => {
      const input = btn.id.includes("battle") ? dom.battleChatInput : dom.chatInput;
      if (input) {
        sendChatMessage(input.value);
        input.value = "";
      }
    });
  });
}

async function init() {
  if (!getPeerCtor()) {
    updateStatus("모듈 로딩 실패", "sand");
    setTicker("Peer 연결 스크립트를 불러오지 못했습니다. 네트워크를 확인해주세요.");
  }

  if (USE_SVG_TANKS) {
    try {
      await loadTankTemplates();
      // Pre-rasterize all tanks for all team colors to avoid placeholder frames
      await Promise.all(
        TANK_IDS.flatMap((id) => TEAM_COLORS.map((team) => preRasterize(id, team)))
      );
    } catch (e) {
      console.warn("SVG tank templates failed to load, falling back to canvas drawing:", e);
    }
  }

  dom.playerNameInput.value = app.draftName;
  attachEvents();
  parseInviteHashOnLoad();
  renderUi();
  window.requestAnimationFrame(animationLoop);
}

init();
