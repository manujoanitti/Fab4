import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAtlas } from '../lib/api';
import { Empty, Modal, Page, StatusBadge } from '../components/ui';
import { evDate, evKey, type Ev } from '../lib/model';
import { yearRange } from '../../shared/dates';
import { ACCESS_LABEL, EVENT_LABEL, EVENT_TYPES, STATUSES, STATUS_LABEL, type Status } from '../../shared/types';

const century = (y: number) => `Século ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'][Math.floor((y - 1) / 100)]}`;

type Row = { y: number; ev?: Ev; c?: any };
export function TimelinePage() {
  const { snap, ix } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [country, setCountry] = useState(''); const [types, setTypes] = useState<string[]>([]); const [sts, setSts] = useState<Status[]>([]);
  const [ctx, setCtx] = useState(true);
  const nucleus = sp.get('nucleo') ?? '', person = sp.get('pessoa') ?? '', placeF = sp.get('lugar') ?? '';
  const openId = sp.get('evento');
  const setParam = (k: string, v: string) => setSp((q) => { const n = new URLSearchParams(q); v ? n.set(k, v) : n.delete(k); return n; });

  const countryOf = (e: Ev) => ix?.placePath(e.place_id).split(', ').pop() ?? '';
  const inPlace = (e: Ev) => { if (!placeF) return true; let cur = e.place_id ? ix?.PL.get(e.place_id) : undefined; let n = 0; while (cur && n++ < 6) { if (cur.id === placeF) return true; cur = cur.parent_id ? ix?.PL.get(cur.parent_id) : undefined; } return false; };
  const events = useMemo(() => {
    if (!snap || !ix) return [];
    return snap.events.filter((e) => !e.archived_at && e.status !== 'descartado' && (!types.length || types.includes(e.type)) && (!sts.length || sts.includes(e.status)) && (!country || countryOf(e) === country)
      && (!person || e.persons.some((x) => x.person_id === person)) && (!nucleus || e.persons.some((x) => ix.P.get(x.person_id)?.nucleusIds.includes(nucleus))) && inPlace(e)
      && (() => { if (!from && !to) return true; const r = yearRange({ from: e.date_from, to: e.date_to, precision: e.date_precision as any }); return !!r && (!to || r[0] <= +to) && (!from || r[1] >= +from); })())
      .sort((a, b) => evKey(a) - evKey(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, ix, types, sts, country, person, nucleus, placeF, from, to]);

  const dated = events.filter((e) => Number.isFinite(evKey(e))), undated = events.filter((e) => !Number.isFinite(evKey(e)));
  const countries = useMemo(() => [...new Set(snap?.events.map((e) => ix?.placePath(e.place_id).split(', ').pop()).filter(Boolean) as string[])], [snap, ix]);
  const minY = 1700, maxY = 2030;
  const dec = useMemo(() => { const m = new Map<number, number>(); dated.forEach((e) => { const y = Math.floor(evKey(e) / 10000); const d = Math.floor(y / 10) * 10; m.set(d, (m.get(d) ?? 0) + 1); }); return m; }, [dated]);
  const maxC = Math.max(1, ...dec.values());
  if (!snap || !ix) return null;
  const contexts = ctx ? snap.contexts.filter((c: any) => (!from || (c.year_to ?? c.year_from) >= +from) && (!to || c.year_from <= +to) && (!country || !c.country || c.country === country)) : [];
  const rows: Row[] = [...dated.map((e) => ({ y: Math.floor(evKey(e) / 10000), ev: e })), ...contexts.map((c: any) => ({ y: c.year_from, c }))].sort((a, b) => a.y - b.y || ((a as Row).c ? -1 : 1));
  const open = openId ? snap.events.find((e) => e.id === openId) : null;
  const X = (y: number) => ((y - minY) / (maxY - minY)) * 100;

  return (
    <Page title="Linha do Tempo" subtitle="Eventos de toda a família, com data exata, aproximada, em intervalo ou sem data. O contexto histórico aparece em destaque tracejado.">
      <div className="card mb-3 grid gap-2 p-3 md:grid-cols-6">
        <input className="input" inputMode="numeric" placeholder="de (ano)" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Ano inicial" /><input className="input" inputMode="numeric" placeholder="até (ano)" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Ano final" />
        <select className="input" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="País"><option value="">Todos os países</option>{countries.map((c) => <option key={c}>{c}</option>)}</select>
        <select className="input" value={nucleus} onChange={(e) => setParam('nucleo', e.target.value)} aria-label="Núcleo"><option value="">Todos os núcleos</option>{snap.nuclei.map((n: any) => <option key={n.id} value={n.id}>{n.name.slice(0, 40)}</option>)}</select>
        <select className="input" value={person} onChange={(e) => setParam('pessoa', e.target.value)} aria-label="Pessoa"><option value="">Todas as pessoas</option>{snap.persons.filter((p) => !p.redacted && !p.archived_at).map((p) => <option key={p.id} value={p.id}>{p.preferred_name}</option>)}</select>
        <select className="input" value={placeF} onChange={(e) => setParam('lugar', e.target.value)} aria-label="Lugar"><option value="">Todos os lugares</option>{snap.places.map((p) => <option key={p.id} value={p.id}>{ix.placePath(p.id).slice(0, 44)}</option>)}</select>
        <div className="flex flex-wrap gap-1 md:col-span-6">{EVENT_TYPES.map((t) => <button key={t} className={`chip cursor-pointer ${types.includes(t) ? '!border-blue !text-blue' : ''}`} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])}>{EVENT_LABEL[t]}</button>)}</div>
        <div className="flex flex-wrap items-center gap-1 md:col-span-6">{STATUSES.filter((s) => s !== 'descartado').map((s) => <button key={s} className={`chip cursor-pointer ${sts.includes(s) ? '!border-blue !text-blue' : ''}`} onClick={() => setSts(sts.includes(s) ? sts.filter((x) => x !== s) : [...sts, s])}>{STATUS_LABEL[s]}</button>)}
          <label className="ml-auto flex items-center gap-1 text-xs"><input type="checkbox" checked={ctx} onChange={(e) => setCtx(e.target.checked)} />contexto histórico</label></div>
      </div>

      <div className="card mb-4 p-3" aria-label="Visão geral por década">
        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-20 w-full" role="img" aria-label="Eventos por década">
          {[...dec].map(([d, n]) => <rect key={d} x={X(d)} y={16 - (n / maxC) * 14} width={(10 / (maxY - minY)) * 100 - 0.15} height={(n / maxC) * 14} fill="var(--blue)" opacity=".75" onClick={() => { setFrom(String(d)); setTo(String(d + 9)); }} style={{ cursor: 'pointer' }}><title>{d}s: {n} evento(s)</title></rect>)}
          {snap.contexts.map((c: any, i: number) => <rect key={c.id} x={Math.max(0, X(c.year_from))} y={17 + (i % 3) * 2.2} width={Math.max(0.6, X(Math.min(c.year_to ?? c.year_from + 2, maxY)) - Math.max(0, X(c.year_from)))} height="1.6" fill={c.origin === 'relatorio' ? 'var(--sepia)' : 'var(--ink-2)'} opacity=".7"><title>{c.title} ({c.year_from}{c.year_to ? `–${c.year_to}` : ''})</title></rect>)}
        </svg>
        <div className="flex justify-between text-[10px] text-ink2"><span>{minY}</span><span>1800</span><span>1900</span><span>{maxY}</span></div>
        <div className="text-[11px] text-ink2">Barras azuis: eventos por década (clique para filtrar). Faixas inferiores: contexto histórico (sépia = relatório; cinza = contexto geral do operador).</div>
      </div>

      {rows.length === 0 && undated.length === 0 ? <Empty>Nenhum evento com estes filtros.</Empty> : (
        <ol className="relative space-y-2 border-l-2 border-line pl-5" data-testid="timeline-list">
          {rows.map((r, i) => {
            const prev = rows[i - 1]; const head = !prev || century(prev.y) !== century(r.y);
            return (
              <li key={(r.ev?.id ?? r.c?.id) + i}>
                {head && <h2 className="serif -ml-5 mb-1 mt-3 border-b border-line pb-1 text-lg text-sepia">{century(r.y)}</h2>}
                <span className={`absolute -left-[7px] mt-3 h-3 w-3 rounded-full border-2 border-card ${r.c ? 'bg-ink2' : 'bg-blue'}`} />
                {r.c ? (
                  <div className="rounded-xl border border-dashed border-line bg-paper2 p-2.5 text-sm"><div className="text-xs text-ink2">{r.c.year_from}{r.c.year_to ? `–${r.c.year_to}` : ''} · contexto histórico {r.c.origin === 'contexto_geral' ? '(geral, do operador)' : '(do relatório)'}</div><div className="serif">{r.c.title}</div>{r.c.description && <p className="text-xs text-ink2">{r.c.description}</p>}</div>
                ) : (
                  <button onClick={() => setParam('evento', r.ev!.id)} className="card block w-full p-3 text-left hover:border-blue" data-testid="timeline-event">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink2"><b className="text-ink">{evDate(r.ev!)}</b><span className="chip">{EVENT_LABEL[r.ev!.type as keyof typeof EVENT_LABEL]}</span><StatusBadge status={r.ev!.status} small />{r.ev!.place_id && <span>📍 {ix.PL.get(r.ev!.place_id)?.name}</span>}{r.ev!.is_route_speculative && <span className="chip">trajeto hipotético</span>}</div>
                    <div className="serif mt-1">{r.ev!.title}</div>
                    <div className="mt-1 text-xs text-ink2">{r.ev!.persons.map((x) => ix.P.get(x.person_id)?.preferred_name).filter(Boolean).join(' · ')}</div>
                  </button>)}
              </li>);
          })}
        </ol>)}
      {undated.length > 0 && <section className="mt-6"><h2 className="serif mb-2 text-lg text-sepia">Sem data conhecida ({undated.length})</h2><div className="grid gap-2 md:grid-cols-2">{undated.map((e) => <button key={e.id} onClick={() => setParam('evento', e.id)} className="card p-3 text-left hover:border-blue"><div className="flex items-center gap-2 text-xs"><span className="chip">{EVENT_LABEL[e.type as keyof typeof EVENT_LABEL]}</span><StatusBadge status={e.status} small /></div><div className="serif mt-1 text-sm">{e.title}</div><div className="text-xs text-ink2">{e.date_text ?? 'data desconhecida'}{e.place_id ? ` · ${ix.PL.get(e.place_id)?.name}` : ''}</div></button>)}</div></section>}
      {open && <EventModal ev={open} onClose={() => setParam('evento', '')} />}
    </Page>
  );
}

function EventModal({ ev, onClose }: { ev: Ev; onClose: () => void }) {
  const { snap, ix } = useAtlas(); if (!snap || !ix) return null;
  const evid = ix.evidBySubject.get(`event:${ev.id}`) ?? [];
  const place = ev.place_id ? ix.PL.get(ev.place_id) : null, dest = ev.route_to_place_id ? ix.PL.get(ev.route_to_place_id) : null;
  return (
    <Modal title={ev.title} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b>{evDate(ev)}</b><span className="chip">{EVENT_LABEL[ev.type as keyof typeof EVENT_LABEL]}</span><StatusBadge status={ev.status} />{ev.is_route_speculative && <span className="chip">⚠ trajeto hipotético, não comprovado</span>}</div>
        {ev.description && <p>{ev.description}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <div><div className="label">Pessoas</div>{ev.persons.length ? <ul>{ev.persons.map((x) => <li key={x.person_id}><Link className="text-blue underline" to={`/pessoas/${x.person_id}`}>{ix.P.get(x.person_id)?.preferred_name}</Link> <span className="text-xs text-ink2">{x.role}</span></li>)}</ul> : '—'}</div>
          <div><div className="label">Lugar</div>{place ? <Link className="text-blue underline" to={`/mapa?lugar=${place.id}`}>{ix.placePath(place.id)}</Link> : '—'}{dest && <> → <Link className="text-blue underline" to={`/mapa?lugar=${dest.id}`}>{dest.name}</Link></>}{ev.place_note && <div className="text-xs text-ink2">{ev.place_note}</div>}</div>
        </div>
        {(ev.status_rationale || ev.reported_status) && <div className="rounded-lg bg-paper2 p-2 text-xs"><b>Estado no relatório:</b> {ev.reported_status ?? '—'}<br /><b>Justificativa do estado atual:</b> {ev.status_rationale ?? '—'}</div>}
        <div><div className="label">Fontes</div>{evid.length ? <ul className="space-y-1">{evid.map((v) => { const s = ix.S.get(v.source_id); return s ? <li key={v.id}><Link className="text-blue underline" to={`/documentos?doc=${s.id}`}>{s.title}</Link> <span className="chip">{ACCESS_LABEL[s.access_status]}</span> <span className="text-xs">{v.stance === 'contraria' ? '⚠ contrária' : v.stance === 'favoravel' ? '✔ favorável' : 'contexto'}</span></li> : null; })}</ul> : <span className="text-xs text-ink2">nenhuma fonte vinculada</span>}</div>
        {ev.notes && <p className="text-xs text-ink2">{ev.notes}</p>}
      </div>
    </Modal>
  );
}
