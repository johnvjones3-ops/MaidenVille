# MaidenVille Runner!

*A little imagination. A whole city of adventure.*

MaidenVille Runner! is a 3D endless runner for kids, starring **Maddy Maiden**. She runs through a full-scale version of the city she built as a handmade model. Everything is local and runs in the browser: there are no ads, no accounts, no payments and no network calls. Progress is saved in `localStorage`.

## Run it

Requirements: Node 22.12+ recommended (Node 20.19+ supported), npm, and a browser with WebGL 2.

```bash
npm ci             # installs the exact committed lockfile
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production dist/ + self-contained offline HTML
npm run preview    # serve dist/ at http://localhost:4173
npm test           # vitest: route reachability, rewards, letters, collisions, saves, restart
npm run typecheck
```

`dist/` is a static site, so you can host it anywhere. It uses relative paths (`base: './'`).

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Change lanes | Swipe left / right | ← → or A / D |
| Jump | Swipe up | ↑, W or Space |
| Slide | Swipe down | ↓ or S |
| Pause / resume | Pause button | Esc or P |
| On-screen buttons | Settings → On-screen buttons | — |

Each swipe triggers exactly one action. The direction locks once per gesture, and swipes never scroll the page. Inputs are buffered for about 0.12 s. The game pauses automatically when the tab is hidden, the window loses focus or the device rotates. Resuming always runs a short 3‑2‑1 countdown.

## Modes

- **Little Explorer** (the default): slower pace, forgiving hitboxes, sparse hazards, three hearts. A bump causes a playful stumble, costs one heart, slows Maddy briefly and gives her about 2 s of visible protection. Losing the last heart ends the run with a kind summary.
- **City Challenge** (labelled *Harder*): faster, with combination patterns. Speed is capped, and every pattern is still validated as fair at the maximum speed. Keeps local best scores.
- **Explore MaidenVille**: no damage, no score and no timer. It has Stop/Go, a city map for travelling to any landmark, and "Look at …" landmark cards that freeze travel while open. Explore can fill the Passport but never banks stars or sets records.

## Features

- **Maddy**: a hand-built, articulated rig (`src/render/character.ts`):
  - Two fluffy puffs with a center part, and the puffs bounce with secondary motion.
  - Medium-to-deep brown skin, a painted face with big eyes and a bright smile, and stud earrings.
  - Navy *WE ARE KNIGHTS* tee with a gold knight, dark jeans, and dark sneakers with light soles.
  - Animations: idle, wave, run, lane lean, jump (rise and fall), crouch-slide, stumble, glide and celebrate. She turns to face the camera on the title, results and closet screens.
- **The seven landmarks from the model**, built as full 3D buildings with crisp canvas-drawn signs:
  - Trinity Church
  - Kingdom School (with a bus and a playground)
  - Super Target (bullseye, red awnings and a parking lot)
  - Hospital (turquoise fascia, blue cross and a blue-framed glass entrance)
  - Emergency Station (EMERGENCY 911, FD 118 and PD 67, plus a fire engine and a police car)
  - The **Turquoise-Door House** and the **Pink-Door House**
- **A winding route built around the landmarks**: a closed loop of 12 streets with turns in both directions (`src/world/route.ts`), so world coordinates stay bounded forever. Every landmark stands at the **end of a street, straight ahead of Maddy and centred on screen**. The road then turns in front of it, so the building gets bigger the whole way down the street. The two colorful houses stand side by side at the first junction. Filler buildings line the sides, and Maddy's Imagination Park and the Celebration Plaza sit at the ends of two more streets.
- **The introductory tour covers every landmark** in under three minutes at beginner speed, without requiring speed power-ups. This is tested.
- **Hazard-free zones** around the tutorial, the corners, the last 34 m before each landmark, glide flights and landings. Zone banners appear low on the screen so they never cover the landmark ahead.
- **Obstacles**: foam hurdles, puddles, low festival arches, padded parcel stacks and "LANE CLOSED FOR FUN" lanes. Each has its own colour, silhouette and floor markings.
- **Power-ups**: Star Magnet, Bubble Shield, Rainbow Sneakers (with a grace window afterwards) and Imagination Glide (clears and reserves its flight and landing span). Picking up a power-up that's already active refreshes its timer instead of stacking it. Each shows a ring timer that blinks before it runs out.
- **MADDY Letter Quest**: the five letters are indexed pickups, so the two Ds are separate and must come in order. Each completed word pays out once.
- **City Passport**: seven stamps, earned by actually passing each landmark. Collecting all seven earns the MaidenVille Explorer badge. The scrapbook shows drawn thumbnails and short descriptions.
- **Friendly Missions**:
  - Flowers go to the church, a book to the school, a gift to the store and a thank-you card to the hospital.
  - Grab the glowing item, then run through the green delivery lane at the landmark.
  - If Maddy misses the lane, it returns on the next lap.
- **Goals** (three active from a finite list) and **8 badges**. Rewards are settled exactly once per run ID.
- **Maddy's Closet**: outfits, sneakers, hair ties and clips (which never cover the puffs) and trails. Everything is bought with earned stars, then equipped and saved.
- **Audio**: an original Web Audio palette (marimba loop, bells and chimes, soft footsteps, birds and a church bell). It starts only after the first tap or keypress.
- **Settings**: SFX and music volume, mute, reduced motion (fades instead of camera flights), on-screen buttons, graphics quality, tutorial replay, and reset progress (with a confirmation).

## Architecture

```
src/config.ts              central config: name, palette, Maddy's look, controls, modes, rewards, cosmetics, quality
src/world/route.ts         CityRoute (CityGraph): loop of streets + arcs, pose(s), corners
src/world/landmarks.ts     LandmarkRegistry: stable IDs, placements, zones
src/sim/                   pure simulation (no DOM/three): RunSim, RouteGenerator, patterns,
                           PatternValidator, LetterQuest, MissionSystem
src/save/                  SaveManager (versioned, sanitised, corruption-safe), progression (goals, badges, settlement)
src/render/                SceneManager, CityBuilder, landmark models, CharacterBuilder/Animator,
                           EntityRenderer (pooled), effects, camera director, canvas textures
src/audio/audio.ts         AudioManager
src/input/input.ts         InputManager (keyboard + pointer swipes + buttons)
src/ui/                    DOM UI, icons, passport thumbnails, CSS
src/game.ts                state machine: loading → intro → title → transition → countdown →
                           running ⇄ paused → ending → results (+ exploring / inspect / closet)
```

- **Simulation**: runs on a fixed 1/120 s step with catch-up capped at 0.1 s. Collision checks are swept along the route, so nothing tunnels through obstacles.
- **Generation**: uses a seeded RNG. Visual randomness uses a separate seed, so the city looks the same every time.
- **Fairness**: every generated pattern is validated against real lane-change, jump and slide timings at the mode's maximum speed. The validation starts from the reachable state carried over from the previous chunk, and it requires a path from every lane Maddy could currently be in.
- **Rendering**:
  - Static city meshes are batched by material and spatial cell.
  - Trees, windows, lamps, flowers, people and stars are instanced.
  - Obstacles and pickups come from pools, so a run never adds scene objects.
  - Device pixel ratio is capped per quality level.

## Verification in this delivery

- `npm test`: **47 tests passed** across four files.
- `npm run typecheck`: passed.
- Production build and offline bundling: passed.
- Existing tests cover 40 seeded 4 km pattern streams per mode, starting/capped speeds, chunk boundaries, tutorial/corner safety, and an autopilot exercising real movement for 3 km on six seeds in each running mode.
- Regression checks additionally cover reference-relative city geography, a complete seven-landmark tour within 180 seconds without speed power-ups, immediate Explore Stop/Go, skipped landmarks not receiving stamps, glide renewal and a later rainbow sprint, zero sightseeing currency/records, payout deduplication beyond 50 newer runs and reload, save version backup, invalid saved identifiers, and one-action swipe/cancel/button/keyboard behavior.
- The input tests dispatch synthetic events against event targets; they are **not real browser or device tests**.
- This session did **not** have the supported browser-preview capability. Fresh visual screenshots, phone/tablet/desktop browser interaction, audio listening, and real-device frame rates were therefore **not verified**. Prior repository screenshot/performance claims are not used as verification for this delivery.
- Responsive CSS covers portrait/landscape, safe areas, reduced motion and compact phone controls. A visual/device review remains necessary before calling this release fully accepted.

## Reference notes and honest limitations

- `IMG_1625.jpeg` was retrieved and visually inspected for this delivery. The city route was re-authored to keep church upper-left, houses upper middle-left, school upper-right, emergency lower-left, hospital middle-left, and store foreground-right. Distances and connecting streets are gameplay adaptations rather than a pixel-for-pixel reconstruction.
- The original portrait could not be located. Maddy uses the supplied appearance notes: brown skin, two fluffy puffs with a center part, navy WE ARE KNIGHTS tee, jeans and dark sneakers. **Her face remains a stylized interpretation, not a verified facial match.** Editable assets:
  - `MADDY_LOOK` in `src/config.ts` for colours.
  - `faceTexture()` and `shirtTexture()` in `src/render/textures.ts`.
  - `buildMaddy()` in `src/render/character.ts`, replaceable with a glTF rig.
- No reference photo is included in the build.
- The green road markings in the original photo couldn't be read, so they were not reproduced.
- The house names (Turquoise-Door / Pink-Door) are **game labels**.
- **Invented additions**: the "Welcome to MaidenVille" arch, Maddy Maiden Way and the other street signs, Maddy's Imagination Park, the Celebration Plaza, the wayfinding signs and all the missions. None of these claim anything about Maddy's real life.
- Neighbors are simple stylized figures. The trees and filler buildings are low-poly.
- The city geometry is built once at load time for the chosen quality. Changing quality later adjusts the pixel ratio, shadows, fog and particles; reload to change how many trees and buildings are drawn.
- Sound was generated but could not be listened to here. The checks only confirmed that no audio errors occurred.

## Delivery files

`npm run build` produces:

- `dist/index.html` and bundled `dist/assets/`: the hosted game.
- `dist/maidenville-runner.html`: a complete self-contained offline page, including CSS, JavaScript, viewport metadata and all procedural assets. Desktop browsers can open it directly; mobile file-preview apps may not execute HTML games, so use the hosted link on a phone.

There are no remote fonts, audio, models or textures required by gameplay. Hosting authentication is separate from the game: the supplied hosted preview is private, while the exported game itself has no account requirement.

## Changes in 1.1.0

Reused the existing game in this repository and corrected its reference geography. Fixed immediate sightseeing stopping, renewed-glide landing reservation, stale swipe cancellation, accessible touch-button activation, asynchronous pause during camera transitions, inspected-place results, sightseeing tutorial completion, old-result payout replay, unsupported save versions, and corrupt progress identifiers. Added menu focus containment, a WebGL 2 startup/retry screen, smaller phone controls and a complete offline HTML export. Unrelated projects in this repository are unchanged.
