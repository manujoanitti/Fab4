import { GAMES, RULES, TOTAL_PHASES } from './rules';
import {
  creditBalance,
  dayProgress,
  deliveryFor,
  findReview,
  gameUnlocked,
  isDateStr,
  phaseDone,
  totals,
} from './selectors';
import {
  GOAL_STATUSES,
  GUARDIAN_ONLY,
  type CampaignState,
  type GameId,
  type Op,
  type OpOutcome,
  type Role,
  type RewardEvent,
} from './types';

export interface Ctx {
  role: Role;
  userId: string;
  now: string; // ISO
  /** Overlay otimista: créditos ganhos ficam "pendentes" até o servidor confirmar. */
  optimistic?: boolean;
}
export interface EngineResult {
  outcome: OpOutcome;
  state: CampaignState;
}

const rej = (code: Extract<OpOutcome, { status: 'rejected' }>['code'], message: string): OpOutcome => ({
  status: 'rejected',
  code,
  message,
});
const MAX_STATE_BYTES = 64 * 1024;

/**
 * Motor determinístico: espelha as regras de apply_op() no PostgreSQL
 * (supabase/migrations/0003_functions.sql). Usado no modo demonstração, nos testes
 * e no overlay otimista de alterações pendentes.
 */
export function applyOp(state: CampaignState, op: Op, ctx: Ctx): EngineResult {
  const no = (outcome: OpOutcome): EngineResult => ({ outcome, state });
  if (GUARDIAN_ONLY.includes(op.type) && ctx.role !== 'guardian')
    return no(rej('forbidden', 'Somente o responsável pode realizar esta ação.'));
  const s: CampaignState = structuredClone(state);
  const { now, userId } = ctx;
  const ok = (info?: string, duplicate?: boolean): EngineResult => ({ outcome: { status: 'ok', info, duplicate }, state: s });
  const dup = (info: string) => ok(info, true);

  switch (op.type) {
    case 'set_goal': {
      const known = [...RULES.goals, ...RULES.specialGoals].some((g) => g.id === op.goalId);
      if (!isDateStr(op.date) || !known || !GOAL_STATUSES.includes(op.status) || !Number.isInteger(op.expectedVersion))
        return no(rej('invalid', 'Dados da meta inválidos.'));
      const cur = findReview(s, op.date, op.goalId);
      if (cur && cur.status === op.status) return dup('same_value');
      const curVersion = cur?.version ?? 0;
      if (op.expectedVersion !== curVersion)
        return no({ status: 'conflict', entity: 'goal', serverVersion: curVersion, serverValue: cur ?? null });
      s.history.push({ opId: op.opId, date: op.date, goalId: op.goalId, from: cur?.status ?? null, to: op.status, at: now, by: userId });
      if (cur) Object.assign(cur, { status: op.status, version: curVersion + 1, updatedAt: now, updatedBy: userId });
      else s.goalReviews.push({ date: op.date, goalId: op.goalId, status: op.status, version: 1, updatedAt: now, updatedBy: userId });
      return ok();
    }

    case 'grant_medal': {
      if (!isDateStr(op.date)) return no(rej('invalid', 'Data inválida.'));
      if (s.medals.some((m) => m.date === op.date)) return dup('already_granted');
      const p = dayProgress(s, op.date);
      if (!p.eligible)
        return no(rej('not_eligible', `Faltam metas cumpridas: ${p.count} de ${p.required} exigidas para o selo do dia.`));
      s.medals.push({ date: op.date, grantedAt: now, grantedBy: userId });
      s.creditEvents.push({
        key: `medal:${op.date}`,
        kind: 'earn_medal',
        amount: 1,
        at: now,
        by: userId,
        ...(ctx.optimistic ? { pending: true } : {}),
      });
      return ok();
    }

    case 'complete_phase': {
      if (!Number.isInteger(op.phase) || op.phase < 1 || op.phase > TOTAL_PHASES) return no(rej('invalid', 'Fase inválida.'));
      if (phaseDone(s, op.phase)) return dup('already_done');
      if (op.phase > 1 && !phaseDone(s, op.phase - 1))
        return no(rej('out_of_order', 'Conclua a fase anterior antes desta.'));
      s.phases.push({ phase: op.phase, completedAt: now, completedBy: userId });
      const ev = (e: Omit<RewardEvent, 'at' | 'by'>) => s.rewardEvents.push({ ...e, at: now, by: userId });
      ev({ key: `phase:${op.phase}:stamp`, kind: 'small_stamp', phase: op.phase, amount: 1 });
      if (op.phase % RULES.phasesPerStage === 0) {
        const st = RULES.stages[op.phase / RULES.phasesPerStage - 1];
        ev({ key: `stage:${st.stage}:coins`, kind: 'coins', stage: st.stage, amount: st.coins });
        ev({ key: `stage:${st.stage}:big`, kind: 'big_stamps', stage: st.stage, amount: st.bigStamps });
        ev({ key: `reward:stage:${st.stage}`, kind: 'reward_unlocked', stage: st.stage, size: st.rewardSize });
        const t = totals(s);
        if (t.coins >= RULES.finalBonus.coinsRequired && t.bigStamps >= RULES.finalBonus.bigStampsRequired) {
          ev({ key: 'final:bonus', kind: 'final_bonus', amount: RULES.finalBonus.bigStamps });
          ev({ key: 'reward:final', kind: 'reward_unlocked', size: 'final' });
        }
      }
      return ok();
    }

    case 'deliver_reward': {
      const unlocked = s.rewardEvents.find((e) => e.kind === 'reward_unlocked' && e.key === op.ref);
      if (!unlocked) return no(rej('unknown_reward', 'Recompensa ainda não liberada.'));
      if (typeof op.choice !== 'string' || !op.choice.trim() || op.choice.length > 200)
        return no(rej('invalid', 'Informe a recompensa recebida.'));
      if (deliveryFor(s, op.ref)) return dup('already_delivered');
      s.rewardEvents.push({
        key: `delivery:${op.ref}`,
        kind: 'delivery',
        stage: unlocked.stage,
        size: unlocked.size,
        ref: op.ref,
        choice: op.choice.trim(),
        note: op.note?.slice(0, 300),
        at: now,
        by: userId,
      });
      return ok();
    }

    case 'adjust_credits': {
      if (!Number.isInteger(op.amount) || op.amount === 0 || Math.abs(op.amount) > 100 || !op.reason?.trim())
        return no(rej('invalid', 'Informe quantidade (inteiro) e motivo.'));
      const key = `adjust:${op.opId}`;
      if (s.creditEvents.some((c) => c.key === key)) return dup('already_applied');
      if (op.amount < 0 && creditBalance(s) + op.amount < 0) return no(rej('insufficient_credits', 'Saldo insuficiente para o ajuste.'));
      s.creditEvents.push({ key, kind: 'adjust', amount: op.amount, reason: op.reason.trim().slice(0, 200), at: now, by: userId });
      return ok();
    }

    case 'start_session': {
      if (!GAMES.some((g) => g.id === op.gameId) || !op.sessionId) return no(rej('invalid', 'Jogo inválido.'));
      if (s.sessions.some((x) => x.id === op.sessionId)) return dup('already_started');
      if (!gameUnlocked(s, op.gameId)) return no(rej('game_locked', 'Este jogo ainda não foi desbloqueado.'));
      if (creditBalance(s) < 1) return no(rej('insufficient_credits', 'Sem créditos de minigame.'));
      s.sessions.push({ id: op.sessionId, gameId: op.gameId, startedAt: now, by: userId });
      s.creditEvents.push({ key: `session:${op.sessionId}`, kind: 'spend_session', amount: -1, at: now, by: userId });
      return ok();
    }

    case 'save_game_state': {
      if (op.gameId !== 'garden') return no(rej('invalid', 'Jogo sem estado persistente.'));
      if (!gameUnlocked(s, op.gameId as GameId)) return no(rej('game_locked', 'Este jogo ainda não foi desbloqueado.'));
      if (!Number.isInteger(op.expectedVersion) || JSON.stringify(op.data ?? null).length > MAX_STATE_BYTES)
        return no(rej('invalid', 'Estado inválido ou grande demais.'));
      const cur = s.gameStates.find((g) => g.gameId === op.gameId);
      if (cur && JSON.stringify(cur.data) === JSON.stringify(op.data)) return dup('same_value');
      const v = cur?.version ?? 0;
      if (op.expectedVersion !== v) return no({ status: 'conflict', entity: 'game', serverVersion: v, serverValue: cur ?? null });
      if (cur) Object.assign(cur, { data: op.data, version: v + 1, updatedAt: now, updatedBy: userId });
      else s.gameStates.push({ gameId: op.gameId, data: op.data, version: 1, updatedAt: now, updatedBy: userId });
      return ok();
    }

    case 'update_settings': {
      const x = op.settings;
      const valid =
        x &&
        Number.isInteger(x.medalMinGoals) && x.medalMinGoals >= 1 && x.medalMinGoals <= RULES.goals.length &&
        typeof x.medalIncludesSpecial === 'boolean' &&
        (x.medalsPerPhaseHint === null || (Number.isInteger(x.medalsPerPhaseHint) && x.medalsPerPhaseHint >= 1 && x.medalsPerPhaseHint <= 31));
      if (!valid) return no(rej('invalid', 'Parâmetros inválidos.'));
      s.settings = { medalMinGoals: x.medalMinGoals, medalIncludesSpecial: x.medalIncludesSpecial, medalsPerPhaseHint: x.medalsPerPhaseHint };
      return ok();
    }
  }
  return no(rej('invalid', 'Operação desconhecida.'));
}

