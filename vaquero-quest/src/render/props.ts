import { TILE } from '../config';
import type { Bouncer, MovingPlatform, Projectile, Spikes } from '../game/entities';
import type { Checkpoint, Decor, Door, Sign } from '../game/world';
import { C, drawBasketball, drawLantern, drawPalmPot, drawStool, drawVEmblem, rr, starPath } from './art';

type Ctx = CanvasRenderingContext2D;

export function drawPalmTree(ctx: Ctx, x: number, y: number, s: number, time: number) {
  const h = 170 * s;
  const sway = Math.sin(time * 1.3 + x * 0.01) * 4 * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 13 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6 * s, -h * 0.5, sway + 4 * s, -h);
  ctx.stroke();
  ctx.strokeStyle = '#8A5A30';
  ctx.lineWidth = 9 * s;
  ctx.stroke();
  ctx.strokeStyle = '#6A4020';
  ctx.lineWidth = 2;
  for (let i = 1; i < 9; i++) {
    const t = i / 9;
    const px = 6 * s * 2 * t * (1 - t) + (sway + 4 * s) * t * t;
    const py = -h * t;
    ctx.beginPath();
    ctx.moveTo(px - 4 * s, py);
    ctx.lineTo(px + 4 * s, py - 3 * s);
    ctx.stroke();
  }
  const tx = sway + 4 * s;
  const ty = -h;
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i - 3.5) * 0.48 + Math.sin(time * 1.6 + i) * 0.04;
    const len = (58 + (i % 3) * 10) * s;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -16 * s, len, 12 * s);
    ctx.quadraticCurveTo(len * 0.5, 2 * s, 0, 0);
    ctx.fillStyle = i % 2 ? C.green : '#13A82E';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(tx - 4 * s, ty + 6 * s, 5 * s, 0, Math.PI * 2);
  ctx.arc(tx + 5 * s, ty + 7 * s, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#5A3A1A';
  ctx.fill();
  ctx.restore();
}

export function drawDecor(ctx: Ctx, d: Decor, x: number, y: number, time: number, night: boolean) {
  const s = d.scale;
  switch (d.art) {
    case 'palm':
      drawPalmTree(ctx, x, y, s, time);
      break;
    case 'palmpot':
      ctx.save();
      ctx.translate(x, y - 20 * s * 1.4);
      drawPalmPot(ctx, 56 * s, Math.sin(time * 1.5 + x) * 1.2);
      ctx.restore();
      break;
    case 'lamp': {
      ctx.fillStyle = '#1E1D21';
      ctx.fillRect(x - 3, y - 120, 6, 120);
      ctx.fillRect(x - 9, y - 6, 18, 6);
      ctx.save();
      ctx.translate(x, y - 132);
      drawLantern(ctx, 26, night ? 1.4 : 0.7, time);
      ctx.restore();
      break;
    }
    case 'lantern':
      ctx.save();
      ctx.translate(x, y - 20);
      drawLantern(ctx, 30, 1.2, time);
      ctx.restore();
      break;
    case 'bench':
      rr(ctx, x - 34, y - 26, 68, 8, 3);
      ctx.fillStyle = C.woodLight;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      rr(ctx, x - 34, y - 42, 68, 7, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2A2A2E';
      ctx.fillRect(x - 30, y - 18, 5, 18);
      ctx.fillRect(x + 25, y - 18, 5, 18);
      break;
    case 'banner': {
      ctx.fillStyle = '#2A2A2E';
      ctx.fillRect(x - 2, y - 150, 4, 150);
      const wv = Math.sin(time * 3 + x) * 3;
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 146);
      ctx.lineTo(x + 40, y - 146 + wv * 0.3);
      ctx.lineTo(x + 40, y - 80 + wv);
      ctx.lineTo(x + 21, y - 92 + wv);
      ctx.lineTo(x + 2, y - 80);
      ctx.closePath();
      ctx.fillStyle = C.orange;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.save();
      ctx.translate(x + 21, y - 118 + wv * 0.5);
      drawVEmblem(ctx, 22);
      ctx.restore();
      break;
    }
    case 'stoolstack':
      ctx.save();
      ctx.translate(x, y - 18);
      drawStool(ctx, 40);
      ctx.translate(0, -22);
      drawStool(ctx, 40);
      ctx.restore();
      break;
    case 'concession': {
      rr(ctx, x - 90, y - 140, 180, 140, 6);
      ctx.fillStyle = '#3A2A22';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      rr(ctx, x - 80, y - 130, 160, 28, 4);
      ctx.fillStyle = C.orange;
      ctx.fill();
      ctx.fillStyle = C.cream;
      ctx.font = '900 16px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CONCESSIONS', x, y - 110);
      const g = ctx.createLinearGradient(0, y - 96, 0, y - 40);
      g.addColorStop(0, '#FFD39A');
      g.addColorStop(1, '#FF9A50');
      ctx.fillStyle = g;
      ctx.fillRect(x - 76, y - 96, 152, 56);
      ctx.fillStyle = '#B98455';
      ctx.fillRect(x - 86, y - 40, 172, 12);
      break;
    }
    case 'scoreboard': {
      ctx.fillStyle = '#2A2A2E';
      ctx.fillRect(x - 3, y - 160, 6, 60);
      rr(ctx, x - 130, y - 100, 260, 110, 8);
      ctx.fillStyle = '#141316';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = C.orange;
      ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.font = '900 18px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VAQUEROS', x - 60, y - 70);
      ctx.fillText('GUESTS', x + 60, y - 70);
      ctx.font = '900 34px "Courier New", monospace';
      ctx.fillStyle = C.gold;
      const sc = 70 + (Math.floor(time / 4) % 30);
      ctx.fillText(String(sc), x - 60, y - 28);
      ctx.fillText('64', x + 60, y - 28);
      ctx.fillStyle = C.green;
      ctx.fillText(':', x, y - 30);
      break;
    }
    case 'hoop': {
      ctx.fillStyle = '#2A2A2E';
      ctx.fillRect(x - 4, y - 200, 8, 200);
      rr(ctx, x - 40, y - 250, 80, 54, 4);
      ctx.fillStyle = 'rgba(255,248,236,0.85)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.strokeStyle = C.orange;
      ctx.strokeRect(x - 16, y - 230, 32, 24);
      break;
    }
  }
}

export function drawSign(ctx: Ctx, s: Sign, x: number, y: number, icon: (ctx: Ctx, key: string, x: number, y: number, size: number) => void) {
  ctx.fillStyle = C.woodDark;
  ctx.fillRect(x - 3, y - 40, 6, 40);
  rr(ctx, x - 22, y - 62, 44, 30, 5);
  ctx.fillStyle = C.woodLight;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  icon(ctx, s.icon, x, y - 47, 22);
}

/** Speech-card for a sign; drawn in screen space above the sign. */
export function drawSignBubble(ctx: Ctx, s: Sign, x: number, y: number, viewW: number) {
  if (s.near <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = s.near;
  ctx.font = '700 15px "Trebuchet MS", Arial, sans-serif';
  const w = Math.min(380, ctx.measureText(s.text).width + 28);
  const bx = Math.max(10, Math.min(viewW - w - 10, x - w / 2));
  const by = y - 118 - (1 - s.near) * 8;
  rr(ctx, bx, by, w, 40, 10);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.orange;
  ctx.fillRect(bx + 10, by + 34, w - 20, 3);
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.text, bx + w / 2, by + 18, w - 20);
  ctx.restore();
}

export function drawDoor(ctx: Ctx, d: Door, x: number, y: number, time: number) {
  rr(ctx, x - 26, y - 86, 52, 86, 6);
  ctx.fillStyle = '#5A4030';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  rr(ctx, x - 20, y - 78, 40, 78, 4);
  const g = ctx.createLinearGradient(0, y - 78, 0, y);
  g.addColorStop(0, '#FF7A3C');
  g.addColorStop(1, C.orangeDark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y - 52);
  drawVEmblem(ctx, 20);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x + 12, y - 36, 3, 0, Math.PI * 2);
  ctx.fillStyle = C.gold;
  ctx.fill();
  // light above
  const pulse = 0.6 + 0.4 * Math.sin(time * 3);
  const lg = ctx.createRadialGradient(x, y - 94, 2, x, y - 94, 44);
  lg.addColorStop(0, `rgba(255,170,60,${0.7 * pulse})`);
  lg.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(x - 44, y - 138, 88, 88);
  ctx.fillStyle = '#FFE0B0';
  ctx.fillRect(x - 8, y - 96, 16, 5);
  if (d.glow > 0.05) {
    ctx.save();
    ctx.globalAlpha = d.glow;
    rr(ctx, x - 16, y - 132 - Math.sin(time * 6) * 3, 32, 28, 8);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.fillStyle = C.orange;
    ctx.font = '900 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↑', x, y - 112 - Math.sin(time * 6) * 3);
    ctx.restore();
  }
}

export function drawCheckpoint(ctx: Ctx, c: Checkpoint, x: number, y: number, time: number) {
  ctx.fillStyle = '#2A2A2E';
  ctx.fillRect(x - 3, y - 150, 6, 150);
  ctx.beginPath();
  ctx.arc(x, y - 152, 6, 0, Math.PI * 2);
  ctx.fillStyle = C.gold;
  ctx.fill();
  ctx.fillStyle = '#4A4A50';
  ctx.fillRect(x - 12, y - 8, 24, 8);
  const fy = y - 140 + (1 - c.raise) * 100;
  const wv = Math.sin(time * 4) * 3;
  ctx.beginPath();
  ctx.moveTo(x + 3, fy);
  ctx.lineTo(x + 52, fy + 13 + wv * 0.4);
  ctx.lineTo(x + 3, fy + 28);
  ctx.closePath();
  ctx.fillStyle = c.active ? C.orange : C.gray;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  if (c.active) {
    ctx.save();
    ctx.translate(x + 20, fy + 14);
    starPath(ctx, 0, 0, 6);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.restore();
  }
}

/** Finish markers: the Fieldhouse entrance arch (L1), the palm gate (L2). */
export function drawFinish(ctx: Ctx, art: string, x: number, y: number, time: number, raised: number) {
  if (art === 'arch') {
    // foreground Fieldhouse entrance: brick arch, orange canopy, glass doors, columns
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#C99467';
    ctx.fillRect(-260, -330, 520, 330);
    ctx.fillStyle = '#B57F52';
    ctx.fillRect(-270, -340, 540, 18);
    ctx.font = '900 30px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.cream;
    ctx.strokeStyle = '#5A3B26';
    ctx.lineWidth = 5;
    ctx.strokeText('UTRGV FIELDHOUSE', 0, -290);
    ctx.fillText('UTRGV FIELDHOUSE', 0, -290);
    ctx.beginPath();
    ctx.ellipse(0, 0, 150, 240, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#D9A06E';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#7A4A2A';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 122, 212, 0, Math.PI, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -212, 0, 0);
    g.addColorStop(0, '#FFCB8A');
    g.addColorStop(1, '#FF8E3C');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#2B2A2E';
    ctx.lineWidth = 4;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 32, -190 + Math.abs(i) * 18);
      ctx.lineTo(i * 32, 0);
      ctx.stroke();
    }
    for (const cx of [-220, -170, 170, 220]) {
      ctx.fillStyle = '#1E1D21';
      ctx.fillRect(cx - 7, -170, 14, 170);
    }
    rr(ctx, -240, -150, 480, 14, 4);
    ctx.save();
    ctx.shadowColor = 'rgba(255,110,30,1)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = C.orange;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  } else if (art === 'gate') {
    ctx.save();
    ctx.translate(x, y);
    for (const sx of [-70, 70]) {
      ctx.fillStyle = '#B98455';
      ctx.fillRect(sx - 18, -150, 36, 150);
      ctx.fillStyle = '#9A6844';
      ctx.fillRect(sx - 22, -160, 44, 14);
      ctx.save();
      ctx.translate(sx, -186);
      drawLantern(ctx, 26, 1.3, time);
      ctx.restore();
    }
    rr(ctx, -80, -150, 160, 34, 6);
    ctx.fillStyle = C.orange;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.font = '900 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FIELDHOUSE →', 0, -127);
    ctx.restore();
  }
  // campus pennant pole (all finishes)
  ctx.fillStyle = '#2A2A2E';
  ctx.fillRect(x - 3, y - 230, 6, 230);
  ctx.beginPath();
  ctx.arc(x, y - 232, 7, 0, Math.PI * 2);
  ctx.fillStyle = C.gold;
  ctx.fill();
  const fy = y - 214 + (1 - raised) * 170;
  const wv = Math.sin(time * 4) * 4;
  ctx.beginPath();
  ctx.moveTo(x + 3, fy);
  ctx.lineTo(x + 78, fy + 18 + wv * 0.4);
  ctx.lineTo(x + 3, fy + 38);
  ctx.closePath();
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.cream;
  ctx.font = '900 12px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('UTRGV', x + 10, fy + 23);
}

export function drawTrophy(ctx: Ctx, x: number, y: number, time: number) {
  const pulse = 1 + Math.sin(time * 4) * 0.04;
  const g = ctx.createRadialGradient(x, y, 10, x, y, 140);
  g.addColorStop(0, 'rgba(255,166,26,0.55)');
  g.addColorStop(1, 'rgba(255,166,26,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 140, y - 140, 280, 280);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  drawVEmblem(ctx, 120);
  ctx.restore();
}

export function drawPlatform(ctx: Ctx, p: MovingPlatform, x: number, y: number) {
  rr(ctx, x, y, p.w, 16, 4);
  ctx.fillStyle = '#4A4A50';
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.orange;
  ctx.fillRect(x + 2, y + 1, p.w - 4, 4);
  ctx.fillStyle = 'rgba(255,248,236,0.9)';
  ctx.fillRect(x + 4, y, p.w - 8, 1.5);
  ctx.fillStyle = C.gold;
  for (let i = 12; i < p.w - 6; i += 24) {
    ctx.beginPath();
    ctx.arc(x + i, y + 10, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawSpikes(ctx: Ctx, s: Spikes, x: number, y: number) {
  const n = s.n;
  // base plate is always visible so the hazard is readable without sound
  rr(ctx, x + 2, y - 6, n * TILE - 4, 6, 2);
  ctx.fillStyle = s.warn ? C.orange : '#2E6A2A';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  const h = 26 * s.ext;
  if (h <= 0.5) return;
  const jitter = s.warn ? Math.sin(performance.now() / 20) * 1.2 : 0;
  ctx.fillStyle = C.green;
  ctx.strokeStyle = C.ink;
  for (let i = 0; i < n * 4; i++) {
    const sx = x + 6 + i * (TILE / 4) + jitter;
    ctx.beginPath();
    ctx.moveTo(sx - 5, y - 4);
    ctx.lineTo(sx, y - 4 - h);
    ctx.lineTo(sx + 5, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, y - 4 - h);
    ctx.lineTo(sx, y - 4 - h + 4);
    ctx.strokeStyle = C.cream;
    ctx.stroke();
    ctx.strokeStyle = C.ink;
  }
}

export function drawBouncer(ctx: Ctx, b: Bouncer, x: number, y: number) {
  // shadow on the floor
  const k = Math.max(0.3, 1 - (b.floor - b.r - y) / 200);
  ctx.beginPath();
  ctx.ellipse(x, b.floor - 3, b.r * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.save();
  ctx.translate(x, y + b.r);
  ctx.scale(1 + b.squish * 0.18, 1 - b.squish * 0.18);
  drawBasketball(ctx, 0, -b.r, b.r, y * 0.01);
  ctx.restore();
}

export function drawProjectile(ctx: Ctx, p: Projectile, x: number, y: number, time: number) {
  if (p.kind === 'wave') {
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createLinearGradient(0, -28, 0, 0);
    g.addColorStop(0, 'rgba(255,94,23,0)');
    g.addColorStop(1, 'rgba(255,94,23,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-p.r, 0);
    ctx.quadraticCurveTo(0, -36 - Math.sin(time * 30) * 4, p.r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.arc(x, y, p.r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, p.r);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(1, '#FFC9A8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.orangeDark;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, p.r * 0.45, time * 8, time * 8 + 2);
  ctx.strokeStyle = C.orange;
  ctx.stroke();
}
