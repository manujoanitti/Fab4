import { applyOp } from '../domain/engine';
import { newId, type OpInput } from '../domain/ops';
import { checkRestoreTarget, type BackupFile, type RestoreReport } from '../domain/backup';
import type { CampaignState, Op, OpOutcome, Role } from '../domain/types';
import type { KV } from '../storage/kv';
import { NetworkError, type Backend, type ServerSnapshot } from './backend';

export interface QueueItem {
  op: Op;
  status: 'pending' | 'conflict' | 'rejected';
  outcome?: OpOutcome;
  createdAt: string;
}
export type SyncStatus = 'loading' | 'synced' | 'syncing' | 'pending' | 'offline' | 'conflict' | 'error';
export interface SyncView {
  server: CampaignState | null; // último estado confirmado pelo servidor
  view: CampaignState | null; // servidor + alterações pendentes (otimista)
  queue: QueueItem[];
  role: Role;
  status: SyncStatus;
  online: boolean;
  lastSyncAt?: string;
  error?: string;
}

/**
 * Cache local + fila de alterações + sincronização.
 * - O servidor (Supabase) é a fonte oficial; o estado local é um cache com overlay otimista.
 * - Operações carregam opId (idempotência) e são reenviadas até confirmação.
 * - Conflitos nunca sobrescrevem: ficam na fila (status "conflict") até o responsável reconciliar.
 */
export class SyncManager {
  private listeners = new Set<() => void>();
  private flushing: Promise<void> | null = null;
  private v: SyncView = { server: null, view: null, queue: [], role: 'child', status: 'loading', online: true };
  private ns: string;

  constructor(private backend: Backend, private kv: KV, campaignId: string) {
    this.ns = `${backend.kind}:${campaignId}`;
  }

  get kind() { return this.backend.kind; }
  getView = (): SyncView => this.v;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  private emit(patch: Partial<SyncView>) {
    this.v = { ...this.v, ...patch };
    this.v.view = this.computeView();
    this.v.status = this.computeStatus();
    for (const l of this.listeners) l();
  }
  private computeView(): CampaignState | null {
    if (!this.v.server) return null;
    let s = this.v.server;
    // Operações já confirmadas, cujo efeito ainda não veio no snapshot, continuam visíveis (sem "piscar").
    const ops = [...this.acked, ...this.v.queue.filter((q) => q.status === 'pending').map((q) => q.op)];
    for (const op of ops) {
      const r = applyOp(s, op, { role: this.v.role, userId: this.backend.userId, now: op.at, optimistic: true });
      if (r.outcome.status === 'ok') s = r.state;
    }
    return s;
  }
  private computeStatus(): SyncStatus {
    const { server, queue, online, error } = this.v;
    if (!server) return error ? 'error' : online ? 'loading' : 'offline';
    if (error) return 'error';
    if (queue.some((q) => q.status === 'conflict')) return 'conflict';
    if (this.flushing && online) return 'syncing';
    if (!online) return 'offline';
    if (queue.some((q) => q.status === 'pending')) return 'pending';
    return 'synced';
  }

  private async persist() {
    await this.kv.set(`snap:${this.ns}`, { server: this.v.server, role: this.v.role, lastSyncAt: this.v.lastSyncAt });
    await this.kv.set(`queue:${this.ns}`, this.v.queue);
  }

  /** Carrega o cache local (mostra algo imediatamente, inclusive offline) e tenta atualizar. */
  async init(): Promise<void> {
    const snap = await this.kv.get<{ server: CampaignState; role: Role; lastSyncAt?: string }>(`snap:${this.ns}`);
    const queue = (await this.kv.get<QueueItem[]>(`queue:${this.ns}`)) ?? [];
    if (snap?.server) this.emit({ server: snap.server, role: snap.role, lastSyncAt: snap.lastSyncAt, queue });
    else this.emit({ queue });
    await this.sync();
  }

  private rerun = false;
  private acked: Op[] = [];
  /** Envia a fila e atualiza o estado a partir do servidor. Chamadas durante uma sincronização geram uma nova rodada. */
  sync(): Promise<void> {
    if (this.flushing) {
      this.rerun = true;
      return this.flushing;
    }
    this.flushing = (async () => {
      try {
        do {
          this.rerun = false;
          await this.syncOnce();
        } while (this.rerun);
      } finally {
        this.flushing = null;
        this.emit({});
      }
    })();
    this.emit({});
    return this.flushing;
  }
  /** Aguarda o fim de qualquer sincronização em andamento. */
  async idle(): Promise<void> {
    while (this.flushing) await this.flushing;
  }

  private async syncOnce() {
    this.emit({ error: undefined });
    try {
      await this.flushQueue();
      const snap: ServerSnapshot = await this.backend.fetchSnapshot();
      const { role, ...server } = snap;
      this.acked = [];
      this.emit({ server, role, online: true, lastSyncAt: new Date().toISOString() });
      await this.persist();
    } catch (e) {
      if (e instanceof NetworkError) this.emit({ online: false });
      else this.emit({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  private async flushQueue() {
    const tried = new Set<string>();
    for (;;) {
      const it = this.v.queue.find((q) => q.status === 'pending' && !tried.has(q.op.opId));
      if (!it) break;
      tried.add(it.op.opId);
      const outcome = await this.backend.submit(it.op); // NetworkError interrompe e mantém a fila
      if (outcome.status === 'ok') {
        this.acked.push(it.op);
        this.emit({ queue: this.v.queue.filter((q) => q !== it) });
      }
      else {
        it.status = outcome.status === 'conflict' ? 'conflict' : 'rejected';
        it.outcome = outcome;
        this.emit({});
      }
      await this.persist();
    }
  }

  /**
   * Executa uma ação do usuário: valida otimisticamente, enfileira, persiste e tenta sincronizar.
   * Retorna a rejeição imediata (ex.: sem créditos) sem enfileirar.
   */
  async act(input: OpInput): Promise<OpOutcome> {
    const view = this.v.view;
    if (!view) return { status: 'rejected', code: 'invalid', message: 'Dados ainda não carregados.' };
    const op = { ...input, opId: newId(), at: new Date().toISOString() } as Op;
    const pre = applyOp(view, op, { role: this.v.role, userId: this.backend.userId, now: op.at, optimistic: true });
    if (pre.outcome.status === 'rejected') return pre.outcome;
    if (pre.outcome.status === 'ok' && pre.outcome.duplicate) return pre.outcome; // nada a fazer
    // Durabilidade primeiro: a fila é gravada (transação confirmada) ANTES de a tela mostrar o efeito otimista.
    this.v = { ...this.v, queue: [...this.v.queue, { op, status: 'pending', createdAt: op.at }] };
    await this.persist();
    this.emit({});
    void this.sync();
    return { status: 'ok' };
  }

  // ---- Reconciliação ----
  /** Mantém o valor do servidor e descarta a alteração local em conflito. */
  async resolveKeepServer(opId: string) {
    this.emit({ queue: this.v.queue.filter((q) => q.op.opId !== opId) });
    await this.persist();
  }
  /** Reaplica a alteração local por cima da versão atual do servidor (decisão explícita do usuário). */
  async resolveUseMine(opId: string) {
    const it = this.v.queue.find((q) => q.op.opId === opId);
    if (!it || it.outcome?.status !== 'conflict') return;
    const serverVersion = it.outcome.serverVersion;
    const op = { ...it.op, opId: newId(), expectedVersion: serverVersion } as Op;
    this.emit({ queue: this.v.queue.map((q) => (q === it ? { op, status: 'pending' as const, createdAt: new Date().toISOString() } : q)) });
    await this.persist();
    await this.sync();
  }
  async dismiss(opId: string) {
    this.emit({ queue: this.v.queue.filter((q) => q.op.opId !== opId) });
    await this.persist();
  }

  async restoreBackup(b: BackupFile): Promise<RestoreReport> {
    const err = checkRestoreTarget(b, this.backend.kind);
    if (err) throw new Error(err);
    const r = await this.backend.restoreBackup(b);
    await this.sync();
    return r;
  }
  /** Limpa o cache local desta campanha (não afeta o servidor). */
  async clearLocal() {
    await this.kv.del(`snap:${this.ns}`);
    await this.kv.del(`queue:${this.ns}`);
  }
}
