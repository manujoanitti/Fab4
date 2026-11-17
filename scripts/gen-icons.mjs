// Gera os ícones PNG do PWA a partir do SVG usando o Chromium/Playwright já instalado.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync('public/icons/icon.svg', 'utf8');
const browser = await chromium.launch();
for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable-512', 512, 0.12]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(`<body style="margin:0;background:#f8b8d4;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg', `<svg width="${inner}" height="${inner}"`)}</body>`);
  writeFileSync(`public/icons/${name}.png`, await page.screenshot({ type: 'png' }));
  await page.close();
}
await browser.close();
