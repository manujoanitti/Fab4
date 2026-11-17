// Gerador de pranchas SINTÉTICAS para testar o processador (formas coloridas sobre fundo chapado). Não é arte do jogo.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paraPng, hexRgb, type Raw } from '../../scripts/art/lib/imaging';
import type { Folha } from '../../scripts/art/lib/types';

export type Forma =
  | { t: 'disco'; cor: [number, number, number]; frac?: number }
  | { t: 'anel'; cor: [number, number, number]; frac?: number }
  | { t: 'ret'; cor: [number, number, number]; fw: number; fh: number; base?: boolean }
  | { t: 'vazio' }
  | { t: 'disco-com-manchas'; cor: [number, number, number]; fundo: [number, number, number] };

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
export const tmp = () => mkdtempSync(join(tmpdir(), 'art-test-'));

export interface OpcoesSintese { largura: number; ruido?: number; deriva?: Record<string, { dx: number; dy: number }>; extras?: Array<{ x: number; y: number; r: number; cor: [number, number, number] }>; alturaExtra?: number }

/** Desenha uma prancha RGBA opaca: fundo chapado + uma forma por célula (com antialias 3×3, ruído e deriva opcionais). */
export function sintetizar(f: Folha, formas: Record<string, Forma>, o: OpcoesSintese): Raw {
  const W = o.largura, H = Math.round(W * (f.aspecto[1] / f.aspecto[0]));
  const bg = hexRgb(f.fundo);
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = bg.r; data[i * 4 + 1] = bg.g; data[i * 4 + 2] = bg.b; data[i * 4 + 3] = 255; }
  const mistura = (x: number, y: number, cor: [number, number, number], a: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - a) + cor[c] * a);
  };
  const desenhar = (x0: number, y0: number, x1: number, y1: number, dentro: (x: number, y: number) => boolean, cor: [number, number, number]) => {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      let n = 0;
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) if (dentro(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) n++;
      mistura(x, y, cor, n / 9);
    }
  };
  for (const c of f.celulas) {
    const forma = formas[c.id];
    if (!forma || forma.t === 'vazio') continue;
    const d = o.deriva?.[c.id] ?? { dx: 0, dy: 0 };
    const cx = (c.rect.x + c.rect.w / 2) * W + d.dx, cy = (c.rect.y + c.rect.h / 2) * H + d.dy;
    const cw = c.rect.w * W, ch = c.rect.h * H, m = Math.min(cw, ch);
    if (forma.t === 'disco' || forma.t === 'disco-com-manchas') {
      const r = ((forma.t === 'disco' ? forma.frac : undefined) ?? 0.72) * m / 2;
      desenhar(cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, forma.cor);
      if (forma.t === 'disco-com-manchas') // manchas minúsculas exatamente na cor do fundo, DENTRO do objeto (resíduo que o recorte não pode remover)
        for (let k = 0; k < 90; k++) { const a = (k * 2.399) % (Math.PI * 2), rr = (0.15 + ((k * 37) % 70) / 100) * r * 0.8; const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const p = ((y + j) * W + x + i) * 4; data[p] = forma.fundo[0]; data[p + 1] = forma.fundo[1]; data[p + 2] = forma.fundo[2]; } }
    } else if (forma.t === 'anel') {
      const R = (forma.frac ?? 0.72) * m / 2, r = R * 0.72;
      desenhar(cx - R, cy - R, cx + R, cy + R, (x, y) => { const q = (x - cx) ** 2 + (y - cy) ** 2; return q <= R * R && q >= r * r; }, forma.cor);
    } else if (forma.t === 'ret') {
      const w = forma.fw * cw, h = forma.fh * ch;
      const yc = forma.base ? c.rect.y * H + ch - 0.1 * ch - h / 2 + d.dy : cy;
      desenhar(cx - w / 2, yc - h / 2, cx + w / 2, yc + h / 2, (x, y) => Math.abs(x - cx) <= w / 2 && Math.abs(y - yc) <= h / 2, forma.cor);
    }
  }
  for (const e of o.extras ?? []) desenhar(e.x - e.r, e.y - e.r, e.x + e.r, e.y + e.r, (x, y) => (x - e.x) ** 2 + (y - e.y) ** 2 <= e.r * e.r, e.cor);
  if (o.ruido) { const r = rng(7); for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.max(0, Math.min(255, data[i * 4 + c] + Math.round((r() - 0.5) * 2 * o.ruido))); }
  return { data, width: W, height: H };
}
export async function gravarPng(raw: Raw, pasta: string, nome = 'prancha.png'): Promise<string> {
  mkdirSync(pasta, { recursive: true });
  const p = join(pasta, nome);
  writeFileSync(p, await paraPng(raw));
  return p;
}
/** Formas padrão para as 6 células do piloto. */
export const FORMAS_PILOTO: Record<string, Forma> = {
  'map.node.locked': { t: 'disco', cor: [150, 140, 175] },
  'map.node.available': { t: 'disco', cor: [240, 130, 170] },
  'map.node.done': { t: 'disco', cor: [235, 190, 60] },
  'map.node.selected': { t: 'anel', cor: [225, 170, 120] },
  'map.start': { t: 'ret', cor: [150, 100, 60], fw: 0.45, fh: 0.7, base: true },
  'map.ribbon.1': { t: 'ret', cor: [236, 111, 160], fw: 0.82, fh: 0.5 },
};
