import './styles.css';
import { App } from './ui/app';

type Hot = { ready?: (start: (data: unknown) => void) => void; snapshot?: (fn: () => unknown) => void; data?: unknown };

function start() {
  const root = document.getElementById('app')!;
  const app = new App(root);
  // The game saves itself continuously, so a republish just reloads from the save.
  try {
    (window as unknown as { claude?: { hot?: Hot } }).claude?.hot?.snapshot?.(() => ({ id: app.state?.id ?? null }));
  } catch {
    /* not inside the artifact viewer */
  }
}

let started = false;
const boot = () => {
  if (started) return;
  started = true;
  start();
};
const hot = (window as unknown as { claude?: { hot?: Hot } }).claude?.hot;
if (hot?.ready) {
  hot.ready(boot);
  setTimeout(boot, 1500); // never leave the screen blank if the host doesn't answer
} else boot();
