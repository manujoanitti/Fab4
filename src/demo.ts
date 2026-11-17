import { completePhaseOp, grantMedalOp, setGoalOp } from './domain/ops';
import { RULES, TOTAL_PHASES } from './domain/rules';
import { hasMedal, nextPhase, shiftDate, todayStr } from './domain/selectors';
import { EngineBackend, EngineServer } from './sync/engineServer';
import type { KV } from './storage/kv';
import { SyncManager } from './sync/syncManager';

export const DEMO_CAMPAIGN_ID = 'demo';
const DEMO_KEY = 'demo:server';

/** Cria (ou recarrega) a campanha de demonstração: 100% local, nomes e dados fictícios. */
export async function openDemo(kv: KV): Promise<SyncManager> {
  const saved = await kv.get<ReturnType<EngineServer['toJSON']>>(DEMO_KEY);
  const server = saved ? EngineServer.fromJSON(saved) : new EngineServer(undefined, DEMO_CAMPAIGN_ID, 'Reino de Demonstração');
  const sm = new SyncManager(new EngineBackend('demo', server, 'demo-guardian', 'guardian', undefined, kv, DEMO_KEY), kv, DEMO_CAMPAIGN_ID);
  await sm.init();
  if (!saved) await seedDemo(sm);
  return sm;
}
export async function resetDemo(kv: KV) {
  for (const k of await kv.keys('demo:')) await kv.del(k);
}

export async function completeDay(sm: SyncManager, date: string) {
  for (const g of RULES.goals) await sm.act(setGoalOp(sm.getView().view!, date, g.id, 'done'));
  for (const sp of RULES.specialGoals) if (sp.weekdays.includes(new Date(date + 'T00:00:00Z').getUTCDay())) await sm.act(setGoalOp(sm.getView().view!, date, sp.id, 'done'));
  await sm.sync();
}
export async function grantDay(sm: SyncManager, date: string) {
  await completeDay(sm, date);
  if (!hasMedal(sm.getView().view!, date)) await sm.act(grantMedalOp(date));
  await sm.sync();
}
export async function seedDemo(sm: SyncManager) {
  const today = todayStr();
  for (const back of [3, 2, 1]) await grantDay(sm, shiftDate(today, -back));
  await sm.act(completePhaseOp(1));
  await sm.act(completePhaseOp(2));
  await sm.sync();
}
export async function advancePhases(sm: SyncManager, count: number) {
  for (let i = 0; i < count; i++) {
    const p = nextPhase(sm.getView().view!);
    if (!p) break;
    await sm.act(completePhaseOp(p));
  }
  await sm.sync();
}
/** Avança até concluir a etapa atual. */
export async function finishCurrentStage(sm: SyncManager) {
  const p = nextPhase(sm.getView().view!);
  if (!p) return;
  await advancePhases(sm, RULES.phasesPerStage - ((p - 1) % RULES.phasesPerStage));
}
/** Simula a campanha inteira: selos do dia, 25 fases, bônus final e créditos. */
export async function simulateCampaign(sm: SyncManager) {
  const today = todayStr();
  for (let i = 12; i >= 1; i--) await grantDay(sm, shiftDate(today, -i));
  await advancePhases(sm, TOTAL_PHASES);
}
