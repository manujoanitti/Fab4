// Exportação GEDCOM 5.5.1. Só representa o que o formato comporta: pessoas, nomes, eventos, famílias e fontes.
// Relações abaixo do limiar de confiança (hipóteses) NÃO viram vínculos GEDCOM — saem como NOTE na pessoa.
// Pessoas vivas/possivelmente vivas ficam de fora (a menos que includeLiving). Dados completos → exportação JSON.
import { STATUS_RANK, STATUS_LABEL, EVENT_LABEL, type Status } from '../../shared/types';
import { parsePartial } from '../../shared/dates';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const one = (s: string) => { const p = parsePartial(s); if (!p) return null; return [p.d, p.m ? MON[p.m - 1] : null, p.y].filter((x) => x != null).join(' '); };

export function gedcomDate(from?: string | null, to?: string | null, precision?: string | null): string | null {
  const f = from ? one(from) : null, t = to ? one(to) : null;
  if (!f && !t) return null;
  if (precision === 'circa') return `ABT ${f ?? t}`;
  if (precision === 'decada') { const y = parsePartial(from ?? to)!.y; const d = Math.floor(y / 10) * 10; return `BET ${d} AND ${d + 9}`; }
  if (f && t && f !== t) return `BET ${f} AND ${t}`;
  return (f ?? t)!;
}

function text(level: number, tag: string, value: string): string[] {
  const out: string[] = []; const lines = value.split(/\r?\n/);
  lines.forEach((ln, i) => {
    const chunks = ln.match(/.{1,200}/gs) ?? [''];
    chunks.forEach((c, k) => {
      if (i === 0 && k === 0) out.push(`${level} ${tag} ${c}`.trimEnd());
      else out.push(`${level + 1} ${k === 0 ? 'CONT' : 'CONC'} ${c}`.trimEnd());
    });
  });
  return out;
}

const QUAY: Record<Status, number> = { documentado: 3, fortemente_corroborado: 2, hipotese_plausivel: 1, nao_confirmado: 0, descartado: 0 };
const EVT_TAG: Record<string, string> = { batismo: 'BAPM', imigracao: 'IMMI', emigracao: 'EMIG', naturalizacao: 'NATU', residencia: 'RESI', nascimento: 'BIRT', falecimento: 'DEAT' };

export function toGedcom(snap: any, opts: { includeLiving?: boolean; minStatus?: Status } = {}): string {
  const min = STATUS_RANK[opts.minStatus ?? 'fortemente_corroborado'];
  const PL = new Map<string, any>(snap.places.map((p: any) => [p.id, p]));
  const placeStr = (id?: string | null) => { const out: string[] = []; let cur = id ? PL.get(id) : null; let n = 0; while (cur && n++ < 6) { out.push(cur.name); cur = cur.parent_id ? PL.get(cur.parent_id) : null; } return out.join(', '); };
  const persons = snap.persons.filter((p: any) => !p.archived_at && (opts.includeLiving || !p.isPrivate) && p.verification_status !== 'descartado');
  const pid = new Map<string, string>(persons.map((p: any, i: number) => [p.id, `@I${i + 1}@`]));
  const ok = (s: Status) => STATUS_RANK[s] >= min;

  // fontes citadas
  const srcIds = new Map<string, string>(); const srcRef = (id: string) => { if (!srcIds.has(id)) srcIds.set(id, `@S${srcIds.size + 1}@`); return srcIds.get(id)!; };
  const cite = (level: number, type: string, id: string): string[] => {
    const out: string[] = [];
    for (const e of snap.evidence.filter((x: any) => x.subject_type === type && x.subject_id === id && x.stance === 'favoravel')) {
      out.push(`${level} SOUR ${srcRef(e.source_id)}`);
      if (e.excerpt) out.push(...text(level + 1, 'DATA', '').slice(0, 1), ...text(level + 2, 'TEXT', e.excerpt));
    }
    return out;
  };

  // famílias
  const rels = snap.relationships.filter((r: any) => !r.archived_at && r.status !== 'descartado' && pid.has(r.person_a) && pid.has(r.person_b));
  const fams: { id: string; husb?: string; wife?: string; chil: string[]; marr?: any }[] = [];
  const famKey = new Map<string, any>();
  const sex = (id: string) => persons.find((p: any) => p.id === id)?.sex;
  const getFam = (a: string, b?: string) => {
    const key = [a, b].filter(Boolean).sort().join('|');
    let f = famKey.get(key);
    if (!f) {
      const [h, w] = b ? (sex(a) === 'F' || sex(b) === 'M' ? [b, a] : [a, b]) : sex(a) === 'F' ? [undefined, a] : [a, undefined];
      f = { id: `@F${fams.length + 1}@`, husb: h, wife: w, chil: [] }; fams.push(f); famKey.set(key, f);
    }
    return f;
  };
  for (const r of rels.filter((x: any) => (x.type === 'casamento' || x.type === 'uniao') && ok(x.status))) { const f = getFam(r.person_a, r.person_b); if (r.type === 'casamento') f.marr = r; }
  const byChild = new Map<string, any[]>();
  for (const r of rels.filter((x: any) => x.type === 'filiacao' && ok(x.status))) (byChild.get(r.person_b) ?? byChild.set(r.person_b, []).get(r.person_b)!).push(r);
  for (const [child, prs] of byChild) {
    const ps = prs.map((r) => r.person_a);
    const pair = ps.length >= 2 ? ps.slice(0, 2) : null;
    const f = pair && famKey.get([...pair].sort().join('|')) ? getFam(pair[0], pair[1]) : getFam(ps[0], ps[1]);
    if (!f.chil.includes(child)) f.chil.push(child);
  }
  const famsOf = (id: string, asChild: boolean) => fams.filter((f) => (asChild ? f.chil.includes(id) : f.husb === id || f.wife === id));

  const L: string[] = [];
  L.push('0 HEAD', '1 SOUR JOANITTI-ATLAS', '2 NAME Joanitti Atlas', '2 VERS 1.0', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '1 LANG Portuguese',
    `1 DATE ${one(new Date().toISOString().slice(0, 10))}`);
  L.push(...text(1, 'NOTE', 'Exportação parcial: somente o que o GEDCOM comporta. Hipóteses, proveniência detalhada e investigações permanecem apenas na exportação JSON. Relações abaixo do limiar de confiança constam como NOTE nas pessoas.'));

  for (const p of persons) {
    L.push(`0 ${pid.get(p.id)} INDI`);
    const given = p.given_names, sur = p.surname;
    const parts = p.preferred_name.split(' ');
    L.push(`1 NAME ${given && sur ? `${given} /${sur}/` : `${parts.slice(0, -1).join(' ')} /${parts.at(-1)}/`.trim()}`);
    if (given) L.push(`2 GIVN ${given}`); if (sur) L.push(`2 SURN ${sur}`);
    for (const n of p.names.filter((x: any) => x.kind !== 'preferido' && x.name !== p.preferred_name)) { const t = n.name.split(' '); L.push(`1 NAME ${t.slice(0, -1).join(' ')} /${t.at(-1)}/`, '2 TYPE aka'); }
    if (p.sex === 'M' || p.sex === 'F') L.push(`1 SEX ${p.sex}`);
    const bd = gedcomDate(p.birth_from, p.birth_to, p.birth_precision), bp = placeStr(p.birth_place_id);
    if (bd || bp) { L.push('1 BIRT'); if (bd) L.push(`2 DATE ${bd}`); if (bp) L.push(`2 PLAC ${bp}`); }
    const dd = gedcomDate(p.death_from, p.death_to, p.death_precision), dp = placeStr(p.death_place_id);
    if (dd || dp) { L.push('1 DEAT'); if (dd) L.push(`2 DATE ${dd}`); if (dp) L.push(`2 PLAC ${dp}`); }
    else if (p.living_status === 'falecido') L.push('1 DEAT Y');
    for (const o of p.occupations) L.push(...text(1, 'OCCU', o.title));
    for (const e of snap.events.filter((ev: any) => !ev.archived_at && ev.status !== 'descartado' && ev.persons.some((x: any) => x.person_id === p.id))) {
      if (!ok(e.status)) { L.push(...text(1, 'NOTE', `Evento não exportado como fato (${STATUS_LABEL[e.status as Status]}): ${e.title}`)); continue; }
      if ((e.type === 'nascimento' && (bd || bp)) || (e.type === 'falecimento' && (dd || dp)) || e.type === 'casamento') continue;
      const tag = EVT_TAG[e.type];
      L.push(tag ? `1 ${tag}` : '1 EVEN'); if (!tag) L.push(`2 TYPE ${EVENT_LABEL[e.type as keyof typeof EVENT_LABEL] ?? e.type}`);
      const d = gedcomDate(e.date_from, e.date_to, e.date_precision), pl = placeStr(e.place_id);
      if (d) L.push(`2 DATE ${d}`); if (pl) L.push(`2 PLAC ${pl}`); L.push(...text(2, 'NOTE', e.title));
      L.push(...cite(2, 'event', e.id));
    }
    for (const r of snap.relationships.filter((x: any) => !x.archived_at && x.status !== 'descartado' && !ok(x.status) && (x.person_a === p.id || x.person_b === p.id))) {
      const other = persons.find((x: any) => x.id === (r.person_a === p.id ? r.person_b : r.person_a));
      if (other) L.push(...text(1, 'NOTE', `Relação NÃO exportada como vínculo (${STATUS_LABEL[r.status as Status]}): ${r.type} com ${other.preferred_name}`));
    }
    L.push(...text(1, 'NOTE', `Estado de verificação: ${STATUS_LABEL[p.verification_status as Status]}${p.notes ? `\n${p.notes}` : ''}`));
    for (const x of Object.entries(p.external_ids ?? {})) L.push(`1 REFN ${x[1]}`, `2 TYPE ${x[0]}`);
    L.push(...cite(1, 'person', p.id));
    for (const f of famsOf(p.id, true)) L.push(`1 FAMC ${f.id}`);
    for (const f of famsOf(p.id, false)) L.push(`1 FAMS ${f.id}`);
  }
  for (const f of fams) {
    L.push(`0 ${f.id} FAM`);
    if (f.husb) L.push(`1 HUSB ${pid.get(f.husb)}`); if (f.wife) L.push(`1 WIFE ${pid.get(f.wife)}`);
    for (const c of f.chil) L.push(`1 CHIL ${pid.get(c)}`);
    if (f.marr) { L.push('1 MARR'); const d = gedcomDate(f.marr.date_from, f.marr.date_to, f.marr.date_precision), pl = placeStr(f.marr.place_id); if (d) L.push(`2 DATE ${d}`); if (pl) L.push(`2 PLAC ${pl}`); L.push(...cite(2, 'relationship', f.marr.id)); }
  }
  const SRC = new Map<string, any>(snap.sources.map((s: any) => [s.id, s]));
  for (const [id, ref] of srcIds) {
    const s = SRC.get(id); if (!s) continue;
    L.push(`0 ${ref} SOUR`, ...text(1, 'TITL', s.title));
    if (s.institution) L.push(...text(1, 'PUBL', s.institution));
    if (s.url) L.push(...text(1, 'NOTE', `URL: ${s.url}`));
    L.push(...text(1, 'NOTE', `Tipo: ${s.kind}; acesso: ${s.access_status}; confiabilidade (1–5): ${s.reliability}`));
  }
  L.push('0 TRLR');
  return L.join('\r\n') + '\r\n';
}
