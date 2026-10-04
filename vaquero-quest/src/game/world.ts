import { RULES, TILE, VIEW_H, VIEW_W } from '../config';
import { emptyInput, type InputState } from '../core/input';
import type { EntityDef, ItemKind, LevelDef, Zone } from '../levels/types';
import { Boss } from './boss';
import { Camera } from './camera';
import { Bouncer, Enemy, Item, MovingPlatform, Projectile, Spikes } from './entities';
import { Particles, PK } from './particles';
import { overlaps } from './physics';
import { Player } from './player';
import type { LevelSession, RunState, Snapshot } from './state';
import { T, TileMap, type CrateInfo } from './tiles';

export type Sfx =
  | 'jump'
  | 'bump'
  | 'thud'
  | 'coin'
  | 'reward'
  | 'power'
  | 'shrink'
  | 'stomp'
  | 'hurt'
  | 'death'
  | 'checkpoint'
  | 'secret'
  | 'break'
  | 'oneup'
  | 'star'
  | 'lasso'
  | 'kick'
  | 'boing'
  | 'door'
  | 'launch'
  | 'warn'
  | 'slam'
  | 'hatch'
  | 'bosshit'
  | 'win'
  | 'charge';

export interface WorldEvents {
  sfx(s: Sfx): void;
  toast(text: string, icon?: string): void;
  rare(rid: string, kind: ItemKind): void;
  book(rid: string): void;
  music(track: string): void;
}

export const NO_EVENTS: WorldEvents = { sfx() {}, toast() {}, rare() {}, book() {}, music() {} };

export interface Sign {
  x: number;
  y: number;
  text: string;
  icon: string;
  near: number; // 0..1 fade
}
export interface Door {
  x: number;
  y: number;
  id: string;
  target: string;
  glow: number;
}
export interface Checkpoint {
  uid: number;
  x: number;
  y: number;
  active: boolean;
  raise: number;
}
export interface Decor {
  x: number;
  y: number;
  art: string;
  scale: number;
}

export type WorldStatus = 'play' | 'dead' | 'finishing' | 'done' | 'gameover-wait';

/**
 * A running level: tiles, entities, player, camera and the rules that connect them.
 * Pure simulation (no DOM, no canvas) so it can run headless in tests.
 */
export class World {
  readonly map: TileMap;
  readonly player = new Player();
  readonly camera = new Camera();
  readonly particles = new Particles();
  items: Item[] = [];
  enemies: Enemy[] = [];
  platforms: MovingPlatform[] = [];
  spikes: Spikes[] = [];
  bouncers: Bouncer[] = [];
  projectiles: Projectile[] = [];
  signs: Sign[] = [];
  doors: Door[] = [];
  checkpoints: Checkpoint[] = [];
  decor: Decor[] = [];
  boss: Boss | null = null;
  finishX = Infinity;
  finishY = 0;
  finishArt = 'pennant';
  trophy: { x: number; y: number; t: number; landed: boolean } | null = null;
  lasso: { x: number; y: number; dir: number; len: number; max: number; t: number } | null = null;

  status: WorldStatus = 'play';
  statusT = 0;
  time = 0; // simulation clock (pauses with the game)
  zone: Zone;
  arenaLocked = false;
  consumed = new Set<number>();
  revealed = new Set<number>();
  crateCD = new Map<number, number>();
  stompChain = 0;
  levelBalls = 0;
  enemiesDefeated = 0;
  checkpointUid = -1;
  spawn: { x: number; y: number };
  /** A door transition in progress (fade); target position applied at the midpoint. */
  doorFade = 0;
  private doorTarget: Door | null = null;
  hintCooldown = 0;
  private input: InputState = emptyInput();

  constructor(
    readonly def: LevelDef,
    readonly run: RunState,
    readonly session: LevelSession,
    readonly savedRare: ReadonlySet<string>,
    readonly ev: WorldEvents = NO_EVENTS,
    snap?: Snapshot,
  ) {
    this.map = new TileMap(def.w, def.h, new Uint8Array(snap ? snap.tiles : def.tiles));
    for (const [k, v] of snap ? snap.crates : def.crates) this.map.crates.set(k, { ...v });
    if (snap) {
      for (const u of snap.consumed) this.consumed.add(u);
      for (const u of snap.revealed) this.revealed.add(u);
      run.score = snap.score;
      run.ballsTotal = snap.ballsTotal;
      run.lassoCharges = snap.lassoCharges;
      this.levelBalls = snap.levelBalls;
      this.enemiesDefeated = snap.enemiesDefeated;
      this.checkpointUid = snap.checkpoint;
    }
    this.spawn = snap ? snap.spawn : def.spawn;
    this.zone = def.zones[0];
    for (const e of def.entities) this.spawnEntity(e);
    this.player.place(this.spawn.x, this.spawn.y);
    if (run.form === 'vaquero') this.player.tryGrow(this.map);
    this.player.lassoCharges = run.lassoCharges;
    this.zone = this.zoneFor(this.player.cx, this.player.y);
    this.camera.snap(this.player, this.zone);
  }

  private spawnEntity(e: EntityDef) {
    if (this.consumed.has(e.uid)) {
      if (e.kind === 'checkpoint') this.checkpoints.push({ uid: e.uid, x: e.x, y: e.y, active: true, raise: 1 });
      return;
    }
    switch (e.kind) {
      case 'ball':
      case 'hat':
      case 'star':
      case 'lantern':
      case 'lasso':
      case 'emblem':
      case 'hand':
      case 'hand2':
      case 'book': {
        if (e.rid && this.session.rare.has(e.rid)) return; // already found this attempt: never duplicated
        const it = new Item(e.kind, e.x, e.y, e.uid, e.rid);
        if (e.rid && this.savedRare.has(e.rid)) it.ghost = true;
        if (e.lanternHidden && !this.revealed.has(e.uid)) it.hidden = true;
        this.items.push(it);
        break;
      }
      case 'bot':
      case 'weed':
      case 'cactus':
      case 'turret':
        this.enemies.push(new Enemy(e.kind, e.x, e.y, e.uid, e.dir ?? -1, e.ledgeAware ?? false));
        break;
      case 'platform':
        this.platforms.push(new MovingPlatform(e.uid, e.x, e.y, e.w ?? 2, e.dx ?? 0, e.dy ?? 0, e.period ?? 4, e.phase ?? 0));
        break;
      case 'spikes':
        this.spikes.push(new Spikes(e.x, e.y, e.w ?? 1, e.phase ?? 0));
        break;
      case 'bouncer':
        this.bouncers.push(new Bouncer(e.x, e.y, e.dy ?? 3 * TILE, e.phase ?? 0));
        break;
      case 'sign':
        this.signs.push({ x: e.x, y: e.y, text: e.text ?? '', icon: e.icon ?? '', near: 0 });
        break;
      case 'door':
        this.doors.push({ x: e.x, y: e.y, id: e.door ?? '', target: e.target ?? '', glow: 0 });
        break;
      case 'checkpoint':
        this.checkpoints.push({ uid: e.uid, x: e.x, y: e.y, active: false, raise: 0 });
        break;
      case 'finish':
        this.finishX = e.x;
        this.finishY = e.y;
        this.finishArt = e.art ?? 'pennant';
        break;
      case 'boss': {
        const a = this.def.arena!;
        this.boss = new Boss(e.x, e.y, a.x0, a.x1);
        break;
      }
      case 'decor':
        this.decor.push({ x: e.x, y: e.y, art: e.art ?? 'palm', scale: e.scale ?? 1 });
        break;
    }
  }

  zoneFor(x: number, y: number): Zone {
    for (const z of this.def.zones) if (x >= z.x0 && x < z.x1 && y < z.y1 + 200) return z;
    return this.def.zones[0];
  }

  /** Snapshot for checkpoint retry; deliberately excludes rare ids (kept in the session union). */
  snapshot(spawn: { x: number; y: number }, checkpointUid: number): Snapshot {
    const consumed = new Set(this.consumed);
    return {
      tiles: new Uint8Array(this.map.data),
      crates: [...this.map.crates.entries()].map(([k, v]) => [k, { ...v }] as [number, CrateInfo]),
      consumed: [...consumed],
      revealed: [...this.revealed],
      score: this.run.score,
      ballsTotal: this.run.ballsTotal,
      levelBalls: this.levelBalls,
      enemiesDefeated: this.enemiesDefeated,
      lassoCharges: this.player.lassoCharges,
      checkpoint: checkpointUid,
      spawn: { ...spawn },
    };
  }
  /** Latest snapshot taken by a checkpoint, read by the game. */
  lastSnapshot: Snapshot | null = null;

  // ------------------------------------------------------------------------
  update(dt: number, inp: InputState) {
    this.input = inp;
    this.time += dt;
    this.statusT += dt;
    this.particles.update(dt);
    for (const [k, v] of this.map.bumps) {
      if (v - dt <= 0) this.map.bumps.delete(k);
      else this.map.bumps.set(k, v - dt);
    }
    for (const [k, v] of this.crateCD) {
      if (v - dt <= 0) this.crateCD.delete(k);
      else this.crateCD.set(k, v - dt);
    }
    if (this.hintCooldown > 0) this.hintCooldown -= dt;

    if (this.status === 'dead') {
      const p = this.player;
      p.prevX = p.x;
      p.prevY = p.y;
      p.deathT += dt;
      if (p.deathT > 0.45) {
        p.vy = Math.min(p.vy + 1700 * dt, 900);
        p.y += p.vy * dt;
      }
      this.camera.prevX = this.camera.x;
      this.camera.prevY = this.camera.y;
      return;
    }
    if (this.doorFade > 0) {
      this.updateDoorFade(dt);
      return;
    }

    const p = this.player;
    for (const pl of this.platforms) pl.update(this.time);

    // Ride moving platforms: carry before the player's own move.
    if (p.platform && p.onGround) {
      const pl = p.platform as MovingPlatform;
      stepCarry(this, p, pl.dxStep);
      const ny = pl.y - p.h;
      if (!this.map.boxHitsSolid(p.x, ny, p.w, p.h)) p.y = ny;
    }

    const inpEff = this.status === 'finishing' ? this.autoInput() : inp;
    const r = p.step(dt, inpEff, this.map, this.platforms);
    if (p.onGround) this.stompChain = 0;
    if (p.justJumped) this.ev.sfx('jump');
    if (r.head) this.hitBlock(r.head.tx, r.head.ty);

    if (p.starT > 0) {
      p.starT -= dt;
      if (Math.random() < 0.5) this.particles.spawn(PK.Star, p.cx + (Math.random() - 0.5) * p.w, p.y + Math.random() * p.h, 0, -20, 0.4, 5, Math.random() < 0.5 ? '#00C21D' : '#FF5E17');
    }
    if (p.lanternT > 0) p.lanternT -= dt;
    this.run.lassoCharges = p.lassoCharges;

    if (this.status === 'play') {
      this.updateLasso(dt, inp);
      this.collectItems();
    }
    for (const it of this.items) if (it.state !== 'idle' || it.kind !== 'ball') it.update(dt, this.map, this.platforms);
    this.items = this.items.filter((i) => i.alive);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateBoss(dt);
    this.updateMarkers(dt, inp);

    // Pits.
    if (p.y > this.map.h * TILE + 40 && this.status === 'play') this.die(true);

    this.zone = this.arenaLocked ? this.arenaZone() : this.zoneFor(p.cx, p.y);
    this.camera.update(dt, p, this.zone);

    if (this.status === 'finishing' && this.statusT > 3.2) this.status = 'done';
  }

  private autoInput(): InputState {
    const s = emptyInput();
    const p = this.player;
    if (this.finishArt !== 'trophy' && p.cx < this.finishX + 60 && this.statusT < 2.2) s.right = true;
    return s;
  }

  private arenaZone(): Zone {
    const a = this.def.arena!;
    return { x0: a.x0, x1: a.x1, y0: this.zone.y0, y1: this.zone.y1, backdrop: 'arena' };
  }

  // ------------------------------------------------------------------------
  hitBlock(tx: number, ty: number) {
    const p = this.player;
    const t = this.map.get(tx, ty);
    const key = this.map.key(tx, ty);
    const top = ty * TILE;
    if (t === T.HIDDEN) {
      this.map.set(tx, ty, T.CRATE);
      this.ev.sfx('secret');
      this.particles.burst(PK.Spark, (tx + 0.5) * TILE, (ty + 0.5) * TILE, 14, 160, 0.5, 4, '#FFA61A');
    }
    const t2 = this.map.get(tx, ty);
    if (t2 === T.CRATE) {
      if (this.crateCD.has(key)) return;
      this.crateCD.set(key, RULES.crateCooldown);
      this.map.bumps.set(key, 0.18);
      const info = this.map.crates.get(key);
      this.ev.sfx('bump');
      if (info && info.remaining > 0) {
        this.dispense(info, tx, ty);
        info.remaining--;
      }
      if (!info || info.remaining <= 0) this.map.set(tx, ty, T.CRATE_EMPTY);
      this.run.score += RULES.scoreCrate;
    } else if (t2 === T.BREAK) {
      if (p.form === 'vaquero') {
        this.map.set(tx, ty, T.EMPTY);
        this.ev.sfx('break');
        this.camera.shake(2, 0.12);
        for (let i = 0; i < 4; i++) {
          const sx = i % 2 ? 1 : -1;
          this.particles.spawn(PK.Debris, (tx + 0.5) * TILE + sx * 10, (ty + 0.3 + (i > 1 ? 0.4 : 0)) * TILE, sx * (90 + Math.random() * 60), -380 - (i > 1 ? 0 : 160), 1.2, 14, '#C8643A', 1800);
        }
        this.run.score += 50;
      } else {
        this.map.bumps.set(key, 0.18);
        this.ev.sfx('bump');
      }
    } else if (t2 === T.CRATE_EMPTY) {
      this.map.bumps.set(key, 0.12);
      this.ev.sfx('thud');
    } else this.ev.sfx('thud');

    // Anything standing on the struck block gets knocked.
    for (const e of this.enemies) {
      if (!e.alive || e.dead || e.state === 'dormant') continue;
      const b = e.y + e.h;
      if (b >= top - 6 && b <= top + 3 && e.x + e.w > tx * TILE && e.x < (tx + 1) * TILE) this.defeat(e, 'flip', e.x + e.w / 2 < (tx + 0.5) * TILE ? -1 : 1);
    }
    for (const it of this.items) {
      const b = it.y + it.h;
      if (b < top - 8 || b > top + 3 || it.x + it.w <= tx * TILE || it.x >= (tx + 1) * TILE) continue;
      if (it.kind === 'ball' && !it.hidden) this.collect(it);
      else if (it.state === 'move') {
        it.vy = -420;
        it.dir = it.x + it.w / 2 < (tx + 0.5) * TILE ? -1 : 1;
      }
    }
  }

  private dispense(info: CrateInfo, tx: number, ty: number) {
    const cx = (tx + 0.5) * TILE;
    const top = ty * TILE;
    let reward = info.reward;
    if (info.id && this.session.rare.has(info.id)) reward = 'ball'; // already found this attempt
    if (reward === 'ball' || reward === 'none') {
      if (reward === 'ball') {
        this.addBalls(1);
        this.ev.sfx('coin');
        const pt = this.particles.spawn(PK.Ball, cx, top - 10, 0, -560, 0.55, 16, '#FF5E17', 1700);
        pt.vr = 14;
        this.particles.text(cx, top - 60, '+100');
      }
      return;
    }
    this.ev.sfx('reward');
    const it = new Item(reward, cx, top - 20, -1, info.id);
    if (info.id && this.savedRare.has(info.id)) it.ghost = true;
    it.emerge(top);
    it.dir = this.player.cx < cx ? 1 : -1; // power-ups slide away from the player first
    if (reward === 'hat') it.dir = 1;
    this.items.push(it);
  }

  addBalls(n: number) {
    this.run.ballsTotal += n;
    this.levelBalls += n;
    this.run.score += RULES.scoreBall * n;
    const earned = Math.floor(this.run.ballsTotal / RULES.ballsPerLife);
    if (earned > this.run.oneUps) {
      this.run.oneUps = earned;
      this.run.lives++;
      this.ev.sfx('oneup');
      this.ev.toast('100 basketballs! Extra life', 'ball');
      const p = this.player;
      this.particles.text(p.cx, p.y - 30, '1-UP', '#00C21D');
      for (let i = 0; i < 16; i++) this.particles.spawn(PK.Ball, p.cx, p.y, (Math.random() - 0.5) * 420, -300 - Math.random() * 380, 1.1, 12, '#FF5E17', 1400);
    }
  }

  // ------------------------------------------------------------------------
  private collectItems() {
    const p = this.player;
    for (const it of this.items) {
      if (!it.alive || it.hidden || it.state === 'emerge') continue;
      if (overlaps(p, it)) this.collect(it);
    }
  }

  collect(it: Item) {
    if (!it.alive) return;
    const p = this.player;
    it.alive = false;
    if (it.uid >= 0) this.consumed.add(it.uid);
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    switch (it.kind) {
      case 'ball':
        this.addBalls(1);
        this.ev.sfx('coin');
        this.particles.burst(PK.Spark, cx, cy, 6, 110, 0.3, 3, '#FFA61A');
        break;
      case 'hat':
        if (p.form === 'rookie') {
          const grown = p.tryGrow(this.map);
          this.ev.sfx('power');
          this.ev.toast(grown ? 'Vaquero form! One extra hit' : 'Vaquero form when there is headroom', 'hat');
          this.particles.burst(PK.Star, p.cx, p.y + 10, 14, 200, 0.6, 6, '#00C21D');
          this.run.score += 1000;
        } else {
          this.run.score += RULES.scoreHatDuplicate;
          this.ev.sfx('reward');
          this.particles.text(cx, cy - 20, `+${RULES.scoreHatDuplicate} HAT BONUS`, '#FFA61A');
        }
        break;
      case 'star':
        p.starT = RULES.starTime;
        this.run.score += RULES.scoreStar;
        this.ev.sfx('star');
        this.ev.toast('Green Star! Enemies fall on contact', 'star');
        break;
      case 'lantern':
        p.lanternT = RULES.lanternTime;
        this.run.score += RULES.scoreLantern;
        this.ev.sfx('power');
        this.ev.toast('Lantern lit: reveals hidden things nearby', 'lantern');
        break;
      case 'lasso':
        p.lassoCharges = Math.min(RULES.lassoMax, p.lassoCharges + RULES.lassoPerPickup);
        this.run.lassoCharges = p.lassoCharges;
        this.run.score += RULES.scoreLasso;
        this.ev.sfx('power');
        this.ev.toast(`Lasso x${RULES.lassoPerPickup}: press C or the lasso button`, 'lasso');
        break;
      case 'emblem':
      case 'hand':
      case 'hand2':
      case 'book': {
        const rid = it.rid!;
        const fresh = !this.session.rare.has(rid);
        this.session.rare.add(rid);
        if (fresh) {
          const pts = it.kind === 'emblem' ? RULES.scoreEmblem : it.kind === 'hand' ? RULES.scoreHand : it.kind === 'hand2' ? RULES.scoreHandRare : RULES.scoreBook;
          this.run.score += pts;
          this.particles.text(cx, cy - 24, `+${pts}`, '#FFA61A');
        }
        this.ev.rare(rid, it.kind);
        if (it.kind === 'book') this.ev.book(rid);
        this.ev.sfx('secret');
        this.particles.burst(PK.Ring, cx, cy, 1, 0, 0.5, 40, '#FFA61A');
        this.particles.burst(PK.Star, cx, cy, 18, 260, 0.8, 6, it.kind === 'emblem' ? '#FF5E17' : '#00C21D');
        if (it.kind === 'emblem') {
          const n = this.def.emblemIds.filter((id) => this.session.rare.has(id)).length;
          this.ev.toast(`V Emblem ${n}/3`, 'emblem');
        } else if (it.kind === 'hand' || it.kind === 'hand2') this.ev.toast(it.kind === 'hand2' ? 'Rare Spirit Hand! +2000' : 'V Spirit Hand! +1000', it.kind);
        break;
      }
    }
  }

  // ------------------------------------------------------------------------
  private updateLasso(dt: number, inp: InputState) {
    const p = this.player;
    if (inp.actionPressed && p.lassoCharges > 0 && p.lassoCooldown <= 0 && !this.lasso && !p.dead) {
      p.lassoCharges--;
      p.lassoCooldown = RULES.lassoCooldown;
      p.lassoT = 0.32;
      const y = p.y + Math.min(22, p.h * 0.4);
      // The rope stops at the first solid tile.
      let max = RULES.lassoRange;
      for (let d = 0; d <= RULES.lassoRange; d += 6) {
        const x = p.cx + p.facing * d;
        if (this.map.solidAt(Math.floor(x / TILE), Math.floor(y / TILE))) {
          max = d;
          break;
        }
      }
      this.lasso = { x: p.cx, y, dir: p.facing, len: 0, max, t: 0 };
      this.ev.sfx('lasso');
    } else if (inp.actionPressed && p.lassoCharges === 0 && this.hintCooldown <= 0) {
      this.hintCooldown = 3;
      this.ev.toast('No lasso charges: find a lasso', 'lasso');
    }
    const l = this.lasso;
    if (!l) return;
    l.t += dt;
    const out = 0.16;
    l.x = p.cx;
    l.y = p.y + Math.min(22, p.h * 0.4);
    l.len = l.t < out ? (l.t / out) * l.max : Math.max(0, (1 - (l.t - out) / 0.16) * l.max);
    if (l.t >= out + 0.16) {
      this.lasso = null;
      return;
    }
    // Hit test along the rope.
    const x0 = l.dir > 0 ? l.x : l.x - l.len;
    const box = { x: x0, y: l.y - 12, w: l.len, h: 24 };
    for (const e of this.enemies) {
      if (!e.alive || e.dead || e.state === 'stunned') continue;
      if (!overlaps(box, e)) continue;
      if (e.spec.spiky) {
        e.stun();
        this.ev.sfx('kick');
        this.particles.text(e.x + e.w / 2, e.y - 10, 'STUNNED', '#FFF8EC');
      } else this.defeat(e, 'flip', l.dir);
    }
    for (const pr of this.projectiles) if (pr.kind !== 'wave' && overlaps(box, pr.box())) pr.alive = false;
    if (this.boss && this.boss.exposed && overlaps(box, this.boss.bodyBox())) this.hitBoss();
  }

  // ------------------------------------------------------------------------
  private updateEnemies(dt: number) {
    const p = this.player;
    const cam = this.camera;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.state === 'dormant' && e.x < cam.x + VIEW_W + 40 && e.x + e.w > cam.x - 120) e.activate();
      const onScreen = e.x + e.w > cam.x && e.x < cam.x + VIEW_W && e.y < cam.y + VIEW_H && e.y + e.h > cam.y;
      if (e.update(dt, this.map, p.cx, onScreen)) {
        const dir = e.dir;
        this.projectiles.push(new Projectile('foam', e.x + e.w / 2 + dir * 26, e.y + 16, dir * 190, 0, 0, 11));
        this.ev.sfx('launch');
      }
      // Rolling tumbleweeds that leave the area are cleaned up.
      if (e.kind === 'weed' && e.state === 'active' && (e.x < cam.x - 700 || e.x > cam.x + VIEW_W + 700)) e.alive = false;
      if (!e.alive || e.dead || this.status !== 'play' || p.dead) continue;
      if (!overlaps(p, e)) continue;
      if (p.starT > 0) {
        this.defeat(e, 'flip', p.cx < e.x + e.w / 2 ? 1 : -1);
        continue;
      }
      const fromAbove = p.vy > 0 && p.prevBottom <= e.prevY + 10;
      if (e.state === 'stunned') {
        if (fromAbove) {
          this.defeat(e, 'squash', 0);
          this.bounce();
        }
        continue; // stunned enemies are harmless
      }
      if (fromAbove && e.spec.stompable) {
        this.defeat(e, 'squash', 0);
        this.bounce();
        p.y = e.y - p.h;
      } else this.damage(p.cx < e.x + e.w / 2 ? -1 : 1);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private bounce() {
    const p = this.player;
    const held = this.input.jump;
    p.vy = -(held ? 650 : 430);
    p.jumping = true;
    p.jumpCutDone = !held;
    p.onGround = false;
  }

  defeat(e: Enemy, how: 'squash' | 'flip', dir: number) {
    if (e.dead) return;
    if (e.uid >= 0) this.consumed.add(e.uid);
    this.enemiesDefeated++;
    this.stompChain++;
    const pts = RULES.scoreStomp * Math.min(8, Math.max(1, this.stompChain));
    this.run.score += pts;
    this.particles.text(e.x + e.w / 2, e.y - 8, `+${pts}`);
    if (how === 'squash') {
      e.squash();
      this.ev.sfx('stomp');
      this.particles.burst(PK.Dust, e.x + e.w / 2, e.y + e.h, 8, 120, 0.4, 7, '#E8D8C0');
    } else {
      e.flip(dir || 1);
      this.ev.sfx('kick');
      this.particles.burst(PK.Spark, e.x + e.w / 2, e.y + e.h / 2, 10, 200, 0.35, 4, '#FFA61A');
    }
    this.camera.shake(2, 0.1);
  }

  damage(fromDir: number) {
    const p = this.player;
    if (p.dead || p.invulnT > 0 || p.starT > 0 || this.status !== 'play') return;
    if (p.form === 'vaquero') {
      p.shrink();
      this.run.form = 'rookie';
      p.invulnT = RULES.invulnTime;
      p.hurtT = 0.35;
      p.vx = fromDir * 170;
      p.vy = -260;
      p.onGround = false;
      this.ev.sfx('shrink');
      this.camera.shake(4, 0.2);
      this.ev.toast('Hat lost! Find another to power up', 'hat');
    } else this.die(false);
  }

  die(pit: boolean) {
    if (this.status !== 'play') return;
    const p = this.player;
    this.status = 'dead';
    this.statusT = 0;
    p.dead = true;
    p.anim = 'death';
    p.deathT = 0;
    p.vx = 0;
    p.vy = pit ? -200 : -640;
    p.starT = 0;
    this.lasso = null;
    if (p.form === 'vaquero') p.shrink();
    this.run.form = 'rookie';
    this.ev.sfx('death');
    this.ev.music('');
    this.camera.shake(5, 0.25);
  }

  // ------------------------------------------------------------------------
  private updateProjectiles(dt: number) {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.update(dt, this.map);
      if (!pr.alive || this.status !== 'play') continue;
      if (overlaps(p, pr.box())) {
        if (p.starT > 0) {
          pr.alive = false;
          this.particles.burst(PK.Spark, pr.x, pr.y, 8, 140, 0.3, 4, '#FFF8EC');
        } else {
          if (pr.kind !== 'wave') pr.alive = false;
          this.damage(p.cx < pr.x ? -1 : 1);
        }
      }
      if (!pr.alive && pr.kind !== 'wave') this.particles.burst(PK.Dust, pr.x, pr.y, 6, 90, 0.3, 6, '#FFD7B8');
    }
    this.projectiles = this.projectiles.filter((x) => x.alive);
  }

  private updateHazards(dt: number) {
    const p = this.player;
    for (const s of this.spikes) {
      s.update(this.time);
      if (s.harmful && this.status === 'play' && overlaps(p, s.box())) this.damage(p.cx < s.x + (s.n * TILE) / 2 ? -1 : 1);
    }
    for (const b of this.bouncers) {
      b.update(this.time, dt);
      if (this.status !== 'play') continue;
      const bx = b.box();
      if (!overlaps(p, bx)) continue;
      if (p.vy >= -50 && p.prevBottom <= b.prevCy - b.r + 12) {
        p.y = b.cy - b.r - p.h;
        p.vy = this.input.jump ? -900 : -760;
        p.jumping = true;
        p.jumpCutDone = true;
        p.onGround = false;
        this.ev.sfx('boing');
        this.particles.burst(PK.Spark, b.cx, b.cy - b.r, 8, 140, 0.3, 4, '#FFA61A');
      } else {
        // Safe side push: never damages.
        const dir = p.cx < b.cx ? -1 : 1;
        const nx = dir < 0 ? bx.x - p.w - 0.5 : bx.x + bx.w + 0.5;
        if (!this.map.boxHitsSolid(nx, p.y, p.w, p.h)) p.x = nx;
        p.vx = dir * 160;
      }
    }
  }

  // ------------------------------------------------------------------------
  private updateBoss(dt: number) {
    const b = this.boss;
    const a = this.def.arena;
    const p = this.player;
    if (!b || !a) return;
    if (!this.arenaLocked && b.state === 'dormant' && p.x > a.trigger && this.status === 'play') {
      this.arenaLocked = true;
      for (let y = 0; y < this.map.h; y++) {
        if (!this.map.solidAt(a.gateL, y)) this.map.set(a.gateL, y, T.BARRIER);
        if (!this.map.solidAt(a.gateR, y)) this.map.set(a.gateR, y, T.BARRIER);
      }
      b.start();
      this.ev.music('boss');
      this.ev.toast('THE REBOUNDER 3000: stomp its core when the hatch opens!', 'boss');
    }
    b.update(dt, p.cx);
    const o = b.out;
    if (o.shake) this.camera.shake(o.shake, 0.3);
    for (const s of o.sfx) this.ev.sfx(s as Sfx);
    for (const l of o.lobs) {
      const T_ = 1.15;
      const g = 1400;
      const ty = b.floor - 12;
      const vx = (l.tx - l.x) / T_;
      const vy = (ty - l.y - 0.5 * g * T_ * T_) / T_;
      this.projectiles.push(new Projectile('lob', l.x, l.y, vx, vy, g, 13));
    }
    for (const w of o.waves) {
      const dir = w.x < b.cx ? -1 : 1;
      this.projectiles.push(new Projectile('wave', w.x, w.y, dir * 270 * b.speedUp, 0, 0, 16));
    }
    if (b.state === 'dying' && Math.random() < dt * 20) {
      this.particles.burst(PK.Ball, b.x + Math.random() * b.w, b.y + Math.random() * b.h, 2, 320, 1, 12, '#FF5E17', 1200, 200);
      this.particles.burst(PK.Spark, b.x + Math.random() * b.w, b.y + Math.random() * b.h, 6, 200, 0.4, 5, '#FFA61A');
    }
    if (b.state === 'dead' && !this.trophy) {
      this.trophy = { x: (a.x0 + a.x1) / 2, y: b.floor - 420, t: 0, landed: false };
      this.run.score += RULES.scoreBoss;
      this.ev.sfx('win');
      this.ev.music('victory');
      this.ev.toast('Machine down! Grab the giant V at center court', 'emblem');
      this.projectiles = [];
    }
    if (this.status !== 'play' || p.dead || b.state === 'dead' || b.state === 'dormant') return;
    // Player vs boss.
    const core = b.coreBox();
    const body = b.bodyBox();
    const falling = p.vy > 0 && p.prevBottom <= b.prevY + 14;
    if (falling && overlaps(p, { x: b.x + 10, y: b.y - 16, w: b.w - 20, h: 30 })) {
      if (b.exposed && overlaps(p, core)) this.hitBoss();
      else {
        this.ev.sfx('thud');
      }
      p.y = b.y - p.h - 1;
      this.bounce();
      p.vy = Math.min(p.vy, -520);
      return;
    }
    if (b.harmful && overlaps(p, body)) {
      if (p.starT > 0) return;
      this.damage(p.cx < b.cx ? -1 : 1);
      // Push out so the player is never stuck inside the machine.
      if (!p.dead) {
        const nx = p.cx < b.cx ? b.x - p.w - 2 : b.x + b.w + 2;
        if (!this.map.boxHitsSolid(nx, p.y, p.w, p.h)) p.x = nx;
      }
    }
  }

  private hitBoss() {
    const b = this.boss!;
    if (!b.hit()) return;
    this.run.score += RULES.scoreBossHit;
    this.ev.sfx('bosshit');
    this.camera.shake(7, 0.35);
    this.particles.burst(PK.Star, b.cx, b.y, 24, 320, 0.8, 7, '#00C21D');
    this.particles.text(b.cx, b.y - 40, b.hp > 0 ? `${b.hp} HIT${b.hp > 1 ? 'S' : ''} LEFT` : 'OVERHEAT!', '#FFA61A');
    this.projectiles = this.projectiles.filter((x) => x.kind !== 'lob');
  }

  // ------------------------------------------------------------------------
  private updateMarkers(dt: number, inp: InputState) {
    const p = this.player;
    for (const s of this.signs) {
      const near = Math.abs(s.x - p.cx) < 80 && Math.abs(s.y - p.bottom) < 120;
      s.near = Math.max(0, Math.min(1, s.near + (near ? dt * 6 : -dt * 4)));
    }
    for (const c of this.checkpoints) {
      if (c.active) {
        c.raise = Math.min(1, c.raise + dt * 2);
        continue;
      }
      if (this.status === 'play' && Math.abs(p.cx - c.x) < 30 && p.bottom > c.y - 160 && p.y < c.y) {
        c.active = true;
        this.consumed.add(c.uid);
        this.checkpointUid = c.uid;
        this.ev.sfx('checkpoint');
        this.ev.toast('Checkpoint!', 'pennant');
        this.particles.burst(PK.Confetti, c.x, c.y - 120, 24, 260, 1.1, 6, '#FF5E17', 500);
        this.lastSnapshot = this.snapshot({ x: c.x, y: c.y }, c.uid);
      }
    }
    for (const d of this.doors) {
      const near = Math.abs(d.x - p.cx) < 28 && p.bottom <= d.y + 2 && p.bottom > d.y - 90;
      d.glow = Math.max(0, Math.min(1, d.glow + (near ? dt * 5 : -dt * 3)));
      if (near && inp.upPressed && p.onGround && this.status === 'play') {
        const target = this.doors.find((o) => o.id === d.target);
        if (target) {
          this.doorTarget = target;
          this.doorFade = 0.001;
          this.ev.sfx('door');
        }
      }
    }
    // Lantern reveals hidden collectibles nearby.
    if (p.lanternT > 0) {
      for (const it of this.items) {
        if (!it.hidden) continue;
        const d = Math.hypot(it.x + it.w / 2 - p.cx, it.y + it.h / 2 - (p.y + p.h / 2));
        if (d < 230) {
          it.hidden = false;
          if (it.uid >= 0) this.revealed.add(it.uid);
          this.particles.burst(PK.Spark, it.x + it.w / 2, it.y + it.h / 2, 8, 90, 0.4, 3, '#FFA61A');
        }
      }
    }
    // Finish.
    if (this.status === 'play') {
      if (this.trophy) {
        const tr = this.trophy;
        tr.t += dt;
        if (!tr.landed) {
          tr.y += 260 * dt;
          if (tr.y >= this.boss!.floor - 70) {
            tr.y = this.boss!.floor - 70;
            tr.landed = true;
            this.camera.shake(4, 0.2);
          }
        }
        if (tr.landed && overlaps(p, { x: tr.x - 50, y: tr.y - 60, w: 100, h: 130 })) this.finish();
      } else if (p.cx >= this.finishX - 12 && this.finishX !== Infinity) this.finish();
    }
  }

  private finish() {
    this.status = 'finishing';
    this.statusT = 0;
    const p = this.player;
    p.victory = true;
    p.starT = 0;
    this.ev.sfx('win');
    this.ev.music('clear');
    const fx = this.trophy ? this.trophy.x : this.finishX;
    const fy = this.trophy ? this.trophy.y : this.finishY - 200;
    for (let i = 0; i < 30; i++) this.particles.spawn(PK.Ball, fx, fy, (Math.random() - 0.5) * 600, -250 - Math.random() * 500, 1.6, 12, '#FF5E17', 1100);
    this.particles.burst(PK.Confetti, fx, fy, 60, 380, 1.8, 6, '#00C21D', 300);
    this.particles.burst(PK.Confetti, fx, fy, 60, 380, 1.8, 6, '#FF5E17', 300);
  }

  private updateDoorFade(dt: number) {
    const before = this.doorFade;
    this.doorFade += dt / 0.6;
    const p = this.player;
    p.prevX = p.x;
    p.prevY = p.y;
    if (before < 0.5 && this.doorFade >= 0.5 && this.doorTarget) {
      p.place(this.doorTarget.x, this.doorTarget.y);
      this.zone = this.zoneFor(p.cx, p.y);
      this.camera.snap(p, this.zone);
      this.doorTarget = null;
    }
    if (this.doorFade >= 1) this.doorFade = 0;
  }
}

/** Horizontal platform carry that still respects walls. */
function stepCarry(w: World, p: Player, dx: number) {
  if (dx === 0) return;
  const x0 = p.x;
  p.x += dx;
  if (w.map.boxHitsSolid(p.x, p.y, p.w, p.h)) p.x = x0;
}
