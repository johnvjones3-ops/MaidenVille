import { TILE } from '../config';
import type { EnemyKind, ItemKind } from '../levels/types';
import { floorAt, moveBody, newResult, type Body, type PlatformLike } from './physics';
import type { TileMap } from './tiles';

const ITEM_SIZE: Record<ItemKind, [number, number]> = {
  ball: [30, 30],
  emblem: [40, 40],
  hand: [40, 44],
  hand2: [40, 44],
  hat: [42, 28],
  star: [36, 36],
  lantern: [30, 42],
  book: [40, 30],
  lasso: [38, 36],
};

export class Item implements Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  onGround = false;
  prevX: number;
  prevY: number;
  alive = true;
  state: 'idle' | 'emerge' | 'move' = 'idle';
  t = 0;
  dir = 1;
  ghost = false;
  /** Lantern-hidden items are invisible and uncollectable until revealed. */
  hidden = false;
  emergeFrom = 0;
  bob = Math.random() * 6;
  private res = newResult();

  constructor(
    readonly kind: ItemKind,
    cx: number,
    cy: number,
    readonly uid: number, // level entity uid, or -1 for crate-spawned items
    readonly rid?: string,
  ) {
    const [w, h] = ITEM_SIZE[kind];
    this.w = w;
    this.h = h;
    this.x = cx - w / 2;
    this.y = cy - h / 2;
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /** Start emerging upward out of the crate whose top is at `top`. */
  emerge(top: number) {
    this.state = 'emerge';
    this.t = 0;
    this.emergeFrom = top;
    this.y = top - 4;
    this.prevY = this.y;
  }

  get moves() {
    return this.kind === 'hat' || this.kind === 'star';
  }

  update(dt: number, map: TileMap, platforms: readonly PlatformLike[]) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.t += dt;
    this.bob += dt;
    if (this.state === 'emerge') {
      const k = Math.min(1, this.t / 0.5);
      this.y = this.emergeFrom - 4 - (this.h - 4) * k;
      if (k >= 1) {
        this.state = this.moves ? 'move' : 'idle';
        this.t = 0;
        if (this.kind === 'star') this.vy = -420;
      }
      return;
    }
    if (this.state !== 'move') return;
    const speed = this.kind === 'hat' ? 115 : 135;
    this.vx = this.dir * speed;
    this.vy = Math.min(this.vy + 1700 * dt, 800);
    const r = moveBody(map, this, dt, { oneWay: true, platforms }, this.res);
    if (r.wall !== 0) this.dir = -r.wall;
    if (r.landed && this.kind === 'star') this.vy = -470;
    if (this.y > map.h * TILE + 100) this.alive = false;
  }
}

export interface EnemySpec {
  w: number;
  h: number;
  stompable: boolean;
  spiky: boolean;
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
  bot: { w: 38, h: 34, stompable: true, spiky: false },
  weed: { w: 36, h: 36, stompable: true, spiky: false },
  cactus: { w: 32, h: 44, stompable: false, spiky: true },
  turret: { w: 42, h: 44, stompable: true, spiky: false },
};

export type EnemyState = 'dormant' | 'alert' | 'active' | 'crouch' | 'stunned' | 'squashed' | 'flipped';

export class Enemy implements Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx = 0;
  vy = 0;
  onGround = false;
  prevX: number;
  prevY: number;
  alive = true;
  state: EnemyState = 'dormant';
  t = 0;
  dir: number;
  /** Turret charge 0..1 for the telegraph glow. */
  charge = 0;
  readonly spec: EnemySpec;
  readonly ledgeAware: boolean;
  private res = newResult();
  anim = Math.random() * 10;

  constructor(
    readonly kind: EnemyKind,
    cx: number,
    feetY: number,
    readonly uid: number,
    dir = -1,
    ledgeAware = false,
  ) {
    this.spec = ENEMY_SPECS[kind];
    this.w = this.spec.w;
    this.h = this.spec.h;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.prevX = this.x;
    this.prevY = this.y;
    this.dir = dir;
    this.ledgeAware = ledgeAware;
  }

  get harmful() {
    return this.alive && (this.state === 'active' || this.state === 'alert' || this.state === 'crouch');
  }
  get dead() {
    return this.state === 'squashed' || this.state === 'flipped';
  }

  activate() {
    if (this.state !== 'dormant') return;
    this.state = this.kind === 'weed' ? 'alert' : 'active';
    this.t = 0;
  }

  /** Returns true when the turret wants to fire this step. */
  update(dt: number, map: TileMap, playerCx: number, onScreen: boolean): boolean {
    this.prevX = this.x;
    this.prevY = this.y;
    this.anim += dt;
    this.t += dt;
    if (this.state === 'dormant') return false;
    if (this.state === 'squashed') {
      if (this.t > 0.45) this.alive = false;
      return false;
    }
    if (this.state === 'flipped') {
      this.vy += 1700 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > map.h * TILE + 200) this.alive = false;
      return false;
    }
    if (this.state === 'stunned') {
      this.vx = 0;
      this.gravity(dt, map);
      if (this.t > 3) {
        this.state = 'active';
        this.t = 0;
      }
      return false;
    }
    let fire = false;
    switch (this.kind) {
      case 'bot': {
        this.vx = this.dir * 70;
        this.gravity(dt, map);
        if (this.ledgeAware && this.onGround) {
          const fx = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
          if (!floorAt(map, fx, this.y + this.h)) this.dir = -this.dir;
        }
        break;
      }
      case 'weed': {
        if (this.state === 'alert') {
          this.vx = 0;
          this.gravity(dt, map);
          if (this.t > 0.75) {
            this.state = 'active';
            this.dir = playerCx < this.x + this.w / 2 ? -1 : 1;
            this.t = 0;
          }
          break;
        }
        this.vx = this.dir * 215;
        const was = this.onGround;
        this.gravity(dt, map);
        if (this.onGround && was && this.t > 0.55) {
          this.vy = -170;
          this.t = 0;
        }
        break;
      }
      case 'cactus': {
        if (this.onGround) {
          if (this.state === 'active') {
            this.vx = 0;
            if (this.t > 0.95) {
              this.state = 'crouch';
              this.t = 0;
              this.dir = playerCx < this.x + this.w / 2 ? -1 : 1;
            }
          } else if (this.state === 'crouch' && this.t > 0.45) {
            this.state = 'active';
            this.t = -10; // airborne marker
            this.vy = -560;
            this.vx = this.dir * 95;
            this.onGround = false;
          }
        }
        const wasAir = !this.onGround;
        this.gravity(dt, map);
        if (this.onGround && wasAir && this.t < 0) {
          this.t = 0;
          this.vx = 0;
        }
        break;
      }
      case 'turret': {
        this.dir = playerCx < this.x + this.w / 2 ? -1 : 1;
        this.vx = 0;
        this.gravity(dt, map);
        if (!onScreen) {
          this.t = 0;
          this.charge = 0;
          break;
        }
        this.charge = this.t > 1.9 ? Math.min(1, (this.t - 1.9) / 0.85) : 0;
        if (this.t > 2.75) {
          this.t = 0;
          this.charge = 0;
          fire = true;
        }
        break;
      }
    }
    if (this.y > map.h * TILE + 100) this.alive = false;
    return fire;
  }

  private gravity(dt: number, map: TileMap) {
    this.vy = Math.min(this.vy + 1700 * dt, 800);
    const r = moveBody(map, this, dt, { oneWay: true }, this.res);
    if (r.wall !== 0 && this.kind !== 'turret') this.dir = -r.wall;
  }

  squash() {
    this.state = 'squashed';
    this.t = 0;
    this.vx = 0;
  }

  flip(dir: number) {
    this.state = 'flipped';
    this.t = 0;
    this.vy = -360;
    this.vx = dir * 90;
  }

  stun() {
    this.state = 'stunned';
    this.t = 0;
  }
}

export class MovingPlatform implements PlatformLike {
  x: number;
  y: number;
  w: number;
  prevX: number;
  prevY: number;
  dxStep = 0;
  dyStep = 0;
  constructor(
    readonly uid: number,
    readonly bx: number,
    readonly by: number,
    tiles: number,
    readonly ox: number,
    readonly oy: number,
    readonly period: number,
    readonly phase: number,
  ) {
    this.w = tiles * TILE;
    this.x = bx;
    this.y = by;
    this.prevX = bx;
    this.prevY = by;
    this.place(0);
    this.prevX = this.x;
    this.prevY = this.y;
  }
  place(time: number) {
    const k = 0.5 - 0.5 * Math.cos(((time + this.phase) / this.period) * Math.PI * 2);
    this.x = this.bx + this.ox * k;
    this.y = this.by + this.oy * k;
  }
  update(time: number) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.place(time);
    this.dxStep = this.x - this.prevX;
    this.dyStep = this.y - this.prevY;
  }
}

/** Retracting cactus spikes: retracted → warning → extended. */
export class Spikes {
  static readonly RETRACT = 1.6;
  static readonly WARN = 0.55;
  static readonly OUT = 1.3;
  static readonly CYCLE = Spikes.RETRACT + Spikes.WARN + Spikes.OUT;
  ext = 0; // 0..1 visual extension
  warn = false;
  constructor(
    readonly x: number,
    readonly y: number,
    readonly n: number,
    readonly phase: number,
  ) {}
  update(time: number) {
    const c = (((time + this.phase) % Spikes.CYCLE) + Spikes.CYCLE) % Spikes.CYCLE;
    if (c < Spikes.RETRACT) {
      this.ext = 0;
      this.warn = false;
    } else if (c < Spikes.RETRACT + Spikes.WARN) {
      this.ext = 0.22;
      this.warn = true;
    } else {
      const k = c - Spikes.RETRACT - Spikes.WARN;
      this.ext = Math.min(1, k / 0.08);
      if (k > Spikes.OUT - 0.15) this.ext = Math.max(0, (Spikes.OUT - k) / 0.15);
      this.warn = false;
    }
  }
  get harmful() {
    return this.ext > 0.6;
  }
  box() {
    return { x: this.x + 6, y: this.y - 22, w: this.n * TILE - 12, h: 22 };
  }
}

/** Big practice basketball bouncing in place. Safe: lands you high, pushes you aside. */
export class Bouncer {
  readonly r = 30;
  cx: number;
  cy: number;
  prevCy: number;
  squish = 0;
  constructor(
    cx: number,
    readonly floor: number,
    readonly height: number,
    readonly phase: number,
  ) {
    this.cx = cx;
    this.cy = floor - this.r;
    this.prevCy = this.cy;
  }
  update(time: number, dt: number) {
    this.prevCy = this.cy;
    const p = 1.5;
    const k = Math.abs(Math.sin(((time + this.phase) / p) * Math.PI));
    this.cy = this.floor - this.r - k * this.height;
    this.squish = k < 0.08 ? 1 - k / 0.08 : Math.max(0, this.squish - dt * 6);
  }
  box() {
    return { x: this.cx - this.r, y: this.cy - this.r, w: this.r * 2, h: this.r * 2 };
  }
}

export type ProjKind = 'foam' | 'lob' | 'wave';

export class Projectile {
  alive = true;
  t = 0;
  prevX: number;
  prevY: number;
  constructor(
    readonly kind: ProjKind,
    public x: number, // centre
    public y: number,
    public vx: number,
    public vy: number,
    readonly g: number,
    readonly r: number,
  ) {
    this.prevX = x;
    this.prevY = y;
  }
  update(dt: number, map: TileMap) {
    this.prevX = this.x;
    this.prevY = this.y;
    this.t += dt;
    this.vy += this.g * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kind === 'wave') {
      // Shockwaves travel along the floor and stop at walls.
      if (map.solidAt(Math.floor((this.x + Math.sign(this.vx) * this.r) / TILE), Math.floor((this.y - 4) / TILE))) this.alive = false;
    } else if (map.solidAt(Math.floor(this.x / TILE), Math.floor(this.y / TILE))) this.alive = false;
    if (this.t > 6 || this.y > map.h * TILE + 50) this.alive = false;
  }
  box() {
    if (this.kind === 'wave') return { x: this.x - this.r, y: this.y - 26, w: this.r * 2, h: 26 };
    return { x: this.x - this.r * 0.8, y: this.y - this.r * 0.8, w: this.r * 1.6, h: this.r * 1.6 };
  }
}
