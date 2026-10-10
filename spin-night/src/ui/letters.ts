// The used-letter board: the whole alphabet, plus a "Not in this puzzle" list.
// It doubles as the letter keyboard when a letter can be called.

import { ALPHABET, isVowel } from '../engine/answer';

export type LetterMark = 'hit' | 'miss' | 'given' | undefined;

export class LetterBoard {
  readonly el: HTMLElement;
  private keys = new Map<string, HTMLButtonElement>();
  private misses: HTMLElement;
  private missList: HTMLElement;
  onPick: (l: string) => void = () => {};

  constructor(host: HTMLElement) {
    this.el = host;
    const grid = document.createElement('div');
    grid.className = 'alpha';
    for (const L of ALPHABET) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `key${isVowel(L) ? ' vowel' : ''}`;
      b.dataset.letter = L;
      b.innerHTML = `<span>${L}</span>`;
      b.addEventListener('click', () => {
        if (!b.disabled) this.onPick(L);
      });
      grid.append(b);
      this.keys.set(L, b);
    }
    this.misses = document.createElement('div');
    this.misses.className = 'misses';
    this.misses.innerHTML = '<span class="misses-label">Not in this puzzle</span>';
    this.missList = document.createElement('span');
    this.missList.className = 'miss-list';
    this.misses.append(this.missList);
    host.append(grid, this.misses);
  }

  /**
   * `used` marks called letters; `pickable` letters are enabled; `selected`
   * marks bonus-round picks waiting to be locked in.
   */
  update(used: Record<string, 'hit' | 'miss'>, pickable: Set<string>, opts: { given?: string[]; selected?: string[] } = {}) {
    const misses: string[] = [];
    for (const [L, b] of this.keys) {
      const mark: LetterMark = opts.given?.includes(L) ? 'given' : used[L];
      const sel = opts.selected?.includes(L) ?? false;
      b.classList.toggle('hit', mark === 'hit');
      b.classList.toggle('miss', mark === 'miss');
      b.classList.toggle('given', mark === 'given');
      b.classList.toggle('selected', sel);
      const can = pickable.has(L) && (!mark || sel);
      b.disabled = !can;
      b.classList.toggle('can', can);
      b.setAttribute(
        'aria-label',
        `${L}${mark === 'hit' ? ', in the puzzle' : mark === 'miss' ? ', not in the puzzle' : mark === 'given' ? ', given' : ''}`,
      );
      if (used[L] === 'miss') misses.push(L);
    }
    this.missList.innerHTML = misses.length
      ? misses.map((m) => `<b class="miss-chip">${m}</b>`).join('')
      : '<i class="miss-none">None yet</i>';
  }
}
