// Procedural canvas textures: signage, facades, road, Maddy's face and shirt.
// All signs are drawn with real fonts so text is crisp and exact (no AI-generated lettering).

import * as THREE from 'three';
import { MADDY_LOOK } from '../config';

const cache = new Map<string, THREE.Texture>();

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, opts: { repeat?: boolean; srgb?: boolean } = {}): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas(w, h);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

export const FONT = '"Baloo 2", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const SIGN_FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

function fitText(g: CanvasRenderingContext2D, text: string, maxW: number, size: number, font = SIGN_FONT, weight = '900') {
  let s = size;
  do {
    g.font = `${weight} ${s}px ${font}`;
    s -= 2;
  } while (g.measureText(text).width > maxW && s > 8);
}

/** A sign board: text on a coloured panel. */
export function signTexture(text: string, opts: { bg?: string; fg?: string; w?: number; h?: number; border?: string; font?: string } = {}): THREE.Texture {
  const w = opts.w ?? 1024;
  const h = opts.h ?? 192;
  return tex(`sign:${text}:${opts.bg}:${opts.fg}:${w}x${h}:${opts.border}`, w, h, (g) => {
    if (opts.bg) {
      g.fillStyle = opts.bg;
      g.fillRect(0, 0, w, h);
    } else g.clearRect(0, 0, w, h);
    if (opts.border) {
      g.strokeStyle = opts.border;
      g.lineWidth = h * 0.06;
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
    }
    g.fillStyle = opts.fg ?? '#222';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    fitText(g, text, w * 0.9, h * 0.62, opts.font);
    g.fillText(text, w / 2, h / 2 + h * 0.04);
  });
}

/** Asphalt road with three lanes, dashed dividers and edge lines; v repeats along the road. */
export function roadTexture(): THREE.Texture {
  return tex(
    'road',
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#56585d';
      g.fillRect(0, 0, w, h);
      noise(g, w, h, 2200, ['#4c4e53', '#62646a', '#5a5c61']);
      // edge lines
      g.fillStyle = '#efeee6';
      g.fillRect(w * 0.035, 0, w * 0.018, h);
      g.fillRect(w * 0.947, 0, w * 0.018, h);
      // lane dividers (dashed)
      for (const x of [w / 3, (2 * w) / 3]) {
        for (let y = 0; y < h; y += h / 2) g.fillRect(x - w * 0.008, y, w * 0.016, h * 0.28);
      }
    },
    { repeat: true },
  );
}

export function sidewalkTexture(): THREE.Texture {
  return tex(
    'sidewalk',
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#d2c5b3';
      g.fillRect(0, 0, w, h);
      noise(g, w, h, 600, ['#c8baa6', '#dbcfbe']);
      g.strokeStyle = 'rgba(120,100,80,0.35)';
      g.lineWidth = 2;
      for (let y = 0; y <= h; y += h / 4) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w / 2, h);
      g.stroke();
      // curb edge
      g.fillStyle = '#b8ab98';
      g.fillRect(0, 0, w * 0.07, h);
    },
    { repeat: true },
  );
}

export function grassTexture(): THREE.Texture {
  return tex(
    'grass',
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#5f9a3c';
      g.fillRect(0, 0, w, h);
      noise(g, w, h, 3000, ['#568f35', '#6aa646', '#4f8530', '#73ad4c']);
    },
    { repeat: true },
  );
}

export function plainAsphaltTexture(): THREE.Texture {
  return tex(
    'asphalt',
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#5a5c61';
      g.fillRect(0, 0, w, h);
      noise(g, w, h, 1200, ['#505257', '#64666b']);
      g.fillStyle = '#f2f0e6';
      for (let y = 0; y < h; y += h / 2) g.fillRect(w / 2 - 3, y, 6, h * 0.25);
    },
    { repeat: true },
  );
}

export function crosswalkTexture(): THREE.Texture {
  return tex('crosswalk', 256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(246,244,236,0.95)';
    for (let x = 8; x < w; x += 32) g.fillRect(x, 0, 18, h);
  });
}

function noise(g: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[]) {
  // deterministic speckle
  let seed = 1234;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    const s = 1 + r() * 2.5;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

export function brickTexture(base: string, mortar: string): THREE.Texture {
  return tex(
    `brick:${base}`,
    256,
    256,
    (g, w, h) => {
      g.fillStyle = mortar;
      g.fillRect(0, 0, w, h);
      const bh = h / 16;
      const bw = w / 6;
      let seed = 99;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let row = 0; row < 16; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < w + bw; x += bw) {
          g.fillStyle = shade(base, (r() - 0.5) * 0.18);
          g.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
        }
      }
    },
    { repeat: true },
  );
}

export function shade(hexStr: string, amt: number): string {
  const n = parseInt(hexStr.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  const r = f((n >> 16) & 255);
  const gg = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${gg},${b})`;
}

// ---------------------------------------------------------------- Maddy

/**
 * Face texture for a SphereGeometry head. The face centre sits at u = 0.25 (the sphere's +Z side).
 * Eyes, brows, nose, smile and cheeks are painted so they stay readable at small sizes.
 */
export function faceTexture(): THREE.Texture {
  return tex('maddy-face', 1024, 512, (g, w, h) => {
    const skin = hex(MADDY_LOOK.skin);
    g.fillStyle = skin;
    g.fillRect(0, 0, w, h);
    // subtle shading toward the back
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.0)');
    grad.addColorStop(0.25, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(40,20,10,0.18)');
    grad.addColorStop(0.9, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    const cx = w * 0.25;
    const eyeY = h * 0.52;
    const eyeDX = w * 0.056;
    // eyes: white, large dark iris, highlights
    for (const sx of [-1, 1]) {
      const ex = cx + sx * eyeDX;
      g.fillStyle = '#fbf6ee';
      ellipse(g, ex, eyeY, w * 0.03, h * 0.058);
      g.fillStyle = hex(MADDY_LOOK.eyes);
      ellipse(g, ex + sx * -2, eyeY + 2, w * 0.022, h * 0.05);
      g.fillStyle = '#3b2416';
      ellipse(g, ex + sx * -2, eyeY + 6, w * 0.012, h * 0.025);
      g.fillStyle = '#ffffff';
      ellipse(g, ex + sx * -2 - 7, eyeY - 8, w * 0.0065, h * 0.013);
      ellipse(g, ex + sx * -2 + 6, eyeY + 9, w * 0.003, h * 0.007);
      // upper lash line
      g.strokeStyle = '#120a06';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(ex, eyeY + 2, w * 0.028, h * 0.052, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      // brows
      g.strokeStyle = '#1a100b';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(ex - w * 0.024, eyeY - h * 0.088);
      g.quadraticCurveTo(ex, eyeY - h * 0.112, ex + w * 0.024, eyeY - h * 0.092);
      g.stroke();
    }
    // nose
    g.strokeStyle = hex(MADDY_LOOK.skinShade);
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx - 9, eyeY + h * 0.1);
    g.quadraticCurveTo(cx, eyeY + h * 0.125, cx + 9, eyeY + h * 0.1);
    g.stroke();
    // cheeks
    g.fillStyle = 'rgba(214,92,88,0.28)';
    ellipse(g, cx - w * 0.072, eyeY + h * 0.11, w * 0.02, h * 0.03);
    ellipse(g, cx + w * 0.072, eyeY + h * 0.11, w * 0.02, h * 0.03);
    // big bright smile with teeth
    const my = eyeY + h * 0.165;
    g.fillStyle = '#5a1d1a';
    g.beginPath();
    g.moveTo(cx - w * 0.045, my);
    g.quadraticCurveTo(cx, my + h * 0.12, cx + w * 0.045, my);
    g.quadraticCurveTo(cx, my + h * 0.03, cx - w * 0.045, my);
    g.fill();
    g.fillStyle = '#fffaf2';
    g.beginPath();
    g.moveTo(cx - w * 0.038, my + 3);
    g.quadraticCurveTo(cx, my + h * 0.045, cx + w * 0.038, my + 3);
    g.quadraticCurveTo(cx, my + h * 0.022, cx - w * 0.038, my + 3);
    g.fill();
    g.strokeStyle = hex(MADDY_LOOK.lips);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx - w * 0.047, my - 1);
    g.quadraticCurveTo(cx, my + h * 0.123, cx + w * 0.047, my - 1);
    g.stroke();
  });
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

/** Hair texture with a centre part and soft strands. */
export function hairTexture(): THREE.Texture {
  return tex('maddy-hair', 512, 256, (g, w, h) => {
    g.fillStyle = hex(MADDY_LOOK.hair);
    g.fillRect(0, 0, w, h);
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      g.strokeStyle = r() > 0.5 ? 'rgba(70,52,44,0.45)' : 'rgba(10,6,5,0.5)';
      g.lineWidth = 1.5;
      const x = r() * w;
      const y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 8, y + 10 + r() * 14);
      g.stroke();
    }
  });
}

/** Front-of-shirt print. `kind` follows the equipped outfit. */
export function shirtTexture(kind: 'knights' | 'maddy' | 'explorer', base: number): THREE.Texture {
  return tex(`shirt:${kind}:${base}`, 512, 512, (g, w, h) => {
    g.fillStyle = hex(base);
    g.fillRect(0, 0, w, h);
    // CylinderGeometry: u = 0.5 faces -Z? We draw the print centred at u = 0.25 (+Z, the front) — see character.ts.
    const cx = w * 0.25;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (kind === 'knights') {
      g.fillStyle = '#ffffff';
      g.font = `900 ${h * 0.11}px ${SIGN_FONT}`;
      g.fillText('WE ARE', cx, h * 0.33);
      g.font = `900 ${h * 0.12}px ${SIGN_FONT}`;
      g.fillText('KNIGHTS', cx, h * 0.47);
      drawKnight(g, cx, h * 0.66, h * 0.14, '#e8b630');
    } else if (kind === 'maddy') {
      g.fillStyle = '#ffffff';
      g.font = `900 ${h * 0.15}px ${SIGN_FONT}`;
      g.fillText('MADDY', cx, h * 0.42);
      g.fillStyle = '#ffd84a';
      star(g, cx, h * 0.62, h * 0.07);
    } else {
      // jacket: zipper, pockets and an M badge
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(cx - 4, 0, 8, h);
      g.fillRect(cx - w * 0.11, h * 0.62, w * 0.07, h * 0.12);
      g.fillRect(cx + w * 0.04, h * 0.62, w * 0.07, h * 0.12);
      g.fillStyle = '#ffd84a';
      g.beginPath();
      g.arc(cx + w * 0.075, h * 0.36, h * 0.07, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1b4d47';
      g.font = `900 ${h * 0.1}px ${SIGN_FONT}`;
      g.fillText('M', cx + w * 0.075, h * 0.365);
    }
  });
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** Simple gold chess-knight emblem. */
function drawKnight(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-30, 50);
  g.lineTo(34, 50);
  g.lineTo(30, 36);
  g.lineTo(22, 34);
  g.quadraticCurveTo(30, 0, 26, -20);
  g.quadraticCurveTo(18, -48, -6, -52);
  g.lineTo(-10, -62);
  g.lineTo(-16, -48);
  g.quadraticCurveTo(-34, -36, -40, -12);
  g.lineTo(-30, -4);
  g.lineTo(-14, -14);
  g.quadraticCurveTo(-8, 4, -26, 30);
  g.lineTo(-24, 36);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.arc(4, -30, 4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Window grid facade texture with glowing warm windows. */
export function facadeTexture(key: string, wall: string, cols: number, rows: number, opts: { glow?: string; frame?: string; brick?: boolean } = {}): THREE.Texture {
  return tex(`facade:${key}`, 512, 512, (g, w, h) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    if (opts.brick) {
      g.strokeStyle = 'rgba(60,30,15,0.35)';
      g.lineWidth = 2;
      for (let y = 0; y < h; y += 14) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
        for (let x = (y / 14) % 2 ? 0 : 18; x < w; x += 36) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 14);
          g.stroke();
        }
      }
    }
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.22;
        const y = r * rh + rh * 0.2;
        g.fillStyle = opts.frame ?? '#f6f0e4';
        g.fillRect(x - 4, y - 4, cw * 0.56 + 8, rh * 0.56 + 8);
        const grd = g.createLinearGradient(0, y, 0, y + rh * 0.56);
        grd.addColorStop(0, opts.glow ?? '#ffd27a');
        grd.addColorStop(1, '#f2a541');
        g.fillStyle = grd;
        g.fillRect(x, y, cw * 0.56, rh * 0.56);
        g.fillStyle = 'rgba(120,70,20,0.35)';
        g.fillRect(x + cw * 0.27, y, 3, rh * 0.56);
      }
    }
  });
}

/** Generic painted texture from a callback (cached by key). */
export function painted(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture {
  return tex(key, w, h, draw);
}

export function drawBullseye(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = '#cc1a24';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(x, y, r * 0.66, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#cc1a24';
  g.beginPath();
  g.arc(x, y, r * 0.33, 0, Math.PI * 2);
  g.fill();
}
