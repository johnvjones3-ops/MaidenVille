import { BOOKS, ITEM_GUIDE } from '../content';
import { ICONS, makeCanvas } from '../render/art';

type Actions = Record<string, () => void>;

const urlCache = new Map<string, string>();
export function iconURL(key: string, size = 48): string {
  const k = `${key}:${size}`;
  let u = urlCache.get(k);
  if (!u) {
    const c = makeCanvas(size * 2, size * 2);
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.translate(size / 2, size / 2);
    ICONS[key]?.(ctx, size * 0.8);
    u = c.toDataURL();
    urlCache.set(k, u);
  }
  return u;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** DOM menus layered over the canvas. Every button is a real <button> (keyboard + touch). */
export class UI {
  private actions: Actions = {};
  private backAction: string | null = null;
  screen = '';
  onSelect: () => void = () => {};

  constructor(readonly root: HTMLElement) {
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!el || !root.contains(el)) return;
      const a = this.actions[el.dataset.act!];
      if (a) {
        this.onSelect();
        a();
      }
    });
    root.addEventListener('keydown', (e) => {
      if (!this.screen) return;
      const btns = [...root.querySelectorAll<HTMLButtonElement>('button[data-act]:not([disabled])')];
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        btns[(i + 1) % btns.length]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        btns[(i - 1 + btns.length) % btns.length]?.focus();
      } else if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && this.backAction) {
        e.preventDefault();
        const a = this.actions[this.backAction];
        if (a) a();
      } else if ((e.key === 'r' || e.key === 'R') && this.actions.retry) {
        e.preventDefault();
        this.actions.retry();
      }
    });
  }

  hide() {
    this.screen = '';
    this.actions = {};
    this.backAction = null;
    this.root.innerHTML = '';
    this.root.classList.remove('show', 'dim', 'clear');
  }

  private render(screen: string, html: string, actions: Actions, back: string | null = null, style: 'dim' | 'clear' = 'dim') {
    this.screen = screen;
    this.actions = actions;
    this.backAction = back;
    this.root.innerHTML = html;
    this.root.classList.add('show');
    this.root.classList.toggle('dim', style === 'dim');
    this.root.classList.toggle('clear', style === 'clear');
    const first = this.root.querySelector<HTMLButtonElement>('button[data-act].primary') ?? this.root.querySelector<HTMLButtonElement>('button[data-act]');
    first?.focus({ preventScroll: true });
  }

  title(opts: { canContinue: boolean; continueLabel: string; storageNote: string }, a: Actions) {
    this.render(
      'title',
      `<div class="title-wrap">
        <div class="logo"><span class="logo-top">UTRGV</span><span class="logo-main">VAQUERO QUEST</span><span class="logo-sub">Run · Jump · Pack the Fieldhouse</span></div>
        <div class="spacer"></div>
        <div class="menu title-menu">
          <div class="row">
          ${opts.canContinue ? `<button class="btn primary" data-act="continue">Continue <small>${esc(opts.continueLabel)}</small></button>` : ''}
          <button class="btn ${opts.canContinue ? '' : 'primary'}" data-act="start">${opts.canContinue ? 'New Game' : 'Start'}</button>
          <button class="btn" data-act="levels">Level Select</button>
          </div>
          <div class="row">
            <button class="btn small" data-act="help">Items</button>
            <button class="btn small" data-act="controls">Controls</button>
            <button class="btn small" data-act="gallery">Gallery</button>
            <button class="btn small" data-act="settings">Settings</button>
          </div>
        </div>
        ${opts.storageNote ? `<p class="note">${esc(opts.storageNote)}</p>` : ''}
        <p class="fine">An original fan-made platformer. All art and music are drawn and synthesized in the browser.</p>
      </div>`,
      a,
      null,
      'clear',
    );
  }

  levelSelect(levels: { name: string; subtitle: string; unlocked: boolean; done: boolean; best: string; emblems: number }[], a: Actions) {
    this.render(
      'levels',
      `<div class="panel wide"><h2>Level Select</h2>
        <div class="levels">${levels
          .map(
            (l, i) => `<button class="lvl ${l.unlocked ? '' : 'locked'}" data-act="${l.unlocked ? `level${i}` : ''}" ${l.unlocked ? '' : 'disabled'}>
              <span class="num">${i + 1}</span>
              <span class="lname">${esc(l.name)}</span>
              <span class="lsub">${l.unlocked ? esc(l.subtitle) : 'Locked: clear the previous level'}</span>
              <span class="lmeta">${l.unlocked ? `${`<img alt="" src="${iconURL('emblem', 22)}">`.repeat(l.emblems)}${`<img alt="" class="ghost" src="${iconURL('emblemGhost', 22)}">`.repeat(3 - l.emblems)} ${l.done ? '✔ ' : ''}${esc(l.best)}` : '🔒'}</span>
            </button>`,
          )
          .join('')}</div>
        <button class="btn" data-act="back">Back</button></div>`,
      a,
      'back',
    );
  }

  controls(a: Actions) {
    this.render(
      'controls',
      `<div class="panel"><h2>Controls</h2>
        <table class="keys">
          <tr><td>Move</td><td><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd></td></tr>
          <tr><td>Jump (hold = higher)</td><td><kbd>Space</kbd> or <kbd>Z</kbd></td></tr>
          <tr><td>Run</td><td>hold <kbd>Shift</kbd> or <kbd>X</kbd></td></tr>
          <tr><td>Lasso</td><td><kbd>C</kbd></td></tr>
          <tr><td>Drop through a ledge</td><td><kbd>↓</kbd> + <kbd>Space</kbd></td></tr>
          <tr><td>Enter a door</td><td><kbd>↑</kbd> or <kbd>W</kbd></td></tr>
          <tr><td>Pause</td><td><kbd>Esc</kbd> or <kbd>P</kbd></td></tr>
          <tr><td>Restart at checkpoint</td><td><kbd>R</kbd> (paused or after a fall)</td></tr>
        </table>
        <p class="hint"><b>Touch:</b> slide your left thumb on the pad to move (pull down to crouch or drop, push up for doors). Right side: big <b>Jump</b>, hold <b>Run</b>, and the <b>rope</b> button throws the lasso. Gamepads work too.</p>
        <button class="btn primary" data-act="back">Back</button></div>`,
      a,
      'back',
    );
  }

  help(a: Actions) {
    this.render(
      'help',
      `<div class="panel wide"><h2>Items & Power-ups</h2>
        <div class="items">${ITEM_GUIDE.map(
          (g) => `<div class="item"><img alt="" src="${iconURL(g.icon, 44)}"><div><b>${esc(g.name)}</b><span>${esc(g.text)}</span></div></div>`,
        ).join('')}</div>
        <p class="hint">Hit V crates from <b>below</b>. Stomp bots and tumbleweeds, but never the spiky green hoppers. Checkpoint pennants save your place.</p>
        <button class="btn primary" data-act="back">Back</button></div>`,
      a,
      'back',
    );
  }

  gallery(found: Set<string>, a: Actions) {
    this.render(
      'gallery',
      `<div class="panel wide"><h2>Gallery: Orange Books</h2>
        <div class="books">${BOOKS.map((b) =>
          found.has(b.id)
            ? `<div class="book"><img alt="" src="${iconURL('book', 40)}"><div><b>${esc(b.title)}</b><span>${esc(b.text)}</span></div></div>`
            : `<div class="book locked"><img alt="" class="ghost" src="${iconURL('book', 40)}"><div><b>??? Not found yet</b><span>${esc(b.where)}</span></div></div>`,
        ).join('')}</div>
        <button class="btn primary" data-act="back">Back</button></div>`,
      a,
      'back',
    );
  }

  settings(s: { music: boolean; sfx: boolean; reducedMotion: boolean; touch: string; storage: string }, a: Actions) {
    const onoff = (v: boolean) => (v ? 'On' : 'Off');
    this.render(
      'settings',
      `<div class="panel"><h2>Settings</h2>
        <div class="settings">
          <button class="btn toggle" data-act="music">Music <b>${onoff(s.music)}</b></button>
          <button class="btn toggle" data-act="sfx">Sound effects <b>${onoff(s.sfx)}</b></button>
          <button class="btn toggle" data-act="motion">Reduced motion <b>${onoff(s.reducedMotion)}</b></button>
          <button class="btn toggle" data-act="touch">Touch controls <b>${esc(s.touch)}</b></button>
          <button class="btn danger" data-act="reset">Reset saved progress…</button>
        </div>
        <p class="hint">${esc(s.storage)}</p>
        <button class="btn primary" data-act="back">Back</button></div>`,
      a,
      'back',
    );
  }

  confirm(msg: string, a: Actions) {
    this.render(
      'confirm',
      `<div class="panel"><h2>Are you sure?</h2><p>${esc(msg)}</p>
        <div class="row"><button class="btn" data-act="no">Cancel</button><button class="btn danger" data-act="yes">Reset</button></div></div>`,
      a,
      'no',
    );
    this.root.querySelector<HTMLButtonElement>('[data-act="no"]')?.focus();
  }

  pause(info: { level: string; emblems: number; time: string }, a: Actions) {
    this.render(
      'pause',
      `<div class="panel"><h2>Paused</h2>
        <p class="sub">${esc(info.level)} · ${esc(info.time)} · V Emblems ${info.emblems}/3</p>
        <div class="menu">
          <button class="btn primary" data-act="resume">Resume</button>
          <button class="btn" data-act="retry">Restart from checkpoint</button>
          <button class="btn" data-act="help">Items guide</button>
          <button class="btn" data-act="settings">Settings</button>
          <button class="btn" data-act="quit">Quit to title</button>
        </div></div>`,
      a,
      'resume',
    );
  }

  death(lives: number, a: Actions) {
    this.render(
      'death',
      `<div class="panel small"><h2>Ouch!</h2>
        <p class="lives"><img alt="" src="${iconURL('hatPlain', 40)}"> × ${lives}</p>
        <div class="menu">
          <button class="btn primary" data-act="retry">Retry from checkpoint <small>R</small></button>
          <button class="btn" data-act="quit">Quit to title</button>
        </div></div>`,
      a,
      null,
    );
  }

  gameOver(a: Actions) {
    this.render(
      'gameover',
      `<div class="panel small"><h2>Game Over</h2><p>Out of lives, but the Fieldhouse is still waiting.</p>
        <div class="menu">
          <button class="btn primary" data-act="restartLevel">Restart this level</button>
          <button class="btn" data-act="newRun">New run from Level 1</button>
          <button class="btn" data-act="quit">Title screen</button>
        </div></div>`,
      a,
      null,
    );
  }

  results(r: { title: string; rows: [string, string][]; emblems: boolean[]; next: string | null; newBest: boolean }, a: Actions) {
    this.render(
      'results',
      `<div class="panel wide results"><h2>${esc(r.title)}</h2>
        <div class="slots">${r.emblems.map((g) => `<img alt="${g ? 'found' : 'missing'}" class="${g ? '' : 'ghost'}" src="${iconURL(g ? 'emblem' : 'emblemGhost', 48)}">`).join('')}</div>
        <table class="stats">${r.rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
        ${r.newBest ? '<p class="best">New personal best!</p>' : ''}
        <div class="row">
          ${r.next ? `<button class="btn primary" data-act="next">${esc(r.next)}</button>` : ''}
          <button class="btn ${r.next ? '' : 'primary'}" data-act="replay">Replay level</button>
          <button class="btn" data-act="quit">Title screen</button>
        </div></div>`,
      a,
      null,
    );
  }

  victory(rows: [string, string][], a: Actions) {
    this.render(
      'victory',
      `<div class="panel wide results"><div class="bigv"><img alt="" src="${iconURL('emblem', 96)}"></div><h2>The Fieldhouse is Packed!</h2>
        <p class="sub">You beat the Rebounder 3000 and finished the campaign. ¡Arriba Vaqueros!</p>
        <table class="stats">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
        <div class="row"><button class="btn primary" data-act="title">Title screen</button><button class="btn" data-act="levels">Level Select</button></div></div>`,
      a,
      null,
    );
  }
}
