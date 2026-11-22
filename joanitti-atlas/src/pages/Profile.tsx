import { Link, useParams } from 'react-router-dom';
import { useAtlas } from '../lib/api';
import { Empty, Kv, Page, Section, Stars, StatusBadge } from '../components/ui';
import { Avatar } from '../components/person';
import { synthesizeBio } from '../lib/bio';
import { evDate, evKey, personDates, type Person, type Rel } from '../lib/model';
import { formatFuzzyDate } from '../../shared/dates';
import { ACCESS_LABEL, EVENT_LABEL, LIVING_LABEL, REL_LABEL, SOURCE_KIND_LABEL } from '../../shared/types';
import { siblingsOf } from '../../shared/integrity';

export function Profile() {
  const { id } = useParams();
  const { snap, ix, admin } = useAtlas();
  if (!snap || !ix) return null;
  const p = ix.P.get(id ?? '');
  if (!p) return <Page title="Pessoa não encontrada"><Empty>Não há registro com este identificador (ou ele é protegido na visão pública).</Empty></Page>;
  const link = (pid: string) => { const o = ix.P.get(pid); return o ? <Link className="text-blue underline" to={`/pessoas/${pid}`}>{o.preferred_name}</Link> : pid; };
  const rels = (ix.relByPerson.get(p.id) ?? []);
  const valid = rels.filter((r) => r.status !== 'descartado'), discarded = rels.filter((r) => r.status === 'descartado');
  const parents = valid.filter((r) => r.type === 'filiacao' && r.person_b === p.id), kids = valid.filter((r) => r.type === 'filiacao' && r.person_a === p.id);
  const unions = valid.filter((r) => r.type === 'casamento' || r.type === 'uniao'), other = valid.filter((r) => r.type === 'parentesco_inferido' || r.type === 'desconhecida');
  const sib = siblingsOf(snap.relationships.filter((r) => !r.archived_at).map((r) => ({ id: r.id, type: r.type as any, a: r.person_a, b: r.person_b, status: r.status })), p.id);
  const groups = ix.groupsByPerson.get(p.id) ?? [];
  const ids = snap.identityLinks.filter((l: any) => l.person_a === p.id || l.person_b === p.id);
  const events = [...(ix.evByPerson.get(p.id) ?? [])].sort((a, b) => evKey(a) - evKey(b));
  const placeIds = new Set<string>([p.birth_place_id, p.death_place_id, ...events.map((e) => e.place_id), ...p.occupations.map((o) => o.place_id)].filter(Boolean) as string[]);
  const claims = ix.claimsByEntity.get(`person:${p.id}`) ?? [];
  // fontes ligadas direta ou indiretamente
  const srcMap = new Map<string, { stance: string; excerpt?: string; via: string }[]>();
  const addSrc = (e: { source_id: string; stance: string; excerpt?: string }, via: string) => (srcMap.get(e.source_id) ?? srcMap.set(e.source_id, []).get(e.source_id)!).push({ stance: e.stance, excerpt: e.excerpt, via });
  (ix.evidBySubject.get(`person:${p.id}`) ?? []).forEach((e) => addSrc(e, 'pessoa'));
  events.forEach((ev) => (ix.evidBySubject.get(`event:${ev.id}`) ?? []).forEach((e) => addSrc(e, ev.title)));
  valid.forEach((r) => (ix.evidBySubject.get(`relationship:${r.id}`) ?? []).forEach((e) => addSrc(e, 'relação')));
  snap.sources.filter((s) => s.personIds.includes(p.id)).forEach((s) => { if (!srcMap.has(s.id)) srcMap.set(s.id, [{ stance: 'contexto', via: 'vínculo direto' }]); });
  const bio = synthesizeBio(p, snap, ix);
  const relRow = (r: Rel, label: string, pid: string) => (
    <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm"><span className="chip">{label}</span>{link(pid)}<StatusBadge status={r.status} small />{r.confidence != null && <span className="text-xs text-ink2">confiança {r.confidence}%</span>}{r.notes && <span className="w-full text-xs text-ink2">{r.notes}</span>}</li>);

  return (
    <Page title={p.preferred_name} wide={false}
      subtitle={<span className="flex flex-wrap items-center gap-2"><Avatar p={p as Person} size={28} /><span>{personDates(p) || 'sem datas'}</span><StatusBadge status={p.verification_status} /><span className="chip">{LIVING_LABEL[p.living_status as keyof typeof LIVING_LABEL]}</span></span>}
      actions={<><Link className="btn" to={`/arvore?foco=${p.id}`}>Ver na árvore</Link>{admin && !p.redacted && <Link className="btn btn-primary" to={`/admin?aba=pessoas&id=${p.id}`}>Editar</Link>}</>}>
      {p.redacted && <p className="mb-4 rounded-lg border border-sepia/40 bg-sepia/10 p-3 text-sm">🔒 Pessoa viva ou possivelmente viva: os dados pessoais são protegidos na visão pública. Entre como administrador para ver o registro completo.</p>}

      <Section title="Identificação">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kv k="Nome preferencial">{p.preferred_name}</Kv>
          <Kv k="Variações do nome">{p.names.filter((n) => n.name !== p.preferred_name).map((n) => <div key={n.id}>{n.name} <span className="text-xs text-ink2">({n.kind.replace('_', ' ')}{n.note ? ` — ${n.note}` : ''})</span></div>)}{!p.names.some((n) => n.name !== p.preferred_name) && '—'}</Kv>
          <Kv k="Sexo registrado">{p.sex === 'M' ? 'Masculino' : p.sex === 'F' ? 'Feminino' : 'Desconhecido (não presumido)'}</Kv>
          <Kv k="Nascimento">{p.birth_from || p.birth_to ? `${formatFuzzyDate({ from: p.birth_from, to: p.birth_to, precision: p.birth_precision as any })}${p.birth_place_id ? ' — ' + ix.placePath(p.birth_place_id) : ''}` : 'desconhecido'}</Kv>
          <Kv k="Falecimento">{p.death_from || p.death_to ? `${formatFuzzyDate({ from: p.death_from, to: p.death_to, precision: p.death_precision as any })}${p.death_place_id ? ' — ' + ix.placePath(p.death_place_id) : ''}` : 'desconhecido'}</Kv>
          <Kv k="Ocupações">{p.occupations.map((o) => <div key={o.id}>{o.title}{o.period_text ? ` (${o.period_text})` : ''} <StatusBadge status={o.status} small /></div>)}{!p.occupations.length && '—'}</Kv>
          <Kv k="Identificadores externos">{Object.entries(p.external_ids).map(([k, v]) => <div key={k}>{k}: <code>{v}</code></div>)}{!Object.keys(p.external_ids).length && '—'}</Kv>
          <Kv k="Núcleos">{p.nucleusIds.map((n) => <div key={n}>{ix.N.get(n)?.name}</div>)}</Kv>
          <Kv k="Estado de verificação"><StatusBadge status={p.verification_status} />{p.reported_status && <div className="mt-1 text-xs text-ink2">No relatório: {p.reported_status}</div>}</Kv>
        </div>
        {p.status_rationale && <p className="mt-3 rounded-lg bg-paper2 p-2 text-xs text-ink2"><b>Justificativa do estado:</b> {p.status_rationale}</p>}
        {p.identity_note && <p className="mt-2 rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs"><b>Cuidado com identidade/homônimos:</b> {p.identity_note}</p>}
      </Section>

      <Section title="Biografia (síntese automática determinística)">
        <ul className="list-disc space-y-1.5 pl-5 text-sm">{bio.map((l, i) => <li key={i} className={i === bio.length - 1 ? 'text-xs text-ink2' : ''}>{l}</li>)}</ul>
        {p.biography && <div className="mt-3 border-t border-line pt-3 text-sm whitespace-pre-wrap"><div className="label mb-1">Texto biográfico editado</div>{p.biography}</div>}
      </Section>

      <Section title="Relações familiares" id="relacoes">
        {!valid.length && !groups.length && <Empty>Nenhuma relação familiar registrada. Isso é intencional: não se criam vínculos sem evidência.</Empty>}
        <ul className="space-y-1.5">
          {parents.map((r) => relRow(r, 'genitor(a)', r.person_a))}{unions.map((r) => relRow(r, REL_LABEL[r.type as keyof typeof REL_LABEL], r.person_a === p.id ? r.person_b : r.person_a))}
          {kids.map((r) => relRow(r, 'filho(a)', r.person_b))}{other.map((r) => relRow(r, REL_LABEL[r.type as keyof typeof REL_LABEL], r.person_a === p.id ? r.person_b : r.person_a))}
          {sib.map((s) => <li key={s.id} className="flex items-center gap-2 text-sm"><span className="chip">{s.half ? 'meio-irmão(ã)' : 'irmão(ã)'}</span>{link(s.id)}<span className="text-xs text-ink2">derivado de filiações</span></li>)}
        </ul>
        {groups.map((g: any) => <div key={g.id} className="mt-3 rounded-lg border border-dashed border-line p-3 text-sm"><b>Agrupamento investigativo:</b> {g.name}<p className="mt-1 text-xs text-ink2">{g.description}</p>
          <div className="mt-1 flex flex-wrap gap-2">{g.memberIds.filter((m: string) => m !== p.id).map((m: string) => <span key={m} className="chip">{link(m)}</span>)}</div></div>)}
        {ids.map((l: any) => <div key={l.id} className="mt-2 rounded-lg border border-warn/40 p-2 text-sm">Possível identidade com {link(l.person_a === p.id ? l.person_b : l.person_a)} <StatusBadge status={l.status} small /><div className="text-xs text-ink2">{l.note}</div></div>)}
        {discarded.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink2">Relações descartadas (histórico da investigação)</summary><ul className="mt-1">{discarded.map((r) => relRow(r, REL_LABEL[r.type as keyof typeof REL_LABEL], r.person_a === p.id ? r.person_b : r.person_a))}</ul></details>}
      </Section>

      <Section title="Eventos e linha do tempo">
        {events.length ? <ol className="relative ml-2 space-y-3 border-l border-line pl-4">{events.map((e) => (
          <li key={e.id}><span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-blue" /><div className="text-xs text-ink2">{evDate(e)}{e.place_id ? ` · ${ix.PL.get(e.place_id)?.name}` : ''}</div>
            <div className="text-sm"><Link to={`/linha-do-tempo?evento=${e.id}`} className="text-blue underline">{e.title}</Link></div>
            <div className="mt-0.5 flex flex-wrap gap-1"><span className="chip">{EVENT_LABEL[e.type as keyof typeof EVENT_LABEL]}</span><StatusBadge status={e.status} small />{e.is_route_speculative && <span className="chip">trajeto hipotético</span>}</div></li>))}</ol> : <Empty>Sem eventos registrados.</Empty>}
      </Section>

      <Section title="Lugares associados">
        {placeIds.size ? <div className="flex flex-wrap gap-2">{[...placeIds].map((pl) => <Link key={pl} to={`/mapa?lugar=${pl}`} className="chip hover:border-blue">📍 {ix.placePath(pl)}</Link>)}</div> : <Empty>Nenhum lugar associado.</Empty>}
      </Section>

      <Section title="Documentos e fontes">
        {srcMap.size ? <ul className="space-y-2">{[...srcMap].map(([sid, uses]) => { const s = ix.S.get(sid); if (!s) return null; return (
          <li key={sid} className="rounded-lg border border-line p-2.5"><Link to={`/documentos?doc=${sid}`} className="serif text-sm text-blue underline">{s.title}</Link>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink2"><span className="chip">{SOURCE_KIND_LABEL[s.kind]}</span><span className="chip">{ACCESS_LABEL[s.access_status]}</span><Stars n={s.reliability} />
              {uses.slice(0, 3).map((u, i) => <span key={i} className="chip">{u.stance === 'contraria' ? '⚠ contrária' : u.stance === 'favoravel' ? '✔ favorável' : 'contexto'} · {u.via}</span>)}</div>
            {uses.find((u) => u.excerpt)?.excerpt && <p className="mt-1 text-xs italic">“{uses.find((u) => u.excerpt)!.excerpt}”</p>}</li>); })}</ul> : <Empty>Nenhuma fonte vinculada.</Empty>}
      </Section>

      <Section title="Hipóteses e controvérsias">
        {claims.length ? <ul className="space-y-2">{claims.map((c) => <li key={c.id} className="rounded-lg border border-line p-2.5 text-sm"><div className="flex flex-wrap items-center gap-2"><span className="chip">{c.code}</span><StatusBadge status={c.status} small /><Link to={`/investigacoes?claim=${c.id}`} className="text-xs text-blue underline">abrir</Link></div><p className="mt-1">{c.content}</p>{c.contradictions && <p className="mt-1 text-xs text-ink2"><b>Limitações:</b> {c.contradictions}</p>}</li>)}</ul> : <Empty>Nenhuma hipótese registrada para esta pessoa.</Empty>}
      </Section>

      <Section title="Anotações do pesquisador">{p.notes ? <p className="whitespace-pre-wrap text-sm">{p.notes}</p> : <Empty>Sem anotações.</Empty>}</Section>
    </Page>
  );
}
