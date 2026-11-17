import { useState } from 'react';
import {
  BACKUP_FORMAT, exportBackup, validateBackup, type BackupFile, type RestoreReport,
} from '../domain/backup';
import {
  adjustCreditsOp, completePhaseOp, deliverRewardOp, grantMedalOp, setGoalOp, updateSettingsOp,
} from '../domain/ops';
import { RULES, phaseLabel } from '../domain/rules';
import {
  creditBalance, dayProgress, deliveryFor, goalStatus, hasMedal, medalsSinceLastPhase, nextPhase,
  pendingCredits, pendingDeliveries, shiftDate, todayStr, totals,
} from '../domain/selectors';
import { GOAL_STATUSES, type GoalStatus, type RewardEvent, type Settings } from '../domain/types';
import { cloud } from '../sync/cloud';
import { advancePhases, completeDay, finishCurrentStage, grantDay, resetDemo, simulateCampaign } from '../demo';
import { defaultKV } from '../storage/kv';
import { useApp } from './ctx';
import { CREDIT_KIND, SIZE_LABEL, STATUS_META, fmtDate, fmtDateTime } from './format';
import { hasPin, setPin } from './pin';

// ---------------------------------------------------------------- Revisão diária
export function ReviewScreen() {
  const { state, act, notify } = useApp();
  const [date, setDate] = useState(todayStr());
  const [confirmMedal, setConfirmMedal] = useState(false);
  const p = dayProgress(state, date);
  const specials = p.specials;
  const medal = hasMedal(state, date);
  const dayHistory = state.history.filter((h) => h.date === date).slice().reverse();
  const set = (goalId: string, status: GoalStatus) => act(setGoalOp(state, date, goalId, status));

  return (
    <section className="panel" data-testid="review">
      <h2>Revisão do dia</h2>
      <div className="date-nav">
        <button className="btn" aria-label="Dia anterior" onClick={() => setDate(shiftDate(date, -1))}>◀</button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Data" data-testid="review-date" />
        <button className="btn" aria-label="Próximo dia" onClick={() => setDate(shiftDate(date, 1))}>▶</button>
        <button className="btn" onClick={() => setDate(todayStr())}>Hoje</button>
      </div>
      <p className="muted">{fmtDate(date)} · metas não avaliadas <b>não</b> contam como descumpridas.</p>
      <ul className="goal-list">
        {RULES.goals.map((g) => (
          <GoalRow key={g.id} id={g.id} text={g.text} status={goalStatus(state, date, g.id)} onSet={(s) => set(g.id, s)} />
        ))}
        {specials.map(({ rule, doneThisWeek, doneOn }) => (
          <GoalRow
            key={rule.id}
            id={rule.id}
            special
            text={`Meta especial (${rule.weekdaysLabel}): ${rule.text}`}
            note={doneThisWeek && doneOn !== date ? `Já cumprida nesta semana em ${fmtDate(doneOn!)}.` : undefined}
            status={goalStatus(state, date, rule.id)}
            onSet={(s) => set(rule.id, s)}
          />
        ))}
      </ul>
      <div className="day-summary" data-testid="day-summary">
        {p.count} de {p.required} exigidas para o selo do dia · {p.done}/{p.total} metas diárias cumpridas
      </div>
      <p className="muted small">{RULES.dailyStampRules.join(' ')}</p>
      {medal ? (
        <div className="day-stamp got" data-testid="medal-granted">🌟 Selo do dia concedido (rendeu 1 crédito de minigame)</div>
      ) : confirmMedal ? (
        <div className="row">
          <button className="btn primary" data-testid="medal-confirm" onClick={async () => {
            const r = await act(grantMedalOp(date));
            if (r.status === 'ok') notify('Selo do dia concedido! +1 crédito de minigame');
            setConfirmMedal(false);
          }}>Confirmar selo do dia de {fmtDate(date)}</button>
          <button className="btn" onClick={() => setConfirmMedal(false)}>Cancelar</button>
        </div>
      ) : (
        <button className="btn primary big" disabled={!p.eligible} data-testid="medal-grant" onClick={() => setConfirmMedal(true)}>
          Conceder selo do dia
        </button>
      )}
      {!medal && !p.eligible && <p className="muted small">Faltam metas cumpridas para o selo do dia.</p>}
      {dayHistory.length > 0 && (
        <details>
          <summary>Histórico de alterações do dia ({dayHistory.length})</summary>
          <ul className="log">
            {dayHistory.map((h) => (
              <li key={h.opId}>{fmtDateTime(h.at)} · {goalText(h.goalId)}: {h.from ? STATUS_META[h.from].label : '—'} → <b>{STATUS_META[h.to].label}</b></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
const goalText = (id: string) => [...RULES.goals, ...RULES.specialGoals].find((g) => g.id === id)?.text.slice(0, 40) + '…';

function GoalRow({ id, text, status, onSet, special, note }: { id: string; text: string; status: GoalStatus; onSet: (s: GoalStatus) => void; special?: boolean; note?: string }) {
  return (
    <li className={`goal review ${special ? 'special' : ''} ${status}`} data-testid={`goal-${id}`} data-status={status}>
      <div className="goal-text">{text}{note && <div className="muted small">{note}</div>}</div>
      <div className="seg" role="radiogroup" aria-label={text}>
        {GOAL_STATUSES.map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={status === s}
            aria-label={STATUS_META[s].label}
            title={STATUS_META[s].label}
            className={status === s ? 'on' : ''}
            data-testid={`goal-${id}-${s}`}
            onClick={() => status !== s && onSet(s)}
          >{STATUS_META[s].icon}</button>
        ))}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- Fases e prêmios
export function PrizesScreen() {
  const { state, act, notify } = useApp();
  const next = nextPhase(state);
  const [confirm, setConfirm] = useState(false);
  const hint = state.settings.medalsPerPhaseHint;
  const since = medalsSinceLastPhase(state);
  const t = totals(state);
  return (
    <section className="panel" data-testid="prizes">
      <h2>Fases e prêmios</h2>
      <p>⭐ {t.smallStamps} selos pequenos · 🪙 {t.coins} moedas · 🏅 {t.bigStamps} selos grandes</p>
      <h3>Avanço de fase</h3>
      {next ? (
        <>
          <p>Próxima fase: <b>{phaseLabel(next)}</b> — {RULES.stages[Math.ceil(next / 5) - 1].name}</p>
          {hint && <p className="muted small">Sugestão configurada: {hint} selos do dia por fase · desde a última fase: {since}.</p>}
          {confirm ? (
            <div className="row">
              <button className="btn primary" data-testid="prizes-confirm-phase" onClick={async () => { const r = await act(completePhaseOp(next)); if (r.status === 'ok') notify(`Fase ${phaseLabel(next)} concluída!`); setConfirm(false); }}>Sim, concluir fase {phaseLabel(next)}</button>
              <button className="btn" onClick={() => setConfirm(false)}>Cancelar</button>
            </div>
          ) : (
            <button className="btn primary big" data-testid="prizes-complete-phase" onClick={() => setConfirm(true)}>Confirmar fase {phaseLabel(next)} concluída</button>
          )}
          <p className="muted small">A conclusão de fases não pode ser desfeita pelo aplicativo.</p>
        </>
      ) : <p>🎉 Todas as 25 fases foram concluídas!</p>}
      <h3>Recompensas liberadas</h3>
      {state.rewardEvents.filter((e) => e.kind === 'reward_unlocked').length === 0 && <p className="muted">Nenhuma recompensa liberada ainda.</p>}
      {pendingDeliveries(state).map((r) => <RewardCard key={r.key} r={r} />)}
      {state.rewardEvents.filter((e) => e.kind === 'reward_unlocked' && deliveryFor(state, e.key)).map((r) => {
        const d = deliveryFor(state, r.key)!;
        return <div key={r.key} className="card done" data-testid={`reward-done-${r.key}`}>✅ {rewardTitle(r)}: <b>{d.choice}</b> <span className="muted small">({fmtDateTime(d.at)})</span></div>;
      })}
    </section>
  );
}
const rewardTitle = (r: RewardEvent) => `${r.stage ? `Etapa ${r.stage}` : 'Bônus final'} · recompensa ${SIZE_LABEL[r.size ?? 'small']}`;
function RewardCard({ r }: { r: RewardEvent }) {
  const { act, notify } = useApp();
  const options = r.stage ? RULES.stages[r.stage - 1].rewardOptions : RULES.finalBonus.rewardOptions;
  const [choice, setChoice] = useState(options[0]);
  const [other, setOther] = useState('');
  return (
    <div className="card" data-testid={`reward-${r.key}`}>
      <b>🎁 {rewardTitle(r)}</b>
      <div role="radiogroup" className="options">
        {options.map((o) => (
          <label key={o}><input type="radio" name={r.key} checked={choice === o} onChange={() => setChoice(o)} /> {o}</label>
        ))}
        <label><input type="radio" name={r.key} checked={choice === '__other'} onChange={() => setChoice('__other')} /> outra: <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="descreva" /></label>
      </div>
      <button className="btn primary" data-testid={`deliver-${r.key}`} onClick={async () => {
        const value = choice === '__other' ? other.trim() : choice;
        if (!value) return notify('Informe qual recompensa foi recebida.', 'error');
        const res = await act(deliverRewardOp(r.key, value));
        if (res.status === 'ok') notify('Recompensa registrada como recebida.');
      }}>Registrar como recebida</button>
    </div>
  );
}

// ---------------------------------------------------------------- Créditos
export function CreditsScreen() {
  const { state, act, notify } = useApp();
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const events = state.creditEvents.slice().sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="panel" data-testid="credits">
      <h2>Créditos de minigame</h2>
      <p className="big-number" data-testid="credit-balance">{creditBalance(state)} 🎮</p>
      {pendingCredits(state) > 0 && <p className="muted">+{pendingCredits(state)} aguardando confirmação do servidor.</p>}
      <p className="muted small">Cada selo do dia confirmado rende 1 crédito; cada sessão consome 1. Créditos não expiram. Os minigames não concedem selos, moedas nem alteram metas (regras digitais adicionais).</p>
      <h3>Ajuste manual</h3>
      <div className="row">
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Quantidade" style={{ width: 90 }} data-testid="adjust-amount" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (obrigatório)" aria-label="Motivo" data-testid="adjust-reason" />
        <button className="btn" data-testid="adjust-submit" onClick={async () => {
          const r = await act(adjustCreditsOp(Number.parseInt(amount, 10), reason));
          if (r.status === 'ok') { notify('Ajuste registrado.'); setReason(''); }
        }}>Aplicar</button>
      </div>
      <h3>Histórico</h3>
      <ul className="log" data-testid="credit-log">
        {events.length === 0 && <li className="muted">Sem movimentações.</li>}
        {events.map((e) => (
          <li key={e.key}><b className={e.amount > 0 ? 'pos' : 'neg'}>{e.amount > 0 ? '+' : ''}{e.amount}</b> · {CREDIT_KIND[e.kind]}{e.reason ? ` — ${e.reason}` : ''}{e.kind === 'earn_medal' ? ` (${e.key.slice(6)})` : ''}{e.pending ? ' · pendente' : ''} <span className="muted small">{fmtDateTime(e.at)}</span></li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Histórico
export function HistoryScreen() {
  const { state } = useApp();
  type Item = { at: string; text: string };
  const items: Item[] = [
    ...state.history.map((h) => ({ at: h.at, text: `Meta ${goalText(h.goalId)} (${fmtDate(h.date)}): ${h.from ? STATUS_META[h.from].label : '—'} → ${STATUS_META[h.to].label}` })),
    ...state.medals.map((m) => ({ at: m.grantedAt, text: `🌟 Selo do dia concedido para ${fmtDate(m.date)}` })),
    ...state.phases.map((p) => ({ at: p.completedAt, text: `⭐ Fase ${phaseLabel(p.phase)} concluída` })),
    ...state.rewardEvents.filter((e) => e.kind === 'delivery').map((e) => ({ at: e.at, text: `🎁 Recompensa recebida: ${e.choice}` })),
    ...state.sessions.map((s) => ({ at: s.startedAt, text: `🎮 Sessão de minigame (${s.gameId})` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
  return (
    <section className="panel" data-testid="history">
      <h2>Histórico</h2>
      <ul className="log">
        {items.length === 0 && <li className="muted">Ainda não há registros.</li>}
        {items.map((i, k) => <li key={k}><span className="muted small">{fmtDateTime(i.at)}</span> · {i.text}</li>)}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Sincronização / conflitos
export function SyncPanel() {
  const { sm, sv, state } = useApp();
  const items = sv.queue;
  const describe = (q: (typeof items)[number]) => {
    const op = q.op;
    switch (op.type) {
      case 'set_goal': return `Meta ${goalText(op.goalId)} em ${fmtDate(op.date)} → ${STATUS_META[op.status].label}`;
      case 'save_game_state': return 'Decoração do Jardim Encantado';
      default: return op.type;
    }
  };
  return (
    <div data-testid="sync-panel">
      <h3>Sincronização</h3>
      <p>Estado: <b data-testid="sync-status-text">{sv.status}</b>{sv.lastSyncAt ? ` · última atualização ${fmtDateTime(sv.lastSyncAt)}` : ''}</p>
      <button className="btn" onClick={() => sm.sync()} data-testid="sync-now">Atualizar agora</button>
      {items.length === 0 && <p className="muted">Nenhuma alteração pendente.</p>}
      <ul className="log">
        {items.map((q) => (
          <li key={q.op.opId} data-testid={`queue-${q.status}`}>
            <div><b>{q.status === 'pending' ? '⏳ Aguardando envio' : q.status === 'conflict' ? '⚠️ Conflito' : '🚫 Recusada pelo servidor'}</b> · {describe(q)}</div>
            {q.outcome?.status === 'conflict' && (
              <div className="conflict">
                <div>Outro aparelho já alterou este registro (versão {q.outcome.serverVersion}).</div>
                <div>Valor no servidor: <b>{conflictServerLabel(q.outcome.serverValue)}</b> · Sua alteração: <b>{conflictMineLabel(q.op)}</b></div>
                <div className="row">
                  <button className="btn" data-testid="keep-server" onClick={() => sm.resolveKeepServer(q.op.opId)}>Manter o do servidor</button>
                  <button className="btn primary" data-testid="use-mine" onClick={() => sm.resolveUseMine(q.op.opId)}>Usar a minha alteração</button>
                </div>
              </div>
            )}
            {q.outcome?.status === 'rejected' && (
              <div className="conflict"><div>{q.outcome.message}</div><button className="btn" onClick={() => sm.dismiss(q.op.opId)}>Dispensar</button></div>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">Campanha: {state.name}</p>
    </div>
  );
}
function conflictServerLabel(v: unknown) {
  const x = v as { status?: GoalStatus; data?: unknown } | null;
  if (x?.status) return STATUS_META[x.status].label;
  return x?.data ? 'decoração salva em outro aparelho' : '—';
}
function conflictMineLabel(op: { type: string; status?: GoalStatus }) {
  return op.status ? STATUS_META[op.status].label : 'decoração deste aparelho';
}

// ---------------------------------------------------------------- Backup
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BackupPanel() {
  const { sm, state, isDemo, notify } = useApp();
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [report, setReport] = useState<RestoreReport | null>(null);
  return (
    <div data-testid="backup-panel">
      <h3>Backup</h3>
      <p className="muted small">Formato <code>{BACKUP_FORMAT}</code> v1. Contém dados reais da família: guarde em local privado e <b>nunca</b> publique no GitHub.</p>
      <button className="btn" data-testid="export-backup" onClick={() => {
        const b = exportBackup(state, { demo: isDemo });
        download(`reino-backup-${isDemo ? 'demo-' : ''}${todayStr()}.json`, JSON.stringify(b, null, 2));
        notify('Backup exportado.');
      }}>Exportar backup (JSON)</button>
      <label className="btn" style={{ marginLeft: 8 }}>
        Restaurar de arquivo…
        <input type="file" accept="application/json,.json" hidden data-testid="import-file" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const v = validateBackup(await f.text());
          setReport(null);
          if (v.ok) { setPending(v.backup); setErrors([]); } else { setPending(null); setErrors(v.errors); }
        }} />
      </label>
      {errors.length > 0 && <ul className="error-list" data-testid="backup-errors">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
      {pending && (
        <div className="callout" data-testid="restore-confirm">
          <p>Restaurar backup de {fmtDateTime(pending.exportedAt)}? Serão adicionados apenas os registros que ainda não existem (sem duplicar e sem sobrescrever).</p>
          <div className="row">
            <button className="btn primary" data-testid="restore-go" onClick={async () => {
              try { setReport(await sm.restoreBackup(pending)); notify('Backup restaurado.'); } catch (e) { notify((e as Error).message, 'error'); }
              setPending(null);
            }}>Confirmar restauração</button>
            <button className="btn" onClick={() => setPending(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {report && <p data-testid="restore-report">Restaurado: {Object.entries(report.inserted).map(([k, n]) => `${k}: ${n}`).join(' · ')}{report.skippedDifferent ? ` · ${report.skippedDifferent} registro(s) divergente(s) mantido(s)` : ''}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Configurações
export function SettingsPanel() {
  const { state, act, notify } = useApp();
  const [s, setS] = useState<Settings>(state.settings);
  return (
    <div data-testid="settings-panel">
      <h3>Parâmetros operacionais</h3>
      <p className="muted small">Não estão no tabuleiro; valores padrão e justificativas em <code>docs/pendencias-regras.md</code>.</p>
      <label className="field">Metas diárias cumpridas para o selo do dia (1–8)
        <input type="number" min={1} max={8} value={s.medalMinGoals} data-testid="set-min" onChange={(e) => setS({ ...s, medalMinGoals: Number.parseInt(e.target.value, 10) || 1 })} />
      </label>
      <label className="field check"><input type="checkbox" checked={s.medalIncludesSpecial} data-testid="set-special" onChange={(e) => setS({ ...s, medalIncludesSpecial: e.target.checked })} /> Metas especiais também são exigidas nos dias em que aparecem</label>
      <label className="field">Sugestão de selos do dia por fase (opcional, só informativa)
        <input type="number" min={1} max={31} value={s.medalsPerPhaseHint ?? ''} placeholder="sem sugestão" onChange={(e) => setS({ ...s, medalsPerPhaseHint: e.target.value ? Number.parseInt(e.target.value, 10) : null })} />
      </label>
      <button className="btn primary" data-testid="save-settings" onClick={async () => { const r = await act(updateSettingsOp(s)); if (r.status === 'ok') notify('Parâmetros salvos.'); }}>Salvar</button>
    </div>
  );
}

function InvitePanel() {
  const { state, notify } = useApp();
  const [code, setCode] = useState('');
  return (
    <div>
      <h3>Convidar para a campanha</h3>
      <p className="muted small">Gere um código de uso único (válido por 7 dias). A conta da criança entra como "criança" (sem permissões do responsável).</p>
      <div className="row">
        <button className="btn" onClick={async () => { try { setCode(await cloud.createInvite(state.campaignId, 'child')); } catch (e) { notify((e as Error).message, 'error'); } }}>Código para criança</button>
        <button className="btn" onClick={async () => { try { setCode(await cloud.createInvite(state.campaignId, 'guardian')); } catch (e) { notify((e as Error).message, 'error'); } }}>Código para responsável</button>
      </div>
      {code && <p>Código: <code data-testid="invite-code">{code}</code></p>}
    </div>
  );
}

function PinPanel() {
  const { notify } = useApp();
  const [pin, setP] = useState('');
  return (
    <div>
      <h3>PIN do modo responsável (neste aparelho)</h3>
      <p className="muted small">Evita que a criança troque de modo sem querer. A proteção real dos dados é feita no banco de dados.</p>
      <div className="row">
        <input inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setP(e.target.value.replace(/\D/g, ''))} placeholder="4 a 6 dígitos" aria-label="Novo PIN" />
        <button className="btn" onClick={async () => { if (pin.length < 4) return notify('Use ao menos 4 dígitos.', 'error'); await setPin(pin); setP(''); notify('PIN definido.'); }}>Definir PIN</button>
        {hasPin() && <button className="btn" onClick={async () => { await setPin(null); notify('PIN removido.'); }}>Remover PIN</button>}
      </div>
    </div>
  );
}

export function DemoPanel() {
  const { sm, state, notify } = useApp();
  const today = todayStr();
  const run = (label: string, f: () => Promise<void>) => async () => { await f(); notify(label); };
  return (
    <div data-testid="demo-panel">
      <h3>Ferramentas da demonstração</h3>
      <p className="muted small">Tudo aqui é fictício e fica somente neste aparelho — nunca é enviado à campanha real.</p>
      <div className="row wrap">
        <button className="btn" data-testid="demo-day" onClick={run('Metas de hoje cumpridas (demo).', () => completeDay(sm, today))}>Cumprir metas de hoje</button>
        <button className="btn" data-testid="demo-medal" onClick={run('Selo do dia fictício concedido.', () => grantDay(sm, today))}>Conceder selo de hoje</button>
        <button className="btn" data-testid="demo-phase" onClick={run('Fase avançada.', () => advancePhases(sm, 1))}>Avançar 1 fase</button>
        <button className="btn" data-testid="demo-stage" onClick={run('Etapa concluída.', () => finishCurrentStage(sm))}>Concluir etapa atual</button>
        <button className="btn" data-testid="demo-all" onClick={run('Campanha simulada até o fim!', () => simulateCampaign(sm))}>Simular campanha completa</button>
        <button className="btn danger" data-testid="demo-reset" onClick={async () => { await resetDemo(defaultKV()); location.reload(); }}>Reiniciar demonstração</button>
      </div>
      <p className="muted small">{state.phases.length}/25 fases · {state.medals.length} selos do dia.</p>
    </div>
  );
}

export function MoreScreen() {
  const { isDemo, exit, signOut } = useApp();
  return (
    <section className="panel" data-testid="more">
      <h2>Mais opções</h2>
      <SyncPanel />
      <hr />
      <SettingsPanel />
      <hr />
      <BackupPanel />
      <hr />
      <PinPanel />
      {isDemo ? <><hr /><DemoPanel /></> : <><hr /><InvitePanel /></>}
      <hr />
      <div className="row">
        <button className="btn" onClick={exit}>Trocar de campanha / sair do reino</button>
        {signOut && <button className="btn" onClick={() => signOut()}>Sair da conta</button>}
      </div>
    </section>
  );
}
