// Pacote de produção dos lotes restantes (pranchas e imagens individuais): prompts, guias e manifestos em ordem de execução,
// e processamento em lote das imagens entregues (sem aprovar nem integrar).
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { cmdProcess, cmdPrompt, cmdReview, lotePlano, planoAtual, type Ambiente } from './executar';
import { montarProposta } from './integrar';
import { sha256 } from './registry';

export const PRODUCAO_DIR = 'art-work/pacote-producao';
export const ENTRADA_PRODUCAO = 'art-work/entrada-producao';
/** Ordem de execução: Bianca → ícones essenciais → faixas 2–5 → bônus → minigames → refinamentos. */
export const ORDEM_PRODUCAO = [
  'bianca-estatica', 'icones-ui-1', 'icones-ui-3', 'faixas-regioes-2-5', 'bonus-final',
  'jogos-l6-1', 'jogos-l6-2', 'jogos-l7-1', 'jogos-l7-2', 'fundo-game-stars-bg', 'fundo-game-garden-bg',
  'icones-ui-2', 'icones-ui-4', 'fundo-ui-bg-app', 'fundo-ui-bg-topbar', 'fundo-ui-button-primary', 'fundo-ui-panel-sheet', 'efeitos-brilho', 'celebracoes',
];
/** Referências aprovadas já no repositório que devem acompanhar certos lotes (convertidas em PNG sobre a cor de fundo do lote). */
const REFERENCIAS_EXTRAS: Record<string, Array<{ de: string; nome: string; descricao: string }>> = {
  'faixas-regioes-2-5': [{ de: 'public/art/v1/map/ribbon-1@2x.webp', nome: 'faixa-regiao-1-aprovada.png', descricao: 'faixa aprovada da Região 1 (mesmo desenho; muda só a cor)' }],
};
const EXT = ['png', 'jpg', 'jpeg', 'webp'];
const nn = (i: number) => String(i).padStart(2, '0');

export async function cmdProducaoPacote(a: Ambiente, raiz = PRODUCAO_DIR) {
  const plano = planoAtual(a);
  const esperados = plano.lotes.filter((l) => l.id !== 'piloto-marcos-regiao-1' && l.tipo !== 'cenario').map((l) => l.id).sort();
  if (JSON.stringify([...ORDEM_PRODUCAO].sort()) !== JSON.stringify(esperados)) throw new Error(`ORDEM_PRODUCAO não cobre exatamente os lotes restantes (esperado: ${esperados.join(', ')})`);
  const comum = join(raiz, '00-anexos-comuns');
  mkdirSync(comum, { recursive: true });
  copyFileSync('art-work/referencias/folha-de-estilo.png', join(comum, 'folha-de-estilo.png'));
  const passos: Array<Record<string, unknown>> = [];
  const dependencias = new Set<string>();
  for (const [i, id] of ORDEM_PRODUCAO.entries()) {
    const p = await cmdPrompt(a, id);
    const lote = lotePlano(plano, id);
    const dir = join(raiz, `${nn(i + 1)}-${id}`);
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(p.pasta, 'prompt-gemini.txt'), join(dir, 'prompt.txt'));
    const temGuia = !!lote.folha;
    if (temGuia) copyFileSync(join(p.pasta, 'guia-prancha.png'), join(dir, 'guia-prancha.png'));
    copyFileSync(join(p.pasta, 'processamento.json'), join(dir, 'manifesto-processamento.json'));
    writeFileSync(join(dir, 'manifesto-proposta.json'), JSON.stringify(montarProposta(lote), null, 2) + '\n');
    const anexos: string[] = [join(comum, 'folha-de-estilo.png')];
    const faltando: string[] = [];
    for (const r of lote.referencias) {
      if (r.gerada || r.arquivo.endsWith('folha-de-estilo.png')) continue;
      if (existsSync(r.arquivo)) { const dest = join(dir, r.arquivo.split('/').pop()!); copyFileSync(r.arquivo, dest); anexos.push(dest); }
      else if (r.obrigatoria) { faltando.push(r.arquivo); dependencias.add(r.arquivo); }
    }
    for (const x of REFERENCIAS_EXTRAS[id] ?? []) {
      if (!existsSync(x.de)) { faltando.push(x.de); continue; }
      const fundo = lote.folha?.fundo ?? '#FFFFFF';
      await sharp(x.de).flatten({ background: fundo }).png().toFile(join(dir, x.nome));
      anexos.push(join(dir, x.nome));
    }
    if (temGuia) anexos.push(join(dir, 'guia-prancha.png'));
    passos.push({
      ordem: i + 1, lote: id, titulo: lote.titulo, tipo: lote.tipo, prioridade: lote.prioridade, recursos: lote.ids.length, pasta: dir,
      prompt: join(dir, 'prompt.txt'), guia: temGuia ? join(dir, 'guia-prancha.png') : null, anexos, dependenciasFaltando: faltando,
      proporcao: lote.folha ? `${lote.folha.aspecto[0]}:${lote.folha.aspecto[1]}` : lote.individual ? `${lote.individual.aspecto[0]}:${lote.individual.aspecto[1]}` : null,
      fundo: lote.folha?.fundo ?? null, salvarComo: `${ENTRADA_PRODUCAO}/${id}.png`, sha256Prompt: sha256(p.texto),
    });
  }
  writeFileSync(join(raiz, 'pacote.json'), JSON.stringify({ versao: 1, tipo: 'producao-restante', entrada: ENTRADA_PRODUCAO, dependencias: [...dependencias], passos }, null, 2) + '\n');
  writeFileSync(join(raiz, 'LEIA-ME.md'), leiaMe(passos, [...dependencias]));
  return { raiz, passos, dependencias: [...dependencias] };
}

function leiaMe(passos: Array<Record<string, unknown>>, dependencias: string[]): string {
  const L: string[] = [];
  L.push('# Produção gráfica restante — pacote para o Gemini', '',
    `${passos.length} imagens-base (pranchas e imagens individuais), em ordem de prioridade. Geração **manual** (sem API paga), em sequência, sem voltar ao Claude entre elas.`, '');
  if (dependencias.length) L.push('## ⚠️ Dependência', '', ...dependencias.map((d) => `- Falta \`${d}\` (necessária para o passo da Bianca). **Não bloqueia os demais**: gere os outros passos e deixe a Bianca para quando tiver o arquivo (ou anexe o modelo direto no chat do Gemini, sem salvá-lo no repositório).`), '');
  L.push('## Como gerar', '',
    '1. Abra **um chat novo** do Gemini e use-o para todos os passos (mantém traço e paleta). Peça sempre a **maior resolução** e a **proporção indicada no prompt**.',
    '2. Para cada passo, na ordem da tabela: anexe os arquivos indicados (a folha de estilo e, nas pranchas, o `guia-prancha.png`), cole o `prompt.txt` e gere.',
    '3. **Confira antes de salvar:** (pranchas) cada elemento dentro da sua célula, fundo chapado liso, nenhum texto, nada tocando a borda; (individuais) sem texto nem molduras. Se falhar, peça de novo.',
    '4. Salve cada imagem (PNG/JPG, maior resolução) com o nome da coluna "Salvar como". O guia serve só de referência de posição: não deve aparecer linha ou número na imagem final.', '',
    '## Sequência', '', '| # | Lote | Recursos | Prio | Proporção | Fundo | Anexar | Colar | Salvar como |', '|---|---|---|---|---|---|---|---|---|');
  for (const p of passos) {
    const dir = String(p.pasta).split('/').pop();
    const anexos = (p.anexos as string[]).map((x) => `\`${x.replace(/^art-work\/pacote-producao\//, '')}\``).join(' + ');
    L.push(`| ${p.ordem} | \`${p.lote}\`${(p.dependenciasFaltando as string[]).length ? ' ⚠️ modelo-bianca' : ''} | ${p.recursos} | ${p.prioridade} | ${p.proporcao ?? '—'} | ${p.fundo ?? '—'} | ${anexos} | \`${dir}/prompt.txt\` | \`${String(p.salvarComo).split('/').pop()}\` |`);
  }
  L.push('', '## Entrega', '',
    `1. Coloque as imagens em \`${ENTRADA_PRODUCAO}/\` (nomes da última coluna; pode ser .png/.jpg/.webp). Pode entregar só parte: as ausentes são apenas sinalizadas.`,
    '2. Diga ao Claude: **"Produção entregue"**. Ele roda `npm run art:producao -- processar`, gera os relatórios e **espera a sua aprovação** antes de integrar.', '',
    '## Arquivos de cada passo', '', '- `prompt.txt`: texto para colar.', '- `guia-prancha.png`: posição das células (só referência).',
    '- `manifesto-processamento.json`: geometria usada no recorte automático (não editar).', '- `manifesto-proposta.json`: arquivos finais e nomes oficiais que o passo vai gerar.');
  return L.join('\n') + '\n';
}

export function imagensEntregues(dir = ENTRADA_PRODUCAO): Array<{ lote: string; arquivo?: string }> {
  const ls = existsSync(dir) ? readdirSync(dir) : [];
  return ORDEM_PRODUCAO.map((lote) => ({ lote, arquivo: ls.map((n) => n).find((n) => EXT.some((e) => n.toLowerCase() === `${lote}.${e}`)) }))
    .map((x) => ({ lote: x.lote, arquivo: x.arquivo ? join(dir, x.arquivo) : undefined }));
}

export async function cmdProducaoProcessar(a: Ambiente, dir = ENTRADA_PRODUCAO, op: { forcar?: boolean } = {}) {
  const out: Array<{ lote: string; presente: boolean; resumo?: { ok: number; revisar: number; falha: number }; relatorio?: string }> = [];
  for (const it of imagensEntregues(dir)) {
    if (!it.arquivo) { out.push({ lote: it.lote, presente: false }); continue; }
    await cmdProcess(a, it.lote, it.arquivo, { forcar: op.forcar });
    const rv = await cmdReview(a, it.lote);
    out.push({ lote: it.lote, presente: true, resumo: rv.resumo, relatorio: rv.rev.relatorioHtml });
  }
  return out;
}
