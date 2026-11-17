import type { ArtStatus } from './types';

/**
 * Pré-carregador de imagens com estado por URL. A arte só é exibida depois de carregada (status "ok"); enquanto isso,
 * ou se falhar (arquivo ausente, rede, offline sem cache), o fallback atual continua visível — nunca há imagem quebrada.
 */
export interface ArtLoader {
  status(url: string): ArtStatus;
  load(url: string, priority?: 'high' | 'low'): void;
  subscribe(cb: () => void): () => void;
  version(): number;
  /** Tenta de novo as URLs que falharam (ex.: ao voltar a conexão). */
  retry(): void;
}

export function createBrowserLoader(opts: { lowConcurrency?: number } = {}): ArtLoader {
  const state = new Map<string, ArtStatus>();
  const prio = new Map<string, 'high' | 'low'>();
  const queue: string[] = [];
  const subs = new Set<() => void>();
  let ver = 0;
  let scheduled = false;
  let activeLow = 0;
  const max = opts.lowConcurrency ?? 3;
  const canLoad = typeof Image !== 'undefined';

  const notify = () => {
    ver++;
    if (scheduled) return;
    scheduled = true;
    const run = () => { scheduled = false; subs.forEach((f) => f()); };
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 0);
  };
  const set = (url: string, s: ArtStatus) => { state.set(url, s); notify(); };
  const start = (url: string) => {
    set(url, 'loading');
    const isLow = prio.get(url) === 'low';
    if (isLow) activeLow++;
    const img = new Image();
    img.decoding = 'async';
    const done = (ok: boolean) => {
      if (isLow) { activeLow--; pump(); }
      set(url, ok ? 'ok' : 'error');
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  };
  const pump = () => {
    while (activeLow < max && queue.length) {
      const url = queue.shift()!;
      if (state.get(url) === 'queued') start(url);
    }
  };
  const loader: ArtLoader = {
    status: (url) => state.get(url) ?? 'idle',
    version: () => ver,
    subscribe(cb) { subs.add(cb); return () => void subs.delete(cb); },
    load(url, priority = 'high') {
      if (!canLoad) return;
      const cur = state.get(url);
      if (cur === 'ok' || cur === 'loading' || cur === 'error') return;
      if (priority === 'high') { prio.set(url, 'high'); start(url); return; } // sobe a prioridade se estava na fila
      if (cur === 'queued') return;
      prio.set(url, 'low');
      state.set(url, 'queued');
      queue.push(url);
      (typeof requestIdleCallback === 'function' ? requestIdleCallback : (f: () => void) => setTimeout(f, 800))(() => pump());
    },
    retry() {
      for (const [url, s] of [...state]) if (s === 'error') { state.delete(url); loader.load(url, prio.get(url) ?? 'high'); }
    },
  };
  return loader;
}

/** Carregador determinístico para testes/SSR: status fixos, sem rede. */
export function createStaticLoader(statuses: Record<string, ArtStatus> = {}, fallbackStatus: ArtStatus = 'idle'): ArtLoader {
  return {
    status: (u) => statuses[u] ?? fallbackStatus,
    load() {},
    subscribe: () => () => {},
    version: () => 0,
    retry() {},
  };
}
