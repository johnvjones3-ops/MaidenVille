// Obstacle pattern library. Offsets are metres along the route; lanes 0 = left, 1 = centre, 2 = right.
// Patterns are mirrored/shifted by the generator and always validated before use.

import type { ObstacleKind } from './types';

export interface PatternObstacle {
  kind: ObstacleKind;
  lane: number;
  dz: number;
  length?: number;
}

export interface Pattern {
  id: string;
  difficulty: number;
  obstacles: PatternObstacle[];
  /** Can lanes be shifted (patterns using a single lane). */
  shiftable?: boolean;
}

const all = (kind: ObstacleKind, dz: number): PatternObstacle[] => [0, 1, 2].map((lane) => ({ kind, lane, dz }));

export const PATTERNS: Pattern[] = [
  // --- difficulty 1: one idea at a time
  { id: 'parcel1', difficulty: 1, obstacles: [{ kind: 'parcel', lane: 1, dz: 0 }], shiftable: true },
  { id: 'hurdle1', difficulty: 1, obstacles: [{ kind: 'hurdle', lane: 1, dz: 0 }], shiftable: true },
  { id: 'puddle1', difficulty: 1, obstacles: [{ kind: 'puddle', lane: 1, dz: 0 }], shiftable: true },
  { id: 'hurdleAll', difficulty: 1, obstacles: all('hurdle', 0) },
  { id: 'archAll', difficulty: 1, obstacles: all('arch', 0) },
  // --- difficulty 2: choose a lane
  {
    id: 'twoParcels',
    difficulty: 2,
    obstacles: [
      { kind: 'parcel', lane: 0, dz: 0 },
      { kind: 'parcel', lane: 1, dz: 0 },
    ],
  },
  { id: 'closedLane', difficulty: 2, obstacles: [{ kind: 'closed', lane: 0, dz: 0, length: 14 }], shiftable: true },
  {
    id: 'mixedRow',
    difficulty: 2,
    obstacles: [
      { kind: 'parcel', lane: 0, dz: 0 },
      { kind: 'hurdle', lane: 1, dz: 0 },
      { kind: 'puddle', lane: 2, dz: 0 },
    ],
  },
  {
    id: 'archTwo',
    difficulty: 2,
    obstacles: [
      { kind: 'arch', lane: 0, dz: 0 },
      { kind: 'arch', lane: 1, dz: 0 },
      { kind: 'parcel', lane: 2, dz: 0 },
    ],
  },
  // --- difficulty 3: combinations
  { id: 'jumpThenSlide', difficulty: 3, obstacles: [...all('hurdle', 0), ...all('arch', 15)] },
  {
    id: 'zigzag',
    difficulty: 3,
    obstacles: [
      { kind: 'parcel', lane: 0, dz: 0 },
      { kind: 'parcel', lane: 1, dz: 0 },
      { kind: 'parcel', lane: 1, dz: 16 },
      { kind: 'parcel', lane: 2, dz: 16 },
    ],
  },
  {
    id: 'corridor',
    difficulty: 3,
    obstacles: [
      { kind: 'closed', lane: 0, dz: 0, length: 22 },
      { kind: 'closed', lane: 2, dz: 0, length: 22 },
      { kind: 'hurdle', lane: 1, dz: -2 },
    ],
  },
  {
    id: 'puddleGate',
    difficulty: 3,
    obstacles: [
      { kind: 'parcel', lane: 0, dz: 0 },
      { kind: 'puddle', lane: 1, dz: 0 },
      { kind: 'parcel', lane: 2, dz: 0 },
    ],
  },
  // --- difficulty 4: City Challenge sequences
  {
    id: 'archBlockJump',
    difficulty: 4,
    obstacles: [
      { kind: 'arch', lane: 0, dz: 0 },
      { kind: 'arch', lane: 1, dz: 0 },
      { kind: 'parcel', lane: 2, dz: 0 },
      ...all('hurdle', 16),
    ],
  },
  {
    id: 'triple',
    difficulty: 4,
    obstacles: [
      { kind: 'parcel', lane: 0, dz: 0 },
      { kind: 'parcel', lane: 1, dz: 0 },
      ...all('arch', 13),
      { kind: 'parcel', lane: 1, dz: 26 },
      { kind: 'parcel', lane: 2, dz: 26 },
    ],
  },
  {
    id: 'slalom',
    difficulty: 4,
    obstacles: [
      { kind: 'closed', lane: 1, dz: 6, length: 18 },
      { kind: 'hurdle', lane: 0, dz: 0 },
      { kind: 'arch', lane: 2, dz: 12 },
    ],
  },
];
