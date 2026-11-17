import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, MAP_H, MAP_W, RH, TOP, WALK, buildLayout, nodePos, regionTop, samplePath, smoothPath } from '../../src/ui/mapGeometry';
import { MAP_H as VAL_H, MAP_W as VAL_W } from '../../scripts/validate-art.mjs';

// Fórmula ORIGINAL (antes da camada gráfica), reproduzida aqui para garantir que as posições não mudaram.
const XS = [110, 275, 125, 280, 200];
const original = (phase: number) => {
  const s = Math.ceil(phase / 5), i = (phase - 1) % 5;
  return { x: s % 2 ? XS[i] : 400 - XS[i], y: 130 + (5 - s) * 540 + 540 - 80 - i * ((540 - 205) / 4) };
};

describe('geometria funcional do mapa (separada da arte)', () => {
  it('mantém o espaço lógico e as 25 posições originais', () => {
    expect([MAP_W, MAP_H, RH, TOP]).toEqual([400, 2960, 540, 130]);
    expect(regionTop(1)).toBe(2290);
    expect(regionTop(5)).toBe(130);
    for (let p = 1; p <= 25; p++) expect(nodePos(p), `fase ${p}`).toEqual(original(p));
    expect(nodePos(1)).toEqual({ x: 110, y: 2750 });
    expect(WALK).toHaveLength(27); // início + 25 casas + bônus
    expect(WALK[0]).toEqual({ x: 200, y: 2875 });
    expect(WALK[26]).toEqual({ x: 200, y: 62 });
  });
  it('o validador de arte usa as mesmas dimensões do mapa', () => {
    expect([VAL_W, VAL_H]).toEqual([MAP_W, MAP_H]);
  });
  it('override válido move só o que foi pedido; o resto permanece', () => {
    const l = buildLayout({ nodes: { '1': { x: 100, y: 2700 }, '13': { x: 50, y: 1000 } }, bonus: { x: 150, y: 80 } });
    expect(l.nodes[0]).toEqual({ x: 100, y: 2700 });
    expect(l.nodes[12]).toEqual({ x: 50, y: 1000 });
    expect(l.nodes[1]).toEqual(DEFAULT_LAYOUT.nodes[1]);
    expect(l.bonus).toEqual({ x: 150, y: 80 });
    expect(l.start).toEqual(DEFAULT_LAYOUT.start);
    expect(l.walk[1]).toEqual({ x: 100, y: 2700 });
  });
  it('override inválido (fora do mapa, NaN, tipo errado) é ignorado', () => {
    const l = buildLayout({ nodes: { '1': { x: -5, y: 10 }, '2': { x: Number.NaN, y: 3 }, '3': { x: 10, y: 99999 }, '99': { x: 1, y: 1 } } as never, start: 'x' as never });
    expect(l.nodes).toEqual(DEFAULT_LAYOUT.nodes);
    expect(l.start).toEqual(DEFAULT_LAYOUT.start);
  });
  it('trilha: smoothPath e samplePath percorrem os mesmos pontos', () => {
    expect(smoothPath(WALK).startsWith(`M${WALK[0].x},${WALK[0].y}`)).toBe(true);
    const s = samplePath(WALK, 10);
    expect(s[0]).toEqual(WALK[0]);
    expect(s[s.length - 1].x).toBeCloseTo(WALK[26].x, 5);
    expect(s[s.length - 1].y).toBeCloseTo(WALK[26].y, 5);
  });
});
