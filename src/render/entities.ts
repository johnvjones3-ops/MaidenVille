// EntityRenderer: mirrors simulation obstacles and pickups into pooled meshes.
// Stars are one InstancedMesh; other entities come from per-kind pools, so long runs never grow the scene.

import * as THREE from 'three';
import type { RunSim } from '../sim/run';
import { ROUTE, type Pose } from '../world/route';
import { laneLateral } from '../sim/generator';
import { buildLetter, buildMissionItem, buildObstacle, buildPowerup, starGeometry } from './props';
import { SIM } from '../config';

class Pool {
  private free = new Map<string, THREE.Object3D[]>();
  constructor(private parent: THREE.Object3D, private factory: (key: string) => THREE.Object3D) {}
  get(key: string): THREE.Object3D {
    const list = this.free.get(key);
    const o = list && list.length ? list.pop()! : this.factory(key);
    o.userData.poolKey = key;
    o.visible = true;
    if (!o.parent) this.parent.add(o);
    return o;
  }
  release(o: THREE.Object3D) {
    o.visible = false;
    const key = o.userData.poolKey as string;
    if (!this.free.has(key)) this.free.set(key, []);
    this.free.get(key)!.push(o);
  }
  get size() {
    let n = 0;
    for (const l of this.free.values()) n += l.length;
    return n;
  }
}

const MAX_STARS = 320;

export class EntityRenderer {
  readonly group = new THREE.Group();
  private pool: Pool;
  private live = new Map<number, THREE.Object3D>();
  private stars: THREE.InstancedMesh;
  private pose: Pose = { x: 0, z: 0, heading: 0 };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3(1, 1, 1);
  private smashed = new Map<number, number>();

  constructor(scene: THREE.Scene) {
    this.group.name = 'entities';
    scene.add(this.group);
    this.pool = new Pool(this.group, (key) => {
      const [type, a, b] = key.split(':');
      let o: THREE.Object3D;
      if (type === 'obs') o = buildObstacle(a as any, Number(b) || 1);
      else if (type === 'letter') o = buildLetter(Number(a));
      else if (type === 'pow') o = buildPowerup(a as any);
      else o = buildMissionItem(a as any);
      o.traverse((c) => {
        const mm = c as THREE.Mesh;
        if (mm.isMesh) mm.castShadow = type === 'obs';
      });
      return o;
    });
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xb57900, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.55 });
    this.stars = new THREE.InstancedMesh(starGeometry(), starMat, MAX_STARS);
    this.stars.count = 0;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  /** Remove everything (restart). */
  clear() {
    for (const o of this.live.values()) this.pool.release(o);
    this.live.clear();
    this.smashed.clear();
    this.stars.count = 0;
  }

  smash(id: number) {
    this.smashed.set(id, 0);
  }

  update(sim: RunSim, time: number, dt: number) {
    const seen = new Set<number>();
    const far = sim.d + SIM.viewDistance;
    for (const o of sim.obstacles) {
      if (o.d - o.length / 2 > far || o.d + o.length / 2 < sim.d - 10) continue;
      const smashT = this.smashed.get(o.id);
      if (o.hit && smashT === undefined && !o.practice) {
        // hit obstacles stay visible but soften (they were bumped)
      }
      seen.add(o.id);
      let obj = this.live.get(o.id);
      if (!obj) {
        const key = o.kind === 'closed' ? `obs:closed:${Math.round(o.length)}` : `obs:${o.kind}`;
        obj = this.pool.get(key);
        obj.scale.set(1, 1, 1);
        this.live.set(o.id, obj);
      }
      ROUTE.worldAt(o.d, laneLateral(o.lane), this.pose);
      obj.position.set(this.pose.x, 0, this.pose.z);
      obj.rotation.set(0, -this.pose.heading, 0);
      if (smashT !== undefined) {
        const t = smashT + dt;
        this.smashed.set(o.id, t);
        const k = Math.max(0, 1 - t * 3);
        obj.scale.set(1 + t * 2, k, 1 + t * 2);
        obj.visible = k > 0.01;
      } else if (o.practice && o.hit) {
        obj.scale.setScalar(0.98);
      }
    }
    for (const p of sim.pickups) {
      if (p.collected || p.kind === 'star') continue;
      if (p.d > far || p.d < sim.d - 4) continue;
      seen.add(p.id);
      let obj = this.live.get(p.id);
      if (!obj) {
        const key = p.kind === 'letter' ? `letter:${p.letterIndex}` : p.kind === 'powerup' ? `pow:${p.powerup}` : `mis:${p.mission}`;
        obj = this.pool.get(key);
        this.live.set(p.id, obj);
      }
      ROUTE.worldAt(p.d, p.lateral, this.pose);
      const bob = Math.sin(time * 3 + p.id) * 0.12;
      obj.position.set(this.pose.x, p.y + bob, this.pose.z);
      obj.rotation.set(0, -this.pose.heading + Math.sin(time * 2 + p.id) * 0.5 + (p.kind === 'powerup' ? time * 1.5 : 0), 0);
    }
    for (const [id, obj] of this.live) {
      if (!seen.has(id)) {
        this.pool.release(obj);
        this.live.delete(id);
        this.smashed.delete(id);
      }
    }
    // stars
    let n = 0;
    const spin = time * 2.6;
    for (const p of sim.pickups) {
      if (p.kind !== 'star' || p.collected) continue;
      if (p.d > far || p.d < sim.d - 3) continue;
      if (n >= MAX_STARS) break;
      ROUTE.worldAt(p.d, p.lateral, this.pose);
      this.v.set(this.pose.x, p.y + Math.sin(time * 4 + p.d) * 0.06, this.pose.z);
      this.e.set(0, -this.pose.heading + spin, 0);
      this.q.setFromEuler(this.e);
      this.sc.setScalar(p.attracted ? 0.75 : 1);
      this.m.compose(this.v, this.q, this.sc);
      this.stars.setMatrixAt(n++, this.m);
    }
    this.stars.count = n;
    this.stars.instanceMatrix.needsUpdate = true;
  }

  get activeCount() {
    return this.live.size + this.stars.count;
  }
}
