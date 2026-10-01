// Central configuration for MaidenVille Runner!
// Name, palette, character appearance, controls, difficulty, rewards and cosmetics all live here
// so they can be tuned or replaced without touching game systems.

export const GAME = {
  title: 'MaidenVille Runner!',
  hero: 'Maddy Maiden',
  tagline: 'A little imagination. A whole city of adventure.',
  saveKey: 'maidenville-runner-save',
  saveVersion: 1,
} as const;

export const PALETTE = {
  // City (golden hour, taken from the full-scale city reference)
  skyTop: 0x6fa6d6,
  skyHorizon: 0xffcf96,
  sun: 0xffd29a,
  fog: 0xf0c49a,
  grass: 0x5f9a3c,
  grassDark: 0x47802c,
  asphalt: 0x55575c,
  sidewalk: 0xcdbfae,
  cream: 0xf1e6cf,
  lightBrick: 0xe2cfae,
  brownBrick: 0x8a5634,
  charcoalRoof: 0x34363d,
  windowGlow: 0xffc061,
  hospitalBlue: 0x1f8fd0,
  hospitalTurquoise: 0x22b8c8,
  targetRed: 0xcc1a24,
  emergencyRed: 0xd2342b,
  emergencyGray: 0xb9b6ae,
  turquoise: 0x2ec4b6,
  magenta: 0xd63c8f,
  lime: 0x9bd63a,
  purple: 0x8c5bd6,
  // Accents for collectibles and celebrations only
  gold: 0xffc93c,
  pink: 0xff8fc7,
  lavender: 0xb79cf0,
  skyBlue: 0x7cc8f5,
  mint: 0x7fe0b8,
} as const;

/** Maddy's look, derived from the reference photo. Edit here to refine the likeness. */
export const MADDY_LOOK = {
  skin: 0x7b4a2d, // medium-to-deep brown
  skinShade: 0x5e3720,
  hair: 0x1c1310,
  hairHighlight: 0x3a2a22,
  eyes: 0x1a0f0a,
  lips: 0x8a3d36,
  shirt: 0x1d2a52, // navy
  shirtText: 'WE ARE KNIGHTS',
  jeans: 0x23365f,
  sneaker: 0x26262b,
  sneakerSole: 0xf1efe8,
  earring: 0xf4e7b6,
  heightMeters: 1.32,
} as const;

/** Beginner-friendly control timings (seconds). */
export const CONTROLS = {
  laneChangeTime: 0.16,
  jumpAirtime: 0.8,
  jumpHeight: 1.35,
  slideTime: 0.75,
  inputBuffer: 0.12,
  laneWidth: 2.6,
  swipeThresholdPx: 28,
  swipeThresholdFrac: 0.045,
} as const;

export type ModeId = 'explorer' | 'challenge' | 'explore';

export interface ModeConfig {
  id: ModeId;
  label: string;
  blurb: string;
  startSpeed: number;
  maxSpeed: number;
  accelDistance: number; // distance constant for smooth approach to max speed
  hearts: number;
  damage: boolean;
  hazards: boolean;
  scored: boolean;
  hitboxScale: number; // < 1 is more forgiving
  invulnAfterHit: number;
  stumbleSlow: number; // speed multiplier right after a hit
  stumbleRecover: number; // seconds to recover speed
  minWarning: number; // seconds of visibility before first hazard row
  patternGap: [number, number]; // meters between patterns
  maxDifficulty: number; // pattern difficulty ceiling
  difficultyRampDistance: number;
  reactionBuffer: number; // seconds added to the validator's minimum gap
  tutorialSeconds: number;
}

export const MODES: Record<ModeId, ModeConfig> = {
  explorer: {
    id: 'explorer',
    label: 'Little Explorer',
    blurb: 'Relaxed pace, gentle obstacles, three hearts.',
    startSpeed: 8.5,
    maxSpeed: 12.5,
    accelDistance: 1600,
    hearts: 3,
    damage: true,
    hazards: true,
    scored: true,
    hitboxScale: 0.72,
    invulnAfterHit: 2.0,
    stumbleSlow: 0.55,
    stumbleRecover: 1.4,
    minWarning: 1.8,
    patternGap: [30, 44],
    maxDifficulty: 2,
    difficultyRampDistance: 1400,
    reactionBuffer: 0.55,
    tutorialSeconds: 10,
  },
  challenge: {
    id: 'challenge',
    label: 'City Challenge',
    blurb: 'Harder! Faster running and trickier patterns.',
    startSpeed: 12,
    maxSpeed: 19,
    accelDistance: 2600,
    hearts: 3,
    damage: true,
    hazards: true,
    scored: true,
    hitboxScale: 0.86,
    invulnAfterHit: 1.6,
    stumbleSlow: 0.7,
    stumbleRecover: 1.0,
    minWarning: 1.4,
    patternGap: [16, 28],
    maxDifficulty: 4,
    difficultyRampDistance: 2200,
    reactionBuffer: 0.3,
    tutorialSeconds: 6,
  },
  explore: {
    id: 'explore',
    label: 'Explore MaidenVille',
    blurb: 'Sightseeing with no damage and no timer.',
    startSpeed: 6,
    maxSpeed: 6,
    accelDistance: 1,
    hearts: 3,
    damage: false,
    hazards: false,
    scored: false,
    hitboxScale: 1,
    invulnAfterHit: 0,
    stumbleSlow: 1,
    stumbleRecover: 0,
    minWarning: 0,
    patternGap: [40, 60],
    maxDifficulty: 0,
    difficultyRampDistance: 1,
    reactionBuffer: 0,
    tutorialSeconds: 0,
  },
};

export const SIM = {
  fixedStep: 1 / 120,
  maxCatchUp: 0.1, // seconds of simulation allowed after a stall
  generateAhead: 170,
  despawnBehind: 12,
  viewDistance: 150,
};

export const POWERUPS = {
  magnet: { duration: 9, radius: 10 },
  shield: { duration: 0 /* lasts until a bump */ },
  rainbow: { duration: 5, speedMul: 1.45, grace: 1.0 },
  glide: { duration: 5.5, height: 7, landing: 1.0 },
  warnAt: 1.6,
  minSpacing: 260,
  maxSpacing: 420,
};

export const REWARDS = {
  scorePerMeter: 1,
  scorePerStar: 5,
  scorePerLetter: 25,
  wordBonusStars: 40,
  wordBonusScore: 250,
  deliveryStars: 30,
  deliveryScore: 200,
  goalStars: 25,
  achievementStars: 20,
};

export type CosmeticCategory = 'outfit' | 'sneakers' | 'accessory' | 'trail';

export interface Cosmetic {
  id: string;
  category: CosmeticCategory;
  name: string;
  cost: number;
  color?: number;
  note: string;
}

// Design suggestions only — not claims about Maddy's real favourites.
export const COSMETICS: Cosmetic[] = [
  { id: 'outfit_knights', category: 'outfit', name: 'Original Navy Tee', cost: 0, note: 'The navy WE ARE KNIGHTS school tee.' },
  { id: 'outfit_maddy', category: 'outfit', name: 'MADDY Shirt', cost: 60, color: 0xb79cf0, note: 'A lavender tee with her name.' },
  { id: 'outfit_explorer', category: 'outfit', name: 'Explorer Jacket', cost: 120, color: 0x2a9d8f, note: 'A teal jacket with a big M badge.' },
  { id: 'sneakers_classic', category: 'sneakers', name: 'Classic Dark', cost: 0, color: 0x26262b, note: 'Dark sneakers with light soles.' },
  { id: 'sneakers_sky', category: 'sneakers', name: 'Sky Blue', cost: 40, color: 0x5fb8f0, note: 'Bright sky-blue sneakers.' },
  { id: 'sneakers_pink', category: 'sneakers', name: 'Bubblegum', cost: 40, color: 0xff7fbf, note: 'Bright pink sneakers.' },
  { id: 'sneakers_mint', category: 'sneakers', name: 'Mint', cost: 40, color: 0x6fdcb0, note: 'Cool mint sneakers.' },
  { id: 'sneakers_gold', category: 'sneakers', name: 'Golden Star', cost: 90, color: 0xf2bf3a, note: 'Shiny gold sneakers.' },
  { id: 'acc_none', category: 'accessory', name: 'Classic Ties', cost: 0, color: 0x2a2a35, note: 'Simple dark hair ties.' },
  { id: 'acc_gold', category: 'accessory', name: 'Gold Ties', cost: 30, color: 0xffc93c, note: 'Gold bands around each puff.' },
  { id: 'acc_stars', category: 'accessory', name: 'Star Clips', cost: 50, color: 0xffd84a, note: 'Little stars beside each puff.' },
  { id: 'acc_flowers', category: 'accessory', name: 'Flower Ties', cost: 50, color: 0xff8fc7, note: 'Pink flowers on each tie.' },
  { id: 'trail_none', category: 'trail', name: 'No Trail', cost: 0, note: 'Just Maddy.' },
  { id: 'trail_stars', category: 'trail', name: 'Star Trail', cost: 80, color: 0xffd84a, note: 'Sparkles follow every step.' },
  { id: 'trail_rainbow', category: 'trail', name: 'Rainbow Trail', cost: 150, note: 'A rainbow ribbon behind her.' },
];

export const DEFAULT_EQUIPPED: Record<CosmeticCategory, string> = {
  outfit: 'outfit_knights',
  sneakers: 'sneakers_classic',
  accessory: 'acc_none',
  trail: 'trail_none',
};

export const QUALITY = {
  low: { pixelRatio: 1, shadows: false, shadowSize: 0, particles: 80, fogFar: 300, decorDensity: 0.5 },
  medium: { pixelRatio: 1.5, shadows: true, shadowSize: 1024, particles: 180, fogFar: 420, decorDensity: 0.8 },
  high: { pixelRatio: 2, shadows: true, shadowSize: 2048, particles: 300, fogFar: 520, decorDensity: 1 },
} as const;
export type QualityId = keyof typeof QUALITY;

export const COPY = {
  letsExplore: "Let's explore, Maddy!",
  shine: 'You made this city shine!',
  discovered: 'New place discovered!',
  again: 'Ready for another adventure?',
};
