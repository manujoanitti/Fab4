import { searchScore } from '../../shared/names';
import { yearRange } from '../../shared/dates';
import type { Index, Snap } from './model';
import type { Status } from '../../shared/types';

export interface Hit { type: 'pessoa' | 'evento' | 'lugar' | 'fonte' | 'investigacao' | 'sobrenome' | 'afirmacao'; id: string; title: string; subtitle: string; score: number; to: string }
export interface Filters { nucleus?: string; status?: Status | ''; from?: number | null; to?: number | null; place?: string; types?: string[] }

export function searchAll(snap: Snap, ix: Index, q: string, f: Filters = {}): Hit[] {
  const out: Hit[] = [];
  const has = q.trim().length > 0;
  const inPeriod = (d: any) => { if (f.from == null && f.to == null) return true; const r = yearRange(d); return !!r && (f.to == null || r[0] <= f.to) && (f.from == null || r[1] >= f.from); };
  const want = (t: string) => !f.types?.length || f.types.includes(t);
  const sc = (text: string, boost = 1) => (has ? searchScore(q, text) * boost : 0.5);
  const placeOk = (id?: string | null) => { if (!f.place) return true; let cur = id ? ix.PL.get(id) : undefined; let n = 0; while (cur && n++ < 6) { if (cur.id === f.place) return true; cur = cur.parent_id ? ix.PL.get(cur.parent_id) : undefined; } return false; };
  if (want('pessoa')) for (const p of snap.persons) {
    if (p.archived_at || (f.nucleus && !p.nucleusIds.includes(f.nucleus)) || (f.status && p.verification_status !== f.status)) continue;
    if (!inPeriod({ from: p.birth_from ?? p.death_from, to: p.death_to ?? p.death_from ?? p.birth_from, precision: 'intervalo' })) continue;
    if (!placeOk(p.birth_place_id) && !placeOk(p.death_place_id) && !(ix.evByPerson.get(p.id) ?? []).some((e) => placeOk(e.place_id))) continue;
    const hay = [p.preferred_name, ...p.names.map((n) => n.name), ...p.occupations.map((o) => o.title), ix.placePath(p.birth_place_id), p.birth_from, p.death_from, ...Object.values(p.external_ids)].filter(Boolean).join(' ');
    const s = sc(hay) + (has && searchScore(q, p.preferred_name) > 0 ? 0.25 : 0);
    if (s > 0) out.push({ type: 'pessoa', id: p.id, title: p.preferred_name, subtitle: [p.birth_from?.slice(0, 4), p.death_from?.slice(0, 4)].filter(Boolean).join('–') || 'sem datas', score: s, to: `/pessoas/${p.id}` });
  }
  if (want('evento')) for (const e of snap.events) {
    if (e.archived_at || (f.status && e.status !== f.status) || !inPeriod({ from: e.date_from, to: e.date_to, precision: e.date_precision }) || !placeOk(e.place_id)) continue;
    if (f.nucleus && !e.persons.some((x) => ix.P.get(x.person_id)?.nucleusIds.includes(f.nucleus!))) continue;
    const s = sc(`${e.title} ${e.description ?? ''} ${ix.placePath(e.place_id)} ${e.date_from ?? ''}`, 0.9);
    if (s > 0) out.push({ type: 'evento', id: e.id, title: e.title, subtitle: [e.date_from, ix.PL.get(e.place_id ?? '')?.name].filter(Boolean).join(' · '), score: s, to: `/linha-do-tempo?evento=${e.id}` });
  }
  if (want('lugar') && !f.nucleus && !f.status) for (const p of snap.places) { if (p.archived_at) continue; const s = sc(`${p.name} ${p.historic_names.join(' ')}`, 0.95); if (s > 0 && placeOk(p.id)) out.push({ type: 'lugar', id: p.id, title: p.name, subtitle: p.level, score: s, to: `/mapa?lugar=${p.id}` }); }
  if (want('fonte') && !f.nucleus) for (const s of snap.sources) { if (s.archived_at) continue; const sc2 = sc(`${s.title} ${s.institution ?? ''} ${s.excerpt ?? ''} ${s.archival_ref ?? ''}`, 0.8); if (sc2 > 0) out.push({ type: 'fonte', id: s.id, title: s.title, subtitle: s.institution ?? '', score: sc2, to: `/documentos?doc=${s.id}` }); }
  if (want('investigacao') && !f.nucleus) for (const v of snap.investigations) { const s = sc(`${v.title} ${v.question}`, 0.85); if (s > 0 && (!f.status || true)) out.push({ type: 'investigacao', id: v.id, title: v.title, subtitle: v.question, score: s, to: `/investigacoes?inv=${v.id}` }); }
  if (want('afirmacao') && !f.nucleus) for (const c of snap.claims) { if (c.redacted) continue; const s = sc(`${c.code ?? ''} ${c.content}`, 0.7); if (s > 0 && (!f.status || c.status === f.status)) out.push({ type: 'afirmacao', id: c.id, title: `${c.code ?? 'Afirmação'}: ${c.content.slice(0, 90)}`, subtitle: c.status, score: s, to: `/investigacoes?claim=${c.id}` }); }
  if (want('sobrenome') && !f.nucleus && !f.status) for (const s of snap.surnames) { const sc2 = sc(s.form, 0.9); if (sc2 > 0) out.push({ type: 'sobrenome', id: s.id, title: s.form, subtitle: s.attested_places ?? '', score: sc2, to: '/pessoas?aba=sobrenomes' }); }
  return out.sort((a, b) => b.score - a.score);
}
