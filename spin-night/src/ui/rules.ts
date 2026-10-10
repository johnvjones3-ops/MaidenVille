// How to Play: rules, special wedges, timing and how this home game differs from TV.

import { TIMING } from '../engine/game';

const s = (ms: number) => `${Math.round(ms / 1000)} seconds`;

export function rulesHTML(): string {
  const tv = TIMING.tv;
  const ty = TIMING.typing;
  return `
<nav class="rules-nav" aria-label="Rules sections">
  <a href="#r-episode">The episode</a><a href="#r-turn">Your turn</a><a href="#r-wedges">Wedges</a>
  <a href="#r-tossups">Toss-ups</a><a href="#r-final">Final spin</a><a href="#r-bonus">Bonus Round</a>
  <a href="#r-timers">Timers</a><a href="#r-home">Home rules</a>
</nav>

<section id="r-episode">
<h3>The episode</h3>
<ol class="steps">
  <li><b>$1,000 Toss-Up</b></li>
  <li><b>$2,000 Toss-Up</b>. The winner starts Round 1.</li>
  <li><b>Round 1</b>, with the Wild Card and a $1,000 Gift Tag on the wheel.</li>
  <li><b>Round 2 · Mystery Round</b>, with two Mystery wedges.</li>
  <li><b>Round 3 · Prize Puzzle</b>, with the Express wedge. Solving it also wins a trip.</li>
  <li><b>Triple Toss-Up</b>: three connected puzzles, $2,000 each. Win all three for a $4,000 sweep bonus.</li>
  <li><b>Round 4</b>, with a $5,000 top wedge. When the round clock runs out, the bell rings for the final spin and speed-up.</li>
  <li><b>Tiebreaker Toss-Up</b>, only if the totals are tied.</li>
  <li><b>Bonus Round</b> for the player with more money.</li>
  <li><b>Final results</b>, then a rematch with new puzzles.</li>
</ol>
<p>Round 2 starts with the player who didn't start Round 1, and Round 3 goes back to the Round 1 starter. Round 4 starts with whoever won the last Triple Toss-Up.</p>
</section>

<section id="r-turn">
<h3>Your turn in a main round</h3>
<ul>
  <li><b>Spin</b>: tap SPIN, tap the wheel, or flick it with your finger. When it stops on a dollar amount, call a consonant. You earn that amount for every time the letter appears, and you keep your turn. If the letter isn't there, your turn passes.</li>
  <li><b>Buy a vowel</b>: $250 from your money this round, whether the vowel appears once, five times or not at all. You need at least $250 this round to buy one. A missing vowel passes your turn.</li>
  <li><b>Solve</b>: type the whole answer. Capital letters, spaces and punctuation don't matter, but every word must be right. A wrong answer passes your turn.</li>
</ul>
<p>Every called letter is crossed off the letter board, with misses also listed under <b>Not in this puzzle</b>, so nobody can call a letter twice. When the puzzle has no consonants left, the wheel stops and you can only buy vowels or solve.</p>
<p><b>Money:</b> <i>This round</i> on your podium is at risk until you solve. <i>Banked</i> money is safe for the rest of the game. Only the player who solves banks their round money and round prizes; the other player's round money goes away. If you solve with less than $1,000 this round, you bank the $1,000 house minimum.</p>
</section>

<section id="r-wedges">
<h3>Special wedges</h3>
<dl class="wedge-list">
  <dt><span class="wdg bk">Bankrupt</span></dt><dd>You lose all of your money this round, any prizes you picked up this round, and the Wild Card if you hold it. Banked money is safe. Your turn passes.</dd>
  <dt><span class="wdg lt">Lose a Turn</span></dt><dd>Your turn passes. You keep your money.</dd>
  <dt><span class="wdg wild">Wild Card</span></dt><dd>Rounds 1 to 3, until someone takes it. Call a correct consonant here and you earn $500 per letter and pick up the card. Once, right after calling a correct consonant, you can play it to call one more consonant at that same value. If you still hold it in the Bonus Round, you get a fourth consonant. Bankrupt takes it away for good.</dd>
  <dt><span class="wdg gift">Gift Tag</span></dt><dd>Round 1. $1,000 per letter plus a $1,000 gift card, which you keep only if you solve the round.</dd>
  <dt><span class="wdg prize">Prize</span></dt><dd>Round 2. $500 per letter plus a prize, which you keep only if you solve the round.</dd>
  <dt><span class="wdg mys">Mystery</span></dt><dd>Round 2. Call a correct consonant and choose: keep $1,000 per letter, or give that money up and flip the wedge. One Mystery wedge hides $10,000 and the other hides a Bankrupt. After either wedge is flipped, both become ordinary $1,000 wedges.</dd>
  <dt><span class="wdg exp">Express</span></dt><dd>Round 3. Call a correct consonant for $1,000 each, then choose whether to ride the Express. On the Express you stop spinning: consonants are $1,000 each, vowels cost $250, and you keep going until you solve. Any letter that isn't in the puzzle, or a wrong solve, counts as a Bankrupt. You can also decline and keep playing normally.</dd>
  <dt><span class="wdg cash">Top dollar</span></dt><dd>$2,500 in Round 1, $3,500 in Rounds 2 and 3, $5,000 in Round 4.</dd>
</dl>
</section>

<section id="r-tossups">
<h3>Toss-ups</h3>
<p>Letters appear one at a time. John buzzes with the left button (or <kbd>J</kbd>), Lex with the right (or <kbd>L</kbd>). The first buzz freezes the board and opens that player's answer box. A wrong answer, a pass or running out of time locks that player out, and the board keeps filling in for the other player. If the board gets down to its last hidden letter, you get a final few seconds to buzz. If nobody gets it, the answer is shown and nobody scores.</p>
<p>Toss-up money is banked right away, so Bankrupt can't touch it. The <b>Triple Toss-Up</b> is three puzzles in the same category with a hidden theme, which is revealed after the third. Win all three and you also get a $4,000 sweep bonus.</p>
</section>

<section id="r-final">
<h3>Round 4: final spin and speed-up</h3>
<p>Round 4 plays normally while the round clock runs (shown at the top). The clock only counts while someone is deciding or picking a letter, so wheel spins and typing don't use it up. When it runs out, the bell rings at the end of the current turn. The player in control spins once more; consonants are now worth that wedge <b>plus $1,000</b>. If the final spin lands on Bankrupt or Lose a Turn, spin again.</p>
<p>Then players take turns calling one letter each. No more spinning or buying: vowels are free but worth nothing. If your letter is in the puzzle, you get a short window to solve or pass. A miss, a pass, a wrong answer or running out of time moves play to the other player.</p>
</section>

<section id="r-bonus">
<h3>Bonus Round</h3>
<ol class="steps">
  <li>The player with the most money (cash plus prizes) picks one of three categories. You only see the category names.</li>
  <li>Spin the bonus wheel to pick a sealed envelope. Its prize stays hidden until the end.</li>
  <li>R, S, T, L, N and E are filled in for you.</li>
  <li>Pick three more consonants and one vowel. Holding the Wild Card adds a fourth consonant.</li>
  <li>Your letters are revealed together and the countdown starts. Answer as many times as you like until time runs out.</li>
  <li>The answer and the envelope are revealed. Solve it and the envelope's prize is yours.</li>
</ol>
</section>

<section id="r-timers">
<h3>Timers</h3>
<table class="timing">
  <thead><tr><th></th><th>TV speed</th><th>Typing-friendly</th></tr></thead>
  <tbody>
    <tr><td>Toss-up answer after buzzing</td><td>${s(tv.tossupAnswer)}</td><td>${s(ty.tossupAnswer)}</td></tr>
    <tr><td>Round 4 clock before the bell</td><td>${s(tv.r4Clock)}</td><td>${s(ty.r4Clock)}</td></tr>
    <tr><td>Speed-up: call a letter</td><td>${s(tv.speedLetter)}</td><td>${s(ty.speedLetter)}</td></tr>
    <tr><td>Speed-up: solve</td><td>${s(tv.speedSolve)}</td><td>${s(ty.speedSolve)}</td></tr>
    <tr><td>Bonus Round solve</td><td>${s(tv.bonus)}</td><td>${s(ty.bonus)}</td></tr>
  </tbody>
</table>
<p>On TV, contestants answer out loud. Typing takes longer, so the typing-friendly setting stretches each window. The TV-speed Bonus Round keeps the broadcast's 10 seconds. Regular turns have no time limit.</p>
<p>Timers stop while the game is paused, while this guide is open, and whenever you switch apps or tabs. Switching away pauses the game, so neither player loses time; tap Resume when you're both ready.</p>
</section>

<section id="r-home">
<h3>How this home game differs from TV</h3>
<ul>
  <li>Two contestants instead of three, and no host: the player in control spins the final spin.</li>
  <li>Answers are typed rather than spoken, with longer timers to match (see Timers).</li>
  <li>The final-spin bell is set off by the round clock above rather than by the TV producers' running time.</li>
  <li>The $4,000 Triple Toss-Up sweep bonus is a Spin Night house rule.</li>
  <li>The Gift Tag and Prize wedges can each be picked up once per round. All prizes, trips and bonus envelopes are play money, counted at the listed value.</li>
  <li>Tiebreaker toss-ups are worth no money. If nobody solves one, another one is played.</li>
  <li>Bonus envelopes hold $40,000 to $100,000.</li>
</ul>
<p>Spin Night is a fan-made home game inspired by the classic U.S. TV format. It is not affiliated with any TV show or network.</p>
</section>
`;
}
