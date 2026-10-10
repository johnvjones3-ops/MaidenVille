// Answer normalization, letter helpers and stable ids.

export const VOWELS = ['A', 'E', 'I', 'O', 'U'] as const;
export const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const isVowel = (l: string) => (VOWELS as readonly string[]).includes(l);
export const isLetter = (c: string) => c >= 'A' && c <= 'Z';

/**
 * Comparison form of an answer: case, spacing and punctuation are ignored,
 * and "&" reads as "AND". Nothing else is forgiven, so a wrong word or a
 * misspelling never counts as a solve.
 */
export function normalize(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]/g, '');
}

export const isCorrect = (guess: string, answer: string) => {
  const g = normalize(guess);
  return g.length > 0 && g === normalize(answer);
};

export const letterCount = (answer: string) => normalize(answer).replace(/[0-9]/g, '').length;

/** FNV-1a hash, base 36: a short id that stays the same while the answer does. */
export function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
