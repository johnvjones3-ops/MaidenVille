// Text content: book gallery entries (fictional campus notes and tips) and the item guide.

export interface BookEntry {
  id: string;
  title: string;
  text: string;
  where: string;
}

export const BOOKS: BookEntry[] = [
  {
    id: 'L1-B1',
    title: "Coach's Notebook: Hang Time",
    text: 'Tap jump for a quick hop; hold it for full height. A running start adds lift and distance, so build speed before the big gaps. (A fictional note.)',
    where: 'Fieldhouse Plaza: something twinkles above the brick stairs.',
  },
  {
    id: 'L2-B1',
    title: 'Night Walk Journal',
    text: 'Somebody wrote this in the storage room: "The palm walk lamps were trimmed in orange so you can always find the next ledge. Light a lantern and dotted outlines show hidden crates." (A fictional note.)',
    where: 'Palm Walk After Dark: behind an orange service door.',
  },
  {
    id: 'L3-B1',
    title: 'Rebounder 3000 Manual (Fictional)',
    text: 'Every attack overheats the machine. When the hatch pops open, stomp the glowing green star or lasso it. Its charge passes under the courtside seats.',
    where: 'Pack the Fieldhouse: a lone basketball floats in the concourse...',
  },
];

export interface ItemGuide {
  icon: string;
  name: string;
  text: string;
}

export const ITEM_GUIDE: ItemGuide[] = [
  { icon: 'ball', name: 'Basketball', text: '+100. Every 100 earns an extra life.' },
  { icon: 'emblem', name: 'V Emblem', text: 'Three hidden per level. Found ones stay found.' },
  { icon: 'hand', name: 'V Spirit Hand', text: 'Rare: +1,000. The orange-and-gray hand is rarer: +2,000.' },
  { icon: 'hat', name: 'Cowboy Hat', text: 'Vaquero form: taller, smashes terracotta blocks, survives one hit. Already powered? +1,000.' },
  { icon: 'star', name: 'Green Star', text: 'About 10 s of invincibility. It flashes before it ends. It does not stop pits.' },
  { icon: 'lantern', name: 'Lantern', text: 'Lights dark areas and reveals hidden items and crates nearby for about 20 s.' },
  { icon: 'book', name: 'Orange Book', text: 'Secret. Unlocks a tip or campus note in the Gallery.' },
  { icon: 'lasso', name: 'Lasso', text: '3 throws per pickup (C or the rope button). Defeats bots, stuns prickly hoppers.' },
  { icon: 'palmpot', name: 'Palms & Stools', text: 'Scenery. Only stools with a cushion top are platforms.' },
];
