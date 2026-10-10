// Main menu and the contestant (avatar) editor.

import type { DifficultySetting, Pid, TimerMode } from '../engine/types';
import type { Settings } from '../save/storage';
import {
  FACIAL,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRT_COLORS,
  SKIN_TONES,
  avatarSVG,
  cropPhoto,
  type AvatarConfig,
} from './avatar';
import { openDialog } from './dialogs';
import { h, icon } from './dom';
import { NAMES, avatarHTML } from './podium';

export interface MenuHooks {
  settings(): Settings;
  update(patch: Partial<Settings>): void;
  resumeInfo(): string | null;
  newGame(): void;
  resume(): void;
  rules(): void;
  clearHistory(): void;
  contestants(): void;
  testSound(): void;
  stats(): { seen: number; total: number };
}

function segmented<T extends string>(id: string, label: string, options: [T, string][], get: () => T, set: (v: T) => void) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label, id });
  const btns = options.map(([v, text]) => {
    const b = h('button', { type: 'button', role: 'radio', class: 'seg-btn', 'data-v': v }, text);
    b.addEventListener('click', () => set(v));
    wrap.append(b);
    return b;
  });
  const sync = () => {
    const cur = get();
    btns.forEach((b) => {
      const on = b.dataset.v === cur;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  };
  return { el: wrap, sync };
}

function toggle(id: string, label: string, get: () => boolean, set: (v: boolean) => void) {
  const b = h('button', { type: 'button', role: 'switch', class: 'switch', id, 'aria-label': label }, h('span', { class: 'knob' }));
  b.addEventListener('click', () => set(!get()));
  const sync = () => {
    b.classList.toggle('on', get());
    b.setAttribute('aria-checked', String(get()));
  };
  return { el: b, sync };
}

export class Menu {
  readonly el: HTMLElement;
  private resumeBtn: HTMLButtonElement;
  private resumeInfo: HTMLElement;
  private faces: HTMLElement[] = [];
  private syncs: (() => void)[] = [];
  private statsEl: HTMLElement;
  private timerNote: HTMLElement;
  private vol: HTMLInputElement;

  constructor(
    host: HTMLElement,
    private hooks: MenuHooks,
  ) {
    const S = () => hooks.settings();
    const diff = segmented<DifficultySetting>(
      'set-difficulty',
      'Difficulty',
      [
        ['easy', 'Easy'],
        ['medium', 'Medium'],
        ['hard', 'Hard'],
        ['mixed', 'Mixed'],
      ],
      () => S().difficulty,
      (v) => hooks.update({ difficulty: v }),
    );
    const timer = segmented<TimerMode>(
      'set-timer',
      'Timers',
      [
        ['tv', 'TV speed'],
        ['typing', 'Typing-friendly'],
      ],
      () => S().timerMode,
      (v) => hooks.update({ timerMode: v }),
    );
    const denton = toggle('set-denton', 'Denton, Texas puzzles', () => S().denton, (v) => hooks.update({ denton: v }));
    const sound = toggle('set-sound', 'Sound on', () => !S().muted, (v) => hooks.update({ muted: !v }));
    const motion = toggle('set-motion', 'Reduce motion', () => S().reduceMotion, (v) => hooks.update({ reduceMotion: v }));
    this.vol = h('input', { type: 'range', min: '0', max: '100', step: '5', id: 'set-volume', class: 'range', 'aria-label': 'Volume' }) as HTMLInputElement;
    this.vol.addEventListener('input', () => hooks.update({ volume: Number(this.vol.value) / 100, muted: false }));
    const test = h('button', { type: 'button', class: 'btn small ghost', id: 'set-test-sound' }, 'Test sound');
    test.addEventListener('click', () => hooks.testSound());
    this.syncs.push(diff.sync, timer.sync, denton.sync, sound.sync, motion.sync, () => {
      this.vol.value = String(Math.round(S().volume * 100));
      this.vol.disabled = S().muted;
      this.timerNote.textContent =
        S().timerMode === 'tv'
          ? 'Broadcast pace: 10-second toss-up answers and a 10-second Bonus Round.'
          : 'Extra time to type on a touch keyboard: 25-second toss-up answers, 30-second Bonus Round.';
    });
    this.timerNote = h('p', { class: 'note' });

    this.resumeInfo = h('span', { class: 'resume-info' });
    this.resumeBtn = h('button', { type: 'button', class: 'btn big secondary', id: 'menu-resume' }, h('span', {}, 'Resume Game'), this.resumeInfo) as HTMLButtonElement;
    this.resumeBtn.addEventListener('click', () => hooks.resume());
    const start = h('button', { type: 'button', class: 'btn big primary', id: 'menu-new' }, 'Start New Game');
    start.addEventListener('click', () => hooks.newGame());
    const rules = h('button', { type: 'button', class: 'btn ghost', id: 'menu-rules' }, 'How to Play');
    rules.addEventListener('click', () => hooks.rules());
    const people = h('button', { type: 'button', class: 'btn ghost', id: 'menu-contestants' }, 'Contestants');
    people.addEventListener('click', () => hooks.contestants());
    const reset = h('button', { type: 'button', class: 'btn ghost', id: 'menu-reset' }, 'Reset / New Puzzle Set');
    reset.addEventListener('click', () => hooks.clearHistory());
    this.statsEl = h('p', { class: 'fine' });

    for (const pid of [0, 1] as Pid[]) {
      const f = h('button', { type: 'button', class: `menu-face p${pid}`, 'aria-label': `Edit ${NAMES[pid]}'s look` });
      f.addEventListener('click', () => hooks.contestants());
      this.faces.push(f);
    }

    const row = (label: string, control: HTMLElement, extra?: HTMLElement) =>
      h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, label), h('div', { class: 'set-ctl' }, control, extra ?? null));

    this.el = h(
      'section',
      { class: 'menu', id: 'menu' },
      h(
        'div',
        { class: 'menu-inner' },
        h(
          'header',
          { class: 'marquee' },
          h('div', { class: 'logo', 'aria-label': 'Spin Night' }, h('span', { class: 'logo-spin' }, 'Spin'), h('span', { class: 'logo-night' }, 'Night')),
          h(
            'div',
            { class: 'versus' },
            this.faces[0],
            h('div', { class: 'vs-names' }, h('span', { class: 'n0' }, 'John'), h('i', {}, '&'), h('span', { class: 'n1' }, 'Lex')),
            this.faces[1],
          ),
          h('p', { class: 'tagline' }, 'A two-player home adaptation of the classic TV wheel-and-puzzle show.'),
        ),
        h('div', { class: 'menu-actions' }, start, this.resumeBtn),
        h(
          'div',
          { class: 'settings' },
          row('Difficulty', diff.el),
          row('Denton, Texas puzzles', denton.el),
          row('Timers', timer.el, this.timerNote),
          row('Sound', h('div', { class: 'sound-row' }, sound.el, this.vol, test)),
          row('Reduce motion', motion.el),
        ),
        h('div', { class: 'menu-links' }, rules, people, reset),
        this.statsEl,
      ),
    );
    host.append(this.el);
    this.update();
  }

  update() {
    this.syncs.forEach((f) => f());
    const info = this.hooks.resumeInfo();
    this.resumeBtn.hidden = !info;
    this.resumeInfo.textContent = info ?? '';
    this.faces.forEach((f, pid) => (f.innerHTML = avatarHTML(pid as Pid, 'happy')));
    const st = this.hooks.stats();
    this.statsEl.textContent = `${st.total} puzzles in the bank · ${st.seen} already played. New games always use puzzles you haven't seen until the bank runs out.`;
  }
}

// ---- contestant editor -------------------------------------------------------------

export function openContestants(get: () => [AvatarConfig, AvatarConfig], set: (pid: Pid, cfg: AvatarConfig) => void) {
  const body = h('div', { class: 'editor' });
  const images: (HTMLImageElement | null)[] = [null, null];
  const crop: { zoom: number; x: number; y: number }[] = [
    { zoom: 1.2, x: 0, y: -0.2 },
    { zoom: 1.2, x: 0, y: -0.2 },
  ];

  const column = (pid: Pid) => {
    const col = h('div', { class: `ed-col p${pid}` });
    const preview = h('div', { class: 'ed-preview' });
    const controls = h('div', { class: 'ed-controls' });
    const apply = (patch: Partial<AvatarConfig>) => {
      set(pid, { ...get()[pid], ...patch });
      draw();
    };
    const swatches = (label: string, colors: string[], key: 'skin' | 'hairColor' | 'shirt') => {
      const wrap = h('div', { class: 'ed-row' }, h('div', { class: 'ed-label' }, label));
      const list = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': `${NAMES[pid]} ${label}` });
      for (const c of colors) {
        const b = h('button', { type: 'button', class: 'swatch', style: `--c:${c}`, 'aria-label': `${label} ${c}`, 'data-c': c });
        b.addEventListener('click', () => apply({ [key]: c, mode: 'art' }));
        list.append(b);
      }
      wrap.append(list);
      return { wrap, list, key };
    };
    const chips = <T extends string>(label: string, opts: { id: T; label: string }[], key: 'hair' | 'facial') => {
      const wrap = h('div', { class: 'ed-row' }, h('div', { class: 'ed-label' }, label));
      const list = h('div', { class: 'chips' });
      for (const o of opts) {
        const b = h('button', { type: 'button', class: 'chip-btn', 'data-v': o.id }, o.label);
        b.addEventListener('click', () => apply({ [key]: o.id, mode: 'art' } as Partial<AvatarConfig>));
        list.append(b);
      }
      wrap.append(list);
      return { wrap, list, key };
    };
    const skin = swatches('Skin tone', SKIN_TONES, 'skin');
    const hair = chips('Hair', HAIR_STYLES, 'hair');
    const hairColor = swatches('Hair color', HAIR_COLORS, 'hairColor');
    const facial = chips('Facial hair', FACIAL, 'facial');
    const shirt = swatches('Shirt', SHIRT_COLORS, 'shirt');
    const glasses = h('button', { type: 'button', class: 'chip-btn' }, 'Glasses');
    glasses.addEventListener('click', () => apply({ glasses: !get()[pid].glasses, mode: 'art' }));
    const jaw = h('button', { type: 'button', class: 'chip-btn' }, 'Softer jaw');
    jaw.addEventListener('click', () => apply({ jaw: get()[pid].jaw === 'soft' ? 'square' : 'soft', mode: 'art' }));

    const file = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: `photo-${pid}` }) as HTMLInputElement;
    const upload = h('label', { class: 'btn small secondary', for: `photo-${pid}`, html: `${icon('camera')} Use a photo` });
    const removePhoto = h('button', { type: 'button', class: 'btn small ghost' }, 'Use illustration');
    removePhoto.addEventListener('click', () => apply({ mode: 'art' }));
    const zoom = h('input', { type: 'range', min: '100', max: '300', value: '120', class: 'range', 'aria-label': 'Zoom' }) as HTMLInputElement;
    const px = h('input', { type: 'range', min: '-100', max: '100', value: '0', class: 'range', 'aria-label': 'Left and right' }) as HTMLInputElement;
    const py = h('input', { type: 'range', min: '-100', max: '100', value: '-20', class: 'range', 'aria-label': 'Up and down' }) as HTMLInputElement;
    const cropRow = h(
      'div',
      { class: 'ed-crop' },
      h('label', {}, 'Zoom', zoom),
      h('label', {}, 'Left / right', px),
      h('label', {}, 'Up / down', py),
    );
    const recrop = () => {
      const img = images[pid];
      if (!img) return;
      crop[pid] = { zoom: Number(zoom.value) / 100, x: Number(px.value) / 100, y: Number(py.value) / 100 };
      apply({ mode: 'photo', photo: cropPhoto(img, crop[pid].zoom, crop[pid].x, crop[pid].y) });
    };
    for (const r of [zoom, px, py]) r.addEventListener('input', recrop);
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          images[pid] = img;
          recrop();
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(f);
    });

    const draw = () => {
      const cfg = get()[pid];
      preview.innerHTML = avatarSVG(cfg, pid, 'happy');
      for (const s of [skin, hairColor, shirt]) {
        s.list.querySelectorAll<HTMLElement>('.swatch').forEach((b) => b.classList.toggle('on', cfg.mode === 'art' && b.dataset.c === cfg[s.key]));
      }
      for (const c of [hair, facial]) {
        c.list.querySelectorAll<HTMLElement>('.chip-btn').forEach((b) => b.classList.toggle('on', b.dataset.v === cfg[c.key]));
      }
      glasses.classList.toggle('on', cfg.glasses);
      jaw.classList.toggle('on', cfg.jaw === 'soft');
      removePhoto.hidden = cfg.mode !== 'photo';
      cropRow.hidden = cfg.mode !== 'photo' || !images[pid];
    };

    controls.append(
      h('div', { class: 'ed-row photo-row' }, upload, file, removePhoto),
      cropRow,
      skin.wrap,
      hair.wrap,
      hairColor.wrap,
      facial.wrap,
      shirt.wrap,
      h('div', { class: 'ed-row' }, h('div', { class: 'ed-label' }, 'Extras'), h('div', { class: 'chips' }, glasses, jaw)),
    );
    col.append(h('h3', {}, NAMES[pid]), preview, controls);
    draw();
    return col;
  };

  body.append(
    h('p', { class: 'note' }, 'Match each portrait to the real contestant, or upload a photo and crop it. Photos stay in this browser and your private game save.'),
    h('div', { class: 'ed-cols' }, column(0), column(1)),
  );
  openDialog({ title: 'Contestants', body, wide: true, className: 'contestants' });
}
