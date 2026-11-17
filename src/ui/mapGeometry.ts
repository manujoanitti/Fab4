import { RULES, TOTAL_PHASES, stageOfPhase } from '../domain/rules';
import type { LayoutOverride } from '../art/types';

// GEOMETRIA FUNCIONAL do mapa (separada da arte): espaço lógico único, em unidades do viewBox.
// Estas posições definem áreas clicáveis, trilha e caminhada da personagem — a arte externa só as acompanha.
export const MAP_W = 400;
export const RH = 540; // altura de cada região
export const TOP = 130;
export const MAP_H = TOP + 5 * RH + 130; // 2960
export const regionTop = (s: number) => TOP + (5 - s) * RH;
export const regionRect = (s: number) => ({ x: 0, y: regionTop(s), w: MAP_W, h: RH });

export interface Pt { x: number; y: number }
const XS = [110, 275, 125, 280, 200];
/** Posição padrão (atual) de cada casa. */
export function defaultNodePos(phase: number): Pt {
  const s = stageOfPhase(phase);
  const i = (phase - 1) % RULES.phasesPerStage;
  const x = s % 2 ? XS[i] : MAP_W - XS[i];
  return { x, y: regionTop(s) + RH - 80 - i * ((RH - 205) / 4) };
}
export const DEFAULT_START: Pt = { x: 200, y: MAP_H - 85 };
export const DEFAULT_BONUS: Pt = { x: 200, y: 62 };
/** Base do poste do marco "Início" em relação ao ponto START (a arte do marco ancora ali). */
export const START_SIGN_OFFSET: Pt = { x: -80, y: 38 };
export const SPARKLES: Pt[] = [[60, 40], [330, 90], [110, 300], [300, 700], [80, 1100], [320, 1500], [90, 1900], [310, 2300]].map(([x, y]) => ({ x, y }));

export interface MapLayout { nodes: Pt[]; start: Pt; bonus: Pt; walk: Pt[] }
const inside = (p: unknown): p is Pt => !!p && typeof (p as Pt).x === 'number' && typeof (p as Pt).y === 'number' && Number.isFinite((p as Pt).x) && Number.isFinite((p as Pt).y) && (p as Pt).x >= 0 && (p as Pt).x <= MAP_W && (p as Pt).y >= 0 && (p as Pt).y <= MAP_H;

/** Monta o layout. Sem override (ou com override inválido) = posições atuais. Um pacote gráfico pode redefinir posições. */
export function buildLayout(override?: LayoutOverride): MapLayout {
  const nodes = Array.from({ length: TOTAL_PHASES }, (_, i) => {
    const o = override?.nodes?.[String(i + 1)];
    return inside(o) ? { x: o.x, y: o.y } : defaultNodePos(i + 1);
  });
  const start = inside(override?.start) ? { ...override!.start! } : { ...DEFAULT_START };
  const bonus = inside(override?.bonus) ? { ...override!.bonus! } : { ...DEFAULT_BONUS };
  return { nodes, start, bonus, walk: [start, ...nodes, bonus] };
}
/** Trilha: curva suave (Catmull-Rom → Bézier) por uma lista de pontos. */
export function smoothPath(pts: Pt[]): string {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
}
/** Amostra pontos ao longo da mesma curva de smoothPath (para guias de layout e testes). */
export function samplePath(pts: Pt[], perSegment = 24): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    for (let k = 1; k <= perSegment; k++) {
      const t = k / perSegment, u = 1 - t;
      out.push({ x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x, y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y });
    }
  }
  return out;
}
export const DEFAULT_LAYOUT: MapLayout = buildLayout();
export const nodePos = (phase: number): Pt => DEFAULT_LAYOUT.nodes[phase - 1];
export const WALK: Pt[] = DEFAULT_LAYOUT.walk;
