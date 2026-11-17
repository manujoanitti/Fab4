// Fluxo dos cenários das regiões (e fundos individuais): ajuste exato de resolução, partes (topo/região/base), análise das
// zonas que precisam ficar livres e prévia com a geometria REAL do app (casas, trilha, faixa) por cima.
// Não separa camadas: o cenário é a camada de fundo; trilha, casas e faixa continuam sendo desenhadas pelo app.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_LAYOUT, MAP_W, RH, regionTop, samplePath, smoothPath } from '../../../src/ui/mapGeometry';
import { gravarImagem, pastaSaida, type ResultadoProcesso } from './process';
import { avaliarRecurso, verificarArquivo, type Problema, type QaRecurso } from './qa';
import type { LotePlano, SaidaSpec } from './types';
import type { Raw } from './imaging';

const ESC = 2; // unidades do mapa → px (@2x)
const STAGE_COLORS = ['#ec6fa0', '#9b7fd4', '#4aaee6', '#f0b429', '#e8548c'];

async function coverRaw(entrada: string | Buffer, w: number, h: number): Promise<{ raw: Raw; origem: { w: number; h: number } }> {
  const meta = await sharp(entrada).metadata();
  const { data, info } = await sharp(entrada).rotate().resize(w, h, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }).flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { raw: { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height }, origem: { w: meta.width ?? w, h: meta.height ?? h } };
}
const fatia = (raw: Raw, y: number, h: number): Raw => ({ data: raw.data.slice(y * raw.width * 4, (y + h) * raw.width * 4), width: raw.width, height: h });

// ---------- análise de textura (aproximação de "região carregada") ----------
const cinza = (raw: Raw) => { const g = new Float32Array(raw.width * raw.height); for (let i = 0; i < g.length; i++) g[i] = 0.299 * raw.data[i * 4] + 0.587 * raw.data[i * 4 + 1] + 0.114 * raw.data[i * 4 + 2]; return g; };
function sobel(g: Float32Array, W: number, H: number): Float32Array {
  const s = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = -g[i - W - 1] - 2 * g[i - 1] - g[i + W - 1] + g[i - W + 1] + 2 * g[i + 1] + g[i + W + 1];
    const gy = -g[i - W - 1] - 2 * g[i - W] - g[i - W + 1] + g[i + W - 1] + 2 * g[i + W] + g[i + W + 1];
    s[i] = Math.hypot(gx, gy) / 1020;
  }
  return s;
}
const percentil = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))] ?? 0; };

export interface ZonaMetrica { nome: string; centro: { x: number; y: number }; raio?: number; borda: number; luminancia: number; status: 'ok' | 'revisar' }
export interface RelatorioZonas { regiao: number; base: { mediana: number; p85: number }; zonas: ZonaMetrica[]; corredor: { borda: number; status: 'ok' | 'revisar' } }

/** Mede a "carga" (densidade de bordas) nas zonas funcionais e compara com o restante do cenário. Heurística: orienta a revisão humana. */
export function analisarZonas(regiao: Raw, regiaoNum: number): RelatorioZonas {
  const W = regiao.width, H = regiao.height;
  const sob = sobel(cinza(regiao), W, H);
  const lum = cinza(regiao);
  const bloco = 24, blocos: number[] = [];
  for (let by = 0; by + bloco <= H; by += bloco) for (let bx = 0; bx + bloco <= W; bx += bloco) { let s = 0; for (let y = by; y < by + bloco; y++) for (let x = bx; x < bx + bloco; x++) s += sob[y * W + x]; blocos.push(s / (bloco * bloco)); }
  const mediana = percentil(blocos, 0.5), p85 = percentil(blocos, 0.85);
  const limite = Math.max(p85, mediana * 1.6, 0.02);
  const noCirculo = (cx: number, cy: number, r: number) => {
    let s = 0, l = 0, n = 0;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { s += sob[y * W + x]; l += lum[y * W + x]; n++; }
    return n ? { borda: s / n, luminancia: l / n / 255 } : { borda: 0, luminancia: 0 };
  };
  const topo = regionTop(regiaoNum);
  const zonas: ZonaMetrica[] = [];
  for (let i = 0; i < 5; i++) {
    const fase = (regiaoNum - 1) * 5 + i + 1, n = DEFAULT_LAYOUT.nodes[fase - 1];
    const c = { x: n.x * ESC, y: (n.y - topo) * ESC }, r = 32 * ESC;
    const m = noCirculo(c.x, c.y, r);
    zonas.push({ nome: `casa ${regiaoNum}.${i + 1}`, centro: c, raio: r, borda: m.borda, luminancia: m.luminancia, status: m.borda > limite ? 'revisar' : 'ok' });
  }
  const rib = noCirculo(200 * ESC, 36 * ESC, 60 * ESC);
  zonas.push({ nome: 'faixa do título', centro: { x: 200 * ESC, y: 36 * ESC }, borda: rib.borda, luminancia: rib.luminancia, status: rib.borda > limite ? 'revisar' : 'ok' });
  const caminho = samplePath(DEFAULT_LAYOUT.walk, 12).filter((p) => p.y >= topo && p.y <= topo + RH);
  let soma = 0, k = 0;
  for (const p of caminho) { soma += noCirculo(p.x * ESC, (p.y - topo) * ESC, 23 * ESC).borda; k++; }
  const corr = k ? soma / k : 0;
  return { regiao: regiaoNum, base: { mediana, p85 }, zonas, corredor: { borda: corr, status: corr > limite * 0.9 ? 'revisar' : 'ok' } };
}

/** Diferença média (0–255) entre as faixas que se tocam de dois cenários vizinhos. */
export function compararBordas(emCima: Raw, emBaixo: Raw, faixa = 12): number {
  const W = Math.min(emCima.width, emBaixo.width);
  let soma = 0, n = 0;
  for (let y = 0; y < faixa; y++) {
    const ya = emCima.height - faixa + y, yb = y; // base do de cima × topo do de baixo
    for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) { soma += Math.abs(emCima.data[(ya * emCima.width + x) * 4 + c] - emBaixo.data[(yb * emBaixo.width + x) * 4 + c]); n++; }
  }
  return n ? soma / n : 0;
}

/** Prévia: o cenário com a geometria real do app (trilha, casas, faixa) desenhada por cima. */
export async function gerarPrevia(composicao: Raw, lote: LotePlano, zonas: RelatorioZonas): Promise<Buffer> {
  const c = lote.cenario!;
  const offsetMapa = c.comTopo ? 0 : regionTop(c.regiao);
  const path = smoothPath(DEFAULT_LAYOUT.walk);
  const cor = STAGE_COLORS[c.regiao - 1];
  const nos = DEFAULT_LAYOUT.nodes.map((n, i) => ({ ...n, fase: i + 1 })).filter((n) => Math.ceil(n.fase / 5) === c.regiao);
  const topoRegiao = (regionTop(c.regiao) - offsetMapa);
  const status = new Map(zonas.zonas.map((z) => [z.nome, z.status]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${composicao.width}" height="${composicao.height}" viewBox="0 0 ${MAP_W} ${composicao.height / ESC}">
  <g transform="translate(0,${-offsetMapa})">
    <path d="${path}" fill="none" stroke="#f3d9b1" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>
    <path d="${path}" fill="none" stroke="#fff5e4" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>
    <path d="${path}" fill="none" stroke="#e7c58f" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>
    ${nos.map((n) => { const i = ((n.fase - 1) % 5) + 1, st = status.get(`casa ${c.regiao}.${i}`) ?? 'ok';
      return `<circle cx="${n.x}" cy="${n.y}" r="25" fill="#fff" stroke="${cor}" stroke-width="4"/><circle cx="${n.x}" cy="${n.y}" r="31" fill="none" stroke="${st === 'ok' ? '#2e7d32' : '#c62828'}" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${n.x}" y="${n.y + 5}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="14" font-weight="700" fill="#37474f">${Math.ceil(n.fase / 5)}.${i}</text>`; }).join('')}
    <g transform="translate(200,${topoRegiao + 36})"><rect x="-118" y="-17" width="236" height="34" rx="17" fill="${cor}" stroke="#fff" stroke-width="3"/><text y="5" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="14" font-weight="800" fill="#fff">Etapa ${c.regiao}</text></g>
  </g></svg>`;
  const base = await sharp(Buffer.from(composicao.data.buffer, composicao.data.byteOffset, composicao.data.byteLength), { raw: { width: composicao.width, height: composicao.height, channels: 4 } }).png().toBuffer();
  return sharp(base).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

export interface OpcoesCenario { pastaLote: string; lote: LotePlano; original: string; log?: (s: string) => void; vizinhas?: { acima?: Raw; abaixo?: Raw } }
export interface ResultadoCenario extends ResultadoProcesso { zonas: RelatorioZonas; previa: string }

export async function processarCenario(op: OpcoesCenario): Promise<ResultadoCenario> {
  const c = op.lote.cenario;
  if (!c) throw new Error(`lote ${op.lote.id} não é um cenário`);
  const meta = await sharp(op.original).metadata();
  const w0 = meta.width ?? 1, h0 = meta.height ?? 1;
  const desvio = Math.abs(w0 / h0 / (c.px.w / c.px.h) - 1);
  if (desvio > 0.25) throw new Error(`proporção recebida (${w0}×${h0}) muito diferente da composição pedida (${c.px.w}×${c.px.h}). Gere de novo em formato retrato próximo de ${(c.px.w / c.px.h).toFixed(2)}:1.`);
  const avisosGerais: string[] = [];
  if (desvio > 0.03) avisosGerais.push(`proporção recebida ${w0}×${h0} difere da pedida em ${(desvio * 100).toFixed(0)}%: imagem recortada ao centro (cover)`);
  const { raw: comp } = await coverRaw(op.original, c.px.w, c.px.h);
  const saidaDir = pastaSaida(op.pastaLote, op.lote.pacote);
  const recursos: QaRecurso[] = [], arquivosSaida: string[] = [];
  let regiaoRaw: Raw | null = null;
  for (const p of c.partes) {
    const raw = fatia(comp, p.y, p.h);
    if (p.id.startsWith('map.region.')) regiaoRaw = raw;
    const spec: SaidaSpec = { arquivo: p.arquivo, formato: p.formato, px: { w: raw.width, h: raw.height }, alfa: false, alinhamento: 'centro', ancora: { x: 0.5, y: 0.5 }, margemSeguranca: 0, maxKB: p.maxKB, dimMode: 'exact' };
    const alvo = join(saidaDir, p.arquivo);
    const { bytes, excedeu } = await gravarImagem(raw, alvo, spec);
    const qa = avaliarRecurso(raw, { ...spec, alfa: false }, { id: p.id, arquivo: p.arquivo, bytes, maxKBExcedido: excedeu });
    // cenário é opaco: cobertura/margens não se aplicam; só dimensões, peso, uniformidade e integridade
    qa.problemas = qa.problemas.filter((x) => !['cortado', 'margem', 'sem-transparencia'].includes(x.codigo));
    const g = cinza(raw); let m = 0; for (const v of g) m += v; m /= g.length; let v2 = 0; for (const v of g) v2 += (v - m) ** 2;
    if (Math.sqrt(v2 / g.length) < 4) qa.problemas.push({ codigo: 'uniforme', severidade: 'erro', msg: 'imagem praticamente uniforme (vazia?)' });
    const integ = await verificarArquivo(alvo, { px: spec.px, formato: spec.formato });
    if (integ) qa.problemas.push(integ);
    qa.status = qa.problemas.some((x) => x.severidade === 'erro') ? 'falha' : qa.problemas.length ? 'revisar' : 'ok';
    recursos.push(qa); arquivosSaida.push(alvo);
  }
  if (!regiaoRaw) throw new Error('cenário sem a parte da região');
  const zonas = analisarZonas(regiaoRaw, c.regiao);
  const bgQa = recursos.find((r) => r.id === `map.region.${c.regiao}.bg`)!;
  for (const z of zonas.zonas.filter((q) => q.status === 'revisar')) bgQa.problemas.push({ codigo: 'zona-carregada', severidade: 'aviso', msg: `${z.nome}: muito detalhe/contraste onde o app desenha (revise a prévia)` });
  if (zonas.corredor.status === 'revisar') bgQa.problemas.push({ codigo: 'corredor-carregado', severidade: 'aviso', msg: 'o corredor da trilha tem muito detalhe: a trilha desenhada pelo app pode perder legibilidade' });
  if (op.vizinhas?.acima) { const d = compararBordas(op.vizinhas.acima, regiaoRaw); if (d > 28) bgQa.problemas.push({ codigo: 'emenda', severidade: 'aviso', msg: `borda superior destoa da região acima (diferença média ${d.toFixed(0)}/255)` }); }
  if (op.vizinhas?.abaixo) { const d = compararBordas(regiaoRaw, op.vizinhas.abaixo); if (d > 28) bgQa.problemas.push({ codigo: 'emenda', severidade: 'aviso', msg: `borda inferior destoa da região abaixo (diferença média ${d.toFixed(0)}/255)` }); }
  bgQa.status = bgQa.problemas.some((x: Problema) => x.severidade === 'erro') ? 'falha' : bgQa.problemas.length ? 'revisar' : 'ok';
  const dirRev = join(op.pastaLote, 'revisao'); mkdirSync(dirRev, { recursive: true });
  const previaPath = join(dirRev, `previa-regiao-${c.regiao}.png`);
  writeFileSync(previaPath, await gerarPrevia(comp, op.lote, zonas));
  writeFileSync(join(dirRev, 'zonas.json'), JSON.stringify(zonas, null, 2));
  avisosGerais.push('Camadas (mid/path/fg) não foram separadas: o cenário é usado como fundo e o app continua desenhando trilha, casas e faixa.');
  return { lote: op.lote.id, recursos, avisosGerais, arquivosSaida, zonas, previa: previaPath };
}

/** Fundo individual (ex.: céu do minigame): ajuste exato de resolução (cover) + conferência técnica. */
export async function processarIndividual(op: { pastaLote: string; lote: LotePlano; original: string; log?: (s: string) => void }): Promise<ResultadoProcesso> {
  const i = op.lote.individual;
  if (!i) throw new Error(`lote ${op.lote.id} não é individual`);
  const meta = await sharp(op.original).metadata();
  const desvio = Math.abs((meta.width ?? 1) / (meta.height ?? 1) / (i.px.w / i.px.h) - 1);
  if (desvio > 0.25) throw new Error(`proporção recebida muito diferente da pedida (${i.px.w}×${i.px.h})`);
  const { raw } = await coverRaw(op.original, i.px.w, i.px.h);
  const spec: SaidaSpec = { arquivo: i.arquivo, formato: i.formato, px: i.px, alfa: false, alinhamento: 'centro', ancora: { x: 0.5, y: 0.5 }, margemSeguranca: 0, maxKB: i.maxKB, dimMode: 'aspect' };
  const alvo = join(pastaSaida(op.pastaLote, op.lote.pacote), i.arquivo);
  const { bytes, excedeu } = await gravarImagem(raw, alvo, spec);
  const qa = avaliarRecurso(raw, spec, { id: i.id, arquivo: i.arquivo, bytes, maxKBExcedido: excedeu });
  qa.problemas = qa.problemas.filter((x) => !['cortado', 'margem', 'sem-transparencia'].includes(x.codigo));
  if (desvio > 0.03) qa.problemas.push({ codigo: 'recorte', severidade: 'aviso', msg: `proporção diferente da pedida em ${(desvio * 100).toFixed(0)}%: imagem recortada ao centro` });
  qa.status = qa.problemas.some((x) => x.severidade === 'erro') ? 'falha' : qa.problemas.length ? 'revisar' : 'ok';
  return { lote: op.lote.id, recursos: [qa], avisosGerais: [], arquivosSaida: [alvo] };
}
