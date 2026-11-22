// Construção PURA do grafo da árvore (sem layout): pessoas, uniões, grupos investigativos e nós de hipótese.
// Regras de integridade visual:
//  * Relação descartada nunca é desenhada como parentesco.
//  * Pessoas de um grupo investigativo NÃO ganham arestas de filiação/casamento entre si.
//  * Hipóteses ligam-se por nós próprios (tracejado), nunca por arestas de parentesco.
import { weakest, type RelType, type Status } from './types';
import { ancestorsOf, descendantsOf, type RelLite } from './integrity';

export interface GPerson {
  id: string; name: string; birth?: string | null; death?: string | null; origin?: string | null;
  status: Status; avatar?: string | null; nucleusIds: string[]; redacted?: boolean; living?: boolean;
}
export interface GRel { id: string; type: RelType; subtype?: string | null; a: string; b: string; status: Status }
export interface GGroup { id: string; name: string; nucleusId?: string | null; memberIds: string[] }
export interface GHyp { id: string; code?: string | null; label: string; status: Status; personIds: string[] }
export interface GraphInput { persons: GPerson[]; rels: GRel[]; groups: GGroup[]; hyps: GHyp[] }

export interface GraphOptions {
  nucleusId?: string | null;
  focusId?: string | null;
  mode?: 'all' | 'ancestors' | 'descendants' | 'both';
  depth?: number;
  collapsed?: Set<string>;
  showHypotheses?: boolean;
  showGroups?: boolean;
}

export type NodeKind = 'person' | 'union' | 'group' | 'hypothesis';
export interface FlowNode {
  id: string; type: NodeKind; parentId?: string; width: number; height: number;
  data: Record<string, any>;
  /** posição relativa ao grupo (apenas para membros de grupo) */
  rel?: { x: number; y: number };
}
export interface FlowEdge {
  id: string; source: string; target: string; kind: 'filiation' | 'spouse' | 'kin' | 'hypothesis';
  status: Status; label?: string; relId?: string; relType?: RelType;
}
export interface BuiltGraph {
  nodes: FlowNode[]; edges: FlowEdge[];
  stats: { persons: number; hiddenByCollapse: number; unions: number; groups: number };
}

export const PERSON_W = 208, PERSON_H = 76, UNION = 14, HYP_W = 150, HYP_H = 46;
const GROUP_PAD = 14, GROUP_HEAD = 46, GROUP_GAP = 12;

const REL_NAME: Record<string, string> = {
  casamento: 'casamento', uniao: 'união', parentesco_inferido: 'parentesco (natureza inferida)', desconhecida: 'vínculo de natureza desconhecida',
};

export function buildGraph(input: GraphInput, opts: GraphOptions = {}): BuiltGraph {
  const { nucleusId = null, focusId = null, mode = 'all', depth = 99, showHypotheses = false, showGroups = true } = opts;
  const collapsed = opts.collapsed ?? new Set<string>();

  let persons = input.persons;
  if (nucleusId) persons = persons.filter((p) => p.nucleusIds.includes(nucleusId));
  const personIds = new Set(persons.map((p) => p.id));
  const rels = input.rels.filter((r) => r.status !== 'descartado' && personIds.has(r.a) && personIds.has(r.b));
  const rl: RelLite[] = rels.map((r) => ({ id: r.id, type: r.type, a: r.a, b: r.b, status: r.status }));

  // 1) conjunto S (foco / gerações)
  let S = new Set(personIds);
  if (focusId && personIds.has(focusId)) {
    S = new Set([focusId]);
    if (mode === 'ancestors' || mode === 'both') for (const x of ancestorsOf(rl, focusId, depth)) if (personIds.has(x)) S.add(x);
    if (mode === 'descendants' || mode === 'both') for (const x of descendantsOf(rl, focusId, depth)) if (personIds.has(x)) S.add(x);
    if (mode === 'all') S = new Set(personIds);
    // cônjuges/parceiros dos incluídos, para não quebrar casais
    for (const r of rels) if ((r.type === 'casamento' || r.type === 'uniao') && (S.has(r.a) !== S.has(r.b))) { S.add(r.a); S.add(r.b); }
  }

  // 2) recolhimento de gerações
  const parentsOf = new Map<string, string[]>(), childrenOf = new Map<string, string[]>();
  for (const r of rels) if (r.type === 'filiacao' && S.has(r.a) && S.has(r.b)) {
    (parentsOf.get(r.b) ?? parentsOf.set(r.b, []).get(r.b)!).push(r.a);
    (childrenOf.get(r.a) ?? childrenOf.set(r.a, []).get(r.a)!).push(r.b);
  }
  // cônjuges/parceiros: o casal recolhe junto; quem não tem pais e casou com alguém que tem ("casado de fora") só aparece com o parceiro
  const spouses = new Map<string, string[]>();
  for (const r of rels) if ((r.type === 'casamento' || r.type === 'uniao') && S.has(r.a) && S.has(r.b)) {
    (spouses.get(r.a) ?? spouses.set(r.a, []).get(r.a)!).push(r.b); (spouses.get(r.b) ?? spouses.set(r.b, []).get(r.b)!).push(r.a);
  }
  const parentless = (id: string) => !(parentsOf.get(id)?.length);
  const marriedIn = (id: string) => parentless(id) && (spouses.get(id) ?? []).some((x) => !parentless(x));
  const blocked = (id: string) => collapsed.has(id) || (spouses.get(id) ?? []).some((x) => collapsed.has(x));
  const visible = new Set<string>();
  const stack: string[] = [];
  for (const id of S) if (parentless(id) && !marriedIn(id)) stack.push(id);
  while (stack.length) {
    const id = stack.pop()!;
    if (visible.has(id)) continue;
    visible.add(id);
    for (const sp of spouses.get(id) ?? []) stack.push(sp);
    if (blocked(id)) continue;
    for (const c of childrenOf.get(id) ?? []) stack.push(c);
  }
  // pessoas em ciclos (não deveriam existir) permanecem visíveis para não sumirem silenciosamente
  for (const id of S) if (!visible.has(id) && !hasRootAncestor(id, parentsOf)) visible.add(id);

  const hiddenCount: Record<string, number> = {};
  for (const id of collapsed) if (visible.has(id)) {
    let n = 0; const seen = new Set<string>(); const q = [...(childrenOf.get(id) ?? [])];
    while (q.length) { const c = q.pop()!; if (seen.has(c)) continue; seen.add(c); if (!visible.has(c)) n++; for (const cc of childrenOf.get(c) ?? []) q.push(cc); }
    hiddenCount[id] = n;
  }

  // 3) nós
  const byId = new Map(persons.map((p) => [p.id, p]));
  const nodes: FlowNode[] = [];
  const memberGroup = new Map<string, string>();
  const groupNodes: FlowNode[] = [];
  const memberPos = new Map<string, { x: number; y: number }>();
  if (showGroups) for (const g of input.groups) {
    if (nucleusId && g.nucleusId && g.nucleusId !== nucleusId) continue;
    const members = g.memberIds.filter((id) => visible.has(id) && !memberGroup.has(id));
    if (!members.length) continue;
    members.forEach((m) => memberGroup.set(m, g.id));
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(members.length))));
    const rows = Math.ceil(members.length / cols);
    const w = cols * PERSON_W + (cols - 1) * GROUP_GAP + 2 * GROUP_PAD;
    const h = rows * PERSON_H + (rows - 1) * GROUP_GAP + GROUP_HEAD + GROUP_PAD;
    groupNodes.push({ id: `grp:${g.id}`, type: 'group', width: w, height: h, data: { name: g.name, count: members.length, groupId: g.id } });
    members.forEach((m, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      memberPos.set(m, { x: GROUP_PAD + c * (PERSON_W + GROUP_GAP), y: GROUP_HEAD + r * (PERSON_H + GROUP_GAP) });
    });
  }
  nodes.push(...groupNodes);

  for (const id of visible) {
    const p = byId.get(id); if (!p) continue;
    const gid = memberGroup.get(id);
    const n: FlowNode = {
      id: `p:${id}`, type: 'person', width: PERSON_W, height: PERSON_H,
      data: { ...p, hasChildren: (childrenOf.get(id)?.length ?? 0) > 0, collapsed: collapsed.has(id), hiddenDescendants: hiddenCount[id] ?? 0, personId: id },
    };
    if (gid) { n.parentId = `grp:${gid}`; n.rel = memberPos.get(id) ?? { x: GROUP_PAD, y: GROUP_HEAD }; }
    nodes.push(n);
  }

  // 4) arestas
  const edges: FlowEdge[] = [];
  const vis = (id: string) => visible.has(id) && byId.has(id);
  const unionOf = new Map<string, { id: string; a: string; b: string; status: Status }>(); // chave "a|b" ordenada
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const r of rels) if ((r.type === 'casamento' || r.type === 'uniao') && vis(r.a) && vis(r.b)) {
    const uid = `u:${r.id}`;
    nodes.push({ id: uid, type: 'union', width: UNION, height: UNION, data: { relType: r.type, status: r.status } });
    unionOf.set(pairKey(r.a, r.b), { id: uid, a: r.a, b: r.b, status: r.status });
    for (const side of [r.a, r.b]) edges.push({ id: `e:${r.id}:${side}`, source: `p:${side}`, target: uid, kind: 'spouse', status: r.status, relId: r.id, relType: r.type, label: side === r.a ? REL_NAME[r.type] : undefined });
  }
  const parentsOfVisible = new Map<string, GRel[]>();
  for (const r of rels) if (r.type === 'filiacao' && vis(r.a) && vis(r.b)) (parentsOfVisible.get(r.b) ?? parentsOfVisible.set(r.b, []).get(r.b)!).push(r);
  for (const [child, prs] of parentsOfVisible) {
    const used = new Set<string>();
    for (let i = 0; i < prs.length; i++) for (let j = i + 1; j < prs.length; j++) {
      const u = unionOf.get(pairKey(prs[i].a, prs[j].a));
      if (u && !used.has(prs[i].id) && !used.has(prs[j].id)) {
        used.add(prs[i].id); used.add(prs[j].id);
        edges.push({ id: `e:${u.id}:${child}`, source: u.id, target: `p:${child}`, kind: 'filiation', status: weakest(prs[i].status, prs[j].status), relId: prs[i].id, relType: 'filiacao' });
      }
    }
    for (const r of prs) if (!used.has(r.id)) edges.push({ id: `e:${r.id}`, source: `p:${r.a}`, target: `p:${child}`, kind: 'filiation', status: r.status, relId: r.id, relType: 'filiacao', label: r.subtype === 'adotiva' ? 'adotiva' : undefined });
  }
  for (const r of rels) if ((r.type === 'parentesco_inferido' || r.type === 'desconhecida') && vis(r.a) && vis(r.b)) {
    edges.push({ id: `e:${r.id}`, source: `p:${r.a}`, target: `p:${r.b}`, kind: 'kin', status: r.status, relId: r.id, relType: r.type, label: REL_NAME[r.type] });
  }
  if (showHypotheses) for (const h of input.hyps) {
    if (h.status === 'descartado') continue;
    const ps = h.personIds.filter(vis);
    if (ps.length < 2) continue;
    nodes.push({ id: `h:${h.id}`, type: 'hypothesis', width: HYP_W, height: HYP_H, data: { code: h.code, label: h.label, status: h.status, hypId: h.id } });
    for (const pid of ps) edges.push({ id: `eh:${h.id}:${pid}`, source: `h:${h.id}`, target: `p:${pid}`, kind: 'hypothesis', status: h.status });
  }

  return {
    nodes, edges,
    stats: {
      persons: [...visible].filter((id) => byId.has(id)).length,
      hiddenByCollapse: [...S].filter((id) => !visible.has(id)).length,
      unions: unionOf.size, groups: groupNodes.length,
    },
  };
}

function hasRootAncestor(id: string, parentsOf: Map<string, string[]>): boolean {
  // há um caminho ascendente até alguém sem pais? (se não → ciclo puro)
  const seen = new Set<string>(); const q = [id];
  while (q.length) {
    const x = q.pop()!; if (seen.has(x)) continue; seen.add(x);
    const ps = parentsOf.get(x); if (!ps?.length) return true;
    q.push(...ps);
  }
  return false;
}

/** Linhagem de uma pessoa: ela + ancestrais + descendentes (ids de pessoa). */
export function lineageIds(rels: GRel[], id: string): Set<string> {
  const rl = rels.map((r) => ({ type: r.type, a: r.a, b: r.b, status: r.status }));
  return new Set([id, ...ancestorsOf(rl, id), ...descendantsOf(rl, id)]);
}

/**
 * Árvores muito extensas: escolhe quais pessoas recolher para que no máximo `limit` pessoas sejam desenhadas
 * (o posicionamento automático cresce de forma superlinear: ~700 pessoas ≈ 5 s, ~2.200 ≈ 50 s em Node).
 * Recolhe a geração mais profunda possível; o usuário expande ramos sob demanda. Nunca apaga nada.
 */
export function autoCollapse(input: GraphInput, opts: GraphOptions, limit = 500): { collapsed: Set<string>; generations: number | null } {
  const base = new Set(opts.collapsed ?? []);
  const full = buildGraph(input, { ...opts, collapsed: base });
  if (full.stats.persons <= limit) return { collapsed: base, generations: null };
  const vis = new Set(full.nodes.filter((n) => n.type === 'person').map((n) => n.data.personId as string));
  const parents = new Map<string, string[]>(), kids = new Map<string, string[]>();
  for (const r of input.rels) if (r.type === 'filiacao' && r.status !== 'descartado' && vis.has(r.a) && vis.has(r.b)) {
    (parents.get(r.b) ?? parents.set(r.b, []).get(r.b)!).push(r.a); (kids.get(r.a) ?? kids.set(r.a, []).get(r.a)!).push(r.b);
  }
  // geração = caminho mais longo a partir das raízes; quem entrou na família por casamento herda a geração do cônjuge
  const spouseOf = new Map<string, string[]>();
  for (const r of input.rels) if ((r.type === 'casamento' || r.type === 'uniao') && r.status !== 'descartado' && vis.has(r.a) && vis.has(r.b)) {
    (spouseOf.get(r.a) ?? spouseOf.set(r.a, []).get(r.a)!).push(r.b); (spouseOf.get(r.b) ?? spouseOf.set(r.b, []).get(r.b)!).push(r.a);
  }
  const gen = new Map<string, number>(), busy = new Set<string>();
  const genOf = (id: string): number => {
    if (gen.has(id)) return gen.get(id)!;
    if (busy.has(id)) return 0; busy.add(id);
    const ps = parents.get(id) ?? [];
    let v = ps.length ? 1 + Math.max(...ps.map(genOf)) : Math.max(0, ...(spouseOf.get(id) ?? []).filter((x) => parents.get(x)?.length).map((x) => 1 + Math.max(...parents.get(x)!.map(genOf))));
    busy.delete(id); gen.set(id, v); return v;
  };
  for (const id of vis) genOf(id);
  const maxGen = Math.max(0, ...gen.values());
  for (let G = maxGen; G >= 1; G--) {
    const collapsed = new Set(base);
    for (const [id, g] of gen) if (g === G - 1 && kids.get(id)?.length) collapsed.add(id);
    if (buildGraph(input, { ...opts, collapsed }).stats.persons <= limit) return { collapsed, generations: G };
  }
  const rootsOnly = new Set(base); for (const [id, g] of gen) if (g === 0 && kids.get(id)?.length) rootsOnly.add(id);
  return { collapsed: rootsOnly, generations: 1 };
}
