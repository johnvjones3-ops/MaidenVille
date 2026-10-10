// The app controller: screens, input, timers, animation sequencing and saving.

import { Sound } from '../audio/sound';
import { isVowel } from '../engine/answer';
import {
  BONUS_LETTERS,
  NAMES,
  SEGMENT_INFO,
  VOWEL_COST,
  allRevealed,
  canBuyVowel,
  canSolve,
  canSpin,
  canUseWild,
  champion,
  consonantsLeft,
  grandTotal,
  isMainRound,
  isTossup,
  mainTotal,
  newGame,
  pickableLetters,
  prizeTotal,
  reduce,
  vowelsLeft,
  type Ctx,
} from '../engine/game';
import type { Action, GameEvent, GameState, Pid, SpinState } from '../engine/types';
import { formatMoney, wedgeAt } from '../engine/wheels';
import { ALL_PUZZLES } from '../puzzles/bank';
import { PuzzlePicker, type History } from '../puzzles/select';
import { Store, type Settings } from '../save/storage';
import { PLAYER_COLORS, type AvatarConfig } from './avatar';
import { Board } from './board';
import { Confetti } from './confetti';
import { closeTopDialog, confirmDialog, dialogOpen, initDialogs, openDialog } from './dialogs';
import { esc, h, icon } from './dom';
import { LetterBoard } from './letters';
import { Menu, openContestants } from './menu';
import { Podium, avatarHTML, getAvatars, setAvatars } from './podium';
import { rulesHTML } from './rules';
import { SolvePanel } from './solve';
import { WheelView } from './wheel';

type Screen = 'menu' | 'game';
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class App {
  private store = new Store();
  private sound = new Sound();
  private settings: Settings;
  private history: History;
  private picker: PuzzlePicker;
  private ctx: Ctx;
  state: GameState | null = null;
  private saved: GameState | null = null;
  private screen: Screen = 'menu';
  private busy = 0;
  private holdRender = false;
  private spinAnim: SpinState | null = null;
  private pendingLanded = false;
  private pauseReason: 'user' | 'hidden' | 'restore' = 'user';
  private bonusSel: { consonants: string[]; vowel: string | null } = { consonants: [], vowel: null };
  private cardKey = '';
  private lastSecond = -1;
  private lastFrame = 0;
  private tickAcc = 0;
  private lastTickSave = 0;
  private historyDirty = 0;
  private avatarTimer = 0;
  forceNext: number | null = null;

  // elements
  private gameEl!: HTMLElement;
  private stage!: HTMLElement;
  private board!: Board;
  private boardWrap!: HTMLElement;
  private catText!: HTMLElement;
  private catBadge!: HTMLElement;
  private segPill!: HTMLElement;
  private clockPill!: HTMLElement;
  private muteBtn!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private lettersWrap!: HTMLElement;
  private letters!: LetterBoard;
  private bonusSlots!: HTMLElement;
  private wheelWrap!: HTMLElement;
  private wheel!: WheelView;
  private resultChip!: HTMLElement;
  private flashEl!: HTMLElement;
  private envelopeEl!: HTMLElement;
  private controls!: HTMLElement;
  private buzzers!: HTMLElement;
  private podiums: Podium[] = [];
  private cardLayer!: HTMLElement;
  private pauseLayer!: HTMLElement;
  private solve!: SolvePanel;
  private confetti!: Confetti;
  private menu!: Menu;

  constructor(private root: HTMLElement) {
    const local = this.store.load();
    this.settings = local.settings;
    this.history = local.history;
    this.saved = local.save;
    if (local.avatars) setAvatars(local.avatars);
    const rand = Math.random;
    this.picker = new PuzzlePicker(this.history, rand, () => this.markHistoryDirty());
    this.ctx = { picker: this.picker, rand };
    this.build();
    this.applySettings();

    if (local.screen === 'game' && this.saved && !this.saved.finished) {
      this.state = this.saved;
      this.state.paused = true;
      this.pauseReason = 'restore';
      this.show('game');
    } else this.show('menu');

    this.store.sync(local).then((out) => {
      if (!out) return;
      if (out.history) {
        this.history = out.history;
        this.picker.history = out.history;
      }
      if (out.avatars) setAvatars(out.avatars);
      if (out.settings) {
        this.settings = out.settings;
        this.applySettings();
      }
      if (out.save !== undefined && !this.state) this.saved = out.save;
      this.menu.update();
      if (this.screen === 'game') this.render();
    });

    requestAnimationFrame(this.loop);
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('keydown', (e) => this.onKey(e));
    new ResizeObserver(() => this.layout()).observe(this.root);
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 250));
    this.installDebug();
  }

  // ---- building the DOM -----------------------------------------------------------

  private build() {
    initDialogs(this.root);
    this.menu = new Menu(this.root, {
      settings: () => this.settings,
      update: (p) => this.updateSettings(p),
      resumeInfo: () => (this.saved && !this.saved.finished ? this.summary(this.saved) : null),
      newGame: () => this.newGame(),
      resume: () => this.resumeSaved(),
      rules: () => this.openRules(),
      clearHistory: () => this.clearHistory(),
      contestants: () => this.openContestants(),
      testSound: () => {
        this.sound.unlock();
        setTimeout(() => this.sound.play('solve'), 60);
      },
      stats: () => ({ seen: ALL_PUZZLES.filter((p) => p.id in this.history.seen).length, total: ALL_PUZZLES.length }),
    });

    const btn = (cls: string, label: string, ic: string, on: () => void) => {
      const b = h('button', { class: `icon-btn ${cls}`, type: 'button', 'aria-label': label, title: label, html: icon(ic) }) as HTMLButtonElement;
      b.addEventListener('click', on);
      return b;
    };
    this.segPill = h('div', { class: 'seg-pill' });
    this.clockPill = h('div', { class: 'clock-pill', hidden: true });
    this.muteBtn = btn('mute', 'Sound on or off', 'sound', () => this.updateSettings({ muted: !this.settings.muted }));
    const topbar = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand', 'aria-hidden': 'true' }, h('span', {}, 'Spin'), h('b', {}, 'Night')),
      this.segPill,
      this.clockPill,
      h('div', { class: 'spacer' }),
      btn('help', 'How to play', 'help', () => this.openRules()),
      this.muteBtn,
      btn('pause', 'Pause', 'pause', () => this.pause('user')),
    );

    const boardEl = h('div', { class: 'board', 'aria-label': 'Puzzle board' });
    this.board = new Board(boardEl);
    this.catText = h('span', { class: 'cat-text' });
    this.catBadge = h('span', { class: 'cat-badge', hidden: true });
    this.boardWrap = h('div', { class: 'area area-board' }, h('div', { class: 'board-frame' }, boardEl), h('div', { class: 'catbar' }, this.catText, this.catBadge));
    this.statusEl = h('div', { class: 'area area-status', 'aria-live': 'polite' });
    this.bonusSlots = h('div', { class: 'bonus-slots', hidden: true });
    const lettersHost = h('div', { class: 'letters' });
    this.lettersWrap = h('div', { class: 'area area-letters' }, this.bonusSlots, lettersHost);
    this.letters = new LetterBoard(lettersHost);
    this.letters.onPick = (l) => this.pickLetter(l);

    this.resultChip = h('div', { class: 'result-chip', hidden: true });
    this.flashEl = h('div', { class: 'flash', hidden: true });
    this.envelopeEl = h('div', { class: 'envelope', hidden: true });
    this.wheelWrap = h('div', { class: 'area area-wheel' }, this.resultChip, this.envelopeEl, this.flashEl);
    this.wheel = new WheelView(this.wheelWrap);
    this.wheel.onTick = (v) => this.sound.tick(v);
    this.wheel.canFlick = () => !!this.state && canSpin(this.state) && !this.busy && !this.spinAnim;
    this.wheel.onFlick = (from, power) => this.spin(power, from);

    this.controls = h('div', { class: 'area area-controls' });
    this.buzzers = h('div', { class: 'area area-buzzers' });
    const pod0 = h('div', { class: 'area area-pod0' });
    const pod1 = h('div', { class: 'area area-pod1' });
    this.podiums = [new Podium(pod0, 0), new Podium(pod1, 1)];

    this.stage = h('main', { class: 'stage' }, this.boardWrap, this.statusEl, this.lettersWrap, this.wheelWrap, this.controls, this.buzzers, pod0, pod1);
    this.cardLayer = h('div', { class: 'card-layer', hidden: true });
    this.pauseLayer = h('div', { class: 'pause-layer', hidden: true });
    this.gameEl = h('section', { class: 'game', id: 'game' }, topbar, this.stage, this.cardLayer, this.pauseLayer);
    this.root.append(this.gameEl);
    this.solve = new SolvePanel(this.gameEl);
    this.solve.onModeChange = (device) => this.updateSettings({ deviceKeyboard: device });
    this.confetti = new Confetti(this.root);
  }

  private installDebug() {
    let on = false;
    try {
      on = localStorage.getItem('spinnight.debug') === '1';
    } catch {
      /* no storage */
    }
    if (!on) return;
    (window as unknown as Record<string, unknown>).__spinNight = {
      app: this,
      state: () => this.state,
      answer: () => this.state?.puzzle?.answer,
      force: (i: number | null) => (this.forceNext = i),
      act: (a: Action) => this.act(a),
      busy: () => this.busy > 0 || !!this.spinAnim,
    };
  }

  // ---- settings ---------------------------------------------------------------------

  private updateSettings(p: Partial<Settings>) {
    this.settings = { ...this.settings, ...p };
    this.store.saveSettings(this.settings);
    this.applySettings();
    this.menu.update();
  }

  private applySettings() {
    const s = this.settings;
    this.sound.setVolume(s.volume);
    this.sound.setMuted(s.muted);
    const reduce = s.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.wheel.speedScale = reduce ? 0.45 : 1;
    this.board.reduceMotion = !!reduce;
    this.confetti.reduceMotion = !!reduce;
    this.root.classList.toggle('reduce-motion', !!reduce);
    this.muteBtn.innerHTML = icon(s.muted ? 'mute' : 'sound');
    this.muteBtn.setAttribute('aria-pressed', String(!s.muted));
    if (this.solve.device !== s.deviceKeyboard) this.solve.setDevice(s.deviceKeyboard);
  }

  private markHistoryDirty() {
    clearTimeout(this.historyDirty);
    this.historyDirty = window.setTimeout(() => this.store.saveHistory(this.history), 300);
  }

  // ---- screens ----------------------------------------------------------------------

  private show(screen: Screen) {
    this.screen = screen;
    this.root.dataset.screen = screen;
    this.store.saveScreen(screen);
    if (screen === 'menu') {
      this.solve.close();
      this.menu.update();
    } else {
      this.cardKey = '';
      this.render();
    }
    this.layout();
  }

  private summary(s: GameState) {
    const seg = SEGMENT_INFO[s.segment].title.split(' ·')[0];
    return `${seg} · John ${formatMoney(mainTotal(s.players[0]))} · Lex ${formatMoney(mainTotal(s.players[1]))}`;
  }

  private async newGame() {
    if (this.saved && !this.saved.finished) {
      const ok = await confirmDialog({
        title: 'Discard the unfinished game?',
        body: `You have a game in progress: <b>${esc(this.summary(this.saved))}</b>. Starting a new game deletes it. Your puzzle history is kept.`,
        confirm: 'Discard and start new',
        cancel: 'Keep it',
        danger: true,
      });
      if (!ok) return;
    }
    this.startFresh();
  }

  private startFresh() {
    this.history.counter++;
    this.state = newGame({ difficulty: this.settings.difficulty, denton: this.settings.denton, timerMode: this.settings.timerMode }, this.ctx);
    this.saved = this.state;
    this.store.saveHistory(this.history);
    this.persist();
    this.spinAnim = null;
    this.pendingLanded = false;
    this.wheel.setHighlight(null);
    this.show('game');
  }

  private resumeSaved() {
    if (!this.saved) return;
    this.state = this.saved;
    this.state.paused = false;
    this.show('game');
    this.afterResume();
  }

  private toMenu() {
    if (this.state) {
      if (!this.state.paused && !this.state.finished) this.act({ type: 'pause' });
      this.saved = this.state;
      this.persist();
    }
    this.cardLayer.hidden = true;
    this.pauseLayer.hidden = true;
    this.state = null;
    this.show('menu');
  }

  private openRules() {
    openDialog({ title: 'How to Play', body: rulesHTML(), wide: true, className: 'rules' });
  }

  private openContestants() {
    openContestants(
      () => getAvatars(),
      (pid: Pid, cfg: AvatarConfig) => {
        const next = [...getAvatars()] as [AvatarConfig, AvatarConfig];
        next[pid] = cfg;
        setAvatars(next);
        this.podiums.forEach((p) => p.renderFace());
        this.menu.update();
        clearTimeout(this.avatarTimer);
        this.avatarTimer = window.setTimeout(() => this.store.saveAvatars(getAvatars()), 400);
      },
    );
  }

  private async clearHistory() {
    const seen = ALL_PUZZLES.filter((p) => p.id in this.history.seen).length;
    const ok = await confirmDialog({
      title: 'Start a new puzzle set?',
      body: `You've played <b>${seen}</b> of ${ALL_PUZZLES.length} puzzles. Clearing the history lets every puzzle come back. New games already skip puzzles you've seen, so you only need this to replay favorites.`,
      confirm: 'Clear puzzle history',
      danger: true,
    });
    if (!ok) return;
    this.history.seen = {};
    this.store.saveHistory(this.history);
    this.menu.update();
  }

  // ---- actions ----------------------------------------------------------------------

  act(a: Action): boolean {
    const s = this.state;
    if (!s) return false;
    const free = a.type === 'tick' || a.type === 'landed' || a.type === 'pause' || a.type === 'resume';
    if (!free && (this.busy > 0 || this.spinAnim)) return false;
    const r = reduce(s, a, this.ctx);
    if (!r.accepted) return false;
    const prevPhase = s.phase.t + s.segment;
    this.state = r.state;
    this.saved = r.state;
    this.handleEvents(r.events);
    if (a.type === 'spin') this.startSpin(r.state);
    if (a.type === 'tick') {
      const now = performance.now();
      if (now - this.lastTickSave > 1500) {
        this.lastTickSave = now;
        this.persist();
      }
      if (prevPhase !== r.state.phase.t + r.state.segment || r.events.length) this.render();
      else this.renderLive();
    } else {
      this.persist();
      if (!this.holdRender) this.render();
    }
    return true;
  }

  private persist() {
    if (this.state) this.store.saveGame(this.state);
  }

  private animate(p: Promise<unknown>) {
    this.busy++;
    p.finally(() => {
      this.busy = Math.max(0, this.busy - 1);
      if (!this.busy) this.render();
    });
  }

  private handleEvents(events: GameEvent[]) {
    const s = this.state!;
    const mystery = events.find((e) => e.e === 'mysteryReveal');
    if (mystery && mystery.e === 'mysteryReveal') {
      this.holdRender = true;
      this.busy++;
      this.cardLayer.hidden = true;
      this.cardKey = '';
      const rest = events.filter((e) => e !== mystery);
      this.mysteryShow(mystery.result).then(() => {
        this.applyEvents(rest, s);
        this.holdRender = false;
        this.busy--;
        this.render();
      });
      return;
    }
    this.applyEvents(events, s);
  }

  private applyEvents(events: GameEvent[], s: GameState) {
    for (const ev of events) {
      switch (ev.e) {
        case 'reveal': {
          const ans = s.puzzle!.answer;
          if (ev.mode === 'call') this.animate(this.board.revealCall(ans, ev.positions, () => this.sound.play('ding')));
          else if (ev.mode === 'tossup') this.board.revealQuick(ans, ev.positions);
          else if (ev.mode === 'all') this.animate(this.board.revealAll(ans, ev.positions));
          else {
            this.sound.play('reveal');
            this.animate(this.board.revealTogether(ans, ev.positions));
          }
          break;
        }
        case 'sound':
          if (ev.s !== 'ding') this.sound.play(ev.s);
          break;
        case 'flash':
          this.flash(ev.text, ev.tone);
          break;
        case 'celebrate':
          this.confetti.burst(ev.big, ev.pid !== null ? PLAYER_COLORS[ev.pid] : undefined);
          break;
        case 'mood':
          this.podiums[ev.pid].setMood(ev.mood);
          break;
        case 'wrongSolve':
          this.solve.wrong();
          this.board.shake();
          break;
      }
    }
  }

  private async mysteryShow(result: 'cash10k' | 'bankrupt') {
    this.sound.play('mystery');
    const card = h(
      'div',
      { class: 'mystery-flip' },
      h('div', { class: 'mf-inner' }, h('div', { class: 'mf-front' }, h('b', {}, '?'), 'MYSTERY'), h('div', { class: `mf-back ${result}` }, result === 'cash10k' ? '$10,000' : 'BANKRUPT')),
    );
    this.wheelWrap.append(card);
    await wait(this.settings.reduceMotion ? 500 : 1400);
    card.classList.add('flipped');
    await wait(1500);
    card.remove();
  }

  private flash(text: string, tone: string) {
    const f = this.flashEl;
    f.textContent = text;
    f.className = `flash ${tone}`;
    f.hidden = false;
    void f.offsetWidth;
    f.classList.add('go');
    clearTimeout(Number(f.dataset.t));
    f.dataset.t = String(window.setTimeout(() => (f.hidden = true), 1700));
  }

  private spin(power: number, from = this.wheel.angle) {
    if (!this.state || !canSpin(this.state)) return;
    this.sound.unlock();
    const force = this.forceNext;
    this.forceNext = null;
    this.act({ type: 'spin', from, power, force: force ?? undefined });
  }

  private startSpin(s: GameState) {
    if (s.phase.t !== 'spinning') return;
    const spin = s.phase.spin;
    this.spinAnim = spin;
    this.wheel.setHighlight(null);
    this.resultChip.hidden = true;
    this.wheel.spin(spin).then(() => {
      this.spinAnim = null;
      if (this.state?.phase.t !== 'spinning') return;
      this.wheel.setHighlight(wedgeAt(spin.to));
      if (this.state.paused) this.pendingLanded = true;
      else this.act({ type: 'landed' });
    });
  }

  private pickLetter(l: string) {
    const s = this.state;
    if (!s) return;
    if (s.phase.t === 'bonusLetters') {
      this.toggleBonusLetter(l);
      return;
    }
    this.act({ type: 'letter', letter: l });
  }

  private toggleBonusLetter(l: string) {
    const b = this.state?.bonus;
    if (!b || this.busy) return;
    const need = b.extra ? 4 : 3;
    const sel = this.bonusSel;
    if (isVowel(l)) sel.vowel = sel.vowel === l ? null : l;
    else if (sel.consonants.includes(l)) sel.consonants = sel.consonants.filter((c) => c !== l);
    else if (sel.consonants.length < need) sel.consonants.push(l);
    else return;
    this.sound.play('blip');
    this.render();
  }

  private lockBonus() {
    const b = this.state?.bonus;
    if (!b) return;
    if (this.act({ type: 'bonusLetters', consonants: this.bonusSel.consonants, vowel: this.bonusSel.vowel ?? '' })) {
      this.bonusSel = { consonants: [], vowel: null };
    }
  }

  // ---- pause and resume -------------------------------------------------------------

  private timersRunning(s: GameState) {
    const t = s.phase.t;
    if (t === 'tossup' || t === 'tossupAnswer' || t === 'speedLetter' || t === 'speedSolve' || t === 'bonusSolve') return true;
    return s.segment === 'round4' && !s.bellRung && (t === 'turn' || t === 'consonant' || t === 'vowel');
  }

  private pause(reason: 'user' | 'hidden') {
    const s = this.state;
    if (!s || s.finished || s.paused) return;
    this.pauseReason = reason;
    this.act({ type: 'pause' });
  }

  private resume() {
    if (!this.state?.paused) return;
    this.sound.unlock();
    this.act({ type: 'resume' });
    this.afterResume();
  }

  private afterResume() {
    const s = this.state;
    if (!s) return;
    if (s.phase.t === 'spinning' && !this.spinAnim) {
      // A spin was interrupted: land it where it was always going to land.
      this.wheel.finishInstantly(s.phase.spin);
      this.pendingLanded = false;
      this.act({ type: 'landed' });
    } else if (this.pendingLanded) {
      this.pendingLanded = false;
      this.act({ type: 'landed' });
    }
  }

  private onVisibility() {
    if (document.visibilityState === 'hidden') {
      if (this.screen === 'game' && this.state && !this.state.finished && !this.state.paused && this.timersRunning(this.state)) this.pause('hidden');
      this.persist();
    }
    this.lastFrame = performance.now();
  }

  private loop = (now: number) => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(100, now - (this.lastFrame || now));
    this.lastFrame = now;
    const s = this.state;
    if (!s || this.screen !== 'game' || s.paused || s.finished || this.busy || this.spinAnim || dialogOpen() || document.hidden) return;
    this.tickAcc += dt;
    if (this.tickAcc >= 100) {
      const step = this.tickAcc;
      this.tickAcc = 0;
      this.act({ type: 'tick', dt: step });
    }
  };

  // ---- keyboard ---------------------------------------------------------------------

  private onKey(e: KeyboardEvent) {
    if (dialogOpen()) {
      if (e.key === 'Escape') closeTopDialog();
      return;
    }
    if (this.screen !== 'game' || !this.state) return;
    if (this.solve.isOpen && this.solve.handleKey(e)) return;
    const s = this.state;
    const k = e.key;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target?.tagName === 'INPUT') return;
    if (s.paused) {
      if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        this.resume();
      }
      return;
    }
    if (k === 'Escape') {
      this.pause('user');
      return;
    }
    const L = k.length === 1 ? k.toUpperCase() : '';
    const ph = s.phase.t;
    if (ph === 'tossup' && (L === 'J' || L === 'L')) {
      e.preventDefault();
      this.buzz(L === 'J' ? 0 : 1);
      return;
    }
    if (k === 'Enter') {
      const primary = this.cardLayer.querySelector<HTMLButtonElement>('.btn.primary:not([disabled])') ?? this.controls.querySelector<HTMLButtonElement>('.btn.primary:not([disabled])');
      if (primary) {
        e.preventDefault();
        primary.click();
      }
      return;
    }
    if (k === ' ' && canSpin(s)) {
      e.preventDefault();
      this.spin(0.6);
      return;
    }
    if (/^[A-Z]$/.test(L) && this.cardLayer.hidden) {
      if (ph === 'bonusLetters') this.toggleBonusLetter(L);
      else if (pickableLetters(s).has(L)) this.act({ type: 'letter', letter: L });
    }
  }

  private buzz(pid: Pid) {
    this.sound.unlock();
    this.act({ type: 'buzz', pid });
  }

  // ---- layout -----------------------------------------------------------------------

  layout() {
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    if (!W || !H) return;
    const layout = W >= 700 && W / H >= 1.05 ? 'land' : W >= 600 ? 'port' : 'phone';
    this.root.dataset.layout = layout;
    const short = layout === 'land' && H < 520;
    this.root.classList.toggle('short', short);
    if (this.screen !== 'game') return;
    const mode = this.gameEl.dataset.mode;
    const toss = mode === 'tossup';
    const bw = this.boardWrap.clientWidth;
    const topbar = 52;
    const stageH = H - topbar;
    const share = short ? 0.8 : layout === 'land' ? (toss ? (H < 720 ? 0.4 : 0.46) : 0.4) : layout === 'port' ? (toss ? 0.36 : 0.28) : toss ? 0.34 : 0.26;
    const byWidth = (bw - 24) / 14.6;
    const byHeight = (stageH * share - 44) / 4 / 1.26;
    const tile = Math.max(16, Math.floor(Math.min(byWidth, byHeight, 78)));
    this.gameEl.style.setProperty('--tile', `${tile}px`);

    let wheel: number;
    if (short) {
      wheel = Math.min(this.wheelWrap.clientWidth, stageH - 16, 420);
      this.gameEl.style.setProperty('--wheel', `${wheel}px`);
    } else if (layout === 'land') {
      wheel = Math.min(this.wheelWrap.clientWidth, this.wheelWrap.clientHeight);
    } else if (layout === 'port') {
      this.gameEl.style.setProperty('--wheel', `${Math.min(W - 360, stageH * 0.36)}px`);
      wheel = Math.min(W - 2 * 168 - 40, this.wheelWrap.clientHeight);
      this.gameEl.style.setProperty('--wheel', `${Math.max(220, wheel)}px`);
    } else {
      wheel = Math.min(W - 24, stageH * 0.4, 440);
      this.gameEl.style.setProperty('--wheel', `${wheel}px`);
    }
    this.wheel.resize(Math.max(200, wheel - 8));
  }

  // ---- rendering --------------------------------------------------------------------

  private render() {
    const s = this.state;
    if (this.screen !== 'game' || !s) return;
    const mode = isTossup(s.segment) ? 'tossup' : s.segment === 'bonus' ? 'bonus' : s.segment === 'results' ? 'results' : 'round';
    if (this.gameEl.dataset.mode !== mode) {
      this.gameEl.dataset.mode = mode;
      requestAnimationFrame(() => this.layout());
    }
    const ph = s.phase;
    this.gameEl.dataset.phase = ph.t;
    this.board.sync(s.puzzle);

    // Category strip.
    const p = s.puzzle;
    this.catText.textContent = p ? p.category : s.segment === 'bonus' ? 'Bonus Round' : '';
    let badge = '';
    if (s.segment === 'round3') badge = 'Prize Puzzle';
    else if (s.segment.startsWith('triple')) badge = `Triple Toss-Up ${s.segment.slice(-1)} of 3`;
    else if (isTossup(s.segment)) badge = s.segment === 'tiebreak' ? 'Tiebreaker' : `${formatMoney(s.segment === 'tossup1' ? 1000 : 2000)} Toss-Up`;
    else if (s.segment === 'bonus') badge = 'Bonus Round';
    this.catBadge.textContent = badge;
    this.catBadge.hidden = !badge;

    this.segPill.textContent = SEGMENT_INFO[s.segment].title;
    this.statusEl.innerHTML = `<span class="status-who p${s.control}">${isMainRound(s.segment) || s.segment === 'bonus' ? NAMES[s.control] : ''}</span><span class="status-msg">${esc(s.msg)}</span>`;

    // Podiums.
    const tu = s.tossup;
    this.podiums.forEach((pod, i) => {
      const pid = i as Pid;
      const active =
        ph.t === 'tossupAnswer' ? ph.pid === pid : isTossup(s.segment) ? false : s.segment === 'results' ? false : s.control === pid;
      pod.update(s, { active, locked: !!tu && tu.locked[pid] && isTossup(s.segment), showRound: isMainRound(s.segment), animate: true });
    });

    // Letters.
    if (ph.t === 'bonusLetters') {
      const pick = new Set<string>();
      'BCDFGHJKMPQVWXYZAIOU'.split('').forEach((l) => pick.add(l));
      this.letters.update(s.puzzle?.used ?? {}, pick, {
        selected: [...this.bonusSel.consonants, ...(this.bonusSel.vowel ? [this.bonusSel.vowel] : [])],
      });
    } else {
      this.letters.update(s.puzzle?.used ?? {}, this.busy ? new Set() : pickableLetters(s));
    }
    this.lettersWrap.classList.toggle('picking', pickableLetters(s).size > 0 || ph.t === 'bonusLetters');
    this.renderBonusSlots(s);

    // Wheel.
    if (mode === 'round' || mode === 'bonus') {
      this.wheel.setWedges(s.wheel);
      if (!this.spinAnim) {
        if (ph.t === 'spinning') {
          // Restored mid-spin: show the landing it was always going to make.
          this.wheel.finishInstantly(ph.spin);
          if (!s.paused) queueMicrotask(() => this.act({ type: 'landed' }));
          else this.pendingLanded = true;
        } else this.wheel.setAngle(s.angle);
      }
      const landedPhase = ph.t === 'consonant' && !ph.wild ? ph : null;
      const showResult = landedPhase || ph.t === 'mysteryChoice' || ph.t === 'expressChoice';
      if (showResult && !this.spinAnim) {
        const idx = wedgeAt(s.angle);
        this.wheel.setHighlight(idx);
        const w = s.wheel[idx];
        const label =
          ph.t === 'mysteryChoice' ? 'Mystery' : ph.t === 'expressChoice' ? 'Express' : landedPhase && w ? (w.kind === 'cash' ? formatMoney(landedPhase.value) : `${formatMoney(landedPhase.value)} · ${w.kind === 'wild' ? 'Wild Card' : w.kind === 'gift' ? 'Gift Tag' : w.kind === 'prize' ? 'Prize' : w.kind === 'mystery' ? 'Mystery' : w.kind === 'express' ? 'Express' : ''}`) : '';
        this.resultChip.textContent = label;
        this.resultChip.hidden = !label;
      } else if (ph.t === 'consonant' && ph.wild) {
        this.resultChip.textContent = `Wild Card · ${formatMoney(ph.value)}`;
        this.resultChip.hidden = false;
      } else if ((ph.t === 'speedLetter' || ph.t === 'speedSolve') && s.speedValue) {
        this.resultChip.textContent = `Speed-up · ${formatMoney(s.speedValue)}`;
        this.resultChip.hidden = false;
        this.wheel.setHighlight(null);
      } else {
        this.resultChip.hidden = true;
        if (!this.spinAnim && ph.t !== 'spinning') this.wheel.setHighlight(null);
      }
    }
    this.renderEnvelope(s);
    this.renderControls(s);
    this.renderBuzzers(s);
    this.renderCard(s);
    this.renderSolve(s);
    this.renderPause(s);
    this.renderLive();
    this.keepInView(s);
  }

  /** Phones scroll: bring the part of the stage the player needs into view. */
  private keepInView(s: GameState) {
    if (this.root.dataset.layout !== 'phone' && !this.root.classList.contains('short')) return;
    const t = s.phase.t;
    const solving = t === 'solve' || t === 'tossupAnswer' || t === 'speedSolve' || t === 'bonusSolve';
    const target = solving
      ? this.boardWrap
      : t === 'consonant' || t === 'vowel' || t === 'speedLetter' || t === 'bonusLetters' || (t === 'turn' && s.express === s.control)
        ? this.lettersWrap
        : t === 'spinning' || t === 'finalSpin' || t === 'bonusSpin' || t === 'turn'
          ? this.wheelWrap
          : t === 'tossup'
            ? this.buzzers
            : null;
    if (!target || this.stage.dataset.focus === `${t}|${s.control}`) return;
    this.stage.dataset.focus = `${t}|${s.control}`;
    requestAnimationFrame(() => target.scrollIntoView({ block: solving ? 'start' : 'nearest', behavior: 'smooth' }));
  }

  /** Cheap per-tick updates: clocks and timer bars. */
  private renderLive() {
    const s = this.state;
    if (!s || this.screen !== 'game') return;
    const r4 = s.segment === 'round4' && !s.bellRung && s.r4clock !== null && s.phase.t !== 'intro';
    this.clockPill.hidden = !r4;
    if (r4) {
      const sec = Math.ceil((s.r4clock ?? 0) / 1000);
      this.clockPill.textContent = `Final spin in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      this.clockPill.classList.toggle('low', sec <= 10);
    }
    const t = s.timer;
    if (t) {
      this.solve.setTimer(t.ms, t.total);
      const bar = this.controls.querySelector<HTMLElement>('.timer-fill');
      if (bar) bar.style.transform = `scaleX(${Math.max(0, t.ms / t.total)})`;
      const secs = this.controls.querySelector<HTMLElement>('.timer-secs');
      if (secs) secs.textContent = String(Math.ceil(t.ms / 1000));
      const env = this.envelopeEl.querySelector<HTMLElement>('.env-count');
      if (env) env.textContent = String(Math.ceil(t.ms / 1000));
      const sec = Math.ceil(t.ms / 1000);
      if (sec !== this.lastSecond && !s.paused && !this.busy) {
        if (sec <= 5 && sec > 0) this.sound.countdown(sec <= 3);
        this.lastSecond = sec;
      }
    } else this.lastSecond = -1;
    if (s.tossup && s.phase.t === 'tossup') {
      const prog = this.buzzers.querySelector<HTMLElement>('.tu-fill');
      const tu = s.tossup;
      if (prog) prog.style.transform = `scaleX(${tu.shown / Math.max(1, tu.order.length - 1)})`;
      const lc = this.buzzers.querySelector<HTMLElement>('.tu-last');
      if (lc) {
        lc.hidden = tu.lastChance === null;
        if (tu.lastChance !== null) {
          const sec = Math.ceil(tu.lastChance / 1000);
          lc.textContent = `Last chance · ${sec}`;
          if (sec !== this.lastSecond && !this.busy) {
            this.sound.countdown(sec <= 2);
            this.lastSecond = sec;
          }
        }
      }
    }
  }

  private button(label: string, cls: string, on: () => void, opts: { disabled?: boolean; sub?: string; id?: string } = {}) {
    const b = h('button', { type: 'button', class: `btn ${cls}`, id: opts.id, disabled: opts.disabled }, h('span', { class: 'b-main' }, label), opts.sub ? h('span', { class: 'b-sub' }, opts.sub) : null) as HTMLButtonElement;
    b.addEventListener('click', () => {
      this.sound.unlock();
      on();
    });
    return b;
  }

  private renderControls(s: GameState) {
    const c = this.controls;
    c.innerHTML = '';
    const ph = s.phase;
    const P = s.players[s.control];
    const lock = this.busy > 0 || !!this.spinAnim || s.paused;
    const hint = (text: string) => c.append(h('div', { class: 'hint' }, text));
    const timer = () => c.append(h('div', { class: 'ctl-timer' }, h('div', { class: 'timer-track' }, h('div', { class: 'timer-fill' })), h('div', { class: 'timer-secs' })));

    if (isMainRound(s.segment)) {
      if (ph.t === 'turn' || ph.t === 'spinning') {
        const riding = s.express === s.control;
        const row = h('div', { class: 'ctl-row' });
        if (!riding) {
          const noCons = !consonantsLeft(s);
          row.append(
            this.button('Spin', 'spin primary', () => this.spin(0.6), { disabled: lock || !canSpin(s), sub: noCons ? 'No consonants left' : 'or flick the wheel', id: 'btn-spin' }),
          );
        }
        row.append(
          this.button('Buy a Vowel', 'vowel', () => this.act({ type: 'buyVowel' }), {
            disabled: lock || !canBuyVowel(s),
            sub: !vowelsLeft(s) ? 'No vowels left' : P.round < VOWEL_COST ? `Need ${formatMoney(VOWEL_COST)}` : formatMoney(VOWEL_COST),
            id: 'btn-vowel',
          }),
          this.button('Solve', 'solve-btn', () => this.act({ type: 'solve' }), { disabled: lock || !canSolve(s), id: 'btn-solve' }),
        );
        c.append(row);
        if (canUseWild(s) && !lock) {
          c.append(this.button(`Play Wild Card`, 'wild', () => this.act({ type: 'useWild' }), { sub: `Another consonant at ${formatMoney(s.lastValue!)}`, id: 'btn-wild' }));
        }
        if (riding) hint(consonantsLeft(s) ? 'Express: tap a consonant for $1,000 each.' : 'No consonants left. Buy a vowel or solve.');
      } else if (ph.t === 'consonant') {
        hint(`Pick a consonant · ${formatMoney(ph.value)} each`);
      } else if (ph.t === 'vowel') {
        hint(`Pick a vowel · ${formatMoney(VOWEL_COST)}`);
        c.append(this.button('Cancel', 'ghost', () => this.act({ type: 'cancel' }), { id: 'btn-cancel' }));
      } else if (ph.t === 'finalSpin') {
        c.append(this.button('Final Spin', 'spin primary', () => this.spin(0.7), { disabled: lock, sub: 'Consonants: wedge + $1,000', id: 'btn-final' }));
      } else if (ph.t === 'speedLetter') {
        timer();
        hint(`Call a letter · consonants ${formatMoney(s.speedValue)} · vowels free`);
        c.append(this.button('Pass', 'ghost', () => this.act({ type: 'pass' }), { disabled: lock, id: 'btn-pass' }));
      } else if (ph.t === 'speedSolve') {
        timer();
        hint(`${NAMES[s.control]}: solve or pass`);
      }
    } else if (s.segment === 'bonus') {
      if (ph.t === 'bonusSpin' || (ph.t === 'spinning' && ph.spin.kind === 'bonus')) {
        c.append(this.button('Spin for an Envelope', 'spin primary', () => this.spin(0.6), { disabled: lock || ph.t !== 'bonusSpin', id: 'btn-bonus-spin' }));
      } else if (ph.t === 'bonusLetters') {
        const need = s.bonus!.extra ? 4 : 3;
        const ready = this.bonusSel.consonants.length === need && !!this.bonusSel.vowel;
        c.append(
          h(
            'div',
            { class: 'ctl-row' },
            this.button('Clear', 'ghost', () => {
              this.bonusSel = { consonants: [], vowel: null };
              this.render();
            }, { disabled: lock }),
            this.button('Lock In Letters', 'primary', () => this.lockBonus(), {
              disabled: lock || !ready,
              sub: ready ? 'Reveal them together' : `${need - this.bonusSel.consonants.length} consonant(s), ${this.bonusSel.vowel ? 0 : 1} vowel to go`,
              id: 'btn-lock',
            }),
          ),
        );
      } else if (ph.t === 'bonusSolve') {
        hint('Type your answer below. Keep guessing until time runs out.');
      }
    }
  }

  private renderBuzzers(s: GameState) {
    const b = this.buzzers;
    if (!isTossup(s.segment)) {
      b.innerHTML = '';
      return;
    }
    const ph = s.phase;
    const tu = s.tossup;
    const key = `${s.segment}|${ph.t}|${tu?.locked.join()}|${this.busy > 0}`;
    if (b.dataset.key === key) return;
    b.dataset.key = key;
    b.innerHTML = '';
    const row = h('div', { class: 'buzz-row' });
    for (const pid of [0, 1] as Pid[]) {
      const locked = !!tu?.locked[pid];
      const btn = h(
        'button',
        { type: 'button', class: `buzzer p${pid}${locked ? ' locked' : ''}`, id: `buzz-${pid}`, disabled: ph.t !== 'tossup' || locked || this.busy > 0, 'aria-label': `${NAMES[pid]} buzz in` },
        h('span', { class: 'bz-face', html: avatarHTML(pid) }),
        h('span', { class: 'bz-text' }, h('b', {}, locked ? 'Locked out' : NAMES[pid]), h('small', {}, locked ? 'Wrong answer' : `Buzz in · ${pid === 0 ? 'J' : 'L'}`)),
      );
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.buzz(pid);
      });
      btn.addEventListener('click', (e) => {
        if ((e as MouseEvent).detail === 0) this.buzz(pid);
      });
      row.append(btn);
    }
    b.append(
      row,
      h('div', { class: 'tu-progress' }, h('div', { class: 'timer-track' }, h('div', { class: 'tu-fill' })), h('div', { class: 'tu-last', hidden: true })),
    );
  }

  private renderBonusSlots(s: GameState) {
    const el = this.bonusSlots;
    const b = s.bonus;
    if (s.segment !== 'bonus' || !b || (s.phase.t !== 'bonusLetters' && s.phase.t !== 'bonusSolve' && s.phase.t !== 'bonusDone')) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const need = b.extra ? 4 : 3;
    const picking = s.phase.t === 'bonusLetters';
    const cons = picking ? this.bonusSel.consonants : b.consonants;
    const vowel = picking ? this.bonusSel.vowel : b.vowel;
    const slot = (l: string | null | undefined, kind: string, i: number) => {
      const btn = h('button', { type: 'button', class: `bslot ${kind}${l ? ' full' : ''}`, disabled: !picking || !l, 'aria-label': l ? `Remove ${l}` : `Empty ${kind} slot ${i + 1}` }, l ?? '');
      if (picking && l) btn.addEventListener('click', () => this.toggleBonusLetter(l));
      return btn;
    };
    el.innerHTML = '';
    el.append(
      h('div', { class: 'bs-given' }, h('span', { class: 'lbl' }, 'Given'), ...BONUS_LETTERS.map((l) => h('b', {}, l))),
      h(
        'div',
        { class: 'bs-picks' },
        h('span', { class: 'lbl' }, picking ? `Your picks${b.extra ? ' (Wild Card: +1)' : ''}` : 'Your letters'),
        ...Array.from({ length: need }, (_, i) => slot(cons[i], 'cons', i)),
        slot(vowel, 'vow', 0),
      ),
    );
  }

  private renderEnvelope(s: GameState) {
    const el = this.envelopeEl;
    const show = s.segment === 'bonus' && (s.phase.t === 'bonusLetters' || s.phase.t === 'bonusSolve' || s.phase.t === 'bonusDone' || s.phase.t === 'bonusCategory' || s.phase.t === 'intro');
    this.wheelWrap.classList.toggle('show-envelope', show);
    el.hidden = !show;
    if (!show) return;
    const b = s.bonus!;
    const open = s.phase.t === 'bonusDone';
    const sealed = b.envelope !== null;
    const key = `${s.phase.t}|${b.envelope}`;
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.innerHTML = '';
    el.append(
      h(
        'div',
        { class: `env-card${open ? ' open' : ''}${sealed ? '' : ' waiting'}` },
        h('div', { class: 'env-flap' }),
        h('div', { class: 'env-body' }, open ? h('b', { class: 'env-prize' }, formatMoney(b.envelopes[b.envelope ?? 0])) : h('span', { class: 'env-seal' }, sealed ? 'Sealed' : 'Bonus Wheel')),
      ),
      s.phase.t === 'bonusSolve' ? h('div', { class: 'env-count', 'aria-live': 'off' }) : h('div', { class: 'env-caption' }, open ? 'The envelope held' : sealed ? 'Your envelope stays sealed until the end' : 'Pick a category first'),
    );
  }

  private renderSolve(s: GameState) {
    const ph = s.phase;
    const p = s.puzzle;
    if (!p || s.paused || !this.cardLayer.hidden) {
      if (!s.paused) this.solve.close();
      return;
    }
    const submit = (text: string) => {
      this.sound.unlock();
      this.act({ type: 'submit', text });
    };
    // With the device keyboard up, dock the answer box just under the board.
    const top = this.boardWrap.getBoundingClientRect().bottom - this.gameEl.getBoundingClientRect().top + 6;
    this.gameEl.style.setProperty('--solve-top', `${Math.max(52, Math.min(top, this.gameEl.clientHeight - 200))}px`);
    if (ph.t === 'tossupAnswer') {
      this.solve.open({ pid: ph.pid, title: `${NAMES[ph.pid]}, solve the toss-up`, answer: p.answer, timed: true, secondary: { label: 'Pass', action: () => this.act({ type: 'pass' }) }, onSubmit: submit });
    } else if (ph.t === 'solve') {
      this.solve.open({
        pid: ph.pid,
        title: s.express === ph.pid ? `${NAMES[ph.pid]}, solve (Express: a miss is Bankrupt)` : `${NAMES[ph.pid]}, solve the puzzle`,
        answer: p.answer,
        timed: false,
        secondary: { label: 'Back', action: () => this.act({ type: 'cancel' }) },
        onSubmit: submit,
      });
    } else if (ph.t === 'speedSolve' && !this.busy) {
      this.solve.open({ pid: s.control, title: allRevealed(s) ? `${NAMES[s.control]}, solve it!` : `${NAMES[s.control]}, solve or pass`, answer: p.answer, timed: true, secondary: { label: 'Pass', action: () => this.act({ type: 'pass' }) }, onSubmit: submit });
    } else if (ph.t === 'bonusSolve' && !this.busy) {
      this.solve.open({ pid: s.bonus!.pid, title: 'Solve the Bonus Round', answer: p.answer, timed: true, submitLabel: 'Try it', onSubmit: submit });
    } else this.solve.close();
  }

  private renderPause(s: GameState) {
    const L = this.pauseLayer;
    if (!s.paused) {
      L.hidden = true;
      L.innerHTML = '';
      return;
    }
    if (!L.hidden && L.dataset.reason === this.pauseReason) return;
    L.dataset.reason = this.pauseReason;
    L.hidden = false;
    L.innerHTML = '';
    const title = this.pauseReason === 'restore' ? 'Welcome back' : this.pauseReason === 'hidden' ? 'Paused while you were away' : 'Paused';
    const note =
      this.pauseReason === 'restore'
        ? `Your game was saved: ${this.summary(s)}. Everything is where you left it, including the timers.`
        : this.pauseReason === 'hidden'
          ? 'The clock stopped when you left, so nobody lost any time.'
          : 'Timers are stopped.';
    const vol = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(this.settings.volume * 100)), class: 'range', 'aria-label': 'Volume', id: 'pause-volume' }) as HTMLInputElement;
    vol.addEventListener('input', () => this.updateSettings({ volume: Number(vol.value) / 100, muted: false }));
    const mute = this.button(this.settings.muted ? 'Sound off' : 'Sound on', 'ghost small', () => {
      this.updateSettings({ muted: !this.settings.muted });
      mute.querySelector('.b-main')!.textContent = this.settings.muted ? 'Sound off' : 'Sound on';
    });
    L.append(
      h(
        'div',
        { class: 'pause-card' },
        h('h2', {}, title),
        h('p', {}, note),
        this.button('Resume', 'primary big', () => this.resume(), { id: 'btn-resume' }),
        h('div', { class: 'pause-row' }, mute, vol),
        h(
          'div',
          { class: 'pause-row' },
          this.button('How to Play', 'ghost', () => this.openRules()),
          this.button('Main Menu', 'ghost', () => this.toMenu(), { id: 'btn-menu' }),
        ),
      ),
    );
    requestAnimationFrame(() => L.querySelector<HTMLButtonElement>('#btn-resume')?.focus({ preventScroll: true }));
  }

  // ---- phase cards -----------------------------------------------------------------

  private renderCard(s: GameState) {
    const ph = s.phase;
    const key = `${s.id}|${s.segment}|${ph.t}|${s.puzzle?.id ?? ''}|${s.tiebreaks}`;
    const wants = ['intro', 'solved', 'unsolved', 'mysteryChoice', 'expressChoice', 'bonusCategory', 'bonusDone', 'results'].includes(ph.t);
    if (!wants) {
      this.cardLayer.hidden = true;
      this.cardLayer.innerHTML = '';
      this.cardKey = '';
      return;
    }
    // Let the board finish turning before covering anything.
    const delay = this.busy > 0 && (ph.t === 'solved' || ph.t === 'unsolved' || ph.t === 'bonusDone');
    if (delay) return;
    if (key === this.cardKey) {
      this.cardLayer.querySelectorAll<HTMLButtonElement>('button[data-lock]').forEach((b) => (b.disabled = this.busy > 0));
      return;
    }
    this.cardKey = key;
    this.cardLayer.innerHTML = '';
    this.cardLayer.className = `card-layer ${ph.t}`;
    const card = this.cardFor(s);
    this.cardLayer.append(card);
    this.cardLayer.hidden = false;
    requestAnimationFrame(() => card.querySelector<HTMLButtonElement>('.btn.primary')?.focus({ preventScroll: true }));
  }

  private standings(s: GameState) {
    return h(
      'div',
      { class: 'standings' },
      ...([0, 1] as Pid[]).map((pid) =>
        h('div', { class: `st p${pid}` }, h('span', { class: 'st-face', html: avatarHTML(pid) }), h('span', {}, NAMES[pid]), h('b', {}, formatMoney(mainTotal(s.players[pid]) + s.players[pid].bonus))),
      ),
    );
  }

  private cardFor(s: GameState): HTMLElement {
    const ph = s.phase;
    const go = (a: Action, label: string, id: string, cls = 'primary big') => {
      const b = this.button(label, cls, () => this.act(a), { id });
      b.dataset.lock = '1';
      return b;
    };
    switch (ph.t) {
      case 'intro': {
        const info = SEGMENT_INFO[s.segment];
        const isBonus = s.segment === 'bonus';
        const parts: (HTMLElement | null)[] = [
          h('div', { class: 'eyebrow' }, isTossup(s.segment) ? 'Toss-Up' : isBonus ? 'Final segment' : 'Main round'),
          h('h2', {}, s.segment === 'tiebreak' && s.tiebreaks > 0 ? 'Another Tiebreaker' : info.title),
          h('p', {}, info.detail),
        ];
        if (isMainRound(s.segment)) parts.push(h('div', { class: 'starter' }, h('span', { class: 'st-face', html: avatarHTML(s.control, 'happy') }), `${NAMES[s.control]} spins first`));
        if (s.segment === 'tiebreak') parts.push(h('p', { class: 'note' }, `Both players have ${formatMoney(mainTotal(s.players[0]))}.`));
        if (isBonus && s.bonus) {
          parts.push(
            h('div', { class: 'starter big' }, h('span', { class: 'st-face', html: avatarHTML(s.bonus.pid, 'wow') }), `${NAMES[s.bonus.pid]} plays for a sealed envelope worth up to $100,000`),
            s.bonus.extra ? h('p', { class: 'note' }, 'The Wild Card is still in play: it adds a fourth consonant.') : null,
          );
        }
        if (s.puzzle && !isBonus) parts.push(h('div', { class: 'cat-preview' }, h('span', {}, 'Category'), h('b', {}, s.puzzle.category)));
        parts.push(this.standings(s), go({ type: 'start' }, isTossup(s.segment) ? 'Reveal the Puzzle' : isBonus ? 'Choose a Category' : 'Start the Round', 'btn-start'));
        return h('div', { class: `card intro seg-${s.segment}` }, ...parts);
      }
      case 'solved': {
        const solvedTossup = isTossup(s.segment);
        const prizes = ph.prizes.map((p) =>
          h('div', { class: `won-prize ${p.kind}` }, h('span', {}, p.kind === 'trip' ? 'Prize Puzzle: you win a' : 'Prize'), h('b', {}, p.label), h('em', {}, formatMoney(p.value))),
        );
        const theme = s.segment === 'triple3' && s.puzzle?.theme ? h('div', { class: 'theme' }, h('span', {}, 'The theme was'), h('b', {}, s.puzzle.theme)) : null;
        const head = solvedTossup ? (s.segment === 'tiebreak' ? `${NAMES[ph.pid]} wins the tiebreaker!` : `${NAMES[ph.pid]} gets it!`) : `${NAMES[ph.pid]} solves it!`;
        return h(
          'div',
          { class: `card solved p${ph.pid}` },
          h('div', { class: 'win-face', html: avatarHTML(ph.pid, 'happy') }),
          h('h2', {}, head),
          h('div', { class: 'answer-line' }, s.puzzle?.answer ?? ''),
          ph.amount > 0 ? h('div', { class: 'banked' }, `+${formatMoney(ph.amount)} banked`) : null,
          ph.houseMin ? h('p', { class: 'note' }, 'Solved with under $1,000 this round, so the $1,000 house minimum applies.') : null,
          ph.sweep ? h('p', { class: 'sweep' }, 'Triple Toss-Up sweep! Includes the $4,000 bonus.') : null,
          ...prizes,
          theme,
          this.standings(s),
          go({ type: 'continue' }, 'Continue', 'btn-continue'),
        );
      }
      case 'unsolved':
        return h(
          'div',
          { class: 'card unsolved' },
          h('h2', {}, 'Nobody got it'),
          h('div', { class: 'answer-line' }, s.puzzle?.answer ?? ''),
          s.segment === 'triple3' && s.puzzle?.theme ? h('div', { class: 'theme' }, h('span', {}, 'The theme was'), h('b', {}, s.puzzle.theme)) : null,
          s.segment === 'tiebreak' ? h('p', { class: 'note' }, "Still tied. Here's another tiebreaker.") : null,
          this.standings(s),
          go({ type: 'continue' }, 'Continue', 'btn-continue'),
        );
      case 'mysteryChoice': {
        const amt = formatMoney(1000 * ph.count);
        return h(
          'div',
          { class: 'card choice mystery' },
          h('div', { class: 'eyebrow' }, 'Mystery wedge'),
          h('h2', {}, `${NAMES[s.control]}, take ${amt} or flip?`),
          h('p', {}, `Keep ${amt} for your letters, or give it up to flip the wedge. One Mystery wedge hides $10,000 and the other hides a Bankrupt.`),
          h('div', { class: 'row-btns' }, go({ type: 'mysteryKeep' }, `Keep ${amt}`, 'btn-keep', 'secondary big'), go({ type: 'mysteryFlip' }, 'Flip the Wedge', 'btn-flip', 'primary big')),
        );
      }
      case 'expressChoice':
        return h(
          'div',
          { class: 'card choice express' },
          h('div', { class: 'eyebrow' }, 'Express'),
          h('h2', {}, `${NAMES[s.control]}, ride the Express?`),
          h('ul', {}, h('li', {}, 'No more spinning: consonants are $1,000 each.'), h('li', {}, 'Vowels still cost $250.'), h('li', {}, 'Keep going until you solve.'), h('li', { class: 'warn' }, 'Any letter not in the puzzle, or a wrong answer, is a Bankrupt.')),
          h('div', { class: 'row-btns' }, go({ type: 'expressDecline' }, 'No Thanks', 'btn-decline', 'secondary big'), go({ type: 'expressRide' }, 'All Aboard!', 'btn-ride', 'primary big')),
        );
      case 'bonusCategory': {
        const opts = ph.options.map((id, i) => {
          const p = this.picker.get(id);
          const b = this.button(p?.category ?? 'Puzzle', 'cat-card', () => this.act({ type: 'bonusPick', index: i }), { id: `btn-cat-${i}` });
          b.dataset.lock = '1';
          return b;
        });
        return h(
          'div',
          { class: 'card bonus-cats' },
          h('div', { class: 'eyebrow' }, 'Bonus Round'),
          h('h2', {}, `${NAMES[s.bonus!.pid]}, choose a category`),
          h('div', { class: 'cat-cards' }, ...opts),
          h('p', { class: 'note' }, 'Each category hides a different short puzzle.'),
        );
      }
      case 'bonusDone': {
        const b = s.bonus!;
        const value = formatMoney(b.envelopes[b.envelope ?? 0]);
        return h(
          'div',
          { class: `card bonus-done ${ph.solved ? 'won' : 'lost'}` },
          h('div', { class: 'win-face', html: avatarHTML(b.pid, ph.solved ? 'wow' : 'sad') }),
          h('h2', {}, ph.solved ? `${NAMES[b.pid]} wins ${value}!` : "Time's up"),
          h('div', { class: 'answer-line' }, s.puzzle?.answer ?? ''),
          h('p', {}, ph.solved ? `Solved! The envelope held ${value}.` : `The envelope held ${value}.`),
          go({ type: 'continue' }, 'See Final Results', 'btn-continue'),
        );
      }
      case 'results':
        return this.resultsCard(s);
      default:
        return h('div');
    }
  }

  private resultsCard(s: GameState) {
    const totals = s.players.map(grandTotal);
    const champ = champion(s);
    const col = (pid: Pid) => {
      const p = s.players[pid];
      return h(
        'div',
        { class: `score-col p${pid}${champ === pid ? ' champ' : ''}` },
        h('div', { class: 'sc-face', html: avatarHTML(pid, champ === pid ? 'happy' : 'neutral') }),
        h('h3', {}, NAMES[pid]),
        h(
          'dl',
          {},
          h('dt', {}, 'Cash'),
          h('dd', {}, formatMoney(p.bank)),
          h('dt', {}, 'Prizes'),
          h('dd', {}, formatMoney(prizeTotal(p))),
          h('dt', {}, 'Bonus Round'),
          h('dd', {}, p.bonus ? formatMoney(p.bonus) : s.bonus?.pid === pid ? 'Not solved' : '—'),
        ),
        p.prizes.length ? h('ul', { class: 'prize-list' }, ...p.prizes.map((x) => h('li', {}, `${x.label} · ${formatMoney(x.value)}`))) : null,
        h('div', { class: 'grand' }, formatMoney(totals[pid])),
      );
    };
    const rematch = this.button('Rematch', 'primary big', () => this.startFresh(), { id: 'btn-rematch', sub: 'New puzzles, same settings' });
    const menu = this.button('Main Menu', 'ghost big', () => this.toMenu(), { id: 'btn-results-menu' });
    return h(
      'div',
      { class: 'card results' },
      h('div', { class: 'eyebrow' }, 'Final results'),
      h('h2', {}, champ === null ? "It's a tie!" : `${NAMES[champ]} is the Spin Night champion!`),
      h('div', { class: 'score-cols' }, col(0), col(1)),
      h('details', { class: 'recap' }, h('summary', {}, 'Episode recap'), h('ol', {}, ...s.log.map((l) => h('li', { class: l.pid !== undefined ? `p${l.pid}` : '' }, l.text)))),
      h('div', { class: 'row-btns' }, menu, rematch),
      h('p', { class: 'fine' }, 'Two-player home adaptation. Prizes and envelopes are play money.'),
    );
  }
}
