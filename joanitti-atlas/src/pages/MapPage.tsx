import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { useAtlas } from '../lib/api';
import { Page, StatusBadge, Empty } from '../components/ui';
import { evDate, evKey, type Ev, type Place } from '../lib/model';
import { COORD_PRECISION_LABEL, EVENT_LABEL, PLACE_LEVEL_LABEL } from '../../shared/types';
import { yearRange } from '../../shared/dates';

const HIGHLIGHT = ['it_oratino', 'it_baranello', 'it_ripabottoni', 'br_duartina', 'br_bauru'];

export function MapPage() {
  const { snap, ix } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const sel = sp.get('lugar');
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [routes, setRoutes] = useState(true);

  const geo = useMemo(() => (snap ? snap.places.filter((p) => !p.archived_at && p.lat != null && p.lon != null) : []), [snap]);
  const noGeo = useMemo(() => (snap ? snap.places.filter((p) => !p.archived_at && (p.lat == null || p.lon == null)) : []), [snap]);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: true }).setView([-2, -20], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(m);
    layer.current = L.layerGroup().addTo(m); mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const m = mapRef.current, lg = layer.current; if (!m || !lg || !snap || !ix) return;
    lg.clearLayers();
    for (const p of geo) {
      const country = ix.placePath(p.id).split(', ').pop();
      const color = country === 'Brasil' ? 'var(--blue)' : 'var(--sepia)';
      const hi = HIGHLIGHT.includes(p.id);
      const icon = L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 26], html: `<div class="pin" style="background:${color};${hi ? 'outline:3px solid var(--gold);' : ''}${p.id === sel ? 'width:30px;height:30px;' : ''}"></div>` });
      const mk = L.marker([p.lat!, p.lon!], { icon, title: p.name, alt: p.name, keyboard: true }).addTo(lg);
      mk.bindTooltip(p.name, { direction: 'top', offset: [0, -22] });
      mk.on('click', () => setSp({ lugar: p.id }));
    }
    if (routes) for (const e of snap.events) {
      const a = e.place_id ? ix.PL.get(e.place_id) : undefined, b = e.route_to_place_id ? ix.PL.get(e.route_to_place_id) : undefined;
      if (!a || !b || a.lat == null || b.lat == null) continue;
      const line = L.polyline([[a.lat, a.lon!], [b.lat, b.lon!]], { color: e.is_route_speculative ? '#9a6a12' : '#1e3a5f', weight: 3, dashArray: e.is_route_speculative ? '4 8' : undefined, opacity: 0.85 }).addTo(lg);
      line.bindTooltip(`${e.is_route_speculative ? 'HIPÓTESE — não comprovado: ' : ''}${e.title}`, { sticky: true });
    }
  }, [snap, ix, geo, routes, sel, setSp]);

  useEffect(() => { // primeiro enquadramento / foco no lugar selecionado
    const m = mapRef.current; if (!m || !geo.length) return;
    const p = sel ? geo.find((g) => g.id === sel) : null;
    if (p) m.flyTo([p.lat!, p.lon!], Math.max(m.getZoom(), 9), { duration: 0.6 });
  }, [sel, geo]);
  useEffect(() => { fit('tudo'); /* eslint-disable-next-line */ }, [geo.length]);
  const fit = (w: 'it' | 'br' | 'tudo') => {
    const m = mapRef.current; if (!m || !ix) return;
    const pts = geo.filter((p) => w === 'tudo' || (ix.placePath(p.id).split(', ').pop() === (w === 'it' ? 'Itália' : 'Brasil')));
    if (pts.length) m.fitBounds(L.latLngBounds(pts.map((p) => [p.lat!, p.lon!] as [number, number])), { padding: [40, 40], maxZoom: 9 });
  };

  if (!snap || !ix) return null;
  const place = sel ? ix.PL.get(sel) : null;
  return (
    <Page title="Mapa Histórico" wide subtitle="Localidades italianas e brasileiras do relatório. Trajetos hipotéticos aparecem tracejados e nunca como viagens comprovadas. Coordenadas ainda não verificadas.">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm no-print">
        <button className="btn" onClick={() => fit('it')}>🇮🇹 Itália</button><button className="btn" onClick={() => fit('br')}>🇧🇷 Brasil</button><button className="btn" onClick={() => fit('tudo')}>Tudo</button>
        <label className="flex items-center gap-1"><input type="checkbox" checked={routes} onChange={(e) => setRoutes(e.target.checked)} />rotas hipotéticas</label>
        <span className="ml-auto text-xs text-ink2">Base: OpenStreetMap (requer internet) · ◉ contorno dourado = destaque inicial (Oratino, Baranello, Ripabottoni, Duartina, Bauru)</span>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        <div ref={el} className="card h-[62vh] min-h-[380px] flex-1" data-testid="map" role="application" aria-label="Mapa interativo" />
        <aside className="card max-h-[62vh] w-full shrink-0 overflow-auto p-4 lg:w-[24rem]" data-testid="place-panel">{place ? <PlacePanel place={place} /> : (
          <div className="text-sm text-ink2"><h2 className="serif mb-2 text-lg text-blue">Localidades</h2><p className="mb-2">Clique em um marcador ou escolha abaixo.</p>
            <ul className="space-y-1">{geo.map((p) => <li key={p.id}><button className="w-full rounded px-2 py-1 text-left hover:bg-paper2" onClick={() => setSp({ lugar: p.id })}>{HIGHLIGHT.includes(p.id) ? '◉ ' : ''}{p.name} <span className="text-xs">· {ix.placePath(p.parent_id).split(', ')[0]}</span></button></li>)}</ul>
            {noGeo.length > 0 && <><h3 className="label mt-4">Sem coordenadas</h3><ul className="mt-1 space-y-1">{noGeo.map((p) => <li key={p.id}><button className="w-full rounded px-2 py-1 text-left hover:bg-paper2" onClick={() => setSp({ lugar: p.id })}>{p.name} <span className="text-xs">({PLACE_LEVEL_LABEL[p.level]})</span></button></li>)}</ul></>}</div>)}</aside>
      </div>
    </Page>
  );
}

function PlacePanel({ place }: { place: Place }) {
  const { snap, ix } = useAtlas(); if (!snap || !ix) return null;
  const sub = (id: string): boolean => { let cur = ix.PL.get(id); let n = 0; while (cur && n++ < 6) { if (cur.id === place.id) return true; cur = cur.parent_id ? ix.PL.get(cur.parent_id) : undefined; } return false; };
  const events = snap.events.filter((e) => !e.archived_at && ((e.place_id && sub(e.place_id)) || e.route_to_place_id === place.id)).sort((a, b) => evKey(a) - evKey(b));
  const persons = new Map<string, { years: number[]; roles: Set<string> }>();
  const touch = (pid: string, y: number | null, role: string) => { const x = persons.get(pid) ?? persons.set(pid, { years: [], roles: new Set() }).get(pid)!; if (y) x.years.push(y); x.roles.add(role); };
  for (const e of events) for (const x of e.persons) { const r = yearRange({ from: e.date_from, to: e.date_to, precision: e.date_precision as any }); touch(x.person_id, r ? r[0] : null, e.type); if (r) touch(x.person_id, r[1], e.type); }
  for (const p of snap.persons) { if (p.birth_place_id && sub(p.birth_place_id)) touch(p.id, null, 'nascimento'); if (p.death_place_id && sub(p.death_place_id)) touch(p.id, null, 'falecimento'); }
  const srcs = snap.sources.filter((s) => !s.archived_at && (s.placeIds.some(sub) || events.some((e) => (ix.evidBySubject.get(`event:${e.id}`) ?? []).some((v) => v.source_id === s.id))));
  const claims = (ix.claimsByEntity.get(`place:${place.id}`) ?? []);
  const children = snap.places.filter((p) => p.parent_id === place.id && !p.archived_at);
  const allYears = [...persons.values()].flatMap((x) => x.years);
  return (
    <div className="space-y-3 text-sm">
      <div><h2 className="serif text-xl text-blue">{place.name}</h2><div className="text-xs text-ink2">{PLACE_LEVEL_LABEL[place.level]} · {ix.placePath(place.parent_id)}</div>
        {place.historic_names.length > 0 && <div className="text-xs">Nomes históricos: {place.historic_names.join('; ')}</div>}</div>
      {place.description && <p>{place.description}</p>}
      <div className="rounded-lg bg-paper2 p-2 text-xs text-ink2">{place.lat != null ? <>Coordenadas: {place.lat.toFixed(4)}, {place.lon!.toFixed(4)} · precisão: {COORD_PRECISION_LABEL[place.coord_precision]} · <b>{place.coord_verified ? 'verificadas' : 'NÃO verificadas'}</b>{place.coord_note ? <div className="mt-1">{place.coord_note}</div> : null}</> : 'Sem coordenadas.'}</div>
      {allYears.length > 0 && <div><div className="label">Período de presença registrada</div>{Math.min(...allYears)}–{Math.max(...allYears)} <span className="text-xs text-ink2">(a partir dos eventos; não implica residência contínua)</span></div>}
      <div><div className="label">Pessoas associadas</div>{persons.size ? <ul className="space-y-0.5">{[...persons].map(([pid, x]) => <li key={pid}><Link className="text-blue underline" to={`/pessoas/${pid}`}>{ix.P.get(pid)?.preferred_name}</Link> <span className="text-xs text-ink2">{[...x.roles].map((r) => EVENT_LABEL[r as keyof typeof EVENT_LABEL] ?? r).join(', ')}</span></li>)}</ul> : <span className="text-xs text-ink2">nenhuma</span>}</div>
      <div><div className="label">Eventos</div>{events.length ? <ul className="space-y-1">{events.map((e: Ev) => <li key={e.id} className="text-xs"><b>{evDate(e)}</b> — <Link className="text-blue underline" to={`/linha-do-tempo?evento=${e.id}`}>{e.title}</Link> <StatusBadge status={e.status} small />{e.is_route_speculative && <span className="chip ml-1">trajeto hipotético</span>}</li>)}</ul> : <span className="text-xs text-ink2">nenhum</span>}</div>
      <div><div className="label">Documentos relacionados</div>{srcs.length ? <ul className="space-y-0.5 text-xs">{srcs.slice(0, 10).map((s) => <li key={s.id}><Link className="text-blue underline" to={`/documentos?doc=${s.id}`}>{s.title}</Link></li>)}</ul> : <span className="text-xs text-ink2">nenhum</span>}</div>
      <div><div className="label">Hipóteses em investigação</div>{claims.length ? <ul className="space-y-1">{claims.map((c) => <li key={c.id} className="text-xs"><span className="chip">{c.code}</span> <StatusBadge status={c.status} small /> {c.content}</li>)}</ul> : <span className="text-xs text-ink2">nenhuma</span>}</div>
      {children.length > 0 && <div><div className="label">Contém</div><div className="flex flex-wrap gap-1">{children.map((c) => <Link key={c.id} to={`/mapa?lugar=${c.id}`} className="chip hover:border-blue">{c.name}</Link>)}</div></div>}
      <Link to="/mapa" className="btn">← todas as localidades</Link>
    </div>
  );
}
export { Empty };
