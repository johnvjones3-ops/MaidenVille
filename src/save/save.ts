// SaveManager: versioned, validated local progress. Corrupted or unavailable storage falls back gracefully.

import { COSMETICS, DEFAULT_EQUIPPED, GAME, type CosmeticCategory, type QualityId } from '../config';

export interface Settings {
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  quality: QualityId;
  touchButtons: boolean;
}

export interface ModeRecord {
  bestScore: number;
  bestDistance: number;
  runs: number;
}

export interface SaveData {
  version: number;
  settings: Settings;
  stars: number; // spendable
  totalStarsEarned: number;
  owned: string[];
  equipped: Record<CosmeticCategory, string>;
  stamps: string[];
  achievements: string[];
  goalsCompleted: string[];
  missionsDelivered: string[]; // distinct mission ids ever delivered
  tutorialDone: boolean;
  records: { explorer: ModeRecord; challenge: ModeRecord };
  settledRuns: string[]; // recent run ids already paid out
  wordsCompleted: number;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function defaultSettings(): Settings {
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { sfxVolume: 0.8, musicVolume: 0.5, muted: false, reducedMotion: reduced, quality: 'medium', touchButtons: false };
}

export function defaultSave(): SaveData {
  return {
    version: GAME.saveVersion,
    settings: defaultSettings(),
    stars: 0,
    totalStarsEarned: 0,
    owned: COSMETICS.filter((c) => c.cost === 0).map((c) => c.id),
    equipped: { ...DEFAULT_EQUIPPED },
    stamps: [],
    achievements: [],
    goalsCompleted: [],
    missionsDelivered: [],
    tutorialDone: false,
    records: { explorer: { bestScore: 0, bestDistance: 0, runs: 0 }, challenge: { bestScore: 0, bestDistance: 0, runs: 0 } },
    settledRuns: [],
    wordsCompleted: 0,
  };
}

const num = (v: unknown, d: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const strArr = (v: unknown, allowed?: Set<string>) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && (!allowed || allowed.has(x))))] : [];

/** Validate and repair any parsed object into a well-formed SaveData. */
export function sanitize(raw: unknown): SaveData {
  const def = defaultSave();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, any>;
  const s = (r.settings ?? {}) as Record<string, unknown>;
  const cosmeticIds = new Set(COSMETICS.map((c) => c.id));
  const owned = new Set([...def.owned, ...strArr(r.owned, cosmeticIds)]);
  const equipped = { ...def.equipped };
  const eq = (r.equipped ?? {}) as Record<string, unknown>;
  for (const cat of Object.keys(equipped) as CosmeticCategory[]) {
    const v = eq[cat];
    const item = COSMETICS.find((c) => c.id === v);
    if (typeof v === 'string' && item && item.category === cat && owned.has(v)) equipped[cat] = v;
  }
  const rec = (x: any): ModeRecord => ({
    bestScore: num(x?.bestScore, 0),
    bestDistance: num(x?.bestDistance, 0),
    runs: num(x?.runs, 0),
  });
  const quality = s.quality === 'low' || s.quality === 'medium' || s.quality === 'high' ? s.quality : def.settings.quality;
  return {
    version: GAME.saveVersion,
    settings: {
      sfxVolume: num(s.sfxVolume, def.settings.sfxVolume, 0, 1),
      musicVolume: num(s.musicVolume, def.settings.musicVolume, 0, 1),
      muted: bool(s.muted, false),
      reducedMotion: bool(s.reducedMotion, def.settings.reducedMotion),
      quality,
      touchButtons: bool(s.touchButtons, false),
    },
    stars: Math.floor(num(r.stars, 0)),
    totalStarsEarned: Math.floor(num(r.totalStarsEarned, 0)),
    owned: [...owned],
    equipped,
    stamps: strArr(r.stamps),
    achievements: strArr(r.achievements),
    goalsCompleted: strArr(r.goalsCompleted),
    missionsDelivered: strArr(r.missionsDelivered),
    tutorialDone: bool(r.tutorialDone, false),
    records: { explorer: rec(r.records?.explorer), challenge: rec(r.records?.challenge) },
    settledRuns: strArr(r.settledRuns).slice(-50),
    wordsCompleted: Math.floor(num(r.wordsCompleted, 0)),
  };
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

export class SaveManager {
  data: SaveData;
  storage: StorageLike;
  /** Set when storage could not be read/written (progress lives in memory only). */
  storageUnavailable = false;
  /** Set when a corrupted save was found and repaired. */
  recovered = false;
  private listeners: Array<() => void> = [];

  constructor(storage?: StorageLike, private key: string = GAME.saveKey) {
    let st: StorageLike | undefined = storage;
    if (!st) {
      try {
        st = window.localStorage;
        const probe = '__mv_probe__';
        st.setItem(probe, '1');
        st.removeItem(probe);
      } catch {
        st = memoryStorage();
        this.storageUnavailable = true;
      }
    }
    this.storage = st;
    this.data = this.load();
  }

  load(): SaveData {
    let text: string | null = null;
    try {
      text = this.storage.getItem(this.key);
    } catch {
      this.storageUnavailable = true;
      return defaultSave();
    }
    if (!text) return defaultSave();
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') this.recovered = true;
      return sanitize(parsed);
    } catch {
      this.recovered = true;
      try {
        this.storage.setItem(this.key + '-corrupt-backup', text);
      } catch {
        /* ignore */
      }
      return defaultSave();
    }
  }

  save() {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      this.storageUnavailable = true;
    }
    for (const l of this.listeners) l();
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings; // keep accessibility/audio preferences
    this.save();
  }

  // --- cosmetics
  buy(id: string): boolean {
    const item = COSMETICS.find((c) => c.id === id);
    if (!item || this.data.owned.includes(id) || this.data.stars < item.cost) return false;
    this.data.stars -= item.cost;
    this.data.owned.push(id);
    this.save();
    return true;
  }

  equip(id: string): boolean {
    const item = COSMETICS.find((c) => c.id === id);
    if (!item || !this.data.owned.includes(id)) return false;
    this.data.equipped[item.category] = id;
    this.save();
    return true;
  }
}
