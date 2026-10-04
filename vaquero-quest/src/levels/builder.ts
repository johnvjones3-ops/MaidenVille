import { TILE } from '../config';
import { T, TileMap, type Reward } from '../game/tiles';
import type { Backdrop, EnemyKind, EntityDef, ItemKind, LevelDef, Theme, Zone } from './types';

/**
 * Small authoring DSL. Every coordinate is in tiles (column, row); row 0 is the top.
 * Levels are hand-placed calls, not random generation.
 */
export class LevelBuilder {
  readonly map: TileMap;
  readonly ents: EntityDef[] = [];
  readonly zones: Zone[] = [];
  readonly backdrops: { x0: number; backdrop: Backdrop }[] = [];
  readonly darks: { x: number; y: number; w: number; h: number }[] = [];
  spawnAt = { x: 3 * TILE, y: 12 * TILE };
  arena?: LevelDef['arena'];
  private emblemN = 0;
  private rareN = 0;
  private bookN = 0;
  readonly emblemIds: string[] = [];
  readonly rareIds: string[] = [];
  readonly bookIds: string[] = [];

  constructor(
    readonly index: number,
    readonly name: string,
    readonly subtitle: string,
    readonly theme: Theme,
    readonly music: string,
    w: number,
    readonly h = 15,
  ) {
    this.map = new TileMap(w, h);
  }

  private add(e: Omit<EntityDef, 'uid'>) {
    const d = { ...e, uid: this.ents.length } as EntityDef;
    this.ents.push(d);
    return d;
  }

  // ---- terrain -------------------------------------------------------------
  /** Ground columns x0..x1 inclusive with surface at row `top`. */
  ground(x0: number, x1: number, top = 12, t: number = T.GROUND) {
    for (let x = x0; x <= x1; x++) for (let y = top; y < this.h; y++) this.map.set(x, y, t);
    return this;
  }
  fill(x0: number, y0: number, x1: number, y1: number, t: number) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) this.map.set(x, y, t);
    return this;
  }
  clear(x0: number, y0: number, x1: number, y1: number) {
    return this.fill(x0, y0, x1, y1, T.EMPTY);
  }
  tile(x: number, y: number, t: number) {
    this.map.set(x, y, t);
    return this;
  }
  /** One-way walkway from x0..x1 at row y. */
  walk(x0: number, x1: number, y: number) {
    return this.fill(x0, y, x1, y, T.ONEWAY);
  }
  stool(x: number, y: number) {
    return this.tile(x, y, T.STOOL);
  }
  /** Staircase of solid blocks rising toward +dir. */
  stairs(x: number, baseRow: number, steps: number, dir: 1 | -1, t: number = T.STONE) {
    for (let i = 0; i < steps; i++) {
      const col = x + i * dir;
      for (let y = baseRow - i; y <= baseRow; y++) this.map.set(col, y, t);
    }
    return this;
  }
  crate(x: number, y: number, reward: Reward = 'ball', count = 1) {
    this.map.set(x, y, T.CRATE);
    this.map.crates.set(this.map.key(x, y), { reward, remaining: count, id: this.rareFor(reward) });
    return this;
  }
  hidden(x: number, y: number, reward: Reward = 'ball', count = 1) {
    this.map.set(x, y, T.HIDDEN);
    this.map.crates.set(this.map.key(x, y), { reward, remaining: count, id: this.rareFor(reward) });
    return this;
  }
  breakable(x0: number, y: number, x1 = x0) {
    return this.fill(x0, y, x1, y, T.BREAK);
  }
  private rareFor(r: Reward): string | undefined {
    if (r === 'hand' || r === 'hand2') return this.nextRare();
    if (r === 'book') return this.nextBook();
    return undefined;
  }
  private nextRare() {
    const id = `L${this.index + 1}-H${++this.rareN}`;
    this.rareIds.push(id);
    return id;
  }
  private nextBook() {
    const id = `L${this.index + 1}-B${++this.bookN}`;
    this.bookIds.push(id);
    return id;
  }

  // ---- entities ------------------------------------------------------------
  spawn(x: number, row = 12) {
    this.spawnAt = { x: x * TILE + TILE / 2, y: row * TILE };
    return this;
  }
  /** Item centred in tile (x, y). */
  item(kind: ItemKind, x: number, y: number, opts: Partial<EntityDef> = {}) {
    let rid: string | undefined;
    if (kind === 'emblem') {
      rid = `L${this.index + 1}-E${++this.emblemN}`;
      this.emblemIds.push(rid);
    } else if (kind === 'hand' || kind === 'hand2') rid = this.nextRare();
    else if (kind === 'book') rid = this.nextBook();
    this.add({ kind, x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, rid, ...opts });
    return this;
  }
  ball(x: number, y: number, opts: Partial<EntityDef> = {}) {
    return this.item('ball', x, y, opts);
  }
  /** Row of basketballs. */
  balls(x0: number, x1: number, y: number) {
    for (let x = x0; x <= x1; x++) this.ball(x, y);
    return this;
  }
  /** Arc of basketballs from x0 to x1 peaking `h` tiles above row y (teaches jump arcs). */
  arc(x0: number, x1: number, y: number, h = 2) {
    const n = x1 - x0;
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0.5 : i / n;
      const yy = y - h * 4 * t * (1 - t);
      this.add({ kind: 'ball', x: (x0 + i) * TILE + TILE / 2, y: yy * TILE + TILE / 2 });
    }
    return this;
  }
  enemy(kind: EnemyKind, x: number, row = 12, opts: Partial<EntityDef> = {}) {
    // Enemies stand on the surface whose top is at `row`.
    this.add({ kind, x: x * TILE + TILE / 2, y: row * TILE, dir: -1, ...opts });
    return this;
  }
  /** Retracting cactus spikes on the floor surface at `row`, `n` tiles wide. */
  spikes(x: number, row: number, n = 1, phase = 0) {
    this.add({ kind: 'spikes', x: x * TILE, y: row * TILE, w: n, phase });
    return this;
  }
  /** Moving one-way platform, `w` tiles wide, top at row y; moves by (dx, dy) tiles and back. */
  platform(x: number, y: number, w: number, dx: number, dy: number, period = 4, phase = 0) {
    this.add({ kind: 'platform', x: x * TILE, y: y * TILE, w, dx: dx * TILE, dy: dy * TILE, period, phase });
    return this;
  }
  bouncer(x: number, row: number, height = 3, phase = 0) {
    this.add({ kind: 'bouncer', x: x * TILE + TILE / 2, y: row * TILE, dy: height * TILE, phase });
    return this;
  }
  checkpoint(x: number, row = 12) {
    this.add({ kind: 'checkpoint', x: x * TILE + TILE / 2, y: row * TILE });
    return this;
  }
  finish(x: number, row = 12, art = 'pennant') {
    this.add({ kind: 'finish', x: x * TILE + TILE / 2, y: row * TILE, art });
    return this;
  }
  sign(x: number, row: number, text: string, icon = '') {
    this.add({ kind: 'sign', x: x * TILE + TILE / 2, y: row * TILE, text, icon });
    return this;
  }
  door(x: number, row: number, id: string, target: string) {
    this.add({ kind: 'door', x: x * TILE + TILE / 2, y: row * TILE, door: id, target });
    return this;
  }
  boss(x: number, row = 12) {
    this.add({ kind: 'boss', x: x * TILE, y: row * TILE });
    return this;
  }
  decor(art: string, x: number, row: number, scale = 1) {
    this.add({ kind: 'decor', art, x: x * TILE + TILE / 2, y: row * TILE, scale });
    return this;
  }
  dark(x0: number, y0: number, x1: number, y1: number) {
    this.darks.push({ x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE });
    return this;
  }
  zone(x0: number, x1: number, backdrop: Backdrop, y0 = 0, y1 = this.h) {
    this.zones.push({ x0: x0 * TILE, x1: (x1 + 1) * TILE, y0: y0 * TILE, y1: y1 * TILE, backdrop });
    return this;
  }
  backdrop(x0: number, b: Backdrop) {
    this.backdrops.push({ x0: x0 * TILE, backdrop: b });
    return this;
  }

  build(): LevelDef {
    if (this.zones.length === 0) this.zone(0, this.map.w - 1, this.backdrops[0]?.backdrop ?? 'plaza');
    if (this.backdrops.length === 0) this.backdrop(0, this.zones[0].backdrop);
    return {
      index: this.index,
      name: this.name,
      subtitle: this.subtitle,
      theme: this.theme,
      music: this.music,
      w: this.map.w,
      h: this.h,
      tiles: this.map.data,
      crates: [...this.map.crates.entries()],
      spawn: this.spawnAt,
      entities: this.ents,
      zones: this.zones,
      backdrops: this.backdrops.sort((a, b) => a.x0 - b.x0),
      darks: this.darks,
      emblemIds: this.emblemIds,
      rareIds: this.rareIds,
      bookIds: this.bookIds,
      arena: this.arena,
    };
  }
}
