// Registro de produção: estados por lote, histórico, etapas já concluídas (retomada) e aprovação artística por recurso.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ESTADOS, type Estado, type LotePlano, type Registro, type RegistroLote } from './types';

export const workDirPadrao = () => process.env.ART_WORK_DIR ?? 'art-work';
export const arquivoRegistro = (workDir: string) => join(workDir, 'registro.json');
export const pastaLote = (workDir: string, id: string) => join(workDir, 'lotes', id);
export const sha256 = (buf: Uint8Array | string) => createHash('sha256').update(buf).digest('hex');

export function carregarRegistro(workDir: string, pacote = 'v1'): Registro {
  const f = arquivoRegistro(workDir);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Registro) : { versao: 1, pacote, lotes: [] };
}
export function salvarRegistro(workDir: string, r: Registro) {
  const f = arquivoRegistro(workDir);
  mkdirSync(dirname(f), { recursive: true });
  const tmp = `${f}.tmp`;
  writeFileSync(tmp, JSON.stringify(r, null, 2) + '\n');
  renameSync(tmp, f); // gravação atômica: uma interrupção nunca deixa o registro pela metade
}

/** Garante uma entrada "planejado" para cada lote do plano, sem mexer nos estados já existentes. */
export function sincronizarComPlano(r: Registro, lotes: LotePlano[], agora: () => string): Registro {
  const out: Registro = { ...r, lotes: [...r.lotes] };
  for (const l of lotes) {
    if (out.lotes.some((x) => x.id === l.id)) continue;
    out.lotes.push({ id: l.id, estado: 'planejado', historico: [{ estado: 'planejado', em: agora() }], etapas: {}, aprovacao: {} });
  }
  return out;
}
export const obter = (r: Registro, id: string): RegistroLote => {
  const l = r.lotes.find((x) => x.id === id);
  if (!l) throw new Error(`lote desconhecido: ${id}`);
  return l;
};

// Transições permitidas: sempre para a frente, com retorno a "aguardando_geracao" (refazer) e "em_revisao" (revogar aprovação).
const PERMITIDAS: Record<Estado, Estado[]> = {
  planejado: ['aguardando_geracao'],
  aguardando_geracao: ['recebido', 'planejado'],
  recebido: ['processado', 'aguardando_geracao'],
  processado: ['em_revisao', 'recebido', 'aguardando_geracao'],
  em_revisao: ['aprovado', 'processado', 'aguardando_geracao'],
  aprovado: ['integrado', 'em_revisao', 'aguardando_geracao'],
  integrado: ['em_revisao'],
};
export function transicao(r: Registro, id: string, para: Estado, agora: () => string, nota?: string): Registro {
  const l = obter(r, id);
  if (l.estado === para) return r;
  if (!PERMITIDAS[l.estado].includes(para)) throw new Error(`transição inválida em "${id}": ${l.estado} → ${para} (permitido: ${PERMITIDAS[l.estado].join(', ') || 'nenhum'})`);
  return { ...r, lotes: r.lotes.map((x) => (x.id === id ? { ...x, estado: para, historico: [...x.historico, { estado: para, em: agora(), ...(nota ? { nota } : {}) }] } : x)) };
}
export const atualizar = (r: Registro, id: string, f: (l: RegistroLote) => RegistroLote): Registro => ({ ...r, lotes: r.lotes.map((x) => (x.id === id ? f(x) : x)) });

export const atingiuAprovacao = (l: RegistroLote) => ESTADOS.indexOf(l.estado) >= ESTADOS.indexOf('aprovado');
/** Dependências ainda não satisfeitas (um lote só libera os dependentes depois de aprovado/integrado). */
export function bloqueiosDe(plano: LotePlano, r: Registro): string[] {
  return plano.dependeDe.filter((d) => { const l = r.lotes.find((x) => x.id === d); return !l || !atingiuAprovacao(l); });
}

/** Etapa idempotente: só executa se a "chave" (hash das entradas) mudou ou se as saídas sumiram. */
export function etapaConcluida(l: RegistroLote, nome: string, chave: string, saidasExistem: boolean): boolean {
  return !!l.etapas[nome] && l.etapas[nome].chave === chave && saidasExistem;
}
export const marcarEtapa = (r: Registro, id: string, nome: string, chave: string, agora: () => string): Registro =>
  atualizar(r, id, (l) => ({ ...l, etapas: { ...l.etapas, [nome]: { em: agora(), chave } } }));
