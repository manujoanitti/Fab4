import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAtlas } from '../lib/api';
import { searchAll } from '../lib/search';
import { Empty, Page } from '../components/ui';
import { STATUSES, STATUS_LABEL, type Status } from '../../shared/types';

const TYPES = ['pessoa', 'evento', 'lugar', 'fonte', 'investigacao', 'afirmacao', 'sobrenome'];
export function SearchPage() {
  const { snap, ix } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const [nucleus, setNucleus] = useState(''); const [status, setStatus] = useState<Status | ''>(''); const [place, setPlace] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [types, setTypes] = useState<string[]>([]);
  const q = sp.get('q') ?? '';
  const hits = useMemo(() => (snap && ix ? searchAll(snap, ix, q, { nucleus, status, place, from: from ? +from : null, to: to ? +to : null, types }) : []), [snap, ix, q, nucleus, status, place, from, to, types]);
  if (!snap || !ix) return null;
  return (
    <Page title="Busca" subtitle="Tolerante a variações ortográficas ítalo-brasileiras: Giovannitti ≈ Giovanitti ≈ Joanitti ≈ Joanite.">
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-6">
        <input className="input md:col-span-2" value={q} onChange={(e) => setSp({ q: e.target.value })} placeholder="Nome, variante, lugar, profissão, ano…" autoFocus data-testid="search-input" />
        <select className="input" value={nucleus} onChange={(e) => setNucleus(e.target.value)} aria-label="Núcleo"><option value="">Todos os núcleos</option>{snap.nuclei.map((n: any) => <option key={n.id} value={n.id}>{n.name.slice(0, 40)}</option>)}</select>
        <select className="input" value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Localização"><option value="">Qualquer lugar</option>{snap.places.filter((p) => p.level !== 'pais' || true).map((p) => <option key={p.id} value={p.id}>{ix.placePath(p.id).slice(0, 48)}</option>)}</select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Confiabilidade"><option value="">Qualquer confiabilidade</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <div className="flex gap-2"><input className="input" inputMode="numeric" placeholder="de (ano)" value={from} onChange={(e) => setFrom(e.target.value)} /><input className="input" inputMode="numeric" placeholder="até" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1 md:col-span-6">{TYPES.map((t) => <button key={t} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])} className={`chip cursor-pointer ${types.includes(t) ? '!border-blue !text-blue' : ''}`}>{t}</button>)}</div>
      </div>
      {hits.length === 0 ? <Empty>Nenhum resultado.</Empty> : <ul className="space-y-2">{hits.slice(0, 80).map((h) => <li key={h.type + h.id}><Link to={h.to} className="card block p-3 hover:border-blue"><div className="flex items-center gap-2"><span className="chip">{h.type}</span><span className="serif">{h.title}</span></div><div className="mt-0.5 text-xs text-ink2">{h.subtitle}</div></Link></li>)}</ul>}
    </Page>
  );
}
