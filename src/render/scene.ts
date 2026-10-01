// SceneManager: renderer, golden-hour sky and lighting, fog, resize and quality handling.

import * as THREE from 'three';
import { PALETTE, QUALITY, type QualityId } from '../config';

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private sky: THREE.Mesh;
  quality: QualityId;
  /** Direction toward the low golden-hour sun (from the west-southwest). */
  readonly sunDir = new THREE.Vector3(-0.62, 0.36, 0.42).normalize();

  constructor(container: HTMLElement, quality: QualityId) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'game-canvas';

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 1400);
    this.scene.fog = new THREE.Fog(PALETTE.fog, 120, QUALITY[quality].fogFar);
    this.scene.background = new THREE.Color(PALETTE.skyHorizon);

    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x8a6a45, 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(PALETTE.sun, 3.1);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    sc.near = 1;
    sc.far = 260;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xffe2c4, 0.45);
    fill.position.set(0.5, 0.6, -0.6);
    this.scene.add(fill);

    this.sky = this.buildSky();
    this.scene.add(this.sky);
    this.applyQuality(quality);
  }

  private buildSky(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(1200, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(PALETTE.skyTop) },
        horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
        sunDir: { value: this.sunDir },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.1, 1.0);
          vec3 col = mix(horizon, top, pow(max(h,0.0), 0.55));
          float sd = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += vec3(1.0,0.75,0.4) * pow(sd, 40.0) * 0.9 + vec3(1.0,0.6,0.3) * pow(sd, 6.0) * 0.25;
          col = mix(col, vec3(1.0,0.92,0.75), smoothstep(0.9985, 0.9995, sd));
          // soft warm haze band near the horizon
          col = mix(col, vec3(1.0,0.82,0.62), smoothstep(0.12, 0.0, abs(h)) * 0.35);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -10;
    m.frustumCulled = false;
    return m;
  }

  applyQuality(q: QualityId) {
    this.quality = q;
    const cfg = QUALITY[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.pixelRatio));
    this.renderer.shadowMap.enabled = cfg.shadows;
    this.sun.castShadow = cfg.shadows;
    if (cfg.shadows) {
      this.sun.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as any).map = null;
    }
    (this.scene.fog as THREE.Fog).far = cfg.fogFar;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) mm.needsUpdate = true;
    });
  }

  /** Keep the shadow frustum centred on Maddy. */
  followSun(x: number, z: number) {
    this.sun.position.set(x + this.sunDir.x * 120, this.sunDir.y * 120, z + this.sunDir.z * 120);
    this.sun.target.position.set(x, 0, z);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep a comfortable horizontal field of view in portrait
    const hfov = 68;
    const vfov = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / this.camera.aspect) * 180) / Math.PI;
    this.camera.fov = Math.min(88, Math.max(56, vfov));
    this.camera.updateProjectionMatrix();
  }

  /** Push fog back when the camera is high (aerial opening) so the whole neighborhood reads. */
  updateFog() {
    const fog = this.scene.fog as THREE.Fog;
    const hgt = Math.max(0, this.camera.position.y - 4);
    const far = QUALITY[this.quality].fogFar;
    fog.near = 110 + hgt * 2.2;
    // stay inside the camera's far plane so the edge of the world is always fully fogged
    fog.far = Math.min(far + hgt * 3.2, this.camera.far * 0.62);
    fog.near = Math.min(fog.near, fog.far * 0.5);
  }

  render() {
    this.updateFog();
    // the sky dome travels with the camera so its horizon always sits at eye level
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
}
