import { formatFuzzyDate } from '../../shared/dates';

const q = (v: any, sep: string) => { const s = v == null ? '' : String(v).replace(/\r?\n/g, ' '); return s.includes(sep) || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(rows: Record<string, any>[], sep = ';'): string {
  if (!rows.length) return '﻿';
  const cols = Object.keys(rows[0]);
  return '﻿' + [cols.join(sep), ...rows.map((r) => cols.map((c) => q(r[c], sep)).join(sep))].join('\r\n') + '\r\n';
}

export const CSV_TABLES = ['pessoas', 'relacoes', 'eventos', 'lugares', 'fontes', 'afirmacoes', 'evidencias'] as const;
export function csvRows(name: string, snap: any): Record<string, any>[] {
  const P = new Map<string, any>(snap.persons.map((p: any) => [p.id, p])), PL = new Map<string, any>(snap.places.map((p: any) => [p.id, p]));
  const pn = (id: string) => P.get(id)?.preferred_name ?? id;
  switch (name) {
    case 'pessoas': return snap.persons.filter((p: any) => !p.archived_at).map((p: any) => ({
      id: p.id, nome: p.preferred_name, variantes: p.names.filter((n: any) => n.kind !== 'preferido').map((n: any) => n.name).join(' | '),
      nascimento: formatFuzzyDate({ from: p.birth_from, to: p.birth_to, precision: p.birth_precision }), falecimento: formatFuzzyDate({ from: p.death_from, to: p.death_to, precision: p.death_precision }),
      local_nascimento: PL.get(p.birth_place_id)?.name ?? '', situacao: p.living_status, verificacao: p.verification_status, nucleos: p.nucleusIds.join(' | '), observacoes: p.notes ?? '' }));
    case 'relacoes': return snap.relationships.filter((r: any) => !r.archived_at).map((r: any) => ({ id: r.id, tipo: r.type, subtipo: r.subtype ?? '', pessoa_a: pn(r.person_a), pessoa_b: pn(r.person_b), estado: r.status, confianca: r.confidence ?? '', notas: r.notes ?? '' }));
    case 'eventos': return snap.events.filter((e: any) => !e.archived_at).map((e: any) => ({ id: e.id, tipo: e.type, titulo: e.title, data: formatFuzzyDate({ from: e.date_from, to: e.date_to, precision: e.date_precision }), lugar: PL.get(e.place_id)?.name ?? '', estado: e.status,
      pessoas: e.persons.map((x: any) => pn(x.person_id)).join(' | ') }));
    case 'lugares': return snap.places.filter((p: any) => !p.archived_at).map((p: any) => ({ id: p.id, nome: p.name, nivel: p.level, superior: PL.get(p.parent_id)?.name ?? '', lat: p.lat ?? '', lon: p.lon ?? '', precisao: p.coord_precision, verificado: p.coord_verified ? 'sim' : 'não' }));
    case 'fontes': return snap.sources.filter((s: any) => !s.archived_at).map((s: any) => ({ id: s.id, tipo: s.kind, documento: s.doc_type, titulo: s.title, instituicao: s.institution ?? '', url: s.url ?? '', acesso: s.access_status, confiabilidade: s.reliability }));
    case 'afirmacoes': return snap.claims.filter((c: any) => !c.archived_at).map((c: any) => ({ id: c.id, codigo: c.code ?? '', tipo: c.kind, conteudo: c.content, estado: c.status, estado_no_relatorio: c.reported_status ?? '', confianca: c.confidence ?? '', justificativa: c.justification ?? '' }));
    case 'evidencias': return snap.evidence.map((e: any) => ({ id: e.id, tipo_sujeito: e.subject_type, sujeito: e.subject_id, fonte: e.source_id, posicao: e.stance, trecho: e.excerpt ?? '' }));
    default: return [];
  }
}
