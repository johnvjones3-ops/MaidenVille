import { TILE } from '../config';

export type BossState = 'dormant' | 'intro' | 'telegraph' | 'attack' | 'recover' | 'exposed' | 'hurt' | 'dying' | 'dead';
export type BossAttack = 'lob' | 'charge' | 'slam';

/** Events the boss asks the world to perform this step. */
export interface BossOut {
  lobs: { x: number; y: number; tx: number }[];
  waves: { x: number; y: number }[];
  shake: number;
  sfx: string[];
}

/**
 * "The Rebounder 3000": an original practice-machine boss.
 * Three readable attack cycles (lob volley, court charge, shockwave slam);
 * after each one its core hatch opens and it can be stomped (or lassoed). Three hits win.
 */
export class Boss {
  x: number; // body left
  y: number; // body top
  readonly w = 150;
  h = 96;
  prevX: number;
  prevY: number;
  vx = 0;
  vy = 0;
  hp = 3;
  state: BossState = 'dormant';
  t = 0;
  attack: BossAttack = 'lob';
  attackIndex = 0;
  facing = -1;
  flash = 0;
  /** Lob landing markers for the telegraph. */
  markers: number[] = [];
  slamTarget = 0;
  private lobsFired = false;
  private airborne = false;
  readonly out: BossOut = { lobs: [], waves: [], shake: 0, sfx: [] };

  constructor(
    x: number,
    readonly floor: number,
    readonly minX: number,
    readonly maxX: number,
  ) {
    this.x = x;
    this.y = floor - this.h;
    this.prevX = this.x;
    this.prevY = this.y;
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get speedUp() {
    return 1 + (3 - this.hp) * 0.2;
  }
  get exposed() {
    return this.state === 'exposed';
  }
  /** The stompable core on top (only meaningful while exposed). */
  coreBox() {
    return { x: this.cx - 30, y: this.y - 14, w: 60, h: 28 };
  }
  bodyBox() {
    return { x: this.x + 8, y: this.y + 6, w: this.w - 16, h: this.h - 6 };
  }
  get harmful() {
    return this.state !== 'dormant' && this.state !== 'dying' && this.state !== 'dead' && this.state !== 'hurt';
  }

  start() {
    if (this.state !== 'dormant') return;
    this.state = 'intro';
    this.t = 0;
  }

  private go(s: BossState) {
    this.state = s;
    this.t = 0;
  }

  update(dt: number, playerCx: number) {
    const o = this.out;
    o.lobs.length = 0;
    o.waves.length = 0;
    o.shake = 0;
    o.sfx.length = 0;
    this.prevX = this.x;
    this.prevY = this.y;
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    const sp = this.speedUp;

    switch (this.state) {
      case 'dormant':
      case 'dead':
        return;
      case 'intro':
        if (this.t > 1.6) this.beginTelegraph(playerCx);
        break;
      case 'telegraph': {
        const tel = (this.attack === 'charge' ? 1.05 : this.attack === 'slam' ? 0.75 : 0.95) / Math.min(sp, 1.25);
        if (this.attack === 'charge') this.x -= this.facing * 18 * dt; // backs up, revving
        if (this.t > tel) {
          this.go('attack');
          this.lobsFired = false;
          if (this.attack === 'charge') {
            this.vx = this.facing * 340 * sp;
            o.sfx.push('charge');
          }
          if (this.attack === 'slam') {
            const flight = 0.95;
            this.vx = (this.slamTarget - this.cx) / flight;
            this.vy = -760;
            this.airborne = true;
            o.sfx.push('jump');
          }
        }
        break;
      }
      case 'attack':
        this.runAttack(dt);
        break;
      case 'recover':
        if (this.t > 0.5) {
          this.go('exposed');
          o.sfx.push('hatch');
        }
        break;
      case 'exposed':
        if (this.t > 2.9) this.beginTelegraph(playerCx);
        break;
      case 'hurt':
        if (this.t > 0.9) {
          if (this.hp <= 0) this.go('dying');
          else this.beginTelegraph(playerCx);
        }
        break;
      case 'dying':
        if (Math.random() < dt * 14) o.shake = 3;
        if (this.t > 2.2) this.go('dead');
        break;
    }
    this.x = Math.max(this.minX, Math.min(this.maxX - this.w, this.x));
  }

  private beginTelegraph(playerCx: number) {
    this.attack = (['lob', 'charge', 'slam'] as const)[this.attackIndex % 3];
    this.attackIndex++;
    this.facing = playerCx < this.cx ? -1 : 1;
    this.go('telegraph');
    this.out.sfx.push('warn');
    if (this.attack === 'lob') {
      const spread = 2.2 * TILE;
      this.markers = [playerCx - spread, playerCx, playerCx + spread].map((m) => Math.max(this.minX + 30, Math.min(this.maxX - 30, m)));
    } else this.markers = [];
    if (this.attack === 'slam') this.slamTarget = Math.max(this.minX + this.w / 2, Math.min(this.maxX - this.w / 2, playerCx));
  }

  private runAttack(dt: number) {
    const o = this.out;
    if (this.attack === 'lob') {
      if (!this.lobsFired) {
        this.lobsFired = true;
        for (const m of this.markers) o.lobs.push({ x: this.cx + this.facing * 30, y: this.y + 10, tx: m });
        o.sfx.push('launch');
      }
      if (this.t > 1.5) {
        this.markers = [];
        this.go('recover');
      }
    } else if (this.attack === 'charge') {
      this.x += this.vx * dt;
      const hitWall = (this.vx < 0 && this.x <= this.minX + 1) || (this.vx > 0 && this.x + this.w >= this.maxX - 1);
      if (hitWall) {
        this.vx = 0;
        o.shake = 6;
        o.sfx.push('slam');
        this.go('recover');
      }
    } else if (this.attack === 'slam') {
      if (this.airborne) {
        this.vy += 1600 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y + this.h >= this.floor && this.vy > 0) {
          this.y = this.floor - this.h;
          this.airborne = false;
          this.vx = this.vy = 0;
          o.shake = 8;
          o.sfx.push('slam');
          o.waves.push({ x: this.x, y: this.floor }, { x: this.x + this.w, y: this.floor });
          this.t = 0;
        }
      } else if (this.t > 0.6) this.go('recover');
    }
  }

  /** A stomp or lasso on the exposed core. */
  hit(): boolean {
    if (this.state !== 'exposed') return false;
    this.hp--;
    this.flash = 0.9;
    this.go('hurt');
    return true;
  }
}
