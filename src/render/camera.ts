// CameraDirector: aerial opening, title portrait, stable chase camera, glide, results, closet and landmark views.
// Transitions orbit around Maddy in cylindrical coordinates so the camera never passes through her.

import * as THREE from 'three';
import { damp, smoothstep, wrapAngle } from '../core/rng';

export type CamMode = 'aerial' | 'title' | 'chase' | 'results' | 'closet' | 'inspect';

export interface CamContext {
  maddy: THREE.Vector3; // feet position
  heading: number; // route heading at Maddy
  lateral: number; // Maddy's lateral offset
  gliding: boolean;
  inspectTarget: THREE.Vector3 | null;
  time: number;
  aspect: number;
  /** -1..1: gently turn the view toward a landmark on that side (hazard-free viewing zones only). */
  peek: number;
}

/** Aerial overview echoing the handmade model's layout: looking north up the central avenue. */
export const AERIAL = { pos: new THREE.Vector3(100, 165, 205), look: new THREE.Vector3(100, 0, -215) };

export class CameraDirector {
  mode: CamMode = 'aerial';
  private blendT = 1;
  private blendDur = 1;
  private fromPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private look = new THREE.Vector3();
  private camHeading = 0;
  private shakeT = 0;
  private glideMix = 0;
  private peek = 0;
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();

  constructor(private cam: THREE.PerspectiveCamera) {
    cam.position.copy(AERIAL.pos);
    this.look.copy(AERIAL.look);
    cam.lookAt(this.look);
  }

  /** Switch mode; duration 0 cuts immediately. */
  set(mode: CamMode, duration: number, ctx?: CamContext) {
    this.fromPos.copy(this.cam.position);
    this.fromLook.copy(this.look);
    this.mode = mode;
    this.blendDur = Math.max(0.0001, duration);
    this.blendT = duration <= 0 ? 1 : 0;
    if (ctx) this.camHeading = ctx.heading;
  }

  shake(amount = 0.25) {
    this.shakeT = Math.max(this.shakeT, amount);
  }

  get blending() {
    return this.blendT < 1;
  }

  private target(ctx: CamContext, outPos: THREE.Vector3, outLook: THREE.Vector3) {
    const m = ctx.maddy;
    const h = ctx.heading;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    switch (this.mode) {
      case 'aerial': {
        const drift = Math.sin(ctx.time * 0.15) * 8;
        outPos.set(AERIAL.pos.x + drift, AERIAL.pos.y, AERIAL.pos.z);
        outLook.copy(AERIAL.look);
        break;
      }
      case 'title':
      case 'results':
      case 'closet': {
        // Portrait views of Maddy. Landscape: she stands right of the menus. Portrait: above the panels.
        const wide = ctx.aspect > 1.15;
        const title = this.mode === 'title';
        const dist = title ? (wide ? 3.4 : 3.0) : this.mode === 'results' ? (wide ? 3.3 : 3.6) : wide ? 3.0 : 3.4;
        const side = title ? 0.8 : this.mode === 'results' ? -0.5 : 0;
        const shift = wide ? 1.15 * (dist / 3.3) : 0;
        outPos.set(m.x + fx * dist + rx * side, title || wide ? 1.35 : 1.5, m.z + fz * dist + rz * side);
        // portrait: title centres her; results/closet frame her in the top part above the panel
        outLook.set(m.x + rx * shift, wide ? 0.95 : title ? 0.8 : -1.0, m.z + rz * shift);
        break;
      }
      case 'inspect': {
        const t = ctx.inspectTarget ?? m;
        const dx = t.x - m.x;
        const dz = t.z - m.z;
        const len = Math.hypot(dx, dz) || 1;
        outPos.set(m.x - (dx / len) * 3, 2.6, m.z - (dz / len) * 3);
        outLook.set(t.x, 5, t.z);
        break;
      }
      case 'chase': {
        const ch = this.camHeading;
        const cfx = Math.sin(ch);
        const cfz = -Math.cos(ch);
        const crx = Math.cos(ch);
        const crz = Math.sin(ch);
        const g = this.glideMix;
        const back = 5.8 + g * 2.6;
        const up = 3.15 + g * 0.6;
        const lat = ctx.lateral * 0.55;
        outPos.set(m.x - crx * (ctx.lateral - lat) - cfx * back, m.y * (0.75 + 0.1 * g) + up, m.z - crz * (ctx.lateral - lat) - cfz * back);
        const pk = this.peek * 3.2;
        outLook.set(m.x - crx * (ctx.lateral * 0.6 - pk) + cfx * (7 + g * 4), m.y * 0.8 + 1.1 + Math.abs(this.peek) * 0.6, m.z - crz * (ctx.lateral * 0.6 - pk) + cfz * (7 + g * 4));
        break;
      }
    }
  }

  update(dt: number, ctx: CamContext, reducedMotion: boolean) {
    // heading smoothing (corners rotate the camera gently, without control reversal)
    this.camHeading += wrapAngle(ctx.heading - this.camHeading) * damp(4.5, dt);
    this.glideMix += ((ctx.gliding ? 1 : 0) - this.glideMix) * damp(2, dt);
    this.peek += (ctx.peek - this.peek) * damp(2.5, dt);
    this.target(ctx, this.tmpPos, this.tmpLook);
    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / this.blendDur);
      const k = smoothstep(this.blendT);
      // orbit around Maddy in cylindrical coordinates
      const c = ctx.maddy;
      const a0 = Math.atan2(this.fromPos.z - c.z, this.fromPos.x - c.x);
      const a1 = Math.atan2(this.tmpPos.z - c.z, this.tmpPos.x - c.x);
      const r0 = Math.hypot(this.fromPos.x - c.x, this.fromPos.z - c.z);
      const r1 = Math.hypot(this.tmpPos.x - c.x, this.tmpPos.z - c.z);
      const a = a0 + wrapAngle(a1 - a0) * k;
      const r = r0 + (r1 - r0) * k;
      const y = this.fromPos.y + (this.tmpPos.y - this.fromPos.y) * k;
      this.cam.position.set(c.x + Math.cos(a) * r, Math.max(y, 0.6), c.z + Math.sin(a) * r);
      this.look.lerpVectors(this.fromLook, this.tmpLook, k);
    } else {
      this.cam.position.copy(this.tmpPos);
      this.look.copy(this.tmpLook);
    }
    if (this.shakeT > 0 && !reducedMotion) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const s = this.shakeT * 0.35;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
    }
    this.cam.lookAt(this.look);
  }
}
