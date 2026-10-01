// Friendly Missions: pick up a clearly marked item, then run through the glowing delivery lane at a landmark.
// These are fictional game activities. Missing a delivery never ends the run — the zone returns next lap.

import { LANDMARK_BY_ID, type LandmarkId } from '../world/landmarks';
import { ROUTE } from '../world/route';
import type { MissionItemKind } from './types';

export interface MissionDef {
  id: string;
  item: MissionItemKind;
  itemName: string;
  target: LandmarkId;
  /** Route distance (s) where the item appears. */
  pickupS: number;
  verb: string;
}

const before = (id: LandmarkId, dist: number) => ROUTE.wrap(LANDMARK_BY_ID[id].s - dist);

export const MISSIONS: MissionDef[] = [
  { id: 'm_flowers', item: 'flowers', itemName: 'Flowers', target: 'church', pickupS: before('church', 150), verb: 'Bring the flowers to the Trinity Church garden' },
  { id: 'm_book', item: 'book', itemName: 'Book', target: 'school', pickupS: before('school', 140), verb: 'Bring the book to Kingdom School' },
  { id: 'm_gift', item: 'gift', itemName: 'Gift Parcel', target: 'store', pickupS: before('store', 150), verb: 'Bring the gift parcel to the Super Target plaza' },
  { id: 'm_card', item: 'card', itemName: 'Thank-You Card', target: 'hospital', pickupS: before('hospital', 150), verb: "Bring the thank-you card to the Hospital's welcome area" },
];

export const DELIVERY_HALF = 7;

/** Lane of the delivery mat: the lane nearest the landmark. */
export function deliveryLane(target: LandmarkId): number {
  return LANDMARK_BY_ID[target].side < 0 ? 0 : 2;
}

export class MissionSystem {
  carrying: MissionDef | null = null;
  completed = new Set<string>();
  /** Delivery count this run (each mission rewards once per run). */
  deliveries = 0;
  /** Last lap index on which each mission item was spawned. */
  private spawnedLap = new Map<string, number>();

  reset() {
    this.carrying = null;
    this.completed.clear();
    this.deliveries = 0;
    this.spawnedLap.clear();
  }

  /** Mission whose item should spawn at run distance d (if any). */
  itemsToSpawn(fromD: number, toD: number): Array<{ def: MissionDef; d: number }> {
    const res: Array<{ def: MissionDef; d: number }> = [];
    const L = ROUTE.length;
    for (const def of MISSIONS) {
      if (this.completed.has(def.id)) continue;
      const lapStart = Math.floor(fromD / L);
      for (let lap = lapStart; lap <= lapStart + 1; lap++) {
        const d = lap * L + def.pickupS;
        if (d < fromD || d >= toD) continue;
        if (this.spawnedLap.get(def.id) === lap) continue;
        this.spawnedLap.set(def.id, lap);
        res.push({ def, d });
      }
    }
    return res;
  }

  pickUp(item: MissionItemKind): MissionDef | null {
    if (this.carrying) return null;
    const def = MISSIONS.find((m) => m.item === item && !this.completed.has(m.id));
    if (!def) return null;
    this.carrying = def;
    return def;
  }

  /** Check delivery. Returns the mission when delivered (once). */
  tryDeliver(s: number, lane: number): MissionDef | null {
    const def = this.carrying;
    if (!def) return null;
    const l = LANDMARK_BY_ID[def.target];
    if (Math.abs(ROUTE.delta(s, l.s)) > DELIVERY_HALF) return null;
    if (lane !== deliveryLane(def.target)) return null;
    if (this.completed.has(def.id)) return null;
    this.completed.add(def.id);
    this.carrying = null;
    this.deliveries++;
    return def;
  }
}
