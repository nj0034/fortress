export const VIEW_WIDTH = 1400;
export const VIEW_HEIGHT = 760;
export const FRAME_STEP = 1000 / 60;
export const SNAPSHOT_INTERVAL = 40;
export const TURN_FUEL = 100;
export const MOVE_COST = 11;
export const MOVE_STEP = 12;
export const ANGLE_STEP = 3;
export const MIN_POWER = 34;
export const MAX_POWER = 100;
export const CHARGE_RATE = 32;
export const HOLD_REPEAT_INTERVAL = 90;
export const LAUNCH_SPEED_DIVISOR = 4.5;
export const WIND_ACCELERATION = 0.35;
export const MAX_WIND = 0.18;
export const BATTLE_CAMERA_SCALE = 0.86;
export const WORLD_WIDTH = Math.round(VIEW_WIDTH / BATTLE_CAMERA_SCALE);
export const WORLD_HEIGHT = Math.round(VIEW_HEIGHT / BATTLE_CAMERA_SCALE);
export const BATTLE_CAMERA_OFFSET_X = Math.round((VIEW_WIDTH - WORLD_WIDTH * BATTLE_CAMERA_SCALE) / 2);
export const BATTLE_CAMERA_OFFSET_Y = Math.round((VIEW_HEIGHT - WORLD_HEIGHT * BATTLE_CAMERA_SCALE) / 2);
export const PLAYER_FALL_ACCELERATION = 0.44;
export const PLAYER_MAX_FALL_SPEED = 18;
export const VOID_TERRAIN_DEPTH = 140;
export const TANK_RADIUS = 21;
export const CRATER_EDGE = 22;
export const MAX_PLAYERS = 4;
export const HOLDABLE_ACTIONS = ["move-left", "move-right", "angle-up", "angle-down"];
export const OPPOSITE_HOLD_ACTION = {
  "move-left": "move-right",
  "move-right": "move-left",
  "angle-up": "angle-down",
  "angle-down": "angle-up",
};
export const BOT_NAMES = ["Rook", "Latch", "Mako", "Nova", "Torque", "Blitz", "Kite", "Beryl"];
export const DEFAULT_THEME_ID = "canyonbridge";
