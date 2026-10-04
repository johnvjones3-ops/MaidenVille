import { TILE } from '../config';
import { T } from '../game/tiles';
import { LevelBuilder } from './builder';

/**
 * Level 3: PACK THE FIELDHOUSE — from the night exterior entrance through a stylized
 * concourse into the arena, ending with the Rebounder 3000 at center court.
 * (The interior is an artistic interpretation, not a depiction of the real building.)
 */
export function level3() {
  const b = new LevelBuilder(2, 'Pack the Fieldhouse', 'Game night at the Fieldhouse', 'arena', 'arena', 200);
  b.backdrop(0, 'exterior');
  b.backdrop(27, 'concourse');
  b.backdrop(100, 'arena');
  b.ground(0, 199);
  b.spawn(3);

  // --- Exterior entrance --------------------------------------------------------------
  b.sign(6, 12, 'The Fieldhouse is packed tonight. Head for center court!', 'move');
  b.decor('palm', 1, 12, 1.1).decor('lamp', 9, 12);
  b.balls(8, 11, 11);
  b.stairs(13, 11, 2, 1, T.STONE);
  b.fill(15, 10, 26, 11, T.STONE);
  b.crate(18, 6, 'hat');
  b.enemy('bot', 22, 10);
  b.decor('palmpot', 16, 10).decor('palmpot', 25, 10);

  // --- Concourse -------------------------------------------------------------------------
  b.fill(27, 0, 99, 2, T.BRICK); // concourse ceiling
  b.fill(27, 10, 27, 11, T.STONE);
  b.breakable(31, 8, 33);
  b.crate(32, 8, 'ball', 5);
  b.sign(30, 12, 'Vaquero form smashes terracotta blocks from below.', 'crate');
  b.enemy('bot', 38).enemy('bot', 41);
  b.sign(44, 12, 'Practice balls bounce you high. They never hurt.', 'bouncer');
  b.bouncer(48, 12, 2.2, 0);
  b.walk(46, 51, 6);
  b.item('emblem', 50, 4); // E1
  b.balls(46, 49, 5);
  b.enemy('turret', 57);
  b.fill(54, 10, 54, 11, T.STONE);
  b.breakable(60, 8, 62).crate(61, 8, 'ball', 4);
  b.checkpoint(65);
  b.enemy('cactus', 71).enemy('cactus', 75);
  b.spikes(79, 12, 2, 0.4);
  b.crate(83, 8, 'lasso');
  b.hidden(86, 8, 'book');
  b.ball(86, 10);
  b.enemy('weed', 94);
  b.crate(90, 8, 'hat');
  b.decor('concession', 36, 12).decor('concession', 68, 12).decor('banner', 88, 12);

  // --- Arena seating ------------------------------------------------------------------
  b.stairs(102, 11, 4, 1, T.STONE);
  b.fill(106, 8, 112, 11, T.STONE);
  b.fill(106, 7, 112, 7, T.SEATS);
  b.clear(113, 12, 118, 14);
  b.walk(114, 117, 10);
  b.stairs(122, 11, 3, -1, T.STONE);
  b.enemy('bot', 108, 7).enemy('turret', 124);
  b.balls(114, 117, 9);
  b.bouncer(129, 12, 3, 0.5);
  b.fill(127, 5, 131, 5, T.SEATS);
  b.item('emblem', 130, 3); // E2
  b.enemy('cactus', 134).enemy('bot', 138);
  b.crate(141, 8, 'star');
  b.enemy('bot', 146).enemy('bot', 149).enemy('cactus', 152);
  b.spikes(156, 12, 2, 0);
  b.fill(160, 9, 163, 11, T.STONE);
  b.fill(160, 8, 163, 8, T.SEATS);
  b.hidden(166, 5, 'hand');
  b.walk(165, 167, 8);
  b.item('emblem', 161, 4); // E3 above the seat block
  b.crate(170, 8, 'hat');
  b.checkpoint(173);
  b.decor('scoreboard', 140, 3).decor('banner', 120, 12).decor('banner', 158, 12);

  // --- Boss arena: hardwood court -------------------------------------------------------
  b.ground(176, 199, 12, T.WOOD);
  b.walk(179, 181, 10);
  b.walk(194, 196, 10);
  b.fill(198, 0, 199, 11, T.BRICK);
  b.boss(188);
  b.arena = { trigger: 180 * TILE, x0: 178 * TILE, x1: 198 * TILE, gateL: 177, gateR: 198 };
  b.decor('hoop', 178.3, 12).decor('hoop', 197.4, 12);
  return b.build();
}
