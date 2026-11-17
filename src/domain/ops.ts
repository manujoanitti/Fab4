import { findReview, gameState } from './selectors';
import type { CampaignState, GameId, GoalStatus, Op, Settings } from './types';

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type OpInput = DistributiveOmit<Op, 'opId' | 'at'>;

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// Construtores de operação: usam a versão visível (servidor + pendentes) como expectedVersion.
export const setGoalOp = (v: CampaignState, date: string, goalId: string, status: GoalStatus): OpInput => ({
  type: 'set_goal', date, goalId, status, expectedVersion: findReview(v, date, goalId)?.version ?? 0,
});
export const saveGameStateOp = (v: CampaignState, gameId: GameId, data: unknown): OpInput => ({
  type: 'save_game_state', gameId, data, expectedVersion: gameState(v, gameId)?.version ?? 0,
});
export const grantMedalOp = (date: string): OpInput => ({ type: 'grant_medal', date });
export const completePhaseOp = (phase: number): OpInput => ({ type: 'complete_phase', phase });
export const startSessionOp = (gameId: GameId): OpInput => ({ type: 'start_session', gameId, sessionId: newId() });
export const adjustCreditsOp = (amount: number, reason: string): OpInput => ({ type: 'adjust_credits', amount, reason });
export const deliverRewardOp = (ref: string, choice: string, note?: string): OpInput => ({ type: 'deliver_reward', ref, choice, note });
export const updateSettingsOp = (settings: Settings): OpInput => ({ type: 'update_settings', settings });
