// Vehicles, flower beds, obstacles and pickups. Vehicles are always parked outside the running course.

import * as THREE from 'three';
import { PALETTE } from '../config';
import { box, basic, cyl, sphere, std } from './kit';

const glassMat = () => std(0x6f93ad, { rough: 0.15, metal: 0.4, emissive: 0x1d2a38, ei: 0.4 });
import { painted, signTexture } from './textures';
import type { ObstacleKind, MissionItemKind, PowerupKind } from '../sim/types';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
wheelGeo.rotateZ(Math.PI / 2);

function wheels(g: THREE.Group, xs: number, zs: number[], r = 1) {
  const mat = std(0x1d1d20, { rough: 0.9 });
  for (const z of zs) {
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, mat);
      w.scale.setScalar(r);
      w.position.set(sx * xs, 0.36 * r, z);
      g.add(w);
    }
  }
}

/** Generic car, length along z. */
export function buildCar(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = std(color, { rough: 0.35, metal: 0.35 });
  g.add(box(1.8, 0.7, 4.2, body, 0, 0.7, 0));
  g.add(box(1.6, 0.62, 2.2, glassMat(), 0, 1.35, -0.2, false));
  g.add(box(1.62, 0.12, 2.25, body, 0, 1.7, -0.2));
  g.add(box(1.5, 0.15, 0.1, basic(0xfff2c0), 0, 0.8, 2.11, false));
  wheels(g, 0.82, [-1.3, 1.3]);
  return g;
}

export function buildPoliceCar(): THREE.Group {
  const g = buildCar(0xf4f4f2);
  g.add(box(1.82, 0.3, 2.2, std(0x2f4a7a, { rough: 0.4 }), 0, 0.8, 0));
  g.add(box(0.5, 0.18, 0.3, basic(0xff4a4a), -0.3, 1.82, -0.2, false));
  g.add(box(0.5, 0.18, 0.3, basic(0x4a7dff), 0.3, 1.82, -0.2, false));
  const t = signTexture('PD 67', { bg: '#2f4a7a', fg: '#ffffff', w: 256, h: 96 });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), basic(0xffffff, { map: t }));
    p.position.set(sx * 0.92, 0.82, 0);
    p.rotation.y = (sx * Math.PI) / 2;
    g.add(p);
  }
  return g;
}

export function buildFireEngine(): THREE.Group {
  const g = new THREE.Group();
  const red = std(PALETTE.emergencyRed, { rough: 0.4, metal: 0.2 });
  g.add(box(7.2, 1.6, 2.4, red, 0, 1.3, 0));
  g.add(box(2.0, 1.2, 2.4, red, 2.6, 2.6, 0));
  g.add(box(1.9, 0.8, 2.3, glassMat(), 3.0, 2.6, 0, false));
  g.add(box(5.0, 0.15, 0.6, std(0xd9d9d9, { metal: 0.7, rough: 0.3 }), -0.8, 2.3, 0));
  for (let i = 0; i < 9; i++) g.add(box(0.08, 0.15, 0.6, std(0xd9d9d9, { metal: 0.7, rough: 0.3 }), -3 + i * 0.55, 2.42, 0));
  g.add(box(0.4, 0.2, 0.6, basic(0xffe04a), 3.0, 3.3, 0, false));
  const t = signTexture('FD 118', { bg: '#ffffff', fg: '#d2342b', w: 256, h: 96 });
  for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), basic(0xffffff, { map: t }));
    p.position.set(-1, 1.3, sz * 1.21);
    if (sz < 0) p.rotation.y = Math.PI;
    g.add(p);
  }
  for (const x of [-2.5, 2.4]) {
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, std(0x1d1d20));
      w.rotation.y = Math.PI / 2;
      w.scale.setScalar(1.25);
      w.position.set(x, 0.45, sz * 1.15);
      g.add(w);
    }
  }
  return g;
}

export function buildSchoolBus(): THREE.Group {
  const g = new THREE.Group();
  const yellow = std(0xf5b912, { rough: 0.45 });
  g.add(box(2.5, 2.2, 9, yellow, 0, 1.55, 0));
  g.add(box(2.4, 1.3, 1.4, yellow, 0, 1.1, 5.1));
  for (const sx of [-1, 1]) g.add(box(0.05, 0.8, 7.6, glassMat(), sx * 1.26, 2.1, -0.4, false));
  g.add(box(2.52, 0.12, 9, std(0x1e1e1e), 0, 1.5, 0));
  const t = signTexture('SCHOOL BUS', { bg: '#f5b912', fg: '#1e1e1e', w: 512, h: 96 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.42), basic(0xffffff, { map: t }));
  p.position.set(0, 2.45, 4.52);
  g.add(p);
  wheels(g, 1.15, [-3, 3.6], 1.15);
  return g;
}

const FLOWER_COLORS = [0xff7fb8, 0xffd84a, 0xb79cf0, 0xff6b6b, 0xffffff, 0xff9f43];
const blossomGeo = new THREE.IcosahedronGeometry(0.14, 0);

/** A raised flower bed with mixed blossoms (instanced). */
export function flowerBed(w: number, d: number, variant: number, x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(box(w, 0.3, d, std(0x9a7b5c, { rough: 1 }), 0, 0.15, 0));
  g.add(box(w - 0.15, 0.08, d - 0.15, std(0x4a3626, { rough: 1 }), 0, 0.3, 0));
  const n = Math.floor(w * d * 7);
  const inst = new THREE.InstancedMesh(blossomGeo, std(0xffffff, { rough: 0.7 }), n);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  let seed = 31 + variant * 17;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    m.makeTranslation((r() - 0.5) * (w - 0.3), 0.38 + r() * 0.12, (r() - 0.5) * (d - 0.3));
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c.setHex(FLOWER_COLORS[(i + variant) % FLOWER_COLORS.length]));
  }
  g.add(inst);
  const leaves = new THREE.InstancedMesh(blossomGeo, std(0x3f7d2c, { rough: 0.9 }), Math.floor(n / 2));
  for (let i = 0; i < leaves.count; i++) {
    m.makeScale(1.4, 0.8, 1.4).setPosition((r() - 0.5) * (w - 0.3), 0.33, (r() - 0.5) * (d - 0.3));
    leaves.setMatrixAt(i, m);
  }
  g.add(leaves);
  return g;
}

// ------------------------------------------------------------------ Obstacles (friendly, padded, readable)

function floorMark(kind: 'jump' | 'slide' | 'block', width: number): THREE.Mesh {
  const t = painted(`mark-${kind}`, 256, 256, (gg, w, h) => {
    gg.clearRect(0, 0, w, h);
    const col = kind === 'jump' ? '#ffd84a' : kind === 'slide' ? '#5fc8ff' : '#ff8a5c';
    gg.fillStyle = col;
    gg.globalAlpha = 0.9;
    if (kind === 'block') {
      for (let i = -2; i < 6; i++) {
        gg.beginPath();
        gg.moveTo(i * 60, h);
        gg.lineTo(i * 60 + 30, h);
        gg.lineTo(i * 60 + 30 + h * 0.6, 0);
        gg.lineTo(i * 60 + h * 0.6, 0);
        gg.fill();
      }
    } else {
      // chevrons: up for jump, down for slide
      for (let k = 0; k < 2; k++) {
        const y = h * (0.25 + k * 0.4);
        const dir = kind === 'jump' ? -1 : 1;
        gg.beginPath();
        gg.moveTo(w * 0.15, y - dir * h * 0.12);
        gg.lineTo(w / 2, y + dir * h * 0.12);
        gg.lineTo(w * 0.85, y - dir * h * 0.12);
        gg.lineTo(w * 0.85, y - dir * h * 0.12 + h * 0.1);
        gg.lineTo(w / 2, y + dir * h * 0.12 + h * 0.1);
        gg.lineTo(w * 0.15, y - dir * h * 0.12 + h * 0.1);
        gg.fill();
      }
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, 2.2), basic(0xffffff, { map: t, transparent: true }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.1;
  return m;
}

/** Build one obstacle mesh. Local +z points back toward Maddy (she approaches from +z... see entities.ts). */
export function buildObstacle(kind: ObstacleKind, length = 1): THREE.Group {
  const g = new THREE.Group();
  const LW = 2.2;
  switch (kind) {
    case 'hurdle': {
      // foam event hurdle: soft striped bar on padded feet
      const stripes = painted('hurdle-bar', 256, 32, (gg, w, h) => {
        for (let i = 0; i < 8; i++) {
          gg.fillStyle = i % 2 ? '#ffffff' : '#ff6fae';
          gg.fillRect((i * w) / 8, 0, w / 8, h);
        }
      });
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, LW - 0.3, 4, 12), std(0xffffff, { map: stripes, rough: 0.7 }));
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 0.6;
      bar.castShadow = true;
      g.add(bar);
      for (const sx of [-1, 1]) {
        g.add(box(0.2, 0.55, 0.2, std(0xffd84a, { rough: 0.7 }), sx * (LW / 2 - 0.15), 0.3, 0));
        g.add(box(0.3, 0.12, 0.8, std(0xffd84a, { rough: 0.7 }), sx * (LW / 2 - 0.15), 0.06, 0));
      }
      const m = floorMark('jump', LW);
      m.position.z = 2.2;
      g.add(m);
      break;
    }
    case 'arch': {
      // low festival arch: pastel posts and a bunting banner hanging low — slide under it
      const post = std(0xb79cf0, { rough: 0.6 });
      for (const sx of [-1, 1]) g.add(cyl(0.12, 0.14, 2.6, post, sx * (LW / 2), 1.3, 0, 10));
      const top = new THREE.Mesh(new THREE.TorusGeometry(LW / 2, 0.12, 8, 24, Math.PI), post);
      top.position.y = 2.6;
      top.castShadow = true;
      g.add(top);
      const banner = painted('arch-banner', 512, 128, (gg, w, h) => {
        const cols = ['#ff8fc7', '#ffd84a', '#7fe0b8', '#7cc8f5', '#b79cf0'];
        gg.fillStyle = '#fff6e8';
        gg.fillRect(0, 0, w, h);
        for (let i = 0; i < 10; i++) {
          gg.fillStyle = cols[i % cols.length];
          gg.beginPath();
          gg.moveTo((i * w) / 10, 0);
          gg.lineTo(((i + 1) * w) / 10, 0);
          gg.lineTo(((i + 0.5) * w) / 10, h * 0.55);
          gg.fill();
        }
        gg.fillStyle = '#6b4bb3';
        gg.font = `900 ${h * 0.32}px Arial Black, Arial`;
        gg.textAlign = 'center';
        gg.fillText('SLIDE!', w / 2, h * 0.9);
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(LW, 1.15, 0.12), std(0xffffff, { map: banner, rough: 0.8 }));
      b.position.y = 1.62;
      b.castShadow = true;
      g.add(b);
      const m = floorMark('slide', LW);
      m.position.z = 2.2;
      g.add(m);
      break;
    }
    case 'parcel': {
      // padded parcel stack
      const tape = painted('parcel', 128, 128, (gg, w, h) => {
        gg.fillStyle = '#d9a86c';
        gg.fillRect(0, 0, w, h);
        gg.fillStyle = '#c38d4f';
        gg.fillRect(w * 0.42, 0, w * 0.16, h);
        gg.fillStyle = '#ff6fae';
        gg.beginPath();
        gg.arc(w * 0.75, h * 0.3, 10, 0, Math.PI * 2);
        gg.fill();
      });
      const mat = std(0xffffff, { map: tape, rough: 0.85 });
      const pad = std(0x7cc8f5, { rough: 0.9 });
      g.add(box(1.9, 0.75, 1.3, mat, 0, 0.38, 0));
      g.add(box(1.5, 0.6, 1.1, mat, 0.1, 1.05, 0.05));
      g.add(box(0.9, 0.45, 0.8, mat, -0.2, 1.57, 0));
      g.add(box(2.0, 0.12, 1.4, pad, 0, 0.06, 0));
      const m = floorMark('block', LW);
      m.position.z = 1.9;
      g.add(m);
      break;
    }
    case 'puddle': {
      const water = new THREE.Mesh(new THREE.CircleGeometry(1, 28), std(0x6fc3ef, { rough: 0.08, metal: 0.3, emissive: 0x1d5a80, ei: 0.35 }));
      water.scale.set(1.0, 1.0, 1);
      water.rotation.x = -Math.PI / 2;
      water.scale.set(1.0, 1.05, 1);
      water.position.y = 0.1;
      g.add(water);
      const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 28), basic(0xdaf3ff));
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.105;
      g.add(rim);
      // a friendly rubber duck at the edge (outside the jump line)
      const duck = std(0xffd84a, { rough: 0.5 });
      g.add(sphere(0.16, duck, 0.75, 0.14, -0.3, 10, 8));
      g.add(sphere(0.1, duck, 0.82, 0.3, -0.22, 8, 6));
      const m = floorMark('jump', LW);
      m.position.z = 2.4;
      g.add(m);
      break;
    }
    case 'closed': {
      // clearly marked closed event lane: barrier boards with cones along its length
      const sign = signTexture('LANE CLOSED FOR FUN', { bg: '#ffffff', fg: '#ff6b3d', w: 1024, h: 160, border: '#ff6b3d' });
      const front = new THREE.Mesh(new THREE.BoxGeometry(LW, 1.1, 0.15), [std(0xff8a5c), std(0xff8a5c), std(0xff8a5c), std(0xff8a5c), std(0xffffff, { map: sign }), std(0xffffff, { map: sign })]);
      front.position.set(0, 0.85, length / 2);
      front.castShadow = true;
      g.add(front);
      const stripe = painted('closed-stripe', 256, 32, (gg, w, h) => {
        for (let i = 0; i < 10; i++) {
          gg.fillStyle = i % 2 ? '#ffffff' : '#ff8a5c';
          gg.fillRect((i * w) / 10, 0, w / 10, h);
        }
      });
      const smat = std(0xffffff, { map: stripe, rough: 0.7 });
      for (const sx of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, length), smat);
        rail.position.set(sx * (LW / 2 - 0.1), 0.7, 0);
        g.add(rail);
      }
      const cone = std(0xff7a3d, { rough: 0.6 });
      for (let z = -length / 2 + 0.6; z <= length / 2 - 0.4; z += 2.4) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 12), cone);
        c.position.set(0, 0.38, z);
        c.castShadow = true;
        g.add(c);
      }
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(LW, length), basic(0xffb08a, { transparent: true, opacity: 0.55 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.09;
      g.add(floor);
      const m = floorMark('block', LW);
      m.position.z = length / 2 + 1.6;
      g.add(m);
      break;
    }
  }
  return g;
}

// ------------------------------------------------------------------ Pickups

const LETTER_COLORS = [0xff7fb8, 0xb79cf0, 0x7cc8f5, 0x7fe0b8, 0xffd84a];

export function buildLetter(index: number): THREE.Group {
  const letter = 'MADDY'[index] ?? 'M';
  const g = new THREE.Group();
  const t = painted(`letter-${index}`, 256, 256, (gg, w, h) => {
    gg.clearRect(0, 0, w, h);
    gg.fillStyle = '#' + LETTER_COLORS[index].toString(16).padStart(6, '0');
    gg.beginPath();
    gg.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
    gg.fill();
    gg.strokeStyle = '#ffffff';
    gg.lineWidth = 14;
    gg.stroke();
    gg.fillStyle = '#ffffff';
    gg.font = `900 ${h * 0.62}px "Arial Black", Arial`;
    gg.textAlign = 'center';
    gg.textBaseline = 'middle';
    gg.fillText(letter, w / 2, h * 0.54);
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 32), [std(LETTER_COLORS[index], { rough: 0.4, emissive: LETTER_COLORS[index], ei: 0.25 }), std(0xffffff, { map: t, emissive: 0xffffff, ei: 0.15 }), std(0xffffff, { map: t, emissive: 0xffffff, ei: 0.15 })]);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  return g;
}

export function buildPowerup(kind: PowerupKind): THREE.Group {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 32), basic(0xffffff, { transparent: true, opacity: 0.8 }));
  g.add(halo);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), std(0xdff4ff, { rough: 0.1, metal: 0.1, emissive: 0x9fd6ff, ei: 0.35 }));
  (bubble.material as THREE.MeshStandardMaterial).transparent = true;
  (bubble.material as THREE.MeshStandardMaterial).opacity = 0.35;
  g.add(bubble);
  switch (kind) {
    case 'magnet': {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 16, Math.PI), std(0xe2483d, { rough: 0.4 }));
      m.rotation.z = Math.PI;
      g.add(m);
      for (const sx of [-1, 1]) g.add(box(0.16, 0.14, 0.16, std(0xf0f0f0, { metal: 0.6, rough: 0.3 }), sx * 0.25, 0.04, 0));
      break;
    }
    case 'shield':
      g.add(sphere(0.3, std(0x7cc8f5, { rough: 0.1, emissive: 0x2a7fb5, ei: 0.5 }), 0, 0, 0, 16, 12));
      break;
    case 'rainbow': {
      const cols = [0xff6b6b, 0xffb84a, 0xffe14a, 0x6be38a, 0x5fb8f0, 0xb79cf0];
      cols.forEach((c, i) => {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.36 - i * 0.045, 0.024, 6, 20, Math.PI), basic(c));
        arc.position.y = -0.12;
        g.add(arc);
      });
      break;
    }
    case 'glide': {
      const wing = std(0xfff6e8, { rough: 0.6 });
      const s = new THREE.Shape();
      s.moveTo(0, 0.35);
      s.lineTo(0.38, -0.25);
      s.lineTo(0, -0.1);
      s.lineTo(-0.38, -0.25);
      s.closePath();
      const pl = new THREE.Mesh(new THREE.ShapeGeometry(s), wing);
      (pl.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      g.add(pl);
      g.add(box(0.04, 0.5, 0.08, std(0xff8fc7), 0, 0.02, 0.02));
      break;
    }
  }
  return g;
}

export function buildMissionItem(kind: MissionItemKind): THREE.Group {
  const g = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 8, 32), basic(0x7fe0b8));
  glow.rotation.x = Math.PI / 2;
  glow.position.y = -0.8;
  g.add(glow);
  switch (kind) {
    case 'book':
      g.add(box(0.7, 0.16, 0.5, std(0x3d6fd6), 0, 0, 0));
      g.add(box(0.66, 0.12, 0.46, std(0xfffaf0), 0.03, 0.0, 0));
      g.add(box(0.1, 0.17, 0.5, std(0xffd84a), -0.3, 0, 0));
      break;
    case 'card':
      g.add(box(0.6, 0.42, 0.05, std(0xffe3ef), 0, 0, 0));
      g.add(sphere(0.09, std(0xff4f8b), 0, 0, 0.04, 10, 8));
      break;
    case 'flowers': {
      g.add(cyl(0.05, 0.12, 0.5, std(0x4f9a3a), 0, -0.1, 0, 8));
      const cols = [0xff7fb8, 0xffd84a, 0xb79cf0, 0xff6b6b, 0xffffff];
      cols.forEach((c, i) => g.add(sphere(0.12, std(c), Math.cos(i * 1.25) * 0.14, 0.22 + (i % 2) * 0.06, Math.sin(i * 1.25) * 0.14, 8, 6)));
      break;
    }
    case 'gift':
      g.add(box(0.6, 0.5, 0.6, std(0xcc1a24, { rough: 0.5 }), 0, 0, 0));
      g.add(box(0.62, 0.52, 0.12, std(0xffffff), 0, 0, 0));
      g.add(box(0.12, 0.52, 0.62, std(0xffffff), 0, 0, 0));
      break;
  }
  return g;
}

/** Five-point star geometry (shared by the instanced Maiden Stars). */
export function starGeometry(r = 0.38, depth = 0.12): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}
