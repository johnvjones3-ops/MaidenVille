// Tuning constants. All physics values are in world pixels and seconds (px/s, px/s²).
// One tile is 48 px. The simulation runs at a fixed 60 Hz.

export const TILE = 48;
export const VIEW_W = 960;
export const VIEW_H = 540;
export const STEP = 1 / 60;
/** Largest real frame delta fed to the accumulator; anything longer is dropped, not simulated. */
export const MAX_FRAME = 0.1;
export const MAX_DPR = 2;

export const PHYS = {
  walkMax: 240,
  runMax: 360,
  groundAccel: 1700,
  groundDecel: 2100,
  /** Deceleration while pushing against current motion on the ground (skid). */
  skidDecel: 2900,
  airAccel: 950,
  /** Gentle air drag when no direction is held, so jumps keep their arc. */
  airDrag: 260,
  jumpV: 660,
  /** Extra launch speed at full run speed, scaled by |vx|/runMax. */
  jumpRunBonus: 70,
  gravityUp: 1750,
  gravityDown: 2300,
  /** Upward speed is multiplied by this when jump is released early. */
  jumpCut: 0.42,
  maxFall: 950,
  coyote: 0.09,
  buffer: 0.12,
  stompBounce: 430,
  stompBounceHeld: 650,
  dropThrough: 0.22,
  /** Horizontal nudge allowed when the head clips a block corner. */
  cornerNudge: 9,
};

export const BODY = {
  rookie: { w: 26, h: 44 },
  vaquero: { w: 28, h: 66 },
};

export const RULES = {
  startLives: 3,
  invulnTime: 1.5,
  starTime: 10,
  starWarn: 2.5,
  lanternTime: 22,
  lassoPerPickup: 3,
  lassoMax: 6,
  lassoRange: 3.4 * TILE,
  lassoCooldown: 0.45,
  stunTime: 3,
  ballsPerLife: 100,
  scoreBall: 100,
  scoreStomp: 200,
  scoreCrate: 50,
  scoreEmblem: 2000,
  scoreHand: 1000,
  scoreHandRare: 2000,
  scoreHatDuplicate: 1000,
  scoreStar: 500,
  scoreBook: 1500,
  scoreLasso: 300,
  scoreLantern: 300,
  scoreBossHit: 1500,
  scoreBoss: 10000,
  crateCooldown: 0.16,
};

export const COLORS = {
  orange: '#FF5E17',
  green: '#00C21D',
  gray: '#646469',
  cream: '#FFF8EC',
  white: '#FFFFFF',
  gold: '#FFA61A',
  charcoal: '#22201F',
  ink: '#151413',
};
