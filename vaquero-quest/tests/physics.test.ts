import { describe, expect, it } from 'vitest';
import { BODY, STEP, TILE } from '../src/config';
import { T } from '../src/game/tiles';
import { flatLevel, input, makeWorld, stepN } from './helpers';

describe('movement', () => {
  it('stands on real ground and walks/runs to the tuned max speeds', () => {
    const { w } = makeWorld(flatLevel());
    stepN(w, 5);
    expect(w.player.onGround).toBe(true);
    expect(w.player.bottom).toBe(12 * TILE);
    stepN(w, 60, { right: true });
    expect(Math.round(w.player.vx)).toBe(240);
    stepN(w, 60, { right: true, run: true });
    expect(Math.round(w.player.vx)).toBe(360);
    stepN(w, 30);
    expect(w.player.vx).toBe(0);
  });

  it('full jump peaks about 2.5 tiles; a tap gives a short hop', () => {
    const peak = (hold: number) => {
      const { w } = makeWorld(flatLevel());
      stepN(w, 5);
      const start = w.player.bottom;
      let best = 0;
      for (let i = 0; i < 90; i++) {
        w.update(STEP, input({ jump: i < hold, jumpPressed: i === 0 }));
        best = Math.max(best, start - w.player.bottom);
      }
      return best / TILE;
    };
    const full = peak(60);
    const hop = peak(1);
    expect(full).toBeGreaterThan(2.4);
    expect(full).toBeLessThan(2.8);
    expect(hop).toBeLessThan(1.0);
    expect(hop).toBeGreaterThan(0.25);
  });

  it('coyote time allows a jump just after leaving a ledge, not later', () => {
    const def = flatLevel(30, (b) => b.clear(10, 12, 29, 14));
    const tryJump = (lateFrames: number) => {
      const { w } = makeWorld(def);
      w.player.place(9 * TILE + TILE - 14, 12 * TILE);
      stepN(w, 3);
      // walk off the edge
      let frames = 0;
      while (w.player.onGround && frames < 100) {
        w.update(STEP, input({ right: true }));
        frames++;
      }
      stepN(w, lateFrames, { right: true });
      w.update(STEP, input({ right: true, jump: true, jumpPressed: true }));
      return w.player.vy < -500;
    };
    expect(tryJump(3)).toBe(true); // 50 ms after leaving the ledge
    expect(tryJump(9)).toBe(false); // 150 ms: too late
  });

  it('buffers a jump pressed shortly before landing', () => {
    const { w } = makeWorld(flatLevel());
    w.player.place(5 * TILE, 12 * TILE - 10); // in the air just above ground
    w.update(STEP, input({ jump: true, jumpPressed: true }));
    let jumped = false;
    for (let i = 0; i < 12; i++) {
      w.update(STEP, input({ jump: true }));
      if (w.player.vy < -500) jumped = true;
    }
    expect(jumped).toBe(true);
  });

  it('never tunnels through a thin wall or floor at sprint and terminal speeds', () => {
    const def = flatLevel(40, (b) => b.fill(12, 0, 12, 11, T.BRICK));
    const { w } = makeWorld(def);
    w.player.vx = 5000; // absurd speed still resolves against the wall
    stepN(w, 120, { right: true, run: true });
    expect(w.player.x + w.player.w).toBeLessThanOrEqual(12 * TILE);
    // terminal fall onto a one-tile floor
    const def2 = flatLevel(20, (b) => b.clear(0, 12, 19, 14).fill(0, 13, 19, 13, T.STONE));
    const { w: w2 } = makeWorld(def2);
    w2.player.place(5 * TILE, 2 * TILE);
    w2.player.vy = 4000;
    stepN(w2, 120);
    expect(w2.player.bottom).toBe(13 * TILE);
    expect(w2.player.onGround).toBe(true);
  });

  it('one-way platforms hold from above, pass from below, and allow drop-through', () => {
    const def = flatLevel(30, (b) => b.walk(2, 8, 10));
    const { w } = makeWorld(def);
    // Jump up through it from below.
    w.player.place(5 * TILE, 12 * TILE);
    stepN(w, 3);
    stepN(w, 40, { jump: true, jumpPressed: true });
    stepN(w, 30);
    expect(w.player.bottom).toBe(10 * TILE);
    expect(w.player.onGround).toBe(true);
    // Down + jump drops through.
    w.update(STEP, input({ down: true, jump: true, jumpPressed: true }));
    stepN(w, 40, { down: true });
    expect(w.player.bottom).toBe(12 * TILE);
  });

  it('moving platforms carry the player without falling through', () => {
    const def = flatLevel(40, (b) => {
      b.clear(6, 12, 30, 14);
      b.platform(6, 10, 2, 8, 0, 4);
      b.platform(20, 11, 2, 0, -5, 3);
    });
    const { w } = makeWorld(def);
    const pl = w.platforms[0];
    w.player.place(pl.x + pl.w / 2, pl.y - 2);
    stepN(w, 2);
    for (let i = 0; i < 240; i++) {
      w.update(STEP, input());
      expect(w.status).toBe('play');
      expect(Math.abs(w.player.bottom - pl.y)).toBeLessThan(1.5);
      expect(w.player.cx).toBeGreaterThan(pl.x - 4);
      expect(w.player.cx).toBeLessThan(pl.x + pl.w + 4);
    }
    const vp = w.platforms[1];
    w.player.place(vp.x + vp.w / 2, vp.y - 2);
    stepN(w, 2);
    for (let i = 0; i < 360; i++) {
      w.update(STEP, input());
      expect(Math.abs(w.player.bottom - vp.y)).toBeLessThan(1.5);
    }
  });
});

describe('blocks', () => {
  it('a crate is struck only from below and pays out exactly once', () => {
    const def = flatLevel(30, (b) => b.crate(6, 8, 'ball'));
    const { w, run } = makeWorld(def);
    // Walking into it from the side does nothing (place on top later).
    w.player.place(6.5 * TILE, 12 * TILE);
    stepN(w, 3);
    // Jump and hold jump against the ceiling for a long time.
    stepN(w, 120, { jump: true, jumpPressed: true });
    expect(run.ballsTotal).toBe(1);
    expect(w.map.get(6, 8)).toBe(T.CRATE_EMPTY);
    // Jump again: empty crate stays solid, no reward.
    stepN(w, 60);
    stepN(w, 60, { jump: true, jumpPressed: true });
    expect(run.ballsTotal).toBe(1);
    expect(w.map.get(6, 8)).toBe(T.CRATE_EMPTY);
    // Standing on top never activates it.
    const { w: w2, run: run2 } = makeWorld(def);
    w2.player.place(6.5 * TILE, 8 * TILE);
    stepN(w2, 60);
    expect(w2.player.bottom).toBe(8 * TILE);
    expect(run2.ballsTotal).toBe(0);
    expect(w2.map.get(6, 8)).toBe(T.CRATE);
  });

  it('multi-reward crates count down per hit', () => {
    const def = flatLevel(30, (b) => b.crate(6, 8, 'ball', 3));
    const { w, run } = makeWorld(def);
    w.player.place(6.5 * TILE, 12 * TILE);
    for (let k = 0; k < 5; k++) {
      stepN(w, 3);
      stepN(w, 70, { jump: true, jumpPressed: true });
    }
    expect(run.ballsTotal).toBe(3);
    expect(w.map.get(6, 8)).toBe(T.CRATE_EMPTY);
  });

  it('hat crate grants Vaquero form; growth is deferred under a low ceiling', () => {
    const def = flatLevel(30, (b) => b.crate(6, 8, 'hat'));
    const { w } = makeWorld(def);
    w.player.place(6.5 * TILE, 12 * TILE);
    stepN(w, 3);
    stepN(w, 40, { jump: true, jumpPressed: true });
    expect(w.items.filter((i) => i.kind === 'hat').length).toBe(1);
    // Wait in the sliding hat's path.
    w.player.place(10 * TILE, 12 * TILE);
    stepN(w, 150);
    expect(w.player.form).toBe('vaquero');

    // Low ceiling: one tile of headroom over the floor between columns 8..16.
    const low = flatLevel(30, (b) => b.fill(8, 10, 16, 10, T.BRICK).fill(8, 11, 16, 11, T.EMPTY));
    const { w: w3 } = makeWorld(low);
    w3.player.place(12 * TILE, 12 * TILE);
    stepN(w3, 3);
    w3.player.tryGrow(w3.map);
    expect(w3.player.form).toBe('rookie');
    expect(w3.player.pendingGrow).toBe(true);
    stepN(w3, 30);
    expect(w3.map.boxHitsSolid(w3.player.x, w3.player.y, w3.player.w, w3.player.h)).toBe(false);
    stepN(w3, 120, { right: true });
    expect(w3.player.form).toBe('vaquero');
    expect(w3.player.h).toBe(BODY.vaquero.h);
    expect(w3.map.boxHitsSolid(w3.player.x, w3.player.y, w3.player.w, w3.player.h)).toBe(false);
  });

  it('Vaquero form breaks terracotta blocks; Rookie only bumps them', () => {
    const def = flatLevel(30, (b) => b.breakable(6, 8));
    const { w } = makeWorld(def);
    w.player.place(6.5 * TILE, 12 * TILE);
    stepN(w, 3);
    stepN(w, 60, { jump: true, jumpPressed: true });
    expect(w.map.get(6, 8)).toBe(T.BREAK);
    stepN(w, 30);
    w.player.tryGrow(w.map);
    stepN(w, 3);
    stepN(w, 60, { jump: true, jumpPressed: true });
    expect(w.map.get(6, 8)).toBe(T.EMPTY);
  });

  it('hidden blocks appear only when struck from below', () => {
    const def = flatLevel(30, (b) => b.hidden(6, 8, 'ball'));
    const { w, run } = makeWorld(def);
    // Falling down through its space from above does nothing.
    w.player.place(6.5 * TILE, 6 * TILE);
    stepN(w, 60);
    expect(w.map.get(6, 8)).toBe(T.HIDDEN);
    expect(w.player.bottom).toBe(12 * TILE);
    stepN(w, 60, { jump: true, jumpPressed: true });
    expect(w.map.get(6, 8)).toBe(T.CRATE_EMPTY);
    expect(run.ballsTotal).toBe(1);
  });

  it('bumping a block knocks out the enemy standing on it', () => {
    const def = flatLevel(30, (b) => {
      b.crate(6, 9, 'ball', 5);
      b.enemy('bot', 6, 9);
    });
    const { w } = makeWorld(def);
    w.enemies[0].activate();
    w.player.place(6.5 * TILE, 12 * TILE);
    stepN(w, 2);
    stepN(w, 25, { jump: true, jumpPressed: true });
    expect(w.enemiesDefeated).toBe(1);
  });
});

describe('enemies and damage', () => {
  it('stomp from above defeats and bounces; side contact damages', () => {
    const def = flatLevel(40, (b) => b.enemy('bot', 12, 12));
    const { w } = makeWorld(def);
    const e = w.enemies[0];
    e.activate();
    w.player.place(e.x + e.w / 2, e.y - 60);
    w.player.vy = 200;
    stepN(w, 20);
    expect(e.dead).toBe(true);
    expect(w.status).toBe('play');
    // Side contact.
    const { w: w2 } = makeWorld(def);
    const e2 = w2.enemies[0];
    e2.activate();
    w2.player.place(e2.x - 20, 12 * TILE);
    stepN(w2, 30, { right: true });
    expect(w2.status).toBe('dead');
  });

  it('hat absorbs one hit with invulnerability; second hit after it expires kills', () => {
    const def = flatLevel(40, (b) => b.enemy('bot', 12, 12, { dir: 1 }));
    const { w } = makeWorld(def);
    w.player.tryGrow(w.map);
    w.enemies[0].activate();
    w.player.place(w.enemies[0].x - 10, 12 * TILE);
    stepN(w, 10);
    expect(w.status).toBe('play');
    expect(w.player.form).toBe('rookie');
    expect(w.player.invulnT).toBeGreaterThan(1);
  });

  it('spiky cactus cannot be stomped safely', () => {
    const def = flatLevel(40, (b) => b.enemy('cactus', 12, 12));
    const { w } = makeWorld(def);
    const e = w.enemies[0];
    e.activate();
    w.player.place(e.x + e.w / 2, e.y - 60);
    w.player.vy = 200;
    stepN(w, 20);
    expect(w.status).toBe('dead');
  });

  it('star defeats enemies on contact but not pits', () => {
    const def = flatLevel(40, (b) => {
      b.enemy('cactus', 12, 12);
      b.clear(20, 12, 25, 14);
    });
    const { w } = makeWorld(def);
    w.player.starT = 10;
    w.enemies[0].activate();
    stepN(w, 90, { right: true, run: true });
    expect(w.enemiesDefeated).toBe(1);
    expect(w.status).toBe('play');
    stepN(w, 120, { right: true });
    expect(w.status).toBe('dead');
  });
});
