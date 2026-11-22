// Importador idempotente com fusão em 3 vias.
//  * chave de reconciliação = `${package.id}/${prefixo}:${key}` → reimportar o mesmo pacote não duplica nada;
//  * `import_state` guarda o hash da última importação de cada registro: se o pesquisador editou o registro
//    depois E o pacote também mudou, o importador NÃO sobrescreve — gera um item de revisão (conflito);
//  * dry_run executa exatamente o mesmo fluxo dentro de um SAVEPOINT revertido → o plano mostrado é o real;
//  * todas as citações (`prov.quote`) são conferidas contra o texto original; citações ausentes bloqueiam a aplicação.
import { createHash } from 'node:crypto';
import type { Db } from '../db/connection';
import { ENTITIES, createEntity, updateEntity, getRow, ValidationError, type Ctx } from '../repo';
import { PackageSchema, type ParsedPackage, type PkgDate } from './package';
import { fold, searchScore } from '../../shared/names';
import { parsePartial } from '../../shared/dates';

export interface ImportOptions { mode: 'dry_run' | 'apply'; actor: string; resolutions?: Record<string, string> }
type Counter = { created: number; updated: number; unchanged: number; conflicts: number };
export interface ImportAudit {
  packageId: string; reportId: string; mode: string;
  counts: Record<string, Counter>;
  links: { added: number };
  created: { type: string; key: string; label: string }[];
  updated: { type: string; key: string; label: string; diff: Record<string, [any, any]> }[];
  conflicts: { type: string; key: string; label: string; fields: string[] }[];
  quotes: { checked: number; failed: { type: string; key: string; quote: string }[] };
  duplicates: { key: string; name: string; candidates: { id: string; name: string; score: number }[] }[];
  orphans: { type: string; id: string; label: string }[];
  reviewItems: { created: number; byKind: Record<string, number> };
  warnings: string[];
}

class Rollback extends Error { constructor(public audit: ImportAudit) { super('rollback'); } }

const sha = (s: string, alg = 'sha256') => createHash(alg).update(s).digest('hex');
export const hashReport = (text: string) => sha(text);
const stripArtifacts = (s: string) => s.replace(/\[span_\d+\]\((?:start|end)_span\)/g, '');
const qn = (s: string) => fold(stripArtifacts(s));

const dcols = (p: string, d?: PkgDate | null) => ({ [`${p}_from`]: d?.from ?? null, [`${p}_to`]: d?.to ?? null, [`${p}_precision`]: d?.precision ?? 'desconhecida', [`${p}_text`]: d?.text ?? null });
const nn = <T>(v: T | undefined | null | ''): T | null => (v === undefined || v === '' ? null : (v as any));
const hashRec = (rec: Record<string, any>) => sha(JSON.stringify(Object.keys(rec).sort().map((k) => [k, rec[k] === undefined ? null : typeof rec[k] === 'boolean' ? +rec[k] : rec[k]])), 'sha1');
const EVIDENCE_TYPE: Record<string, string> = { person: 'person', relationship: 'relationship', event: 'event', place: 'place', claim: 'claim', surname: 'surname_variant', occupation: 'person_occupation', identity_link: 'identity_link' };

export function runImport(db: Db, rawPkg: unknown, reportText: string, opts: ImportOptions): ImportAudit {
  const parsed = PackageSchema.safeParse(rawPkg);
  if (!parsed.success) throw new ValidationError(parsed.error.issues.slice(0, 12).map((i) => `${i.path.join('.')}: ${i.message}`));
  const pkg: ParsedPackage = parsed.data;
  const reportId = hashReport(reportText);
  const ctx: Ctx = { actor: `import:${pkg.id}` };
  const nowIso = new Date().toISOString();

  const body = (): ImportAudit => {
    const audit: ImportAudit = {
      packageId: pkg.id, reportId, mode: opts.mode, counts: {}, links: { added: 0 }, created: [], updated: [], conflicts: [],
      quotes: { checked: 0, failed: [] }, duplicates: [], orphans: [], reviewItems: { created: 0, byKind: {} }, warnings: [],
    };
    const count = (t: string) => (audit.counts[t] ??= { created: 0, updated: 0, unchanged: 0, conflicts: 0 });

    // 0) texto original preservado + conferência das citações
    db.run('INSERT OR IGNORE INTO report (id, title, origin, imported_at, content) VALUES (?,?,?,?,?)', [reportId, pkg.report.title, pkg.report.origin, nowIso, reportText]);
    const hay = qn(reportText);
    const touched = new Set<string>();
    const checkQuote = (type: string, key: string, p?: { sec?: string; quote?: string }) => {
      if (!p?.quote) return;
      audit.quotes.checked++;
      const q = qn(p.quote);
      if (q.length < 8 || !hay.includes(q)) audit.quotes.failed.push({ type, key, quote: p.quote });
    };

    const ids = new Map<string, string>(); // `${type}:${key}` → id
    const nsOf = sha(pkg.id, 'sha1').slice(0, 6);
    const importKeyOf = (type: string, key: string) => `${pkg.id}/${ENTITIES[type].prefix}:${key}`;
    const idOf = (type: string, key: string | undefined | null): string | null => {
      if (!key) return null;
      const got = ids.get(`${type}:${key}`);
      if (got) return got;
      const row = db.get<any>(`SELECT id FROM ${ENTITIES[type].table} WHERE import_key = ?`, [importKeyOf(type, key)]);
      if (row) return row.id;
      throw new ValidationError([`Referência desconhecida: ${type}:${key}`]);
    };

    const upsert = (type: string, key: string, record: Record<string, any>, label: string, prov?: { sec?: string; quote?: string }): string => {
      const def = ENTITIES[type];
      checkQuote(type, key, prov);
      for (const k of Object.keys(record)) if (record[k] === undefined || record[k] === '') record[k] = null;
      for (const c of def.json ?? []) if (record[c] !== null && typeof record[c] !== 'string') record[c] = JSON.stringify(record[c]);
      const ik = importKeyOf(type, key);
      const res = opts.resolutions?.[`${type}:${key}`];
      const alias = db.get<any>('SELECT entity_id FROM import_alias WHERE import_key = ? AND entity_type = ?', [ik, type]);
      let existing: any = res ? getRow(db, type, res) : (db.get(`SELECT * FROM ${def.table} WHERE import_key = ?`, [ik]) ?? (alias ? getRow(db, type, alias.entity_id) : undefined));
      if (res && !existing) throw new ValidationError([`Resolução aponta para registro inexistente: ${type}:${key} → ${res}`]);
      if (res) db.run('INSERT OR REPLACE INTO import_alias (import_key, entity_type, entity_id) VALUES (?,?,?)', [ik, type, res]);
      const mapped = !!existing && existing.import_key !== ik;
      const newHash = hashRec(record);
      const setState = (id: string) => db.run('INSERT OR REPLACE INTO import_state (entity_type, entity_id, report_id, hash) VALUES (?,?,?,?)', [type, id, reportId, newHash]);
      let id: string;
      if (!existing) {
        id = `${def.prefix}_${key}`;
        if (db.get(`SELECT 1 x FROM ${def.table} WHERE id = ?`, [id])) id = `${def.prefix}_${key}_${nsOf}`;
        createEntity(db, ctx, type, { ...record, import_key: ik }, { id });
        setState(id); count(type).created++; audit.created.push({ type, key, label });
      } else {
        id = existing.id;
        const state = db.get<any>('SELECT hash FROM import_state WHERE entity_type = ? AND entity_id = ?', [type, id]);
        if (mapped) {
          // registro existente mapeado manualmente (de outro pacote): só preenche campos vazios — nunca sobrescreve
          const fill: Record<string, any> = {}; const diff: Record<string, [any, any]> = {};
          for (const [c, v] of Object.entries(record)) if ((existing[c] === null || existing[c] === '') && v !== null) { fill[c] = v; diff[c] = [null, v]; }
          if (Object.keys(fill).length) { updateEntity(db, ctx, type, id, fill, 'importação: preenchimento de campos vazios'); count(type).updated++; audit.updated.push({ type, key, label, diff }); }
          else count(type).unchanged++;
        } else if (state?.hash === newHash) {
          count(type).unchanged++;
        } else {
          const cur = hashRec(Object.fromEntries(Object.keys(record).map((c) => [c, existing[c] ?? null])));
          if (state && cur === state.hash) {
            const diff: Record<string, [any, any]> = {};
            for (const c of Object.keys(record)) if ((existing[c] ?? null) !== record[c]) diff[c] = [existing[c] ?? null, record[c]];
            updateEntity(db, ctx, type, id, record, 'importação: pacote atualizado');
            setState(id); count(type).updated++; audit.updated.push({ type, key, label, diff });
          } else {
            const fields = Object.keys(record).filter((c) => (existing[c] ?? null) !== record[c]);
            count(type).conflicts++; audit.conflicts.push({ type, key, label, fields });
            reviewUpsert(`conflict:${type}:${key}`, 'conflito_importacao', `Conflito de importação: ${label}`,
              `O registro foi editado após a última importação e o pacote também mudou nos campos: ${fields.join(', ')}. Nada foi sobrescrito.`, type, id);
          }
        }
      }
      ids.set(`${type}:${key}`, id); touched.add(`${type}:${id}`);
      if (prov && (prov.sec || prov.quote)) db.run('INSERT OR REPLACE INTO provenance (entity_type, entity_id, report_id, section, quote) VALUES (?,?,?,?,?)', [type, id, reportId, prov.sec ?? null, prov.quote ?? null]);
      return id;
    };

    const link = (table: string, cols: Record<string, any>) => {
      const k = Object.keys(cols);
      const r = db.run(`INSERT OR IGNORE INTO ${table} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map((c) => cols[c] ?? null));
      audit.links.added += r.changes;
    };
    const reviewUpsert = (key: string, kind: string, title: string, detail: string | null, entityType?: string | null, entityId?: string | null, prov?: { sec?: string; quote?: string }) => {
      const ik = `${pkg.id}/rev:${key}`;
      const ex = db.get<any>('SELECT id, status FROM review_item WHERE import_key = ?', [ik]);
      if (!ex) {
        db.run('INSERT INTO review_item (id, kind, title, detail, entity_type, entity_id, report_id, section, quote, status, import_key, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [`rev_${sha(ik, 'sha1').slice(0, 10)}`, kind, title, detail, entityType ?? null, entityId ?? null, reportId, prov?.sec ?? null, prov?.quote ?? null, 'pendente', ik, nowIso, nowIso]);
        audit.reviewItems.created++; audit.reviewItems.byKind[kind] = (audit.reviewItems.byKind[kind] ?? 0) + 1;
      } else if (ex.status === 'pendente') {
        db.run('UPDATE review_item SET title = ?, detail = ?, updated_at = ? WHERE id = ?', [title, detail, nowIso, ex.id]);
      }
    };

    // 1) lugares (pais antes dos filhos)
    const placeByKey = new Map(pkg.places.map((p) => [p.key, p]));
    const donePlaces = new Set<string>();
    const doPlace = (k: string, stack: string[] = []) => {
      if (donePlaces.has(k)) return; const p = placeByKey.get(k);
      if (!p) return; if (stack.includes(k)) throw new ValidationError([`Hierarquia circular de lugares: ${[...stack, k].join(' → ')}`]);
      if (p.parent) doPlace(p.parent, [...stack, k]);
      upsert('place', p.key, {
        parent_id: idOf('place', p.parent), level: p.level, name: p.name, historic_names: p.historic ?? [], lat: nn(p.lat), lon: nn(p.lon),
        coord_precision: p.precision ?? 'desconhecida', coord_verified: p.verified ? 1 : 0, coord_note: nn(p.coordNote), description: nn(p.description), notes: nn(p.notes),
      }, p.name, p.prov);
      donePlaces.add(k);
    };
    pkg.places.forEach((p) => doPlace(p.key));

    // 2) núcleos
    for (const n of pkg.nuclei) upsert('nucleus', n.key, { name: n.name, kind: n.kind, description: nn(n.description), color: nn(n.color), sort: n.sort ?? 0 }, n.name, n.prov);

    // 3) pessoas
    for (const p of pkg.persons) {
      const id = upsert('person', p.key, {
        preferred_name: p.name, given_names: nn(p.given), surname: nn(p.surname), sex: p.sex ?? 'desconhecido', living_status: p.living,
        ...dcols('birth', p.birth), birth_place_id: idOf('place', p.birthPlace), ...dcols('death', p.death), death_place_id: idOf('place', p.deathPlace),
        biography: nn(p.bio), verification_status: p.status, reported_status: nn(p.reportedStatus), status_rationale: nn(p.rationale), identity_note: nn(p.identityNote),
        notes: nn(p.notes), external_ids: p.externalIds ?? {}, avatar_url: null,
      }, p.name, p.prov);
      link('person_name', { id: `pn_${sha(id + p.name + 'preferido', 'sha1').slice(0, 10)}`, person_id: id, name: p.name, kind: 'preferido', historic_surname: null, note: null });
      for (const nm of p.names ?? []) link('person_name', { id: `pn_${sha(id + nm.name + (nm.kind ?? 'variante'), 'sha1').slice(0, 10)}`, person_id: id, name: nm.name, kind: nm.kind ?? 'variante', historic_surname: nm.historicSurname, note: nm.note });
      for (const o of p.occupations ?? []) upsert('person_occupation', `${p.key}_${o.key}`, { person_id: id, title: o.title, period_text: nn(o.period), place_id: idOf('place', o.place), status: o.status ?? 'nao_confirmado', note: nn(o.note) }, `${p.name}: ${o.title}`);
      for (const nk of p.nuclei ?? []) link('person_nucleus', { person_id: id, nucleus_id: idOf('nucleus', nk) });
    }

    // 4) grupos investigativos
    for (const g of pkg.groups) {
      const gid = upsert('research_group', g.key, { nucleus_id: idOf('nucleus', g.nucleus), name: g.name, description: nn(g.description) }, g.name, g.prov);
      for (const m of g.members) link('research_group_member', { group_id: gid, person_id: idOf('person', m) });
    }

    // 5) relações e identidades
    for (const r of pkg.relationships) {
      upsert('relationship', r.key, {
        type: r.type, subtype: nn(r.subtype), person_a: idOf('person', r.a), person_b: idOf('person', r.b), status: r.status, reported_status: nn(r.reportedStatus),
        status_rationale: nn(r.rationale), confidence: nn(r.confidence), ...dcols('date', r.date), place_id: idOf('place', r.place), notes: nn(r.notes),
      }, `${r.type}: ${r.a} ↔ ${r.b}`, r.prov);
    }
    for (const l of pkg.identityLinks) upsert('identity_link', l.key, { person_a: idOf('person', l.a), person_b: idOf('person', l.b), status: l.status, note: nn(l.note) }, `identidade ${l.a}~${l.b}`, l.prov);

    // 6) fontes
    for (const s of pkg.sources) {
      const sid = upsert('source', s.key, {
        kind: s.kind, doc_type: s.docType, title: s.title, institution: nn(s.institution), url: nn(s.url), extra_urls: s.extraUrls ?? [], archival_ref: nn(s.archivalRef), page_ref: nn(s.pageRef),
        produced_date: nn(s.produced), consulted_date: nn(s.consulted), excerpt: nn(s.excerpt), transcription: null, local_file: null, access_status: s.access,
        reliability: s.reliability, reliability_note: nn(s.reliabilityNote), notes: nn(s.notes),
      }, s.title, s.prov);
      for (const pk of s.persons ?? []) link('source_person', { source_id: sid, person_id: idOf('person', pk) });
      for (const pl of s.places ?? []) link('source_place', { source_id: sid, place_id: idOf('place', pl) });
    }

    // 7) eventos
    for (const e of pkg.events) {
      const eid = upsert('event', e.key, {
        type: e.type, title: e.title, description: nn(e.description), ...dcols('date', e.date), place_id: idOf('place', e.place), place_note: nn(e.placeNote), status: e.status,
        reported_status: nn(e.reportedStatus), status_rationale: nn(e.rationale), is_route_speculative: e.speculative ? 1 : 0, route_to_place_id: idOf('place', e.routeTo), notes: nn(e.notes),
      }, e.title, e.prov);
      for (const ep of e.persons ?? []) link('event_person', { event_id: eid, person_id: idOf('person', ep.person), role: ep.role ?? 'participante' });
    }

    // 8) afirmações (antes das evidências, que podem apontar para elas)
    for (const c of pkg.claims) {
      const cid = upsert('claim', c.key, { code: nn(c.code), kind: c.kind, content: c.content, status: c.status, reported_status: nn(c.reportedStatus), confidence: nn(c.confidence), justification: nn(c.justification), contradictions: nn(c.contradictions) }, c.code ?? c.content.slice(0, 50), c.prov);
      if (!db.get('SELECT 1 x FROM claim_history WHERE claim_id = ?', [cid]))
        db.run('INSERT INTO claim_history (claim_id, at, actor, from_status, to_status, note) VALUES (?,?,?,?,?,?)', [cid, nowIso, ctx.actor, null, c.status, `Registro inicial (relatório: ${c.reportedStatus ?? 'sem classificação'})`]);
      for (const en of c.entities ?? []) link('claim_entity', { claim_id: cid, entity_type: en.type, entity_id: idOf(en.type === 'nucleus' ? 'nucleus' : en.type, en.key), role: en.role });
    }

    // 10) sobrenomes, contextos
    for (const s of pkg.surnames) upsert('surname_variant', s.key, { form: s.form, family_group: s.group ?? 'giovannitti', status: s.status, attested_places: nn(s.places), period_text: nn(s.period), linguistic_note: nn(s.note) }, s.form, s.prov);
    for (const c of pkg.contexts) upsert('historical_context', c.key, { title: c.title, description: nn(c.description), year_from: c.from, year_to: nn(c.to), country: nn(c.country), origin: c.origin }, c.title);

    // 9) evidências
    for (const ev of pkg.evidence) {
      const [st, sk] = ev.subject.split(':');
      upsert('evidence', ev.key, { subject_type: st, subject_id: idOf(EVIDENCE_TYPE[st], sk), source_id: idOf('source', ev.source), stance: ev.stance ?? 'favoravel', excerpt: nn(ev.excerpt), note: nn(ev.note) }, `evidência ${ev.subject} ← ${ev.source}`, ev.prov);
    }

    // 11) investigações
    for (const v of pkg.investigations) {
      const iid = upsert('investigation', v.key, { title: v.title, question: v.question, description: nn(v.description), status: v.status, priority: v.priority, conclusion: nn(v.conclusion) }, v.title, v.prov);
      v.hypotheses?.forEach((h, i) => link('investigation_hypothesis', { investigation_id: iid, claim_id: idOf('claim', h.claim), label: h.label, sort: i }));
      for (const en of v.entities ?? []) link('investigation_entity', { investigation_id: iid, entity_type: en.type, entity_id: idOf(en.type, en.key) });
      v.tasks?.forEach((t, i) => upsert('investigation_task', `${v.key}_${t.key}`, { investigation_id: iid, claim_id: idOf('claim', t.claim), kind: t.kind, text: t.text, institution: nn(t.institution), status: t.status ?? 'pendente', sort: i }, t.text.slice(0, 60)));
    }

    // 12) itens de revisão (ambiguidades, contradições, lacunas…)
    for (const r of pkg.reviewItems) {
      checkQuote('review', r.key, r.prov);
      let et: string | null = null, eid: string | null = null;
      if (r.entity) { const [t, k] = r.entity.split(':'); et = EVIDENCE_TYPE[t]; eid = idOf(et, k); }
      reviewUpsert(r.key, r.kind, r.title, r.detail ?? null, et, eid, r.prov);
    }

    // 13) possíveis duplicatas (pessoas novas × pessoas já existentes de outros pacotes) — nunca funde sozinho
    const others = db.all<any>(`SELECT p.id, p.preferred_name, p.birth_from, (SELECT group_concat(name, ' ') FROM person_name n WHERE n.person_id = p.id) names FROM person p WHERE p.import_key IS NULL OR p.import_key NOT LIKE ?`, [`${pkg.id}/%`]);
    for (const c of audit.created.filter((x) => x.type === 'person')) {
      const p = pkg.persons.find((x) => x.key === c.key)!;
      const by = parsePartial(p.birth?.from)?.y;
      const cands = others.map((o) => {
        const oy = parsePartial(o.birth_from)?.y;
        if (by && oy && Math.abs(by - oy) > 3) return null;
        const s = searchScore(p.name, `${o.preferred_name} ${o.names ?? ''}`);
        return s >= 0.75 ? { id: o.id, name: o.preferred_name, score: +s.toFixed(2) } : null;
      }).filter(Boolean) as { id: string; name: string; score: number }[];
      if (cands.length) {
        audit.duplicates.push({ key: c.key, name: p.name, candidates: cands });
        reviewUpsert(`dup:${c.key}`, 'identidade', `Possível duplicata: ${p.name}`, `Registros semelhantes já existentes: ${cands.map((x) => `${x.name} (${x.id})`).join('; ')}. Nada foi fundido automaticamente.`, 'person', ids.get(`person:${c.key}`));
      }
    }

    // 14) órfãos (já importados deste pacote, ausentes na nova versão — preservados)
    for (const [type, def] of Object.entries(ENTITIES).filter(([, d]) => d.cols.includes('import_key'))) {
      for (const r of db.all<any>(`SELECT id, import_key FROM ${def.table} WHERE import_key LIKE ?`, [`${pkg.id}/%`])) {
        if (!touched.has(`${type}:${r.id}`)) audit.orphans.push({ type, id: r.id, label: r.import_key });
      }
    }
    if (audit.orphans.length) audit.warnings.push(`${audit.orphans.length} registro(s) importado(s) antes não constam nesta versão do pacote; foram preservados (nunca removidos automaticamente).`);

    if (audit.quotes.failed.length) audit.warnings.push(`${audit.quotes.failed.length} citação(ões) não encontradas no texto do relatório.`);
    if (opts.mode === 'apply') {
      if (audit.quotes.failed.length) throw new ValidationError([`Importação recusada: ${audit.quotes.failed.length} citação(ões) do pacote não existem no relatório (ex.: ${audit.quotes.failed.slice(0, 3).map((f) => `${f.type}:${f.key}`).join(', ')}).`]);
      db.run('INSERT INTO import_run (id, report_id, package_id, package_version, mode, at, actor, summary, audit) VALUES (?,?,?,?,?,?,?,?,?)',
        [`imp_${sha(pkg.id + nowIso, 'sha1').slice(0, 10)}`, reportId, pkg.id, String(pkg.version), 'apply', nowIso, opts.actor, JSON.stringify(audit.counts), JSON.stringify(audit)]);
    }
    return audit;
  };

  if (opts.mode === 'dry_run') {
    try { db.tx(() => { throw new Rollback(body()); }); } catch (e) { if (e instanceof Rollback) return e.audit; throw e; }
  }
  return db.tx(body);
}
