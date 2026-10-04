import type { Boss } from '../game/boss';
import type { Enemy } from '../game/entities';
import type { Player } from '../game/player';
import { C, drawHat, drawVEmblem, drawVHand, rr, starPath } from './art';

type Ctx = CanvasRenderingContext2D;

const SKIN = '#E3A781';
const SKIN_SH = '#C4825C';
const HAIR = '#3A281C';
const SHIRT = '#F4F2ED';
const SHIRT_SH = '#D4D0C8';
const VEST = '#3B3D45';
const PANTS = '#2A2B30';
const CHAPS = '#1C1C20';
const BELT = '#6B4426';
const BOOT = '#3E2617';

export interface HeroPose {
  big: boolean;
  anim: Player['anim'];
  facing: number;
  landT: number;
  starT: number;
  stride: number;
  vx: number;
}

/** Draws the player with feet centred at (fx, fy). */
export function drawPlayer(ctx: Ctx, p: Player, fx: number, fy: number, time: number) {
  if (p.invulnT > 0 && !p.dead && Math.floor(p.invulnT * 18) % 2 === 0) return;
  const big = p.form === 'vaquero';
  // Growth flicker alternates between the two silhouettes.
  const showBig = p.growT > 0 ? Math.floor(p.growT * 16) % 2 === (big ? 0 : 1) : big;
  drawHero(ctx, { big: showBig, anim: p.anim, facing: p.facing, landT: p.landT, starT: p.starT, stride: p.stride, vx: p.vx }, fx, fy, time);
}

/**
 * The Vaquero hero, styled after the supplied character photo: black cowboy hat with
 * orange band (V patch in Vaquero form), short dark hair and beard, orange paisley
 * bandana, rolled white sleeves. Vaquero form adds the charcoal vest with orange piping,
 * black/orange bracers, silver buckle, perforated chaps with fringe and boots.
 */
export function drawHero(ctx: Ctx, h: HeroPose, fx: number, fy: number, time: number) {
  const big = h.big;
  const legL = big ? 23 : 15;
  const torso = big ? 23 : 16;
  const headR = big ? 10.5 : 9;
  const anim = h.anim;
  const run = anim === 'run';

  ctx.save();
  ctx.translate(fx, fy);
  let sx = 1;
  let sy = 1;
  if (anim === 'land') {
    const q = Math.max(0, h.landT / 0.12);
    sx = 1 + 0.14 * q;
    sy = 1 - 0.14 * q;
  } else if (anim === 'jump') {
    sx = 0.95;
    sy = 1.05;
  }
  ctx.scale(sx, sy);
  ctx.scale(anim === 'death' ? 1 : h.facing, 1);
  if (h.starT > 0) {
    const flash = h.starT < 2.5 ? Math.floor(time * 12) % 2 === 0 : true;
    if (flash) {
      ctx.shadowColor = Math.floor(time * 10) % 2 ? C.green : C.orange;
      ctx.shadowBlur = 16;
    }
  }

  // ---- pose (negative angle = forward) ----
  let thA = 0, thB = 0, knA = 0, knB = 0, arA = 0.15, arB = -0.15, elA = -0.3, elB = -0.3, lean = 0;
  const ph = h.stride / (run ? 28 : 21);
  switch (anim) {
    case 'walk':
    case 'run': {
      const amp = run ? 0.9 : 0.6;
      thA = Math.sin(ph) * amp;
      thB = -thA;
      knA = Math.max(0, Math.sin(ph - 1.3)) * (run ? 1.3 : 0.8);
      knB = Math.max(0, Math.sin(ph - 1.3 + Math.PI)) * (run ? 1.3 : 0.8);
      arA = -thA * 0.9;
      arB = thA * 0.9;
      elA = elB = run ? -1.2 : -0.5;
      lean = run ? 0.13 : 0.04;
      break;
    }
    case 'idle':
      arA = 0.12 + Math.sin(time * 2.4) * 0.04;
      arB = -0.1 - Math.sin(time * 2.4) * 0.04;
      break;
    case 'jump':
    case 'bonk':
      thA = -0.8; knA = 1.2; thB = 0.3; knB = 0.5;
      arA = anim === 'bonk' ? -3.0 : -2.6; elA = 0; arB = 0.7; elB = -0.6;
      break;
    case 'fall':
      thA = -0.3; knA = 0.6; thB = 0.35; knB = 0.3;
      arA = -1.9; elA = -0.3; arB = 1.5; elB = 0.2;
      break;
    case 'skid':
      thA = -0.6; knA = 0.2; thB = 0.5; knB = 0.6;
      arA = 1.2; arB = 1.5; elA = elB = 0.2; lean = -0.22;
      break;
    case 'land':
      thA = -0.3; knA = 0.7; thB = 0.3; knB = 0.7; arA = 0.6; arB = -0.5;
      break;
    case 'hurt':
    case 'death': {
      const w = Math.sin(time * 30) * 0.3;
      thA = 0.4; thB = -0.4; arA = -2.6 + w; arB = 2.6 - w; elA = elB = 0;
      break;
    }
    case 'victory':
      arA = -3.0; elA = 0; arB = 0.4; thA = 0.12; thB = -0.12;
      break;
    case 'lasso':
      arA = -1.5; elA = -0.2; arB = 0.4; lean = 0.08;
      break;
  }
  ctx.rotate(lean);

  const hipY = -legL;
  const shoulderY = hipY - torso + 3;
  const ink = C.ink;
  const lw = big ? 2.2 : 1.9;

  const seg = (x: number, y: number, ang: number, len: number, w: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    rr(ctx, -w / 2, -w / 4, w, len + w / 2, w / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();
    return { x: x - Math.sin(ang) * len, y: y + Math.cos(ang) * len };
  };

  const leg = (x: number, th: number, kn: number, front: boolean) => {
    const tl = legL * 0.52;
    const sl = legL * 0.5;
    const w = big ? 8.5 : 7;
    const pant = front ? PANTS : '#232428';
    const knee = seg(x, hipY, th, tl, w, pant);
    if (big) {
      // perforated black leather chaps over the thigh
      ctx.save();
      ctx.translate(x, hipY);
      ctx.rotate(th);
      rr(ctx, -w / 2 - 0.5, 0, w + 1, tl + 1, 3);
      ctx.fillStyle = front ? CHAPS : '#161619';
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,236,0.28)';
      for (let yy = 3; yy < tl - 1; yy += 3) for (let xx = -2; xx <= 2; xx += 2.5) ctx.fillRect(xx, yy + (xx > 0 ? 1.2 : 0), 0.9, 0.9);
      ctx.fillStyle = C.orange;
      ctx.fillRect(w / 2 - 1.6, 1, 1.4, tl - 1);
      ctx.restore();
    }
    const ankle = seg(knee.x, knee.y, th + kn, sl, big ? 7.5 : 6.2, front ? (big ? '#26262B' : PANTS) : '#202125');
    // footwear
    ctx.save();
    ctx.translate(ankle.x, ankle.y);
    if (big) {
      rr(ctx, -4.5, -5, 14, 7.5, 3);
      ctx.fillStyle = BOOT;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.fillStyle = '#5A3A22';
      ctx.fillRect(-3.5, -4.2, 7, 1.6);
    } else {
      rr(ctx, -4, -3.5, 11.5, 6, 3);
      ctx.fillStyle = '#2E2E33';
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = ink;
      ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.fillRect(-1.5, -2.6, 6, 1.6);
      ctx.fillStyle = C.cream;
      ctx.fillRect(-4, 1, 11.5, 1.2);
    }
    ctx.restore();
  };

  const arm = (x: number, ar: number, el: number, front: boolean) => {
    const ul = torso * 0.46;
    const fl = torso * 0.44;
    const w = big ? 7 : 6;
    const elbow = seg(x, shoulderY + 2, ar, ul, w + 0.6, front ? SHIRT : SHIRT_SH); // rolled white sleeve
    const ang = ar + el;
    // forearm: bare (Rookie) or black bracer with orange trim (Vaquero)
    const wrist = seg(elbow.x, elbow.y, ang, fl, w - 0.4, big ? (front ? '#1E1E22' : '#18181B') : front ? SKIN : SKIN_SH);
    if (big) {
      ctx.save();
      ctx.translate(elbow.x, elbow.y);
      ctx.rotate(ang);
      ctx.fillStyle = C.orange;
      ctx.fillRect(-(w - 0.4) / 2 + 0.6, fl * 0.55, w - 1.6, 1.6);
      ctx.fillStyle = '#8D8D93';
      ctx.beginPath();
      ctx.arc(0, fl * 0.3, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // sleeve cuff roll
    ctx.save();
    ctx.translate(elbow.x, elbow.y);
    ctx.rotate(ar);
    rr(ctx, -(w + 1.6) / 2, -2.2, w + 1.6, 3.6, 1.5);
    ctx.fillStyle = front ? SHIRT : SHIRT_SH;
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.restore();
    // hand
    ctx.beginPath();
    ctx.arc(wrist.x, wrist.y, w * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = front ? SKIN : SKIN_SH;
    ctx.fill();
    ctx.lineWidth = lw * 0.85;
    ctx.strokeStyle = ink;
    ctx.stroke();
    return wrist;
  };

  // back limbs
  arm(-2, arB, elB, false);
  leg(-2, thB, knB, false);

  // fringe on the far hip (Vaquero)
  if (big) {
    ctx.strokeStyle = '#7A4E2A';
    ctx.lineWidth = 1.4;
    const sway = Math.sin(time * 9) * 1.5 + Math.min(4, Math.abs(h.vx) / 80);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-7 + i * 0.6, hipY + 1);
      ctx.lineTo(-9 - sway + i * 0.8, hipY + 11 + (i % 2) * 2);
      ctx.stroke();
    }
  }

  // torso: white shirt, vest in Vaquero form
  const tw = big ? 19 : 15;
  rr(ctx, -tw / 2, shoulderY - 2, tw, torso + 1, 5);
  ctx.fillStyle = SHIRT;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ink;
  ctx.stroke();
  if (big) {
    rr(ctx, -tw / 2 + 0.5, shoulderY - 1, tw - 1, torso - 1, 4);
    ctx.fillStyle = VEST;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.stroke();
    // lapels with orange piping
    ctx.beginPath();
    ctx.moveTo(-1, shoulderY - 1);
    ctx.lineTo(4, shoulderY + torso * 0.42);
    ctx.lineTo(9, shoulderY - 1);
    ctx.closePath();
    ctx.fillStyle = SHIRT;
    ctx.fill();
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // UTRGV chest patch, buttons, pocket welts
    rr(ctx, -tw / 2 + 2.5, shoulderY + 4, 7.5, 3.6, 1);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.fillStyle = C.orange;
    ctx.fillRect(-tw / 2 + 3.3, shoulderY + 5, 5.9, 1.6);
    ctx.fillStyle = C.orange;
    for (const by of [0.55, 0.72]) {
      ctx.beginPath();
      ctx.arc(4.5, shoulderY + torso * by, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(-tw / 2 + 2.5, shoulderY + torso * 0.78, 4.5, 1.4);
  } else {
    ctx.strokeStyle = SHIRT_SH;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, shoulderY + 2);
    ctx.lineTo(4, hipY - 2);
    ctx.stroke();
    ctx.fillStyle = '#A9A49A';
    for (const by of [0.35, 0.6]) ctx.fillRect(4.6, shoulderY + torso * by, 1.3, 1.3);
  }
  // belt + buckle
  rr(ctx, -tw / 2, hipY - 3, tw, big ? 4.5 : 3.6, 1.2);
  ctx.fillStyle = BELT;
  ctx.fill();
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(3, hipY - 0.8, big ? 4.2 : 2.6, big ? 3 : 2.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#C3C6CC';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (big) {
    ctx.fillStyle = C.orange;
    ctx.fillRect(0.5, hipY - 1.4, 5, 1.2);
  }
  // hips
  rr(ctx, -tw / 2 + 0.5, hipY + 1, tw - 1, 4, 2);
  ctx.fillStyle = PANTS;
  ctx.fill();

  // front leg
  leg(2, thA, knA, true);

  // neck, bandana, head
  const headY = shoulderY - headR + 1;
  ctx.fillStyle = SKIN_SH;
  ctx.fillRect(-2.5, shoulderY - 5, 6, 5);
  ctx.beginPath();
  ctx.arc(1, headY, headR, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = ink;
  ctx.stroke();
  // short dark hair at the back/sides
  ctx.save();
  ctx.beginPath();
  ctx.arc(1, headY, headR, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = HAIR;
  ctx.fillRect(1 - headR, headY - headR, headR * 0.8, headR * 1.3);
  // full short beard along the jaw
  ctx.beginPath();
  ctx.moveTo(1 - headR * 0.3, headY - headR * 0.05);
  ctx.quadraticCurveTo(1 - headR * 0.2, headY + headR * 1.05, 1 + headR * 0.55, headY + headR * 1.0);
  ctx.quadraticCurveTo(1 + headR * 1.05, headY + headR * 0.75, 1 + headR, headY + headR * 0.15);
  ctx.lineTo(1 + headR * 0.82, headY + headR * 0.15);
  ctx.quadraticCurveTo(1 + headR * 0.35, headY + headR * 0.1, 1 + headR * 0.05, headY + headR * 0.3);
  ctx.closePath();
  ctx.fillStyle = HAIR;
  ctx.fill();
  ctx.restore();
  // ear
  ctx.beginPath();
  ctx.arc(1 - headR * 0.32, headY + 0.5, headR * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = SKIN_SH;
  ctx.fill();
  // face
  const hurt = anim === 'hurt' || anim === 'death';
  const ex = 1 + headR * 0.5;
  const ey = headY - headR * 0.18;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  if (hurt) {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ex - 2, ey - 2);
    ctx.lineTo(ex + 2, ey + 2);
    ctx.moveTo(ex + 2, ey - 2);
    ctx.lineTo(ex - 2, ey + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(1 + headR * 0.55, headY + headR * 0.55, 2.2, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const blink = Math.floor(time * 0.7 + 0.2) !== Math.floor(time * 0.7 + 0.26);
    if (blink) ctx.fillRect(ex - 1.6, ey, 3.2, 1.2);
    else {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 1.4, 1.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // brow
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ex - 2.4, ey - 3.2);
    ctx.lineTo(ex + 2, ey - 3.6);
    ctx.stroke();
    // big friendly smile in the beard
    ctx.beginPath();
    ctx.moveTo(1 + headR * 0.22, headY + headR * 0.42);
    ctx.quadraticCurveTo(1 + headR * 0.55, headY + headR * 0.78, 1 + headR * 0.9, headY + headR * 0.4);
    ctx.closePath();
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // mustache
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.ellipse(1 + headR * 0.6, headY + headR * 0.33, headR * 0.36, headR * 0.12, -0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  // nose
  ctx.beginPath();
  ctx.arc(1 + headR * 0.98, headY + headR * 0.06, headR * 0.17, -1.2, 1.6);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = ink;
  ctx.stroke();

  // orange paisley bandana
  const by = shoulderY - 1;
  ctx.beginPath();
  ctx.moveTo(-headR * 0.55, by - 2.5);
  ctx.lineTo(headR * 0.95, by - 2.5);
  ctx.lineTo(headR * 0.45, by + (big ? 7 : 5.5));
  ctx.closePath();
  ctx.fillStyle = C.orange;
  ctx.fill();
  ctx.lineWidth = lw * 0.85;
  ctx.strokeStyle = ink;
  ctx.stroke();
  ctx.fillStyle = '#7A2A08';
  for (const [dx, dy] of [[0.1, 0], [0.5, 0.5], [0.75, -0.1], [0.3, 1.3]] as const) {
    ctx.beginPath();
    ctx.arc(headR * dx, by - 1 + dy * 2.4, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // knot tail
  const flap = Math.sin(time * 11) * 1.5 + Math.min(5, Math.abs(h.vx) / 60);
  ctx.beginPath();
  ctx.moveTo(-headR * 0.5, by - 2);
  ctx.lineTo(-headR * 0.5 - 4 - flap, by - 1 + Math.sin(time * 8));
  ctx.lineTo(-headR * 0.5 - 2 - flap * 0.6, by + 2.5);
  ctx.closePath();
  ctx.fillStyle = C.orangeDark;
  ctx.fill();

  // cowboy hat (icon-sheet hat; V patch in Vaquero form)
  ctx.save();
  ctx.translate(1.5, headY - headR * 1.32);
  ctx.rotate(-0.05);
  drawHat(ctx, headR * 2.85, false);
  if (big) {
    ctx.save();
    ctx.translate(headR * 0.12, -headR * 0.3);
    drawVEmblem(ctx, headR * 0.75);
    ctx.restore();
  }
  ctx.restore();

  // front arm (V sign on victory)
  const wrist = arm(3, arA, elA, true);
  if (anim === 'victory') {
    ctx.save();
    ctx.translate(wrist.x, wrist.y - 6);
    drawVHand(ctx, big ? 18 : 14, 1);
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
