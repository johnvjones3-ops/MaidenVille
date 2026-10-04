// Keyboard, touch and (optional) gamepad input merged into one held/pressed state.
// "Pressed" flags are edge-triggered and consumed once per simulation step.

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  run: boolean;
  action: boolean;
  jumpPressed: boolean;
  actionPressed: boolean;
  upPressed: boolean;
}

export function emptyInput(): InputState {
  return { left: false, right: false, up: false, down: false, jump: false, run: false, action: false, jumpPressed: false, actionPressed: false, upPressed: false };
}

type Btn = 'left' | 'right' | 'up' | 'down' | 'jump' | 'run' | 'action';

const KEYMAP: Record<string, Btn> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  KeyZ: 'jump',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyX: 'run',
  KeyC: 'action',
};

export class Input {
  readonly state = emptyInput();
  /** Set by the game: only while true do we capture keys and suppress page scrolling. */
  active = false;
  onPause: (() => void) | null = null;
  onRestart: (() => void) | null = null;

  private keys = new Set<Btn>();
  private touch = { left: false, right: false, up: false, down: false, jump: false, run: false, action: false };
  private pad = { left: false, right: false, up: false, down: false, jump: false, run: false, action: false };
  private pendingJump = false;
  private pendingAction = false;
  private pendingUp = false;
  private padPausePrev = false;
  private cleanup: (() => void)[] = [];

  constructor() {
    const kd = (e: KeyboardEvent) => this.onKey(e, true);
    const ku = (e: KeyboardEvent) => this.onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const clear = () => this.clearAll();
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    this.cleanup.push(
      () => window.removeEventListener('keydown', kd),
      () => window.removeEventListener('keyup', ku),
      () => window.removeEventListener('blur', clear),
      () => document.removeEventListener('visibilitychange', clear),
    );
  }

  destroy() {
    for (const c of this.cleanup) c();
    this.cleanup = [];
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (!this.active) return;
    if (down && (e.code === 'Escape' || e.code === 'KeyP')) {
      e.preventDefault();
      if (!e.repeat) this.onPause?.();
      return;
    }
    if (down && e.code === 'KeyR' && !e.repeat) {
      this.onRestart?.();
      return;
    }
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    if (down) {
      if (e.repeat) return;
      this.keys.add(b);
      if (b === 'jump') this.pendingJump = true;
      if (b === 'action') this.pendingAction = true;
      if (b === 'up') this.pendingUp = true;
    } else this.keys.delete(b);
  }

  /** Called by the touch layer. */
  setTouch(b: Btn, v: boolean) {
    if (this.touch[b] === v) return;
    this.touch[b] = v;
    if (v && b === 'jump') this.pendingJump = true;
    if (v && b === 'action') this.pendingAction = true;
    if (v && b === 'up') this.pendingUp = true;
  }

  clearAll() {
    this.keys.clear();
    for (const k of Object.keys(this.touch) as Btn[]) this.touch[k] = false;
    for (const k of Object.keys(this.pad) as Btn[]) this.pad[k] = false;
    this.pendingJump = this.pendingAction = this.pendingUp = false;
    Object.assign(this.state, emptyInput());
  }

  private pollPad() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let p: Gamepad | null = null;
    for (const g of pads) if (g && g.connected) { p = g; break; }
    if (!p) {
      for (const k of Object.keys(this.pad) as Btn[]) this.pad[k] = false;
      return;
    }
    const ax = p.axes[0] ?? 0;
    const ay = p.axes[1] ?? 0;
    const b = (i: number) => !!p!.buttons[i]?.pressed;
    this.pad.left = ax < -0.4 || b(14);
    this.pad.right = ax > 0.4 || b(15);
    this.pad.up = ay < -0.6 || b(12);
    this.pad.down = ay > 0.6 || b(13);
    const j = b(0);
    if (j && !this.pad.jump) this.pendingJump = true;
    this.pad.jump = j;
    this.pad.run = b(2) || b(7) || b(6);
    const a = b(1) || b(3);
    if (a && !this.pad.action) this.pendingAction = true;
    this.pad.action = a;
    const pause = b(9);
    if (pause && !this.padPausePrev && this.active) this.onPause?.();
    this.padPausePrev = pause;
  }

  /** Builds the state for one simulation step. */
  sample(): InputState {
    this.pollPad();
    const s = this.state;
    const k = this.keys;
    s.left = k.has('left') || this.touch.left || this.pad.left;
    s.right = k.has('right') || this.touch.right || this.pad.right;
    s.up = k.has('up') || this.touch.up || this.pad.up;
    s.down = k.has('down') || this.touch.down || this.pad.down;
    s.jump = k.has('jump') || this.touch.jump || this.pad.jump;
    s.run = k.has('run') || this.touch.run || this.pad.run;
    s.action = k.has('action') || this.touch.action || this.pad.action;
    s.jumpPressed = this.pendingJump;
    s.actionPressed = this.pendingAction;
    s.upPressed = this.pendingUp;
    this.pendingJump = this.pendingAction = this.pendingUp = false;
    return s;
  }
}
