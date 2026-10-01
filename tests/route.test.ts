import { describe, expect, it } from 'vitest';
import { MODES } from '../src/config';
import { CORNER_MARGIN_AFTER, CORNER_MARGIN_BEFORE, RouteGenerator } from '../src/sim/generator';
import { RunSim } from '../src/sim/run';
import { allLanes, obstaclesToRows, timingsFor, validateRows } from '../src/sim/validator';
import { LANDMARKS, LANDMARK_VIEW_HALF } from '../src/world/landmarks';
import { ROUTE } from '../src/world/route';
import { autopilot } from './helpers';

describe('CityRoute', () => {
  it('is a continuous closed loop', () => {
    let prev = ROUTE.pose(0);
    for (let s = 0.5; s <= ROUTE.length + 0.01; s += 0.5) {
      const p = ROUTE.pose(s);
      expect(Math.hypot(p.x - prev.x, p.z - prev.z)).toBeLessThan(0.55);
      prev = p;
    }
    const a = ROUTE.pose(0);
    const b = ROUTE.pose(ROUTE.length - 1e-6);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.01);
  });
  it('starts heading north up the central avenue and turns right four times', () => {
    expect(ROUTE.pose(0).heading).toBeCloseTo(0);
    expect(ROUTE.corners.length).toBe(4);
    expect(ROUTE.pose(ROUTE.corners[0].s1 + 1).heading).toBeCloseTo(Math.PI / 2);
  });
  it('places landmarks at stable, distinct route positions', () => {
    const ids = new Set(LANDMARKS.map((l) => l.id));
    expect(ids.size).toBe(7);
    for (const l of LANDMARKS) expect(l.s).toBeGreaterThan(0);
  });
});

describe('Generated courses', () => {
  const t = (m: (typeof MODES)['explorer']) => timingsFor(m.reactionBuffer);

  for (const modeId of ['explorer', 'challenge'] as const) {
    it(`${modeId}: every pattern stream validates at the max speed across chunk boundaries`, () => {
      const mode = MODES[modeId];
      for (let seed = 1; seed <= 40; seed++) {
        const gen = new RouteGenerator(mode, seed, { tutorial: false, letterNeeded: () => null });
        const out = { obstacles: [] as any[], pickups: [] as any[] };
        // generate in several chunks, like the game does
        for (let d = 100; d <= 4000; d += 37) gen.generateUntil(d, out);
        const rows = obstaclesToRows(out.obstacles);
        const res = validateRows(allLanes(), 0, rows, mode.maxSpeed, t(mode), false);
        expect(res.ok, `seed ${seed}`).toBe(true);
        // and at the starting speed
        expect(validateRows(allLanes(), 0, rows, mode.startSpeed, t(mode), false).ok).toBe(true);
      }
    });

    it(`${modeId}: no hazards in tutorial, corners or landmark viewing zones`, () => {
      const mode = MODES[modeId];
      for (let seed = 1; seed <= 20; seed++) {
        const gen = new RouteGenerator(mode, seed, { tutorial: false, letterNeeded: () => null });
        const out = { obstacles: [] as any[], pickups: [] as any[] };
        gen.generateUntil(ROUTE.length * 3, out);
        for (const o of out.obstacles) {
          for (const d of [o.d - o.length / 2, o.d, o.d + o.length / 2]) {
            expect(d).toBeGreaterThanOrEqual(gen.tutorialEnd);
            const s = ROUTE.wrap(d);
            for (const c of ROUTE.corners) {
              const inside = s >= c.s0 - CORNER_MARGIN_BEFORE && s <= c.s1 + CORNER_MARGIN_AFTER;
              expect(inside, `corner overlap at s=${s}`).toBe(false);
            }
            for (const l of LANDMARKS) expect(Math.abs(ROUTE.delta(s, l.s))).toBeGreaterThanOrEqual(LANDMARK_VIEW_HALF - 0.01);
          }
        }
      }
    });

    it(`${modeId}: an autopilot using real lane/jump/slide timings survives 3 km`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const sim = new RunSim(modeId, { seed, tutorial: false });
        sim.hearts = 99;
        let hits = 0;
        while (sim.d < 3000 && !sim.over) {
          autopilot(sim);
          sim.step();
          for (const e of sim.events) if (e.type === 'hit') hits++;
          sim.events.length = 0;
        }
        expect(hits, `seed ${seed} hits`).toBe(0);
      }
    });
  }

  it('the introductory tour reaches all seven landmarks within three minutes at beginner speed', () => {
    const sim = new RunSim('explorer', { seed: 7, tutorial: true });
    sim.hearts = 99;
    const seen = new Map<string, number>();
    while (sim.time < 180 && seen.size < 7) {
      autopilot(sim);
      sim.step();
      for (const e of sim.events) if (e.type === 'landmark' && !seen.has(e.id)) seen.set(e.id, sim.time);
      sim.events.length = 0;
    }
    expect(seen.size).toBe(7);
    expect(Math.max(...seen.values())).toBeLessThan(180);
  });
});
