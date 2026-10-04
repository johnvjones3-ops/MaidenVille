import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels';
import { analyze } from '../src/levels/validate';

describe('hand-authored levels', () => {
  const defs = LEVELS.map((f) => f());

  it('there are three levels with distinct rare ids', () => {
    expect(defs.length).toBe(3);
    const ids = defs.flatMap((d) => [...d.emblemIds, ...d.rareIds, ...d.bookIds]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const def of defs) {
    describe(def.name, () => {
      const r = analyze(def);
      it('has three V emblems, a checkpoint and a substantial length', () => {
        expect(def.emblemIds.length).toBe(3);
        expect(def.entities.filter((e) => e.kind === 'checkpoint').length).toBeGreaterThanOrEqual(1);
        expect(def.w).toBeGreaterThanOrEqual(190);
      });
      it('main route reaches the finish using only Rookie physics (no secrets, no power-ups)', () => {
        expect(r.finishReached).toBe(true);
      });
      it('every checkpoint is reachable', () => {
        expect(r.checkpointsReached.length).toBe(def.entities.filter((e) => e.kind === 'checkpoint').length);
      });
      it('no reachable spot is a dead end (you can always continue to the finish)', () => {
        expect(r.deadEnds).toEqual([]);
      });
      it('every rare collectible can be reached (hidden blocks revealed)', () => {
        const r2 = analyze(def, { revealHidden: true });
        expect(r2.rareUids.filter((u) => !r2.raresTouched.has(u))).toEqual([]);
      });
    });
  }

  it('Palm Walk has a secret book room behind a door pair', () => {
    const def = defs[1];
    const r = analyze(def);
    expect(r.doorsUsed).toBeGreaterThan(0);
    expect(def.bookIds.length).toBeGreaterThanOrEqual(1);
  });
});
