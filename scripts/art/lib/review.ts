// Relatório de conferência: prancha de contato (com ID e status), detecção sobre a prancha original, qa.json e HTML.
import sharp, { type OverlayOptions } from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResultadoProcesso } from './process';
import { pastaSaida } from './process';
import type { LotePlano } from './types';
import { resumirQa } from './qa';

const COR = { ok: '#2e7d32', revisar: '#ef6c00', falha: '#c62828' } as const;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const xadrez = (w: number, h: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#ddd"/><rect width="8" height="8" fill="#fff"/><rect x="8" y="8" width="8" height="8" fill="#fff"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/></svg>`);
const liso = (w: number, h: number, cor: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${cor}"/></svg>`);

/** Prancha de conferência: cada recurso sobre xadrez, escuro e claro, com ID e resultado da validação técnica. */
export async function pranchaConferencia(res: ResultadoProcesso, pastaLote: string, pacote: string): Promise<Buffer> {
  const itens = res.recursos;
  const S = 112, G = 8, tileW = 3 * S + 4 * G, tileH = S + 70, cols = Math.min(2, Math.max(1, itens.length)), rows = Math.ceil(itens.length / cols);
  const W = cols * tileW, H = Math.max(1, rows) * tileH + 44;
  const comps: OverlayOptions[] = [];
  const texto: string[] = [`<text x="12" y="28" font-family="DejaVu Sans, sans-serif" font-size="16" font-weight="700" fill="#333">Conferência técnica · ${esc(res.lote)} — a aprovação artística é separada e manual</text>`];
  for (let i = 0; i < itens.length; i++) {
    const q = itens[i];
    const tx = (i % cols) * tileW, ty = 44 + Math.floor(i / cols) * tileH;
    const arq = join(pastaSaida(pastaLote, pacote), q.arquivo);
    let prev: Buffer | null = null;
    if (existsSync(arq)) prev = await sharp(arq).resize(S - 8, S - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    [xadrez(S, S), liso(S, S, '#2d2760'), liso(S, S, '#fff0f7')].forEach((bg, k) => {
      const x = tx + G + k * (S + G);
      comps.push({ input: bg, left: x, top: ty });
      if (prev) comps.push({ input: prev, left: x + 4, top: ty + 4 });
    });
    const cor = COR[q.status];
    texto.push(`<rect x="${tx + 2}" y="${ty - 2}" width="${tileW - 4}" height="${tileH - 6}" rx="8" fill="none" stroke="${cor}" stroke-width="3"/>`);
    texto.push(`<text x="${tx + G}" y="${ty + S + 20}" font-family="DejaVu Sans, sans-serif" font-size="12" font-weight="700" fill="#222">${esc(q.id)}</text>`);
    texto.push(`<text x="${tx + G}" y="${ty + S + 37}" font-family="DejaVu Sans, sans-serif" font-size="12" font-weight="700" fill="${cor}">${q.status.toUpperCase()} · ${(q.metricas.bytes / 1024).toFixed(0)} KB · ${q.metricas.px.w}×${q.metricas.px.h}</text>`);
    texto.push(`<text x="${tx + G}" y="${ty + S + 54}" font-family="DejaVu Sans, sans-serif" font-size="11" fill="#555">${esc((q.problemas[0]?.msg ?? 'sem alertas automáticos').slice(0, 60))}</text>`);
  }
  const base = await sharp({ create: { width: W, height: H, channels: 4, background: '#f6f6fa' } }).composite([...comps, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${texto.join('')}</svg>`), left: 0, top: 0 }]).png().toBuffer();
  return base;
}

/** Original com as células esperadas (azul) e o que foi detectado em cada uma (verde/vermelho). */
export async function imagemDeteccao(res: ResultadoProcesso, original: string): Promise<Buffer | null> {
  const d = res.deteccao;
  if (!d) return null;
  const marcas = d.celulas.map((c) => {
    const q = res.recursos.find((r) => r.id === c.id);
    const cor = q ? COR[q.status] : '#999';
    return `<rect x="${c.rect.x}" y="${c.rect.y}" width="${c.rect.w}" height="${c.rect.h}" fill="none" stroke="#1e88e5" stroke-width="${Math.max(2, d.largura / 400)}" stroke-dasharray="12 8"/>` +
      (c.bbox ? `<rect x="${c.bbox.x0}" y="${c.bbox.y0}" width="${c.bbox.x1 - c.bbox.x0}" height="${c.bbox.y1 - c.bbox.y0}" fill="none" stroke="${cor}" stroke-width="${Math.max(3, d.largura / 300)}"/>` : `<line x1="${c.rect.x}" y1="${c.rect.y}" x2="${c.rect.x + c.rect.w}" y2="${c.rect.y + c.rect.h}" stroke="#c62828" stroke-width="4"/>`) +
      `<text x="${c.rect.x + 8}" y="${c.rect.y + Math.max(16, d.largura / 60)}" font-family="DejaVu Sans, sans-serif" font-size="${Math.max(14, d.largura / 70)}" font-weight="700" fill="${cor}">${esc(c.id)}</text>`;
  }).join('');
  return sharp(original).rotate().composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${d.largura}" height="${d.altura}">${marcas}</svg>`) }]).png().toBuffer();
}

export interface SaidaRevisao { pasta: string; conferencia: string; relatorioHtml: string; qaJson: string; deteccao?: string }
export async function gerarRevisao(pastaLote: string, lote: LotePlano, res: ResultadoProcesso, original?: string): Promise<SaidaRevisao> {
  const pasta = join(pastaLote, 'revisao');
  mkdirSync(pasta, { recursive: true });
  const conferencia = join(pasta, 'conferencia.png');
  writeFileSync(conferencia, await pranchaConferencia(res, pastaLote, lote.pacote));
  let deteccao: string | undefined;
  if (original && res.deteccao) { const b = await imagemDeteccao(res, original); if (b) { deteccao = join(pasta, 'deteccao.png'); writeFileSync(deteccao, b); } }
  const qaJson = join(pasta, 'qa.json');
  writeFileSync(qaJson, JSON.stringify({ lote: lote.id, resumo: resumirQa(res.recursos), avisosGerais: res.avisosGerais, fundoDetectado: res.fundoDetectado, recursos: res.recursos }, null, 2));
  const r = resumirQa(res.recursos);
  const linhas = res.recursos.map((q) => `<tr><td><img src="../saida/art/${esc(lote.pacote)}/${esc(q.arquivo)}" alt="" style="max-width:96px;max-height:96px;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px"></td><td><code>${esc(q.id)}</code></td><td style="color:${COR[q.status]};font-weight:700">${q.status.toUpperCase()}</td><td>${q.problemas.map((p) => `${p.severidade === 'erro' ? '⛔' : '⚠️'} ${esc(p.msg)}`).join('<br>') || '—'}</td><td>${q.metricas.px.w}×${q.metricas.px.h}<br>${(q.metricas.bytes / 1024).toFixed(0)} KB</td><td>Aprovação artística: <b>pendente</b></td></tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Revisão ${esc(lote.id)}</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;vertical-align:top;font-size:14px}th{background:#f3ecfb;text-align:left}.aviso{background:#fff8e1;border:2px dashed #ffb300;border-radius:8px;padding:10px 14px;margin:12px 0}img.g{max-width:100%;border:1px solid #ccc}</style>
<h1>${esc(lote.titulo)}</h1><p>Lote <code>${esc(lote.id)}</code> · ${r.ok} ok · ${r.revisar} para revisar · ${r.falha} com falha</p>
<div class="aviso"><b>Validação técnica ≠ aprovação artística.</b> Estes resultados só indicam problemas mensuráveis (tamanho, transparência, cortes, resíduos). Olhe cada recurso e decida: <code>npm run art:approve -- ${esc(lote.id)} --ids ID1,ID2</code> ou <code>--rejeitar ID</code>.</div>
${res.avisosGerais.length ? `<h2>Avisos gerais</h2><ul>${res.avisosGerais.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
<h2>Recursos extraídos</h2><table><tr><th>Prévia</th><th>ID</th><th>Técnico</th><th>Alertas</th><th>Arquivo</th><th>Arte</th></tr>${linhas}</table>
<h2>Prancha de conferência</h2><img class="g" src="conferencia.png" alt="conferência">${deteccao ? '<h2>Detecção sobre a imagem recebida</h2><p>Azul tracejado = célula esperada; contorno colorido = o que foi encontrado.</p><img class="g" src="deteccao.png" alt="detecção">' : ''}
${lote.tipo === 'cenario' ? `<h2>Prévia com a geometria real do app</h2><img class="g" src="previa-regiao-${lote.cenario!.regiao}.png" alt="prévia">` : ''}</html>`;
  const relatorioHtml = join(pasta, 'relatorio.html');
  writeFileSync(relatorioHtml, html);
  return { pasta, conferencia, relatorioHtml, qaJson, deteccao };
}
export const lerQa = (pastaLote: string) => JSON.parse(readFileSync(join(pastaLote, 'revisao', 'qa.json'), 'utf8')) as { recursos: Array<{ id: string; status: string }> };
