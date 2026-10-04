import { C, drawPalmPot, makeCanvas, rr } from './art';


export const FH_W = 1500;
export const FH_H = 600;
/** Pavement line in the Fieldhouse canvas. */
export const FH_GROUND = 452;

/**
 * Layered illustration of the UTRGV Fieldhouse exterior: long tan-brick facade, repeating
 * dark arched windows, UTRGV FIELDHOUSE lettering, illuminated orange canopy, tall dark
 * columns, glass entrance inside a curved brick arch, steps with railings, trees and
 * landscaping, and a reflective pavement.
 */
export function renderFieldhouse(mode: 'sunset' | 'night', scale: number): HTMLCanvasElement {
  const cv = makeCanvas(FH_W * scale, FH_H * scale);
  const ctx = cv.getContext('2d')!;
  ctx.scale(scale, scale);
  const night = mode === 'night';
  const G = FH_GROUND;
  const top = 92;

  // --- Facade body -----------------------------------------------------------------
  const brick = ctx.createLinearGradient(0, top, 0, G);
  if (night) {
    brick.addColorStop(0, '#6E5442');
    brick.addColorStop(0.55, '#9A7356');
    brick.addColorStop(1, '#C99467');
  } else {
    brick.addColorStop(0, '#E2B07E');
    brick.addColorStop(1, '#C88E5D');
  }
  ctx.fillStyle = brick;
  ctx.fillRect(40, top, FH_W - 80, G - top);
  // brick coursing
  ctx.strokeStyle = night ? 'rgba(40,25,15,0.25)' : 'rgba(110,60,30,0.18)';
  ctx.lineWidth = 1;
  for (let y = top + 30; y < G; y += 7) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(FH_W - 40, y);
    ctx.stroke();
  }
  // parapet / cornice
  ctx.fillStyle = night ? '#4C3A2E' : '#B57F52';
  ctx.fillRect(30, top - 10, FH_W - 60, 24);
  ctx.fillStyle = night ? '#7B6150' : '#EAC199';
  ctx.fillRect(30, top - 10, FH_W - 60, 5);
  ctx.fillStyle = night ? '#3E3026' : '#A06F45';
  ctx.fillRect(40, top + 14, FH_W - 80, 6);

  // --- Repeating arched windows ----------------------------------------------------
  const winTop = 130;
  for (let x = 80; x < FH_W - 100; x += 64) {
    const w = 40;
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x, winTop + r + 48);
    ctx.lineTo(x, winTop + r);
    ctx.arc(x + r, winTop + r, r, Math.PI, 0);
    ctx.lineTo(x + w, winTop + r + 48);
    ctx.closePath();
    const wg = ctx.createLinearGradient(0, winTop, 0, winTop + r + 48);
    if (night) {
      wg.addColorStop(0, '#2A2224');
      wg.addColorStop(1, '#4A3226');
    } else {
      wg.addColorStop(0, '#2E2A2C');
      wg.addColorStop(1, '#5A4438');
    }
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = night ? '#3A2C22' : '#8E6040';
    ctx.stroke();
    // brick voussoir ring
    ctx.beginPath();
    ctx.arc(x + r, winTop + r, r + 4, Math.PI, 0);
    ctx.strokeStyle = night ? '#856650' : '#D9A57A';
    ctx.lineWidth = 3;
    ctx.stroke();
    // mullion + warm reflection
    ctx.beginPath();
    ctx.moveTo(x + r, winTop + 4);
    ctx.lineTo(x + r, winTop + r + 48);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = night ? 'rgba(255,150,60,0.16)' : 'rgba(255,220,180,0.18)';
    ctx.fillRect(x + 4, winTop + r + 10, 10, 30);
    // sill
    ctx.fillStyle = night ? '#5E4636' : '#E8BE92';
    ctx.fillRect(x - 3, winTop + r + 48, w + 6, 4);
  }

  // --- Lettering ---------------------------------------------------------------------
  ctx.save();
  ctx.font = '900 52px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ly = 240;
  if (night) {
    ctx.shadowColor = 'rgba(255,140,60,0.9)';
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = night ? '#FFF1DE' : '#FFF8EC';
  ctx.lineWidth = 6;
  ctx.strokeStyle = night ? '#2A1E18' : '#5A3B26';
  ctx.strokeText('UTRGV  FIELDHOUSE', FH_W / 2, ly);
  ctx.fillText('UTRGV  FIELDHOUSE', FH_W / 2, ly);
  ctx.restore();

  // --- Lower colonnade -----------------------------------------------------------------
  const colTop = 290;
  for (let x = 92; x < FH_W - 80; x += 116) {
    if (x > 560 && x < 940) continue;
    // recessed bay
    ctx.fillStyle = night ? 'rgba(30,20,15,0.55)' : 'rgba(90,55,30,0.28)';
    ctx.fillRect(x + 16, colTop + 30, 84, G - colTop - 30);
    ctx.fillStyle = night ? 'rgba(255,170,90,0.22)' : 'rgba(255,230,200,0.2)';
    ctx.fillRect(x + 26, colTop + 52, 64, 36);
    // column
    const cg = ctx.createLinearGradient(x, 0, x + 18, 0);
    cg.addColorStop(0, '#1B1A1C');
    cg.addColorStop(0.5, '#3A383C');
    cg.addColorStop(1, '#17161A');
    ctx.fillStyle = cg;
    ctx.fillRect(x, colTop, 16, G - colTop);
    ctx.fillStyle = '#2A2A2E';
    ctx.fillRect(x - 3, colTop - 6, 22, 7);
  }

  // --- Curved brick entrance arch ---------------------------------------------------------
  const ax = FH_W / 2;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ax, G, 172, 178, 0, Math.PI, 0);
  ctx.closePath();
  const ag = ctx.createLinearGradient(0, G - 180, 0, G);
  ag.addColorStop(0, night ? '#8E6A50' : '#D9A06E');
  ag.addColorStop(1, night ? '#C08A5E' : '#C4875A');
  ctx.fillStyle = ag;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = night ? '#3E2C20' : '#8A5A36';
  ctx.stroke();
  // voussoirs
  ctx.strokeStyle = night ? 'rgba(50,30,20,0.55)' : 'rgba(120,70,40,0.5)';
  ctx.lineWidth = 2;
  for (let a = Math.PI + 0.08; a < Math.PI * 2 - 0.05; a += 0.13) {
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(a) * 140, G + Math.sin(a) * 146);
    ctx.lineTo(ax + Math.cos(a) * 172, G + Math.sin(a) * 178);
    ctx.stroke();
  }
  // opening
  ctx.beginPath();
  ctx.ellipse(ax, G, 140, 146, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = night ? '#2A1B14' : '#4A2E1E';
  ctx.fill();
  ctx.restore();

  // glass entrance inside the arch
  const gx0 = ax - 112;
  const gx1 = ax + 112;
  const gy0 = 352;
  const glass = ctx.createLinearGradient(0, gy0, 0, G);
  glass.addColorStop(0, night ? '#FFC07A' : '#F6D2A6');
  glass.addColorStop(1, night ? '#FF8E3C' : '#E9A672');
  ctx.fillStyle = glass;
  ctx.fillRect(gx0, gy0, gx1 - gx0, G - gy0);
  ctx.strokeStyle = '#2B2A2E';
  ctx.lineWidth = 4;
  for (let x = gx0; x <= gx1 + 1; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, gy0);
    ctx.lineTo(x, G);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(gx0, gy0 + 34);
  ctx.lineTo(gx1, gy0 + 34);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(gx0 + 8, gy0 + 4, 8, G - gy0 - 8);
  // silhouettes of fans inside
  ctx.fillStyle = 'rgba(60,30,15,0.35)';
  for (let i = 0; i < 6; i++) {
    const x = gx0 + 22 + i * 36;
    ctx.beginPath();
    ctx.arc(x, G - 40, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 8, G - 33, 16, 33);
  }

  // --- Illuminated orange canopy + tall dark columns ------------------------------------------
  const cy = 320;
  if (night) {
    const glow = ctx.createRadialGradient(ax, cy + 20, 20, ax, cy + 20, 420);
    glow.addColorStop(0, 'rgba(255,120,40,0.55)');
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(ax - 440, cy - 200, 880, 400);
  }
  // underside light spill
  const spill = ctx.createLinearGradient(0, cy + 14, 0, G);
  spill.addColorStop(0, night ? 'rgba(255,170,80,0.55)' : 'rgba(255,190,120,0.3)');
  spill.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.moveTo(ax - 300, cy + 14);
  ctx.lineTo(ax + 300, cy + 14);
  ctx.lineTo(ax + 360, G);
  ctx.lineTo(ax - 360, G);
  ctx.closePath();
  ctx.fill();
  for (const x of [ax - 290, ax - 196, ax + 180, ax + 274]) {
    const cg = ctx.createLinearGradient(x, 0, x + 16, 0);
    cg.addColorStop(0, '#141316');
    cg.addColorStop(0.5, '#38363B');
    cg.addColorStop(1, '#121114');
    ctx.fillStyle = cg;
    ctx.fillRect(x, cy - 70, 16, G - cy + 70);
    ctx.fillStyle = '#222125';
    ctx.fillRect(x - 3, cy - 74, 22, 6);
  }
  rr(ctx, ax - 318, cy, 636, 16, 4);
  const cng = ctx.createLinearGradient(0, cy, 0, cy + 16);
  cng.addColorStop(0, '#FFB070');
  cng.addColorStop(0.5, C.orange);
  cng.addColorStop(1, '#D9480E');
  ctx.fillStyle = cng;
  if (night) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,110,30,1)';
    ctx.shadowBlur = 26;
    ctx.fill();
    ctx.restore();
  } else ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3A1A08';
  ctx.stroke();
  ctx.fillStyle = '#FFE2C4';
  ctx.fillRect(ax - 300, cy + 13, 600, 2);

  // --- Steps and railings ----------------------------------------------------------------
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 ? (night ? '#8E8478' : '#D8CDBE') : night ? '#A49888' : '#E7DCCD';
    ctx.fillRect(ax - 180 - i * 18, G + i * 9, 360 + i * 36, 9);
  }
  ctx.strokeStyle = '#2B2A2E';
  ctx.lineWidth = 3;
  for (const sx of [-1, 1]) {
    const x = ax + sx * 130;
    ctx.beginPath();
    ctx.moveTo(x, G - 30);
    ctx.lineTo(x + sx * 46, G - 6);
    ctx.moveTo(x, G - 30);
    ctx.lineTo(x, G + 22);
    ctx.moveTo(x + sx * 46, G - 6);
    ctx.lineTo(x + sx * 46, G + 26);
    ctx.stroke();
  }

  // --- Landscaping, trees and palms ---------------------------------------------------------
  const hedgeY = G - 22;
  for (let x = 50; x < FH_W - 50; x += 26) {
    if (x > ax - 200 && x < ax + 200) continue;
    ctx.beginPath();
    ctx.ellipse(x, hedgeY + 12, 20, 16, 0, Math.PI, 0);
    ctx.fillStyle = night ? '#0E5A1E' : '#1C9A34';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 4, hedgeY + 6, 9, 6, 0, Math.PI, 0);
    ctx.fillStyle = night ? 'rgba(80,200,90,0.3)' : 'rgba(140,240,140,0.35)';
    ctx.fill();
  }
  ctx.fillStyle = night ? '#0A3E16' : '#178A2C';
  ctx.fillRect(40, G - 10, FH_W - 80, 10);
  const tree = (x: number, s: number) => {
    ctx.fillStyle = '#3A2414';
    ctx.fillRect(x - 5 * s, G - 70 * s, 10 * s, 70 * s);
    for (const [dx, dy, r] of [
      [0, -110, 46],
      [-34, -86, 34],
      [34, -86, 34],
      [-14, -140, 30],
      [18, -132, 28],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, G + dy * s, r * s, 0, Math.PI * 2);
      ctx.fillStyle = night ? '#0B4A1A' : '#22A83C';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x - 12 * s, G - 124 * s, 18 * s, 0, Math.PI * 2);
    ctx.fillStyle = night ? 'rgba(90,200,100,0.22)' : 'rgba(160,240,150,0.4)';
    ctx.fill();
  };
  tree(110, 1.05);
  tree(1390, 1.1);
  tree(380, 0.8);
  tree(1130, 0.82);
  for (const x of [ax - 230, ax + 230]) {
    ctx.save();
    ctx.translate(x, G - 20);
    drawPalmPot(ctx, 54);
    ctx.restore();
  }
  // warm uplights at night
  if (night) {
    for (let x = 140; x < FH_W - 100; x += 232) {
      const ug = ctx.createRadialGradient(x, G, 4, x, G - 60, 140);
      ug.addColorStop(0, 'rgba(255,190,110,0.32)');
      ug.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = ug;
      ctx.fillRect(x - 140, G - 200, 280, 200);
    }
  }

  // --- Reflective pavement ------------------------------------------------------------------
  const pav = ctx.createLinearGradient(0, G, 0, FH_H);
  pav.addColorStop(0, night ? '#2A2426' : '#B99A82');
  pav.addColorStop(1, night ? '#141114' : '#8E705C');
  ctx.fillStyle = pav;
  ctx.fillRect(0, G + 26, FH_W, FH_H - G - 26);
  ctx.save();
  ctx.globalAlpha = night ? 0.28 : 0.18;
  ctx.translate(0, (G + 26) * 2);
  ctx.scale(1, -1);
  ctx.drawImage(cv, 0, 150 * scale, FH_W * scale, (G + 26 - 150) * scale, 0, 150, FH_W, G + 26 - 150);
  ctx.restore();
  // wet streaks
  ctx.fillStyle = night ? 'rgba(255,140,60,0.12)' : 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 18; i++) ctx.fillRect(60 + i * 80, G + 40 + (i % 4) * 22, 40, 2);
  return cv;
}
