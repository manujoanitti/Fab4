import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAtlas } from '../lib/api';
import { Empty, Page, StatusBadge, Tabs } from '../components/ui';
import { PersonCard } from '../components/person';
import { searchScore } from '../../shared/names';
import { STATUSES, STATUS_LABEL } from '../../shared/types';

export function PeoplePage() {
  const { snap, ix } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('aba') ?? 'pessoas';
  const [q, setQ] = useState(''); const [nuc, setNuc] = useState(''); const [st, setSt] = useState(''); const [liv, setLiv] = useState('');
  const list = useMemo(() => {
    if (!snap || !ix) return [];
    return snap.persons.filter((p) => !p.archived_at && (!nuc || p.nucleusIds.includes(nuc)) && (!st || p.verification_status === st) &&
      (!liv || (liv === 'vivos' ? p.isPrivate : !p.isPrivate)))
      .map((p) => ({ p, s: q ? searchScore(q, `${p.preferred_name} ${p.names.map((n) => n.name).join(' ')} ${p.occupations.map((o) => o.title).join(' ')} ${ix.placePath(p.birth_place_id)}`) : 1 }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.p.preferred_name.localeCompare(b.p.preferred_name)).map((x) => x.p);
  }, [snap, ix, q, nuc, st, liv]);
  if (!snap || !ix) return null;
  return (
    <Page title="Pessoas" subtitle={`${snap.persons.length} registros. Homônimos permanecem separados até que um documento comprove a identidade.`}>
      <Tabs tabs={[['pessoas', 'Pessoas'], ['sobrenomes', 'Sobrenomes e variantes']]} value={tab} onChange={(v) => setSp({ aba: v })} />
      {tab === 'pessoas' ? (<>
        <div className="card mb-4 grid gap-3 p-3 md:grid-cols-4">
          <input className="input" placeholder="Filtrar por nome, variante, ofício…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="people-filter" />
          <select className="input" value={nuc} onChange={(e) => setNuc(e.target.value)} aria-label="Núcleo"><option value="">Todos os núcleos</option>{snap.nuclei.map((n: any) => <option key={n.id} value={n.id}>{n.name.slice(0, 50)}</option>)}</select>
          <select className="input" value={st} onChange={(e) => setSt(e.target.value)} aria-label="Confiabilidade"><option value="">Qualquer confiabilidade</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          <select className="input" value={liv} onChange={(e) => setLiv(e.target.value)} aria-label="Situação"><option value="">Vivos e falecidos</option><option value="vivos">Vivos / privados</option><option value="falecidos">Falecidos</option></select>
        </div>
        {list.length === 0 ? <Empty>Nenhuma pessoa encontrada.</Empty> : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{list.map((p) => <PersonCard key={p.id} p={p} />)}</div>}
      </>) : (
        <div className="space-y-3">
          <p className="max-w-3xl text-sm text-ink2">Formas do sobrenome encontradas no relatório. "Joanitti" não é sobrenome italiano estabelecido; a hipótese H1 propõe adaptação brasileira de Giovanitti/Giovannitti.</p>
          {snap.surnames.map((v: any) => (
            <div key={v.id} className="card p-4"><div className="flex flex-wrap items-center gap-2"><span className="serif text-xl text-blue">{v.form}</span><StatusBadge status={v.status} /></div>
              <dl className="mt-2 grid gap-2 text-sm md:grid-cols-3"><div><dt className="label">Onde foi atestada</dt><dd>{v.attested_places}</dd></div><div><dt className="label">Cronologia</dt><dd>{v.period_text}</dd></div><div><dt className="label">Natureza linguística</dt><dd>{v.linguistic_note}</dd></div></dl></div>))}
        </div>
      )}
    </Page>
  );
}
