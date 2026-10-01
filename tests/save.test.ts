import { describe, expect, it } from 'vitest';
import { SaveManager, type StorageLike } from '../src/save/save';
import { settleRun, stamp, type RunSummary } from '../src/save/progression';

function mem(initial?: string): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set('k', initial);
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  runId: 'run-1',
  mode: 'explorer',
  stars: 42,
  score: 1000,
  distance: 900,
  landmarksVisited: ['emergency', 'hospital', 'church'],
  words: 1,
  lettersProgress: 0,
  deliveries: ['m_book'],
  powerups: 1,
  longestNoDamage: 320,
  hits: 1,
  shieldPops: 0,
  ...over,
});

describe('SaveManager', () => {
  it('recovers from corrupted JSON and keeps a backup', () => {
    const st = mem('{not json!!');
    const s = new SaveManager(st, 'k');
    expect(s.recovered).toBe(true);
    expect(s.data.stars).toBe(0);
    expect(st.map.get('k-corrupt-backup')).toBe('{not json!!');
  });
  it('repairs wrong types and unknown ids', () => {
    const st = mem(JSON.stringify({ stars: 'lots', owned: ['outfit_maddy', 'bogus', 5], equipped: { outfit: 'outfit_maddy', trail: 'nope' }, settings: { sfxVolume: 7, quality: 'ultra' } }));
    const s = new SaveManager(st, 'k');
    expect(s.data.stars).toBe(0);
    expect(s.data.owned).toContain('outfit_maddy');
    expect(s.data.owned).not.toContain('bogus');
    expect(s.data.equipped.outfit).toBe('outfit_maddy');
    expect(s.data.equipped.trail).toBe('trail_none');
    expect(s.data.settings.sfxVolume).toBe(1);
    expect(s.data.settings.quality).toBe('medium');
  });
  it('cannot equip an item that is not owned and cannot buy without stars', () => {
    const s = new SaveManager(mem(), 'k');
    expect(s.equip('outfit_explorer')).toBe(false);
    expect(s.buy('outfit_explorer')).toBe(false);
    s.data.stars = 500;
    expect(s.buy('outfit_explorer')).toBe(true);
    expect(s.buy('outfit_explorer')).toBe(false);
    expect(s.equip('outfit_explorer')).toBe(true);
    const again = new SaveManager(s.storage, 'k');
    expect(again.data.equipped.outfit).toBe('outfit_explorer');
    expect(again.data.stars).toBe(380);
  });
  it('survives storage that throws', () => {
    const bad: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
    };
    const s = new SaveManager(bad, 'k');
    expect(s.storageUnavailable).toBe(true);
    s.data.stars = 3;
    s.save();
    expect(s.data.stars).toBe(3);
  });
});

describe('Run settlement', () => {
  it('pays out exactly once per run id', () => {
    const s = new SaveManager(mem(), 'k');
    const first = settleRun(s, summary());
    expect(first.alreadySettled).toBe(false);
    const after = s.data.stars;
    expect(after).toBeGreaterThanOrEqual(42);
    const second = settleRun(s, summary());
    expect(second.alreadySettled).toBe(true);
    expect(s.data.stars).toBe(after);
    // persisted guard survives reload
    const reloaded = new SaveManager(s.storage, 'k');
    settleRun(reloaded, summary());
    expect(reloaded.data.stars).toBe(after);
  });
  it('explore runs never bank stars or set records', () => {
    const s = new SaveManager(mem(), 'k');
    settleRun(s, summary({ runId: 'x', mode: 'explore', stars: 999, score: 999 }));
    expect(s.data.stars).toBe(0);
    expect(s.data.records.explorer.bestScore).toBe(0);
  });
  it('goals complete once and achievements do not repeat', () => {
    const s = new SaveManager(mem(), 'k');
    const a = settleRun(s, summary({ runId: 'a' }));
    expect(a.goals.map((g) => g.id)).toEqual(['g_stars30', 'g_visit3', 'g_word1']);
    expect(a.achievements.map((x) => x.id)).toContain('a_first');
    const b = settleRun(s, summary({ runId: 'b' }));
    expect(b.achievements.map((x) => x.id)).not.toContain('a_first');
    expect(b.goals.map((g) => g.id)).toContain('g_book');
  });
  it('stamps are unique and seven earn the explorer badge', () => {
    const s = new SaveManager(mem(), 'k');
    expect(stamp(s, 'church')).toBe(true);
    expect(stamp(s, 'church')).toBe(false);
    for (const id of ['emergency', 'hospital', 'house_turquoise', 'house_pink', 'school', 'store'] as const) stamp(s, id);
    const r = settleRun(s, summary({ runId: 'z', mode: 'explore' }));
    expect(r.achievements.map((a) => a.id)).toContain('a_explorer');
  });
});
