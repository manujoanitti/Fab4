// Repositório genérico: CRUD validado + histórico de mudanças (change_log). Nunca apaga registros históricos
// principais (arquivamento reversível). Sub-registros (nomes, evidências, tarefas…) são removidos de forma
// registrada no change_log (com o conteúdo anterior), portanto recuperáveis.
import { randomUUID } from 'node:crypto';
import type { Db } from './db/connection';
import { validateFuzzyDate, parsePartial } from '../shared/dates';
import { validateRelationship, type RelLite, type PersonLite } from '../shared/integrity';
import { STATUS_RANK, type Status } from '../shared/types';

export interface Ctx { actor: string }
export class ValidationError extends Error {
  status = 400;
  constructor(public details: string[]) { super(details.join(' | ')); }
}
export class NotFoundError extends Error { status = 404; }

export interface EntityDef {
  table: string; prefix: string; cols: string[]; json?: string[]; required?: string[];
  soft: boolean; stamps: boolean;
}
const D = (p: string) => [`${p}_from`, `${p}_to`, `${p}_precision`, `${p}_text`];
const mk = (table: string, prefix: string, cols: string[], o: Partial<EntityDef> = {}): EntityDef =>
  ({ table, prefix, cols, soft: true, stamps: true, ...o });

export const ENTITIES: Record<string, EntityDef> = {
  person: mk('person', 'per', ['preferred_name', 'given_names', 'surname', 'sex', 'living_status', ...D('birth'), 'birth_place_id', ...D('death'), 'death_place_id',
    'biography', 'verification_status', 'reported_status', 'status_rationale', 'identity_note', 'notes', 'external_ids', 'avatar_url', 'import_key'],
    { json: ['external_ids'], required: ['preferred_name'] }),
  place: mk('place', 'pl', ['parent_id', 'level', 'name', 'historic_names', 'lat', 'lon', 'coord_precision', 'coord_verified', 'coord_note', 'description', 'notes', 'import_key'],
    { json: ['historic_names'], required: ['name', 'level'] }),
  nucleus: mk('nucleus', 'nuc', ['name', 'kind', 'description', 'color', 'sort', 'import_key'], { required: ['name'] }),
  relationship: mk('relationship', 'rel', ['type', 'subtype', 'person_a', 'person_b', 'status', 'reported_status', 'status_rationale', 'confidence', ...D('date'), 'place_id', 'notes', 'import_key'],
    { required: ['type', 'person_a', 'person_b'] }),
  event: mk('event', 'ev', ['type', 'title', 'description', ...D('date'), 'place_id', 'place_note', 'status', 'reported_status', 'status_rationale', 'is_route_speculative', 'route_to_place_id', 'notes', 'import_key'],
    { required: ['type', 'title'] }),
  source: mk('source', 'src', ['kind', 'doc_type', 'title', 'institution', 'url', 'extra_urls', 'archival_ref', 'page_ref', 'produced_date', 'consulted_date', 'excerpt', 'transcription', 'local_file',
    'access_status', 'reliability', 'reliability_note', 'notes', 'import_key'], { json: ['extra_urls'], required: ['kind', 'title'] }),
  claim: mk('claim', 'cl', ['code', 'kind', 'content', 'status', 'reported_status', 'confidence', 'justification', 'contradictions', 'import_key'], { required: ['content'] }),
  investigation: mk('investigation', 'inv', ['title', 'question', 'description', 'status', 'priority', 'conclusion', 'import_key'], { required: ['title', 'question'] }),
  research_group: mk('research_group', 'grp', ['nucleus_id', 'name', 'description', 'import_key'], { required: ['name'] }),
  // sub-registros (remoção registrada)
  person_name: mk('person_name', 'pn', ['person_id', 'name', 'kind', 'historic_surname', 'note'], { soft: false, stamps: false, required: ['person_id', 'name'] }),
  person_occupation: mk('person_occupation', 'oc', ['person_id', 'title', 'period_text', 'place_id', 'status', 'note', 'import_key'], { soft: false, stamps: false, required: ['person_id', 'title'] }),
  evidence: mk('evidence', 'evd', ['subject_type', 'subject_id', 'source_id', 'stance', 'excerpt', 'note', 'import_key'], { soft: false, required: ['subject_type', 'subject_id', 'source_id'], stamps: false }),
  investigation_task: mk('investigation_task', 'tsk', ['investigation_id', 'claim_id', 'kind', 'text', 'institution', 'status', 'sort', 'import_key'], { soft: false, stamps: false, required: ['investigation_id', 'kind', 'text'] }),
  identity_link: mk('identity_link', 'idl', ['person_a', 'person_b', 'status', 'note', 'import_key'], { soft: false, stamps: false, required: ['person_a', 'person_b'] }),
  surname_variant: mk('surname_variant', 'sn', ['form', 'family_group', 'status', 'attested_places', 'period_text', 'linguistic_note', 'import_key'], { soft: false, stamps: false, required: ['form'] }),
  historical_context: mk('historical_context', 'hc', ['title', 'description', 'year_from', 'year_to', 'country', 'origin', 'import_key'], { soft: false, stamps: false, required: ['title', 'year_from'] }),
};
export const ENTITY_TYPE_OF_TABLE: Record<string, string> = Object.fromEntries(Object.entries(ENTITIES).map(([k, v]) => [v.table, k]));

const now = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;

const pack = (def: EntityDef, data: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const c of def.cols) if (c in data) {
    let v = data[c];
    if (v === '') v = null;
    if (def.json?.includes(c) && v !== null && typeof v !== 'string') v = JSON.stringify(v);
    out[c] = v ?? null;
  }
  return out;
};

export function getRow<T = any>(db: Db, type: string, id: string): T | undefined {
  const d = ENTITIES[type]; if (!d) throw new NotFoundError(`Entidade desconhecida: ${type}`);
  return db.get<T>(`SELECT * FROM ${d.table} WHERE id = ?`, [id]);
}
const exists = (db: Db, table: string, id: any) => id == null || !!db.get(`SELECT 1 x FROM ${table} WHERE id = ?`, [id]);

export function log(db: Db, ctx: Ctx, action: string, type: string, id: string, before: any, after: any, note?: string) {
  db.run('INSERT INTO change_log (at, actor, action, entity_type, entity_id, before, after, note) VALUES (?,?,?,?,?,?,?,?)',
    [now(), ctx.actor, action, type, id, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, note ?? null]);
}

const LEVEL_RANK: Record<string, number> = { pais: 0, regiao: 1, provincia: 2, municipio: 3, localidade: 4, porto: 4 };

function validate(db: Db, type: string, row: Record<string, any>, selfId?: string): string[] {
  const errs: string[] = [], warns: string[] = [];
  const dateErrs = (p: string, label: string) => {
    const e = validateFuzzyDate({ from: row[`${p}_from`], to: row[`${p}_to`], precision: row[`${p}_precision`] ?? 'desconhecida' });
    e.forEach((m) => errs.push(`${label}: ${m}`));
  };
  const fk = (table: string, col: string, label: string) => { if (row[col] != null && !exists(db, table, row[col])) errs.push(`${label} inexistente (${row[col]}).`); };

  if (type === 'person') {
    dateErrs('birth', 'Nascimento'); dateErrs('death', 'Falecimento');
    fk('place', 'birth_place_id', 'Local de nascimento'); fk('place', 'death_place_id', 'Local de falecimento');
    const by = parsePartial(row.birth_from)?.y, dy = parsePartial(row.death_from ?? row.death_to)?.y;
    if (by && dy && dy < by) errs.push('Falecimento anterior ao nascimento.');
    if ((row.death_from || row.death_to) && row.living_status && ['vivo', 'possivelmente_vivo'].includes(row.living_status)) errs.push('Pessoa com data de falecimento não pode estar marcada como viva.');
  }
  if (type === 'event') { dateErrs('date', 'Data'); fk('place', 'place_id', 'Lugar'); fk('place', 'route_to_place_id', 'Destino'); }
  if (type === 'relationship') {
    dateErrs('date', 'Data'); fk('person', 'person_a', 'Pessoa A'); fk('person', 'person_b', 'Pessoa B'); fk('place', 'place_id', 'Lugar');
    if (row.type !== 'filiacao' && row.subtype) errs.push('Subtipo só se aplica à filiação.');
  }
  if (type === 'place') {
    if (row.parent_id) {
      const par = db.get<any>('SELECT * FROM place WHERE id = ?', [row.parent_id]);
      if (!par) errs.push('Lugar superior inexistente.');
      else {
        if (par.id === selfId) errs.push('Um lugar não pode ser pai de si mesmo.');
        if ((LEVEL_RANK[par.level] ?? 0) >= (LEVEL_RANK[row.level] ?? 9)) errs.push(`Hierarquia inválida: ${par.level} não pode conter ${row.level}.`);
        let cur = par; const seen = new Set<string>();
        while (cur?.parent_id && !seen.has(cur.id)) { if (cur.parent_id === selfId) { errs.push('Hierarquia de lugares circular.'); break; } seen.add(cur.id); cur = db.get('SELECT * FROM place WHERE id = ?', [cur.parent_id]); }
      }
    }
    if (row.lat != null && (row.lat < -90 || row.lat > 90)) errs.push('Latitude fora do intervalo.');
    if (row.lon != null && (row.lon < -180 || row.lon > 180)) errs.push('Longitude fora do intervalo.');
    if ((row.lat == null) !== (row.lon == null)) errs.push('Informe latitude e longitude juntas.');
  }
  if (type === 'evidence') { fk('source', 'source_id', 'Fonte'); }
  if (type === 'research_group') fk('nucleus', 'nucleus_id', 'Núcleo');
  return errs;
}

export function activeRels(db: Db): RelLite[] {
  return db.all<any>('SELECT id, type, subtype, person_a a, person_b b, status FROM relationship WHERE archived_at IS NULL');
}
export function personLite(db: Db): Map<string, PersonLite> {
  const m = new Map<string, PersonLite>();
  for (const p of db.all<any>('SELECT id, birth_from, death_from, death_to FROM person'))
    m.set(p.id, { id: p.id, birthYear: parsePartial(p.birth_from)?.y ?? null, deathYear: parsePartial(p.death_from ?? p.death_to)?.y ?? null });
  return m;
}

export interface SaveResult<T = any> { row: T; warnings: string[] }

export function createEntity(db: Db, ctx: Ctx, type: string, data: Record<string, any>, opts: { id?: string } = {}): SaveResult {
  const def = ENTITIES[type]; if (!def) throw new NotFoundError(`Entidade desconhecida: ${type}`);
  const row = pack(def, data);
  const miss = (def.required ?? []).filter((c) => row[c] == null || row[c] === '');
  if (miss.length) throw new ValidationError([`Campos obrigatórios: ${miss.join(', ')}`]);
  return db.tx(() => {
    const errs = validate(db, type, row);
    let warnings: string[] = [];
    if (type === 'relationship') {
      const v = validateRelationship(activeRels(db), { type: row.type, a: row.person_a, b: row.person_b, status: (row.status ?? 'nao_confirmado') as Status, subtype: row.subtype }, personLite(db));
      errs.push(...v.errors); warnings = v.warnings;
    }
    if (errs.length) throw new ValidationError(errs);
    const id = opts.id ?? newId(def.prefix);
    const cols = Object.keys(row);
    const all = def.stamps ? [...cols, 'created_at', 'updated_at'] : cols;
    const vals = def.stamps ? [...cols.map((c) => row[c]), now(), now()] : cols.map((c) => row[c]);
    db.run(`INSERT INTO ${def.table} (id, ${all.join(',')}) VALUES (?, ${all.map(() => '?').join(',')})`, [id, ...vals]);
    const created = getRow(db, type, id);
    log(db, ctx, 'create', type, id, null, created);
    return { row: created, warnings };
  });
}

export function updateEntity(db: Db, ctx: Ctx, type: string, id: string, patch: Record<string, any>, note?: string): SaveResult {
  const def = ENTITIES[type]; if (!def) throw new NotFoundError(`Entidade desconhecida: ${type}`);
  return db.tx(() => {
    const before = getRow(db, type, id);
    if (!before) throw new NotFoundError(`${type} ${id} não encontrado`);
    const changes = pack(def, patch);
    delete changes.import_key;
    const merged = { ...before, ...changes };
    const miss = (def.required ?? []).filter((c) => merged[c] == null || merged[c] === '');
    if (miss.length) throw new ValidationError([`Campos obrigatórios: ${miss.join(', ')}`]);
    const errs = validate(db, type, merged, id);
    let warnings: string[] = [];
    if (type === 'relationship') {
      const v = validateRelationship(activeRels(db), { id, type: merged.type, a: merged.person_a, b: merged.person_b, status: merged.status, subtype: merged.subtype }, personLite(db));
      errs.push(...v.errors); warnings = v.warnings;
    }
    if (errs.length) throw new ValidationError(errs);
    const cols = Object.keys(changes).filter((c) => (before as any)[c] !== changes[c]);
    if (!cols.length) return { row: before, warnings };
    const sets = cols.map((c) => `${c} = ?`);
    if (def.stamps) sets.push('updated_at = ?');
    db.run(`UPDATE ${def.table} SET ${sets.join(', ')} WHERE id = ?`, [...cols.map((c) => changes[c]), ...(def.stamps ? [now()] : []), id]);
    const after = getRow(db, type, id);
    const statusCol = ['verification_status', 'status'].find((c) => cols.includes(c));
    log(db, ctx, statusCol && cols.length === 1 ? 'status' : 'update', type, id, before, after, note);
    if (type === 'claim' && cols.includes('status')) db.run('INSERT INTO claim_history (claim_id, at, actor, from_status, to_status, note) VALUES (?,?,?,?,?,?)', [id, now(), ctx.actor, (before as any).status, changes.status, note ?? null]);
    return { row: after, warnings };
  });
}

/** Arquiva (reversível) entidades principais; remove sub-registros registrando o conteúdo anterior. */
export function removeEntity(db: Db, ctx: Ctx, type: string, id: string, restore = false) {
  const def = ENTITIES[type]; if (!def) throw new NotFoundError(`Entidade desconhecida: ${type}`);
  return db.tx(() => {
    const before = getRow<any>(db, type, id);
    if (!before) throw new NotFoundError(`${type} ${id} não encontrado`);
    if (def.soft) {
      db.run(`UPDATE ${def.table} SET archived_at = ?, updated_at = ? WHERE id = ?`, [restore ? null : now(), now(), id]);
      log(db, ctx, restore ? 'restore' : 'archive', type, id, before, getRow(db, type, id));
    } else {
      db.run(`DELETE FROM ${def.table} WHERE id = ?`, [id]);
      log(db, ctx, 'archive', type, id, before, null, 'sub-registro removido (recuperável a partir do histórico)');
    }
    return { ok: true };
  });
}

// ---- tabelas de ligação (chave composta) ----
export const LINKS: Record<string, { cols: string[]; keys: string[] }> = {
  person_nucleus: { cols: ['person_id', 'nucleus_id', 'note'], keys: ['person_id', 'nucleus_id'] },
  research_group_member: { cols: ['group_id', 'person_id', 'note'], keys: ['group_id', 'person_id'] },
  source_person: { cols: ['source_id', 'person_id', 'note'], keys: ['source_id', 'person_id'] },
  source_place: { cols: ['source_id', 'place_id'], keys: ['source_id', 'place_id'] },
  event_person: { cols: ['event_id', 'person_id', 'role'], keys: ['event_id', 'person_id'] },
  claim_entity: { cols: ['claim_id', 'entity_type', 'entity_id', 'role'], keys: ['claim_id', 'entity_type', 'entity_id'] },
  investigation_hypothesis: { cols: ['investigation_id', 'claim_id', 'label', 'sort'], keys: ['investigation_id', 'claim_id'] },
  investigation_entity: { cols: ['investigation_id', 'entity_type', 'entity_id'], keys: ['investigation_id', 'entity_type', 'entity_id'] },
};

export function upsertLink(db: Db, ctx: Ctx, table: string, data: Record<string, any>) {
  const l = LINKS[table]; if (!l) throw new NotFoundError(`Ligação desconhecida: ${table}`);
  const miss = l.keys.filter((k) => data[k] == null || data[k] === '');
  if (miss.length) throw new ValidationError([`Campos obrigatórios: ${miss.join(', ')}`]);
  return db.tx(() => {
    const where = l.keys.map((k) => `${k} = ?`).join(' AND ');
    const before = db.get(`SELECT * FROM ${table} WHERE ${where}`, l.keys.map((k) => data[k]));
    const vals = l.cols.map((c) => data[c] ?? null);
    db.run(`INSERT OR REPLACE INTO ${table} (${l.cols.join(',')}) VALUES (${l.cols.map(() => '?').join(',')})`, vals);
    log(db, ctx, before ? 'update' : 'create', table, l.keys.map((k) => data[k]).join('|'), before, data);
    return { ok: true };
  });
}
export function deleteLink(db: Db, ctx: Ctx, table: string, data: Record<string, any>) {
  const l = LINKS[table]; if (!l) throw new NotFoundError(`Ligação desconhecida: ${table}`);
  return db.tx(() => {
    const where = l.keys.map((k) => `${k} = ?`).join(' AND ');
    const before = db.get(`SELECT * FROM ${table} WHERE ${where}`, l.keys.map((k) => data[k]));
    if (!before) throw new NotFoundError('Ligação não encontrada');
    db.run(`DELETE FROM ${table} WHERE ${where}`, l.keys.map((k) => data[k]));
    log(db, ctx, 'archive', table, l.keys.map((k) => data[k]).join('|'), before, null, 'ligação removida (recuperável a partir do histórico)');
    return { ok: true };
  });
}

/** Aviso de consistência: status "documentado" sem nenhuma evidência favorável registrada. */
export function statusWarning(db: Db, subjectType: string, subjectId: string, status: Status): string | null {
  if (STATUS_RANK[status] >= STATUS_RANK.fortemente_corroborado) {
    const n = db.get<{ n: number }>("SELECT COUNT(*) n FROM evidence WHERE subject_type = ? AND subject_id = ? AND stance = 'favoravel'", [subjectType, subjectId])!.n;
    if (n === 0) return `O estado "${status}" não possui nenhuma evidência favorável vinculada.`;
  }
  return null;
}
