import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, useAtlas } from '../../lib/api';
import { Empty, Modal } from '../../components/ui';
import { searchScore } from '../../../shared/names';
import { DATE_PRECISIONS, PRECISION_LABEL, NEW_DEFAULTS, type EntityConf, type FieldDef, type LinkConf } from './conf';
import { STATUS_LABEL } from '../../../shared/types';

const errMsg = (e: unknown) => (e instanceof ApiError ? [e.message, ...e.details].filter((x, i, a) => a.indexOf(x) === i).join(' • ') : String(e));
const toForm = (conf: EntityConf, row: any) => {
  const f: Record<string, any> = { ...row };
  for (const fd of conf.fields) if (fd.type === 'kv') f[fd.name] = fd.hint === 'lines' ? (row[fd.name] ?? []).join('\n') : Object.entries(row[fd.name] ?? {}).map(([k, v]) => `${k}=${v}`).join('\n');
  return f;
};
const fromForm = (conf: EntityConf, f: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const fd of conf.fields) {
    const cols = fd.type === 'date' ? [`${fd.prefix}_from`, `${fd.prefix}_to`, `${fd.prefix}_precision`, `${fd.prefix}_text`] : [fd.name];
    for (const c of cols) {
      let v = f[c];
      if (fd.type === 'kv') v = fd.hint === 'lines' ? String(v ?? '').split('\n').map((x) => x.trim()).filter(Boolean) : Object.fromEntries(String(v ?? '').split('\n').map((l) => l.split('=')).filter((p) => p.length >= 2).map(([k, ...r]) => [k.trim(), r.join('=').trim()]));
      else if (fd.type === 'number') v = v === '' || v == null ? null : Number(v);
      else if (fd.type === 'checkbox') v = v ? 1 : 0;
      else if (v === '') v = null;
      out[c] = v ?? null;
    }
  }
  return out;
};

export function EntityManager({ conf, initialId }: { conf: EntityConf; initialId?: string | null }) {
  const { snap, refresh } = useAtlas();
  const [q, setQ] = useState(''); const [editId, setEditId] = useState<string | 'new' | null>(initialId ?? null);
  useEffect(() => { if (initialId) setEditId(initialId); }, [initialId]);
  const rows = useMemo(() => (snap ? conf.list(snap).filter((r: any) => !r.archived_at) : []), [snap, conf]);
  const shown = useMemo(() => (q ? rows.map((r: any) => ({ r, s: searchScore(q, `${conf.title(r)} ${conf.subtitle?.(r) ?? ''}`) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).map((x: any) => x.r) : rows), [rows, q, conf]);
  if (!snap) return null;
  const editing = editId && editId !== 'new' ? rows.find((r: any) => r.id === editId) : null;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2"><input className="input max-w-sm" placeholder={`Filtrar ${conf.plural.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn btn-primary" onClick={() => setEditId('new')} data-testid="new-entity">＋ Novo ({conf.label})</button><span className="self-center text-xs text-ink2">{shown.length} registro(s)</span></div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-card" data-testid="entity-list">
        {shown.map((r: any) => <li key={r.id}><button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-paper2" onClick={() => setEditId(r.id)}><span className="serif truncate text-sm">{conf.title(r)}</span><span className="shrink-0 text-xs text-ink2">{conf.subtitle?.(r)}</span></button></li>)}
        {!shown.length && <li><Empty>Nada encontrado.</Empty></li>}
      </ul>
      {editId && (editId === 'new' || editing) && <EditorModal key={editId} conf={conf} row={editing ?? null} onClose={() => setEditId(null)} onSaved={async (id) => { await refresh(); if (editId === 'new' && id) setEditId(id); }} />}
    </div>
  );
}

function FieldInput({ fd, f, set, snap }: { fd: FieldDef; f: Record<string, any>; set: (k: string, v: any) => void; snap: any }) {
  const cls = fd.full ? 'md:col-span-2' : '';
  const lab = <label className="label mb-0.5 block" htmlFor={`f_${fd.name}`}>{fd.label}</label>;
  if (fd.type === 'date') {
    const p = fd.prefix!;
    return <div className="md:col-span-2"><span className="label mb-0.5 block">{fd.label}</span><div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <input className="input" placeholder="início (AAAA, AAAA-MM, AAAA-MM-DD)" value={f[`${p}_from`] ?? ''} onChange={(e) => set(`${p}_from`, e.target.value)} aria-label={`${fd.label} início`} />
      <input className="input" placeholder="fim (opcional)" value={f[`${p}_to`] ?? ''} onChange={(e) => set(`${p}_to`, e.target.value)} aria-label={`${fd.label} fim`} />
      <select className="input" value={f[`${p}_precision`] ?? 'desconhecida'} onChange={(e) => set(`${p}_precision`, e.target.value)} aria-label={`${fd.label} precisão`}>{DATE_PRECISIONS.map((x) => <option key={x} value={x}>{PRECISION_LABEL[x]}</option>)}</select>
      <input className="input" placeholder="texto original" value={f[`${p}_text`] ?? ''} onChange={(e) => set(`${p}_text`, e.target.value)} aria-label={`${fd.label} texto`} /></div></div>;
  }
  if (fd.type === 'textarea' || fd.type === 'kv') return <div className={cls}>{lab}<textarea id={`f_${fd.name}`} className="input min-h-[4.5rem]" value={f[fd.name] ?? ''} onChange={(e) => set(fd.name, e.target.value)} /></div>;
  if (fd.type === 'checkbox') return <label className={`flex items-center gap-2 text-sm ${cls}`}><input type="checkbox" checked={!!f[fd.name]} onChange={(e) => set(fd.name, e.target.checked)} />{fd.label}</label>;
  if (fd.type === 'select') return <div className={cls}>{lab}<select id={`f_${fd.name}`} className="input" value={f[fd.name] ?? ''} onChange={(e) => set(fd.name, e.target.value)}>{fd.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
  if (fd.type === 'ref') {
    const opts: [string, string][] = fd.ref === 'person' ? snap.persons.filter((p: any) => !p.redacted).map((p: any) => [p.id, p.preferred_name]) : fd.ref === 'place' ? snap.places.map((p: any) => [p.id, p.name]) : fd.ref === 'nucleus' ? snap.nuclei.map((n: any) => [n.id, n.name]) : snap.sources.map((s: any) => [s.id, s.title]);
    return <div className={cls}>{lab}<select id={`f_${fd.name}`} className="input" value={f[fd.name] ?? ''} onChange={(e) => set(fd.name, e.target.value)}><option value="">—</option>{opts.map(([v, l]) => <option key={v} value={v}>{l.slice(0, 70)}</option>)}</select></div>;
  }
  return <div className={cls}>{lab}<input id={`f_${fd.name}`} className="input" type={fd.type === 'number' ? 'number' : 'text'} value={f[fd.name] ?? ''} onChange={(e) => set(fd.name, e.target.value)} /></div>;
}

function EditorModal({ conf, row, onClose, onSaved }: { conf: EntityConf; row: any | null; onClose: () => void; onSaved: (id?: string) => Promise<void> }) {
  const { snap, refresh } = useAtlas();
  const [f, setF] = useState<Record<string, any>>(() => (row ? toForm(conf, row) : { ...NEW_DEFAULTS[conf.type] }));
  const [err, setErr] = useState<string | null>(null); const [warn, setWarn] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [tab, setTab] = useState('dados');
  const set = (k: string, v: any) => setF((x) => ({ ...x, [k]: v }));
  if (!snap) return null;
  const save = async () => {
    setBusy(true); setErr(null); setWarn([]);
    try {
      const body = fromForm(conf, f);
      const r = row ? await api(`/admin/${conf.type}/${row.id}`, { method: 'PATCH', body }) : await api(`/admin/${conf.type}`, { method: 'POST', body });
      setWarn(r.warnings ?? []); await onSaved(r.row?.id); if (!(r.warnings?.length)) { if (!row) onClose(); }
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const archive = async () => { if (!confirm('Arquivar este registro? (reversível — não há exclusão irreversível)')) return; try { await api(`/admin/${conf.type}/${row.id}`, { method: 'DELETE' }); await refresh(); onClose(); } catch (e) { setErr(errMsg(e)); } };
  const tabs: [string, string][] = [['dados', 'Dados'], ...(row && (conf.links || conf.subs) ? [['vinculos', 'Vínculos'] as [string, string]] : []), ...(row && conf.evidence ? [['evidencias', 'Evidências'] as [string, string]] : []), ...(row ? [['historico', 'Histórico'] as [string, string]] : [])];
  return (
    <Modal title={row ? `Editar ${conf.label}` : `Nova ${conf.label}`} onClose={onClose} wide>
      <div className="mb-3 flex gap-1 border-b border-line">{tabs.map(([k, l]) => <button key={k} className={`-mb-px rounded-t-lg border border-b-0 px-3 py-1 text-sm ${tab === k ? 'border-line bg-card text-blue' : 'border-transparent text-ink2'}`} onClick={() => setTab(k)}>{l}</button>)}</div>
      {err && <p className="mb-2 rounded-lg border border-bad p-2 text-sm text-bad" role="alert" data-testid="form-error">{err}</p>}
      {warn.map((w) => <p key={w} className="mb-2 rounded-lg border border-warn p-2 text-sm text-warn">⚠ {w}</p>)}
      {tab === 'dados' && <><div className="grid gap-3 md:grid-cols-2">{conf.fields.map((fd) => <FieldInput key={fd.name} fd={fd} f={f} set={set} snap={snap} />)}</div>
        <div className="mt-4 flex flex-wrap gap-2"><button className="btn btn-primary" disabled={busy} onClick={save} data-testid="save-entity">{busy ? 'Salvando…' : 'Salvar'}</button><button className="btn" onClick={onClose}>Fechar</button>{row && <button className="btn btn-danger ml-auto" onClick={archive}>Arquivar</button>}</div></>}
      {tab === 'vinculos' && row && <div className="space-y-5">{(conf.links ?? []).map((l) => <LinksEditor key={l.table + (l.refType ?? '')} link={l} row={row} />)}{conf.subs?.includes('names') && <NamesEditor row={row} />}{conf.subs?.includes('occupations') && <OccupationsEditor row={row} />}</div>}
      {tab === 'evidencias' && row && <EvidenceEditor type={conf.type} row={row} />}
      {tab === 'historico' && row && <History type={conf.type} id={row.id} />}
    </Modal>
  );
}

function currentLinks(link: LinkConf, row: any): { id: string; extra?: any }[] {
  switch (link.table) {
    case 'person_nucleus': return row.nucleusIds.map((id: string) => ({ id }));
    case 'event_person': return row.persons.map((x: any) => ({ id: x.person_id, extra: { role: x.role } }));
    case 'source_person': return row.personIds.map((id: string) => ({ id })); case 'source_place': return row.placeIds.map((id: string) => ({ id }));
    case 'claim_entity': return row.entities.filter((e: any) => e.type === link.refType).map((e: any) => ({ id: e.id, extra: { role: e.role } }));
    case 'investigation_entity': return row.entities.filter((e: any) => e.type === link.refType).map((e: any) => ({ id: e.id }));
    case 'research_group_member': return row.memberIds.map((id: string) => ({ id }));
    default: return [];
  }
}
function LinksEditor({ link, row }: { link: LinkConf; row: any }) {
  const { snap, refresh } = useAtlas(); const [pick, setPick] = useState(''); const [role, setRole] = useState(''); const [err, setErr] = useState<string | null>(null);
  if (!snap) return null;
  const opts: [string, string][] = link.ref === 'person' ? snap.persons.filter((p: any) => !p.redacted).map((p: any) => [p.id, p.preferred_name]) : link.ref === 'place' ? snap.places.map((p: any) => [p.id, p.name]) : snap.nuclei.map((n: any) => [n.id, n.name]);
  const label = (id: string) => opts.find(([v]) => v === id)?.[1] ?? id;
  const keys = (id: string) => ({ [link.owner]: row.id, [link.key]: id, ...(link.refType ? { entity_type: link.refType } : {}) });
  return (
    <div><h3 className="label mb-1">{link.label}</h3>{err && <p className="text-sm text-bad">{err}</p>}
      <ul className="mb-2 flex flex-wrap gap-1.5">{currentLinks(link, row).map((c) => <li key={c.id} className="chip">{label(c.id)}{c.extra?.role ? ` (${c.extra.role})` : ''}<button aria-label="Remover" className="ml-1 text-bad" onClick={async () => { try { await api(`/admin/link/${link.table}`, { method: 'DELETE', body: keys(c.id) }); await refresh(); } catch (e) { setErr(errMsg(e)); } }}>✕</button></li>)}</ul>
      <div className="flex gap-2"><select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label={`Adicionar ${link.label}`}><option value="">Adicionar…</option>{opts.map(([v, l]) => <option key={v} value={v}>{l.slice(0, 60)}</option>)}</select>
        {link.extra && <input className="input max-w-[10rem]" placeholder="papel" value={role} onChange={(e) => setRole(e.target.value)} />}
        <button className="btn" disabled={!pick} onClick={async () => { try { await api(`/admin/link/${link.table}`, { method: 'POST', body: { ...keys(pick), ...(link.extra ? { role: role || null } : {}) } }); setPick(''); setRole(''); await refresh(); } catch (e) { setErr(errMsg(e)); } }}>Adicionar</button></div></div>
  );
}
function NamesEditor({ row }: { row: any }) {
  const { refresh } = useAtlas(); const [name, setName] = useState(''); const [kind, setKind] = useState('variante'); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  return (
    <div><h3 className="label mb-1">Variações do nome</h3>{err && <p className="text-sm text-bad">{err}</p>}
      <ul className="mb-2 space-y-1">{row.names.map((n: any) => <li key={n.id} className="flex items-center gap-2 text-sm"><span>{n.name}</span><span className="chip">{n.kind}</span><span className="text-xs text-ink2">{n.note}</span><button className="ml-auto text-bad" aria-label="Remover" onClick={async () => { await api(`/admin/person_name/${n.id}`, { method: 'DELETE' }); await refresh(); }}>✕</button></li>)}</ul>
      <div className="grid gap-2 md:grid-cols-[1fr_10rem_1fr_auto]"><input className="input" placeholder="Variante ortográfica" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{['variante', 'grafia_indexada', 'apelido', 'nome_de_registro', 'preferido'].map((k) => <option key={k}>{k}</option>)}</select><input className="input" placeholder="nota" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={async () => { try { await api('/admin/person_name', { method: 'POST', body: { person_id: row.id, name, kind, note: note || null } }); setName(''); setNote(''); await refresh(); } catch (e) { setErr(errMsg(e)); } }}>Adicionar</button></div></div>
  );
}
function OccupationsEditor({ row }: { row: any }) {
  const { refresh } = useAtlas(); const [title, setTitle] = useState(''); const [period, setPeriod] = useState(''); const [err, setErr] = useState<string | null>(null);
  return (
    <div><h3 className="label mb-1">Ocupações</h3>{err && <p className="text-sm text-bad">{err}</p>}
      <ul className="mb-2 space-y-1">{row.occupations.map((o: any) => <li key={o.id} className="flex items-center gap-2 text-sm"><span>{o.title}{o.period_text ? ` (${o.period_text})` : ''}</span><span className="chip">{STATUS_LABEL[o.status as keyof typeof STATUS_LABEL]}</span><button className="ml-auto text-bad" aria-label="Remover" onClick={async () => { await api(`/admin/person_occupation/${o.id}`, { method: 'DELETE' }); await refresh(); }}>✕</button></li>)}</ul>
      <div className="grid gap-2 md:grid-cols-[1fr_12rem_auto]"><input className="input" placeholder="Ocupação / cargo" value={title} onChange={(e) => setTitle(e.target.value)} /><input className="input" placeholder="período" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <button className="btn" disabled={!title.trim()} onClick={async () => { try { await api('/admin/person_occupation', { method: 'POST', body: { person_id: row.id, title, period_text: period || null } }); setTitle(''); setPeriod(''); await refresh(); } catch (e) { setErr(errMsg(e)); } }}>Adicionar</button></div></div>
  );
}
function EvidenceEditor({ type, row }: { type: string; row: any }) {
  const { snap, refresh } = useAtlas(); const [src, setSrc] = useState(''); const [stance, setStance] = useState('favoravel'); const [exc, setExc] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  if (!snap) return null;
  const items = snap.evidence.filter((e) => e.subject_type === type && e.subject_id === row.id);
  return (
    <div><p className="mb-2 text-xs text-ink2">Cada afirmação aponta para fontes. O estado de verificação continua sendo uma decisão sua — não é calculado pela quantidade de fontes.</p>{err && <p className="text-sm text-bad">{err}</p>}
      <ul className="mb-3 space-y-1.5">{items.map((e) => <li key={e.id} className="rounded border border-line p-2 text-sm"><span className="chip mr-1">{e.stance}</span>{snap.sources.find((s) => s.id === e.source_id)?.title}{e.excerpt && <div className="text-xs italic">“{e.excerpt}”</div>}{e.note && <div className="text-xs text-ink2">{e.note}</div>}
        <button className="float-right text-bad" aria-label="Remover evidência" onClick={async () => { await api(`/admin/evidence/${e.id}`, { method: 'DELETE' }); await refresh(); }}>✕</button></li>)}{!items.length && <Empty>Sem evidências vinculadas.</Empty>}</ul>
      <div className="grid gap-2 md:grid-cols-2"><select className="input md:col-span-2" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Fonte"><option value="">Fonte…</option>{snap.sources.map((s) => <option key={s.id} value={s.id}>{s.title.slice(0, 80)}</option>)}</select>
        <select className="input" value={stance} onChange={(e) => setStance(e.target.value)}><option value="favoravel">favorável</option><option value="contraria">contrária</option><option value="contexto">contexto</option></select><input className="input" placeholder="Trecho relevante" value={exc} onChange={(e) => setExc(e.target.value)} />
        <input className="input md:col-span-2" placeholder="Nota" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-primary md:col-span-2" disabled={!src} onClick={async () => { try { await api('/admin/evidence', { method: 'POST', body: { subject_type: type, subject_id: row.id, source_id: src, stance, excerpt: exc || null, note: note || null } }); setSrc(''); setExc(''); setNote(''); await refresh(); } catch (e) { setErr(errMsg(e)); } }}>Vincular evidência</button></div></div>
  );
}
export function History({ type, id }: { type?: string; id?: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { api<any[]>(`/admin/changelog?limit=200${type ? `&entity_type=${type}` : ''}${id ? `&entity_id=${id}` : ''}`).then(setRows).catch(() => setRows([])); }, [type, id]);
  if (!rows) return <p className="text-sm text-ink2">Carregando…</p>;
  if (!rows.length) return <Empty>Sem alterações registradas.</Empty>;
  return <ul className="space-y-1 text-xs">{rows.map((r) => <li key={r.id} className="rounded border border-line p-2"><span className="chip mr-1">{r.action}</span><b>{r.entity_type}</b> {r.entity_id} <span className="text-ink2">· {r.at.slice(0, 19).replace('T', ' ')} · {r.actor}</span>{r.note && <div className="text-ink2">{r.note}</div>}
    {r.before && r.after && <DiffView before={r.before} after={r.after} />}</li>)}</ul>;
}
function DiffView({ before, after }: { before: string; after: string }) {
  let b: any, a: any; try { b = JSON.parse(before); a = JSON.parse(after); } catch { return null; }
  const keys = Object.keys(a).filter((k) => !['updated_at'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  return keys.length ? <ul className="mt-1 pl-3">{keys.slice(0, 8).map((k) => <li key={k}><code>{k}</code>: <span className="text-bad line-through">{String(b[k] ?? '∅').slice(0, 60)}</span> → <span className="text-ok">{String(a[k] ?? '∅').slice(0, 60)}</span></li>)}</ul> : null;
}
