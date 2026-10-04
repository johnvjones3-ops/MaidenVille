import type { CrateInfo } from '../game/tiles';

export type Theme = 'plaza' | 'night' | 'arena';
export type Backdrop = 'plaza' | 'night' | 'exterior' | 'concourse' | 'arena' | 'secret';

export type ItemKind = 'ball' | 'emblem' | 'hand' | 'hand2' | 'book' | 'lasso' | 'lantern' | 'hat' | 'star';
export type EnemyKind = 'bot' | 'weed' | 'cactus' | 'turret';

export interface EntityDef {
  /** Stable index into the level's entity list; used by checkpoint snapshots. */
  uid: number;
  kind:
    | ItemKind
    | EnemyKind
    | 'spikes'
    | 'platform'
    | 'bouncer'
    | 'door'
    | 'sign'
    | 'checkpoint'
    | 'finish'
    | 'boss'
    | 'decor';
  x: number; // world px (left edge for tiles, see builder)
  y: number;
  /** Persistent id for rare collectibles (emblem/hand/book). */
  rid?: string;
  /** Hidden until revealed by the lantern. */
  lanternHidden?: boolean;
  dir?: number;
  ledgeAware?: boolean;
  /** platform: path offset (px) and period (s); spikes: tile count; phase offset (s). */
  dx?: number;
  dy?: number;
  w?: number;
  period?: number;
  phase?: number;
  text?: string;
  icon?: string;
  /** door: own id and the id of the door it leads to. */
  door?: string;
  target?: string;
  /** decor art key. */
  art?: string;
  scale?: number;
}

export interface Zone {
  /** Camera bounds in world px. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  backdrop: Backdrop;
}

export interface BackdropRegion {
  x0: number; // world px where this backdrop starts
  backdrop: Backdrop;
}

export interface LevelDef {
  index: number;
  name: string;
  subtitle: string;
  theme: Theme;
  music: string;
  w: number; // tiles
  h: number;
  tiles: Uint8Array;
  crates: [number, CrateInfo][];
  spawn: { x: number; y: number }; // world px, feet position
  entities: EntityDef[];
  zones: Zone[];
  backdrops: BackdropRegion[];
  darks: { x: number; y: number; w: number; h: number }[];
  /** Ids of the rare collectibles placed in this level (for results/HUD). */
  emblemIds: string[];
  rareIds: string[];
  bookIds: string[];
  /** Boss arena trigger: when the player passes x, the arena locks. */
  arena?: { trigger: number; x0: number; x1: number; gateL: number; gateR: number };
}
