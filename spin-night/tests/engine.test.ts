import { describe, expect, it } from 'vitest';
import { isCorrect, normalize } from '../src/engine/answer';
import { HOUSE_MINIMUM, TIMING, VOWEL_COST, grandTotal, mainTotal, newGame, reduce } from '../src/engine/game';
import { WEDGES, landingAngle, spinProgress, wedgeAt } from '../src/engine/wheels';
import type { Action } from '../src/engine/types';
import { PuzzlePicker, emptyHistory } from '../src/puzzles/select';
import { rng, setup } from './helpers';

describe('answers', () => {
  it('ignores case, spacing and punctuation but nothing else', () => {
    expect(isCorrect("don't count your chickens before they hatch", "DON'T COUNT YOUR CHICKENS BEFORE THEY HATCH")).toBe(true);
    expect(isCorrect('dontcountyourchickens beforethey hatch', "DON'T COUNT YOUR CHICKENS BEFORE THEY HATCH")).toBe(true);
    expect(isCorrect('Monsters Inc', 'MONSTERS, INC.')).toBe(true);
    expect(isCorrect('hide and seek', 'HIDE-AND-SEEK')).toBe(true);
    expect(isCorrect('rock & roll', 'ROCK AND ROLL')).toBe(true);
    expect(isCorrect('jalapeño cheddar cornbread', 'JALAPENO CHEDDAR CORNBREAD')).toBe(true);
    expect(isCorrect('DONT COUNT YOUR CHICKEN BEFORE THEY HATCH', "DON'T COUNT YOUR CHICKENS BEFORE THEY HATCH")).toBe(false);
    expect(isCorrect('THE LION KING', 'THE LION QUEEN')).toBe(false);
    expect(isCorrect('', 'A')).toBe(false);
    expect(normalize('  a-b ')).toBe('AB');
  });
});

describe('wheel geometry', () => {
  it('lands exactly inside the chosen wedge, in either direction', () => {
    const r = rng(3);
    for (let i = 0; i < 2000; i++) {
      const from = (r() - 0.5) * 5000;
      const target = Math.floor(r() * WEDGES);
      const dir = r() < 0.5 ? 1 : -1;
      const to = landingAngle(from, target, r(), 2 + Math.floor(r() * 3), dir);
      expect(wedgeAt(to)).toBe(target);
      expect(Math.sign(to - from)).toBe(dir);
      expect(Math.abs(to - from)).toBeGreaterThanOrEqual(720);
    }
  });

  it('eases from rest to rest without going backwards', () => {
    let prev = 0;
    for (let t = 0; t <= 5; t += 0.01) {
      const p = spinProgress(t, 5);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = p;
    }
    expect(spinProgress(5, 5)).toBe(1);
    // Fast in the middle, slow at the end.
    expect(spinProgress(2.5, 5)).toBeGreaterThan(0.75);
    expect(spinProgress(4.9, 5)).toBeGreaterThan(0.999);
  });
});

describe('toss-ups', () => {
  it('reveals letters over time and awards the buzz-in winner', () => {
    const g = setup();
    expect(g.s.segment).toBe('tossup1');
    expect(g.s.phase.t).toBe('intro');
    g.act({ type: 'start' });
    const before = g.s.puzzle!.revealed.filter(Boolean).length;
    g.wait(TIMING.tv.revealMs * 3 + 10);
    expect(g.s.puzzle!.revealed.filter(Boolean).length).toBe(before + 3);
    expect(g.act({ type: 'buzz', pid: 1 }).accepted).toBe(true);
    // The board freezes while someone answers.
    const frozen = g.s.puzzle!.revealed.filter(Boolean).length;
    g.act({ type: 'tick', dt: 3000 });
    expect(g.s.puzzle!.revealed.filter(Boolean).length).toBe(frozen);
    // Second buzz is ignored.
    expect(g.act({ type: 'buzz', pid: 0 }).accepted).toBe(false);
    g.act({ type: 'submit', text: g.answer() });
    expect(g.s.players[1].bank).toBe(1000);
    expect(g.s.phase).toMatchObject({ t: 'solved', pid: 1, amount: 1000 });
    expect(g.s.tossupWinners.tossup1).toBe(1);
  });

  it('locks out a wrong answer and lets the other player try', () => {
    const g = setup();
    g.act({ type: 'start' });
    g.act({ type: 'buzz', pid: 0 });
    g.act({ type: 'submit', text: 'WRONG GUESS' });
    expect(g.s.tossup!.locked).toEqual([true, false]);
    expect(g.s.phase.t).toBe('tossup');
    expect(g.act({ type: 'buzz', pid: 0 }).accepted).toBe(false);
    expect(g.act({ type: 'buzz', pid: 1 }).accepted).toBe(true);
    g.wait(TIMING.tv.tossupAnswer + 1); // Lex runs out of time
    expect(g.s.phase.t).toBe('unsolved');
    expect(g.s.players[0].bank + g.s.players[1].bank).toBe(0);
    expect(g.s.puzzle!.revealed.every(Boolean)).toBe(true);
  });

  it('ends cleanly when nobody buzzes', () => {
    const g = setup();
    g.act({ type: 'start' });
    for (let i = 0; i < 200 && g.s.phase.t === 'tossup'; i++) g.act({ type: 'tick', dt: 500 });
    expect(g.s.phase.t).toBe('unsolved');
    g.act({ type: 'continue' });
    expect(g.s.segment).toBe('tossup2');
  });
});

describe('main rounds', () => {
  const inRound1 = () => {
    const g = setup();
    g.to('round1');
    g.act({ type: 'start' });
    g.s.control = 0;
    return g;
  };

  it('pays the wedge value per consonant and keeps control on a hit', () => {
    const g = inRound1();
    const i = g.wedge('cash', 600);
    g.spinTo(i);
    expect(g.s.phase).toMatchObject({ t: 'consonant', value: 600 });
    const c = g.goodConsonant();
    const n = g.answer().split('').filter((x) => x === c).length;
    g.act({ type: 'letter', letter: c });
    expect(g.s.players[0].round).toBe(600 * n);
    expect(g.s.control).toBe(0);
    expect(g.s.puzzle!.used[c]).toBe('hit');
    // The same letter can never be called twice.
    g.spinTo(i);
    expect(g.act({ type: 'letter', letter: c }).accepted).toBe(false);
  });

  it('passes control on a miss and rejects letters during a spin', () => {
    const g = inRound1();
    g.act({ type: 'spin', from: g.s.angle, power: 0.5, force: g.wedge('cash', 700) });
    expect(g.act({ type: 'letter', letter: 'T' }).accepted).toBe(false);
    expect(g.act({ type: 'spin', from: 0, power: 1 }).accepted).toBe(false);
    g.act({ type: 'landed' });
    expect(g.act({ type: 'landed' }).accepted).toBe(false); // no double payout
    g.act({ type: 'letter', letter: g.badConsonant() });
    expect(g.s.control).toBe(1);
    expect(g.s.players[0].round).toBe(0);
  });

  it('charges $250 per vowel, hit or miss, and requires the money', () => {
    const g = inRound1();
    expect(g.act({ type: 'buyVowel' }).accepted).toBe(false);
    g.s.players[0].round = 600;
    expect(g.act({ type: 'buyVowel' }).accepted).toBe(true);
    expect(g.act({ type: 'letter', letter: 'T' }).accepted).toBe(false); // consonants not allowed here
    const v = g.badVowel();
    if (v) {
      g.act({ type: 'letter', letter: v });
      expect(g.s.players[0].round).toBe(600 - VOWEL_COST);
      expect(g.s.control).toBe(1);
      expect(g.s.puzzle!.used[v]).toBe('miss');
    }
  });

  it('Bankrupt clears round money, round prizes and the Wild Card but not the bank', () => {
    const g = inRound1();
    const p = g.s.players[0];
    const bankBefore = p.bank;
    p.round = 2400;
    p.roundPrizes = [{ id: 'x', label: 'Test', value: 1000, kind: 'gift' }];
    p.wild = 'held';
    g.spinTo(g.wedge('bankrupt'));
    expect(g.s.players[0]).toMatchObject({ round: 0, roundPrizes: [], wild: 'lost', bank: bankBefore });
    expect(g.s.control).toBe(1);
  });

  it('Lose a Turn passes control without touching money', () => {
    const g = inRound1();
    g.s.players[0].round = 900;
    g.spinTo(g.wedge('lose'));
    expect(g.s.control).toBe(1);
    expect(g.s.players[0].round).toBe(900);
  });

  it('banks round money only for the solver, with the house minimum', () => {
    const g = inRound1();
    g.s.players[1].round = 3000;
    const bank0 = g.s.players[0].bank;
    g.act({ type: 'solve' });
    expect(g.act({ type: 'letter', letter: 'T' }).accepted).toBe(false);
    g.act({ type: 'submit', text: g.answer().toLowerCase() });
    expect(g.s.players[0].bank).toBe(bank0 + HOUSE_MINIMUM);
    expect(g.s.players[1].round).toBe(0);
    expect(g.s.phase).toMatchObject({ t: 'solved', houseMin: true });
  });

  it('a wrong solve loses the turn', () => {
    const g = inRound1();
    g.act({ type: 'solve' });
    g.act({ type: 'submit', text: 'definitely not the answer' });
    expect(g.s.control).toBe(1);
    expect(g.s.phase.t).toBe('turn');
  });

  it('picks up and plays the Wild Card, and the Gift Tag is lost if the other player solves', () => {
    const g = inRound1();
    g.spinTo(g.wedge('wild'));
    g.act({ type: 'letter', letter: g.goodConsonant() });
    expect(g.s.players[0].wild).toBe('held');
    expect(g.s.wildOnWheel).toBe(false);
    expect(g.wedge('wild')).toBe(-1);
    // Play it right away for another consonant at $500.
    expect(g.act({ type: 'useWild' }).accepted).toBe(true);
    expect(g.s.phase).toMatchObject({ t: 'consonant', value: 500, wild: true });
    const c = g.goodConsonant();
    if (c) g.act({ type: 'letter', letter: c });
    expect(g.s.players[0].wild).toBe('used');
    // Gift tag
    if (g.s.control === 0 && g.wedge('gift') >= 0 && g.goodConsonant()) {
      g.spinTo(g.wedge('gift'));
      g.act({ type: 'letter', letter: g.goodConsonant() });
      expect(g.s.players[0].roundPrizes[0]).toMatchObject({ value: 1000, kind: 'gift' });
      g.act({ type: 'solve' });
      g.act({ type: 'submit', text: 'nope' });
      g.act({ type: 'solve' });
      g.act({ type: 'submit', text: g.answer() });
      expect(g.s.players[0].roundPrizes).toEqual([]);
      expect(g.s.players[0].prizes).toEqual([]);
    }
  });
});

describe('Mystery and Express', () => {
  it('Mystery: keep the money or flip for $10,000 or Bankrupt', () => {
    for (const outcome of ['keep', 'cash10k', 'bankrupt'] as const) {
      const g = setup();
      g.to('round2');
      g.act({ type: 'start' });
      g.s.control = 0;
      g.s.players[0].round = 500;
      const idx =
        outcome === 'keep'
          ? g.wedge('mystery')
          : g.s.wheel.findIndex((w) => w.kind === 'mystery' && w.hidden === outcome);
      g.spinTo(idx);
      const c = g.goodConsonant();
      const n = g.answer().split('').filter((x) => x === c).length;
      g.act({ type: 'letter', letter: c });
      expect(g.s.phase.t).toBe('mysteryChoice');
      if (outcome === 'keep') {
        g.act({ type: 'mysteryKeep' });
        expect(g.s.players[0].round).toBe(500 + 1000 * n);
      } else {
        g.act({ type: 'mysteryFlip' });
        if (outcome === 'cash10k') {
          expect(g.s.players[0].round).toBe(10500);
          expect(g.s.control).toBe(0);
        } else {
          expect(g.s.players[0].round).toBe(0);
          expect(g.s.control).toBe(1);
        }
      }
      // After any choice both Mystery wedges are plain $1,000.
      expect(g.wedge('mystery')).toBe(-1);
    }
  });

  it('Express: $1,000 per consonant without spinning; any miss is a Bankrupt', () => {
    const g = setup();
    g.to('round3');
    g.act({ type: 'start' });
    g.s.control = 0;
    g.s.players[0].bank = 5000;
    g.spinTo(g.wedge('express'));
    g.act({ type: 'letter', letter: g.goodConsonant() });
    expect(g.s.phase.t).toBe('expressChoice');
    g.act({ type: 'expressRide' });
    expect(g.s.express).toBe(0);
    expect(g.act({ type: 'spin', from: 0, power: 1 }).accepted).toBe(false);
    const r0 = g.s.players[0].round;
    const c = g.goodConsonant();
    if (c) {
      const n = g.answer().split('').filter((x) => x === c).length;
      g.act({ type: 'letter', letter: c });
      expect(g.s.players[0].round).toBe(r0 + 1000 * n);
      expect(g.s.express).toBe(0);
    }
    g.act({ type: 'letter', letter: g.badConsonant() });
    expect(g.s.players[0]).toMatchObject({ round: 0, bank: 5000 });
    expect(g.s.express).toBe(null);
    expect(g.s.control).toBe(1);
  });

  it('Express: a wrong solve is a Bankrupt too', () => {
    const g = setup();
    g.to('round3');
    g.act({ type: 'start' });
    g.s.control = 0;
    g.spinTo(g.wedge('express'));
    g.act({ type: 'letter', letter: g.goodConsonant() });
    g.act({ type: 'expressRide' });
    g.act({ type: 'solve' });
    g.act({ type: 'submit', text: 'wrong answer' });
    expect(g.s.players[0].round).toBe(0);
    expect(g.s.control).toBe(1);
  });

  it('awards the Prize Puzzle trip to the solver', () => {
    const g = setup();
    g.to('round3');
    g.act({ type: 'start' });
    expect(g.s.puzzle!.prize).toBeTruthy();
    const pid = g.s.control;
    g.act({ type: 'solve' });
    g.act({ type: 'submit', text: g.answer() });
    expect(g.s.players[pid].prizes.some((p) => p.kind === 'trip')).toBe(true);
  });
});

describe('triple toss-up, round 4 and the end game', () => {
  it('gives a $4,000 sweep bonus for winning all three', () => {
    const g = setup();
    g.to('triple1');
    const base = g.s.players[1].bank;
    const cat = g.s.puzzle!.category;
    g.tossup(1);
    expect(g.s.puzzle!.category).toBe(cat);
    g.tossup(1);
    g.act({ type: 'start' });
    g.act({ type: 'buzz', pid: 1 });
    g.act({ type: 'submit', text: g.answer() });
    expect(g.s.phase).toMatchObject({ t: 'solved', sweep: true, amount: 6000 });
    expect(g.s.players[1].bank).toBe(base + 2000 * 3 + 4000);
  });

  it('rings the bell, takes a final spin and plays speed-up', () => {
    const g = setup();
    g.to('round4');
    g.act({ type: 'start' });
    expect(g.s.r4clock).toBe(TIMING.tv.r4Clock);
    g.act({ type: 'tick', dt: 1000 });
    for (let i = 0; i < 80 && g.s.phase.t === 'turn'; i++) g.act({ type: 'tick', dt: 1000 });
    expect(g.s.phase.t).toBe('finalSpin');
    expect(g.act({ type: 'buyVowel' }).accepted).toBe(false);
    const starter = g.s.control;
    g.spinTo(g.wedge('cash', 800));
    expect(g.s.speedValue).toBe(1800);
    expect(g.s.phase.t).toBe('speedLetter');
    const c = g.goodConsonant();
    const n = g.answer().split('').filter((x) => x === c).length;
    g.act({ type: 'letter', letter: c });
    expect(g.s.players[starter].round).toBe(1800 * n);
    expect(g.s.phase.t).toBe('speedSolve');
    g.act({ type: 'pass' });
    expect(g.s.control).toBe(1 - starter);
    expect(g.s.phase.t).toBe('speedLetter');
    g.wait(TIMING.tv.speedLetter + 1); // timed out
    expect(g.s.control).toBe(starter);
    g.act({ type: 'letter', letter: g.goodVowel() ?? g.goodConsonant() });
    g.act({ type: 'submit', text: g.answer() });
    expect(g.s.phase).toMatchObject({ t: 'solved', pid: starter });
  });

  it('final spin re-spins on Bankrupt', () => {
    const g = setup();
    g.to('round4');
    g.act({ type: 'start' });
    g.s.r4clock = 1;
    g.act({ type: 'tick', dt: 5 });
    g.spinTo(g.wedge('bankrupt'));
    expect(g.s.phase.t).toBe('finalSpin');
  });

  it('plays a tiebreaker when the totals are tied', () => {
    const g = setup();
    g.to('round4');
    g.act({ type: 'start' });
    g.s.players[0].bank = 0;
    g.s.players[0].prizes = [];
    g.s.players[1].bank = 0;
    g.s.players[1].prizes = [];
    g.s.players[1].round = 400; // the house minimum makes them $1,000 each
    g.s.control = 1;
    g.act({ type: 'solve' });
    g.act({ type: 'submit', text: g.answer() });
    g.s.players[0].bank = 1000;
    g.act({ type: 'continue' });
    expect(g.s.segment).toBe('tiebreak');
    g.tossup(null); // nobody solves: another tiebreaker
    expect(g.s.segment).toBe('tiebreak');
    g.tossup(0);
    expect(g.s.segment).toBe('bonus');
    expect(g.s.bonus!.pid).toBe(0);
  });

  it('runs the Bonus Round: categories, envelope, RSTLNE, letters, solve', () => {
    const g = setup();
    g.to('bonus');
    expect(g.s.bonus!.pid).toBe(0);
    g.act({ type: 'start' });
    expect(g.s.phase.t).toBe('bonusCategory');
    const opts = (g.s.phase as { options: string[] }).options;
    expect(opts).toHaveLength(3);
    const cats = opts.map((id) => g.ctx.picker.get(id)!.category);
    expect(new Set(cats).size).toBe(3);
    g.act({ type: 'bonusPick', index: 1 });
    expect(g.s.puzzle!.id).toBe(opts[1]);
    g.spinTo(5);
    expect(g.s.bonus!.envelope).toBe(5);
    expect(g.s.phase.t).toBe('bonusLetters');
    for (const L of 'RSTLNE') expect(g.s.puzzle!.used[L]).toBeDefined();
    // Validation: RSTLNE letters and wrong counts are rejected.
    expect(g.act({ type: 'bonusLetters', consonants: ['R', 'B', 'C'], vowel: 'A' }).accepted).toBe(false);
    expect(g.act({ type: 'bonusLetters', consonants: ['B', 'C'], vowel: 'A' }).accepted).toBe(false);
    expect(g.act({ type: 'bonusLetters', consonants: ['B', 'C', 'D'], vowel: 'E' }).accepted).toBe(false);
    const extra = g.s.bonus!.extra;
    const cons = extra ? ['B', 'C', 'D', 'G'] : ['B', 'C', 'D'];
    expect(g.act({ type: 'bonusLetters', consonants: cons, vowel: 'A' }).accepted).toBe(true);
    expect(g.s.phase.t).toBe('bonusSolve');
    g.act({ type: 'submit', text: 'wrong' });
    expect(g.s.phase.t).toBe('bonusSolve'); // keep trying
    g.act({ type: 'submit', text: g.answer() });
    const value = g.s.bonus!.envelopes[5];
    expect(g.s.players[0].bonus).toBe(value);
    expect(grandTotal(g.s.players[0])).toBe(mainTotal(g.s.players[0]) + value);
    g.act({ type: 'continue' });
    expect(g.s.phase.t).toBe('results');
    expect(g.s.finished).toBe(true);
    expect(g.act({ type: 'buzz', pid: 0 }).accepted).toBe(false);
  });

  it('the Bonus Round can run out of time; a held Wild Card adds a consonant', () => {
    const g = setup();
    g.to('bonus');
    g.s.players[0].wild = 'held';
    g.s.bonus!.extra = true;
    g.act({ type: 'start' });
    g.act({ type: 'bonusPick', index: 0 });
    g.spinTo(0);
    expect(g.act({ type: 'bonusLetters', consonants: ['B', 'C', 'D'], vowel: 'A' }).accepted).toBe(false);
    expect(g.act({ type: 'bonusLetters', consonants: ['B', 'C', 'D', 'G'], vowel: 'O' }).accepted).toBe(true);
    expect(g.s.players[0].wild).toBe('used');
    g.act({ type: 'pause' });
    g.act({ type: 'tick', dt: 1000 });
    expect(g.s.timer!.ms).toBe(TIMING.tv.bonus); // paused: no time lost
    g.act({ type: 'resume' });
    for (let i = 0; i < 20 && g.s.phase.t === 'bonusSolve'; i++) g.act({ type: 'tick', dt: 1000 });
    expect(g.s.phase).toMatchObject({ t: 'bonusDone', solved: false });
    expect(g.s.players[0].bonus).toBe(0);
  });
});

describe('full episodes', () => {
  const play = (seed: number, winner: 0 | 1) => {
    const rand = rng(seed);
    const history = emptyHistory();
    const picker = new PuzzlePicker(history, rand);
    const ctx = { picker, rand };
    let s = newGame({ difficulty: 'mixed', denton: seed % 2 === 0, timerMode: seed % 3 ? 'tv' : 'typing' }, ctx);
    const act = (a: Action) => {
      const r = reduce(s, a, ctx);
      s = r.state;
      return r.accepted;
    };
    let steps = 0;
    while (!s.finished && steps++ < 5000) {
      const ph = s.phase;
      const p = s.puzzle;
      switch (ph.t) {
        case 'intro':
          act({ type: 'start' });
          break;
        case 'tossup':
          if (rand() < 0.15) act({ type: 'buzz', pid: winner });
          else act({ type: 'tick', dt: 400 });
          break;
        case 'tossupAnswer':
          act({ type: 'submit', text: rand() < 0.7 ? p!.answer : 'nope' });
          break;
        case 'turn': {
          const r = rand();
          if (s.control === winner && r < 0.25) act({ type: 'solve' });
          else if (r < 0.4 && act({ type: 'buyVowel' })) break;
          else if (s.express === s.control) act({ type: 'solve' });
          else if (!act({ type: 'spin', from: s.angle, power: rand() })) act({ type: 'solve' });
          break;
        }
        case 'spinning':
          act({ type: 'landed' });
          break;
        case 'consonant':
        case 'vowel':
        case 'speedLetter': {
          const pool = ph.t === 'vowel' ? 'AEIOU' : ph.t === 'speedLetter' ? 'TNRSLAEIOUHDCMGPBFWYKVXZJQ' : 'TNRSLHDCMGPBFWYKVXZJQ';
          const letter = [...pool].find((l) => !(l in p!.used))!;
          if (!act({ type: 'letter', letter })) act({ type: 'tick', dt: 1000 });
          break;
        }
        case 'mysteryChoice':
          act({ type: rand() < 0.5 ? 'mysteryKeep' : 'mysteryFlip' });
          break;
        case 'expressChoice':
          act({ type: rand() < 0.5 ? 'expressRide' : 'expressDecline' });
          break;
        case 'solve':
        case 'speedSolve':
          act({ type: 'submit', text: s.control === winner ? p!.answer : 'nope' });
          break;
        case 'finalSpin':
        case 'bonusSpin':
          act({ type: 'spin', from: s.angle, power: rand() });
          break;
        case 'bonusCategory':
          act({ type: 'bonusPick', index: Math.floor(rand() * 3) });
          break;
        case 'bonusLetters':
          act({ type: 'bonusLetters', consonants: s.bonus!.extra ? ['C', 'D', 'M', 'P'] : ['C', 'D', 'M'], vowel: 'A' });
          break;
        case 'bonusSolve':
          if (rand() < 0.5) act({ type: 'submit', text: p!.answer });
          else for (let t = 0; t < 40 && s.phase.t === 'bonusSolve'; t++) act({ type: 'tick', dt: 1000 });
          break;
        case 'solved':
        case 'unsolved':
        case 'bonusDone':
          act({ type: 'continue' });
          break;
        default:
          throw new Error(`stuck in ${ph.t}`);
      }
    }
    return { s, history };
  };

  it('plays 60 random episodes to the results screen without repeats', () => {
    let johnWins = 0;
    let lexWins = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const winner = (seed % 2) as 0 | 1;
      const { s } = play(seed, winner);
      expect(s.finished, `seed ${seed}`).toBe(true);
      expect(s.phase.t).toBe('results');
      expect(new Set(s.used).size).toBe(s.used.length);
      const segs = s.log.map((l) => l.seg);
      for (const seg of ['tossup1', 'tossup2', 'round1', 'round2', 'round3', 'triple1', 'triple2', 'triple3', 'round4', 'bonus']) {
        expect(segs, `seed ${seed}`).toContain(seg);
      }
      if (s.bonus!.pid === 0) johnWins++;
      else lexWins++;
      for (const p of s.players) {
        expect(p.round).toBe(0);
        expect(p.bank).toBeGreaterThanOrEqual(0);
      }
    }
    expect(johnWins).toBeGreaterThan(5);
    expect(lexWins).toBeGreaterThan(5);
  });
});

describe('puzzle selection across games', () => {
  it('never repeats an answer across new games while unseen puzzles remain, then recycles', () => {
    const history = emptyHistory();
    const rand = rng(11);
    const picker = new PuzzlePicker(history, rand);
    const seen = new Set<string>();
    let repeatsBeforeExhaustion = 0;
    for (let game = 0; game < 30; game++) {
      history.counter++;
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) {
        const p = picker.pick({ pool: 'main', difficulty: 'medium', exclude: ids, allowDenton: true });
        if (seen.has(p.id)) repeatsBeforeExhaustion++;
        seen.add(p.id);
        ids.push(p.id);
        picker.markSeen(p.id);
      }
    }
    // 180 picks from a 300-puzzle pool: no repeats at all.
    expect(repeatsBeforeExhaustion).toBe(0);
    // Exhaust the pool, then make sure it keeps working and picks the oldest.
    for (let i = 0; i < 400; i++) {
      const p = picker.pick({ pool: 'main', difficulty: 'hard', exclude: [], allowDenton: true });
      picker.markSeen(p.id);
      history.counter++;
    }
    const again = picker.pick({ pool: 'main', difficulty: 'hard', exclude: [], allowDenton: true });
    expect(again).toBeTruthy();
  });

  it('keeps Denton puzzles out when the toggle is off', () => {
    const picker = new PuzzlePicker(emptyHistory(), rng(5));
    for (let i = 0; i < 200; i++) {
      const p = picker.pick({ pool: 'main', difficulty: 'medium', exclude: [], allowDenton: false, preferCategory: 'Denton, Texas' });
      expect(p.category).not.toBe('Denton, Texas');
      picker.markSeen(p.id);
    }
    for (let i = 0; i < 30; i++) {
      for (const p of picker.pickBonusOptions('medium', false, [])) expect(p.category).not.toBe('Denton, Texas');
    }
  });

  it('puts a Denton puzzle in each episode when the toggle is on', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = setup({ denton: true }, seed);
      g.to('round4');
      const cats = g.s.used.map((id) => g.ctx.picker.get(id)!.category);
      expect(cats, `seed ${seed}`).toContain('Denton, Texas');
    }
  });
});
