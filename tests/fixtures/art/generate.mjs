// Gera as imagens SINTÉTICAS do pacote de teste (tests/fixtures/art). Não é arte do jogo: são retângulos/círculos coloridos
// só para exercitar o carregamento, o posicionamento, as animações e os fallbacks.   node tests/fixtures/art/generate.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('./public/art/', import.meta.url).pathname;
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
export function png(w, h, px, alpha = true) {
  const bpp = alpha ? 4 : 3;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * bpp + 1)] = 0;
    for (let x = 0; x < w; x++) { const c = px(x, y); const o = y * (w * bpp + 1) + 1 + x * bpp; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; if (alpha) raw[o + 3] = c[3] ?? 255; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const disc = (w, h, c) => (x, y) => ((x - w / 2) ** 2 + (y - h / 2) ** 2 <= (Math.min(w, h) / 2 - 2) ** 2 ? [...c, 255] : [0, 0, 0, 0]);
const svg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle cx="64" cy="64" r="56" fill="${color}"/></svg>\n`;
const files = {
  'test/map/region-1-bg@2x.png': png(800, 1080, () => [255, 214, 232], false),
  'test/map/region-1-path@2x.png': png(800, 1080, (x) => (x > 380 && x < 420 ? [255, 112, 67, 255] : [0, 0, 0, 0])),
  'test/map/node-locked@2x.png': png(128, 128, disc(128, 128, [158, 158, 158])),
  'test/map/node-available@2x.png': png(128, 128, disc(128, 128, [76, 175, 80])),
  'test/map/node-done@2x.png': png(128, 128, disc(128, 128, [255, 193, 7])),
  'test/char/bianca-idle@2x.png': png(1536, 256, (x, y) => { const f = Math.floor(x / 256); const c = [[233, 30, 99], [156, 39, 176], [63, 81, 181], [3, 169, 244], [0, 150, 136], [255, 87, 34]][f]; return ((x % 256) - 128) ** 2 + (y - 128) ** 2 < 100 ** 2 ? [...c, 255] : [0, 0, 0, 0]; }),
  'test/game/stars-star@2x.png': png(192, 192, disc(192, 192, [255, 235, 59])),
  'test/game/garden-item-tulip@2x.png': png(192, 192, disc(192, 192, [233, 30, 99])),
  'test/ui/icon-stamp-small.svg': svg('#ffb300'),
  'test/ui/tab-map.svg': svg('#1e88e5'),
  'alt/ui/icon-coin.svg': svg('#795548'),
};
if (import.meta.url === `file://${process.argv[1]}`) for (const [rel, data] of Object.entries(files)) { const p = join(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); }
if (import.meta.url === `file://${process.argv[1]}`) console.log(Object.keys(files).length, 'arquivos de fixture gerados');
