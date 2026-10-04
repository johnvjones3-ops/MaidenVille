import { TILE } from '../config';
import type { Theme } from '../levels/types';
import { T } from '../game/tiles';
import { C, drawCrate, drawStool, makeCanvas, rr } from './art';

type Ctx = CanvasRenderingContext2D;

interface Pal {
  top: string;
  topLight: string;
  lip: string;
  fill: string;
  fillLine: string;
  brick: string;
  brickLine: string;
  stone: string;
  stoneLine: string;
  trim: string;
}

const PALS: Record<Theme, Pal> = {
  plaza: { top: '#E7C49A', topLight: '#FFE7C4', lip: '#2FB548', fill: '#9A6844', fillLine: '#7C5034', brick: '#D7A574', brickLine: '#A9764C', stone: '#D9CFC2', stoneLine: '#A99C8C', trim: '#FFF0D8' },
  night: { top: '#A88A6E', topLight: '#FFB070', lip: '#139A34', fill: '#4A3428', fillLine: '#36261C', brick: '#9C7458', brickLine: '#6E4E38', stone: '#8E8478', stoneLine: '#625A50', trim: '#FF9A50' },
  arena: { top: '#B4AAA0', topLight: '#FFD2A8', lip: '#FF5E17', fill: '#3A3034', fillLine: '#2A2226', brick: '#B28058', brickLine: '#7E5838', stone: '#9C948A', stoneLine: '#6E665C', trim: '#FFC28A' },
};

/** Pre-rendered tile images per theme. */
export class TileArt {
  private scale = 0;
  private cache = new Map<string, HTMLCanvasElement>();

  ensure(scale: number) {
    if (scale === this.scale) return;
    this.scale = scale;
    this.cache.clear();
  }

  get(theme: Theme, t: number, variant: number): HTMLCanvasElement {
    const k = `${theme}:${t}:${variant}`;
    let c = this.cache.get(k);
    if (!c) {
      c = makeCanvas((TILE + 8) * this.scale, (TILE + 8) * this.scale);
      const ctx = c.getContext('2d')!;
      ctx.scale(this.scale, this.scale);
      ctx.translate(4, 4);
      drawTile(ctx, theme, t, variant);
      this.cache.set(k, c);
    }
    return c;
  }
}

/** variant bit 1: top exposed; bit 2: left exposed; bit 4: right exposed; bits 8+: hash. */
function drawTile(ctx: Ctx, theme: Theme, t: number, v: number) {
  const p = PALS[theme];
  const S = TILE;
  const top = (v & 1) !== 0;
  const hash = v >> 3;
  switch (t) {
    case T.GROUND: {
      ctx.fillStyle = p.fill;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = p.fillLine;
      ctx.lineWidth = 2;
      // earth with buried brick coursing
      for (let y = 12; y < S; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
        ctx.stroke();
        const off = (y / 12 + hash) % 2 ? 12 : 0;
        for (let x = off; x < S; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, y - 12);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      if (top) {
        if (theme === 'arena') {
          // polished concourse floor
          ctx.fillStyle = p.top;
          ctx.fillRect(0, 0, S, 16);
          ctx.fillStyle = p.lip;
          ctx.fillRect(0, 13, S, 4);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect((hash * 7) % 30, 5, 14, 2);
        } else {
          // brick pavers with a grass lip
          ctx.fillStyle = p.top;
          ctx.fillRect(0, 0, S, 15);
          ctx.strokeStyle = 'rgba(80,50,30,0.35)';
          ctx.lineWidth = 1.5;
          for (let x = (hash % 2) * 12; x < S; x += 24) {
            ctx.beginPath();
            ctx.moveTo(x, 2);
            ctx.lineTo(x, 15);
            ctx.stroke();
          }
          ctx.fillStyle = p.lip;
          ctx.fillRect(0, 14, S, 5);
          for (let x = 2; x < S; x += 6) ctx.fillRect(x, 18, 3, 2 + ((x + hash) % 3));
        }
        // bright readable edge
        ctx.fillStyle = p.topLight;
        ctx.fillRect(0, 0, S, 3);
      }
      break;
    }
    case T.BRICK:
    case T.PLANTER: {
      ctx.fillStyle = p.brick;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = p.brickLine;
      ctx.lineWidth = 1.6;
      for (let y = 0; y <= S; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
        ctx.stroke();
        const off = (y / 8) % 2 ? 8 : 0;
        for (let x = off; x < S; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 8);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, S, S / 2);
      if (t === T.PLANTER && top) {
        ctx.fillStyle = '#16883A';
        rr(ctx, -1, -6, S + 2, 14, 6);
        ctx.fill();
        ctx.fillStyle = '#4FD067';
        for (let x = 3; x < S; x += 9) {
          ctx.beginPath();
          ctx.arc(x, -2, 4, Math.PI, 0);
          ctx.fill();
        }
        ctx.fillStyle = p.topLight;
        ctx.fillRect(0, 7, S, 2);
      } else if (top) {
        ctx.fillStyle = p.trim;
        ctx.fillRect(0, 0, S, 3);
      }
      break;
    }
    case T.STONE: {
      ctx.fillStyle = p.stone;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = p.stoneLine;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, S - 2, S - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(2, S / 2, S - 4, S / 2 - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 4; i++) ctx.fillRect(((hash * 13 + i * 11) % 40) + 4, ((hash * 7 + i * 17) % 36) + 6, 2, 2);
      if (top) {
        ctx.fillStyle = p.trim;
        ctx.fillRect(0, 0, S, 4);
      }
      break;
    }
    case T.METAL: {
      ctx.fillStyle = '#3A393E';
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = '#1E1D21';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, S - 4, S - 4);
      ctx.fillStyle = '#8D8D93';
      for (const [x, y] of [
        [7, 7],
        [S - 7, 7],
        [7, S - 7],
        [S - 7, S - 7],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (top) {
        ctx.fillStyle = C.orange;
        ctx.fillRect(0, 0, S, 4);
      }
      break;
    }
    case T.WOOD: {
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, '#E9B878');
      g.addColorStop(1, '#C48A50');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(120,70,30,0.35)';
      ctx.lineWidth = 1;
      for (let y = 6; y < S; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const x = (hash * 17 + i * 19) % S;
        const y = 6 * (1 + ((hash + i) % 7));
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      if (top) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(0, 0, S, 3);
        if (hash % 5 === 0) {
          ctx.fillStyle = C.orange;
          ctx.fillRect(0, 8, S, 4);
        }
      }
      break;
    }
    case T.SEATS: {
      ctx.fillStyle = '#2A2226';
      ctx.fillRect(0, 10, S, 8);
      for (let x = 2; x < S; x += 16) {
        rr(ctx, x, -2, 13, 14, 3);
        ctx.fillStyle = C.orange;
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x + 2, 0, 9, 2);
      }
      ctx.fillStyle = p.trim;
      ctx.fillRect(0, 0, S, 2);
      break;
    }
    case T.ONEWAY: {
      // walkway plank with orange trim and brackets
      rr(ctx, 0, 0, S, 12, 2);
      ctx.fillStyle = C.woodLight;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.fillStyle = theme === 'plaza' ? C.orange : '#FF7A30';
      ctx.fillRect(0, 0, S, 3);
      ctx.strokeStyle = C.woodDark;
      ctx.beginPath();
      ctx.moveTo(S / 2, 3);
      ctx.lineTo(S / 2, 12);
      ctx.stroke();
      ctx.fillStyle = '#55555A';
      ctx.beginPath();
      ctx.moveTo(8, 12);
      ctx.lineTo(16, 12);
      ctx.lineTo(8, 22);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(S - 8, 12);
      ctx.lineTo(S - 16, 12);
      ctx.lineTo(S - 8, 22);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case T.STOOL: {
      ctx.save();
      ctx.translate(S / 2, 22);
      drawStool(ctx, S * 1.05);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,240,220,0.9)';
      ctx.fillRect(6, 0, S - 12, 2);
      break;
    }
    case T.CRATE:
    case T.CRATE_EMPTY: {
      ctx.save();
      ctx.translate(S / 2, S / 2);
      drawCrate(ctx, S, { star: t === T.CRATE && hash % 3 === 0, empty: t === T.CRATE_EMPTY });
      ctx.restore();
      break;
    }
    case T.BREAK: {
      rr(ctx, 1, 1, S - 2, S - 2, 4);
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, '#E07A4A');
      g.addColorStop(1, '#B2532A');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      // terracotta tile pattern
      ctx.strokeStyle = 'rgba(80,25,5,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(S / 2, 3);
      ctx.lineTo(S / 2, S - 3);
      ctx.moveTo(3, S / 2);
      ctx.lineTo(S - 3, S / 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,190,0.5)';
      ctx.beginPath();
      ctx.moveTo(6, 6);
      ctx.lineTo(S / 2 - 4, 6);
      ctx.moveTo(S / 2 + 4, S / 2 + 4);
      ctx.lineTo(S - 6, S / 2 + 4);
      ctx.stroke();
      // hairline cracks hint that it can break
      ctx.strokeStyle = 'rgba(60,20,5,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(10, S - 8);
      ctx.lineTo(16, S - 16);
      ctx.lineTo(13, S - 22);
      ctx.moveTo(S - 10, 10);
      ctx.lineTo(S - 16, 16);
      ctx.stroke();
      break;
    }
  }
}
