// Contestant portraits: flat illustrated busts drawn as SVG, or a cropped photo.
// The defaults are drawn from John and Lex's own photos: skin tones averaged
// across sunlit and indoor shots, John's lined-up cut and full trimmed beard,
// Lex's sleek pulled-back hair with curls at the back, and both big smiles.

export type HairStyle =
  | 'lineup'
  | 'short'
  | 'fade'
  | 'waves'
  | 'bald'
  | 'sleek'
  | 'long'
  | 'bob'
  | 'curly'
  | 'afro'
  | 'bun'
  | 'ponytail'
  | 'locs'
  | 'pixie';
export type FacialHair = 'none' | 'stubble' | 'trimmed' | 'goatee' | 'full';
export type Outfit = 'tee' | 'polo' | 'halter';
export type Jewelry = 'none' | 'chain' | 'pendant';
export type Jaw = 'square' | 'long' | 'soft';
export type Mood = 'neutral' | 'happy' | 'sad' | 'wow';

export interface AvatarConfig {
  mode: 'art' | 'photo';
  skin: string;
  hair: HairStyle;
  hairColor: string;
  facial: FacialHair;
  glasses: boolean;
  shirt: string;
  jaw: Jaw;
  outfit: Outfit;
  jewelry: Jewelry;
  earrings: boolean;
  lashes: boolean;
  /** Square JPEG data URL, already cropped. */
  photo?: string;
}

export const SKIN_TONES = ['#f3d0b4', '#e2b38f', '#d39b72', '#bd8158', '#a56a45', '#8a5536', '#6a3f27', '#4b2b1c'];
export const HAIR_COLORS = ['#141010', '#2c1b12', '#4a2c1a', '#7a4a26', '#b07a3e', '#d9b36b', '#8f8f94', '#e8e4dc', '#7d2e3c'];
export const SHIRT_COLORS = ['#efe7d6', '#141218', '#6e7a2e', '#22314f', '#7b2d5e', '#155e63', '#8e3b2a', '#c8a045'];
export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'lineup', label: 'Line-up' },
  { id: 'short', label: 'Short' },
  { id: 'fade', label: 'Fade' },
  { id: 'waves', label: 'Waves' },
  { id: 'bald', label: 'Bald' },
  { id: 'sleek', label: 'Sleek + curls' },
  { id: 'pixie', label: 'Pixie' },
  { id: 'bob', label: 'Bob' },
  { id: 'long', label: 'Long' },
  { id: 'curly', label: 'Curly' },
  { id: 'afro', label: 'Afro' },
  { id: 'bun', label: 'Bun' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'locs', label: 'Locs' },
];
export const FACIAL: { id: FacialHair; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'trimmed', label: 'Trimmed beard' },
  { id: 'goatee', label: 'Goatee' },
  { id: 'full', label: 'Full beard' },
];
export const OUTFITS: { id: Outfit; label: string }[] = [
  { id: 'polo', label: 'Knit polo' },
  { id: 'tee', label: 'T-shirt' },
  { id: 'halter', label: 'Halter top' },
];
export const JEWELRY: { id: Jewelry; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'chain', label: 'Gold chain' },
  { id: 'pendant', label: 'Pendant' },
];
export const JAWS: { id: Jaw; label: string }[] = [
  { id: 'long', label: 'Long' },
  { id: 'square', label: 'Square' },
  { id: 'soft', label: 'Soft' },
];

/** From the photos: John in a cream knit polo and gold chain, Lex in a black halter with a pendant. */
export const DEFAULT_AVATARS: [AvatarConfig, AvatarConfig] = [
  {
    mode: 'art',
    skin: '#8a5536',
    hair: 'lineup',
    hairColor: '#141010',
    facial: 'trimmed',
    glasses: false,
    shirt: '#efe7d6',
    jaw: 'long',
    outfit: 'polo',
    jewelry: 'chain',
    earrings: false,
    lashes: false,
  },
  {
    mode: 'art',
    skin: '#bd8158',
    hair: 'sleek',
    hairColor: '#17110e',
    facial: 'none',
    glasses: false,
    shirt: '#141218',
    jaw: 'soft',
    outfit: 'halter',
    jewelry: 'pendant',
    earrings: true,
    lashes: true,
  },
];

/** Fills in fields added after a portrait was saved. */
export const normalizeAvatar = (pid: 0 | 1, cfg: Partial<AvatarConfig> | undefined): AvatarConfig => ({ ...DEFAULT_AVATARS[pid], ...(cfg ?? {}) });

export const PLAYER_COLORS = ['#ff5747', '#3f8cff'] as const;
export const PLAYER_DARK = ['#a4231a', '#1b4fb0'] as const;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

let uid = 0;

function hairBack(style: HairStyle, c: string): string {
  switch (style) {
    case 'long':
      return `<path fill="${c}" d="M33 48C32 25 46 16 60 16s28 9 27 32c1 18 3 36 6 52-12 6-54 6-66 0 3-16 5-34 6-52z"/>`;
    case 'bob':
      return `<path fill="${c}" d="M33 48C32 25 46 16 60 16s28 9 27 32c1 12 1 24-1 33-6 3-12 1-14-3H48c-2 4-8 6-14 3-2-9-2-21-1-33z"/>`;
    case 'sleek': {
      // A curly ponytail gathered low at the back, peeking out behind her right side.
      let out = `<path d="M71 30c9 3 15 10 16 20 1 6-1 11-4 14l-8-6z"/>`;
      const curls: [number, number, number][] = [
        [84, 44, 5.5], [89, 50, 5.2], [86.5, 57, 5.6], [91, 60, 4.6], [84.5, 64, 5], [89, 68, 4.4], [85.5, 72, 3.8], [92, 54, 3.6], [81.5, 70.5, 3.4],
      ];
      for (const [x, y, r] of curls) out += `<circle cx="${x}" cy="${y}" r="${r}"/>`;
      const shine = shade(c, 0.35);
      let rings = '';
      for (const [x, y, r] of curls.slice(0, 6)) rings += `<path d="M${x - r * 0.55} ${y - r * 0.1}a${r * 0.6} ${r * 0.6} 0 0 1 ${r * 1.1} 0"/>`;
      return `<g fill="${c}">${out}</g><g fill="none" stroke="${shine}" stroke-width=".7" opacity=".7">${rings}</g>`;
    }
    case 'curly': {
      let out = '';
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI * (0.95 + (i / 16) * 1.1);
        const r = i % 2 ? 8 : 9.5;
        out += `<circle cx="${(60 + Math.cos(a) * 28).toFixed(1)}" cy="${(48 + Math.sin(a) * 27).toFixed(1)}" r="${r}"/>`;
      }
      for (const [x, y] of [[33, 66], [87, 66], [31, 80], [89, 80], [35, 92], [85, 92]]) out += `<circle cx="${x}" cy="${y}" r="8.5"/>`;
      return `<g fill="${c}">${out}</g>`;
    }
    case 'afro': {
      let out = `<ellipse cx="60" cy="42" rx="34" ry="30"/>`;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        out += `<circle cx="${(60 + Math.cos(a) * 31).toFixed(1)}" cy="${(42 + Math.sin(a) * 27).toFixed(1)}" r="7"/>`;
      }
      return `<g fill="${c}">${out}</g>`;
    }
    case 'locs': {
      let out = `<path d="M34 48C33 25 46 17 60 17s27 8 26 31v8H34z"/>`;
      for (let i = 0; i < 9; i++) {
        const x = 31 + i * 7.2;
        const len = 46 + (i % 3) * 6;
        out += `<rect x="${x.toFixed(1)}" y="40" width="5.6" height="${len}" rx="2.8"/>`;
      }
      return `<g fill="${c}">${out}</g>`;
    }
    case 'ponytail':
      return `<path fill="${c}" d="M80 34c10 4 14 16 12 30-1 10-4 20-9 26 1-10 0-20-4-28z"/>`;
    case 'bun':
      return `<circle fill="${c}" cx="60" cy="17" r="10"/>`;
    default:
      return '';
  }
}

function hairFront(style: HairStyle, c: string): string {
  const hi = shade(c, 0.18);
  switch (style) {
    case 'lineup':
      // Short, dense top with a crisp straight hairline and sharp temple corners.
      return `<path fill="${c}" d="M38.2 47C37.6 32 45.5 21 60 20.5S82.4 32 81.8 47h-1c-.6-3.6-1.8-6.6-3.6-8.6L74.5 34c-4-.9-9-1.3-14.5-1.3s-10.5.4-14.5 1.3l-2.7 4.4c-1.8 2-3 5-3.6 8.6z"/><path fill="${c}" d="M38.3 47l.3 9h1.7l-.1-9.6zM81.7 47l-.3 9h-1.7l.1-9.6z"/><g fill="${hi}" opacity=".35">${[[47, 27], [53, 24.5], [60, 23.5], [67, 24.5], [73, 27], [44, 31], [50, 29], [57, 27.5], [63, 27.5], [70, 29], [76, 31], [55, 31], [65, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7"/>`).join('')}</g>`;
    case 'short':
      return `<path fill="${c}" d="M37.5 51C36 30 46.5 21.5 60 21.5S84 30 82.5 51c-.6-6-2.5-11.5-5.5-14.6-5.5-2.6-11-3.4-17-3.4s-11.5.8-17 3.4C40 39.5 38.1 45 37.5 51z"/><path fill="${c}" d="M37.6 50l.5 7h2.6l-.2-10zM82.4 50l-.5 7h-2.6l.2-10z"/><path fill="none" stroke="${hi}" stroke-width=".7" opacity=".55" d="M45 27c4-2 10-3 15-3s11 1 15 3"/>`;
    case 'fade':
      return `<path fill="${c}" d="M39 46c0-14 9.5-22 21-22s21 8 21 22c-1.6-4.4-3.6-7.6-6-9.2-4.5-1.8-9.5-2.4-15-2.4s-10.5.6-15 2.4c-2.4 1.6-4.4 4.8-6 9.2z"/><path fill="${c}" opacity=".45" d="M38.2 46c-.4 4 0 8 .6 11h2l-.4-12zM81.8 46c.4 4 0 8-.6 11h-2l.4-12z"/>`;
    case 'waves':
      return `<path fill="${c}" d="M37.5 51C36 30 46.5 21.5 60 21.5S84 30 82.5 51c-.6-6-2.5-11.5-5.5-14.6-5.5-2.6-11-3.4-17-3.4s-11.5.8-17 3.4C40 39.5 38.1 45 37.5 51z"/><g fill="none" stroke="${hi}" stroke-width=".9" opacity=".6"><path d="M44 30q4-2 8 0t8 0 8 0 8 0"/><path d="M42 34.5q4.5-2 9 0t9 0 9 0 9 0"/></g>`;
    case 'bald':
      return `<ellipse cx="53" cy="31" rx="7" ry="3" fill="#fff" opacity=".12"/>`;
    case 'sleek':
      // Slicked straight back from a smooth hairline.
      return `<path fill="${c}" d="M38 53C36 32 46 20.5 60 20.5S84 32 82 53c-1.4-9.5-5-16.6-11-20.2-3.4-2-7-2.8-11-2.8s-7.6.8-11 2.8c-6 3.6-9.6 10.7-11 20.2z"/><g fill="none" stroke="${shade(c, 0.3)}" stroke-width=".8" opacity=".55"><path d="M48 27.5c4-2.4 8-3.2 12-3.2"/><path d="M45 31c2-1.6 4-2.6 6.5-3.2"/><path d="M66 24.6c4 .6 7.4 2.4 10 5"/></g><path fill="none" stroke="${c}" stroke-width="1" opacity=".55" d="M39.6 50c-.6 2-.4 4 .2 6M80.4 50c.6 2 .4 4-.2 6"/>`;
    case 'pixie':
      return `<path fill="${c}" d="M37 52C35 29 47 20 61 20c13 0 23 9 22 28-3-7-7-11-12-13-6 4-15 6-22 6-5 0-9 3-12 11z"/>`;
    case 'long':
    case 'bob':
    case 'ponytail':
      return `<path fill="${c}" d="M37 54C35 30 47 20 60 20c14 0 25 10 23 34-3-12-9-19-19-22-6 5-15 8-22 9-3 3-4.5 7-5 13z"/>`;
    case 'bun':
      return `<path fill="${c}" d="M37.5 50C36.5 31 47 22 60 22s23.5 9 22.5 28c-2.5-8-7-13-12-14.5-3.5-1-7-1.5-10.5-1.5s-7 .5-10.5 1.5C44.5 37 40 42 37.5 50z"/>`;
    case 'curly':
      return `<g fill="${c}"><circle cx="45" cy="32" r="8"/><circle cx="55" cy="28" r="8.5"/><circle cx="66" cy="28.5" r="8.5"/><circle cx="76" cy="33" r="8"/><circle cx="40" cy="41" r="6.5"/><circle cx="80" cy="41" r="6.5"/></g>`;
    case 'afro':
      return `<path fill="${c}" d="M38 50c-1-14 8-22 22-22s23 8 22 22c-3-7-10-11-22-11s-19 4-22 11z"/>`;
    case 'locs':
      return `<path fill="${c}" d="M37 52c-1-18 9-28 23-28s24 10 23 28c-3-9-8-14-14-15-3 2-6 3-9 3s-6-1-9-3c-6 1-11 6-14 15z"/>`;
  }
}

function facialHair(kind: FacialHair, c: string, jaw: Jaw): string {
  const t = jaw === 'long' ? ' transform="translate(0 1.4)"' : '';
  // Trimmed beard: a clean cheek line from the sideburns, open around the mouth, full at the chin.
  const beard =
    'M38.8 55c0 15 3.2 25 9.2 30 4 3 8 4 12 4s8-1 12-4c6-5 9.2-15 9.2-30h-2c-.6 5-1.8 9.5-4.4 14-2.2 3.4-4.2 5-5.4 5.4-2.4 2.6-5.4 4.2-9.4 4.2s-7-1.6-9.4-4.2c-1.2-.4-3.2-2-5.4-5.4-2.6-4.5-3.8-9-4.4-14z';
  const stache =
    'M49.4 72c.2-2.6 2.6-4.8 5.8-5.2 2.2-.2 3.8.2 4.8.8 1-.6 2.6-1 4.8-.8 3.2.4 5.6 2.6 5.8 5.2-1-1.6-2.2-2.4-3.8-2.8-2.4-.6-4.8-.4-6.8 0-2-.4-4.4-.6-6.8 0-1.6.4-2.8 1.2-3.8 2.8z';
  switch (kind) {
    case 'none':
      return '';
    case 'stubble':
      return `<g fill="${c}" opacity=".38"${t}><path d="${beard}"/><path d="${stache}"/></g>`;
    case 'trimmed': {
      // Softer than the hair, with a fuzzy edge and a little texture, so it reads as a groomed beard.
      const b = shade(c, 0.05);
      let dots = '';
      for (const [x, y] of [[42, 64], [44, 72], [48, 79], [53, 83], [60, 85], [67, 83], [72, 79], [76, 72], [78, 64], [46, 76], [74, 76], [56, 81], [64, 81]]) dots += `<circle cx="${x}" cy="${y}" r=".6"/>`;
      return `<g fill="${b}" stroke="${b}" stroke-width="1.1" stroke-opacity=".35" stroke-linejoin="round"${t}><path d="${beard}"/><path d="${stache}"/></g><g fill="${shade(c, 0.35)}" opacity=".3"${t}>${dots}</g>`;
    }
    case 'goatee':
      return `<g fill="${c}"${t}><path d="M52 77.5c2 2.6 5 3.6 8 3.6s6-1 8-3.6c-1.6 5-4.4 8-8 8s-6.4-3-8-8z"/><path d="${stache}"/></g>`;
    case 'full':
      return `<g fill="${c}"${t}><path d="M37.5 50c-1 18 3 31 10.5 36.5 4 3 8 5 12 5s8-2 12-5c7.5-5.5 11.5-18.5 10.5-36.5h-2.5c-.5 10-2.5 15-7.5 19-3 2.4-5 7.8-12.5 8.3-7.5-.5-9.5-5.9-12.5-8.3-5-4-7-9-7.5-19z"/><path d="M49.5 70c2.5-4 7-4.4 10.5-3 3.5-1.4 8-1 10.5 3-3.5-1-7-.9-10.5-.3-3.5-.6-7-.7-10.5.3z"/></g>`;
  }
}

function mouth(mood: Mood, lips: string, lipFill: string | null): string {
  switch (mood) {
    case 'sad':
      return `<path fill="none" stroke="${lipFill ?? lips}" stroke-width="2.2" stroke-linecap="round" d="M53.5 74.5q6.5-5 13 0"/>`;
    case 'wow':
      return `<ellipse cx="60" cy="72.8" rx="3.6" ry="4.4" fill="#4a1717"${lipFill ? ` stroke="${lipFill}" stroke-width="1.6"` : ''}/>`;
    case 'happy':
      // The widest grin, for solves and wins.
      return `<path fill="#4a1717" d="M50.8 69.4q9.2 2.6 18.4 0-2.4 10.6-9.2 10.6t-9.2-10.6z"/><path fill="#fff" d="M52 70q8 2.4 16 0l-.6 2.6q-7.4 2.1-14.8 0z"/><path fill="#f3e9e6" d="M55 77.4q5 1.6 10 0-2 1.8-5 1.8t-5-1.8z"/>${lipFill ? `<path fill="none" stroke="${lipFill}" stroke-width="1.5" stroke-linejoin="round" d="M50.6 69.3q9.4 2.5 18.8 0-2.4 10.9-9.4 10.9t-9.4-10.9z"/>` : ''}`;
    default:
      // Their everyday smile shows teeth.
      return `<path fill="#4a1717" d="M51.6 69.8q8.4 2.2 16.8 0-2.6 8.2-8.4 8.2t-8.4-8.2z"/><path fill="#fff" d="M52.8 70.3q7.2 2 14.4 0l-.7 2.3q-6.5 1.8-13 0z"/>${lipFill ? `<path fill="none" stroke="${lipFill}" stroke-width="1.5" stroke-linejoin="round" d="M51.4 69.7q8.6 2.2 17.2 0-2.6 8.5-8.6 8.5t-8.6-8.5z"/>` : `<path fill="none" stroke="${lips}" stroke-width="1" stroke-linecap="round" d="M50.6 69.4q1 .3 1.6.7M69.4 69.4q-1 .3-1.6.7"/>`}`;
  }
}

function outfitSVG(cfg: AvatarConfig, skin: string, skinDark: string): string {
  const shirt = cfg.shirt;
  const edge = shade(shirt, shirt === '#141218' ? 0.25 : -0.12);
  switch (cfg.outfit) {
    case 'polo': {
      // Open knit polo: a V of skin at the neck, collar points, ribbed texture.
      let ribs = '';
      for (let x = 26; x <= 94; x += 4.5) if (x < 49 || x > 71) ribs += `M${x} 122V${x < 34 || x > 86 ? 108 : 102}`;
      return `<path fill="${shirt}" d="M12 122c2-20 18-29 38-32l10 14 10-14c20 3 36 12 38 32z"/>
<path fill="${skinDark}" d="M50 89.5l10 14.5 10-14.5c-3-1-6.5-1.6-10-1.6s-7 .6-10 1.6z"/>
<path fill="none" stroke="${edge}" stroke-width=".8" opacity=".55" d="${ribs}"/>
<path fill="${shade(shirt, -0.06)}" stroke="${edge}" stroke-width=".9" d="M49.5 89l-7 10.5 10.8 3.2 6.2-.4zM70.5 89l7 10.5-10.8 3.2-6.2-.4z"/>`;
    }
    case 'halter':
      // Bare shoulders and a high halter neck.
      return `<path fill="${skin}" d="M12 122c2-20 18-29 38-32q10 7 20 0c20 3 36 12 38 32z"/>
<path fill="${shade(skin, -0.12)}" opacity=".5" d="M30 98c4 6 6 14 6 24h-4c0-10-1-17-2-24zM90 98c-4 6-6 14-6 24h4c0-10 1-17 2-24z"/>
<path fill="${shirt}" d="M49 86.5q11 4 22 0l2 5c6 9 10 19 11 30.5H36c1-11.5 5-21.5 11-30.5z"/>
<path fill="none" stroke="${shade(shirt, 0.3)}" stroke-width=".8" opacity=".6" d="M49.6 88.6q10.4 3.6 20.8 0"/>`;
    default:
      return `<path fill="${shirt}" d="M12 122c2-20 18-29 38-32q10 8 20 0c20 3 36 12 38 32z"/><path fill="none" stroke="${shade(shirt, 0.25)}" stroke-width="2" d="M50 90l10 11 10-11"/>`;
  }
}

function jewelrySVG(cfg: AvatarConfig): string {
  const gold = '#f0c75e';
  switch (cfg.jewelry) {
    case 'chain':
      return `<path fill="none" stroke="${gold}" stroke-width="1.4" stroke-dasharray="1.6 .7" d="M50.5 85.5q3.5 10.5 9.5 14.5 6-4 9.5-14.5"/>`;
    case 'pendant':
      return `<path fill="none" stroke="${gold}" stroke-width=".9" d="M50 86q4 9.5 10 11.5 6-2 10-11.5"/><circle cx="60" cy="98.6" r="1.9" fill="#fbf6ea" stroke="${gold}" stroke-width=".6"/>`;
    default:
      return '';
  }
}

export function avatarSVG(raw: AvatarConfig, pid: 0 | 1, mood: Mood = 'neutral'): string {
  const cfg = normalizeAvatar(pid, raw);
  const id = `av${pid}x${uid++}`;
  const bg = PLAYER_COLORS[pid];
  const bgDark = PLAYER_DARK[pid];
  const frame = `<defs><radialGradient id="${id}g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${shade(bg, 0.25)}"/><stop offset="1" stop-color="${bgDark}"/></radialGradient><clipPath id="${id}c"><circle cx="60" cy="60" r="60"/></clipPath></defs>`;
  if (cfg.mode === 'photo' && cfg.photo) {
    return `<svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">${frame}<circle cx="60" cy="60" r="60" fill="url(#${id}g)"/><image href="${cfg.photo}" x="0" y="0" width="120" height="120" clip-path="url(#${id}c)" preserveAspectRatio="xMidYMid slice"/></svg>`;
  }
  const skin = cfg.skin;
  const skinDark = shade(skin, -0.2);
  const skinLight = shade(skin, 0.14);
  const lips = shade(skin, -0.42);
  const lipFill = cfg.lashes ? '#b4545f' : null;
  const head =
    cfg.jaw === 'square'
      ? 'M38 50c0-18 10-26 22-26s22 8 22 26c0 14-3 22-8 27-4 4-9 6-14 6s-10-2-14-6c-5-5-8-13-8-27z'
      : cfg.jaw === 'long'
        ? 'M37.8 49c0-18 9.8-26.5 22.2-26.5S82.2 31 82.2 49c0 16-3 25.5-8.2 30.8-4 4-8.8 5.9-14 5.9s-10-1.9-14-5.9c-5.2-5.3-8.2-14.8-8.2-30.8z'
        : 'M39 50c0-18 9-26 21-26s21 8 21 26c0 13-3 21-8 26-4 4-9 6-13 6s-9-2-13-6c-5-5-8-13-8-26z';
  const brow = cfg.hair === 'bald' ? shade(skin, -0.55) : cfg.hairColor;
  const browW = cfg.lashes ? 1.8 : 2.6;
  const happy = mood === 'happy';
  const eyeRy = happy ? 2.3 : 3;
  const glasses = cfg.glasses
    ? `<g fill="none" stroke="#1d1d22" stroke-width="1.6"><rect x="43.5" y="49.5" width="13" height="9.5" rx="3.5"/><rect x="63.5" y="49.5" width="13" height="9.5" rx="3.5"/><path d="M56.5 53.5q3.5-2 7 0M43.5 53l-5-1.5M76.5 53l5-1.5"/></g>`
    : '';
  const lashes = cfg.lashes
    ? `<path fill="none" stroke="#1a1010" stroke-width="1.5" stroke-linecap="round" d="M46 53.4q4.5-3.8 9 0M65 53.4q4.5-3.8 9 0M46 53.4l-1.8-1.1M74 53.4l1.8-1.1"/>`
    : `<path fill="none" stroke="${shade(skin, -0.45)}" stroke-width="1.1" d="M46 53.2q4.5-3.6 9 0M65 53.2q4.5-3.6 9 0"/>`;
  const earrings = cfg.earrings
    ? `<circle cx="38.6" cy="63.6" r="2.3" fill="none" stroke="#f0c75e" stroke-width="1.3"/><circle cx="81.4" cy="63.6" r="2.3" fill="none" stroke="#f0c75e" stroke-width="1.3"/>`
    : '';
  // Smiling cheeks lift a little.
  const cheeks = `<ellipse cx="47" cy="63.5" rx="4.6" ry="3.4" fill="${skinLight}" opacity=".45"/><ellipse cx="73" cy="63.5" rx="4.6" ry="3.4" fill="${skinLight}" opacity=".45"/>${cfg.lashes ? `<circle cx="47" cy="65" r="4" fill="#ff6b6b" opacity=".13"/><circle cx="73" cy="65" r="4" fill="#ff6b6b" opacity=".13"/>` : ''}`;
  return `<svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">${frame}
<g clip-path="url(#${id}c)">
<circle cx="60" cy="60" r="60" fill="url(#${id}g)"/>
<circle cx="60" cy="38" r="40" fill="#fff" opacity=".07"/>
${hairBack(cfg.hair, cfg.hairColor)}
<path fill="${skinDark}" d="M50 72v20q10 6 20 0V72z"/>
${outfitSVG(cfg, skin, skinDark)}
${jewelrySVG(cfg)}
<ellipse cx="38.5" cy="56" rx="4.6" ry="7" fill="${skinDark}"/><ellipse cx="81.5" cy="56" rx="4.6" ry="7" fill="${skinDark}"/>
<path fill="${skin}" d="${head}"/>
<ellipse cx="51" cy="40" rx="9" ry="5" fill="${skinLight}" opacity=".35"/>
${cheeks}
${facialHair(cfg.facial, cfg.hairColor, cfg.jaw)}
<g><ellipse cx="50.5" cy="54.5" rx="4.3" ry="${eyeRy}" fill="#fff"/><ellipse cx="69.5" cy="54.5" rx="4.3" ry="${eyeRy}" fill="#fff"/>
<circle cx="50.8" cy="54.6" r="2.3" fill="#24150d"/><circle cx="69.8" cy="54.6" r="2.3" fill="#24150d"/>
<circle cx="51.6" cy="53.8" r=".75" fill="#fff"/><circle cx="70.6" cy="53.8" r=".75" fill="#fff"/>
${happy ? `<path fill="${skin}" d="M45.5 57.6q5 -2.4 10 0v2h-10zM64.5 57.6q5-2.4 10 0v2h-10z"/>` : ''}
${lashes}</g>
<path fill="none" stroke="${brow}" stroke-width="${browW}" stroke-linecap="round" d="${mood === 'sad' ? 'M45.5 47.5q4.5-.6 9.5-2.6M65 44.9q5 2 9.5 2.6' : 'M45.3 47.4q4.6-3.4 9.8-1.6M64.9 45.8q5.2-1.8 9.8 1.6'}"/>
<path fill="none" stroke="${skinDark}" stroke-width="1.6" stroke-linecap="round" d="M60 56q-1.6 6.5-3.6 8.6 3.6 1.8 7.2 0"/>
${mouth(mood, lips, lipFill)}
${hairFront(cfg.hair, cfg.hairColor)}
${earrings}
${glasses}
</g></svg>`;
}

/** Crop a photo to a square portrait. `zoom` >= 1, offsets in -1..1 of the free space. */
export function cropPhoto(img: HTMLImageElement, zoom: number, ox: number, oy: number, size = 320): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom;
  const sx = (img.naturalWidth - side) / 2 + ((img.naturalWidth - side) / 2) * ox;
  const sy = (img.naturalHeight - side) / 2 + ((img.naturalHeight - side) / 2) * oy;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.86);
}
