// Confetti and streamers for solves and wins.

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

const COLORS = ['#ffd34d', '#ff5747', '#3f8cff', '#36d17a', '#ff7ad1', '#ffffff', '#b06bff'];

export class Confetti {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private bits: Bit[] = [];
  private raf = 0;
  private last = 0;
  reduceMotion = false;

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'confetti';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.append(this.canvas);
    this.g = this.canvas.getContext('2d')!;
  }

  burst(big = false, tint?: string) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== W * dpr) {
      this.canvas.width = W * dpr;
      this.canvas.height = H * dpr;
    }
    const n = this.reduceMotion ? 40 : big ? 260 : 130;
    const palette = tint ? [tint, tint, ...COLORS] : COLORS;
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0;
      this.bits.push({
        x: big ? Math.random() * W : fromLeft ? W * 0.1 : W * 0.9,
        y: big ? -20 - Math.random() * H * 0.4 : H * 0.55,
        vx: big ? (Math.random() - 0.5) * 120 : (fromLeft ? 1 : -1) * (200 + Math.random() * 380),
        vy: big ? 80 + Math.random() * 160 : -(420 + Math.random() * 520),
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 10,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: big ? 5 + Math.random() * 2 : 3 + Math.random(),
      });
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const g = this.g;
    const dpr = this.canvas.width / window.innerWidth || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const b of this.bits) {
      b.vy += 600 * dt;
      b.vx *= 1 - 0.9 * dt;
      b.vy = Math.min(b.vy, 260);
      b.x += (b.vx + Math.sin(now / 300 + b.r) * 30) * dt;
      b.y += b.vy * dt;
      b.r += b.vr * dt;
      b.life -= dt;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.r);
      g.scale(1, Math.cos(b.r * 1.7));
      g.globalAlpha = Math.max(0, Math.min(1, b.life));
      g.fillStyle = b.color;
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    }
    this.bits = this.bits.filter((b) => b.life > 0 && b.y < window.innerHeight + 40);
    if (this.bits.length) this.raf = requestAnimationFrame(this.frame);
    else {
      this.raf = 0;
      g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  };
}
