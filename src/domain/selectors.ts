import { DEFAULT_SETTINGS, GAMES, RULES, TOTAL_PHASES } from './rules';
import type { CampaignState, GameId, GoalReview, GoalStatus, RewardEvent, SpecialGoalRule } from './types';

export const isDateStr = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

export const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay();
const addDays = (date: string, n: number) => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Segunda-feira da semana que contém a data. */
export const weekStart = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));
export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const shiftDate = addDays;

export function emptyState(campaignId: string, name: string): CampaignState {
  return {
    campaignId,
    name,
    settings: { ...DEFAULT_SETTINGS },
    goalReviews: [],
    history: [],
    medals: [],
    phases: [],
    rewardEvents: [],
    creditEvents: [],
    sessions: [],
    gameStates: [],
  };
}

export const findReview = (s: CampaignState, date: string, goalId: string): GoalReview | undefined =>
  s.goalReviews.find((r) => r.date === date && r.goalId === goalId);
export const goalStatus = (s: CampaignState, date: string, goalId: string): GoalStatus =>
  findReview(s, date, goalId)?.status ?? 'pending';

/** Metas especiais agendadas para a data (cumprir em UM dos dias indicados na semana). */
export function specialGoalsOn(s: CampaignState, date: string): { rule: SpecialGoalRule; doneThisWeek: boolean; doneOn?: string }[] {
  const wd = weekdayOf(date);
  const ws = weekStart(date);
  return RULES.specialGoals
    .filter((g) => g.weekdays.includes(wd))
    .map((rule) => {
      const done = s.goalReviews.find(
        (r) => r.goalId === rule.id && r.status === 'done' && r.date >= ws && r.date <= addDays(ws, 6),
      );
      return { rule, doneThisWeek: !!done, doneOn: done?.date };
    });
}

export function dayProgress(s: CampaignState, date: string) {
  const done = RULES.goals.filter((g) => goalStatus(s, date, g.id) === 'done').length;
  const specials = specialGoalsOn(s, date);
  const specialDone = specials.filter((x) => x.doneThisWeek).length;
  const include = s.settings.medalIncludesSpecial;
  const required = s.settings.medalMinGoals + (include ? specials.length : 0);
  const count = done + (include ? specialDone : 0);
  return { done, total: RULES.goals.length, specials, specialDone, required, count, eligible: count >= required };
}
export const hasMedal = (s: CampaignState, date: string) => s.medals.some((m) => m.date === date);

// ---- Progressão ----
export const phaseDone = (s: CampaignState, phase: number) => s.phases.some((p) => p.phase === phase);
export const completedPhases = (s: CampaignState) => s.phases.length;
export const nextPhase = (s: CampaignState): number | null => {
  for (let p = 1; p <= TOTAL_PHASES; p++) if (!phaseDone(s, p)) return p;
  return null;
};
export const stageCompleted = (s: CampaignState, stage: number) => {
  const n = RULES.phasesPerStage;
  for (let p = (stage - 1) * n + 1; p <= stage * n; p++) if (!phaseDone(s, p)) return false;
  return true;
};
export const completedStages = (s: CampaignState) => RULES.stages.filter((st) => stageCompleted(s, st.stage)).length;
/** Etapa 1 sempre liberada; etapa N libera quando N-1 estiver concluída. */
export const stageUnlocked = (s: CampaignState, stage: number) => stage === 1 || stageCompleted(s, stage - 1);
export const campaignComplete = (s: CampaignState) => completedPhases(s) === TOTAL_PHASES;

// ---- Totais de recompensas ----
const sum = (evs: RewardEvent[]) => evs.reduce((a, e) => a + (e.amount ?? 0), 0);
export function totals(s: CampaignState) {
  const ev = s.rewardEvents;
  const smallStamps = sum(ev.filter((e) => e.kind === 'small_stamp'));
  const coins = sum(ev.filter((e) => e.kind === 'coins'));
  const bigStamps = sum(ev.filter((e) => e.kind === 'big_stamps' || e.kind === 'final_bonus'));
  return { smallStamps, coins, bigStamps, dailyStamps: s.medals.length };
}
export const rewardsUnlocked = (s: CampaignState) => s.rewardEvents.filter((e) => e.kind === 'reward_unlocked');
export const deliveryFor = (s: CampaignState, ref: string) =>
  s.rewardEvents.find((e) => e.kind === 'delivery' && e.ref === ref);
export const pendingDeliveries = (s: CampaignState) => rewardsUnlocked(s).filter((e) => !deliveryFor(s, e.key));

// ---- Créditos de minigame ----
/** Saldo utilizável: créditos ganhos só contam quando confirmados pelo servidor (não pendentes). */
export const creditBalance = (s: CampaignState) =>
  s.creditEvents.reduce((a, e) => (e.pending && e.amount > 0 ? a : a + e.amount), 0);
export const creditBalanceProjected = (s: CampaignState) => s.creditEvents.reduce((a, e) => a + e.amount, 0);
export const pendingCredits = (s: CampaignState) =>
  s.creditEvents.filter((e) => e.pending && e.amount > 0).reduce((a, e) => a + e.amount, 0);
export const gameUnlocked = (s: CampaignState, id: GameId) => {
  const g = GAMES.find((x) => x.id === id);
  return !!g && (g.unlockStage === null || stageCompleted(s, g.unlockStage));
};
export const gameState = (s: CampaignState, id: GameId) => s.gameStates.find((g) => g.gameId === id);

/** Selos do dia concedidos desde a última fase concluída (apenas sugestão informativa). */
export function medalsSinceLastPhase(s: CampaignState): number {
  const last = s.phases.reduce((a, p) => (p.completedAt > a ? p.completedAt : a), '');
  return s.medals.filter((m) => m.grantedAt > last).length;
}
