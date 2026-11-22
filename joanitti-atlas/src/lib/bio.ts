// Síntese biográfica DETERMINÍSTICA (sem IA): só reescreve dados estruturados, mantendo o grau de certeza de cada afirmação.
import { formatFuzzyDate } from '../../shared/dates';
import { STATUS_LABEL, EVENT_LABEL, LIVING_LABEL, type Status } from '../../shared/types';
import { descendantsOf, siblingsOf, type RelLite } from '../../shared/integrity';
import type { Index, Person, Snap } from './model';
import { evDate, evKey } from './model';

const hedge = (s: Status, sure: string, maybe: string) => (s === 'documentado' || s === 'fortemente_corroborado' ? sure : maybe);
const tag = (s: Status) => `[${STATUS_LABEL[s].toLowerCase()}]`;

export function synthesizeBio(p: Person, snap: Snap, ix: Index): string[] {
  if (p.redacted) return ['Dados protegidos: pessoa viva ou possivelmente viva (visão pública).'];
  const out: string[] = [];
  const names = p.names.filter((n) => n.kind !== 'preferido' && n.name !== p.preferred_name);
  out.push(`${p.preferred_name} — situação: ${LIVING_LABEL[p.living_status as keyof typeof LIVING_LABEL] ?? p.living_status}; estado de verificação do registro: ${STATUS_LABEL[p.verification_status].toLowerCase()}.` +
    (names.length ? ` Também aparece como: ${names.map((n) => n.name).join('; ')}.` : ''));
  const bp = ix.placePath(p.birth_place_id), dp = ix.placePath(p.death_place_id);
  if (p.birth_from || p.birth_to) out.push(`${hedge(p.verification_status, 'Consta nascimento em', 'Segundo as fontes disponíveis (a confirmar), teria nascido em')} ${formatFuzzyDate({ from: p.birth_from, to: p.birth_to, precision: p.birth_precision as any })}${bp ? `, em ${bp}` : ' (local não informado)'}.`);
  else out.push('Data de nascimento desconhecida.');
  if (p.death_from || p.death_to) out.push(`${hedge(p.verification_status, 'Consta falecimento em', 'Teria falecido em')} ${formatFuzzyDate({ from: p.death_from, to: p.death_to, precision: p.death_precision as any })}${dp ? `, em ${dp}` : ' (local não informado)'}.`);
  for (const o of p.occupations) out.push(`Ocupação registrada: ${o.title}${o.period_text ? ` (${o.period_text})` : ''} ${tag(o.status)}.`);

  const rels = snap.relationships.filter((r) => !r.archived_at && r.status !== 'descartado' && (r.person_a === p.id || r.person_b === p.id));
  const lite: RelLite[] = snap.relationships.filter((r) => !r.archived_at).map((r) => ({ id: r.id, type: r.type as any, a: r.person_a, b: r.person_b, status: r.status }));
  for (const r of rels) {
    const other = ix.P.get(r.person_a === p.id ? r.person_b : r.person_a); if (!other) continue;
    const nm = other.preferred_name;
    if (r.type === 'filiacao') out.push(r.person_b === p.id ? `${hedge(r.status, 'Filiação registrada: genitor(a)', 'Possível genitor(a) (hipótese, não documentado)')} ${nm} ${tag(r.status)}.` : `${hedge(r.status, 'Filiação registrada: filho(a)', 'Possível filho(a) (hipótese, não documentado)')} ${nm} ${tag(r.status)}.`);
    else if (r.type === 'casamento' || r.type === 'uniao') out.push(`${hedge(r.status, r.type === 'casamento' ? 'Casamento registrado com' : 'União registrada com', 'Possível ' + (r.type === 'casamento' ? 'casamento' : 'união') + ' com')} ${nm} ${tag(r.status)}.`);
    else out.push(`Parentesco de natureza ${r.type === 'desconhecida' ? 'desconhecida' : 'inferida'} com ${nm} ${tag(r.status)} — a natureza exata não está estabelecida.`);
  }
  const sib = siblingsOf(lite, p.id); if (sib.length) out.push(`Irmandade derivada de filiações em comum: ${sib.map((s) => ix.P.get(s.id)?.preferred_name + (s.half ? ' (meio-irmão/ã)' : '')).join('; ')}.`);
  const desc = descendantsOf(lite, p.id); if (desc.size) out.push(`${desc.size} descendente(s) registrado(s) na base.`);
  const gs = ix.groupsByPerson.get(p.id) ?? [];
  for (const g of gs) out.push(`Listado(a) no agrupamento investigativo "${g.name}" junto a ${g.memberIds.length - 1} outra(s) pessoa(s), SEM relação de parentesco especificada.`);
  for (const l of snap.identityLinks.filter((l: any) => l.person_a === p.id || l.person_b === p.id)) {
    const o = ix.P.get(l.person_a === p.id ? l.person_b : l.person_a);
    if (o) out.push(`Possível identidade com outro registro de "${o.preferred_name}" ${tag(l.status)} — não fundidos.`);
  }
  const evs = (ix.evByPerson.get(p.id) ?? []).filter((e) => e.status !== 'descartado' && !['nascimento', 'falecimento'].includes(e.type)).sort((a, b) => evKey(a) - evKey(b)).slice(0, 6);
  for (const e of evs) out.push(`${evDate(e)}: ${e.title} (${EVENT_LABEL[e.type as keyof typeof EVENT_LABEL] ?? e.type}) ${tag(e.status)}.`);
  const hyps = (ix.claimsByEntity.get(`person:${p.id}`) ?? []).filter((c) => c.kind !== 'fato' && c.status !== 'documentado');
  if (hyps.length) out.push(`Hipóteses em aberto envolvendo esta pessoa: ${hyps.map((c) => `${c.code ?? ''} ${tag(c.status)}`).join(', ')}.`);
  out.push('Síntese gerada automaticamente a partir dos dados estruturados; hipóteses permanecem como hipóteses. Consulte as fontes.');
  return out;
}
