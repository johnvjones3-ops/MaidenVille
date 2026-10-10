// The illuminated puzzle board: 4 rows of tiles with animated letter reveals.

import { isLetter } from '../engine/answer';
import type { PuzzleState } from '../engine/types';
import { COLS, layoutAnswer } from '../puzzles/layout';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class Board {
  readonly el: HTMLElement;
  private grid: HTMLElement;
  private tiles: HTMLElement[] = []; // by answer index
  private cells: HTMLElement[] = [];
  private puzzleId: string | null = null;
  private animating = new Set<number>();
  reduceMotion = false;

  constructor(host: HTMLElement) {
    this.el = host;
    this.grid = document.createElement('div');
    this.grid.className = 'board-grid';
    this.el.append(this.grid);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'tile';
        cell.innerHTML = '<span class="ch"></span>';
        this.grid.append(cell);
        this.cells.push(cell);
      }
    }
    this.clear();
    this.el.addEventListener('animationend', (e) => e.target === this.el && this.el.classList.remove('shake'));
  }

  clear() {
    this.puzzleId = null;
    this.tiles = [];
    this.cells.forEach((cell, i) => {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const outside = (r === 0 || r === 3) && (c === 0 || c === COLS - 1);
      cell.className = outside ? 'tile off' : 'tile empty';
      (cell.firstChild as HTMLElement).textContent = '';
    });
  }

  /** Builds the tiles for a new puzzle, or refreshes the current one without animation. */
  sync(p: PuzzleState | null) {
    if (!p) {
      if (this.puzzleId !== null) this.clear();
      return;
    }
    if (p.id !== this.puzzleId) {
      this.clear();
      this.puzzleId = p.id;
      this.animating.clear();
      const { grid } = layoutAnswer(p.answer);
      this.tiles = [];
      grid.forEach((row, r) =>
        row.forEach((idx, c) => {
          if (idx < 0) return;
          const cell = this.cells[r * COLS + c];
          this.tiles[idx] = cell;
          const ch = p.answer[idx];
          cell.className = isLetter(ch) ? 'tile slot' : 'tile slot punct shown';
          (cell.firstChild as HTMLElement).textContent = isLetter(ch) ? '' : ch;
        }),
      );
      this.el.classList.remove('fresh');
      void this.el.offsetWidth;
      this.el.classList.add('fresh');
    }
    p.revealed.forEach((rev, i) => {
      const t = this.tiles[i];
      if (!t || this.animating.has(i)) return;
      const ch = p.answer[i];
      if (rev && isLetter(ch)) {
        t.classList.add('shown');
        t.classList.remove('lit');
        (t.firstChild as HTMLElement).textContent = ch;
      } else if (!rev && isLetter(ch)) {
        t.classList.remove('shown', 'lit');
        (t.firstChild as HTMLElement).textContent = '';
      }
    });
  }

  private show(i: number, ch: string, cls = 'pop') {
    const t = this.tiles[i];
    if (!t) return;
    t.classList.remove('lit');
    t.classList.add('shown', cls);
    (t.firstChild as HTMLElement).textContent = ch;
    setTimeout(() => t.classList.remove(cls), 500);
    this.animating.delete(i);
  }

  /** Called letters: each tile lights blue in turn with a chime, then turns. */
  async revealCall(answer: string, positions: number[], chime: () => void) {
    const sorted = [...positions].sort((a, b) => a - b);
    sorted.forEach((i) => this.animating.add(i));
    const step = this.reduceMotion ? 120 : 380;
    for (const i of sorted) {
      this.tiles[i]?.classList.add('lit');
      chime();
      await wait(step);
    }
    await wait(this.reduceMotion ? 100 : 260);
    for (const i of sorted) {
      this.show(i, answer[i], 'turn');
      await wait(this.reduceMotion ? 20 : 90);
    }
    await wait(200);
  }

  /** Toss-up: a single tile flips in. */
  revealQuick(answer: string, positions: number[]) {
    for (const i of positions) this.show(i, answer[i], 'pop');
  }

  /** Solved: the rest of the board turns in a quick wave. */
  async revealAll(answer: string, positions: number[]) {
    positions.forEach((i) => this.animating.add(i));
    const sorted = [...positions].sort((a, b) => a - b);
    for (const i of sorted) {
      this.tiles[i]?.classList.add('lit');
      await wait(this.reduceMotion ? 5 : 28);
    }
    await wait(180);
    for (const i of sorted) {
      this.show(i, answer[i], 'turn');
      await wait(this.reduceMotion ? 5 : 30);
    }
  }

  /** Bonus round: everything lights at once, then turns together. */
  async revealTogether(answer: string, positions: number[]) {
    positions.forEach((i) => {
      this.animating.add(i);
      this.tiles[i]?.classList.add('lit');
    });
    await wait(this.reduceMotion ? 300 : 1100);
    positions.forEach((i) => this.show(i, answer[i], 'turn'));
    await wait(400);
  }

  shake() {
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
  }
}
