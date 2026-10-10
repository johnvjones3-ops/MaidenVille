// Wheel layouts. 24 wedges, listed clockwise starting at the pointer (12 o'clock)
// when the wheel's angle is 0.

import type { Segment, Wedge, WedgeKind } from './types';

export const WEDGES = 24;
export const WEDGE_DEG = 360 / WEDGES;

// Cash wedge colors cycle so neighbors never match.
const PALETTE = ['#e63b2e', '#f6c12a', '#2f74e0', '#f07f1f', '#36ad4c', '#9446cc', '#ea4f9c', '#1fb3c4'];

const SPECIAL_COLOR: Partial<Record<WedgeKind, string>> = {
  bankrupt: '#0c0c10',
  lose: '#f4f2ec',
  wild: '#13c27a',
  gift: '#ff6fb1',
  prize: '#b9c4d6',
  mystery: '#5a1f9e',
  express: '#d8ef2c',
  envelope: '#c99a2e',
};

type Spec = number | 'BK' | 'LT' | 'WILD' | 'GIFT' | 'PRIZE' | 'MYS' | 'EXP';

const ROUND_SPECS: Record<'round1' | 'round2' | 'round3' | 'round4', Spec[]> = {
  round1: [2500, 600, 700, 600, 650, 500, 700, 'BK', 600, 550, 500, 'WILD', 800, 'LT', 700, 500, 650, 'GIFT', 900, 'BK', 500, 900, 300, 800],
  round2: [3500, 600, 700, 'MYS', 650, 500, 900, 'BK', 600, 550, 'PRIZE', 'WILD', 800, 'LT', 700, 'MYS', 650, 600, 900, 'BK', 500, 850, 550, 800],
  round3: [3500, 600, 700, 600, 650, 'EXP', 700, 'BK', 600, 550, 500, 'WILD', 800, 'LT', 700, 900, 650, 500, 900, 'BK', 500, 850, 300, 800],
  round4: [5000, 600, 700, 600, 650, 500, 700, 'BK', 600, 550, 500, 600, 800, 'LT', 700, 900, 650, 500, 900, 'BK', 500, 850, 300, 800],
};

function wedgeFor(spec: Spec, i: number, wildOnWheel: boolean): Wedge {
  const cash = (value: number): Wedge => ({ kind: 'cash', value, color: i === 0 ? '#e9e4d4' : PALETTE[i % PALETTE.length] });
  switch (spec) {
    case 'BK':
      return { kind: 'bankrupt', value: 0, color: SPECIAL_COLOR.bankrupt! };
    case 'LT':
      return { kind: 'lose', value: 0, color: SPECIAL_COLOR.lose! };
    case 'WILD':
      return wildOnWheel ? { kind: 'wild', value: 500, color: SPECIAL_COLOR.wild! } : cash(500);
    case 'GIFT':
      return { kind: 'gift', value: 1000, color: SPECIAL_COLOR.gift! };
    case 'PRIZE':
      return { kind: 'prize', value: 500, color: SPECIAL_COLOR.prize! };
    case 'MYS':
      return { kind: 'mystery', value: 1000, color: SPECIAL_COLOR.mystery! };
    case 'EXP':
      return { kind: 'express', value: 1000, color: SPECIAL_COLOR.express! };
    default:
      return cash(spec);
  }
}

export function buildWheel(seg: Segment, wildOnWheel: boolean, rand: () => number): Wedge[] {
  const key = seg === 'round1' || seg === 'round2' || seg === 'round3' ? seg : 'round4';
  const wedges = ROUND_SPECS[key].map((s, i) => wedgeFor(s, i, wildOnWheel));
  if (key === 'round2') {
    // One Mystery wedge hides $10,000, the other hides a Bankrupt.
    const mysteries = wedges.map((w, i) => (w.kind === 'mystery' ? i : -1)).filter((i) => i >= 0);
    const lucky = rand() < 0.5 ? 0 : 1;
    mysteries.forEach((wi, n) => (wedges[wi].hidden = n === lucky ? 'cash10k' : 'bankrupt'));
  }
  return wedges;
}

/** Bonus wheel: 24 identical sealed envelopes. Their contents live in state, not on the wheel. */
export function buildBonusWheel(): Wedge[] {
  return Array.from({ length: WEDGES }, () => ({ kind: 'envelope' as const, value: 0, color: SPECIAL_COLOR.envelope! }));
}

/** Bonus envelope contents (cash values), shuffled per episode. */
export const BONUS_ENVELOPES = [
  ...Array(8).fill(40000),
  ...Array(6).fill(45000),
  ...Array(4).fill(50000),
  ...Array(3).fill(55000),
  ...Array(2).fill(75000),
  100000,
];

/** Index of the wedge under the fixed pointer at a given wheel angle (degrees, clockwise). */
export function wedgeAt(angle: number): number {
  const local = (((-angle % 360) + 360) % 360);
  return Math.floor(local / WEDGE_DEG) % WEDGES;
}

/**
 * Final angle for a spin that lands inside `target`, well clear of its pegs.
 * `turns` full rotations are added in the direction of `dir`.
 */
export function landingAngle(from: number, target: number, within: number, turns: number, dir: 1 | -1): number {
  const local = (target + 0.14 + within * 0.72) * WEDGE_DEG; // stays 14% away from each edge
  const want = (((-local % 360) + 360) % 360); // angle mod 360 that puts `local` under the pointer
  const cur = ((from % 360) + 360) % 360;
  let delta = dir === 1 ? want - cur : cur - want;
  delta = ((delta % 360) + 360) % 360;
  return from + dir * (delta + turns * 360);
}

/** Wheel motion: a short wind-up, then a long, smooth slow-down. Returns 0..1 progress. */
export function spinProgress(t: number, duration: number): number {
  if (t <= 0) return 0;
  if (t >= duration) return 1;
  const ta = Math.min(0.35, duration * 0.1);
  const d = duration - ta;
  const total = ta / 2 + d / 3;
  if (t < ta) return (t * t) / (2 * ta) / total;
  const s = t - ta;
  return (ta / 2 + (d / 3) * (1 - ((d - s) / d) ** 3)) / total;
}

export const formatMoney = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
