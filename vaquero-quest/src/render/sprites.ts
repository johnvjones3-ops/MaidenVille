// Icons extracted from the supplied UTRGV icon sheet (upper portion only) by
// scripts/extract-icons.py. Bundled as data URLs so the game works offline / as one file.
import ball from '../assets/icons/ball.webp';
import book from '../assets/icons/book.webp';
import crate from '../assets/icons/crate.webp';
import emblem from '../assets/icons/emblem.webp';
import hand from '../assets/icons/hand.webp';
import hand2 from '../assets/icons/hand2.webp';
import hat from '../assets/icons/hat.webp';
import hatPlain from '../assets/icons/hatPlain.webp';
import lantern from '../assets/icons/lantern.webp';
import lasso from '../assets/icons/lasso.webp';
import palmpot from '../assets/icons/palmpot.webp';
import star from '../assets/icons/star.webp';
import stool from '../assets/icons/stool.webp';

const URLS = { ball, book, crate, emblem, hand, hand2, hat, hatPlain, lantern, lasso, palmpot, star, stool };
export type SpriteName = keyof typeof URLS;

const images = new Map<SpriteName, HTMLImageElement>();
const variants = new Map<string, HTMLCanvasElement>();

/** Loads every sprite; resolves even if some fail (vector fallbacks are used then). */
export function loadSprites(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  return Promise.all(
    (Object.keys(URLS) as SpriteName[]).map(
      (k) =>
        new Promise<void>((res) => {
          const im = new Image();
          im.onload = () => {
            images.set(k, im);
            res();
          };
          im.onerror = () => res();
          im.src = URLS[k];
        }),
    ),
  ).then(() => undefined);
}

export function sprite(name: SpriteName): HTMLImageElement | null {
  return images.get(name) ?? null;
}

/** A tinted copy of a sprite: 'ghost' (dark silhouette) or 'spent' (darkened, for empty crates). */
function variant(name: SpriteName, kind: 'ghost' | 'spent'): HTMLCanvasElement | null {
  const k = `${name}:${kind}`;
  const hit = variants.get(k);
  if (hit) return hit;
  const im = sprite(name);
  if (!im) return null;
  const c = document.createElement('canvas');
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(im, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  if (kind === 'ghost') {
    ctx.fillStyle = 'rgb(34,32,31)';
    ctx.fillRect(0, 0, c.width, c.height);
  } else {
    ctx.fillStyle = 'rgba(40,28,22,0.62)';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  variants.set(k, c);
  return c;
}

/**
 * Draws a sprite fitted (aspect kept) inside a w×h box centred at (cx, cy).
 * Returns false when the sprite is unavailable so callers can fall back to vector art.
 */
export function drawSprite(ctx: CanvasRenderingContext2D, name: SpriteName, w: number, h: number, cx = 0, cy = 0, kind?: 'ghost' | 'spent'): boolean {
  const src = kind ? variant(name, kind) : sprite(name);
  if (!src) return false;
  const iw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const ih = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const k = Math.min(w / iw, h / ih);
  const dw = iw * k;
  const dh = ih * k;
  ctx.drawImage(src, cx - dw / 2, cy - dh / 2, dw, dh);
  return true;
}
