import { RULES } from '../config';
import type { Form } from './player';
import type { CrateInfo } from './tiles';

/** Campaign-run state that survives level changes (not saved to disk). */
export interface RunState {
  lives: number;
  score: number;
  /** Cumulative basketballs this run; never wraps (prevents 1-up farming). */
  ballsTotal: number;
  /** Extra lives already awarded from basketballs. */
  oneUps: number;
  form: Form;
  lassoCharges: number;
}

export function newRun(): RunState {
  return { lives: RULES.startLives, score: 0, ballsTotal: 0, oneUps: 0, form: 'rookie', lassoCharges: 0 };
}

/** Coherent world snapshot taken when a checkpoint is touched (or at level start). */
export interface Snapshot {
  tiles: Uint8Array;
  crates: [number, CrateInfo][];
  /** Level entity uids that are gone for good (collected items, defeated enemies, activated checkpoints). */
  consumed: number[];
  revealed: number[];
  score: number;
  ballsTotal: number;
  levelBalls: number;
  enemiesDefeated: number;
  lassoCharges: number;
  checkpoint: number; // entity uid, or -1 for level start
  spawn: { x: number; y: number };
}

/** Per-level-attempt stats and rare collectible ids (union across deaths). */
export interface LevelSession {
  rare: Set<string>;
  time: number;
  deaths: number;
}
