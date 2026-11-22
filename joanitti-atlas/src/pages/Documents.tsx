import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAtlas } from '../lib/api';
import { Empty, Kv, Modal, Page, Stars } from '../components/ui';
import { searchScore } from '../../shared/names';
import { ACCESS_LABEL, DOC_TYPE_LABEL, SOURCE_KIND_LABEL, SOURCE_KINDS, type Status } from '../../shared/types';
import { evDate } from '../lib/model';

const KIND_TONE: Record<string, string> = { primaria: 'text-ok', oficial: 'text-blue', secundaria: 'text-ink2', colaborativa: 'text-warn', nao_verificada: 'text-bad' };

export function DocumentsPage() {
  const { snap, ix } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(''); const [kind, setKind] = useState(''); const [dt, setDt] = useState(''); const [acc, setAcc] = useState(''); const [rel, setRel] = useState(''); const [place, setPlace] = useState(''); const [person, setPerson] = useState('');
  const list = useMemo(() => {
    if (!snap || !ix) return [];
    return snap.sources.filter((s) => !s.archived_at && (!kind || s.kind === kind) && (!dt || s.doc_type === dt) && (!acc || s.access_status === acc) && (!rel || s.reliability >= +rel) && (!place || s.placeIds.includes(place)) && (!person || s.personIds.includes(person)))
      .map((s) => ({ s, sc: q ? searchScore(q, `${s.title} ${s.institution ?? ''} ${s.excerpt ?? ''} ${s.transcription ?? ''} ${s.archival_ref ?? ''} ${s.url ?? ''}`) : 1 })).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc || a.s.title.localeCompare(b.s.title)).map((x) => x.s);
  }, [snap, ix, q, kind, dt, acc, rel, place, person]);
  if (!snap || !ix) return null;
  const open = sp.get('doc') ? ix.S.get(sp.get('doc')!) : null;
  const counts = Object.fromEntries(SOURCE_KINDS.map((k) => [k, snap.sources.filter((s) => s.kind === k && !s.archived_at).length]));
  return (
    <Page title="Documentos e Fontes" subtitle="Acervo digital com metadados, trecho, transcrição e referências. Referências externas são aceitas — nem todo documento está em arquivo local. Documento citado não é documento verificado.">
      <div className="mb-3 flex flex-wrap gap-2 text-xs">{SOURCE_KINDS.map((k) => <button key={k} className={`chip cursor-pointer ${kind === k ? '!border-blue !text-blue' : ''}`} onClick={() => setKind(kind === k ? '' : k)}><span className={KIND_TONE[k]}>●</span> {SOURCE_KIND_LABEL[k]} ({counts[k]})</button>)}</div>
      <div className="card mb-4 grid gap-2 p-3 md:grid-cols-6">
        <input className="input md:col-span-2" placeholder="Buscar título, instituição, trecho, referência…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="doc-filter" />
        <select className="input" value={dt} onChange={(e) => setDt(e.target.value)} aria-label="Tipo de documento"><option value="">Todos os tipos</option>{Object.entries(DOC_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="input" value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="Acesso"><option value="">Qualquer acesso</option>{Object.entries(ACCESS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="input" value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Lugar"><option value="">Qualquer lugar</option>{snap.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input" value={rel} onChange={(e) => setRel(e.target.value)} aria-label="Confiabilidade mínima"><option value="">Qualquer confiabilidade</option>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>≥ {n} ★</option>)}</select>
        <select className="input md:col-span-2" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Pessoa"><option value="">Qualquer pessoa</option>{snap.persons.filter((p) => !p.redacted).map((p) => <option key={p.id} value={p.id}>{p.preferred_name}</option>)}</select>
      </div>
      <p className="mb-2 text-xs text-ink2">{list.length} documento(s)</p>
      {list.length === 0 ? <Empty>Nenhum documento encontrado.</Empty> : <div className="grid gap-3 md:grid-cols-2">{list.map((s) => (
        <button key={s.id} onClick={() => setSp({ doc: s.id })} className="card p-3 text-left hover:border-blue" data-testid="doc-card">
          <div className="flex flex-wrap items-center gap-2 text-xs"><span className={`chip ${KIND_TONE[s.kind]}`}>{SOURCE_KIND_LABEL[s.kind]}</span><span className="chip">{DOC_TYPE_LABEL[s.doc_type] ?? s.doc_type}</span><Stars n={s.reliability} /></div>
          <div className="serif mt-1 text-sm">{s.title}</div><div className="text-xs text-ink2">{s.institution}{s.produced_date ? ` · ${s.produced_date}` : ''}</div>
          <div className="mt-1 text-[11px] text-ink2">{ACCESS_LABEL[s.access_status]}</div></button>))}</div>}
      {open && <DocModal id={open.id} onClose={() => setSp({})} />}
    </Page>
  );
}

function DocModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { snap, ix } = useAtlas(); if (!snap || !ix) return null;
  const s = ix.S.get(id)!;
  const uses = ix.evidBySource.get(id) ?? [];
  const subj = (t: string, sid: string): { label: string; to: string } | null => {
    if (t === 'person') { const p = ix.P.get(sid); return p ? { label: `Pessoa: ${p.preferred_name}`, to: `/pessoas/${sid}` } : null; }
    if (t === 'event') { const e = snap.events.find((x) => x.id === sid); return e ? { label: `Evento: ${e.title} (${evDate(e)})`, to: `/linha-do-tempo?evento=${sid}` } : null; }
    if (t === 'claim') { const c = ix.C.get(sid); return c ? { label: `Hipótese ${c.code ?? ''}: ${c.content.slice(0, 80)}`, to: `/investigacoes?claim=${sid}` } : null; }
    if (t === 'relationship') return { label: 'Relação', to: '/arvore' };
    return { label: t, to: '#' };
  };
  const external = [s.url, ...s.extra_urls].filter(Boolean) as string[];
  return (
    <Modal title={s.title} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><span className={`chip ${KIND_TONE[s.kind]}`}>{SOURCE_KIND_LABEL[s.kind]}</span><span className="chip">{DOC_TYPE_LABEL[s.doc_type] ?? s.doc_type}</span><span className="chip">{ACCESS_LABEL[s.access_status]}</span><Stars n={s.reliability} /></div>
        {s.access_status !== 'examinada_integral' && s.access_status !== 'examinada_extrato' && <p className="rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs">⚠ Esta fonte NÃO foi examinada diretamente — não a trate como evidência verificada.</p>}
        <div className="grid gap-3 md:grid-cols-3"><Kv k="Instituição / acervo">{s.institution}</Kv><Kv k="Referência arquivística">{s.archival_ref}</Kv><Kv k="Página / registro">{s.page_ref}</Kv><Kv k="Data de produção">{s.produced_date}</Kv><Kv k="Consultada em">{s.consulted_date}</Kv><Kv k="Arquivo local">{s.local_file ?? 'referência externa'}</Kv></div>
        {external.length > 0 && <div><div className="label">Referências externas</div><ul className="space-y-0.5 break-all text-xs">{external.map((u) => <li key={u}><a className="text-blue underline" href={u} target="_blank" rel="noreferrer noopener">{u}</a></li>)}</ul></div>}
        {s.reliability_note && <div className="rounded-lg bg-paper2 p-2 text-xs"><b>Avaliação de confiabilidade:</b> {s.reliability_note}</div>}
        {s.excerpt && <div><div className="label">Trecho relevante</div><blockquote className="border-l-2 border-gold pl-3 italic">{s.excerpt}</blockquote></div>}
        {s.transcription && <div><div className="label">Transcrição</div><pre className="whitespace-pre-wrap rounded-lg bg-paper2 p-2 text-xs">{s.transcription}</pre></div>}
        <div className="grid gap-3 md:grid-cols-2">
          <div><div className="label">Pessoas relacionadas</div>{s.personIds.length ? <ul>{s.personIds.map((p) => <li key={p}><Link className="text-blue underline" to={`/pessoas/${p}`}>{ix.P.get(p)?.preferred_name}</Link></li>)}</ul> : '—'}</div>
          <div><div className="label">Lugares</div>{s.placeIds.length ? <ul>{s.placeIds.map((p) => <li key={p}><Link className="text-blue underline" to={`/mapa?lugar=${p}`}>{ix.placePath(p)}</Link></li>)}</ul> : '—'}</div>
        </div>
        <div><div className="label">Afirmações, eventos e pessoas que citam esta fonte ({uses.length})</div>
          <ul className="space-y-1 text-xs">{uses.map((u) => { const t = subj(u.subject_type, u.subject_id); return t ? <li key={u.id}><Link className="text-blue underline" to={t.to}>{t.label}</Link> <span className="chip">{u.stance === 'contraria' ? '⚠ contrária' : u.stance === 'favoravel' ? '✔ favorável' : 'contexto'}</span>{u.note && <span className="text-ink2"> — {u.note}</span>}</li> : null; })}</ul></div>
        {s.notes && <p className="text-xs text-ink2">{s.notes}</p>}
      </div>
    </Modal>
  );
}
export type { Status };
