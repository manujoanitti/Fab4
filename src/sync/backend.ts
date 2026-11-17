import type { BackupFile, RestoreReport } from '../domain/backup';
import type { CampaignState, Op, OpOutcome, Role } from '../domain/types';

export type ServerSnapshot = CampaignState & { role: Role };

/** Erro de rede/indisponibilidade: a operação deve permanecer na fila e ser reenviada depois. */
export class NetworkError extends Error {
  constructor(message = 'Sem conexão com o servidor') {
    super(message);
    this.name = 'NetworkError';
  }
}
/** Erro não recuperável (ex.: usuário não é membro da campanha, sessão expirada). */
export class FatalSyncError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'FatalSyncError';
  }
}

export interface Backend {
  readonly kind: 'demo' | 'cloud';
  readonly userId: string;
  fetchSnapshot(): Promise<ServerSnapshot>;
  submit(op: Op): Promise<OpOutcome>;
  restoreBackup(backup: BackupFile): Promise<RestoreReport>;
}
