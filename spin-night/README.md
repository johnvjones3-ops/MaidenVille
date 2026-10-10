# Spin Night: John & Lex

A two-player home adaptation of the classic U.S. TV wheel-and-puzzle game show, built for John and Lex to play together on one screen. It's designed for an 11-inch iPad in either orientation, and it also works on phones and computers.

Everything is drawn in the browser: the puzzle board is HTML, the wheel is a canvas, the contestant portraits are SVG, and every sound and the victory music are synthesized with Web Audio. There are no image or audio files and no API keys. Games save themselves automatically.

## Run it

Requires Node 18+ (developed on Node 22).

```bash
cd spin-night
npm install
npm run dev            # http://localhost:5173
npm test               # vitest: puzzle bank validation + engine rules + 60 simulated full episodes
npm run build:single   # dist/spin-night.html (open directly) and dist/spin-night.artifact.html (for publishing)
npm run playtest       # Playwright: plays two full episodes through the real UI (needs build:single first)
node scripts/playtest.mjs --size 390x760 --shots   # other screen sizes, screenshots in screenshots/
```

## The episode

1. $1,000 toss-up
2. $2,000 toss-up (the winner starts Round 1)
3. Round 1, with the Wild Card and a $1,000 Gift Tag
4. Round 2, the Mystery Round, with two Mystery wedges ($10,000 or Bankrupt underneath)
5. Round 3, the Prize Puzzle (wins a trip), with the Express wedge
6. Triple Toss-Up: three connected puzzles at $2,000 each, plus $4,000 for a sweep
7. Round 4, with a $5,000 top wedge. A round clock rings the bell for the final spin (wedge + $1,000 per consonant) and speed-up
8. Tiebreaker toss-ups, only if the totals are tied
9. Bonus Round: three categories, a bonus-wheel envelope, R S T L N E, 3 consonants + 1 vowel (+1 with the Wild Card), then a countdown
10. Final results and a rematch with new puzzles

The in-game How to Play explains every wedge, the timers, and how this home version differs from the broadcast.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Spin | SPIN button, tap the wheel, or flick it | Space |
| Call a letter | Tap it on the letter board | The letter key |
| Buzz in (toss-ups) | John's or Lex's buzzer | J / L |
| Type an answer | Onscreen keys, or switch to the device keyboard | Type, Enter to submit |
| Continue / start | The gold button | Enter |
| Pause | Pause button | Esc |

## How it's built

- `src/engine/` is the rules: a pure reducer `(state, action) -> (state, events)` with no DOM or clock. Wheels, timing, scoring, Mystery, Express, Wild Card, speed-up, tiebreakers and the Bonus Round all live here. The UI only animates the events it returns, so a double tap, a letter during a spin or a second landing is rejected by the engine itself.
- The wheel lands where the engine says: a spin picks a final angle, and the payout is read from that same angle with `wedgeAt()`, so the wedge under the pointer is always the wedge that pays.
- `src/puzzles/bank.ts` holds 427 unique puzzles: 301 main, 18 prize puzzles with trips, 18 Triple Toss-Up sets and 54 bonus puzzles, across Phrase, Food & Drink, What Are You Doing?, Around the House, On the Map, Show Biz, Fun & Games, Before & After and Denton, Texas. Before & After answers are built from their two halves (`ba('COUCH POTATO', 'POTATO SALAD')`), and a test checks every overlap. Tests also check uniqueness, difficulty balance, and that every answer fits the 12/14/14/12 board.
- `src/puzzles/select.ts` picks unseen puzzles first (matching difficulty, then nearby difficulty, avoiding repeated categories in an episode). It only recycles, oldest first, once a pool is exhausted. Seen history is kept across games. New Game keeps it; "Reset / New Puzzle Set" clears it.
- `src/save/storage.ts` saves settings, history, the game in progress and portraits to `localStorage`. When the page runs as a Claude artifact, it also mirrors them to the signed-in viewer's private artifact storage, so a cleared browser can recover. A refresh reopens the game paused, with scores, round, puzzle, letters, cards and timers intact. A spin that was interrupted lands where it was always going to land.
- Timers stop while paused, while a dialog is open, and when the tab or app is in the background (which also pauses the game, so neither player loses time).

### Denton, Texas puzzles

These are based on places and events checked against current local sources in October 2026: the downtown square and Courthouse-on-the-Square Museum, Recycled Books in the purple former opera house, Beth Marie's, Twilight Tunes, the Arts & Jazz Festival in Quakertown Park, the Day of the Dead coffin races on Hickory Street, Dan's Silverleaf, Seven Mile Cafe, the One O'Clock Lab Band, TWU's Little Chapel-in-the-Woods, the A-train, Ray Roberts Lake and the North Texas Fair and Rodeo. Spots whose current status couldn't be confirmed (for example Denton Square Donuts, Jupiter House and LSA Burger) were left out. The toggle in the menu turns the category off.

## Known limitations

- The illustrated portraits are drawn from John and Lex's photos. Their skin tones were averaged across sunlit and indoor shots. John has a lined-up short cut, a full trimmed beard, a cream knit polo and a gold chain. Lex has sleek pulled-back hair with curls at the back, small hoops, and a black halter with a pendant. The photos themselves are not in the repository or the build. **Contestants** can fine-tune each portrait (skin tone, face shape, hair, facial hair, outfit, jewelry) or use an uploaded photo instead, which is kept only in that browser and the player's private save.
- The earlier `John_and_Lex_Spin_Night.html` was not available, so the game was built from the written spec.
- On iPhone and iPad, sound starts after the first tap, as Safari requires. On iOS 17+ it plays even with the ringer switch on silent.
- Answers must be spelled correctly. Only case, spaces and punctuation are forgiven, and `&` counts as AND.
