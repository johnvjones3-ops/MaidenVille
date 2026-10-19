import './ui/styles.css';
import { Game } from './game';

const stage = document.getElementById('stage')!;
const ui = document.getElementById('ui')!;

function showStartupError(message: string) {
  const host = document.createElement('div');
  host.className = 'screen-host active';
  const overlay = document.createElement('div'); overlay.className = 'overlay';
  const panel = document.createElement('div'); panel.className = 'panel';
  const body = document.createElement('div'); body.className = 'panel-body';
  const title = document.createElement('h2'); title.textContent = 'MaidenVille Runner!';
  const text = document.createElement('p'); text.textContent = message;
  const retry = document.createElement('button'); retry.className = 'btn primary'; retry.textContent = 'Try again';
  retry.addEventListener('click', () => location.reload());
  body.append(title, text, retry); panel.append(body); overlay.append(panel); host.append(overlay); ui.replaceChildren(host);
}

async function start() {
  try {
    // This Three.js release needs WebGL 2. Release the probe context before creating the renderer.
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      showStartupError('3D graphics (WebGL 2) are unavailable in this browser. Enable hardware acceleration or try a current browser on another device.');
      return;
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const game = new Game(stage, ui);
    stage.addEventListener('webglcontextlost', (event) => { event.preventDefault(); game.pause(); }, true);
    await game.boot();
  } catch (error) {
    console.error(error);
    showStartupError('MaidenVille could not start. Try reloading the page or using a current browser with 3D graphics enabled.');
  }
}
void start();
