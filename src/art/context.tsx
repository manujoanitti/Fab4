import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { createBrowserLoader, type ArtLoader } from './loader';
import { createDefaultRegistry, type ArtRegistry } from './registry';
import type { ResolvedArt } from './types';

export interface ArtEnv { registry: ArtRegistry; loader: ArtLoader }
let defaultEnv: ArtEnv | null = null;
/** Ambiente padrão (lazy): registro do manifesto empacotado + pré-carregador do navegador. */
export const getDefaultEnv = (): ArtEnv => (defaultEnv ??= { registry: createDefaultRegistry(), loader: createBrowserLoader() });

const ArtCtx = createContext<ArtEnv | null>(null);
export const useArtEnv = (): ArtEnv => useContext(ArtCtx) ?? getDefaultEnv();

/** Sobrescreve registro/carregador (testes, pré-visualização). Sem Provider, vale o ambiente padrão. */
export function ArtProvider({ registry, loader, children }: { registry?: ArtRegistry; loader?: ArtLoader; children: ReactNode }) {
  const base = getDefaultEnv();
  const value = useMemo(() => ({ registry: registry ?? base.registry, loader: loader ?? base.loader }), [registry, loader, base]);
  return <ArtCtx.Provider value={value}>{children}</ArtCtx.Provider>;
}

/**
 * Resolve um ID lógico (ou lista de candidatos) para arte pronta para uso.
 * Retorna null quando não há arte registrada OU ela ainda não carregou/falhou → o componente desenha o fallback.
 */
export function useArt(ids: string | readonly string[] | null | undefined, priority: 'high' | 'low' = 'high'): ResolvedArt | null {
  const { registry, loader } = useArtEnv();
  const key = ids == null ? '' : typeof ids === 'string' ? ids : ids.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => registry.resolveAll(ids), [registry, key]);
  useSyncExternalStore(loader.subscribe, loader.version, () => 0);
  useEffect(() => { candidates.forEach((c, i) => loader.load(c.url, i === 0 ? priority : 'low')); }, [candidates, loader, priority]);
  // primeiro candidato já carregado (ex.: variante da região; senão a genérica; enquanto carrega, o fallback)
  return candidates.find((c) => loader.status(c.url) === 'ok') ?? null;
}
