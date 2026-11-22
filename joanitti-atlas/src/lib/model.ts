import { formatFuzzyDate, sortKey, parsePartial } from '../../shared/dates';
import { STATUS_RANK, type Status } from '../../shared/types';

export interface Person { id: string; preferred_name: string; given_names?: string; surname?: string; sex: string; living_status: string; isPrivate: boolean; redacted?: boolean;
  birth_from?: string; birth_to?: string; birth_precision: string; birth_text?: string; birth_place_id?: string; death_from?: string; death_to?: string; death_precision: string; death_text?: string; death_place_id?: string;
  biography?: string; avatar_url?: string | null; verification_status: Status; reported_status?: string; status_rationale?: string; identity_note?: string; notes?: string; external_ids: Record<string, string>; names: { id: string; name: string; kind: string; note?: string }[];
  occupations: { id: string; title: string; period_text?: string; place_id?: string; status: Status; note?: string }[]; nucleusIds: string[]; archived_at?: string | null }
export interface Place { id: string; parent_id?: string; level: string; name: string; historic_names: string[]; lat?: number; lon?: number; coord_precision: string; coord_verified: boolean; coord_note?: string; description?: string; notes?: string; archived_at?: string | null }
export interface Rel { id: string; type: string; subtype?: string; person_a: string; person_b: string; status: Status; reported_status?: string; status_rationale?: string; confidence?: number; notes?: string; archived_at?: string | null }
export interface Ev { id: string; type: string; title: string; description?: string; date_from?: string; date_to?: string; date_precision: string; date_text?: string; place_id?: string; place_note?: string; status: Status; reported_status?: string; status_rationale?: string;
  is_route_speculative: boolean; route_to_place_id?: string; persons: { person_id: string; role: string }[]; notes?: string; archived_at?: string | null }
export interface Src { id: string; kind: string; doc_type: string; title: string; institution?: string; url?: string; extra_urls: string[]; archival_ref?: string; page_ref?: string; produced_date?: string; consulted_date?: string; excerpt?: string; transcription?: string; local_file?: string | null;
  access_status: string; reliability: number; reliability_note?: string; notes?: string; personIds: string[]; placeIds: string[]; archived_at?: string | null }
export interface Claim { id: string; code?: string; kind: string; content: string; status: Status; reported_status?: string; confidence?: number; justification?: string; contradictions?: string; entities: { type: string; id: string; role?: string }[];
  history: { id: number; at: string; actor: string; from_status?: string; to_status?: string; note?: string }[]; redacted?: boolean; archived_at?: string | null }
export interface Evid { id: string; subject_type: string; subject_id: string; source_id: string; stance: 'favoravel' | 'contraria' | 'contexto'; excerpt?: string; note?: string }
export interface Task { id: string; claim_id?: string; kind: string; text: string; institution?: string; status: string }
export interface Inv { id: string; title: string; question: string; description?: string; status: string; priority: number; conclusion?: string; hypotheses: { claim_id: string; label?: string }[]; entities: { type: string; id: string }[]; tasks: Task[]; log: { id: number; at: string; actor: string; kind: string; text: string }[]; redacted?: boolean }

export interface Snap {
  mode: 'admin' | 'public'; generatedAt: string; nuclei: any[]; places: Place[]; persons: Person[]; relationships: Rel[]; groups: any[]; identityLinks: any[]; events: Ev[]; sources: Src[]; evidence: Evid[]; claims: Claim[];
  investigations: Inv[]; surnames: any[]; contexts: any[]; reviewItems: any[]; reports: any[]; stats: Record<string, number>;
}

export const personDates = (p: Person) => {
  const b = p.redacted ? '' : formatFuzzyDate({ from: p.birth_from, to: p.birth_to, precision: p.birth_precision as any }, {});
  const d = p.redacted ? '' : formatFuzzyDate({ from: p.death_from, to: p.death_to, precision: p.death_precision as any });
  const bu = !p.birth_from && !p.birth_to, du = !p.death_from && !p.death_to;
  if (bu && du) return '';
  return `${bu ? '?' : b} – ${du ? (p.living_status === 'vivo' || p.living_status === 'possivelmente_vivo' ? '' : '?') : d}`.trim();
};
export const yearsShort = (p: Person) => {
  const y = (s?: string) => (s ? parsePartial(s)?.y : undefined);
  const b = y(p.birth_from), d = y(p.death_from ?? p.death_to);
  return !b && !d ? '' : `${b ?? '?'}–${d ?? ''}`;
};
export const evDate = (e: Ev) => formatFuzzyDate({ from: e.date_from, to: e.date_to, precision: e.date_precision as any, text: e.date_text });
export const evKey = (e: Ev) => sortKey({ from: e.date_from, to: e.date_to });
export const minStatus = (...s: Status[]) => s.reduce((a, b) => (STATUS_RANK[a] <= STATUS_RANK[b] ? a : b));

export function buildIndex(snap: Snap) {
  const P = new Map(snap.persons.map((p) => [p.id, p]));
  const PL = new Map(snap.places.map((p) => [p.id, p]));
  const S = new Map(snap.sources.map((s) => [s.id, s]));
  const C = new Map(snap.claims.map((c) => [c.id, c]));
  const N = new Map(snap.nuclei.map((n: any) => [n.id, n]));
  const placePath = (id?: string | null): string => { const out: string[] = []; let cur = id ? PL.get(id) : undefined; let n = 0; while (cur && n++ < 6) { out.push(cur.name); cur = cur.parent_id ? PL.get(cur.parent_id) : undefined; } return out.join(', '); };
  const evByPerson = new Map<string, Ev[]>(); snap.events.forEach((e) => e.persons.forEach((x) => (evByPerson.get(x.person_id) ?? evByPerson.set(x.person_id, []).get(x.person_id)!).push(e)));
  const relByPerson = new Map<string, Rel[]>(); snap.relationships.filter((r) => !r.archived_at).forEach((r) => { for (const k of [r.person_a, r.person_b]) (relByPerson.get(k) ?? relByPerson.set(k, []).get(k)!).push(r); });
  const evidBySubject = new Map<string, Evid[]>(); snap.evidence.forEach((e) => { const k = `${e.subject_type}:${e.subject_id}`; (evidBySubject.get(k) ?? evidBySubject.set(k, []).get(k)!).push(e); });
  const evidBySource = new Map<string, Evid[]>(); snap.evidence.forEach((e) => (evidBySource.get(e.source_id) ?? evidBySource.set(e.source_id, []).get(e.source_id)!).push(e));
  const claimsByEntity = new Map<string, Claim[]>(); snap.claims.forEach((c) => c.entities.forEach((x) => { const k = `${x.type}:${x.id}`; (claimsByEntity.get(k) ?? claimsByEntity.set(k, []).get(k)!).push(c); }));
  const groupsByPerson = new Map<string, any[]>(); snap.groups.forEach((g: any) => g.memberIds.forEach((m: string) => (groupsByPerson.get(m) ?? groupsByPerson.set(m, []).get(m)!).push(g)));
  return { P, PL, S, C, N, placePath, evByPerson, relByPerson, evidBySubject, evidBySource, claimsByEntity, groupsByPerson };
}
export type Index = ReturnType<typeof buildIndex>;
