// Camada de aplicação: orquestra planejar → prompt → receber/processar → revisar → aprovar → integrar, com registro e retomada.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import catalogJson from '../../../src/art/catalog.json';
import { guiaPng, guiaSvg, promptMarkdown, textoParaGemini } from './prompt';
import { atualizar, bloqueiosDe, carregarRegistro, etapaConcluida, marcarEtapa, obter, pastaLote, salvarRegistro, sha256, sincronizarComPlano, transicao, workDirPadrao } from './registry';
import { OPCOES_PADRAO, planejar, resumoPlano, type OpcoesPlano } from './planner';
import { processarPrancha, pastaSaida, type ResultadoProcesso } from './process';
import { integrar, montarProposta } from './integrar';
import { gerarRevisao } from './review';
import { processarCenario, processarIndividual } from './scenario';
import { lerRaw, type Raw } from './imaging';
import { resumirQa } from './qa';
import type { CatalogFile, LotePlano, Plano, Registro } from './types';

export interface Ambiente { workDir: string; publicDir: string; manifestoPath: string; catalogo: CatalogFile; agora: () => string; log: (s: string) => void; opcoes?: Partial<OpcoesPlano> }
export const ambientePadrao = (log: (s: string) => void = console.log): Ambiente => ({ workDir: workDirPadrao(), publicDir: 'public/art', manifestoPath: 'src/art/manifest.json', catalogo: catalogJson as unknown as CatalogFile, agora: () => new Date().toISOString(), log });

export const planoAtual = (a: Ambiente): Plano => planejar(a.catalogo, { ...OPCOES_PADRAO, ...a.opcoes });
export function carregar(a: Ambiente): { plano: Plano; registro: Registro } {
  const plano = planoAtual(a);
  const reg = sincronizarComPlano(carregarRegistro(a.workDir, a.opcoes?.pacote ?? OPCOES_PADRAO.pacote), plano.lotes, a.agora);
  return { plano, registro: reg };
}
export const lotePlano = (plano: Plano, id: string): LotePlano => {
  const l = plano.lotes.find((x) => x.id === id);
  if (!l) throw new Error(`lote desconhecido: ${id}. Veja os nomes com: npm run art:plan`);
  return l;
};
export const proximoLote = (plano: Plano, reg: Registro): LotePlano | undefined =>
  plano.lotes.find((l) => ['planejado', 'aguardando_geracao'].includes(obter(reg, l.id).estado) && !bloqueiosDe(l, reg).length);

/** Plano efetivamente combinado (o salvo em processamento.json prevalece sobre o recalculado). */
export function loteCombinado(a: Ambiente, plano: Plano, id: string): LotePlano {
  const f = join(pastaLote(a.workDir, id), 'processamento.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as { lote: LotePlano }).lote : lotePlano(plano, id);
}

// ------------------------------------------------------------------ plan
export function cmdPlan(a: Ambiente) {
  const { plano, registro } = carregar(a);
  salvarRegistro(a.workDir, registro);
  const linhas = plano.lotes.map((l) => { const r = obter(registro, l.id); return { ordem: l.ordem, id: l.id, titulo: l.titulo, tipo: l.tipo, prioridade: l.prioridade, recursos: l.ids.length, estado: r.estado, bloqueadoPor: bloqueiosDe(l, registro) }; });
  return { linhas, proximo: proximoLote(plano, registro)?.id ?? null, resumo: resumoPlano(plano), adiados: plano.adiados };
}

// ------------------------------------------------------------------ prompt
export async function cmdPrompt(a: Ambiente, id?: string) {
  let { plano, registro } = carregar(a);
  const lote = id ? lotePlano(plano, id) : proximoLote(plano, registro);
  if (!lote) throw new Error('nenhum lote disponível: todos estão em andamento ou bloqueados por dependências');
  const pasta = pastaLote(a.workDir, lote.id);
  mkdirSync(pasta, { recursive: true });
  const bloqueio = bloqueiosDe(lote, registro);
  const texto = textoParaGemini(lote);
  writeFileSync(join(pasta, 'processamento.json'), JSON.stringify({ versao: 1, lote }, null, 2) + '\n');
  writeFileSync(join(pasta, 'prompt.md'), promptMarkdown(lote));
  writeFileSync(join(pasta, 'prompt-gemini.txt'), texto + '\n');
  if (lote.folha) {
    writeFileSync(join(pasta, 'guia-prancha.png'), await guiaPng(lote.folha));
    writeFileSync(join(pasta, 'guia-prancha.svg'), guiaSvg(lote.folha).svg);
  }
  const chave = sha256(JSON.stringify(lote));
  registro = marcarEtapa(registro, lote.id, 'prompt', chave, a.agora);
  if (obter(registro, lote.id).estado === 'planejado') registro = transicao(registro, lote.id, 'aguardando_geracao', a.agora, 'prompt gerado');
  salvarRegistro(a.workDir, registro);
  return { lote, pasta, texto, bloqueio, arquivos: ['prompt.md', 'prompt-gemini.txt', 'processamento.json', ...(lote.folha ? ['guia-prancha.png', 'guia-prancha.svg'] : [])].map((f) => join(pasta, f)) };
}

// ------------------------------------------------------------------ process
async function localizarVizinhas(a: Ambiente, lote: LotePlano): Promise<{ acima?: Raw; abaixo?: Raw }> {
  const r = lote.cenario?.regiao;
  if (!r) return {};
  const achar = async (n: number) => {
    const rel = `map/region-${n}-bg@2x.webp`;
    for (const c of [join(a.publicDir, lote.pacote, rel), join(pastaSaida(pastaLote(a.workDir, `cenario-regiao-${n}`), lote.pacote), rel)]) if (existsSync(c)) return lerRaw(c);
    return undefined;
  };
  return { acima: r < 5 ? await achar(r + 1) : undefined, abaixo: r > 1 ? await achar(r - 1) : undefined };
}

const resultadoPath = (pasta: string) => join(pasta, 'resultado.json');
export async function cmdProcess(a: Ambiente, id: string | undefined, arquivo: string, op: { forcar?: boolean; tolerancia?: 'baixa' | 'media' | 'alta' } = {}) {
  if (!existsSync(arquivo)) throw new Error(`arquivo não encontrado: ${arquivo}`);
  let { plano, registro } = carregar(a);
  if (!id) {
    const aguardando = plano.lotes.filter((l) => obter(registro, l.id).estado === 'aguardando_geracao');
    if (aguardando.length !== 1) throw new Error(`informe o lote: npm run art:process -- <lote> ${arquivo} (aguardando geração: ${aguardando.map((l) => l.id).join(', ') || 'nenhum'})`);
    id = aguardando[0].id;
  }
  const lote = loteCombinado(a, plano, id);
  const pasta = pastaLote(a.workDir, id);
  mkdirSync(pasta, { recursive: true });
  if (!existsSync(join(pasta, 'processamento.json'))) writeFileSync(join(pasta, 'processamento.json'), JSON.stringify({ versao: 1, lote }, null, 2) + '\n');
  let l = obter(registro, id);
  if (['aprovado', 'integrado'].includes(l.estado) && !op.forcar) throw new Error(`lote ${id} já está ${l.estado}. Para refazer use --forcar (a aprovação é revogada).`);
  const bytes = readFileSync(arquivo);
  const sha = sha256(bytes);
  const recebidoDir = join(pasta, 'recebido');
  const destino = join(recebidoDir, `${sha.slice(0, 8)}-${basename(arquivo)}`); // o original é preservado, nunca sobrescrito
  mkdirSync(recebidoDir, { recursive: true });
  if (!existsSync(destino)) copyFileSync(arquivo, destino);
  const novaImagem = l.recebido?.sha256 !== sha;
  if (l.estado === 'planejado') registro = transicao(registro, id, 'aguardando_geracao', a.agora, 'processamento iniciado sem prompt');
  l = obter(registro, id);
  if (l.estado !== 'aguardando_geracao' && l.estado !== 'recebido' && novaImagem) registro = transicao(registro, id, 'aguardando_geracao', a.agora, op.forcar ? 'reprocessamento forçado' : 'nova imagem recebida');
  if (obter(registro, id).estado === 'aguardando_geracao') registro = transicao(registro, id, 'recebido', a.agora, basename(arquivo));
  const meta = await lerRaw(destino).then((r) => ({ w: r.width, h: r.height })).catch(() => { throw new Error('não foi possível ler a imagem (arquivo corrompido ou formato não suportado)'); });
  registro = atualizar(registro, id, (x) => ({ ...x, recebido: { arquivo: destino, sha256: sha, largura: meta.w, altura: meta.h, em: x.recebido?.sha256 === sha ? x.recebido.em : a.agora() } }));
  salvarRegistro(a.workDir, registro); // "recebido" fica gravado mesmo se o processamento for interrompido

  const chave = sha256([sha, JSON.stringify(lote), op.tolerancia ?? 'media', 'proc-v1'].join('|'));
  const esperados = montarProposta(lote).assets;
  const saidasExistem = existsSync(resultadoPath(pasta)) && Object.values(esperados).every((e) => existsSync(join(pastaSaida(pasta, lote.pacote), e.file)));
  let resultado: ResultadoProcesso;
  let pulou = false;
  if (!op.forcar && etapaConcluida(obter(registro, id), 'processar', chave, saidasExistem)) {
    a.log('Etapa de processamento já concluída para esta imagem — nada a refazer (use --forcar para refazer).');
    resultado = JSON.parse(readFileSync(resultadoPath(pasta), 'utf8')) as ResultadoProcesso;
    pulou = true;
  } else {
    a.log(`Processando ${id} (${lote.tipo}) a partir de ${basename(arquivo)} …`);
    if (lote.tipo === 'prancha') resultado = await processarPrancha({ pastaLote: pasta, lote, original: destino, tolerancia: op.tolerancia, log: a.log });
    else if (lote.tipo === 'cenario') resultado = await processarCenario({ pastaLote: pasta, lote, original: destino, log: a.log, vizinhas: await localizarVizinhas(a, lote) });
    else resultado = await processarIndividual({ pastaLote: pasta, lote, original: destino, log: a.log });
    writeFileSync(resultadoPath(pasta), JSON.stringify(resultado, null, 2) + '\n');
    writeFileSync(join(pasta, 'manifesto-proposta.json'), JSON.stringify(montarProposta(lote), null, 2) + '\n');
    registro = marcarEtapa(registro, id, 'processar', chave, a.agora);
  }
  registro = atualizar(registro, id, (x) => ({ ...x, qa: resumirQa(resultado.recursos), aprovacao: pulou ? x.aprovacao : Object.fromEntries(lote.ids.map((i) => [i, 'pendente' as const])) }));
  if (obter(registro, id).estado === 'recebido') registro = transicao(registro, id, 'processado', a.agora, `QA: ${JSON.stringify(resumirQa(resultado.recursos))}`);
  salvarRegistro(a.workDir, registro);
  return { lote, pasta, resultado, pulou, original: destino };
}

// ------------------------------------------------------------------ review
export async function cmdReview(a: Ambiente, id?: string) {
  let { plano, registro } = carregar(a);
  if (!id) {
    const c = plano.lotes.filter((l) => ['processado', 'em_revisao'].includes(obter(registro, l.id).estado));
    if (c.length !== 1) throw new Error(`informe o lote (processados/em revisão: ${c.map((l) => l.id).join(', ') || 'nenhum'})`);
    id = c[0].id;
  }
  const lote = loteCombinado(a, plano, id);
  const pasta = pastaLote(a.workDir, id);
  if (!existsSync(resultadoPath(pasta))) throw new Error(`lote ${id} ainda não foi processado: npm run art:process -- ${id} <arquivo>`);
  const resultado = JSON.parse(readFileSync(resultadoPath(pasta), 'utf8')) as ResultadoProcesso;
  const rev = await gerarRevisao(pasta, lote, resultado, obter(registro, id).recebido?.arquivo);
  if (obter(registro, id).estado === 'processado') registro = transicao(registro, id, 'em_revisao', a.agora, 'relatório gerado');
  salvarRegistro(a.workDir, registro);
  return { lote, resultado, rev, resumo: resumirQa(resultado.recursos) };
}

// ------------------------------------------------------------------ approve
export function cmdApprove(a: Ambiente, id: string, op: { todos?: boolean; ids?: string[]; rejeitar?: string[]; incluirFalhas?: boolean }) {
  let { plano, registro } = carregar(a);
  const lote = loteCombinado(a, plano, id);
  const pasta = pastaLote(a.workDir, id);
  const l = obter(registro, id);
  if (!['em_revisao', 'aprovado'].includes(l.estado)) throw new Error(`lote ${id} está "${l.estado}": só se aprova depois da revisão (npm run art:review -- ${id})`);
  const res = JSON.parse(readFileSync(resultadoPath(pasta), 'utf8')) as ResultadoProcesso;
  const falhas = new Set(res.recursos.filter((r) => r.status === 'falha').map((r) => r.id));
  const alvo = op.todos ? lote.ids.filter((i) => !(op.rejeitar ?? []).includes(i)) : (op.ids ?? []);
  for (const i of [...alvo, ...(op.rejeitar ?? [])]) if (!lote.ids.includes(i)) throw new Error(`recurso fora do lote ${id}: ${i}`);
  const bloqueados = alvo.filter((i) => falhas.has(i));
  if (bloqueados.length && !op.incluirFalhas) throw new Error(`recursos com FALHA técnica não podem ser aprovados: ${bloqueados.join(', ')} (reprocesse ou rejeite; --incluir-falhas ignora, com responsabilidade)`);
  registro = atualizar(registro, id, (x) => ({ ...x, aprovacao: { ...x.aprovacao, ...Object.fromEntries(alvo.map((i) => [i, 'aprovado' as const])), ...Object.fromEntries((op.rejeitar ?? []).map((i) => [i, 'rejeitado' as const])) } }));
  const ap = obter(registro, id).aprovacao;
  const todosAprovados = lote.ids.every((i) => ap[i] === 'aprovado');
  if (todosAprovados && obter(registro, id).estado === 'em_revisao') registro = transicao(registro, id, 'aprovado', a.agora, 'aprovação artística manual');
  if (!todosAprovados && obter(registro, id).estado === 'aprovado') registro = transicao(registro, id, 'em_revisao', a.agora, 'aprovação revogada em parte');
  salvarRegistro(a.workDir, registro);
  return { estado: obter(registro, id).estado, aprovacao: ap, pendentes: lote.ids.filter((i) => ap[i] === 'pendente'), rejeitados: lote.ids.filter((i) => ap[i] === 'rejeitado') };
}

// ------------------------------------------------------------------ integrate
export function cmdIntegrate(a: Ambiente, id: string, op: { confirmar?: boolean; ativar?: boolean }) {
  let { plano, registro } = carregar(a);
  const lote = loteCombinado(a, plano, id);
  const l = obter(registro, id);
  if (l.estado !== 'aprovado') throw new Error(`lote ${id} está "${l.estado}": só se integra um lote APROVADO`);
  const aprovados = new Set(lote.ids.filter((i) => l.aprovacao[i] === 'aprovado'));
  const proposta = montarProposta(lote, aprovados);
  if (!op.confirmar) return { simulacao: true, proposta, ok: true, erros: [] as string[], avisos: [] as string[], copiados: [] as string[] };
  const r = integrar({ pastaLote: pastaLote(a.workDir, id), lote, aprovados, manifestoPath: a.manifestoPath, publicDir: a.publicDir, catalogo: a.catalogo, ativar: op.ativar });
  if (r.ok) { registro = transicao(registro, id, 'integrado', a.agora, `copiados ${r.copiados.length} arquivo(s)${op.ativar ? '; pacote ativado' : ''}`); salvarRegistro(a.workDir, registro); }
  return { simulacao: false, proposta, ...r };
}

export function cmdReopen(a: Ambiente, id: string, nota = 'reaberto para nova geração') {
  let { registro } = carregar(a);
  registro = transicao(registro, id, 'aguardando_geracao', a.agora, nota);
  registro = atualizar(registro, id, (x) => ({ ...x, aprovacao: {}, etapas: Object.fromEntries(Object.entries(x.etapas).filter(([k]) => k === 'prompt')) }));
  salvarRegistro(a.workDir, registro);
  return obter(registro, id);
}
export function cmdStatus(a: Ambiente, id: string) {
  const { plano, registro } = carregar(a);
  const lote = loteCombinado(a, plano, id);
  return { lote, registro: obter(registro, id), bloqueadoPor: bloqueiosDe(lote, registro) };
}
