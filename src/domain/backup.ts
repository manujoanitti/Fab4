import { RULES, TOTAL_PHASES } from './rules';
import { isDateStr } from './selectors';
import type { CampaignState } from './types';

export const BACKUP_FORMAT = 'reino-bianca-backup';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  demo: boolean;
  state: CampaignState;
}
export interface RestoreReport {
  inserted: Record<string, number>;
  skippedDifferent: number;
}

export function exportBackup(state: CampaignState, opts: { demo: boolean; now?: string }): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: opts.now ?? new Date().toISOString(),
    demo: opts.demo,
    state: structuredClone(state),
  };
}

const arr = (v: unknown) => (Array.isArray(v) ? v : null);
const GOAL_IDS = [...RULES.goals, ...RULES.specialGoals].map((g) => g.id);

/** Valida o formato de um backup importado (texto JSON ou objeto). Nunca lança. */
export function validateBackup(input: unknown): { ok: true; backup: BackupFile } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  let b: any = input;
  if (typeof input === 'string') {
    try { b = JSON.parse(input); } catch { return { ok: false, errors: ['Arquivo não é um JSON válido.'] }; }
  }
  if (!b || typeof b !== 'object') return { ok: false, errors: ['Conteúdo inválido.'] };
  if (b.format !== BACKUP_FORMAT) errors.push('Formato desconhecido (não é um backup do Reino da Bianca).');
  if (b.schemaVersion !== BACKUP_SCHEMA_VERSION) errors.push(`Versão de esquema não suportada: ${String(b.schemaVersion)}.`);
  const s = b.state;
  if (!s || typeof s !== 'object') errors.push('Backup sem estado.');
  else {
    for (const k of ['goalReviews', 'history', 'medals', 'phases', 'rewardEvents', 'creditEvents', 'sessions', 'gameStates'])
      if (!arr(s[k])) errors.push(`Lista ausente ou inválida: ${k}.`);
    if (!errors.length) {
      for (const g of s.goalReviews) if (!isDateStr(g.date) || !GOAL_IDS.includes(g.goalId) || !['pending', 'done', 'not_done', 'not_evaluated'].includes(g.status) || !Number.isInteger(g.version)) errors.push('Registro de meta inválido.');
      for (const m of s.medals) if (!isDateStr(m.date)) errors.push('Medalha com data inválida.');
      for (const p of s.phases) if (!Number.isInteger(p.phase) || p.phase < 1 || p.phase > TOTAL_PHASES) errors.push('Fase inválida.');
      for (const e of s.rewardEvents) if (typeof e.key !== 'string' || typeof e.kind !== 'string') errors.push('Evento de recompensa inválido.');
      for (const e of s.creditEvents) if (typeof e.key !== 'string' || !Number.isInteger(e.amount)) errors.push('Evento de crédito inválido.');
      for (const e of s.sessions) if (typeof e.id !== 'string' || typeof e.gameId !== 'string') errors.push('Sessão inválida.');
    }
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)].slice(0, 8) };
  return { ok: true, backup: b as BackupFile };
}

/** Mescla um backup sem duplicar nem sobrescrever (espelha public.restore_backup no PostgreSQL). */
export function mergeBackup(state: CampaignState, backup: BackupFile): { state: CampaignState; report: RestoreReport } {
  const s: CampaignState = structuredClone(state);
  const src = backup.state;
  const inserted: Record<string, number> = {};
  const add = <T,>(name: string, target: T[], incoming: T[], keyOf: (x: T) => string) => {
    const have = new Set(target.map(keyOf));
    let n = 0;
    for (const x of incoming) if (!have.has(keyOf(x))) { target.push(structuredClone(x)); have.add(keyOf(x)); n++; }
    inserted[name] = n;
  };
  const empty = s.phases.length === 0 && s.medals.length === 0;
  add('medals', s.medals, src.medals, (m) => m.date);
  add('phases', s.phases, src.phases, (p) => String(p.phase));
  add('rewardEvents', s.rewardEvents, src.rewardEvents, (e) => e.key);
  add('creditEvents', s.creditEvents, src.creditEvents, (e) => e.key);
  add('sessions', s.sessions, src.sessions, (e) => e.id);
  add('history', s.history, src.history, (h) => h.opId);
  let skipped = 0;
  const haveGoal = new Map(s.goalReviews.map((g) => [`${g.date}|${g.goalId}`, g]));
  let ng = 0;
  for (const g of src.goalReviews) {
    const cur = haveGoal.get(`${g.date}|${g.goalId}`);
    if (!cur) { s.goalReviews.push(structuredClone(g)); ng++; } else if (cur.status !== g.status) skipped++;
  }
  inserted.goalReviews = ng;
  for (const g of src.gameStates) {
    const cur = s.gameStates.find((x) => x.gameId === g.gameId);
    if (!cur) s.gameStates.push(structuredClone(g));
    else if (JSON.stringify(cur.data) !== JSON.stringify(g.data)) skipped++;
  }
  if (empty && src.settings) s.settings = { ...src.settings };
  return { state: s, report: { inserted, skippedDifferent: skipped } };
}

/** Isolamento: backup de demonstração só restaura em demonstração, e vice-versa. */
export function checkRestoreTarget(b: BackupFile, kind: 'demo' | 'cloud'): string | null {
  if (b.demo && kind === 'cloud') return 'Este backup é de demonstração e não pode ser restaurado em uma campanha real.';
  if (!b.demo && kind === 'demo') return 'Backups reais não podem ser restaurados no modo demonstração.';
  return null;
}
