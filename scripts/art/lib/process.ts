// Processador de pranchas: recorte por célula, remoção de fundo, escala uniforme, margem de segurança, conversão e nomes oficiais.
import sharp from 'sharp';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { alphaDe, atribuir, estimarFundo, extrair, hexRgb, jaTransparente, distRgb, lerRaw, paraPng, removerFundo, rotular, TOLERANCIAS, type CelulaPx, type Raw } from './imaging';
import { avaliarRecurso, verificarArquivo, type Problema, type QaRecurso } from './qa';
import type { LotePlano, SaidaSpec } from './types';

export interface ResultadoProcesso {
  lote: string; recursos: QaRecurso[]; avisosGerais: string[];
  deteccao?: { largura: number; altura: number; celulas: Array<{ id: string; rect: { x: number; y: number; w: number; h: number }; bbox: { x0: number; y0: number; x1: number; y1: number } | null }> };
  fundoDetectado?: string; arquivosSaida: string[];
}
export const pastaSaida = (pastaLote: string, pacote: string) => join(pastaLote, 'saida', 'art', pacote);
const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/** Escala uniforme célula→arquivo, centralização (ou base no chão) e redução automática para respeitar a margem. */
export async function comporFinal(crop: Raw, celulaPx: { w: number; h: number }, spec: SaidaSpec): Promise<{ raw: Raw; reducao: number; escala: number }> {
  const { w: PW, h: PH } = spec.px;
  const escala = Math.min(PW / celulaPx.w, PH / celulaPx.h);
  const sw = crop.width * escala, sh = crop.height * escala;
  const mx = spec.margemSeguranca * PW, my = spec.margemSeguranca * PH;
  const base = spec.alinhamento === 'base';
  const dispW = PW - 2 * mx, dispH = base ? spec.ancora.y * PH - my : PH - 2 * my;
  const reducao = Math.min(1, dispW / sw, dispH / sh);
  const fw = Math.max(1, Math.round(sw * reducao)), fh = Math.max(1, Math.round(sh * reducao));
  const left = Math.min(PW - fw, Math.max(0, Math.round(base ? spec.ancora.x * PW - fw / 2 : (PW - fw) / 2)));
  const top = Math.min(PH - fh, Math.max(0, Math.round(base ? spec.ancora.y * PH - fh : (PH - fh) / 2)));
  const redim = await sharp(Buffer.from(crop.data.buffer, crop.data.byteOffset, crop.data.byteLength), { raw: { width: crop.width, height: crop.height, channels: 4 } })
    .resize(fw, fh, { kernel: 'lanczos3', fit: 'fill' }).png().toBuffer();
  const { data } = await sharp({ create: { width: PW, height: PH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: redim, left, top }]).raw().toBuffer({ resolveWithObject: true });
  return { raw: { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: PW, height: PH }, reducao, escala };
}

/** Grava WebP/PNG respeitando o orçamento de peso (reduz a qualidade em passos). */
export async function gravarImagem(raw: Raw, caminho: string, spec: Pick<SaidaSpec, 'formato' | 'maxKB'>): Promise<{ bytes: number; excedeu: boolean }> {
  mkdirSync(dirname(caminho), { recursive: true });
  const base = () => sharp(Buffer.from(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength), { raw: { width: raw.width, height: raw.height, channels: 4 } });
  let buf: Buffer;
  if (spec.formato === 'webp') {
    buf = Buffer.alloc(0);
    for (const q of [92, 88, 84, 80, 74, 68]) { buf = await base().webp({ quality: q, alphaQuality: 100, effort: 5 }).toBuffer(); if (buf.length <= spec.maxKB * 1024) break; }
  } else {
    buf = await base().png({ compressionLevel: 9 }).toBuffer();
    if (buf.length > spec.maxKB * 1024) buf = await base().png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
  }
  writeFileSync(caminho, buf);
  return { bytes: buf.length, excedeu: buf.length > spec.maxKB * 1024 };
}

export interface OpcoesPrancha { pastaLote: string; lote: LotePlano; original: string; tolerancia?: keyof typeof TOLERANCIAS; log?: (s: string) => void }

export async function processarPrancha(op: OpcoesPrancha): Promise<ResultadoProcesso> {
  const { lote, pastaLote } = op;
  const f = lote.folha;
  if (!f) throw new Error(`lote ${lote.id} não é uma prancha`);
  const log = op.log ?? (() => {});
  const raw = await lerRaw(op.original);
  const W = raw.width, H = raw.height;
  const avisosGerais: string[] = [];
  const esperado = f.aspecto[0] / f.aspecto[1];
  const desvio = Math.abs(W / H / esperado - 1);
  if (desvio > 0.25) throw new Error(`proporção da imagem recebida (${W}×${H}) é muito diferente da pedida (${f.aspecto[0]}:${f.aspecto[1]}). Gere de novo no formato correto.`);
  if (desvio > 0.03) avisosGerais.push(`proporção recebida ${W}×${H} difere da pedida ${f.aspecto[0]}:${f.aspecto[1]} (${(desvio * 100).toFixed(0)}%): as células foram localizadas por detecção`);

  const bg = estimarFundo(raw);
  const pedido = hexRgb(f.fundo);
  if (distRgb(bg, pedido) > 60) avisosGerais.push(`fundo detectado rgb(${bg.r},${bg.g},${bg.b}) difere do pedido ${f.fundo}; usando o detectado`);
  if (bg.confianca < 0.6) avisosGerais.push(`fundo pouco uniforme no contorno (${(bg.confianca * 100).toFixed(0)}% do contorno na mesma cor): recortes podem exigir revisão`);
  const fundoHex = `#${hex2(bg.r)}${hex2(bg.g)}${hex2(bg.b)}`.toUpperCase();

  let rgba: Uint8Array;
  if (jaTransparente(raw)) { rgba = raw.data; avisosGerais.push('imagem já possui transparência: fundo não foi removido'); }
  else {
    const r = removerFundo(raw, bg, TOLERANCIAS[op.tolerancia ?? 'media']);
    rgba = r.rgba;
    log(`fundo removido (${r.vaos} vão(s) interno(s), ${r.semi} pixel(s) de borda suavizados)`);
  }
  const rot = rotular(alphaDe({ data: rgba, width: W, height: H }), W, H);
  const cel: CelulaPx[] = f.celulas.map((c) => ({ id: c.id, x: c.rect.x * W, y: c.rect.y * H, w: c.rect.w * W, h: c.rect.h * H }));
  const atr = atribuir(rot.comps, cel);
  if (atr.foraDaGrade.length) avisosGerais.push(`${atr.foraDaGrade.length} elemento(s) fora da grade (ignorado(s)): possível resíduo ou desenho extra`);
  if (atr.ruido.length) avisosGerais.push(`${atr.ruido.length} resíduo(s) minúsculo(s) descartado(s)`);

  const recursos: QaRecurso[] = [];
  const arquivosSaida: string[] = [];
  const det: NonNullable<ResultadoProcesso['deteccao']>['celulas'] = [];
  const saidaDir = pastaSaida(pastaLote, lote.pacote);
  for (const c of f.celulas) {
    const px = cel.find((k) => k.id === c.id)!;
    const g = atr.porCelula.get(c.id);
    const spec = c.saida;
    det.push({ id: c.id, rect: { x: px.x, y: px.y, w: px.w, h: px.h }, bbox: g ? { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1 } : null });
    if (!g) {
      recursos.push({ id: c.id, arquivo: spec.arquivo, status: 'falha', problemas: [{ codigo: 'celula-vazia', severidade: 'erro', msg: 'célula vazia: nenhum elemento encontrado nesta posição da prancha' }], metricas: { cobertura: 0, bytes: 0, reducao: 1, residuoFundo: 0, franja: 0, margemMin: 0, px: spec.px }, aprovacaoArtistica: 'pendente' });
      continue;
    }
    const notas: Problema[] = [];
    if (g.x0 <= 1 || g.y0 <= 1 || g.x1 >= W - 2 || g.y1 >= H - 2) notas.push({ codigo: 'cortado-imagem', severidade: 'erro', msg: 'o elemento encosta na borda da imagem inteira (provavelmente cortado)' });
    if (px.w < spec.px.w || px.h < spec.px.h) notas.push({ codigo: 'resolucao-baixa', severidade: 'aviso', msg: `a célula recebida tem ${Math.round(px.w)}×${Math.round(px.h)} px, menos que o arquivo final (${spec.px.w}×${spec.px.h}): será ampliada — peça a maior resolução disponível` });
    const ex = 0.1;
    if (g.x0 < px.x - px.w * ex || g.x1 > px.x + px.w * (1 + ex) || g.y0 < px.y - px.h * ex || g.y1 > px.y + px.h * (1 + ex)) notas.push({ codigo: 'invade-celula', severidade: 'aviso', msg: 'o elemento ultrapassa os limites da sua célula (pode invadir a vizinha)' });
    const grandes = g.comps.filter((k) => k.area > 0.05 * Math.max(...g.comps.map((q) => q.area)));
    if (grandes.length > 1) notas.push({ codigo: 'partes-separadas', severidade: 'aviso', msg: `${grandes.length} partes separadas na célula (elemento duplicado ou fragmentado?)` });
    const crop = extrair(rgba, W, rot, new Set(g.comps.map((k) => k.id)), g);
    mkdirSync(join(pastaLote, 'celulas'), { recursive: true });
    writeFileSync(join(pastaLote, 'celulas', `${c.id}.png`), await paraPng(crop));
    const { raw: final, reducao } = await comporFinal(crop, { w: px.w, h: px.h }, spec);
    const alvo = join(saidaDir, spec.arquivo);
    const { bytes, excedeu } = await gravarImagem(final, alvo, spec);
    const qa = avaliarRecurso(final, spec, { id: c.id, arquivo: spec.arquivo, bg, bytes, reducao, maxKBExcedido: excedeu, notasCelula: notas, baseNoChao: spec.alinhamento === 'base' && spec.ancora.y >= 0.99 });
    const integ = await verificarArquivo(alvo, spec);
    if (integ) { qa.problemas.push(integ); qa.status = 'falha'; }
    recursos.push(qa);
    arquivosSaida.push(alvo);
    log(`${c.id}: ${qa.status}${qa.problemas.length ? ` (${qa.problemas.map((p) => p.codigo).join(', ')})` : ''}`);
  }
  return { lote: lote.id, recursos, avisosGerais, deteccao: { largura: W, altura: H, celulas: det }, fundoDetectado: fundoHex, arquivosSaida };
}
export const tamanhoArquivo = (p: string) => statSync(p).size;
