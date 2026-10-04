// Fixed-size particle pool: no allocation during play.

export enum PK {
  Dust,
  Spark,
  Debris,
  Ball,
  Star,
  Text,
  Ring,
  Confetti,
}

export interface Particle {
  on: boolean;
  kind: PK;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  text: string;
}

export class Particles {
  readonly list: Particle[] = [];
  private next = 0;
  /** Multiplier from the reduced-motion setting. */
  density = 1;

  constructor(n = 500) {
    for (let i = 0; i < n; i++)
      this.list.push({ on: false, kind: PK.Dust, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 4, rot: 0, vr: 0, color: '#fff', text: '' });
  }

  spawn(kind: PK, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, g = 0, text = ''): Particle {
    const p = this.list[this.next];
    this.next = (this.next + 1) % this.list.length;
    p.on = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.g = g;
    p.text = text;
    p.rot = Math.random() * Math.PI * 2;
    p.vr = (Math.random() - 0.5) * 10;
    return p;
  }

  burst(kind: PK, x: number, y: number, n: number, speed: number, life: number, size: number, color: string, g = 0, upBias = 0) {
    const count = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(kind, x, y, Math.cos(a) * s, Math.sin(a) * s - upBias, life * (0.7 + Math.random() * 0.5), size * (0.7 + Math.random() * 0.6), color, g);
    }
  }

  text(x: number, y: number, text: string, color = '#FFF8EC') {
    this.spawn(PK.Text, x, y, 0, -70, 0.9, 16, color, 0, text);
  }

  update(dt: number) {
    for (const p of this.list) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.on = false;
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === PK.Dust) {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }
  }

  clear() {
    for (const p of this.list) p.on = false;
  }
}
