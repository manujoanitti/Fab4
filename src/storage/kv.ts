// Armazenamento local chave→valor sobre IndexedDB (com fallback em memória quando indisponível).
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  readonly persistent: boolean;
}

export function memoryKV(): KV {
  const m = new Map<string, unknown>();
  return {
    persistent: false,
    async get<T>(k: string) { const v = m.get(k); return v === undefined ? undefined : (structuredClone(v) as T); },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async del(k) { m.delete(k); },
    async keys(p = '') { return [...m.keys()].filter((k) => k.startsWith(p)); },
  };
}

const STORE = 'kv';
export function idbKV(dbName = 'reino-bianca'): KV {
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise((res, rej) => {
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  // Escritas só resolvem quando a transação COMMITA (oncomplete): garante durabilidade antes de confirmar na tela.
  const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const r = f(t.objectStore(STORE));
      t.oncomplete = () => res(r.result);
      t.onerror = () => rej(t.error ?? r.error);
      t.onabort = () => rej(t.error ?? new Error('transação abortada'));
    });
  };
  return {
    persistent: true,
    get: <T,>(k: string) => tx<T | undefined>('readonly', (s) => s.get(k)),
    set: async (k, v) => void (await tx('readwrite', (s) => s.put(v, k))),
    del: async (k) => void (await tx('readwrite', (s) => s.delete(k))),
    keys: async (p = '') => (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String).filter((k) => k.startsWith(p)),
  };
}

export function defaultKV(dbName?: string): KV {
  try {
    if (typeof indexedDB !== 'undefined') return idbKV(dbName);
  } catch {
    /* cai para memória */
  }
  return memoryKV();
}
