// InputManager: keyboard + Pointer Events swipes + optional on-screen buttons.
// One action per intentional gesture, direction locking, pointer-cancel handling, and no interference with menus.

import { CONTROLS } from '../config';
import type { Action } from '../sim/run';

export class InputManager {
  /** Only true while gameplay should consume input. */
  enabled = false;
  onAction: (a: Action) => void = () => {};
  onPause: () => void = () => {};
  private start: { id: number; x: number; y: number; fired: boolean } | null = null;

  constructor(private surface: HTMLElement) {
    window.addEventListener('keydown', (e) => this.key(e));
    surface.addEventListener('pointerdown', (e) => this.down(e));
    surface.addEventListener('pointermove', (e) => this.move(e));
    surface.addEventListener('pointerup', (e) => this.up(e));
    surface.addEventListener('pointercancel', () => (this.start = null));
    surface.addEventListener('lostpointercapture', () => (this.start = null));
  }

  private key(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (!e.repeat) this.onPause();
      return;
    }
    if (!this.enabled) return;
    if (e.repeat) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
      return;
    }
    let a: Action | null = null;
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        a = 'left';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        a = 'right';
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        a = 'jump';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        a = 'slide';
        break;
    }
    if (a) {
      e.preventDefault();
      this.onAction(a);
    }
  }

  private threshold(): number {
    const m = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(CONTROLS.swipeThresholdPx, m * CONTROLS.swipeThresholdFrac);
  }

  private down(e: PointerEvent) {
    if (!this.enabled || !e.isPrimary) return;
    this.start = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  private move(e: PointerEvent) {
    const s = this.start;
    if (!s || s.id !== e.pointerId || s.fired || !this.enabled) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const th = this.threshold();
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    // direction lock: the dominant axis wins, decided once per gesture
    s.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) this.onAction(dx < 0 ? 'left' : 'right');
    else this.onAction(dy < 0 ? 'jump' : 'slide');
  }

  private up(e: PointerEvent) {
    if (this.start && this.start.id === e.pointerId) this.start = null;
  }

  /** Bind an on-screen button (works independently from swipes). */
  bindButton(el: HTMLElement, a: Action) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.enabled) this.onAction(a);
    });
  }
}
