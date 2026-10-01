import './ui/styles.css';
import { Game } from './game';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const stage = document.getElementById('stage')!;
const ui = document.getElementById('ui')!;

if (!webglAvailable()) {
  ui.innerHTML = `<div class="screen-host active"><div class="panel"><div class="panel-body">
    <h2>MaidenVille Runner!</h2>
    <p>This game needs WebGL (3D graphics), which isn't available in this browser or device right now.</p>
    <p>Try turning on hardware acceleration, updating the browser, or opening the game on another device.</p>
  </div></div></div>`;
} else {
  const game = new Game(stage, ui);
  game.boot().catch((err) => {
    console.error(err);
    ui.insertAdjacentHTML('beforeend', `<div class="screen-host active"><div class="panel"><div class="panel-body"><h2>Oops!</h2><p>MaidenVille couldn't start: ${String(err?.message ?? err)}</p></div></div></div>`);
  });
}
