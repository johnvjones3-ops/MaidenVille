import { STEP, TILE } from '../src/config';
import { emptyInput, type InputState } from '../src/core/input';
import { LevelBuilder } from '../src/levels/builder';
import type { LevelDef } from '../src/levels/types';
import { newRun } from '../src/game/state';
import { World } from '../src/game/world';

export function flatLevel(w = 40, setup?: (b: LevelBuilder) => void): LevelDef {
  const b = new LevelBuilder(0, 'Test', '', 'plaza', 'plaza', w);
  b.ground(0, w - 1, 12);
  b.spawn(3);
  setup?.(b);
  return b.build();
}

export function makeWorld(def: LevelDef, rare: Set<string> = new Set()) {
  const run = newRun();
  const session = { rare: new Set<string>(), time: 0, deaths: 0 };
  const w = new World(def, run, session, rare);
  return { w, run, session };
}

export function input(p: Partial<InputState> = {}): InputState {
  return { ...emptyInput(), ...p };
}

/** Steps the world n times with the given input (jumpPressed only on the first step). */
export function stepN(w: World, n: number, p: Partial<InputState> = {}) {
  for (let i = 0; i < n; i++) w.update(STEP, input(i === 0 ? p : { ...p, jumpPressed: false, actionPressed: false, upPressed: false }));
}

export const tile = (n: number) => n * TILE;
