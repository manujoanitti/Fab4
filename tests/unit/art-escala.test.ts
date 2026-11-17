import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aplicarAjustes } from '../../scripts/art/lib/ajustes';
import { diametroMaximo, medirCorpo, planejarEscalas, type MembroEscala } from '../../scripts/art/lib/corpo';
import { limparResiduoChave, type Raw } from '../../scripts/art/lib/imaging';
import { comporFinal } from '../../scripts/art/lib/process';
import { extrasDaSaida } from '../../scripts/art/lib/integrar';
import type { LotePlano, SaidaSpec } from '../../scripts/art/lib/types';

/** Disco opaco de raio r em (cx,cy) + apêndices retangulares finos (cadeado/folhas) numa tela W×H. */
function disco(W: number, H: number, cx: number, cy: number, r: number, apendices: Array<[number, number, number, number]> = [], furo = 0): Raw {
  const data = new Uint8Array(W * H * 4);
  const pinta = (x: number, y: number) => { const o = (y * W + x) * 4; data[o] = 200; data[o + 1] = 120; data[o + 2] = 90; data[o + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= r && d >= furo) pinta(x, y);
  }
  for (const [x0, y0, w, h] of apendices) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < W && y < H) pinta(x, y);
  return { data, width: W, height: H };
}
const spec = (over: Partial<SaidaSpec> = {}): SaidaSpec => ({ arquivo: 'a@2x.webp', formato: 'webp', px: { w: 128, h: 128 }, alfa: true, alinhamento: 'centro', ancora: { x: 0.5, y: 0.5 }, margemSeguranca: 0.03, maxKB: 60, dimMode: 'aspect', ...over });

describe('medirCorpo (disco inscrito)', () => {
  it('ignora cadeado/folhas finos e mede o disco do corpo', () => {
    const r = disco(300, 340, 150, 150, 100, [[135, 240, 30, 60], [30, 215, 12, 60], [258, 215, 12, 60]]);
    const c = medirCorpo(r, 'corpo')!;
    expect(c.diametro).toBeGreaterThan(190);
    expect(c.diametro).toBeLessThan(210);
    expect(Math.abs(c.cx - 150)).toBeLessThan(6);
    expect(Math.abs(c.cy - 150)).toBeLessThan(6);
  });
  it('"vao" mede o furo de um anel (e não o fundo externo)', () => {
    const r = disco(300, 300, 150, 150, 120, [], 90);
    const v = medirCorpo(r, 'vao')!;
    expect(v.diametro).toBeGreaterThan(170);
    expect(v.diametro).toBeLessThan(190);
    expect(medirCorpo(disco(100, 100, 50, 50, 30), 'vao')).toBeNull(); // sem vão interno
  });
});

describe('escala por corpo e grupo', () => {
  const membro = (id: string, r: number, apend: Array<[number, number, number, number]>, W = 400, H = 400, cx = 200, cy = 200): MembroEscala => {
    const raw = disco(W, H, cx, cy, r, apend);
    return { id, corpo: medirCorpo(raw, 'corpo')!, cropW: W, cropH: H, spec: spec({ escala: { ref: 'corpo', diametro: 0.78, grupo: 'g' } }) };
  };
  it('membros do mesmo grupo recebem o MESMO diâmetro, mesmo com corpos e ornamentos diferentes', () => {
    const a = membro('a', 100, [[185, 300, 30, 70]]), b = membro('b', 90, [[100, 280, 200, 20]]), c = membro('c', 105, []);
    const planos = planejarEscalas([a, b, c]);
    const ds = planos.map((p) => p.diametroPx);
    expect(Math.max(...ds) - Math.min(...ds)).toBeLessThan(1e-9);
    expect(planos[0].alvoAplicado).toBeLessThanOrEqual(0.78);
  });
  it('o diâmetro do grupo é limitado pelo membro cujos ornamentos mais se afastam (nunca corta ornamento)', () => {
    const largo = membro('largo', 100, [[0, 190, 400, 20]]); // ornamento atravessa toda a largura
    const simples = membro('simples', 100, []);
    const [pl, ps] = planejarEscalas([largo, simples]);
    expect(pl.limitadoPorOrnamento).toBe(true);
    expect(diametroMaximo(largo)).toBeCloseTo(pl.alvoAplicado, 6);
    expect(ps.alvoAplicado).toBeCloseTo(pl.alvoAplicado, 6);
  });
  it('comporFinal por corpo centra o corpo (não o bounding box) e preserva os apêndices', async () => {
    const raw = disco(300, 340, 150, 150, 100, [[135, 240, 30, 70]]); // "cadeado" abaixo do disco
    const corpo = medirCorpo(raw, 'corpo')!;
    const [plano] = planejarEscalas([{ id: 'x', corpo, cropW: 300, cropH: 340, spec: spec({ escala: { ref: 'corpo', diametro: 0.4 } }) }]);
    const { raw: fin } = await comporFinal(raw, { w: 300, h: 340 }, spec({ escala: { ref: 'corpo', diametro: 0.4 } }), { escala: plano.escala, corpo });
    const m = medirCorpo(fin, 'corpo')!;
    expect(Math.abs(m.cx - 64)).toBeLessThan(2);
    expect(Math.abs(m.cy - 64)).toBeLessThan(2);
    expect(m.diametro / 128).toBeGreaterThan(0.37);
    expect(m.diametro / 128).toBeLessThan(0.43);
    let baixo = 0; for (let y = 100; y < 128; y++) for (let x = 0; x < 128; x++) if (fin.data[(y * 128 + x) * 4 + 3] > 200) baixo++;
    expect(baixo).toBeGreaterThan(20); // o apêndice inferior continua lá
  });
});

describe('ajustes por lote e extras do manifesto', () => {
  const lote = { id: 'l', pacote: 'v1', folha: { celulas: [{ id: 'a', saida: spec() }, { id: 'b', saida: spec() }] } } as unknown as LotePlano;
  it('sobrepõe só as células citadas, sem mutar o lote original; sem arquivo = inalterado', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aj-'));
    expect(aplicarAjustes(lote, join(dir, 'nao-existe.json'))).toBe(lote);
    writeFileSync(join(dir, 'ajustes.json'), JSON.stringify({ versao: 1, celulas: { a: { margemSeguranca: 0.01, exibicao: { box: { w: 10, h: 10 } } } } }));
    const novo = aplicarAjustes(lote, join(dir, 'ajustes.json'));
    expect(novo.folha!.celulas[0].saida.margemSeguranca).toBe(0.01);
    expect(novo.folha!.celulas[1].saida.margemSeguranca).toBe(0.03);
    expect(lote.folha!.celulas[0].saida.margemSeguranca).toBe(0.03);
    writeFileSync(join(dir, 'ruim.json'), JSON.stringify({ versao: 1, celulas: { zzz: {} } }));
    expect(() => aplicarAjustes(lote, join(dir, 'ruim.json'))).toThrow(/célula desconhecida/);
  });
  it('extrasDaSaida só emite o que foi declarado', () => {
    expect(extrasDaSaida(spec())).toEqual({});
    expect(extrasDaSaida(spec({ fatias: { esq: 0.3, dir: 0.3 }, areaTexto: { x: 0, y: 0, w: 1, h: 1 }, exibicao: { box: { w: 5, h: 5 } } }))).toEqual({ box: { w: 5, h: 5 }, textArea: { x: 0, y: 0, w: 1, h: 1 }, slice: { l: 0.3, r: 0.3 } });
  });
});

describe('limparResiduoChave', () => {
  const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];
  it('remove verde-chave misturado dentro do desenho e preserva oliva/pastel', () => {
    // [transparente (fundo já removido)] [verde-chave misturado] [oliva] [rosa] [verde intermediário]
    const data = new Uint8Array([...px(0, 0, 0, 0), ...px(75, 208, 54), ...px(150, 160, 90), ...px(240, 180, 190), ...px(100, 175, 60)]);
    const r = limparResiduoChave(data, { r: 0, g: 255, b: 0 }, 5, 1);
    expect(r.removidos).toBe(1);
    expect(data[7]).toBe(0);
    expect(Array.from(data.slice(8, 16))).toEqual([150, 160, 90, 255, 240, 180, 190, 255]); // intactos
    expect(data[17]).toBeLessThanOrEqual(100 + 40); // despill do verde intermediário
  });
  it('não toca em mancha de cor-chave longe do fundo removido (fica para o QA acusar)', () => {
    const N = 60, data = new Uint8Array(N * N * 4);
    for (let i = 0; i < N * N; i++) { data[i * 4] = 150; data[i * 4 + 1] = 120; data[i * 4 + 2] = 160; data[i * 4 + 3] = 255; }
    const c = (30 * N + 30) * 4; data[c] = 75; data[c + 1] = 208; data[c + 2] = 54;
    expect(limparResiduoChave(data, { r: 0, g: 255, b: 0 }, N, N).removidos).toBe(0);
    expect(data[c + 3]).toBe(255);
  });
  it('não age quando o fundo não é uma cor-chave saturada', () => {
    const data = new Uint8Array(px(75, 208, 54));
    expect(limparResiduoChave(data, { r: 128, g: 128, b: 128 }, 1, 1)).toEqual({ removidos: 0, corrigidos: 0 });
  });
});
