// Bundle dist/ into one self-contained HTML page (used to publish the game as a single file).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const files = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${files.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${files.find((f) => f.endsWith('.js'))}`, 'utf8');
const html = `<title>MaidenVille Runner!</title>
<style>${css}</style>
<div id="app"><div id="stage"></div><div id="ui" aria-live="polite"></div></div>
<script type="module">${js}</script>
`;
writeFileSync('dist/maidenville-runner.html', html);
console.log(`dist/maidenville-runner.html (${(html.length / 1024).toFixed(0)} KB)`);
