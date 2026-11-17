import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import catalogJson from '../../src/art/catalog.json';
import { validateArt } from '../../scripts/validate-art.mjs';
import { ASPECTOS_PERMITIDOS, ESPACO, MARGEM_PAGINA, layoutFolha } from '../../scripts/art/lib/grid';
import { lerRaw, removerFundo, estimarFundo, hexRgb } from '../../scripts/art/lib/imaging';
import { PILOTO_ID, PILOTO_IDS, planejar, empacotarGrupos } from '../../scripts/art/lib/planner';
import { guiaSvg, promptMarkdown, textoParaGemini } from '../../scripts/art/lib/prompt';
import { processarPrancha, pastaSaida } from '../../scripts/art/lib/process';
import { montarProposta, aplicarProposta } from '../../scripts/art/lib/integrar';
import type { CatalogFile } from '../../scripts/art/lib/types';
import { FORMAS_PILOTO, gravarPng, sintetizar, tmp } from './art-sinteticos';

const cat = catalogJson as unknown as CatalogFile;
const plano = planejar(cat);
const piloto = plano.lotes.find((l) => l.id === PILOTO_ID)!;

describe('planejador de lotes', () => {
  it('cada um dos 116 recursos do catálogo tem exatamente um destino (lote ou adiado com motivo)', () => {
    const emLotes = plano.lotes.flatMap((l) => l.ids);
    const adiados = plano.adiados.map((a) => a.id);
    expect(new Set(emLotes).size).toBe(emLotes.length); // sem duplicidade
    expect(emLotes.filter((i) => adiados.includes(i))).toEqual([]);
    expect([...emLotes, ...adiados].sort()).toEqual(cat.catalog.map((e) => e.id).sort());
    expect(plano.adiados.every((a) => a.motivo.length > 10)).toBe(true);
  });
  it('o piloto tem exatamente os 6 elementos pedidos, é o primeiro lote e não depende de nada', () => {
    expect(PILOTO_IDS).toEqual(['map.node.locked', 'map.node.available', 'map.node.done', 'map.node.selected', 'map.start', 'map.ribbon.1']);
    expect(plano.lotes[0].id).toBe(PILOTO_ID);
    expect(piloto.ids).toEqual(PILOTO_IDS);
    expect(piloto.dependeDe).toEqual([]);
    expect(piloto.folha!.celulas.map((c) => c.id).sort()).toEqual([...PILOTO_IDS].sort());
  });
  it('as dependências apontam para lotes existentes, sem ciclos; regiões seguem em cadeia', () => {
    const ids = new Set(plano.lotes.map((l) => l.id));
    for (const l of plano.lotes) for (const d of l.dependeDe) { expect(ids.has(d), `${l.id} → ${d}`).toBe(true); expect(plano.lotes.find((x) => x.id === d)!.ordem).toBeLessThan(l.ordem); }
    expect(plano.lotes.find((l) => l.id === 'cenario-regiao-3')!.dependeDe).toEqual(['cenario-regiao-2']);
  });
  it('camadas raster, névoa, animações e variantes ficam adiadas (não se afirma separação confiável de camadas)', () => {
    const a = new Map(plano.adiados.map((x) => [x.id, x.motivo]));
    for (let r = 1; r <= 5; r++) for (const c of ['mid', 'path', 'fg']) expect(a.get(`map.region.${r}.${c}`)).toMatch(/camadas|separa/i);
    expect(a.has('char.bianca.walk')).toBe(true);
    expect(a.has('map.fog')).toBe(true);
  });
  it('cenários: região 1 inclui a base; região 5 inclui o topo; fundos individuais têm proporção permitida', () => {
    expect(plano.lotes.find((l) => l.id === 'cenario-regiao-1')!.cenario).toMatchObject({ comBase: true, comTopo: false, px: { w: 800, h: 1340 } });
    expect(plano.lotes.find((l) => l.id === 'cenario-regiao-5')!.cenario).toMatchObject({ comTopo: true, px: { w: 800, h: 1340 } });
    for (const l of plano.lotes.filter((x) => x.tipo === 'individual')) expect(ASPECTOS_PERMITIDOS.some((a) => a[0] === l.individual!.aspecto[0] && a[1] === l.individual!.aspecto[1])).toBe(true);
  });
  it('Bianca começa estática: um quadro (sprite de 1 quadro) alinhado pela base', () => {
    const b = plano.lotes.find((l) => l.id === 'bianca-estatica')!.folha!.celulas[0].saida;
    expect(b.spriteUmQuadro).toEqual({ frameW: 256, frameH: 256 });
    expect(b.px).toEqual({ w: 256, h: 256 });
    expect(b.alinhamento).toBe('base');
    expect(montarProposta(plano.lotes.find((l) => l.id === 'bianca-estatica')!).assets['char.bianca.idle'].sprite).toMatchObject({ frames: 1, frameW: 256 });
  });
  it('é determinístico e agrupa pranchas até o limite', () => {
    expect(JSON.stringify(planejar(cat))).toBe(JSON.stringify(plano));
    for (const l of plano.lotes.filter((x) => x.tipo === 'prancha' && x.id !== 'bianca-estatica')) expect(l.ids.length).toBeLessThanOrEqual(9);
    const grupos = empacotarGrupos(cat.catalog.filter((e) => e.id.startsWith('ui.tab.')), 4);
    expect(grupos.map((g) => g.length)).toEqual([3, 3, 3]); // 9 abas em partes equilibradas
  });
});

describe('geometria das pranchas', () => {
  const conjuntos: Array<[string, Array<{ id: string; proporcao: number }>]> = [
    ['9 quadrados', Array.from({ length: 9 }, (_, i) => ({ id: `q${i}`, proporcao: 1 }))],
    ['1 quadrado', [{ id: 'a', proporcao: 1 }]],
    ['piloto', piloto.folha!.celulas.map((c) => ({ id: c.id, proporcao: c.saida.px.w / c.saida.px.h }))],
    ['mistura larga', [{ id: 'a', proporcao: 1 }, { id: 'b', proporcao: 2.5 }, { id: 'c', proporcao: 5 }, { id: 'd', proporcao: 0.6 }]],
    ['7 quadrados', Array.from({ length: 7 }, (_, i) => ({ id: `q${i}`, proporcao: 1 }))],
  ];
  it.each(conjuntos)('layout válido: %s', (_n, itens) => {
    const l = layoutFolha(itens);
    expect(ASPECTOS_PERMITIDOS.some((a) => a[0] === l.aspecto[0] && a[1] === l.aspecto[1])).toBe(true);
    expect(l.celulas).toHaveLength(itens.length);
    for (const c of l.celulas) {
      const it = itens.find((i) => i.id === c.id)!;
      expect(c.w / c.h).toBeCloseTo(it.proporcao, 5); // célula com a proporção do recurso final
      expect(c.x).toBeGreaterThanOrEqual(MARGEM_PAGINA - 1e-9);
      expect(c.x + c.w).toBeLessThanOrEqual(1 - MARGEM_PAGINA + 1e-9);
      expect(c.y).toBeGreaterThanOrEqual(MARGEM_PAGINA - 1e-9);
      expect(c.y + c.h).toBeLessThanOrEqual(l.altura - MARGEM_PAGINA + 1e-9);
    }
    for (let i = 0; i < l.celulas.length; i++) for (let j = i + 1; j < l.celulas.length; j++) {
      const a = l.celulas[i], b = l.celulas[j];
      const sep = a.x + a.w <= b.x - ESPACO + 1e-9 || b.x + b.w <= a.x - ESPACO + 1e-9 || a.y + a.h <= b.y - ESPACO + 1e-9 || b.y + b.h <= a.y - ESPACO + 1e-9;
      expect(sep, `${a.id} × ${b.id}`).toBe(true); // sem sobreposição, com espaçamento
    }
  });
  it('uma prancha de 9 quadrados fica em 3×3 numa folha 1:1', () => {
    const l = layoutFolha(conjuntos[0][1]);
    expect(l.aspecto).toEqual([1, 1]);
    expect(new Set(l.celulas.map((c) => c.linha)).size).toBe(3);
  });
});

describe('prompt do Gemini', () => {
  const texto = textoParaGemini(piloto);
  it('incorpora a identidade artística aprovada e o que evitar', () => {
    for (const s of ['Fantasia onírica e poética', 'Aquarela e lápis de cor', 'Formas orgânicas e ligeiramente surreais', 'Paleta delicada, rica e harmoniosa', 'Atmosfera de livro ilustrado', 'jogo mobile']) expect(texto).toContain(s);
  });
  it('descreve a prancha exatamente: proporção, fundo, linhas, células, margem, sem texto', () => {
    const f = piloto.folha!;
    expect(texto).toContain(`${f.aspecto[0]}:${f.aspecto[1]}`);
    expect(texto).toContain(f.fundo);
    expect(texto).toContain(`${f.celulas.length} áreas de conteúdo distribuídas em ${f.linhas.length} faixas horizontais`);
    // as coordenadas do texto vêm dos mesmos retângulos do guia/processamento
    const P = (v: number) => `${Math.round(v * 100)}%`;
    for (const c of f.celulas) expect(texto).toContain(`área ${c.ordem}: x de ${P(c.rect.x)} a ${P(c.rect.x + c.rect.w)}, y de ${P(c.rect.y)} a ${P(c.rect.y + c.rect.h)}`);
    expect(texto).toMatch(/FAIXA 1 \(superior\).*4 áreas lado a lado/);
    expect(texto).toMatch(/FAIXA 2 \(do meio\).*1 área, centralizada/);
    expect(texto).toMatch(/FAIXA 3 \(inferior\)/);
    expect(texto).toMatch(/NENHUM texto, letra, número/);
    expect(texto).toMatch(/folga livre de pelo menos 10%/);
    for (const c of f.celulas) expect(texto).toContain(`  ${c.ordem}. [célula`);
    expect(texto).toMatch(/vão interno deve ser EXATAMENTE a cor do fundo/);
    expect(texto).toMatch(/Responda somente com a imagem/);
  });
  it('lista os anexos (folha de estilo + guia) e é determinístico', () => {
    const md = promptMarkdown(piloto, () => false);
    expect(md).toContain('art-work/referencias/folha-de-estilo.png');
    expect(md).toContain('guia-prancha.png');
    expect(md).toContain('AINDA NÃO ENVIADO');
    expect(promptMarkdown(piloto, () => true)).toContain('✅ presente');
    expect(textoParaGemini(piloto)).toBe(texto);
  });
  it('o guia de posições tem uma célula por recurso, sem texto/números', () => {
    const { svg, largura, altura } = guiaSvg(piloto.folha!);
    expect(altura).toBe(largura);
    expect((svg.match(/stroke-dasharray="14 10"/g) ?? []).length).toBe(6);
    expect(svg).not.toContain('<text');
  });
  it('cenários e fundos pedem fundo sem trilha/casas/texto; prompts distintos por lote', () => {
    const c = textoParaGemini(plano.lotes.find((l) => l.id === 'cenario-regiao-2')!);
    expect(c).toMatch(/NÃO desenhe trilha/);
    expect(c).toMatch(/LIVRE/);
    expect(textoParaGemini(plano.lotes.find((l) => l.id === 'icones-ui-1')!)).not.toBe(texto);
  });
});

describe('remoção de fundo', () => {
  it('estima a cor do fundo pelo contorno e preserva interior parecido com o fundo (não conectado)', async () => {
    const f = piloto.folha!;
    const raw = sintetizar(f, { ...FORMAS_PILOTO, 'map.node.done': { t: 'disco', cor: [60, 230, 70] } }, { largura: 1024, ruido: 3 }); // disco quase verde
    const bg = estimarFundo(raw);
    expect(Math.abs(bg.g - 255)).toBeLessThan(8);
    expect(bg.confianca).toBeGreaterThan(0.95);
    const r = removerFundo(raw, bg);
    const c = f.celulas.find((x) => x.id === 'map.node.done')!;
    const i = (Math.round((c.rect.y + c.rect.h / 2) * raw.height) * raw.width + Math.round((c.rect.x + c.rect.w / 2) * raw.width)) * 4;
    expect(r.rgba[i + 3]).toBe(255); // centro do disco verde continua opaco
    expect(r.rgba[3]).toBe(0); // canto = fundo → transparente
  });
  it('vão do anel (cor do fundo, fechado) vira transparente; borda do anel é preservada', async () => {
    const raw = sintetizar(piloto.folha!, FORMAS_PILOTO, { largura: 1024 });
    const r = removerFundo(raw, estimarFundo(raw));
    const c = piloto.folha!.celulas.find((x) => x.id === 'map.node.selected')!;
    const cx = Math.round((c.rect.x + c.rect.w / 2) * raw.width), cy = Math.round((c.rect.y + c.rect.h / 2) * raw.height);
    expect(r.rgba[(cy * raw.width + cx) * 4 + 3]).toBe(0);
    expect(r.vaos).toBeGreaterThanOrEqual(1);
    const R = 0.72 * Math.min(c.rect.w * raw.width, c.rect.h * raw.height) / 2;
    const noAnel = (cy * raw.width + Math.round(cx + R * 0.86)) * 4;
    expect(r.rgba[noAnel + 3]).toBe(255);
  });
  it('borda suave: alfa intermediário e cor descontaminada (sem franja verde)', () => {
    const raw = sintetizar(piloto.folha!, FORMAS_PILOTO, { largura: 1024 });
    const bg = hexRgb('#00FF00');
    const r = removerFundo(raw, estimarFundo(raw));
    let semi = 0, esverdeados = 0;
    for (let i = 0; i < raw.width * raw.height; i++) { const a = r.rgba[i * 4 + 3]; if (a > 20 && a < 235) { semi++; if (r.rgba[i * 4 + 1] > r.rgba[i * 4] + 60 && r.rgba[i * 4 + 1] > r.rgba[i * 4 + 2] + 60) esverdeados++; } }
    expect(semi).toBeGreaterThan(200);
    expect(esverdeados / semi).toBeLessThan(0.05);
    void bg;
  });
});

describe('processamento de prancha (sintética)', () => {
  async function rodar(formas = FORMAS_PILOTO, extra: Partial<Parameters<typeof sintetizar>[2]> = {}, largura = 1024) {
    const pasta = tmp();
    const raw = sintetizar(piloto.folha!, formas, { largura, ...extra });
    const original = await gravarPng(raw, pasta);
    const res = await processarPrancha({ pastaLote: pasta, lote: piloto, original });
    return { pasta, res, original };
  }
  const status = (r: Awaited<ReturnType<typeof rodar>>, id: string) => r.res.recursos.find((x) => x.id === id)!;

  it('extrai os 6 recursos com nomes oficiais, dimensões exatas, WebP com alfa e QA técnico "ok"', async () => {
    const r = await rodar(FORMAS_PILOTO, { ruido: 4 });
    expect(r.res.recursos).toHaveLength(6);
    for (const c of piloto.folha!.celulas) {
      const q = status(r, c.id);
      expect(q.problemas.filter((p) => p.severidade === 'erro'), c.id).toEqual([]);
      const arq = join(pastaSaida(r.pasta, 'v1'), c.saida.arquivo);
      expect(existsSync(arq)).toBe(true);
      const m = await sharp(arq).metadata();
      expect([m.format, m.width, m.height, m.hasAlpha], c.id).toEqual(['webp', c.saida.px.w, c.saida.px.h, true]);
      expect(statSync(arq).size).toBeLessThanOrEqual(c.saida.maxKB * 1024);
      expect(q.aprovacaoArtistica).toBe('pendente'); // QA nunca aprova arte
    }
    expect(piloto.folha!.celulas.map((c) => c.saida.arquivo)).toEqual(['map/node-locked@2x.webp', 'map/node-available@2x.webp', 'map/node-done@2x.webp', 'map/node-selected@2x.webp', 'map/start@2x.webp', 'map/ribbon-1@2x.webp']);
  });
  it('conteúdo correto: cantos transparentes, centro do disco opaco com a cor original, vão do anel transparente', async () => {
    const r = await rodar();
    const ler = async (id: string) => lerRaw(join(pastaSaida(r.pasta, 'v1'), piloto.folha!.celulas.find((c) => c.id === id)!.saida.arquivo));
    const px = (raw: Awaited<ReturnType<typeof lerRaw>>, x: number, y: number) => Array.from(raw.data.slice((y * raw.width + x) * 4, (y * raw.width + x) * 4 + 4));
    const done = await ler('map.node.done');
    expect(px(done, 2, 2)[3]).toBe(0);
    const centro = px(done, 64, 64);
    expect(centro[3]).toBe(255);
    expect(Math.abs(centro[0] - 235) + Math.abs(centro[1] - 190) + Math.abs(centro[2] - 60)).toBeLessThan(16);
    const anel = await ler('map.node.selected');
    expect(px(anel, 76, 76)[3]).toBe(0); // vão
    expect(anel.width).toBe(152);
  });
  it('escala uniforme: o anel fica 19% maior que o medalhão (152 vs 128), como no catálogo', async () => {
    const r = await rodar();
    const larg = async (id: string) => { const raw = await lerRaw(join(pastaSaida(r.pasta, 'v1'), piloto.folha!.celulas.find((c) => c.id === id)!.saida.arquivo)); let a = raw.width, b = -1; for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) if (raw.data[(y * raw.width + x) * 4 + 3] > 16) { a = Math.min(a, x); b = Math.max(b, x); } return b - a + 1; };
    const razao = (await larg('map.node.selected')) / (await larg('map.node.available'));
    expect(razao).toBeGreaterThan(1.15);
    expect(razao).toBeLessThan(1.23);
  });
  it('o marco inicial pisa na base (alinhamento pela base) e a faixa fica centralizada', async () => {
    const r = await rodar();
    const raw = await lerRaw(join(pastaSaida(r.pasta, 'v1'), 'map/start@2x.webp'));
    let maxY = -1; for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) if (raw.data[(y * raw.width + x) * 4 + 3] > 16) maxY = Math.max(maxY, y);
    expect(maxY).toBeGreaterThan(raw.height - 4);
    const f = await lerRaw(join(pastaSaida(r.pasta, 'v1'), 'map/ribbon-1@2x.webp'));
    let a = f.width, b = -1; for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (f.data[(y * f.width + x) * 4 + 3] > 16) { a = Math.min(a, x); b = Math.max(b, x); }
    expect(Math.abs((a + b) / 2 - f.width / 2)).toBeLessThan(3);
  });
  it('tolera desvio de posição e ruído de compressão', async () => {
    const r = await rodar(FORMAS_PILOTO, { ruido: 7, deriva: { 'map.node.locked': { dx: 14, dy: -10 }, 'map.node.done': { dx: -12, dy: 9 } } });
    expect(r.res.recursos.every((q) => q.status !== 'falha')).toBe(true);
  });
  it('funciona em resoluções diferentes (a grade é proporcional)', async () => {
    const r = await rodar(FORMAS_PILOTO, {}, 2048);
    expect(r.res.recursos.every((q) => q.status === 'ok')).toBe(true);
  });
  it('QA: resolução de origem menor que o arquivo final gera aviso (e não falha)', async () => {
    const r = await rodar(FORMAS_PILOTO, {}, 380);
    expect(r.res.recursos.some((q) => q.problemas.some((p) => p.codigo === 'resolucao-baixa'))).toBe(true);
    expect(r.res.recursos.every((q) => q.status !== 'falha')).toBe(true);
  });
  it('QA: célula vazia vira falha só naquele recurso', async () => {
    const r = await rodar({ ...FORMAS_PILOTO, 'map.node.available': { t: 'vazio' } });
    expect(status(r, 'map.node.available').status).toBe('falha');
    expect(status(r, 'map.node.available').problemas[0].codigo).toBe('celula-vazia');
    expect(status(r, 'map.node.done').status).not.toBe('falha');
  });
  it('QA: objeto cortado pela borda da imagem é detectado', async () => {
    const r = await rodar(FORMAS_PILOTO, { deriva: { 'map.node.locked': { dx: -90, dy: -50 } } });
    const q = status(r, 'map.node.locked');
    expect(q.problemas.map((p) => p.codigo)).toEqual(expect.arrayContaining(['cortado-imagem']));
    expect(q.status).toBe('falha');
  });
  it('QA: objeto que invade a célula vizinha gera aviso', async () => {
    const r = await rodar({ ...FORMAS_PILOTO, 'map.node.done': { t: 'disco', cor: [235, 190, 60], frac: 1.22 } });
    expect(status(r, 'map.node.done').problemas.map((p) => p.codigo)).toContain('invade-celula');
  });
  it('QA: resíduos da cor do fundo dentro do objeto geram aviso para revisão', async () => {
    const r = await rodar({ ...FORMAS_PILOTO, 'map.node.locked': { t: 'disco-com-manchas', cor: [150, 140, 175], fundo: [0, 255, 0] } });
    const q = status(r, 'map.node.locked');
    expect(q.problemas.map((p) => p.codigo)).toContain('residuo-fundo');
    expect(q.status).not.toBe('ok');
  });
  it('elemento fora da grade e resíduos pequenos são sinalizados sem derrubar os recursos', async () => {
    const r = await rodar(FORMAS_PILOTO, { extras: [{ x: 60, y: 520, r: 30, cor: [80, 80, 200] }, { x: 700, y: 420, r: 1.5, cor: [10, 10, 10] }] });
    expect(r.res.avisosGerais.join(' ')).toMatch(/fora da grade|resíduo/);
    expect(r.res.recursos.every((q) => q.status !== 'falha')).toBe(true);
  });
  it('proporção muito diferente da pedida é recusada com mensagem clara', async () => {
    const pasta = tmp();
    const p = await gravarPng(sintetizar({ ...piloto.folha!, aspecto: [4, 3] }, FORMAS_PILOTO, { largura: 1024 }), pasta);
    await expect(processarPrancha({ pastaLote: pasta, lote: piloto, original: p })).rejects.toThrow(/proporção/);
  });
  it('imagem já transparente não passa por remoção de fundo (aviso)', async () => {
    const pasta = tmp();
    const raw = sintetizar(piloto.folha!, FORMAS_PILOTO, { largura: 1024 });
    const bg = removerFundo(raw, estimarFundo(raw));
    const p = await gravarPng({ data: bg.rgba, width: raw.width, height: raw.height }, pasta);
    const res = await processarPrancha({ pastaLote: pasta, lote: piloto, original: p });
    expect(res.avisosGerais.join(' ')).toMatch(/já possui transparência/);
    expect(res.recursos.every((q) => q.status !== 'falha')).toBe(true);
  });
  it('a saída passa na validação técnica já existente (validate-art) com a proposta de manifesto', async () => {
    const r = await rodar(FORMAS_PILOTO, { ruido: 3 });
    const manifesto = aplicarProposta({ schema: 1, activePack: null, packs: {} }, montarProposta(piloto));
    const v = validateArt({ manifest: manifesto, catalog: cat, publicDir: join(r.pasta, 'saida', 'art') });
    expect(v.errors).toEqual([]);
    expect(Object.keys(manifesto.packs.v1.assets)).toEqual(PILOTO_IDS);
    expect(JSON.parse(readFileSync(join(r.pasta, 'celulas', 'map.node.done.png')).length ? '"ok"' : '"x"')).toBe('ok'); // intermediário gravado para auditoria
  });
});
