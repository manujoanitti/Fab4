import { describe, expect, it } from 'vitest';
import { FatalSyncError, NetworkError } from '../../src/sync/backend';
import { SupabaseBackend, mapError } from '../../src/sync/cloud';

const fakeClient = (res: { data?: unknown; error?: { message: string; code?: string } | null }) =>
  ({ rpc: async () => ({ data: res.data ?? null, error: res.error ?? null }) }) as never;

describe('cliente Supabase (mapeamento de erros e RPC)', () => {
  it('classifica falhas de rede, sessão expirada e não-membro', () => {
    expect(mapError({ message: 'TypeError: Failed to fetch' })).toBeInstanceOf(NetworkError);
    expect(mapError({ message: 'JWT expired' })).toBeInstanceOf(FatalSyncError);
    expect(mapError({ message: 'not a campaign member', code: '42501' })).toBeInstanceOf(FatalSyncError);
    const other = mapError({ message: 'algo inesperado' });
    expect(other).not.toBeInstanceOf(NetworkError);
    expect(other.message).toBe('algo inesperado');
  });
  it('chama get_snapshot/apply_op/restore_backup e repassa o resultado', async () => {
    const calls: [string, unknown][] = [];
    const sb = { rpc: async (fn: string, args: unknown) => { calls.push([fn, args]); return { data: fn === 'restore_backup' ? { medals: 2, skippedDifferent: 1 } : { status: 'ok' }, error: null }; } } as never;
    const be = new SupabaseBackend(sb, 'camp-1', 'user-1');
    expect(await be.submit({ opId: 'x', at: '', type: 'grant_medal', date: '2026-03-02' })).toEqual({ status: 'ok' });
    await be.fetchSnapshot();
    const r = await be.restoreBackup({ format: 'reino-bianca-backup', schemaVersion: 1, exportedAt: '', demo: false, state: {} as never });
    expect(r).toEqual({ inserted: { medals: 2 }, skippedDifferent: 1 });
    expect(calls.map((c) => c[0])).toEqual(['apply_op', 'get_snapshot', 'restore_backup']);
    expect(calls[0][1]).toMatchObject({ p_campaign: 'camp-1' });
  });
  it('erro de rede no RPC vira NetworkError (operação permanece na fila)', async () => {
    const be = new SupabaseBackend(fakeClient({ error: { message: 'Failed to fetch' } }), 'c', 'u');
    await expect(be.fetchSnapshot()).rejects.toBeInstanceOf(NetworkError);
  });
});
