// Shared types for the game engine, puzzle bank and UI.

export type Pid = 0 | 1;
export const PLAYERS: readonly Pid[] = [0, 1];
export const other = (p: Pid): Pid => (p === 0 ? 1 : 0);

export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultySetting = Difficulty | 'mixed';
export type TimerMode = 'tv' | 'typing';

export const CATEGORIES = [
  'Phrase',
  'Food & Drink',
  'What Are You Doing?',
  'Around the House',
  'On the Map',
  'Show Biz',
  'Fun & Games',
  'Before & After',
  'Denton, Texas',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Pool = 'main' | 'prize' | 'bonus' | 'triple';

export interface Puzzle {
  id: string;
  category: Category;
  answer: string;
  difficulty: Difficulty;
  pool: Pool;
  /** Prize Puzzle trip awarded to whoever solves it. */
  prize?: { label: string; value: number };
  /** Triple Toss-Up set id and its theme (revealed after the third puzzle). */
  set?: string;
  theme?: string;
}

export interface TripleSet {
  id: string;
  category: Category;
  theme: string;
  difficulty: Difficulty;
  puzzles: Puzzle[];
}

export interface PrizeCard {
  id: string;
  label: string;
  value: number;
  kind: 'gift' | 'prize' | 'trip' | 'bonus';
}

export type WedgeKind =
  | 'cash'
  | 'bankrupt'
  | 'lose'
  | 'wild'
  | 'gift'
  | 'prize'
  | 'mystery'
  | 'express'
  | 'envelope';

export interface Wedge {
  kind: WedgeKind;
  /** Dollar value per consonant (0 for Bankrupt / Lose a Turn / envelopes). */
  value: number;
  color: string;
  /** Mystery wedges: what is under the wedge. */
  hidden?: 'cash10k' | 'bankrupt';
}

export type Segment =
  | 'tossup1'
  | 'tossup2'
  | 'round1'
  | 'round2'
  | 'round3'
  | 'triple1'
  | 'triple2'
  | 'triple3'
  | 'round4'
  | 'tiebreak'
  | 'bonus'
  | 'results';

export type WildState = 'none' | 'held' | 'used' | 'lost';

export interface PlayerState {
  /** Banked cash: safe from Bankrupt. */
  bank: number;
  /** Banked prizes (their values count toward the total). */
  prizes: PrizeCard[];
  /** Current round cash, at risk until this player solves the round. */
  round: number;
  /** Prizes picked up this round, lost on Bankrupt or if someone else solves. */
  roundPrizes: PrizeCard[];
  wild: WildState;
  /** Bonus round winnings (cash or prize value). */
  bonus: number;
  bonusLabel: string | null;
}

export interface PuzzleState {
  id: string;
  category: Category;
  answer: string;
  pool: Pool;
  difficulty: Difficulty;
  /** Per character of `answer`: true once shown. Non-letters start true. */
  revealed: boolean[];
  /** Letters called this puzzle and whether they were in it. */
  used: Record<string, 'hit' | 'miss'>;
  prize?: { label: string; value: number };
  theme?: string;
}

export interface TossupState {
  order: number[];
  shown: number;
  accum: number;
  locked: [boolean, boolean];
  value: number;
  /** Counts down once only one letter is still hidden. */
  lastChance: number | null;
}

export interface SpinState {
  from: number;
  to: number;
  duration: number;
  kind: 'main' | 'final' | 'bonus';
}

export type Phase =
  | { t: 'intro' }
  | { t: 'tossup' }
  | { t: 'tossupAnswer'; pid: Pid }
  | { t: 'turn' }
  | { t: 'spinning'; spin: SpinState }
  | { t: 'consonant'; wedge: number; value: number; wild?: boolean }
  | { t: 'vowel' }
  | { t: 'mysteryChoice'; wedge: number; count: number }
  | { t: 'expressChoice' }
  | { t: 'solve'; pid: Pid }
  | { t: 'finalSpin' }
  | { t: 'speedLetter' }
  | { t: 'speedSolve' }
  | { t: 'solved'; pid: Pid; amount: number; prizes: PrizeCard[]; houseMin: boolean; sweep: boolean }
  | { t: 'unsolved' }
  | { t: 'bonusCategory'; options: string[] }
  | { t: 'bonusSpin' }
  | { t: 'bonusLetters' }
  | { t: 'bonusSolve' }
  | { t: 'bonusDone'; solved: boolean }
  | { t: 'results' };

export type TimerKind = 'tossupAnswer' | 'speedLetter' | 'speedSolve' | 'bonus';

export interface TimerState {
  kind: TimerKind;
  ms: number;
  total: number;
}

export interface LogEntry {
  seg: Segment;
  text: string;
  pid?: Pid;
}

export interface GameSettings {
  difficulty: DifficultySetting;
  denton: boolean;
  timerMode: TimerMode;
}

export interface GameState {
  version: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  settings: GameSettings;
  segment: Segment;
  phase: Phase;
  players: [PlayerState, PlayerState];
  control: Pid;
  puzzle: PuzzleState | null;
  wheel: Wedge[];
  angle: number;
  tossup: TossupState | null;
  timer: TimerState | null;
  /** Round 4 clock in ms; the final-spin bell rings when it reaches 0. */
  r4clock: number | null;
  bellRung: boolean;
  speedValue: number;
  /** Who is riding the Express, if anyone. */
  express: Pid | null;
  /** Last consonant value this turn, for playing the Wild Card. */
  lastValue: number | null;
  /** Wild Card is still on the wheel (nobody has picked it up). */
  wildOnWheel: boolean;
  mysteryFlipped: boolean;
  /** Who started each main round, for rotating starts. */
  starters: Partial<Record<Segment, Pid>>;
  /** Winner of each toss-up (null if nobody solved). */
  tossupWinners: Partial<Record<Segment, Pid | null>>;
  /** Puzzle ids already used this episode. */
  used: string[];
  tripleSet: string | null;
  tiebreaks: number;
  bonus: {
    pid: Pid;
    options: string[];
    envelopes: number[];
    envelope: number | null;
    consonants: string[];
    vowel: string | null;
    extra: boolean;
  } | null;
  msg: string;
  log: LogEntry[];
  paused: boolean;
  finished: boolean;
  /** Segments that prefer a Denton, Texas puzzle this episode. */
  dentonPlan: Segment[];
}

export type Action =
  | { type: 'start' }
  | { type: 'buzz'; pid: Pid }
  | { type: 'submit'; text: string }
  | { type: 'pass' }
  | { type: 'spin'; from: number; power: number; force?: number }
  | { type: 'landed' }
  | { type: 'letter'; letter: string }
  | { type: 'buyVowel' }
  | { type: 'solve' }
  | { type: 'cancel' }
  | { type: 'useWild' }
  | { type: 'mysteryKeep' }
  | { type: 'mysteryFlip' }
  | { type: 'expressRide' }
  | { type: 'expressDecline' }
  | { type: 'continue' }
  | { type: 'bonusPick'; index: number }
  | { type: 'bonusLetters'; consonants: string[]; vowel: string }
  | { type: 'tick'; dt: number }
  | { type: 'pause' }
  | { type: 'resume' };

export type SoundName =
  | 'ding'
  | 'buzzer'
  | 'bankrupt'
  | 'loseTurn'
  | 'buzzIn'
  | 'blip'
  | 'solve'
  | 'bigWin'
  | 'victory'
  | 'register'
  | 'bell'
  | 'timeUp'
  | 'countdown'
  | 'mystery'
  | 'cash10k'
  | 'express'
  | 'wild'
  | 'prize'
  | 'wrong'
  | 'reveal'
  | 'whoosh';

export type GameEvent =
  | { e: 'reveal'; positions: number[]; mode: 'call' | 'tossup' | 'all' | 'bonus' }
  | { e: 'sound'; s: SoundName }
  | { e: 'flash'; text: string; tone: 'good' | 'bad' | 'info' | 'gold' }
  | { e: 'celebrate'; pid: Pid | null; big: boolean }
  | { e: 'mood'; pid: Pid; mood: 'happy' | 'sad' | 'wow' }
  | { e: 'wrongSolve' }
  | { e: 'mysteryReveal'; wedge: number; result: 'cash10k' | 'bankrupt' };

export interface PickRequest {
  pool: Pool;
  difficulty: Difficulty;
  exclude: string[];
  allowDenton: boolean;
  tossup?: boolean;
  preferCategory?: Category;
  avoidCategories?: Category[];
}

/** Supplies puzzles to the engine; implemented over the bank + seen history. */
export interface Picker {
  pick(req: PickRequest): Puzzle;
  pickTriple(difficulty: Difficulty, allowDenton: boolean, exclude: string[]): TripleSet;
  pickBonusOptions(difficulty: Difficulty, allowDenton: boolean, exclude: string[]): Puzzle[];
  get(id: string): Puzzle | undefined;
  getTriple(id: string): TripleSet | undefined;
  /** Record that a puzzle (or triple set) was put on the board. */
  markSeen(id: string): void;
}
