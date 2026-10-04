import { VIEW_H, VIEW_W } from '../config';
import type { Backdrop } from '../levels/types';
import { C, drawLantern, makeCanvas, rr } from './art';
import { FH_GROUND, FH_H, FH_W, renderFieldhouse } from './fieldhouse';

type Ctx = CanvasRenderingContext2D;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const STRIP_W = 1600;

/** Pre-rendered parallax layers, regenerated when the pixel scale changes. */
export class Backdrops {
  private scale = 0;
  private c: Record<string, HTMLCanvasElement> = {};
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private crowd: { x: number; y: number; c: string; p: number }[] = [];

  ensure(scale: number) {
    if (scale === this.scale) return;
    this.scale = scale;
    const s = scale;
    this.c = {
      fhSunset: renderFieldhouse('sunset', s * 0.75),
      fhNight: renderFieldhouse('night', s),
      skylineDusk: this.skyline(s, false),
      skylineNight: this.skyline(s, true),
      palmsDusk: this.palms(s, false),
      palmsNight: this.palms(s, true),
      hedges: this.hedges(s, false),
      hedgesNight: this.hedges(s, true),
      arches: this.arches(s),
      seats: this.seats(s),
      shelves: this.shelves(s),
    };
    const r = rng(7);
    this.stars = Array.from({ length: 90 }, () => ({ x: r() * VIEW_W, y: r() * VIEW_H * 0.6, r: 0.6 + r() * 1.4, p: r() * 6 }));
    const r2 = rng(11);
    const cols = ['#FF5E17', '#FFF8EC', '#00C21D', '#FFA61A', '#646469', '#FF8A4C'];
    this.crowd = Array.from({ length: 220 }, () => ({ x: r2() * STRIP_W, y: r2(), c: cols[Math.floor(r2() * cols.length)], p: r2() * 6 }));
  }

  // ---- strip builders -------------------------------------------------------------
  private skyline(s: number, night: boolean) {
    const h = 260;
    const cv = makeCanvas(STRIP_W * s, h * s);
    const ctx = cv.getContext('2d')!;
    ctx.scale(s, s);
    const r = rng(night ? 3 : 4);
    let x = 0;
    while (x < STRIP_W) {
      const w = 60 + r() * 120;
      const bh = 60 + r() * 150;
      ctx.fillStyle = night ? '#1A1420' : '#7A4A5C';
      ctx.fillRect(x, h - bh, w, bh);
      if (r() < 0.35) {
        ctx.fillRect(x + w * 0.3, h - bh - 24, w * 0.4, 24);
      }
      // lit windows
      ctx.fillStyle = night ? 'rgba(255,170,80,0.7)' : 'rgba(255,210,150,0.35)';
      for (let wy = h - bh + 14; wy < h - 10; wy += 16)
        for (let wx = x + 8; wx < x + w - 10; wx += 14) if (r() < (night ? 0.35 : 0.2)) ctx.fillRect(wx, wy, 6, 8);
      x += w + 6 + r() * 30;
    }
    return cv;
  }

  private palms(s: number, night: boolean) {
    const h = 300;
    const cv = makeCanvas(STRIP_W * s, h * s);
    const ctx = cv.getContext('2d')!;
    ctx.scale(s, s);
    const r = rng(night ? 21 : 22);
    const col = night ? '#0C0A10' : '#3B2238';
    for (let x = 40; x < STRIP_W; x += 140 + r() * 120) {
      const th = 150 + r() * 110;
      const lean = (r() - 0.5) * 30;
      ctx.strokeStyle = col;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + lean * 0.3, h - th * 0.5, x + lean, h - th);
      ctx.stroke();
      ctx.fillStyle = col;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.5 + (r() - 0.5) * 0.2;
        const len = 50 + r() * 26;
        ctx.save();
        ctx.translate(x + lean, h - th);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.5, -14, len, 10);
        ctx.quadraticCurveTo(len * 0.5, 0, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
    return cv;
  }

  private hedges(s: number, night: boolean) {
    const h = 120;
    const cv = makeCanvas(STRIP_W * s, h * s);
    const ctx = cv.getContext('2d')!;
    ctx.scale(s, s);
    const r = rng(night ? 31 : 32);
    for (let x = -20; x < STRIP_W + 40; x += 30 + r() * 20) {
      const rad = 24 + r() * 22;
      ctx.beginPath();
      ctx.arc(x, h - 10, rad, Math.PI, 0);
      ctx.fillStyle = night ? '#08301A' : '#1E8C38';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - rad * 0.3, h - 10 - rad * 0.4, rad * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = night ? 'rgba(60,160,80,0.25)' : 'rgba(150,230,140,0.4)';
      ctx.fill();
    }
    ctx.fillStyle = night ? '#08301A' : '#1E8C38';
    ctx.fillRect(0, h - 12, STRIP_W, 12);
    return cv;
  }

  private arches(s: number) {
    const h = 540;
    const cv = makeCanvas(STRIP_W * s, h * s);
    const ctx = cv.getContext('2d')!;
    ctx.scale(s, s);
    const wall = ctx.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, '#5A3E30');
    wall.addColorStop(1, '#A87650');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, STRIP_W, h);
    ctx.strokeStyle = 'rgba(40,20,10,0.22)';
    ctx.lineWidth = 1;
    for (let y = 8; y < h; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(STRIP_W, y);
      ctx.stroke();
    }
    for (let x = 0; x < STRIP_W; x += 200) {
      const ax = x + 100;
      // arch opening with warm light
      ctx.beginPath();
      ctx.moveTo(ax - 70, h - 40);
      ctx.lineTo(ax - 70, 260);
      ctx.ellipse(ax, 260, 70, 80, 0, Math.PI, 0);
      ctx.lineTo(ax + 70, h - 40);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 180, 0, h);
      g.addColorStop(0, '#3A2218');
      g.addColorStop(1, '#C8642A');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#B98455';
      ctx.stroke();
      // banner between arches
      ctx.fillStyle = x % 400 === 0 ? C.orange : C.green;
      ctx.beginPath();
      ctx.moveTo(x - 18, 120);
      ctx.lineTo(x + 18, 120);
      ctx.lineTo(x + 18, 220);
      ctx.lineTo(x, 204);
      ctx.lineTo(x - 18, 220);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.cream;
      ctx.font = '900 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('V', x, 170);
      // wall sconce
      const sg = ctx.createRadialGradient(x, 90, 2, x, 90, 60);
      sg.addColorStop(0, 'rgba(255,190,110,0.6)');
      sg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x - 60, 30, 120, 120);
    }
    return cv;
  }

  private seats(s: number) {
    const h = 420;
    const cv = makeCanvas(STRIP_W * s, h * s);
    const ctx = cv.getContext('2d')!;
    ctx.scale(s, s);
    for (let row = 0; row < 12; row++) {
      const y = 40 + row * 30;
      ctx.fillStyle = row % 2 ? '#2A2024' : '#33272B';
      ctx.fillRect(0, y, STRIP_W, 30);
      for (let x = (row % 2) * 9; x < STRIP_W; x += 18) {
        rr(ctx, x + 2, y + 6, 14, 14, 3);
        ctx.fillStyle = row < 3 ? '#B8430E' : C.orange;
        ctx.fill();
      }
    }
    // aisles
    ctx.fillStyle = '#18141A';
    for (let x = 180; x < STRIP_W; x += 400) ctx.fillRect(x, 40, 22, 360);
    return cv;
  }

  private shelves(s: number) {
    const h = 540;
    const cv = makeCanvas(STRIP_W * s, h * s);
    const ctx = cv.getContext('2d')!;
    ctx.scale(s, s);
    ctx.fillStyle = '#4A3428';
    ctx.fillRect(0, 0, STRIP_W, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let y = 6; y < h; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(STRIP_W, y);
      ctx.stroke();
    }
    const r = rng(41);
    for (let x = 40; x < STRIP_W; x += 260) {
      ctx.fillStyle = '#2A1C14';
      ctx.fillRect(x, 200, 200, 300);
      for (let sy = 230; sy < 480; sy += 70) {
        ctx.fillStyle = '#6A4630';
        ctx.fillRect(x, sy + 50, 200, 8);
        let bx = x + 8;
        while (bx < x + 186) {
          const bw = 8 + r() * 10;
          const bh = 30 + r() * 18;
          ctx.fillStyle = ['#FF5E17', '#FFF8EC', '#00C21D', '#646469', '#C9430C', '#FFA61A'][Math.floor(r() * 6)];
          ctx.fillRect(bx, sy + 50 - bh, bw, bh);
          bx += bw + 2;
        }
      }
    }
    return cv;
  }

  // ---- drawing --------------------------------------------------------------------
  private strip(ctx: Ctx, key: string, camX: number, f: number, y: number, h: number, offset = 0) {
    const cv = this.c[key];
    let x = -((camX * f + offset) % STRIP_W);
    if (x > 0) x -= STRIP_W;
    for (; x < VIEW_W; x += STRIP_W) ctx.drawImage(cv, x, y, STRIP_W, h);
  }

  /**
   * Draws a backdrop for camera (camX, camY). `levelW` (px) positions the Fieldhouse so it
   * stays in view across the level and is front and centre near the end.
   */
  draw(ctx: Ctx, b: Backdrop, camX: number, camY: number, time: number, levelW: number, fhAlpha = 1) {
    const py = -camY * 0.15; // slight vertical parallax
    switch (b) {
      case 'plaza': {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        g.addColorStop(0, '#4B2A55');
        g.addColorStop(0.45, '#C9506A');
        g.addColorStop(0.75, '#FF8A4C');
        g.addColorStop(1, '#FFC27A');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        // sun
        const sx = 700 - camX * 0.02;
        const sg = ctx.createRadialGradient(sx, 330 + py, 10, sx, 330 + py, 220);
        sg.addColorStop(0, 'rgba(255,240,200,1)');
        sg.addColorStop(0.25, 'rgba(255,200,120,0.8)');
        sg.addColorStop(1, 'rgba(255,160,80,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sx - 220, 110 + py, 440, 440);
        // clouds
        ctx.fillStyle = 'rgba(255,190,150,0.5)';
        for (let i = 0; i < 6; i++) {
          const cx = ((i * 330 - camX * 0.05) % 1400 + 1400) % 1400 - 200;
          const cy = 70 + (i % 3) * 50 + py;
          rr(ctx, cx, cy, 160 + (i % 2) * 80, 18, 9);
          ctx.fill();
        }
        this.strip(ctx, 'skylineDusk', camX, 0.06, 250 + py, 260);
        this.fieldhouse(ctx, 'fhSunset', camX, camY, levelW, 0.62, 0.11, fhAlpha);
        this.strip(ctx, 'palmsDusk', camX, 0.3, 190 + py * 1.5, 300);
        this.strip(ctx, 'hedges', camX, 0.55, 420 - camY * 0.3, 120);
        break;
      }
      case 'night':
      case 'exterior': {
        this.nightSky(ctx, time, py);
        this.strip(ctx, 'skylineNight', camX, 0.05, 230 + py, 260);
        if (b === 'night') this.fieldhouse(ctx, 'fhNight', camX, camY, levelW, 0.72, 0.1, fhAlpha);
        else {
          // Level 3 entrance: the building is close and front and centre.
          const size = 1.0;
          const x = VIEW_W / 2 - (FH_W * size) / 2 + 180 - camX * 0.45;
          ctx.drawImage(this.c.fhNight, x, 470 - FH_GROUND * size - camY * 0.3, FH_W * size, FH_H * size);
        }
        this.strip(ctx, 'palmsNight', camX, 0.32, 180 + py * 1.5, 300);
        this.strip(ctx, 'hedgesNight', camX, 0.55, 420 - camY * 0.3, 120);
        // lamp posts with warm glow
        for (let i = 0; i < 5; i++) {
          const lx = ((i * 260 - camX * 0.55) % 1300 + 1300) % 1300 - 160;
          const ly = 300 - camY * 0.3;
          ctx.fillStyle = '#121014';
          ctx.fillRect(lx - 3, ly, 6, 160);
          const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 70);
          lg.addColorStop(0, 'rgba(255,190,110,0.85)');
          lg.addColorStop(1, 'rgba(255,190,110,0)');
          ctx.fillStyle = lg;
          ctx.fillRect(lx - 70, ly - 70, 140, 140);
          ctx.fillStyle = '#FFE0B0';
          ctx.fillRect(lx - 6, ly - 6, 12, 8);
        }
        break;
      }
      case 'concourse': {
        this.strip(ctx, 'arches', camX, 0.55, -camY * 0.4, 540);
        const fl = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        fl.addColorStop(0, 'rgba(20,10,5,0.35)');
        fl.addColorStop(0.3, 'rgba(20,10,5,0)');
        ctx.fillStyle = fl;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        break;
      }
      case 'arena': {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        g.addColorStop(0, '#0E0A0E');
        g.addColorStop(1, '#2A1A1C');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        // light rig beams
        for (let i = 0; i < 4; i++) {
          const bx = ((i * 320 - camX * 0.1) % 1280 + 1280) % 1280 - 160;
          const bg = ctx.createLinearGradient(bx, 0, bx + 80, VIEW_H);
          bg.addColorStop(0, 'rgba(255,220,170,0.16)');
          bg.addColorStop(1, 'rgba(255,220,170,0)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.lineTo(bx + 30, 0);
          ctx.lineTo(bx + 220, VIEW_H);
          ctx.lineTo(bx + 60, VIEW_H);
          ctx.closePath();
          ctx.fill();
        }
        const sy = 90 - camY * 0.25;
        this.strip(ctx, 'seats', camX, 0.3, sy, 420);
        // crowd heads bobbing
        const off = camX * 0.3;
        for (const p of this.crowd) {
          let x = (p.x - (off % STRIP_W) + STRIP_W) % STRIP_W;
          if (x > VIEW_W) continue;
          const row = Math.floor(p.y * 11);
          const y = sy + 40 + row * 30 + 2 + Math.sin(time * 5 + p.p) * 1.5;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Keep the crowd behind the action: dim it so platforms and enemies read clearly.
        ctx.fillStyle = 'rgba(14,10,12,0.55)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        break;
      }
      case 'secret': {
        this.strip(ctx, 'shelves', camX, 0.5, -camY * 0.4, 540);
        drawWarm(ctx, 200, 300);
        drawWarm(ctx, 760, 300);
        break;
      }
    }
  }

  private nightSky(ctx: Ctx, time: number, py: number) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#0B0912');
    g.addColorStop(0.6, '#241A2C');
    g.addColorStop(1, '#4A2A2E');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const s of this.stars) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 1.5 + s.p);
      ctx.fillStyle = C.cream;
      ctx.fillRect(s.x, s.y + py * 0.3, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    // moon
    ctx.beginPath();
    ctx.arc(150, 90 + py * 0.3, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF1D6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(162, 82 + py * 0.3, 27, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1422';
    ctx.fill();
  }

  private fieldhouse(ctx: Ctx, key: string, camX: number, camY: number, levelW: number, size: number, f: number, alpha: number) {
    if (alpha <= 0) return;
    const cv = this.c[key];
    const w = FH_W * size;
    const h = FH_H * size;
    // Positioned so that across the level the building slides from right-of-centre to left-of-centre.
    const travel = Math.max(0, levelW - VIEW_W) * f;
    const x = VIEW_W / 2 - w / 2 + travel * 0.5 - camX * f;
    const y = 470 - FH_GROUND * size - camY * 0.3;
    ctx.globalAlpha = alpha;
    ctx.drawImage(cv, x, y, w, h);
    ctx.globalAlpha = 1;
  }

  /** Title-screen composition: the full Fieldhouse at night. */
  drawTitle(ctx: Ctx, time: number) {
    this.nightSky(ctx, time, 0);
    this.strip(ctx, 'skylineNight', time * 4, 1, 250, 260);
    const cv = this.c.fhNight;
    const size = 0.64;
    ctx.drawImage(cv, VIEW_W / 2 - (FH_W * size) / 2, VIEW_H - FH_H * size + 44, FH_W * size, FH_H * size);
    // framing palms at the edges only, so the facade and lettering stay readable
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 150, VIEW_H);
    ctx.rect(VIEW_W - 150, 0, 150, VIEW_H);
    ctx.clip();
    this.strip(ctx, 'palmsNight', 0, 1, 250, 300, 30);
    ctx.restore();
  }
}

function drawWarm(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  drawLantern(ctx, 34, 1, 0);
  ctx.restore();
}
