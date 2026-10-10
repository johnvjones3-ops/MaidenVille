// The episode state machine. Pure: (state, action) -> (new state, events).
// The UI animates events; the engine never touches the DOM or the clock.

import { CONSONANTS, VOWELS, isCorrect, isLetter, isVowel } from './answer';
import {
  BONUS_ENVELOPES,
  WEDGES,
  buildBonusWheel,
  buildWheel,
  formatMoney,
  landingAngle,
  wedgeAt,
} from './wheels';
import {
  other,
  type Action,
  type Difficulty,
  type GameEvent,
  type GameSettings,
  type GameState,
  type Pid,
  type Picker,
  type PlayerState,
  type PrizeCard,
  type Puzzle,
  type Segment,
  type SoundName,
  type TimerKind,
} from './types';

export const NAMES = ['John', 'Lex'] as const;

/** Home-game timing (ms). TV speed follows the broadcast pace; typing-friendly allows for touch typing. */
export const TIMING = {
  tv: { tossupAnswer: 10000, speedLetter: 6000, speedSolve: 10000, bonus: 10000, r4Clock: 60000, revealMs: 950, lastChance: 4000 },
  typing: { tossupAnswer: 25000, speedLetter: 12000, speedSolve: 25000, bonus: 30000, r4Clock: 90000, revealMs: 1100, lastChance: 6000 },
} as const;

export const VOWEL_COST = 250;
export const HOUSE_MINIMUM = 1000;
export const SWEEP_BONUS = 4000;
export const BONUS_LETTERS = ['R', 'S', 'T', 'L', 'N', 'E'];

const MAIN_ROUNDS: Segment[] = ['round1', 'round2', 'round3', 'round4'];
const TOSSUPS: Segment[] = ['tossup1', 'tossup2', 'triple1', 'triple2', 'triple3', 'tiebreak'];
const ORDER: Segment[] = ['tossup1', 'tossup2', 'round1', 'round2', 'round3', 'triple1', 'triple2', 'triple3', 'round4'];

export const isMainRound = (s: Segment) => MAIN_ROUNDS.includes(s);
export const isTossup = (s: Segment) => TOSSUPS.includes(s);

export const SEGMENT_INFO: Record<Segment, { title: string; detail: string }> = {
  tossup1: { title: 'Toss-Up', detail: 'Worth $1,000. Letters appear one at a time. Buzz in as soon as you know it.' },
  tossup2: { title: 'Toss-Up', detail: 'Worth $2,000. The winner starts Round 1.' },
  round1: { title: 'Round 1', detail: 'The Wild Card and a $1,000 Gift Tag are on the wheel.' },
  round2: { title: 'Round 2 · Mystery Round', detail: 'Two Mystery wedges. One hides $10,000, the other hides a Bankrupt.' },
  round3: { title: 'Round 3 · Prize Puzzle', detail: 'Solve it to win a trip. The Express wedge is on the wheel.' },
  triple1: { title: 'Triple Toss-Up · 1 of 3', detail: 'Three connected puzzles, $2,000 each. Win all three for a $4,000 sweep bonus.' },
  triple2: { title: 'Triple Toss-Up · 2 of 3', detail: 'Same category, same hidden theme. $2,000.' },
  triple3: { title: 'Triple Toss-Up · 3 of 3', detail: 'Last one. The winner starts Round 4.' },
  round4: { title: 'Round 4', detail: 'Top wedge $5,000. When the round clock runs out: Final Spin and Speed-Up.' },
  tiebreak: { title: 'Tiebreaker Toss-Up', detail: 'The scores are tied. Solve this to go to the Bonus Round.' },
  bonus: { title: 'Bonus Round', detail: 'One puzzle, a sealed envelope, and a countdown.' },
  results: { title: 'Final Results', detail: '' },
};

export const GIFT_CARD: Omit<PrizeCard, 'id'> = { label: 'Spin Night Gift Card', value: 1000, kind: 'gift' };
export const WHEEL_PRIZES: Omit<PrizeCard, 'id'>[] = [
  { label: 'Weekend Spa Getaway', value: 3250, kind: 'prize' },
  { label: 'Backyard Pizza Oven', value: 2400, kind: 'prize' },
  { label: 'Home Theater Sound System', value: 3600, kind: 'prize' },
  { label: 'Pair of Touring Kayaks', value: 2850, kind: 'prize' },
  { label: 'Hot Air Balloon Ride for Two', value: 1900, kind: 'prize' },
  { label: 'Smart Grill and Patio Set', value: 3100, kind: 'prize' },
];

export interface Ctx {
  picker: Picker;
  rand: () => number;
  now?: () => number;
}

export interface Result {
  state: GameState;
  events: GameEvent[];
  accepted: boolean;
}

const freshPlayer = (): PlayerState => ({
  bank: 0,
  prizes: [],
  round: 0,
  roundPrizes: [],
  wild: 'none',
  bonus: 0,
  bonusLabel: null,
});

export const prizeTotal = (p: PlayerState) => p.prizes.reduce((s, x) => s + x.value, 0);
/** Banked cash plus banked prizes, before the Bonus Round. */
export const mainTotal = (p: PlayerState) => p.bank + prizeTotal(p);
export const grandTotal = (p: PlayerState) => mainTotal(p) + p.bonus;
export const roundTotal = (p: PlayerState) => p.round + p.roundPrizes.reduce((s, x) => s + x.value, 0);

export function newGame(settings: GameSettings, ctx: Ctx): GameState {
  const now = ctx.now?.() ?? Date.now();
  const dentonPlan: Segment[] = [];
  if (settings.denton) {
    dentonPlan.push((['round1', 'round2', 'round4'] as Segment[])[Math.floor(ctx.rand() * 3)]);
    if (ctx.rand() < 0.5) dentonPlan.push(ctx.rand() < 0.5 ? 'tossup1' : 'tossup2');
  }
  const s: GameState = {
    version: 1,
    id: `g${now.toString(36)}${Math.floor(ctx.rand() * 1e6).toString(36)}`,
    createdAt: now,
    updatedAt: now,
    settings: { ...settings },
    segment: 'tossup1',
    phase: { t: 'intro' },
    players: [freshPlayer(), freshPlayer()],
    control: 0,
    puzzle: null,
    wheel: buildWheel('round1', true, ctx.rand),
    angle: Math.floor(ctx.rand() * 360),
    tossup: null,
    timer: null,
    r4clock: null,
    bellRung: false,
    speedValue: 0,
    express: null,
    lastValue: null,
    wildOnWheel: true,
    mysteryFlipped: false,
    starters: {},
    tossupWinners: {},
    used: [],
    tripleSet: null,
    tiebreaks: 0,
    bonus: null,
    msg: '',
    log: [],
    paused: false,
    finished: false,
    dentonPlan,
  };
  const run = new Run(s, ctx);
  run.enterSegment('tossup1');
  return run.s;
}

export function reduce(state: GameState, action: Action, ctx: Ctx): Result {
  const run = new Run(structuredClone(state), ctx);
  const accepted = run.apply(action);
  if (!accepted) return { state, events: [], accepted: false };
  if (action.type !== 'tick') run.s.updatedAt = ctx.now?.() ?? Date.now();
  return { state: run.s, events: run.ev, accepted: true };
}

// ---- queries the UI uses to enable controls -------------------------------------------

export const timing = (s: GameState) => TIMING[s.settings.timerMode];

const unrevealed = (s: GameState, pred: (l: string) => boolean) => {
  const p = s.puzzle;
  if (!p) return false;
  for (let i = 0; i < p.answer.length; i++) if (!p.revealed[i] && pred(p.answer[i])) return true;
  return false;
};

/** True while the puzzle still has a hidden consonant (the wheel can be spun). */
export const consonantsLeft = (s: GameState) => unrevealed(s, (c) => isLetter(c) && !isVowel(c));
export const vowelsLeft = (s: GameState) => unrevealed(s, (c) => isVowel(c));
export const allRevealed = (s: GameState) => !!s.puzzle && s.puzzle.revealed.every(Boolean);

export function canSpin(s: GameState): boolean {
  if (s.paused) return false;
  if (s.phase.t === 'finalSpin' || s.phase.t === 'bonusSpin') return true;
  return s.phase.t === 'turn' && isMainRound(s.segment) && s.express === null && !s.bellRung && consonantsLeft(s);
}

export function canBuyVowel(s: GameState): boolean {
  return (
    !s.paused &&
    s.phase.t === 'turn' &&
    isMainRound(s.segment) &&
    !s.bellRung &&
    vowelsLeft(s) &&
    s.players[s.control].round >= VOWEL_COST
  );
}

export const canSolve = (s: GameState) => !s.paused && s.phase.t === 'turn' && isMainRound(s.segment);

export const canUseWild = (s: GameState) =>
  canSolve(s) && s.express === null && s.lastValue !== null && s.players[s.control].wild === 'held' && consonantsLeft(s);

/** Letters the active player may pick right now. */
export function pickableLetters(s: GameState): Set<string> {
  const out = new Set<string>();
  const p = s.puzzle;
  if (!p || s.paused) return out;
  const unused = (l: string) => !(l in p.used);
  const ph = s.phase.t;
  if (ph === 'consonant' || (ph === 'turn' && s.express === s.control && isMainRound(s.segment))) {
    if (ph === 'turn' && !consonantsLeft(s)) return out;
    CONSONANTS.filter(unused).forEach((l) => out.add(l));
  } else if (ph === 'vowel') {
    VOWELS.filter(unused).forEach((l) => out.add(l));
  } else if (ph === 'speedLetter') {
    [...CONSONANTS, ...VOWELS].filter(unused).forEach((l) => out.add(l));
  }
  return out;
}

/** The main-game winner (who played the Bonus Round) is the champion, even when a tiebreaker decided it. */
export function champion(s: GameState): Pid | null {
  if (s.bonus) return s.bonus.pid;
  const [a, b] = s.players.map(grandTotal);
  return a === b ? null : a > b ? 0 : 1;
}

export function bonusWinner(s: GameState): Pid {
  if (s.bonus) return s.bonus.pid;
  if (s.tossupWinners.tiebreak != null) return s.tossupWinners.tiebreak;
  return mainTotal(s.players[0]) >= mainTotal(s.players[1]) ? 0 : 1;
}

// ---- the reducer ----------------------------------------------------------------------

class Run {
  ev: GameEvent[] = [];
  constructor(public s: GameState, private ctx: Ctx) {}

  private get P() {
    return this.s.players[this.s.control];
  }
  private name(p: Pid = this.s.control) {
    return NAMES[p];
  }
  private sound(s: SoundName) {
    this.ev.push({ e: 'sound', s });
  }
  private flash(text: string, tone: 'good' | 'bad' | 'info' | 'gold') {
    this.ev.push({ e: 'flash', text, tone });
  }
  private log(text: string, pid?: Pid) {
    this.s.log.push({ seg: this.s.segment, text, pid });
  }
  private startTimer(kind: TimerKind) {
    const ms = timing(this.s)[kind];
    this.s.timer = { kind, ms, total: ms };
  }

  apply(a: Action): boolean {
    const s = this.s;
    if (s.finished && a.type !== 'tick') return false;
    if (a.type === 'pause') {
      if (s.paused) return false;
      s.paused = true;
      return true;
    }
    if (a.type === 'resume') {
      if (!s.paused) return false;
      s.paused = false;
      return true;
    }
    if (s.paused) return false;

    const ph = s.phase;
    switch (a.type) {
      case 'tick':
        return this.tick(Math.max(0, Math.min(a.dt, 1000)));
      case 'start':
        if (ph.t !== 'intro') return false;
        return this.startSegment();
      case 'continue':
        if (ph.t !== 'solved' && ph.t !== 'unsolved' && ph.t !== 'bonusDone') return false;
        return this.advance();
      case 'buzz':
        if (ph.t !== 'tossup' || !s.tossup || s.tossup.locked[a.pid]) return false;
        s.phase = { t: 'tossupAnswer', pid: a.pid };
        s.control = a.pid;
        this.startTimer('tossupAnswer');
        s.msg = `${this.name(a.pid)} buzzed in. Type the answer.`;
        this.sound('buzzIn');
        return true;
      case 'spin':
        return this.spin(a.from, a.power, a.force);
      case 'landed':
        if (ph.t !== 'spinning') return false;
        return this.landed();
      case 'letter':
        return this.letter(a.letter.toUpperCase());
      case 'buyVowel':
        if (!canBuyVowel(s)) return false;
        s.lastValue = null;
        s.phase = { t: 'vowel' };
        s.msg = `${this.name()}, pick a vowel. It costs ${formatMoney(VOWEL_COST)}.`;
        return true;
      case 'solve':
        if (!canSolve(s)) return false;
        s.lastValue = null;
        s.phase = { t: 'solve', pid: s.control };
        s.msg = `${this.name()} is solving.`;
        return true;
      case 'cancel':
        if (ph.t === 'vowel' || ph.t === 'solve') {
          s.phase = { t: 'turn' };
          s.msg = this.turnPrompt();
          return true;
        }
        return false;
      case 'submit':
        return this.submit(a.text);
      case 'pass':
        return this.pass();
      case 'useWild': {
        if (!canUseWild(s)) return false;
        const value = s.lastValue!;
        this.P.wild = 'used';
        s.lastValue = null;
        s.phase = { t: 'consonant', wedge: -1, value, wild: true };
        s.msg = `Wild Card played! ${this.name()}, call another consonant for ${formatMoney(value)}.`;
        this.sound('wild');
        this.log(`${this.name()} played the Wild Card`, s.control);
        return true;
      }
      case 'mysteryKeep': {
        if (ph.t !== 'mysteryChoice') return false;
        const amount = 1000 * ph.count;
        this.P.round += amount;
        this.convertMysteries();
        this.toTurn(s.control, `${this.name()} keeps ${formatMoney(amount)}.`);
        return true;
      }
      case 'mysteryFlip': {
        if (ph.t !== 'mysteryChoice') return false;
        const result = s.wheel[ph.wedge].hidden ?? 'bankrupt';
        this.convertMysteries();
        this.ev.push({ e: 'mysteryReveal', wedge: ph.wedge, result });
        if (result === 'cash10k') {
          this.P.round += 10000;
          this.sound('cash10k');
          this.flash('$10,000!', 'gold');
          this.ev.push({ e: 'mood', pid: s.control, mood: 'wow' });
          this.log(`${this.name()} flipped a Mystery wedge and found $10,000`, s.control);
          this.toTurn(s.control, `It's $10,000! ${this.name()} now has ${formatMoney(this.P.round)} this round.`);
        } else {
          this.log(`${this.name()} flipped a Mystery wedge: Bankrupt`, s.control);
          this.bankrupt(s.control, 'The Mystery wedge was a Bankrupt.');
        }
        return true;
      }
      case 'expressRide':
        if (ph.t !== 'expressChoice') return false;
        s.express = s.control;
        s.phase = { t: 'turn' };
        s.msg = `All aboard! ${this.name()}: consonants are $1,000 each, vowels $250. Any miss or wrong solve is a Bankrupt.`;
        this.sound('express');
        this.log(`${this.name()} rode the Express`, s.control);
        return true;
      case 'expressDecline':
        if (ph.t !== 'expressChoice') return false;
        this.toTurn(s.control, `${this.name()} stays off the Express and keeps playing.`);
        return true;
      case 'bonusPick': {
        if (ph.t !== 'bonusCategory' || !s.bonus) return false;
        const id = ph.options[a.index];
        const p = id ? this.ctx.picker.get(id) : undefined;
        if (!p) return false;
        this.loadPuzzle(p);
        s.phase = { t: 'bonusSpin' };
        s.msg = `${p.category}. ${this.name(s.bonus.pid)}, spin the bonus wheel to choose a sealed envelope.`;
        return true;
      }
      case 'bonusLetters':
        return this.bonusLetters(a.consonants.map((c) => c.toUpperCase()), a.vowel.toUpperCase());
    }
    return false;
  }

  // ---- segments --------------------------------------------------------------------

  private difficultyFor(seg: Segment): Difficulty {
    const d = this.s.settings.difficulty;
    if (d !== 'mixed') return d;
    const r = this.ctx.rand();
    switch (seg) {
      case 'tossup1':
      case 'round1':
        return 'easy';
      case 'tossup2':
      case 'round2':
      case 'round3':
      case 'tiebreak':
        return 'medium';
      case 'triple1':
        return r < 0.5 ? 'easy' : 'medium';
      case 'round4':
        return 'hard';
      case 'bonus':
        return r < 0.5 ? 'medium' : 'hard';
      default:
        return 'medium';
    }
  }

  private usedCategories() {
    return this.s.used.map((id) => this.ctx.picker.get(id)?.category).filter((c): c is NonNullable<typeof c> => !!c);
  }

  private loadPuzzle(p: Puzzle) {
    const s = this.s;
    s.puzzle = {
      id: p.id,
      category: p.category,
      answer: p.answer,
      pool: p.pool,
      difficulty: p.difficulty,
      revealed: p.answer.split('').map((ch) => !isLetter(ch)),
      used: {},
      prize: p.prize,
      theme: p.theme,
    };
    if (!s.used.includes(p.id)) s.used.push(p.id);
    this.ctx.picker.markSeen(p.id);
  }

  enterSegment(seg: Segment) {
    const s = this.s;
    s.segment = seg;
    s.phase = { t: 'intro' };
    s.timer = null;
    s.tossup = null;
    s.express = null;
    s.lastValue = null;
    s.bellRung = false;
    s.r4clock = null;
    s.speedValue = 0;
    for (const p of s.players) {
      p.round = 0;
      p.roundPrizes = [];
    }
    const allowDenton = s.settings.denton;
    const req = {
      difficulty: this.difficultyFor(seg),
      exclude: s.used,
      allowDenton,
      preferCategory: s.dentonPlan.includes(seg) ? ('Denton, Texas' as const) : undefined,
      avoidCategories: this.usedCategories(),
    };

    if (seg === 'tossup1' || seg === 'tossup2' || seg === 'tiebreak') {
      this.loadPuzzle(this.ctx.picker.pick({ ...req, pool: 'main', tossup: true }));
    } else if (seg === 'round1' || seg === 'round2' || seg === 'round4') {
      this.loadPuzzle(this.ctx.picker.pick({ ...req, pool: 'main' }));
    } else if (seg === 'round3') {
      this.loadPuzzle(this.ctx.picker.pick({ ...req, pool: 'prize', preferCategory: undefined }));
    } else if (seg === 'triple1') {
      const set = this.ctx.picker.pickTriple(req.difficulty, allowDenton, s.used);
      s.tripleSet = set.id;
      this.ctx.picker.markSeen(set.id);
      this.loadPuzzle(set.puzzles[0]);
    } else if (seg === 'triple2' || seg === 'triple3') {
      const set = s.tripleSet ? this.ctx.picker.getTriple(s.tripleSet) : undefined;
      if (set) this.loadPuzzle(set.puzzles[seg === 'triple2' ? 1 : 2]);
    } else if (seg === 'bonus') {
      const pid = bonusWinner(s);
      const options = this.ctx.picker.pickBonusOptions(req.difficulty, allowDenton, s.used).map((p) => p.id);
      const envelopes = [...BONUS_ENVELOPES];
      for (let i = envelopes.length - 1; i > 0; i--) {
        const j = Math.floor(this.ctx.rand() * (i + 1));
        [envelopes[i], envelopes[j]] = [envelopes[j], envelopes[i]];
      }
      s.bonus = { pid, options, envelopes, envelope: null, consonants: [], vowel: null, extra: s.players[pid].wild === 'held' };
      s.puzzle = null;
      s.control = pid;
      s.wheel = buildBonusWheel();
    }

    if (isMainRound(seg)) {
      s.wheel = buildWheel(seg, s.wildOnWheel, this.ctx.rand);
      s.mysteryFlipped = false;
      s.control = this.starterFor(seg);
      s.starters[seg] = s.control;
    }

    const info = SEGMENT_INFO[seg];
    s.msg = seg === 'bonus' ? `${this.name(s.bonus!.pid)} is going to the Bonus Round!` : info.detail;
  }

  private starterFor(seg: Segment): Pid {
    const s = this.s;
    const w = s.tossupWinners;
    if (seg === 'round1') return w.tossup2 ?? w.tossup1 ?? (this.ctx.rand() < 0.5 ? 0 : 1);
    if (seg === 'round2') return other(s.starters.round1 ?? 0);
    if (seg === 'round3') return s.starters.round1 ?? 0;
    // Round 4: the last Triple Toss-Up winner, else whoever is trailing.
    const t = w.triple3 ?? w.triple2 ?? w.triple1;
    if (t != null) return t;
    const [a, b] = s.players.map(mainTotal);
    if (a !== b) return a < b ? 0 : 1;
    return other(s.starters.round3 ?? 0);
  }

  private startSegment(): boolean {
    const s = this.s;
    const seg = s.segment;
    if (isTossup(seg)) {
      const p = s.puzzle!;
      const order: number[] = [];
      p.answer.split('').forEach((ch, i) => isLetter(ch) && order.push(i));
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(this.ctx.rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      const value = seg === 'tossup1' ? 1000 : seg === 'tiebreak' ? 0 : 2000;
      s.tossup = { order, shown: 0, accum: 0, locked: [false, false], value, lastChance: null };
      s.phase = { t: 'tossup' };
      s.msg = 'Buzz in when you know it!';
      return true;
    }
    if (isMainRound(seg)) {
      if (seg === 'round4') s.r4clock = timing(s).r4Clock;
      this.toTurn(s.control, `${this.name()} starts ${SEGMENT_INFO[seg].title.split(' ·')[0]}.`);
      return true;
    }
    if (seg === 'bonus' && s.bonus) {
      s.phase = { t: 'bonusCategory', options: s.bonus.options };
      s.msg = `${this.name(s.bonus.pid)}, choose a category.`;
      return true;
    }
    return false;
  }

  private advance(): boolean {
    const s = this.s;
    const seg = s.segment;
    if (s.phase.t === 'bonusDone' || seg === 'bonus') {
      s.phase = { t: 'results' };
      s.segment = 'results';
      s.finished = true;
      s.msg = 'Thanks for playing Spin Night!';
      this.sound('victory');
      this.ev.push({ e: 'celebrate', pid: this.champion(), big: true });
      return true;
    }
    if (seg === 'tiebreak') {
      if (s.tossupWinners.tiebreak != null) this.enterSegment('bonus');
      else {
        s.tiebreaks++;
        this.enterSegment('tiebreak');
      }
      return true;
    }
    const i = ORDER.indexOf(seg);
    if (i >= 0 && i < ORDER.length - 1) {
      this.enterSegment(ORDER[i + 1]);
      return true;
    }
    if (seg === 'round4') {
      const [a, b] = s.players.map(mainTotal);
      this.enterSegment(a === b ? 'tiebreak' : 'bonus');
      return true;
    }
    return false;
  }

  champion(): Pid | null {
    return champion(this.s);
  }

  // ---- turns -----------------------------------------------------------------------

  turnPrompt(): string {
    const s = this.s;
    const n = this.name();
    if (s.express === s.control) return `${n} is on the Express: call a consonant, buy a vowel, or solve.`;
    const spin = consonantsLeft(s);
    const vowel = vowelsLeft(s) && this.P.round >= VOWEL_COST;
    if (!spin && !vowelsLeft(s)) return `Every letter is up. ${n}, solve the puzzle!`;
    if (!spin) return vowel ? `No more consonants. ${n}, buy a vowel or solve.` : `No more consonants. ${n}, solve the puzzle.`;
    return vowel ? `${n}, spin, buy a vowel, or solve.` : `${n}, spin the wheel or solve.`;
  }

  private toTurn(pid: Pid, lead?: string) {
    const s = this.s;
    s.control = pid;
    s.timer = null;
    if (s.segment === 'round4' && !s.bellRung && (s.r4clock ?? 1) <= 0) {
      this.ringBell(lead);
      return;
    }
    s.phase = { t: 'turn' };
    s.msg = lead ? `${lead} ${this.turnPrompt()}` : this.turnPrompt();
  }

  private passTurn(lead: string) {
    const s = this.s;
    s.express = null;
    s.lastValue = null;
    this.toTurn(other(s.control), lead);
  }

  private bankrupt(pid: Pid, lead: string) {
    const p = this.s.players[pid];
    p.round = 0;
    p.roundPrizes = [];
    if (p.wild === 'held') p.wild = 'lost';
    this.sound('bankrupt');
    this.flash('BANKRUPT', 'bad');
    this.ev.push({ e: 'mood', pid, mood: 'sad' });
    this.passTurn(lead);
  }

  private convertMysteries() {
    const s = this.s;
    if (s.mysteryFlipped) return;
    s.mysteryFlipped = true;
    s.wheel = s.wheel.map((w) => (w.kind === 'mystery' ? { kind: 'cash', value: 1000, color: w.color } : w));
  }

  private spin(from: number, power: number, force?: number): boolean {
    const s = this.s;
    if (!canSpin(s)) return false;
    const kind = s.phase.t === 'finalSpin' ? 'final' : s.phase.t === 'bonusSpin' ? 'bonus' : 'main';
    const dir: 1 | -1 = power < 0 ? -1 : 1;
    const mag = Math.min(1, Math.max(0.2, Math.abs(power) || 0.6));
    const turns = 2 + Math.round(mag * 2.5);
    const duration = 3.6 + mag * 2 + this.ctx.rand() * 0.5;
    const target = force != null && force >= 0 && force < WEDGES ? force : Math.floor(this.ctx.rand() * WEDGES);
    const to = landingAngle(from, target, this.ctx.rand(), turns, dir);
    s.lastValue = null;
    s.phase = { t: 'spinning', spin: { from, to, duration, kind } };
    s.msg = kind === 'bonus' ? 'Choosing an envelope…' : `${this.name()} spins…`;
    this.sound('whoosh');
    return true;
  }

  private landed(): boolean {
    const s = this.s;
    if (s.phase.t !== 'spinning') return false;
    const spin = s.phase.spin;
    s.angle = spin.to;
    const idx = wedgeAt(spin.to);
    const w = s.wheel[idx];

    if (spin.kind === 'bonus') {
      s.bonus!.envelope = idx;
      this.revealBonusGivens();
      return true;
    }
    if (spin.kind === 'final') {
      if (w.value <= 0) {
        s.phase = { t: 'finalSpin' };
        s.msg = `The final spin landed on ${w.kind === 'bankrupt' ? 'Bankrupt' : 'Lose a Turn'}, which doesn't count. Spin again.`;
        return true;
      }
      s.speedValue = w.value + 1000;
      this.flash(`${formatMoney(s.speedValue)} per consonant`, 'gold');
      this.log(`Final spin: ${formatMoney(w.value)} + $1,000 = ${formatMoney(s.speedValue)} per consonant`);
      this.enterSpeedLetter(`Final spin: ${formatMoney(w.value)} + $1,000.`);
      return true;
    }

    switch (w.kind) {
      case 'bankrupt':
        this.log(`${this.name()} hit Bankrupt`, s.control);
        this.bankrupt(s.control, `Bankrupt! ${this.name()} loses this round's money.`);
        return true;
      case 'lose':
        this.sound('loseTurn');
        this.flash('LOSE A TURN', 'bad');
        this.passTurn(`${this.name()} loses a turn.`);
        return true;
      default: {
        s.phase = { t: 'consonant', wedge: idx, value: w.value };
        const what =
          w.kind === 'mystery'
            ? 'a Mystery wedge ($1,000)'
            : w.kind === 'express'
              ? 'the Express ($1,000)'
              : w.kind === 'wild'
                ? 'the Wild Card ($500)'
                : w.kind === 'gift'
                  ? 'the Gift Tag ($1,000)'
                  : w.kind === 'prize'
                    ? 'the Prize wedge ($500)'
                    : formatMoney(w.value);
        s.msg = `${what}. ${this.name()}, call a consonant.`;
        return true;
      }
    }
  }

  private reveal(letter: string, mode: 'call' | 'bonus'): number[] {
    const p = this.s.puzzle!;
    const positions: number[] = [];
    for (let i = 0; i < p.answer.length; i++) {
      if (p.answer[i] === letter && !p.revealed[i]) {
        p.revealed[i] = true;
        positions.push(i);
      }
    }
    if (positions.length) this.ev.push({ e: 'reveal', positions, mode });
    return positions;
  }

  private revealAll() {
    const p = this.s.puzzle;
    if (!p) return;
    const positions = p.revealed.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
    p.revealed = p.revealed.map(() => true);
    if (positions.length) this.ev.push({ e: 'reveal', positions, mode: 'all' });
  }

  private letter(L: string): boolean {
    const s = this.s;
    const p = s.puzzle;
    if (!p || !/^[A-Z]$/.test(L) || L in p.used) return false;
    if (!pickableLetters(s).has(L)) return false;
    const ph = s.phase;
    const vowel = isVowel(L);

    if (ph.t === 'speedLetter') {
      const positions = this.reveal(L, 'call');
      p.used[L] = positions.length ? 'hit' : 'miss';
      if (!positions.length) {
        this.sound('buzzer');
        this.nextSpeed(`No ${L}.`);
        return true;
      }
      let lead = `${positions.length} ${L}${positions.length > 1 ? 's' : ''}.`;
      if (!vowel) {
        const amount = s.speedValue * positions.length;
        this.P.round += amount;
        lead += ` +${formatMoney(amount)}.`;
      }
      this.sound('ding');
      s.phase = { t: 'speedSolve' };
      this.startTimer('speedSolve');
      s.msg = `${lead} ${this.name()}, solve now or pass.`;
      return true;
    }

    if (ph.t === 'vowel') {
      if (!vowel) return false;
      this.P.round -= VOWEL_COST;
      const positions = this.reveal(L, 'call');
      p.used[L] = positions.length ? 'hit' : 'miss';
      this.sound('register');
      if (!positions.length) {
        this.sound('buzzer');
        if (s.express === s.control) this.expressFail(`No ${L}. The Express derails.`);
        else this.passTurn(`No ${L}.`);
        return true;
      }
      this.sound('ding');
      this.toTurn(s.control, `${positions.length} ${L}${positions.length > 1 ? 's' : ''}.`);
      return true;
    }

    // Consonants: after a spin, a Wild Card play, or on the Express.
    if (vowel) return false;
    const riding = ph.t === 'turn' && s.express === s.control;
    if (ph.t !== 'consonant' && !riding) return false;
    const value = riding ? 1000 : (ph as { value: number }).value;
    const wedgeIdx = riding ? -1 : (ph as { wedge: number }).wedge;
    const wildPlay = !riding && !!(ph as { wild?: boolean }).wild;
    const w = wedgeIdx >= 0 ? s.wheel[wedgeIdx] : undefined;

    const positions = this.reveal(L, 'call');
    p.used[L] = positions.length ? 'hit' : 'miss';
    const n = positions.length;
    if (!n) {
      this.sound('buzzer');
      if (riding) this.expressFail(`No ${L}. The Express derails.`);
      else this.passTurn(`No ${L}.`);
      return true;
    }
    this.sound('ding');
    const plural = `${n} ${L}${n > 1 ? 's' : ''}`;

    if (w?.kind === 'mystery' && !s.mysteryFlipped) {
      s.phase = { t: 'mysteryChoice', wedge: wedgeIdx, count: n };
      s.msg = `${plural}. ${this.name()}: take ${formatMoney(1000 * n)}, or give it up to flip the Mystery wedge?`;
      return true;
    }

    const amount = value * n;
    this.P.round += amount;
    let lead = `${plural}! +${formatMoney(amount)}.`;

    if (w && !wildPlay) {
      if (w.kind === 'wild' && s.wildOnWheel) {
        this.P.wild = 'held';
        s.wildOnWheel = false;
        s.wheel[wedgeIdx] = { kind: 'cash', value: 500, color: '#36ad4c' };
        this.sound('wild');
        this.flash('WILD CARD', 'gold');
        lead += ` ${this.name()} picks up the Wild Card!`;
        this.log(`${this.name()} picked up the Wild Card`, s.control);
      } else if (w.kind === 'gift') {
        this.P.roundPrizes.push({ ...GIFT_CARD, id: `gift-${s.segment}` });
        s.wheel[wedgeIdx] = { kind: 'cash', value: 1000, color: w.color };
        this.sound('prize');
        this.flash('GIFT TAG', 'gold');
        lead += ` Plus a $1,000 gift card, if ${this.name()} solves.`;
      } else if (w.kind === 'prize') {
        const prize = WHEEL_PRIZES[Math.floor(this.ctx.rand() * WHEEL_PRIZES.length)];
        this.P.roundPrizes.push({ ...prize, id: `prize-${s.segment}` });
        s.wheel[wedgeIdx] = { kind: 'cash', value: 500, color: w.color };
        this.sound('prize');
        this.flash('PRIZE!', 'gold');
        lead += ` Plus a prize: ${prize.label} (${formatMoney(prize.value)}), if ${this.name()} solves.`;
      }
    }

    if (w?.kind === 'express' && s.express === null) {
      s.phase = { t: 'expressChoice' };
      s.msg = `${lead} Ride the Express, or keep playing the regular way?`;
      return true;
    }

    if (riding) {
      s.phase = { t: 'turn' };
      s.msg = `${lead} ${this.turnPrompt()}`;
      return true;
    }
    s.lastValue = !wildPlay && w && w.kind !== 'mystery' && w.kind !== 'express' ? value : null;
    this.toTurn(s.control, lead);
    return true;
  }

  private expressFail(lead: string) {
    const pid = this.s.control;
    this.s.express = null;
    this.log(`${this.name(pid)} derailed on the Express`, pid);
    this.bankrupt(pid, `${lead} That's a Bankrupt for ${this.name(pid)}.`);
  }

  // ---- solving ---------------------------------------------------------------------

  private submit(text: string): boolean {
    const s = this.s;
    const ph = s.phase;
    const p = s.puzzle;
    if (!p) return false;
    const right = isCorrect(text, p.answer);
    switch (ph.t) {
      case 'tossupAnswer':
        if (right) this.tossupWin(ph.pid);
        else this.tossupMiss(ph.pid, `${this.name(ph.pid)}: that's not it.`);
        return true;
      case 'solve':
        if (right) this.roundSolved(ph.pid);
        else {
          this.sound('wrong');
          this.ev.push({ e: 'wrongSolve' });
          if (s.express === s.control) this.expressFail('Wrong answer.');
          else this.passTurn(`Sorry, ${this.name()}, that's not it.`);
        }
        return true;
      case 'speedSolve':
        if (right) this.roundSolved(s.control);
        else {
          this.sound('wrong');
          this.ev.push({ e: 'wrongSolve' });
          this.nextSpeed("That's not it.");
        }
        return true;
      case 'bonusSolve':
        if (right) this.bonusDone(true);
        else {
          this.sound('wrong');
          this.ev.push({ e: 'wrongSolve' });
          s.msg = 'Not quite. Keep trying!';
        }
        return true;
      default:
        return false;
    }
  }

  private pass(): boolean {
    const s = this.s;
    switch (s.phase.t) {
      case 'tossupAnswer':
        this.tossupMiss(s.phase.pid, `${this.name(s.phase.pid)} passes.`);
        return true;
      case 'speedLetter':
      case 'speedSolve':
        this.nextSpeed(`${this.name()} passes.`);
        return true;
      default:
        return false;
    }
  }

  private roundSolved(pid: Pid) {
    const s = this.s;
    const P = s.players[pid];
    this.revealAll();
    let amount = P.round;
    let houseMin = false;
    if (amount < HOUSE_MINIMUM) {
      amount = HOUSE_MINIMUM;
      houseMin = true;
    }
    const prizes = [...P.roundPrizes];
    if (s.puzzle?.prize) prizes.push({ id: `trip-${s.segment}`, label: s.puzzle.prize.label, value: s.puzzle.prize.value, kind: 'trip' });
    P.bank += amount;
    P.prizes.push(...prizes);
    for (const p of s.players) {
      p.round = 0;
      p.roundPrizes = [];
    }
    s.express = null;
    s.timer = null;
    s.lastValue = null;
    s.control = pid;
    s.phase = { t: 'solved', pid, amount, prizes, houseMin, sweep: false };
    s.msg = `${this.name(pid)} solves it and banks ${formatMoney(amount)}${prizes.length ? ' plus ' + prizes.map((x) => x.label).join(' and ') : ''}!`;
    this.sound('solve');
    this.ev.push({ e: 'celebrate', pid, big: false });
    this.ev.push({ e: 'mood', pid, mood: 'happy' });
    const extra = prizes.length ? ` + ${prizes.map((x) => `${x.label} (${formatMoney(x.value)})`).join(', ')}` : '';
    this.log(`${this.name(pid)} solved and banked ${formatMoney(amount)}${houseMin ? ' (house minimum)' : ''}${extra}`, pid);
  }

  // ---- toss-ups --------------------------------------------------------------------

  private tossupWin(pid: Pid) {
    const s = this.s;
    const tu = s.tossup!;
    this.revealAll();
    let amount = tu.value;
    s.players[pid].bank += amount;
    s.tossupWinners[s.segment] = pid;
    let sweep = false;
    if (s.segment === 'triple3' && s.tossupWinners.triple1 === pid && s.tossupWinners.triple2 === pid) {
      sweep = true;
      s.players[pid].bank += SWEEP_BONUS;
      amount += SWEEP_BONUS;
    }
    s.timer = null;
    s.control = pid;
    s.phase = { t: 'solved', pid, amount, prizes: [], houseMin: false, sweep };
    const label = s.segment === 'tiebreak' ? 'wins the tiebreaker' : `wins ${formatMoney(tu.value)}`;
    s.msg = `${this.name(pid)} ${label}!${sweep ? ' That is a sweep: +$4,000 bonus!' : ''}`;
    this.sound('solve');
    this.ev.push({ e: 'celebrate', pid, big: sweep });
    this.ev.push({ e: 'mood', pid, mood: 'happy' });
    this.log(`${SEGMENT_INFO[s.segment].title}: ${this.name(pid)} ${label}${sweep ? ' and the $4,000 sweep bonus' : ''}`, pid);
  }

  private tossupMiss(pid: Pid, lead: string) {
    const s = this.s;
    const tu = s.tossup!;
    tu.locked[pid] = true;
    tu.lastChance = null; // the other player gets a full last-chance window
    s.timer = null;
    this.sound('wrong');
    this.ev.push({ e: 'wrongSolve' });
    if (tu.locked[0] && tu.locked[1]) {
      this.tossupUnsolved(`${lead} Nobody else can buzz in.`);
      return;
    }
    s.phase = { t: 'tossup' };
    s.msg = `${lead} ${this.name(other(pid))}, it's all yours.`;
  }

  private tossupUnsolved(lead: string) {
    const s = this.s;
    this.revealAll();
    s.timer = null;
    s.tossupWinners[s.segment] = null;
    s.phase = { t: 'unsolved' };
    s.msg = `${lead} The answer was ${s.puzzle!.answer}.`;
    this.sound('timeUp');
    this.log(`${SEGMENT_INFO[s.segment].title}: nobody solved it`);
  }

  // ---- round 4 ---------------------------------------------------------------------

  private ringBell(lead?: string) {
    const s = this.s;
    s.bellRung = true;
    s.express = null;
    s.lastValue = null;
    s.timer = null;
    s.phase = { t: 'finalSpin' };
    s.msg = `${lead ? lead + ' ' : ''}That's the bell! ${this.name()}, give the wheel a final spin.`;
    this.sound('bell');
    this.flash('FINAL SPIN', 'gold');
  }

  private enterSpeedLetter(lead: string) {
    const s = this.s;
    s.lastValue = null;
    if (allRevealed(s)) {
      s.phase = { t: 'speedSolve' };
      this.startTimer('speedSolve');
      s.msg = `${lead} Every letter is up. ${this.name()}, solve it!`;
      return;
    }
    s.phase = { t: 'speedLetter' };
    this.startTimer('speedLetter');
    s.msg = `${lead} ${this.name()}, call a letter. Consonants are ${formatMoney(s.speedValue)} each; vowels are free.`;
  }

  private nextSpeed(lead: string) {
    this.s.control = other(this.s.control);
    this.enterSpeedLetter(lead);
  }

  // ---- bonus round -----------------------------------------------------------------

  private revealBonusGivens() {
    const s = this.s;
    const p = s.puzzle!;
    const positions: number[] = [];
    for (const L of BONUS_LETTERS) {
      let hit = false;
      for (let i = 0; i < p.answer.length; i++) {
        if (p.answer[i] === L && !p.revealed[i]) {
          p.revealed[i] = true;
          positions.push(i);
          hit = true;
        }
      }
      p.used[L] = hit ? 'hit' : 'miss';
    }
    if (positions.length) this.ev.push({ e: 'reveal', positions, mode: 'bonus' });
    s.phase = { t: 'bonusLetters' };
    const n = s.bonus!.extra ? 4 : 3;
    s.msg = `Here are R, S, T, L, N and E. ${this.name()}, choose ${n} more consonants and 1 vowel${s.bonus!.extra ? ' (your Wild Card adds the 4th consonant)' : ''}.`;
  }

  private bonusLetters(consonants: string[], vowel: string): boolean {
    const s = this.s;
    const b = s.bonus;
    const p = s.puzzle;
    if (s.phase.t !== 'bonusLetters' || !b || !p) return false;
    const need = b.extra ? 4 : 3;
    const uniq = new Set(consonants);
    if (consonants.length !== need || uniq.size !== need) return false;
    if (consonants.some((c) => !CONSONANTS.includes(c) || BONUS_LETTERS.includes(c))) return false;
    if (!isVowel(vowel) || BONUS_LETTERS.includes(vowel)) return false;
    b.consonants = consonants;
    b.vowel = vowel;
    if (b.extra) s.players[b.pid].wild = 'used';
    const positions: number[] = [];
    for (const L of [...consonants, vowel]) {
      let hit = false;
      for (let i = 0; i < p.answer.length; i++) {
        if (p.answer[i] === L && !p.revealed[i]) {
          p.revealed[i] = true;
          positions.push(i);
          hit = true;
        }
      }
      p.used[L] = hit ? 'hit' : 'miss';
    }
    this.ev.push({ e: 'reveal', positions, mode: 'bonus' });
    if (!positions.length) this.sound('buzzer');
    s.phase = { t: 'bonusSolve' };
    this.startTimer('bonus');
    s.msg = `${this.name(b.pid)}, solve it! Try as many times as you like before time runs out.`;
    return true;
  }

  private bonusDone(solved: boolean) {
    const s = this.s;
    const b = s.bonus!;
    const value = b.envelopes[b.envelope ?? 0];
    const P = s.players[b.pid];
    this.revealAll();
    s.timer = null;
    s.phase = { t: 'bonusDone', solved };
    if (solved) {
      P.bonus = value;
      P.bonusLabel = `${formatMoney(value)} Bonus`;
      s.msg = `${this.name(b.pid)} solved the Bonus Round and wins ${formatMoney(value)}!`;
      this.sound('bigWin');
      this.ev.push({ e: 'celebrate', pid: b.pid, big: true });
      this.ev.push({ e: 'mood', pid: b.pid, mood: 'wow' });
      this.log(`Bonus Round: ${this.name(b.pid)} solved it and won ${formatMoney(value)}`, b.pid);
    } else {
      s.msg = `Time's up. The answer was ${s.puzzle!.answer}. The envelope held ${formatMoney(value)}.`;
      this.sound('timeUp');
      this.ev.push({ e: 'mood', pid: b.pid, mood: 'sad' });
      this.log(`Bonus Round: ${this.name(b.pid)} ran out of time (the envelope held ${formatMoney(value)})`, b.pid);
    }
  }

  // ---- time ------------------------------------------------------------------------

  private tick(dt: number): boolean {
    const s = this.s;
    const ph = s.phase.t;
    if (dt <= 0) return false;
    if (ph === 'tossup' && s.tossup) {
      const tu = s.tossup;
      const max = tu.order.length - 1;
      const step = timing(s).revealMs;
      tu.accum += dt;
      while (tu.shown < max && tu.accum >= step) {
        tu.accum -= step;
        const i = tu.order[tu.shown++];
        s.puzzle!.revealed[i] = true;
        this.ev.push({ e: 'reveal', positions: [i], mode: 'tossup' });
        this.sound('blip');
      }
      if (tu.shown >= max) {
        if (tu.lastChance === null) {
          tu.lastChance = timing(s).lastChance;
          s.msg = 'One letter left. Last chance to buzz in!';
        } else {
          tu.lastChance -= dt;
          if (tu.lastChance <= 0) this.tossupUnsolved('Nobody buzzed in.');
        }
      }
      return true;
    }
    if (s.timer && (ph === 'tossupAnswer' || ph === 'speedLetter' || ph === 'speedSolve' || ph === 'bonusSolve')) {
      s.timer.ms -= dt;
      if (s.timer.ms > 0) return true;
      s.timer.ms = 0;
      this.sound('timeUp');
      if (ph === 'tossupAnswer') this.tossupMiss((s.phase as { pid: Pid }).pid, `Time's up for ${this.name()}.`);
      else if (ph === 'bonusSolve') this.bonusDone(false);
      else this.nextSpeed(`Time's up for ${this.name()}.`);
      return true;
    }
    if (s.segment === 'round4' && !s.bellRung && s.r4clock !== null && s.r4clock > 0) {
      if (ph === 'turn' || ph === 'consonant' || ph === 'vowel' || ph === 'mysteryChoice' || ph === 'expressChoice') {
        s.r4clock = Math.max(0, s.r4clock - dt);
        if (s.r4clock === 0 && ph === 'turn') this.ringBell();
        return true;
      }
    }
    return false;
  }
}
