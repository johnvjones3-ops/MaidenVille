import type { Input } from '../core/input';

type Btn = 'jump' | 'run' | 'action';

/**
 * On-screen controls. Left: a movement pad (slide between left/right; pull down to
 * crouch/drop, push up for doors). Right: Jump, Run (hold) and Lasso.
 * Multi-touch via pointer ids + pointer capture; every release path clears the input.
 */
export class TouchControls {
  private cleanup: (() => void)[] = [];
  private padPointer: number | null = null;
  private knob: HTMLElement;
  private pad: HTMLElement;

  constructor(
    readonly root: HTMLElement,
    readonly input: Input,
    onPause: () => void,
  ) {
    root.innerHTML = `
      <div class="pad" aria-label="Move"><div class="pad-ring"><span class="arr l">◀</span><span class="arr r">▶</span><span class="arr u">▲</span><span class="arr d">▼</span><div class="knob"></div></div></div>
      <div class="btns">
        <button class="tbtn act" data-b="action" aria-label="Lasso"><svg viewBox="0 0 40 40"><ellipse cx="18" cy="18" rx="12" ry="9" fill="none" stroke="currentColor" stroke-width="4"/><path d="M27 24 q6 6 2 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg></button>
        <button class="tbtn run" data-b="run" aria-label="Run">RUN</button>
        <button class="tbtn jump" data-b="jump" aria-label="Jump">JUMP</button>
      </div>
      <button class="tpause" aria-label="Pause">II</button>`;
    this.pad = root.querySelector('.pad')!;
    this.knob = root.querySelector('.knob')!;

    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(ev, fn as EventListener, { passive: false });
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };

    // Pad.
    const padMove = (e: PointerEvent) => {
      const r = this.pad.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dead = r.width * 0.12;
      input.setTouch('left', dx < -dead);
      input.setTouch('right', dx > dead);
      input.setTouch('down', dy > r.height * 0.28 && Math.abs(dy) > Math.abs(dx) * 0.6);
      input.setTouch('up', dy < -r.height * 0.28 && Math.abs(dy) > Math.abs(dx) * 0.6);
      const max = r.width * 0.32;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, max / len);
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    };
    const padEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.padPointer) return;
      this.padPointer = null;
      this.releasePad();
    };
    on(this.pad, 'pointerdown', (e) => {
      e.preventDefault();
      this.padPointer = e.pointerId;
      try {
        this.pad.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      padMove(e);
    });
    on(this.pad, 'pointermove', (e) => {
      if (e.pointerId === this.padPointer) padMove(e);
    });
    on(this.pad, 'pointerup', padEnd);
    on(this.pad, 'pointercancel', padEnd);
    on(this.pad, 'lostpointercapture', padEnd);

    // Buttons.
    for (const el of root.querySelectorAll<HTMLElement>('.tbtn')) {
      const b = el.dataset.b as Btn;
      const ids = new Set<number>();
      const sync = () => {
        input.setTouch(b, ids.size > 0);
        el.classList.toggle('down', ids.size > 0);
      };
      on(el, 'pointerdown', (e) => {
        e.preventDefault();
        ids.add(e.pointerId);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        sync();
      });
      const end = (e: PointerEvent) => {
        ids.delete(e.pointerId);
        sync();
      };
      on(el, 'pointerup', end);
      on(el, 'pointercancel', end);
      on(el, 'lostpointercapture', end);
      this.cleanup.push(() => {
        ids.clear();
        sync();
      });
    }
    const pauseBtn = root.querySelector<HTMLElement>('.tpause')!;
    on(pauseBtn, 'pointerdown', (e) => {
      e.preventDefault();
      onPause();
    });
    on(root, 'contextmenu', (e) => e.preventDefault());
  }

  private releasePad() {
    this.input.setTouch('left', false);
    this.input.setTouch('right', false);
    this.input.setTouch('up', false);
    this.input.setTouch('down', false);
    this.knob.style.transform = '';
  }

  /** Clear all held touches (pause, blur, menu). */
  reset() {
    this.padPointer = null;
    this.releasePad();
    for (const el of this.root.querySelectorAll<HTMLElement>('.tbtn')) el.classList.remove('down');
    for (const b of ['jump', 'run', 'action'] as Btn[]) this.input.setTouch(b, false);
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('show', v);
    if (!v) this.reset();
  }

  destroy() {
    for (const c of this.cleanup) c();
    this.cleanup = [];
    this.root.innerHTML = '';
  }
}
