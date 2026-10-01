// CityBuilder: builds the full-scale neighborhood around the route — streets, sidewalks, landmarks, filler blocks,
// trees, lamps, flower beds, bunting, invented additions and a distant city to the horizon.
// Visual randomness uses its own seeded RNG so the city looks identical on every visit.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE, QUALITY, type QualityId } from '../config';
import { Rng } from '../core/rng';
import { ADDITIONS, LANDMARKS, landmarkWorld } from '../world/landmarks';
import { ROAD, ROUTE } from '../world/route';
import { box, basic, cyl, gable, plane, std } from './kit';
import { buildLandmark } from './landmarkModels';
import { buildCar, flowerBed } from './props';
import { crosswalkTexture, grassTexture, painted, plainAsphaltTexture, roadTexture, sidewalkTexture, signTexture } from './textures';

interface AABB {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const overlaps = (a: AABB, b: AABB) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

function rectAABB(cx: number, cz: number, yaw: number, w: number, d: number, pad = 0): AABB {
  const c = Math.abs(Math.cos(yaw));
  const s = Math.abs(Math.sin(yaw));
  const hx = (w * c + d * s) / 2 + pad;
  const hz = (w * s + d * c) / 2 + pad;
  return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz };
}

/** Core rectangle of the loop (street centrelines). */
const LOOP = { x0: 0, x1: 260, z0: -340, z1: 60 };

export interface CityRefs {
  group: THREE.Group;
  landmarks: Map<string, THREE.Group>;
  canopyMaterial: THREE.MeshStandardMaterial;
  people: PeopleSet;
  deliveryMats: Map<string, THREE.Mesh>;
}

export interface PeopleSet {
  arms: THREE.InstancedMesh;
  armBase: THREE.Matrix4[];
  positions: THREE.Vector3[];
  phases: number[];
}

export function buildCity(quality: QualityId): CityRefs {
  const q = QUALITY[quality];
  const rng = new Rng(20240611);
  const root = new THREE.Group();
  root.name = 'city';
  const blocked: AABB[] = [];
  const landmarks = new Map<string, THREE.Group>();

  // ---------------------------------------------------------------- ground
  const grass = grassTexture();
  grass.repeat.set(300, 300);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), std(0xffffff, { map: grass, rough: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(130, -0.06, -140);
  (ground.material as THREE.MeshStandardMaterial).polygonOffset = true;
  (ground.material as THREE.MeshStandardMaterial).polygonOffsetFactor = 2;
  (ground.material as THREE.MeshStandardMaterial).polygonOffsetUnits = 4;
  ground.receiveShadow = true;
  root.add(ground);

  // ---------------------------------------------------------------- route road + sidewalks (ribbons)
  root.add(ribbon(-ROAD.roadHalfWidth, ROAD.roadHalfWidth, 0.07, std(0xffffff, { map: roadTexture(), rough: 0.92 }), 9));
  const sw = sidewalkTexture();
  const swMat = std(0xffffff, { map: sw, rough: 0.95 });
  root.add(ribbon(ROAD.roadHalfWidth, ROAD.roadHalfWidth + ROAD.sidewalkWidth, 0.14, swMat, 4));
  root.add(ribbon(-ROAD.roadHalfWidth - ROAD.sidewalkWidth, -ROAD.roadHalfWidth, 0.14, swMat, 4, true));
  // curbs
  const curb = std(0xbdb3a3, { rough: 0.9 });
  root.add(ribbon(ROAD.roadHalfWidth - 0.05, ROAD.roadHalfWidth + 0.15, 0.17, curb, 50));
  root.add(ribbon(-ROAD.roadHalfWidth - 0.15, -ROAD.roadHalfWidth + 0.05, 0.17, curb, 50));

  // ---------------------------------------------------------------- decorative side streets (no traffic on the course)
  const asph = plainAsphaltTexture();
  const decoStreets: Array<[number, number, number, number]> = [
    // x0,z0,x1,z1 (axis aligned)
    [0, 60, 0, 520],
    [0, -340, 0, -1100],
    [260, 60, 260, 420],
    [260, -340, 260, -900],
    [-520, 60, 0, 60],
    [260, 60, 760, 60],
    [-520, -340, 0, -340],
    [260, -340, 760, -340],
    [-300, -130, 0, -130],
    [260, -150, 600, -150],
  ];
  for (const [x0, z0, x1, z1] of decoStreets) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const t = asph.clone();
    t.needsUpdate = true;
    t.repeat.set(1, len / 8);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10.4, len), std(0xffffff, { map: t, rough: 0.95 }));
    m.rotation.x = -Math.PI / 2;
    if (x0 !== x1) m.rotation.z = Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
    m.receiveShadow = true;
    root.add(m);
    // sidewalks alongside
    for (const side of [-1, 1]) {
      // sidewalks stop short of the intersections at each end
      const s = new THREE.Mesh(new THREE.PlaneGeometry(4, Math.max(1, len - 26)), swMat);
      s.rotation.x = -Math.PI / 2;
      if (x0 !== x1) s.rotation.z = Math.PI / 2;
      const off = side * 7.2;
      s.position.set((x0 + x1) / 2 + (x0 === x1 ? off : 0), 0.1, (z0 + z1) / 2 + (x0 === x1 ? 0 : off));
      s.receiveShadow = true;
      root.add(s);
    }
    // keep buildings off the street
    blocked.push({ x0: Math.min(x0, x1) - 10, x1: Math.max(x0, x1) + 10, z0: Math.min(z0, z1) - 10, z1: Math.max(z0, z1) + 10 });
  }
  // crosswalks at every route intersection
  const cw = basic(0xffffff, { map: crosswalkTexture(), transparent: true });
  const crossings: Array<[number, number, number]> = [];
  for (const c of [
    [0, 60],
    [0, -340],
    [260, -340],
    [260, 60],
  ]) {
    crossings.push([c[0], c[1] + 13, 0], [c[0], c[1] - 13, 0], [c[0] + 13, c[1], Math.PI / 2], [c[0] - 13, c[1], Math.PI / 2]);
  }
  crossings.push([0 - 13, -130, Math.PI / 2], [260 + 13, -150, Math.PI / 2], [0, -130 + 8, 0], [0, -130 - 8, 0], [260, -150 + 8, 0], [260, -150 - 8, 0]);
  for (const [x, z, r] of crossings) {
    const m = plane(10, 3, cw, x, 0.11, z);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = r;
    root.add(m);
  }

  // keep filler buildings off the route streets themselves
  for (const pc of ROUTE.pieces) {
    if (pc.kind !== 'line') continue;
    const a = ROUTE.pose(pc.s0);
    const b = ROUTE.pose(pc.s0 + pc.len);
    blocked.push({ x0: Math.min(a.x, b.x) - 10, x1: Math.max(a.x, b.x) + 10, z0: Math.min(a.z, b.z) - 10, z1: Math.max(a.z, b.z) + 10 });
  }

  // ---------------------------------------------------------------- landmarks
  for (const l of LANDMARKS) {
    const w = landmarkWorld(l);
    const g = buildLandmark(l.id);
    g.position.set(w.x, 0, w.z);
    g.rotation.y = w.yaw;
    root.add(g);
    landmarks.set(l.id, g);
    const pad = l.id === 'store' ? 6 : l.id === 'school' ? 14 : 3;
    blocked.push(rectAABB(w.x, w.z, w.yaw, l.width + pad * 2, l.depth + (l.id === 'store' ? 30 : 10), 0));
    // lawn/forecourt between sidewalk and building
    const apron = ROUTE.worldAt(l.s, l.side * (ROAD.roadHalfWidth + ROAD.sidewalkWidth + (l.setback - 9.4) / 2));
    const ap = new THREE.Mesh(new THREE.PlaneGeometry(l.width + 6, l.setback - 9.4), std(0xd7ccb9, { rough: 1 }));
    ap.rotation.x = -Math.PI / 2;
    ap.rotation.z = w.yaw;
    ap.position.set(apron.x, 0.05, apron.z);
    ap.receiveShadow = true;
    if (l.id !== 'store') root.add(ap);
  }

  // wayfinding signs that face Maddy as she approaches each landmark (so names are readable from the chase camera)
  for (const l of LANDMARKS) {
    const p = ROUTE.worldAt(l.s - l.width / 2 - 10, l.side * 10.2);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.heading; // local +z faces back toward the runner
    const colors: Record<string, string> = { church: '#8c5bd6', school: '#8a5634', store: '#cc1a24', hospital: '#1f8fd0', emergency: '#d2342b', house_turquoise: '#1aa39a', house_pink: '#d63c8f' };
    const t = signTexture(l.name.toUpperCase(), { bg: colors[l.id], fg: '#ffffff', w: 768, h: 150, border: '#ffffff' });
    g.add(plane(4.6, 0.9, basic(0xffffff, { map: t }), 0, 3.3, 0.06));
    g.add(box(4.8, 1.05, 0.1, std(0x2b2b30), 0, 3.3, 0));
    g.add(cyl(0.08, 0.08, 3.4, std(0x2b2b30), -2.1, 1.7, 0, 6), cyl(0.08, 0.08, 3.4, std(0x2b2b30), 2.1, 1.7, 0, 6));
    root.add(g);
  }

  // delivery mats at each landmark (shown only while carrying the matching item)
  const deliveryMats = new Map<string, THREE.Mesh>();
  const matTex = painted('delivery-mat', 256, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(127,224,184,0.0)');
    grd.addColorStop(0.2, 'rgba(127,224,184,0.85)');
    grd.addColorStop(0.8, 'rgba(127,224,184,0.85)');
    grd.addColorStop(1, 'rgba(127,224,184,0.0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let y = 40; y < h; y += 110) {
      g.beginPath();
      g.moveTo(w * 0.2, y + 50);
      g.lineTo(w / 2, y);
      g.lineTo(w * 0.8, y + 50);
      g.lineTo(w * 0.8, y + 72);
      g.lineTo(w / 2, y + 22);
      g.lineTo(w * 0.2, y + 72);
      g.fill();
    }
  });
  for (const l of LANDMARKS) {
    const lane = l.side < 0 ? 0 : 2;
    const p = ROUTE.worldAt(l.s, (lane - 1) * 2.6);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 14), basic(0xffffff, { map: matTex, transparent: true }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -p.heading;
    m.position.set(p.x, 0.11, p.z);
    m.visible = false;
    root.add(m);
    deliveryMats.set(l.id, m);
  }

  // ---------------------------------------------------------------- invented additions (secondary)
  root.add(welcomeArch());
  const park = imaginationPark();
  root.add(park.group);
  blocked.push(park.aabb);
  const plaza = celebrationPlaza();
  root.add(plaza.group);
  blocked.push(plaza.aabb);
  for (const c of [
    [10, 50, 'MADDY MAIDEN WAY'],
    [-10, -330, 'KINGDOM LANE'],
    [270, -330, 'IMAGINATION PKWY'],
    [250, 70, 'TARGET SQUARE ROW'],
  ] as Array<[number, number, string]>) root.add(streetSign(c[0], c[1], c[2]));

  // ---------------------------------------------------------------- filler buildings along every street
  const fill = new FillerBuilder();
  const fillerAABBs: AABB[] = [];
  for (const piece of ROUTE.pieces) {
    if (piece.kind !== 'line') continue;
    for (const side of [-1, 1] as const) {
      for (const row of [0, 1]) {
        let t = 6;
        while (t < piece.len - 6) {
          const w = rng.range(8, 14);
          const d = rng.range(10, 15);
          const set = row === 0 ? rng.range(11.5, 13.5) : rng.range(31, 36);
          const s = piece.s0 + t + w / 2;
          t += w + rng.range(1, 4);
          const lateral = side * (set + d / 2);
          const p = ROUTE.worldAt(s, lateral);
          const yaw = Math.atan2(-Math.cos(p.heading) * side, -Math.sin(p.heading) * side);
          const bb = rectAABB(p.x, p.z, yaw, w, d, 0.5);
          if (blocked.some((b) => overlaps(b, bb)) || fillerAABBs.some((b) => overlaps(b, bb))) continue;
          // the interior of the loop gets a park-like middle: only a single row there
          const inside = p.x > LOOP.x0 && p.x < LOOP.x1 && p.z > LOOP.z0 && p.z < LOOP.z1;
          if (inside && row === 1) continue;
          fillerAABBs.push(bb);
          fill.building(rng, p.x, p.z, yaw, w, d, row === 0 ? 1 : 0.8);
        }
      }
    }
  }
  // distant city to the horizon
  for (let x = -560; x <= 820; x += 34) {
    for (let z = -1060; z <= 520; z += 34) {
      const nearLoop = x > LOOP.x0 - 60 && x < LOOP.x1 + 60 && z > LOOP.z0 - 60 && z < LOOP.z1 + 60;
      if (nearLoop) continue;
      if (rng.next() > 0.62 * q.decorDensity + 0.2) continue;
      const w = rng.range(9, 16);
      const d = rng.range(9, 16);
      const bb = rectAABB(x, z, 0, w, d, 1);
      if (blocked.some((b) => overlaps(b, bb))) continue;
      fill.building(rng, x + rng.range(-5, 5), z + rng.range(-5, 5), rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), w, d, 0.7, true);
    }
  }
  root.add(fill.finish());

  // ---------------------------------------------------------------- trees, lamps, flower beds
  const trees = new TreeBuilder();
  const lamps: Array<[number, number, number]> = [];
  const landmarkClear = (s: number, side: number) =>
    LANDMARKS.some((l) => l.side === side && Math.abs(ROUTE.delta(s, l.s)) < l.width / 2 + 3);
  for (let s = 4; s < ROUTE.length; s += 15) {
    for (const side of [-1, 1]) {
      if (ROUTE.cornerDistance(s) < 6) continue;
      if (!landmarkClear(s, side)) {
        const p = ROUTE.worldAt(s + rng.range(-1.5, 1.5), side * 9.0);
        trees.add(rng, p.x, p.z, 1);
      }
    }
  }
  for (let s = 10; s < ROUTE.length; s += 24) {
    for (const side of [-1, 1]) {
      if (ROUTE.cornerDistance(s) < 3) continue;
      const p = ROUTE.worldAt(s + (side > 0 ? 12 : 0), side * 6.0);
      lamps.push([p.x, p.z, p.heading]);
    }
  }
  // loop interior: lawns, tree clusters and footpaths
  for (let i = 0; i < 520 * q.decorDensity; i++) {
    const x = rng.range(LOOP.x0 + 50, LOOP.x1 - 50);
    const z = rng.range(LOOP.z0 + 50, LOOP.z1 - 55);
    const bb = { x0: x - 2, x1: x + 2, z0: z - 2, z1: z + 2 };
    if (blocked.some((b) => overlaps(b, bb)) || fillerAABBs.some((b) => overlaps(b, bb))) continue;
    trees.add(rng, x, z, rng.range(0.9, 1.5));
  }
  // trees around the distant blocks and behind the outer rows
  for (let i = 0; i < 900 * q.decorDensity; i++) {
    const x = rng.range(-560, 820);
    const z = rng.range(-1060, 520);
    const bb = { x0: x - 2, x1: x + 2, z0: z - 2, z1: z + 2 };
    if (x > LOOP.x0 - 12 && x < LOOP.x1 + 12 && z > LOOP.z0 - 12 && z < LOOP.z1 + 12) continue;
    if (blocked.some((b) => overlaps(b, bb)) || fillerAABBs.some((b) => overlaps(b, bb))) continue;
    trees.add(rng, x, z, rng.range(0.9, 1.6));
  }
  const treeMeshes = trees.finish();
  root.add(treeMeshes.group);
  root.add(buildLamps(lamps));

  // flower beds along the sidewalks near landmarks and in garden zones
  let variant = 0;
  for (const l of LANDMARKS) {
    for (const off of [-l.width / 2 - 4, l.width / 2 + 4]) {
      const p = ROUTE.worldAt(l.s + off, l.side * 10.6);
      const fb = flowerBed(4, 1.4, variant++, 0, 0);
      fb.position.set(p.x, 0, p.z);
      fb.rotation.y = -p.heading;
      root.add(fb);
    }
  }
  // Trinity Garden Walk: extra beds
  for (let s = 270; s < 360; s += 14) {
    const p = ROUTE.worldAt(s, 10.8);
    const fb = flowerBed(3, 1.2, variant++, 0, 0);
    fb.position.set(p.x, 0, p.z);
    fb.rotation.y = -p.heading;
    root.add(fb);
  }

  // parked cars on side streets (outside the course)
  const carColors = [0x3a6ea5, 0xe8e4da, 0x9c2f2f, 0x4b7f52, 0xd9a441, 0x6b5b95];
  const parked: Array<[number, number, number]> = [
    [-30, -126.5, Math.PI / 2],
    [-55, -126.5, Math.PI / 2],
    [-80, -133.5, -Math.PI / 2],
    [290, -146.5, Math.PI / 2],
    [330, -153.5, -Math.PI / 2],
    [3.5, 110, 0],
    [-3.5, 150, Math.PI],
    [3.5, -400, 0],
    [263.5, -420, 0],
    [-60, 63.5, Math.PI / 2],
    [320, 56.5, -Math.PI / 2],
  ];
  parked.forEach(([x, z, r], i) => {
    const c = buildCar(carColors[i % carColors.length]);
    c.position.set(x, 0, z);
    c.rotation.y = r;
    root.add(c);
  });

  // bunting strings high across the course (event decorations)
  root.add(buildBunting());

  // neighbors who wave from the sidewalks
  const people = buildPeople(rng);
  root.add(people.group);

  for (const m of deliveryMats.values()) m.userData.dynamic = true;
  const batched = batchStatic(root, 140);
  return { group: batched, landmarks, canopyMaterial: treeMeshes.canopyMat, people: people.set, deliveryMats };
}

/**
 * Merge every static, non-instanced mesh by material and spatial cell. This turns hundreds of small
 * landmark/prop meshes into a few dozen draw calls while keeping frustum culling useful.
 */
function batchStatic(root: THREE.Group, cell: number): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  const keep: THREE.Object3D[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if ((m as any).isInstancedMesh || m.userData.dynamic || Array.isArray(m.material) || m.geometry.morphAttributes.position) {
      keep.push(m);
      return;
    }
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const hasColor = !!g.attributes.color;
    m.getWorldPosition(v);
    const key = `${(m.material as THREE.Material).uuid}:${hasColor}:${Math.floor(v.x / cell)}:${Math.floor(v.z / cell)}`;
    const b = buckets.get(key) ?? { mat: m.material as THREE.Material, geos: [], cast: false, receive: false };
    b.geos.push(g);
    b.cast ||= m.castShadow;
    b.receive ||= m.receiveShadow;
    buckets.set(key, b);
    g = null as any;
  });
  const out = new THREE.Group();
  out.name = 'city';
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  for (const k of keep) {
    const clone = k as THREE.Mesh;
    k.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    out.add(clone);
  }
  return out;
}

// ---------------------------------------------------------------- helpers

/** A ribbon following the route between two lateral offsets. */
function ribbon(l0: number, l1: number, y: number, mat: THREE.Material, vScale: number, flipU = false): THREE.Mesh {
  const step = 2;
  const n = Math.ceil(ROUTE.length / step);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * ROUTE.length;
    const a = ROUTE.worldAt(s, l0);
    const b = ROUTE.worldAt(s, l1);
    pos.push(a.x, y, a.z, b.x, y, b.z);
    const v = s / vScale;
    uv.push(flipU ? 1 : 0, v, flipU ? 0 : 1, v);
    if (i < n) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); // counter-clockwise from above
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // ensure normals point up regardless of winding
  const nrm = geo.attributes.normal;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

const FILLER_WALLS = [0xf1e6cf, 0xe2cfae, 0xd8b48a, 0xa65a3c, 0xa9c29a, 0x9fbcd6, 0xf0b58f, 0xf2dc9b, 0xc98d6b, 0xe7d9c4];
const FILLER_ROOFS = [0x34363d, 0x4a3a33, 0x50555e, 0x3b3f47];
const AWNINGS = [0xcc4a4a, 0x2a9d8f, 0xe9c46a, 0x6b5b95, 0x3a6ea5];

class FillerBuilder {
  private walls: THREE.BufferGeometry[] = [];
  private roofs: THREE.BufferGeometry[] = [];
  private windows: THREE.Matrix4[] = [];
  private windowColors: THREE.Color[] = [];
  private m = new THREE.Matrix4();

  private colored(geo: THREE.BufferGeometry, color: number, matrix: THREE.Matrix4): THREE.BufferGeometry {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(matrix);
    const c = new THREE.Color(color);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = c.r;
      arr[i + 1] = c.g;
      arr[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    return g;
  }

  building(rng: Rng, x: number, z: number, yaw: number, w: number, d: number, scale: number, far = false) {
    const style = rng.pick(['row', 'row', 'shop', 'apartment'] as const);
    const floors = style === 'apartment' ? rng.int(3, 4) : style === 'shop' ? rng.int(1, 2) : 2;
    const fh = 3.1;
    const h = floors * fh + (style === 'shop' ? 1 : 0.6);
    const wall = style === 'apartment' ? rng.pick([0xa65a3c, 0xe2cfae, 0xc98d6b]) : rng.pick(FILLER_WALLS);
    const base = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
    const local = (lx: number, ly: number, lz: number, sx = 1, sy = 1, sz = 1, ry = 0) =>
      base.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(lx, ly, lz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz)));
    this.walls.push(this.colored(new THREE.BoxGeometry(w, h, d), wall, local(0, h / 2, 0)));
    if (style === 'row') {
      const roof = rng.pick(FILLER_ROOFS);
      const rh = rng.range(2.4, 3.6);
      this.roofs.push(this.colored(gableGeoCached(), roof, local(0, h, 0, w + 0.8, rh, d + 0.8)));
    } else {
      this.walls.push(this.colored(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), 0xd9cfc0, local(0, h + 0.25, 0)));
      if (style === 'shop') this.walls.push(this.colored(new THREE.BoxGeometry(w * 0.85, 0.2, 1.6), rng.pick(AWNINGS), local(0, 3.0, d / 2 + 0.8)));
    }
    if (far && scale < 0.75 && rng.chance(0.4)) return; // fewer windows far away
    // windows on the street face (and some on the sides)
    const cols = Math.max(1, Math.floor(w / 3));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const lx = -w / 2 + (w / cols) * (c + 0.5);
        const ly = f * fh + 1.8;
        if (f === 0 && c === Math.floor(cols / 2) && style !== 'apartment') {
          // door
          this.windows.push(local(lx, 1.2, d / 2 + 0.03, 1.1, 2.2, 1));
          this.windowColors.push(new THREE.Color(0xe9a24a));
          continue;
        }
        this.windows.push(local(lx, ly, d / 2 + 0.03, 1.2, 1.4, 1));
        const lit = rng.next();
        this.windowColors.push(new THREE.Color(lit > 0.25 ? 0xffc768 : 0x8fa3b8).multiplyScalar(lit > 0.25 ? rng.range(0.85, 1.1) : 1));
      }
    }
    void this.m;
  }

  finish(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'fillers';
    const wallsGeo = mergeGeometries(this.walls);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const walls = new THREE.Mesh(wallsGeo, mat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    g.add(walls);
    if (this.roofs.length) {
      const roofs = new THREE.Mesh(mergeGeometries(this.roofs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
      roofs.castShadow = true;
      roofs.receiveShadow = true;
      g.add(roofs);
    }
    const winGeo = new THREE.PlaneGeometry(1, 1);
    const win = new THREE.InstancedMesh(winGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.windows.length);
    this.windows.forEach((m, i) => {
      win.setMatrixAt(i, m);
      win.setColorAt(i, this.windowColors[i]);
    });
    g.add(win);
    this.walls = [];
    this.roofs = [];
    return g;
  }
}

let _gable: THREE.BufferGeometry | null = null;
function gableGeoCached(): THREE.BufferGeometry {
  if (!_gable) {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0);
    s.lineTo(0.5, 0);
    s.lineTo(0, 1);
    s.closePath();
    _gable = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    _gable.translate(0, 0, -0.5);
  }
  return _gable.clone();
}

class TreeBuilder {
  private trunks: THREE.Matrix4[] = [];
  private canopies: THREE.Matrix4[] = [];
  private colors: THREE.Color[] = [];

  add(rng: Rng, x: number, z: number, scale: number) {
    const h = rng.range(3.2, 4.6) * scale;
    this.trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(scale, h, scale)));
    const blobs = rng.int(2, 3);
    for (let i = 0; i < blobs; i++) {
      const r = rng.range(1.4, 2.1) * scale;
      const p = new THREE.Vector3(x + rng.range(-0.9, 0.9) * scale, h + rng.range(-0.2, 1.4) * scale, z + rng.range(-0.9, 0.9) * scale);
      this.canopies.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.next(), rng.next() * 3, 0)), new THREE.Vector3(r, r * rng.range(0.8, 1.0), r)));
      this.colors.push(new THREE.Color().setHSL(rng.range(0.24, 0.32), rng.range(0.45, 0.6), rng.range(0.27, 0.38)));
    }
  }

  finish() {
    const g = new THREE.Group();
    g.name = 'trees';
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1, 7);
    const trunks = new THREE.InstancedMesh(trunkGeo, std(0x6b4a33, { rough: 1 }), this.trunks.length);
    this.trunks.forEach((m, i) => trunks.setMatrixAt(i, m));
    trunks.castShadow = true;
    g.add(trunks);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    // gentle sway in the vertex shader (cheap, global)
    canopyMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      canopyMat.userData.shader = shader;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           #ifdef USE_INSTANCING
             vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
             float sway = sin(uTime * 1.3 + ip.x * 0.21 + ip.z * 0.17) * 0.05;
             transformed.x += sway * (position.y + 1.0);
             transformed.z += sway * 0.6 * (position.y + 1.0);
           #endif`,
        );
    };
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, this.canopies.length);
    this.canopies.forEach((m, i) => {
      canopies.setMatrixAt(i, m);
      canopies.setColorAt(i, this.colors[i]);
    });
    canopies.castShadow = true;
    canopies.receiveShadow = true;
    g.add(canopies);
    return { group: g, canopyMat };
  }
}

function buildLamps(list: Array<[number, number, number]>): THREE.Group {
  const g = new THREE.Group();
  g.name = 'lamps';
  const black = std(0x1b1c20, { rough: 0.5, metal: 0.4 });
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 4.4, 8), black, list.length);
  const base = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.26, 0.6, 8), black, list.length);
  const cage = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.18, 0.55, 6), black, list.length);
  const glow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.21, 10, 8), basic(0xffd890), list.length);
  const cap = new THREE.InstancedMesh(new THREE.ConeGeometry(0.34, 0.3, 6), black, list.length);
  const m = new THREE.Matrix4();
  list.forEach(([x, z], i) => {
    pole.setMatrixAt(i, m.makeTranslation(x, 2.2, z));
    base.setMatrixAt(i, m.makeTranslation(x, 0.3, z));
    cage.setMatrixAt(i, m.makeTranslation(x, 4.65, z));
    glow.setMatrixAt(i, m.makeTranslation(x, 4.62, z));
    cap.setMatrixAt(i, m.makeTranslation(x, 5.05, z));
  });
  pole.castShadow = true;
  g.add(pole, base, cage, glow, cap);
  return g;
}

function buildBunting(): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  const cols = [0xff8fc7, 0xffd84a, 0x7fe0b8, 0x7cc8f5, 0xb79cf0, 0xff9f43];
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.3, 0, 0, 0.3, 0, 0, 0, -0.55, 0], 3));
  tri.computeVertexNormals();
  for (let s = 60; s < ROUTE.length; s += 70) {
    if (ROUTE.cornerDistance(s) < 10) continue;
    const p = ROUTE.pose(s);
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const lat = -9 + (18 * i) / n;
      const sag = 1.2 * (1 - ((lat / 9) * (lat / 9)));
      const w = ROUTE.worldAt(s, lat);
      const g = tri.clone();
      const m = new THREE.Matrix4().makeRotationY(-p.heading).setPosition(w.x, 7.2 - sag, w.z);
      g.applyMatrix4(m);
      const c = new THREE.Color(cols[i % cols.length]);
      const arr = new Float32Array(9);
      for (let k = 0; k < 9; k += 3) {
        arr[k] = c.r;
        arr[k + 1] = c.g;
        arr[k + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      geos.push(g);
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  mesh.name = 'bunting';
  return mesh;
}

function welcomeArch(): THREE.Group {
  const g = new THREE.Group();
  const p = ROUTE.pose(ADDITIONS.welcomeArchS);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = -p.heading;
  const cream = std(PALETTE.cream, { rough: 0.8 });
  const gold = std(0xe8b630, { rough: 0.4, metal: 0.5 });
  for (const sx of [-1, 1]) {
    g.add(box(1.2, 8, 1.2, cream, sx * 8.2, 4, 0));
    g.add(box(1.5, 0.5, 1.5, gold, sx * 8.2, 8.2, 0));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), gold).translateX(sx * 8.2).translateY(8.8));
  }
  g.add(box(17.6, 1.6, 0.8, cream, 0, 7.4, 0));
  const t = signTexture('WELCOME TO MAIDENVILLE', { bg: '#2a9d8f', fg: '#ffffff', w: 1024, h: 110 });
  const signM = plane(16.4, 1.3, basic(0xffffff, { map: t }), 0, 7.4, -0.42);
  signM.rotation.y = Math.PI; // face Maddy as she runs toward it (she travels toward -z locally)
  g.add(signM);
  const back = plane(16.4, 1.3, basic(0xffffff, { map: t }), 0, 7.4, 0.42);
  g.add(back);
  return g;
}

function imaginationPark(): { group: THREE.Group; aabb: AABB } {
  const g = new THREE.Group();
  const s = ADDITIONS.parkS;
  const p = ROUTE.worldAt(s, 34);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = Math.atan2(-Math.cos(p.heading), -Math.sin(p.heading));
  // paved circle and paths
  const pave = std(0xe5d8c2, { rough: 1 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(14, 40), pave);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.05;
  disc.receiveShadow = true;
  g.add(disc);
  const path = plane(4, 10, pave, 0, 0.05, 19);
  path.rotation.x = -Math.PI / 2;
  g.add(path);
  // fountain
  g.add(cyl(3.2, 3.4, 0.7, std(0xd9cdb8), 0, 0.35, 0, 24));
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.9, 24), std(0x7cc8f5, { rough: 0.1, emissive: 0x2a7fb5, ei: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.72;
  g.add(water);
  g.add(cyl(0.3, 0.5, 2.2, std(0xd9cdb8), 0, 1.4, 0, 12));
  // giant crayon sculptures and a paint palette (imagination!)
  const crayon = (c: number, x: number, z: number, r: number) => {
    const grp = new THREE.Group();
    grp.add(cyl(0.5, 0.5, 5, std(c, { rough: 0.6 }), 0, 2.5, 0, 12));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 12), std(c, { rough: 0.6 }));
    tip.position.y = 5.6;
    grp.add(tip);
    grp.add(cyl(0.52, 0.52, 1.2, std(0xffffff), 0, 3.6, 0, 12));
    grp.position.set(x, 0, z);
    grp.rotation.z = r;
    return grp;
  };
  g.add(crayon(0xff6fae, -9, -6, 0.15), crayon(0x5fb8f0, -7, -9, -0.1), crayon(0xffd84a, 9, -7, -0.12), crayon(0x6be38a, 7.5, -10, 0.1));
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      (() => {
        const sh = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? 1.1 : 2.4;
          if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        return sh;
      })(),
      { depth: 0.5, bevelEnabled: false },
    ),
    std(0xffd84a, { rough: 0.35, metal: 0.4, emissive: 0x6a4a00, ei: 0.3 }),
  );
  star.position.set(0, 6.2, -10);
  star.castShadow = true;
  g.add(star, cyl(0.2, 0.25, 4.5, std(0x3a3a3a), 0, 2.25, -10.2, 8));
  // benches
  for (const a of [0.6, 2.2, 3.9, 5.5]) {
    const b = box(2.4, 0.5, 0.7, std(0x8a5a3a), Math.cos(a) * 11, 0.45, Math.sin(a) * 11);
    b.rotation.y = -a + Math.PI / 2;
    g.add(b);
  }
  // park sign
  const t = signTexture("MADDY'S IMAGINATION PARK", { bg: '#7fe0b8', fg: '#1b4d47', w: 1024, h: 140 });
  const signM = plane(10, 1.4, basic(0xffffff, { map: t }), 0, 2.2, 22.2);
  g.add(signM);
  g.add(box(10.4, 0.3, 0.3, std(0x5a4a3a), 0, 1.4, 22.05), box(0.3, 2.6, 0.3, std(0x5a4a3a), -5, 1.3, 22.05), box(0.3, 2.6, 0.3, std(0x5a4a3a), 5, 1.3, 22.05));
  for (let i = 0; i < 6; i++) {
    const fb = flowerBed(3, 1.2, i, Math.cos(i) * 17, Math.sin(i) * 17 - 2);
    g.add(fb);
  }
  return { group: g, aabb: rectAABB(p.x, p.z, g.rotation.y, 40, 58, 0) };
}

function celebrationPlaza(): { group: THREE.Group; aabb: AABB } {
  const g = new THREE.Group();
  const p = ROUTE.worldAt(ADDITIONS.plazaS, 24);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = Math.atan2(-Math.cos(p.heading), -Math.sin(p.heading));
  const pave = std(0xeadfcb, { rough: 1 });
  const d = new THREE.Mesh(new THREE.CircleGeometry(10, 32), pave);
  d.rotation.x = -Math.PI / 2;
  d.position.y = 0.05;
  d.receiveShadow = true;
  g.add(d);
  // little stage with a canopy
  g.add(box(8, 1, 4, std(0x8c5bd6, { rough: 0.6 }), 0, 0.5, -5));
  g.add(gable(8.6, 1.6, 4.4, std(0xff8fc7, { rough: 0.6 }), 0, 4, -5, 0.2));
  for (const sx of [-1, 1]) g.add(cyl(0.12, 0.12, 3, std(0xffffff), sx * 3.8, 2.5, -3.2, 8));
  // balloons
  const cols = [0xff8fc7, 0xffd84a, 0x7cc8f5, 0x7fe0b8, 0xb79cf0];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), std(cols[i % cols.length], { rough: 0.3 }));
    b.scale.y = 1.15;
    b.position.set(Math.cos(a) * 9, 3.2 + (i % 3) * 0.4, Math.sin(a) * 9);
    g.add(b);
    g.add(cyl(0.01, 0.01, 3, basic(0xffffff), Math.cos(a) * 9, 1.6, Math.sin(a) * 9, 3));
  }
  const t = signTexture('CELEBRATION PLAZA', { bg: '#ffd84a', fg: '#6b4bb3', w: 1024, h: 140 });
  g.add(plane(6.5, 0.9, basic(0xffffff, { map: t }), 0, 3.4, -2.75));
  return { group: g, aabb: rectAABB(p.x, p.z, 0, 22, 22, 0) };
}

function streetSign(x: number, z: number, text: string): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(cyl(0.06, 0.06, 3.4, std(0x2f3a2f), 0, 1.7, 0, 6));
  const t = signTexture(text, { bg: '#1f7a46', fg: '#ffffff', w: 512, h: 80, border: '#ffffff' });
  for (const r of [Math.PI / 4, Math.PI / 4 + Math.PI]) {
    const p = plane(2.6, 0.42, basic(0xffffff, { map: t }), 0, 3.2, 0);
    p.rotation.y = r;
    p.translateZ(0.01);
    g.add(p);
  }
  return g;
}

/** Friendly neighbors on the sidewalks: instanced bodies, heads and a waving arm each. */
function buildPeople(rng: Rng): { group: THREE.Group; set: PeopleSet } {
  const g = new THREE.Group();
  g.name = 'people';
  const spots: Array<{ x: number; z: number; yaw: number }> = [];
  const anchors = [...LANDMARKS.map((l) => ({ s: l.s, side: l.side })), { s: ADDITIONS.parkS, side: 1 }, { s: ADDITIONS.plazaS, side: 1 }, { s: 60, side: 1 }, { s: 180, side: 1 }, { s: 450, side: 1 }, { s: 960, side: -1 }];
  for (const a of anchors) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const s = a.s + rng.range(-14, 14);
      if (ROUTE.cornerDistance(s) < 4) continue;
      const p = ROUTE.worldAt(s, a.side * rng.range(9.6, 10.8));
      // face the course
      const yaw = Math.atan2(-Math.cos(p.heading) * a.side, -Math.sin(p.heading) * a.side);
      spots.push({ x: p.x, z: p.z, yaw });
    }
  }
  const n = spots.length;
  const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.75, 4, 10);
  const headGeo = new THREE.SphereGeometry(0.17, 12, 10);
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.45, 3, 6);
  armGeo.translate(0, 0.28, 0);
  const bodies = new THREE.InstancedMesh(bodyGeo, std(0xffffff, { rough: 0.8 }), n);
  const heads = new THREE.InstancedMesh(headGeo, std(0xffffff, { rough: 0.7 }), n);
  const arms = new THREE.InstancedMesh(armGeo, std(0xffffff, { rough: 0.8 }), n);
  const skin = [0x8d5a3b, 0x6b3f26, 0xc68a62, 0xe9c19d, 0x4e2f1d, 0xb07b55];
  const shirts = [0x3a6ea5, 0xe76f51, 0x2a9d8f, 0xe9c46a, 0x8c5bd6, 0xf4a3c0, 0x6b8f71];
  const m = new THREE.Matrix4();
  const armBase: THREE.Matrix4[] = [];
  const positions: THREE.Vector3[] = [];
  const phases: number[] = [];
  spots.forEach((sp, i) => {
    const scale = rng.range(0.85, 1.12);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.yaw);
    bodies.setMatrixAt(i, m.compose(new THREE.Vector3(sp.x, 0.6 * scale + 0.1, sp.z), q, new THREE.Vector3(scale, scale, scale)));
    bodies.setColorAt(i, new THREE.Color(rng.pick(shirts)));
    heads.setMatrixAt(i, m.compose(new THREE.Vector3(sp.x, 1.45 * scale + 0.1, sp.z), q, new THREE.Vector3(scale, scale, scale)));
    const sc = new THREE.Color(rng.pick(skin));
    heads.setColorAt(i, sc);
    arms.setColorAt(i, sc);
    // shoulder position (to the person's right)
    const right = new THREE.Vector3(-Math.cos(sp.yaw), 0, Math.sin(sp.yaw)).multiplyScalar(0.27 * scale);
    const base = new THREE.Matrix4().compose(new THREE.Vector3(sp.x + right.x, 1.1 * scale + 0.1, sp.z + right.z), q, new THREE.Vector3(scale, scale, scale));
    armBase.push(base);
    arms.setMatrixAt(i, base);
    positions.push(new THREE.Vector3(sp.x, 0, sp.z));
    phases.push(rng.range(0, 6.28));
  });
  bodies.castShadow = true;
  g.add(bodies, heads, arms);
  return { group: g, set: { arms, armBase, positions, phases } };
}
