import { drawSprite } from './sprites';

// Sprites from the supplied icon sheet are used when loaded; these vector redraws are the fallback.
// Vector redraws of the approved UTRGV icon-sheet objects (upper portion only).
// Every function draws centred on (0, 0) at a nominal size `s` (≈ the icon's width in px).
// No blue panels/frames from the sheet's lower portion are reproduced anywhere.

export const C = {
  orange: '#FF5E17',
  orangeLight: '#FF8A4C',
  orangeDark: '#C9430C',
  green: '#00C21D',
  greenLight: '#5BE36F',
  greenDark: '#008A14',
  gray: '#646469',
  grayLight: '#9A9AA0',
  grayDark: '#3E3E42',
  cream: '#FFF8EC',
  gold: '#FFA61A',
  ink: '#22201F',
  wood: '#B27740',
  woodLight: '#D49A5E',
  woodDark: '#7A4A22',
  brick: '#D7A574',
  brickDark: '#B98455',
};

type Ctx = CanvasRenderingContext2D;

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function starPath(ctx: Ctx, cx: number, cy: number, r: number, inner = 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * inner;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
export function drawBasketball(ctx: Ctx, x: number, y: number, r: number, rot = 0) {
  if (r > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const ok = drawSprite(ctx, 'ball', r * 2.1, r * 2.1);
    ctx.restore();
    if (ok) return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#FF9A5C');
  g.addColorStop(0.55, C.orange);
  g.addColorStop(1, '#C23E08');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-r * 1.05, 0, r * 0.62, r * 1.05, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(r * 1.05, 0, r * 0.62, r * 1.05, 0, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.restore();
}

/** Two-finger "V" hand sign. variant 1: orange hand, gray cuff. variant 2: gray hand, orange fingertips. */
export function drawVHand(ctx: Ctx, s: number, variant: 1 | 2 = 1) {
  if (drawSprite(ctx, variant === 1 ? 'hand' : 'hand2', s * 1.15, s * 1.15)) return;
  const u = s / 40;
  const body = variant === 1 ? C.orange : '#B8B8BE';
  const shade = variant === 1 ? C.orangeDark : '#86868C';
  ctx.save();
  ctx.scale(u, u);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const finger = (rot: number, len: number, ox: number) => {
    ctx.save();
    ctx.translate(ox, -2);
    ctx.rotate(rot);
    rr(ctx, -4.6, -len, 9.2, len + 4, 4.6);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    if (variant === 2) {
      ctx.save();
      rr(ctx, -4.6, -len, 9.2, len + 4, 4.6);
      ctx.clip();
      ctx.fillStyle = C.orange;
      ctx.fillRect(-6, -len - 1, 12, 8);
      ctx.restore();
      rr(ctx, -4.6, -len, 9.2, len + 4, 4.6);
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-1.5, -len * 0.45);
    ctx.lineTo(1.5, -len * 0.45);
    ctx.strokeStyle = shade;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  };
  finger(-0.32, 20, -3.5);
  finger(0.3, 21, 4);
  // palm with folded fingers
  rr(ctx, -10, -4, 20, 16, 6);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // folded ring/pinky knuckles
  ctx.beginPath();
  ctx.arc(5, 0, 4, Math.PI, 0);
  ctx.arc(-3, 0, 4, Math.PI, 0);
  ctx.strokeStyle = shade;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // thumb across
  rr(ctx, -12, 2, 15, 7, 3.5);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // cuff
  rr(ctx, -9.5, 11, 19, 8, 2);
  ctx.fillStyle = variant === 1 ? C.gray : C.grayDark;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-7, 12.5, 14, 2);
  ctx.restore();
}

export function drawPalmPot(ctx: Ctx, s: number, sway = 0) {
  ctx.save();
  ctx.rotate(sway * 0.01);
  const ok = drawSprite(ctx, 'palmpot', s * 1.5, s * 1.45, 0, s * 0.48 - s * 0.725);
  ctx.restore();
  if (ok) return;
  const u = s / 40;
  ctx.save();
  ctx.scale(u, u);
  // trunk
  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.quadraticCurveTo(-1 + sway, -10, 1 + sway * 2, -22);
  ctx.lineTo(4 + sway * 2, -22);
  ctx.quadraticCurveTo(3 + sway, -10, 3, 4);
  ctx.closePath();
  ctx.fillStyle = C.woodDark;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-1.5 + sway * (i / 5), -i * 5 + 2);
    ctx.lineTo(3 + sway * (i / 5), -i * 5);
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // fronds
  const tipX = 2.5 + sway * 2;
  const tipY = -23;
  const leaf = (ang: number, len: number) => {
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -6, len, 3);
    ctx.quadraticCurveTo(len * 0.5, 2, 0, 0);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, -0.5);
    ctx.quadraticCurveTo(len * 0.5, -3.5, len - 2, 2);
    ctx.strokeStyle = C.greenLight;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };
  for (const [a, l] of [
    [-2.9, 15],
    [-2.3, 17],
    [-1.6, 13],
    [-0.9, 16],
    [-0.25, 15],
    [0.35, 13],
  ] as const)
    leaf(a + sway * 0.03, l);
  // pot
  ctx.beginPath();
  ctx.moveTo(-11, 2);
  ctx.lineTo(11, 2);
  ctx.lineTo(8, 19);
  ctx.lineTo(-8, 19);
  ctx.closePath();
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  rr(ctx, -13, -1, 26, 6, 2);
  ctx.fillStyle = C.orangeLight;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(3, 6, 4, 12);
  ctx.restore();
}

/** Wooden crate with metal corner brackets and orange V marks; optional small star. */
export function drawCrate(ctx: Ctx, s: number, opts: { star?: boolean; empty?: boolean; glow?: number } = {}) {
  if (drawSprite(ctx, 'crate', s * 1.08, s * 1.08, 0, 0, opts.empty ? 'spent' : undefined)) return;
  const h = s / 2;
  const empty = !!opts.empty;
  ctx.save();
  const g = ctx.createLinearGradient(0, -h, 0, h);
  g.addColorStop(0, empty ? '#8C6A4C' : C.woodLight);
  g.addColorStop(1, empty ? '#6B4E36' : C.wood);
  rr(ctx, -h + 1, -h + 1, s - 2, s - 2, s * 0.06);
  ctx.fillStyle = g;
  ctx.fill();
  // planks
  ctx.strokeStyle = empty ? 'rgba(40,25,10,0.45)' : 'rgba(90,50,20,0.55)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-h + 3, -h + (s * i) / 3);
    ctx.lineTo(h - 3, -h + (s * i) / 3);
    ctx.stroke();
  }
  // inner frame
  ctx.strokeStyle = empty ? '#5A4030' : C.woodDark;
  ctx.lineWidth = s * 0.06;
  ctx.strokeRect(-h + s * 0.12, -h + s * 0.12, s * 0.76, s * 0.76);
  // V mark
  if (!empty) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.2);
    ctx.lineTo(-s * 0.08, -s * 0.2);
    ctx.lineTo(0, s * 0.04);
    ctx.lineTo(s * 0.08, -s * 0.2);
    ctx.lineTo(s * 0.22, -s * 0.2);
    ctx.lineTo(s * 0.06, s * 0.22);
    ctx.lineTo(-s * 0.06, s * 0.22);
    ctx.closePath();
    ctx.fillStyle = C.orange;
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    if (opts.star) {
      starPath(ctx, s * 0.27, s * 0.22, s * 0.09);
      ctx.fillStyle = C.green;
      ctx.fill();
      ctx.lineWidth = Math.max(0.8, s * 0.02);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(30,20,10,0.35)';
    ctx.fillRect(-s * 0.15, -s * 0.06, s * 0.3, s * 0.12);
  }
  // corner brackets
  const b = s * 0.2;
  ctx.fillStyle = empty ? '#55555A' : '#8D8D93';
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    ctx.save();
    ctx.translate(sx * (h - 1), sy * (h - 1));
    ctx.scale(-sx, -sy);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(b, 0);
    ctx.lineTo(b, s * 0.07);
    ctx.lineTo(s * 0.07, s * 0.07);
    ctx.lineTo(s * 0.07, b);
    ctx.lineTo(0, b);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.035, s * 0.035, s * 0.018, 0, Math.PI * 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.fillStyle = empty ? '#55555A' : '#8D8D93';
    ctx.restore();
  }
  rr(ctx, -h + 1, -h + 1, s - 2, s - 2, s * 0.06);
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  if (!empty) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-h + 4, -h + 4, s - 8, s * 0.05);
  }
  ctx.restore();
}

export function drawLantern(ctx: Ctx, s: number, glow = 1, t = 0) {
  if (glow > 0) {
    const r = s * (0.95 + Math.sin(t * 4) * 0.06);
    const g0 = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
    g0.addColorStop(0, `rgba(255,166,26,${0.5 * Math.min(1, glow)})`);
    g0.addColorStop(1, 'rgba(255,166,26,0)');
    ctx.fillStyle = g0;
    ctx.fillRect(-r, -r, r * 2, r * 2);
  }
  if (drawSprite(ctx, 'lantern', s * 1.3, s * 1.3, 0, -s * 0.08)) return;
  const u = s / 30;
  ctx.save();
  ctx.scale(u, u);
  if (glow > 0) {
    const r = 26 + Math.sin(t * 4) * 2;
    const g = ctx.createRadialGradient(0, 2, 2, 0, 2, r);
    g.addColorStop(0, `rgba(255,166,26,${0.55 * glow})`);
    g.addColorStop(1, 'rgba(255,166,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, 2 - r, r * 2, r * 2);
  }
  // handle
  ctx.beginPath();
  ctx.arc(0, -17, 5, Math.PI, 0);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // cap
  ctx.beginPath();
  ctx.moveTo(-10, -9);
  ctx.lineTo(0, -16);
  ctx.lineTo(10, -9);
  ctx.closePath();
  ctx.fillStyle = C.grayDark;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  // glass body
  rr(ctx, -9, -9, 18, 20, 3);
  const gg = ctx.createRadialGradient(0, 1, 1, 0, 1, 11);
  gg.addColorStop(0, '#FFF2C4');
  gg.addColorStop(0.45, C.gold);
  gg.addColorStop(1, C.orange);
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.stroke();
  // frame bars
  ctx.beginPath();
  ctx.moveTo(-3, -9);
  ctx.lineTo(-3, 11);
  ctx.moveTo(3, -9);
  ctx.lineTo(3, 11);
  ctx.strokeStyle = C.grayDark;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // base
  rr(ctx, -11, 11, 22, 5, 2);
  ctx.fillStyle = C.gray;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

export function drawStool(ctx: Ctx, s: number) {
  if (drawSprite(ctx, 'stool', s * 1.0, s * 1.0, 0, s * 0.13)) return;
  const u = s / 40;
  ctx.save();
  ctx.scale(u, u);
  ctx.lineJoin = 'round';
  // legs
  ctx.fillStyle = C.wood;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  for (const x of [-13, 9]) {
    ctx.beginPath();
    ctx.moveTo(x, -4);
    ctx.lineTo(x + 4, -4);
    ctx.lineTo(x + 4 + (x < 0 ? -3 : 3), 18);
    ctx.lineTo(x + (x < 0 ? -3 : 3), 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  rr(ctx, -12, 6, 24, 3.5, 1.5);
  ctx.fillStyle = C.woodDark;
  ctx.fill();
  ctx.stroke();
  // seat
  rr(ctx, -17, -8, 34, 6, 2);
  ctx.fillStyle = C.woodLight;
  ctx.fill();
  ctx.stroke();
  // cushion
  ctx.beginPath();
  ctx.ellipse(0, -10, 15, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-3, -11.5, 7, 1.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();
  ctx.restore();
}

/** Black cowboy hat with orange band; `star` adds the green star on the band. */
export function drawHat(ctx: Ctx, s: number, star = true) {
  if (drawSprite(ctx, star ? 'hat' : 'hatPlain', s * 1.05, s * 0.85, 0, -s * 0.03)) return;
  const u = s / 42;
  ctx.save();
  ctx.scale(u, u);
  ctx.lineJoin = 'round';
  // brim
  ctx.beginPath();
  ctx.moveTo(-21, 3);
  ctx.quadraticCurveTo(-18, 9, 0, 9);
  ctx.quadraticCurveTo(18, 9, 21, 3);
  ctx.quadraticCurveTo(17, 1, 11, 4);
  ctx.lineTo(-11, 4);
  ctx.quadraticCurveTo(-17, 1, -21, 3);
  ctx.closePath();
  ctx.fillStyle = '#1E1D1D';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // crown
  ctx.beginPath();
  ctx.moveTo(-11, 5);
  ctx.quadraticCurveTo(-12, -9, -7, -12);
  ctx.quadraticCurveTo(0, -9, 7, -12);
  ctx.quadraticCurveTo(12, -9, 11, 5);
  ctx.closePath();
  ctx.fillStyle = '#2A2928';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -9);
  ctx.quadraticCurveTo(-6, -2, -5, 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // band
  ctx.beginPath();
  ctx.moveTo(-11.3, 0);
  ctx.lineTo(11.3, 0);
  ctx.lineTo(11.1, 4.6);
  ctx.lineTo(-11.1, 4.6);
  ctx.closePath();
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  if (star) {
    starPath(ctx, 0, 2.3, 4.4);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStar(ctx: Ctx, r: number, color = C.green, light = C.greenLight) {
  if (color === C.green && drawSprite(ctx, 'star', r * 2.2, r * 2.2)) return;
  starPath(ctx, 0, 0, r, 0.48);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1.4, r * 0.13);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  starPath(ctx, -r * 0.06, -r * 0.1, r * 0.5, 0.48);
  ctx.fillStyle = light;
  ctx.globalAlpha *= 0.55;
  ctx.fill();
  ctx.globalAlpha /= 0.55;
}

/** Orange V emblem with a dark star and dark outline. */
export function drawVEmblem(ctx: Ctx, s: number, ghost = false) {
  if (drawSprite(ctx, 'emblem', s, s, 0, 0, ghost ? 'ghost' : undefined)) {
    return;
  }
  const u = s / 40;
  ctx.save();
  ctx.scale(u, u);
  ctx.beginPath();
  ctx.moveTo(-19, -15);
  ctx.lineTo(-7, -15);
  ctx.lineTo(0, 4);
  ctx.lineTo(7, -15);
  ctx.lineTo(19, -15);
  ctx.lineTo(5, 18);
  ctx.lineTo(-5, 18);
  ctx.closePath();
  if (ghost) {
    ctx.fillStyle = 'rgba(34,32,31,0.08)';
    ctx.fill();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = 'rgba(34,32,31,0.55)';
    ctx.stroke();
    ctx.restore();
    return;
  }
  const g = ctx.createLinearGradient(0, -15, 0, 18);
  g.addColorStop(0, C.orangeLight);
  g.addColorStop(1, C.orangeDark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  starPath(ctx, 0, -6, 6.5);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-16, -13);
  ctx.lineTo(-9, -13);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawBook(ctx: Ctx, s: number) {
  if (drawSprite(ctx, 'book', s * 1.05, s * 1.05)) return;
  const u = s / 40;
  ctx.save();
  ctx.scale(u, u);
  ctx.lineJoin = 'round';
  // cover
  ctx.beginPath();
  ctx.moveTo(-20, -9);
  ctx.quadraticCurveTo(-10, -13, 0, -9);
  ctx.quadraticCurveTo(10, -13, 20, -9);
  ctx.lineTo(20, 13);
  ctx.quadraticCurveTo(10, 9, 0, 13);
  ctx.quadraticCurveTo(-10, 9, -20, 13);
  ctx.closePath();
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // pages
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.quadraticCurveTo(sx * 9, -11, sx * 17, -8);
    ctx.lineTo(sx * 17, 9);
    ctx.quadraticCurveTo(sx * 9, 6, 0, 10);
    ctx.closePath();
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(34,32,31,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(4, -3 + i * 4);
    ctx.lineTo(14, -4 + i * 4);
    ctx.stroke();
  }
  starPath(ctx, -8.5, 0, 5);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();
}

export function drawLasso(ctx: Ctx, s: number) {
  if (drawSprite(ctx, 'lasso', s * 1.05, s * 1.05)) return;
  const u = s / 40;
  ctx.save();
  ctx.scale(u, u);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(-1 + i * 1.2, 0 + i * 0.6, 15 - i * 3, 11 - i * 2, -0.2, 0, Math.PI * 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = i % 2 ? '#A06A3A' : '#8A5A2E';
    ctx.lineWidth = 3.6;
    ctx.stroke();
  }
  // twist marks
  ctx.strokeStyle = 'rgba(255,220,170,0.5)';
  ctx.lineWidth = 1;
  for (let a = 0; a < Math.PI * 2; a += 0.5) {
    const x = -1 + Math.cos(a) * 15;
    const y = Math.sin(a) * 11;
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 1);
    ctx.lineTo(x + 1, y + 1);
    ctx.stroke();
  }
  // tail with orange handle
  ctx.beginPath();
  ctx.moveTo(10, 8);
  ctx.quadraticCurveTo(16, 14, 13, 18);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = '#8A5A2E';
  ctx.lineWidth = 3.6;
  ctx.stroke();
  rr(ctx, 9, 15, 9, 6, 2.5);
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
/** Offscreen canvas helper (browser only). */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Caches icon drawings at a given pixel scale. */
export class IconCache {
  private map = new Map<string, HTMLCanvasElement>();
  constructor(public scale = 1) {}
  setScale(s: number) {
    if (s === this.scale) return;
    this.scale = s;
    this.map.clear();
  }
  get(key: string, w: number, h: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
    const k = `${key}|${w}|${h}`;
    let c = this.map.get(k);
    if (!c) {
      const pad = 4;
      c = makeCanvas((w + pad * 2) * this.scale, (h + pad * 2) * this.scale);
      const ctx = c.getContext('2d')!;
      ctx.scale(this.scale, this.scale);
      ctx.translate(w / 2 + pad, h / 2 + pad);
      draw(ctx);
      this.map.set(k, c);
    }
    return c;
  }
  /** Draws a cached icon centred at (x, y) in logical units. */
  blit(ctx: Ctx, key: string, w: number, h: number, x: number, y: number, draw: (ctx: Ctx) => void) {
    const c = this.get(key, w, h, draw);
    const pad = 4;
    ctx.drawImage(c, x - w / 2 - pad, y - h / 2 - pad, w + pad * 2, h + pad * 2);
  }
}

export const ICONS: Record<string, (ctx: Ctx, s: number) => void> = {
  ball: (c, s) => drawBasketball(c, 0, 0, s / 2),
  emblem: (c, s) => drawVEmblem(c, s),
  emblemGhost: (c, s) => drawVEmblem(c, s, true),
  hand: (c, s) => drawVHand(c, s, 1),
  hand2: (c, s) => drawVHand(c, s, 2),
  hat: (c, s) => drawHat(c, s, true),
  hatPlain: (c, s) => drawHat(c, s, false),
  star: (c, s) => drawStar(c, s / 2),
  lantern: (c, s) => drawLantern(c, s * 0.75, 0),
  book: (c, s) => drawBook(c, s),
  lasso: (c, s) => drawLasso(c, s),
  palmpot: (c, s) => drawPalmPot(c, s),
  stool: (c, s) => drawStool(c, s),
  crate: (c, s) => drawCrate(c, s * 0.8, { star: true }),
};

