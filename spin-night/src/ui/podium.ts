// Contestant podiums: portrait, name plate, round money, banked total and cards.

import { NAMES, mainTotal } from '../engine/game';
import type { GameState, Pid } from '../engine/types';
import { formatMoney } from '../engine/wheels';
import { avatarSVG, DEFAULT_AVATARS, normalizeAvatar, type AvatarConfig, type Mood } from './avatar';
import { h, icon } from './dom';

let avatars: [AvatarConfig, AvatarConfig] = structuredClone(DEFAULT_AVATARS);
const moods: Mood[] = ['neutral', 'neutral'];

export function setAvatars(a: [AvatarConfig, AvatarConfig]) {
  avatars = [normalizeAvatar(0, a[0]), normalizeAvatar(1, a[1])];
}

export function getAvatars() {
  return avatars;
}

export function avatarHTML(pid: Pid, mood?: Mood) {
  return avatarSVG(avatars[pid], pid, mood ?? moods[pid]);
}

/** Tweens a money display toward its new value. */
class Counter {
  private shown = 0;
  private target = 0;
  private raf = 0;
  constructor(private el: HTMLElement) {}
  set(v: number, animate = true) {
    if (v === this.target) return;
    this.target = v;
    cancelAnimationFrame(this.raf);
    if (!animate || Math.abs(v - this.shown) < 1) {
      this.shown = v;
      this.el.textContent = formatMoney(v);
      return;
    }
    const from = this.shown;
    const t0 = performance.now();
    const dur = Math.min(900, 250 + Math.abs(v - from) / 20);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      this.shown = from + (v - from) * (1 - (1 - t) ** 3);
      this.el.textContent = formatMoney(this.shown);
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
}

export { NAMES };

export class Podium {
  readonly el: HTMLElement;
  private face: HTMLElement;
  private round: Counter;
  private total: Counter;
  private roundEl: HTMLElement;
  private cards: HTMLElement;
  private badge: HTMLElement;
  private moodTimer = 0;
  private lastAvatarKey = '';

  constructor(
    host: HTMLElement,
    readonly pid: Pid,
  ) {
    this.face = h('div', { class: 'pod-face' });
    this.roundEl = h('div', { class: 'led' }, '$0');
    const totalEl = h('b', {}, '$0');
    this.cards = h('div', { class: 'pod-cards' });
    this.badge = h('div', { class: 'pod-badge' });
    this.el = h(
      'div',
      { class: `podium p${pid}` },
      h('div', { class: 'pod-lights', 'aria-hidden': 'true' }),
      this.face,
      h(
        'div',
        { class: 'pod-body' },
        h('div', { class: 'pod-name' }, NAMES[pid]),
        h('div', { class: 'pod-round' }, h('span', { class: 'lbl' }, 'This round'), this.roundEl),
        h('div', { class: 'pod-total' }, h('span', { class: 'lbl' }, 'Banked'), totalEl),
        this.cards,
      ),
      this.badge,
    );
    host.append(this.el);
    this.round = new Counter(this.roundEl);
    this.total = new Counter(totalEl);
    this.renderFace();
  }

  renderFace() {
    const key = JSON.stringify(avatars[this.pid]) + moods[this.pid];
    if (key === this.lastAvatarKey) return;
    this.lastAvatarKey = key;
    this.face.innerHTML = avatarHTML(this.pid);
  }

  setMood(mood: Mood, ms = 3200) {
    moods[this.pid] = mood;
    this.renderFace();
    this.el.classList.remove('bounce', 'droop');
    void this.el.offsetWidth;
    if (mood === 'happy' || mood === 'wow') this.el.classList.add('bounce');
    if (mood === 'sad') this.el.classList.add('droop');
    clearTimeout(this.moodTimer);
    this.moodTimer = window.setTimeout(() => {
      moods[this.pid] = 'neutral';
      this.renderFace();
    }, ms);
  }

  update(s: GameState | null, o: { active: boolean; locked: boolean; showRound: boolean; animate: boolean }) {
    this.renderFace();
    const p = s?.players[this.pid];
    this.el.classList.toggle('active', o.active);
    this.el.classList.toggle('locked', o.locked);
    this.el.classList.toggle('no-round', !o.showRound);
    this.round.set(p?.round ?? 0, o.animate);
    this.total.set(p ? mainTotal(p) + p.bonus : 0, o.animate);
    const chips: string[] = [];
    if (p?.wild === 'held') chips.push(`<span class="chip wild">${icon('star')}Wild Card</span>`);
    for (const pr of p?.roundPrizes ?? []) chips.push(`<span class="chip risk" title="Lost on Bankrupt or if the other player solves">${pr.label} ${formatMoney(pr.value)}</span>`);
    for (const pr of p?.prizes ?? []) chips.push(`<span class="chip won" title="Banked">${pr.kind === 'trip' ? 'Trip' : pr.label} ${formatMoney(pr.value)}</span>`);
    this.cards.innerHTML = chips.join('');
    this.badge.textContent = o.locked ? 'Locked out' : o.active ? 'Your turn' : '';
    this.badge.hidden = !o.locked && !o.active;
  }
}
