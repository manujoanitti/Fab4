import { describe, expect, it } from 'vitest';
import { applyOp as engineApply } from '../../src/domain/engine';
import { emptyState, findReview, gameState } from '../../src/domain/selectors';
import type { CampaignState, Op, Role } from '../../src/domain/types';
import { addUser, applyOp, as, newCampaign, newDb, snapshot } from './harness';

// Normaliza um snapshot removendo campos que dependem de relógio/identidade e ordenando listas.
const TIME_KEYS = new Set(['at', 'by', 'grantedAt', 'grantedBy', 'updatedAt', 'updatedBy', 'completedAt', 'completedBy', 'startedAt', 'role', 'campaignId', 'message']);
function norm(v: any): any {
  if (Array.isArray(v)) return v.map(norm).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v).sort()) if (!TIME_KEYS.has(k) && v[k] !== undefined) o[k] = norm(v[k]);
    return o;
  }
  return v;
}
const view = (s: any) => norm(JSON.parse(JSON.stringify({ ...s, history: s.history.map((h: any) => ({ ...h, opId: undefined })) })));
const outcomeKey = (o: any) => JSON.stringify([o.status, o.code, o.duplicate ?? false, o.entity, o.serverVersion]);

function prng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('paridade motor TypeScript × funções SQL', () => {
  it('sequência aleatória (semente fixa) produz estados e resultados idênticos', async () => {
    const db = await newDb();
    const guardian = await addUser(db, 'responsavel@example.test');
    const child = await addUser(db, 'crianca@example.test');
    const camp = await as(db, guardian, () => newCampaign(db, 'Campanha Fictícia'));
    const code = await as(db, guardian, async () => (await db.query<any>(`select public.create_invite($1::uuid,'child') as r`, [camp])).rows[0].r);
    await as(db, child, () => db.query(`select public.redeem_invite($1)`, [code]));

    let st: CampaignState = emptyState(camp, 'Campanha Fictícia');
    const rnd = prng(20260302);
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const dates = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-06', '2026-03-07', '2026-03-09'];
    const goals = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 's1', 's2'];
    const refs = ['reward:stage:1', 'reward:stage:2', 'reward:stage:3', 'reward:stage:4', 'reward:stage:5', 'reward:final', 'reward:bogus'];
    let n = 0;
    const stats: Record<string, number> = {};
    for (let i = 0; i < 1400; i++) {
      const role: Role = rnd() < 0.15 ? 'child' : 'guardian';
      const r = rnd();
      let body: any;
      if (r < 0.34) {
        const date = pick(dates), goalId = pick(goals);
        const ver = findReview(st, date, goalId)?.version ?? 0;
        body = { type: 'set_goal', date, goalId, status: rnd() < 0.8 ? 'done' : pick(['pending', 'not_done', 'not_evaluated']), expectedVersion: rnd() < 0.85 ? ver : ver + 1 };
      } else if (r < 0.46) body = { type: 'grant_medal', date: pick(dates) };
      else if (r < 0.62) {
        const nextP = st.phases.length + 1;
        body = { type: 'complete_phase', phase: rnd() < 0.85 ? nextP : pick([0, 1, nextP + 1, 26, 12]) };
      } else if (r < 0.7) body = { type: 'deliver_reward', ref: pick(refs), choice: rnd() < 0.9 ? 'opção' : '  ' };
      else if (r < 0.78) body = { type: 'adjust_credits', amount: pick([-3, -1, 0, 1, 2, 5]), reason: rnd() < 0.9 ? 'motivo' : '' };
      else if (r < 0.9) body = { type: 'start_session', sessionId: `sess-${n}`, gameId: pick(['stars', 'crystals', 'garden']) };
      else if (r < 0.96) {
        const ver = gameState(st, 'garden')?.version ?? 0;
        body = { type: 'save_game_state', gameId: 'garden', data: { items: [{ id: n, kind: 'flower' }] }, expectedVersion: rnd() < 0.8 ? ver : ver + 2 };
      } else body = { type: 'update_settings', settings: { medalMinGoals: pick([0, 1, 7, 8, 9]), medalIncludesSpecial: rnd() < 0.5, medalsPerPhaseHint: pick([null, 3, 0]) } };

      const op = { opId: `fz-${++n}`, at: '2026-03-02T10:00:00Z', ...body } as Op;
      const eng = engineApply(st, op, { role, userId: 'u', now: '2026-03-02T10:00:00Z' });
      const sql = await as(db, role === 'guardian' ? guardian : child, () => applyOp(db, camp, op));
      expect(outcomeKey(sql), `op #${i} ${JSON.stringify(body)}`).toBe(outcomeKey(eng.outcome));
      st = eng.state;
      stats[body.type + ':' + sql.status] = (stats[body.type + ':' + sql.status] ?? 0) + 1;
      if (i % 100 === 99 || i === 1399) {
        const snap = await as(db, guardian, () => snapshot(db, camp));
        expect(view(snap), `estado após op #${i}`).toEqual(view(st));
      }
    }
    // O cenário precisa ter exercitado o jogo de verdade (progressão completa, medalhas, conflitos…).
    expect(st.phases.length).toBe(25);
    expect(st.medals.length).toBeGreaterThan(2);
    expect(stats['set_goal:conflict']).toBeGreaterThan(0);
    expect(stats['grant_medal:rejected']).toBeGreaterThan(0);
    expect(stats['start_session:ok']).toBeGreaterThan(0);
    expect(st.rewardEvents.some((e) => e.kind === 'final_bonus')).toBe(true);
  }, 120000);
});
