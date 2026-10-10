// Small DOM helpers.

type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const ICONS: Record<string, string> = {
  pause: '<path d="M8 5h3v14H8zM13 5h3v14h-3z"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  help: '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 16.2a1.3 1.3 0 110-2.6 1.3 1.3 0 010 2.6zm1.4-5.1c-.6.4-.7.6-.7 1.2v.4h-1.9v-.5c0-1.2.4-1.8 1.3-2.4.7-.5 1-.8 1-1.4 0-.7-.5-1.1-1.2-1.1-.8 0-1.3.5-1.4 1.3H8.7C8.8 8.6 10.1 7.4 12 7.4c1.9 0 3.1 1.1 3.1 2.6 0 1.2-.6 1.9-1.7 2.6z"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a7 7 0 010 13.4v2.1a9 9 0 000-17.6z"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4zm15.6 3l2.2-2.2-1.4-1.4-2.2 2.2-2.2-2.2-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4z"/>',
  menu: '<path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>',
  back: '<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/>',
  close: '<path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/>',
  backspace: '<path d="M22 5H8l-6 7 6 7h14V5zm-3.6 10.6L17 17l-3-3-3 3-1.4-1.4 3-3-3-3L11 8.2l3 3 3-3 1.4 1.4-3 3 3 3z"/>',
  keyboard: '<path d="M20 5H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V7a2 2 0 00-2-2zM11 8h2v2h-2zm0 3h2v2h-2zM8 8h2v2H8zm0 3h2v2H8zm-1 2H5v-2h2zm0-3H5V8h2zm9 7H8v-2h8zm0-4h-2v-2h2zm0-3h-2V8h2zm3 3h-2v-2h2zm0-3h-2V8h2z"/>',
  check: '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
  x: '<path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7l-1.4-1.4L9.2 12 2.9 5.7l1.4-1.4 6.3 6.3 6.3-6.3z"/>',
  star: '<path d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z"/>',
  envelope: '<path d="M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm9 7.5L20 7H4l8 5.5z"/>',
  camera: '<path d="M9 4l-1.8 2H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-3.2L15 4H9zm3 4.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z"/>',
};

export function icon(name: keyof typeof ICONS | string, cls = 'icon') {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ICONS[name] ?? ''}</svg>`;
}
