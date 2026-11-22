import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, download, getToken, useAtlas } from '../lib/api';
import { Empty, Modal, Page, Section, Tabs } from '../components/ui';
import { CONFS } from './admin/conf';
import { EntityManager, History } from './admin/EntityManager';
import { STATUSES, STATUS_LABEL } from '../../shared/types';

const errMsg = (e: unknown) => (e instanceof ApiError ? [e.message, ...e.details].join(' • ') : String(e));
const TABS: [string, string][] = [['painel', 'Painel e integridade'], ['revisao', 'Revisão'], ['pessoas', 'Pessoas'], ['relacoes', 'Relações'], ['eventos', 'Eventos'], ['lugares', 'Lugares'], ['fontes', 'Fontes'], ['afirmacoes', 'Afirmações'], ['investigacoes', 'Investigações'], ['nucleos', 'Núcleos, grupos e identidades'], ['sobrenomes', 'Sobrenomes e contexto'], ['importar', 'Importar relatório'], ['exportar', 'Exportar e backup'], ['historico', 'Histórico']];
const CONF_OF: Record<string, string> = { pessoas: 'person', relacoes: 'relationship', eventos: 'event', lugares: 'place', fontes: 'source', afirmacoes: 'claim', investigacoes: 'investigation' };

export function AdminPage() {
  const { admin, snap, preview } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('aba') ?? 'painel';
  if (!snap) return null;
  if (!admin || preview) return <Page title="Administração"><Empty>{preview ? 'Desative "ver como público" para editar.' : <>Área restrita. Use <b>“entrar como administrador”</b> no topo da página e informe o token (<code>ATLAS_ADMIN_TOKEN</code>).</>}</Empty></Page>;
  return (
    <Page title="Administração" wide subtitle="Edição validada com histórico de mudanças. Nada é apagado de forma irreversível: registros são arquivados e podem ser restaurados.">
      <Tabs tabs={TABS} value={tab} onChange={(v) => setSp({ aba: v })} />
      {tab === 'painel' && <Dashboard />}
      {tab === 'revisao' && <Review />}
      {CONF_OF[tab] && <EntityManager conf={CONFS[CONF_OF[tab]]} initialId={sp.get('id')} />}
      {tab === 'nucleos' && <><h2 className="serif mb-2 text-lg text-blue">Núcleos</h2><EntityManager conf={CONFS.nucleus} /><h2 className="serif mb-2 mt-6 text-lg text-blue">Agrupamentos investigativos</h2><EntityManager conf={CONFS.research_group} /><h2 className="serif mb-2 mt-6 text-lg text-blue">Ligações de identidade (homônimos)</h2><EntityManager conf={CONFS.identity_link} /></>}
      {tab === 'sobrenomes' && <><h2 className="serif mb-2 text-lg text-blue">Sobrenomes e variantes</h2><EntityManager conf={CONFS.surname_variant} /><h2 className="serif mb-2 mt-6 text-lg text-blue">Contexto histórico</h2><EntityManager conf={CONFS.historical_context} /></>}
      {tab === 'importar' && <Importer />}
      {tab === 'exportar' && <Exporter />}
      {tab === 'historico' && <Section title="Últimas alterações"><History /></Section>}
    </Page>
  );
}

function Dashboard() {
  const { snap } = useAtlas();
  const [res, setRes] = useState<{ issues: any[]; summary: Record<string, number> } | null>(null);
  const [archived, setArchived] = useState<any[]>([]);
  const { refresh } = useAtlas();
  const load = () => { api('/admin/integrity').then(setRes); api<any[]>('/admin/archived').then(setArchived); };
  useEffect(load, []);
  const editLink = (i: any) => (i.entityType === 'person' ? `/admin?aba=pessoas&id=${i.entityId}` : i.entityType === 'relationship' ? `/admin?aba=relacoes&id=${i.entityId}` : i.entityType === 'event' ? `/admin?aba=eventos&id=${i.entityId}` : i.entityType === 'place' ? `/admin?aba=lugares&id=${i.entityId}` : i.entityType === 'source' ? `/admin?aba=fontes&id=${i.entityId}` : i.entityType === 'claim' ? `/admin?aba=afirmacoes&id=${i.entityId}` : null);
  if (!snap) return null;
  const s = snap.stats;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">{Object.entries({ Pessoas: s.persons, Relações: s.relationships, Eventos: s.events, Lugares: s.places, Fontes: s.sources, 'Hipóteses abertas': s.openHypotheses, Investigações: s.openInvestigations, 'Revisões pendentes': s.pendingReview }).map(([k, v]) => <div key={k} className="card p-3"><div className="serif text-2xl text-blue">{v}</div><div className="text-xs text-ink2">{k}</div></div>)}</div>
      <Section title="Verificações de integridade" right={<button className="btn" onClick={load}>⟳ Reexecutar</button>}>
        {!res ? <p className="text-sm text-ink2">Verificando…</p> : <>
          <p className="mb-2 text-sm"><b className="text-bad">{res.summary.erro} erro(s)</b> · <b className="text-warn">{res.summary.aviso} aviso(s)</b> · <span className="text-ink2">{res.summary.info} informação(ões)</span></p>
          <ul className="space-y-1 text-sm" data-testid="integrity-list">{res.issues.filter((i) => i.severity !== 'info').map((i, n) => <li key={n} className="flex items-start gap-2"><span className={`chip ${i.severity === 'erro' ? '!border-bad !text-bad' : '!border-warn !text-warn'}`}>{i.severity}</span><span>{i.message} {editLink(i) && <Link className="text-blue underline" to={editLink(i)!}>abrir</Link>}</span></li>)}</ul>
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink2">Informações ({res.summary.info})</summary><ul className="mt-1 space-y-0.5 text-xs">{res.issues.filter((i) => i.severity === 'info').map((i, n) => <li key={n}>• {i.message}</li>)}</ul></details></>}
      </Section>
      <Section title={`Registros arquivados (${archived.length})`}>
        {archived.length ? <ul className="space-y-1 text-sm">{archived.map((a) => <li key={a.type + a.id} className="flex items-center gap-2"><span className="chip">{a.type}</span><span className="truncate">{String(a.label).slice(0, 80)}</span><button className="btn ml-auto" onClick={async () => { await api(`/admin/${a.type}/${a.id}/restore`, { method: 'POST' }); await refresh(); load(); }}>Restaurar</button></li>)}</ul> : <Empty>Nenhum registro arquivado.</Empty>}
      </Section>
    </div>
  );
}

function Review() {
  const { snap, refresh, ix } = useAtlas();
  const [kind, setKind] = useState(''); const [stat, setStat] = useState('pendente'); const [open, setOpen] = useState<any | null>(null); const [txt, setTxt] = useState('');
  if (!snap || !ix) return null;
  const kinds = [...new Set(snap.reviewItems.map((r: any) => r.kind))] as string[];
  const items = snap.reviewItems.filter((r: any) => (!kind || r.kind === kind) && (!stat || r.status === stat));
  const set = async (status: string) => { await api(`/admin/review/${open.id}`, { method: 'POST', body: { status, resolution: txt || null } }); setOpen(null); setTxt(''); await refresh(); };
  return (
    <div>
      <p className="mb-3 max-w-3xl text-sm text-ink2">Itens que a importação NÃO decidiu sozinha: ambiguidades, contradições do relatório, lacunas, propostas de relação não aplicadas e decisões de privacidade. <a className="text-blue underline" href="#" onClick={(e) => { e.preventDefault(); download('/admin/inconsistencias.md', 'inconsistencias-e-lacunas.md'); }}>Exportar relatório de inconsistências e lacunas (.md)</a></p>
      <div className="mb-3 flex flex-wrap gap-2"><select className="input !w-auto" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos os tipos</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select><select className="input !w-auto" value={stat} onChange={(e) => setStat(e.target.value)}><option value="">Qualquer estado</option><option value="pendente">Pendentes</option><option value="resolvido">Resolvidos</option><option value="recusado">Recusados</option></select><span className="self-center text-xs text-ink2">{items.length} item(ns)</span></div>
      <ul className="space-y-2" data-testid="review-list">{items.map((r: any) => (
        <li key={r.id}><button className="card block w-full p-3 text-left hover:border-blue" onClick={() => { setOpen(r); setTxt(r.resolution ?? ''); }}><div className="flex flex-wrap items-center gap-2 text-xs"><span className="chip">{r.kind}</span><span className="chip">{r.status}</span>{r.section && <span className="text-ink2">relatório, seção {r.section}</span>}</div><div className="serif mt-1 text-sm">{r.title}</div></button></li>))}</ul>
      {open && <Modal title={open.title} onClose={() => setOpen(null)} wide><div className="space-y-3 text-sm"><p>{open.detail}</p>{open.quote && <blockquote className="border-l-2 border-gold pl-3 text-xs italic">“{open.quote}”<div className="not-italic text-ink2">— relatório, seção {open.section}</div></blockquote>}
        {open.entity_type && <p className="text-xs">Registro relacionado: {open.entity_type} <code>{open.entity_id}</code></p>}
        <textarea className="input" placeholder="Resolução / decisão" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <div className="flex gap-2"><button className="btn btn-primary" onClick={() => set('resolvido')}>Marcar como resolvido</button><button className="btn" onClick={() => set('recusado')}>Recusar</button><button className="btn" onClick={() => set('pendente')}>Reabrir</button></div></div></Modal>}
    </div>
  );
}

function Importer() {
  const { snap, refresh } = useAtlas();
  const [pkgText, setPkgText] = useState(''); const [reportText, setReportText] = useState(''); const [reportId, setReportId] = useState('');
  const [audit, setAudit] = useState<any | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [res, setRes] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<any[]>([]);
  const loadRuns = () => api<any[]>('/admin/import-runs').then(setRuns).catch(() => {});
  useEffect(() => { loadRuns(); }, []);
  const readFile = (set: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) f.text().then(set); };
  const go = async (mode: 'dry_run' | 'apply') => {
    setBusy(true); setErr(null);
    try {
      const body: any = { package: JSON.parse(pkgText), mode, resolutions: res }; if (reportId) body.reportId = reportId; else body.reportText = reportText;
      const a = await api('/admin/import', { method: 'POST', body }); setAudit({ ...a, applied: mode === 'apply' }); if (mode === 'apply') { await refresh(); loadRuns(); }
    } catch (e) { setErr(e instanceof SyntaxError ? 'JSON do pacote inválido: ' + e.message : errMsg(e)); setAudit(null); } finally { setBusy(false); }
  };
  if (!snap) return null;
  return (
    <div className="space-y-4">
      <Section title="Importação incremental de relatórios">
        <p className="mb-3 max-w-3xl text-sm text-ink2">O importador não interpreta texto livre: ele recebe um <b>pacote de extração</b> (JSON) com o texto original do relatório, <b>confere cada citação</b> contra esse texto, reconcilia com o que já existe (chaves estáveis), mostra as alterações propostas e só então consolida. Reimportar o mesmo pacote não duplica nada; edições suas posteriores nunca são sobrescritas (viram conflito para revisão).</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div><label className="label">Pacote de extração (.json)</label><input type="file" accept=".json,application/json" onChange={readFile(setPkgText)} className="input" data-testid="pkg-file" /><textarea className="input mt-2 h-28 font-mono text-xs" placeholder="…ou cole o JSON do pacote" value={pkgText} onChange={(e) => setPkgText(e.target.value)} data-testid="pkg-text" /></div>
          <div><label className="label">Texto original do relatório (.md/.txt)</label><input type="file" accept=".md,.txt,text/*" onChange={readFile(setReportText)} className="input" /><textarea className="input mt-2 h-28 text-xs" placeholder="…ou cole o texto" value={reportText} onChange={(e) => { setReportText(e.target.value); setReportId(''); }} data-testid="report-text" />
            <select className="input mt-2" value={reportId} onChange={(e) => setReportId(e.target.value)} aria-label="Relatório armazenado"><option value="">— ou use um relatório já armazenado —</option>{snap.reports.map((r: any) => <option key={r.id} value={r.id}>{r.title} ({Math.round(r.size / 1000)} kB)</option>)}</select></div>
        </div>
        {err && <p className="mt-3 rounded-lg border border-bad p-2 text-sm text-bad" role="alert" data-testid="import-error">{err}</p>}
        <div className="mt-3 flex gap-2"><button className="btn" disabled={busy || !pkgText} onClick={() => go('dry_run')} data-testid="dry-run">1 · Pré-visualizar alterações</button><button className="btn btn-primary" disabled={busy || !audit || audit.applied || audit.quotes.failed.length > 0} onClick={() => go('apply')} data-testid="apply-import">2 · Consolidar</button></div>
      </Section>
      {audit && <AuditView a={audit} res={res} setRes={setRes} />}
      <Section title="Importações anteriores">{runs.length ? <ul className="space-y-1 text-sm">{runs.map((r) => <li key={r.id}><span className="chip mr-2">{r.mode}</span>{r.package_id} v{r.package_version} <span className="text-xs text-ink2">· {r.at.slice(0, 16).replace('T', ' ')} · {r.actor}</span></li>)}</ul> : <Empty>Nenhuma importação registrada.</Empty>}</Section>
    </div>
  );
}
function AuditView({ a, res, setRes }: { a: any; res: Record<string, string>; setRes: (r: Record<string, string>) => void }) {
  const { snap } = useAtlas();
  return (
    <Section title={a.applied ? '✔ Importação consolidada' : 'Plano de alterações (pré-visualização — nada foi gravado)'}>
      <table className="mb-3 w-full text-sm"><thead><tr className="text-left text-xs text-ink2"><th>Entidade</th><th>Criar</th><th>Atualizar</th><th>Inalterado</th><th>Conflito</th></tr></thead><tbody>{Object.entries(a.counts).map(([k, c]: any) => <tr key={k} className="border-t border-line"><td>{k}</td><td>{c.created}</td><td>{c.updated}</td><td>{c.unchanged}</td><td className={c.conflicts ? 'text-bad' : ''}>{c.conflicts}</td></tr>)}</tbody></table>
      <p className="text-sm">Citações conferidas no texto original: <b>{a.quotes.checked}</b> · falhas: <b className={a.quotes.failed.length ? 'text-bad' : 'text-ok'}>{a.quotes.failed.length}</b> · ligações novas: {a.links.added} · itens de revisão novos: {a.reviewItems.created}</p>
      {a.quotes.failed.length > 0 && <div className="mt-2 rounded-lg border border-bad p-2 text-sm"><b>Citações não encontradas no relatório (a consolidação fica bloqueada):</b><ul className="text-xs">{a.quotes.failed.slice(0, 20).map((f: any, i: number) => <li key={i}>{f.type}:{f.key} — “{f.quote}”</li>)}</ul></div>}
      {a.warnings.map((w: string) => <p key={w} className="mt-2 text-sm text-warn">⚠ {w}</p>)}
      {a.conflicts.length > 0 && <div className="mt-3"><h3 className="label">Conflitos (nada foi sobrescrito)</h3><ul className="text-sm">{a.conflicts.map((c: any, i: number) => <li key={i}>{c.type} “{c.label}” — campos: {c.fields.join(', ')}</li>)}</ul></div>}
      {a.duplicates.length > 0 && <div className="mt-3"><h3 className="label">Possíveis duplicatas — escolha antes de consolidar</h3>{a.duplicates.map((d: any) => <div key={d.key} className="mb-2 rounded-lg border border-warn/50 p-2 text-sm"><b>{d.name}</b> parece com:<select className="input mt-1" value={res[`person:${d.key}`] ?? ''} onChange={(e) => setRes({ ...res, [`person:${d.key}`]: e.target.value })}><option value="">Criar como pessoa NOVA</option>{d.candidates.map((c: any) => <option key={c.id} value={c.id}>Mesclar com {c.name} ({c.id}, similaridade {c.score})</option>)}</select></div>)}<p className="text-xs text-ink2">Depois de escolher, execute a pré-visualização novamente.</p></div>}
      <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink2">Registros criados ({a.created.length}) e atualizados ({a.updated.length})</summary>
        <ul className="mt-1 max-h-64 overflow-auto text-xs">{a.created.map((c: any, i: number) => <li key={'c' + i}>＋ {c.type}: {c.label}</li>)}{a.updated.map((c: any, i: number) => <li key={'u' + i}>✎ {c.type}: {c.label} — {Object.keys(c.diff).join(', ')}</li>)}</ul></details>
      {snap && a.orphans.length > 0 && <p className="mt-2 text-xs text-ink2">{a.orphans.length} registro(s) de versões anteriores deste pacote não constam mais nele (preservados).</p>}
    </Section>
  );
}

function Exporter() {
  const { snap, refresh } = useAtlas();
  const [living, setLiving] = useState(false); const [minSt, setMinSt] = useState('fortemente_corroborado'); const [msg, setMsg] = useState<string | null>(null); const [report, setReport] = useState<any | null>(null);
  const run = async (fn: () => Promise<any>) => { setMsg(null); try { await fn(); } catch (e) { setMsg(errMsg(e)); } };
  if (!snap) return null;
  const csvs = ['pessoas', 'relacoes', 'eventos', 'lugares', 'fontes', 'afirmacoes', 'evidencias'];
  return (
    <div className="space-y-4">
      {msg && <p className="rounded-lg border border-warn p-2 text-sm">{msg}</p>}
      <Section title="Backup e restauração">
        <div className="flex flex-wrap gap-2"><button className="btn btn-primary" onClick={() => run(() => download('/admin/export/backup.json', 'joanitti-atlas-backup.json'))} data-testid="export-json">Backup completo (JSON estruturado, sem perdas)</button><button className="btn" onClick={() => run(() => download('/admin/export/sqlite', 'joanitti-atlas.sqlite'))}>Cópia do banco (SQLite)</button></div>
        <div className="mt-3"><label className="label">Restaurar a partir de backup JSON (substitui os dados; uma cópia de segurança do banco atual é criada antes)</label>
          <input type="file" accept=".json" className="input" onChange={async (e) => { const f = e.target.files?.[0]; if (!f || !confirm('Restaurar este backup substituirá TODO o acervo atual. Continuar?')) return; await run(async () => { const r = await api('/admin/restore', { method: 'POST', body: JSON.parse(await f.text()) }); setMsg(`Restaurado: ${r.restored} linhas. Cópia de segurança: ${r.safetyCopy}`); await refresh(); }); }} data-testid="restore-file" /></div>
      </Section>
      <Section title="GEDCOM (5.5.1)">
        <p className="mb-2 max-w-3xl text-xs text-ink2">O GEDCOM só comporta pessoas, nomes, eventos, famílias e fontes. Relações abaixo do limiar escolhido (hipóteses) NÃO viram vínculos: saem como nota na pessoa. Pessoas vivas ficam de fora por padrão. Hipóteses, proveniência e investigações completas só existem no backup JSON.</p>
        <div className="flex flex-wrap items-center gap-3"><label className="text-sm">Limiar de relações: <select className="input !inline-block !w-auto" value={minSt} onChange={(e) => setMinSt(e.target.value)}>{STATUSES.filter((s) => s !== 'descartado').map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={living} onChange={(e) => setLiving(e.target.checked)} />incluir pessoas vivas</label>
          <button className="btn" onClick={() => run(() => download(`/export/gedcom?minStatus=${minSt}&includeLiving=${living ? 1 : 0}`, 'joanitti-atlas.ged'))} data-testid="export-gedcom">Baixar .ged</button></div>
      </Section>
      <Section title="Relatórios CSV (separador ponto e vírgula, UTF-8 com BOM — abre no Excel)">
        <div className="flex flex-wrap gap-2">{csvs.map((c) => <button key={c} className="btn" onClick={() => run(() => download(`/export/csv/${c}`, `${c}.csv`))}>{c}.csv</button>)}</div>
      </Section>
      <Section title="Imagem / PDF das visualizações"><p className="text-sm text-ink2">Na <Link className="text-blue underline" to="/arvore">Árvore Genealógica</Link> use os botões PNG e PDF (impressão). Linha do tempo e mapa podem ser impressos pelo navegador.</p></Section>
      <Section title="Texto original dos relatórios importados">
        {snap.reports.length ? <ul className="space-y-1 text-sm">{snap.reports.map((r: any) => <li key={r.id} className="flex items-center gap-2"><span>{r.title}</span><span className="text-xs text-ink2">{r.origin} · {Math.round(r.size / 1000)} kB · sha256 {r.id.slice(0, 12)}…</span><button className="btn ml-auto" onClick={() => run(async () => setReport(await api(`/admin/reports/${r.id}`)))}>Ler</button></li>)}</ul> : <Empty>Nenhum relatório armazenado.</Empty>}
      </Section>
      {report && <Modal title={report.title} onClose={() => setReport(null)} wide><p className="mb-2 text-xs text-ink2">Texto original preservado integralmente (restrito à administração).</p><pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-paper2 p-3 text-xs">{report.content}</pre></Modal>}
    </div>
  );
}
export { useMemo, getToken };
