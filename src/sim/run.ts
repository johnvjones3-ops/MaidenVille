// RunSim: the fixed-step gameplay simulation for one run. No rendering or DOM — fully testable.

import { CONTROLS, MODES, POWERUPS, REWARDS, SIM, type ModeConfig, type ModeId } from '../config';
import { smoothstep } from '../core/rng';
import { LANDMARKS, type LandmarkId, zoneAt } from '../world/landmarks';
import { ROUTE } from '../world/route';
import { laneLateral, RouteGenerator } from './generator';
import { LetterQuest } from './letterQuest';
import { deliveryLane, MissionSystem, type MissionDef } from './missions';
import type { Obstacle, Pickup, PowerupKind } from './types';

export type Action = 'left' | 'right' | 'jump' | 'slide';

export type SimEvent =
  | { type: 'star'; d: number; lateral: number; y: number }
  | { type: 'letter'; index: number }
  | { type: 'word'; words: number }
  | { type: 'powerup'; kind: PowerupKind; renewed: boolean }
  | { type: 'powerupEnd'; kind: PowerupKind }
  | { type: 'hit'; hearts: number; kind: string }
  | { type: 'shieldPop' }
  | { type: 'smash'; id: number }
  | { type: 'practice'; ok: boolean; kind: string }
  | { type: 'gameOver' }
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'slide' }
  | { type: 'lane'; dir: number }
  | { type: 'edge' }
  | { type: 'landmark'; id: LandmarkId }
  | { type: 'approach'; id: LandmarkId }
  | { type: 'zone'; name: string }
  | { type: 'tutorial'; kind: 'lanes' | 'jump' | 'slide' }
  | { type: 'missionPickup'; def: MissionDef }
  | { type: 'missionDone'; def: MissionDef }
  | { type: 'step' };

export interface RunOptions {
  seed: number;
  tutorial: boolean;
}

const G = (8 * CONTROLS.jumpHeight) / (CONTROLS.jumpAirtime * CONTROLS.jumpAirtime);
const V0 = (4 * CONTROLS.jumpHeight) / CONTROLS.jumpAirtime;

export class RunSim {
  readonly mode: ModeConfig;
  readonly gen: RouteGenerator;
  readonly letters = new LetterQuest();
  readonly missions = new MissionSystem();
  obstacles: Obstacle[] = [];
  pickups: Pickup[] = [];
  events: SimEvent[] = [];

  time = 0;
  d = 0;
  prevD = 0;
  speed = 0;
  // lateral movement
  lane = 1;
  x = 0;
  private laneFromX = 0;
  private laneT = 1;
  // vertical
  y = 0;
  vy = 0;
  airborne = false;
  private pendingSlide = false;
  sliding = false;
  slideT = 0;
  // damage & effects
  hearts: number;
  shield = false;
  invulnT = 0;
  stumbleT = 0;
  slowT = 0;
  magnetT = 0;
  rainbowT = 0;
  rainbowGraceT = 0;
  glideT = 0;
  landingT = 0;
  glideY = 0;
  // results
  stars = 0;
  score = 0;
  hits = 0;
  shieldPops = 0;
  powerupsUsed = 0;
  lastHitD = 0;
  longestNoDamage = 0;
  visited = new Set<LandmarkId>();
  over = false;
  // explore
  stopped = false;
  private exploreSpeed = 0;
  private queue: Array<{ a: Action; t: number }> = [];
  private lastZone = '';
  private approached = new Set<string>();
  private tutorialShown = new Set<string>();
  private stepCounter = 0;

  constructor(modeId: ModeId, opts: RunOptions) {
    this.mode = MODES[modeId];
    this.hearts = this.mode.hearts;
    this.gen = new RouteGenerator(this.mode, opts.seed, {
      tutorial: opts.tutorial,
      letterNeeded: () => this.letterNeeded(),
    });
    const out = { obstacles: this.obstacles, pickups: this.pickups };
    this.gen.addTutorial(out);
    this.extend();
    this.speed = this.mode.id === 'explore' ? 0 : this.mode.startSpeed;
  }

  get s(): number {
    return ROUTE.wrap(this.d);
  }

  get protectedNow(): boolean {
    return this.invulnT > 0 || this.rainbowT > 0 || this.rainbowGraceT > 0 || this.glideT > 0 || this.landingT > 0 || !this.mode.damage;
  }

  get gliding(): boolean {
    return this.glideT > 0;
  }

  baseSpeed(d: number): number {
    const m = this.mode;
    const t = Math.max(0, d - this.gen.tutorialEnd);
    return m.startSpeed + (m.maxSpeed - m.startSpeed) * (1 - Math.exp(-t / m.accelDistance));
  }

  private letterNeeded(): number | null {
    if (!this.mode.scored) return null;
    const idx = this.letters.next;
    // Only one letter pickup of the needed index may wait ahead at a time.
    for (const p of this.pickups) if (p.kind === 'letter' && !p.collected && p.d > this.d - 1) return null;
    return idx;
  }

  input(a: Action) {
    if (this.over) return;
    this.queue.push({ a, t: this.time });
    if (this.queue.length > 4) this.queue.shift();
  }

  private tryAction(a: Action): boolean {
    switch (a) {
      case 'left':
      case 'right': {
        const dir = a === 'left' ? -1 : 1;
        const target = this.lane + dir;
        if (target < 0 || target > 2) {
          this.events.push({ type: 'edge' });
          return true;
        }
        this.lane = target;
        this.laneFromX = this.x;
        this.laneT = 0;
        this.events.push({ type: 'lane', dir });
        return true;
      }
      case 'jump': {
        if (this.gliding) return true; // already flying
        if (this.airborne) return false; // buffer until landing
        this.sliding = false;
        this.slideT = 0;
        this.airborne = true;
        this.vy = V0;
        this.events.push({ type: 'jump' });
        return true;
      }
      case 'slide': {
        if (this.gliding) return true;
        if (this.airborne) {
          this.vy = Math.min(this.vy, -14); // quick drop
          this.pendingSlide = true;
          return true;
        }
        this.startSlide();
        return true;
      }
    }
  }

  private startSlide() {
    this.sliding = true;
    this.slideT = CONTROLS.slideTime;
    this.events.push({ type: 'slide' });
  }

  /** Advance by one fixed step. */
  step(dt: number = SIM.fixedStep) {
    if (this.over) return;
    this.time += dt;
    const m = this.mode;

    // --- input buffer
    const keep: typeof this.queue = [];
    for (const q of this.queue) {
      if (this.time - q.t > CONTROLS.inputBuffer + dt) continue;
      if (!this.tryAction(q.a)) keep.push(q);
    }
    this.queue = keep;

    // --- speed
    let target: number;
    if (m.id === 'explore') {
      this.exploreSpeed += ((this.stopped ? 0 : m.startSpeed) - this.exploreSpeed) * Math.min(1, dt * 2.5);
      target = this.exploreSpeed;
    } else {
      target = this.baseSpeed(this.d);
      if (this.slowT > 0) target *= m.stumbleSlow + (1 - m.stumbleSlow) * (1 - this.slowT / m.stumbleRecover);
      if (this.rainbowT > 0) target *= POWERUPS.rainbow.speedMul;
    }
    this.speed += (target - this.speed) * Math.min(1, dt * 4);
    this.prevD = this.d;
    this.d += this.speed * dt;

    // --- lateral
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dt / CONTROLS.laneChangeTime);
      this.x = this.laneFromX + (laneLateral(this.lane) - this.laneFromX) * smoothstep(this.laneT);
    } else this.x = laneLateral(this.lane);

    // --- vertical
    if (this.glideT > 0) {
      this.glideT -= dt;
      const total = POWERUPS.glide.duration;
      const el = total - this.glideT;
      const rise = smoothstep(el / 0.9);
      const fall = smoothstep(this.glideT / 1.0);
      this.y = POWERUPS.glide.height * Math.min(rise, fall);
      this.airborne = true;
      this.vy = 0;
      if (this.glideT <= 0) {
        this.glideT = 0;
        this.y = 0;
        this.airborne = false;
        this.landingT = POWERUPS.glide.landing;
        this.events.push({ type: 'powerupEnd', kind: 'glide' }, { type: 'land' });
      }
    } else if (this.airborne) {
      this.vy -= G * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.airborne = false;
        this.events.push({ type: 'land' });
        if (this.pendingSlide) {
          this.pendingSlide = false;
          this.startSlide();
        }
      }
    }
    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) this.sliding = false;
    }

    // --- timers
    const prevRainbow = this.rainbowT;
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.stumbleT = Math.max(0, this.stumbleT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.landingT = Math.max(0, this.landingT - dt);
    this.rainbowGraceT = Math.max(0, this.rainbowGraceT - dt);
    if (this.magnetT > 0) {
      this.magnetT -= dt;
      if (this.magnetT <= 0) {
        this.magnetT = 0;
        this.events.push({ type: 'powerupEnd', kind: 'magnet' });
      }
    }
    if (this.rainbowT > 0) {
      this.rainbowT -= dt;
      if (this.rainbowT <= 0 && prevRainbow > 0) {
        this.rainbowT = 0;
        this.rainbowGraceT = POWERUPS.rainbow.grace;
        this.events.push({ type: 'powerupEnd', kind: 'rainbow' });
      }
    }

    this.collide();
    this.collect(dt);
    this.landmarksAndZones();
    this.tutorialPrompts();

    // --- missions
    if (this.missions.carrying) {
      const lane = Math.round(this.x / CONTROLS.laneWidth) + 1;
      const done = this.missions.tryDeliver(this.s, lane);
      if (done) {
        this.score += REWARDS.deliveryScore;
        this.stars += REWARDS.deliveryStars;
        this.events.push({ type: 'missionDone', def: done });
      }
    }

    // --- score & bookkeeping
    if (m.scored) this.score += (this.d - this.prevD) * REWARDS.scorePerMeter;
    this.longestNoDamage = Math.max(this.longestNoDamage, this.d - this.lastHitD);
    if (++this.stepCounter % 30 === 0) {
      this.extend();
      this.cleanup();
    }
    // footstep cadence for audio/animation
    if (!this.airborne && !this.sliding && this.speed > 1) {
      const stride = 1.15 + this.speed * 0.07;
      if (Math.floor(this.d / stride) !== Math.floor(this.prevD / stride)) this.events.push({ type: 'step' });
    }
  }

  private collide() {
    const m = this.mode;
    const p0 = this.prevD - 0.25;
    const p1 = this.d + 0.25;
    const halfW = (0.4 + 0.95) * m.hitboxScale;
    for (const o of this.obstacles) {
      if (o.hit) continue;
      const half = o.length / 2;
      if (p1 < o.d - half || p0 > o.d + half) continue;
      if (Math.abs(this.x - laneLateral(o.lane)) > halfW) continue;
      if (!this.overlapsVertically(o)) {
        if (o.practice && o.d + half < this.d + 0.3 && !o.hit) {
          o.hit = true; // mark as passed so the "nice" message fires once
          this.events.push({ type: 'practice', ok: true, kind: o.kind });
        }
        continue;
      }
      o.hit = true;
      if (o.practice) {
        this.events.push({ type: 'practice', ok: false, kind: o.kind });
        continue;
      }
      if (this.protectedNow) {
        if (this.rainbowT > 0) this.events.push({ type: 'smash', id: o.id });
        continue;
      }
      if (this.shield) {
        this.shield = false;
        this.shieldPops++;
        this.invulnT = 1.0;
        this.events.push({ type: 'shieldPop' }, { type: 'smash', id: o.id });
        continue;
      }
      this.hearts--;
      this.hits++;
      this.lastHitD = this.d;
      this.invulnT = m.invulnAfterHit;
      this.slowT = m.stumbleRecover;
      this.stumbleT = 0.6;
      this.events.push({ type: 'hit', hearts: this.hearts, kind: o.kind });
      if (this.hearts <= 0) {
        this.over = true;
        this.events.push({ type: 'gameOver' });
        return;
      }
    }
  }

  private overlapsVertically(o: Obstacle): boolean {
    const forgive = this.mode.hitboxScale;
    switch (o.kind) {
      case 'hurdle':
        return this.y < 0.62 * forgive + 0.1;
      case 'puddle':
        return this.y < 0.12;
      case 'arch':
        return !this.sliding && this.y < 2.6;
      case 'parcel':
      case 'closed':
        return this.y < 1.55;
    }
  }

  private collect(dt: number) {
    const magnet = this.magnetT > 0;
    const R = POWERUPS.magnet.radius;
    for (const p of this.pickups) {
      if (p.collected) continue;
      const ahead = p.d - this.d;
      if (magnet && p.kind === 'star' && ahead < R && ahead > -1.5) p.attracted = true;
      if (p.attracted) {
        const k = Math.min(1, dt * 9);
        p.lateral += (this.x - p.lateral) * k;
        p.y += (this.y + 0.9 - p.y) * k;
        p.d += (this.d + 0.2 - p.d) * k;
      }
      const yTol = p.kind === 'star' ? 1.25 : 1.4;
      if (p.d < this.prevD - 0.7 || p.d > this.d + 0.7) continue;
      if (Math.abs(p.lateral - this.x) > 1.15) continue;
      if (Math.abs(p.y - (this.y + (this.sliding ? 0.45 : 0.9))) > yTol) continue;
      this.take(p);
    }
  }

  private take(p: Pickup) {
    switch (p.kind) {
      case 'star':
        p.collected = true;
        this.stars++;
        if (this.mode.scored) this.score += REWARDS.scorePerStar;
        this.events.push({ type: 'star', d: p.d, lateral: p.lateral, y: p.y });
        break;
      case 'letter': {
        const r = this.letters.collect(p.letterIndex ?? -1);
        if (r === 'ignored') return;
        p.collected = true;
        this.score += REWARDS.scorePerLetter;
        this.events.push({ type: 'letter', index: p.letterIndex ?? 0 });
        if (r === 'word') {
          this.stars += REWARDS.wordBonusStars;
          this.score += REWARDS.wordBonusScore;
          this.events.push({ type: 'word', words: this.letters.words });
        }
        break;
      }
      case 'powerup':
        p.collected = true;
        this.activate(p.powerup ?? 'magnet');
        break;
      case 'mission': {
        if (this.missions.carrying) return;
        const def = this.missions.pickUp(p.mission ?? 'book');
        if (!def) return;
        p.collected = true;
        this.events.push({ type: 'missionPickup', def });
        break;
      }
    }
  }

  activate(kind: PowerupKind) {
    this.powerupsUsed++;
    let renewed = false;
    switch (kind) {
      case 'magnet':
        renewed = this.magnetT > 0;
        this.magnetT = POWERUPS.magnet.duration; // renew to full, never stacks
        break;
      case 'shield':
        renewed = this.shield;
        if (this.shield) this.stars += 5; // already protected: small bonus instead
        this.shield = true;
        break;
      case 'rainbow':
        renewed = this.rainbowT > 0;
        this.rainbowT = POWERUPS.rainbow.duration;
        this.rainbowGraceT = 0;
        break;
      case 'glide': {
        renewed = this.glideT > 0;
        if (renewed) {
          this.glideT = Math.max(this.glideT, POWERUPS.glide.duration - 0.9);
          break;
        }
        this.glideT = POWERUPS.glide.duration;
        this.sliding = false;
        this.pendingSlide = false;
        // Guarantee a clear flight and landing: remove hazards and reserve the span.
        const speed = Math.max(this.speed, this.mode.maxSpeed) * (this.rainbowT > 0 ? POWERUPS.rainbow.speedMul : 1);
        const span = (POWERUPS.glide.duration + POWERUPS.glide.landing) * speed + 18;
        const d0 = this.d - 2;
        const d1 = this.d + span;
        this.gen.reserve(d0, d1);
        for (const o of this.obstacles) if (o.d + o.length / 2 > d0 && o.d - o.length / 2 < d1) o.hit = true;
        this.obstacles = this.obstacles.filter((o) => !(o.d + o.length / 2 > d0 && o.d - o.length / 2 < d1 && !o.practice));
        // Sky stars along the flight
        const t0 = 1.0;
        const t1 = POWERUPS.glide.duration - 1.2;
        for (let t = t0; t < t1; t += 0.22) {
          const lane = Math.round(1 + Math.sin(t * 1.3));
          this.pickups.push({
            id: this.gen.id(),
            kind: 'star',
            d: this.d + t * this.speed,
            lateral: laneLateral(lane),
            y: POWERUPS.glide.height + 0.9,
            collected: false,
          });
        }
        break;
      }
    }
    this.events.push({ type: 'powerup', kind, renewed });
  }

  private landmarksAndZones() {
    const s0 = ROUTE.wrap(this.prevD);
    const s1 = this.s;
    for (const l of LANDMARKS) {
      if (crossed(s0, s1, l.s)) {
        this.visited.add(l.id);
        this.events.push({ type: 'landmark', id: l.id });
      }
      const lap = Math.floor((this.d - l.s + 60) / ROUTE.length);
      const key = `${l.id}:${lap}`;
      if (crossed(s0, s1, ROUTE.wrap(l.s - 60)) && !this.approached.has(key)) {
        this.approached.add(key);
        this.events.push({ type: 'approach', id: l.id });
      }
    }
    const z = zoneAt(s1).name;
    if (z !== this.lastZone) {
      this.lastZone = z;
      this.events.push({ type: 'zone', name: z });
    }
  }

  private tutorialPrompts() {
    for (const p of this.gen.practice) {
      if (this.d >= p.d && !this.tutorialShown.has(p.kind)) {
        this.tutorialShown.add(p.kind);
        this.events.push({ type: 'tutorial', kind: p.kind });
      }
    }
  }

  /** Generate content ahead and spawn mission items at their fixed places. */
  extend() {
    const before = this.gen.generatedTo;
    const target = this.d + SIM.generateAhead;
    this.gen.generateUntil(target, { obstacles: this.obstacles, pickups: this.pickups });
    if (this.mode.scored) {
      const from = Math.max(before, this.d + 30, this.gen.tutorialEnd);
      for (const { def, d } of this.missions.itemsToSpawn(from, this.gen.generatedTo)) {
        if (this.missions.carrying) continue;
        // keep the item's surroundings clear so it is always reachable
        this.obstacles = this.obstacles.filter((o) => o.practice || Math.abs(o.d - d) > 9 + o.length / 2);
        this.pickups = this.pickups.filter((p) => !(p.kind !== 'star' && Math.abs(p.d - d) < 4));
        this.pickups.push({ id: this.gen.id(), kind: 'mission', d, lateral: laneLateral(1), y: 1.0, collected: false, mission: def.item });
      }
    }
  }

  private cleanup() {
    const cut = this.d - SIM.despawnBehind;
    if (this.obstacles.length && this.obstacles[0].d < cut) this.obstacles = this.obstacles.filter((o) => o.d + o.length / 2 >= cut);
    this.pickups = this.pickups.filter((p) => !p.collected && p.d >= cut);
  }

  /** Explore: jump to a landmark along the route (forward), clearing nothing because Explore has no hazards. */
  travelTo(s: number) {
    const delta = ROUTE.wrap(s - this.s);
    this.d += delta;
    this.prevD = this.d;
    this.lastHitD = this.d;
    this.extend();
    this.lastZone = '';
  }

  deliveryTargetLane(): number | null {
    return this.missions.carrying ? deliveryLane(this.missions.carrying.target) : null;
  }

  /** Current visual lane-change lean (-1..1) for animation. */
  get lean(): number {
    if (this.laneT >= 1) return 0;
    const dir = Math.sign(laneLateral(this.lane) - this.laneFromX);
    return dir * Math.sin(this.laneT * Math.PI);
  }

  summary(runId: string) {
    return {
      runId,
      mode: this.mode.id,
      stars: this.mode.scored ? this.stars : 0,
      score: this.mode.scored ? Math.floor(this.score) : 0,
      distance: Math.floor(this.d),
      landmarksVisited: [...this.visited],
      words: this.letters.words,
      lettersProgress: this.letters.next,
      deliveries: [...this.missions.completed],
      powerups: this.powerupsUsed,
      longestNoDamage: Math.floor(this.longestNoDamage),
      hits: this.hits,
      shieldPops: this.shieldPops,
    };
  }
}

/** Did travelling from s0 to s1 (forward, wrapped) cross point p? */
export function crossed(s0: number, s1: number, p: number): boolean {
  if (s1 >= s0) return p > s0 && p <= s1;
  return p > s0 || p <= s1; // wrapped past the loop start
}

export const JUMP_PHYSICS = { gravity: G, launch: V0 };
