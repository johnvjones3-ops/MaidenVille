import { it } from 'vitest';
import { ROUTE } from '../src/world/route';
it('dbg', () => {
  for (const s of [360, 368, 372, 380, 393, 400]) {
    const p = ROUTE.pose(s); const a = ROUTE.worldAt(s, -5.2); const b = ROUTE.worldAt(s, 5.2);
    console.log(s, p.x.toFixed(2), p.z.toFixed(2), p.heading.toFixed(3), a.x.toFixed(2), a.z.toFixed(2), b.x.toFixed(2), b.z.toFixed(2));
  }
  console.log(ROUTE.pieces.map(p => [p.kind, p.s0.toFixed(1), p.len.toFixed(1)]).join(' | '));
});
