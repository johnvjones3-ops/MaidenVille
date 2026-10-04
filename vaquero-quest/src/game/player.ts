import { BODY, PHYS, RULES } from '../config';
import type { InputState } from '../core/input';
import { moveBody, newResult, standingOnOneWayOnly, type Body, type MoveResult, type PlatformLike } from './physics';
import type { TileMap } from './tiles';

export type Form = 'rookie' | 'vaquero';
export type Anim = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'skid' | 'land' | 'hurt' | 'bonk' | 'victory' | 'death' | 'lasso';

export class Player implements Body {
  x = 0;
  y = 0;
  w = BODY.rookie.w;
  h = BODY.rookie.h;
  vx = 0;
  vy = 0;
  onGround = false;
  prevX = 0;
  prevY = 0;

  form: Form = 'rookie';
  /** Hat collected while there was no headroom; grows as soon as space allows. */
  pendingGrow = false;
  facing: 1 | -1 = 1;
  anim: Anim = 'idle';
  animT = 0;
  /** Distance-driven walk cycle phase. */
  stride = 0;

  coyoteT = 0;
  bufferT = 0;
  jumping = false;
  jumpCutDone = false;
  airMax: number = PHYS.walkMax;
  dropT = 0;
  landT = 0;
  bonkT = 0;
  hurtT = 0;
  invulnT = 0;
  growT = 0;
  starT = 0;
  lanternT = 0;
  lassoT = 0;
  lassoCooldown = 0;
  lassoCharges = 0;
  dead = false;
  justJumped = false;
  deathT = 0;
  victory = false;
  frozen = false;
  platform: PlatformLike | null = null;
  readonly result: MoveResult = newResult();
  /** Previous-step bottom; used for stomp checks. */
  prevBottom = 0;

  place(feetX: number, feetY: number) {
    this.x = feetX - this.w / 2;
    this.y = feetY - this.h;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = this.vy = 0;
    this.onGround = false;
    this.platform = null;
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get bottom() {
    return this.y + this.h;
  }

  /** Grow into Vaquero form if there is room above; otherwise remember to grow later. */
  tryGrow(map: TileMap): boolean {
    const nh = BODY.vaquero.h;
    const nw = BODY.vaquero.w;
    const nx = this.x + (this.w - nw) / 2;
    const ny = this.y + this.h - nh;
    if (map.boxHitsSolid(nx, ny, nw, nh)) {
      this.pendingGrow = true;
      return false;
    }
    this.x = nx;
    this.y = ny;
    this.prevX = nx;
    this.prevY = ny;
    this.w = nw;
    this.h = nh;
    this.form = 'vaquero';
    this.pendingGrow = false;
    this.growT = 0.6;
    return true;
  }

  shrink() {
    const nw = BODY.rookie.w;
    const nh = BODY.rookie.h;
    this.x += (this.w - nw) / 2;
    this.y += this.h - nh;
    this.prevX = this.x;
    this.prevY = this.y;
    this.w = nw;
    this.h = nh;
    this.form = 'rookie';
    this.pendingGrow = false;
    this.growT = 0.6;
  }

  /** One fixed simulation step of movement. Returns the move result (head hits etc). */
  step(dt: number, inp: InputState, map: TileMap, platforms: readonly PlatformLike[]): MoveResult {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevBottom = this.y + this.h;
    this.animT += dt;
    if (this.landT > 0) this.landT -= dt;
    if (this.bonkT > 0) this.bonkT -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.growT > 0) this.growT -= dt;
    if (this.dropT > 0) this.dropT -= dt;
    if (this.lassoT > 0) this.lassoT -= dt;
    if (this.lassoCooldown > 0) this.lassoCooldown -= dt;

    if (this.pendingGrow) this.tryGrow(map);

    const frozen = this.frozen;
    const dir = frozen ? 0 : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const run = !frozen && inp.run;
    const max = run ? PHYS.runMax : PHYS.walkMax;
    const hurtLock = this.hurtT > 0.15;
    let skidding = false;

    if (!hurtLock) {
      if (this.onGround) {
        if (dir !== 0) {
          if (this.vx !== 0 && Math.sign(this.vx) === -dir) {
            this.vx += dir * PHYS.skidDecel * dt;
            if (Math.sign(this.vx) === dir) this.vx = dir * 20;
            skidding = Math.abs(this.vx) > 90;
          } else if (Math.abs(this.vx) <= max) {
            this.vx += dir * PHYS.groundAccel * dt;
            if (Math.abs(this.vx) > max) this.vx = dir * max;
          } else {
            // Above max (run released): ease back down to walk speed.
            this.vx -= Math.sign(this.vx) * PHYS.groundDecel * 0.5 * dt;
            if (Math.abs(this.vx) < max) this.vx = Math.sign(this.vx) * max;
          }
          this.facing = dir as 1 | -1;
        } else {
          const d = PHYS.groundDecel * dt;
          this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
        }
        this.airMax = Math.max(PHYS.walkMax, Math.abs(this.vx));
      } else {
        const airCap = Math.max(max, Math.min(this.airMax, PHYS.runMax));
        if (dir !== 0) {
          this.vx += dir * PHYS.airAccel * dt;
          if (Math.abs(this.vx) > airCap) this.vx = Math.sign(this.vx) * airCap;
          this.facing = dir as 1 | -1;
        } else {
          const d = PHYS.airDrag * dt;
          this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
        }
      }
    }

    // Jump buffering, coyote time and drop-through.
    if (!frozen && inp.jumpPressed) this.bufferT = PHYS.buffer;
    else if (this.bufferT > 0) this.bufferT -= dt;
    if (this.onGround) this.coyoteT = PHYS.coyote;
    else if (this.coyoteT > 0) this.coyoteT -= dt;

    let jumpedNow = false;
    if (this.bufferT > 0 && inp.down && this.onGround && standingOnOneWayOnly(map, this, this.platform !== null)) {
      this.dropT = PHYS.dropThrough;
      this.bufferT = 0;
      this.coyoteT = 0;
      this.y += 2;
      this.onGround = false;
    } else if (this.bufferT > 0 && (this.onGround || this.coyoteT > 0) && !hurtLock) {
      this.vy = -(PHYS.jumpV + PHYS.jumpRunBonus * Math.min(1, Math.abs(this.vx) / PHYS.runMax));
      this.onGround = false;
      this.coyoteT = 0;
      this.bufferT = 0;
      this.jumping = true;
      this.jumpCutDone = false;
      this.airMax = Math.max(PHYS.walkMax, Math.abs(this.vx));
      jumpedNow = true;
    }
    if (this.jumping && !inp.jump && this.vy < 0 && !this.jumpCutDone) {
      this.vy *= PHYS.jumpCut;
      this.jumpCutDone = true;
    }

    const g = this.vy < 0 ? PHYS.gravityUp : PHYS.gravityDown;
    this.vy = Math.min(this.vy + g * dt, PHYS.maxFall);

    this.justJumped = jumpedNow;
    const wasGround = this.onGround || jumpedNow;
    const fallSpeed = this.vy;
    const r = moveBody(map, this, dt, { oneWay: true, dropping: this.dropT > 0, platforms, nudge: PHYS.cornerNudge, hitsHidden: true }, this.result);
    this.platform = r.platform;
    if (r.landed) {
      this.jumping = false;
      if (!wasGround && fallSpeed > 260) this.landT = 0.12;
    }
    if (r.head) this.bonkT = 0.16;

    // Animation state.
    this.updateAnim(dt, skidding);
    return r;
  }

  private updateAnim(dt: number, skidding: boolean) {
    let a: Anim;
    if (this.dead) a = 'death';
    else if (this.victory) a = 'victory';
    else if (this.hurtT > 0) a = 'hurt';
    else if (this.lassoT > 0) a = 'lasso';
    else if (!this.onGround) a = this.bonkT > 0 ? 'bonk' : this.vy < 0 ? 'jump' : 'fall';
    else if (skidding) a = 'skid';
    else if (this.landT > 0) a = 'land';
    else if (Math.abs(this.vx) > 300) a = 'run';
    else if (Math.abs(this.vx) > 8) a = 'walk';
    else a = 'idle';
    if (a !== this.anim) {
      this.anim = a;
      this.animT = 0;
    }
    if (this.onGround) this.stride += Math.abs(this.vx) * dt;
  }

  hasStar() {
    return this.starT > 0;
  }

  /** Reset per-life state (keeps nothing timed). */
  resetLife() {
    this.dead = false;
    this.deathT = 0;
    this.victory = false;
    this.frozen = false;
    this.starT = 0;
    this.lanternT = 0;
    this.invulnT = 0;
    this.hurtT = 0;
    this.lassoT = 0;
    this.jumping = false;
    this.bufferT = 0;
    this.coyoteT = 0;
    this.dropT = 0;
    this.pendingGrow = false;
    if (this.form !== 'rookie') this.shrink();
    this.growT = 0;
    this.anim = 'idle';
  }
}

export const LASSO_RANGE = RULES.lassoRange;
