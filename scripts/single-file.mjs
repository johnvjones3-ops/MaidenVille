// Preserve the production document and inline its bundled local assets for offline play.
import { readFileSync, writeFileSync } from 'node:fs';
let html = readFileSync('dist/index.html', 'utf8');
html = html.replace(/<script[^>]+src="([^\"]+)"[^>]*><\/script>/g, (_tag, src) => {
  const js = readFileSync(`dist/${src.replace(/^\.\//, '')}`, 'utf8');
  return `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`;
});
html = html.replace(/<link[^>]+href="([^\"]+\.css)"[^>]*>/g, (_tag, href) => {
  const css = readFileSync(`dist/${href.replace(/^\.\//, '')}`, 'utf8');
  return `<style>${css}</style>`;
});
writeFileSync('dist/maidenville-runner.html', html);
console.log(`Offline game: dist/maidenville-runner.html (${Math.round(Buffer.byteLength(html)/1024)} KiB)`);
