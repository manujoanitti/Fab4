// Gera docs/arte/INVENTARIO_GRAFICO.md cruzando catálogo × plano × registro × manifesto × arquivos reais do repositório.
// Uso: npm run art:inventario   (somente leitura do estado; só escreve o documento)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ambientePadrao, carregar } from './lib/executar';
import { pastaLote } from './lib/registry';
import type { CatalogEntry } from './lib/types';

const a = ambientePadrao(() => {});
const { plano, registro } = carregar(a);
const catalogo = a.catalogo.catalog as CatalogEntry[];
const manifest = JSON.parse(readFileSync(a.manifestoPath, 'utf8')) as { activePack: string | null; packs: Record<string, { dir: string; assets: Record<string, { file: string }> }> };
const loteDe = new Map<string, string>();
for (const l of plano.lotes) for (const id of l.ids) loteDe.set(id, l.id);
const adiado = new Map(plano.adiados.map((d) => [d.id, d.motivo]));
const regLote = (id: string) => registro.lotes.find((x) => x.id === id)!;
const ORDEM = ['planejado', 'aguardando_geracao', 'recebido', 'processado', 'em_revisao', 'aprovado', 'integrado'];
const alcancou = (lote: string, est: string) => ORDEM.indexOf(regLote(lote).estado) >= ORDEM.indexOf(est);
const motivoCurto = (m: string) => m.startsWith('Camadas') ? 'camadas (cenário entra como fundo único)' : m.startsWith('Variantes') ? 'variante por região (após marcos genéricos)' : m.startsWith('Animação adiada: a Bianca') ? 'animação da Bianca (começa estática)' : m.startsWith('Véu') ? 'véu: método próprio ou mantido pelo app' : m.startsWith('Animação') ? 'sprite de efeito (após arte estática)' : m;
const guiaPacote = (id: string) => { const m = /^cenario-regiao-(\d)$/.exec(id); return m ? existsSync(`art-work/pacote-cenarios/0${m[1]}-regiao-${m[1]}/guia-regiao-${m[1]}.png`) : false; };
const temPromptGuia = (lote: string) => {
  const p = pastaLote(a.workDir, lote);
  const individual = !!plano.lotes.find((l) => l.id === lote)?.individual; // imagem única: não há grade de posições, logo não há guia
  return existsSync(join(p, 'prompt-gemini.txt')) && (individual || existsSync(join(p, 'guia-prancha.png')) || guiaPacote(lote));
};
const integrado = (id: string) => { const p = manifest.packs[manifest.activePack ?? '']; return !!p?.assets[id] && existsSync(join(a.publicDir, p.dir, p.assets[id].file)); };
const faltas = (lote: string) => plano.lotes.find((l) => l.id === lote)!.referencias.filter((r) => r.obrigatoria && !r.gerada && !existsSync(r.arquivo)).map((r) => r.arquivo);
const sn = (b: boolean) => (b ? 'sim' : 'não');
const esc = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const resumo = (s: string, n = 110) => { const t = esc(s); return t.length > n ? t.slice(0, n - 1).replace(/[ ,;:.]+\S*$/, '') + '…' : t; };

interface Linha { id: string; conj: string; desc: string; prio: string; rec: boolean; proc: boolean; apr: boolean; integ: boolean; pg: boolean; prox: string; lote: string | null }
const linhas: Linha[] = catalogo.map((e) => {
  const lote = loteDe.get(e.id) ?? null;
  const ad = adiado.get(e.id);
  const rec = !!lote && alcancou(lote, 'recebido') && !!regLote(lote).recebido;
  const proc = !!lote && alcancou(lote, 'processado');
  const apr = !!lote && regLote(lote).aprovacao[e.id] === 'aprovado';
  const integ = integrado(e.id);
  let prox: string;
  if (integ) prox = 'Concluído — não refazer';
  else if (ad) prox = `Adiado: ${motivoCurto(ad)}`;
  else if (!lote) prox = '⚠️ sem lote';
  else {
    const f = faltas(lote), est = regLote(lote).estado;
    prox = est === 'planejado' ? `Gerar prompt/guia e imagem-base (${lote})` : est === 'aguardando_geracao' ? `Gerar imagem-base no Gemini (${lote})` : `Avançar ${lote} (${est})`;
    if (f.length) prox += ` — falta ${f.map((x) => x.split('/').pop()).join(', ')}`;
  }
  return { id: e.id, conj: e.group, desc: resumo(e.desc), prio: e.priority, rec, proc, apr, integ, pg: !!lote && temPromptGuia(lote), prox, lote };
});

const n = linhas.length, nInt = linhas.filter((l) => l.integ).length, nAd = linhas.filter((l) => !l.lote).length;
const emLotes = linhas.filter((l) => l.lote).length;
const lotes = plano.lotes;
const baseRecebidas = lotes.filter((l) => !!regLote(l.id).recebido);
const baseNecessarias = lotes.length - baseRecebidas.length;
const prontosPrompt = lotes.filter((l) => temPromptGuia(l.id));
const porPrio = (p: string) => linhas.filter((l) => l.prio === p);
const out: string[] = [];
out.push('# Inventário gráfico do Reino da Bianca', '',
  '> Gerado por `npm run art:inventario` a partir do estado real do repositório (catálogo × plano × `art-work/registro.json` × manifesto × arquivos). **Não edite à mão**: regenere.',
  '> **Imagem-base** = a imagem que o Gemini gera (prancha, cenário ou imagem individual). **Recurso** = cada arquivo final extraído dela. As colunas "recebida/processada/aprovada" de um recurso refletem o estado da imagem-base do seu lote.', '');
out.push('## 1. Resumo', '',
  '| Indicador | Valor |', '|---|---|',
  `| Recursos previstos (catálogo) | **${n}** |`,
  `| Integrados ao app (\`public/art/${manifest.activePack}\`) | **${nInt}** |`,
  `| Pendentes | **${n - nInt}** (${emLotes - nInt} em lotes planejados + ${nAd} adiados) |`,
  `| Imagens-base planejadas (lotes) | ${lotes.length} (${lotes.filter((l) => l.tipo === 'prancha').length} pranchas, ${lotes.filter((l) => l.tipo === 'cenario').length} cenários, ${lotes.filter((l) => l.tipo === 'individual').length} individuais) |`,
  `| Imagens-base já recebidas do Gemini | **${baseRecebidas.length}** (${baseRecebidas.map((l) => `\`${l.id}\``).join(', ')}) |`,
  `| Imagens-base ainda necessárias | **${baseNecessarias}** |`,
  `| Lotes com prompt e guia prontos | ${prontosPrompt.length} (${prontosPrompt.map((l) => `\`${l.id}\``).join(', ')}) |`,
  `| Prioridade P0 / P1 / P2 (recursos) | ${porPrio('P0').length} / ${porPrio('P1').length} / ${porPrio('P2').length} — integrados: ${porPrio('P0').filter((l) => l.integ).length} / ${porPrio('P1').filter((l) => l.integ).length} / ${porPrio('P2').filter((l) => l.integ).length} |`, '');

out.push('## 2. Tabela única de recursos', '',
  'Prioridade visual: P0 = essencial para o visual do app; P1 = importante; P2 = refinamento. "Prompt e guia" = existem prompt do Gemini **e** guia de posição já preparados para o lote do recurso.', '',
  '| ID | Região / conjunto | Descrição | Prio | Recebida? | Processada? | Aprovada? | Integrada? | Prompt e guia? | Próxima ação |', '|---|---|---|---|---|---|---|---|---|---|');
for (const l of linhas) out.push(`| \`${l.id}\` | ${esc(l.conj)} | ${l.desc} | ${l.prio} | ${sn(l.rec)} | ${sn(l.proc)} | ${sn(l.apr)} | ${sn(l.integ)} | ${sn(l.pg)} | ${esc(l.prox)} |`);

out.push('', '## 3. Lotes (imagens-base)', '',
  '| # | Lote | Tipo | Recursos | Prio | Estado | Prompt e guia | Pré-requisito que falta |', '|---|---|---|---|---|---|---|---|');
for (const l of lotes) out.push(`| ${l.ordem} | \`${l.id}\` | ${l.tipo} | ${l.ids.length} | ${l.prioridade} | ${regLote(l.id).estado} | ${sn(temPromptGuia(l.id))} | ${faltas(l.id).map((x) => `\`${x}\``).join(', ') || '—'} |`);
out.push('', '## 4. Diagnóstico', '',
  `- **Concluídos:** ${nInt} recursos (piloto \`piloto-marcos-regiao-1\`): 4 estados de casa, anel de seleção, marco Início e faixa da Região 1. Não refazer.`,
  `- **Pranchas que rendem vários recursos:** ${lotes.filter((l) => l.tipo === 'prancha').map((l) => `\`${l.id}\` (${l.ids.length})`).join(', ')}.`,
  `- **Cenários:** 5 imagens-base (uma por região) → 7 recursos (\`map.region.N.bg\`, \`map.bottom.bg\`, \`map.top.bg\`). São o maior ganho visual por geração e já têm prompt e guia.`,
  `- **Imagens individuais** (1 imagem = 1 recurso): ${lotes.filter((l) => l.tipo === 'individual').map((l) => `\`${l.id}\``).join(', ')} — fundos de minigames e de interface; baixo risco, podem esperar.`,
  `- **Adiados (${nAd}) sem prejuízo à experiência:** 15 marcos por região (os genéricos aprovados já cobrem todas as regiões), 15 camadas extras do mapa (\`mid\`/\`path\`/\`fg\`: o cenário entra como fundo e o app desenha trilha e casas), 3 animações (Bianca andando/comemorando e brilho de conclusão) e o véu de região bloqueada (o app mantém o véu atual).`,
  '- **Bloqueio conhecido:** `bianca-estatica` exige `art-work/referencias/modelo-bianca.png` (ainda não recebido). Os layouts `layout-regiao-N.png` são opcionais.',
  '- **Pendências não bloqueantes do piloto:** marco Início próximo da fase 1.1; possível distorção da textura da faixa; adequar as faixas das demais regiões (lote `faixas-regioes-2-5`).', '');

out.push('## 5. Plano de produção (minimiza gerações e intervenções)', '',
  'Ordem por impacto visual. "Sessão" = um bloco de gerações no Gemini sem voltar ao Claude entre elas; depois entrega-se tudo de uma vez.', '',
  '| Sessão | Lotes | Imagens-base | Recursos | Por quê | Pré-requisito |', '|---|---|---|---|---|---|',
  '| A | `cenario-regiao-1` … `cenario-regiao-5` | 5 | 7 | Troca o fundo do mapa inteiro (maior efeito visual). Pacote pronto em `art-work/pacote-cenarios/`. | — |',
  '| B | `icones-ui-1`, `icones-ui-3` | 2 | 15 | Todos os ícones P0 (moedas, selos, navegação principal). | — |',
  '| C | `bianca-estatica` | 1 | 1 | A personagem é o centro do mapa. | **modelo-bianca.png** (você envia) |',
  '| D | `faixas-regioes-2-5`, `bonus-final` | 2 | 6 | Completa as faixas (usa a mesma técnica de fatias) e o prêmio final. | Piloto aprovado ✅ |',
  '| E | `icones-ui-2`, `jogos-l6-1`, `jogos-l6-2` | 3 | 19 | Estados das metas e minigame Cristais. | — |',
  '| F | `jogos-l7-1`, `jogos-l7-2`, `fundo-game-stars-bg`, `fundo-game-garden-bg` | 4 | 14 | Minigames restantes e seus fundos. | — |',
  '| G | `icones-ui-4`, `fundo-ui-*` (4), `efeitos-brilho`, `celebracoes` | 7 | 14 | Refinamentos P2. | — |', '',
  '### Próximos cinco lotes recomendados', '',
  '1. **Cenários das 5 regiões** (`cenario-regiao-1` … `5`) — 5 imagens, 7 recursos; pacote pronto.',
  '2. **`icones-ui-1`** (P0, 6 recursos).',
  '3. **`icones-ui-3`** (P0, 9 recursos).',
  '4. **`bianca-estatica`** (P0, 1 recurso) — depende do modelo da Bianca.',
  '5. **`faixas-regioes-2-5`** (P1, 4 recursos) — resolve a pendência das faixas.', '',
  '> **Pacotes prontos (prompts, guias e manifestos):** cenários em `art-work/pacote-cenarios/` (5 imagens) e demais lotes em `art-work/pacote-producao/` (19 imagens, com a ordem de execução no `LEIA-ME.md`). Dependência: `art-work/referencias/modelo-bianca.png` (só afeta `bianca-estatica`).',
  '', `> **Entregas ao repositório:** imagens dos cenários em \`art-work/entrada-cenarios/\` — ${existsSync('art-work/entrada-cenarios') ? 'presentes' : '**ainda não entregues**'}; imagens dos demais lotes em \`art-work/entrada-producao/\` — ${existsSync('art-work/entrada-producao') ? 'presentes' : '**ainda não entregues**'}. O estado "recebido" só é registrado quando o arquivo chega ao repositório e é processado (\`npm run art:cenarios -- processar\`, \`npm run art:producao -- processar\`).`);
writeFileSync('docs/arte/INVENTARIO_GRAFICO.md', out.join('\n') + '\n');
console.log(`inventário: ${n} recursos · ${nInt} integrados · ${n - nInt} pendentes · bases recebidas ${baseRecebidas.length}/${lotes.length}`);
