// Snapshot do acervo para a API de leitura + camada de privacidade (visão pública × administrativa).
import type { Db } from './db/connection';
import { parsePartial } from '../shared/dates';

export type Mode = 'admin' | 'public';

const j = (s: any, d: any) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

/** Pessoa cujos dados pessoais não podem ser expostos publicamente (viva, possivelmente viva ou indeterminada recente). */
export function isPrivatePerson(p: { living_status: string; birth_from?: string | null; death_from?: string | null; death_to?: string | null }, year = new Date().getFullYear()): boolean {
  if (p.living_status === 'falecido' || p.living_status === 'presumido_falecido') return false;
  if (p.living_status === 'vivo' || p.living_status === 'possivelmente_vivo') return true;
  if (p.death_from || p.death_to) return false;
  const by = parsePartial(p.birth_from)?.y;
  return !(by && by < year - 110);
}

export function loadSnapshot(db: Db, mode: Mode, opts: { includeArchived?: boolean } = {}): any {
  const arch = (t: string) => (opts.includeArchived ? '' : `WHERE ${t}.archived_at IS NULL`);
  const nuclei = db.all<any>(`SELECT * FROM nucleus ${arch('nucleus')} ORDER BY sort, name`);
  const places = db.all<any>(`SELECT * FROM place ${arch('place')} ORDER BY name`).map((p) => ({ ...p, historic_names: j(p.historic_names, []), coord_verified: !!p.coord_verified }));
  const names = db.all<any>('SELECT * FROM person_name');
  const occs = db.all<any>('SELECT * FROM person_occupation');
  const pn = db.all<any>('SELECT * FROM person_nucleus');
  const persons = db.all<any>(`SELECT * FROM person ${arch('person')} ORDER BY preferred_name`).map((p) => ({
    ...p, external_ids: j(p.external_ids, {}),
    names: names.filter((n) => n.person_id === p.id), occupations: occs.filter((o) => o.person_id === p.id),
    nucleusIds: pn.filter((x) => x.person_id === p.id).map((x) => x.nucleus_id),
    isPrivate: isPrivatePerson(p),
  }));
  const relationships = db.all<any>(`SELECT * FROM relationship ${arch('relationship')}`);
  const groups = db.all<any>(`SELECT * FROM research_group ${arch('research_group')}`);
  const gm = db.all<any>('SELECT * FROM research_group_member');
  const groupsOut = groups.map((g) => ({ ...g, memberIds: gm.filter((m) => m.group_id === g.id).map((m) => m.person_id) }));
  const identityLinks = db.all<any>('SELECT * FROM identity_link');
  const ep = db.all<any>('SELECT * FROM event_person');
  const events = db.all<any>(`SELECT * FROM event ${arch('event')}`).map((e) => ({ ...e, is_route_speculative: !!e.is_route_speculative, persons: ep.filter((x) => x.event_id === e.id).map((x) => ({ person_id: x.person_id, role: x.role })) }));
  const sp = db.all<any>('SELECT * FROM source_person'), spl = db.all<any>('SELECT * FROM source_place');
  const sources = db.all<any>(`SELECT * FROM source ${arch('source')} ORDER BY title`).map((s) => ({
    ...s, extra_urls: j(s.extra_urls, []), personIds: sp.filter((x) => x.source_id === s.id).map((x) => x.person_id), placeIds: spl.filter((x) => x.source_id === s.id).map((x) => x.place_id),
  }));
  const evidence = db.all<any>('SELECT * FROM evidence');
  const ce = db.all<any>('SELECT * FROM claim_entity'), ch = db.all<any>('SELECT * FROM claim_history ORDER BY id');
  const claims = db.all<any>(`SELECT * FROM claim ${arch('claim')} ORDER BY code, created_at`).map((c) => ({
    ...c, entities: ce.filter((x) => x.claim_id === c.id).map((x) => ({ type: x.entity_type, id: x.entity_id, role: x.role })), history: ch.filter((x) => x.claim_id === c.id),
  }));
  const ih = db.all<any>('SELECT * FROM investigation_hypothesis ORDER BY sort'), ie = db.all<any>('SELECT * FROM investigation_entity');
  const it = db.all<any>('SELECT * FROM investigation_task ORDER BY sort'), il = db.all<any>('SELECT * FROM investigation_log ORDER BY id');
  const investigations = db.all<any>(`SELECT * FROM investigation ${arch('investigation')} ORDER BY priority, title`).map((v) => ({
    ...v, hypotheses: ih.filter((x) => x.investigation_id === v.id).map((x) => ({ claim_id: x.claim_id, label: x.label })),
    entities: ie.filter((x) => x.investigation_id === v.id).map((x) => ({ type: x.entity_type, id: x.entity_id })),
    tasks: it.filter((x) => x.investigation_id === v.id), log: il.filter((x) => x.investigation_id === v.id),
  }));
  const surnames = db.all<any>('SELECT * FROM surname_variant ORDER BY form');
  const contexts = db.all<any>('SELECT * FROM historical_context ORDER BY year_from');
  const snap: any = {
    mode, generatedAt: new Date().toISOString(), nuclei, places, persons, relationships, groups: groupsOut, identityLinks, events, sources, evidence, claims, investigations, surnames, contexts,
    reviewItems: mode === 'admin' ? db.all<any>('SELECT * FROM review_item ORDER BY kind, title') : [],
    reports: mode === 'admin' ? db.all<any>('SELECT id, title, origin, imported_at, length(content) AS size FROM report') : [],
  };
  return mode === 'public' ? redact(snap) : snap;
}

const ANON = (p: any, nuclei: any[]) => {
  const nn = nuclei.find((n) => p.nucleusIds[0] === n.id)?.name?.split(/[—(]/)[0].trim();
  return {
    ...p, preferred_name: `Pessoa viva${nn ? ` · ${nn}` : ''}`, given_names: null, surname: null, sex: 'desconhecido',
    birth_from: null, birth_to: null, birth_precision: 'desconhecida', birth_text: null, birth_place_id: null,
    death_from: null, death_to: null, death_precision: 'desconhecida', death_text: null, death_place_id: null,
    biography: null, notes: null, identity_note: null, status_rationale: null, external_ids: {}, avatar_url: null, import_key: null,
    names: [], occupations: [], redacted: true,
  };
};

/** Remove/anonimiza tudo que identifique pessoas vivas. */
export function redact(snap: any): any {
  const priv = new Set<string>(snap.persons.filter((p: any) => p.isPrivate).map((p: any) => p.id));
  const persons = snap.persons.map((p: any) => (p.isPrivate ? ANON(p, snap.nuclei) : p));
  const touchesPriv = (ids: string[]) => ids.some((i) => priv.has(i));
  const events = snap.events.filter((e: any) => !touchesPriv(e.persons.map((x: any) => x.person_id)));
  const hiddenSources = new Set<string>();
  const sources = snap.sources.filter((s: any) => {
    const only = s.personIds.length > 0 && s.personIds.every((i: string) => priv.has(i));
    if (only) hiddenSources.add(s.id);
    return !only;
  }).map((s: any) => ({ ...s, personIds: s.personIds.filter((i: string) => !priv.has(i)) }));
  const visEvents = new Set(events.map((e: any) => e.id));
  const claimPriv = (c: any) => c.entities.some((x: any) => x.type === 'person' && priv.has(x.id));
  const claims = snap.claims.map((c: any) => claimPriv(c)
    ? { ...c, content: 'Afirmação envolvendo pessoas vivas (oculta na visão pública).', justification: null, contradictions: null, history: [], redacted: true } : c);
  const privClaim = new Set(snap.claims.filter(claimPriv).map((c: any) => c.id));
  const evidence = snap.evidence.filter((e: any) => !hiddenSources.has(e.source_id)
    && !(e.subject_type === 'person' && priv.has(e.subject_id)) && !(e.subject_type === 'claim' && privClaim.has(e.subject_id))
    && !(e.subject_type === 'event' && !visEvents.has(e.subject_id)));
  const invPriv = (v: any) => v.entities.some((x: any) => x.type === 'person' && priv.has(x.id)) || v.hypotheses.some((h: any) => privClaim.has(h.claim_id));
  const investigations = snap.investigations.map((v: any) => invPriv(v)
    ? { ...v, title: 'Investigação envolvendo pessoas vivas', question: 'Oculta na visão pública.', description: null, conclusion: null, tasks: [], log: [], redacted: true } : v);
  const scrubbed = scrubNames({ places: snap.places, nuclei: snap.nuclei, sources, events, claims, investigations, surnames: snap.surnames, contexts: snap.contexts, groups: snap.groups }, privateNames(snap.persons));
  return {
    ...snap, ...scrubbed, persons, evidence,
    identityLinks: snap.identityLinks.filter((l: any) => !priv.has(l.person_a) && !priv.has(l.person_b)),
    relationships: snap.relationships.map((r: any) => (priv.has(r.person_a) || priv.has(r.person_b) ? { ...r, notes: null, status_rationale: null } : r)),
  };
}

/** Nomes completos (≥ 2 palavras) de pessoas privadas, para varrer textos livres. */
function privateNames(all: any[]): RegExp | null {
  const set = new Set<string>();
  for (const p of all.filter((x) => x.isPrivate)) for (const n of [p.preferred_name, ...p.names.map((x: any) => x.name), p.given_names && p.surname ? `${p.given_names} ${p.surname}` : null, p.given_names]) {
    if (n && n.trim().split(/\s+/).length >= 2 && n.length >= 8) set.add(n.trim());
  }
  if (!set.size) return null;
  return new RegExp([...set].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
}
function scrubNames<T>(obj: T, re: RegExp | null): T {
  if (!re) return obj;
  const walk = (v: any): any => typeof v === 'string' ? v.replace(re, 'pessoa viva') : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  return walk(obj);
}

export function statsOf(s: any) {
  const live = (x: any) => !x.archived_at;
  const openStatuses = ['hipotese_plausivel', 'nao_confirmado'];
  return {
    persons: s.persons.filter(live).length,
    nuclei: s.nuclei.filter(live).length,
    places: s.places.filter(live).length,
    sources: s.sources.filter(live).length,
    openHypotheses: s.claims.filter((c: any) => live(c) && c.kind === 'hipotese' && openStatuses.includes(c.status)).length,
    openInvestigations: s.investigations.filter((v: any) => live(v) && ['aberta', 'em_andamento'].includes(v.status)).length,
    events: s.events.filter(live).length,
    relationships: s.relationships.filter(live).length,
    pendingReview: (s.reviewItems ?? []).filter((r: any) => r.status === 'pendente').length,
  };
}
