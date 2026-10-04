import './styles.css';
import { Game } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game(canvas, document.getElementById('ui')!, document.getElementById('touch')!, document.getElementById('banner')!);

const fit = () => {
  const vv = window.visualViewport;
  const w = vv ? vv.width : window.innerWidth;
  const h = vv ? vv.height : window.innerHeight;
  const { cssW, cssH } = game.renderer.resize(w, h);
  const stage = document.getElementById('stage')!;
  stage.style.width = `${cssW}px`;
  stage.style.height = `${cssH}px`;
  document.documentElement.style.setProperty('--stage-w', `${cssW}px`);
  document.documentElement.style.setProperty('--stage-h', `${cssH}px`);
};
fit();
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 150));

document.getElementById('rotate-ok')!.addEventListener('click', () => document.documentElement.classList.add('rotate-dismissed'));

game.start();
// Exposed for automated smoke tests and debugging in the console.
(window as unknown as { vq: Game }).vq = game;
