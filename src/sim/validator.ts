// PatternValidator: proves that a sequence of obstacle rows can be traversed with the real
// lane-change, jump and slide timings at a given speed. Works across pattern and chunk boundaries
// by carrying the set of reachable (lane, last action) states from the previous row.

import { CONTROLS } from '../config';
import type { Obstacle, Req, Row } from './types';
import { OBSTACLE_DEPTH, REQ_FOR } from './types';

export interface Timings {
  laneTime: number;
  airtime: number;
  slideTime: number;
  reaction: number;
}

export function timingsFor(reaction: number): Timings {
  return { laneTime: CONTROLS.laneChangeTime, airtime: CONTROLS.jumpAirtime, slideTime: CONTROLS.slideTime, reaction };
}

export type Act = 'open' | 'jump' | 'slide';
/** state[lane] = set of actions that could have been used to pass the last row in that lane. */
export type ReachState = Array<Set<Act>>;

export function allLanes(): ReachState {
  return [new Set<Act>(['open']), new Set<Act>(['open']), new Set<Act>(['open'])];
}

/** Minimum seconds needed between passing a row with `prev` and the next row with `next`. */
export function minGap(prev: Act, next: Act, moves: number, t: Timings): number {
  const moveNeed = moves > 0 ? moves * t.laneTime * 1.25 + t.reaction : 0;
  let busy = 0;
  if (prev === 'jump') {
    // still airborne after clearing; lane changes are allowed mid-air
    if (next === 'jump') busy = t.airtime * 0.9;
    else if (next === 'slide') busy = 0.38; // quick drop into a slide
    else busy = 0;
  } else if (prev === 'slide') {
    if (next === 'slide') busy = t.slideTime * 0.75;
    else if (next === 'jump') busy = 0.15; // a jump cancels the slide
  }
  const actNeed = next === 'open' ? 0 : busy + t.reaction * 0.6;
  return Math.max(moveNeed, actNeed);
}

function actsFor(req: Req): Act[] {
  switch (req) {
    case 'open':
      return ['open'];
    case 'jump':
      return ['jump'];
    case 'slide':
      return ['slide'];
    default:
      return [];
  }
}

/** Advance a reach state by one row. Returns the new state (possibly with no reachable lanes). */
export function stepReach(prev: ReachState, prevD: number, row: Row, speed: number, t: Timings): ReachState {
  const dt = (row.d - prevD) / speed;
  const out: ReachState = [new Set(), new Set(), new Set()];
  for (let b = 0; b < 3; b++) {
    const acts = actsFor(row.lanes[b]);
    for (const next of acts) {
      let ok = false;
      for (let a = 0; a < 3 && !ok; a++) {
        for (const p of prev[a]) {
          if (dt >= minGap(p, next, Math.abs(a - b), t)) {
            ok = true;
            break;
          }
        }
      }
      if (ok) out[b].add(next);
    }
  }
  return out;
}

export function anyReachable(st: ReachState): boolean {
  return st.some((s) => s.size > 0);
}

/** Convert obstacles into validator rows. Long closures become several rows. */
export function obstaclesToRows(obs: Array<Pick<Obstacle, 'kind' | 'lane' | 'd' | 'length'>>): Row[] {
  const raw: Array<{ d: number; lane: number; req: Req }> = [];
  for (const o of obs) {
    const req = REQ_FOR[o.kind];
    if (o.kind === 'closed') {
      const d0 = o.d - o.length / 2;
      const d1 = o.d + o.length / 2;
      for (let d = d0; d < d1; d += 4) raw.push({ d, lane: o.lane, req });
      raw.push({ d: d1, lane: o.lane, req });
    } else {
      const depth = OBSTACLE_DEPTH[o.kind];
      if (req === 'block') {
        // a solid block occupies the lane for its whole depth
        raw.push({ d: o.d - depth / 2, lane: o.lane, req });
        raw.push({ d: o.d + depth / 2, lane: o.lane, req });
      } else {
        // one jump or slide covers the whole (short) obstacle
        raw.push({ d: o.d - depth / 2, lane: o.lane, req });
      }
    }
  }
  raw.sort((a, b) => a.d - b.d);
  const rows: Row[] = [];
  for (const r of raw) {
    let row = rows[rows.length - 1];
    if (!row || r.d - row.d > 0.75) {
      row = { d: r.d, lanes: ['open', 'open', 'open'] };
      rows.push(row);
    }
    row.lanes[r.lane] = combine(row.lanes[r.lane], r.req);
  }
  return rows;
}

function combine(a: Req, b: Req): Req {
  if (a === 'open') return b;
  if (b === 'open') return a;
  if (a === b) return a;
  return 'block'; // jump + slide in same lane = impassable
}

/**
 * Validate rows starting from a carried state. When `everyStartLane` is set, each currently reachable lane
 * must individually have a path through all rows (so Maddy is never trapped by where she happens to be).
 */
export function validateRows(
  start: ReachState,
  startD: number,
  rows: Row[],
  speed: number,
  t: Timings,
  everyStartLane = true,
): { ok: boolean; end: ReachState; endD: number } {
  const runFrom = (st: ReachState) => {
    let cur = st;
    let d = startD;
    for (const row of rows) {
      cur = stepReach(cur, d, row, speed, t);
      d = row.d;
      if (!anyReachable(cur)) return null;
    }
    return { end: cur, endD: d };
  };
  const whole = runFrom(start);
  if (!whole) return { ok: false, end: start, endD: startD };
  if (everyStartLane) {
    for (let lane = 0; lane < 3; lane++) {
      if (start[lane].size === 0) continue;
      const single: ReachState = [new Set(), new Set(), new Set()];
      single[lane] = new Set(start[lane]);
      if (!runFrom(single)) return { ok: false, end: start, endD: startD };
    }
  }
  return { ok: true, end: whole.end, endD: whole.endD };
}

/** Pick one concrete lane per row along a valid path (used to lay star trails on safe routes). */
export function findPath(start: ReachState, startD: number, rows: Row[], speed: number, t: Timings, preferLane: number): number[] | null {
  const states: ReachState[] = [];
  let cur = start;
  let d = startD;
  for (const row of rows) {
    cur = stepReach(cur, d, row, speed, t);
    states.push(cur);
    d = row.d;
    if (!anyReachable(cur)) return null;
  }
  // backtrack: choose a reachable lane at the last row closest to preference, then walk back
  const path: number[] = new Array(rows.length);
  let target = preferLane;
  for (let i = rows.length - 1; i >= 0; i--) {
    const st = states[i];
    let best = -1;
    let bestScore = Infinity;
    for (let l = 0; l < 3; l++) {
      if (st[l].size === 0) continue;
      if (i < rows.length - 1) {
        // must be able to reach path[i+1] from l
        const nextRow = rows[i + 1];
        const dt = (nextRow.d - rows[i].d) / speed;
        const nextAct = actsFor(nextRow.lanes[path[i + 1]])[0];
        let ok = false;
        for (const p of st[l]) if (dt >= minGap(p, nextAct, Math.abs(l - path[i + 1]), t)) ok = true;
        if (!ok) continue;
      }
      const score = Math.abs(l - target);
      if (score < bestScore) {
        bestScore = score;
        best = l;
      }
    }
    if (best < 0) return null;
    path[i] = best;
    target = best;
  }
  return path;
}
