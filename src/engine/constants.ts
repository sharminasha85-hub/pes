// Full-scale PES virtual pitch: 105m x 68m scaled at 10 units per meter
export const PITCH_WIDTH = 1050;
export const PITCH_HEIGHT = 680;
export const HALF_W = PITCH_WIDTH / 2;
export const HALF_H = PITCH_HEIGHT / 2;

// Penalty areas (authentic proportions)
export const PENALTY_AREA_W = 165;
export const PENALTY_AREA_H = 403;
export const SIX_YARD_W = 55;
export const SIX_YARD_H = 183;
export const PENALTY_SPOT_DIST = 110;
export const CENTER_CIRCLE_R = 91.5;

// 3D Goal dimensions (slightly generous for rewarding PES top-corner finishing)
export const GOAL_WIDTH = 112;
export const GOAL_HALF_W = GOAL_WIDTH / 2;
export const GOAL_HEIGHT = 40;
export const GOAL_DEPTH = 34;

// Physics constants (units per second)
export const GRAVITY = 560;
export const BALL_RADIUS = 6.2;
export const PLAYER_RADIUS = 13.5;
export const TURF_FRICTION = 0.985; // per 60Hz tick
export const AIR_DRAG = 0.996;
export const BALL_BOUNCE = 0.56;
export const CURL_STRENGTH = 240;

// Speed tuning
export const BASE_JOG_SPEED = 118;
export const BASE_SPRINT_SPEED = 172;
export const DRIBBLE_SPEED_FACTOR = 0.91;
export const GK_MOVE_SPEED = 115;

// Power gauge tuning
export const CHARGE_RATE_SHOOT = 1.48; // full bar in ~0.68s
export const CHARGE_RATE_PASS = 1.75;
export const CHARGE_RATE_LOB = 1.55;

// Replay buffer: 60fps * 4.2 seconds
export const REPLAY_BUFFER_SIZE = 250;
export const REPLAY_PLAYBACK_SPEED = 0.52;

// Celebration & transition timings
export const GOAL_CELEBRATION_DURATION = 2.6;
export const INTRO_DURATION = 1.8;

