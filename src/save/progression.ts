// Goals, achievements, passport and once-only run settlement.

import { REWARDS, type ModeId } from '../config';
import { LANDMARKS, type LandmarkId } from '../world/landmarks';
import { MISSIONS } from '../sim/missions';
import type { SaveManager } from './save';

export interface RunSummary {
  runId: string;
  mode: ModeId;
  stars: number;
  score: number;
  distance: number;
  landmarksVisited: LandmarkId[];
  words: number;
  lettersProgress: number;
  deliveries: string[];
  powerups: number;
  longestNoDamage: number;
  hits: number;
  shieldPops: number;
}

export type GoalMetric = 'stars' | 'landmarks' | 'words' | 'deliverBook' | 'noDamage' | 'distance' | 'powerups' | 'deliveries' | 'shieldPops';

export interface GoalDef {
  id: string;
  text: string;
  metric: GoalMetric;
  target: number;
}

/** Finite goal list; three are active at a time. No streaks or waiting. */
export const GOALS: GoalDef[] = [
  { id: 'g_stars30', text: 'Collect 30 Maiden Stars in one run', metric: 'stars', target: 30 },
  { id: 'g_visit3', text: 'Visit 3 landmarks in one run', metric: 'landmarks', target: 3 },
  { id: 'g_word1', text: 'Spell MADDY once', metric: 'words', target: 1 },
  { id: 'g_book', text: 'Deliver a book to Kingdom School', metric: 'deliverBook', target: 1 },
  { id: 'g_nodamage', text: 'Run a 300 m block with no bumps', metric: 'noDamage', target: 300 },
  { id: 'g_dist800', text: 'Run 800 m in one adventure', metric: 'distance', target: 800 },
  { id: 'g_power3', text: 'Use 3 power-ups in one run', metric: 'powerups', target: 3 },
  { id: 'g_deliver2', text: 'Make 2 friendly deliveries in one run', metric: 'deliveries', target: 2 },
  { id: 'g_stars100', text: 'Collect 100 Maiden Stars in one run', metric: 'stars', target: 100 },
  { id: 'g_visit7', text: 'Visit all 7 landmarks in one run', metric: 'landmarks', target: 7 },
];

export interface AchievementDef {
  id: string;
  name: string;
  text: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_first', name: 'First Steps', text: 'Finish your first adventure.' },
  { id: 'a_maddy', name: 'Spell It Out', text: 'Complete the MADDY letter quest.' },
  { id: 'a_explorer', name: 'MaidenVille Explorer', text: 'Collect all seven City Passport stamps.' },
  { id: 'a_helper', name: 'Helping Hands', text: 'Make all four friendly deliveries.' },
  { id: 'a_stars500', name: 'Star Saver', text: 'Earn 500 Maiden Stars in total.' },
  { id: 'a_long', name: 'Long Way Round', text: 'Run 1,500 m in a single run.' },
  { id: 'a_smooth', name: 'Smooth Runner', text: 'Run 600 m without a bump.' },
  { id: 'a_style', name: 'Fresh Style', text: "Equip something new in Maddy's Closet." },
];

export function metricValue(m: GoalMetric, r: Pick<RunSummary, 'stars' | 'landmarksVisited' | 'words' | 'deliveries' | 'longestNoDamage' | 'distance' | 'powerups' | 'shieldPops'>): number {
  switch (m) {
    case 'stars':
      return r.stars;
    case 'landmarks':
      return r.landmarksVisited.length;
    case 'words':
      return r.words;
    case 'deliverBook':
      return r.deliveries.includes('m_book') ? 1 : 0;
    case 'noDamage':
      return r.longestNoDamage;
    case 'distance':
      return r.distance;
    case 'powerups':
      return r.powerups;
    case 'deliveries':
      return r.deliveries.length;
    case 'shieldPops':
      return r.shieldPops;
  }
}

export function activeGoals(save: SaveManager): GoalDef[] {
  return GOALS.filter((g) => !save.data.goalsCompleted.includes(g.id)).slice(0, 3);
}

/** Record a passport stamp immediately (visiting is the reward). Returns true if new. */
export function stamp(save: SaveManager, id: LandmarkId): boolean {
  if (save.data.stamps.includes(id)) return false;
  save.data.stamps.push(id);
  save.save();
  return true;
}

export function hasExplorerBadge(save: SaveManager): boolean {
  return LANDMARKS.every((l) => save.data.stamps.includes(l.id));
}

export interface Settlement {
  alreadySettled: boolean;
  starsBanked: number;
  bonusStars: number;
  goals: GoalDef[];
  achievements: AchievementDef[];
  newBest: boolean;
  best: number;
}

function grantAchievement(save: SaveManager, id: string, out: AchievementDef[]) {
  if (save.data.achievements.includes(id)) return;
  save.data.achievements.push(id);
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (def) out.push(def);
}

/** Check closet-style achievements outside of runs. */
export function checkStyleAchievement(save: SaveManager): AchievementDef | null {
  if (save.data.achievements.includes('a_style')) return null;
  const out: AchievementDef[] = [];
  grantAchievement(save, 'a_style', out);
  save.data.stars += REWARDS.achievementStars;
  save.data.totalStarsEarned += REWARDS.achievementStars;
  save.save();
  return out[0] ?? null;
}

/**
 * Settle a finished run exactly once. Calling it again with the same runId awards nothing.
 * Explore runs never bank stars or records.
 */
export function settleRun(save: SaveManager, r: RunSummary): Settlement {
  const d = save.data;
  if (d.settledRuns.includes(r.runId)) {
    const rec = r.mode === 'explore' ? null : d.records[r.mode];
    return { alreadySettled: true, starsBanked: 0, bonusStars: 0, goals: [], achievements: [], newBest: false, best: rec?.bestScore ?? 0 };
  }
  d.settledRuns.push(r.runId);
  if (d.settledRuns.length > 50) d.settledRuns.splice(0, d.settledRuns.length - 50);

  const competitive = r.mode !== 'explore';
  let banked = 0;
  let bonus = 0;
  const goals: GoalDef[] = [];
  const achievements: AchievementDef[] = [];
  let newBest = false;
  let best = 0;

  if (competitive) {
    banked = Math.max(0, Math.floor(r.stars));
    for (const g of activeGoals(save)) {
      if (metricValue(g.metric, r) >= g.target) {
        d.goalsCompleted.push(g.id);
        goals.push(g);
        bonus += REWARDS.goalStars;
      }
    }
    const rec = d.records[r.mode as "explorer" | "challenge"];
    rec.runs++;
    if (r.score > rec.bestScore) {
      newBest = rec.bestScore > 0 || r.score > 0;
      rec.bestScore = Math.floor(r.score);
    }
    rec.bestDistance = Math.max(rec.bestDistance, Math.floor(r.distance));
    best = rec.bestScore;
    d.wordsCompleted += r.words;
    for (const m of r.deliveries) if (!d.missionsDelivered.includes(m)) d.missionsDelivered.push(m);

    grantAchievement(save, 'a_first', achievements);
    if (r.words > 0) grantAchievement(save, 'a_maddy', achievements);
    if (r.distance >= 1500) grantAchievement(save, 'a_long', achievements);
    if (r.longestNoDamage >= 600) grantAchievement(save, 'a_smooth', achievements);
    if (MISSIONS.every((m) => d.missionsDelivered.includes(m.id))) grantAchievement(save, 'a_helper', achievements);
  }
  if (hasExplorerBadge(save)) grantAchievement(save, 'a_explorer', achievements);

  bonus += achievements.length * REWARDS.achievementStars;
  d.stars += banked + bonus;
  d.totalStarsEarned += banked + bonus;
  if (d.totalStarsEarned >= 500 && !d.achievements.includes('a_stars500')) {
    grantAchievement(save, 'a_stars500', achievements);
    d.stars += REWARDS.achievementStars;
    d.totalStarsEarned += REWARDS.achievementStars;
    bonus += REWARDS.achievementStars;
  }
  save.save();
  return { alreadySettled: false, starsBanked: banked, bonusStars: bonus, goals, achievements, newBest, best };
}
