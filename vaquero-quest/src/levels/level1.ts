import { T } from '../game/tiles';
import { LevelBuilder } from './builder';

/**
 * Level 1: FIELDHOUSE PLAZA — sunset campus exterior.
 * Teaches, in order: move/run, jump, basketballs, crates from below, the hat, the first
 * stomp and the first checkpoint. A low route and a high skill route split mid-level.
 * Ends at the Fieldhouse's orange-lit entrance arch.
 */
export function level1() {
  const b = new LevelBuilder(0, 'Fieldhouse Plaza', 'Sunset on campus', 'plaza', 'plaza', 214);
  b.backdrop(0, 'plaza');
  b.ground(0, 213);
  b.spawn(3);

  // --- Safe start: move and run --------------------------------------------
  b.decor('palm', 1, 12, 1.1).decor('lamp', 8, 12).decor('bench', 11, 12);
  b.sign(5, 12, 'Move with ← → or A D. Hold Shift to run.', 'move');
  b.balls(9, 12, 11);

  // --- First jump over a planter --------------------------------------------
  b.sign(14, 12, 'Jump: Space or Z. Hold it to jump higher.', 'jump');
  b.fill(17, 10, 18, 11, T.PLANTER);
  b.decor('palmpot', 17.5, 10, 0.9);
  b.arc(15, 20, 10, 1.5);

  // --- Crates from below ------------------------------------------------------
  b.sign(22, 12, 'Hit V crates from below!', 'crate');
  b.crate(25, 8, 'ball');
  b.breakable(26, 8);
  b.crate(27, 8, 'ball', 6);
  b.breakable(28, 8);
  b.decor('palm', 30.5, 12);

  // --- The hat ------------------------------------------------------------
  b.sign(32, 12, 'A cowboy hat gives Vaquero form: one extra hit.', 'hat');
  b.crate(35, 8, 'hat');
  b.fill(41, 10, 41, 11, T.STONE); // the hat slides back toward you off this post
  b.decor('lamp', 38, 12);

  // --- First stomp ---------------------------------------------------------
  b.sign(44, 12, 'Stomp Practice Bots from above.', 'bot');
  b.enemy('bot', 50);
  b.balls(46, 47, 11);

  // --- First checkpoint ---------------------------------------------------
  b.checkpoint(55);
  b.decor('banner', 54, 12);
  b.clear(59, 12, 60, 14);
  b.arc(58, 61, 10, 1.5);

  // --- Route split: stools up to a high walkway, or the low road -----------
  b.stool(63, 11).stool(65, 10).stool(67, 9);
  b.walk(69, 83, 7);
  for (let x = 70; x <= 82; x += 2) b.ball(x, 6);
  b.item('emblem', 85, 4); // E1: leap off the walkway's end
  b.crate(74, 8, 'ball', 3).crate(76, 8, 'ball');
  b.enemy('bot', 79).enemy('bot', 85);
  b.decor('palm', 72, 12, 0.9).decor('lamp', 80, 12);

  // --- Tumbleweed ------------------------------------------------------------
  b.sign(89, 12, 'Tumbleweeds shake and kick up dust before they roll.', 'weed');
  b.stool(95, 11).stool(96, 11);
  b.enemy('weed', 106);
  // Hidden block clue: a lone basketball floats right under it, and it twinkles.
  b.ball(101, 10);
  b.hidden(101, 8, 'hand');
  b.hidden(130, 5, 'book'); // twinkles above the brick stairs
  b.decor('palm', 99, 12, 1.05);

  // --- Planter posts over a sunken garden ------------------------------------
  b.clear(108, 12, 119, 14);
  b.fill(111, 11, 111, 14, T.PLANTER);
  b.fill(114, 10, 115, 14, T.PLANTER);
  b.fill(118, 11, 118, 14, T.PLANTER);
  b.arc(108, 111, 10, 1.2).arc(112, 114, 9, 1).arc(116, 118, 9, 1);
  b.decor('palmpot', 114.5, 10, 0.85);

  // --- Checkpoint 2 and the brick skill route ---------------------------------
  b.checkpoint(124);
  b.stairs(128, 11, 4, 1, T.BRICK);
  b.fill(136, 8, 139, 8, T.BRICK); // high ledge across a run-jump gap
  b.item('emblem', 138, 6); // E2
  b.balls(133, 135, 7);
  b.enemy('bot', 137, 12, { ledgeAware: true });
  b.crate(142, 8, 'ball', 3);

  // --- Star and a crowd of bots ----------------------------------------------
  b.sign(145, 12, 'Green Star: about 10 seconds of invincibility.', 'star');
  b.crate(147, 8, 'star');
  b.enemy('bot', 153).enemy('bot', 156).enemy('bot', 159, 12, { dir: 1 });
  b.decor('lamp', 151, 12).decor('palm', 157, 12, 1.1);

  // --- Plaza approach: crates, stools and a balcony for the last emblem ---------
  b.breakable(161, 8).crate(162, 8, 'ball', 8).breakable(163, 8);
  b.stool(166, 10).stool(168, 8);
  b.walk(170, 174, 6);
  b.item('emblem', 174, 4); // E3
  b.balls(170, 173, 5);
  b.enemy('bot', 172);
  b.crate(177, 8, 'hat');
  b.decor('palm', 165, 12).decor('bench', 176, 12);

  // --- Entrance steps and the finish arch ------------------------------------
  b.stairs(181, 11, 2, 1, T.STONE);
  b.fill(183, 10, 213, 11, T.GROUND);
  b.decor('lamp', 185, 10).decor('palmpot', 189, 10);
  b.finish(197, 10, 'arch');
  return b.build();
}
