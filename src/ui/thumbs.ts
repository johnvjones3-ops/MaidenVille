// Small illustrated thumbnails for the City Passport scrapbook and landmark cards (drawn, not photos).

import type { LandmarkId } from '../world/landmarks';
import { drawBullseye } from '../render/textures';

const cache = new Map<string, string>();

export function landmarkThumb(id: LandmarkId, size = 220): string {
  const key = `${id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = Math.round(size * 0.75);
  const g = c.getContext('2d')!;
  const w = c.width;
  const h = c.height;
  // golden-hour backdrop
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#8fbfe6');
  sky.addColorStop(0.7, '#ffd9a8');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#6aa646';
  g.fillRect(0, h * 0.82, w, h * 0.18);
  g.fillStyle = '#4f8530';
  for (const x of [0.06, 0.94]) {
    g.beginPath();
    g.arc(w * x, h * 0.66, h * 0.15, 0, Math.PI * 2);
    g.fill();
  }
  const base = h * 0.84;
  const rect = (x: number, y: number, ww: number, hh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  };
  const tri = (x0: number, x1: number, y: number, top: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.lineTo((x0 + x1) / 2, top);
    g.closePath();
    g.fill();
  };
  const text = (t: string, x: number, y: number, size2: number, col: string) => {
    g.fillStyle = col;
    g.font = `900 ${size2}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t, x, y);
  };
  const win = (x: number, y: number, ww: number, hh: number, frame = '#f6efe0') => {
    rect(x - 2, y - 2, ww + 4, hh + 4, frame);
    rect(x, y, ww, hh, '#ffc865');
  };
  const cx = w / 2;
  switch (id) {
    case 'church': {
      rect(cx - w * 0.17, base - h * 0.36, w * 0.34, h * 0.36, '#f1e6cf');
      tri(cx - w * 0.2, cx + w * 0.2, base - h * 0.35, base - h * 0.72, '#34363d');
      tri(cx - w * 0.15, cx + w * 0.15, base - h * 0.36, base - h * 0.64, '#f1e6cf');
      g.fillStyle = '#ffc865';
      g.beginPath();
      g.arc(cx, base - h * 0.47, h * 0.055, 0, Math.PI * 2);
      g.fill();
      rect(cx - 1.5, base - h * 0.85, 3, h * 0.14, '#fff6e0');
      rect(cx - h * 0.04, base - h * 0.8, h * 0.08, 3, '#fff6e0');
      rect(cx - w * 0.04, base - h * 0.16, w * 0.08, h * 0.16, '#3b2a20');
      text('TRINITY CHURCH', cx, base - h * 0.28, h * 0.055, '#5a3a28');
      break;
    }
    case 'school': {
      rect(cx - w * 0.4, base - h * 0.32, w * 0.8, h * 0.32, '#8a5634');
      rect(cx - w * 0.14, base - h * 0.4, w * 0.28, h * 0.4, '#8a5634');
      tri(cx - w * 0.16, cx + w * 0.16, base - h * 0.4, base - h * 0.66, '#34363d');
      for (let i = 0; i < 3; i++) {
        win(cx - w * 0.37 + i * w * 0.075, base - h * 0.24, w * 0.05, h * 0.1);
        win(cx + w * 0.2 + i * w * 0.065, base - h * 0.24, w * 0.045, h * 0.1);
      }
      rect(cx - w * 0.13, base - h * 0.37, w * 0.26, h * 0.06, '#f6efe0');
      text('KINGDOM SCHOOL', cx, base - h * 0.34, h * 0.042, '#5b2f17');
      rect(cx - w * 0.04, base - h * 0.14, w * 0.08, h * 0.14, '#ffb755');
      rect(w * 0.7, base - h * 0.1, w * 0.22, h * 0.09, '#f5b912');
      break;
    }
    case 'store': {
      rect(cx - w * 0.42, base - h * 0.3, w * 0.84, h * 0.3, '#e2cfae');
      rect(cx - w * 0.18, base - h * 0.5, w * 0.36, h * 0.5, '#f2e8d4');
      drawBullseye(g, cx, base - h * 0.4, h * 0.07);
      text('SUPER TARGET', cx, base - h * 0.27, h * 0.05, '#cc1a24');
      rect(cx - w * 0.15, base - h * 0.17, w * 0.3, h * 0.04, '#cc1a24');
      rect(cx - w * 0.14, base - h * 0.13, w * 0.28, h * 0.13, '#cfe9ff');
      break;
    }
    case 'hospital': {
      rect(cx - w * 0.36, base - h * 0.3, w * 0.72, h * 0.3, '#f7f6f1');
      rect(cx - w * 0.37, base - h * 0.36, w * 0.74, h * 0.07, '#22b8c8');
      text('HOSPITAL', cx + w * 0.05, base - h * 0.325, h * 0.05, '#ffffff');
      rect(cx - w * 0.27, base - h * 0.35, w * 0.02, h * 0.05, '#1f8fd0');
      rect(cx - w * 0.285, base - h * 0.335, w * 0.05, h * 0.02, '#1f8fd0');
      rect(cx - w * 0.07, base - h * 0.17, w * 0.14, h * 0.17, '#1f8fd0');
      rect(cx - w * 0.06, base - h * 0.16, w * 0.12, h * 0.16, '#cfe9ff');
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) win(cx + sx * (w * 0.14 + i * w * 0.09) - w * 0.03, base - h * 0.24, w * 0.06, h * 0.08, '#1f8fd0');
      break;
    }
    case 'emergency': {
      rect(cx - w * 0.38, base - h * 0.3, w * 0.76, h * 0.3, '#b9b6ae');
      rect(cx - w * 0.38, base - h * 0.31, w * 0.76, h * 0.03, '#d2342b');
      for (let i = 0; i < 3; i++) rect(cx - w * 0.34 + i * w * 0.14, base - h * 0.17, w * 0.11, h * 0.17, '#d2342b');
      rect(cx - w * 0.2, base - h * 0.42, w * 0.4, h * 0.08, '#ffffff');
      text('EMERGENCY 911', cx, base - h * 0.38, h * 0.045, '#d2342b');
      text('FD 118', cx - w * 0.2, base - h * 0.22, h * 0.035, '#ffffff');
      text('PD 67', cx + w * 0.26, base - h * 0.22, h * 0.035, '#2f4a7a');
      break;
    }
    case 'house_turquoise':
    case 'house_pink': {
      const face = id === 'house_turquoise' ? '#2ec4b6' : '#d63c8f';
      const trim = id === 'house_turquoise' ? '#ff8fc7' : '#9bd63a';
      rect(cx - w * 0.15, base - h * 0.42, w * 0.3, h * 0.42, face);
      tri(cx - w * 0.19, cx + w * 0.19, base - h * 0.41, base - h * 0.72, '#34363d');
      tri(cx - w * 0.12, cx + w * 0.12, base - h * 0.42, base - h * 0.6, face);
      g.fillStyle = '#ffd27a';
      g.beginPath();
      g.arc(cx, base - h * 0.49, h * 0.03, 0, Math.PI * 2);
      g.fill();
      win(cx - w * 0.11, base - h * 0.35, w * 0.07, h * 0.09, trim);
      win(cx + w * 0.04, base - h * 0.35, w * 0.07, h * 0.09, trim);
      rect(cx + w * 0.03, base - h * 0.17, w * 0.08, h * 0.17, trim);
      rect(cx + w * 0.045, base - h * 0.15, w * 0.05, h * 0.15, '#ffd27a');
      win(cx - w * 0.11, base - h * 0.15, w * 0.08, h * 0.07, trim);
      break;
    }
  }
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
