// Proposta de atualização do manifesto e integração controlada (somente lote aprovado, com validação e reversão).
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { validateArt } from '../../validate-art.mjs';
import { pastaSaida } from './process';
import type { CatalogFile, LotePlano } from './types';

export interface EntradaProposta {
  file: string; sprite?: { frames: number; fps: number; loop: boolean; frameW: number; frameH: number };
  box?: { w: number; h: number }; anchor?: { x: number; y: number }; offset?: { x: number; y: number };
  textArea?: { x: number; y: number; w: number; h: number }; slice?: { l: number; r: number };
}
/** Campos opcionais do manifesto derivados da especificação de saída (só aparecem quando declarados). */
export function extrasDaSaida(s: import('./types').SaidaSpec): Partial<EntradaProposta> {
  return {
    ...(s.exibicao?.box ? { box: s.exibicao.box } : {}), ...(s.exibicao?.anchor ? { anchor: s.exibicao.anchor } : {}), ...(s.exibicao?.offset ? { offset: s.exibicao.offset } : {}),
    ...(s.areaTexto ? { textArea: s.areaTexto } : {}), ...(s.fatias ? { slice: { l: s.fatias.esq, r: s.fatias.dir } } : {}),
  };
}
export interface Proposta { pacote: string; lote: string; assets: Record<string, EntradaProposta> }

export function montarProposta(lote: LotePlano, apenas?: Set<string>): Proposta {
  const assets: Record<string, EntradaProposta> = {};
  if (lote.folha) for (const c of lote.folha.celulas) {
    if (apenas && !apenas.has(c.id)) continue;
    const s = c.saida;
    assets[c.id] = { file: s.arquivo, ...extrasDaSaida(s), ...(s.spriteUmQuadro ? { sprite: { frames: 1, fps: 1, loop: true, frameW: s.spriteUmQuadro.frameW, frameH: s.spriteUmQuadro.frameH } } : {}) };
  }
  if (lote.cenario) for (const p of lote.cenario.partes) if (!apenas || apenas.has(p.id)) assets[p.id] = { file: p.arquivo };
  if (lote.individual && (!apenas || apenas.has(lote.individual.id))) assets[lote.individual.id] = { file: lote.individual.arquivo };
  return { pacote: lote.pacote, lote: lote.id, assets };
}

type Manifesto = { schema: 1; activePack: string | null; packs: Record<string, { label?: string; dir: string; assets: Record<string, unknown>; layout?: unknown }> };
export function aplicarProposta(m: Manifesto, p: Proposta, ativar = false): Manifesto {
  const out: Manifesto = JSON.parse(JSON.stringify(m));
  out.packs[p.pacote] ??= { label: `Pacote ${p.pacote}`, dir: p.pacote, assets: {} };
  Object.assign(out.packs[p.pacote].assets, p.assets);
  if (ativar) out.activePack = p.pacote;
  return out;
}

export interface ResultadoIntegracao { ok: boolean; erros: string[]; avisos: string[]; copiados: string[] }
/** Copia os arquivos aprovados para public/art/<pacote>, valida e só então grava o manifesto; qualquer erro desfaz tudo. */
export function integrar(o: { pastaLote: string; lote: LotePlano; aprovados: Set<string>; manifestoPath: string; publicDir: string; catalogo: CatalogFile; ativar?: boolean }): ResultadoIntegracao {
  const proposta = montarProposta(o.lote, o.aprovados);
  const ids = Object.keys(proposta.assets);
  if (!ids.length) return { ok: false, erros: ['nenhum recurso aprovado para integrar'], avisos: [], copiados: [] };
  const origem = pastaSaida(o.pastaLote, o.lote.pacote);
  const copiados: string[] = [], novos: string[] = [];
  const antigo = existsSync(o.manifestoPath) ? readFileSync(o.manifestoPath, 'utf8') : '';
  const reverter = () => { for (const f of novos) rmSync(f, { force: true }); };
  for (const id of ids) {
    const rel = proposta.assets[id].file, de = join(origem, rel), para = join(o.publicDir, o.lote.pacote, rel);
    if (!existsSync(de)) { reverter(); return { ok: false, erros: [`arquivo processado ausente: ${rel} (rode art:process)`], avisos: [], copiados: [] }; }
    mkdirSync(dirname(para), { recursive: true });
    if (!existsSync(para)) novos.push(para);
    copyFileSync(de, para);
    copiados.push(para);
  }
  const atual = (antigo ? JSON.parse(antigo) : { schema: 1, activePack: null, packs: {} }) as Manifesto;
  const novo = aplicarProposta(atual, proposta, o.ativar);
  const v = validateArt({ manifest: novo, catalog: o.catalogo, publicDir: o.publicDir });
  if (v.errors.length) { reverter(); return { ok: false, erros: v.errors, avisos: v.warnings, copiados: [] }; }
  writeFileSync(o.manifestoPath, JSON.stringify(novo, null, 2) + '\n');
  return { ok: true, erros: [], avisos: v.warnings, copiados };
}
