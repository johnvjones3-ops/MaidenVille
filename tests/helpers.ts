import { CONTROLS } from '../src/config';
import { laneLateral } from '../src/sim/generator';
import { RunSim } from '../src/sim/run';
import { findPath, obstaclesToRows, type ReachState } from '../src/sim/validator';

/**
 * A simple autopilot that uses the same validator the generator uses, then drives the real simulation
 * through PlayerController-style inputs. If it survives, the course is reachable with real timings.
 */
export function autopilot(sim: RunSim) {
  if (sim.gliding) return;
  const ahead = sim.obstacles.filter((o) => !o.hit && !o.practice && o.d + o.length / 2 > sim.d - 0.2 && o.d - o.length / 2 < sim.d + 60);
  if (ahead.length === 0) return;
  const rows = obstaclesToRows(ahead).filter((r) => r.d > sim.d - 0.3);
  if (rows.length === 0) return;
  const cur = Math.round(sim.x / CONTROLS.laneWidth) + 1;
  const start: ReachState = [new Set(), new Set(), new Set()];
  start[sim.lane].add(sim.airborne ? 'jump' : sim.sliding ? 'slide' : 'open');
  const t = sim.gen.timings;
  const path = findPath(start, sim.d, rows, Math.max(sim.speed, 1), { ...t, reaction: 0.02 }, cur) ?? findPath(start, sim.d, rows, Math.max(sim.speed, 1), { ...t, reaction: 0 }, cur);
  if (!path) return;
  const want = path[0];
  if (want !== sim.lane) {
    sim.input(want < sim.lane ? 'left' : 'right');
    return;
  }
  if (Math.abs(sim.x - laneLateral(sim.lane)) > 0.4) return;
  const row = rows[0];
  const req = row.lanes[want];
  const dist = row.d - sim.d;
  const tt = dist / Math.max(sim.speed, 1);
  if (req === 'jump' && !sim.airborne && tt < 0.16) sim.input('jump');
  if (req === 'slide' && !sim.sliding && tt < 0.12) sim.input('slide');
}
