import { T } from '../game/tiles';
import { LevelBuilder } from './builder';

/**
 * Level 2: PALM WALK AFTER DARK — night campus with the Fieldhouse as the anchor.
 * Introduces raised walkways, moving platforms, prickly hoppers, the lasso, the lantern
 * and dark alcoves, foam launchers, retracting spikes, and a secret book room behind an
 * orange service door.
 */
export function level2() {
  const b = new LevelBuilder(1, 'Palm Walk After Dark', 'Night falls on the palm walk', 'night', 'night', 276);
  b.backdrop(0, 'night');
  b.zone(0, 239, 'night');
  b.zone(243, 275, 'secret');
  b.ground(0, 239);
  b.spawn(3);

  // --- Start -------------------------------------------------------------------
  b.decor('lamp', 2, 12).decor('palm', 6, 12, 1.1).decor('lamp', 12, 12);
  b.sign(5, 12, 'Orange trim marks every ledge you can land on.', 'move');
  b.balls(8, 11, 11);

  // --- Raised walkways -----------------------------------------------------------
  b.walk(14, 24, 10);
  b.walk(26, 33, 8);
  b.enemy('bot', 20, 10, { ledgeAware: true });
  b.balls(27, 32, 7);
  b.crate(18, 6, 'ball', 4);
  b.decor('palm', 16, 12).decor('lamp', 29, 12);

  // --- Moving platforms over the reflecting pool --------------------------------
  b.sign(35, 12, 'Ride the moving platforms across.', 'platform');
  b.clear(38, 12, 53, 14);
  b.platform(38, 11, 2, 4, 0, 3.6);
  b.platform(46, 10, 2, 5, 0, 3.6, 1.8);
  b.arc(40, 44, 9, 1.5).arc(47, 52, 8, 1.5);

  // --- Prickly hoppers and the lasso ----------------------------------------------
  b.sign(56, 12, "Prickly hoppers can't be stomped. Hop past them!", 'cactus');
  b.crate(60, 8, 'lasso');
  b.sign(62, 12, 'Lasso: press C (or the rope button). It stuns hoppers.', 'lasso');
  b.enemy('cactus', 68).enemy('cactus', 73);
  b.balls(64, 65, 11);
  b.decor('palm', 70, 12, 1.05);

  // --- Lantern and the dark alcove ----------------------------------------------------
  b.fill(77, 11, 77, 11, T.STONE);
  b.item('lantern', 77, 10);
  b.sign(75, 12, 'The lantern lights dark spots and reveals hidden things.', 'lantern');
  b.fill(80, 0, 101, 3, T.BRICK); // alcove ceiling
  b.dark(80, 3, 101, 14);
  for (let x = 82; x <= 84; x++) b.ball(x, 10, { lanternHidden: true });
  b.fill(87, 10, 87, 11, T.STONE);
  b.hidden(90, 8, 'ball');
  b.fill(92, 7, 95, 7, T.BRICK); // nook ledge
  b.item('emblem', 94, 5); // E1
  b.ball(93, 6, { lanternHidden: true }).ball(95, 6, { lanternHidden: true });
  b.enemy('bot', 97);
  b.decor('lantern', 100, 12);

  // --- Checkpoint, vertical lift and the service door -------------------------------------
  b.checkpoint(104);
  b.platform(108, 11, 2, 0, -6, 4.2);
  b.walk(110, 119, 5);
  b.door(116, 5, 'svc', 'room');
  b.balls(111, 114, 4);
  b.sign(112, 5, 'Orange service door: press ↑ (or W) to go in.', 'door');
  b.enemy('bot', 115);
  b.crate(113, 8, 'ball', 5);
  b.decor('lamp', 120, 12);

  // --- Foam launcher ----------------------------------------------------------------------
  b.sign(123, 12, 'Foam launchers glow before they fire. Jump the foam!', 'turret');
  b.fill(127, 10, 127, 11, T.STONE);
  b.enemy('turret', 133);
  b.balls(129, 131, 9);

  // --- Retracting spikes, then spikes with a hopper --------------------------------------
  b.sign(137, 12, 'Cactus spikes wiggle, then pop up. Cross when they drop.', 'spikes');
  b.spikes(141, 12, 2, 0);
  b.spikes(146, 12, 2, 1.7);
  b.crate(150, 8, 'hat');
  b.enemy('cactus', 156);
  b.spikes(160, 12, 1, 0.8);
  b.decor('palm', 152, 12, 1.1);

  // --- Checkpoint 2 and the high walk (E2) -------------------------------------------------
  b.checkpoint(166);
  b.walk(170, 176, 10);
  b.walk(178, 184, 8);
  b.walk(186, 191, 6);
  b.item('emblem', 190, 3); // E2
  b.balls(186, 189, 5);
  b.enemy('bot', 180, 8, { ledgeAware: true });
  b.enemy('bot', 182).enemy('cactus', 189);
  b.crate(176, 6, 'star');

  // --- Final stretch: platforms over a pool, then a hidden E3 nook --------------------------
  b.clear(195, 12, 206, 14);
  b.platform(196, 10, 2, 0, -3, 2.8);
  b.platform(200, 8, 2, 4, 0, 3.2, 0.8);
  b.walk(201, 203, 11); // low safety ledge
  b.enemy('turret', 214);
  b.fill(209, 10, 210, 11, T.STONE);
  b.hidden(220, 8, 'star');
  b.fill(222, 9, 224, 9, T.BRICK);
  b.item('emblem', 223, 7); // E3
  b.stool(221, 11);
  b.enemy('bot', 226).enemy('weed', 231);
  b.decor('palm', 218, 12, 1.1).decor('lamp', 228, 12);

  // --- Finish: the palm gate ----------------------------------------------------------------
  b.finish(235, 12, 'gate');
  b.fill(239, 0, 239, 11, T.BRICK);

  // --- Secret book room (separate camera zone) -------------------------------------------
  b.ground(243, 275, 12, T.BRICK);
  b.fill(243, 0, 243, 11, T.BRICK);
  b.fill(275, 0, 275, 11, T.BRICK);
  b.fill(244, 0, 274, 4, T.BRICK);
  b.door(246, 12, 'room', 'svc');
  b.sign(249, 12, 'A quiet storage room full of campus history...', 'book');
  b.fill(253, 10, 254, 11, T.STONE);
  b.walk(257, 260, 9);
  b.fill(263, 8, 264, 11, T.STONE);
  b.item('book', 264, 6);
  b.walk(267, 271, 9);
  b.item('hand2', 270, 7);
  for (let x = 250; x <= 272; x += 2) b.ball(x, 11);
  b.decor('lantern', 247, 12).decor('lantern', 273, 12).decor('stoolstack', 266, 12);
  return b.build();
}
