// Controle de qualidade TÉCNICO de cada recurso (não é aprovação artística: ela é sempre uma decisão humana).
import sharp from 'sharp';
import type { SaidaSpec } from './types';
import { distRgb, type Raw, type RGB } from './imaging';

export interface Problema { codigo: string; severidade: 'erro' | 'aviso'; msg: string }
export type StatusQa = 'ok' | 'revisar' | 'falha';
export interface QaRecurso {
  id: string; arquivo: string; status: StatusQa; problemas: Problema[];
  metricas: { cobertura: number; bytes: number; reducao: number; residuoFundo: number; franja: number; margemMin: number; px: { w: number; h: number } };
  aprovacaoArtistica: 'pendente'; // sempre pendente: o QA automático nunca aprova arte
}
export interface ContextoQa { id: string; arquivo: string; bg?: RGB; bytes: number; reducao?: number; maxKBExcedido?: boolean; notasCelula?: Problema[]; baseNoChao?: boolean }

export function avaliarRecurso(final: Raw, spec: SaidaSpec, ctx: ContextoQa): QaRecurso {
  const { width: W, height: H, data } = final;
  const problemas: Problema[] = [...(ctx.notasCelula ?? [])];
  const add = (codigo: string, severidade: Problema['severidade'], msg: string) => problemas.push({ codigo, severidade, msg });
  const n = W * H;
  let opacos = 0, transp = 0, minX = W, minY = H, maxX = -1, maxY = -1, borda = false, semi = 0, semiFundo = 0, resid = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4, a = data[o + 3];
    if (a > 200) opacos++;
    if (a < 10) transp++;
    if (a > 16) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const naBorda = x === 0 || y === 0 || x === W - 1 || (y === H - 1 && !(ctx.baseNoChao));
      if (naBorda) borda = true;
    }
    if (ctx.bg) {
      const d = distRgb({ r: data[o], g: data[o + 1], b: data[o + 2] }, ctx.bg);
      if (a > 200 && d <= 45) resid++;
      if (a > 16 && a < 240) { semi++; if (d <= 60) semiFundo++; }
    }
  }
  const cobertura = opacos / n;
  const residuoFundo = opacos ? resid / opacos : 0;
  const franja = semi ? semiFundo / semi : 0;
  const dim = (w: number, h: number) => w === spec.px.w && h === spec.px.h;
  if (!dim(W, H)) add('dimensoes', 'erro', `dimensões ${W}×${H} diferem de ${spec.px.w}×${spec.px.h}`);
  if (cobertura < 0.01) add('vazia', 'erro', 'recurso vazio ou quase vazio (célula sem elemento?)');
  if (spec.alfa && transp / n < 0.001 && cobertura >= 0.01) add('sem-transparencia', 'erro', 'sem pixels transparentes: o fundo não foi removido');
  if (borda) add('cortado', 'erro', 'o elemento toca a borda do arquivo (provavelmente cortado)');
  const margemMin = maxX < 0 ? 0 : Math.min(minX / W, minY / H, (W - 1 - maxX) / W, ctx.baseNoChao ? 1 : (H - 1 - maxY) / H);
  if (maxX >= 0 && !borda && margemMin < spec.margemSeguranca * 0.4) add('margem', 'aviso', `elemento muito perto da borda (margem ${(margemMin * 100).toFixed(1)}% < ${(spec.margemSeguranca * 40).toFixed(1)}%)`);
  if (residuoFundo > 0.005) add('residuo-fundo', residuoFundo > 0.05 ? 'erro' : 'aviso', `possíveis resíduos da cor do fundo (${(residuoFundo * 100).toFixed(1)}% dos pixels opacos)`);
  if (franja > 0.35 && semi > 40) add('franja', 'aviso', `borda com cor do fundo (${(franja * 100).toFixed(0)}% dos pixels semitransparentes)`);
  if (ctx.reducao !== undefined && ctx.reducao < 0.8) add('apertada', 'aviso', `elemento reduzido a ${(ctx.reducao * 100).toFixed(0)}% para caber na margem (célula apertada)`);
  if (ctx.bytes > spec.maxKB * 1024 || ctx.maxKBExcedido) add('peso', 'aviso', `${(ctx.bytes / 1024).toFixed(0)} KB excede o orçamento de ${spec.maxKB} KB`);
  const status: StatusQa = problemas.some((p) => p.severidade === 'erro') ? 'falha' : problemas.length ? 'revisar' : 'ok';
  return { id: ctx.id, arquivo: ctx.arquivo, status, problemas, metricas: { cobertura, bytes: ctx.bytes, reducao: ctx.reducao ?? 1, residuoFundo, franja, margemMin, px: { w: W, h: H } }, aprovacaoArtistica: 'pendente' };
}

/** Integridade: relê o arquivo gravado e confere formato e dimensões. */
export async function verificarArquivo(caminho: string, spec: { px: { w: number; h: number }; formato: string }): Promise<Problema | null> {
  try {
    const m = await sharp(caminho).metadata();
    if (m.format !== spec.formato) return { codigo: 'formato', severidade: 'erro', msg: `arquivo gravado é ${m.format}, esperado ${spec.formato}` };
    if (m.width !== spec.px.w || m.height !== spec.px.h) return { codigo: 'integridade', severidade: 'erro', msg: `arquivo gravado mede ${m.width}×${m.height}, esperado ${spec.px.w}×${spec.px.h}` };
    await sharp(caminho).raw().toBuffer(); // decodifica por inteiro
    return null;
  } catch (e) {
    return { codigo: 'integridade', severidade: 'erro', msg: `arquivo ilegível: ${(e as Error).message}` };
  }
}
export const resumirQa = (lista: QaRecurso[]) => ({ ok: lista.filter((q) => q.status === 'ok').length, revisar: lista.filter((q) => q.status === 'revisar').length, falha: lista.filter((q) => q.status === 'falha').length });
