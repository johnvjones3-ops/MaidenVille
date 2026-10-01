# MaidenVille Runner!

*A little imagination. A whole city of adventure.*

MaidenVille Runner! is a 3D endless runner for kids, starring **Maddy Maiden**. She runs through a full-scale version of the city she built as a handmade model. Everything is local and runs in the browser: there are no ads, no accounts, no payments and no network calls. Progress is saved in `localStorage`.

## Run it

Requirements: Node 18 or newer (developed on Node 22).

```bash
npm install        # uses the committed package-lock.json
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build into dist/
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
- **A connected route**: an authored loop of four streets with rounded corners (`src/world/route.ts`), so world coordinates stay bounded forever. The opening aerial matches the model's layout: church toward the back left, houses on the left of the avenue, school at the back right, emergency station front left, hospital middle-left and store front right. The camera then descends to Maddy at the foreground intersection.
- **The first lap covers every landmark** in about 2.5 minutes at beginner speed. This is tested.
- **Hazard-free zones** around the tutorial, corners, landmark viewing areas, glide flights and landings. During landmark zones the camera turns gently toward the building.
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

## Verification

These checks were actually run in this environment:

- `npm run typecheck` and `npm run build` pass.
- `npm test`: **32 tests pass**. They cover:
  - Route continuity.
  - Generated courses validate at the maximum and starting speeds across 40 seeds × 4 km. This includes chunk boundaries, and no hazards appear in the tutorial, corners or landmark zones.
  - An **autopilot that plays the real simulation** (real lane, jump and slide physics) survives 3 km in both modes on 6 seeds each with zero hits.
  - The tour reaches all 7 landmarks within 180 s.
  - The two-D MADDY rule and once-per-word rewards.
  - Collisions: hearts, protection after a hit, no multi-hit, the shield absorbing exactly one bump, and Explore never taking damage.
  - Glide landing safety and power-up renewal.
  - Restart resets everything, and entity counts stay bounded over 300 s.
  - Corrupted or invalid saves are repaired, and storage that throws is handled.
  - Run payouts happen exactly once, even after a reload.
- **Browser checks** were done in headless Chromium (Playwright, SwiftShader software WebGL). Screenshots were reviewed at 1280×720, 960×540, 800×600 and 390×844 (phone portrait) for:
  - Intro, title, running, corners, every landmark, glide, pause, results, closet, passport, settings, Explore, the map and landmark cards.
- **Scripted input check**:
  - A mouse swipe gives exactly one lane change, and the arrow keys and A/D work.
  - A swipe up jumps.
  - Hiding the tab pauses the game and freezes the simulation.
  - The canvas uses `touch-action: none`.
- **Performance**: this was **not** measured on real devices. Software rendering in the sandbox ran at about 2–6 fps, which says nothing about GPU performance. A frame shows roughly 220–360 draw calls (including the shadow pass) and about 300k triangles. Use **Low** quality on older phones.

## Reference notes and honest limitations

- No reference images were attached in this build environment. Maddy's likeness and the landmarks come from the written, verified visual notes in the brief. The skin tone, the two-puff hairstyle, the outfit and the landmark identities all follow those notes. **The face is a stylized interpretation, not a precise facial match.** To refine it, edit:
  - `MADDY_LOOK` in `src/config.ts` for colours.
  - `faceTexture()` and `shirtTexture()` in `src/render/textures.ts`.
  - `buildMaddy()` in `src/render/character.ts`, which can be swapped for an imported glTF model.
- No reference photo is included in the build.
- The green road markings in the original photo couldn't be read, so they were not reproduced.
- The house names (Turquoise-Door / Pink-Door) are **game labels**.
- **Invented additions**: the "Welcome to MaidenVille" arch, Maddy Maiden Way and the other street signs, Maddy's Imagination Park, the Celebration Plaza, the wayfinding signs and all the missions. None of these claim anything about Maddy's real life.
- Neighbors are simple stylized figures. The trees and filler buildings are low-poly.
- The city geometry is built once at load time for the chosen quality. Changing quality later adjusts the pixel ratio, shadows, fog and particles; reload to change how many trees and buildings are drawn.
- Sound was generated but could not be listened to here. The checks only confirmed that no audio errors occurred.
