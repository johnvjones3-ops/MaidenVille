// Answer entry: an onscreen keyboard (keeps the board visible on an iPad),
// with a switch to the device keyboard, and physical-keyboard typing.

import { letterCount } from '../engine/answer';
import type { Pid } from '../engine/types';
import { avatarHTML } from './podium';
import { h, icon } from './dom';

export interface SolveOpts {
  pid: Pid;
  title: string;
  answer: string;
  timed: boolean;
  submitLabel?: string;
  secondary?: { label: string; action: () => void };
  onSubmit: (text: string) => void;
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

export class SolvePanel {
  readonly el: HTMLElement;
  private display: HTMLElement;
  private input: HTMLInputElement;
  private count: HTMLElement;
  private bar: HTMLElement;
  private secs: HTMLElement;
  private who: HTMLElement;
  private title: HTMLElement;
  private secondary: HTMLButtonElement;
  private submitBtn: HTMLButtonElement;
  private toggleBtn: HTMLButtonElement;
  private text = '';
  private opts: SolveOpts | null = null;
  private total = 0;
  device = false;
  onModeChange: (device: boolean) => void = () => {};

  constructor(host: HTMLElement) {
    this.display = h('div', { class: 'solve-display', 'aria-live': 'polite' });
    this.input = h('input', {
      class: 'solve-input',
      type: 'text',
      id: 'solve-input',
      autocomplete: 'off',
      autocapitalize: 'characters',
      autocorrect: 'off',
      spellcheck: 'false',
      enterkeyhint: 'go',
      'aria-label': 'Type the answer',
    }) as HTMLInputElement;
    this.input.addEventListener('input', () => this.setText(this.input.value, false));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
      e.stopPropagation();
    });
    this.count = h('div', { class: 'solve-count' });
    this.bar = h('div', { class: 'timer-fill' });
    this.secs = h('div', { class: 'timer-secs' });
    this.who = h('div', { class: 'solve-who' });
    this.title = h('div', { class: 'solve-title' });
    this.secondary = h('button', { class: 'btn ghost', type: 'button' }) as HTMLButtonElement;
    this.secondary.addEventListener('click', () => this.opts?.secondary?.action());
    this.submitBtn = h('button', { class: 'btn solve-go', type: 'button' }, 'Submit') as HTMLButtonElement;
    this.submitBtn.addEventListener('click', () => this.submit());
    this.toggleBtn = h('button', { class: 'key-mode', type: 'button', html: icon('keyboard') + '<span>Device keyboard</span>' }) as HTMLButtonElement;
    this.toggleBtn.addEventListener('click', () => this.setDevice(!this.device, true));

    const keys = h('div', { class: 'solve-keys' });
    ROWS.forEach((row, ri) => {
      const r = h('div', { class: 'krow' });
      for (const L of row) r.append(this.key(L, L));
      if (ri === 2) r.append(this.key('⌫', 'BACK', 'wide', icon('backspace')));
      keys.append(r);
    });
    const last = h('div', { class: 'krow' });
    last.append(this.key("'", "'"), this.key('-', '-'), this.key('SPACE', ' ', 'space'), this.key('&', '&'), this.key('CLEAR', 'CLEAR', 'wide small'));
    keys.append(last);

    this.el = h(
      'div',
      { class: 'solve', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Solve the puzzle', hidden: true },
      h('div', { class: 'solve-head' }, this.who, h('div', { class: 'solve-titles' }, this.title, this.count), this.secondary, this.submitBtn),
      h('div', { class: 'solve-timer' }, h('div', { class: 'timer-track' }, this.bar), this.secs),
      h('div', { class: 'solve-entry' }, this.display, this.input, this.toggleBtn),
      keys,
    );
    host.append(this.el);
    this.el.addEventListener('animationend', () => this.el.classList.remove('shake'));
  }

  private key(label: string, value: string, cls = '', html?: string) {
    const b = h('button', { class: `skey ${cls}`, type: 'button', 'aria-label': value === ' ' ? 'Space' : value === 'BACK' ? 'Delete' : label });
    b.innerHTML = html ?? label;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // keep focus where it is, no double-tap zoom
      this.press(value);
    });
    b.addEventListener('click', (e) => {
      // Keyboard activation (Enter/Space on a focused key) arrives as a click with detail 0.
      if ((e as MouseEvent).detail === 0) this.press(value);
    });
    return b;
  }

  private press(v: string) {
    if (!this.opts) return;
    if (v === 'BACK') this.setText(this.text.slice(0, -1));
    else if (v === 'CLEAR') this.setText('');
    else this.setText(this.text + v);
  }

  get isOpen() {
    return !!this.opts;
  }

  get value() {
    return this.text;
  }

  setDevice(on: boolean, user = false) {
    this.device = on;
    this.el.classList.toggle('device', on);
    this.toggleBtn.querySelector('span')!.textContent = on ? 'Onscreen keys' : 'Device keyboard';
    if (on) {
      this.input.value = this.text;
      if (this.opts) this.input.focus();
    } else this.input.blur();
    if (user) this.onModeChange(on);
  }

  private setText(t: string, syncInput = true) {
    this.text = t.toUpperCase().replace(/[^A-Z '\-&.,!?]/g, '').replace(/ {2,}/g, ' ').slice(0, 60);
    if (syncInput && this.device) this.input.value = this.text;
    this.display.innerHTML = this.text
      ? `${this.text.replace(/&/g, '&amp;').replace(/ /g, '&nbsp;')}<i class="caret"></i>`
      : '<span class="ph">Type the whole answer</span><i class="caret"></i>';
    const n = letterCount(this.text);
    const need = this.opts ? letterCount(this.opts.answer) : 0;
    this.count.textContent = `${n} of ${need} letters`;
    this.count.classList.toggle('match', n === need && n > 0);
  }

  open(opts: SolveOpts) {
    const same = this.opts && this.opts.pid === opts.pid && this.opts.answer === opts.answer && this.opts.title === opts.title;
    this.opts = opts;
    this.who.innerHTML = avatarHTML(opts.pid, 'happy');
    this.title.textContent = opts.title;
    this.el.dataset.pid = String(opts.pid);
    this.submitBtn.textContent = opts.submitLabel ?? 'Submit';
    this.secondary.hidden = !opts.secondary;
    if (opts.secondary) this.secondary.textContent = opts.secondary.label;
    this.el.classList.toggle('timed', opts.timed);
    if (!same) this.setText('');
    this.el.hidden = false;
    if (this.device) this.input.focus({ preventScroll: true });
  }

  close() {
    this.opts = null;
    this.el.hidden = true;
    this.input.blur();
  }

  setTimer(ms: number, total: number) {
    this.total = total;
    const f = Math.max(0, Math.min(1, ms / Math.max(1, this.total)));
    this.bar.style.transform = `scaleX(${f})`;
    this.bar.classList.toggle('low', ms < 3500);
    this.secs.textContent = `${Math.ceil(ms / 1000)}`;
  }

  wrong() {
    this.setText('');
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
  }

  submit() {
    if (!this.opts) return;
    if (!letterCount(this.text)) {
      this.wrong();
      return;
    }
    this.opts.onSubmit(this.text);
  }

  /** Physical keyboard while the panel is open. Returns true when handled. */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.opts || this.device) return false;
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.key === 'Enter') this.submit();
    else if (e.key === 'Backspace') this.press('BACK');
    else if (e.key === 'Escape' && this.opts.secondary) this.opts.secondary.action();
    else if (e.key.length === 1 && /[a-zA-Z '\-&]/.test(e.key)) this.press(e.key === ' ' ? ' ' : e.key.toUpperCase());
    else return false;
    e.preventDefault();
    return true;
  }
}
