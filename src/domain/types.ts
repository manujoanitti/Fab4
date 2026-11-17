// Tipos centrais do domínio. O mesmo vocabulário é usado pelo motor local (engine.ts),
// pelo backend de demonstração/testes e pelo snapshot devolvido pelo Supabase (get_snapshot).

export type GoalStatus = 'pending' | 'done' | 'not_done' | 'not_evaluated';
export const GOAL_STATUSES: GoalStatus[] = ['pending', 'done', 'not_done', 'not_evaluated'];
export type Role = 'guardian' | 'child';
export type RewardSize = 'small' | 'medium' | 'large';
export type GameId = 'stars' | 'crystals' | 'garden';

export interface GoalRule {
  id: string; // g1..g8
  text: string; // redação original do tabuleiro
}
export interface SpecialGoalRule {
  id: string; // s1, s2
  text: string; // redação original
  weekdays: number[]; // 0=domingo … 6=sábado (cumprir em UM dos dias indicados)
  weekdaysLabel: string; // "terça ou quarta"
}
export interface StageRule {
  stage: number; // 1..5
  name: string; // nome da região
  coins: number;
  bigStamps: number;
  rewardSize: RewardSize;
  rewardOptions: string[];
  sourceText: string; // texto original do tabuleiro
}
export interface FinalBonusRule {
  coinsRequired: number;
  bigStampsRequired: number;
  bigStamps: number;
  rewardOptions: string[];
  sourceText: string;
}
export interface RuleSet {
  goals: GoalRule[];
  specialGoals: SpecialGoalRule[];
  stages: StageRule[];
  finalBonus: FinalBonusRule;
  phasesPerStage: number;
  howItWorks: string[];
  dailyStampRules: string[];
}

/** Parâmetros operacionais — NÃO estão no tabuleiro; são configuráveis (ver docs/pendencias-regras.md). */
export interface Settings {
  /** Mínimo de metas diárias "cumpridas" para o responsável poder conceder o selo do dia. */
  medalMinGoals: number;
  /** Se verdadeiro, metas especiais agendadas para a data entram na contagem exigida. */
  medalIncludesSpecial: boolean;
  /** Sugestão (apenas informativa) de selos do dia por fase; null = sem sugestão. */
  medalsPerPhaseHint: number | null;
}

export interface GoalReview {
  date: string; // YYYY-MM-DD
  goalId: string;
  status: GoalStatus;
  version: number;
  updatedAt: string;
  updatedBy: string;
}
export interface GoalHistory {
  opId: string;
  date: string;
  goalId: string;
  from: GoalStatus | null;
  to: GoalStatus;
  at: string;
  by: string;
}
export interface Medal {
  date: string;
  grantedAt: string;
  grantedBy: string;
}
export interface PhaseProgress {
  phase: number; // 1..25
  completedAt: string;
  completedBy: string;
}
export type RewardKind =
  | 'small_stamp'
  | 'coins'
  | 'big_stamps'
  | 'reward_unlocked'
  | 'final_bonus'
  | 'delivery';
export interface RewardEvent {
  key: string; // único por campanha
  kind: RewardKind;
  stage?: number;
  phase?: number;
  amount?: number;
  size?: RewardSize | 'final';
  ref?: string; // delivery -> key da recompensa liberada
  choice?: string; // delivery -> opção escolhida (texto livre/opção)
  note?: string;
  at: string;
  by: string;
}
export type CreditKind = 'earn_medal' | 'spend_session' | 'adjust';
export interface CreditEvent {
  key: string; // único por campanha (idempotência)
  kind: CreditKind;
  amount: number;
  reason?: string;
  at: string;
  by: string;
  pending?: boolean; // apenas no overlay otimista do cliente
}
export interface GameSession {
  id: string;
  gameId: GameId;
  startedAt: string;
  by: string;
}
export interface GameStateRow {
  gameId: GameId;
  data: unknown;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface CampaignState {
  campaignId: string;
  name: string;
  settings: Settings;
  goalReviews: GoalReview[];
  history: GoalHistory[];
  medals: Medal[];
  phases: PhaseProgress[];
  rewardEvents: RewardEvent[];
  creditEvents: CreditEvent[];
  sessions: GameSession[];
  gameStates: GameStateRow[];
}

// ----- Operações (cliente -> motor/servidor). Cada uma carrega opId para idempotência. -----
interface OpBase {
  opId: string;
  at: string; // horário informado pelo cliente (apenas informativo)
}
export type Op = OpBase &
  (
    | { type: 'set_goal'; date: string; goalId: string; status: GoalStatus; expectedVersion: number }
    | { type: 'grant_medal'; date: string }
    | { type: 'complete_phase'; phase: number }
    | { type: 'deliver_reward'; ref: string; choice: string; note?: string }
    | { type: 'adjust_credits'; amount: number; reason: string }
    | { type: 'start_session'; sessionId: string; gameId: GameId }
    | { type: 'save_game_state'; gameId: GameId; data: unknown; expectedVersion: number }
    | { type: 'update_settings'; settings: Settings }
  );
export type OpType = Op['type'];

export const GUARDIAN_ONLY: OpType[] = [
  'set_goal',
  'grant_medal',
  'complete_phase',
  'deliver_reward',
  'adjust_credits',
  'update_settings',
];

export type RejectCode =
  | 'forbidden'
  | 'invalid'
  | 'not_eligible'
  | 'out_of_order'
  | 'already_done'
  | 'insufficient_credits'
  | 'game_locked'
  | 'unknown_reward';

export type OpOutcome =
  | { status: 'ok'; duplicate?: boolean; info?: string }
  | { status: 'rejected'; code: RejectCode; message: string }
  | { status: 'conflict'; entity: 'goal' | 'game'; serverVersion: number; serverValue: unknown };
