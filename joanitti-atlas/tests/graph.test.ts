import { describe, expect, it } from 'vitest';
import { buildGraph, lineageIds, type GPerson, type GRel, type GraphInput } from '../shared/graph';
import { layoutGraph } from '../shared/layout';

const P = (id: string, nuc = 'n1'): GPerson => ({ id, name: id, status: 'documentado', nucleusIds: [nuc] });
const R = (a: string, b: string, status: any = 'documentado', type: any = 'filiacao'): GRel => ({ id: `${type}-${a}-${b}`, type, a, b, status });
const base = (over: Partial<GraphInput>): GraphInput => ({ persons: [], rels: [], groups: [], hyps: [], ...over });
const ids = (g: ReturnType<typeof buildGraph>) => g.nodes.filter((n) => n.type === 'person').map((n) => n.id).sort();

describe('grafo da árvore — regras de integridade visual', () => {
  it('agrupamento investigativo não gera arestas de parentesco entre os membros', () => {
    const g = buildGraph(base({ persons: ['a', 'b', 'c'].map((x) => P(x)), groups: [{ id: 'g', name: 'índice', memberIds: ['a', 'b', 'c'] }] }));
    expect(g.edges).toHaveLength(0); expect(g.nodes.filter((n) => n.type === 'group')).toHaveLength(1); expect(g.nodes.filter((n) => n.parentId === 'grp:g')).toHaveLength(3);
  });
  it('filiação desconhecida: pessoa sem genitores aparece como raiz, sem inventar vínculo', () => {
    const g = buildGraph(base({ persons: [P('filho'), P('outro')], rels: [] }));
    expect(g.edges).toHaveLength(0); expect(ids(g)).toEqual(['p:filho', 'p:outro']);
  });
  it('relação descartada não é desenhada', () => {
    const g = buildGraph(base({ persons: [P('a'), P('b')], rels: [R('a', 'b', 'descartado')] }));
    expect(g.edges).toHaveLength(0);
  });
  it('estilo da aresta segue o estado (contínua/tracejada/pontilhada) e há um nó de união por casal', () => {
    const g = buildGraph(base({ persons: ['p', 'm', 'f', 'h'].map((x) => P(x)), rels: [R('p', 'm', 'documentado', 'casamento'), R('p', 'f', 'documentado'), R('m', 'f', 'hipotese_plausivel'), R('p', 'h', 'nao_confirmado')] }));
    expect(g.stats.unions).toBe(1);
    const toF = g.edges.find((e) => e.target === 'p:f' && e.kind === 'filiation')!;
    expect(toF.source.startsWith('u:')).toBe(true); expect(toF.status).toBe('hipotese_plausivel'); // elo mais fraco
    expect(g.edges.find((e) => e.target === 'p:h')!.status).toBe('nao_confirmado');
  });
  it('relação de natureza desconhecida vira aresta "kin", nunca filiação/cônjuge', () => {
    const g = buildGraph(base({ persons: [P('a'), P('b')], rels: [R('a', 'b', 'hipotese_plausivel', 'parentesco_inferido')] }));
    expect(g.edges.map((e) => e.kind)).toEqual(['kin']);
  });
  it('hipóteses entram como nós próprios (tracejados), não como parentesco', () => {
    const g = buildGraph(base({ persons: [P('a'), P('b'), P('c')], hyps: [{ id: 'h', code: 'H3', label: 'x', status: 'hipotese_plausivel', personIds: ['a', 'b'] }] }), { showHypotheses: true });
    expect(g.nodes.some((n) => n.type === 'hypothesis')).toBe(true); expect(g.edges.every((e) => e.kind === 'hypothesis')).toBe(true);
    expect(buildGraph(base({ persons: [P('a'), P('b')], hyps: [{ id: 'h', label: 'x', status: 'descartado', personIds: ['a', 'b'] }] }), { showHypotheses: true }).nodes.some((n) => n.type === 'hypothesis')).toBe(false);
  });
  it('múltiplos núcleos sem conexão: filtro por núcleo isola e o layout os separa', async () => {
    const input = base({ persons: [P('a1', 'A'), P('a2', 'A'), P('b1', 'B'), P('b2', 'B')], rels: [R('a1', 'a2'), R('b1', 'b2')] });
    expect(ids(buildGraph(input, { nucleusId: 'A' }))).toEqual(['p:a1', 'p:a2']);
    const all = buildGraph(input); const lay = await layoutGraph(all, 'DOWN');
    expect(Object.keys(lay.positions)).toHaveLength(4);
    const boxes = ['p:a1', 'p:b1'].map((i) => lay.positions[i]); expect(boxes[0]).not.toEqual(boxes[1]);
  });
});

describe('gerações: foco, expandir/recolher, linhagem', () => {
  // avô → pai → filho → neto; tio (irmão do pai) e primo
  const input = base({ persons: ['avo', 'pai', 'tio', 'filho', 'neto', 'primo'].map((x) => P(x)), rels: [R('avo', 'pai'), R('avo', 'tio'), R('pai', 'filho'), R('filho', 'neto'), R('tio', 'primo')] });
  it('ancestrais e descendentes a partir de um foco, limitados por gerações', () => {
    expect(ids(buildGraph(input, { focusId: 'filho', mode: 'ancestors', depth: 1 }))).toEqual(['p:filho', 'p:pai']);
    expect(ids(buildGraph(input, { focusId: 'filho', mode: 'ancestors' }))).toEqual(['p:avo', 'p:filho', 'p:pai']);
    expect(ids(buildGraph(input, { focusId: 'pai', mode: 'descendants' }))).toEqual(['p:filho', 'p:neto', 'p:pai']);
    expect(ids(buildGraph(input, { focusId: 'filho', mode: 'both', depth: 1 }))).toEqual(['p:filho', 'p:neto', 'p:pai']);
  });
  it('recolher oculta apenas os descendentes exclusivos e informa quantos', () => {
    const g = buildGraph(input, { collapsed: new Set(['pai']) });
    expect(ids(g)).toEqual(['p:avo', 'p:pai', 'p:primo', 'p:tio']); expect(g.stats.hiddenByCollapse).toBe(2);
    expect(g.nodes.find((n) => n.id === 'p:pai')!.data.hiddenDescendants).toBe(2);
    expect(ids(buildGraph(input, { collapsed: new Set() })).length).toBe(6); // expandir
  });
  it('quem tem outro genitor visível não some ao recolher um dos genitores', () => {
    const inp = base({ persons: ['a', 'b', 'c'].map((x) => P(x)), rels: [R('a', 'c'), R('b', 'c')] });
    expect(ids(buildGraph(inp, { collapsed: new Set(['a']) }))).toContain('p:c');
  });
  it('linhagem = pessoa + ancestrais + descendentes (sem colaterais)', () => {
    const l = lineageIds(input.rels, 'pai'); expect([...l].sort()).toEqual(['avo', 'filho', 'neto', 'pai']);
  });
});

function bigTree(generations: number, kids = 3) {
  const persons: GPerson[] = [], rels: GRel[] = []; let n = 0;
  const couple = (gen: number): string => {
    const a = `p${n++}`, b = `p${n++}`; persons.push(P(a), P(b)); rels.push(R(a, b, 'documentado', 'casamento'));
    if (gen < generations) for (let k = 0; k < kids; k++) { const c = couple(gen + 1); const first = c; rels.push(R(a, first), R(b, first)); }
    return a;
  };
  couple(1); return base({ persons, rels });
}

describe('desempenho em árvores extensas', () => {
  it('constrói o grafo de ~2.200 pessoas rapidamente e recolher reduz o grafo', () => {
    const input = bigTree(7); expect(input.persons.length).toBeGreaterThan(2000);
    const t0 = performance.now(); const g = buildGraph(input); const dt = performance.now() - t0;
    expect(g.stats.persons).toBe(input.persons.length); expect(dt).toBeLessThan(2500);
    const root = input.persons[0].id; const small = buildGraph(input, { collapsed: new Set([root]) });
    expect(small.stats.persons).toBeLessThan(g.stats.persons / 2);
  });
  it('posiciona automaticamente (ELK) ~700 pessoas em tempo razoável', async () => {
    const g = buildGraph(bigTree(6)); expect(g.stats.persons).toBeGreaterThan(600);
    const t0 = performance.now(); const lay = await layoutGraph(g, 'DOWN'); const dt = performance.now() - t0;
    expect(Object.keys(lay.positions).length).toBe(g.nodes.length); expect(dt).toBeLessThan(25000);
  }, 60000);
});

import { autoCollapse } from '../shared/graph';
describe('árvores muito extensas: recolhimento automático', () => {
  it('mantém árvores pequenas intactas', () => {
    const r = autoCollapse(bigTree(3), {}, 500); expect(r.generations).toBeNull(); expect(r.collapsed.size).toBe(0);
  });
  it('recolhe gerações profundas até caber no limite, sem perder a raiz, e permite expandir', () => {
    const input = bigTree(7); const r = autoCollapse(input, {}, 500);
    expect(r.generations).toBeGreaterThanOrEqual(1); const g = buildGraph(input, { collapsed: r.collapsed });
    expect(g.stats.persons).toBeLessThanOrEqual(500); expect(g.stats.persons).toBeGreaterThan(20); expect(g.stats.hiddenByCollapse).toBeGreaterThan(1000);
    expect(buildGraph(input, { collapsed: new Set() }).stats.persons).toBe(input.persons.length); // "expandir tudo"
  });
  it('árvore com foco de poucas gerações não é recolhida', () => {
    expect(autoCollapse(bigTree(7), { focusId: 'p0', mode: 'descendants', depth: 2 }, 500).generations).toBeNull();
  });
});
