// Pacote de produção dos cenários das 5 regiões: tudo que o Gemini precisa, em ordem, numa única pasta,
// e o processamento em lote das 5 imagens entregues (sem aprovar nem integrar nada).
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cmdProcess, cmdPrompt, cmdReview, lotePlano, planoAtual, type Ambiente } from './executar';
import { montarProposta } from './integrar';
import { REGIOES } from './style';
import { sha256 } from './registry';

export const PACOTE_DIR = 'art-work/pacote-cenarios';
export const ENTRADA_DIR = 'art-work/entrada-cenarios';
const EXT = ['png', 'jpg', 'jpeg', 'webp'];
const nn = (r: number) => String(r).padStart(2, '0');
export const arquivoEsperado = (r: number) => `regiao-${r}.png`;

export async function cmdCenariosPacote(a: Ambiente, raiz = PACOTE_DIR) {
  const plano = planoAtual(a);
  const comum = join(raiz, '00-anexos-comuns');
  mkdirSync(comum, { recursive: true });
  const estilo = 'art-work/referencias/folha-de-estilo.png';
  if (!existsSync(estilo)) throw new Error(`falta ${estilo}`);
  copyFileSync(estilo, join(comum, 'folha-de-estilo.png'));
  const passos: Array<Record<string, unknown>> = [];
  for (let r = 1; r <= 5; r++) {
    const id = `cenario-regiao-${r}`;
    const guia = `docs/arte/guias/regiao-${r}.png`;
    if (!existsSync(guia)) throw new Error(`falta ${guia} (rode npm run art:guides)`);
    const p = await cmdPrompt(a, id);
    const lote = lotePlano(plano, id);
    const dir = join(raiz, `${nn(r)}-regiao-${r}`);
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(p.pasta, 'prompt-gemini.txt'), join(dir, 'prompt.txt'));
    copyFileSync(guia, join(dir, `guia-regiao-${r}.png`));
    const proposta = JSON.stringify(montarProposta(lote), null, 2) + '\n';
    writeFileSync(join(dir, 'manifesto-proposta.json'), proposta);
    writeFileSync(join(p.pasta, 'manifesto-proposta.json'), proposta);
    passos.push({
      ordem: r, lote: id, regiao: REGIOES[r - 1], pasta: dir,
      prompt: join(dir, 'prompt.txt'), guia: join(dir, `guia-regiao-${r}.png`), anexos: [join(comum, 'folha-de-estilo.png'), join(dir, `guia-regiao-${r}.png`)],
      proporcao: `${lote.cenario!.px.w}:${lote.cenario!.px.h}`, arquivoFinal: `${lote.cenario!.px.w}x${lote.cenario!.px.h}`, recursos: lote.ids,
      salvarComo: `${ENTRADA_DIR}/${arquivoEsperado(r)}`, sha256Prompt: sha256(p.texto),
    });
  }
  writeFileSync(join(raiz, 'pacote.json'), JSON.stringify({ versao: 1, tipo: 'cenarios-5-regioes', entrada: ENTRADA_DIR, passos }, null, 2) + '\n');
  writeFileSync(join(raiz, 'LEIA-ME.md'), leiaMe(passos));
  return { raiz, passos };
}

function leiaMe(passos: Array<Record<string, unknown>>): string {
  const L: string[] = [];
  L.push('# Cenários das 5 regiões — pacote de produção (Gemini)', '',
    'Tudo o que você precisa para gerar as 5 imagens **numa única sessão**, sem voltar ao Claude entre elas. Nada aqui usa API paga: você gera manualmente no Gemini.', '',
    '## Antes de começar', '',
    '- Use **um único chat novo** do Gemini para as 5 imagens (ele mantém o traço e a paleta entre elas). Peça sempre a **maior resolução** disponível.',
    '- Siga a ordem **1 → 5** (a Região 1 é a de baixo do mapa; a 5, a do topo).',
    '- Em **cada passo**: anexe os 2 arquivos indicados, cole o prompt (`prompt.txt`) e gere. Se a imagem vier com trilha, casas, texto ou moldura, ou com o estilo diferente, peça de novo (ou cole: "Refaça sem trilha, casas ou texto, mantendo o mesmo estilo").',
    '- A partir do passo 2, se o estilo se afastar da Região 1, **anexe também a imagem da Região 1 já aprovada** e acrescente ao prompt: "Mantenha exatamente o mesmo traço, textura e paleta desta imagem".',
    '- O layout de referência de cada região (`layout-regiao-N.png`) é **opcional**: o guia da região já basta.', '',
    '## Sequência', '', '| # | Região | Anexar (2 arquivos) | Colar | Salvar como | Proporção |', '|---|---|---|---|---|---|');
  for (const p of passos) L.push(`| ${p.ordem} | ${p.regiao} | \`00-anexos-comuns/folha-de-estilo.png\` + \`${String(p.pasta).split('/').pop()}/guia-regiao-${p.ordem}.png\` | \`${String(p.pasta).split('/').pop()}/prompt.txt\` | \`${arquivoEsperado(Number(p.ordem))}\` | ${p.proporcao} |`);
  L.push('', '## Entrega das 5 imagens', '',
    `1. Salve as 5 imagens (PNG ou JPG, na maior resolução) na pasta \`${ENTRADA_DIR}/\` com os nomes \`regiao-1.png\` … \`regiao-5.png\` (a extensão pode ser .jpg/.webp).`,
    '2. Volte ao Claude e diga: **"Cenários entregues"**. Ele processa as cinco (`npm run art:cenarios -- processar`), gera o relatório e a prévia no mapa real e **espera a sua aprovação** antes de integrar qualquer coisa.',
    '3. Se faltar alguma imagem, o processamento segue com as presentes e avisa quais faltam.', '',
    '## Arquivos de cada passo', '',
    '- `prompt.txt`: texto para colar no Gemini.', '- `guia-regiao-N.png`: posição das 5 casas e do corredor da trilha (use só como referência de posição).',
    '- `manifesto-proposta.json`: arquivos finais que cada imagem vai gerar (nomes e proporções); não precisa abrir.', '- `pacote.json`: o mesmo, em formato de máquina.');
  return L.join('\n') + '\n';
}

export function imagensEntregues(a: Ambiente, dir = ENTRADA_DIR): Array<{ regiao: number; arquivo?: string }> {
  void a;
  const ls = existsSync(dir) ? readdirSync(dir) : [];
  return [1, 2, 3, 4, 5].map((r) => {
    const f = ls.find((n) => EXT.some((e) => n.toLowerCase() === `regiao-${r}.${e}`));
    return { regiao: r, arquivo: f ? join(dir, f) : undefined };
  });
}

/** Processa (e gera o relatório de) todas as imagens entregues, em ordem 1→5 (as vizinhas alimentam a checagem de continuidade). */
export async function cmdCenariosProcessar(a: Ambiente, dir = ENTRADA_DIR, op: { forcar?: boolean } = {}) {
  const itens = imagensEntregues(a, dir);
  const out: Array<{ regiao: number; lote: string; presente: boolean; resumo?: { ok: number; revisar: number; falha: number }; relatorio?: string }> = [];
  for (const it of itens) {
    const lote = `cenario-regiao-${it.regiao}`;
    if (!it.arquivo) { out.push({ regiao: it.regiao, lote, presente: false }); continue; }
    await cmdProcess(a, lote, it.arquivo, { forcar: op.forcar });
    const rv = await cmdReview(a, lote);
    out.push({ regiao: it.regiao, lote, presente: true, resumo: rv.resumo, relatorio: rv.rev.relatorioHtml });
  }
  return out;
}
