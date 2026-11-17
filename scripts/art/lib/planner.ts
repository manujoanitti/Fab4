// Planejador de lotes: lê o catálogo, agrupa recursos compatíveis em pranchas, separa o que exige geração individual,
// respeita dependências e declara o que fica adiado (e por quê). Puro e determinístico.
import { fracaoDaFolha, layoutFolha, proporcaoTexto } from './grid';
import { COR_REGIAO, FUNDOS, REFERENCIAS_FIXAS, REGIOES } from './style';
import type { Adiado, CatalogEntry, CatalogFile, Celula, Folha, LotePlano, Plano, Referencia, SaidaSpec } from './types';

export interface OpcoesPlano { pacote: string; maxPorFolha: number; biancaEstatica: boolean }
export const OPCOES_PADRAO: OpcoesPlano = { pacote: 'v1', maxPorFolha: 9, biancaEstatica: true };

/** Piloto definido pelo usuário: 6 elementos do mapa (marcos + início + faixa da Região 1). */
export const PILOTO_ID = 'piloto-marcos-regiao-1';
export const PILOTO_IDS = ['map.node.locked', 'map.node.available', 'map.node.done', 'map.node.selected', 'map.start', 'map.ribbon.1'];

const saidaDe = (e: CatalogEntry, opts: OpcoesPlano): SaidaSpec => {
  const raster = e.formats.includes('webp') ? 'webp' : 'png';
  const ehPersonagem = e.id.startsWith('char.');
  const base = ehPersonagem || e.id === 'map.start'; // objetos que "pisam" no chão alinham pela base
  const ancora = ehPersonagem ? { x: 0.5, y: 0.875 } : e.id === 'map.start' ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 };
  const sprite1 = e.kind === 'sprite' && opts.biancaEstatica;
  return {
    arquivo: `${e.stem}@2x.${raster}`, formato: raster,
    px: { w: e.sprite ? e.sprite.frameW : e.px.w, h: e.sprite ? e.sprite.frameH : e.px.h },
    alfa: e.transparent, alinhamento: base ? 'base' : 'centro', ancora,
    margemSeguranca: 0.1, maxKB: e.maxKB, dimMode: e.dimMode,
    ...(sprite1 && e.sprite ? { spriteUmQuadro: { frameW: e.sprite.frameW, frameH: e.sprite.frameH } } : {}),
  };
};

const regiaoDe = (id: string) => Number(id.match(/^map\.(?:region|ribbon)\.(\d)/)?.[1] ?? 0);

/** Texto visual por recurso (além da descrição do catálogo). */
export function dicaVisual(id: string): string {
  const r = regiaoDe(id);
  const mapa: Record<string, string> = {
    'map.node.locked': 'Marco de fase BLOQUEADA — medalhão circular APAGADO: lavanda-acinzentado dessaturado, aquarela quase seca; um pequeno cadeado delicado na parte inferior do medalhão. Centro calmo e livre para receber um número.',
    'map.node.available': 'Marco de fase DISPONÍVEL (a próxima) — medalhão circular VIVO e convidativo: rosa e dourado luminosos, pétalas ou pontos de luz sutis no próprio aro; o brilho fica DENTRO do contorno. Centro calmo e livre para receber um número.',
    'map.node.done': 'Marco de fase CONCLUÍDA — selo/medalhão DOURADO já conquistado: estrela ou flor de cinco pontas pintada ao centro, aro de ouro em aquarela, pequenas folhas. Mesmo tamanho e mesmo contorno dos outros dois medalhões.',
    'map.node.selected': 'Anel de seleção — anel FINO: aro de lápis de cor dourado-rosado com delicadas pétalas/folhas ao redor. Ocupa a célula do mesmo modo que os medalhões (o aumento relativo é aplicado depois, automaticamente). O vão central deve ser EXATAMENTE a cor de fundo (vazado).',
    'map.start': 'Marco "Início" — poste de madeira quente com uma placa VAZIA (sem letras) e uma trepadeira com flores pequenas; verde-oliva suave (nunca verde puro). A base do poste assenta no chão; sem sombra projetada.',
    'map.ribbon.1': `Faixa do título da Região 1 — fita horizontal de pontas onduladas na cor ${COR_REGIAO[0]} (Floresta dos Sonhos), textura de aquarela, pequenas flores nas extremidades. O centro fica VAZIO e liso (o texto será escrito depois).`,
  };
  if (mapa[id]) return mapa[id];
  if (id.startsWith('map.ribbon.')) return `Faixa/fita horizontal de pontas onduladas na cor ${COR_REGIAO[r - 1] ?? 'da região'} (${REGIOES[r - 1] ?? ''}), mesmo desenho da faixa da Região 1, centro vazio e liso.`;
  return '';
}

function celulasDaFolha(entries: CatalogEntry[], opts: OpcoesPlano, fundoHex: string): Folha {
  const itens = entries.map((e) => ({ id: e.id, proporcao: (e.sprite ? e.sprite.frameW / e.sprite.frameH : e.px.w / e.px.h) }));
  const lay = layoutFolha(itens);
  const fundo = FUNDOS.find((f) => f.hex === fundoHex) ?? FUNDOS[0];
  const porId = new Map(entries.map((e) => [e.id, e]));
  const celulas: Celula[] = lay.celulas.map((c, i) => {
    const e = porId.get(c.id)!;
    const dica = dicaVisual(e.id);
    // a direção visual específica (quando existe) substitui a descrição técnica do catálogo
    const limpa = e.desc.replace(/\s*\(substitui [^)]*\)\.?/, '.').replace(/\.\./g, '.').replace(/\s*\((overlay|o app)[^)]*\)/gi, '');
    return { id: e.id, ordem: i + 1, linha: c.linha, coluna: c.coluna, rect: fracaoDaFolha(c, lay.altura), descricao: dica || limpa, saida: saidaDe(e, opts) };
  });
  return { aspecto: lay.aspecto, largura: 1, fundo: fundo.hex, fundoNome: fundo.nome, margemSeguranca: 0.1, celulas, linhas: lay.linhas.map((l) => ({ y: l.y / lay.altura, celulas: l.ids })) };
}

const refEstilo = (): Referencia => ({ ...REFERENCIAS_FIXAS.estilo, obrigatoria: true });
const refGuia = (): Referencia => ({ arquivo: 'guia-prancha.png', obrigatoria: true, gerada: true, descricao: 'Guia de posições desta prancha (gerado; usar só como referência de posição)' });

function lotePrancha(id: string, titulo: string, entries: CatalogEntry[], ordem: number, dependeDe: string[], opts: OpcoesPlano, extras: Partial<LotePlano> & { fundo?: string; refs?: Referencia[] } = {}): LotePlano {
  const prioridade = entries.reduce((m, e) => (e.priority < m ? e.priority : m), 'P2' as 'P0' | 'P1' | 'P2');
  return {
    id, titulo, tipo: 'prancha', prioridade, lote: Math.min(...entries.map((e) => e.lot)), ordem, dependeDe, ids: entries.map((e) => e.id), pacote: opts.pacote,
    referencias: [refEstilo(), refGuia(), ...(extras.refs ?? [])], folha: celulasDaFolha(entries, opts, extras.fundo ?? '#00FF00'),
    observacoes: extras.observacoes ?? [],
  };
}

/** Empacota grupos do catálogo em pranchas de até `max` itens (primeiro-que-couber), dividindo de forma equilibrada os grupos maiores que `max`. */
export function empacotarGrupos(entries: CatalogEntry[], max: number): CatalogEntry[][] {
  const grupos: CatalogEntry[][] = [];
  for (const e of entries) { const g = grupos.find((x) => x[0].group === e.group); g ? g.push(e) : grupos.push([e]); }
  const folhas: CatalogEntry[][] = [];
  const colocar = (parte: CatalogEntry[]) => { const f = folhas.find((x) => x.length + parte.length <= max); f ? f.push(...parte) : folhas.push([...parte]); };
  for (const g of grupos) {
    if (g.length <= max) { colocar(g); continue; }
    const partes = Math.ceil(g.length / max), tam = Math.ceil(g.length / partes);
    for (let i = 0; i < g.length; i += tam) folhas.push(g.slice(i, i + tam)); // partes de um grupo grande ficam em pranchas próprias
  }
  return folhas;
}

export function planejar(cat: CatalogFile, opcoes: Partial<OpcoesPlano> = {}): Plano {
  const opts = { ...OPCOES_PADRAO, ...opcoes };
  const todos = cat.catalog;
  const por = new Map(todos.map((e) => [e.id, e]));
  const usados = new Set<string>();
  const pegar = (ids: string[]) => ids.map((id) => { const e = por.get(id); if (!e) throw new Error(`catálogo sem ${id}`); usados.add(id); return e; });
  const lotes: LotePlano[] = [];
  const adiados: Adiado[] = [];
  const adiar = (ids: string[], motivo: string) => ids.forEach((id) => { if (!usados.has(id)) { usados.add(id); adiados.push({ id, motivo }); } });
  let ordem = 0;

  // 1) Piloto (marcos do mapa da Região 1)
  lotes.push(lotePrancha(PILOTO_ID, 'Piloto — marcos do mapa e faixa da Região 1', pegar(PILOTO_IDS), ++ordem, [], opts, {
    fundo: '#00FF00',
    observacoes: ['Define a família de formas dos marcos do mapa (referência para os demais lotes).', 'O número da casa, o nome da região e o texto "Início" são desenhados pelo app: nada de texto nas imagens.'],
  }));

  // 2) Cenários (um por região) — o app continua desenhando trilha e marcos por cima
  for (let r = 1; r <= 5; r++) {
    const ids = [`map.region.${r}.bg`, ...(r === 1 ? ['map.bottom.bg'] : []), ...(r === 5 ? ['map.top.bg'] : [])];
    const es = pegar(ids);
    const partes: NonNullable<LotePlano['cenario']>['partes'] = [];
    const comTopo = r === 5, comBase = r === 1;
    let y = 0;
    for (const id of [...(comTopo ? ['map.top.bg'] : []), `map.region.${r}.bg`, ...(comBase ? ['map.bottom.bg'] : [])]) {
      const e = por.get(id)!;
      partes.push({ id, arquivo: `${e.stem}@2x.webp`, y, h: e.px.h, formato: 'webp', maxKB: e.maxKB });
      y += e.px.h;
    }
    lotes.push({
      id: `cenario-regiao-${r}`, titulo: `Cenário da Região ${r} — ${REGIOES[r - 1]}`, tipo: 'cenario', prioridade: es[0].priority, lote: es[0].lot, ordem: ++ordem,
      dependeDe: r === 1 ? [] : [`cenario-regiao-${r - 1}`], ids, pacote: opts.pacote,
      referencias: [refEstilo(), { ...REFERENCIAS_FIXAS.layout(r), descricao: `Layout de referência da Região ${r} (opcional: use se você tiver)`, obrigatoria: false }, { arquivo: `docs/arte/guias/regiao-${r}.png`, obrigatoria: true, descricao: 'Guia de layout com a posição real das 5 casas, o corredor da trilha e as zonas livres' }],
      cenario: { regiao: r, comBase, comTopo, px: { w: 800, h: y }, partes },
      observacoes: ['Entrega o cenário como camada de FUNDO: a trilha, as casas, a faixa e o véu continuam sendo desenhados pelo app.', 'A arte NÃO deve conter trilha, casas, números nem texto; deixe livres o corredor e os círculos das casas.'],
    });
  }

  // 3) Bianca (estática inicialmente)
  if (opts.biancaEstatica) {
    lotes.push(lotePrancha('bianca-estatica', 'Bianca — imagem estática (idle)', pegar(['char.bianca.idle']), ++ordem, [], opts, {
      fundo: '#00FF00',
      refs: [{ ...REFERENCIAS_FIXAS.bianca, obrigatoria: true }],
      observacoes: ['Quadro único (sprite de 1 quadro); pés apoiados na base do quadro. Animação (walk/celebrate) fica para uma etapa posterior.'],
    }));
    adiar(['char.bianca.walk', 'char.bianca.celebrate'], 'Animação adiada: a Bianca começa estática (quadro único em char.bianca.idle).');
  } else {
    for (const id of ['char.bianca.idle', 'char.bianca.walk', 'char.bianca.celebrate']) lotes.push(lotePrancha(`bianca-${id.split('.').pop()}`, `Bianca — ${id.split('.').pop()}`, pegar([id]), ++ordem, [], opts, { refs: [{ ...REFERENCIAS_FIXAS.bianca, obrigatoria: true }] }));
  }

  // 4) Ícones da interface (pranchas)
  const icones = todos.filter((e) => /^ui\.(icon|brand|tab|status|sync)\./.test(e.id) && !usados.has(e.id));
  empacotarGrupos(icones, opts.maxPorFolha).forEach((es, i) => {
    pegar(es.map((e) => e.id));
    lotes.push(lotePrancha(`icones-ui-${i + 1}`, `Ícones da interface ${i + 1} — ${[...new Set(es.map((e) => e.group.replace('UI · ', '')))].join(' + ')}`, es, ++ordem, [PILOTO_ID], opts, { fundo: i % 2 ? '#FF00FF' : '#00FF00' }));
  });

  // 5) Faixas das regiões 2–5 e bônus
  lotes.push(lotePrancha('faixas-regioes-2-5', 'Faixas das regiões 2 a 5', pegar([2, 3, 4, 5].map((r) => `map.ribbon.${r}`)), ++ordem, [PILOTO_ID], opts, { fundo: '#00FF00', observacoes: ['Mesmo desenho da faixa da Região 1 (aprovada no piloto), mudando só a cor de cada região.'] }));
  lotes.push(lotePrancha('bonus-final', 'Bônus final (fechado e conquistado)', pegar(['map.bonus.locked', 'map.bonus.unlocked']), ++ordem, [PILOTO_ID], opts, { fundo: '#00FFFF' }));

  // 6) Minigames
  const jogos = todos.filter((e) => e.id.startsWith('game.') && !/\.bg$/.test(e.id) && !usados.has(e.id));
  const porLote = (n: number) => jogos.filter((e) => (n === 6 ? e.lot <= 6 : e.lot === n));
  [6, 7].forEach((n) => empacotarGrupos(porLote(n), opts.maxPorFolha).forEach((es, i) => {
    pegar(es.map((e) => e.id));
    lotes.push(lotePrancha(`jogos-l${n}-${i + 1}`, `Minigames ${n === 6 ? '(Estrelas e Memória)' : '(Jardim)'} ${i + 1} — ${[...new Set(es.map((e) => e.group.replace(/^Minigames? · /, '')))].join(' + ')}`, es, ++ordem, [PILOTO_ID], opts, { fundo: n === 7 ? '#FF00FF' : '#00FF00' }));
  }));

  // 7) Fundos individuais (geração própria, exatos)
  for (const id of ['game.stars.bg', 'game.garden.bg', 'ui.bg.app', 'ui.bg.topbar', 'ui.button.primary', 'ui.panel.sheet']) {
    const e = pegar([id])[0];
    const g = Math.round((e.px.w / e.px.h) * 1000) / 1000;
    const asp = ([[1, 1], [4, 3], [3, 4], [16, 9], [9, 16]] as Array<[number, number]>).reduce((b, a) => (Math.abs(a[0] / a[1] - g) < Math.abs(b[0] / b[1] - g) ? a : b));
    lotes.push({
      id: `fundo-${id.replace(/\./g, '-')}`, titulo: `Fundo — ${id}`, tipo: 'individual', prioridade: e.priority, lote: e.lot, ordem: ++ordem, dependeDe: [PILOTO_ID], ids: [id], pacote: opts.pacote,
      referencias: [refEstilo()], individual: { id, arquivo: `${e.stem}@2x.webp`, px: e.px, formato: 'webp', maxKB: e.maxKB, aspecto: asp }, observacoes: [e.desc],
    });
  }

  // 8) Efeitos e celebrações
  lotes.push(lotePrancha('efeitos-brilho', 'Efeito — brilho mágico', pegar(['fx.sparkle']), ++ordem, [PILOTO_ID], opts, { fundo: '#00FFFF' }));
  lotes.push(lotePrancha('celebracoes', 'Celebrações (etapa e reino)', pegar(['ui.celebration.stage', 'ui.celebration.final']), ++ordem, [PILOTO_ID], opts, { fundo: '#00FFFF' }));

  // 9) Adiados (com motivo)
  adiar(todos.filter((e) => /^map\.region\.\d\.(mid|path|fg)$/.test(e.id)).map((e) => e.id), 'Camadas adiadas: uma ilustração raster não se separa de forma confiável em camadas. O cenário entra como fundo e o app continua desenhando a trilha e os marcos.');
  adiar(['map.fog'], 'Véu semitransparente: exige método próprio (luminância→alfa) ou manter o véu desenhado pelo app.');
  adiar(['fx.node.complete'], 'Animação adiada (sprites de efeito só depois da arte estática aprovada).');
  adiar(todos.filter((e) => /^map\.node\.\d\./.test(e.id)).map((e) => e.id), 'Variantes opcionais por região: só depois da aprovação dos marcos genéricos.');
  const faltando = todos.filter((e) => !usados.has(e.id)).map((e) => e.id);
  if (faltando.length) throw new Error(`planejador: recursos sem destino: ${faltando.join(', ')}`);
  return { lotes, adiados };
}

export const resumoPlano = (p: Plano) => ({
  lotes: p.lotes.length,
  pranchas: p.lotes.filter((l) => l.tipo === 'prancha').length,
  cenarios: p.lotes.filter((l) => l.tipo === 'cenario').length,
  individuais: p.lotes.filter((l) => l.tipo === 'individual').length,
  recursosEmLotes: p.lotes.reduce((s, l) => s + l.ids.length, 0),
  adiados: p.adiados.length,
});
export const textoAspecto = (l: LotePlano) => (l.folha ? proporcaoTexto(l.folha.aspecto) : '');
