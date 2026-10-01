// Game: the explicit state machine that ties simulation, rendering, input, UI, audio and persistence together.
// States: loading → intro → title → transition → countdown → running ⇄ paused → results; plus exploring/inspect/closet.

import * as THREE from 'three';
import { COPY, CONTROLS, DEFAULT_EQUIPPED, MODES, POWERUPS, QUALITY, SIM, type CosmeticCategory, type ModeId } from './config';
import { AudioManager } from './audio/audio';
import { InputManager } from './input/input';
import { applyOutfit, buildMaddy, CharacterAnimator, type AnimState, type Rig } from './render/character';
import { buildCity, type CityRefs } from './render/city';
import { CameraDirector, type CamContext } from './render/camera';
import { Life, Particles, Ribbon } from './render/effects';
import { EntityRenderer } from './render/entities';
import { SceneManager } from './render/scene';
import { activeGoals, checkStyleAchievement, metricValue, settleRun, stamp } from './save/progression';
import { SaveManager, type Settings } from './save/save';
import { laneLateral } from './sim/generator';
import { RunSim, type Action, type SimEvent } from './sim/run';
import { UI, powerName, POWER_DURATION } from './ui/ui';
import { LANDMARKS, LANDMARK_BY_ID, landmarkWorld, type LandmarkId } from './world/landmarks';
import { ROUTE, type Pose } from './world/route';
import type { PowerupKind } from './sim/types';

type State = 'loading' | 'intro' | 'title' | 'transition' | 'countdown' | 'running' | 'paused' | 'ending' | 'results' | 'exploring' | 'inspect' | 'closet';

const START_S = 0;

export class Game {
  private sm: SceneManager;
  private city!: CityRefs;
  private rig!: Rig;
  private anim!: CharacterAnimator;
  private keyLight!: THREE.PointLight;
  private entities!: EntityRenderer;
  private particles!: Particles;
  private ribbon!: Ribbon;
  private life!: Life;
  private camDir: CameraDirector;
  readonly audio = new AudioManager();
  private input: InputManager;
  readonly ui: UI;
  readonly save: SaveManager;

  state: State = 'loading';
  sim: RunSim | null = null;
  private selectedMode: ModeId = 'explorer';
  private acc = 0;
  private time = 0;
  private lastFrame = 0;
  private pose: Pose = { x: 0, z: 0, heading: 0 };
  private maddyPos = new THREE.Vector3();
  private maddyYaw = 0;
  private faceCamera = 0; // 0 = face route, 1 = face camera
  private turntable = 0;
  private dragX: number | null = null;
  private countdownT = 0;
  private countdownStep = -1;
  private afterCountdown: State = 'running';
  private endingT = 0;
  private starCombo = 0;
  private starComboT = 0;
  private goalToasted = new Set<string>();
  private replayTutorial = false;
  private closetCategory: CosmeticCategory = 'outfit';
  private inspectTarget: THREE.Vector3 | null = null;
  private lastBanner = 0;
  private wasPortrait = window.innerWidth < window.innerHeight;
  private runCounter = 0;
  private runId = '';
  private lastSettlement: ReturnType<typeof settleRun> | null = null;
  private pausedFrom: State = 'running';
  private stepEvents: SimEvent[] = [];
  private touchUsed = false;
  private trailT = 0;
  private birdsT = 6;
  /** For tests and debugging (window.__mv). */
  /** Debug camera override relative to Maddy: [dx, dy, dz, lookDx, lookDy, lookDz]. */
  debugCam: number[] | null = null;
  stats = { fps: 0, frames: 0, fpsT: 0, drawCalls: 0, triangles: 0 };

  constructor(private stage: HTMLElement, uiRoot: HTMLElement) {
    this.save = new SaveManager();
    const s = this.save.data.settings;
    this.applyAudioSettings(s);
    this.sm = new SceneManager(stage, s.quality);
    this.camDir = new CameraDirector(this.sm.camera);
    this.ui = new UI(uiRoot);
    this.ui.click = () => this.audio.click();
    this.ui.onPauseClick = () => this.pause();
    this.input = new InputManager(stage);
    this.input.onAction = (a) => this.onAction(a);
    this.input.onPause = () => {
      if (this.state === 'paused') this.resume();
      else this.pause();
    };
    this.ui.bindTouch((el, a) => this.input.bindButton(el, a as Action));
    document.body.classList.toggle('reduced-motion', s.reducedMotion);
    this.setupLifecycle();
  }

  // ------------------------------------------------------------------ boot
  async boot() {
    this.ui.showLoading();
    this.resize();
    await nextFrame();
    this.city = buildCity(this.save.data.settings.quality);
    this.sm.scene.add(this.city.group);
    this.rig = buildMaddy();
    applyOutfit(this.rig, this.save.data.equipped);
    this.sm.scene.add(this.rig.root);
    this.anim = new CharacterAnimator(this.rig);
    // soft key light from the camera side so Maddy's face always reads
    this.keyLight = new THREE.PointLight(0xffe6cc, 2.2, 7, 1.6);
    this.sm.scene.add(this.keyLight);
    this.entities = new EntityRenderer(this.sm.scene);
    this.particles = new Particles(this.sm.scene, QUALITY[this.save.data.settings.quality].particles);
    this.ribbon = new Ribbon(this.sm.scene);
    this.life = new Life(this.sm.scene);
    this.placeMaddyAtStart();
    // warm up shaders
    this.sm.renderer.compile(this.sm.scene, this.sm.camera);
    await nextFrame();
    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    if (this.save.data.settings.reducedMotion) this.toTitle(true);
    else this.startIntro();
    (window as any).__mv = this;
  }

  private placeMaddyAtStart() {
    ROUTE.worldAt(START_S, 0, this.pose);
    this.maddyPos.set(this.pose.x, 0, this.pose.z);
    this.maddyYaw = Math.PI - this.pose.heading;
    this.rig.root.position.copy(this.maddyPos);
    this.rig.root.rotation.y = this.maddyYaw;
  }

  // ------------------------------------------------------------------ lifecycle (backgrounding, resize, rotation)
  private setupLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        this.audio.suspend();
      } else if (this.audio.ready) this.audio.resume();
    });
    window.addEventListener('blur', () => this.pause());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => this.pause());
    // unlock audio on the first gesture
    const unlock = () => {
      this.audio.unlock();
      this.applyAudioSettings(this.save.data.settings);
      this.audio.startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.touchUsed = true;
    });
    // closet turntable drag
    this.stage.addEventListener('pointerdown', (e) => {
      if (this.state === 'closet') this.dragX = e.clientX;
    });
    window.addEventListener('pointermove', (e) => {
      if (this.state === 'closet' && this.dragX !== null) {
        this.turntable += (e.clientX - this.dragX) * 0.012;
        this.dragX = e.clientX;
      }
    });
    window.addEventListener('pointerup', () => (this.dragX = null));
    window.addEventListener('pointercancel', () => (this.dragX = null));
  }

  private resize() {
    const w = this.stage.clientWidth || window.innerWidth;
    const h = this.stage.clientHeight || window.innerHeight;
    this.sm.resize(w, h);
    const portrait = w < h;
    if (portrait !== this.wasPortrait) {
      this.wasPortrait = portrait;
      this.pause(); // rotation never causes accidental damage
    }
  }

  // ------------------------------------------------------------------ intro & title
  private startIntro() {
    this.state = 'intro';
    this.camDir.set('aerial', 0);
    this.ui.showIntro(() => this.skipIntro());
    this.introT = 0;
  }
  private introT = 0;

  private skipIntro() {
    if (this.state !== 'intro') return;
    this.toTitle(this.save.data.settings.reducedMotion);
  }

  toTitle(cut = false) {
    this.state = 'title';
    this.sim = null;
    this.entities?.clear();
    this.particles?.clear();
    this.ribbon?.reset();
    this.input.enabled = false;
    this.ui.showHUD(false);
    this.ui.showTouch(false);
    this.ui.showExploreBar(null);
    this.ui.clearToasts();
    this.ui.showCountdown(null);
    this.hideDeliveryMats();
    this.placeMaddyAtStart();
    this.faceCamera = 0;
    this.rig.wings.visible = false;
    this.rig.shield.visible = false;
    this.rig.magnetRing.visible = false;
    this.rig.root.visible = true;
    const ctx = this.camCtx();
    if (cut) {
      void this.ui.fade(true, 150).then(() => {
        this.camDir.set('title', 0, ctx);
        void this.ui.fade(false, 300);
      });
    } else this.camDir.set('title', this.camDir.mode === 'aerial' ? 3.2 : 1.2, ctx);
    this.showTitleScreen();
  }

  private showTitleScreen() {
    const note = this.save.storageUnavailable ? 'Progress can’t be saved in this browser window, but you can still play!' : this.save.recovered ? 'Your saved progress was repaired.' : null;
    this.ui.showTitle({
      save: this.save.data,
      goals: activeGoals(this.save),
      mode: this.selectedMode,
      onMode: (m) => {
        this.selectedMode = m;
        this.showTitleScreen();
      },
      onPlay: () => this.startRun(this.selectedMode),
      onExplore: () => this.startRun('explore'),
      onPassport: () => this.ui.showPassport(this.save.data, () => this.showTitleScreen()),
      onCloset: () => this.openCloset(),
      onSettings: () => this.openSettings(() => this.showTitleScreen()),
      onHelp: () => this.ui.showHelp(() => this.showTitleScreen()),
      storageNote: note,
    });
  }

  // ------------------------------------------------------------------ runs
  startRun(mode: ModeId, fromResults = false) {
    this.audio.unlock();
    this.runCounter++;
    this.runId = `${Date.now().toString(36)}-${this.runCounter}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    this.lastSettlement = null;
    const tutorial = mode !== 'explore' && (!this.save.data.tutorialDone || this.replayTutorial);
    this.replayTutorial = false;
    this.sim = new RunSim(mode, { seed: (Date.now() ^ (this.runCounter * 7919)) >>> 0, tutorial });
    this.entities.clear();
    this.particles.clear();
    this.ribbon.reset();
    this.goalToasted.clear();
    this.starCombo = 0;
    this.acc = 0;
    this.faceCamera = 0;
    this.hideDeliveryMats();
    this.ui.closeScreen();
    this.ui.clearToasts();
    this.ui.showHUD(true);
    this.ui.showTouch(this.save.data.settings.touchButtons);
    this.ui.showExploreBar(null);
    this.syncMaddyToSim(0);
    this.updateHud();
    const ctx = this.camCtx();
    const reduced = this.save.data.settings.reducedMotion;
    this.state = 'transition';
    this.afterCountdown = mode === 'explore' ? 'exploring' : 'running';
    if (reduced || fromResults) {
      void this.ui.fade(true, reduced ? 200 : 250).then(() => {
        this.camDir.set('chase', 0, ctx);
        void this.ui.fade(false, 250);
        this.beginCountdown();
      });
    } else {
      this.camDir.set('chase', 1.5, ctx);
      setTimeout(() => {
        if (this.state === 'transition') this.beginCountdown();
      }, 1350);
    }
    this.audio.intensity = 0.3;
    this.ui.banner(mode === 'explore' ? 'Explore MaidenVille' : MODES[mode].label, mode === 'explore' ? 'Stop anywhere and look around' : COPY.letsExplore);
  }

  private beginCountdown() {
    if (!this.sim) return;
    this.state = 'countdown';
    this.countdownT = 0;
    this.countdownStep = -1;
    this.input.enabled = false;
  }

  private updateCountdown(dt: number) {
    const explore = this.sim?.mode.id === 'explore';
    const steps = explore ? ['Go!'] : ['3', '2', '1', 'Go!'];
    const stepLen = 0.5;
    this.countdownT += dt;
    const idx = Math.floor(this.countdownT / stepLen);
    if (idx !== this.countdownStep && idx < steps.length) {
      this.countdownStep = idx;
      this.ui.showCountdown(steps[idx]);
      this.audio.countdown(idx === steps.length - 1);
    }
    // allow pre-buffering nothing: input is enabled exactly when running starts
    if (this.countdownT >= stepLen * steps.length - 0.15) {
      this.ui.showCountdown(null);
      this.state = this.afterCountdown;
      this.input.enabled = true;
      this.lastFrame = performance.now();
      this.acc = 0;
    }
  }

  pause() {
    if (!['running', 'countdown', 'exploring', 'transition'].includes(this.state) || !this.sim) return;
    this.pausedFrom = this.state === 'exploring' || this.sim.mode.id === 'explore' ? 'exploring' : 'running';
    this.state = 'paused';
    this.input.enabled = false;
    this.ui.showCountdown(null);
    this.showPauseMenu();
  }

  private showPauseMenu() {
    const sim = this.sim!;
    const summary = sim.summary(this.runId);
    this.ui.showPause({
      mode: sim.mode.id,
      goals: activeGoals(this.save).map((g) => ({ ...g, progress: metricValue(g.metric, summary) })),
      onResume: () => this.resume(),
      onRestart: () => {
        this.ui.closeScreen();
        this.settle();
        this.startRun(sim.mode.id, true);
      },
      onSettings: () => this.openSettings(() => this.showPauseMenu()),
      onHelp: () => this.ui.showHelp(() => this.showPauseMenu()),
      onQuit: () => {
        this.ui.closeScreen();
        this.endRun(true);
      },
    });
  }

  resume() {
    if (this.state !== 'paused' || !this.sim) return;
    this.ui.closeScreen();
    this.afterCountdown = this.pausedFrom;
    this.beginCountdown();
  }

  private onAction(a: Action) {
    if (!this.sim) return;
    if (this.state === 'running' || this.state === 'exploring') {
      this.sim.input(a);
      if (this.touchUsed && !this.save.data.settings.touchButtons) {
        /* swipes in use */
      }
    }
  }

  /** Bank results exactly once for the current run. */
  private settle() {
    if (!this.sim) return null;
    if (!this.lastSettlement) {
      this.lastSettlement = settleRun(this.save, this.sim.summary(this.runId));
      if (this.sim.d > this.sim.gen.tutorialEnd && !this.save.data.tutorialDone) {
        this.save.data.tutorialDone = true;
        this.save.save();
      }
    }
    return this.lastSettlement;
  }

  private endRun(quit: boolean) {
    if (!this.sim) return;
    this.input.enabled = false;
    this.settle();
    if (quit && this.sim.mode.id !== 'explore' && this.sim.d < 30) {
      this.toTitle();
      return;
    }
    this.state = 'ending';
    this.endingT = 0;
    this.ui.showTouch(false);
    this.ui.showExploreBar(null);
  }

  private showResults() {
    const sim = this.sim!;
    const s = this.settle()!;
    this.state = 'results';
    this.ui.showHUD(false);
    this.audio.results();
    const sum = sim.summary(this.runId);
    this.ui.showResults(
      {
        mode: sim.mode.id,
        stars: sum.stars,
        score: sum.score,
        distance: sum.distance,
        visited: sum.landmarksVisited,
        lettersProgress: sim.letters.next,
        words: sim.letters.words,
        deliveries: sum.deliveries,
        settlement: s,
        bank: this.save.data.stars,
        missionNames: sum.deliveries.map((id) => {
          const m = sim.missions.completed.has(id) ? id : id;
          return { m_book: 'Book → School', m_card: 'Card → Hospital', m_flowers: 'Flowers → Church', m_gift: 'Gift → Store' }[m] ?? m;
        }),
      },
      () => this.startRun(sim.mode.id, true),
      () => this.toTitle(),
    );
  }

  // ------------------------------------------------------------------ explore extras
  private nearbyLandmark(): LandmarkId | null {
    if (!this.sim) return null;
    let best: LandmarkId | null = null;
    let bd = 26;
    for (const l of LANDMARKS) {
      const d = Math.abs(ROUTE.delta(this.sim.s, l.s));
      if (d < bd) {
        bd = d;
        best = l.id;
      }
    }
    return best;
  }

  private openLook(id: LandmarkId) {
    if (!this.sim) return;
    this.state = 'inspect';
    this.input.enabled = false;
    const w = landmarkWorld(LANDMARK_BY_ID[id]);
    this.inspectTarget = new THREE.Vector3(w.x, 0, w.z);
    this.camDir.set('inspect', this.save.data.settings.reducedMotion ? 0 : 1.0, this.camCtx());
    if (stamp(this.save, id)) this.ui.toast(`${COPY.discovered} ${LANDMARK_BY_ID[id].name}`, 'good', 'passport');
    this.ui.showExploreBar(null);
    this.ui.showLandmarkCard(id, this.save.data.stamps.includes(id), () => this.closeInspect());
  }

  private closeInspect() {
    this.ui.closeScreen();
    this.inspectTarget = null;
    this.camDir.set('chase', this.save.data.settings.reducedMotion ? 0 : 0.9, this.camCtx());
    this.state = 'exploring';
    this.input.enabled = true;
  }

  private openMap() {
    if (!this.sim) return;
    this.state = 'inspect';
    this.input.enabled = false;
    this.ui.showExploreBar(null);
    this.ui.showMap({
      currentS: this.sim.s,
      stamps: this.save.data.stamps,
      onTravel: (id) => {
        const l = LANDMARK_BY_ID[id];
        this.ui.closeScreen();
        void this.ui.fade(true, 250).then(() => {
          this.sim!.travelTo(ROUTE.wrap(l.s - 30));
          this.sim!.stopped = false;
          this.syncMaddyToSim(0);
          this.camDir.set('chase', 0, this.camCtx());
          this.state = 'exploring';
          this.input.enabled = true;
          void this.ui.fade(false, 300);
        });
      },
      onClose: () => {
        this.ui.closeScreen();
        this.state = 'exploring';
        this.input.enabled = true;
      },
    });
  }

  // ------------------------------------------------------------------ closet & settings
  private openCloset() {
    this.state = 'closet';
    this.turntable = 0;
    this.camDir.set('closet', this.save.data.settings.reducedMotion ? 0 : 1.0, this.camCtx());
    this.renderCloset();
  }

  private renderCloset() {
    this.ui.showCloset({
      save: this.save.data,
      category: this.closetCategory,
      onCategory: (c) => {
        this.closetCategory = c;
        this.renderCloset();
      },
      onBuy: (id) => {
        if (this.save.buy(id)) {
          this.audio.powerup();
          this.save.equip(id);
          this.afterEquip();
        }
        this.renderCloset();
      },
      onEquip: (id) => {
        this.save.equip(id);
        this.afterEquip();
        this.renderCloset();
      },
      onClose: () => {
        this.ui.closeScreen();
        this.state = 'title';
        this.camDir.set('title', this.save.data.settings.reducedMotion ? 0 : 0.8, this.camCtx());
        this.showTitleScreen();
      },
    });
  }

  private afterEquip() {
    applyOutfit(this.rig, this.save.data.equipped);
    const changed = (Object.keys(DEFAULT_EQUIPPED) as CosmeticCategory[]).some((c) => this.save.data.equipped[c] !== DEFAULT_EQUIPPED[c]);
    if (changed) {
      const a = checkStyleAchievement(this.save);
      if (a) this.ui.toast(`New badge: ${a.name}!`, 'good', 'badge');
    }
  }

  private openSettings(back: () => void) {
    this.ui.showSettings({
      settings: this.save.data.settings,
      storageNote: this.save.storageUnavailable ? 'Settings will last until you close this window (storage is unavailable).' : null,
      onChange: (patch) => {
        const s = this.save.data.settings;
        const prevQ = s.quality;
        Object.assign(s, patch);
        this.save.save();
        this.applyAudioSettings(s);
        document.body.classList.toggle('reduced-motion', s.reducedMotion);
        if (patch.quality && patch.quality !== prevQ) {
          this.sm.applyQuality(s.quality);
          this.particles.setCapacity(QUALITY[s.quality].particles);
        }
        if (patch.touchButtons !== undefined && this.sim) this.ui.showTouch(s.touchButtons);
      },
      onReplayTutorial: () => {
        this.replayTutorial = true;
        this.ui.toast('The tutorial will play on your next run.', 'info', 'help');
      },
      onReset: () =>
        this.ui.confirm(
          'This clears stars, outfits, passport stamps, badges and records on this device. Settings are kept.',
          'Yes, reset everything',
          () => {
            this.save.reset();
            applyOutfit(this.rig, this.save.data.equipped);
            this.ui.toast('Progress reset. A fresh adventure awaits!', 'info');
            this.openSettings(back);
          },
          () => this.openSettings(back),
        ),
      onClose: back,
    });
  }

  private applyAudioSettings(s: Settings) {
    this.audio.sfxVolume = s.sfxVolume;
    this.audio.musicVolume = s.musicVolume;
    this.audio.muted = s.muted;
    this.audio.applyVolumes();
  }

  // ------------------------------------------------------------------ frame loop
  private frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (!(dt > 0)) dt = 0;
    this.stats.frames++;
    this.stats.fpsT += dt; // real time, for an honest frame rate
    dt = Math.min(dt, 0.1);
    this.time += dt;
    if (this.stats.fpsT >= 1) {
      this.stats.fps = this.stats.frames / this.stats.fpsT;
      this.stats.frames = 0;
      this.stats.fpsT = 0;
    }
    try {
      this.update(dt);
      this.render(dt);
    } catch (err) {
      console.error(err);
    }
  }

  private update(dt: number) {
    const reduced = this.save.data.settings.reducedMotion;
    switch (this.state) {
      case 'intro':
        this.introT += dt;
        if (this.introT > 3.2 && this.camDir.mode === 'aerial') {
          this.camDir.set('title', 3.4, this.camCtx());
        }
        if (this.introT > 6.8) this.toTitle(false);
        break;
      case 'countdown':
        this.updateCountdown(dt);
        break;
      case 'running':
      case 'exploring':
        this.stepSim(dt);
        break;
      case 'ending':
        this.endingT += dt;
        if (this.endingT > 1.1 && this.camDir.mode !== 'results') this.camDir.set('results', reduced ? 0 : 1.2, this.camCtx());
        if (this.endingT > 1.6) this.showResults();
        break;
      case 'closet':
        if (this.dragX === null) this.turntable += dt * 0.5;
        break;
    }
    if (this.starComboT > 0) {
      this.starComboT -= dt;
      if (this.starComboT <= 0) this.starCombo = 0;
    }
    this.updateMaddy(dt);
    this.updateCityLife(dt);
    this.camDir.update(dt, this.camCtx(), reduced);
    if (this.debugCam) {
      const d = this.debugCam;
      this.sm.camera.position.set(this.maddyPos.x + d[0], this.maddyPos.y + d[1], this.maddyPos.z + d[2]);
      this.sm.camera.lookAt(this.maddyPos.x + d[3], this.maddyPos.y + d[4], this.maddyPos.z + d[5]);
    }
    this.sm.followSun(this.maddyPos.x, this.maddyPos.z);
    const cp = this.sm.camera.position;
    this.keyLight.position.set(this.maddyPos.x + (cp.x - this.maddyPos.x) * 0.45, this.maddyPos.y + 1.7, this.maddyPos.z + (cp.z - this.maddyPos.z) * 0.45);
    if (this.sim) this.entities.update(this.sim, this.time, dt);
    // keep pickups from blocking the results view of Maddy
    this.entities.group.visible = !(this.state === 'results' || (this.state === 'ending' && this.endingT > 1.0));
    this.particles.update(dt);
  }

  private stepSim(dt: number) {
    const sim = this.sim!;
    if (sim.mode.id === 'explore') this.ui.showExploreBar({ stopped: sim.stopped, nearby: this.nearbyLandmark(), onStopGo: () => (sim.stopped = !sim.stopped), onMap: () => this.openMap(), onLook: () => this.openLook(this.nearbyLandmark()!) });
    this.acc += dt;
    if (this.acc > SIM.maxCatchUp) this.acc = SIM.maxCatchUp; // cap catch-up after a stall
    while (this.acc >= SIM.fixedStep) {
      sim.step(SIM.fixedStep);
      this.acc -= SIM.fixedStep;
      for (const e of sim.events) this.stepEvents.push(e);
      sim.events.length = 0;
      if (sim.over) break;
    }
    for (const e of this.stepEvents) this.handleEvent(e);
    this.stepEvents.length = 0;
    this.audio.intensity = sim.mode.id === 'explore' ? 0 : Math.min(1, 0.3 + (sim.speed - sim.mode.startSpeed) / Math.max(1, sim.mode.maxSpeed - sim.mode.startSpeed));
    this.updateHud();
    if (sim.over && this.state === 'running') this.endRun(false);
  }

  private handleEvent(e: SimEvent) {
    const sim = this.sim!;
    const reduced = this.save.data.settings.reducedMotion;
    switch (e.type) {
      case 'star': {
        this.starCombo++;
        this.starComboT = 0.6;
        this.audio.star(this.starCombo);
        const w = ROUTE.worldAt(e.d, e.lateral);
        this.particles.burst(w.x, e.y, w.z, [0xffd84a, 0xfff2a8], reduced ? 3 : 7, 2.5, 3, 0.8);
        break;
      }
      case 'letter':
        this.audio.letter(e.index);
        this.ui.toast(`Letter ${'MADDY'[e.index]}!`, 'good', 'star');
        this.burstAtMaddy([0xff7fb8, 0xb79cf0, 0x7cc8f5], 14);
        break;
      case 'word':
        this.audio.word();
        this.ui.banner('M · A · D · D · Y !', `You spelled your name! +${40} stars`, 3000);
        this.burstAtMaddy([0xff7fb8, 0xffd84a, 0x7fe0b8, 0x7cc8f5, 0xb79cf0], reduced ? 20 : 60);
        break;
      case 'powerup':
        this.audio.powerup();
        this.ui.toast(e.renewed ? `${powerName(e.kind)} renewed!` : `${powerName(e.kind)}!`, 'good', e.kind);
        break;
      case 'powerupEnd':
        this.audio.lane();
        break;
      case 'hit':
        this.audio.bump();
        this.camDir.shake(0.3);
        this.ui.toast(e.hearts > 0 ? 'Oops! Shake it off and keep going!' : 'What an adventure!', 'soft', 'heart');
        break;
      case 'shieldPop':
        this.audio.pop();
        this.burstAtMaddy([0xbfeaff, 0xffffff], 18);
        this.ui.toast('Bubble Shield popped — you’re safe!', 'info', 'shield');
        break;
      case 'smash': {
        this.entities.smash(e.id);
        break;
      }
      case 'practice':
        if (e.ok) this.ui.toast(e.kind === 'arch' ? 'Super slide!' : 'Nice jump!', 'good', 'check');
        else this.ui.toast('Almost! That one was just practice.', 'soft');
        break;
      case 'gameOver':
        break;
      case 'jump':
        this.audio.jump();
        break;
      case 'land':
        this.audio.land();
        break;
      case 'slide':
        this.audio.slide();
        break;
      case 'lane':
        this.audio.lane();
        break;
      case 'step':
        this.audio.step();
        break;
      case 'edge':
        break;
      case 'landmark': {
        const l = LANDMARK_BY_ID[e.id];
        if (stamp(this.save, e.id)) {
          this.audio.stamp();
          this.ui.toast(`${COPY.discovered} ${l.name} — stamp added!`, 'good', 'passport');
        }
        break;
      }
      case 'approach': {
        const l = LANDMARK_BY_ID[e.id];
        this.ui.banner(l.name, l.zone);
        this.lastBanner = this.time;
        if (e.id === 'church') this.audio.churchBell();
        break;
      }
      case 'zone':
        if (this.time - this.lastBanner > 4) this.ui.banner(e.name);
        break;
      case 'tutorial':
        this.ui.tutorial(e.kind, this.touchUsed);
        break;
      case 'missionPickup':
        this.audio.pickup();
        this.ui.toast(`Got the ${e.def.itemName.toLowerCase()}! Follow the green lane at ${LANDMARK_BY_ID[e.def.target].name}.`, 'good', e.def.item as any);
        this.showDeliveryMat(e.def.target);
        break;
      case 'missionDone':
        this.audio.mission();
        this.ui.banner('Delivered!', `${LANDMARK_BY_ID[e.def.target].name} says thank you! +30 stars`, 2800);
        this.burstAtMaddy([0x7fe0b8, 0xffffff, 0xffd84a], reduced ? 12 : 36);
        this.hideDeliveryMats();
        break;
    }
    void sim;
  }

  private burstAtMaddy(colors: number[], n: number) {
    this.particles.burst(this.maddyPos.x, this.maddyPos.y + 1.2, this.maddyPos.z, colors, n, 4, 3, 1.1);
  }

  private showDeliveryMat(target: LandmarkId) {
    this.hideDeliveryMats();
    const m = this.city.deliveryMats.get(target);
    if (m) m.visible = true;
  }

  private hideDeliveryMats() {
    this.city?.deliveryMats.forEach((m) => (m.visible = false));
  }

  private updateHud() {
    const sim = this.sim!;
    const pw: Array<{ kind: PowerupKind; frac: number; warn: boolean }> = [];
    const add = (kind: PowerupKind, t: number) => {
      if (t > 0) pw.push({ kind, frac: Math.min(1, t / POWER_DURATION[kind]), warn: t < POWERUPS.warnAt });
    };
    add('magnet', sim.magnetT);
    add('rainbow', sim.rainbowT);
    add('glide', sim.glideT);
    let hint: string | null = null;
    if (!sim.missions.carrying) {
      const next = sim.pickups.find((p) => p.kind === 'mission' && !p.collected && p.d > sim.d && p.d - sim.d < 110);
      if (next) hint = `Friendly mission ahead: grab the glowing ${next.mission === 'card' ? 'card' : next.mission === 'gift' ? 'gift' : next.mission}!`;
    }
    this.ui.updateHUD({
      stars: sim.stars,
      score: sim.score,
      hearts: sim.hearts,
      maxHearts: sim.mode.hearts,
      showScore: sim.mode.scored,
      showHearts: sim.mode.damage,
      letters: sim.letters.slots,
      words: sim.letters.words,
      mission: sim.missions.carrying,
      missionHint: hint,
      powerups: pw,
      shield: sim.shield,
      invuln: sim.invulnT > 0,
    });
    // live goal toasts (rewards are still settled once at the end)
    if (sim.mode.scored && Math.floor(this.time * 2) !== Math.floor((this.time - 1 / 60) * 2)) {
      const summary = sim.summary(this.runId);
      for (const g of activeGoals(this.save)) {
        if (!this.goalToasted.has(g.id) && metricValue(g.metric, summary) >= g.target) {
          this.goalToasted.add(g.id);
          this.ui.toast(`Goal complete: ${g.text}!`, 'good', 'badge');
        }
      }
    }
  }

  // ------------------------------------------------------------------ Maddy & world visuals
  private syncMaddyToSim(dt: number) {
    const sim = this.sim;
    if (!sim) return;
    ROUTE.worldAt(sim.d, sim.x, this.pose);
    this.maddyPos.set(this.pose.x, sim.y, this.pose.z);
    const targetYaw = Math.PI - this.pose.heading - sim.lean * 0.18;
    if (dt === 0) this.maddyYaw = targetYaw;
    else this.maddyYaw += wrap(targetYaw - this.maddyYaw) * Math.min(1, dt * 14);
  }

  private updateMaddy(dt: number) {
    const sim = this.sim;
    const s = this.save.data.settings;
    let state: AnimState = 'idle';
    let speed = 0;
    let lean = 0;
    let vy = 0;
    let airborne = false;
    if (sim && ['running', 'exploring', 'countdown', 'transition', 'paused', 'ending', 'inspect', 'results'].includes(this.state)) {
      if (this.state === 'running' || this.state === 'exploring' || this.state === 'ending') this.syncMaddyToSim(dt);
      speed = sim.speed;
      lean = sim.lean;
      vy = sim.vy;
      airborne = sim.airborne;
      if (this.state === 'results' || (this.state === 'ending' && this.endingT > 1.0)) state = 'celebrate';
      else if (this.state === 'ending') state = sim.over ? 'stumble' : 'run';
      else if (this.state === 'countdown' || this.state === 'transition') state = 'idle';
      else if (this.state === 'paused' || this.state === 'inspect') state = sim.mode.id === 'explore' ? 'idle' : 'run';
      else if (sim.gliding) state = 'glide';
      else if (sim.stumbleT > 0) state = 'stumble';
      else if (sim.sliding) state = 'slide';
      else if (sim.airborne) state = 'jump';
      else if (sim.speed < 0.6) state = 'idle';
      else state = 'run';
      if (this.state === 'ending' && this.endingT > 1.0) {
        this.maddyPos.y = Math.max(0, this.maddyPos.y - dt * 4);
      }
    } else if (this.state === 'title' || this.state === 'intro') state = 'wave';
    else if (this.state === 'closet') state = 'preview';

    // turning to face the camera on title, results and closet
    const wantFace = this.state === 'title' || this.state === 'intro' || this.state === 'results' || (this.state === 'ending' && this.endingT > 1.0) || this.state === 'closet';
    this.faceCamera += ((wantFace ? 1 : 0) - this.faceCamera) * Math.min(1, dt * 5);
    let yaw = this.maddyYaw;
    if (this.faceCamera > 0.001) {
      const toCam = Math.atan2(this.sm.camera.position.x - this.maddyPos.x, this.sm.camera.position.z - this.maddyPos.z);
      yaw = this.maddyYaw + wrap(toCam - this.maddyYaw) * this.faceCamera;
    }
    if (this.state === 'closet') yaw += this.turntable;
    this.rig.root.position.copy(this.maddyPos);
    this.rig.root.rotation.y = yaw;
    this.anim.update(dt, { state, speed, lean, vy, airborne, reducedMotion: s.reducedMotion });

    // power-up visuals
    const running = sim && (this.state === 'running' || this.state === 'exploring' || this.state === 'paused' || this.state === 'countdown');
    this.rig.shield.visible = !!(running && sim!.shield);
    if (this.rig.shield.visible) this.rig.shield.scale.setScalar(1 + Math.sin(this.time * 4) * (s.reducedMotion ? 0.01 : 0.04));
    this.rig.magnetRing.visible = !!(running && sim!.magnetT > 0);
    if (this.rig.magnetRing.visible) this.rig.magnetRing.rotation.z = this.time * 3;
    this.rig.wings.visible = !!(running && sim!.gliding);
    // invulnerability blink (gentle; a slower pulse with reduced motion)
    const blink = running && sim!.invulnT > 0 && sim!.mode.damage;
    this.rig.body.visible = !blink || Math.floor(this.time * (s.reducedMotion ? 4 : 12)) % 2 === 0;

    // trails
    const trail = this.save.data.equipped.trail;
    const rainbowActive = !!(running && sim!.rainbowT > 0) || (trail === 'trail_rainbow' && this.state === 'running');
    if (rainbowActive && this.state === 'running') {
      this.ribbon.push(new THREE.Vector3(this.maddyPos.x, this.maddyPos.y + 0.12, this.maddyPos.z), this.pose.heading, 0.9);
    } else if (!rainbowActive) this.ribbon.reset();
    if (this.state === 'running' && trail === 'trail_stars') {
      this.trailT += dt;
      if (this.trailT > 0.06) {
        this.trailT = 0;
        this.particles.emit(this.maddyPos.x + (Math.random() - 0.5) * 0.3, this.maddyPos.y + 0.2, this.maddyPos.z, Math.random() > 0.5 ? 0xffd84a : 0xfff2a8, 0.6, 0.7);
      }
    }
    if (running && sim!.magnetT > 0 && !s.reducedMotion) {
      // curved sparkle trails on attracted stars
      for (const p of sim!.pickups) {
        if (p.attracted && !p.collected && Math.random() < 0.3) {
          const w = ROUTE.worldAt(p.d, p.lateral);
          this.particles.emit(w.x, p.y, w.z, 0xfff2a8, 0.45, 0.35);
        }
      }
    }
  }

  private updateCityLife(dt: number) {
    const reduced = this.save.data.settings.reducedMotion;
    const shader = this.city.canopyMaterial.userData.shader;
    if (shader) shader.uniforms.uTime.value = reduced ? 0 : this.time;
    // neighbors wave when Maddy is near
    const ppl = this.city.people;
    const m = new THREE.Matrix4();
    const r = new THREE.Matrix4();
    let any = false;
    for (let i = 0; i < ppl.positions.length; i++) {
      const p = ppl.positions[i];
      const near = Math.hypot(p.x - this.maddyPos.x, p.z - this.maddyPos.z) < 45;
      if (!near && !ppl.arms.userData[`w${i}`]) continue;
      const ang = near ? -2.6 + Math.sin(this.time * (reduced ? 3 : 8) + ppl.phases[i]) * 0.45 : 0;
      ppl.arms.userData[`w${i}`] = near;
      r.makeRotationZ(-ang);
      m.multiplyMatrices(ppl.armBase[i], r);
      ppl.arms.setMatrixAt(i, m);
      any = true;
    }
    if (any) ppl.arms.instanceMatrix.needsUpdate = true;
    this.life.update(dt, this.maddyPos.x, this.maddyPos.z, this.pose.heading || 0, reduced);
    this.birdsT -= dt;
    if (this.birdsT <= 0) {
      this.birdsT = 9 + Math.random() * 10;
      if (this.state === 'running' || this.state === 'exploring' || this.state === 'title') this.audio.birds();
    }
  }

  private camCtx(): CamContext {
    const sim = this.sim;
    let heading = this.pose.heading;
    if (sim) {
      // look slightly ahead so corners are anticipated smoothly
      heading = ROUTE.pose(sim.d + 4).heading;
    } else heading = ROUTE.pose(START_S).heading;
    return {
      maddy: this.maddyPos,
      heading,
      lateral: sim ? sim.x : 0,
      gliding: !!sim?.gliding,
      inspectTarget: this.inspectTarget,
      time: this.time,
      aspect: this.sm.camera.aspect,
      peek: this.peekAmount(),
    };
  }

  /** Landmarks now stand straight ahead at the end of each street, so the camera never needs to turn aside. */
  private peekAmount(): number {
    return 0;
  }

  private render(_dt: number) {
    this.sm.render();
    const info = this.sm.renderer.info.render;
    this.stats.drawCalls = info.calls;
    this.stats.triangles = info.triangles;
  }

  // ------------------------------------------------------------------ debug helpers (used by automated screenshots)
  /** Put Maddy on the approach to a landmark (for screenshots). */
  debugView(id: LandmarkId, dist = 40) {
    this.debugCam = null;
    this.debugJump(ROUTE.wrap(LANDMARK_BY_ID[id].s - dist));
  }

  debugJump(s: number) {
    if (!this.sim) return;
    this.sim.travelTo(s);
    this.syncMaddyToSim(0);
    this.camDir.set('chase', 0, this.camCtx());
  }

  debugState() {
    return {
      state: this.state,
      fps: Math.round(this.stats.fps),
      drawCalls: this.stats.drawCalls,
      triangles: this.stats.triangles,
      d: this.sim?.d ?? 0,
      hearts: this.sim?.hearts ?? 0,
      stars: this.sim?.stars ?? 0,
      entities: this.entities?.activeCount ?? 0,
      sceneChildren: this.sm.scene.children.length,
      lane: laneLateral(this.sim?.lane ?? 1) / CONTROLS.laneWidth,
    };
  }
}

function wrap(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function nextFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}
