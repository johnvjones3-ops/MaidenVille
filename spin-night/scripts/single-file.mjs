// Inline dist/ into self-contained HTML:
//   dist/spin-night.html          - a complete page you can open directly
//   dist/spin-night.artifact.html - the same page as a body fragment for publishing
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
let css = '';
let js = '';
for (const f of readdirSync('dist/assets')) {
  const body = readFileSync(`dist/assets/${f}`, 'utf8');
  if (f.endsWith('.css')) css += body;
  if (f.endsWith('.js')) js += body;
}
js = js.replace(/<\/script/gi, '<\\/script');
css = css.replace(/<\/style/gi, '<\\/style');

const full = html
  .replace(/<link[^>]*rel="stylesheet"[^>]*assets\/[^>]*>/, () => `<style>${css}</style>`)
  .replace(/<script[^>]*assets\/[^>]*><\/script>/, '')
  .replace('</body>', () => `<script type="module">${js}</script></body>`);
writeFileSync('dist/spin-night.html', full);

const pick = (re) => (html.match(re) ?? [''])[0];
const fragment = [
  pick(/<title>[\s\S]*?<\/title>/),
  ...(html.match(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts[^>]*>/g) ?? []),
  `<style>${css}</style>`,
  pick(/<div id="app"[^>]*><\/div>/),
  `<script type="module">${js}</script>`,
].join('\n');
writeFileSync('dist/spin-night.artifact.html', fragment);
console.log(`dist/spin-night.html (${(full.length / 1024).toFixed(0)} KB), dist/spin-night.artifact.html (${(fragment.length / 1024).toFixed(0)} KB)`);
