// Inline SVG icons (no external assets).

const svg = (body: string, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICON = {
  star: svg('<path fill="#ffc93c" stroke="#c98a00" stroke-width="1.2" stroke-linejoin="round" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>'),
  heart: svg('<path fill="#ff5d8f" stroke="#c2245a" stroke-width="1.2" d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.6 3.3 4.4 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/>'),
  heartEmpty: svg('<path fill="rgba(255,255,255,0.35)" stroke="rgba(80,60,80,0.5)" stroke-width="1.2" d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.6 3.3 4.4 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/>'),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1.5" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1.5" fill="currentColor"/>'),
  play: svg('<path fill="currentColor" d="M8 4.8v14.4c0 .8.9 1.3 1.6.8l11-7.2c.6-.4.6-1.2 0-1.6l-11-7.2C8.9 3.5 8 4 8 4.8z"/>'),
  stop: svg('<rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="currentColor"/>'),
  map: svg('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z M9 4v13.5 M15 6.5V20"/>'),
  eye: svg('<path fill="none" stroke="currentColor" stroke-width="2" d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
  gear: svg('<path fill="currentColor" d="M19.4 13a7.5 7.5 0 000-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 00-1.7-1L15 3.3h-4l-.4 2.6a7.6 7.6 0 00-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 000 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1l.4 2.6h4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"/>'),
  shirt: svg('<path fill="currentColor" d="M8.5 3L3 5.8l2 4.4 2-.8V21h10V9.4l2 .8 2-4.4L15.5 3c-.6 1.5-2 2.4-3.5 2.4S9.1 4.5 8.5 3z"/>'),
  passport: svg('<rect x="4.5" y="2.5" width="15" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 17h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  help: svg('<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M9.3 9.3a2.8 2.8 0 015.4 1c0 2-2.7 2.3-2.7 4"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/>'),
  home: svg('<path fill="currentColor" d="M12 3.2l9 7.6-1.3 1.5-1.2-1V20h-5.3v-5.5h-2.4V20H5.5v-8.7l-1.2 1L3 10.8z"/>'),
  restart: svg('<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M19.5 12a7.5 7.5 0 11-2.2-5.3"/><path fill="currentColor" d="M20.5 3.5v6h-6z"/>'),
  left: svg('<path fill="currentColor" d="M15.5 4.5L7 12l8.5 7.5z"/>'),
  right: svg('<path fill="currentColor" d="M8.5 4.5L17 12l-8.5 7.5z"/>'),
  up: svg('<path fill="currentColor" d="M4.5 15.5L12 7l7.5 8.5z"/>'),
  down: svg('<path fill="currentColor" d="M4.5 8.5L12 17l7.5-8.5z"/>'),
  close: svg('<path stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2.2" d="M8 10.5V8a4 4 0 018 0v2.5"/>'),
  check: svg('<path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/>'),
  magnet: svg('<path fill="#e2483d" d="M5 3h4v9a3 3 0 006 0V3h4v9a7 7 0 01-14 0z"/><rect x="5" y="3" width="4" height="3.5" fill="#eee"/><rect x="15" y="3" width="4" height="3.5" fill="#eee"/>'),
  shield: svg('<circle cx="12" cy="12" r="9" fill="#bfeaff" stroke="#3aa0d0" stroke-width="2"/><circle cx="9" cy="9" r="2.4" fill="#fff" opacity=".8"/>'),
  rainbow: svg('<path fill="none" stroke="#ff6b6b" stroke-width="2.2" d="M3 18a9 9 0 0118 0"/><path fill="none" stroke="#ffd84a" stroke-width="2.2" d="M5.5 18a6.5 6.5 0 0113 0"/><path fill="none" stroke="#6be38a" stroke-width="2.2" d="M8 18a4 4 0 018 0"/><path fill="none" stroke="#5fb8f0" stroke-width="2.2" d="M10.3 18a1.7 1.7 0 013.4 0"/>'),
  glide: svg('<path fill="#fff6e8" stroke="#ff8fc7" stroke-width="1.6" stroke-linejoin="round" d="M2.5 11.5L21.5 4l-6 16-3.5-6.5z"/><path fill="none" stroke="#ff8fc7" stroke-width="1.6" d="M12 13.5L21.5 4"/>'),
  book: svg('<path fill="#3d6fd6" d="M4 4.5h7.5a2 2 0 012 2V20a2 2 0 00-2-2H4z"/><path fill="#5b8cf0" d="M20 4.5h-6.5V20a2 2 0 012-2H20z"/>'),
  card: svg('<rect x="3" y="6" width="18" height="12" rx="2" fill="#ffe3ef" stroke="#ff4f8b" stroke-width="1.5"/><path fill="#ff4f8b" d="M12 15.5s-3-1.8-3-3.6a1.6 1.6 0 013-.8 1.6 1.6 0 013 .8c0 1.8-3 3.6-3 3.6z"/>'),
  flowers: svg('<path stroke="#4f9a3a" stroke-width="2" d="M12 21v-8"/><circle cx="12" cy="9" r="3" fill="#ff7fb8"/><circle cx="8" cy="11" r="2.4" fill="#ffd84a"/><circle cx="16" cy="11" r="2.4" fill="#b79cf0"/>'),
  gift: svg('<rect x="4" y="9" width="16" height="11" rx="1.5" fill="#cc1a24"/><rect x="3" y="7" width="18" height="4" rx="1" fill="#e2483d"/><path stroke="#fff" stroke-width="2.4" d="M12 7v13"/><path fill="none" stroke="#fff" stroke-width="1.8" d="M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1z"/>'),
  badge: svg('<circle cx="12" cy="10" r="7" fill="#ffd84a" stroke="#c98a00" stroke-width="1.5"/><path fill="#c98a00" d="M12 6l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z"/><path fill="#ff8fc7" d="M8 15.5l-1.5 6 3-1.5 1.5 2 1-6zM16 15.5l1.5 6-3-1.5-1.5 2-1-6z"/>'),
  sound: svg('<path fill="currentColor" d="M4 9h4l5-4.5v15L8 15H4z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12"/>'),
};

export type IconName = keyof typeof ICON;
