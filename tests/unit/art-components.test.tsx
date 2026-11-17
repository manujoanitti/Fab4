import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Icon, SpriteStrip, SvgArt } from '../../src/art/components';
import { ArtProvider } from '../../src/art/context';
import { ART } from '../../src/art/ids';
import { createStaticLoader } from '../../src/art/loader';
import { createArtRegistry } from '../../src/art/registry';
import catalog from '../../src/art/catalog.json';
import type { ArtManifest, ArtStatus, DefaultSlot } from '../../src/art/types';
import MapView from '../../src/ui/MapView';
import { completeUpTo, fresh } from './helpers';
import fixture from '../fixtures/art/manifest.json';

const defaults = catalog.defaults as unknown as Record<string, DefaultSlot>;
const fx = fixture as unknown as ArtManifest;
const registry = createArtRegistry({ manifest: fx, defaults, base: '/Fab4/' });
const noLayout: ArtManifest = { ...fx, packs: { ...fx.packs, test: { ...fx.packs.test, layout: undefined } } };
const registryNoLayout = createArtRegistry({ manifest: noLayout, defaults, base: '/Fab4/' });
const norm = (html: string) => html.replace(/<!-- -->/g, '').replace(/></g, '>\n<') + '\n';
const render = (el: ReactElement, status: ArtStatus | null, reg = registry) =>
  renderToStaticMarkup(status ? <ArtProvider registry={reg} loader={createStaticLoader({}, status)}>{el}</ArtProvider> : el);
const noop = () => {};
const s7 = completeUpTo(fresh(), 7);

describe('Icon: arte por ID lógico com fallback', () => {
  it('sem pacote/arte → exatamente o fallback (ex.: emoji)', () => {
    expect(norm(renderToStaticMarkup(<span><Icon id="ui.icon.coin" fallback="🪙" /> 3</span>))).toBe('<span>🪙 3</span>\n');
  });
  it('arte registrada mas AINDA não carregada ou com ERRO → fallback (nunca imagem quebrada)', () => {
    for (const st of ['idle', 'queued', 'loading', 'error'] as const)
      expect(render(<Icon id={ART.icon.stampSmall} fallback="⭐" />, st), st).toBe('⭐');
  });
  it('arte carregada → <img> decorativo apontando para o caminho com a base do Pages', () => {
    const html = render(<Icon id={ART.icon.stampSmall} fallback="⭐" />, 'ok');
    expect(html).toContain('<img src="/Fab4/art/test/ui/icon-stamp-small.svg"');
    expect(html).toContain('class="art-icon"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-art="ui.icon.stamp-small"');
    expect(html).not.toContain('⭐');
  });
  it('ID sem arte no pacote continua no fallback mesmo com carregador "ok"', () => {
    expect(render(<Icon id={ART.icon.coin} fallback="🪙" />, 'ok')).toBe('🪙');
    expect(render(<Icon id={null} fallback="❓" />, 'ok')).toBe('❓');
  });
  it('alt informado torna a imagem acessível', () => {
    expect(render(<Icon id={ART.icon.stampSmall} fallback="⭐" alt="Selo pequeno" />, 'ok')).toContain('alt="Selo pequeno"');
  });
});

describe('SvgArt / SpriteStrip: posicionamento por âncora', () => {
  const svg = (el: ReactElement, st: ArtStatus | null = 'ok') => render(<svg>{el}</svg>, st);
  it('ponto lógico + âncora central + tamanho do catálogo (64×64)', () => {
    const html = svg(<SvgArt ids={ART.map.node(1, 'done')} at={{ x: 200, y: 100 }} />);
    expect(html).toContain('x="168"');
    expect(html).toContain('y="68"');
    expect(html).toContain('width="64"');
    expect(html).toContain('href="/Fab4/art/test/map/node-done@2x.png"');
  });
  it('retângulo exato (faixas de fundo) ignora a âncora', () => {
    const html = svg(<SvgArt ids={ART.map.regionBg(1)} rect={{ x: 0, y: 2290, w: 400, h: 540 }} />);
    expect(html).toMatch(/x="0"[^>]*y="2290"[^>]*width="400"[^>]*height="540"/);
    expect(html).toContain('preserveAspectRatio="none"');
  });
  it('sem arte → fallback; sem tamanho conhecido → fallback', () => {
    expect(svg(<SvgArt ids="map.region.5.bg" rect={{ x: 0, y: 0, w: 1, h: 1 }} fallback={<rect id="fb" />} />)).toContain('<rect id="fb"></rect>');
    expect(svg(<SvgArt ids={ART.map.node(1, 'done')} at={{ x: 1, y: 1 }} fallback={<rect id="fb" />} />, 'idle')).toContain('<rect id="fb"></rect>');
    expect(svg(<SvgArt ids={ART.game.starsStar} at={{ x: 1, y: 1 }} fallback={<rect id="fb2" />} />)).toContain('<rect id="fb2"></rect>'); // sem box no catálogo
  });
  it('sprite: tira horizontal animada por CSS (steps = nº de quadros), âncora nos pés', () => {
    const html = svg(<SvgArt ids={ART.char.bianca('idle')} at={{ x: 0, y: 22 }} />);
    expect(html).toContain('viewBox="0 0 256 256"');
    expect(html).toContain('width="1536"'); // 6 quadros × 256
    expect(html).toContain('steps(6) infinite');
    expect(html).toContain('--art-shift:-1536px');
    expect(html).toContain('x="-36"'); // 0 − 0,5·72
    expect(html).toContain('y="-41"'); // 22 − 0,875·72 = −41
  });
  it('sprite sem laço usa quadros−1 passos e termina no último quadro', () => {
    const art = registry.resolve('char.bianca.idle')!;
    const html = renderToStaticMarkup(<SpriteStrip art={art} w={10} h={10} once />);
    expect(html).toContain('steps(5) 1 forwards');
    expect(html).toContain('--art-shift:-1280px');
  });
});

describe('MapView com arte: estados, eventos e acessibilidade preservados', () => {
  const map = (st: ArtStatus | null, selected: number | null = null) => render(<MapView state={s7} onSelect={noop} onBonus={noop} selected={selected} />, st);

  it('arte registrada, mas não carregada/erro → marcação IDÊNTICA ao golden do visual atual', () => {
    const golden = readFileSync(join(__dirname, '../golden/map-7.html'), 'utf8');
    for (const st of ['idle', 'loading', 'error'] as const)
      expect(norm(render(<MapView state={s7} onSelect={noop} onBonus={noop} />, st, registryNoLayout)), st).toBe(golden);
  });
  it('com arte carregada: fundo, trilha e marcos viram imagens; fallbacks correspondentes saem', () => {
    const html = map('ok');
    expect(html).toContain('data-art="map.region.1.bg"');
    expect(html).toContain('data-art="map.region.1.path"');
    expect(html).not.toContain('url(#rg1)'); // gradiente da região 1 substituído
    expect(html).toContain('url(#rg2)'); // regiões sem arte mantêm o desenho atual
    expect(html).toContain('clip-path="url(#trail-clip)"'); // trilha padrão recortada onde há arte de trilha
    expect(html).toContain('data-art="map.node.done"');
    expect(html).toContain('data-art="map.node.available"');
    expect(html).toContain('data-art="map.node.locked"');
    expect(html).not.toContain('class="node-star"'); // a estrela da casa concluída vem da arte
  });
  it('atributos de teste, papéis, rótulos e estados das casas não mudam', () => {
    const html = map('ok');
    for (let p = 1; p <= 25; p++) expect(html).toContain(`data-testid="phase-${p}"`);
    expect((html.match(/role="button"/g) ?? []).length).toBe(26); // 25 casas + bônus
    expect(html).toContain('aria-label="Fase 1.1, concluída"');
    expect(html).toContain('aria-label="Fase 2.3, próxima fase"');
    expect(html).toContain('aria-label="Fase 5.5, bloqueada"');
    expect((html.match(/data-state="done"/g) ?? []).length).toBe(7);
    expect((html.match(/data-state="next"/g) ?? []).length).toBe(1);
    expect(html).toContain('data-testid="bianca"');
    expect(html).toContain('data-testid="bonus-node"');
    for (let s = 1; s <= 5; s++) expect(html).toContain(`data-testid="region-${s}"`);
  });
  it('área de toque inalterada com arte: círculo transparente r=28 em cada casa', () => {
    expect((map('ok').match(/<circle r="28" fill="transparent"><\/circle>/g) ?? []).length).toBe(25);
  });
  it('rótulos de texto continuam sendo do app (número da casa, nome da região, "Início")', () => {
    const html = map('ok');
    expect(html).toContain('class="node-label"');
    expect(html).toMatch(/class="node-label" fill="#37474f" stroke="#fff"/); // legível sobre qualquer arte
    expect(html).toContain('Etapa 1 · Floresta dos Sonhos');
    expect(html).toContain('>Início<');
    expect(html).toContain('>Bônus final<');
  });
  it('estado "selecionado" é atributo próprio e não altera os demais estados', () => {
    const html = map('ok', 3);
    expect(html).toMatch(/data-testid="phase-3"[^>]*data-state="done"[^>]*data-selected="true"/);
    expect((html.match(/data-selected="true"/g) ?? []).length).toBe(1);
    expect(map('idle', null)).not.toContain('data-selected');
  });
  it('layout do pacote reposiciona a casa 1; as demais permanecem', () => {
    const html = map('ok');
    expect(html).toContain('transform="translate(100,2700)" class="node done  "');
    expect(html).toContain('transform="translate(275,2666.25)"'); // casa 1.2 inalterada
  });
  it('o personagem usa o sprite de idle e mantém data-at', () => {
    const html = map('ok');
    expect(html).toMatch(/data-testid="bianca" data-at="7"[^>]*>.*steps\(6\) infinite/);
  });
  it('sem registro (padrão do app), o visual é exatamente o atual', () => {
    const golden = readFileSync(join(__dirname, '../golden/map-7.html'), 'utf8');
    expect(norm(renderToStaticMarkup(<MapView state={s7} onSelect={noop} onBonus={noop} />))).toBe(golden);
  });
});
