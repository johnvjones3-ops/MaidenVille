// Prints a level as ASCII with validator results: `npx vite-node scripts/dump.ts 1`
import { TILE } from '../src/config';
import { analyze } from '../src/levels/validate';
import { LEVELS } from '../src/levels';

const n = Number(process.argv[2] ?? 1);
const def = LEVELS[n - 1]();
const ch: Record<number, string> = { 0: ' ', 1: '#', 2: 'B', 3: '?', 4: 'x', 5: '%', 6: 'h', 7: '=', 8: 'n', 9: 'S', 10: 'W', 11: '-', 12: 'M', 13: '|', 14: 'P' };
const rows: string[][] = [];
for (let y = 0; y < def.h; y++) {
  rows.push([]);
  for (let x = 0; x < def.w; x++) rows[y].push(ch[def.tiles[y * def.w + x]] ?? '?');
}
const t0 = Date.now();
const r = analyze(def);
for (const id of r.reachable) {
  const nd = r.nodes[id];
  if (nd.r - 1 >= 0 && rows[nd.r - 1][nd.c] === ' ') rows[nd.r - 1][nd.c] = r.canFinish.has(id) ? '.' : '!';
}
const em: Record<string, string> = { ball: 'o', emblem: 'E', hand: 'V', hand2: 'V', book: 'K', bot: 'b', weed: 'w', cactus: 'c', turret: 't', checkpoint: 'C', finish: 'F', door: 'D', sign: 's', platform: '_', spikes: '^', bouncer: 'O', lantern: 'L', lasso: 'Q', star: '*', hat: 'H', boss: 'X' };
for (const e of def.entities) {
  const c = em[e.kind];
  if (!c) continue;
  const x = Math.floor(e.x / TILE);
  const y = Math.min(def.h - 1, Math.floor((e.kind === 'ball' || e.rid || ['lantern','lasso','star','hat'].includes(e.kind) ? e.y : e.y - 1) / TILE));
  if (rows[y] && x < def.w) rows[y][x] = c;
}
const chunk = 110;
for (let x0 = 0; x0 < def.w; x0 += chunk) {
  let ruler = '';
  for (let x = x0; x < Math.min(def.w, x0 + chunk); x++) ruler += x % 10 === 0 ? String((x / 10) % 10) : ' ';
  console.log('    ' + ruler);
  rows.forEach((row, y) => console.log(String(y).padStart(3) + ' ' + row.slice(x0, x0 + chunk).join('')));
}
console.log(`nodes ${r.nodes.length} reachable ${r.reachable.size} sims ${r.sims} in ${Date.now() - t0}ms`);
console.log('finish reached:', r.finishReached, 'checkpoints:', r.checkpointsReached.length, 'doors', r.doorsUsed);
console.log('dead ends:', JSON.stringify(r.deadEnds));
console.log('rares untouched:', r.rareUids.filter((u) => !r.raresTouched.has(u)).map((u) => { const e = def.entities[u]; return `${e.kind}@${Math.floor(e.x / TILE)},${Math.floor(e.y / TILE)}`; }));
const r2 = analyze(def, { revealHidden: true });
console.log('rares untouched with hidden blocks revealed:', r2.rareUids.filter((u) => !r2.raresTouched.has(u)).length, 'dead ends', r2.deadEnds.length);
