import { describe, expect, it } from 'vitest';
import { STEP, TILE } from '../src/config';
import { SAVE_KEY, SaveStore, type StorageLike } from '../src/core/save';
import { LEVELS } from '../src/levels';
import { newRun } from '../src/game/state';
import { T } from '../src/game/tiles';
import { World } from '../src/game/world';
import { flatLevel, input, makeWorld, stepN } from './helpers';

function memStorage(init: Record<string, string> = {}): StorageLike & { m: Record<string, string> } {
  const m = { ...init };
  return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => void (m[k] = v), removeItem: (k) => void delete m[k] };
}

describe('checkpoints, lives and rewards', () => {
  const def = flatLevel(60, (b) => {
    b.ball(6, 11); // before checkpoint
    b.checkpoint(10);
    b.balls(14, 16, 11); // after checkpoint
    b.item('emblem', 18, 11);
    b.clear(24, 12, 30, 14); // pit
  });

  it('dying after a checkpoint cannot farm basketballs or score; rare items union instead of duplicating', () => {
    const rare = new Set<string>();
    const run = newRun();
    const session = { rare: new Set<string>(), time: 0, deaths: 0 };
    const events = { sfx() {}, toast() {}, book() {}, music() {}, rare: (id: string) => rare.add(id) };
    let w = new World(def, run, session, rare, events);
    stepN(w, 120, { right: true }); // through ball 6 and checkpoint 10
    expect(w.checkpoints[0].active).toBe(true);
    const snap = w.lastSnapshot!;
    expect(snap.ballsTotal).toBe(1);
    stepN(w, 150, { right: true }); // collect 3 balls + emblem, then fall into the pit
    expect(run.ballsTotal).toBe(4);
    expect(session.rare.has('L1-E1')).toBe(true);
    stepN(w, 120, { right: true });
    expect(w.status).toBe('dead');
    const scoreBefore = snap.score;

    // Respawn from the snapshot.
    w = new World(def, run, session, rare, events, snap);
    expect(run.ballsTotal).toBe(1);
    expect(run.score).toBe(scoreBefore);
    expect(w.items.filter((i) => i.kind === 'ball').length).toBe(3); // post-checkpoint balls are back
    expect(w.items.some((i) => i.kind === 'emblem')).toBe(false); // rare stays found, not respawned
    expect(w.checkpoints[0].active).toBe(true);
    expect(w.player.cx).toBeCloseTo(10.5 * TILE, 0);
    stepN(w, 140, { right: true });
    expect(run.ballsTotal).toBe(4); // same total, not 7
    expect([...rare].filter((x) => x === 'L1-E1').length).toBe(1);
  });

  it('a 1-up earned after a checkpoint is not re-earned after dying', () => {
    const run = newRun();
    run.ballsTotal = 99;
    const session = { rare: new Set<string>(), time: 0, deaths: 0 };
    let w = new World(def, run, session, new Set());
    stepN(w, 120, { right: true }); // ball at 6 -> 100 -> 1-up; checkpoint after
    expect(run.lives).toBe(4);
    const snap = w.lastSnapshot!;
    stepN(w, 400, { right: true });
    expect(w.status).toBe('dead');
    run.lives--;
    w = new World(def, run, session, new Set(), undefined, snap);
    stepN(w, 140, { right: true });
    expect(run.lives).toBe(3);
  });

  it('star does not protect from pits', () => {
    const { w } = makeWorld(def);
    w.player.place(22 * TILE, 12 * TILE);
    w.player.starT = 10;
    stepN(w, 120, { right: true });
    expect(w.status).toBe('dead');
  });

  it('pause freezes power-up timers (timers only advance inside world.update)', () => {
    const { w } = makeWorld(def);
    w.player.starT = 5;
    const t = w.player.starT;
    // no updates while paused
    expect(w.player.starT).toBe(t);
    stepN(w, 60);
    expect(w.player.starT).toBeCloseTo(4, 1);
  });

  it('the lasso stops at walls and stuns prickly hoppers', () => {
    const d = flatLevel(40, (b) => {
      b.fill(8, 9, 8, 11, T.BRICK);
      b.enemy('cactus', 10);
      b.enemy('cactus', 4, 12, { dir: 1 });
    });
    const { w } = makeWorld(d);
    w.player.place(6.5 * TILE, 12 * TILE);
    w.player.lassoCharges = 2;
    w.player.facing = 1;
    for (const e of w.enemies) e.activate();
    stepN(w, 2);
    w.update(STEP, input({ actionPressed: true, action: true }));
    stepN(w, 20);
    const behindWall = w.enemies.find((e) => e.x > 8 * TILE)!;
    expect(behindWall.state).not.toBe('stunned');
    expect(w.player.lassoCharges).toBe(1);
  });
});

describe('save data', () => {
  it('round-trips progress and settings', () => {
    const st = memStorage();
    const s = new SaveStore(3, st);
    s.completeLevel(0, 1234, 61.5);
    s.addRare('L1-E1');
    s.addRare('L1-E1');
    s.data.settings.music = false;
    s.save();
    const s2 = new SaveStore(3, st);
    expect(s2.data.unlocked).toBe(1);
    expect(s2.data.best[0]).toEqual({ score: 1234, time: 61.5 });
    expect(s2.data.rare).toEqual(['L1-E1']);
    expect(s2.data.settings.music).toBe(false);
    expect(JSON.parse(st.m[SAVE_KEY]).v).toBe(1);
  });

  it('survives corrupt, wrong-typed, future-version and missing storage', () => {
    const bad = new SaveStore(3, memStorage({ [SAVE_KEY]: '{not json' }));
    expect(bad.recovered).toBe(true);
    expect(bad.data.unlocked).toBe(0);
    const typed = new SaveStore(3, memStorage({ [SAVE_KEY]: JSON.stringify({ v: 1, unlocked: 'x', rare: [1, 'L1-E2'], best: [{ score: 'a' }], settings: { touch: 'weird' } }) }));
    expect(typed.data.unlocked).toBe(0);
    expect(typed.data.rare).toEqual(['L1-E2']);
    expect(typed.data.best[0]).toBe(null);
    expect(typed.data.settings.touch).toBe('auto');
    const future = new SaveStore(3, memStorage({ [SAVE_KEY]: JSON.stringify({ v: 99 }) }));
    expect(future.recovered).toBe(true);
    const none = new SaveStore(3, null);
    expect(none.available).toBe(false);
    none.completeLevel(0, 1, 1);
    expect(none.data.unlocked).toBe(1);
    const throwing: StorageLike = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    const t = new SaveStore(3, throwing);
    t.save();
    expect(t.available).toBe(false);
  });

  it('reset clears progress but keeps settings', () => {
    const s = new SaveStore(3, memStorage());
    s.completeLevel(0, 10, 10);
    s.data.settings.sfx = false;
    s.resetProgress();
    expect(s.data.unlocked).toBe(0);
    expect(s.data.settings.sfx).toBe(false);
  });
});

describe('boss', () => {
  it('the Rebounder 3000 can be beaten in three core stomps and the giant V finishes the level', () => {
    const def = LEVELS[2]();
    const run = newRun();
    const session = { rare: new Set<string>(), time: 0, deaths: 0 };
    const w = new World(def, run, session, new Set());
    const a = def.arena!;
    w.player.place(a.trigger + 2 * TILE, 12 * TILE);
    w.player.starT = 0;
    let hits = 0;
    let guard = 0;
    while (w.boss!.state !== 'dead' && guard++ < 60 * 90) {
      const b = w.boss!;
      // Keep the test player safe on the left seats until the hatch opens.
      if (b.state === 'exposed' && b.t > 0.4) {
        w.player.invulnT = 5;
        w.player.place(b.cx, b.y - 40);
        w.player.vy = 300;
        const hp = b.hp;
        stepN(w, 6);
        if (b.hp < hp) hits++;
      } else {
        w.player.invulnT = 5;
        w.player.place(a.trigger + 0.8 * TILE, 10 * TILE);
        w.update(STEP, input());
      }
      expect(w.status).toBe('play');
    }
    expect(hits).toBe(3);
    stepN(w, 60 * 3);
    expect(w.trophy?.landed).toBe(true);
    w.player.place(w.trophy!.x, 12 * TILE);
    stepN(w, 60 * 4);
    expect(w.status).toBe('done');
  });
});
