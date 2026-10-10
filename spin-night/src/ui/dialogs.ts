// In-page dialogs. (The artifact viewer blocks alert/confirm/prompt.)

import { h, icon } from './dom';

export interface DialogHandle {
  el: HTMLElement;
  close: () => void;
}

let layer: HTMLElement;
const stack: { el: HTMLElement; onClose?: () => void; lastFocus: Element | null }[] = [];

export function initDialogs(host: HTMLElement) {
  layer = h('div', { class: 'dialog-layer', hidden: true });
  host.append(layer);
}

export const dialogOpen = () => stack.length > 0;

export function openDialog(opts: { title: string; body: HTMLElement | string; className?: string; onClose?: () => void; wide?: boolean }): DialogHandle {
  const body = typeof opts.body === 'string' ? h('div', { html: opts.body }) : opts.body;
  const closeBtn = h('button', { class: 'icon-btn dlg-x', type: 'button', 'aria-label': 'Close', html: icon('close') });
  const panel = h(
    'div',
    { class: `dialog ${opts.className ?? ''} ${opts.wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
    h('div', { class: 'dlg-head' }, h('h2', {}, opts.title), closeBtn),
    h('div', { class: 'dlg-body' }, body),
  );
  const entry = { el: panel, onClose: opts.onClose, lastFocus: document.activeElement };
  stack.push(entry);
  layer.append(panel);
  layer.hidden = false;
  const close = () => {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    panel.remove();
    if (!stack.length) layer.hidden = true;
    (entry.lastFocus as HTMLElement | null)?.focus?.({ preventScroll: true });
    opts.onClose?.();
  };
  closeBtn.addEventListener('click', close);
  requestAnimationFrame(() => closeBtn.focus({ preventScroll: true }));
  return { el: panel, close };
}

export function closeTopDialog() {
  const top = stack[stack.length - 1];
  top?.el.querySelector<HTMLButtonElement>('.dlg-x')?.click();
}

export function confirmDialog(opts: { title: string; body: string; confirm: string; cancel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    const yes = h('button', { class: `btn ${opts.danger ? 'danger' : 'primary'}`, type: 'button' }, opts.confirm);
    const no = h('button', { class: 'btn ghost', type: 'button' }, opts.cancel ?? 'Cancel');
    const body = h('div', { class: 'confirm' }, h('p', { html: opts.body }), h('div', { class: 'row-btns' }, no, yes));
    const d = openDialog({ title: opts.title, body, className: 'small', onClose: () => resolve(result) });
    yes.addEventListener('click', () => {
      result = true;
      d.close();
    });
    no.addEventListener('click', () => d.close());
  });
}
