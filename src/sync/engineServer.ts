import { mergeBackup, type BackupFile, type RestoreReport } from '../domain/backup';
import { applyOp } from '../domain/engine';
import { emptyState } from '../domain/selectors';
import type { CampaignState, Op, OpOutcome, Role } from '../domain/types';
import type { Backend, ServerSnapshot } from './backend';
import { NetworkError } from './backend';
import type { KV } from '../storage/kv';

/**
 * "Servidor" em memória que usa o MESMO motor das funções SQL (paridade testada).
 * Serve ao modo demonstração (persistido em IndexedDB) e aos testes de sincronização multi-aparelho.
 */
export class EngineServer {
  state: CampaignState;
  applied = new Map<string, OpOutcome>();
  constructor(state?: CampaignState, id = 'demo-campaign', name = 'Reino de Demonstração') {
    this.state = state ?? emptyState(id, name);
  }
  submit(op: Op, ctx: { role: Role; userId: string }): OpOutcome {
    const prev = this.applied.get(op.opId);
    if (prev) return { status: 'ok', duplicate: true, info: 'replayed' };
    const r = applyOp(this.state, op, { ...ctx, now: new Date().toISOString() });
    if (r.outcome.status === 'ok') {
      this.state = r.state;
      this.applied.set(op.opId, r.outcome);
    }
    return r.outcome;
  }
  snapshot(role: Role): ServerSnapshot {
    return { ...structuredClone(this.state), role };
  }
  restore(backup: BackupFile): RestoreReport {
    const r = mergeBackup(this.state, backup);
    this.state = r.state;
    return r.report;
  }
  toJSON() {
    return { state: this.state, applied: [...this.applied.keys()] };
  }
  static fromJSON(j: { state: CampaignState; applied: string[] }) {
    const s = new EngineServer(j.state);
    for (const k of j.applied) s.applied.set(k, { status: 'ok' });
    return s;
  }
}

/** Controle de rede simulada (testes). */
export class FakeNet {
  online = true;
  calls = 0;
}

export class EngineBackend implements Backend {
  constructor(
    readonly kind: 'demo' | 'cloud',
    readonly server: EngineServer,
    readonly userId: string,
    public role: Role = 'guardian',
    private net: FakeNet = new FakeNet(),
    private kv?: KV,
    private persistKey = 'demo:server',
  ) {}
  private guard() {
    if (!this.net.online) throw new NetworkError();
    this.net.calls++;
  }
  private async persist() {
    if (this.kv) await this.kv.set(this.persistKey, this.server.toJSON());
  }
  async fetchSnapshot() {
    this.guard();
    return this.server.snapshot(this.role);
  }
  async submit(op: Op) {
    this.guard();
    const o = this.server.submit(op, { role: this.role, userId: this.userId });
    await this.persist();
    return o;
  }
  async restoreBackup(b: BackupFile) {
    this.guard();
    if (this.role !== 'guardian') throw new Error('forbidden');
    const r = this.server.restore(b);
    await this.persist();
    return r;
  }
}
