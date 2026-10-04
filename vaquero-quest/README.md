# UTRGV Vaquero Quest

A side-scrolling platformer for the browser. Run, jump, hit V crates from below, stomp Practice Bots, collect basketballs and UTRGV items, find secrets, and finish at the UTRGV Fieldhouse. The game has three hand-built levels, a secret book room and a boss fight against the Rebounder 3000.

All art is drawn with canvas vector code, and all music and sound are synthesized with Web Audio. There are no image or audio files, no network calls, no accounts and no API keys. Progress is saved in `localStorage`.

## Run it

Requires Node 18+ (developed on Node 22).

```bash
cd vaquero-quest
npm install            # uses package-lock.json
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm run preview        # serve dist/ at http://localhost:4173
npm test               # 43 vitest tests (physics, blocks, enemies, checkpoints, saves, level reachability, boss)
npm run build:single   # also writes dist/vaquero-quest.html: one self-contained file you can double-click
```

`npx vite-node scripts/dump.ts 2` prints a level as ASCII art, with the validator's reachable spots marked.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | ← → / A D | Slide your thumb on the left pad |
| Jump (hold to jump higher) | Space / Z | JUMP |
| Run | hold Shift / X | hold RUN |
| Lasso | C | Rope button |
| Drop through a ledge | ↓ + Jump | Pull the pad down, then press JUMP |
| Enter a door | ↑ / W | Push the pad up |
| Pause | Esc / P | II button |
| Restart from checkpoint | R (while paused or after a fall) | Menu button |

Gamepads also work: the stick or d-pad moves, A jumps, X or a trigger runs, B or Y throws the lasso, and Start pauses.

## What's in it

- **Movement:** fixed 60 Hz simulation with an accumulator and interpolated rendering. It has acceleration, skid, air control, run speed, variable jump height (releasing jump early cuts the jump), heavier gravity while falling, coyote time (90 ms) and jump buffering (120 ms). All tuning values are in `src/config.ts`.
- **Collision:** X and Y are resolved separately, with substeps of 12 px or less so nothing tunnels through. The player slides around ceiling corners. One-way ledges, drop-through and moving platforms that carry the player are all supported.
- **Blocks:** V crates pay out only when struck from below, once per hit, with a cooldown. Single crates turn empty after use, and multi-reward crates count down. Hat, star, lasso, V-hand and book crates also exist. Terracotta blocks break only in Vaquero form. Hidden blocks give a faint twinkle as a clue and show a dotted outline under the lantern. Bumping a block knocks out any enemy standing on it.
- **Forms:** Rookie (plain black hat) and Vaquero (taller, green-star hat, boots and scarf, one extra hit). If there is no headroom when you pick up a hat, growth waits until there is room.
- **Enemies:** Practice Bot (walks; some avoid ledges), Tumbleweed (shakes, shows a "!" and kicks up dust before it rolls), Prickly Hopper (spiky, so it can't be stomped; it crouches before each hop) and Foam Launcher (its barrel glows before it fires). Hazards include pits, retracting cactus spikes (they wiggle as a warning) and safe bouncing practice balls.
- **Boss:** The Rebounder 3000 cycles through three telegraphed attacks: a lob volley with landing markers, a court charge (the seats are safe) and a slam that sends floor shockwaves. After each attack its core hatch opens. Stomp the core or lasso it; three hits win. A giant V then drops to center court to end the game.
- **Checkpoints:** each checkpoint saves a coherent snapshot of tiles, crates, collected items, defeated enemies, score and basketball total. Dying cannot farm rewards or extra lives. Rare items (V emblems, V hands, books) are kept separately and merged in after a respawn, so they are never lost and never counted twice.
- **Save data:** saved in `localStorage` with a schema version. It stores unlocked levels, best score and time per level, rare item IDs and settings. Missing, blocked, corrupt or future-version saves fall back safely. Progress can be reset after a confirmation.

### Verification

`tests/levels.test.ts` replays the real player physics as Rookie, with no power-ups and enemies ignored. It checks that every level can be finished on its main route, that every checkpoint can be reached, that there are no dead-end spots, and that every rare collectible can be reached. Bouncers and door links are modeled. Moving platforms are treated as surfaces along their whole path.

I also drove every menu flow, touch multi-touch and the single-file build in headless Chromium with Playwright, and saw no console errors.

## Known limitations

- The reference photo and icon sheet were not available while this was built. The Fieldhouse and every UTRGV object (V hands, basketball, crate, lantern, stool, both hats, star, V emblem, book, lasso, potted palm) are redrawn from the written descriptions. None of the excluded blue panels are used.
- The arena interior is an artistic interpretation, not the real building.
- Playtesting was automated (unit tests, the reachability validator and scripted browser runs). Feel tuning would benefit from human playtesting on real phones.
