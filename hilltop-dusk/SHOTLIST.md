# Hilltop at Dusk: shot list

A silent 54-second compilation of six looping clips. One character stands alone
on a grassy rise at dusk, smoking and looking down at a lit farmhouse. The
rendered files are in `out/`. This document describes the same film in enough
detail to rebuild it by hand or in another video tool.

## Format

| | |
|---|---|
| Frame | 960 × 720 (4:3, silent-era Academy-style ratio) |
| Rate | 24 fps output. Characters, smoke and grass are animated **on twos** (12 drawings/s). Grain, flicker and gate weave run on ones. |
| Clip length | 9.5 s = 228 frames = 114 drawings. Every clip is a seamless loop: frame 228 = frame 0. |
| Transitions | 12-frame (0.5 s) cross-dissolves. The set is identical in every clip, so only the character changes. |
| Total | 6 × 9.0 s = **54.0 s** (1296 frames). The file loops: the last half-second dissolves Betty into Mickey's first frame. |
| Sound | None (silent). No dialogue, no title cards, no logos, no studio names. |
| Look | Limited early colour: violet-to-orange sky, everything else nearly monochrome. Characters are inked black and off-white paper (#F0E8D4). There is also a full black-and-white cut. Post: soft 3×3 blur, 32% desaturation, warm tone, S-curve contrast, luminance grain (σ≈0.045), ±2% flicker, sub-pixel gate weave, dust specks, a hair now and then, short runs of vertical scratch, and a vignette. |

## The shared set (identical in all six clips)

Camera: **medium-wide, locked off, slightly low.** The lens sits at about the
character's knee height, so the head and shoulders stand against the sky and
the farm lies below the horizon. There is no camera move, which keeps every clip
loopable. For a single non-looping pass, a 100%→104% push centred on the
character over 9.5 s also works.

Layout (pixel positions in the 960 × 720 frame):

- **Sky (y 0–480):** gradient from deep violet (#2B1C45) at the top, through mauve (#5C3361) and rose (#A85466), to orange (#ED854D) and gold (#FCBD6B) at the horizon. About 14 faint stars in the top 170 px. Five long flat clouds with violet tops and orange-lit undersides.
- **Sun:** a half-set disc at (575, 476), r = 26, with a 260 px warm glow. It sits between the character and the farm, so the scene is backlit.
- **Far hills:** two soft violet silhouette bands, about y 450–490.
- **Valley floor:** dusky plum (#45293F to #2E1F2E) with faint furrow lines that recede toward the farm.
- **Farmhouse:** a small gabled house, 80 × 43 px, at x 655–735, base y 548, roof peak (695, 468), with a chimney. It has two warm windows with cross mullions, a lit open door and a round attic light (#FFC766). Each light has a 34 px glow that flickers ±5%. A faint chimney wisp rises at 13 px/s.
- **Windmill:** a farm water-pump windmill. The lattice tower stands at x ≈ 805, base y 556, hub (805, 448). The 12-blade wheel is seen at three-quarter (60% horizontal squash) with a tail vane pointing right. It turns 5/12 of a revolution per 9.5 s loop, so the loop is seamless.
- **Extras:** a lone round tree at (626, 496) and a post-and-rail fence along y 548–560.
- **The rise:** the foreground hill crest `y = 588 + 0.00026·(x − 290)²`. It is highest under the character and falls away to the right, which opens the view to the valley. The ground is a near-black gradient. The crest has a thin orange rim light from the low sun and short static grass tufts.
- **Foreground:** three dark rocks (bottom-left, a small one beside it, bottom-right) with ink outlines and orange rim highlights. About 150 tall grass blades (55–175 px) are clustered at both lower corners and kept shorter in the middle. About 110 small tufts on the crest sit around the feet, and those whose roots are nearer the camera are drawn over the feet. All grass sways in a two-frequency breeze that travels left to right (periods 4.75 s and 1.9 s, both dividing the loop).
- **Character mark:** feet at (300, 591), in the left third, on the crest. The character faces screen-right (toward the farm) in three-quarter view and is about 360 px tall (Oswald's ears reach about 400 px). A soft contact shadow falls back toward camera-left, away from the sun.

## The shared performance (every clip, frame numbers within the 228-frame loop)

| Frames | Time | Beat | Animation detail |
|---|---|---|---|
| 0–28 | 0.0–1.2 s | **Idle** | Smoking hand rests at hip height in front of the body, cigarette tilted up and forward about 55°. The other hand is on the hip (Felix: behind the back), elbow out. Idle breathing: ±1.4% vertical stretch, three breaths per loop. Body sways ±0.7°. A thin wavy wisp rises from the lit end. Last loop's smoke puffs are still drifting off toward the farm. |
| 29–55 | 1.2–2.3 s | **Raise** | The hand arcs up and out to the lips along an S-curve. The cigarette swings level so its butt meets the mouth. The eyes glance down toward the hand. The wisp breaks while the hand is moving, so it never draws a hook. |
| 55–91 | 2.3–3.8 s | **Slow drag** | Stretch: the body lengthens 7% and narrows 5%. The chin lifts 4°. The lids drop to about 60%. The ember swells from a 6 px to an 18 px orange glow. |
| 91–118 | 3.8–4.9 s | **Lower** | The hand returns to rest. The breath is held (stretch peaks at 7.5%) until about frame 104. |
| 104–156 | 4.35–6.5 s | **Exhale** | Squash and stretch: the body drops to −8.5% at frame 119, overshoots to +3% at frame 132 and settles by frame 158. The mouth opens to a small black "O". The chin tips up 7.5° and the lids sit at 30–40%. A puff leaves the mouth every 1/6 s from frame 104 to frame 148 (11 puffs). |
| 156–228 | 6.5–9.5 s | **Settle / contemplate** | Breathing resumes. The head turns toward the farmhouse: features slide about 4 px right by 7.6 s, hold until 8.6 s, then ease back. One slow blink at 8.35 s (frame 200). Everything returns exactly to the frame-0 pose. |

**Exhaled smoke path:** each puff starts at the lips moving 95–120 px/s to
screen-right. Its speed decays (time constant 0.55 s) into a steady 40 px/s
breeze toward the farmhouse. The path dips slightly, then rises, with a small
sideways wobble. Radius grows from about 3 px to 25–35 px (∝ √age). Over the
last 40% of its 6 s life each puff shrinks to nothing; puffs pop away rather
than fade. Each puff is off-white with a 2.4 px ink outline around the whole
cloud and a faint inner shading arc, at 86% opacity. The plume travels about
260 px, from the mouth (~x 375) to above the farm (~x 640).

**Cigarette wisp:** a ribbon of points from the lit end rising 30 px/s and
leaning right with the breeze. A sideways wobble grows from 1.5 to 18 px. It is
1.8 px wide at the tip and 4.8 px at the top, and fades over 2.8 s. It is
suppressed wherever the lit end moved more than 3 px in a drawing.

Because each puff's age is taken modulo 9.5 s and every cycle (breath, wind,
windmill, window flicker) divides 9.5 s, frame 228 matches frame 0 exactly.

---

## Clip 1: Mickey Mouse, *Steamboat Willie* (1928) design

- **Design:** black rubber-hose body with a pear-shaped torso. Bare black hands, **no gloves.** Two round black ears. Black head with a pale face mask: rounded muzzle, long snout, large black oval nose at the tip. Tall black **pie-cut eyes**, each with a white wedge. Dark shorts with two white buttons. Long whip-thin tail curling on the ground behind. Plain grey oval shoes. No modern colour model (no red shorts, no yellow shoes).
- **Pose:** weight slightly on the back foot. The left hand is on the hip with the elbow flared back. The cigarette is in the right hand at hip height.
- **Smoke:** cigarette. The plume leaves from under the snout.
- **Personal touch:** a broad, easy smile at rest that tightens around the cigarette at the mouth. The tail tip flicks with the breeze.

## Clip 2: Oswald the Lucky Rabbit (1927 design)

- **Design:** black body and head. Two **long upright ears** that sway a few degrees in the wind and pivot at the base. White face mask with a short muzzle, small black nose and a little white buck tooth. White eyes with black pupils. Plain grey shorts with no buttons. Small white cotton tail. Big bare black feet.
- **Pose:** the same as Mickey: hand on hip, cigarette low.
- **Smoke:** cigarette.
- **Personal touch:** the ears lag the head on the drag and exhale, so the follow-through reads.

## Clip 3: Felix the Cat (silent-era 1920s design)

- **Design:** all-black, lean, no clothes. Big head with **pointed triangular ears**. White muzzle patch. Large white eyes with black pupils, small black nose, three whiskers. A long tail that rises in an S-curve behind him with a kink at the tip and sways in the breeze.
- **Pose:** the far hand is tucked **behind the back** (Felix's thinking-walk posture). The cigarette is in the near hand at hip height.
- **Smoke:** cigarette.
- **Personal touch:** the heavy-lidded drag eyes read especially well on the all-black head.

## Clip 4: Popeye, 1929 *Thimble Theatre* comic-strip design

- **Design:** taken from the 1929 newspaper strip, not the 1933 cartoons. Small white sailor cap. Big bulbous nose. Heavy jutting jaw. **One eye screwed shut**, the other a small bead. A **corncob pipe** jutting from the corner of the mouth. Dark shirt with a white square sailor collar and a white V front. Thin upper arms with heavier forearms (no tattoos). Belt. Light bell-bottom trousers. Big black boots. **No spinach, no anchor tattoos, no 1930s animated-model features.**
- **Pose:** the far fist is on the hip. The near arm hangs relaxed with a loose fist.
- **Smoke:** the pipe stays clenched in his teeth the whole time. On the Raise beat the near hand comes up to cradle the pipe bowl. On the Drag the bowl glows. The exhale leaves from the *other* corner of the mouth. The pipe bowl sends up the continuous wisp.
- **Personal touch:** the pipe tilts with the head, and the exhale comes out the side of the mouth.

## Clip 5: Koko the Clown (silent *Out of the Inkwell* design)

- **Design:** baggy white clown suit with **three big black pompom buttons** down the front. Scalloped white ruff collar. Small white cone hat with a black pompom, tipped back and nodding in the wind. Round white face with a dark tuft of hair at the back, white eyes with black pupils, arched brows, a small round dark nose and a wide smile. White gloves on rubber-hose sleeves. Black slippers with curled toes.
- **Pose:** one gloved hand on the hip, the cigarette held low in the other.
- **Smoke:** cigarette.
- **Personal touch:** the baggy suit squashes and stretches the most of the cast, so the breathing is very visible.

## Clip 6: Betty, *Dizzy Dishes* (1930) original dog design

- **Design:** the original **anthropomorphic dog** singer, *not* the later all-human flapper. Large round white head with **long floppy black dog ears** hanging down behind the face. A short dog muzzle with a black button nose. Big white eyes with black pupils and lashes. Small dark lips. Three black curls on top and a spit-curl on the forehead. Slim white rubber-hose arms and legs. Short strapless black dress with a scalloped flared hem that moves in the breeze. A garter on the front leg. Small black heels.
- **Pose:** the far hand is on the hip. The near hand is held up at shoulder height with a **long black cigarette holder** pointing skyward.
- **Smoke:** the holder swings level to the lips for the drag. The wisp rises from the far end of the holder.
- **Personal touch:** the ears swing and the hem ripples. She closes the compilation and dissolves back into Mickey, so the file loops.

---

## Edit order and timing

Output file: `out/hilltop-dusk.mp4` (colour) / `out/hilltop-dusk-bw.mp4` (black and white).
The individual seamless loops are in `out/clips/`.

| # | Clip | Source file | In (output) | Out (output) | Transition out |
|---|---|---|---|---|---|
| 1 | Mickey (1928) | `clips/01-mickey-1928.mp4`, from 0.5 s in | 00:00.00 | 00:09.00 | 0.5 s dissolve (08.50–09.00) |
| 2 | Oswald (1927) | `clips/02-oswald-1927.mp4` | 00:08.50 | 00:18.00 | 0.5 s dissolve (17.50–18.00) |
| 3 | Felix (silent) | `clips/03-felix-silent.mp4` | 00:17.50 | 00:27.00 | 0.5 s dissolve (26.50–27.00) |
| 4 | Popeye (1929 strip) | `clips/04-popeye-1929.mp4` | 00:26.50 | 00:36.00 | 0.5 s dissolve (35.50–36.00) |
| 5 | Koko (silent) | `clips/05-koko-silent.mp4` | 00:35.50 | 00:45.00 | 0.5 s dissolve (44.50–45.00) |
| 6 | Betty (1930) | `clips/06-betty-1930.mp4` | 00:44.50 | 00:54.00 | 0.5 s dissolve into Mickey's frame 0 (53.50–54.00), then loop |

**To rebuild in any editor:** lay the six 9.5 s clips end to end, each one
overlapping the previous by 0.5 s with a linear cross-dissolve. Trim the first
0.5 s off clip 1. Dissolve the last 0.5 s of clip 6 into the first 0.5 s of
clip 1. Every clip starts and ends on the same idle pose and uses the same set,
so each dissolve looks like one character becoming the next in place. Add grain
and flicker over the whole timeline, not per clip.

## Text-to-video prompt template (for regenerating a clip in another tool)

> 1920s silent-era rubber-hose cartoon, hand-inked black-and-off-white
> character, limited early colour background, grainy flickering film, 4:3,
> locked-off medium-wide shot from slightly low. **[CHARACTER DESCRIPTION FROM
> ABOVE]** stands alone on a grassy hilltop at dusk, in three-quarter view
> facing right, one hand on hip. Below in the valley: a small farmhouse with
> warm glowing windows, a lattice-tower farm windmill turning slowly, a lone
> round tree and a fence. Purple-to-orange sky, low setting sun, long flat
> clouds. Tall dark grass and rocks in the foreground sway gently. The
> character slowly raises a **[cigarette / pipe / long cigarette holder]**,
> takes a long drag (body stretches up, eyes half-close, ember glows), lowers
> it, then exhales a string of outlined white cartoon smoke puffs that drift
> right toward the farmhouse while the body squashes and settles. Then quiet
> breathing and a slow head turn toward the farm. Simple cycle animation on
> twos, exaggerated squash and stretch, no dialogue, no text, no logos.
> Seamless 9.5-second loop.

## Optional alternate: Minnie Mouse (*Steamboat Willie*, 1928)

Minnie is not rendered here. To add her, use Mickey's build with these changes:
a short skirt flaring out from the waist, showing bloomers; a small flat hat
with a single flower; eyelashes on the pie-cut eyes; bare black hands; small
heeled shoes. Swap her in for any clip, or add her as clip 7 (+9 s, 63 s total).

## Notes on public-domain versions

Each design above follows the earliest public-domain version: *Steamboat Willie*
(1928, US public domain since 2024), Oswald's 1927 shorts (since 2023), Felix's
1920s silent shorts, Popeye's January 1929 *Thimble Theatre* debut (since 2025),
Koko's silent *Out of the Inkwell* shorts, and *Dizzy Dishes* (1930, since
2026). All artwork is drawn from scratch by `render.py`. The film carries **no
names, titles, logos or studio credits**. Trademark rights in some of these
characters still exist apart from copyright. If you distribute the film, don't
use the character names or likenesses in titles, thumbnails or marketing in a
way that suggests the film comes from or is endorsed by the rights holders.
This is general information, not legal advice.
