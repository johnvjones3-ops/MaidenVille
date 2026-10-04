import { MAX_FRAME, STEP } from './config';
import { AudioEngine } from './core/audio';
import { Input } from './core/input';
import { SaveStore } from './core/save';
import { BOOKS } from './content';
import { LEVELS } from './levels';
import type { LevelDef } from './levels/types';
import { newRun, type LevelSession, type RunState, type Snapshot } from './game/state';
import { World, type WorldEvents } from './game/world';
import { Renderer } from './render/renderer';
import { TouchControls } from './ui/touch';
import { UI, fmtTime } from './ui/ui';

type Mode = 'title' | 'menu' | 'play' | 'paused' | 'dead' | 'gameover' | 'results' | 'victory';

const MUSIC: Record<string, string> = { plaza: 'plaza', night: 'night', arena: 'arena' };

/** Owns the loop, the state machine between menus and play, saves, audio and input. */
export class Game {
  readonly renderer: Renderer;
  readonly input = new Input();
  readonly audio = new AudioEngine();
  readonly save = new SaveStore(LEVELS.length);
  readonly ui: UI;
  readonly touch: TouchControls;
  mode: Mode = 'title';
  run: RunState = newRun();
  levelIndex = 0;
  def: LevelDef | null = null;
  session: LevelSession = { rare: new Set(), time: 0, deaths: 0 };
  world: World | null = null;
  snapshot: Snapshot | null = null;
  private levelStartRun: RunState = newRun();
  private acc = 0;
  private last = 0;
  private time = 0;
  private raf = 0;
  private deathShown = false;
  private campaign = { balls: 0, enemies: 0, deaths: 0, time: 0 };
  private bannerEl: HTMLElement;

  constructor(
    readonly canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
    touchRoot: HTMLElement,
    bannerEl: HTMLElement,
  ) {
    this.renderer = new Renderer(canvas);
    this.ui = new UI(uiRoot);
    this.ui.onSelect = () => {
      this.audio.unlock();
      this.audio.sfx('select');
    };
    this.bannerEl = bannerEl;
    this.touch = new TouchControls(touchRoot, this.input, () => this.pause());
    this.input.onPause = () => this.pause();
    this.input.onRestart = () => {
      if (this.mode === 'dead') this.respawn();
    };
    const st = this.save.data.settings;
    this.audio.setMusic(st.music);
    this.audio.setSfx(st.sfx);
    this.applyMotion();
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.autoPause();
    });
    // First gesture unlocks audio.
    const unlock = () => {
      this.audio.unlock();
      if (this.mode === 'title' || this.mode === 'menu') this.audio.play('title');
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  start() {
    this.showTitle();
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.touch.destroy();
  }

  resize(w: number, h: number) {
    this.renderer.resize(w, h);
  }

  // ---- loop -------------------------------------------------------------------
  private frame(now: number) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > MAX_FRAME) dt = MAX_FRAME; // long stalls are dropped, not simulated
    this.time += dt;
    const w = this.world;
    if (this.mode === 'play' && w) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) {
        const inp = this.input.sample();
        w.update(STEP, inp);
        if (w.status === 'play') this.session.time += STEP;
        this.acc -= STEP;
        steps++;
        if (w.lastSnapshot) {
          this.snapshot = w.lastSnapshot;
          w.lastSnapshot = null;
        }
        if (this.afterStep(w)) break;
      }
      this.renderer.drawWorld(w, Math.min(1, this.acc / STEP), w.time, dt);
    } else if (w && this.mode !== 'title' && !(this.mode === 'menu' && !this.def)) {
      this.renderer.drawWorld(w, 1, w.time, 0);
    } else {
      this.renderer.drawTitle(this.time);
    }
  }

  /** Reacts to world status changes. Returns true to stop stepping this frame. */
  private afterStep(w: World): boolean {
    if (w.status === 'dead' && w.statusT > 1.9 && !this.deathShown) {
      this.deathShown = true;
      this.run.lives--;
      this.session.deaths++;
      this.campaign.deaths++;
      if (this.run.lives > 0) {
        this.mode = 'dead';
        this.enterMenuInput();
        this.ui.death(this.run.lives, { retry: () => this.respawn(), quit: () => this.quitToTitle() });
      } else {
        this.mode = 'gameover';
        this.enterMenuInput();
        this.audio.play('gameover');
        this.ui.gameOver({ restartLevel: () => this.restartLevel(), newRun: () => this.newRunFrom(0), quit: () => this.quitToTitle() });
      }
      return true;
    }
    if (w.status === 'done') {
      this.levelComplete();
      return true;
    }
    return false;
  }

  private enterMenuInput() {
    this.input.active = false;
    this.input.clearAll();
    this.touch.setVisible(false);
  }
  private enterPlayInput() {
    this.input.clearAll();
    this.input.active = true;
    this.touch.setVisible(this.touchWanted());
    this.acc = 0;
    this.last = performance.now();
  }
  private touchWanted() {
    const t = this.save.data.settings.touch;
    if (t === 'on') return true;
    if (t === 'off') return false;
    return window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  // ---- world events ---------------------------------------------------------------
  private events(): WorldEvents {
    return {
      sfx: (s) => this.audio.sfx(s),
      toast: (t, i) => this.renderer.toast(t, i),
      rare: (rid) => {
        this.save.addRare(rid);
      },
      book: (rid) => {
        const b = BOOKS.find((x) => x.id === rid);
        if (b) this.renderer.toast(`Book found: "${b.title}" (see Gallery)`, 'book');
      },
      music: (m) => {
        if (m === '') this.audio.stopMusic();
        else this.audio.play(m);
      },
    };
  }

  // ---- flow ----------------------------------------------------------------------
  showTitle() {
    this.mode = 'title';
    this.world = null;
    this.def = null;
    this.enterMenuInput();
    this.renderer.clearToasts();
    this.audio.play('title');
    const d = this.save.data;
    const cont = this.save.hasProgress;
    const next = Math.min(d.unlocked, LEVELS.length - 1);
    this.ui.title(
      {
        canContinue: cont,
        continueLabel: `Level ${next + 1}`,
        storageNote: !this.save.available ? 'Saving is unavailable in this browser; progress lasts until you close the page.' : this.save.recovered ? 'Your old save could not be read, so a fresh one was started.' : '',
      },
      {
        continue: () => this.newRunFrom(next),
        start: () => this.newRunFrom(0),
        levels: () => this.showLevels(() => this.showTitle()),
        help: () => this.showHelp(() => this.showTitle()),
        controls: () => this.ui.controls({ back: () => this.showTitle() }),
        gallery: () => this.ui.gallery(new Set(this.save.data.rare), { back: () => this.showTitle() }),
        settings: () => this.showSettings(() => this.showTitle()),
      },
    );
  }

  private showLevels(back: () => void) {
    const d = this.save.data;
    const defs = LEVELS.map((f) => f());
    const acts: Record<string, () => void> = { back };
    defs.forEach((_, i) => (acts[`level${i}`] = () => this.newRunFrom(i)));
    this.ui.levelSelect(
      defs.map((def, i) => ({
        name: def.name,
        subtitle: def.subtitle,
        unlocked: i <= d.unlocked,
        done: d.completed[i],
        best: d.best[i] ? `Best ${d.best[i]!.score.toLocaleString()} · ${fmtTime(d.best[i]!.time)}` : '',
        emblems: def.emblemIds.filter((id) => d.rare.includes(id)).length,
      })),
      acts,
    );
  }

  private showHelp(back: () => void) {
    this.ui.help({ back });
  }

  private showSettings(back: () => void) {
    const s = this.save.data.settings;
    const again = () => this.showSettings(back);
    this.ui.settings(
      {
        music: s.music,
        sfx: s.sfx,
        reducedMotion: s.reducedMotion,
        touch: s.touch === 'auto' ? 'Auto' : s.touch === 'on' ? 'Always' : 'Off',
        storage: this.save.available ? 'Progress and settings are saved in this browser.' : 'Saving is unavailable here; settings last for this visit only.',
      },
      {
        music: () => {
          s.music = !s.music;
          this.audio.setMusic(s.music);
          this.save.save();
          again();
        },
        sfx: () => {
          s.sfx = !s.sfx;
          this.audio.setSfx(s.sfx);
          this.save.save();
          again();
        },
        motion: () => {
          s.reducedMotion = !s.reducedMotion;
          this.applyMotion();
          this.save.save();
          again();
        },
        touch: () => {
          s.touch = s.touch === 'auto' ? 'on' : s.touch === 'on' ? 'off' : 'auto';
          this.save.save();
          again();
        },
        reset: () =>
          this.ui.confirm('This erases unlocked levels, best scores, V emblems and books. Settings are kept.', {
            no: again,
            yes: () => {
              this.save.resetProgress();
              this.renderer.toast('Progress reset');
              again();
            },
          }),
        back,
      },
    );
  }

  private applyMotion() {
    const r = this.save.data.settings.reducedMotion;
    this.renderer.reducedMotion = r;
    document.documentElement.classList.toggle('reduced-motion', r);
    if (this.world) {
      this.world.camera.reduced = r;
      this.world.particles.density = r ? 0.4 : 1;
    }
  }

  newRunFrom(i: number) {
    this.run = newRun();
    this.campaign = { balls: 0, enemies: 0, deaths: 0, time: 0 };
    this.startLevel(i);
  }

  startLevel(i: number) {
    this.levelIndex = i;
    this.def = LEVELS[i]();
    this.session = { rare: new Set(), time: 0, deaths: 0 };
    this.levelStartRun = { ...this.run };
    this.buildWorld(undefined);
    this.snapshot = this.world!.snapshot(this.def.spawn, -1);
    this.ui.hide();
    this.mode = 'play';
    this.enterPlayInput();
    this.audio.play(MUSIC[this.def.theme]);
    this.showBanner(`Level ${i + 1}`, this.def.name, this.def.subtitle);
  }

  private buildWorld(snap: Snapshot | undefined) {
    const w = new World(this.def!, this.run, this.session, new Set(this.save.data.rare), this.events(), snap);
    w.camera.reduced = this.save.data.settings.reducedMotion;
    w.particles.density = this.save.data.settings.reducedMotion ? 0.4 : 1;
    this.world = w;
    this.deathShown = false;
  }

  private showBanner(a: string, b: string, c: string) {
    const el = this.bannerEl;
    el.innerHTML = `<span class="b1">${a}</span><span class="b2">${b}</span><span class="b3">${c}</span>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  /** Retry from the latest checkpoint snapshot (coherent: no reward farming). */
  respawn() {
    if (!this.def || !this.snapshot) return;
    this.run.form = 'rookie';
    this.buildWorld(this.snapshot);
    this.renderer.clearToasts();
    this.ui.hide();
    this.mode = 'play';
    this.enterPlayInput();
    this.audio.pause(false);
    this.audio.play(MUSIC[this.def.theme]);
  }

  restartLevel() {
    this.run = { ...this.levelStartRun, lives: Math.max(this.levelStartRun.lives, 3) };
    this.startLevel(this.levelIndex);
  }

  quitToTitle() {
    this.audio.pause(false);
    this.showTitle();
  }

  pause() {
    if (this.mode !== 'play' || !this.world) return;
    if (this.world.status !== 'play' && this.world.status !== 'dead') return;
    this.mode = 'paused';
    this.enterMenuInput();
    this.audio.pause(true);
    this.audio.sfx('pause');
    this.showPause();
  }

  private autoPause() {
    if (this.mode === 'play') this.pause();
    this.input.clearAll();
    this.touch.reset();
  }

  private showPause() {
    this.ui.pause(
      { level: this.def!.name, emblems: this.def!.emblemIds.filter((id) => this.session.rare.has(id)).length, time: fmtTime(this.session.time) },
      {
        resume: () => this.resume(),
        retry: () => this.respawn(),
        help: () => this.showHelp(() => this.showPause()),
        settings: () => this.showSettings(() => this.showPause()),
        quit: () => this.quitToTitle(),
      },
    );
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.ui.hide();
    this.mode = 'play';
    this.enterPlayInput();
    this.audio.pause(false);
  }

  private levelComplete() {
    const w = this.world!;
    const def = this.def!;
    const i = this.levelIndex;
    const levelScore = this.run.score - this.levelStartRun.score;
    const prevBest = this.save.data.best[i];
    const t = this.session.time;
    this.save.completeLevel(i, levelScore, t);
    const newBest = !prevBest || levelScore > prevBest.score || t < prevBest.time;
    this.campaign.balls += w.levelBalls;
    this.campaign.enemies += w.enemiesDefeated;
    this.campaign.time += t;
    this.mode = 'results';
    this.enterMenuInput();
    const emblems = def.emblemIds.map((id) => this.session.rare.has(id));
    const total = def.emblemIds.filter((id) => this.save.data.rare.includes(id)).length;
    const hands = def.rareIds.filter((id) => this.session.rare.has(id)).length;
    const books = def.bookIds.filter((id) => this.session.rare.has(id)).length;
    const last = i === LEVELS.length - 1;
    const rows: [string, string][] = [
      ['Time', fmtTime(t)],
      ['Level score', levelScore.toLocaleString()],
      ['Total score', this.run.score.toLocaleString()],
      ['Basketballs', String(w.levelBalls)],
      ['V Emblems (this run / all-time)', `${emblems.filter(Boolean).length}/3 · ${total}/3`],
      ['V Spirit Hands', `${hands}/${def.rareIds.length}`],
      ['Orange Books', `${books}/${def.bookIds.length}`],
      ['Enemies defeated', String(w.enemiesDefeated)],
      ['Falls', String(this.session.deaths)],
    ];
    this.ui.results(
      { title: `${def.name}: Clear!`, rows, emblems, next: last ? 'Campaign finale' : `Next: Level ${i + 2}`, newBest },
      {
        next: () => (last ? this.showVictory() : this.startLevel(i + 1)),
        replay: () => this.restartLevel(),
        quit: () => this.quitToTitle(),
      },
    );
  }

  private showVictory() {
    this.mode = 'victory';
    this.audio.play('victory');
    const d = this.save.data;
    const allEmblems = LEVELS.map((f) => f()).flatMap((x) => x.emblemIds);
    const found = allEmblems.filter((id) => d.rare.includes(id)).length;
    const rows: [string, string][] = [
      ['Final score', this.run.score.toLocaleString()],
      ['Campaign time (this run)', fmtTime(this.campaign.time)],
      ['Basketballs (this run)', String(this.campaign.balls)],
      ['Enemies defeated', String(this.campaign.enemies)],
      ['Falls', String(this.campaign.deaths)],
      ['V Emblems collected (all-time)', `${found}/${allEmblems.length}`],
      ['Books in the Gallery', `${BOOKS.filter((b) => d.rare.includes(b.id)).length}/${BOOKS.length}`],
    ];
    this.ui.victory(rows, { title: () => this.showTitle(), levels: () => this.showLevels(() => this.showTitle()) });
  }
}
