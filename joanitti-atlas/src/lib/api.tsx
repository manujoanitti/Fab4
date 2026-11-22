import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildIndex, type Index, type Snap } from './model';

const KEY = 'atlas_token';
export const getToken = (): string | null => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const setToken = (t: string | null) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* sem storage: sessão apenas em memória */ } };

export class ApiError extends Error { constructor(public status: number, message: string, public details: string[] = []) { super(message); } }
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; raw?: boolean } = {}): Promise<T> {
  const t = getToken();
  const res = await fetch(`/api${path}`, { method: opts.method ?? 'GET', headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  if (opts.raw) return res as any;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText, data.details ?? []);
  return data as T;
}
export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  if (!res.ok) throw new ApiError(res.status, 'Falha no download');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

interface Ctx { snap: Snap | null; ix: Index | null; loading: boolean; error: string | null; admin: boolean; preview: boolean; setPreview: (v: boolean) => void; refresh: () => Promise<void>; login: (token: string) => Promise<boolean>; logout: () => void }
const AtlasCtx = createContext<Ctx>(null as any);
export const useAtlas = () => useContext(AtlasCtx);

export function AtlasProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [preview, setPreview] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const a = await api<{ admin: boolean }>('/auth/check').catch(() => ({ admin: false }));
      setAdmin(a.admin);
      setSnap(await api<Snap>(`/snapshot${preview ? '?view=public' : ''}`));
      setError(null);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [preview]);
  useEffect(() => { void refresh(); }, [refresh]);
  const login = useCallback(async (token: string) => { setToken(token); try { const a = await api<{ admin: boolean }>('/auth/check'); if (!a.admin) throw new Error(); await refresh(); return true; } catch { setToken(null); setAdmin(false); return false; } }, [refresh]);
  const logout = useCallback(() => { setToken(null); setAdmin(false); setPreview(false); void refresh(); }, [refresh]);
  const ix = useMemo(() => (snap ? buildIndex(snap) : null), [snap]);
  return <AtlasCtx.Provider value={{ snap, ix, loading, error, admin, preview, setPreview, refresh, login, logout }}>{children}</AtlasCtx.Provider>;
}
