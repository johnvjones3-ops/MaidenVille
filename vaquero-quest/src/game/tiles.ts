import { TILE } from '../config';

/** Tile ids stored in the level grid. */
export const T = {
  EMPTY: 0,
  GROUND: 1, // brick walk / grass top over earth
  BRICK: 2, // tan Fieldhouse brick
  CRATE: 3, // V crate with rewards
  CRATE_EMPTY: 4, // spent crate (still solid)
  BREAK: 5, // terracotta block, breakable by Vaquero form
  HIDDEN: 6, // invisible until struck from below
  ONEWAY: 7, // walkway plank, solid only from above
  STOOL: 8, // stool cushion, solid only from above
  STONE: 9, // concrete steps / planters
  WOOD: 10, // hardwood court floor
  SEATS: 11, // arena seat row, solid only from above
  METAL: 12, // charcoal steel block
  BARRIER: 13, // invisible wall (level edges, boss arena gates)
  PLANTER: 14, // brick planter with green top
} as const;

export function isSolid(t: number): boolean {
  return (
    t === T.GROUND ||
    t === T.BRICK ||
    t === T.CRATE ||
    t === T.CRATE_EMPTY ||
    t === T.BREAK ||
    t === T.STONE ||
    t === T.WOOD ||
    t === T.METAL ||
    t === T.BARRIER ||
    t === T.PLANTER
  );
}

export function isOneWay(t: number): boolean {
  return t === T.ONEWAY || t === T.STOOL || t === T.SEATS;
}

/** Content a crate or hidden block dispenses. */
export type Reward = 'ball' | 'hat' | 'star' | 'hand' | 'hand2' | 'book' | 'lasso' | 'lantern' | 'none';

export interface CrateInfo {
  reward: Reward;
  remaining: number;
  /** Rare items carry a persistent id. */
  id?: string;
}

export class TileMap {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
  readonly crates = new Map<number, CrateInfo>();
  /** Per-tile bump animation timers (seconds remaining). */
  readonly bumps = new Map<number, number>();

  constructor(w: number, h: number, data?: Uint8Array) {
    this.w = w;
    this.h = h;
    this.data = data ? data : new Uint8Array(w * h);
  }

  key(tx: number, ty: number) {
    return ty * this.w + tx;
  }

  get(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.w) return T.BARRIER;
    if (ty < 0) return T.EMPTY;
    if (ty >= this.h) return T.EMPTY;
    return this.data[ty * this.w + tx];
  }

  set(tx: number, ty: number, t: number) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.data[ty * this.w + tx] = t;
  }

  solidAt(tx: number, ty: number) {
    return isSolid(this.get(tx, ty));
  }

  /** True when the axis-aligned box overlaps any solid tile. */
  boxHitsSolid(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return true;
    return false;
  }

  clone(): TileMap {
    const m = new TileMap(this.w, this.h, new Uint8Array(this.data));
    for (const [k, v] of this.crates) m.crates.set(k, { ...v });
    return m;
  }
}
