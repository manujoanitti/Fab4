import { useState } from 'react';
import { completePhaseOp } from '../domain/ops';
import { RULES, TOTAL_PHASES, phaseLabel, stageOfPhase } from '../domain/rules';
import {
  campaignComplete, creditBalance, dayProgress, deliveryFor, goalStatus, hasMedal, nextPhase, pendingCredits,
  phaseDone, rewardsUnlocked, shiftDate, specialGoalsOn, stageCompleted, todayStr, totals,
} from '../domain/selectors';
import { useApp } from './ctx';
import { SIZE_LABEL, STATUS_META, fmtDate, fmtDateTime } from './format';
import MapView from './MapView';

export function Stats() {
  const { state } = useApp();
  const t = totals(state);
  const bal = creditBalance(state), pend = pendingCredits(state);
  return (
    <div className="stats" data-testid="stats">
      <span title="Selos pequenos (1 por fase)">⭐ <b data-testid="stat-small">{t.smallStamps}</b>/{TOTAL_PHASES}</span>
      <span title="Moedas">🪙 <b data-testid="stat-coins">{t.coins}</b>/{RULES.finalBonus.coinsRequired}</span>
      <span title="Selos grandes">🏅 <b data-testid="stat-big">{t.bigStamps}</b>/{RULES.finalBonus.bigStampsRequired}</span>
      <span title="Selos do dia">🌟 <b data-testid="stat-daily">{t.dailyStamps}</b></span>
      <span title="Créditos de minigame">🎮 <b data-testid="stat-credits">{bal}</b>{pend ? <small> (+{pend} a confirmar)</small> : null}</span>
    </div>
  );
}

function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} data-testid="sheet">
        <button className="sheet-close" onClick={onClose} aria-label="Fechar">×</button>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function PhaseSheet({ phase, onClose }: { phase: number; onClose: () => void }) {
  const { state, guardianMode, act, notify } = useApp();
  const [confirming, setConfirming] = useState(false);
  const stage = RULES.stages[stageOfPhase(phase) - 1];
  const done = state.phases.find((p) => p.phase === phase);
  const isNext = nextPhase(state) === phase;
  const endOfStage = phase % RULES.phasesPerStage === 0;
  return (
    <Sheet onClose={onClose} title={`Fase ${phaseLabel(phase)} — ${stage.name}`}>
      {done ? (
        <p>✅ Concluída em {fmtDateTime(done.completedAt)}. Ganhou 1 selo pequeno ⭐.</p>
      ) : isNext ? (
        <p>✨ Esta é a próxima fase da Bianca!</p>
      ) : (
        <p>🔒 Conclua as fases anteriores para chegar aqui.</p>
      )}
      {endOfStage && (
        <div className="callout">
          <b>Ao finalizar a etapa {stage.stage}:</b>
          <div>{stage.sourceText}</div>
          {done && <div>Recompensa {SIZE_LABEL[stage.rewardSize]} liberada 🎁</div>}
        </div>
      )}
      {isNext && guardianMode && (
        confirming ? (
          <div className="row">
            <button className="btn primary" data-testid="confirm-phase" onClick={async () => {
              const r = await act(completePhaseOp(phase));
              if (r.status === 'ok') { notify(`Fase ${phaseLabel(phase)} concluída!`); onClose(); }
            }}>Sim, confirmar</button>
            <button className="btn" onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        ) : (
          <button className="btn primary" data-testid="complete-phase" onClick={() => setConfirming(true)}>Confirmar fase concluída</button>
        )
      )}
      {isNext && !guardianMode && <p className="muted">Quem confirma a fase é o responsável 💜</p>}
    </Sheet>
  );
}

function BonusSheet({ onClose }: { onClose: () => void }) {
  const { state } = useApp();
  const t = totals(state);
  const got = campaignComplete(state);
  return (
    <Sheet onClose={onClose} title="Bônus final 👑">
      <p>{RULES.finalBonus.sourceText}</p>
      <p>Moedas: <b>{t.coins}/{RULES.finalBonus.coinsRequired}</b> · Selos grandes: <b>{t.bigStamps}/{RULES.finalBonus.bigStampsRequired}</b></p>
      <p>{got ? '🎉 Bônus conquistado! +1 selo grande e uma recompensa grande extra.' : 'Continue a trilha para conquistar o bônus!'}</p>
    </Sheet>
  );
}

export function MapScreen() {
  const { state } = useApp();
  const [phase, setPhase] = useState<number | null>(null);
  const [bonus, setBonus] = useState(false);
  return (
    <>
      <MapView state={state} onSelect={setPhase} onBonus={() => setBonus(true)} />
      {phase && <PhaseSheet phase={phase} onClose={() => setPhase(null)} />}
      {bonus && <BonusSheet onClose={() => setBonus(false)} />}
    </>
  );
}

export function GoalsScreen() {
  const { state } = useApp();
  const date = todayStr();
  const p = dayProgress(state, date);
  const specials = specialGoalsOn(state, date);
  return (
    <section className="panel" data-testid="goals-child">
      <h2>Metas de hoje · {fmtDate(date)}</h2>
      <ul className="goal-list">
        {RULES.goals.map((g) => {
          const st = goalStatus(state, date, g.id);
          return (
            <li key={g.id} className={`goal ${st}`} data-testid={`child-goal-${g.id}`} data-status={st}>
              <span className="goal-icon" aria-label={STATUS_META[st].label}>{STATUS_META[st].icon}</span>
              <span>{g.text}</span>
            </li>
          );
        })}
        {specials.map(({ rule, doneThisWeek, doneOn }) => {
          const st = goalStatus(state, date, rule.id);
          return (
            <li key={rule.id} className={`goal special ${st}`} data-testid={`child-goal-${rule.id}`}>
              <span className="goal-icon">{doneThisWeek ? '✅' : '💖'}</span>
              <span><b>Meta especial ({rule.weekdaysLabel}):</b> {rule.text}{doneThisWeek && doneOn !== date ? ` (já cumprida em ${fmtDate(doneOn!)})` : ''}</span>
            </li>
          );
        })}
      </ul>
      <div className={`day-stamp ${hasMedal(state, date) ? 'got' : ''}`} data-testid="child-day-stamp">
        {hasMedal(state, date) ? '🌟 Você ganhou o selo do dia!' : `🌙 ${p.done} de ${RULES.goals.length} metas cumpridas até agora`}
      </div>
      <p className="muted">{RULES.dailyStampRules.join(' ')}</p>
    </section>
  );
}

export function AchievementsScreen() {
  const { state } = useApp();
  const t = totals(state);
  const today = todayStr();
  const days = Array.from({ length: 28 }, (_, i) => shiftDate(today, i - 27));
  return (
    <section className="panel" data-testid="achievements">
      <h2>Minhas conquistas</h2>
      <h3>Selos pequenos ({t.smallStamps}/{TOTAL_PHASES})</h3>
      <div className="stamp-grid">
        {Array.from({ length: TOTAL_PHASES }, (_, i) => i + 1).map((p) => (
          <span key={p} className={`stamp ${phaseDone(state, p) ? 'on' : ''}`} title={phaseLabel(p)}>{phaseDone(state, p) ? '⭐' : phaseLabel(p)}</span>
        ))}
      </div>
      <h3>Etapas</h3>
      <ul className="stage-list">
        {RULES.stages.map((s) => (
          <li key={s.stage} className={stageCompleted(state, s.stage) ? 'on' : ''}>
            <b>{s.name}</b> — {s.coins} 🪙 · {s.bigStamps} 🏅 · recompensa {SIZE_LABEL[s.rewardSize]} {stageCompleted(state, s.stage) ? '✅' : '🔒'}
          </li>
        ))}
      </ul>
      <p>🪙 Moedas: <b>{t.coins}/{RULES.finalBonus.coinsRequired}</b> · 🏅 Selos grandes: <b>{t.bigStamps}</b> · 🌟 Selos do dia: <b>{t.dailyStamps}</b></p>
      <h3>Selos dos últimos 28 dias</h3>
      <div className="cal">
        {days.map((d) => <span key={d} className={`day ${hasMedal(state, d) ? 'on' : ''} ${d === today ? 'today' : ''}`} title={fmtDate(d)}>{hasMedal(state, d) ? '🌟' : d.slice(8)}</span>)}
      </div>
      <h3>Recompensas</h3>
      <ul className="reward-list">
        {rewardsUnlocked(state).length === 0 && <li className="muted">Complete uma etapa para liberar a primeira recompensa.</li>}
        {rewardsUnlocked(state).map((r) => {
          const d = deliveryFor(state, r.key);
          return (
            <li key={r.key}>
              🎁 {r.stage ? `Etapa ${r.stage}` : 'Bônus final'} — recompensa {SIZE_LABEL[r.size ?? 'small']}: {d ? <b>recebida ({d.choice}) 🎉</b> : <i>aguardando escolha com o responsável</i>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
