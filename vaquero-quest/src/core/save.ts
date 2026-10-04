// Versioned save data in localStorage. Missing, unavailable or corrupt storage never crashes the game.

export const SAVE_KEY = 'utrgv-vaquero-quest.save';
export const SAVE_VERSION = 1;

export interface Settings {
  music: boolean;
  sfx: boolean;
  reducedMotion: boolean;
  touch: 'auto' | 'on' | 'off';
}

export interface Best {
  score: number;
  time: number;
}

export interface SaveData {
  v: number;
  /** Highest unlocked level index (0-based). */
  unlocked: number;
  completed: boolean[];
  best: (Best | null)[];
  /** Persistent rare collectible ids (V emblems, V hands, books). */
  rare: string[];
  campaignComplete: boolean;
  settings: Settings;
}

export function defaultSave(levels = 3): SaveData {
  return {
    v: SAVE_VERSION,
    unlocked: 0,
    completed: Array(levels).fill(false),
    best: Array(levels).fill(null),
    rare: [],
    campaignComplete: false,
    settings: { music: true, sfx: true, reducedMotion: false, touch: 'auto' },
  };
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function sanitize(raw: unknown, levels: number): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.v !== 'number' || r.v > SAVE_VERSION) return null;
  const d = defaultSave(levels);
  if (typeof r.unlocked === 'number' && Number.isFinite(r.unlocked)) d.unlocked = Math.max(0, Math.min(levels - 1, Math.floor(r.unlocked)));
  if (Array.isArray(r.completed)) for (let i = 0; i < levels; i++) d.completed[i] = r.completed[i] === true;
  if (Array.isArray(r.best))
    for (let i = 0; i < levels; i++) {
      const b = r.best[i] as Record<string, unknown> | null;
      if (b && typeof b.score === 'number' && typeof b.time === 'number' && Number.isFinite(b.score) && Number.isFinite(b.time)) d.best[i] = { score: b.score, time: b.time };
    }
  if (Array.isArray(r.rare)) d.rare = [...new Set(r.rare.filter((x): x is string => typeof x === 'string' && x.length < 32))];
  d.campaignComplete = r.campaignComplete === true;
  const s = r.settings as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    if (typeof s.music === 'boolean') d.settings.music = s.music;
    if (typeof s.sfx === 'boolean') d.settings.sfx = s.sfx;
    if (typeof s.reducedMotion === 'boolean') d.settings.reducedMotion = s.reducedMotion;
    if (s.touch === 'auto' || s.touch === 'on' || s.touch === 'off') d.settings.touch = s.touch;
  }
  return d;
}

export class SaveStore {
  data: SaveData;
  /** False when storage is unavailable; progress then lives only in memory. */
  available = true;
  /** True when a stored save existed but could not be read (it was replaced with defaults). */
  recovered = false;
  private storage: StorageLike | null;

  constructor(
    readonly levels = 3,
    storage?: StorageLike | null,
  ) {
    this.storage = storage === undefined ? SaveStore.detect() : storage;
    this.available = this.storage !== null;
    this.data = this.load();
  }

  static detect(): StorageLike | null {
    try {
      const s = window.localStorage;
      const k = '__vq_probe__';
      s.setItem(k, '1');
      s.removeItem(k);
      return s;
    } catch {
      return null;
    }
  }

  private load(): SaveData {
    if (!this.storage) return defaultSave(this.levels);
    let txt: string | null = null;
    try {
      txt = this.storage.getItem(SAVE_KEY);
    } catch {
      this.available = false;
      return defaultSave(this.levels);
    }
    if (txt === null) return defaultSave(this.levels);
    try {
      const parsed = sanitize(JSON.parse(txt), this.levels);
      if (parsed) return parsed;
    } catch {
      /* fall through */
    }
    this.recovered = true;
    return defaultSave(this.levels);
  }

  get hasProgress() {
    return this.data.unlocked > 0 || this.data.completed.some(Boolean) || this.data.rare.length > 0;
  }

  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      this.available = false;
    }
  }

  addRare(id: string) {
    if (this.data.rare.includes(id)) return false;
    this.data.rare.push(id);
    this.save();
    return true;
  }

  completeLevel(i: number, score: number, time: number) {
    this.data.completed[i] = true;
    if (i + 1 < this.levels) this.data.unlocked = Math.max(this.data.unlocked, i + 1);
    else this.data.campaignComplete = true;
    const b = this.data.best[i];
    if (!b) this.data.best[i] = { score, time };
    else this.data.best[i] = { score: Math.max(b.score, score), time: Math.min(b.time, time) };
    this.save();
  }

  /** Clears progress but keeps settings. */
  resetProgress() {
    const settings = this.data.settings;
    this.data = defaultSave(this.levels);
    this.data.settings = settings;
    this.save();
  }
}
