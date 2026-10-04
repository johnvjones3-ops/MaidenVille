import { TILE } from '../config';
import { T, TileMap, isOneWay, isSolid } from './tiles';

export interface Body {
  x: number; // top-left, world px
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

/** One-way moving platform surface (only its top edge collides). */
export interface PlatformLike {
  x: number;
  y: number;
  w: number;
  prevY: number;
}

export interface MoveOpts {
  /** Respect one-way tiles and platforms. */
  oneWay: boolean;
  /** Ignore one-way surfaces (intentional drop-through). */
  dropping?: boolean;
  platforms?: readonly PlatformLike[];
  /** Max px to slide sideways around a ceiling corner (player only). */
  nudge?: number;
  /** Hidden blocks are struck (and become solid) when hit from below. */
  hitsHidden?: boolean;
}

export interface MoveResult {
  wall: -1 | 0 | 1;
  landed: boolean;
  ceiling: boolean;
  head: { tx: number; ty: number } | null;
  platform: PlatformLike | null;
}

const EPS = 0.001;
const MAX_SUB = 12; // px per substep, well under a tile and under the smallest body

export function newResult(): MoveResult {
  return { wall: 0, landed: false, ceiling: false, head: null, platform: null };
}

/**
 * Moves a body through the tile map, resolving X then Y separately.
 * Large moves are split into substeps no longer than MAX_SUB so nothing tunnels.
 */
export function moveBody(map: TileMap, b: Body, dt: number, opts: MoveOpts, out: MoveResult = newResult()): MoveResult {
  out.wall = 0;
  out.landed = false;
  out.ceiling = false;
  out.head = null;
  out.platform = null;

  let dx = b.vx * dt;
  const nx = Math.max(1, Math.ceil(Math.abs(dx) / MAX_SUB));
  const sx = dx / nx;
  for (let i = 0; i < nx; i++) {
    const w = stepX(map, b, sx);
    if (w !== 0) {
      out.wall = w;
      b.vx = 0;
      break;
    }
  }

  const dy = b.vy * dt;
  b.onGround = false;
  const ny = Math.max(1, Math.ceil(Math.abs(dy) / MAX_SUB));
  const sy = dy / ny;
  for (let i = 0; i < ny; i++) {
    if (sy >= 0) {
      if (stepDown(map, b, sy, opts, out)) {
        b.vy = 0;
        b.onGround = true;
        out.landed = true;
        break;
      }
    } else if (stepUp(map, b, sy, opts, out)) {
      b.vy = 0;
      out.ceiling = true;
      break;
    }
  }
  return out;
}

export function stepX(map: TileMap, b: Body, dx: number): -1 | 0 | 1 {
  if (dx === 0) return 0;
  const y0 = Math.floor(b.y / TILE);
  const y1 = Math.floor((b.y + b.h - EPS) / TILE);
  if (dx > 0) {
    const nx = b.x + dx;
    const col = Math.floor((nx + b.w - EPS) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (map.solidAt(col, ty)) {
        b.x = Math.min(b.x, col * TILE - b.w);
        return 1;
      }
    }
    b.x = nx;
  } else {
    const nx = b.x + dx;
    const col = Math.floor(nx / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (map.solidAt(col, ty)) {
        b.x = Math.max(b.x, (col + 1) * TILE);
        return -1;
      }
    }
    b.x = nx;
  }
  return 0;
}

function stepDown(map: TileMap, b: Body, dy: number, opts: MoveOpts, out: MoveResult): boolean {
  const prevBottom = b.y + b.h;
  const newBottom = prevBottom + dy;
  const row = Math.floor((newBottom - EPS) / TILE);
  const x0 = Math.floor(b.x / TILE);
  const x1 = Math.floor((b.x + b.w - EPS) / TILE);
  let top = Infinity;
  for (let tx = x0; tx <= x1; tx++) {
    const t = map.get(tx, row);
    if (isSolid(t)) top = Math.min(top, row * TILE);
    else if (opts.oneWay && !opts.dropping && isOneWay(t) && prevBottom <= row * TILE + 0.5) top = Math.min(top, row * TILE);
  }
  let plat: PlatformLike | null = null;
  if (opts.oneWay && !opts.dropping && opts.platforms) {
    for (const p of opts.platforms) {
      if (b.x + b.w <= p.x || b.x >= p.x + p.w) continue;
      if (prevBottom <= Math.max(p.y, p.prevY) + 1 && newBottom >= p.y && p.y < top) {
        top = p.y;
        plat = p;
      }
    }
  }
  if (top !== Infinity && newBottom >= top) {
    b.y = top - b.h;
    out.platform = plat;
    return true;
  }
  b.y += dy;
  return false;
}

function stepUp(map: TileMap, b: Body, dy: number, opts: MoveOpts, out: MoveResult): boolean {
  const ny = b.y + dy;
  const row = Math.floor(ny / TILE);
  const x0 = Math.floor(b.x / TILE);
  const x1 = Math.floor((b.x + b.w - EPS) / TILE);
  let best = -1;
  let bestD = Infinity;
  let count = 0;
  let minTx = Infinity;
  let maxTx = -Infinity;
  const cx = b.x + b.w / 2;
  for (let tx = x0; tx <= x1; tx++) {
    const t = map.get(tx, row);
    const hit = isSolid(t) || (opts.hitsHidden === true && t === T.HIDDEN && b.y >= (row + 1) * TILE - 0.5);
    if (!hit) continue;
    count++;
    minTx = Math.min(minTx, tx);
    maxTx = Math.max(maxTx, tx);
    const d = Math.abs((tx + 0.5) * TILE - cx);
    if (d < bestD) {
      bestD = d;
      best = tx;
    }
  }
  if (count === 0) {
    b.y = ny;
    return false;
  }
  // Corner correction: if only the edge of the head clips a block, slide around it.
  if (opts.nudge && opts.nudge > 0) {
    const leftOverlap = (minTx + 1) * TILE - b.x; // overlap into blocks from the left side
    const rightOverlap = b.x + b.w - maxTx * TILE;
    if (maxTx === x0 && leftOverlap > 0 && leftOverlap <= opts.nudge) {
      const tryX = (minTx + 1) * TILE;
      if (!map.boxHitsSolid(tryX, ny, b.w, b.h) && map.get(Math.floor((tryX + b.w - EPS) / TILE), row) !== T.HIDDEN) {
        b.x = tryX;
        b.y = ny;
        return false;
      }
    } else if (minTx === x1 && rightOverlap > 0 && rightOverlap <= opts.nudge) {
      const tryX = minTx * TILE - b.w;
      if (!map.boxHitsSolid(tryX, ny, b.w, b.h) && map.get(Math.floor(tryX / TILE), row) !== T.HIDDEN) {
        b.x = tryX;
        b.y = ny;
        return false;
      }
    }
  }
  b.y = (row + 1) * TILE;
  out.head = { tx: best, ty: row };
  return true;
}

/** Does the body have one-way-only support directly under its feet (so it may drop through)? */
export function standingOnOneWayOnly(map: TileMap, b: Body, onPlatform: boolean): boolean {
  if (!b.onGround) return false;
  if (onPlatform) return true;
  const row = Math.floor((b.y + b.h + 1) / TILE);
  const x0 = Math.floor(b.x / TILE);
  const x1 = Math.floor((b.x + b.w - EPS) / TILE);
  let anyOneWay = false;
  for (let tx = x0; tx <= x1; tx++) {
    const t = map.get(tx, row);
    if (isSolid(t)) return false;
    if (isOneWay(t)) anyOneWay = true;
  }
  return anyOneWay;
}

/** Is there solid (or one-way) floor under the given point? Used by ledge-aware walkers. */
export function floorAt(map: TileMap, px: number, footY: number): boolean {
  const t = map.get(Math.floor(px / TILE), Math.floor((footY + 2) / TILE));
  return isSolid(t) || isOneWay(t);
}

export function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
