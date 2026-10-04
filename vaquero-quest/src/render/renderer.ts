import { MAX_DPR, RULES, TILE, VIEW_H, VIEW_W } from '../config';
import type { Backdrop } from '../levels/types';
import { PK } from '../game/particles';
import { T, isOneWay, isSolid } from '../game/tiles';
import type { World } from '../game/world';
import { drawBoss, drawEnemy, drawHero, drawPlayer } from './actors';
import { C, ICONS, IconCache, drawBasketball, drawLantern, drawVHand, makeCanvas, rr, starPath } from './art';
import { Backdrops } from './backdrop';
import {
  drawBouncer,
  drawCheckpoint,
  drawDecor,
  drawDoor,
  drawFinish,
  drawPlatform,
  drawProjectile,
  drawSign,
  drawSignBubble,
  drawSpikes,
  drawTrophy,
} from './props';
import { TileArt } from './tiles';

type Ctx = CanvasRenderingContext2D;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Toast {
  text: string;
  icon: string;
  t: number;
}

export class Renderer {
  readonly ctx: Ctx;
  pixelScale = 1;
  readonly icons = new IconCache();
  readonly tiles = new TileArt();
  readonly backdrops = new Backdrops();
  private dark: HTMLCanvasElement = makeCanvas(1, 1);
  private toasts: Toast[] = [];
  reducedMotion = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  /** Fit a 960×540 logical view into the window with letterboxing. */
  resize(availW: number, availH: number) {
    const scale = Math.min(availW / VIEW_W, availH / VIEW_H);
    const cssW = Math.floor(VIEW_W * scale);
    const cssH = Math.floor(VIEW_H * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const ps = Math.max(0.5, Math.round(scale * dpr * 4) / 4);
    this.canvas.width = Math.round(VIEW_W * ps);
    this.canvas.height = Math.round(VIEW_H * ps);
    this.pixelScale = ps;
    this.icons.setScale(ps);
    this.tiles.ensure(ps);
    this.backdrops.ensure(ps);
    this.dark = makeCanvas(VIEW_W * ps, VIEW_H * ps);
    return { cssW, cssH };
  }

  toast(text: string, icon = '') {
    this.toasts = this.toasts.filter((t) => t.text !== text);
    this.toasts.push({ text, icon, t: 0 });
    if (this.toasts.length > 2) this.toasts.shift();
  }
  clearToasts() {
    this.toasts = [];
  }

  icon = (ctx: Ctx, key: string, x: number, y: number, size: number) => {
    const f = ICONS[key];
    if (!f) {
      if (key === 'move' || key === 'jump') {
        ctx.fillStyle = C.ink;
        ctx.font = '900 15px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(key === 'move' ? '⇄' : '⤒', x, y + 1);
        ctx.textBaseline = 'alphabetic';
        return;
      }
      const alias: Record<string, string> = { bot: 'ball', weed: 'ball', cactus: 'star', turret: 'ball', spikes: 'star', platform: 'stool', door: 'emblem', bouncer: 'ball', pennant: 'emblem', boss: 'emblem' };
      const k = alias[key] ?? 'emblem';
      this.icons.blit(ctx, k, size, size, x, y, (c) => ICONS[k](c, size));
      return;
    }
    this.icons.blit(ctx, key, size, size, x, y, (c) => f(c, size));
  };

  // -------------------------------------------------------------------------
  drawTitle(time: number) {
    const ctx = this.ctx;
    ctx.setTransform(this.pixelScale, 0, 0, this.pixelScale, 0, 0);
    this.backdrops.drawTitle(ctx, time);
    // The hero, front and centre-left, waving the V.
    const anim = Math.floor(time / 3) % 2 === 0 ? 'idle' : 'victory';
    ctx.save();
    ctx.translate(100, 500);
    ctx.scale(2.6, 2.6);
    drawHero(ctx, { big: true, anim, facing: 1, landT: 0, starT: 0, stride: 0, vx: 0 }, 0, 0, time);
    ctx.restore();
  }

  drawWorld(w: World, alpha: number, time: number, realDt: number) {
    const ctx = this.ctx;
    const ps = this.pixelScale;
    const cam = w.camera;
    const camX = Math.round(lerp(cam.prevX, cam.x, alpha) * ps) / ps;
    const camY = Math.round(lerp(cam.prevY, cam.y, alpha) * ps) / ps;
    const shx = cam.shakeX;
    const shy = cam.shakeY;
    ctx.setTransform(ps, 0, 0, ps, 0, 0);
    ctx.imageSmoothingEnabled = true;

    // --- backdrop ---------------------------------------------------------------
    const levelW = w.def.w * TILE;
    // The distant Fieldhouse fades out as the foreground entrance (finish) comes into view.
    const fhAlpha = w.finishArt === 'arch' ? Math.max(0, Math.min(1, (w.finishX - camX - 1100) / 700)) : 1;
    if (w.zone.backdrop === 'secret') this.backdrops.draw(ctx, 'secret', camX, camY, time, levelW);
    else {
      const regs = w.def.backdrops;
      let idx = 0;
      for (let i = 0; i < regs.length; i++) if (regs[i].x0 <= camX) idx = i;
      const cur: Backdrop = regs[idx].backdrop;
      const next = regs[idx + 1];
      const split = next ? next.x0 - camX : Infinity;
      if (split < VIEW_W) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, split, VIEW_H);
        ctx.clip();
        this.backdrops.draw(ctx, cur, camX, camY, time, levelW, fhAlpha);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(split, 0, VIEW_W - split, VIEW_H);
        ctx.clip();
        this.backdrops.draw(ctx, next.backdrop, camX, camY, time, levelW, fhAlpha);
        ctx.restore();
      } else this.backdrops.draw(ctx, cur, camX, camY, time, levelW, fhAlpha);
    }

    ctx.save();
    ctx.translate(-camX + shx, -camY + shy);
    const vx0 = camX - 200;
    const vx1 = camX + VIEW_W + 200;
    const night = w.def.theme !== 'plaza';

    // --- decor, finish, markers ------------------------------------------------------------
    for (const d of w.decor) if (d.x > vx0 - 200 && d.x < vx1 + 200) drawDecor(ctx, d, d.x, d.y, time, night);
    if (w.finishX !== Infinity && w.finishX > vx0 - 300 && w.finishX < vx1 + 300) {
      const raised = w.status === 'finishing' || w.status === 'done' ? Math.min(1, w.statusT / 1.2) : 0;
      drawFinish(ctx, w.finishArt, w.finishX, w.finishY, time, raised);
    }
    for (const d of w.doors) if (d.x > vx0 && d.x < vx1) drawDoor(ctx, d, d.x, d.y, time);
    for (const c of w.checkpoints) if (c.x > vx0 && c.x < vx1) drawCheckpoint(ctx, c, c.x, c.y, time);
    for (const s of w.signs) if (s.x > vx0 && s.x < vx1) drawSign(ctx, s, s.x, s.y, this.icon);

    // --- tiles -----------------------------------------------------------------------------
    this.drawTiles(w, camX, camY, time);

    // --- platforms & hazards -------------------------------------------------------------------
    for (const p of w.platforms) drawPlatform(ctx, p, lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha));
    for (const s of w.spikes) if (s.x > vx0 && s.x < vx1) drawSpikes(ctx, s, s.x, s.y);
    for (const b of w.bouncers) if (b.cx > vx0 && b.cx < vx1) drawBouncer(ctx, b, b.cx, lerp(b.prevCy, b.cy, alpha));

    // --- items --------------------------------------------------------------------------
    for (const it of w.items) {
      if (it.hidden || it.x < vx0 || it.x > vx1) continue;
      const x = lerp(it.prevX, it.x, alpha) + it.w / 2;
      let y = lerp(it.prevY, it.y, alpha) + it.h / 2;
      if (it.state === 'idle' && it.kind !== 'ball') y += Math.sin(it.bob * 2.5) * 3;
      ctx.save();
      if (it.state === 'emerge') {
        ctx.beginPath();
        ctx.rect(x - 60, y - 200, 120, it.emergeFrom - (y - 200));
        ctx.clip();
      }
      if (it.ghost) ctx.globalAlpha = 0.45;
      if (it.kind === 'ball') drawBasketball(ctx, x, y, 14, time * 2 + it.x * 0.1);
      else {
        if (it.kind === 'emblem' || it.kind === 'hand' || it.kind === 'hand2' || it.kind === 'book') {
          const g = ctx.createRadialGradient(x, y, 4, x, y, 40);
          g.addColorStop(0, 'rgba(255,166,26,0.45)');
          g.addColorStop(1, 'rgba(255,166,26,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 40, y - 40, 80, 80);
        }
        if (it.kind === 'star') {
          ctx.translate(x, y);
          ctx.rotate(Math.sin(time * 6) * 0.25);
          this.icon(ctx, 'star', 0, 0, 36);
        } else if (it.kind === 'lantern') {
          ctx.translate(x, y);
          drawLantern(ctx, 34, 1, time);
        } else {
          const size = it.kind === 'hat' ? 42 : it.kind === 'emblem' ? 40 : 38;
          this.icon(ctx, it.kind, x, y, size);
        }
      }
      ctx.restore();
    }

    // --- enemies & boss -------------------------------------------------------------------
    for (const e of w.enemies) {
      if (e.x < vx0 || e.x > vx1) continue;
      drawEnemy(ctx, e, lerp(e.prevX, e.x, alpha), lerp(e.prevY, e.y, alpha), time);
    }
    const b = w.boss;
    if (b) {
      if (b.state === 'telegraph' && b.attack === 'lob')
        for (const m of b.markers) this.marker(ctx, m, b.floor, time);
      if (b.state === 'telegraph' && b.attack === 'slam') this.marker(ctx, b.slamTarget, b.floor, time);
      drawBoss(ctx, b, lerp(b.prevX, b.x, alpha), lerp(b.prevY, b.y, alpha), time);
    }

    // --- player & lasso ----------------------------------------------------------------------
    const p = w.player;
    const px = lerp(p.prevX, p.x, alpha) + p.w / 2;
    const py = lerp(p.prevY, p.y, alpha) + p.h;
    if (!p.dead && p.onGround) {
      ctx.beginPath();
      ctx.ellipse(px, py - 1, p.w * 0.6, 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fill();
    }
    if (w.lasso) this.drawLasso(ctx, w.lasso.x, w.lasso.y, w.lasso.dir, w.lasso.len, time);
    if (w.doorFade === 0 || w.doorFade > 0.5) drawPlayer(ctx, p, px, py, time);

    for (const pr of w.projectiles) drawProjectile(ctx, pr, lerp(pr.prevX, pr.x, alpha), lerp(pr.prevY, pr.y, alpha), time);
    if (w.trophy) drawTrophy(ctx, w.trophy.x, w.trophy.y, time);
    this.drawParticles(ctx, w);
    ctx.restore();

    // --- darkness -------------------------------------------------------------------------
    this.drawDarkness(w, camX - shx, camY - shy, px, py - p.h / 2, time);

    // --- screen-space overlays ---------------------------------------------------------------
    for (const s of w.signs) if (s.near > 0) drawSignBubble(ctx, s, s.x - camX, s.y - camY, VIEW_W);
    this.drawHud(w, time, realDt);
    if (w.doorFade > 0) {
      ctx.fillStyle = `rgba(10,8,8,${1 - Math.abs(w.doorFade - 0.5) * 2})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private marker(ctx: Ctx, x: number, floor: number, time: number) {
    const a = 0.5 + 0.5 * Math.sin(time * 14);
    ctx.beginPath();
    ctx.ellipse(x, floor - 3, 26, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,94,23,${0.3 + a * 0.4})`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.cream;
    ctx.stroke();
  }

  private drawLasso(ctx: Ctx, x: number, y: number, dir: number, len: number, time: number) {
    if (len < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + dir * 6, y);
    const segs = 10;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      ctx.lineTo(x + dir * (6 + len * t), y + Math.sin(t * 9 + time * 30) * 3 * (1 - t));
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#A06A3A';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + dir * (len + 10), y, 11, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#A06A3A';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  private drawTiles(w: World, camX: number, camY: number, time: number) {
    const ctx = this.ctx;
    const m = w.map;
    const theme = w.def.theme;
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(m.w - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const r1 = Math.min(m.h - 1, Math.floor((camY + VIEW_H) / TILE) + 1);
    const lantern = w.player.lanternT > 0;
    const pcx = w.player.cx;
    const pcy = w.player.y + w.player.h / 2;
    for (let ty = r0; ty <= r1; ty++) {
      for (let tx = c0; tx <= c1; tx++) {
        const t = m.data[ty * m.w + tx];
        if (t === T.EMPTY || t === T.BARRIER) continue;
        const x = tx * TILE;
        let y = ty * TILE;
        if (t === T.HIDDEN) {
          // A faint periodic twinkle is the discoverable clue; the lantern shows a dotted outline.
          const ph = (time + tx * 0.37) % 3.2;
          if (ph < 0.5) {
            const a = Math.sin((ph / 0.5) * Math.PI);
            ctx.save();
            ctx.translate(x + TILE / 2, y + TILE / 2);
            ctx.globalAlpha = a * 0.85;
            starPath(ctx, 0, 0, 7, 0.35);
            ctx.fillStyle = C.cream;
            ctx.fill();
            ctx.restore();
          }
          if (lantern && Math.hypot(x + TILE / 2 - pcx, y + TILE / 2 - pcy) < 300) {
            ctx.save();
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,166,26,0.9)';
            ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
            ctx.restore();
          }
          continue;
        }
        const bump = m.bumps.get(ty * m.w + tx);
        if (bump !== undefined) y -= Math.sin((1 - bump / 0.18) * Math.PI) * 7;
        const above = ty > 0 ? m.data[(ty - 1) * m.w + tx] : T.EMPTY;
        const exposed = !isSolid(above) || isOneWay(above);
        const hash = (tx * 7 + ty * 13) & 31;
        const v = (exposed ? 1 : 0) | (hash << 3);
        const img = this.tiles.get(theme, t, v);
        ctx.drawImage(img, x - 4, y - 4, TILE + 8, TILE + 8);
      }
    }
  }

  private drawParticles(ctx: Ctx, w: World) {
    for (const p of w.particles.list) {
      if (!p.on) continue;
      const a = Math.min(1, p.life / (p.max * 0.4));
      ctx.globalAlpha = a;
      switch (p.kind) {
        case PK.Dust:
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.4), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          break;
        case PK.Spark:
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case PK.Debris:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 2;
          ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
        case PK.Ball:
          drawBasketball(ctx, p.x, p.y, p.size, p.rot);
          break;
        case PK.Star:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          starPath(ctx, 0, 0, p.size);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.restore();
          break;
        case PK.Ring:
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (2 - a), 0, Math.PI * 2);
          ctx.lineWidth = 4 * a;
          ctx.strokeStyle = p.color;
          ctx.stroke();
          break;
        case PK.Confetti:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
          break;
        case PK.Text:
          ctx.font = '900 16px "Trebuchet MS", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 4;
          ctx.strokeStyle = C.ink;
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawDarkness(w: World, camX: number, camY: number, px: number, py: number, time: number) {
    const vis = w.def.darks.filter((d) => d.x < camX + VIEW_W && d.x + d.w > camX && d.y < camY + VIEW_H && d.y + d.h > camY);
    if (vis.length === 0) return;
    const ps = this.pixelScale;
    const dctx = this.dark.getContext('2d')!;
    dctx.setTransform(ps, 0, 0, ps, 0, 0);
    dctx.clearRect(0, 0, VIEW_W, VIEW_H);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = 'rgba(6,4,10,0.93)';
    for (const d of vis) {
      // soft edge on the left/right entry
      dctx.fillRect(d.x - camX, d.y - camY, d.w, d.h);
    }
    dctx.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number) => {
      const g = dctx.createRadialGradient(x, y, r * 0.25, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const lantern = w.player.lanternT > 0;
    const flick = Math.sin(time * 9) * 4;
    hole(px - camX, py - camY, (lantern ? 300 : 125) + flick);
    for (const d of w.decor) if (d.art === 'lantern') hole(d.x - camX, d.y - 20 - camY, 120);
    for (const it of w.items) if (it.kind === 'lantern') hole(it.x + it.w / 2 - camX, it.y - camY, 110);
    dctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.dark, 0, 0, VIEW_W, VIEW_H);
    if (lantern) {
      const g = this.ctx.createRadialGradient(px - camX, py - camY, 10, px - camX, py - camY, 300);
      g.addColorStop(0, 'rgba(255,166,26,0.14)');
      g.addColorStop(1, 'rgba(255,166,26,0)');
      this.ctx.fillStyle = g;
      this.ctx.fillRect(px - camX - 300, py - camY - 300, 600, 600);
    }
  }

  // -------------------------------------------------------------------------
  private card(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    rr(ctx, x + 3, y + 4, w, h, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    rr(ctx, x, y, w, h, 12);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }

  private drawHud(w: World, time: number, realDt: number) {
    const ctx = this.ctx;
    const run = w.run;
    ctx.textBaseline = 'middle';
    // Left card: level, balls, score, lives
    this.card(14, 12, 318, 58);
    ctx.fillStyle = C.orange;
    ctx.fillRect(26, 22, 4, 38);
    ctx.font = '800 12px "Trebuchet MS", Arial, sans-serif';
    ctx.fillStyle = C.orangeDark;
    ctx.textAlign = 'left';
    ctx.fillText(w.def.name.toUpperCase(), 38, 26);
    ctx.font = '900 20px "Trebuchet MS", Arial, sans-serif';
    ctx.fillStyle = C.ink;
    drawBasketball(ctx, 48, 50, 10, 0);
    ctx.fillText(`×${String(run.ballsTotal % RULES.ballsPerLife).padStart(2, '0')}`, 62, 51);
    ctx.fillText(String(run.score).padStart(7, '0'), 128, 51);
    this.icon(ctx, 'hatPlain', 252, 49, 30);
    ctx.fillText(`×${run.lives}`, 270, 51);

    // V emblem slots
    const ids = w.def.emblemIds;
    this.card(VIEW_W / 2 - 78, 12, 156, 52);
    for (let i = 0; i < 3; i++) {
      const got = w.session.rare.has(ids[i]);
      const x = VIEW_W / 2 - 46 + i * 46;
      if (!got) ctx.globalAlpha = 0.2;
      this.icon(ctx, got ? 'emblem' : 'emblemGhost', x, 38, 34);
      ctx.globalAlpha = 1;
    }

    // Right card: form, timers, lasso
    const p = w.player;
    const items: { key: string; frac?: number; count?: number; warn?: boolean }[] = [];
    items.push({ key: p.form === 'vaquero' ? 'hat' : 'hatPlain' });
    if (p.starT > 0) items.push({ key: 'star', frac: p.starT / RULES.starTime, warn: p.starT < RULES.starWarn });
    if (p.lanternT > 0) items.push({ key: 'lantern', frac: p.lanternT / RULES.lanternTime, warn: p.lanternT < 3 });
    if (p.lassoCharges > 0) items.push({ key: 'lasso', count: p.lassoCharges, frac: p.lassoCooldown > 0 ? 1 - p.lassoCooldown / RULES.lassoCooldown : undefined });
    const cw = 22 + items.length * 52;
    const cx0 = VIEW_W - 14 - cw;
    this.card(cx0, 12, cw, 52);
    items.forEach((it, i) => {
      const x = cx0 + 37 + i * 52;
      const y = 38;
      if (it.frac !== undefined) {
        ctx.beginPath();
        ctx.arc(x, y, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, it.frac)));
        ctx.strokeStyle = it.warn && Math.floor(time * 8) % 2 ? C.orange : C.green;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      this.icon(ctx, it.key, x, y, it.key === 'lantern' ? 30 : 32);
      if (it.count !== undefined) {
        ctx.font = '900 13px "Trebuchet MS", Arial, sans-serif';
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'right';
        ctx.fillText(`×${it.count}`, x + 24, y + 16);
      }
    });

    // Boss bar
    const b = w.boss;
    if (b && b.state !== 'dormant' && b.state !== 'dead') {
      this.card(VIEW_W / 2 - 130, VIEW_H - 54, 260, 40);
      ctx.font = '900 13px "Trebuchet MS", Arial, sans-serif';
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      ctx.fillText('REBOUNDER 3000', VIEW_W / 2 - 116, VIEW_H - 34);
      for (let i = 0; i < 3; i++) {
        rr(ctx, VIEW_W / 2 + 22 + i * 32, VIEW_H - 44, 26, 20, 5);
        ctx.fillStyle = i < b.hp ? C.orange : '#D8CFC2';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
      }
    }

    // Toasts
    for (let i = 0; i < this.toasts.length; i++) {
      const t = this.toasts[i];
      t.t += realDt;
      const life = 2.6;
      const a = Math.min(1, t.t / 0.15, (life - t.t) / 0.35);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '800 16px "Trebuchet MS", Arial, sans-serif';
      const tw = ctx.measureText(t.text).width + 64;
      const x = VIEW_W / 2 - tw / 2;
      const y = 78 + i * 46 - (1 - a) * 6;
      this.card(x, y, tw, 38);
      if (t.icon === 'hand' || t.icon === 'hand2') {
        ctx.save();
        ctx.translate(x + 24, y + 19);
        drawVHand(ctx, 22, t.icon === 'hand' ? 1 : 2);
        ctx.restore();
      } else this.icon(ctx, t.icon || 'emblem', x + 24, y + 19, 24);
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      ctx.fillText(t.text, x + 44, y + 20);
      ctx.restore();
    }
    this.toasts = this.toasts.filter((t) => t.t < 2.6);
    ctx.textBaseline = 'alphabetic';
  }
}
