import type { Boss } from '../game/boss';
import type { Enemy } from '../game/entities';
import type { Player } from '../game/player';
import { C, drawHat, drawVHand, rr, starPath } from './art';

type Ctx = CanvasRenderingContext2D;

const SKIN = '#B9784E';
const SKIN_SHADE = '#94593A';

/** Draws the Vaquero adventurer with feet centred at (fx, fy). */
export function drawPlayer(ctx: Ctx, p: Player, fx: number, fy: number, time: number) {
  if (p.invulnT > 0 && !p.dead && Math.floor(p.invulnT * 18) % 2 === 0) return;
  const big = p.form === 'vaquero';
  // Growth flicker alternates between the two silhouettes.
  const showBig = p.growT > 0 ? Math.floor(p.growT * 16) % 2 === (big ? 0 : 1) : big;
  const k = showBig ? 1.42 : 1;
  const legL = 13 * k;
  const torso = 14 * k;
  const headR = showBig ? 10 : 8.6;
  const anim = p.anim;
  const run = anim === 'run';

  ctx.save();
  ctx.translate(fx, fy);
  // squash & stretch (visual only)
  let sx = 1;
  let sy = 1;
  if (anim === 'land') {
    const q = Math.max(0, p.landT / 0.12);
    sx = 1 + 0.16 * q;
    sy = 1 - 0.16 * q;
  } else if (anim === 'jump') {
    sx = 0.94;
    sy = 1.06;
  }
  ctx.scale(sx, sy);
  const face = anim === 'death' ? 1 : p.facing;
  ctx.scale(face, 1);

  // star power tint/glow
  if (p.starT > 0) {
    const flash = p.starT < 2.5 ? Math.floor(time * 12) % 2 === 0 : true;
    if (flash) {
      ctx.shadowColor = Math.floor(time * 10) % 2 ? C.green : C.orange;
      ctx.shadowBlur = 16;
    }
  }

  // pose angles
  let legA = 0;
  let legB = 0;
  let armA = 0;
  let armB = 0;
  let lean = 0;
  const phase = p.stride / (run ? 26 : 20);
  switch (anim) {
    case 'walk':
    case 'run': {
      const amp = run ? 0.95 : 0.65;
      legA = Math.sin(phase) * amp;
      legB = -legA;
      armA = -legA * 0.9;
      armB = legA * 0.9;
      lean = run ? 0.14 : 0.05;
      break;
    }
    case 'idle':
      armA = 0.08 + Math.sin(time * 2.4) * 0.04;
      armB = -0.08 - Math.sin(time * 2.4) * 0.04;
      break;
    case 'jump':
    case 'bonk':
      legA = -0.5;
      legB = 0.35;
      armA = -2.5;
      armB = 0.6;
      break;
    case 'fall':
      legA = 0.3;
      legB = -0.25;
      armA = -1.6;
      armB = 1.2;
      break;
    case 'skid':
      legA = 0.7;
      legB = 0.45;
      armA = 1.1;
      armB = 1.4;
      lean = -0.22;
      break;
    case 'land':
      legA = 0.2;
      legB = -0.2;
      armA = 0.5;
      armB = -0.5;
      break;
    case 'hurt':
    case 'death':
      legA = 0.4;
      legB = -0.4;
      armA = -2.6 + Math.sin(time * 30) * 0.3;
      armB = 2.6 - Math.sin(time * 30) * 0.3;
      break;
    case 'victory':
      armA = -2.9;
      armB = 0.3;
      legA = 0.15;
      legB = -0.15;
      break;
    case 'lasso':
      armA = -1.4;
      armB = 0.4;
      lean = 0.08;
      break;
  }
  if (anim === 'bonk') armA = -3.05;

  const hipY = -legL;
  const shoulderY = hipY - torso + 3;
  ctx.rotate(lean);

  const limb = (x: number, y: number, ang: number, len: number, w: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    rr(ctx, -w / 2, 0, w, len, w / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.restore();
  };
  const foot = (x: number, y: number, ang: number, len: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.translate(0, len);
    if (showBig) {
      // boots
      rr(ctx, -4.5, -6, 14, 8, 3);
      ctx.fillStyle = '#6A3E1E';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.fillRect(-3.5, -5, 9, 2);
    } else {
      rr(ctx, -4, -4, 12, 6, 3);
      ctx.fillStyle = C.cream;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.fillRect(-1, -3, 6, 2);
    }
    ctx.restore();
  };

  const legW = showBig ? 7.5 : 6.5;
  // back leg & arm
  limb(-2, hipY, legB, legL - 2, legW, showBig ? '#3E3E44' : C.gray);
  foot(-2, hipY, legB, legL - 2);
  limb(-3, shoulderY + 2, armB, torso * 0.8, showBig ? 6.5 : 5.5, SKIN_SHADE);

  // torso: orange jersey
  rr(ctx, -8 * (showBig ? 1.15 : 1), shoulderY - 2, 16 * (showBig ? 1.15 : 1), torso + 2, 5);
  const jg = ctx.createLinearGradient(0, shoulderY, 0, hipY);
  jg.addColorStop(0, '#FF7A3C');
  jg.addColorStop(1, C.orange);
  ctx.fillStyle = jg;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // jersey trim + emblem
  ctx.fillStyle = C.cream;
  ctx.fillRect(-7 * (showBig ? 1.15 : 1), hipY - 3, 14 * (showBig ? 1.15 : 1), 2.5);
  if (showBig) {
    // vest edges
    ctx.fillStyle = C.grayDark;
    ctx.fillRect(-9, shoulderY + 1, 3.5, torso - 4);
    ctx.fillStyle = C.green;
    starPath(ctx, 2.5, shoulderY + torso * 0.45, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = C.cream;
    ctx.font = '900 9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('V', 1, shoulderY + torso * 0.62);
  }
  // shorts
  rr(ctx, -7.5 * (showBig ? 1.12 : 1), hipY - 2, 15 * (showBig ? 1.12 : 1), 6, 2);
  ctx.fillStyle = showBig ? '#3E3E44' : C.gray;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // front leg
  limb(2, hipY, legA, legL - 2, legW, showBig ? '#45454B' : '#727278');
  foot(2, hipY, legA, legL - 2);

  // head
  const headY = shoulderY - headR + 1;
  // bandana scarf (Vaquero)
  if (showBig) {
    const flap = Math.sin(time * 14) * 2 + Math.min(10, Math.abs(p.vx) / 30);
    ctx.beginPath();
    ctx.moveTo(-4, shoulderY - 1);
    ctx.lineTo(-10 - flap, shoulderY + 2 + Math.sin(time * 9) * 2);
    ctx.lineTo(-9 - flap * 0.6, shoulderY + 7);
    ctx.closePath();
    ctx.fillStyle = C.orange;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();
    rr(ctx, -7, shoulderY - 3, 14, 5, 2);
    ctx.fillStyle = C.orange;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(1, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // hair under hat
  ctx.beginPath();
  ctx.arc(1, headY - 1, headR, Math.PI * 1.05, Math.PI * 1.65);
  ctx.lineTo(1, headY);
  ctx.fillStyle = '#2A1A12';
  ctx.fill();
  // face
  const hurt = anim === 'hurt' || anim === 'death';
  ctx.fillStyle = C.ink;
  if (hurt) {
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(headR * 0.25, headY - 3);
    ctx.lineTo(headR * 0.55, headY);
    ctx.moveTo(headR * 0.55, headY - 3);
    ctx.lineTo(headR * 0.25, headY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(headR * 0.45, headY + 4, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const blink = Math.floor(time * 0.7 + 0.2) !== Math.floor(time * 0.7 + 0.26);
    if (blink) ctx.fillRect(headR * 0.35, headY - 1.5, 3.5, 1.4);
    else {
      ctx.beginPath();
      ctx.ellipse(headR * 0.48, headY - 1.5, 1.6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(headR * 0.42, headY + 2.5, 3, 0.15, Math.PI * 0.85);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // ear
  ctx.beginPath();
  ctx.arc(-headR * 0.35, headY + 1, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = SKIN_SHADE;
  ctx.fill();
  // hat
  ctx.save();
  ctx.translate(1, headY - headR * 0.72);
  ctx.rotate(-0.06);
  drawHat(ctx, showBig ? 34 : 27, showBig);
  ctx.restore();

  // front arm (with V hand on victory)
  limb(3, shoulderY + 2, armA, torso * 0.8, showBig ? 6.5 : 5.5, SKIN);
  if (anim === 'victory') {
    ctx.save();
    ctx.translate(3 + Math.sin(armA) * -torso * 0.8, shoulderY + 2 + Math.cos(armA) * torso * 0.8 - 6);
    drawVHand(ctx, 15, 1);
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
export function drawEnemy(ctx: Ctx, e: Enemy, x: number, y: number, time: number) {
  const cx = x + e.w / 2;
  const by = y + e.h;
  ctx.save();
  if (e.state === 'flipped') {
    ctx.translate(cx, y + e.h / 2);
    ctx.rotate(Math.PI + e.t * 4 * Math.sign(e.vx || 1));
    ctx.translate(-cx, -(y + e.h / 2));
  }
  switch (e.kind) {
    case 'bot':
      drawBot(ctx, e, cx, by, time);
      break;
    case 'weed':
      drawWeed(ctx, e, cx, by, time);
      break;
    case 'cactus':
      drawCactus(ctx, e, cx, by, time);
      break;
    case 'turret':
      drawTurret(ctx, e, cx, by);
      break;
  }
  ctx.restore();
  if (e.state === 'stunned') {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = time * 5 + (i * Math.PI * 2) / 3;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 18, y - 6 + Math.sin(a) * 5);
      starPath(ctx, 0, 0, 5);
      ctx.fillStyle = C.gold;
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(cx, y + e.h * 0.55, e.w * 0.62, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#8A5A2E';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

function drawBot(ctx: Ctx, e: Enemy, cx: number, by: number, time: number) {
  const squash = e.state === 'squashed';
  ctx.translate(cx, by);
  if (squash) ctx.scale(1.25, 0.35);
  ctx.scale(e.dir < 0 ? 1 : -1, 1);
  // wheels
  for (const wx of [-11, 11]) {
    ctx.save();
    ctx.translate(wx, -6);
    ctx.rotate((e.x / 6) * (e.dir < 0 ? 1 : -1));
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#2A2A2E';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.fillStyle = C.grayLight;
    ctx.fillRect(-1, -5, 2, 10);
    ctx.restore();
  }
  // dome body
  ctx.beginPath();
  ctx.moveTo(-18, -9);
  ctx.lineTo(-18, -18);
  ctx.quadraticCurveTo(-18, -34, 0, -34);
  ctx.quadraticCurveTo(18, -34, 18, -18);
  ctx.lineTo(18, -9);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -34, 0, -9);
  g.addColorStop(0, '#B4B4BA');
  g.addColorStop(1, C.gray);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // orange visor + eye
  rr(ctx, -16, -26, 22, 9, 4);
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.stroke();
  const blink = Math.sin(time * 3 + e.anim) > 0.95;
  ctx.fillStyle = C.cream;
  ctx.fillRect(-12, -24, 5, blink ? 1 : 5);
  // basketball decal
  ctx.beginPath();
  ctx.arc(8, -15, 4, 0, Math.PI * 2);
  ctx.fillStyle = C.orangeDark;
  ctx.fill();
  // antenna
  ctx.beginPath();
  ctx.moveTo(4, -34);
  ctx.lineTo(6, -40 + Math.sin(time * 8 + e.anim) * 1.5);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, -41 + Math.sin(time * 8 + e.anim) * 1.5, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = C.green;
  ctx.fill();
  ctx.stroke();
}

function drawWeed(ctx: Ctx, e: Enemy, cx: number, by: number, time: number) {
  const r = 18;
  const squash = e.state === 'squashed';
  let ox = 0;
  if (e.state === 'alert') ox = Math.sin(time * 50) * 2.5;
  ctx.translate(cx + ox, by - r);
  if (squash) ctx.scale(1.3, 0.4);
  ctx.rotate(e.x / r);
  ctx.strokeStyle = '#6E4A22';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r - (i % 3) * 3, r * 0.55, (i * Math.PI) / 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#B98B4C';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r - 4, r * 0.35, (i * Math.PI) / 6 + 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (e.state === 'alert') {
    ctx.rotate(-e.x / r);
    // "!" warning bubble
    ctx.fillStyle = C.cream;
    rr(ctx, -8, -r - 30, 16, 20, 5);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.orange;
    ctx.font = '900 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, -r - 14);
    // dust cue
    ctx.fillStyle = 'rgba(230,200,160,0.7)';
    for (let i = 0; i < 4; i++) {
      const a = time * 9 + i * 1.7;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 20, r - 2 - Math.abs(Math.sin(a)) * 6, 4 + (i % 2) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCactus(ctx: Ctx, e: Enemy, cx: number, by: number, time: number) {
  const crouch = e.state === 'crouch' ? Math.min(1, e.t / 0.45) : 0;
  const airborne = !e.onGround;
  ctx.translate(cx, by);
  ctx.scale(e.dir < 0 ? 1 : -1, 1);
  ctx.scale(1 + crouch * 0.18, 1 - crouch * 0.25 + (airborne ? 0.06 : 0));
  if (crouch > 0) ctx.translate(Math.sin(time * 60) * 1.2, 0);
  // feet
  ctx.fillStyle = '#0E6A1A';
  ctx.beginPath();
  ctx.ellipse(-7, -2, 6, 3, 0, 0, Math.PI * 2);
  ctx.ellipse(7, -2, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // arms
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 10, -22);
    ctx.lineTo(s * 17, -22);
    ctx.lineTo(s * 17, -32 - (airborne ? 4 : 0));
    ctx.lineWidth = 7;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.green;
    ctx.stroke();
  }
  // body
  rr(ctx, -12, -42, 24, 40, 12);
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, C.greenDark);
  g.addColorStop(0.5, C.green);
  g.addColorStop(1, C.greenDark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // ribs
  ctx.strokeStyle = 'rgba(0,60,10,0.6)';
  ctx.lineWidth = 1.4;
  for (const x of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(x, -38);
    ctx.lineTo(x, -6);
    ctx.stroke();
  }
  // spines: obvious, cream-tipped, all around the silhouette
  ctx.strokeStyle = C.cream;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x0 = Math.cos(a) * 12;
    const y0 = -22 + Math.sin(a) * 20;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 * 1.45, -22 + Math.sin(a) * 20 * 1.3);
    ctx.stroke();
  }
  // angry eyes
  ctx.fillStyle = C.ink;
  ctx.fillRect(-9, -30, 4, 4);
  ctx.fillRect(-1, -30, 4, 4);
  ctx.beginPath();
  ctx.moveTo(-11, -34);
  ctx.lineTo(-4, -32);
  ctx.moveTo(5, -34);
  ctx.lineTo(-2, -32);
  ctx.lineWidth = 2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  // orange flower
  ctx.fillStyle = C.orange;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + time;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 3.5, -44 + Math.sin(a) * 3.5, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(0, -44, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTurret(ctx: Ctx, e: Enemy, cx: number, by: number) {
  const squash = e.state === 'squashed';
  ctx.translate(cx, by);
  if (squash) ctx.scale(1.2, 0.4);
  ctx.scale(e.dir < 0 ? 1 : -1, 1);
  // base
  rr(ctx, -20, -26, 40, 26, 5);
  ctx.fillStyle = '#4A4A50';
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.fillStyle = C.orange;
  ctx.fillRect(-18, -12, 36, 4);
  // barrel
  const ch = e.charge;
  rr(ctx, -26, -40, 30, 14, 5);
  ctx.fillStyle = C.gray;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-24, -33, 6, 0, Math.PI * 2);
  ctx.fillStyle = ch > 0 ? `rgba(255,${Math.floor(160 - ch * 100)},40,${0.4 + ch * 0.6})` : '#1E1E22';
  ctx.fill();
  ctx.stroke();
  if (ch > 0) {
    const g = ctx.createRadialGradient(-24, -33, 2, -24, -33, 22 * ch + 4);
    g.addColorStop(0, 'rgba(255,190,90,0.9)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-50, -60, 52, 54);
  }
  // dome cap
  ctx.beginPath();
  ctx.arc(4, -40, 10, Math.PI, 0);
  ctx.fillStyle = '#8D8D93';
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------------------
export function drawBoss(ctx: Ctx, b: Boss, x: number, y: number, time: number) {
  if (b.state === 'dead') return;
  const w = b.w;
  const h = b.h;
  ctx.save();
  if (b.flash > 0 && Math.floor(b.flash * 16) % 2 === 0) ctx.globalAlpha = 0.55;
  const shakeX = b.state === 'telegraph' || b.state === 'dying' ? Math.sin(time * 70) * 2.5 : 0;
  ctx.translate(x + shakeX, y);
  const tel = b.state === 'telegraph';
  // treads
  rr(ctx, 4, h - 22, w - 8, 22, 10);
  ctx.fillStyle = '#1C1B1E';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  const treadOff = (b.x * 0.5) % 14;
  ctx.fillStyle = '#4A4A50';
  for (let tx = 10 - treadOff; tx < w - 10; tx += 14) ctx.fillRect(tx, h - 18, 6, 14);
  // body
  rr(ctx, 0, 14, w, h - 34, 12);
  const g = ctx.createLinearGradient(0, 14, 0, h - 20);
  g.addColorStop(0, '#5A5A62');
  g.addColorStop(1, '#2E2E34');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.stroke();
  // orange stripes + label
  ctx.fillStyle = C.orange;
  ctx.fillRect(6, 40, w - 12, 8);
  ctx.fillStyle = C.cream;
  ctx.font = '900 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REBOUNDER 3000', w / 2, 66);
  // headlights / eyes
  const eyeCol = tel && b.attack === 'charge' ? (Math.floor(time * 14) % 2 ? '#FF3A1A' : C.gold) : b.state === 'exposed' ? C.green : C.gold;
  for (const ex of [b.facing < 0 ? 14 : w - 34]) {
    rr(ctx, ex, 22, 20, 12, 4);
    ctx.fillStyle = eyeCol;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // cannon
  const cx = b.facing < 0 ? -18 : w - 6;
  rr(ctx, cx, 18, 24, 18, 6);
  ctx.fillStyle = '#7A7A82';
  ctx.fill();
  ctx.stroke();
  if (tel && b.attack === 'lob') {
    const gg = ctx.createRadialGradient(cx + 12, 27, 2, cx + 12, 27, 36);
    gg.addColorStop(0, 'rgba(255,200,100,0.95)');
    gg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(cx - 24, -10, 72, 72);
  }
  // hoop + net on top (practice-machine look)
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w - 26, 14);
  ctx.lineTo(w - 26, -22);
  ctx.stroke();
  rr(ctx, w - 44, -40, 36, 22, 3);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(w - 26, -16, 13, 3.5, 0, 0, Math.PI * 2);
  ctx.strokeStyle = C.orange;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,236,0.8)';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(w - 26 + i * 5, -14);
    ctx.lineTo(w - 26 + i * 3, -2);
    ctx.stroke();
  }
  // core hatch
  const open = b.state === 'exposed' ? Math.min(1, b.t / 0.25) : b.state === 'hurt' ? 1 : 0;
  const hx = w / 2;
  if (open > 0) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 10);
    const cg = ctx.createRadialGradient(hx, 10, 2, hx, 10, 40);
    cg.addColorStop(0, `rgba(0,194,29,${pulse})`);
    cg.addColorStop(1, 'rgba(0,194,29,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(hx - 40, -30, 80, 80);
    ctx.save();
    ctx.translate(hx, 8);
    ctx.rotate(time * 2);
    starPath(ctx, 0, 0, 13);
    ctx.fillStyle = C.green;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.restore();
  }
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(hx + s * 26, 14);
    ctx.rotate(s * -open * 1.1);
    rr(ctx, s < 0 ? 0 : -26, -6, 26, 8, 2);
    ctx.fillStyle = '#8D8D93';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.restore();
  }
  // steam when exposed
  if (b.state === 'exposed' || b.state === 'recover') {
    ctx.fillStyle = 'rgba(255,248,236,0.35)';
    for (let i = 0; i < 3; i++) {
      const t = (time * 1.5 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(hx - 30 + i * 30, 6 - t * 40, 6 + t * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
