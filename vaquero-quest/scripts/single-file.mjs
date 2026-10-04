// Inline dist/ into one self-contained HTML file (no external requests).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
let html = readFileSync('dist/index.html', 'utf8');
for (const f of readdirSync('dist/assets')) {
  const body = readFileSync(`dist/assets/${f}`, 'utf8');
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link[^>]*${f}[^>]*>`), () => `<style>${body}</style>`);
  if (f.endsWith('.js')) {
    html = html.replace(new RegExp(`<script[^>]*${f}[^>]*></script>`), '');
    html = html.replace('</body>', () => `<script type="module">${body}</script></body>`);
  }
}
writeFileSync('dist/vaquero-quest.html', html);
console.log(`dist/vaquero-quest.html (${(html.length / 1024).toFixed(0)} KB)`);
