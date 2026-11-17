import catalog from './catalog.json';
import manifestJson from './manifest.json';
import type { ArtEntry, ArtManifest, ArtPack, DefaultSlot, LayoutOverride, ResolvedArt } from './types';

/** Garante barra final; aceita "/", "/Fab4", "/Fab4/", "./" ou URL absoluta. */
export function normalizeBase(base: string | undefined): string {
  let b = (base ?? '/').trim() || '/';
  if (!b.endsWith('/')) b += '/';
  return b;
}
/** URL final de um arquivo do pacote — independente do caminho-base do GitHub Pages. */
export function resolveArtUrl(base: string, packDir: string, file: string, rev = ''): string {
  const clean = (s: string) => s.replace(/^\/+/, '').replace(/\/+$/, '');
  return `${normalizeBase(base)}art/${clean(packDir)}/${clean(file)}${rev ? `?v=${encodeURIComponent(rev)}` : ''}`;
}

/** Escolhe o pacote: ?artpack=none desativa; ?artpack=<nome> pré-visualiza outro pacote do manifesto; padrão = activePack. */
export function pickPack(manifest: ArtManifest, search = ''): string | null {
  const q = new URLSearchParams(search).get('artpack');
  if (q === 'none') return null;
  if (q && manifest.packs[q]) return q;
  return manifest.activePack && manifest.packs[manifest.activePack] ? manifest.activePack : null;
}

export interface ArtRegistry {
  readonly packName: string | null;
  readonly enabled: boolean;
  /** Primeiro ID (da lista de candidatos) registrado no pacote ativo, ou null → usar fallback. */
  resolve(ids: string | readonly string[] | null | undefined): ResolvedArt | null;
  /** Todos os candidatos registrados, na ordem de preferência. */
  resolveAll(ids: string | readonly string[] | null | undefined): ResolvedArt[];
  /** Todos os recursos do pacote ativo (para pré-carga/cache offline). */
  all(): ResolvedArt[];
  layout(): LayoutOverride | undefined;
}

export interface RegistryOptions {
  manifest: ArtManifest;
  defaults: Record<string, DefaultSlot>;
  base: string;
  packName?: string | null;
  rev?: string;
}
export function createArtRegistry({ manifest, defaults, base, packName, rev = '' }: RegistryOptions): ArtRegistry {
  const name = packName === undefined ? pickPack(manifest) : packName;
  const pack: ArtPack | null = name ? (manifest.packs[name] ?? null) : null;
  const build = (id: string, e: ArtEntry): ResolvedArt => {
    const d = defaults[id];
    return {
      id,
      url: resolveArtUrl(base, pack!.dir, e.file, rev),
      kind: e.kind ?? d?.kind ?? 'image',
      box: e.box ?? d?.box,
      anchor: e.anchor ?? d?.anchor ?? { x: 0.5, y: 0.5 },
      offset: e.offset ?? { x: 0, y: 0 },
      sprite: e.sprite ?? d?.sprite,
    };
  };
  const cache = new Map<string, ResolvedArt | null>();
  return {
    packName: pack ? name : null,
    enabled: !!pack,
    resolve(ids) { return this.resolveAll(ids)[0] ?? null; },
    resolveAll(ids) {
      if (!pack || !ids) return [];
      const out: ResolvedArt[] = [];
      for (const id of typeof ids === 'string' ? [ids] : ids) {
        if (!cache.has(id)) cache.set(id, pack.assets[id] ? build(id, pack.assets[id]) : null);
        const r = cache.get(id);
        if (r) out.push(r);
      }
      return out;
    },
    all: () => (pack ? Object.entries(pack.assets).map(([id, e]) => build(id, e)) : []),
    layout: () => pack?.layout,
  };
}

declare const __ART_REV__: string | undefined;
export const catalogDefaults = (catalog as { defaults: Record<string, DefaultSlot> }).defaults;
export const manifest = manifestJson as unknown as ArtManifest;

export function createDefaultRegistry(search = typeof location !== 'undefined' ? location.search : ''): ArtRegistry {
  return createArtRegistry({
    manifest,
    defaults: catalogDefaults,
    base: import.meta.env.BASE_URL,
    packName: pickPack(manifest, search),
    rev: typeof __ART_REV__ === 'string' ? __ART_REV__ : '',
  });
}
