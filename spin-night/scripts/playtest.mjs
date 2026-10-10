// End-to-end playtest of the built single file in headless Chromium.
//   npm run build:single && npm run playtest            (iPad landscape)
//   node scripts/playtest.mjs --size 834x1040 --shots    (other sizes, with screenshots)
// Plays two full episodes through the real UI: taps, the onscreen keyboard and
// physical keys. A debug hook (enabled only by a localStorage flag) reads answers
// and can choose which wedge the next spin lands on.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const size = (args.includes('--size') ? args[args.indexOf('--size') + 1] : '1194x760').split('x').map(Number);
const shots = args.includes('--shots');
const tag = `${size[0]}x${size[1]}`;
const url = `file://${resolve('dist/spin-night.html')}`;
if (shots) mkdirSync('screenshots', { recursive: true });

const results = [];
const check = (ok, what) => {
  results.push([!!ok, what]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: size[0], height: size[1] }, hasTouch: true });
await context.addInitScript(() => localStorage.setItem('spinnight.debug', '1'));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const wait = (ms) => page.waitForTimeout(ms);
const st = () => page.evaluate(() => window.__spinNight.state());
const answer = () => page.evaluate(() => window.__spinNight.answer());
const shot = async (name) => shots && page.screenshot({ path: `screenshots/${tag}-${name}.png` });
async function idle() {
  for (let i = 0; i < 300; i++) {
    if (!(await page.evaluate(() => window.__spinNight.busy()))) return;
    await wait(50);
  }
}
async function phase() {
  return (await st()).phase.t;
}
async function until(fn, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await wait(80);
  }
  return false;
}
async function tap(sel) {
  await idle();
  await page.locator(sel).first().click();
  await wait(60);
}
async function typeAnswer(text, { onscreen = false } = {}) {
  if (onscreen) {
    for (const ch of text.toUpperCase()) {
      const key = ch === ' ' ? 'Space' : ch;
      const b = page.locator(`.solve .skey[aria-label="${key}"]`);
      if (await b.count()) await b.first().dispatchEvent('pointerdown');
    }
  } else await page.keyboard.type(text);
  await page.locator('.solve-go').click();
  await wait(80);
}
async function force(kind, value) {
  const s = await st();
  const i = s.wheel.findIndex((w) => w.kind === kind && (value === undefined || w.value === value));
  await page.evaluate((i) => window.__spinNight.force(i), i);
  return i;
}
async function spinTo(kind, value) {
  await force(kind, value);
  await tap('#btn-spin');
  await until(async () => (await phase()) !== 'spinning', 15000);
  await idle();
}
const goodConsonant = (a, used) => [...'TNRSLHDCMGPBFWYKVXZJQ'].find((c) => a.includes(c) && !(c in used));
const badConsonant = (a, used) => [...'QZXJVKWFBPMGYCDHLSRTN'].find((c) => !a.includes(c) && !(c in used));
const goodVowel = (a, used) => [...'EAOIU'].find((c) => a.includes(c) && !(c in used));
const keyFor = (l) => `.alpha .key[data-letter="${l}"]`;

async function pressContinue() {
  await until(async () => (await page.locator('#btn-continue').count()) > 0, 8000);
  await idle();
  await tap('#btn-continue');
}

async function tossupWin(pid, { wrongFirst = false } = {}) {
  await tap('#btn-start');
  await wait(1600);
  if (wrongFirst) {
    await page.keyboard.press(pid === 0 ? 'l' : 'j');
    await typeAnswer('TOTALLY WRONG');
    await wait(400);
  }
  await page.keyboard.press(pid === 0 ? 'j' : 'l');
  await until(async () => (await phase()) === 'tossupAnswer');
  await typeAnswer(await answer(), { onscreen: true });
  await until(async () => (await phase()) === 'solved');
}

/** In a main round: whoever has control solves (after handing control to `pid` if needed). */
async function solveRoundAs(pid) {
  let s = await st();
  if (s.control !== pid) {
    await tap('#btn-solve');
    await typeAnswer('NOT THE ANSWER');
    await idle();
    s = await st();
  }
  await tap('#btn-solve');
  await typeAnswer(await answer());
  await until(async () => (await phase()) === 'solved');
}

// =============================== Episode 1 ===============================
await page.goto(url);
await wait(800);
check((await page.locator('#menu-new').isVisible()) && !(await page.locator('#menu-resume').isVisible()), 'menu shows Start New Game and hides Resume with no save');
await shot('menu');
await page.locator('#set-timer .seg-btn[data-v="tv"]').click();
await page.locator('#menu-rules').click();
check(await page.locator('.dialog.rules').isVisible(), 'How to Play opens');
check((await page.locator('.dialog.rules').innerText()).includes('Mystery'), 'rules explain the Mystery wedge');
await shot('rules');
await page.keyboard.press('Escape');
await page.locator('#menu-contestants').click();
check(await page.locator('.dialog.contestants').isVisible(), 'contestant editor opens');
await page.locator('.ed-col.p1 .chip-btn[data-v="curly"]').click();
await page.locator('#photo-0').setInputFiles({ name: 'john.png', mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 300 } }) });
await until(async () => (await page.evaluate(() => window.__spinNight.app && document.querySelector('.ed-col.p0 .ed-preview image') !== null)), 4000);
check(await page.locator('.ed-col.p0 .ed-preview image').count(), 'uploading a photo makes a cropped portrait');
await page.locator('.ed-col.p0 .ed-crop input').first().fill('180');
await shot('contestants');
await wait(600);
const savedAv = await page.evaluate(() => JSON.parse(localStorage.getItem('spinnight.avatars2.v1')).data);
check(savedAv[0].mode === 'photo' && savedAv[0].photo.startsWith('data:image/jpeg') && savedAv[1].hair === 'curly', 'portraits are saved');
await page.locator('.ed-col.p0 .ed-row.photo-row .btn.ghost').click();
await page.keyboard.press('Escape');

await page.locator('#menu-new').click();
await wait(300);
const ep1 = await st();
check(ep1.segment === 'tossup1' && ep1.phase.t === 'intro', 'new game starts at the $1,000 toss-up');
check(ep1.settings.timerMode === 'tv', 'timer setting is used for the new game');
await shot('tu1-intro');

// Toss-up 1: Lex buzzes wrong (locked out), John answers with the onscreen keyboard.
await tossupWin(0, { wrongFirst: true });
let s = await st();
check(s.players[0].bank === 1000 && s.tossup.locked[1], 'toss-up 1: wrong answer locks Lex out; John wins $1,000');
await shot('tu1-solved');
await pressContinue();

// Toss-up 2: pause while answering; the timer must not move.
await tap('#btn-start');
await wait(1200);
await page.keyboard.press('l');
await until(async () => (await phase()) === 'tossupAnswer');
await wait(500);
await page.locator('.icon-btn.pause').click();
const t1 = (await st()).timer.ms;
await wait(1500);
const t2 = (await st()).timer.ms;
check((await st()).paused && t1 === t2, 'pause freezes the toss-up answer timer');
await shot('paused');
await tap('#btn-resume');
await wait(400);
check(!(await st()).paused && (await st()).timer.ms < t2, 'resume restarts the timer');
// Tab hidden while timing: auto-pause, no time lost.
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
const t3 = (await st()).timer.ms;
await wait(1200);
check((await st()).paused && (await st()).timer.ms === t3, 'switching away pauses timers');
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
check((await page.locator('.pause-card h2').innerText()).includes('away'), 'return shows "Paused while you were away"');
await tap('#btn-resume');
await page.locator('.icon-btn.help').click();
const t4 = (await st()).timer.ms;
await wait(1200);
check((await page.locator('.dialog.rules').isVisible()) && (await st()).timer.ms === t4, 'timers hold while How to Play is open');
await page.keyboard.press('Escape');
await typeAnswer(await answer());
await until(async () => (await phase()) === 'solved');
check((await st()).players[1].bank === 2000, 'toss-up 2: Lex wins $2,000');
await pressContinue();

// Round 1
s = await st();
check(s.segment === 'round1' && s.control === 1, 'Round 1 starts with the $2,000 toss-up winner (Lex)');
await shot('r1-intro');
await tap('#btn-start');
await wait(200);
check(await page.locator('#btn-vowel').isDisabled(), 'cannot buy a vowel with $0');
await shot('r1-turn');
// Pick up the Wild Card.
await spinTo('wild');
s = await st();
check(s.phase.t === 'consonant' && s.phase.value === 500, 'landing on the Wild Card asks for a consonant at $500');
check((await page.locator(`${keyFor('A')}`).isDisabled()) && !(await page.locator(keyFor(goodConsonant(s.puzzle.answer, s.puzzle.used))).isDisabled()), 'only consonants are tappable after a spin');
let c = goodConsonant(s.puzzle.answer, s.puzzle.used);
let count = s.puzzle.answer.split('').filter((x) => x === c).length;
await tap(keyFor(c));
await idle();
s = await st();
check(s.players[1].wild === 'held' && s.players[1].round === 500 * count, `Wild Card picked up; Lex earns $500 x ${count}`);
check(await page.locator(keyFor(c)).isDisabled(), 'a called letter is disabled');
check((await page.evaluate((l) => window.__spinNight.act({ type: 'letter', letter: l }), c)) === false, 'calling the same letter again is rejected');
await shot('r1-wild');
// Play the Wild Card.
if (await page.locator('#btn-wild').count()) {
  await tap('#btn-wild');
  s = await st();
  check(s.phase.t === 'consonant' && s.phase.wild && s.players[1].wild === 'used', 'Wild Card played for another consonant');
  const c2 = goodConsonant(s.puzzle.answer, s.puzzle.used) ?? badConsonant(s.puzzle.answer, s.puzzle.used);
  await page.keyboard.press(c2.toLowerCase()); // physical keyboard pick
  await idle();
}
// Buy a vowel.
s = await st();
if (s.control === 1 && s.players[1].round >= 250 && goodVowel(s.puzzle.answer, s.puzzle.used)) {
  const before = s.players[1].round;
  await tap('#btn-vowel');
  const v = goodVowel(s.puzzle.answer, s.puzzle.used);
  await tap(keyFor(v));
  await idle();
  s = await st();
  check(s.players[1].round === before - 250 && s.puzzle.used[v] === 'hit', 'buying a vowel costs $250 and reveals it');
}
// Bankrupt.
s = await st();
const lexBank = s.players[s.control].bank;
const who = s.control;
await spinTo('bankrupt');
s = await st();
check(s.players[who].round === 0 && s.players[who].bank === lexBank && s.control !== who, 'Bankrupt clears round money, keeps banked money, passes the turn');
check(s.players[1].wild !== 'held', 'Bankrupt (or playing it) removes the Wild Card');
await shot('r1-bankrupt');
// Lose a Turn.
const before = (await st()).control;
await spinTo('lose');
check((await st()).control !== before, 'Lose a Turn passes control');
// Missed consonant.
s = await st();
const miss = badConsonant(s.puzzle.answer, s.puzzle.used);
await spinTo('cash', 600);
await tap(keyFor(miss));
await idle();
s = await st();
check(s.puzzle.used[miss] === 'miss' && (await page.locator('.miss-list').innerText()).includes(miss), 'a miss lands in "Not in this puzzle"');
// Wrong solve then correct solve: John wins round 1.
await solveRoundAs(0);
s = await st();
check(s.players[0].bank >= 2000, 'John banks Round 1 (with the house minimum if needed)');
await shot('r1-solved');
await pressContinue();

// Round 2: Mystery.
await tap('#btn-start');
s = await st();
const mys = s.wheel.findIndex((w) => w.kind === 'mystery' && w.hidden === 'cash10k');
await page.evaluate((i) => window.__spinNight.force(i), mys);
await tap('#btn-spin');
await until(async () => (await phase()) === 'consonant');
await idle();
s = await st();
await tap(keyFor(goodConsonant(s.puzzle.answer, s.puzzle.used)));
await until(async () => (await phase()) === 'mysteryChoice');
await idle();
await shot('r2-mystery-choice');
const r2player = (await st()).control;
await tap('#btn-flip');
await wait(1700);
await shot('r2-mystery-flip');
await idle();
s = await st();
check(s.players[r2player].round >= 10000 && s.wheel.every((w) => w.kind !== 'mystery'), 'flipping the lucky Mystery wedge pays $10,000');
// Solve with the device keyboard instead of the onscreen keys.
await tap('#btn-solve');
await page.locator('.key-mode').click();
check(await page.locator('#solve-input').isVisible(), 'device keyboard mode shows a text field');
await page.locator('#solve-input').fill((await answer()).toLowerCase());
await page.locator('#solve-input').press('Enter');
await until(async () => (await phase()) === 'solved');
check((await st()).phase.pid === r2player, 'typing on the device keyboard solves the puzzle');
await page.evaluate(() => window.__spinNight.app.updateSettings?.({ deviceKeyboard: false }));
await pressContinue();
if (await page.locator('.solve.device').count()) await page.evaluate(() => document.querySelector('.key-mode').click());

// Round 3: Express + Prize Puzzle.
await tap('#btn-start');
s = await st();
check(!!s.puzzle.prize && (await page.locator('.cat-badge').innerText()).toLowerCase().includes('prize'), 'Round 3 is the Prize Puzzle');
await spinTo('express');
s = await st();
await tap(keyFor(goodConsonant(s.puzzle.answer, s.puzzle.used)));
await until(async () => (await phase()) === 'expressChoice');
await idle();
await shot('r3-express-choice');
await tap('#btn-ride');
s = await st();
const rider = s.control;
check(s.express === rider && (await page.locator('#btn-spin').count()) === 0, 'riding the Express removes the Spin button');
const cg = goodConsonant(s.puzzle.answer, s.puzzle.used);
if (cg) {
  const r0 = s.players[rider].round;
  const n = s.puzzle.answer.split('').filter((x) => x === cg).length;
  await tap(keyFor(cg));
  await idle();
  check((await st()).players[rider].round === r0 + 1000 * n, 'Express consonants pay $1,000 each without spinning');
}
await shot('r3-express');
s = await st();
await tap(keyFor(badConsonant(s.puzzle.answer, s.puzzle.used)));
await idle();
s = await st();
check(s.players[rider].round === 0 && s.express === null && s.control !== rider, 'an Express miss is a Bankrupt');
const solver3 = s.control;
await solveRoundAs(solver3);
s = await st();
check(s.players[solver3].prizes.some((p) => p.kind === 'trip'), 'Prize Puzzle trip goes to the solver');
await shot('r3-solved');
await pressContinue();

// Triple toss-up: John sweeps.
const triBank = (await st()).players[0].bank;
await tossupWin(0);
await pressContinue();
await tossupWin(0);
await pressContinue();
await tossupWin(0);
s = await st();
check(s.phase.sweep && s.players[0].bank === triBank + 10000, 'Triple Toss-Up sweep pays $6,000 + $4,000 bonus');
await shot('triple-sweep');
await pressContinue();

// Round 4: shorten the clock, then final spin and speed-up.
await tap('#btn-start');
await page.evaluate(() => (window.__spinNight.app.state.r4clock = 600));
await until(async () => (await phase()) === 'finalSpin', 5000);
check((await phase()) === 'finalSpin', 'the bell rings for the final spin when the round clock runs out');
await shot('r4-final-spin');
await force('cash', 900);
await tap('#btn-final');
await until(async () => (await phase()) === 'speedLetter', 15000);
await idle();
s = await st();
check(s.speedValue === 1900, 'final spin value is the wedge plus $1,000');
await shot('r4-speed');
const sp = s.control;
const sl = goodConsonant(s.puzzle.answer, s.puzzle.used) ?? goodVowel(s.puzzle.answer, s.puzzle.used);
await tap(keyFor(sl));
await until(async () => (await phase()) === 'speedSolve');
await idle();
if (sp !== 0) {
  await page.locator('.solve .btn.ghost').click(); // pass
  await until(async () => (await phase()) === 'speedLetter');
  s = await st();
  await tap(keyFor([...'BCDFGHJKLMNPQRSTVWXYZAEIOU'].find((l) => s.puzzle.answer.includes(l) && !(l in s.puzzle.used))));
  await until(async () => (await phase()) === 'speedSolve');
  await idle();
}
await typeAnswer(await answer());
await until(async () => (await phase()) === 'solved');
await pressContinue();

// Bonus round.
s = await st();
check(s.segment === 'bonus' && s.bonus.pid === 0, 'John, with the most money, goes to the Bonus Round');
await shot('bonus-intro');
await tap('#btn-start');
await shot('bonus-categories');
const catNames = await page.locator('.cat-card').allInnerTexts();
const optionAnswers = await page.evaluate(() => window.__spinNight.state().phase.options.map((id) => window.__spinNight.app.picker.get(id).answer));
check(catNames.length === 3 && new Set(catNames).size === 3 && !optionAnswers.some((a) => catNames.join(' ').includes(a)), 'three different bonus categories, answers hidden');
await tap('#btn-cat-1');
await tap('#btn-bonus-spin');
await until(async () => (await phase()) === 'bonusLetters', 15000);
await idle();
s = await st();
check(['R', 'S', 'T', 'L', 'N', 'E'].every((l) => l in s.puzzle.used), 'R S T L N E are revealed automatically');
check(!(await page.locator('.envelope').innerText()).includes('$'), 'the envelope amount stays hidden');
const need = s.bonus.extra ? 4 : 3;
for (const l of ['C', 'D', 'M', 'P'].slice(0, need)) await tap(keyFor(l));
await tap(keyFor('A'));
await shot('bonus-letters');
await tap('#btn-lock');
await until(async () => (await phase()) === 'bonusSolve');
await idle();
await shot('bonus-solve');
await typeAnswer('WRONG GUESS');
check((await phase()) === 'bonusSolve', 'a wrong bonus answer allows another try');
await typeAnswer(await answer());
await until(async () => (await phase()) === 'bonusDone');
s = await st();
check(s.players[0].bonus > 0, 'solving the Bonus Round awards the envelope');
await idle();
await shot('bonus-done');
await pressContinue();
await until(async () => (await phase()) === 'results');
check((await page.locator('.card.results h2').innerText()).includes('John'), 'results name John as champion');
await shot('results');
const ep1Used = (await st()).used;
check(await page.evaluate(() => window.__spinNight.app.sound.ctx?.state === 'running'), 'audio context is running after taps');
const soundErr = await page.evaluate(() => {
  const snd = window.__spinNight.app.sound;
  try {
    for (const n of ['ding', 'buzzer', 'bankrupt', 'loseTurn', 'buzzIn', 'blip', 'solve', 'bigWin', 'victory', 'register', 'bell', 'timeUp', 'countdown', 'mystery', 'cash10k', 'express', 'wild', 'prize', 'wrong', 'reveal', 'whoosh']) snd.play(n);
    snd.tick(0.9);
    snd.countdown(true);
    snd.setMuted(true);
    snd.setMuted(false);
    return '';
  } catch (e) {
    return String(e);
  }
});
check(soundErr === '', `every sound effect plays without errors ${soundErr}`);

// =============================== Episode 2 ===============================
await tap('#btn-rematch');
s = await st();
check(s.segment === 'tossup1' && s.players.every((p) => p.bank === 0), 'rematch resets scores');
check(!ep1Used.includes(s.puzzle.id), 'rematch uses a puzzle not played in episode 1');

// Refresh recovery mid-round.
await tossupWin(1);
await pressContinue();
await tossupWin(1);
await pressContinue();
await tap('#btn-start');
await spinTo('cash', 700);
s = await st();
await tap(keyFor(goodConsonant(s.puzzle.answer, s.puzzle.used)));
await idle();
const beforeReload = await st();
await page.reload();
await wait(900);
const afterReload = await st();
check(
  afterReload.paused &&
    afterReload.segment === beforeReload.segment &&
    afterReload.puzzle.id === beforeReload.puzzle.id &&
    JSON.stringify(afterReload.puzzle.used) === JSON.stringify(beforeReload.puzzle.used) &&
    afterReload.players[1].round === beforeReload.players[1].round &&
    afterReload.control === beforeReload.control,
  'refresh restores round, puzzle, letters, scores and control (paused)',
);
check((await page.locator('.pause-card h2').innerText()).includes('Welcome back'), 'refresh shows the Welcome back screen');
await shot('restored');
await tap('#btn-resume');

// Menu round trip: Main Menu then Resume Game.
await page.locator('.icon-btn.pause').click();
await tap('#btn-menu');
check(await page.locator('#menu-resume').isVisible(), 'Main Menu offers Resume Game');
await page.locator('#menu-new').click();
check(await page.locator('.dialog.small').isVisible(), 'starting a new game asks before discarding the unfinished one');
await page.locator('.dialog.small .btn.ghost').click();
await page.locator('#menu-resume').click();
check((await st()).segment === 'round1', 'Resume Game returns to the same round');

// Lex wins Round 1, then fast-forward to a tie in Round 4.
await solveRoundAs(1);
await pressContinue();
for (const r of ['round2', 'round3']) {
  await tap('#btn-start');
  await solveRoundAs(1);
  await pressContinue();
}
for (let i = 0; i < 3; i++) {
  await tossupWin(i === 2 ? 0 : 1);
  await pressContinue();
}
await tap('#btn-start');
// Make the totals tie once this round is solved.
await page.evaluate(() => {
  const s = window.__spinNight.app.state;
  s.players.forEach((p) => {
    p.bank = 5000;
    p.prizes = [];
    p.round = 0;
    p.roundPrizes = [];
  });
  s.players[1 - s.control].bank = 6000;
});
await solveRoundAs((await st()).control);
await pressContinue();
s = await st();
check(s.segment === 'tiebreak', 'a tie after Round 4 goes to a tiebreaker toss-up');
await shot('tiebreak');
await tossupWin(1);
await pressContinue();
s = await st();
check(s.segment === 'bonus' && s.bonus.pid === 1, 'the tiebreaker winner (Lex) plays the Bonus Round');
await tap('#btn-start');
await tap('#btn-cat-0');
await tap('#btn-bonus-spin');
await until(async () => (await phase()) === 'bonusLetters', 15000);
await idle();
s = await st();
for (const l of ['B', 'G', 'H', 'K'].slice(0, s.bonus.extra ? 4 : 3)) await tap(keyFor(l));
await tap(keyFor('O'));
await tap('#btn-lock');
await until(async () => (await phase()) === 'bonusSolve');
const ok = await until(async () => (await phase()) === 'bonusDone', 40000);
s = await st();
check(ok && s.players[1].bonus === 0 && s.phase.solved === false, 'running out of time loses the Bonus Round and reveals the envelope');
await idle();
await shot('bonus-timeout');
await pressContinue();
await until(async () => (await phase()) === 'results');
check((await page.locator('.card.results h2').innerText()).includes('Lex'), 'Lex can win the game');
const seenCount = await page.evaluate(() => Object.keys(window.__spinNight.app.history.seen).length);
check(seenCount >= 20, `seen-puzzle history kept across games (${seenCount} ids)`);

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
const failed = results.filter(([ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed at ${tag}`);
process.exit(failed ? 1 : 0);
