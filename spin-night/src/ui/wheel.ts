// The wheel: a canvas disc that spins under a fixed pointer.
// The landing wedge comes from the final angle, the same way the engine reads it,
// so the wedge under the pointer is always the wedge that pays out.

import type { SpinState, Wedge } from '../engine/types';
import { WEDGES, WEDGE_DEG, spinProgress, wedgeAt } from '../engine/wheels';

const RAD = Math.PI / 180;
const FONT = '"Bungee", "Arial Black", Impact, sans-serif';

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function lighten(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const LABELS: Partial<Record<Wedge['kind'], [string, string]>> = {
  bankrupt: ['BANKRUPT', ''],
  lose: ['LOSE A TURN', ''],
  wild: ['WILD CARD', '$500'],
  gift: ['GIFT TAG', '$1,000'],
  prize: ['PRIZE', '$500'],
  mystery: ['MYSTERY', '$1,000'],
  express: ['EXPRESS', '$1,000'],
};

export class WheelView {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private size = 0;
  private dpr = 1;
  private wedges: Wedge[] = [];
  private key = '';
  private disc: HTMLCanvasElement | null = null;
  angle = 0;
  private flap = 0;
  private flapV = 0;
  private lastPeg = 0;
  private spinning = false;
  private highlight: number | null = null;
  private raf = 0;
  private idleTimer = 0;
  private drag: { start: number; base: number; samples: { t: number; a: number }[]; moved: number } | null = null;

  onTick: (speed: number) => void = () => {};
  onFlick: (from: number, power: number) => void = () => {};
  canFlick: () => boolean = () => false;
  speedScale = 1;

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wheel-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Prize wheel');
    host.prepend(this.canvas);
    this.g = this.canvas.getContext('2d')!;
    this.bindDrag();
    document.fonts?.ready.then(() => {
      this.key = '';
      this.render();
    });
    this.idleTimer = window.setInterval(() => {
      if (!this.spinning && !this.drag && document.visibilityState === 'visible' && this.size) this.draw(performance.now());
    }, 140);
  }

  resize(size: number) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    size = Math.max(120, Math.floor(size));
    if (size === this.size && dpr === this.dpr) return;
    this.size = size;
    this.dpr = dpr;
    this.canvas.style.width = this.canvas.style.height = `${size}px`;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.key = '';
    this.render();
  }

  setWedges(wedges: Wedge[]) {
    this.wedges = wedges;
    this.render();
  }

  setAngle(a: number) {
    if (this.spinning || this.drag) return;
    this.angle = a;
    this.draw(performance.now());
  }

  setHighlight(i: number | null) {
    this.highlight = i;
    this.draw(performance.now());
  }

  /** Wedge under the pointer right now. */
  current() {
    return wedgeAt(this.angle);
  }

  private render() {
    if (!this.size || !this.wedges.length) return;
    const key = `${this.size}|${this.dpr}|${JSON.stringify(this.wedges.map((w) => [w.kind, w.value, w.color]))}`;
    if (key !== this.key) {
      this.key = key;
      this.disc = this.drawDisc();
    }
    this.draw(performance.now());
  }

  private get R() {
    return (this.size / 2) * 0.86;
  }

  private drawDisc(): HTMLCanvasElement {
    const px = this.size * this.dpr;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const R = this.R;
    g.translate(this.size / 2, this.size / 2);
    this.wedges.forEach((w, i) => {
      const a0 = (i * WEDGE_DEG - 90) * RAD;
      const a1 = ((i + 1) * WEDGE_DEG - 90) * RAD;
      const grad = g.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
      grad.addColorStop(0, lighten(w.color, w.kind === 'bankrupt' ? 0.1 : 0.05));
      grad.addColorStop(0.75, w.color);
      grad.addColorStop(1, lighten(w.color, w.kind === 'bankrupt' ? 0.18 : 0.22));
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R, a0, a1);
      g.closePath();
      g.fillStyle = grad;
      g.fill();
      if (i === 0 && w.kind === 'cash') {
        // Top-dollar wedge gets a sparkle band.
        g.save();
        g.clip();
        const sh = g.createLinearGradient(-R * 0.3, -R, R * 0.3, -R * 0.2);
        sh.addColorStop(0, 'rgba(255,255,255,0)');
        sh.addColorStop(0.5, 'rgba(255,255,255,.55)');
        sh.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = sh;
        g.fillRect(-R, -R, R * 2, R * 2);
        g.restore();
      }
      g.strokeStyle = 'rgba(255,240,200,.85)';
      g.lineWidth = Math.max(1, R * 0.008);
      g.stroke();
      this.drawLabel(g, w, i, R);
    });
    // Pegs between wedges.
    for (let i = 0; i < WEDGES; i++) {
      const a = (i * WEDGE_DEG - 90) * RAD;
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.955, Math.sin(a) * R * 0.955, Math.max(1.6, R * 0.017), 0, Math.PI * 2);
      g.fillStyle = '#fff3c4';
      g.fill();
      g.strokeStyle = '#8a6a1c';
      g.lineWidth = Math.max(0.6, R * 0.005);
      g.stroke();
    }
    return c;
  }

  private drawLabel(g: CanvasRenderingContext2D, w: Wedge, i: number, R: number) {
    const mid = (i + 0.5) * WEDGE_DEG * RAD;
    const dark = luminance(w.color) > 0.42;
    const ink = dark ? '#16131c' : '#ffffff';
    g.save();
    g.rotate(mid);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = ink;
    if (w.kind === 'cash') {
      const s = `$${w.value}`;
      const fs = R * (s.length >= 5 ? 0.096 : 0.108);
      let r = R * 0.84;
      for (const ch of s) {
        g.font = `${ch === '$' ? fs * 0.82 : fs}px ${FONT}`;
        if (!dark) {
          g.shadowColor = 'rgba(0,0,0,.35)';
          g.shadowBlur = R * 0.012;
        }
        g.fillText(ch, 0, -r);
        r -= fs * 0.9;
      }
    } else if (w.kind === 'envelope') {
      const y = -R * 0.74;
      const ew = R * 0.13;
      const eh = R * 0.09;
      g.fillStyle = '#fff8e6';
      g.strokeStyle = '#8a5d12';
      g.lineWidth = R * 0.008;
      g.beginPath();
      g.rect(-ew / 2, y - eh / 2, ew, eh);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(-ew / 2, y - eh / 2);
      g.lineTo(0, y + eh * 0.12);
      g.lineTo(ew / 2, y - eh / 2);
      g.stroke();
      g.fillStyle = '#5a3a08';
      g.font = `${R * 0.1}px ${FONT}`;
      g.fillText('?', 0, -R * 0.5);
    } else {
      const [main, sub] = LABELS[w.kind] ?? ['', ''];
      if (w.kind === 'mystery') {
        g.font = `${R * 0.15}px ${FONT}`;
        g.fillText('?', 0, -R * 0.82);
      }
      g.rotate(-Math.PI / 2);
      const long = main.length > 8;
      const fs = R * (long ? 0.064 : main.length > 6 ? 0.074 : 0.084);
      const r = w.kind === 'mystery' ? R * 0.5 : R * 0.6;
      g.font = `${fs}px ${FONT}`;
      if (sub) {
        g.fillText(main, r, -fs * 0.55);
        g.font = `${fs * 0.86}px ${FONT}`;
        g.fillText(sub, r, fs * 0.6);
      } else {
        g.fillText(main, r, 0);
      }
    }
    g.restore();
  }

  private draw(now: number) {
    const g = this.g;
    const S = this.size;
    if (!S) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    const cx = S / 2;
    const cy = S / 2;
    const R = this.R;
    const Rrim = S / 2 - 2;

    // Rim with bulbs.
    const rim = g.createRadialGradient(cx, cy, R, cx, cy, Rrim);
    rim.addColorStop(0, '#5b3d08');
    rim.addColorStop(0.35, '#e6b94a');
    rim.addColorStop(0.7, '#fff0b3');
    rim.addColorStop(1, '#8c6414');
    g.beginPath();
    g.arc(cx, cy, Rrim, 0, Math.PI * 2);
    g.fillStyle = rim;
    g.fill();
    const bulbs = 32;
    const phase = Math.floor(now / (this.spinning ? 70 : 450));
    for (let i = 0; i < bulbs; i++) {
      const a = (i / bulbs) * Math.PI * 2;
      const rr = (R + Rrim) / 2;
      const on = this.spinning ? (i + phase) % 3 === 0 : (i + phase) % 2 === 0;
      g.beginPath();
      g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(1.5, (Rrim - R) * 0.24), 0, Math.PI * 2);
      g.fillStyle = on ? '#fffbe8' : '#c89a3a';
      g.shadowColor = on ? 'rgba(255,240,180,.95)' : 'transparent';
      g.shadowBlur = on ? (Rrim - R) * 0.8 : 0;
      g.fill();
    }
    g.shadowBlur = 0;

    // Disc.
    if (this.disc) {
      g.save();
      g.translate(cx, cy);
      g.rotate(this.angle * RAD);
      g.drawImage(this.disc, -S / 2, -S / 2, S, S);
      g.restore();
    }

    // Landed wedge glow.
    if (this.highlight !== null && !this.spinning) {
      const i = this.highlight;
      const a0 = (i * WEDGE_DEG - 90 + this.angle) * RAD;
      const a1 = ((i + 1) * WEDGE_DEG - 90 + this.angle) * RAD;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, R, a0, a1);
      g.closePath();
      const pulse = 0.25 + 0.15 * Math.sin(now / 160);
      g.fillStyle = `rgba(255,255,255,${pulse})`;
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = Math.max(2, R * 0.018);
      g.stroke();
    }

    // Hub.
    const hr = R * 0.2;
    const hub = g.createRadialGradient(cx - hr * 0.3, cy - hr * 0.3, hr * 0.1, cx, cy, hr);
    hub.addColorStop(0, '#fff7d1');
    hub.addColorStop(0.5, '#e2b33f');
    hub.addColorStop(1, '#7c560f');
    g.beginPath();
    g.arc(cx, cy, hr, 0, Math.PI * 2);
    g.fillStyle = hub;
    g.fill();
    g.beginPath();
    g.arc(cx, cy, hr * 0.8, 0, Math.PI * 2);
    g.fillStyle = '#1a1036';
    g.fill();
    g.fillStyle = '#ffd34d';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${hr * 0.36}px ${FONT}`;
    g.fillText('SPIN', cx, cy - hr * 0.2);
    g.fillStyle = '#ff7ad1';
    g.font = `${hr * 0.3}px ${FONT}`;
    g.fillText('NIGHT', cx, cy + hr * 0.22);

    // Pointer (flapper) at 12 o'clock.
    g.save();
    g.translate(cx, cy - Rrim + 2);
    g.rotate(this.flap * RAD);
    const pw = S * 0.042;
    const ph = S * 0.11;
    g.beginPath();
    g.moveTo(-pw, -2);
    g.lineTo(pw, -2);
    g.lineTo(0, ph);
    g.closePath();
    const pg = g.createLinearGradient(-pw, 0, pw, 0);
    pg.addColorStop(0, '#9c1a1a');
    pg.addColorStop(0.5, '#ff4a3d');
    pg.addColorStop(1, '#9c1a1a');
    g.fillStyle = pg;
    g.shadowColor = 'rgba(0,0,0,.5)';
    g.shadowBlur = 6;
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = '#ffe28a';
    g.lineWidth = Math.max(1.5, S * 0.006);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, pw * 0.55, 0, Math.PI * 2);
    g.fillStyle = '#ffe28a';
    g.fill();
    g.restore();
  }

  private stepFlap(dt: number) {
    // Damped spring back to rest.
    this.flapV += (-this.flap * 380 - this.flapV * 16) * dt;
    this.flap += this.flapV * dt;
  }

  private kick(dir: number, speed: number) {
    this.flap = Math.max(-28, Math.min(28, this.flap - dir * (10 + speed * 14)));
    this.onTick(speed);
  }

  spin(spin: SpinState): Promise<void> {
    cancelAnimationFrame(this.raf);
    this.highlight = null;
    this.spinning = true;
    this.angle = spin.from;
    this.lastPeg = Math.floor(spin.from / WEDGE_DEG);
    const dur = spin.duration * 1000 * this.speedScale;
    const t0 = performance.now();
    let last = t0;
    let lastAngle = spin.from;
    const dir = Math.sign(spin.to - spin.from) || 1;
    return new Promise((resolve) => {
      const frame = (now: number) => {
        const t = Math.min(dur, now - t0);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.angle = spin.from + (spin.to - spin.from) * spinProgress(t / 1000, dur / 1000);
        const peg = Math.floor(this.angle / WEDGE_DEG);
        const speed = Math.min(1, Math.abs(this.angle - lastAngle) / Math.max(dt, 0.001) / 1400);
        lastAngle = this.angle;
        if (peg !== this.lastPeg) {
          this.lastPeg = peg;
          this.kick(dir, speed);
        }
        this.stepFlap(dt);
        this.draw(now);
        if (t < dur) {
          this.raf = requestAnimationFrame(frame);
        } else {
          this.angle = spin.to;
          this.spinning = false;
          this.settle();
          resolve();
        }
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  /** Let the flapper come to rest after a spin. */
  private settle() {
    let last = performance.now();
    const end = last + 700;
    const frame = (now: number) => {
      this.stepFlap(Math.min(0.05, (now - last) / 1000));
      last = now;
      this.draw(now);
      if (now < end && !this.spinning) this.raf = requestAnimationFrame(frame);
      else if (!this.spinning) {
        this.flap = 0;
        this.draw(now);
      }
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Jump straight to a landing (used when a spin was interrupted by a reload). */
  finishInstantly(spin: SpinState) {
    cancelAnimationFrame(this.raf);
    this.spinning = false;
    this.angle = spin.to;
    this.draw(performance.now());
  }

  private pointerAngle(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) / RAD;
  }

  private bindDrag() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.spinning || !this.canFlick()) return;
      const r = c.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) > r.width / 2) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const a = this.pointerAngle(e);
      this.drag = { start: a, base: this.angle, samples: [{ t: performance.now(), a: this.angle }], moved: 0 };
      this.highlight = null;
    });
    c.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      let delta = this.pointerAngle(e) - d.start;
      delta = ((((delta + 180) % 360) + 360) % 360) - 180;
      // Unwrap relative to the previous sample so fast drags keep their direction.
      const prev = d.samples[d.samples.length - 1].a - d.base;
      while (delta - prev > 180) delta -= 360;
      while (delta - prev < -180) delta += 360;
      const next = d.base + delta;
      d.moved = Math.max(d.moved, Math.abs(delta));
      const peg = Math.floor(next / WEDGE_DEG);
      if (peg !== Math.floor(this.angle / WEDGE_DEG)) this.kick(Math.sign(next - this.angle), 0.2);
      this.angle = next;
      const now = performance.now();
      d.samples.push({ t: now, a: next });
      while (d.samples.length > 2 && now - d.samples[0].t > 120) d.samples.shift();
      this.draw(now);
    });
    const end = (e: PointerEvent) => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const s0 = d.samples[0];
      const s1 = d.samples[d.samples.length - 1];
      const dt = (s1.t - s0.t) / 1000;
      const v = dt > 0.005 ? (s1.a - s0.a) / dt : 0;
      if (!this.canFlick()) return;
      if (Math.abs(v) > 160) this.onFlick(this.angle, Math.sign(v) * Math.min(1, Math.abs(v) / 1500));
      else if (d.moved < 4 && e.type === 'pointerup') this.onFlick(this.angle, 0.55); // a tap spins too
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.idleTimer);
  }
}
