import { describe, expect, it } from 'vitest';
import { artTextSpot } from '../../src/art/components';
import { createArtRegistry } from '../../src/art/registry';
import type { ArtManifest } from '../../src/art/types';

const manifest: ArtManifest = {
  schema: 1, activePack: 'p',
  packs: { p: { dir: 'p', assets: {
    'map.ribbon.1': { file: 'map/ribbon-1@2x.webp', box: { w: 360, h: 48 }, slice: { l: 0.3, r: 0.3 }, textArea: { x: 0.27, y: 0.25, w: 0.46, h: 0.38 } },
    'map.start': { file: 'map/start@2x.webp', box: { w: 192, h: 128 }, offset: { x: -14, y: 0 }, textArea: { x: 0.4, y: 0.16, w: 0.24, h: 0.27 } },
  } } },
};
const defaults = { 'map.ribbon.1': { kind: 'image' as const, box: { w: 240, h: 48 }, anchor: { x: 0.5, y: 0.5 } }, 'map.start': { kind: 'image' as const, box: { w: 96, h: 64 }, anchor: { x: 0.5, y: 1 } } };
const reg = createArtRegistry({ manifest, defaults, base: '/', packName: 'p' });

describe('textArea e fatias do manifesto', () => {
  it('a faixa em fatias tem o texto centrado e a largura da área cresce com a caixa (pontas ficam na escala nativa)', () => {
    const art = reg.resolve('map.ribbon.1')!;
    expect(art.slice).toEqual({ l: 0.3, r: 0.3 });
    expect(art.nativeBox).toEqual({ w: 240, h: 48 });
    const spot = artTextSpot(art, { x: 0, y: 0 })!;
    expect(spot.cx).toBeCloseTo(0, 6);
    // pontas nativas (0.27*240 = 64,8 de cada lado até a área de texto) → área = 360 − 2·64,8
    expect(spot.w).toBeCloseTo(360 - 2 * 0.27 * 240, 6);
    expect(spot.w).toBeGreaterThan(215); // cabe "Etapa 1 · Floresta dos Sonhos" (≈ 215 px)
    expect(spot.cy).toBeCloseTo((0.25 + 0.19 - 0.5) * 48, 6);
  });
  it('sem textArea (ou sem arte) não há posição: o app mantém o texto onde estava', () => {
    expect(artTextSpot(null, { x: 0, y: 0 })).toBeNull();
    const semArea = createArtRegistry({ manifest: { ...manifest, packs: { p: { dir: 'p', assets: { 'map.start': { file: 'x@2x.webp' } } } } }, defaults, base: '/', packName: 'p' }).resolve('map.start');
    expect(artTextSpot(semArea, { x: 0, y: 46 })).toBeNull();
  });
  it('marco Início: texto na placa, deslocado pelo offset do manifesto, com a base do poste na âncora', () => {
    const art = reg.resolve('map.start')!;
    const spot = artTextSpot(art, { x: 0, y: 46 })!;
    const x0 = 0 - 0.5 * 192 - 14, y0 = 46 - 1 * 128;
    expect(spot.cx).toBeCloseTo(x0 + (0.4 + 0.12) * 192, 6);
    expect(spot.cy).toBeCloseTo(y0 + (0.16 + 0.135) * 128, 6);
  });
});
