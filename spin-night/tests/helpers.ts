import { newGame, reduce, type Ctx } from '../src/engine/game';
import type { Action, GameSettings, GameState, Pid, Segment, WedgeKind } from '../src/engine/types';
import { PuzzlePicker, emptyHistory, type History } from '../src/puzzles/select';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function setup(settings: Partial<GameSettings> = {}, seed = 7, history: History = emptyHistory()) {
  const rand = rng(seed);
  const picker = new PuzzlePicker(history, rand);
  const ctx: Ctx = { picker, rand, now: () => 1_700_000_000_000 };
  let s: GameState = newGame({ difficulty: 'mixed', denton: true, timerMode: 'tv', ...settings }, ctx);
  const g = {
    ctx,
    picker,
    get s() {
      return s;
    },
    set s(v: GameState) {
      s = v;
    },
    act(a: Action) {
      const r = reduce(s, a, ctx);
      s = r.state;
      return r;
    },
    /** Advances time in small steps, the way the UI ticks. */
    wait(ms: number) {
      for (let t = 0; t < ms; t += 100) g.act({ type: 'tick', dt: Math.min(100, ms - t) });
    },
    /** Index of the first wedge of a kind on the current wheel. */
    wedge(kind: WedgeKind, value?: number) {
      return s.wheel.findIndex((w) => w.kind === kind && (value === undefined || w.value === value));
    },
    spinTo(index: number) {
      const r1 = g.act({ type: 'spin', from: s.angle, power: 0.5, force: index });
      if (!r1.accepted) return r1;
      return g.act({ type: 'landed' });
    },
    answer() {
      return s.puzzle!.answer;
    },
    /** A consonant that is in the puzzle and not yet called. */
    goodConsonant() {
      const a = s.puzzle!.answer;
      return [...'TNRSLHDCMGPBFWYKVXZJQ'].find((c) => a.includes(c) && !(c in s.puzzle!.used))!;
    },
    badConsonant() {
      const a = s.puzzle!.answer;
      return [...'QZXJVKWFBPMGYCDHLSRTN'].find((c) => !a.includes(c) && !(c in s.puzzle!.used))!;
    },
    goodVowel() {
      const a = s.puzzle!.answer;
      return [...'EAOIU'].find((c) => a.includes(c) && !(c in s.puzzle!.used));
    },
    badVowel() {
      const a = s.puzzle!.answer;
      return [...'UIOAE'].find((c) => !a.includes(c) && !(c in s.puzzle!.used));
    },
    tossup(pid: Pid | null) {
      g.act({ type: 'start' });
      if (pid === null) {
        g.act({ type: 'buzz', pid: 0 });
        g.act({ type: 'submit', text: 'NOT IT' });
        g.act({ type: 'buzz', pid: 1 });
        g.act({ type: 'submit', text: 'NOT IT' });
      } else {
        g.act({ type: 'buzz', pid });
        g.act({ type: 'submit', text: s.puzzle!.answer });
      }
      g.act({ type: 'continue' });
    },
    /** Plays a main round: `pid` earns money with a consonant, then solves. */
    round(pid: Pid) {
      g.act({ type: 'start' });
      if (s.control !== pid) {
        // Hand control over with a wrong solve.
        g.act({ type: 'solve' });
        g.act({ type: 'submit', text: 'NOT IT' });
      }
      g.act({ type: 'solve' });
      g.act({ type: 'submit', text: s.puzzle!.answer });
      g.act({ type: 'continue' });
    },
    to(seg: Segment) {
      let guard = 0;
      while (s.segment !== seg && guard++ < 40) {
        if (s.segment.startsWith('tossup') || s.segment.startsWith('triple') || s.segment === 'tiebreak') g.tossup(0);
        else if (s.segment.startsWith('round')) g.round(0);
        else throw new Error(`cannot skip past ${s.segment}`);
      }
      if (s.segment !== seg) throw new Error(`did not reach ${seg}`);
    },
  };
  return g;
}
