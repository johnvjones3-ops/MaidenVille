// LandmarkRegistry: stable IDs and fixed placements for the seven buildings from Maddy's handmade model,
// plus clearly-labelled invented additions. Placements never change between runs.
//
// Every landmark stands at the END of a street, straight ahead of Maddy as she runs toward it, so it sits in the
// centre of the screen for the whole approach. The road then turns in front of the building.

import { ROUTE, type CornerZone } from './route';

export type LandmarkId = 'emergency' | 'hospital' | 'house_turquoise' | 'house_pink' | 'church' | 'school' | 'store';

export interface Landmark {
  id: LandmarkId;
  name: string;
  /** Description shown in the City Passport scrapbook. */
  description: string;
  zone: string;
  /** Index into ROUTE.corners: the T-junction this building faces. */
  corner: number;
  /** Sideways offset from the street's centre line (two houses share one junction). */
  lateral: number;
  /** Extra forecourt depth in front of the facade (parking, bus, vehicles, steps). */
  frontExtra: number;
  width: number;
  depth: number;
  /** Route distance where Maddy reaches the junction in front of the building (set below). */
  s: number;
  /** True when the label is a game name rather than text read from the model. */
  gameLabel?: boolean;
}

type LandmarkDef = Omit<Landmark, 's'>;

const DEFS: LandmarkDef[] = [
  {
    id: 'house_turquoise',
    name: 'Turquoise-Door House',
    description: 'A narrow house with a charcoal pitched roof, a little attic gable and bright turquoise trim. (Game name.)',
    zone: 'Maiden Main Street',
    corner: 0,
    lateral: -5.2,
    frontExtra: 1.5,
    width: 8,
    depth: 11,
    gameLabel: true,
  },
  {
    id: 'house_pink',
    name: 'Pink-Door House',
    description: 'The colorful neighbor next door, with a magenta front, lime and purple window frames and short front steps. (Game name.)',
    zone: 'Maiden Main Street',
    corner: 0,
    lateral: 5.2,
    frontExtra: 1.5,
    width: 8,
    depth: 11,
    gameLabel: true,
  },
  {
    id: 'school',
    name: 'Kingdom School',
    description: 'A warm brown-brick school with a steep center gable, big glowing windows, a yellow bus and a playground.',
    zone: 'Kingdom School Block',
    corner: 2,
    lateral: 0,
    frontExtra: 7.5,
    width: 36,
    depth: 17,
  },
  {
    id: 'church',
    name: 'Trinity Church',
    description: 'A cream church with a tall pointed gable, a round window split into four, and a cross at the very top.',
    zone: 'Trinity Garden Walk',
    corner: 4,
    lateral: 0,
    frontExtra: 2.5,
    width: 15,
    depth: 24,
  },
  {
    id: 'store',
    name: 'Super Target',
    description: 'The big cream store with the red bullseye, red awnings and a shining glass storefront facing the square.',
    zone: 'Super Target Square',
    corner: 6,
    lateral: 0,
    frontExtra: 19.5,
    width: 46,
    depth: 26,
  },
  {
    id: 'hospital',
    name: 'Hospital',
    description: 'A bright white building with a blue cross and a blue-framed glass entrance. Its welcome area greets every neighbor.',
    zone: 'Helping Hands Block',
    corner: 8,
    lateral: 0,
    frontExtra: 4,
    width: 28,
    depth: 16,
  },
  {
    id: 'emergency',
    name: 'Emergency Station',
    description: 'Home of EMERGENCY 911, FD 118 and PD 67 — the friendly helpers of MaidenVille, with their bright red doors.',
    zone: 'Helping Hands Block',
    corner: 9,
    lateral: 0,
    frontExtra: 5,
    width: 26,
    depth: 14,
  },
];

export const LANDMARKS: Landmark[] = DEFS.map((d) => ({ ...d, s: ROUTE.corners[d.corner].s0 }));

export const LANDMARK_BY_ID = Object.fromEntries(LANDMARKS.map((l) => [l.id, l])) as Record<LandmarkId, Landmark>;

/** Distance from a junction's grid point to where a building's forecourt may begin (clear of road and sidewalk). */
export const JUNCTION_CLEAR = 15;

/** Point straight ahead of a corner, `dist` metres beyond its grid vertex, plus a sideways offset. */
export function aheadOfCorner(c: CornerZone, dist: number, lateral = 0) {
  const h = c.headingIn;
  const fx = Math.sin(h);
  const fz = -Math.cos(h);
  return { x: c.vertex.x + fx * dist + Math.cos(h) * lateral, z: c.vertex.z + fz * dist + Math.sin(h) * lateral, heading: h };
}

export function landmarkWorld(l: Landmark) {
  const c = ROUTE.corners[l.corner];
  const p = aheadOfCorner(c, JUNCTION_CLEAR + l.frontExtra + l.depth / 2, l.lateral);
  // The facade faces back down the street toward the approaching runner.
  return { x: p.x, z: p.z, heading: p.heading, yaw: -p.heading };
}

/** Invented additions (not from the model): kept secondary to the original landmarks. */
export const ADDITIONS = {
  welcomeArchS: 12,
  parkCorner: 1, // Maddy's Imagination Park, straight ahead at the end of Rainbow Row
  plazaCorner: 11, // Celebration Plaza, straight ahead before the start line
};

export interface ZoneInfo {
  name: string;
  s0: number;
  s1: number;
}

/** Zone banners follow the street names. */
export function zoneAt(s: number): ZoneInfo {
  const st = ROUTE.streetAt(s);
  return { name: st.name, s0: st.s0, s1: st.s1 };
}

/** The calm, hazard-free stretch in front of each landmark: the last part of the approach plus the turn. */
export const LANDMARK_VIEW_BEFORE = 34;
export const LANDMARK_VIEW_AFTER = 4;

export function inLandmarkZone(s: number): boolean {
  for (const l of LANDMARKS) {
    const d = ROUTE.delta(s, l.s); // > 0 when the landmark junction is ahead
    if (d > -LANDMARK_VIEW_AFTER && d < LANDMARK_VIEW_BEFORE) return true;
  }
  return false;
}
