import { Link } from 'react-router-dom';
import { useAtlas } from '../lib/api';
import { Page, Section, StatusBadge, StatusIcon } from '../components/ui';
import { PersonCard } from '../components/person';
import { STATUS_HINT, STATUS_LABEL, STATUSES } from '../../shared/types';

export function Overview() {
  const { snap, ix, admin } = useAtlas();
  if (!snap || !ix) return null;
  const s = snap.stats;
  const tiles: [string, number, string, string][] = [
    ['Pessoas identificadas', s.persons, '/pessoas', 'pessoas'], ['Núcleos familiares', s.nuclei, '/arvore', 'nucleos'], ['Localidades', s.places, '/mapa', 'lugares'], ['Documentos e fontes', s.sources, '/documentos', 'fontes'],
    ['Hipóteses em aberto', s.openHypotheses, '/investigacoes', 'hipoteses'], ['Investigações ativas', s.openInvestigations, '/investigacoes', 'investigacoes'],
  ];
  const key = snap.persons.filter((p) => !p.isPrivate && !p.archived_at && ['documentado', 'fortemente_corroborado'].includes(p.verification_status) && p.living_status !== 'vivo').slice(0, 6);
  const claims = snap.claims.filter((c) => !c.archived_at && c.kind !== 'fato' && c.status !== 'descartado' && !c.redacted).sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, 6);
  const open = snap.investigations.filter((v) => ['aberta', 'em_andamento'].includes(v.status) && !v.redacted).sort((a, b) => a.priority - b.priority).slice(0, 5);
  const variants = snap.surnames;
  const counts = (id: string) => snap.persons.filter((p) => p.nucleusIds.includes(id) && !p.archived_at).length;

  return (
    <Page title="Joanitti — Atlas Genealógico" subtitle="Uma investigação histórica e genealógica baseada em evidências. Aqui estão os personagens identificados, de onde vieram, como se relacionam — e o que ainda precisa de confirmação.">
      <section className="card atlas-bg mb-5 p-5">
        <h2 className="serif mb-2 text-xl text-blue">Como ler este atlas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-ink2">Cada afirmação carrega um <b>estado de verificação</b>, editável e independente do número de fontes:</p>
            <ul className="space-y-1">{STATUSES.map((st) => <li key={st} className="flex items-start gap-2 text-sm"><StatusBadge status={st} small /><span className="text-xs text-ink2">{STATUS_HINT[st]}</span></li>)}</ul>
          </div>
          <div>
            <p className="mb-2 text-sm text-ink2">Na árvore, o tipo de linha mostra a confiança da relação (não só a cor):</p>
            <svg width="340" height="96" role="img" aria-label="Legenda das linhas"><g stroke="currentColor" strokeWidth="2" className="text-blue">
              <line x1="0" y1="14" x2="70" y2="14" /><line x1="0" y1="44" x2="70" y2="44" strokeDasharray="8 5" /><line x1="0" y1="74" x2="70" y2="74" strokeDasharray="2 5" strokeLinecap="round" /></g>
              <g className="fill-ink text-[12px]"><text x="82" y="18">contínua — relação documentada</text><text x="82" y="48">tracejada — hipotética</text><text x="82" y="78">pontilhada — não confirmada</text></g></svg>
            <p className="text-xs text-ink2">Relações descartadas não aparecem como parentesco; ficam no histórico da investigação.</p>
          </div>
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([l, n, to, id]) => <Link key={l} to={to} className="card p-4 transition hover:border-blue" data-testid={`tile-${id}`}><div className="serif text-3xl text-blue">{n}</div><div className="text-xs text-ink2">{l}</div></Link>)}
      </div>
      {admin && s.pendingReview > 0 && <Link to="/admin?aba=revisao" className="mb-4 block rounded-lg border border-warn/50 bg-warn/10 p-3 text-sm">⚠ {s.pendingReview} item(ns) de revisão pendentes (ambiguidades, contradições e lacunas da importação) →</Link>}

      <Section title="Núcleos familiares e linhas de investigação" right={<Link to="/arvore" className="text-sm text-blue underline">abrir a árvore →</Link>}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {snap.nuclei.map((n: any) => (
            <Link key={n.id} to={`/arvore?nucleo=${n.id}`} className="rounded-xl border border-line p-3 transition hover:border-blue" style={{ borderLeft: `5px solid ${n.color ?? '#999'}` }}>
              <div className="serif text-base">{n.name}</div><p className="mt-1 line-clamp-3 text-xs text-ink2">{n.description}</p><div className="mt-2 text-xs"><span className="chip">{counts(n.id)} pessoas</span> <span className="chip">{n.kind}</span></div>
            </Link>))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Perguntas abertas" right={<Link to="/investigacoes" className="text-sm text-blue underline">todas →</Link>}>
          <ul className="space-y-2">{open.map((v) => <li key={v.id}><Link to={`/investigacoes?inv=${v.id}`} className="block rounded-lg p-2 hover:bg-paper2"><div className="serif text-sm text-blue">{v.title}</div><div className="text-xs text-ink2">{v.question}</div></Link></li>)}</ul>
        </Section>
        <Section title="Principais hipóteses em investigação">
          <ul className="space-y-2">{claims.map((c) => <li key={c.id}><Link to={`/investigacoes?claim=${c.id}`} className="block rounded-lg p-2 hover:bg-paper2"><div className="flex items-center gap-2"><span className="chip">{c.code}</span><StatusBadge status={c.status} small /></div><div className="mt-1 line-clamp-2 text-xs text-ink2">{c.content}</div></Link></li>)}</ul>
        </Section>
      </div>

      <Section title="Origem do sobrenome: de Giovannitti a Joanitti" right={<Link to="/pessoas?aba=sobrenomes" className="text-sm text-blue underline">detalhes →</Link>}>
        <div className="flex flex-wrap gap-2">{variants.map((v: any) => <span key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm"><span className="serif">{v.form}</span><span title={STATUS_LABEL[v.status as keyof typeof STATUS_LABEL]} className="text-ink2"><StatusIcon status={v.status} /></span></span>)}</div>
        <p className="mt-2 text-xs text-ink2">A forma "Joanitti" não consta como sobrenome italiano estabelecido; nos registros brasileiros ela surge, plausivelmente, por adaptação fonética de "Giovanitti"/"Giovannitti" (hipótese H1).</p>
      </Section>

      <Section title="Personagens com registro mais sólido" right={<Link to="/pessoas" className="text-sm text-blue underline">ver todos →</Link>}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{key.map((p) => <PersonCard key={p.id} p={p} />)}</div>
      </Section>
    </Page>
  );
}
