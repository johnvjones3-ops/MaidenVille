// CityGraph: the authored, connected running route through MaidenVille.
// The route is a closed loop of streets joined by rounded corners, so world coordinates stay bounded
// no matter how long a run lasts. Distance along the loop is `s`; run distance `d` maps to s = d mod length.
//
// World axes: +x east, -z north (the overview camera looks north up the central avenue).
// Heading h: direction = (sin h, 0, -cos h). h = 0 is north, h = PI/2 is east. Right turns increase h.

export interface Pose {
  x: number;
  z: number;
  heading: number;
}

interface LinePiece {
  kind: 'line';
  s0: number;
  len: number;
  x0: number;
  z0: number;
  heading: number;
  street: string;
}
interface ArcPiece {
  kind: 'arc';
  s0: number;
  len: number;
  cx: number;
  cz: number;
  r: number;
  h0: number; // heading at start
  turn: 1 | -1; // +1 right turn
  street: string;
}
type Piece = LinePiece | ArcPiece;

export interface StreetInfo {
  id: string;
  name: string;
  s0: number;
  s1: number;
}

export interface CornerZone {
  s0: number; // start of arc
  s1: number; // end of arc
}

export const CORNER_RADIUS = 16;

/** Rectangle loop: central avenue north, north street east, east street south, south street west. */
const CORNERS: Array<{ x: number; z: number }> = [
  { x: 0, z: 60 }, // SW — foreground intersection (start)
  { x: 0, z: -340 }, // NW
  { x: 260, z: -340 }, // NE
  { x: 260, z: 60 }, // SE
];

const STREET_NAMES = ['Maiden Main Street', 'Kingdom Lane', 'Imagination Parkway', 'Target Square Row'];

export class CityRoute {
  readonly pieces: Piece[] = [];
  readonly length: number;
  readonly corners: CornerZone[] = [];
  readonly streets: StreetInfo[] = [];

  constructor() {
    const R = CORNER_RADIUS;
    let s = 0;
    const n = CORNERS.length;
    for (let i = 0; i < n; i++) {
      const a = CORNERS[i];
      const b = CORNERS[(i + 1) % n];
      const c = CORNERS[(i + 2) % n];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const segLen = Math.hypot(dx, dz);
      const ux = dx / segLen;
      const uz = dz / segLen;
      const heading = Math.atan2(ux, -uz);
      const lineLen = segLen - 2 * R;
      const x0 = a.x + ux * R;
      const z0 = a.z + uz * R;
      this.pieces.push({ kind: 'line', s0: s, len: lineLen, x0, z0, heading, street: STREET_NAMES[i] });
      const streetStart = s;
      s += lineLen;
      // Corner at b turning toward c
      const vx = (c.x - b.x) / Math.hypot(c.x - b.x, c.z - b.z);
      const vz = (c.z - b.z) / Math.hypot(c.x - b.x, c.z - b.z);
      const cross = ux * vz - uz * vx; // >0 means right turn in this coordinate system
      const turn: 1 | -1 = cross > 0 ? 1 : -1;
      // Right-hand vector of heading h: (cos h, sin h)
      const rx = Math.cos(heading) * turn;
      const rz = Math.sin(heading) * turn;
      const sx = b.x - ux * R;
      const sz = b.z - uz * R;
      const arcLen = (Math.PI / 2) * R;
      this.pieces.push({ kind: 'arc', s0: s, len: arcLen, cx: sx + rx * R, cz: sz + rz * R, r: R, h0: heading, turn, street: STREET_NAMES[i] });
      this.corners.push({ s0: s, s1: s + arcLen });
      s += arcLen;
      this.streets.push({ id: `street${i}`, name: STREET_NAMES[i], s0: streetStart, s1: s });
    }
    this.length = s;
  }

  wrap(s: number): number {
    const L = this.length;
    return ((s % L) + L) % L;
  }

  private piece(s: number): Piece {
    s = this.wrap(s);
    // tiny array; linear scan is fine
    for (let i = this.pieces.length - 1; i >= 0; i--) if (s >= this.pieces[i].s0) return this.pieces[i];
    return this.pieces[0];
  }

  /** Centerline pose at route distance s (wrapped). */
  pose(s: number, out: Pose = { x: 0, z: 0, heading: 0 }): Pose {
    s = this.wrap(s);
    const p = this.piece(s);
    const t = s - p.s0;
    if (p.kind === 'line') {
      out.x = p.x0 + Math.sin(p.heading) * t;
      out.z = p.z0 - Math.cos(p.heading) * t;
      out.heading = p.heading;
    } else {
      const a = (t / p.r) * p.turn;
      const h = p.h0 + a;
      // position = center - right(h) * r * turn
      out.x = p.cx - Math.cos(h) * p.r * p.turn;
      out.z = p.cz - Math.sin(h) * p.r * p.turn;
      out.heading = h;
    }
    return out;
  }

  /** World position for route distance s and lateral offset (+ = right of travel). */
  worldAt(s: number, lateral: number, out: Pose = { x: 0, z: 0, heading: 0 }): Pose {
    this.pose(s, out);
    out.x += Math.cos(out.heading) * lateral;
    out.z += Math.sin(out.heading) * lateral;
    return out;
  }

  streetAt(s: number): StreetInfo {
    s = this.wrap(s);
    for (const st of this.streets) if (s >= st.s0 && s < st.s1) return st;
    return this.streets[0];
  }

  /** Distance from s to the nearest corner arc (0 inside an arc). */
  cornerDistance(s: number): number {
    s = this.wrap(s);
    let best = Infinity;
    for (const c of this.corners) {
      for (const off of [-this.length, 0, this.length]) {
        const a = c.s0 + off;
        const b = c.s1 + off;
        const d = s < a ? a - s : s > b ? s - b : 0;
        if (d < best) best = d;
      }
    }
    return best;
  }

  /** Signed distance along the loop from a to b in (-L/2, L/2]. */
  delta(a: number, b: number): number {
    let d = this.wrap(b) - this.wrap(a);
    if (d > this.length / 2) d -= this.length;
    if (d <= -this.length / 2) d += this.length;
    return d;
  }

  /** Project a world point to the closest route s (coarse search then refine). */
  project(x: number, z: number): number {
    let best = 0;
    let bestD = Infinity;
    const p: Pose = { x: 0, z: 0, heading: 0 };
    for (let s = 0; s < this.length; s += 2) {
      this.pose(s, p);
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    for (let s = best - 2; s <= best + 2; s += 0.1) {
      this.pose(s, p);
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = this.wrap(s);
      }
    }
    return best;
  }
}

export const ROUTE = new CityRoute();

export const ROAD = {
  laneCount: 3,
  roadHalfWidth: 5.2,
  sidewalkWidth: 4.2,
} as const;
