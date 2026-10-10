// Puzzle board layout: four rows of 12, 14, 14 and 12 tiles, as on the TV board.
// Rows 0 and 3 are inset by one tile at each end.

export const ROW_WIDTHS = [12, 14, 14, 12] as const;
export const COLS = 14;
const ROW_INSET = [1, 0, 0, 1];

export interface BoardLine {
  row: number;
  /** First column (0-13) of the line. */
  col: number;
  /** Index into the answer where this line starts. */
  offset: number;
  text: string;
}

export interface BoardLayout {
  lines: BoardLine[];
  /** grid[row][col] = index into the answer, -1 for an empty tile, -2 outside the board. */
  grid: number[][];
}

function bestBreak(words: string[], widths: number[]): string[] | null {
  const n = words.length;
  const k = widths.length;
  if (n < k) return null;
  // memo[i][r]: min cost to set words[i..] on rows r..k-1, every row non-empty.
  const memo = new Map<string, { cost: number; lines: string[] } | null>();
  const go = (i: number, r: number): { cost: number; lines: string[] } | null => {
    const key = `${i},${r}`;
    if (memo.has(key)) return memo.get(key)!;
    let best: { cost: number; lines: string[] } | null = null;
    if (r === k - 1) {
      const line = words.slice(i).join(' ');
      best = line.length <= widths[r] ? { cost: (widths[r] - line.length) ** 2, lines: [line] } : null;
    } else {
      for (let j = i + 1; j <= n - (k - 1 - r); j++) {
        const line = words.slice(i, j).join(' ');
        if (line.length > widths[r]) break;
        const rest = go(j, r + 1);
        if (!rest) continue;
        const cost = (widths[r] - line.length) ** 2 + rest.cost;
        if (!best || cost < best.cost) best = { cost, lines: [line, ...rest.lines] };
      }
    }
    memo.set(key, best);
    return best;
  };
  return go(0, 0)?.lines ?? null;
}

const STARTS: Record<number, number[]> = { 1: [1], 2: [1], 3: [1, 0], 4: [0] };

export function layoutAnswer(answer: string): BoardLayout {
  const words = answer.split(' ');
  const len = answer.length;
  const preferred = len <= 11 ? 1 : len <= 24 ? 2 : len <= 38 ? 3 : 4;
  let chosen: { start: number; lines: string[]; cost: number } | null = null;
  const order = [1, 2, 3, 4].filter((k) => k >= preferred).concat([3, 2, 1].filter((k) => k < preferred));
  for (const k of order) {
    if (chosen) break;
    for (const start of STARTS[k]) {
      const widths = ROW_WIDTHS.slice(start, start + k) as unknown as number[];
      const lines = bestBreak(words, widths);
      if (!lines) continue;
      const cost = lines.reduce((s, l, i) => s + (widths[i] - l.length) ** 2, 0);
      if (!chosen || cost < chosen.cost) chosen = { start, lines, cost };
    }
  }
  if (!chosen) throw new Error(`Puzzle does not fit the board: ${answer}`);

  const grid: number[][] = ROW_WIDTHS.map((w, r) =>
    Array.from({ length: COLS }, (_, c) => (c >= ROW_INSET[r] && c < ROW_INSET[r] + w ? -1 : -2)),
  );
  const lines: BoardLine[] = [];
  let offset = 0;
  chosen.lines.forEach((text, i) => {
    const row = chosen!.start + i;
    const col = ROW_INSET[row] + Math.floor((ROW_WIDTHS[row] - text.length) / 2);
    lines.push({ row, col, offset, text });
    for (let j = 0; j < text.length; j++) if (text[j] !== ' ') grid[row][col + j] = offset + j;
    offset += text.length + 1;
  });
  return { lines, grid };
}
