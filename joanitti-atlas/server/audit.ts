// Verificações de integridade do acervo inteiro (usadas na Administração e nos testes).
import type { Db } from './db/connection';
import { loadSnapshot } from './snapshot';
import { validateRelationship, descendantsOf, type RelLite } from '../shared/integrity';
import { fold } from '../shared/names';
import { parsePartial } from '../shared/dates';
import { STATUS_RANK, type Status } from '../shared/types';

export interface Issue { severity: 'erro' | 'aviso' | 'info'; code: string; message: string; entityType?: string; entityId?: string }

export function auditIntegrity(db: Db): { issues: Issue[]; summary: Record<string, number> } {
  const s = loadSnapshot(db, 'admin');
  const issues: Issue[] = [];
  const add = (severity: Issue['severity'], code: string, message: string, entityType?: string, entityId?: string) => issues.push({ severity, code, message, entityType, entityId });
  const P = new Map<string, any>(s.persons.map((p: any) => [p.id, p]));
  const rels: RelLite[] = s.relationships.filter((r: any) => !r.archived_at).map((r: any) => ({ id: r.id, type: r.type, a: r.person_a, b: r.person_b, status: r.status, subtype: r.subtype }));

  for (const r of rels) if (r.type === 'filiacao' && r.status !== 'descartado' && descendantsOf(rels, r.b).has(r.b)) add('erro', 'ciclo_filiacao', `Ciclo de filiação envolvendo ${P.get(r.b)?.preferred_name ?? r.b}.`, 'relationship', r.id);
  for (const r of s.relationships.filter((x: any) => !x.archived_at)) {
    for (const k of ['person_a', 'person_b']) if (!P.get(r[k]) || P.get(r[k]).archived_at) add('erro', 'relacao_pessoa_arquivada', `Relação ${r.id} aponta para pessoa inexistente/arquivada.`, 'relationship', r.id);
    const v = validateRelationship(rels.filter((x) => x.id !== r.id), { id: r.id, type: r.type, a: r.person_a, b: r.person_b, status: r.status, subtype: r.subtype },
      new Map([...P].map(([id, p]) => [id, { id, birthYear: parsePartial(p.birth_from)?.y ?? null, deathYear: parsePartial(p.death_from ?? p.death_to)?.y ?? null }])));
    v.warnings.forEach((w) => add('aviso', 'idade_improvavel', `${P.get(r.person_a)?.preferred_name} → ${P.get(r.person_b)?.preferred_name}: ${w}`, 'relationship', r.id));
  }

  const favorable = new Set(s.evidence.filter((e: any) => e.stance === 'favoravel').map((e: any) => `${e.subject_type}:${e.subject_id}`));
  const SRC = new Map<string, any>(s.sources.map((x: any) => [x.id, x]));
  const needsEvidence = (type: string, row: any, st: Status, label: string) => {
    if (STATUS_RANK[st] >= STATUS_RANK.fortemente_corroborado && !favorable.has(`${type}:${row.id}`)) add('aviso', 'status_sem_evidencia', `${label} está "${st}" sem evidência favorável vinculada.`, type, row.id);
    if (st === 'documentado') {
      const ev = s.evidence.filter((e: any) => e.subject_type === type && e.subject_id === row.id && e.stance === 'favoravel');
      if (ev.length && !ev.some((e: any) => ['examinada_integral', 'examinada_extrato'].includes(SRC.get(e.source_id)?.access_status))) add('aviso', 'documentado_sem_fonte_examinada', `${label} está "documentado", mas nenhuma fonte vinculada foi examinada.`, type, row.id);
    }
  };
  for (const p of s.persons.filter((x: any) => !x.archived_at)) needsEvidence('person', p, p.verification_status, p.preferred_name);
  for (const r of s.relationships.filter((x: any) => !x.archived_at)) needsEvidence('relationship', r, r.status, `Relação ${r.type} (${P.get(r.person_a)?.preferred_name} / ${P.get(r.person_b)?.preferred_name})`);
  for (const e of s.events.filter((x: any) => !x.archived_at)) needsEvidence('event', e, e.status, `Evento "${e.title}"`);
  for (const c of s.claims.filter((x: any) => !x.archived_at)) needsEvidence('claim', c, c.status, `Afirmação ${c.code ?? c.id}`);

  for (const src of s.sources.filter((x: any) => !x.archived_at)) {
    if (src.reliability >= 4 && ['citada_nao_examinada', 'para_consulta_futura', 'apenas_indexada'].includes(src.access_status)) add('aviso', 'confiabilidade_incoerente', `Fonte "${src.title}" tem confiabilidade ${src.reliability} sem ter sido examinada.`, 'source', src.id);
    if (!src.url && !src.archival_ref && !src.local_file) add('info', 'fonte_sem_referencia', `Fonte "${src.title}" não tem URL, referência arquivística nem arquivo.`, 'source', src.id);
  }
  const names = new Map<string, any[]>();
  for (const p of s.persons.filter((x: any) => !x.archived_at)) (names.get(fold(p.preferred_name)) ?? names.set(fold(p.preferred_name), []).get(fold(p.preferred_name))!).push(p);
  const linked = new Set(s.identityLinks.flatMap((l: any) => [l.person_a, l.person_b]));
  for (const [n, ps] of names) if (ps.length > 1) add(ps.every((p: any) => linked.has(p.id)) ? 'info' : 'aviso', 'homonimos', `Homônimos (${ps.length}): ${ps[0].preferred_name}. ${ps.every((p: any) => linked.has(p.id)) ? 'Há hipótese de identidade registrada.' : 'Registre se são a mesma pessoa ou pessoas distintas.'}`, 'person', ps[0].id);
  const inGroup = new Set(s.groups.flatMap((g: any) => g.memberIds));
  const inRel = new Set(rels.flatMap((r) => [r.a, r.b]));
  for (const p of s.persons.filter((x: any) => !x.archived_at)) if (!inGroup.has(p.id) && !inRel.has(p.id)) add('info', 'pessoa_isolada', `${p.preferred_name} não tem relações nem grupo investigativo.`, 'person', p.id);
  for (const p of s.persons.filter((x: any) => !x.archived_at)) {
    if ((p.death_from || p.death_to) && ['vivo', 'possivelmente_vivo'].includes(p.living_status)) add('erro', 'vivo_com_obito', `${p.preferred_name} tem data de falecimento mas está marcada como viva.`, 'person', p.id);
    if (p.living_status === 'desconhecido') add('aviso', 'privacidade_indeterminada', `${p.preferred_name}: situação (viva/falecida) desconhecida — tratada como privada na visão pública.`, 'person', p.id);
  }
  for (const pl of s.places.filter((x: any) => !x.archived_at)) {
    if (pl.lat == null && ['municipio', 'localidade', 'porto'].includes(pl.level)) add('info', 'lugar_sem_coordenadas', `${pl.name} não tem coordenadas.`, 'place', pl.id);
    else if (pl.lat != null && !pl.coord_verified) add('info', 'coordenada_nao_verificada', `Coordenadas de ${pl.name} ainda não verificadas.`, 'place', pl.id);
  }
  const pend = s.reviewItems.filter((r: any) => r.status === 'pendente').length;
  if (pend) add('info', 'revisao_pendente', `${pend} item(ns) de revisão pendentes.`);
  const summary: Record<string, number> = { erro: 0, aviso: 0, info: 0 };
  issues.forEach((i) => summary[i.severity]++);
  return { issues, summary };
}
