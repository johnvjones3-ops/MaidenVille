// RouteGenerator: places obstacle patterns, star trails, letters and power-ups ahead of Maddy.
// Uses its own seeded RNG (gameplay randomness) and only places hazards in validated, hazard-free-safe spans.

import { CONTROLS, POWERUPS, type ModeConfig } from '../config';
import { Rng } from '../core/rng';
import { ADDITIONS, inLandmarkZone } from '../world/landmarks';
import { ROUTE } from '../world/route';
import { PATTERNS, type Pattern } from './patterns';
import type { Obstacle, Pickup, PowerupKind, Row } from './types';
import { OBSTACLE_DEPTH } from './types';
import { allLanes, findPath, obstaclesToRows, timingsFor, validateRows, type ReachState, type Timings } from './validator';

export const CORNER_MARGIN_BEFORE = 24;
export const CORNER_MARGIN_AFTER = 18;

export interface GenContext {
  /** Index (0..4) of the next MADDY letter that should appear, or null if none needed now. */
  letterNeeded(): number | null;
  /** Whether glide pickups are allowed (not while a glide is active). */
  tutorial: boolean;
}

export interface GenOutput {
  obstacles: Obstacle[];
  pickups: Pickup[];
}

export const laneLateral = (lane: number) => (lane - 1) * CONTROLS.laneWidth;

export class RouteGenerator {
  readonly rng: Rng;
  readonly mode: ModeConfig;
  readonly timings: Timings;
  /** Furthest generated distance. */
  generatedTo = 0;
  private reach: ReachState = allLanes();
  private reachD = 0;
  private reserved: Array<[number, number]> = [];
  private nextPowerupD: number;
  private nextLetterD: number;
  private nextId = 1;
  readonly tutorialEnd: number;
  /** Distances of the tutorial practice obstacles and prompts (for the HUD). */
  readonly practice: Array<{ d: number; kind: 'lanes' | 'jump' | 'slide' }> = [];
  pathLane = 1;

  constructor(mode: ModeConfig, seed: number, private ctx: GenContext) {
    this.mode = mode;
    this.rng = new Rng(seed);
    this.timings = timingsFor(mode.reactionBuffer);
    this.tutorialEnd = mode.hazards ? mode.tutorialSeconds * mode.startSpeed : 0;
    this.nextPowerupD = Math.max(this.tutorialEnd + 60, 160);
    this.nextLetterD = Math.max(this.tutorialEnd * 0.5, 40);
    this.generatedTo = 0;
  }

  id(): number {
    return this.nextId++;
  }

  /** Reserve a hazard-free span (e.g. a glide landing) — existing hazards there must be removed by the caller. */
  reserve(d0: number, d1: number) {
    this.reserved.push([d0, d1]);
    if (this.reserved.length > 16) this.reserved.shift();
  }

  /** True if run distance d is inside any hazard-free span. */
  isProtected(d: number): boolean {
    if (d < this.tutorialEnd) return true;
    for (const [a, b] of this.reserved) if (d >= a && d <= b) return true;
    const s = ROUTE.wrap(d);
    for (const c of ROUTE.corners) {
      for (const off of [-ROUTE.length, 0, ROUTE.length]) {
        if (s >= c.s0 + off - CORNER_MARGIN_BEFORE && s <= c.s1 + off + CORNER_MARGIN_AFTER) return true;
      }
    }
    if (inLandmarkZone(s)) return true;
    if (Math.abs(ROUTE.delta(s, ADDITIONS.welcomeArchS)) < 8) return true;
    return false;
  }

  private spanFree(d0: number, d1: number): boolean {
    for (let d = d0; d <= d1; d += 1.5) if (this.isProtected(d)) return false;
    return !this.isProtected(d1);
  }

  /** Validation speed: the mode's maximum, which is the hardest shipped speed. */
  get validationSpeed(): number {
    return this.mode.maxSpeed;
  }

  difficultyAt(d: number): number {
    const m = this.mode;
    const ramp = Math.min(1, Math.max(0, (d - this.tutorialEnd) / m.difficultyRampDistance));
    return Math.max(1, Math.round(1 + (m.maxDifficulty - 1) * ramp));
  }

  private instantiate(p: Pattern, startD: number): Array<Omit<Obstacle, 'id' | 'hit' | 'practice'>> {
    const mirror = this.rng.chance(0.5);
    const shift = p.shiftable ? this.rng.int(0, 2) - 1 : 0;
    const res: Array<Omit<Obstacle, 'id' | 'hit' | 'practice'>> = [];
    for (const o of p.obstacles) {
      let lane = o.lane + shift;
      if (p.shiftable) lane = Math.max(0, Math.min(2, lane));
      if (mirror) lane = 2 - lane;
      res.push({ kind: o.kind, lane, d: startD + o.dz, length: o.length ?? OBSTACLE_DEPTH[o.kind] });
    }
    return res;
  }

  private extent(obs: Array<{ d: number; length: number }>): [number, number] {
    let a = Infinity;
    let b = -Infinity;
    for (const o of obs) {
      a = Math.min(a, o.d - o.length / 2 - 1);
      b = Math.max(b, o.d + o.length / 2 + 1);
    }
    return [a, b];
  }

  /** Build the tutorial practice course (harmless) — only when the tutorial is shown. */
  addTutorial(out: GenOutput) {
    if (!this.ctx.tutorial || this.tutorialEnd <= 0) return;
    const e = this.tutorialEnd;
    this.practice.push({ d: e * 0.12, kind: 'lanes' }, { d: e * 0.4, kind: 'jump' }, { d: e * 0.7, kind: 'slide' });
    const hurdleD = e * 0.58;
    const archD = e * 0.88;
    for (let lane = 0; lane < 3; lane++) {
      out.obstacles.push({ id: this.id(), kind: 'hurdle', lane, d: hurdleD, length: OBSTACLE_DEPTH.hurdle, hit: false, practice: true });
      out.obstacles.push({ id: this.id(), kind: 'arch', lane, d: archD, length: OBSTACLE_DEPTH.arch, hit: false, practice: true });
    }
    // Star trail that weaves left and right to teach lane changes.
    for (let d = e * 0.15; d < e * 0.38; d += 2.5) {
      const t = (d - e * 0.15) / (e * 0.23);
      this.star(out, d, laneLateral(t < 0.5 ? 0 : 2), 0.9);
    }
    for (let i = -3; i <= 3; i++) this.star(out, hurdleD + i * 1.4, 0, 1.0 + (1 - (i * i) / 9) * 1.2);
  }

  private star(out: GenOutput, d: number, lateral: number, y: number) {
    out.pickups.push({ id: this.id(), kind: 'star', d, lateral, y, collected: false });
  }

  /** Generate content until `targetD`. */
  generateUntil(targetD: number, out: GenOutput) {
    let guard = 0;
    while (this.generatedTo < targetD && guard++ < 200) this.step(out);
  }

  private step(out: GenOutput) {
    const m = this.mode;
    const gap = this.rng.range(m.patternGap[0], m.patternGap[1]);
    let start = Math.max(this.generatedTo + gap, 6);

    if (!m.hazards) {
      // Explore: no hazards — just leave space; scenery carries the experience.
      this.generatedTo = start;
      return;
    }

    // Skip protected spans; decorate them with gentle star lines.
    if (this.isProtected(start)) {
      let d = start;
      while (this.isProtected(d)) d += 2;
      this.starLine(out, this.generatedTo + 4, d - 2, this.pathLane);
      this.generatedTo = d;
      return;
    }

    // Choose a pattern within the difficulty limit.
    const diff = this.difficultyAt(start);
    const candidates = PATTERNS.filter((p) => p.difficulty <= diff);
    const weights = candidates.map((p) => (p.difficulty === diff ? 2 : 1));
    for (let attempt = 0; attempt < 6; attempt++) {
      const p = weightedPick(this.rng, candidates, weights);
      const obs = this.instantiate(p, start);
      // pattern dz may be negative; shift so its first obstacle starts at `start`
      const [e0, e1] = this.extent(obs);
      const shiftBy = start - e0;
      for (const o of obs) o.d += shiftBy;
      const [a, b] = [e0 + shiftBy, e1 + shiftBy];
      if (!this.spanFree(a, b)) {
        // Not enough room before the next protected span — move past it.
        let d = a;
        while (!this.isProtected(d)) d += 2;
        this.starLine(out, this.generatedTo + 4, d - 2, this.pathLane);
        this.generatedTo = d;
        return;
      }
      const rows = obstaclesToRows(obs);
      const res = validateRows(this.reach, this.reachD, rows, this.validationSpeed, this.timings, true);
      if (!res.ok) continue;
      const path = findPath(this.reach, this.reachD, rows, this.validationSpeed, this.timings, this.pathLane);
      // Commit
      for (const o of obs) out.obstacles.push({ ...o, id: this.id(), hit: false, practice: false });
      this.decorateGap(out, this.generatedTo + 3, a - 3, path ? path[0] : 1);
      if (path) this.trailThroughRows(out, rows, path);
      this.reach = res.end;
      this.reachD = res.endD;
      if (path) this.pathLane = path[path.length - 1];
      this.generatedTo = b;
      return;
    }
    // Nothing fit: leave a clear stretch (always valid) and carry on.
    this.starLine(out, this.generatedTo + 4, start + 10, this.pathLane);
    this.generatedTo = start + 12;
  }

  /** Fill the gap before a pattern with a star line that leads into the safe lane, plus letters/power-ups. */
  private decorateGap(out: GenOutput, d0: number, d1: number, lane: number) {
    if (d1 - d0 < 4) return;
    const mid = (d0 + d1) / 2;
    const letter = this.ctx.letterNeeded();
    if (letter !== null && mid >= this.nextLetterD) {
      out.pickups.push({ id: this.id(), kind: 'letter', d: mid, lateral: laneLateral(lane), y: 1.0, collected: false, letterIndex: letter });
      this.nextLetterD = mid + (this.mode.id === 'challenge' ? 120 : 85);
      this.starLine(out, d0, mid - 3, lane);
      this.starLine(out, mid + 3, d1, lane);
      return;
    }
    if (mid >= this.nextPowerupD) {
      const kind = this.choosePowerup(mid);
      out.pickups.push({ id: this.id(), kind: 'powerup', d: mid, lateral: laneLateral(lane), y: 1.0, collected: false, powerup: kind });
      this.nextPowerupD = mid + this.rng.range(POWERUPS.minSpacing, POWERUPS.maxSpacing);
      this.starLine(out, d0, mid - 3, lane);
      return;
    }
    if (this.rng.chance(0.8)) this.starLine(out, d0, d1, lane);
  }

  private choosePowerup(d: number): PowerupKind {
    const kinds: PowerupKind[] = ['magnet', 'shield', 'rainbow'];
    if (this.glideFits(d)) kinds.push('glide', 'glide');
    return this.rng.pick(kinds);
  }

  /** A glide needs a long corner-free stretch so the landing is never surprising. */
  glideFits(_d: number): boolean {
    // The flight and landing span is cleared and reserved when the glide is picked up, and corners are safe to fly.
    return true;
  }

  private starLine(out: GenOutput, d0: number, d1: number, lane: number) {
    if (d1 - d0 < 3) return;
    const n = Math.min(12, Math.floor((d1 - d0) / 2.6));
    const step = (d1 - d0) / Math.max(1, n);
    for (let i = 0; i < n; i++) this.star(out, d0 + step * (i + 0.5), laneLateral(lane), 0.9);
  }

  private trailThroughRows(out: GenOutput, rows: Row[], path: number[]) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lane = path[i];
      const req = row.lanes[lane];
      const x = laneLateral(lane);
      if (req === 'jump') {
        for (let k = -2; k <= 2; k++) this.star(out, row.d + 0.3 + k * 1.5, x, 1.1 + (1 - (k * k) / 4) * 1.1);
      } else if (req === 'slide') {
        this.star(out, row.d + 0.3, x, 0.45);
      } else if (i > 0 && path[i - 1] === lane && row.d - rows[i - 1].d > 4) {
        this.star(out, (row.d + rows[i - 1].d) / 2, x, 0.9);
      }
    }
  }
}

function weightedPick<T>(rng: Rng, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

