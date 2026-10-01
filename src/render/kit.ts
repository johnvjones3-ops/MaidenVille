// Small geometry kit shared by landmark, prop and city builders.

import * as THREE from 'three';

const matCache = new Map<string, THREE.Material>();

export function std(color: number, opts: { rough?: number; metal?: number; emissive?: number; ei?: number; map?: THREE.Texture } = {}): THREE.MeshStandardMaterial {
  const key = `std:${color}:${opts.rough}:${opts.metal}:${opts.emissive}:${opts.ei}:${opts.map?.uuid}`;
  let m = matCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.8,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.ei ?? 1,
      map: opts.map ?? null,
    });
    matCache.set(key, m);
  }
  return m;
}

export function basic(color: number, opts: { map?: THREE.Texture; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}): THREE.MeshBasicMaterial {
  const key = `basic:${color}:${opts.map?.uuid}:${opts.transparent}:${opts.opacity}:${opts.side}`;
  let m = matCache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, map: opts.map ?? null, transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide });
    matCache.set(key, m);
  }
  return m;
}

/** Lit window glass: warm and bright at golden hour. */
export const glowMat = () => basic(0xffc56b);
export const glassMat = () => std(0xbfe6ff, { rough: 0.15, metal: 0.3, emissive: 0xfff1cf, ei: 0.55 });

export function box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** Gable roof prism: ridge runs along z (front-to-back), triangle faces ±z. Base sits at y = 0. */
export function gableGeometry(w: number, h: number, d: number, overhang = 0.4): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - overhang, 0);
  s.lineTo(w / 2 + overhang, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d + overhang * 2, bevelEnabled: false });
  geo.translate(0, 0, -(d + overhang * 2) / 2);
  geo.computeVertexNormals();
  return geo;
}

export function gable(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, overhang = 0.4): THREE.Mesh {
  const m = new THREE.Mesh(gableGeometry(w, h, d, overhang), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A pentagon front (rectangle + triangle) with UVs normalised to its bounds, for painted facades. */
export function gableFront(w: number, wallH: number, roofH: number, mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, wallH);
  s.lineTo(0, wallH + roofH);
  s.lineTo(-w / 2, wallH);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const H = wallH + roofH;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / H);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

export function plane(w: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  return m;
}

export function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 12): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, ws = 12, hs = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Merge all meshes in a group that share a material into single meshes (fewer draw calls). */
export function mergeByMaterial(group: THREE.Group, mergeFn: (geos: THREE.BufferGeometry[]) => THREE.BufferGeometry | null): THREE.Group {
  group.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>();
  const keep: THREE.Object3D[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material) || (m as any).isInstancedMesh || m.userData.noMerge) {
      if (m.isMesh) keep.push(m);
      return;
    }
    const g = m.geometry.clone();
    if (g.index) {
      /* mergeGeometries needs consistent indexing */
    }
    g.applyMatrix4(m.matrixWorld);
    const b = buckets.get(m.material) ?? { geos: [], cast: false };
    b.geos.push(g);
    b.cast = b.cast || m.castShadow;
    buckets.set(m.material, b);
  });
  const out = new THREE.Group();
  out.name = group.name;
  for (const [mat, b] of buckets) {
    const nonIndexed = b.geos.map((g) => (g.index ? g.toNonIndexed() : g));
    // keep only shared attributes
    for (const g of nonIndexed) {
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
    }
    const merged = mergeFn(nonIndexed);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const k of keep) {
    k.updateMatrixWorld(true);
    const clone = k.clone();
    k.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    out.add(clone);
  }
  return out;
}
