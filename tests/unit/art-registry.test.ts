import { describe, expect, it } from 'vitest';
import catalog from '../../src/art/catalog.json';
import { createArtRegistry, manifest as bundledManifest, normalizeBase, pickPack, resolveArtUrl } from '../../src/art/registry';
import type { ArtManifest, DefaultSlot } from '../../src/art/types';
import fixture from '../fixtures/art/manifest.json';

const defaults = catalog.defaults as unknown as Record<string, DefaultSlot>;
const fx = fixture as unknown as ArtManifest;

describe('resolução de caminhos (independente do caminho-base do GitHub Pages)', () => {
  it.each([
    ['/', '/art/v1/map/a@2x.webp'],
    ['/Fab4/', '/Fab4/art/v1/map/a@2x.webp'],
    ['/Fab4', '/Fab4/art/v1/map/a@2x.webp'],
    ['./', './art/v1/map/a@2x.webp'],
    ['https://u.github.io/Fab4/', 'https://u.github.io/Fab4/art/v1/map/a@2x.webp'],
    ['', '/art/v1/map/a@2x.webp'],
  ])('base %j → %s', (base, expected) => {
    expect(resolveArtUrl(base, 'v1', 'map/a@2x.webp')).toBe(expected);
  });
  it('normaliza barras e acrescenta ?v= quando há revisão', () => {
    expect(normalizeBase(undefined)).toBe('/');
    expect(resolveArtUrl('/Fab4/', '/v1/', '/map/a.webp', 'abc123')).toBe('/Fab4/art/v1/map/a.webp?v=abc123');
  });
  it('o mesmo manifesto resolve para qualquer base sem alteração de dados', () => {
    const a = createArtRegistry({ manifest: fx, defaults, base: '/' }).resolve('map.region.1.bg')!;
    const b = createArtRegistry({ manifest: fx, defaults, base: '/Fab4/' }).resolve('map.region.1.bg')!;
    expect(a.url).toBe('/art/test/map/region-1-bg@2x.png');
    expect(b.url).toBe('/Fab4/art/test/map/region-1-bg@2x.png');
  });
});

describe('escolha do pacote (versionamento e reversão)', () => {
  it('usa o activePack; ?artpack= pré-visualiza outro pacote ou desativa a arte', () => {
    expect(pickPack(fx)).toBe('test');
    expect(pickPack(fx, '?artpack=alt')).toBe('alt');
    expect(pickPack(fx, '?artpack=none')).toBeNull();
    expect(pickPack(fx, '?artpack=inexistente')).toBe('test'); // ignora nomes desconhecidos
    expect(pickPack({ ...fx, activePack: 'fantasma' })).toBeNull();
  });
  it('reverter = trocar activePack: o outro pacote passa a valer sem tocar no código', () => {
    const v1 = createArtRegistry({ manifest: fx, defaults, base: '/', packName: 'test' });
    const v2 = createArtRegistry({ manifest: fx, defaults, base: '/', packName: 'alt' });
    expect(v1.resolve('ui.icon.coin')).toBeNull();
    expect(v2.resolve('ui.icon.coin')!.url).toBe('/art/alt/ui/icon-coin.svg');
    expect(v2.resolve('ui.tab.map')).toBeNull();
  });
});

describe('registro de recursos por ID lógico', () => {
  const reg = createArtRegistry({ manifest: fx, defaults, base: '/Fab4/', rev: 'r1' });
  it('devolve o primeiro candidato registrado (variante → genérico)', () => {
    expect(reg.resolve(['map.node.1.done', 'map.node.done'])!.id).toBe('map.node.done');
    expect(reg.resolveAll(['map.node.done', 'map.node.available', 'map.node.zzz']).map((a) => a.id)).toEqual(['map.node.done', 'map.node.available']);
  });
  it('aplica padrões do catálogo (tamanho, âncora, sprite) e acrescenta a revisão na URL', () => {
    const idle = reg.resolve('char.bianca.idle')!;
    expect(idle.kind).toBe('sprite');
    expect(idle.sprite).toMatchObject({ frames: 6, frameW: 256, frameH: 256 });
    expect(idle.anchor).toEqual({ x: 0.5, y: 0.875 });
    expect(idle.box).toEqual({ w: 72, h: 72 });
    expect(idle.url).toBe('/Fab4/art/test/char/bianca-idle@2x.png?v=r1');
    expect(reg.resolve('map.node.done')!.box).toEqual({ w: 64, h: 64 });
  });
  it('IDs ausentes, listas vazias e nulos → null (o componente usa o fallback)', () => {
    expect(reg.resolve('map.region.5.bg')).toBeNull();
    expect(reg.resolve([])).toBeNull();
    expect(reg.resolve(null)).toBeNull();
    expect(reg.resolve(undefined)).toBeNull();
  });
  it('sobrescritas do manifesto prevalecem sobre o catálogo', () => {
    const m: ArtManifest = { schema: 1, activePack: 'p', packs: { p: { dir: 'p', assets: { 'map.node.done': { file: 'x.png', box: { w: 10, h: 12 }, anchor: { x: 0, y: 1 }, offset: { x: 2, y: 3 } } } } } };
    const a = createArtRegistry({ manifest: m, defaults, base: '/' }).resolve('map.node.done')!;
    expect(a).toMatchObject({ box: { w: 10, h: 12 }, anchor: { x: 0, y: 1 }, offset: { x: 2, y: 3 } });
  });
  it('all() lista o pacote ativo (base do pré-aquecimento offline); sem pacote, nada', () => {
    expect(reg.all().length).toBe(Object.keys(fx.packs.test.assets).length);
    expect(createArtRegistry({ manifest: fx, defaults, base: '/', packName: null }).all()).toEqual([]);
    expect(createArtRegistry({ manifest: fx, defaults, base: '/', packName: null }).enabled).toBe(false);
  });
});

describe('visual atual como fallback por padrão', () => {
  it('sem pacote selecionado (?artpack=none) o app usa só o visual atual, mesmo com pacote integrado', () => {
    expect(createArtRegistry({ manifest: bundledManifest, defaults, base: '/Fab4/', packName: null }).enabled).toBe(false);
    expect(pickPack(bundledManifest, '?artpack=none')).toBeNull();
  });
});
