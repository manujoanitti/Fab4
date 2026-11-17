// Medição do CORPO principal de um recurso (independente de ornamentos externos) e escala uniforme por grupo.
import type { Raw } from './imaging';
import type { SaidaSpec } from './types';

export interface Corpo { cx: number; cy: number; diametro: number } // em px do raster medido

/** Transformada de distância (chanfro 3-4) ao pixel "falso" mais próximo; em unidades de pixel. */
function distancia(mascara: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mascara[i] ? INF : 0;
  const A = 1, B = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i];
    if (v === 0) continue;
    v = Math.min(v, x > 0 ? d[i - 1] + A : INF, y > 0 ? d[i - w] + A : INF, x > 0 && y > 0 ? d[i - w - 1] + B : INF, x < w - 1 && y > 0 ? d[i - w + 1] + B : INF);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i];
    if (v === 0) continue;
    v = Math.min(v, x < w - 1 ? d[i + 1] + A : INF, y < h - 1 ? d[i + w] + A : INF, x < w - 1 && y < h - 1 ? d[i + w + 1] + B : INF, x > 0 && y < h - 1 ? d[i + w - 1] + B : INF);
    d[i] = v;
  }
  return d;
}

/**
 * Corpo = maior disco inscrito. "corpo": dentro do opaco (ignora cadeados, folhas e flores, que são finos/laterais);
 * "vao": dentro do transparente ENCLAUSURADO (o furo de um anel), ignorando o fundo externo. Retorna null se não houver.
 * Mede num raster reduzido (≤ ~320 px) e devolve em px do raster original.
 */
export function medirCorpo(raw: Raw, ref: 'corpo' | 'vao', limiar = 128): Corpo | null {
  const f = Math.max(1, Math.ceil(Math.max(raw.width, raw.height) / 320));
  const w = Math.ceil(raw.width / f), h = Math.ceil(raw.height / f);
  const opaco = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(raw.width - 1, x * f + (f >> 1)), sy = Math.min(raw.height - 1, y * f + (f >> 1));
    opaco[y * w + x] = raw.data[(sy * raw.width + sx) * 4 + 3] >= limiar ? 1 : 0;
  }
  let alvo = opaco;
  if (ref === 'vao') {
    // transparente conectado à borda (com 1 px de moldura) = exterior; o que sobra é vão interno
    const ext = new Uint8Array(w * h), pilha: number[] = [];
    const semear = (i: number) => { if (!opaco[i] && !ext[i]) { ext[i] = 1; pilha.push(i); } };
    for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
    while (pilha.length) {
      const i = pilha.pop()!, x = i % w;
      if (x > 0) semear(i - 1); if (x < w - 1) semear(i + 1); if (i >= w) semear(i - w); if (i < w * (h - 1)) semear(i + w);
    }
    alvo = new Uint8Array(w * h);
    for (let i = 0; i < alvo.length; i++) alvo[i] = !opaco[i] && !ext[i] ? 1 : 0;
  }
  const d = distancia(alvo, w, h);
  let best = 0, bi = -1;
  for (let i = 0; i < d.length; i++) if (d[i] > best) { best = d[i]; bi = i; }
  if (bi < 0 || best < 2) return null;
  // raio do disco inscrito ≈ d (distância ao mais próximo "falso"); centro refinado = média dos pixels próximos do máximo
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < d.length; i++) if (d[i] >= best * 0.97) { sx += i % w; sy += (i / w) | 0; n++; }
  return { cx: ((sx / n) + 0.5) * f, cy: ((sy / n) + 0.5) * f, diametro: 2 * (best + 0.5) * f };
}

export interface MembroEscala {
  id: string; corpo: Corpo; cropW: number; cropH: number; // crop do elemento (px) e corpo medido nele
  spec: Pick<SaidaSpec, 'px' | 'margemSeguranca' | 'ancora' | 'escala'>;
}
export interface PlanoEscala { id: string; escala: number; diametroPx: number; diametroRel: number; limitadoPorOrnamento: boolean; alvoDeclarado: number; alvoAplicado: number }

/** Maior diâmetro relativo (fração do menor lado) que mantém TODOS os ornamentos do membro dentro da margem de segurança. */
export function diametroMaximo(m: MembroEscala): number {
  const { px, margemSeguranca: mg, ancora } = m.spec;
  const L = m.corpo.cx, R = m.cropW - m.corpo.cx, T = m.corpo.cy, B = m.cropH - m.corpo.cy;
  const dispL = (ancora.x - mg) * px.w, dispR = (1 - ancora.x - mg) * px.w, dispT = (ancora.y - mg) * px.h, dispB = (1 - ancora.y - mg) * px.h;
  const s = Math.min(dispL / L, dispR / R, dispT / T, dispB / B);
  return (m.corpo.diametro * s) / Math.min(px.w, px.h);
}

/** Calcula a escala de cada membro: recursos de um mesmo grupo compartilham o diâmetro (o menor entre o declarado e o que cabe para todos). */
export function planejarEscalas(membros: MembroEscala[]): PlanoEscala[] {
  const grupos = new Map<string, MembroEscala[]>();
  for (const m of membros) { const g = m.spec.escala!.grupo ?? `#${m.id}`; grupos.set(g, [...(grupos.get(g) ?? []), m]); }
  const out: PlanoEscala[] = [];
  for (const lista of grupos.values()) {
    const declarado = Math.min(...lista.map((m) => m.spec.escala!.diametro));
    const maximo = Math.min(...lista.map(diametroMaximo));
    const alvo = Math.min(declarado, maximo);
    for (const m of lista) {
      const lado = Math.min(m.spec.px.w, m.spec.px.h);
      const escala = (alvo * lado) / m.corpo.diametro;
      out.push({ id: m.id, escala, diametroPx: alvo * lado, diametroRel: alvo, limitadoPorOrnamento: maximo < declarado, alvoDeclarado: declarado, alvoAplicado: alvo });
    }
  }
  return out;
}
