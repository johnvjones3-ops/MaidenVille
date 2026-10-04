import { PHYS, STEP, TILE } from '../config';
import { emptyInput } from '../core/input';
import { Player } from '../game/player';
import { T, TileMap, isOneWay, isSolid } from '../game/tiles';
import type { LevelDef } from './types';

/**
 * Reachability check that replays the real player physics (Rookie form, no power-ups,
 * enemies ignored). Standing spots are graph nodes; simulated jumps/walk-offs are edges.
 * Used by tests to prove each level is completable on its main route, that every checkpoint
 * is reachable, and that no reachable spot is a dead end.
 */

interface Node {
  id: number;
  x: number; // feet centre
  c: number;
  r: number; // row of the floor tile top the feet rest on
  out: number[];
}

export interface Reach {
  nodes: Node[];
  reachable: Set<number>;
  canFinish: Set<number>;
  finishReached: boolean;
  checkpointsReached: number[];
  deadEnds: { x: number; r: number }[];
  doorsUsed: number;
  sims: number;
  /** Rare collectible uids the simulated player touched. */
  raresTouched: Set<number>;
  rareUids: number[];
}

export function validatorMap(def: LevelDef, revealHidden = false): TileMap {
  const m = new TileMap(def.w, def.h, new Uint8Array(def.tiles));
  if (revealHidden) for (let i = 0; i < m.data.length; i++) if (m.data[i] === T.HIDDEN) m.data[i] = T.CRATE_EMPTY;
  for (const [k, v] of def.crates) m.crates.set(k, { ...v });
  // Moving platforms become one-way surfaces along their path (the player can wait for them).
  for (const e of def.entities) {
    if (e.kind !== 'platform') continue;
    const w = e.w ?? 2;
    const steps = Math.ceil(Math.max(Math.abs(e.dx ?? 0), Math.abs(e.dy ?? 0)) / (TILE / 2)) + 1;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const px = e.x + (e.dx ?? 0) * k;
      const py = e.y + (e.dy ?? 0) * k;
      const row = Math.round(py / TILE);
      for (let c = Math.floor(px / TILE); c < Math.ceil((px + w * TILE) / TILE); c++)
        if (m.get(c, row) === T.EMPTY) m.set(c, row, T.ONEWAY);
    }
  }
  return m;
}

function standable(m: TileMap, c: number, r: number) {
  const f = m.get(c, r);
  return (isSolid(f) || isOneWay(f)) && !isSolid(m.get(c, r - 1)) && f !== T.BARRIER;
}

export function analyze(def: LevelDef, opts: { finishX?: number; revealHidden?: boolean } = {}): Reach {
  const m = validatorMap(def, opts.revealHidden);
  const nodes: Node[] = [];
  const index = new Map<number, number>();
  const key = (c: number, r: number) => r * 10000 + c;
  const getNode = (x: number, r: number): number => {
    const c = Math.floor(x / TILE);
    const k = key(c, r);
    const f = index.get(k);
    if (f !== undefined) return f;
    const id = nodes.length;
    nodes.push({ id, x, c, r, out: [] });
    index.set(k, id);
    return id;
  };

  const p = new Player();
  let sims = 0;
  const rares = def.entities.filter((e) => e.rid !== undefined);
  const raresTouched = new Set<number>();
  const touch = () => {
    for (const e of rares) {
      if (raresTouched.has(e.uid)) continue;
      if (Math.abs(e.x - p.cx) < 20 + p.w / 2 && e.y + 20 > p.y && e.y - 20 < p.bottom) raresTouched.add(e.uid);
    }
  };
  const simulate = (x: number, r: number, dir: number, run: boolean, vx0: number, hold: number, steerStop: number, jump: boolean, drop: boolean, launch?: { feetY: number; vy: number }): number => {
    sims++;
    p.resetLife();
    p.place(x, launch ? launch.feetY : r * TILE);
    p.vx = vx0;
    p.vy = launch ? launch.vy : 0;
    p.onGround = !launch;
    const inp = emptyInput();
    let left = false;
    for (let f = 0; f < 260; f++) {
      inp.left = f < steerStop && dir < 0;
      inp.right = f < steerStop && dir > 0;
      inp.run = run;
      inp.down = drop;
      inp.jump = jump && f < hold;
      inp.jumpPressed = jump && f === 0;
      p.step(STEP, inp, m, []);
      touch();
      if (!p.onGround) left = true;
      else if (left) {
        const rr = Math.round(p.bottom / TILE);
        return getNode(p.cx, rr);
      } else if (!jump && f > 40) return -1; // walked but never left the ground
      if (p.y > m.h * TILE) return -1;
    }
    return -1;
  };

  const start = getNode(def.spawn.x, Math.round(def.spawn.y / TILE));
  for (const e of def.entities) if (e.kind === 'checkpoint') getNode(e.x, Math.round(e.y / TILE));
  const doorList = def.entities.filter((e) => e.kind === 'door');
  const bouncers = def.entities.filter((e) => e.kind === 'bouncer');

  const reachable = new Set<number>([start]);
  const queue = [start];
  let doorsUsed = 0;
  while (queue.length) {
    const id = queue.shift()!;
    const n = nodes[id];
    p.resetLife();
    p.place(n.x, n.r * TILE);
    touch();
    const add = (to: number) => {
      if (to < 0 || to === id) return;
      if (!n.out.includes(to)) n.out.push(to);
      if (!reachable.has(to)) {
        reachable.add(to);
        queue.push(to);
      }
    };
    // Walking along the floor.
    for (const d of [-1, 1]) {
      const c2 = n.c + d;
      if (standable(m, c2, n.r) && !isSolid(m.get(c2, n.r - 1))) add(getNode((c2 + 0.5) * TILE, n.r));
    }
    // Run-up room behind the node, per direction.
    const room = (dir: number) => standable(m, n.c - dir, n.r) && standable(m, n.c - 2 * dir, n.r);
    for (const dir of [-1, 1]) {
      for (const run of [false, true]) {
        const speed = run ? PHYS.runMax : PHYS.walkMax;
        const vx0 = room(dir) ? dir * speed : 0;
        for (const hold of [1, 9, 60]) for (const steer of [999, 16]) add(simulate(n.x, n.r, dir, run, vx0, hold, steer, true, false));
        add(simulate(n.x, n.r, dir, run, vx0, 0, 999, false, false)); // walk off a ledge
      }
    }
    add(simulate(n.x, n.r, 0, false, 0, 60, 0, true, false)); // straight up
    if (isOneWay(m.get(n.c, n.r))) add(simulate(n.x, n.r, 0, false, 0, 1, 0, true, true)); // drop through
    // Bouncing practice balls launch the player (as in World.updateHazards).
    for (const bo of bouncers) {
      if (Math.abs(bo.x - n.x) > 3 * TILE || Math.round(bo.y / TILE) !== n.r) continue;
      const feetY = bo.y - 60 - (bo.dy ?? 3 * TILE) * 0.5;
      for (const vy of [-760, -900]) for (const dir of [-1, 0, 1]) for (const steer of [999, 20, 35])
        add(simulate(bo.x, n.r, dir, true, 0, 0, steer, false, false, { feetY, vy }));
    }
    // Doors.
    for (const d of doorList) {
      if (Math.abs(d.x - n.x) < TILE && Math.round(d.y / TILE) === n.r) {
        const t = doorList.find((o) => o.door === d.target);
        if (t) {
          doorsUsed++;
          add(getNode(t.x, Math.round(t.y / TILE)));
        }
      }
    }
  }

  const finishEnt = def.entities.find((e) => e.kind === 'finish');
  const finishX = opts.finishX ?? (finishEnt ? finishEnt.x - 12 : def.arena ? def.arena.trigger + TILE : Infinity);
  const goals = [...reachable].filter((id) => nodes[id].x >= finishX);
  // Reverse reachability from the goals.
  const rev = new Map<number, number[]>();
  for (const id of reachable) for (const to of nodes[id].out) {
    if (!rev.has(to)) rev.set(to, []);
    rev.get(to)!.push(id);
  }
  const canFinish = new Set<number>(goals);
  const q2 = [...goals];
  while (q2.length) {
    const id = q2.shift()!;
    for (const from of rev.get(id) ?? []) if (!canFinish.has(from)) {
      canFinish.add(from);
      q2.push(from);
    }
  }
  const checkpointsReached = def.entities
    .filter((e) => e.kind === 'checkpoint')
    .filter((e) => reachable.has(index.get(key(Math.floor(e.x / TILE), Math.round(e.y / TILE)))!))
    .map((e) => e.uid);
  const deadEnds = [...reachable].filter((id) => !canFinish.has(id)).map((id) => ({ x: nodes[id].c, r: nodes[id].r }));
  return { nodes, reachable, canFinish, finishReached: goals.length > 0, checkpointsReached, deadEnds, doorsUsed, sims, raresTouched, rareUids: rares.map((e) => e.uid) };
}
