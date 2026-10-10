// Puzzle selection over the bank and the seen-puzzle history.
//
// Unseen puzzles always win. Within unseen puzzles we prefer the requested
// difficulty, then nearby difficulties, and avoid repeating a category in the
// same episode. Only when a pool is exhausted do we recycle, oldest first.

import { letterCount } from '../engine/answer';
import type { Category, Difficulty, PickRequest, Picker, Puzzle, TripleSet } from '../engine/types';
import { BONUS_PUZZLES, MAIN_PUZZLES, PRIZE_PUZZLES, TRIPLE_SETS, puzzleById, tripleById } from './bank';

export interface History {
  /** id -> game counter when last put on the board */
  seen: Record<string, number>;
  /** Increments once per new game. */
  counter: number;
}

export const emptyHistory = (): History => ({ seen: {}, counter: 0 });

const NEAR: Record<Difficulty, Difficulty[]> = {
  easy: ['easy', 'medium', 'hard'],
  medium: ['medium', 'easy', 'hard'],
  hard: ['hard', 'medium', 'easy'],
};

const DENTON: Category = 'Denton, Texas';

export const isTossupFriendly = (p: Puzzle) => letterCount(p.answer) >= 9 && p.answer.includes(' ');

export class PuzzlePicker implements Picker {
  constructor(
    public history: History,
    private rand: () => number,
    private onChange: () => void = () => {},
  ) {}

  private choose<T>(list: T[]): T {
    return list[Math.floor(this.rand() * list.length)];
  }

  private oldest<T extends { id: string }>(list: T[]): T[] {
    if (!list.length) return list;
    const age = (x: T) => this.history.seen[x.id] ?? -1;
    const min = Math.min(...list.map(age));
    return list.filter((x) => age(x) === min);
  }

  /** Picks from the first non-empty tier. */
  private tiered<T extends { id: string; difficulty: Difficulty; category: Category }>(
    base: T[],
    difficulty: Difficulty,
    prefer?: Category,
    avoid: Category[] = [],
  ): T | undefined {
    const unseen = base.filter((p) => !(p.id in this.history.seen));
    const tiers: T[][] = [];
    if (prefer) {
      tiers.push(unseen.filter((p) => p.category === prefer && p.difficulty === difficulty));
      tiers.push(unseen.filter((p) => p.category === prefer));
    }
    for (const d of NEAR[difficulty]) {
      tiers.push(unseen.filter((p) => p.difficulty === d && !avoid.includes(p.category)));
      tiers.push(unseen.filter((p) => p.difficulty === d));
    }
    tiers.push(this.oldest(base.filter((p) => p.difficulty === difficulty)));
    tiers.push(this.oldest(base));
    const tier = tiers.find((t) => t.length);
    return tier ? this.choose(tier) : undefined;
  }

  pick(req: PickRequest): Puzzle {
    const pool = req.pool === 'prize' ? PRIZE_PUZZLES : req.pool === 'bonus' ? BONUS_PUZZLES : MAIN_PUZZLES;
    const allowed = pool.filter((p) => (req.allowDenton || p.category !== DENTON) && !req.exclude.includes(p.id));
    const base = req.tossup ? allowed.filter(isTossupFriendly) : allowed;
    const prefer = req.allowDenton ? req.preferCategory : undefined;
    const p = this.tiered(base.length ? base : allowed, req.difficulty, prefer, req.avoidCategories);
    if (!p) throw new Error(`No puzzle available in pool ${req.pool}`);
    return p;
  }

  pickTriple(difficulty: Difficulty, allowDenton: boolean, exclude: string[]): TripleSet {
    const base = TRIPLE_SETS.filter(
      (s) => (allowDenton || s.category !== DENTON) && !s.puzzles.some((p) => exclude.includes(p.id)),
    );
    const set = this.tiered(base, difficulty);
    if (!set) throw new Error('No Triple Toss-Up set available');
    return set;
  }

  pickBonusOptions(difficulty: Difficulty, allowDenton: boolean, exclude: string[]): Puzzle[] {
    const cats = [...new Set(BONUS_PUZZLES.map((p) => p.category))].filter((c) => allowDenton || c !== DENTON);
    const unseenScore = (c: Category) =>
      BONUS_PUZZLES.some((p) => p.category === c && !(p.id in this.history.seen) && !exclude.includes(p.id)) ? 0 : 1;
    // Categories with unseen puzzles first, shuffled within each group.
    const ranked = cats
      .map((c) => ({ c, k: unseenScore(c) + this.rand() * 0.5 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.c);
    const out: Puzzle[] = [];
    for (const c of ranked) {
      if (out.length === 3) break;
      const base = BONUS_PUZZLES.filter((p) => p.category === c && !exclude.includes(p.id));
      const p = this.tiered(base, difficulty);
      if (p) out.push(p);
    }
    return out;
  }

  get(id: string) {
    return puzzleById(id);
  }

  getTriple(id: string) {
    return tripleById(id);
  }

  markSeen(id: string) {
    this.history.seen[id] = this.history.counter;
    this.onChange();
  }
}
