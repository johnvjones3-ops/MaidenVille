// LandmarkRegistry: stable IDs and fixed placements for the seven buildings from Maddy's handmade model,
// plus clearly-labelled invented additions. Placements never change between runs.

import { ROUTE } from './route';

export type LandmarkId = 'emergency' | 'hospital' | 'house_turquoise' | 'house_pink' | 'church' | 'school' | 'store';

export interface Landmark {
  id: LandmarkId;
  name: string;
  /** Description shown in the City Passport scrapbook. */
  description: string;
  zone: string;
  /** Route distance where the building's front is centred. */
  s: number;
  /** -1 = left of travel, +1 = right of travel. */
  side: -1 | 1;
  /** Distance from road centreline to the building front. */
  setback: number;
  width: number;
  depth: number;
  /** True when the label is a game name rather than text read from the model. */
  gameLabel?: boolean;
}

export const LANDMARKS: Landmark[] = [
  {
    id: 'emergency',
    name: 'Emergency Station',
    description: 'Home of EMERGENCY 911, FD 118 and PD 67 — the friendly helpers of MaidenVille, with their bright red doors.',
    zone: 'Helping Hands Block',
    s: 40,
    side: -1,
    setback: 15,
    width: 26,
    depth: 15,
  },
  {
    id: 'hospital',
    name: 'Hospital',
    description: 'A bright white building with a blue cross and a blue-framed glass entrance. Its welcome area greets every neighbor.',
    zone: 'Helping Hands Block',
    s: 128,
    side: -1,
    setback: 14,
    width: 28,
    depth: 16,
  },
  {
    id: 'house_turquoise',
    name: 'Turquoise-Door House',
    description: 'A narrow house with a charcoal pitched roof, a little attic gable and bright turquoise trim. (Game name.)',
    zone: 'Maiden Main Street',
    s: 214,
    side: -1,
    setback: 12,
    width: 8,
    depth: 11,
    gameLabel: true,
  },
  {
    id: 'house_pink',
    name: 'Pink-Door House',
    description: 'The colorful neighbor next door, with a magenta front, lime and purple window frames and short front steps. (Game name.)',
    zone: 'Maiden Main Street',
    s: 232,
    side: -1,
    setback: 12,
    width: 8,
    depth: 11,
    gameLabel: true,
  },
  {
    id: 'church',
    name: 'Trinity Church',
    description: 'A cream church with a tall pointed gable, a round window split into four, and a cross at the very top.',
    zone: 'Trinity Garden Walk',
    s: 318,
    side: -1,
    setback: 16,
    width: 15,
    depth: 24,
  },
  {
    id: 'school',
    name: 'Kingdom School',
    description: 'A warm brown-brick school with a steep center gable, big glowing windows, a yellow bus and a playground.',
    zone: 'Kingdom School Block',
    s: 507,
    side: -1,
    setback: 17,
    width: 36,
    depth: 16,
  },
  {
    id: 'store',
    name: 'Super Target',
    description: 'The big cream store with the red bullseye, red awnings and a shining glass storefront facing the square.',
    zone: 'Super Target Square',
    s: 1158,
    side: 1,
    setback: 30,
    width: 46,
    depth: 26,
  },
];

export const LANDMARK_BY_ID = Object.fromEntries(LANDMARKS.map((l) => [l.id, l])) as Record<LandmarkId, Landmark>;

/** Invented additions (not from the model): kept secondary to the original landmarks. */
export const ADDITIONS = {
  welcomeArchS: 10,
  parkS: 820, // Maddy's Imagination Park on Imagination Parkway (right side)
  plazaS: 1240, // Celebration plaza near the start intersection
};

export interface ZoneInfo {
  name: string;
  s0: number;
  s1: number;
}

/** Named route zones for banners. Ordered by s. */
export const ZONES: ZoneInfo[] = [
  { name: 'Maiden Main Street', s0: 0, s1: 90 },
  { name: 'Helping Hands Block', s0: 90, s1: 170 },
  { name: 'Maiden Main Street', s0: 170, s1: 270 },
  { name: 'Trinity Garden Walk', s0: 270, s1: 400 },
  { name: 'Kingdom School Block', s0: 400, s1: 640 },
  { name: "Maddy's Imagination Park", s0: 640, s1: 1030 },
  { name: 'Super Target Square', s0: 1030, s1: 1230 },
  { name: 'Maiden Main Street', s0: 1230, s1: ROUTE.length + 1 },
];

export function zoneAt(s: number): ZoneInfo {
  s = ROUTE.wrap(s);
  for (const z of ZONES) if (s >= z.s0 && s < z.s1) return z;
  return ZONES[0];
}

/** Half-length of the hazard-free viewing zone centred on each landmark. */
export const LANDMARK_VIEW_HALF = 16;

export function landmarkWorld(l: Landmark) {
  // Centre of the building footprint in world space and the yaw that faces the road.
  const p = ROUTE.worldAt(l.s, l.side * (l.setback + l.depth / 2));
  // Building front faces the road: front normal points toward -side lateral.
  const yawFront = Math.atan2(-Math.cos(p.heading) * l.side, -Math.sin(p.heading) * l.side);
  return { x: p.x, z: p.z, heading: p.heading, yaw: yawFront };
}
