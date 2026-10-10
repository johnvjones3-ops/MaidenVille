// Saving: browser storage first (instant, works offline), mirrored to the
// signed-in viewer's private Claude artifact storage when the page runs there,
// so a cleared browser or a different device can still pick up the game.

import type { DifficultySetting, GameState, TimerMode } from '../engine/types';
import type { History } from '../puzzles/select';
import type { AvatarConfig } from '../ui/avatar';

export interface Settings {
  difficulty: DifficultySetting;
  denton: boolean;
  timerMode: TimerMode;
  muted: boolean;
  volume: number;
  deviceKeyboard: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'mixed',
  denton: true,
  timerMode: 'typing',
  muted: false,
  volume: 0.8,
  deviceKeyboard: false,
  reduceMotion: false,
};

type Key = 'settings' | 'history' | 'save' | 'avatars' | 'screen';
interface Wrapped<T> {
  updatedAt: number;
  data: T;
}

const LS = (k: Key) => `spinnight.${k}.v1`;

function readLocal<T>(k: Key): Wrapped<T> | null {
  try {
    const raw = localStorage.getItem(LS(k));
    if (!raw) return null;
    const w = JSON.parse(raw) as Wrapped<T>;
    return w && typeof w === 'object' && 'data' in w ? w : null;
  } catch {
    return null;
  }
}

function writeLocal<T>(k: Key, w: Wrapped<T> | null) {
  try {
    if (w === null) localStorage.removeItem(LS(k));
    else localStorage.setItem(LS(k), JSON.stringify(w));
  } catch {
    /* storage full or blocked: the cloud copy, if any, still works */
  }
}

interface ClaudeLike {
  use?: (name: string) => Promise<unknown>;
}
interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(d: Record<string, unknown>): Promise<void>;
}
interface DbLike {
  doc(path: string): DocRef;
}
interface UserLike {
  id(): Promise<string | null>;
}

const CLOUD_KEYS: Key[] = ['settings', 'history', 'save', 'avatars'];

class Cloud {
  private db: DbLike | null = null;
  private uid: string | null = null;
  private pending = new Map<Key, string>();
  private writing = new Set<Key>();
  private timers = new Map<Key, number>();
  disabled = false;

  get ready() {
    return !!this.db && !!this.uid && !this.disabled;
  }

  async connect(): Promise<Partial<Record<Key, Wrapped<unknown>>> | null> {
    const c = (window as unknown as { claude?: ClaudeLike }).claude;
    if (!c?.use) return null;
    try {
      const [db, user] = (await Promise.all([c.use('db'), c.use('user')])) as [DbLike | null, UserLike | null];
      if (!db || !user) return null;
      const uid = await user.id();
      if (!uid) return null;
      this.db = db;
      this.uid = uid;
      const out: Partial<Record<Key, Wrapped<unknown>>> = {};
      for (const k of CLOUD_KEYS) {
        try {
          const snap = await db.doc(this.path(k)).get();
          const body = snap.exists ? snap.data() : undefined;
          if (body && typeof body.json === 'string') out[k] = JSON.parse(body.json) as Wrapped<unknown>;
        } catch {
          /* unreadable doc: ignore it */
        }
      }
      return out;
    } catch {
      return null;
    }
  }

  private path(k: Key) {
    return `data/users/${this.uid}/spin-night-${k}`;
  }

  queue(k: Key, json: string, delay = 2500) {
    if (!this.ready || !CLOUD_KEYS.includes(k)) return;
    this.pending.set(k, json);
    clearTimeout(this.timers.get(k));
    this.timers.set(k, window.setTimeout(() => this.flush(k), delay));
  }

  flushAll() {
    for (const k of [...this.pending.keys()]) this.flush(k);
  }

  private async flush(k: Key) {
    if (!this.ready || this.writing.has(k)) return;
    const json = this.pending.get(k);
    if (json === undefined) return;
    this.pending.delete(k);
    this.writing.add(k);
    try {
      await this.db!.doc(this.path(k)).set({ json });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'invalid_argument' || code === 'revoked' || code === 'not_granted' || code === 'quota_exceeded') this.disabled = true;
    } finally {
      this.writing.delete(k);
      if (this.pending.has(k)) this.timers.set(k, window.setTimeout(() => this.flush(k), 1500));
    }
  }
}

export class Store {
  private cloud = new Cloud();

  constructor() {
    const flush = () => this.cloud.flushAll();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  get cloudReady() {
    return this.cloud.ready;
  }

  load() {
    const settings = { ...DEFAULT_SETTINGS, ...(readLocal<Settings>('settings')?.data ?? {}) };
    const history = readLocal<History>('history')?.data ?? { seen: {}, counter: 0 };
    const save = readLocal<GameState>('save');
    const avatars = readLocal<[AvatarConfig, AvatarConfig]>('avatars')?.data ?? null;
    const screen = readLocal<string>('screen')?.data ?? 'menu';
    return { settings, history, save: save?.data ?? null, avatars, screen };
  }

  private put<T>(k: Key, data: T | null, cloudDelay?: number) {
    const w = data === null ? null : { updatedAt: Date.now(), data };
    writeLocal(k, w);
    if (w) this.cloud.queue(k, JSON.stringify(w), cloudDelay);
    else this.cloud.queue(k, JSON.stringify({ updatedAt: Date.now(), data: null }), cloudDelay);
  }

  saveSettings(s: Settings) {
    this.put('settings', s);
  }
  saveHistory(h: History) {
    this.put('history', h);
  }
  saveGame(g: GameState | null) {
    this.put('save', g, 3000);
  }
  saveAvatars(a: [AvatarConfig, AvatarConfig]) {
    this.put('avatars', a);
  }
  saveScreen(screen: 'menu' | 'game') {
    writeLocal('screen', { updatedAt: Date.now(), data: screen });
  }

  /**
   * Connects to cloud storage when available and merges it with local data.
   * Seen-puzzle history is unioned; the newer save and avatars win.
   */
  async sync(local: ReturnType<Store['load']>) {
    const remote = await this.cloud.connect();
    if (!remote) return null;
    const out: { history?: History; save?: GameState | null; avatars?: [AvatarConfig, AvatarConfig]; settings?: Settings } = {};

    const rh = remote.history?.data as History | undefined;
    if (rh && rh.seen) {
      const merged: History = { seen: { ...rh.seen }, counter: Math.max(rh.counter || 0, local.history.counter) };
      for (const [id, n] of Object.entries(local.history.seen)) merged.seen[id] = Math.max(n, merged.seen[id] ?? -1);
      out.history = merged;
    }
    const localSave = readLocal<GameState>('save');
    const rs = remote.save as Wrapped<GameState | null> | undefined;
    if (rs && (!localSave || rs.updatedAt > localSave.updatedAt)) out.save = rs.data;
    const localAv = readLocal<[AvatarConfig, AvatarConfig]>('avatars');
    const ra = remote.avatars as Wrapped<[AvatarConfig, AvatarConfig]> | undefined;
    if (ra?.data && (!localAv || ra.updatedAt > localAv.updatedAt)) out.avatars = ra.data;
    if (!readLocal('settings') && remote.settings?.data) out.settings = { ...DEFAULT_SETTINGS, ...(remote.settings.data as Settings) };

    // Push local data the cloud doesn't have yet.
    if (out.history) this.saveHistory(out.history);
    else this.saveHistory(local.history);
    if (!rs && localSave) this.cloud.queue('save', JSON.stringify(localSave), 500);
    if (!ra && localAv) this.cloud.queue('avatars', JSON.stringify(localAv), 500);
    if (!remote.settings) this.saveSettings(local.settings);
    if (out.save !== undefined) writeLocal('save', out.save ? { updatedAt: rs!.updatedAt, data: out.save } : null);
    if (out.avatars) writeLocal('avatars', ra!);
    return out;
  }
}
