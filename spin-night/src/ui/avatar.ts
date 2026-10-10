// Contestant portraits: flat illustrated busts drawn as SVG, or a cropped photo.

export type HairStyle =
  | 'short'
  | 'fade'
  | 'waves'
  | 'bald'
  | 'long'
  | 'bob'
  | 'curly'
  | 'afro'
  | 'bun'
  | 'ponytail'
  | 'locs'
  | 'pixie';
export type FacialHair = 'none' | 'stubble' | 'trimmed' | 'goatee' | 'full';
export type Mood = 'neutral' | 'happy' | 'sad' | 'wow';

export interface AvatarConfig {
  mode: 'art' | 'photo';
  skin: string;
  hair: HairStyle;
  hairColor: string;
  facial: FacialHair;
  glasses: boolean;
  shirt: string;
  jaw: 'square' | 'soft';
  /** Square JPEG data URL, already cropped. */
  photo?: string;
}

export const SKIN_TONES = ['#f6d3b8', '#e9b996', '#d39b72', '#b97a51', '#9a5f3c', '#7a4529', '#5e3420', '#45261a'];
export const HAIR_COLORS = ['#141010', '#2c1b12', '#4a2c1a', '#7a4a26', '#b07a3e', '#d9b36b', '#8f8f94', '#e8e4dc', '#7d2e3c'];
export const SHIRT_COLORS = ['#22314f', '#7b2d5e', '#155e63', '#8e3b2a', '#3d3d48', '#c8a045', '#f4f1ea', '#2f6a3a'];
export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'fade', label: 'Fade' },
  { id: 'waves', label: 'Waves' },
  { id: 'bald', label: 'Bald' },
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

/** John: deep brown skin, short black hair, trimmed beard. Lex's look is set in Contestants. */
export const DEFAULT_AVATARS: [AvatarConfig, AvatarConfig] = [
  { mode: 'art', skin: '#5e3420', hair: 'short', hairColor: '#141010', facial: 'trimmed', glasses: false, shirt: '#22314f', jaw: 'square' },
  { mode: 'art', skin: '#b97a51', hair: 'long', hairColor: '#2c1b12', facial: 'none', glasses: false, shirt: '#7b2d5e', jaw: 'soft' },
];

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
    case 'short':
      return `<path fill="${c}" d="M37.5 51C36 30 46.5 21.5 60 21.5S84 30 82.5 51c-.6-6-2.5-11.5-5.5-14.6-5.5-2.6-11-3.4-17-3.4s-11.5.8-17 3.4C40 39.5 38.1 45 37.5 51z"/><path fill="${c}" d="M37.6 50l.5 7h2.6l-.2-10zM82.4 50l-.5 7h-2.6l.2-10z"/><path fill="none" stroke="${hi}" stroke-width=".7" opacity=".55" d="M45 27c4-2 10-3 15-3s11 1 15 3"/>`;
    case 'fade':
      return `<path fill="${c}" d="M39 46c0-14 9.5-22 21-22s21 8 21 22c-1.6-4.4-3.6-7.6-6-9.2-4.5-1.8-9.5-2.4-15-2.4s-10.5.6-15 2.4c-2.4 1.6-4.4 4.8-6 9.2z"/><path fill="${c}" opacity=".45" d="M38.2 46c-.4 4 0 8 .6 11h2l-.4-12zM81.8 46c.4 4 0 8-.6 11h-2l.4-12z"/>`;
    case 'waves':
      return `<path fill="${c}" d="M37.5 51C36 30 46.5 21.5 60 21.5S84 30 82.5 51c-.6-6-2.5-11.5-5.5-14.6-5.5-2.6-11-3.4-17-3.4s-11.5.8-17 3.4C40 39.5 38.1 45 37.5 51z"/><g fill="none" stroke="${hi}" stroke-width=".9" opacity=".6"><path d="M44 30q4-2 8 0t8 0 8 0 8 0"/><path d="M42 34.5q4.5-2 9 0t9 0 9 0 9 0"/></g>`;
    case 'bald':
      return `<ellipse cx="53" cy="31" rx="7" ry="3" fill="#fff" opacity=".12"/>`;
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

function facialHair(kind: FacialHair, c: string): string {
  const beard =
    'M38.5 54c0 14 3.5 23 9.5 27.5 4 3 8 4 12 4s8-1 12-4c6-4.5 9.5-13.5 9.5-27.5h-2c-.5 8-2.5 13-7.5 16.5-3 2-5 6.5-12 7-7-.5-9-5-12-7-5-3.5-7-8.5-7.5-16.5z';
  const stache = 'M50.5 69.5c2.5-3 6.5-3.2 9.5-2.1 3-1.1 7-.9 9.5 2.1-3-.7-6.5-.6-9.5-.1-3-.5-6.5-.6-9.5.1z';
  switch (kind) {
    case 'none':
      return '';
    case 'stubble':
      return `<g fill="${c}" opacity=".38"><path d="${beard}"/><path d="${stache}"/></g>`;
    case 'trimmed':
      return `<g fill="${c}"><path d="${beard}"/><path d="${stache}"/></g>`;
    case 'goatee':
      return `<g fill="${c}"><path d="M52 77.5c2 2.6 5 3.6 8 3.6s6-1 8-3.6c-1.6 5-4.4 8-8 8s-6.4-3-8-8z"/><path d="${stache}"/></g>`;
    case 'full':
      return `<g fill="${c}"><path d="M37.5 50c-1 18 3 31 10.5 36.5 4 3 8 5 12 5s8-2 12-5c7.5-5.5 11.5-18.5 10.5-36.5h-2.5c-.5 10-2.5 15-7.5 19-3 2.4-5 7.8-12.5 8.3-7.5-.5-9.5-5.9-12.5-8.3-5-4-7-9-7.5-19z"/><path d="M49.5 70c2.5-4 7-4.4 10.5-3 3.5-1.4 8-1 10.5 3-3.5-1-7-.9-10.5-.3-3.5-.6-7-.7-10.5.3z"/></g>`;
  }
}

function mouth(mood: Mood, lips: string): string {
  switch (mood) {
    case 'happy':
      return `<path fill="#4a1717" d="M52 70q8 9.5 16 0z"/><path fill="#fff" d="M53.4 70.4q6.6 2.4 13.2 0l-.6 1.4q-6 2.2-12 0z"/>`;
    case 'sad':
      return `<path fill="none" stroke="${lips}" stroke-width="2.1" stroke-linecap="round" d="M53.5 74.5q6.5-5 13 0"/>`;
    case 'wow':
      return `<ellipse cx="60" cy="72.5" rx="3.4" ry="4.2" fill="#4a1717"/>`;
    default:
      return `<path fill="none" stroke="${lips}" stroke-width="2.1" stroke-linecap="round" d="M53 70.5q7 5.5 14 0"/>`;
  }
}

export function avatarSVG(cfg: AvatarConfig, pid: 0 | 1, mood: Mood = 'neutral'): string {
  const id = `av${pid}x${uid++}`;
  const bg = PLAYER_COLORS[pid];
  const bgDark = PLAYER_DARK[pid];
  const frame = `<defs><radialGradient id="${id}g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${shade(bg, 0.25)}"/><stop offset="1" stop-color="${bgDark}"/></radialGradient><clipPath id="${id}c"><circle cx="60" cy="60" r="60"/></clipPath></defs>`;
  if (cfg.mode === 'photo' && cfg.photo) {
    return `<svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">${frame}<circle cx="60" cy="60" r="60" fill="url(#${id}g)"/><image href="${cfg.photo}" x="0" y="0" width="120" height="120" clip-path="url(#${id}c)" preserveAspectRatio="xMidYMid slice"/></svg>`;
  }
  const skin = cfg.skin;
  const skinDark = shade(skin, -0.2);
  const skinLight = shade(skin, 0.12);
  const lips = shade(skin, -0.42);
  const head =
    cfg.jaw === 'square'
      ? 'M38 50c0-18 10-26 22-26s22 8 22 26c0 14-3 22-8 27-4 4-9 6-14 6s-10-2-14-6c-5-5-8-13-8-27z'
      : 'M39 50c0-18 9-26 21-26s21 8 21 26c0 13-3 21-8 26-4 4-9 6-13 6s-9-2-13-6c-5-5-8-13-8-26z';
  const brow = cfg.hair === 'bald' ? shade(skin, -0.55) : cfg.hairColor;
  const glasses = cfg.glasses
    ? `<g fill="none" stroke="#1d1d22" stroke-width="1.6"><rect x="43.5" y="49.5" width="13" height="9.5" rx="3.5"/><rect x="63.5" y="49.5" width="13" height="9.5" rx="3.5"/><path d="M56.5 53.5q3.5-2 7 0M43.5 53l-5-1.5M76.5 53l5-1.5"/></g>`
    : '';
  return `<svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">${frame}
<g clip-path="url(#${id}c)">
<circle cx="60" cy="60" r="60" fill="url(#${id}g)"/>
<circle cx="60" cy="38" r="40" fill="#fff" opacity=".07"/>
${hairBack(cfg.hair, cfg.hairColor)}
<path fill="${skinDark}" d="M50 72v20q10 6 20 0V72z"/>
<path fill="${cfg.shirt}" d="M12 122c2-20 18-29 38-32q10 8 20 0c20 3 36 12 38 32z"/>
<path fill="none" stroke="${shade(cfg.shirt, 0.25)}" stroke-width="2" d="M50 90l10 11 10-11"/>
<ellipse cx="38.5" cy="56" rx="4.6" ry="7" fill="${skinDark}"/><ellipse cx="81.5" cy="56" rx="4.6" ry="7" fill="${skinDark}"/>
<path fill="${skin}" d="${head}"/>
<ellipse cx="51" cy="42" rx="9" ry="5" fill="${skinLight}" opacity=".35"/>
<circle cx="47.5" cy="64" r="4.2" fill="#ff6b6b" opacity=".12"/><circle cx="72.5" cy="64" r="4.2" fill="#ff6b6b" opacity=".12"/>
${facialHair(cfg.facial, cfg.hairColor)}
<g><ellipse cx="50.5" cy="54.5" rx="4.3" ry="3" fill="#fff"/><ellipse cx="69.5" cy="54.5" rx="4.3" ry="3" fill="#fff"/>
<circle cx="50.8" cy="54.6" r="2.3" fill="#24150d"/><circle cx="69.8" cy="54.6" r="2.3" fill="#24150d"/>
<circle cx="51.6" cy="53.8" r=".75" fill="#fff"/><circle cx="70.6" cy="53.8" r=".75" fill="#fff"/>
<path fill="none" stroke="${skinDark}" stroke-width="1" d="M46 53.2q4.5-3.6 9 0M65 53.2q4.5-3.6 9 0"/></g>
<path fill="none" stroke="${brow}" stroke-width="2.3" stroke-linecap="round" d="${mood === 'sad' ? 'M45.5 47.5q4.5-.6 9.5-2.6M65 44.9q5 2 9.5 2.6' : 'M45.5 47.2q4.5-3 9.5-1.4M65 45.8q5-1.6 9.5 1.4'}"/>
<path fill="none" stroke="${skinDark}" stroke-width="1.6" stroke-linecap="round" d="M60 56q-1.6 6.5-3.6 8.6 3.6 1.8 7.2 0"/>
${mouth(mood, lips)}
${hairFront(cfg.hair, cfg.hairColor)}
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
