import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, getNodesBounds, getViewportForBounds, useReactFlow, type Edge, type Node, type NodeProps, MarkerType } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useAtlas } from '../lib/api';
import { autoCollapse, buildGraph, lineageIds, type GraphInput, type GraphOptions } from '../../shared/graph';
import { elk } from '../lib/elk';
import { layoutGraph } from '../../shared/layout';
import { STATUS_LINE, STATUS_LABEL, type Status } from '../../shared/types';
import { Avatar } from '../components/person';
import { Page, StatusBadge, StatusIcon } from '../components/ui';
import { personDates, evDate, evKey, type Person } from '../lib/model';
import { synthesizeBio } from '../lib/bio';
import { searchScore } from '../../shared/names';

const RELATIONAL = /parent|casal|esposa|marido|irm|filho|descend|mesma pessoa|vínculo|membro da oficina/i;
const dash = (s: Status) => (STATUS_LINE[s] === 'dashed' ? '9 6' : STATUS_LINE[s] === 'dotted' ? '2 6' : undefined);
const EDGE_COLOR: Record<string, string> = { filiation: 'var(--blue)', spouse: 'var(--sepia)', kin: 'var(--gold)', hypothesis: 'var(--ink-2)' };

const PersonNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any; const p: Person = d.person; const horiz = d.dir === 'RIGHT';
  return (
    <div className={`rf-node-person card relative flex w-[208px] items-center gap-2 p-2 ${selected ? 'ring-2 ring-blue' : ''} ${p.redacted ? 'opacity-80' : ''}`} style={{ opacity: d.dim ? 0.25 : 1, borderLeft: `4px solid ${d.color}` }} data-testid="tree-node" data-person={p.id}>
      <Handle type="target" position={horiz ? Position.Left : Position.Top} style={{ opacity: 0 }} /><Handle type="source" position={horiz ? Position.Right : Position.Bottom} style={{ opacity: 0 }} />
      <Avatar p={p} size={34} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="serif truncate text-[13px]" title={p.preferred_name}>{p.preferred_name}</div>
        <div className="truncate text-[11px] text-ink2">{personDates(p) || 'sem datas'}{d.origin ? ` · ${d.origin}` : ''}</div>
        <div className="mt-0.5 text-[10px] text-ink2" title={STATUS_LABEL[p.verification_status]}><StatusIcon status={p.verification_status} size={10} /> {STATUS_LABEL[p.verification_status]}</div>
      </div>
      {d.hasChildren && <button className="nodrag nopan absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-card px-1.5 text-[10px] text-blue shadow" title={d.collapsed ? 'Expandir descendentes' : 'Recolher descendentes'} onClick={(e) => { e.stopPropagation(); d.toggle(d.personId); }} data-testid="toggle-collapse">{d.collapsed ? `＋${d.hidden || ''}` : '－'}</button>}
    </div>
  );
});
const UnionNode = memo(({ data }: NodeProps) => <div style={{ width: 14, height: 14 }} className="rounded-full border-2 border-sepia bg-card" title={(data as any).relType === 'casamento' ? 'Casamento' : 'União'}><Handle type="target" position={Position.Top} style={{ opacity: 0 }} /><Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} /></div>);
const GroupNode = memo(({ data }: NodeProps) => {
  const d = data as any;
  return <div className="h-full w-full rounded-2xl border-2 border-dashed border-sepia/60 bg-sepia/5 p-2"><div className="serif text-[12px] leading-tight text-sepia" title={d.name}>◌ Agrupamento investigativo</div><div className="line-clamp-1 text-[11px] text-ink2">{d.name}</div><div className="text-[10px] text-ink2">{d.count} pessoas · sem relação especificada</div></div>;
});
const HypNode = memo(({ data, selected }: NodeProps) => {
  const d = data as any;
  return <div className={`rounded-xl border-2 border-dashed bg-card px-2 py-1 text-center ${selected ? 'ring-2 ring-blue' : ''}`} style={{ width: 150, borderColor: 'var(--warn)', opacity: d.dim ? 0.25 : 1 }} data-testid="hyp-node"><Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} /><Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
    <div className="serif text-[12px] text-warn">⚖ {d.code ?? 'Hipótese'}</div><div className="text-[10px] text-ink2"><StatusIcon status={d.status as Status} size={10} /> {STATUS_LABEL[d.status as Status]}</div></div>;
});
const nodeTypes = { person: PersonNode, union: UnionNode, group: GroupNode, hypothesis: HypNode };

function TreeInner() {
  const { snap, ix } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const rf = useReactFlow();
  const [dir, setDir] = useState<'DOWN' | 'RIGHT'>('DOWN');
  const [hyp, setHyp] = useState(true);
  const [mode, setMode] = useState<'ancestors' | 'descendants' | 'both'>('both');
  const [depth, setDepth] = useState(4);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ kind: 'person' | 'hyp' | 'group'; id: string } | null>(null);
  const [highlight, setHighlight] = useState(false);
  const [finder, setFinder] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layouting, setLayouting] = useState(false);
  const [rev, setRev] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [autoGens, setAutoGens] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const nucleus = sp.get('nucleo') || null, focus = sp.get('foco') || null;

  const input = useMemo<GraphInput | null>(() => {
    if (!snap || !ix) return null;
    return {
      persons: snap.persons.filter((p) => !p.archived_at).map((p) => ({ id: p.id, name: p.preferred_name, status: p.verification_status, nucleusIds: p.nucleusIds, redacted: p.redacted, living: p.isPrivate, origin: ix.placePath(p.birth_place_id)?.split(',')[0] })),
      rels: snap.relationships.filter((r) => !r.archived_at).map((r) => ({ id: r.id, type: r.type as any, subtype: r.subtype, a: r.person_a, b: r.person_b, status: r.status })),
      groups: snap.groups.filter((g: any) => !g.archived_at).map((g: any) => ({ id: g.id, name: g.name, nucleusId: g.nucleus_id, memberIds: g.memberIds })),
      hyps: snap.claims.filter((c) => !c.archived_at && c.kind === 'hipotese' && !c.redacted && RELATIONAL.test(c.content) && !c.entities.some((e) => e.type === 'place'))
        .map((c) => ({ id: c.id, code: c.code, label: c.content, status: c.status, personIds: c.entities.filter((e) => e.type === 'person').map((e) => e.id) })),
    };
  }, [snap, ix]);

  // árvores muito extensas começam recolhidas (mantém a interface fluida); o usuário expande por ramo
  useEffect(() => {
    if (!input) return;
    const r = autoCollapse(input, { nucleusId: nucleus, focusId: focus, mode: focus ? mode : 'all', depth, showHypotheses: hyp }, 500);
    setCollapsed(r.collapsed); setAutoGens(r.generations);
  }, [input, nucleus, focus, mode, depth, hyp]);
  const opts: GraphOptions = useMemo(() => ({ nucleusId: nucleus, focusId: focus, mode: focus ? mode : 'all', depth, collapsed, showHypotheses: hyp }), [nucleus, focus, mode, depth, collapsed, hyp]);
  const built = useMemo(() => (input ? buildGraph(input, opts) : null), [input, opts]);
  const rels = useMemo(() => snap?.relationships.filter((r) => !r.archived_at).map((r) => ({ id: r.id, type: r.type as any, a: r.person_a, b: r.person_b, status: r.status })) ?? [], [snap]);
  const lineage = useMemo(() => (highlight && selected?.kind === 'person' ? lineageIds(rels, selected.id) : null), [highlight, selected, rels]);

  const toggle = useCallback((id: string) => setCollapsed((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);

  // layout automático (ELK) sempre que o grafo/orientação mudam
  useEffect(() => {
    if (!built || !snap || !ix) return;
    let cancel = false; setLayouting(true);
    layoutGraph(built, dir, elk).then((lay) => {
      if (cancel) return;
      const colorOf = (p: Person) => ix.N.get(p.nucleusIds[0])?.color ?? '#6b7280';
      const rfNodes: Node[] = built.nodes.map((n) => {
        const base: Node = { id: n.id, type: n.type, position: lay.positions[n.id] ?? { x: 0, y: 0 }, data: {}, draggable: true };
        if (n.parentId) { base.parentId = n.parentId; base.extent = 'parent'; }
        if (n.type === 'group') { base.style = { width: n.width, height: n.height }; base.zIndex = -1; base.selectable = true; base.draggable = true; base.data = n.data; }
        if (n.type === 'person') { const p = ix.P.get(n.data.personId)!; base.data = { ...n.data, person: p, color: colorOf(p), dir, toggle, hidden: n.data.hiddenDescendants }; }
        if (n.type === 'hypothesis' || n.type === 'union') base.data = n.data;
        return base;
      });
      const rfEdges: Edge[] = built.edges.map((e) => ({
        id: e.id, source: e.source, target: e.target, type: e.kind === 'hypothesis' || e.kind === 'kin' ? 'default' : 'smoothstep',
        label: e.label, labelStyle: { fontSize: 10, fill: 'var(--ink-2)' }, labelBgStyle: { fill: 'var(--paper)' },
        style: { stroke: EDGE_COLOR[e.kind], strokeWidth: e.kind === 'hypothesis' ? 1.5 : 2.2, strokeDasharray: e.kind === 'hypothesis' ? '3 5' : dash(e.status) },
        markerEnd: e.kind === 'filiation' ? { type: MarkerType.ArrowClosed, color: 'var(--blue)', width: 14, height: 14 } : undefined,
        data: { status: e.status, kind: e.kind },
      }));
      setNodes(rfNodes); setEdges(rfEdges); setLayouting(false); setRev((r) => r + 1);
    });
    return () => { cancel = true; };
  }, [built, dir, snap, ix, toggle, nonce]);

  useEffect(() => { if (rev) setTimeout(() => rf.fitView({ padding: 0.15, duration: 300 }), 30); }, [rev, rf]);

  // seleção / realce de linhagem (sem refazer o layout)
  const shownNodes = useMemo(() => nodes.map((n) => {
    const pid = n.type === 'person' ? (n.data as any).personId : null;
    const dim = lineage ? (pid ? !lineage.has(pid) : n.type === 'hypothesis' ? true : false) : false;
    return { ...n, selected: selected ? (selected.kind === 'person' ? n.id === `p:${selected.id}` : selected.kind === 'hyp' ? n.id === `h:${selected.id}` : n.id === `grp:${selected.id}`) : false, data: { ...n.data, dim } };
  }), [nodes, selected, lineage]);
  const shownEdges = useMemo(() => edges.map((e) => {
    if (!lineage) return e;
    const inL = (id: string) => (id.startsWith('p:') ? lineage.has(id.slice(2)) : id.startsWith('u:'));
    const on = inL(e.source) && inL(e.target) && (e.data as any)?.kind !== 'hypothesis';
    return { ...e, style: { ...e.style, opacity: on ? 1 : 0.12, strokeWidth: on ? 3.5 : (e.style as any)?.strokeWidth } };
  }), [edges, lineage]);

  const finderHits = useMemo(() => (snap && finder.trim().length > 1 ? snap.persons.filter((p) => !p.archived_at).map((p) => ({ p, s: searchScore(finder, `${p.preferred_name} ${p.names.map((n) => n.name).join(' ')}`) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map((x) => x.p) : []), [snap, finder]);
  const locate = (id: string) => {
    setFinder(''); setSelected({ kind: 'person', id });
    const node = nodes.find((n) => n.id === `p:${id}`);
    if (node) rf.fitView({ nodes: [{ id: `p:${id}` }], duration: 500, maxZoom: 1.3, padding: 0.6 });
    else setSp((q) => { const n = new URLSearchParams(q); n.delete('nucleo'); return n; });
  };
  const exportPng = async () => {
    const el = wrap.current?.querySelector('.react-flow__viewport') as HTMLElement | null; if (!el || !nodes.length) return;
    const b = getNodesBounds(nodes); const W = 2000, H = Math.max(900, Math.round(2000 * (b.height / Math.max(b.width, 1))));
    const vp = getViewportForBounds(b, W, H, 0.3, 2, 0.1);
    const url = await toPng(el, { backgroundColor: getComputedStyle(document.body).backgroundColor, width: W, height: H, style: { width: `${W}px`, height: `${H}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` } });
    const a = document.createElement('a'); a.href = url; a.download = 'arvore-joanitti.png'; a.click();
  };
  const setParam = (k: string, v: string | null) => setSp((q) => { const n = new URLSearchParams(q); v ? n.set(k, v) : n.delete(k); return n; });
  if (!snap || !ix || !built) return null;
  const rootsWithKids = built.nodes.filter((n) => n.type === 'person' && n.data.hasChildren).map((n) => n.data.personId as string);
  const selPerson = selected?.kind === 'person' ? ix.P.get(selected.id) : null;
  const selClaim = selected?.kind === 'hyp' ? ix.C.get(selected.id) : null;
  const selGroup = selected?.kind === 'group' ? snap.groups.find((g: any) => g.id === selected.id) : null;
  const focusPerson = focus ? ix.P.get(focus) : null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="card mb-2 flex flex-wrap items-center gap-2 p-2 text-sm no-print">
          <select className="input !w-auto max-w-[16rem]" value={nucleus ?? ''} onChange={(e) => setParam('nucleo', e.target.value || null)} aria-label="Núcleo familiar" data-testid="nucleus-select"><option value="">Todos os núcleos</option>{snap.nuclei.map((n: any) => <option key={n.id} value={n.id}>{n.name.slice(0, 46)}</option>)}</select>
          <div className="relative"><input className="input !w-48" placeholder="🔍 Localizar pessoa…" value={finder} onChange={(e) => setFinder(e.target.value)} data-testid="tree-find" aria-label="Localizar pessoa" />
            {finderHits.length > 0 && <ul className="card absolute z-30 mt-1 w-64 p-1 shadow-lg">{finderHits.map((p) => <li key={p.id}><button className="w-full rounded px-2 py-1 text-left text-sm hover:bg-paper2" onClick={() => locate(p.id)}>{p.preferred_name} <span className="text-xs text-ink2">{personDates(p)}</span></button></li>)}</ul>}</div>
          <button className="btn" onClick={() => setDir(dir === 'DOWN' ? 'RIGHT' : 'DOWN')} data-testid="orientation">{dir === 'DOWN' ? '↕ Vertical' : '↔ Horizontal'}</button>
          <label className="flex items-center gap-1"><input type="checkbox" checked={hyp} onChange={(e) => setHyp(e.target.checked)} />hipóteses</label>
          <button className="btn" onClick={() => setNonce((n) => n + 1)} title="Recalcular o posicionamento automático">⟳ Reorganizar</button>
          <button className="btn" onClick={() => setCollapsed(new Set(rootsWithKids))} disabled={!rootsWithKids.length}>Recolher</button>
          <button className="btn" onClick={() => { if (built && built.stats.persons + built.stats.hiddenByCollapse > 800 && !confirm('Esta árvore é muito extensa: expandir tudo pode demorar e ficar lento. Continuar?')) return; setAutoGens(null); setCollapsed(new Set()); }}>Expandir tudo</button>
          <button className="btn ml-auto" onClick={exportPng}>PNG</button><button className="btn" onClick={() => window.print()}>PDF</button>
        </div>
        {(focus || selPerson) && <div className="mb-2 flex flex-wrap items-center gap-2 text-xs no-print">
          {focusPerson && <span className="chip !border-blue !text-blue">Foco: {focusPerson.preferred_name}
            <select className="bg-transparent" value={mode} onChange={(e) => setMode(e.target.value as any)} aria-label="Modo do foco"><option value="both">ancestrais e descendentes</option><option value="ancestors">só ancestrais</option><option value="descendants">só descendentes</option></select>
            <input type="range" min={1} max={8} value={depth} onChange={(e) => setDepth(+e.target.value)} aria-label="Gerações" /> {depth} ger. <button onClick={() => setParam('foco', null)} aria-label="Remover foco">✕</button></span>}
          {selPerson && <label className="chip cursor-pointer"><input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> destacar linhagem de {selPerson.preferred_name.split(' ')[0]}</label>}
        </div>}
        {autoGens !== null && <p className="mb-2 rounded-lg border border-warn/50 bg-warn/10 p-2 text-xs" data-testid="auto-collapse-note">Árvore extensa: exibindo as primeiras {autoGens} geração(ões) ({built.stats.persons} pessoas) para manter a fluidez. Use ＋ nos nós, o foco por pessoa ou “Expandir tudo”.</p>}
        <div ref={wrap} className="card relative h-[68vh] min-h-[420px] overflow-hidden atlas-bg" data-testid="tree-canvas">
          {layouting && <div className="absolute right-3 top-3 z-10 chip">posicionando…</div>}
          <ReactFlow nodes={shownNodes} edges={shownEdges} nodeTypes={nodeTypes} minZoom={0.1} maxZoom={2} nodesConnectable={false} onlyRenderVisibleElements={shownNodes.length > 250} proOptions={{ hideAttribution: true }}
            onNodeClick={(_, n) => { if (n.type === 'person') setSelected({ kind: 'person', id: (n.data as any).personId }); else if (n.type === 'hypothesis') setSelected({ kind: 'hyp', id: (n.data as any).hypId }); else if (n.type === 'group') setSelected({ kind: 'group', id: (n.data as any).groupId }); }}
            onPaneClick={() => setSelected(null)}>
            <Background variant={BackgroundVariant.Dots} gap={22} color="var(--grid)" /><Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!hidden md:!block" nodeColor={(n) => (n.type === 'group' ? '#b08a2e55' : n.type === 'hypothesis' ? '#9a6a12' : '#1e3a5f')} />
          </ReactFlow>
          {!built.nodes.length && <div className="absolute inset-0 grid place-items-center text-sm text-ink2">Nenhuma pessoa neste filtro.</div>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2" aria-label="Legenda">
          <svg width="70" height="10"><line x1="0" y1="5" x2="70" y2="5" stroke="var(--blue)" strokeWidth="2" /></svg>documentada
          <svg width="70" height="10"><line x1="0" y1="5" x2="70" y2="5" stroke="var(--blue)" strokeWidth="2" strokeDasharray="9 6" /></svg>hipotética
          <svg width="70" height="10"><line x1="0" y1="5" x2="70" y2="5" stroke="var(--blue)" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" /></svg>não confirmada
          <span>◌ agrupamento = mesmo núcleo documental, <b>sem</b> relação especificada</span><span>⚖ nó de hipótese</span>
          <span data-testid="tree-stats">{built.stats.persons} pessoas{built.stats.hiddenByCollapse ? ` · ${built.stats.hiddenByCollapse} recolhidas` : ''}</span>
        </div>
      </div>

      <aside className="card w-full shrink-0 p-4 lg:w-[22rem]" aria-label="Painel da pessoa" data-testid="side-panel">
        {selPerson ? <PersonPanel p={selPerson} onFocus={(m) => { setMode(m); setParam('foco', selPerson.id); }} /> :
          selClaim ? <div><div className="mb-1 flex items-center gap-2"><span className="chip">{selClaim.code}</span><StatusBadge status={selClaim.status} /></div><p className="text-sm">{selClaim.content}</p>{selClaim.contradictions && <p className="mt-2 text-xs text-ink2"><b>Limitações:</b> {selClaim.contradictions}</p>}
            <p className="mt-2 text-xs text-ink2">Nó de hipótese: liga as pessoas envolvidas por linha pontilhada, <b>sem</b> afirmar parentesco.</p><Link className="btn mt-3" to={`/investigacoes?claim=${selClaim.id}`}>Abrir na investigação</Link></div> :
          selGroup ? <div><div className="serif text-lg text-sepia">Agrupamento investigativo</div><div className="text-sm font-medium">{selGroup.name}</div><p className="mt-2 text-sm text-ink2">{selGroup.description}</p>
            <ul className="mt-2 space-y-1 text-sm">{selGroup.memberIds.map((m: string) => <li key={m}><Link className="text-blue underline" to={`/pessoas/${m}`}>{ix.P.get(m)?.preferred_name}</Link></li>)}</ul></div> :
          <div className="text-sm text-ink2"><h2 className="serif mb-1 text-lg text-blue">Painel</h2><p>Clique em uma pessoa para ver dados, relações, biografia, eventos e fontes. Arraste para mover, role para aproximar.</p>
            <p className="mt-2">Pessoas ligadas por linhas têm relação registrada; as dentro de um <b>agrupamento</b> apenas aparecem juntas nos documentos.</p></div>}
      </aside>
    </div>
  );
}

function PersonPanel({ p, onFocus }: { p: Person; onFocus: (m: 'ancestors' | 'descendants' | 'both') => void }) {
  const { snap, ix } = useAtlas(); if (!snap || !ix) return null;
  const events = [...(ix.evByPerson.get(p.id) ?? [])].sort((a, b) => evKey(a) - evKey(b)).slice(0, 5);
  const rels = (ix.relByPerson.get(p.id) ?? []).filter((r) => r.status !== 'descartado');
  const bio = synthesizeBio(p, snap, ix).slice(0, 4);
  const srcIds = [...new Set([...(ix.evidBySubject.get(`person:${p.id}`) ?? []).map((e) => e.source_id), ...snap.sources.filter((s) => s.personIds.includes(p.id)).map((s) => s.id)])].slice(0, 4);
  return (
    <div className="space-y-3 text-sm" data-testid="person-panel">
      <div className="flex items-center gap-3"><Avatar p={p} size={52} /><div><h2 className="serif text-lg leading-tight text-blue">{p.preferred_name}</h2><div className="text-xs text-ink2">{personDates(p) || 'sem datas'}</div><StatusBadge status={p.verification_status} small /></div></div>
      {p.identity_note && <p className="rounded bg-warn/10 p-2 text-xs">⚠ {p.identity_note}</p>}
      <div><div className="label">Origem</div>{ix.placePath(p.birth_place_id) || 'não informada'}</div>
      <div><div className="label">Relações</div>{rels.length ? <ul className="space-y-0.5">{rels.slice(0, 5).map((r) => { const o = ix.P.get(r.person_a === p.id ? r.person_b : r.person_a); return <li key={r.id} className="text-xs">{r.type === 'filiacao' ? (r.person_b === p.id ? 'genitor(a): ' : 'filho(a): ') : `${r.type.replace('_', ' ')}: `}{o?.preferred_name} <span title={STATUS_LABEL[r.status]}><StatusIcon status={r.status} size={10} /></span></li>; })}</ul> : <span className="text-xs text-ink2">nenhuma relação registrada (agrupado sem vínculo)</span>}</div>
      <div><div className="label">Biografia (síntese)</div><ul className="list-disc space-y-1 pl-4 text-xs">{bio.map((b, i) => <li key={i}>{b}</li>)}</ul></div>
      {events.length > 0 && <div><div className="label">Eventos</div><ul className="space-y-0.5 text-xs">{events.map((e) => <li key={e.id}><b>{evDate(e)}</b> — {e.title}</li>)}</ul></div>}
      {srcIds.length > 0 && <div><div className="label">Fontes</div><ul className="space-y-0.5 text-xs">{srcIds.map((s) => <li key={s}><Link className="text-blue underline" to={`/documentos?doc=${s}`}>{ix.S.get(s)?.title.slice(0, 70)}</Link></li>)}</ul></div>}
      <div className="flex flex-wrap gap-2 pt-1"><Link className="btn btn-primary" to={`/pessoas/${p.id}`} data-testid="open-profile">Perfil completo</Link>
        <button className="btn" onClick={() => onFocus('ancestors')}>Ancestrais</button><button className="btn" onClick={() => onFocus('descendants')}>Descendentes</button></div>
    </div>
  );
}

export function TreePage() {
  return <Page title="Árvore Genealógica" wide subtitle="Linhas conforme a confiança: contínua (documentada), tracejada (hipotética), pontilhada (não confirmada). Pessoas sem relação especificada ficam em agrupamentos investigativos."><ReactFlowProvider><TreeInner /></ReactFlowProvider></Page>;
}
