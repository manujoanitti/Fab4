import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BackupFile, RestoreReport } from '../domain/backup';
import type { Op, OpOutcome } from '../domain/types';
import { FatalSyncError, NetworkError, type Backend, type ServerSnapshot } from './backend';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Verdadeiro quando o build recebeu a URL e a chave PÚBLICA (anon) do Supabase. */
export const cloudConfigured = Boolean(url && anon);

let client: SupabaseClient | null = null;
export function getClient(): SupabaseClient {
  if (!url || !anon) throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  return (client ??= createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }));
}

export function mapError(e: { message?: string; code?: string; status?: number } | null): Error {
  const msg = e?.message ?? 'Erro desconhecido';
  if ((typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(msg) || e?.status === 0)
    return new NetworkError();
  if (/jwt|not authenticated|expired/i.test(msg) || e?.code === '28000') return new FatalSyncError('Sessão expirada. Entre novamente.', e?.code);
  if (e?.code === '42501') return new FatalSyncError('Você não participa desta campanha.', e.code);
  return new Error(msg);
}

export class SupabaseBackend implements Backend {
  readonly kind = 'cloud' as const;
  constructor(private sb: SupabaseClient, private campaignId: string, readonly userId: string) {}
  async fetchSnapshot(): Promise<ServerSnapshot> {
    const { data, error } = await this.sb.rpc('get_snapshot', { p_campaign: this.campaignId });
    if (error) throw mapError(error);
    return data as ServerSnapshot;
  }
  async submit(op: Op): Promise<OpOutcome> {
    const { data, error } = await this.sb.rpc('apply_op', { p_campaign: this.campaignId, p_op: op });
    if (error) throw mapError(error);
    return data as OpOutcome;
  }
  async restoreBackup(b: BackupFile): Promise<RestoreReport> {
    const { data, error } = await this.sb.rpc('restore_backup', { p_campaign: this.campaignId, p_payload: b });
    if (error) throw mapError(error);
    const { skippedDifferent, ...inserted } = data as Record<string, number>;
    return { inserted, skippedDifferent: skippedDifferent ?? 0 };
  }
}

export interface CampaignRow { id: string; name: string; role: 'guardian' | 'child' }
export const cloud = {
  async session() {
    const { data } = await getClient().auth.getSession();
    return data.session;
  },
  onAuth(cb: () => void) {
    return getClient().auth.onAuthStateChange(() => cb()).data.subscription;
  },
  async signIn(email: string, password: string) {
    const { error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },
  async signUp(email: string, password: string) {
    const { data, error } = await getClient().auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  },
  async signOut() {
    await getClient().auth.signOut();
  },
  async campaigns(): Promise<CampaignRow[]> {
    const { data, error } = await getClient().rpc('list_my_campaigns');
    if (error) throw mapError(error);
    return (data ?? []) as CampaignRow[];
  },
  async createCampaign(name: string): Promise<string> {
    const { data, error } = await getClient().rpc('create_campaign', { p_name: name });
    if (error) throw mapError(error);
    return data as string;
  },
  async createInvite(campaignId: string, role: 'guardian' | 'child'): Promise<string> {
    const { data, error } = await getClient().rpc('create_invite', { p_campaign: campaignId, p_role: role });
    if (error) throw mapError(error);
    return data as string;
  },
  async redeemInvite(code: string): Promise<string> {
    const { data, error } = await getClient().rpc('redeem_invite', { p_code: code.trim() });
    if (error) throw new Error('Convite inválido ou expirado.');
    return data as string;
  },
};
