// Gera o prompt do Gemini, a lista de anexos e o guia visual de posições de cada prancha. Puro (texto) + guia via sharp.
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { EVITAR, IDENTIDADE } from './style';
import { orientacaoTexto, proporcaoTexto } from './grid';
import type { Folha, LotePlano, Referencia } from './types';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const nomeProporcao = (w: number, h: number) => { const r = w / h; return r > 3 ? 'faixa muito larga' : r > 1.3 ? 'larga' : r < 0.77 ? 'alta' : 'quadrada'; };

/** Texto exato da estrutura da prancha (linhas, colunas, células) — fonte única, usada no prompt e na documentação. */
export function descreverEstrutura(f: Folha): string[] {
  const linhas: string[] = [];
  f.linhas.forEach((l, i) => {
    const cels = l.celulas.map((id) => f.celulas.find((c) => c.id === id)!);
    linhas.push(`Linha ${i + 1} (de cima para baixo) — ${cels.length} ${cels.length === 1 ? 'célula' : 'células'}, da esquerda para a direita:`);
    cels.forEach((c) => {
      const prop = c.saida.px.w / c.saida.px.h;
      linhas.push(`  ${c.ordem}. [célula ${nomeProporcao(c.saida.px.w, c.saida.px.h)}, proporção ${prop.toFixed(2).replace(/\.00$/, '')}:1] ${c.descricao}`);
    });
  });
  return linhas;
}

/** Descrição geométrica das faixas (linhas) e áreas, derivada dos mesmos retângulos usados no guia e no processamento. */
export function descreverFaixas(f: Folha): string[] {
  const nomes = ['superior', 'do meio', 'inferior'];
  const n = f.linhas.length;
  const P = (v: number) => `${Math.round(v * 100)}%`;
  const out: string[] = [`A imagem tem ${n} ${n === 1 ? 'faixa horizontal' : 'faixas horizontais'} empilhadas (de cima para baixo), com fundo livre entre elas. Posições em % da largura (x) e da altura (y) da imagem, medidas a partir do canto superior esquerdo:`];
  f.linhas.forEach((l, i) => {
    const cels = l.celulas.map((id) => f.celulas.find((c) => c.id === id)!);
    const y0 = Math.min(...cels.map((c) => c.rect.y)), y1 = Math.max(...cels.map((c) => c.rect.y + c.rect.h));
    const nome = n === 3 ? nomes[i] : `${i + 1}ª`;
    const centrada = cels.length === 1 && Math.abs(cels[0].rect.x + cels[0].rect.w / 2 - 0.5) < 0.01;
    out.push(`- FAIXA ${i + 1} (${nome}), y de ${P(y0)} a ${P(y1)}: ${cels.length} ${cels.length === 1 ? 'área' : 'áreas'}${cels.length > 1 ? ' lado a lado, igualmente espaçadas' : centrada ? ', centralizada horizontalmente' : ''}.`);
    cels.forEach((c) => out.push(`    · área ${c.ordem}: x de ${P(c.rect.x)} a ${P(c.rect.x + c.rect.w)}, y de ${P(c.rect.y)} a ${P(c.rect.y + c.rect.h)}`));
  });
  out.push('- Todo o espaço fora dessas áreas é fundo chapado vazio.');
  return out;
}

export function anexos(lote: LotePlano, existe: (arq: string) => boolean = existsSync): Array<Referencia & { presente: boolean | null }> {
  return lote.referencias.map((r) => ({ ...r, presente: r.gerada ? null : existe(r.arquivo) }));
}

export function textoParaGemini(lote: LotePlano): string {
  const L: string[] = [];
  const f = lote.folha;
  const identidade = IDENTIDADE.map((x) => `- ${x}`).join('\n');
  const evitar = EVITAR.map((x) => `- ${x}`).join('\n');
  if (f) {
    const n = f.celulas.length;
    L.push(`Gere UMA ÚNICA IMAGEM, em formato ${proporcaoTexto(f.aspecto)} (${orientacaoTexto(f.aspecto)}), na MAIOR resolução disponível: uma prancha de produção com ${n} ${n === 1 ? 'elemento ilustrado' : 'elementos ilustrados'} para um jogo infantil que parece um livro de contos.`);
    L.push('', 'IDENTIDADE ARTÍSTICA (siga a folha de estilo anexa — mesmo traço, mesma paleta, mesma atmosfera):', identidade, '', 'EVITE:', evitar);
    L.push('', `ESTRUTURA DA PRANCHA (siga o guia de posições anexo; use-o SOMENTE como referência de posição — não reproduza linhas, cruzes, marcas nem números):`);
    L.push(`- Fundo: uma única cor chapada e uniforme, ${f.fundo} (${f.fundoNome}), em TODA a imagem, sem textura, sem gradiente, sem vinheta e sem sombra projetada no fundo.`);
    L.push(`- A prancha tem ${n} ${n === 1 ? 'área de conteúdo' : 'áreas de conteúdo'} distribuídas em ${f.linhas.length} ${f.linhas.length === 1 ? 'faixa horizontal' : 'faixas horizontais'} (cada área é uma “célula”). Cada área contém UM único elemento, centralizado, com folga livre de pelo menos ${pct(f.margemSeguranca)} do tamanho da célula em todos os lados.`);
    L.push('', ...descreverFaixas(f), '');
    L.push('- Nenhum elemento toca a borda da célula nem da imagem; nenhum elemento se sobrepõe a outro; cada elemento aparece por inteiro, sem cortes.');
    L.push('- NENHUM texto, letra, número, legenda, título, moldura, linha de grade ou marca d\'água em lugar algum da imagem.');
    L.push('', 'CONTEÚDO DAS CÉLULAS:', ...descreverEstrutura(f));
    L.push('', 'REGRAS PARA O RECORTE POSTERIOR (importantes):',
      `- Contornos nítidos e limpos contra o fundo; sem brilho difuso, halos, fumaça ou luz que extravase para fora do contorno (qualquer brilho fica dentro do próprio elemento).`,
      `- NÃO use a cor do fundo (${f.fundo}) nem tons próximos dela dentro dos elementos.`,
      '- Elementos vazados (anéis, molduras): o vão interno deve ser EXATAMENTE a cor do fundo.',
      '- Mantenha a mesma escala e o mesmo estilo entre os elementos da prancha.');
    if (f.celulas.some((c) => c.saida.alinhamento === 'base')) L.push('- Elementos que pisam no chão (poste, personagem): a base/os pés ficam na parte inferior da célula, sem sombra no chão.');
    L.push('', 'Responda somente com a imagem.');
  } else if (lote.tipo === 'cenario' && lote.cenario) {
    const c = lote.cenario;
    const asp: [number, number] = [c.px.w, c.px.h];
    L.push(`Gere UMA ÚNICA ILUSTRAÇÃO de cenário, em formato retrato (proporção próxima de ${c.px.w}:${c.px.h}), na MAIOR resolução disponível: o cenário da Região ${c.regiao} de um jogo infantil que parece um livro de contos.`);
    L.push('', 'IDENTIDADE ARTÍSTICA (siga a folha de estilo anexa):', identidade, '', 'EVITE:', evitar);
    L.push('', 'COMPOSIÇÃO (siga o layout de referência e o guia anexos):',
      '- O cenário é o FUNDO do mapa. NÃO desenhe trilha, caminho, casas, círculos, números, faixas, placas nem texto: o aplicativo desenha tudo isso por cima.',
      '- Mantenha LIVRE e calmo (sem objetos grandes nem contrastes fortes) o corredor sinuoso e os 5 círculos marcados no guia; decoração só nas laterais e no fundo.',
      '- Iluminação suave vinda de cima, à esquerda. Bordas superior e inferior devem poder continuar nas regiões vizinhas (sem moldura, sem corte abrupto de cor).',
      `- Proporção final aproximada ${asp[0]}:${asp[1]}${c.comBase ? '; a parte inferior (cerca de 20% da altura) é a área de partida do jogo' : ''}${c.comTopo ? '; a parte superior (cerca de 20% da altura) é o horizonte do final do reino' : ''}.`);
    L.push('', 'Responda somente com a imagem.');
  } else if (lote.individual) {
    const i = lote.individual;
    L.push(`Gere UMA ÚNICA IMAGEM em formato ${proporcaoTexto(i.aspecto)}, na MAIOR resolução disponível: ${lote.observacoes[0] ?? lote.titulo}`);
    L.push('', 'IDENTIDADE ARTÍSTICA (siga a folha de estilo anexa):', identidade, '', 'EVITE:', evitar, '', '- Sem texto, letras, números, molduras ou elementos de interface. Composição calma, com o centro pouco carregado (o app coloca conteúdo por cima).', '', 'Responda somente com a imagem.');
  }
  return L.join('\n');
}

export function promptMarkdown(lote: LotePlano, existe: (arq: string) => boolean = existsSync): string {
  const A = anexos(lote, existe);
  const f = lote.folha;
  const L: string[] = [];
  L.push(`# ${lote.titulo}`, '', `- **Lote:** \`${lote.id}\` · prioridade ${lote.prioridade} · recursos: ${lote.ids.length}`);
  if (f) L.push(`- **Prancha:** proporção **${proporcaoTexto(f.aspecto)}**, fundo **${f.fundo}** (${f.fundoNome}), ${f.linhas.length} linha(s), ${f.celulas.length} célula(s)`);
  if (lote.dependeDe.length) L.push(`- **Depende de (aprovados antes):** ${lote.dependeDe.map((d) => `\`${d}\``).join(', ')}`);
  L.push('', '## 1. Anexe estes arquivos ao Gemini', '');
  for (const a of A) L.push(`- ${a.obrigatoria ? '**Obrigatório**' : 'Recomendado'} — \`${a.arquivo}\` — ${a.descricao}${a.gerada ? ' (gerado junto com este prompt, na pasta do lote)' : a.presente ? ' ✅ presente' : ' ⚠️ AINDA NÃO ENVIADO'}`);
  L.push('', '## 2. Cole este prompt no Gemini', '', '````text', textoParaGemini(lote), '````', '', '## 3. Depois de gerar', '',
    f ? `1. Escolha a melhor imagem (a prancha deve respeitar a grade e o fundo ${f.fundo}). Se vier torta, com texto ou com elementos tocando a borda, peça novamente.` : '1. Escolha a melhor imagem.',
    `2. Salve o arquivo (PNG ou JPG, maior resolução possível) e entregue com: \`npm run art:process -- ${lote.id} caminho/do/arquivo.png\``,
    `3. Confira o relatório com \`npm run art:review -- ${lote.id}\` (abre \`revisao/relatorio.html\`).`);
  if (lote.observacoes.length) L.push('', '## Observações', '', ...lote.observacoes.map((o) => `- ${o}`));
  return L.join('\n') + '\n';
}

/** Guia visual de posições (PNG/SVG): cor do fundo, contornos pontilhados das células e uma cruz central. Sem texto/números. */
export function guiaSvg(f: Folha, largura = 1024): { svg: string; largura: number; altura: number } {
  const altura = Math.round(largura * (f.aspecto[1] / f.aspecto[0]));
  const partes = f.celulas.map((c) => {
    const x = c.rect.x * largura, y = c.rect.y * altura, w = c.rect.w * largura, h = c.rect.h * altura;
    const m = f.margemSeguranca;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 10" opacity=".9"/>` +
      `<rect x="${(x + w * m).toFixed(1)}" y="${(y + h * m).toFixed(1)}" width="${(w * (1 - 2 * m)).toFixed(1)}" height="${(h * (1 - 2 * m)).toFixed(1)}" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 8" opacity=".55"/>` +
      `<path d="M${(x + w / 2 - 10).toFixed(1)},${(y + h / 2).toFixed(1)}h20M${(x + w / 2).toFixed(1)},${(y + h / 2 - 10).toFixed(1)}v20" stroke="#fff" stroke-width="2" opacity=".8"/>`;
  }).join('');
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}"><rect width="100%" height="100%" fill="${f.fundo}"/>${partes}</svg>`, largura, altura };
}
export async function guiaPng(f: Folha, largura = 1024): Promise<Buffer> {
  return sharp(Buffer.from(guiaSvg(f, largura).svg)).png().toBuffer();
}
