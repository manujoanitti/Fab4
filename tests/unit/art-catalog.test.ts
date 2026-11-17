import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '../../src/art/catalog.json';
import { ART, CSS_ART, GAME_IDS, GOAL_STATUS_IDS, STAGES, SYNC_IDS, TAB_IDS } from '../../src/art/ids';
import { GAMES } from '../../src/domain/rules';
import { GARDEN_ITEMS } from '../../src/games/gardenCatalog';
import { SYMBOL_SLUGS } from '../../src/games/crystalSymbols';
import { LOT_TITLES, renderCatalogDoc, type Catalog } from '../../scripts/lib/catalog-doc';

const entries = catalog.catalog as Array<{ id: string; stem: string; kind: string; formats: string[]; px: { w: number; h: number }; sheet?: { w: number; h: number }; sprite?: { frames: number; frameW: number; frameH: number }; priority: string; lot: number; transparent: boolean }>;
const ids = new Set(entries.map((e) => e.id));

/** Todos os IDs que o código pode pedir (expansão das funções de ids.ts). */
function codeIds(): Set<string> {
  const s = new Set<string>([ART.map.topBg, ART.map.bottomBg, ART.map.fog, ART.map.start, ART.fx.sparkle, ART.fx.nodeComplete, ART.crown, ART.game.starsStar, ART.game.starsHit, ART.game.crystalsBack, ...Object.values(ART.icon)]);
  for (const st of STAGES) {
    [ART.map.regionBg(st), ART.map.regionMid(st), ART.map.regionPath(st), ART.map.regionFg(st), ART.map.ribbon(st), ...ART.map.nodeSelected(st)].forEach((i) => s.add(i));
    for (const state of ['locked', 'available', 'done'] as const) ART.map.node(st, state).forEach((i) => s.add(i));
  }
  [true, false].forEach((u) => s.add(ART.map.bonus(u)));
  (['idle', 'walk', 'celebrate'] as const).forEach((a) => s.add(ART.char.bianca(a)));
  TAB_IDS.forEach((t) => s.add(ART.tab(t === 'achievements' ? 'achievements' : t)));
  GOAL_STATUS_IDS.forEach((x) => s.add(ART.status(x)));
  SYNC_IDS.forEach((x) => s.add(ART.sync(x)));
  (['stage', 'final'] as const).forEach((k) => s.add(ART.celebration(k)));
  GAME_IDS.forEach((g) => s.add(ART.game.icon(g)));
  Object.values(SYMBOL_SLUGS).forEach((x) => s.add(ART.game.crystalsSymbol(x)));
  GARDEN_ITEMS.forEach((i) => s.add(ART.game.gardenItem(i.slug)));
  CSS_ART.forEach((c) => s.add(c.id));
  return s;
}

describe('catálogo de recursos (contrato gráfico)', () => {
  it('IDs únicos, no padrão e com nomes de arquivo únicos', () => {
    expect(ids.size).toBe(entries.length);
    for (const e of entries) expect(e.id, e.id).toMatch(/^[a-z0-9]+(\.[a-z0-9-]+)+$/);
    expect(new Set(entries.map((e) => e.stem)).size).toBe(entries.length);
  });
  it('todo ID pedido pelo código existe no catálogo, e todo item do catálogo tem um ponto de uso no código', () => {
    const used = codeIds();
    const missing = [...used].filter((i) => !ids.has(i));
    const orphan = [...ids].filter((i) => !used.has(i));
    expect({ missing, orphan }).toEqual({ missing: [], orphan: [] });
  });
  it('padrões de runtime (defaults) são derivados do catálogo', () => {
    const d = catalog.defaults as Record<string, { kind: string }>;
    expect(Object.keys(d).sort()).toEqual([...ids].sort());
    for (const e of entries) expect(d[e.id].kind, e.id).toBe(e.kind);
  });
  it('sprites: tira = quadros × largura do quadro; recursos de mapa têm tamanho e âncora', () => {
    for (const e of entries.filter((x) => x.kind === 'sprite')) {
      expect(e.sheet).toEqual({ w: e.sprite!.frames * e.sprite!.frameW, h: e.sprite!.frameH });
      expect(e.formats).not.toContain('svg');
    }
    const d = catalog.defaults as Record<string, { box?: unknown; anchor?: unknown }>;
    for (const e of entries.filter((x) => /^(map|char|fx)\./.test(x.id))) { expect(d[e.id].box, e.id).toBeTruthy(); expect(d[e.id].anchor, e.id).toBeTruthy(); }
  });
  it('transparência/prioridade/lote coerentes (fundos opacos; camadas e ícones com alfa)', () => {
    for (const e of entries) {
      if (/\.bg$/.test(e.id) && e.id.startsWith('map.')) expect(e.transparent, e.id).toBe(false);
      if (/\.(mid|path|fg)$/.test(e.id) || e.id.startsWith('ui.icon.') || e.id.startsWith('char.')) expect(e.transparent, e.id).toBe(true);
      expect(['P0', 'P1', 'P2']).toContain(e.priority);
      expect(LOT_TITLES[e.lot], e.id).toBeTruthy();
    }
  });
  it('minigames: slugs do código ↔ catálogo (jardim, símbolos, ícones dos jogos)', () => {
    expect(entries.filter((e) => e.id.startsWith('game.garden.item.')).map((e) => e.id.split('.').pop()).sort()).toEqual(GARDEN_ITEMS.map((i) => i.slug).sort());
    expect(entries.filter((e) => e.id.startsWith('game.crystals.symbol.')).map((e) => e.id.split('.').pop()).sort()).toEqual(Object.values(SYMBOL_SLUGS).sort());
    expect(GAMES.map((g) => ART.game.icon(g.id)).every((i) => ids.has(i))).toBe(true);
  });
  it('o catálogo em Markdown (docs/arte/catalogo-recursos.md) está atualizado em relação ao JSON', () => {
    const file = readFileSync(join(__dirname, '../../docs/arte/catalogo-recursos.md'), 'utf8');
    expect(file).toBe(renderCatalogDoc(catalog as unknown as Catalog));
  });
});
