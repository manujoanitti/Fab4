import { applyOp, type Ctx } from '../../src/domain/engine';
import { emptyState } from '../../src/domain/selectors';
import type { CampaignState, Op, OpOutcome } from '../../src/domain/types';

let n = 0;
export const uid = () => `op-${++n}`;
export const G: Ctx = { role: 'guardian', userId: 'guardian-1', now: '2026-03-02T10:00:00Z' };
export const C: Ctx = { role: 'child', userId: 'child-1', now: '2026-03-02T10:00:00Z' };

type OpInput = Op extends infer T ? (T extends Op ? Omit<T, 'opId' | 'at'> & { opId?: string } : never) : never;
export function run(s: CampaignState, op: OpInput, ctx: Ctx = G): { s: CampaignState; o: OpOutcome } {
  const full = { opId: uid(), at: ctx.now, ...op } as Op;
  const r = applyOp(s, full, ctx);
  return { s: r.state, o: r.outcome };
}
export const fresh = () => emptyState('camp-1', 'Campanha Fictícia');
export const GOALS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'];

export function allDone(s: CampaignState, date: string): CampaignState {
  for (const g of GOALS) s = run(s, { type: 'set_goal', date, goalId: g, status: 'done', expectedVersion: 0 }).s;
  return s;
}
export function completeUpTo(s: CampaignState, last: number): CampaignState {
  for (let p = 1; p <= last; p++) s = run(s, { type: 'complete_phase', phase: p }).s;
  return s;
}
export function giveCredits(s: CampaignState, n: number): CampaignState {
  return run(s, { type: 'adjust_credits', amount: n, reason: 'teste' }).s;
}
