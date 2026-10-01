import { describe, expect, it } from 'vitest';
import { RunSim } from '../src/sim/run';
import { LetterQuest } from '../src/sim/letterQuest';
import type { Obstacle } from '../src/sim/types';

function clearSim(mode: 'explorer' | 'challenge' | 'explore' = 'explorer') {
  const sim = new RunSim(mode, { seed: 3, tutorial: false });
  sim.obstacles.length = 0;
  sim.pickups.length = 0;
  // stop the generator from adding anything near us during the test
  sim.gen.generatedTo = 1e9;
  return sim;
}

function place(sim: RunSim, kind: Obstacle['kind'], dAhead: number, lane = 1, length = 1.4): Obstacle {
  const o: Obstacle = { id: Math.floor(Math.random() * 1e9), kind, lane, d: sim.d + dAhead, length, hit: false, practice: false };
  sim.obstacles.push(o);
  return o;
}

function run(sim: RunSim, seconds: number) {
  const evs: string[] = [];
  for (let i = 0; i < seconds * 120; i++) {
    sim.step();
    for (const e of sim.events) evs.push(e.type);
    sim.events.length = 0;
  }
  return evs;
}

describe('MADDY letter quest', () => {
  it('requires two separate Ds in order', () => {
    const q = new LetterQuest();
    expect(q.collect(0)).toBe('letter'); // M
    expect(q.collect(1)).toBe('letter'); // A
    expect(q.collect(3)).toBe('ignored'); // second D before first is not accepted
    expect(q.collect(2)).toBe('letter'); // first D
    expect(q.next).toBe(3);
    expect(q.collect(2)).toBe('ignored'); // the first D again does not count as the second
    expect(q.collect(4)).toBe('ignored'); // Y too early
    expect(q.collect(3)).toBe('letter'); // second D
    expect(q.collect(4)).toBe('word'); // Y completes
    expect(q.words).toBe(1);
    expect(q.next).toBe(0);
  });
  it('rewards each completed word sequence once and resets on restart', () => {
    const q = new LetterQuest();
    for (const i of [0, 1, 2, 3, 4]) q.collect(i);
    for (const i of [0, 1, 2, 3]) q.collect(i);
    expect(q.collect(4)).toBe('word');
    expect(q.words).toBe(2);
    q.collect(0);
    q.reset();
    expect(q.next).toBe(0);
    expect(q.words).toBe(0);
    expect(q.slots.every((s) => !s)).toBe(true);
  });
});

describe('Collision protection', () => {
  it('a hit costs one heart, then grants protection and never multi-hits the same obstacle', () => {
    const sim = clearSim();
    const o = place(sim, 'closed', 5, 1, 30);
    const evs = run(sim, 4);
    expect(evs.filter((e) => e === 'hit').length).toBe(1);
    expect(sim.hearts).toBe(2);
    expect(o.hit).toBe(true);
  });
  it('invulnerability prevents a second hit right after the first', () => {
    const sim = clearSim();
    place(sim, 'parcel', 3);
    place(sim, 'parcel', 8);
    run(sim, 2);
    expect(sim.hearts).toBe(2);
  });
  it('the bubble shield absorbs exactly one bump', () => {
    const sim = clearSim();
    sim.activate('shield');
    place(sim, 'parcel', 4);
    const evs = run(sim, 2);
    expect(evs).toContain('shieldPop');
    expect(sim.hearts).toBe(3);
    expect(sim.shield).toBe(false);
    place(sim, 'parcel', 6);
    run(sim, 2);
    expect(sim.hearts).toBe(2);
  });
  it('ends kindly after the last heart', () => {
    const sim = clearSim();
    for (let i = 0; i < 3; i++) {
      place(sim, 'parcel', 5);
      run(sim, 3);
    }
    expect(sim.hearts).toBe(0);
    expect(sim.over).toBe(true);
  });
  it('jumping clears a hurdle and sliding clears an arch', () => {
    const sim = clearSim();
    place(sim, 'hurdle', 2, 1, 0.5);
    for (let i = 0; i < 120 * 2; i++) {
      const o = sim.obstacles[0];
      if (o && !sim.airborne && o.d - sim.d < sim.speed * 0.3 && o.d > sim.d) sim.input('jump');
      sim.step();
    }
    expect(sim.hearts).toBe(3);
    const arch = place(sim, 'arch', 3, 1, 0.6);
    for (let i = 0; i < 120 * 2; i++) {
      if (!sim.sliding && arch.d - sim.d < sim.speed * 0.1 && arch.d > sim.d) sim.input('slide');
      sim.step();
    }
    expect(sim.hearts).toBe(3);
  });
  it('Explore mode never takes damage', () => {
    const sim = clearSim('explore');
    run(sim, 1);
    place(sim, 'parcel', 3);
    run(sim, 3);
    expect(sim.hearts).toBe(3);
  });
  it('Explore can stop and go', () => {
    const sim = clearSim('explore');
    run(sim, 2);
    sim.stopped = true;
    run(sim, 3);
    const d = sim.d;
    run(sim, 2);
    expect(sim.d - d).toBeLessThan(0.05);
    sim.stopped = false;
    run(sim, 2);
    expect(sim.d - d).toBeGreaterThan(3);
  });
});

describe('Power-ups', () => {
  it('Imagination Glide clears the flight and landing path and lands safely', () => {
    const sim = new RunSim('challenge', { seed: 11, tutorial: false });
    run(sim, 8);
    sim.activate('glide');
    const landingEnd = sim.d + 200;
    const hazardsInSpan = () => sim.obstacles.filter((o) => !o.hit && o.d > sim.d && o.d < sim.d + 100).length;
    expect(hazardsInSpan()).toBe(0);
    const before = sim.hearts;
    // do nothing during the glide and for a moment after landing
    let t = 0;
    while (t < 7 && sim.d < landingEnd) {
      sim.step();
      sim.events.length = 0;
      t += 1 / 120;
    }
    expect(sim.gliding).toBe(false);
    expect(sim.hearts).toBe(before);
  });
  it('renewing a magnet refreshes its duration instead of stacking', () => {
    const sim = clearSim();
    sim.activate('magnet');
    run(sim, 3);
    const left = sim.magnetT;
    sim.activate('magnet');
    expect(sim.magnetT).toBeGreaterThan(left);
    expect(sim.magnetT).toBeLessThanOrEqual(9);
  });
  it('rainbow sneakers protect and leave a grace window when they expire', () => {
    const sim = clearSim();
    sim.activate('rainbow');
    place(sim, 'parcel', 10);
    run(sim, 5.05);
    expect(sim.hearts).toBe(3);
    expect(sim.rainbowGraceT > 0 || sim.rainbowT > 0).toBe(true);
  });
});

describe('Restart', () => {
  it('a new run starts completely fresh', () => {
    const a = new RunSim('explorer', { seed: 5, tutorial: false });
    a.letters.collect(0);
    a.letters.collect(1);
    a.stars = 40;
    a.hearts = 1;
    const b = new RunSim('explorer', { seed: 5, tutorial: false });
    expect(b.letters.next).toBe(0);
    expect(b.stars).toBe(0);
    expect(b.hearts).toBe(3);
    expect(b.d).toBe(0);
    expect(b.missions.carrying).toBe(null);
  });
  it('long runs keep entity counts bounded', () => {
    const sim = new RunSim('challenge', { seed: 9, tutorial: false });
    sim.hearts = 1e6;
    let maxEntities = 0;
    for (let i = 0; i < 120 * 300; i++) {
      sim.step();
      sim.events.length = 0;
      maxEntities = Math.max(maxEntities, sim.obstacles.length + sim.pickups.length);
    }
    expect(maxEntities).toBeLessThan(400);
  });
});
