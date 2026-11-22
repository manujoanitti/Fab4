import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, useAtlas } from '../lib/api';
import { Empty, Page, Section, StatusBadge } from '../components/ui';
import { INVESTIGATION_STATUS_LABEL, STATUSES, STATUS_LABEL, type Status } from '../../shared/types';
import type { Claim, Inv } from '../lib/model';

export function InvestigationsPage() {
  const { snap, ix } = useAtlas();
  const [sp, setSp] = useSearchParams();
  const [filter, setFilter] = useState('ativas');
  const claimParam = sp.get('claim');
  const selId = sp.get('inv') ?? (claimParam ? snap?.investigations.find((v) => v.hypotheses.some((h) => h.claim_id === claimParam))?.id : null);
  const list = useMemo(() => (snap ? snap.investigations.filter((v) => (filter === 'todas' ? true : filter === 'ativas' ? ['aberta', 'em_andamento'].includes(v.status) : v.status === filter)) : []), [snap, filter]);
  if (!snap || !ix) return null;
  const sel = snap.investigations.find((v) => v.id === selId) ?? null;
  const orphanClaims = snap.claims.filter((c) => !c.archived_at && !snap.investigations.some((v) => v.hypotheses.some((h) => h.claim_id === c.id)));
  return (
    <Page title="Investigações" wide subtitle="Perguntas de pesquisa ainda abertas: hipóteses alternativas, o que sustenta cada uma, documentos necessários e o histórico das decisões. Uma investigação pode relacionar pessoas e lugares sem estabelecer parentesco.">
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div>
          <div className="mb-2 flex flex-wrap gap-1">{[['ativas', 'Ativas'], ['concluida', 'Concluídas'], ['arquivada', 'Arquivadas'], ['todas', 'Todas']].map(([k, l]) => <button key={k} className={`chip cursor-pointer ${filter === k ? '!border-blue !text-blue' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
          <ul className="space-y-2" data-testid="inv-list">{list.map((v) => (
            <li key={v.id}><button onClick={() => setSp({ inv: v.id })} className={`card block w-full p-3 text-left hover:border-blue ${sel?.id === v.id ? '!border-blue ring-1 ring-blue' : ''}`}>
              <div className="flex items-center gap-2 text-xs"><span className="chip">P{v.priority}</span><span className="chip">{INVESTIGATION_STATUS_LABEL[v.status]}</span><span className="text-ink2">{v.hypotheses.length} hipótese(s)</span></div>
              <div className="serif mt-1 text-sm text-blue">{v.title}</div><div className="mt-0.5 line-clamp-2 text-xs text-ink2">{v.question}</div></button></li>))}
            {!list.length && <Empty>Nenhuma investigação neste filtro.</Empty>}</ul>
          {orphanClaims.length > 0 && <p className="mt-3 text-xs text-ink2">{orphanClaims.length} afirmação(ões) sem investigação associada.</p>}
        </div>
        <div>{sel ? <InvestigationDetail inv={sel} focusClaim={claimParam} /> : <Empty>Selecione uma investigação para ver hipóteses, evidências, documentos pendentes e o histórico.</Empty>}</div>
      </div>
    </Page>
  );
}

function InvestigationDetail({ inv, focusClaim }: { inv: Inv; focusClaim: string | null }) {
  const { snap, ix, admin, refresh } = useAtlas(); if (!snap || !ix) return null;
  const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null); const [warn, setWarn] = useState<string[]>([]);
  const [concl, setConcl] = useState(inv.conclusion ?? ''); const [st, setSt] = useState(inv.status);
  const run = async (fn: () => Promise<any>) => { setErr(null); try { const r = await fn(); setWarn(r?.warnings ?? []); await refresh(); } catch (e) { setErr(e instanceof ApiError ? [e.message, ...e.details].join(' — ') : String(e)); } };
  const hyps = inv.hypotheses.map((h) => ({ h, c: ix.C.get(h.claim_id)! })).filter((x) => x.c);
  const generalTasks = inv.tasks.filter((t) => !t.claim_id);
  return (
    <div className="space-y-4" data-testid="inv-detail">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="chip">Prioridade {inv.priority}</span><span className="chip">{INVESTIGATION_STATUS_LABEL[inv.status]}</span></div>
        <h2 className="serif mt-1 text-2xl text-blue">{inv.title}</h2><p className="mt-1 text-base">{inv.question}</p>
        {inv.description && <p className="mt-2 text-sm text-ink2">{inv.description}</p>}
        {inv.conclusion && <div className="mt-3 rounded-lg border border-ok/40 bg-ok/10 p-2 text-sm"><b>Conclusão:</b> {inv.conclusion}</div>}
        <div className="mt-3 flex flex-wrap gap-1.5">{inv.entities.map((e) => e.type === 'person' ? <Link key={e.id} className="chip hover:border-blue" to={`/pessoas/${e.id}`}>👤 {ix.P.get(e.id)?.preferred_name}</Link> : e.type === 'place' ? <Link key={e.id} className="chip hover:border-blue" to={`/mapa?lugar=${e.id}`}>📍 {ix.PL.get(e.id)?.name}</Link> : e.type === 'nucleus' ? <Link key={e.id} className="chip hover:border-blue" to={`/arvore?nucleo=${e.id}`}>◌ {ix.N.get(e.id)?.name.slice(0, 40)}</Link> : null)}</div>
      </div>
      {err && <p className="rounded-lg border border-bad p-2 text-sm text-bad">{err}</p>}
      {warn.map((w) => <p key={w} className="rounded-lg border border-warn p-2 text-sm text-warn">⚠ {w}</p>)}

      <Section title={`Hipóteses (${hyps.length})`}>
        <div className="space-y-3">{hyps.map(({ h, c }) => <HypothesisCard key={c.id} label={h.label} c={c} tasks={inv.tasks.filter((t) => t.claim_id === c.id)} open={focusClaim === c.id} admin={admin} run={run} />)}
          {!hyps.length && <Empty>Sem hipóteses.</Empty>}</div>
      </Section>

      <Section title="Documentos pendentes e próximos passos">
        {generalTasks.length ? <ul className="space-y-1.5">{generalTasks.map((t) => <TaskRow key={t.id} t={t} admin={admin} run={run} />)}</ul> : <Empty>Sem tarefas gerais; veja as tarefas dentro de cada hipótese.</Empty>}
      </Section>

      {admin && <Section title="Registrar documento pendente / próximo passo / hipótese">
        <AddItems inv={inv} run={run} />
      </Section>}

      <Section title="Histórico de decisões">
        {inv.log.length ? <ul className="space-y-1.5 text-sm">{[...inv.log].reverse().map((l) => <li key={l.id} className="rounded border border-line p-2"><span className="chip mr-2">{l.kind}</span><span className="text-xs text-ink2">{l.at.slice(0, 16).replace('T', ' ')} · {l.actor}</span><div>{l.text}</div></li>)}</ul> : <Empty>Nenhum registro ainda.</Empty>}
        {admin && <div className="mt-3 space-y-2 border-t border-line pt-3">
          <div className="flex gap-2"><input className="input" placeholder="Registrar nota / decisão…" value={note} onChange={(e) => setNote(e.target.value)} data-testid="inv-note" />
            <button className="btn" onClick={() => note.trim() && run(async () => { await api(`/admin/investigation/${inv.id}/log`, { method: 'POST', body: { kind: 'decisao', text: note } }); setNote(''); })}>Registrar decisão</button></div>
          <div className="grid gap-2 md:grid-cols-[10rem_1fr_auto]"><select className="input" value={st} onChange={(e) => setSt(e.target.value)} aria-label="Estado da investigação">{Object.entries(INVESTIGATION_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <input className="input" placeholder="Conclusão (opcional)" value={concl} onChange={(e) => setConcl(e.target.value)} /><button className="btn btn-primary" onClick={() => run(() => api(`/admin/investigation/${inv.id}/conclude`, { method: 'POST', body: { status: st, conclusion: concl || null } }))}>Atualizar estado</button></div></div>}
      </Section>
    </div>
  );
}

function TaskRow({ t, admin, run }: { t: Inv['tasks'][number]; admin: boolean; run: (f: () => Promise<any>) => void }) {
  const done = t.status === 'feito';
  return (
    <li className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={done} disabled={!admin} aria-label="Concluída" onChange={() => run(() => api(`/admin/investigation_task/${t.id}`, { method: 'PATCH', body: { status: done ? 'pendente' : 'feito' } }))} />
      <div className={done ? 'text-ink2 line-through' : ''}><span className="chip mr-1">{t.kind === 'documento_pendente' ? 'documento' : 'passo'}</span>{t.text}{t.institution && <span className="text-xs text-ink2"> — {t.institution}</span>}</div></li>
  );
}

function HypothesisCard({ label, c, tasks, open, admin, run }: { label?: string; c: Claim; tasks: Inv['tasks']; open: boolean; admin: boolean; run: (f: () => Promise<any>) => void }) {
  const { snap, ix } = useAtlas(); if (!snap || !ix) return null;
  const evid = ix.evidBySubject.get(`claim:${c.id}`) ?? [];
  const fav = evid.filter((e) => e.stance === 'favoravel'), con = evid.filter((e) => e.stance === 'contraria'), ctx = evid.filter((e) => e.stance === 'contexto');
  const [status, setStatus] = useState<Status>(c.status); const [why, setWhy] = useState(''); const [conf, setConf] = useState(String(c.confidence ?? ''));
  const [src, setSrc] = useState(''); const [stance, setStance] = useState('favoravel'); const [exc, setExc] = useState('');
  const srcLink = (id: string, note?: string) => { const s = ix.S.get(id); return s ? <li key={id + (note ?? '')} className="text-xs"><Link className="text-blue underline" to={`/documentos?doc=${id}`}>{s.title.slice(0, 90)}</Link>{note && <span className="text-ink2"> — {note}</span>}</li> : null; };
  return (
    <details open={open} className={`rounded-xl border p-3 ${open ? 'border-blue' : 'border-line'}`} data-testid="hypothesis">
      <summary className="cursor-pointer list-none"><div className="flex flex-wrap items-center gap-2"><span className="chip">{label ?? c.code}</span><StatusBadge status={c.status} />{c.confidence != null && <span className="text-xs text-ink2">confiança {c.confidence}%</span>}{c.reported_status && c.reported_status.toLowerCase() !== STATUS_LABEL[c.status].toLowerCase() && <span className="chip" title="Classificação original do relatório">relatório: {c.reported_status.slice(0, 40)}</span>}</div>
        <p className="mt-1 text-sm">{c.content}</p></summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div><div className="label">O que sustenta (evidências favoráveis)</div>{fav.length ? <ul className="space-y-0.5">{fav.map((e) => srcLink(e.source_id, e.note))}</ul> : <span className="text-xs text-ink2">nenhuma evidência favorável vinculada</span>}
          {ctx.length > 0 && <><div className="label mt-2">Contexto</div><ul className="space-y-0.5">{ctx.map((e) => srcLink(e.source_id, e.note))}</ul></>}</div>
        <div><div className="label">Contra / limitações</div>{con.length > 0 && <ul className="space-y-0.5">{con.map((e) => srcLink(e.source_id, e.note))}</ul>}{c.contradictions ? <p className="text-xs">{c.contradictions}</p> : !con.length && <span className="text-xs text-ink2">nenhuma registrada</span>}</div>
      </div>
      {c.justification && <p className="mt-2 rounded-lg bg-paper2 p-2 text-xs"><b>Justificativa do estado:</b> {c.justification}</p>}
      <div className="mt-3"><div className="label">Documentos necessários para confirmar</div>{tasks.length ? <ul className="space-y-1">{tasks.map((t) => <TaskRow key={t.id} t={t} admin={admin} run={run} />)}</ul> : <span className="text-xs text-ink2">nenhum documento específico registrado</span>}</div>
      {c.entities.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.entities.filter((e) => e.type === 'person').map((e) => <Link key={e.id} className="chip hover:border-blue" to={`/pessoas/${e.id}`}>{ix.P.get(e.id)?.preferred_name}</Link>)}</div>}
      {c.history.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer text-ink2">Histórico de atualizações ({c.history.length})</summary><ul className="mt-1 space-y-0.5">{c.history.map((h) => <li key={h.id}>{h.at.slice(0, 16).replace('T', ' ')} · {h.actor}: {h.from_status ? `${STATUS_LABEL[h.from_status as Status]} → ` : ''}{h.to_status ? STATUS_LABEL[h.to_status as Status] : ''}{h.note ? ` — ${h.note}` : ''}</li>)}</ul></details>}
      {admin && <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
        <div className="grid gap-2 md:grid-cols-[12rem_6rem_1fr_auto]"><select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Novo estado">{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          <input className="input" inputMode="numeric" placeholder="conf. %" value={conf} onChange={(e) => setConf(e.target.value)} aria-label="Confiança (%)" /><input className="input" placeholder="Justificativa da mudança" value={why} onChange={(e) => setWhy(e.target.value)} />
          <button className="btn btn-primary" data-testid="claim-status-save" onClick={() => run(async () => { if (conf !== String(c.confidence ?? '')) await api(`/admin/claim/${c.id}`, { method: 'PATCH', body: { confidence: conf === '' ? null : +conf } }); return api(`/admin/status/claim/${c.id}`, { method: 'POST', body: { status, note: why } }); })}>Salvar estado</button></div>
        <div className="grid gap-2 md:grid-cols-[1fr_8rem_1fr_auto]"><select className="input" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Fonte"><option value="">Vincular evidência: fonte…</option>{snap.sources.map((s) => <option key={s.id} value={s.id}>{s.title.slice(0, 60)}</option>)}</select>
          <select className="input" value={stance} onChange={(e) => setStance(e.target.value)}><option value="favoravel">favorável</option><option value="contraria">contrária</option><option value="contexto">contexto</option></select><input className="input" placeholder="Trecho (opcional)" value={exc} onChange={(e) => setExc(e.target.value)} />
          <button className="btn" disabled={!src} onClick={() => run(async () => { await api('/admin/evidence', { method: 'POST', body: { subject_type: 'claim', subject_id: c.id, source_id: src, stance, excerpt: exc || null } }); setSrc(''); setExc(''); })}>Vincular</button></div></div>}
    </details>
  );
}

function AddItems({ inv, run }: { inv: Inv; run: (f: () => Promise<any>) => void }) {
  const { snap } = useAtlas(); const [kind, setKind] = useState('documento_pendente'); const [text, setText] = useState(''); const [inst, setInst] = useState(''); const [claim, setClaim] = useState('');
  const [hc, setHc] = useState(''); const [hl, setHl] = useState('');
  if (!snap) return null;
  const linked = new Set(inv.hypotheses.map((h) => h.claim_id));
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-[10rem_1fr_12rem_12rem_auto]"><select className="input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo"><option value="documento_pendente">documento pendente</option><option value="proximo_passo">próximo passo</option></select>
        <input className="input" placeholder="Descrição" value={text} onChange={(e) => setText(e.target.value)} data-testid="task-text" /><input className="input" placeholder="Instituição / acervo" value={inst} onChange={(e) => setInst(e.target.value)} />
        <select className="input" value={claim} onChange={(e) => setClaim(e.target.value)} aria-label="Hipótese"><option value="">(geral)</option>{inv.hypotheses.map((h) => <option key={h.claim_id} value={h.claim_id}>{h.label ?? h.claim_id}</option>)}</select>
        <button className="btn btn-primary" disabled={!text.trim()} data-testid="task-add" onClick={() => run(async () => { await api('/admin/investigation_task', { method: 'POST', body: { investigation_id: inv.id, kind, text, institution: inst || null, claim_id: claim || null, sort: inv.tasks.length } }); setText(''); setInst(''); })}>Adicionar</button></div>
      <div className="grid gap-2 md:grid-cols-[1fr_12rem_auto]"><select className="input" value={hc} onChange={(e) => setHc(e.target.value)} aria-label="Afirmação existente"><option value="">Vincular hipótese/afirmação existente…</option>{snap.claims.filter((c) => !linked.has(c.id) && !c.redacted).map((c) => <option key={c.id} value={c.id}>{(c.code ?? '') + ' ' + c.content.slice(0, 70)}</option>)}</select>
        <input className="input" placeholder="Rótulo (ex.: D — outra cidade)" value={hl} onChange={(e) => setHl(e.target.value)} />
        <button className="btn" disabled={!hc} onClick={() => run(async () => { await api('/admin/link/investigation_hypothesis', { method: 'POST', body: { investigation_id: inv.id, claim_id: hc, label: hl || null, sort: inv.hypotheses.length } }); setHc(''); setHl(''); })}>Vincular</button></div>
    </div>
  );
}
