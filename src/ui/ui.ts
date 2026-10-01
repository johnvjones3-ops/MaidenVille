// UI: real DOM menus, HUD, toasts and overlays. Every visible control is a focusable <button> with a label.

import { COPY, COSMETICS, GAME, MODES, POWERUPS, type CosmeticCategory, type ModeId, type QualityId } from '../config';
import { ACHIEVEMENTS, type GoalDef, type Settlement } from '../save/progression';
import type { SaveData, Settings } from '../save/save';
import { WORD } from '../sim/letterQuest';
import type { MissionDef } from '../sim/missions';
import type { PowerupKind } from '../sim/types';
import { LANDMARKS, LANDMARK_BY_ID, landmarkWorld, type LandmarkId } from '../world/landmarks';
import { ROUTE } from '../world/route';
import { ICON, type IconName } from './icons';
import { landmarkThumb } from './thumbs';

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style') e.setAttribute('style', v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c as any);
  return e;
}

const icon = (name: IconName, cls = 'ico') => el('span', { class: cls, html: ICON[name] });

export interface HudState {
  stars: number;
  score: number;
  hearts: number;
  maxHearts: number;
  showScore: boolean;
  showHearts: boolean;
  letters: boolean[];
  words: number;
  mission: MissionDef | null;
  missionHint: string | null;
  powerups: Array<{ kind: PowerupKind; frac: number; warn: boolean }>;
  shield: boolean;
  invuln: boolean;
}

export interface ResultsData {
  mode: ModeId;
  stars: number;
  score: number;
  distance: number;
  visited: LandmarkId[];
  lettersProgress: number;
  words: number;
  deliveries: string[];
  settlement: Settlement;
  bank: number;
  missionNames: string[];
}

export class UI {
  readonly root: HTMLElement;
  private screen: HTMLElement;
  private hud: HTMLElement;
  private toasts: HTMLElement;
  private bannerEl: HTMLElement;
  private promptEl: HTMLElement;
  private fadeEl: HTMLElement;
  private countEl: HTMLElement;
  private touchEl: HTMLElement;
  private exploreEl: HTMLElement;
  private hudCache = new Map<string, string>();
  private refs: Record<string, HTMLElement> = {};
  private lastFocus: HTMLElement | null = null;
  click: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.hud = el('div', { class: 'hud hidden', 'aria-hidden': 'false' });
    this.toasts = el('div', { class: 'toasts', role: 'status' });
    this.bannerEl = el('div', { class: 'banner' });
    this.promptEl = el('div', { class: 'prompt' });
    this.countEl = el('div', { class: 'countdown hidden', 'aria-live': 'assertive' });
    this.touchEl = el('div', { class: 'touch hidden' });
    this.exploreEl = el('div', { class: 'explore-bar hidden' });
    this.screen = el('div', { class: 'screen-host' });
    this.fadeEl = el('div', { class: 'fade' });
    root.append(this.hud, this.bannerEl, this.promptEl, this.toasts, this.countEl, this.touchEl, this.exploreEl, this.screen, this.fadeEl);
    this.buildHud();
    this.buildTouch();
  }

  // ------------------------------------------------------------------ generic screen handling
  private open(screen: HTMLElement, opts: { modal?: boolean } = {}) {
    this.lastFocus = document.activeElement as HTMLElement | null;
    this.screen.replaceChildren(screen);
    this.screen.classList.toggle('modal', !!opts.modal);
    this.screen.classList.add('active');
    requestAnimationFrame(() => {
      const f = screen.querySelector<HTMLElement>('[data-autofocus]') ?? screen.querySelector<HTMLElement>('button');
      f?.focus({ preventScroll: true });
    });
  }

  closeScreen() {
    this.screen.replaceChildren();
    this.screen.classList.remove('active', 'modal');
  }

  get screenOpen() {
    return this.screen.classList.contains('active');
  }

  private btn(label: string, onClick: () => void, opts: { cls?: string; icon?: IconName; aria?: string; autofocus?: boolean; disabled?: boolean } = {}): HTMLButtonElement {
    const b = el(
      'button',
      {
        class: `btn ${opts.cls ?? ''}`,
        type: 'button',
        'aria-label': opts.aria,
        'data-autofocus': opts.autofocus,
        disabled: opts.disabled,
        onclick: () => {
          this.click();
          onClick();
        },
      },
      opts.icon ? icon(opts.icon) : null,
      label ? el('span', {}, label) : null,
    );
    return b;
  }

  private panel(title: string, onClose: (() => void) | null, ...children: Child[]): HTMLElement {
    return el(
      'div',
      { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('div', { class: 'panel-head' }, el('h2', {}, title), onClose ? this.btn('', onClose, { cls: 'icon-btn', icon: 'close', aria: 'Close' }) : null),
      el('div', { class: 'panel-body' }, ...children),
    );
  }

  fade(on: boolean, ms = 350): Promise<void> {
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, ms));
  }

  // ------------------------------------------------------------------ loading / intro / title
  showLoading(text = 'Building MaidenVille…') {
    this.open(el('div', { class: 'loading' }, el('div', { class: 'wordmark small' }, GAME.title), el('div', { class: 'spinner', 'aria-hidden': 'true' }), el('p', {}, text)));
  }

  showIntro(onSkip: () => void) {
    const s = el(
      'div',
      { class: 'intro' },
      el('div', { class: 'wordmark' }, wordmark()),
      el('p', { class: 'tagline' }, GAME.tagline),
      this.btn('Skip', onSkip, { cls: 'skip', autofocus: true, aria: 'Skip the opening' }),
    );
    s.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      onSkip();
    });
    this.open(s);
  }

  showTitle(o: {
    save: SaveData;
    goals: Array<GoalDef & { done?: boolean }>;
    mode: ModeId;
    onMode: (m: ModeId) => void;
    onPlay: () => void;
    onExplore: () => void;
    onPassport: () => void;
    onCloset: () => void;
    onSettings: () => void;
    onHelp: () => void;
    storageNote: string | null;
  }) {
    const modeBtn = (m: ModeId) => {
      const cfg = MODES[m];
      const b = el(
        'button',
        {
          type: 'button',
          class: `mode-btn ${o.mode === m ? 'selected' : ''}`,
          'aria-pressed': String(o.mode === m),
          onclick: () => {
            this.click();
            o.onMode(m);
          },
        },
        el('strong', {}, cfg.label),
        m === 'challenge' ? el('span', { class: 'tag hard' }, 'Harder') : el('span', { class: 'tag' }, 'Default'),
        el('small', {}, cfg.blurb),
      );
      return b;
    };
    const rec = o.save.records[o.mode === 'challenge' ? 'challenge' : 'explorer'];
    const s = el(
      'div',
      { class: 'title' },
      el('div', { class: 'title-top' }, el('div', { class: 'bank', 'aria-label': `${o.save.stars} Maiden Stars` }, icon('star'), el('span', {}, String(o.save.stars)))),
      el('div', { class: 'wordmark' }, wordmark()),
      el('p', { class: 'tagline' }, GAME.tagline),
      el('p', { class: 'hello' }, `${COPY.letsExplore}`),
      el('div', { class: 'title-main' }, this.btn('Play', o.onPlay, { cls: 'primary huge', icon: 'play', autofocus: true, aria: `Play ${MODES[o.mode].label}` }), el('div', { class: 'modes', role: 'group', 'aria-label': 'Choose a mode' }, modeBtn('explorer'), modeBtn('challenge'))),
      rec.bestScore > 0 ? el('p', { class: 'best' }, `Best ${MODES[o.mode].label} score: ${rec.bestScore.toLocaleString()}`) : null,
      el(
        'div',
        { class: 'title-grid' },
        this.btn('Explore', o.onExplore, { icon: 'map', cls: 'secondary' }),
        this.btn('City Passport', o.onPassport, { icon: 'passport', cls: 'secondary' }),
        this.btn("Maddy's Closet", o.onCloset, { icon: 'shirt', cls: 'secondary' }),
        this.btn('Settings', o.onSettings, { icon: 'gear', cls: 'secondary' }),
        this.btn('Help', o.onHelp, { icon: 'help', cls: 'secondary' }),
      ),
      o.goals.length
        ? el('div', { class: 'goals' }, el('h3', {}, 'Goals'), ...o.goals.map((g) => el('div', { class: 'goal' }, icon('star', 'ico tiny'), el('span', {}, g.text))))
        : el('div', { class: 'goals' }, el('h3', {}, 'Goals'), el('p', {}, 'Every goal complete — amazing!')),
      o.storageNote ? el('p', { class: 'note' }, o.storageNote) : null,
    );
    this.open(s);
  }

  // ------------------------------------------------------------------ HUD
  private buildHud() {
    const r = this.refs;
    r.stars = el('span', { class: 'v' }, '0');
    r.score = el('span', { class: 'v' }, '0');
    r.scoreBox = el('div', { class: 'chip score' }, el('small', {}, 'Score'), r.score);
    r.hearts = el('div', { class: 'hearts', 'aria-label': 'Hearts' });
    r.letters = el('div', { class: 'letters', 'aria-label': 'MADDY letters' }, ...WORD.map((L) => el('span', { class: 'slot' }, L)));
    r.words = el('span', { class: 'words' });
    r.letters.append(r.words);
    r.mission = el('div', { class: 'mission hidden' });
    r.power = el('div', { class: 'power' });
    r.pause = el(
      'button',
      {
        type: 'button',
        class: 'btn icon-btn pause-btn',
        'aria-label': 'Pause',
        onclick: () => {
          this.click();
          this.onPauseClick();
        },
      },
      icon('pause'),
    );
    this.hud.append(
      el('div', { class: 'hud-left' }, (r.starBox = el('div', { class: 'chip stars', 'aria-label': 'Stars' }, icon('star'), r.stars)), r.scoreBox, r.power),
      el('div', { class: 'hud-center' }, r.hearts, r.letters, r.mission),
      el('div', { class: 'hud-right' }, r.pause),
    );
  }

  onPauseClick: () => void = () => {};

  showHUD(on: boolean) {
    this.hud.classList.toggle('hidden', !on);
  }

  private set(key: string, value: string, apply: () => void) {
    if (this.hudCache.get(key) === value) return;
    this.hudCache.set(key, value);
    apply();
  }

  updateHUD(h: HudState) {
    const r = this.refs;
    this.set('stars', String(h.stars), () => (r.stars.textContent = String(h.stars)));
    this.set('score', `${h.showScore}:${Math.floor(h.score)}`, () => {
      r.scoreBox.classList.toggle('hidden', !h.showScore);
      r.starBox.classList.toggle('hidden', !h.showScore);
      r.score.textContent = Math.floor(h.score).toLocaleString();
    });
    this.set('hearts', `${h.showHearts}:${h.hearts}/${h.maxHearts}:${h.shield}:${h.invuln}`, () => {
      r.hearts.classList.toggle('hidden', !h.showHearts);
      r.hearts.classList.toggle('blink', h.invuln);
      r.hearts.setAttribute('aria-label', `${h.hearts} of ${h.maxHearts} hearts`);
      r.hearts.replaceChildren(...Array.from({ length: h.maxHearts }, (_, i) => icon(i < h.hearts ? 'heart' : 'heartEmpty', 'ico heart')), h.shield ? icon('shield', 'ico heart shield-ico') : '');
    });
    this.set('letters', `${h.showScore}:${h.letters.join(',')}:${h.words}`, () => {
      r.letters.classList.toggle('hidden', !h.showScore);
      r.letters.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('got', h.letters[i]));
      r.words.textContent = h.words > 0 ? `×${h.words}` : '';
    });
    const ms = h.mission ? `carry:${h.mission.id}` : h.missionHint ? `hint:${h.missionHint}` : '';
    this.set('mission', ms, () => {
      r.mission.classList.toggle('hidden', !ms);
      if (h.mission) r.mission.replaceChildren(icon(h.mission.item as IconName), el('span', {}, h.mission.verb), el('span', { class: 'arrow' }, '→'));
      else if (h.missionHint) r.mission.replaceChildren(icon('star', 'ico tiny'), el('span', {}, h.missionHint));
    });
    const pk = h.powerups.map((p) => `${p.kind}:${p.frac.toFixed(2)}:${p.warn}`).join('|');
    this.set('power', pk, () => {
      r.power.replaceChildren(
        ...h.powerups.map((p) =>
          el(
            'div',
            { class: `pw ${p.warn ? 'warn' : ''}`, style: `--f:${p.frac}`, 'aria-label': `${powerName(p.kind)} active` },
            icon(p.kind as IconName),
          ),
        ),
      );
    });
  }

  banner(text: string, sub?: string, ms = 2600) {
    this.bannerEl.replaceChildren(el('div', { class: 'banner-in' }, el('strong', {}, text), sub ? el('small', {}, sub) : null));
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    clearTimeout((this.bannerEl as any)._t);
    (this.bannerEl as any)._t = setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }

  toast(text: string, kind: 'good' | 'info' | 'soft' = 'good', ic?: IconName) {
    const t = el('div', { class: `toast ${kind}` }, ic ? icon(ic) : null, el('span', {}, text));
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
  }

  clearToasts() {
    this.toasts.replaceChildren();
    this.bannerEl.classList.remove('show');
    this.promptEl.classList.remove('show');
  }

  tutorial(kind: 'lanes' | 'jump' | 'slide', touch: boolean) {
    const text =
      kind === 'lanes'
        ? touch
          ? 'Swipe left or right to change lanes'
          : 'Press ← / → (or A / D) to change lanes'
        : kind === 'jump'
          ? touch
            ? 'Swipe up to jump the hurdles'
            : 'Press ↑, W or Space to jump'
          : touch
            ? 'Swipe down to slide under the arch'
            : 'Press ↓ or S to slide';
    const ic: IconName = kind === 'lanes' ? 'right' : kind === 'jump' ? 'up' : 'down';
    this.promptEl.replaceChildren(el('div', { class: 'prompt-in' }, icon(ic), el('span', {}, text)));
    this.promptEl.classList.add('show');
    clearTimeout((this.promptEl as any)._t);
    (this.promptEl as any)._t = setTimeout(() => this.promptEl.classList.remove('show'), 3200);
  }

  showCountdown(text: string | null) {
    this.countEl.classList.toggle('hidden', text === null);
    if (text !== null) {
      this.countEl.textContent = text;
      this.countEl.classList.remove('pop');
      void this.countEl.offsetWidth;
      this.countEl.classList.add('pop');
    }
  }

  // ------------------------------------------------------------------ touch buttons + explore bar
  private touchButtons: Array<[HTMLElement, string]> = [];
  private buildTouch() {
    const mk = (ic: IconName, label: string, a: string) => {
      const b = el('button', { type: 'button', class: 'tbtn', 'aria-label': label }, icon(ic));
      this.touchButtons.push([b, a]);
      return b;
    };
    this.touchEl.append(el('div', { class: 'tgroup' }, mk('left', 'Move left', 'left'), mk('right', 'Move right', 'right')), el('div', { class: 'tgroup' }, mk('down', 'Slide', 'slide'), mk('up', 'Jump', 'jump')));
  }

  bindTouch(bind: (el: HTMLElement, action: string) => void) {
    for (const [b, a] of this.touchButtons) bind(b, a);
  }

  showTouch(on: boolean) {
    this.touchEl.classList.toggle('hidden', !on);
  }

  showExploreBar(o: { stopped: boolean; nearby: LandmarkId | null; onStopGo: () => void; onMap: () => void; onLook: () => void } | null) {
    if (!o) {
      this.exploreEl.classList.add('hidden');
      this.exploreEl.replaceChildren();
      this.hudCache.delete('explore');
      return;
    }
    const key = `${o.stopped}:${o.nearby}`;
    if (this.hudCache.get('explore') === key && !this.exploreEl.classList.contains('hidden')) return;
    this.hudCache.set('explore', key);
    this.exploreEl.classList.remove('hidden');
    this.exploreEl.replaceChildren(
      this.btn(o.stopped ? 'Go' : 'Stop', o.onStopGo, { cls: o.stopped ? 'primary' : 'secondary', icon: o.stopped ? 'play' : 'stop', aria: o.stopped ? 'Go: start walking' : 'Stop here' }),
      this.btn('Map', o.onMap, { cls: 'secondary', icon: 'map', aria: 'Open city map' }),
      ...(o.nearby ? [this.btn(`Look at ${LANDMARK_BY_ID[o.nearby].name}`, o.onLook, { cls: 'secondary look', icon: 'eye' })] : []),
    );
  }

  // ------------------------------------------------------------------ pause
  showPause(o: { goals: Array<GoalDef & { progress: number }>; mode: ModeId; onResume: () => void; onRestart: () => void; onSettings: () => void; onHelp: () => void; onQuit: () => void }) {
    const p = this.panel(
      'Paused',
      null,
      el('p', { class: 'center' }, 'Take a breather — MaidenVille will wait for you.'),
      el(
        'div',
        { class: 'stack' },
        this.btn('Resume', o.onResume, { cls: 'primary big', icon: 'play', autofocus: true }),
        o.mode !== 'explore' ? this.btn('Restart', o.onRestart, { cls: 'secondary', icon: 'restart' }) : null,
        this.btn('Settings', o.onSettings, { cls: 'secondary', icon: 'gear' }),
        this.btn('Help', o.onHelp, { cls: 'secondary', icon: 'help' }),
        this.btn(o.mode === 'explore' ? 'Finish exploring' : 'End run', o.onQuit, { cls: 'secondary', icon: 'home' }),
      ),
      o.mode !== 'explore' && o.goals.length
        ? el(
            'div',
            { class: 'goals inpanel' },
            el('h3', {}, 'Goals this run'),
            ...o.goals.map((g) => el('div', { class: 'goal' }, el('span', {}, g.text), el('progress', { max: g.target, value: Math.min(g.target, g.progress), 'aria-label': g.text }))),
          )
        : null,
    );
    this.open(el('div', { class: 'overlay' }, p), { modal: true });
  }

  // ------------------------------------------------------------------ results
  showResults(r: ResultsData, onAgain: () => void, onTitle: () => void) {
    const explore = r.mode === 'explore';
    const s = r.settlement;
    const head = explore ? 'What a lovely walk!' : r.visited.length >= 3 || r.words > 0 ? COPY.shine : 'What an adventure!';
    const p = el(
      'div',
      { class: 'results', role: 'dialog', 'aria-label': 'Results' },
      el('h2', {}, head),
      el('p', { class: 'center sub' }, explore ? 'Every place you visit fills your City Passport.' : COPY.again),
      !explore
        ? el(
            'div',
            { class: 'stats' },
            stat('star', 'Stars earned', `+${r.stars}`),
            stat('badge', 'Score', r.score.toLocaleString() + (s.newBest ? ' — new best!' : '')),
            stat('map', 'Distance', `${r.distance.toLocaleString()} m`),
          )
        : null,
      el('h3', {}, `Places visited (${r.visited.length})`),
      el('div', { class: 'chips' }, ...(r.visited.length ? r.visited.map((id) => el('span', { class: 'chipx' }, LANDMARK_BY_ID[id].name)) : [el('span', { class: 'muted' }, 'Keep running to reach the landmarks!')])),
      !explore
        ? el(
            'div',
            { class: 'row2' },
            el('div', {}, el('h3', {}, 'MADDY letters'), el('div', { class: 'letters static' }, ...WORD.map((L, i) => el('span', { class: `slot ${r.words > 0 || i < r.lettersProgress ? 'got' : ''}` }, L))), r.words > 0 ? el('p', { class: 'muted' }, `Spelled MADDY ${r.words}×!`) : null),
            el('div', {}, el('h3', {}, 'Friendly missions'), el('p', {}, r.missionNames.length ? r.missionNames.join(', ') : 'None this time — try grabbing a glowing item!')),
          )
        : null,
      s.goals.length ? el('div', { class: 'awards' }, el('h3', {}, 'Goals complete'), ...s.goals.map((g) => el('p', {}, icon('check', 'ico tiny'), ` ${g.text}`))) : null,
      s.achievements.length ? el('div', { class: 'awards' }, el('h3', {}, 'New badges'), ...s.achievements.map((a) => el('p', {}, icon('badge', 'ico tiny'), ` ${a.name} — ${a.text}`))) : null,
      !explore ? el('p', { class: 'center bankline' }, icon('star', 'ico tiny'), ` ${r.stars + s.bonusStars} stars added — you now have ${r.bank}.`) : null,
      el('div', { class: 'stack' }, this.btn(explore ? 'Explore again' : 'Run Again', onAgain, { cls: 'primary huge', icon: 'restart', autofocus: true }), this.btn('Title', onTitle, { cls: 'secondary', icon: 'home' })),
    );
    this.open(el('div', { class: 'overlay results-host' }, p), { modal: true });
  }

  // ------------------------------------------------------------------ passport
  showPassport(save: SaveData, onClose: () => void) {
    const cards = LANDMARKS.map((l) => {
      const got = save.stamps.includes(l.id);
      return el(
        'div',
        { class: `pcard ${got ? 'got' : 'locked'}` },
        el('img', { src: landmarkThumb(l.id), alt: got ? l.name : `${l.name} (not visited yet)`, width: 220, height: 165 }),
        el('div', { class: 'pc-body' }, el('strong', {}, l.name), el('p', {}, got ? l.description : 'Visit this place on your run to collect its stamp.')),
        got ? el('div', { class: 'stamp', 'aria-hidden': 'true' }, 'VISITED') : el('div', { class: 'lockmark' }, icon('lock')),
      );
    });
    const all = LANDMARKS.every((l) => save.stamps.includes(l.id));
    const p = this.panel(
      'City Passport',
      onClose,
      el('p', { class: 'center' }, `${save.stamps.length} of ${LANDMARKS.length} stamps collected`),
      all ? el('div', { class: 'explorer-badge' }, icon('badge', 'ico big'), el('strong', {}, 'MaidenVille Explorer'), el('span', {}, 'You visited every place in the city!')) : null,
      el('div', { class: 'pgrid' }, ...cards),
      el('h3', {}, 'Badges'),
      el('div', { class: 'achs' }, ...ACHIEVEMENTS.map((a) => el('div', { class: `ach ${save.achievements.includes(a.id) ? 'got' : ''}` }, icon(save.achievements.includes(a.id) ? 'badge' : 'lock', 'ico'), el('div', {}, el('strong', {}, a.name), el('small', {}, a.text))))),
      el('p', { class: 'muted small' }, 'House names are friendly game labels. The seven buildings come from Maddy’s handmade city model.'),
    );
    this.open(el('div', { class: 'overlay' }, p), { modal: true });
  }

  // ------------------------------------------------------------------ closet
  showCloset(o: { save: SaveData; category: CosmeticCategory; onCategory: (c: CosmeticCategory) => void; onBuy: (id: string) => void; onEquip: (id: string) => void; onClose: () => void }) {
    const cats: Array<[CosmeticCategory, string]> = [
      ['outfit', 'Outfits'],
      ['sneakers', 'Sneakers'],
      ['accessory', 'Hair'],
      ['trail', 'Trails'],
    ];
    const items = COSMETICS.filter((c) => c.category === o.category).map((c) => {
      const owned = o.save.owned.includes(c.id);
      const equipped = o.save.equipped[c.category] === c.id;
      const afford = o.save.stars >= c.cost;
      const swatch = el('span', { class: 'swatch', style: `background:${c.color !== undefined ? '#' + c.color.toString(16).padStart(6, '0') : c.id === 'trail_rainbow' ? 'linear-gradient(90deg,#ff6b6b,#ffd84a,#6be38a,#5fb8f0,#b79cf0)' : c.id === 'outfit_knights' ? '#1d2a52' : '#ddd'}` });
      let action: HTMLElement;
      if (equipped) action = el('span', { class: 'equipped' }, icon('check', 'ico tiny'), ' Wearing');
      else if (owned) action = this.btn('Wear', () => o.onEquip(c.id), { cls: 'small primary', aria: `Wear ${c.name}` });
      else action = this.btn(`${c.cost}`, () => o.onBuy(c.id), { cls: 'small buy', icon: 'star', aria: `Buy ${c.name} for ${c.cost} stars`, disabled: !afford });
      return el('div', { class: `item ${equipped ? 'on' : ''}` }, swatch, el('div', { class: 'item-body' }, el('strong', {}, c.name), el('small', {}, c.note)), action);
    });
    const p = el(
      'div',
      { class: 'closet', role: 'dialog', 'aria-label': "Maddy's Closet" },
      el('div', { class: 'panel-head' }, el('h2', {}, "Maddy's Closet"), el('div', { class: 'bank' }, icon('star'), el('span', {}, String(o.save.stars))), this.btn('', o.onClose, { cls: 'icon-btn', icon: 'close', aria: 'Close closet' })),
      el(
        'div',
        { class: 'tabs', role: 'tablist' },
        ...cats.map(([c, label]) =>
          el(
            'button',
            {
              type: 'button',
              role: 'tab',
              class: `tab ${o.category === c ? 'on' : ''}`,
              'aria-selected': String(o.category === c),
              onclick: () => {
                this.click();
                o.onCategory(c);
              },
            },
            label,
          ),
        ),
      ),
      el('div', { class: 'items' }, ...items),
      el('p', { class: 'muted small' }, 'Earn Maiden Stars by running. Accessories always keep Maddy’s two puffs in view.'),
    );
    this.open(el('div', { class: 'overlay closet-host' }, p), { modal: true });
  }

  // ------------------------------------------------------------------ settings
  showSettings(o: { settings: Settings; onChange: (s: Partial<Settings>) => void; onReplayTutorial: () => void; onReset: () => void; onClose: () => void; storageNote: string | null }) {
    const st = o.settings;
    const slider = (label: string, key: 'sfxVolume' | 'musicVolume') => {
      const id = `s-${key}`;
      return el(
        'div',
        { class: 'field' },
        el('label', { for: id }, label),
        el('input', {
          id,
          type: 'range',
          min: 0,
          max: 100,
          value: Math.round(st[key] * 100),
          oninput: (e: Event) => o.onChange({ [key]: Number((e.target as HTMLInputElement).value) / 100 }),
        }),
      );
    };
    const toggle = (label: string, key: 'muted' | 'reducedMotion' | 'touchButtons', hint?: string) => {
      const id = `s-${key}`;
      return el(
        'div',
        { class: 'field toggle' },
        el('label', { for: id }, label, hint ? el('small', {}, hint) : null),
        el('input', { id, type: 'checkbox', role: 'switch', checked: st[key], onchange: (e: Event) => o.onChange({ [key]: (e.target as HTMLInputElement).checked }) }),
      );
    };
    const q = el(
      'select',
      { id: 's-quality', onchange: (e: Event) => o.onChange({ quality: (e.target as HTMLSelectElement).value as QualityId }) },
      ...(['low', 'medium', 'high'] as const).map((v) => el('option', { value: v, selected: st.quality === v }, v[0].toUpperCase() + v.slice(1))),
    );
    const p = this.panel(
      'Settings',
      o.onClose,
      slider('Sound effects', 'sfxVolume'),
      slider('Music', 'musicVolume'),
      toggle('Mute everything', 'muted'),
      toggle('Reduced motion', 'reducedMotion', 'Fades instead of camera flights, calmer effects'),
      toggle('On-screen buttons', 'touchButtons', 'Big arrow, jump and slide buttons'),
      el('div', { class: 'field' }, el('label', { for: 's-quality' }, 'Graphics quality', el('small', {}, 'Lower if the game feels slow')), q),
      el('div', { class: 'stack' }, this.btn('Replay tutorial on next run', o.onReplayTutorial, { cls: 'secondary', icon: 'help' }), this.btn('Reset progress…', o.onReset, { cls: 'danger' })),
      o.storageNote ? el('p', { class: 'note' }, o.storageNote) : null,
    );
    this.open(el('div', { class: 'overlay' }, p), { modal: true });
  }

  confirm(text: string, yes: string, onYes: () => void, onNo: () => void) {
    const p = this.panel('Are you sure?', onNo, el('p', {}, text), el('div', { class: 'stack' }, this.btn(yes, onYes, { cls: 'danger' }), this.btn('Keep my progress', onNo, { cls: 'primary', autofocus: true })));
    this.open(el('div', { class: 'overlay' }, p), { modal: true });
  }

  // ------------------------------------------------------------------ help
  showHelp(onClose: () => void) {
    const row = (k: string, v: string) => el('tr', {}, el('th', { scope: 'row' }, k), el('td', {}, v));
    const p = this.panel(
      'How to play',
      onClose,
      el('p', {}, 'Maddy runs by herself through her city. Change lanes, jump and slide to avoid the friendly event obstacles, and collect Maiden Stars!'),
      el(
        'table',
        { class: 'keys' },
        el('tbody', {}, row('Change lanes', 'Swipe left/right · ← → · A D'), row('Jump', 'Swipe up · ↑ · W · Space'), row('Slide', 'Swipe down · ↓ · S'), row('Pause', 'Pause button · Esc · P'), row('On-screen buttons', 'Turn on in Settings')),
      ),
      el('h3', {}, 'Obstacles'),
      el('ul', {}, el('li', {}, 'Striped foam hurdles and puddles: jump (yellow ↑ marks).'), el('li', {}, 'Low festival arches: slide under (blue ↓ marks).'), el('li', {}, 'Parcel stacks and closed lanes: change lanes (orange stripes).')),
      el('h3', {}, 'Power-ups'),
      el(
        'ul',
        {},
        el('li', {}, 'Star Magnet — pulls nearby stars to Maddy.'),
        el('li', {}, 'Bubble Shield — absorbs one bump.'),
        el('li', {}, 'Rainbow Sneakers — a short, safe rainbow sprint.'),
        el('li', {}, 'Imagination Glide — fly above the city with a guaranteed clear landing.'),
      ),
      el('h3', {}, 'Quests'),
      el('ul', {}, el('li', {}, 'Collect M, A, D, D, Y in order to spell MADDY.'), el('li', {}, 'Grab a glowing mission item, then run through the green delivery lane at its landmark.'), el('li', {}, 'Pass each landmark to stamp your City Passport.')),
    );
    this.open(el('div', { class: 'overlay' }, p), { modal: true });
  }

  // ------------------------------------------------------------------ explore map & landmark card
  showMap(o: { currentS: number; stamps: string[]; onTravel: (id: LandmarkId) => void; onClose: () => void }) {
    // simple top-down map of the loop with landmark buttons
    const W = 340;
    const H = 340;
    const toMap = (x: number, z: number) => [((x + 70) / 590) * W, ((z + 370) / 590) * H];
    const pts: string[] = [];
    for (let s = 0; s < ROUTE.length; s += 8) {
      const p = ROUTE.pose(s);
      const [mx, my] = toMap(p.x, p.z);
      pts.push(`${mx.toFixed(1)},${my.toFixed(1)}`);
    }
    const me = ROUTE.pose(o.currentS);
    const [mex, mey] = toMap(me.x, me.z);
    const svgStr = `<svg viewBox="0 0 ${W} ${H}" class="mapsvg" aria-hidden="true">
      <rect width="${W}" height="${H}" rx="18" fill="#cfe6b8"/>
      <polygon points="${pts.join(' ')}" fill="#e9f3dc" stroke="#7d7f86" stroke-width="10" stroke-linejoin="round"/>
      <polygon points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="6 6"/>
      <circle cx="${mex}" cy="${mey}" r="8" fill="#ff5d8f" stroke="#fff" stroke-width="3"/>
    </svg>`;
    const host = el('div', { class: 'map-host', html: svgStr });
    for (const l of LANDMARKS) {
      const w = landmarkWorld(l);
      const nudge: Partial<Record<LandmarkId, number>> = { house_turquoise: -12, house_pink: 12 };
      const [mx, my0] = toMap(w.x, w.z);
      const my = my0 + (nudge[l.id] ?? 0);
      host.append(
        el(
          'button',
          {
            type: 'button',
            class: `map-pin ${o.stamps.includes(l.id) ? 'got' : ''}`,
            style: `left:${(mx / W) * 100}%;top:${(my / H) * 100}%`,
            'aria-label': `Travel to ${l.name}`,
            onclick: () => {
              this.click();
              o.onTravel(l.id);
            },
          },
          el('span', {}, l.name),
        ),
      );
    }
    const p = this.panel('City Map', o.onClose, el('p', { class: 'center' }, 'Tap a place to walk there. You are the pink dot.'), host);
    this.open(el('div', { class: 'overlay' }, p), { modal: true });
  }

  showLandmarkCard(id: LandmarkId, stamped: boolean, onClose: () => void) {
    const l = LANDMARK_BY_ID[id];
    const p = this.panel(
      l.name,
      onClose,
      el('img', { class: 'card-img', src: landmarkThumb(id, 360), alt: l.name, width: 360, height: 270 }),
      el('p', {}, l.description),
      el('p', { class: 'muted' }, `Part of ${l.zone}.`, stamped ? ' Stamp collected in your City Passport!' : ''),
      el('div', { class: 'stack' }, this.btn('Keep exploring', onClose, { cls: 'primary', icon: 'play', autofocus: true })),
    );
    this.open(el('div', { class: 'overlay' }, p), { modal: true });
  }

  restoreFocus() {
    this.lastFocus?.focus?.({ preventScroll: true });
  }
}

function stat(ic: IconName, label: string, value: string) {
  return el('div', { class: 'stat' }, icon(ic), el('small', {}, label), el('strong', {}, value));
}

function wordmark(): HTMLElement {
  const w = el('h1', { class: 'wm', 'aria-label': GAME.title });
  const letters = 'MaidenVille';
  const colors = ['#ff5d8f', '#ffb84a', '#ffd84a', '#6be38a', '#5fb8f0', '#b79cf0'];
  [...letters].forEach((ch, i) => w.append(el('span', { class: 'wl', style: `--c:${colors[i % colors.length]};--i:${i}`, 'aria-hidden': 'true' }, ch)));
  w.append(el('span', { class: 'wr', 'aria-hidden': 'true' }, 'Runner!'));
  return w;
}

export function powerName(k: PowerupKind) {
  return k === 'magnet' ? 'Star Magnet' : k === 'shield' ? 'Bubble Shield' : k === 'rainbow' ? 'Rainbow Sneakers' : 'Imagination Glide';
}

export const POWER_DURATION: Record<PowerupKind, number> = {
  magnet: POWERUPS.magnet.duration,
  shield: 1,
  rainbow: POWERUPS.rainbow.duration,
  glide: POWERUPS.glide.duration,
};
