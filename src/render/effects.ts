// Effects: pooled sparkle particles, a rainbow ribbon trail, butterflies and distant birds.

import * as THREE from 'three';

interface Particle {
  life: number;
  max: number;
  p: THREE.Vector3;
  v: THREE.Vector3;
  size: number;
  color: THREE.Color;
  gravity: number;
}

export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private cap: number;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();

  constructor(scene: THREE.Scene, capacity: number) {
    this.cap = capacity;
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), 400);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setCapacity(c: number) {
    this.cap = Math.min(400, c);
  }

  burst(x: number, y: number, z: number, color: number | number[], count: number, speed = 3, gravity = 4, size = 1) {
    for (let i = 0; i < count; i++) {
      if (this.parts.length >= this.cap) this.parts.shift();
      const c = Array.isArray(color) ? color[i % color.length] : color;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.parts.push({ life: 0, max: 0.5 + Math.random() * 0.5, p: new THREE.Vector3(x, y, z), v: dir, size: size * (0.6 + Math.random() * 0.6), color: new THREE.Color(c), gravity });
    }
  }

  emit(x: number, y: number, z: number, color: number, size = 0.7, life = 0.6) {
    if (this.parts.length >= this.cap) this.parts.shift();
    this.parts.push({ life: 0, max: life, p: new THREE.Vector3(x, y, z), v: new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.8, (Math.random() - 0.5) * 0.6), size, color: new THREE.Color(color), gravity: 0.5 });
  }

  clear() {
    this.parts.length = 0;
    this.mesh.count = 0;
  }

  update(dt: number) {
    let n = 0;
    const alive: Particle[] = [];
    for (const p of this.parts) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.v.y -= p.gravity * dt;
      p.p.addScaledVector(p.v, dt);
      const k = 1 - p.life / p.max;
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.life * 6);
      this.s.setScalar(p.size * (0.4 + k * 0.8));
      this.m.compose(p.p, this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, p.color);
      n++;
      alive.push(p);
    }
    this.parts = alive;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** A ribbon that follows a point (used for the rainbow trail). */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  private pts: THREE.Vector3[] = [];
  private n: number;
  private geo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene, segments = 28) {
    this.n = segments;
    this.geo = new THREE.BufferGeometry();
    const pos = new Float32Array(segments * 2 * 3);
    const col = new Float32Array(segments * 2 * 3);
    const idx: number[] = [];
    const rainbow = [0xff6b6b, 0xffb84a, 0xffe14a, 0x6be38a, 0x5fb8f0, 0xb79cf0];
    for (let i = 0; i < segments; i++) {
      const c = new THREE.Color(rainbow[Math.floor((i / segments) * rainbow.length)]);
      for (let k = 0; k < 2; k++) col.set([c.r, c.g, c.b], (i * 2 + k) * 3);
      if (i < segments - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  reset() {
    this.pts.length = 0;
    this.mesh.visible = false;
  }

  push(p: THREE.Vector3, heading: number, width: number) {
    this.pts.unshift(p.clone());
    if (this.pts.length > this.n) this.pts.pop();
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const rx = Math.cos(heading) * width * 0.5;
    const rz = Math.sin(heading) * width * 0.5;
    for (let i = 0; i < this.n; i++) {
      const q = this.pts[Math.min(i, this.pts.length - 1)];
      const taper = 1 - i / this.n;
      pos.setXYZ(i * 2, q.x - rx * taper, q.y, q.z - rz * taper);
      pos.setXYZ(i * 2 + 1, q.x + rx * taper, q.y, q.z + rz * taper);
    }
    pos.needsUpdate = true;
    this.mesh.visible = this.pts.length > 2;
  }
}

/** Butterflies that flutter at the edges of the course near Maddy, and birds far away in the sky. */
export class Life {
  private butterflies: THREE.Group[] = [];
  private birds: THREE.Group[] = [];
  private t = 0;

  constructor(scene: THREE.Scene) {
    const wingGeo = new THREE.CircleGeometry(0.16, 8);
    const cols = [0xff9fd0, 0xffe066, 0xa6e3ff, 0xc8a8ff, 0xffb070];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide });
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(wingGeo, mat);
        w.position.x = sx * 0.13;
        w.name = sx < 0 ? 'wl' : 'wr';
        const pivot = new THREE.Group();
        pivot.add(w);
        pivot.name = sx < 0 ? 'pl' : 'pr';
        g.add(pivot);
      }
      g.userData.seed = Math.random() * 100;
      scene.add(g);
      this.butterflies.push(g);
    }
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x3a3030, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      for (const sx of [-1, 1]) {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(sx * 1.4, 0.4);
        s.lineTo(sx * 1.2, 0.1);
        s.closePath();
        const m = new THREE.Mesh(new THREE.ShapeGeometry(s), birdMat);
        m.name = 'w';
        g.add(m);
      }
      g.userData.seed = i * 1.7;
      scene.add(g);
      this.birds.push(g);
    }
  }

  update(dt: number, cx: number, cz: number, heading: number, reduced: boolean) {
    this.t += dt;
    const fx = Math.sin(heading);
    const fz = -Math.cos(heading);
    const rx = Math.cos(heading);
    const rz = Math.sin(heading);
    this.butterflies.forEach((b, i) => {
      const seed = b.userData.seed as number;
      // anchor ahead of Maddy at the edges of the course, drifting
      const side = i % 2 ? 1 : -1;
      const ahead = 8 + ((this.t * 3 + seed * 7) % 40);
      const lat = side * (6.5 + Math.sin(this.t * 0.7 + seed) * 1.2);
      b.position.set(cx + fx * ahead + rx * lat, 1.4 + Math.sin(this.t * 2 + seed) * 0.5, cz + fz * ahead + rz * lat);
      b.rotation.y = Math.sin(this.t * 0.8 + seed) * 2;
      const flap = reduced ? 0.4 : Math.sin(this.t * 18 + seed) * 0.9;
      (b.getObjectByName('pl') as THREE.Object3D).rotation.z = flap;
      (b.getObjectByName('pr') as THREE.Object3D).rotation.z = -flap;
    });
    this.birds.forEach((b) => {
      const seed = b.userData.seed as number;
      const a = this.t * 0.05 + seed;
      b.position.set(cx + Math.cos(a) * 220 + seed * 10, 60 + Math.sin(this.t * 0.3 + seed) * 6 + seed * 3, cz + Math.sin(a) * 220 - 120);
      b.rotation.y = -a;
      const flap = reduced ? 0 : Math.sin(this.t * 5 + seed) * 0.35;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
    });
  }
}
