import { VIEW_H, VIEW_W } from '../config';
import type { Zone } from '../levels/types';
import type { Player } from './player';

/**
 * Side-scrolling camera: horizontal dead zone with look-ahead in the facing direction,
 * platform-snapped eased vertical tracking, hard margins so the player never outruns it.
 * Shake is a render-only offset and never touches collision.
 */
export class Camera {
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  look = 0;
  shakeT = 0;
  shakeA = 0;
  shakeX = 0;
  shakeY = 0;
  reduced = false;
  private targetY = 0;

  snap(p: Player, z: Zone) {
    this.look = p.facing * 60;
    this.x = p.cx + this.look - VIEW_W * 0.45;
    this.targetY = p.bottom - VIEW_H * 0.68;
    this.y = this.targetY;
    this.clamp(z);
    this.prevX = this.x;
    this.prevY = this.y;
  }

  shake(a: number, t = 0.25) {
    if (this.reduced) return;
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = Math.max(this.shakeT, t);
  }

  update(dt: number, p: Player, z: Zone) {
    this.prevX = this.x;
    this.prevY = this.y;
    // Look-ahead eases toward the facing direction, stronger when moving.
    const moving = Math.abs(p.vx) > 40;
    const lookTarget = p.facing * (moving ? 96 : 40);
    this.look += (lookTarget - this.look) * Math.min(1, dt * 2.2);
    const focus = p.cx + this.look;
    const left = this.x + VIEW_W * 0.4;
    const right = this.x + VIEW_W * 0.56;
    let tx = this.x;
    if (focus < left) tx = focus - VIEW_W * 0.4;
    else if (focus > right) tx = focus - VIEW_W * 0.56;
    this.x += (tx - this.x) * Math.min(1, dt * 9);
    // Hard margins: the player is always at least 180 px inside the view.
    this.x = Math.min(this.x, p.cx - 180);
    this.x = Math.max(this.x, p.cx - (VIEW_W - 180));

    // Vertical: follow the ground the player stands on; only chase mid-air near the edges.
    if (p.onGround) this.targetY = p.bottom - VIEW_H * 0.68;
    else {
      const top = p.y - this.targetY;
      if (top < VIEW_H * 0.2) this.targetY = p.y - VIEW_H * 0.2;
      const bot = p.bottom - this.targetY;
      if (bot > VIEW_H * 0.86) this.targetY = p.bottom - VIEW_H * 0.86;
    }
    this.y += (this.targetY - this.y) * Math.min(1, dt * 4.5);
    this.y = Math.min(this.y, p.y - 24);
    this.y = Math.max(this.y, p.bottom - VIEW_H + 16);
    this.clamp(z);

    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT / 0.25);
      this.shakeX = (Math.random() * 2 - 1) * a;
      this.shakeY = (Math.random() * 2 - 1) * a;
      if (this.shakeT <= 0) this.shakeA = 0;
    } else this.shakeX = this.shakeY = 0;
  }

  clamp(z: Zone) {
    const maxX = Math.max(z.x0, z.x1 - VIEW_W);
    this.x = Math.max(z.x0, Math.min(maxX, this.x));
    const maxY = Math.max(z.y0, z.y1 - VIEW_H);
    this.y = Math.max(z.y0, Math.min(maxY, this.y));
  }
}
