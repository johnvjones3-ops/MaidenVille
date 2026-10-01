export type ObstacleKind = 'hurdle' | 'arch' | 'parcel' | 'puddle' | 'closed';
export type Req = 'open' | 'jump' | 'slide' | 'block';
export type PowerupKind = 'magnet' | 'shield' | 'rainbow' | 'glide';
export type MissionItemKind = 'book' | 'card' | 'flowers' | 'gift';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  lane: number;
  d: number; // centre, in run distance
  length: number;
  hit: boolean;
  /** Practice obstacles in the tutorial never damage. */
  practice: boolean;
}

export type PickupKind = 'star' | 'letter' | 'powerup' | 'mission';

export interface Pickup {
  id: number;
  kind: PickupKind;
  d: number;
  lateral: number;
  y: number;
  collected: boolean;
  letterIndex?: number;
  powerup?: PowerupKind;
  mission?: MissionItemKind;
  /** Magnet-attracted stars fly toward Maddy. */
  attracted?: boolean;
}

export interface Row {
  d: number;
  lanes: Req[];
}

export const REQ_FOR: Record<ObstacleKind, Req> = {
  hurdle: 'jump',
  puddle: 'jump',
  arch: 'slide',
  parcel: 'block',
  closed: 'block',
};

export const OBSTACLE_DEPTH: Record<ObstacleKind, number> = {
  hurdle: 0.5,
  puddle: 2.0,
  arch: 0.6,
  parcel: 1.4,
  closed: 0, // uses explicit length
};
