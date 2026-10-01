// CharacterBuilder + CharacterAnimator for Maddy Maiden.
// An articulated, hand-modelled rig: two fluffy puffs with a centre part, painted face, navy tee,
// jeans and dark sneakers with light soles. All colours come from MADDY_LOOK so the likeness is easy to refine,
// and the whole rig can be swapped for an imported model by replacing buildMaddy().

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COSMETICS, MADDY_LOOK, type CosmeticCategory } from '../config';
import { damp } from '../core/rng';
import { faceTexture, hairTexture, shirtTexture } from './textures';

export type AnimState = 'idle' | 'wave' | 'run' | 'jump' | 'slide' | 'stumble' | 'celebrate' | 'glide' | 'preview';

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  thighL: THREE.Group;
  thighR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  puffL: THREE.Group;
  puffR: THREE.Group;
  mats: {
    shirt: THREE.MeshStandardMaterial;
    sleeve: THREE.MeshStandardMaterial;
    forearm: THREE.MeshStandardMaterial;
    sneaker: THREE.MeshStandardMaterial;
    tie: THREE.MeshStandardMaterial;
  };
  accessories: { stars: THREE.Group; flowers: THREE.Group };
  wings: THREE.Group;
  shield: THREE.Mesh;
  magnetRing: THREE.Mesh;
}

function g(name: string, x = 0, y = 0, z = 0): THREE.Group {
  const o = new THREE.Group();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Fluffy puff: a displaced icosphere for an afro-textured silhouette. */
function puffGeometry(r: number, seed: number): THREE.BufferGeometry {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(r, 4).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    const bump =
      Math.sin(n.x * 9 + seed) * Math.sin(n.y * 8 + seed * 2) * Math.sin(n.z * 7 + seed * 3) * 0.08 +
      Math.sin(n.x * 21 + n.y * 17 + seed) * 0.025;
    v.copy(n.multiplyScalar(r * (1 + bump)));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function starShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export function buildMaddy(): Rig {
  const L = MADDY_LOOK;
  const skin = new THREE.MeshStandardMaterial({ color: L.skin, roughness: 0.62 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: hairTexture(), roughness: 0.95 });
  const puffMat = new THREE.MeshStandardMaterial({ color: L.hair, roughness: 1 });
  const jeans = new THREE.MeshStandardMaterial({ color: L.jeans, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xffffff, map: shirtTexture('knights', L.shirt), roughness: 0.8 });
  const sleeve = new THREE.MeshStandardMaterial({ color: L.shirt, roughness: 0.8 });
  const forearm = skin;
  const sneaker = new THREE.MeshStandardMaterial({ color: L.sneaker, roughness: 0.55 });
  const sole = new THREE.MeshStandardMaterial({ color: L.sneakerSole, roughness: 0.7 });
  const tie = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.5, metalness: 0.1 });
  const earring = new THREE.MeshStandardMaterial({ color: L.earring, roughness: 0.25, metalness: 0.7 });

  const root = g('maddy');
  const body = g('body');
  root.add(body);
  const hips = g('hips', 0, 0.585, 0);
  body.add(hips);
  hips.add(mesh(new THREE.CylinderGeometry(0.135, 0.13, 0.14, 16), jeans, 0, 0.0, 0));

  // --- legs
  const leg = (side: 1 | -1) => {
    const thigh = g(side > 0 ? 'thighL' : 'thighR', 0.068 * side, -0.02, 0);
    hips.add(thigh);
    thigh.add(mesh(new THREE.CylinderGeometry(0.07, 0.058, 0.27, 12), jeans, 0, -0.135, 0));
    const knee = g('knee', 0, -0.265, 0);
    thigh.add(knee);
    knee.add(mesh(new THREE.CylinderGeometry(0.058, 0.055, 0.25, 12), jeans, 0, -0.125, 0));
    const foot = g('foot', 0, -0.25, 0);
    knee.add(foot);
    const shoe = mesh(new THREE.CapsuleGeometry(0.048, 0.1, 4, 10), sneaker, 0, -0.025, 0.035);
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.set(1.05, 1, 0.8);
    foot.add(shoe);
    const soleM = mesh(new THREE.BoxGeometry(0.1, 0.022, 0.2), sole, 0, -0.058, 0.035);
    foot.add(soleM);
    const lace = mesh(new THREE.BoxGeometry(0.05, 0.01, 0.06), sole, 0, 0.012, 0.06);
    foot.add(lace);
    return { thigh, knee, foot };
  };
  const lL = leg(1);
  const lR = leg(-1);

  // --- torso
  const spine = g('spine', 0, 0.05, 0);
  hips.add(spine);
  const torsoGeo = new THREE.CylinderGeometry(0.14, 0.135, 0.36, 24, 1, false, -Math.PI / 2, Math.PI * 2);
  const torso = mesh(torsoGeo, shirt, 0, 0.17, 0);
  torso.scale.set(1, 1, 0.78);
  spine.add(torso);
  const shoulders = mesh(new THREE.SphereGeometry(0.14, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), sleeve, 0, 0.345, 0);
  shoulders.scale.set(1, 0.42, 0.78);
  spine.add(shoulders);

  // --- arms
  const arm = (side: 1 | -1) => {
    const sh = g(side > 0 ? 'shoulderL' : 'shoulderR', 0.165 * side, 0.32, 0);
    spine.add(sh);
    sh.add(mesh(new THREE.SphereGeometry(0.058, 12, 10), sleeve, 0, -0.01, 0));
    sh.add(mesh(new THREE.CylinderGeometry(0.057, 0.053, 0.11, 12), sleeve, 0, -0.06, 0));
    sh.add(mesh(new THREE.CylinderGeometry(0.042, 0.039, 0.12, 10), skin, 0, -0.14, 0));
    const el = g('elbow', 0, -0.2, 0);
    sh.add(el);
    el.add(mesh(new THREE.CylinderGeometry(0.039, 0.035, 0.17, 10), forearm, 0, -0.085, 0));
    el.add(mesh(new THREE.SphereGeometry(0.047, 12, 10), skin, 0, -0.19, 0));
    return { sh, el };
  };
  const aL = arm(1);
  const aR = arm(-1);

  // --- head
  const neck = g('neck', 0, 0.37, 0);
  spine.add(neck);
  neck.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), skin, 0, 0.03, 0));
  const head = g('head', 0, 0.215, 0.005);
  head.scale.setScalar(1.1); // larger head for childlike proportions
  neck.add(head);
  const headMesh = mesh(new THREE.SphereGeometry(0.15, 40, 28), faceMat);
  headMesh.scale.set(1, 1.04, 0.97);
  head.add(headMesh);
  // ears + stud earrings
  for (const sx of [1, -1]) {
    const ear = mesh(new THREE.SphereGeometry(0.03, 10, 8), skin, 0.145 * sx, -0.01, -0.005);
    ear.scale.set(0.6, 1, 0.8);
    head.add(ear);
    head.add(mesh(new THREE.SphereGeometry(0.011, 8, 6), earring, 0.158 * sx, -0.04, 0.005));
  }
  // hair cap with a centre part, tilted back so the forehead shows
  const cap = mesh(new THREE.SphereGeometry(0.162, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, 0, 0.004, -0.004);
  cap.rotation.x = -0.5;
  cap.scale.set(1.02, 1.04, 1.02);
  head.add(cap);
  // centre part line (thin skin strip from the hairline back over the crown)
  const part = mesh(new THREE.TorusGeometry(0.1655, 0.004, 4, 48, Math.PI * 0.86), new THREE.MeshStandardMaterial({ color: L.skinShade, roughness: 0.8 }));
  part.rotation.y = Math.PI / 2;
  part.position.set(0, 0.004, -0.004);
  part.castShadow = false;
  head.add(part);
  // neatly styled front sections sweeping toward each puff
  for (const sx of [1, -1]) {
    const sweep = mesh(new THREE.SphereGeometry(0.075, 16, 12), hairMat, 0.075 * sx, 0.1, 0.07);
    sweep.scale.set(1.15, 0.55, 0.9);
    sweep.rotation.z = -0.5 * sx;
    head.add(sweep);
  }

  // two fluffy puffs
  const puff = (side: 1 | -1) => {
    const pivot = g(side > 0 ? 'puffL' : 'puffR', 0.1 * side, 0.115, -0.03);
    head.add(pivot);
    const ball = mesh(puffGeometry(0.11, side > 0 ? 1.3 : 4.1), puffMat, 0.065 * side, 0.075, -0.01);
    ball.scale.set(1.0, 0.95, 0.95);
    pivot.add(ball);
    const band = mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), tie, 0.012 * side, 0.012, 0);
    band.rotation.set(Math.PI / 2, 0, 0.8 * side);
    pivot.add(band);
    return pivot;
  };
  const puffL = puff(1);
  const puffR = puff(-1);

  // accessories (toggled by the closet; never cover the puffs)
  const stars = new THREE.Group();
  const flowers = new THREE.Group();
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.03), { depth: 0.01, bevelEnabled: false });
  const starMat = new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0x6a4a00, roughness: 0.3, metalness: 0.4 });
  const petal = new THREE.MeshStandardMaterial({ color: 0xff8fc7, roughness: 0.6 });
  const centre = new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.6 });
  for (const sx of [1, -1]) {
    const st = mesh(starGeo, starMat, 0.105 * sx, 0.12, 0.035);
    st.rotation.y = 0.5 * sx;
    stars.add(st);
    const fl = new THREE.Group();
    fl.position.set(0.11 * sx, 0.125, 0.03);
    for (let i = 0; i < 5; i++) {
      const p = mesh(new THREE.SphereGeometry(0.014, 8, 6), petal, Math.cos((i / 5) * Math.PI * 2) * 0.017, Math.sin((i / 5) * Math.PI * 2) * 0.017, 0);
      fl.add(p);
    }
    fl.add(mesh(new THREE.SphereGeometry(0.011, 8, 6), centre, 0, 0, 0.006));
    fl.rotation.y = 0.4 * sx;
    flowers.add(fl);
  }
  head.add(stars, flowers);

  // Imagination Glide wings (paper-craft rainbow wings), hidden by default
  const wings = new THREE.Group();
  const wingColors = [0xff8fc7, 0xffd84a, 0x7fe0b8, 0x7cc8f5, 0xb79cf0];
  for (const sx of [1, -1]) {
    wingColors.forEach((c, i) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(0.55 * sx, 0.18 - i * 0.06);
      shape.lineTo(0.5 * sx, 0.05 - i * 0.06);
      shape.closePath();
      const w = mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.6, emissive: c, emissiveIntensity: 0.15 }), 0, 0.28 - i * 0.012, -0.12);
      wings.add(w);
    });
  }
  wings.visible = false;
  spine.add(wings);

  // Bubble shield + magnet ring
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 32, 20),
    new THREE.MeshStandardMaterial({ color: 0x9fe3ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, emissive: 0x3aa0d0, emissiveIntensity: 0.25, depthWrite: false }),
  );
  shield.position.y = 0.7;
  shield.visible = false;
  root.add(shield);
  const magnetRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.85 }));
  magnetRing.rotation.x = Math.PI / 2;
  magnetRing.position.y = 0.05;
  magnetRing.visible = false;
  root.add(magnetRing);

  return {
    root,
    body,
    hips,
    spine,
    neck,
    head,
    thighL: lL.thigh,
    thighR: lR.thigh,
    kneeL: lL.knee,
    kneeR: lR.knee,
    footL: lL.foot,
    footR: lR.foot,
    shoulderL: aL.sh,
    shoulderR: aR.sh,
    elbowL: aL.el,
    elbowR: aR.el,
    puffL,
    puffR,
    mats: { shirt, sleeve, forearm: forearm as THREE.MeshStandardMaterial, sneaker, tie },
    accessories: { stars, flowers },
    wings,
    shield,
    magnetRing,
  };
}

/** Apply equipped cosmetics to the rig. */
export function applyOutfit(rig: Rig, equipped: Record<CosmeticCategory, string>) {
  const L = MADDY_LOOK;
  const outfit = COSMETICS.find((c) => c.id === equipped.outfit);
  const kind = outfit?.id === 'outfit_maddy' ? 'maddy' : outfit?.id === 'outfit_explorer' ? 'explorer' : 'knights';
  const base = kind === 'knights' ? L.shirt : outfit!.color!;
  rig.mats.shirt.map = shirtTexture(kind, base);
  rig.mats.shirt.needsUpdate = true;
  rig.mats.sleeve.color.setHex(base);
  // Explorer jacket has long sleeves
  const forearmMeshes: THREE.Mesh[] = [];
  for (const el of [rig.elbowL, rig.elbowR]) forearmMeshes.push(el.children[0] as THREE.Mesh);
  for (const m of forearmMeshes) {
    m.material = kind === 'explorer' ? rig.mats.sleeve : (rig.elbowL.children[1] as THREE.Mesh).material;
  }
  const sn = COSMETICS.find((c) => c.id === equipped.sneakers);
  rig.mats.sneaker.color.setHex(sn?.color ?? L.sneaker);
  const acc = COSMETICS.find((c) => c.id === equipped.accessory);
  rig.mats.tie.color.setHex(acc?.id === 'acc_gold' ? 0xffc93c : acc?.id === 'acc_flowers' ? 0xff8fc7 : acc?.id === 'acc_stars' ? 0xffd84a : 0x2a2a35);
  rig.mats.tie.metalness = acc?.id === 'acc_gold' ? 0.6 : 0.1;
  rig.accessories.stars.visible = acc?.id === 'acc_stars';
  rig.accessories.flowers.visible = acc?.id === 'acc_flowers';
}

export interface AnimInput {
  state: AnimState;
  speed: number;
  lean: number; // -1..1 (positive = moving right)
  vy: number;
  airborne: boolean;
  reducedMotion: boolean;
}

const JOINTS = ['thighL', 'thighR', 'kneeL', 'kneeR', 'footL', 'footR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'spine', 'neck', 'head'] as const;
type Joint = (typeof JOINTS)[number];

/** Procedural animator: computes a target pose per state and blends smoothly between them. */
export class CharacterAnimator {
  phase = 0;
  private t = 0;
  private puffVel = [0, 0];
  private puffAng = [0, 0];
  private prevBodyY = 0;
  private bodyY = 0;
  private bodyRoll = 0;
  private bodyPitch = 0;
  private target: Record<Joint, THREE.Vector3> = Object.fromEntries(JOINTS.map((j) => [j, new THREE.Vector3()])) as any;

  constructor(private rig: Rig) {}

  update(dt: number, inp: AnimInput) {
    this.t += dt;
    const r = this.rig;
    const T = this.target;
    for (const j of JOINTS) T[j].set(0, 0, 0);
    let bodyY = 0;
    let roll = 0;
    let pitch = 0;

    switch (inp.state) {
      case 'run':
      case 'stumble': {
        this.phase += dt * (2.2 + inp.speed * 0.42);
        const p = this.phase;
        const sw = 0.78;
        T.thighL.x = -Math.sin(p) * sw;
        T.thighR.x = Math.sin(p) * sw;
        T.kneeL.x = Math.max(0, Math.sin(p - 1.2)) * 1.25 + 0.15;
        T.kneeR.x = Math.max(0, -Math.sin(p - 1.2)) * 1.25 + 0.15;
        T.footL.x = -0.2 + Math.max(0, Math.sin(p)) * 0.3;
        T.footR.x = -0.2 + Math.max(0, -Math.sin(p)) * 0.3;
        T.shoulderL.x = Math.sin(p) * 0.75;
        T.shoulderR.x = -Math.sin(p) * 0.75;
        T.shoulderL.z = 0.12;
        T.shoulderR.z = -0.12;
        T.elbowL.x = -1.25;
        T.elbowR.x = -1.25;
        T.spine.x = 0.14;
        T.spine.y = Math.sin(p) * 0.12;
        T.head.x = -0.08;
        bodyY = Math.abs(Math.cos(p)) * 0.05;
        roll = inp.lean * 0.28;
        if (inp.state === 'stumble') {
          const w = Math.sin(this.t * 22);
          T.spine.z = w * 0.25;
          T.head.z = -w * 0.2;
          T.shoulderL.z = 1.2 + w * 0.4;
          T.shoulderR.z = -1.2 + w * 0.4;
          T.elbowL.x = -0.4;
          T.elbowR.x = -0.4;
          pitch = 0.08;
        }
        break;
      }
      case 'jump': {
        const rising = inp.vy > 0;
        T.thighL.x = rising ? -1.0 : -0.6;
        T.thighR.x = rising ? -0.3 : -0.35;
        T.kneeL.x = rising ? 1.5 : 0.9;
        T.kneeR.x = rising ? 0.9 : 0.7;
        T.shoulderL.x = -2.3;
        T.shoulderR.x = -2.1;
        T.shoulderL.z = 0.3;
        T.shoulderR.z = -0.3;
        T.elbowL.x = -0.4;
        T.elbowR.x = -0.4;
        T.spine.x = 0.05;
        T.head.x = rising ? -0.15 : 0.05;
        roll = inp.lean * 0.3;
        break;
      }
      case 'slide': {
        T.thighL.x = -1.45;
        T.thighR.x = -1.15;
        T.kneeL.x = 0.25;
        T.kneeR.x = 0.9;
        T.spine.x = -0.75;
        T.neck.x = 0.45;
        T.head.x = 0.35;
        T.shoulderL.x = 0.5;
        T.shoulderR.x = 0.5;
        T.shoulderL.z = 0.9;
        T.shoulderR.z = -0.9;
        T.elbowL.x = -0.3;
        T.elbowR.x = -0.3;
        bodyY = -0.3;
        roll = inp.lean * 0.2;
        break;
      }
      case 'glide': {
        T.shoulderL.z = 1.45;
        T.shoulderR.z = -1.45;
        T.shoulderL.x = -0.2;
        T.shoulderR.x = -0.2;
        T.thighL.x = 0.25;
        T.thighR.x = 0.1;
        T.kneeL.x = 0.6;
        T.kneeR.x = 0.4;
        T.spine.x = 0.35;
        T.head.x = -0.3;
        roll = inp.lean * 0.45 + Math.sin(this.t * 1.7) * 0.06;
        bodyY = Math.sin(this.t * 2.2) * 0.05;
        break;
      }
      case 'celebrate': {
        const hop = Math.abs(Math.sin(this.t * 5.5));
        bodyY = hop * 0.22;
        T.shoulderL.z = 2.6 + Math.sin(this.t * 11) * 0.15;
        T.shoulderR.z = -2.6 - Math.sin(this.t * 11) * 0.15;
        T.elbowL.z = 0.3;
        T.elbowR.z = -0.3;
        T.thighL.x = -hop * 0.35;
        T.thighR.x = -hop * 0.35;
        T.kneeL.x = hop * 0.7;
        T.kneeR.x = hop * 0.7;
        T.head.x = -0.15;
        T.head.z = Math.sin(this.t * 5.5) * 0.12;
        break;
      }
      case 'wave':
      case 'idle':
      case 'preview': {
        const br = Math.sin(this.t * 2.1);
        T.spine.x = 0.02 + br * 0.015;
        T.shoulderL.z = 0.12;
        T.shoulderR.z = -0.12;
        T.elbowL.x = -0.15;
        T.elbowR.x = -0.15;
        T.head.z = Math.sin(this.t * 0.9) * 0.05;
        T.head.x = -0.04;
        T.thighL.z = 0.03;
        T.thighR.z = -0.03;
        if (inp.state === 'preview') {
          // a happy little sway for the closet turntable
          T.spine.z = Math.sin(this.t * 1.6) * 0.05;
          T.head.z = Math.sin(this.t * 1.6 + 0.6) * 0.08;
          T.shoulderL.z = 0.35;
          T.shoulderR.z = -0.35;
          T.elbowL.x = -0.5;
          T.elbowR.x = -0.5;
          T.thighL.z = 0.06;
          T.thighR.z = -0.06;
        }
        if (inp.state === 'wave') {
          T.shoulderR.z = -2.55;
          T.shoulderR.x = -0.2;
          T.elbowR.z = -0.35 + Math.sin(this.t * 9) * 0.45;
          T.head.z = 0.08;
          T.spine.z = 0.04;
        }
        break;
      }
    }

    const k = damp(inp.state === 'run' ? 22 : 12, dt);
    for (const j of JOINTS) {
      const obj = r[j];
      obj.rotation.x += (T[j].x - obj.rotation.x) * k;
      obj.rotation.y += (T[j].y - obj.rotation.y) * k;
      obj.rotation.z += (T[j].z - obj.rotation.z) * k;
    }
    this.bodyY += (bodyY - this.bodyY) * damp(inp.state === 'slide' ? 20 : 14, dt);
    this.bodyRoll += (roll - this.bodyRoll) * damp(14, dt);
    this.bodyPitch += (pitch - this.bodyPitch) * damp(10, dt);
    r.body.position.y = this.bodyY;
    r.body.rotation.z = this.bodyRoll;
    r.body.rotation.x = this.bodyPitch;

    // Puff secondary motion: a damped spring driven by vertical body velocity and lean.
    const vyBody = (this.bodyY - this.prevBodyY) / Math.max(dt, 1e-3) + (inp.airborne ? inp.vy * 0.15 : 0);
    this.prevBodyY = this.bodyY;
    const amount = inp.reducedMotion ? 0.35 : 1;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const targetAng = (-vyBody * 0.06 + this.bodyRoll * 0.6 * side) * amount;
      const acc = -90 * (this.puffAng[i] - targetAng) - 9 * this.puffVel[i];
      this.puffVel[i] += acc * dt;
      this.puffAng[i] += this.puffVel[i] * dt;
      this.puffAng[i] = Math.max(-0.35, Math.min(0.35, this.puffAng[i]));
      const p = i === 0 ? r.puffL : r.puffR;
      p.rotation.z = this.puffAng[i] * side;
      p.rotation.x = this.puffAng[i] * 0.5;
    }
  }
}
