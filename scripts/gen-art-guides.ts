// Gera os GUIAS DE LAYOUT (SVG + PNG) para quem produz a arte externa. NÃO são arte do jogo: são gabaritos técnicos
// (faixas, posição das casas, corredor da trilha, pontos de encontro entre regiões, quadro do personagem).
//   npm run art:guides       (PNG via Chromium; defina CHROMIUM_PATH se necessário)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { RULES } from '../src/domain/rules';
import { DEFAULT_LAYOUT, DEFAULT_BONUS, MAP_H, MAP_W, RH, TOP, regionTop, samplePath, smoothPath } from '../src/ui/mapGeometry';

const OUT = 'docs/arte/guias';
mkdirSync(OUT, { recursive: true });
const walk = DEFAULT_LAYOUT.walk;
const dense = samplePath(walk, 40);
const grid = (w: number, h: number, step = 50) => {
  let s = '';
  for (let x = 0; x <= w; x += step) s += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="#d9dbe6" stroke-width=".5"/>`;
  for (let y = 0; y <= h; y += step) s += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="#d9dbe6" stroke-width=".5"/>`;
  return s;
};
/** Onde a trilha cruza uma altura y (coordenadas do mapa). */
const crossX = (y: number): number | null => {
  for (let i = 0; i < dense.length - 1; i++) {
    const a = dense[i], b = dense[i + 1];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
  }
  return null;
};
const frame = (w: number, h: number, body: string, scale = 2) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" font-family="Arial, sans-serif"><rect width="${w}" height="${h}" fill="#f6f6fa"/>${grid(w, h)}${body}</svg>`;

function bandBody(y0: number, h: number, title: string) {
  const p = smoothPath(walk);
  const nodes = DEFAULT_LAYOUT.nodes.map((n, i) => ({ ...n, i: i + 1 })).filter((n) => n.y >= y0 - 30 && n.y <= y0 + h + 30);
  return `
  <g transform="translate(0,${-y0})"><path d="${p}" fill="none" stroke="#ff7043" stroke-opacity=".18" stroke-width="46" stroke-linecap="round"/><path d="${p}" fill="none" stroke="#e64a19" stroke-width="1.2" stroke-dasharray="4 3"/></g>
  ${nodes.map((n) => `<g transform="translate(${n.x},${n.y - y0})"><circle r="28" fill="#e53935" fill-opacity=".10" stroke="#e53935" stroke-width="1"/><circle r="25" fill="none" stroke="#e53935" stroke-dasharray="3 2" stroke-width=".8"/><text y="4" text-anchor="middle" font-size="12" font-weight="700" fill="#b71c1c">${Math.ceil(n.i / 5)}.${((n.i - 1) % 5) + 1}</text><text y="46" text-anchor="middle" font-size="7" fill="#b71c1c">toque r=28 · NÃO cobrir</text></g>`).join('')}
  <text x="6" y="12" font-size="9" font-weight="700" fill="#333">${title}</text>
  <text x="6" y="23" font-size="7" fill="#555">GUIA DE LAYOUT — NÃO É ARTE · unidades do mapa (400 de largura) · exportar @2x</text>`;
}

for (const s of [1, 2, 3, 4, 5]) {
  const top = regionTop(s);
  const st = RULES.stages[s - 1];
  const xTop = crossX(top), xBot = crossX(top + RH);
  let body = bandBody(top, RH, `Região ${s} — ${st.name} · faixa 400×540 em y=${top} → entregar 800×1080`);
  body += `<g transform="translate(200,36)"><rect x="-120" y="-24" width="240" height="48" rx="12" fill="#1e88e5" fill-opacity=".10" stroke="#1e88e5" stroke-dasharray="4 3"/><text y="3" text-anchor="middle" font-size="8" fill="#0d47a1">faixa do título (240×48) — o app escreve o nome aqui</text></g>`;
  body += `<rect x="0" y="0" width="70" height="${RH}" fill="#43a047" fill-opacity=".07"/><rect x="330" y="0" width="70" height="${RH}" fill="#43a047" fill-opacity=".07"/><text x="35" y="${RH - 8}" text-anchor="middle" font-size="7" fill="#2e7d32">zona de decoração</text><text x="365" y="${RH - 8}" text-anchor="middle" font-size="7" fill="#2e7d32">zona de decoração</text>`;
  if (xTop != null) body += `<g transform="translate(${xTop},0)"><line x1="-24" x2="24" stroke="#8e24aa" stroke-width="2"/><text y="72" x="28" font-size="7" fill="#6a1b9a">a trilha encontra a região ${s + 1 <= 5 ? s + 1 : '(topo)'} aqui · x=${xTop.toFixed(0)}</text></g>`;
  if (xBot != null) body += `<g transform="translate(${xBot},${RH})"><line x1="-24" x2="24" stroke="#8e24aa" stroke-width="2"/><text y="-5" x="28" font-size="7" fill="#6a1b9a">a trilha encontra a região ${s - 1 >= 1 ? s - 1 : '(início)'} aqui · x=${xBot.toFixed(0)}</text></g>`;
  writeFileSync(`${OUT}/regiao-${s}.svg`, frame(MAP_W, RH, body));
}
// base (Início) e topo (bônus)
const bottomY = TOP + 5 * RH;
let b = bandBody(bottomY, MAP_H - bottomY, `Base do mapa — faixa 400×130 em y=${bottomY} → entregar 800×260`);
const sx = DEFAULT_LAYOUT.start.x - 80, sy = DEFAULT_LAYOUT.start.y - 8 + 46 - bottomY;
b += `<g transform="translate(${sx},${sy})"><circle r="3" fill="#00897b"/><rect x="-48" y="-64" width="96" height="64" fill="#00897b" fill-opacity=".10" stroke="#00897b" stroke-dasharray="3 2"/><text y="12" text-anchor="middle" font-size="7" fill="#004d40">base do poste do marco "Início" (96×64, âncora na base)</text></g>`;
writeFileSync(`${OUT}/base-inicio.svg`, frame(MAP_W, MAP_H - bottomY, b));
let t = bandBody(0, TOP, `Topo do mapa — faixa 400×130 em y=0 → entregar 800×260`);
t += `<g transform="translate(${DEFAULT_BONUS.x},${DEFAULT_BONUS.y})"><circle r="40" fill="#fb8c00" fill-opacity=".12" stroke="#fb8c00" stroke-dasharray="3 2"/><text y="56" text-anchor="middle" font-size="7" fill="#e65100">bônus final (80×80) — não cobrir</text></g>`;
writeFileSync(`${OUT}/topo-bonus.svg`, frame(MAP_W, TOP, t));
// visão geral
const p = smoothPath(walk);
let o = `<path d="${p}" fill="none" stroke="#ff7043" stroke-opacity=".25" stroke-width="46" stroke-linecap="round"/>`;
for (const s of [1, 2, 3, 4, 5]) o += `<rect x="0" y="${regionTop(s)}" width="${MAP_W}" height="${RH}" fill="none" stroke="#1e88e5" stroke-width="1.2" stroke-dasharray="6 4"/><text x="8" y="${regionTop(s) + 16}" font-size="14" font-weight="700" fill="#0d47a1">Região ${s} — ${RULES.stages[s - 1].name}</text>`;
o += DEFAULT_LAYOUT.nodes.map((n, i) => `<circle cx="${n.x}" cy="${n.y}" r="25" fill="#e53935" fill-opacity=".15" stroke="#e53935"/><text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#b71c1c">${Math.ceil((i + 1) / 5)}.${(i % 5) + 1}</text>`).join('');
o += `<text x="8" y="${bottomY + 70}" font-size="12" fill="#00695c">Início</text><text x="${DEFAULT_BONUS.x + 40}" y="${DEFAULT_BONUS.y}" font-size="12" fill="#e65100">Bônus final</text>`;
writeFileSync(`${OUT}/mapa-visao-geral.svg`, frame(MAP_W, MAP_H, o, 1));
// quadro do personagem
const ch = `<rect x="16" y="16" width="224" height="224" fill="none" stroke="#1e88e5" stroke-dasharray="5 3"/><line x1="0" y1="224" x2="256" y2="224" stroke="#e53935" stroke-width="1.5"/><line x1="128" y1="0" x2="128" y2="256" stroke="#8e24aa" stroke-dasharray="4 3"/><circle cx="128" cy="224" r="4" fill="#e53935"/>
<text x="8" y="12" font-size="9" font-weight="700" fill="#333">Quadro 256×256 (1 de N quadros da tira horizontal)</text>
<text x="132" y="218" font-size="8" fill="#b71c1c">linha dos pés (y=224 = 87,5%) — igual em TODOS os quadros</text>
<text x="132" y="30" font-size="8" fill="#6a1b9a">eixo central (x=128)</text><text x="22" y="236" font-size="8" fill="#0d47a1">margem de segurança 16px — nada cortado</text>`;
writeFileSync(`${OUT}/personagem-quadro.svg`, frame(256, 256, ch, 2));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const name of ['regiao-1', 'regiao-2', 'regiao-3', 'regiao-4', 'regiao-5', 'base-inicio', 'topo-bonus', 'mapa-visao-geral', 'personagem-quadro']) {
  const svg = (await import('node:fs')).readFileSync(`${OUT}/${name}.svg`, 'utf8');
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/)!;
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  writeFileSync(`${OUT}/${name}.png`, await page.screenshot({ type: 'png' }));
  await page.close();
}
await browser.close();
console.log('guias gerados em', OUT);
