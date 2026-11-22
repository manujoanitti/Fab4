// Backup/restauração lossless (JSON estruturado) — preserva proveniência, hipóteses e investigações integralmente.
import type { Db } from '../db/connection';
import { ValidationError } from '../repo';

export const TABLE_ORDER = ['nucleus', 'place', 'person', 'person_name', 'person_occupation', 'person_nucleus', 'research_group', 'research_group_member',
  'identity_link', 'relationship', 'source', 'source_person', 'source_place', 'event', 'event_person', 'historical_context', 'claim', 'claim_entity', 'claim_history',
  'evidence', 'surname_variant', 'investigation', 'investigation_hypothesis', 'investigation_entity', 'investigation_task', 'investigation_log',
  'report', 'import_run', 'provenance', 'review_item', 'change_log', 'import_state'];

export function dumpAll(db: Db) {
  const tables: Record<string, any[]> = {};
  for (const t of TABLE_ORDER) tables[t] = db.all(`SELECT * FROM ${t}`);
  return { format: 'joanitti-atlas-backup', version: 1, exportedAt: new Date().toISOString(), counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), tables };
}

function sortPlaces(rows: any[]) {
  const out: any[] = [], seen = new Set<string>(), by = new Map(rows.map((r) => [r.id, r]));
  const visit = (r: any, depth = 0) => { if (seen.has(r.id) || depth > 20) return; if (r.parent_id && by.has(r.parent_id)) visit(by.get(r.parent_id), depth + 1); seen.add(r.id); out.push(r); };
  rows.forEach((r) => visit(r)); return out;
}

export function restoreAll(db: Db, dump: any) {
  if (dump?.format !== 'joanitti-atlas-backup' || typeof dump.tables !== 'object') throw new ValidationError(['Arquivo não é um backup do Joanitti Atlas.']);
  return db.tx(() => {
    for (const t of [...TABLE_ORDER].reverse()) db.run(`DELETE FROM ${t}`);
    let total = 0;
    for (const t of TABLE_ORDER) {
      let rows: any[] = dump.tables[t] ?? [];
      if (t === 'place') rows = sortPlaces(rows);
      for (const r of rows) {
        const cols = Object.keys(r);
        db.run(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => r[c]));
        total++;
      }
    }
    return { restored: total };
  });
}
