// Posicionamento automático com ELK (layered) + grade para grupos investigativos.
import type { BuiltGraph } from './graph';

export interface Layout { positions: Record<string, { x: number; y: number }>; width: number; height: number }

/** `elkInstance`: no navegador passe um ELK com Web Worker (src/lib/elk.ts); em Node/testes usa a versão embutida. */
export async function layoutGraph(g: BuiltGraph, dir: 'DOWN' | 'RIGHT' = 'DOWN', elkInstance?: { layout: (g: any) => Promise<any> }): Promise<Layout> {
  const elk = elkInstance ?? new ((await import('elkjs/lib/elk.bundled.js')).default as any)();
  const top = g.nodes.filter((n) => !n.parentId);
  const topIds = new Set(top.map((n) => n.id));
  const owner = new Map<string, string>();
  for (const n of g.nodes) owner.set(n.id, n.parentId && topIds.has(n.parentId) ? n.parentId : n.id);
  const seen = new Set<string>();
  const edges: { id: string; sources: string[]; targets: string[] }[] = [];
  for (const e of g.edges) {
    const s = owner.get(e.source), t = owner.get(e.target);
    if (!s || !t || s === t) continue;
    const key = `${s}>${t}`; if (seen.has(key)) continue; seen.add(key);
    edges.push({ id: `l${edges.length}`, sources: [s], targets: [t] });
  }
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': dir,
      'elk.spacing.nodeNode': '34', 'elk.layered.spacing.nodeNodeBetweenLayers': '70',
      'elk.spacing.componentComponent': '60', 'elk.separateConnectedComponents': 'true', 'elk.aspectRatio': '1.9',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX', 'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: top.map((n) => ({ id: n.id, width: n.width, height: n.height })),
    edges,
  };
  const out = await elk.layout(graph);
  const positions: Layout['positions'] = {};
  for (const c of out.children ?? []) positions[c.id] = { x: c.x ?? 0, y: c.y ?? 0 };
  for (const n of g.nodes) if (n.parentId && n.rel) positions[n.id] = n.rel;
  return { positions, width: out.width ?? 0, height: out.height ?? 0 };
}
