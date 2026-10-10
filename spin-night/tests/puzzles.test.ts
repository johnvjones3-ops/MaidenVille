import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES, BEFORE_AFTER_PARTS, BONUS_PUZZLES, MAIN_PUZZLES, PRIZE_PUZZLES, TRIPLE_SETS } from '../src/puzzles/bank';
import { layoutAnswer } from '../src/puzzles/layout';
import { CONSONANTS, normalize } from '../src/engine/answer';
import { CATEGORIES } from '../src/engine/types';

describe('puzzle bank', () => {
  it('has at least 300 puzzles', () => {
    expect(ALL_PUZZLES.length).toBeGreaterThanOrEqual(300);
  });

  it('has no duplicate answers or ids across every pool', () => {
    const answers = new Set<string>();
    const ids = new Set<string>();
    for (const p of ALL_PUZZLES) {
      const n = normalize(p.answer);
      expect(answers.has(n), `duplicate answer ${p.answer}`).toBe(false);
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false);
      answers.add(n);
      ids.add(p.id);
    }
  });

  it('uses only board characters and known categories', () => {
    for (const p of ALL_PUZZLES) {
      expect(p.answer, p.answer).toMatch(/^[A-Z' \-.,!?]+$/);
      expect(p.answer).not.toMatch(/ {2}|^ | $/);
      expect(CATEGORIES).toContain(p.category);
    }
  });

  it('fits every answer on the 12/14/14/12 board', () => {
    for (const p of ALL_PUZZLES) {
      const { lines } = layoutAnswer(p.answer);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.map((l) => l.text).join(' ')).toBe(p.answer);
    }
  });

  it('builds Before & After answers from two real halves that share whole words', () => {
    const ba = ALL_PUZZLES.filter((p) => p.category === 'Before & After');
    expect(ba.length).toBeGreaterThan(30);
    for (const p of ba) {
      const parts = BEFORE_AFTER_PARTS[p.answer];
      expect(parts, p.answer).toBeTruthy();
      const [a, b] = parts;
      expect(p.answer.startsWith(a)).toBe(true);
      expect(p.answer.endsWith(b)).toBe(true);
      // The shared word appears once, so the answer is shorter than the halves joined.
      expect(p.answer.length).toBeLessThan(a.length + b.length + 1);
    }
  });

  it('keeps What Are You Doing? answers as -ING phrases', () => {
    for (const p of ALL_PUZZLES.filter((x) => x.category === 'What Are You Doing?')) {
      expect(p.answer.split(/[ -]/).some((w) => w.endsWith('ING')), p.answer).toBe(true);
    }
  });

  it('balances difficulty in every main category', () => {
    for (const c of CATEGORIES) {
      const rows = MAIN_PUZZLES.filter((p) => p.category === c);
      for (const d of ['easy', 'medium', 'hard'] as const) {
        expect(rows.filter((p) => p.difficulty === d).length, `${c} ${d}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('has prize puzzles with trips, triple sets of three, and short bonus puzzles', () => {
    expect(PRIZE_PUZZLES.length).toBeGreaterThanOrEqual(15);
    for (const p of PRIZE_PUZZLES) expect(p.prize!.value).toBeGreaterThan(3000);
    expect(TRIPLE_SETS.length).toBeGreaterThanOrEqual(15);
    for (const s of TRIPLE_SETS) {
      expect(s.puzzles).toHaveLength(3);
      for (const p of s.puzzles) expect(p.category).toBe(s.category);
    }
    expect(BONUS_PUZZLES.length).toBeGreaterThanOrEqual(50);
    for (const p of BONUS_PUZZLES) {
      expect(p.answer.split(' ').length, p.answer).toBeLessThanOrEqual(3);
      // RSTLNE must leave at least three letter tiles hidden.
      const hidden = normalize(p.answer).split('').filter((ch) => !'RSTLNE'.includes(ch));
      expect(hidden.length, p.answer).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every main puzzle at least one consonant to call', () => {
    for (const p of MAIN_PUZZLES) {
      expect(normalize(p.answer).split('').some((ch) => CONSONANTS.includes(ch))).toBe(true);
    }
  });
});
