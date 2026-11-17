import { describe, expect, it } from 'vitest';
import {
  campaignComplete, creditBalance, dayProgress, gameUnlocked, goalStatus, nextPhase, pendingDeliveries,
  specialGoalsOn, stageUnlocked, totals,
} from '../../src/domain/selectors';
import { C, G, allDone, completeUpTo, fresh, giveCredits, run } from './helpers';

const D = '2026-03-02'; // segunda-feira

describe('metas diárias', () => {
  it('meta sem registro é pendente; "não avaliada" não é "não cumprida"', () => {
    let s = fresh();
    expect(goalStatus(s, D, 'g1')).toBe('pending');
    s = run(s, { type: 'set_goal', date: D, goalId: 'g1', status: 'not_evaluated', expectedVersion: 0 }).s;
    expect(goalStatus(s, D, 'g1')).toBe('not_evaluated');
    expect(dayProgress(s, D).done).toBe(0);
  });
  it.each(['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 's1', 's2'])('aceita registrar a meta %s', (g) => {
    const r = run(fresh(), { type: 'set_goal', date: D, goalId: g, status: 'done', expectedVersion: 0 });
    expect(r.o.status).toBe('ok');
  });
  it('rejeita meta desconhecida, data e status inválidos', () => {
    expect(run(fresh(), { type: 'set_goal', date: D, goalId: 'g9', status: 'done', expectedVersion: 0 }).o.status).toBe('rejected');
    expect(run(fresh(), { type: 'set_goal', date: '02/03/2026', goalId: 'g1', status: 'done', expectedVersion: 0 }).o.status).toBe('rejected');
    expect(run(fresh(), { type: 'set_goal', date: D, goalId: 'g1', status: 'xx' as never, expectedVersion: 0 }).o.status).toBe('rejected');
  });
  it('correção gera histórico e incrementa versão', () => {
    let s = run(fresh(), { type: 'set_goal', date: D, goalId: 'g1', status: 'done', expectedVersion: 0 }).s;
    s = run(s, { type: 'set_goal', date: D, goalId: 'g1', status: 'not_done', expectedVersion: 1 }).s;
    expect(s.goalReviews[0].version).toBe(2);
    expect(s.history.map((h) => [h.from, h.to])).toEqual([[null, 'done'], ['done', 'not_done']]);
  });
  it('versão desatualizada gera conflito (não sobrescreve)', () => {
    let s = run(fresh(), { type: 'set_goal', date: D, goalId: 'g1', status: 'done', expectedVersion: 0 }).s;
    const r = run(s, { type: 'set_goal', date: D, goalId: 'g1', status: 'not_done', expectedVersion: 0 });
    expect(r.o.status).toBe('conflict');
    expect(goalStatus(r.s, D, 'g1')).toBe('done');
  });
  it('mesmo valor vindo de outro aparelho é idempotente (sem conflito)', () => {
    const s = run(fresh(), { type: 'set_goal', date: D, goalId: 'g1', status: 'done', expectedVersion: 0 }).s;
    const r = run(s, { type: 'set_goal', date: D, goalId: 'g1', status: 'done', expectedVersion: 0 });
    expect(r.o).toMatchObject({ status: 'ok', duplicate: true });
  });
  it('criança não registra metas (autorização)', () => {
    const r = run(fresh(), { type: 'set_goal', date: D, goalId: 'g1', status: 'done', expectedVersion: 0 }, C);
    expect(r.o).toMatchObject({ status: 'rejected', code: 'forbidden' });
  });
});

describe('metas especiais da semana', () => {
  it('aparecem apenas nos dias correspondentes e valem uma vez por semana', () => {
    let s = fresh();
    expect(specialGoalsOn(s, '2026-03-02')).toHaveLength(0); // segunda
    expect(specialGoalsOn(s, '2026-03-03').map((x) => x.rule.id)).toEqual(['s1']); // terça
    expect(specialGoalsOn(s, '2026-03-04').map((x) => x.rule.id)).toEqual(['s1']); // quarta
    expect(specialGoalsOn(s, '2026-03-06').map((x) => x.rule.id)).toEqual(['s2']); // sexta
    expect(specialGoalsOn(s, '2026-03-07').map((x) => x.rule.id)).toEqual(['s2']); // sábado
    s = run(s, { type: 'set_goal', date: '2026-03-03', goalId: 's1', status: 'done', expectedVersion: 0 }).s;
    expect(specialGoalsOn(s, '2026-03-04')[0].doneThisWeek).toBe(true);
    expect(specialGoalsOn(fresh(), '2026-03-10')[0].doneThisWeek).toBe(false);
  });
});

describe('selo do dia (medalha diária)', () => {
  it('só é concedido com metas cumpridas e confirmação do responsável', () => {
    let s = fresh();
    expect(run(s, { type: 'grant_medal', date: D }).o).toMatchObject({ status: 'rejected', code: 'not_eligible' });
    s = allDone(s, D);
    expect(dayProgress(s, D).eligible).toBe(true);
    const r = run(s, { type: 'grant_medal', date: D });
    expect(r.o.status).toBe('ok');
    expect(r.s.medals).toHaveLength(1);
    expect(creditBalance(r.s)).toBe(1);
  });
  it('7 de 8 não basta com o padrão (todas as metas); é configurável', () => {
    let s = fresh();
    for (const g of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'])
      s = run(s, { type: 'set_goal', date: D, goalId: g, status: 'done', expectedVersion: 0 }).s;
    s = run(s, { type: 'set_goal', date: D, goalId: 'g8', status: 'not_done', expectedVersion: 0 }).s;
    expect(run(s, { type: 'grant_medal', date: D }).o.status).toBe('rejected');
    s = run(s, { type: 'update_settings', settings: { ...s.settings, medalMinGoals: 7 } }).s;
    expect(run(s, { type: 'grant_medal', date: D }).o.status).toBe('ok');
  });
  it('metas especiais entram na exigência quando configurado', () => {
    const date = '2026-03-03'; // terça
    let s = run(fresh(), { type: 'update_settings', settings: { medalMinGoals: 8, medalIncludesSpecial: true, medalsPerPhaseHint: null } }).s;
    s = allDone(s, date);
    expect(run(s, { type: 'grant_medal', date }).o.status).toBe('rejected');
    s = run(s, { type: 'set_goal', date, goalId: 's1', status: 'done', expectedVersion: 0 }).s;
    expect(run(s, { type: 'grant_medal', date }).o.status).toBe('ok');
  });
  it('não concede duas vezes para a mesma data e não duplica crédito', () => {
    let s = allDone(fresh(), D);
    s = run(s, { type: 'grant_medal', date: D }).s;
    const r = run(s, { type: 'grant_medal', date: D });
    expect(r.o).toMatchObject({ status: 'ok', duplicate: true });
    expect(r.s.medals).toHaveLength(1);
    expect(creditBalance(r.s)).toBe(1);
  });
  it('criança não concede selo', () => {
    const s = allDone(fresh(), D);
    expect(run(s, { type: 'grant_medal', date: D }, C).o).toMatchObject({ code: 'forbidden' });
  });
  it('corrigir meta depois do selo não remove selo nem crédito', () => {
    let s = allDone(fresh(), D);
    s = run(s, { type: 'grant_medal', date: D }).s;
    s = run(s, { type: 'set_goal', date: D, goalId: 'g1', status: 'not_done', expectedVersion: 1 }).s;
    expect(s.medals).toHaveLength(1);
    expect(creditBalance(s)).toBe(1);
  });
});

describe('progressão das 25 fases', () => {
  it('exige ordem e ignora repetição', () => {
    const s = fresh();
    expect(run(s, { type: 'complete_phase', phase: 2 }).o).toMatchObject({ code: 'out_of_order' });
    expect(run(s, { type: 'complete_phase', phase: 26 }).o.status).toBe('rejected');
    const a = run(s, { type: 'complete_phase', phase: 1 });
    expect(run(a.s, { type: 'complete_phase', phase: 1 }).o).toMatchObject({ duplicate: true });
    expect(nextPhase(a.s)).toBe(2);
  });
  it('cada fase concede 1 selo pequeno (25 no total)', () => {
    expect(totals(completeUpTo(fresh(), 7)).smallStamps).toBe(7);
    expect(totals(completeUpTo(fresh(), 25)).smallStamps).toBe(25);
  });
  it('etapa só libera a seguinte ao concluir as 5 fases', () => {
    let s = completeUpTo(fresh(), 4);
    expect(stageUnlocked(s, 2)).toBe(false);
    s = completeUpTo(s, 5);
    expect(stageUnlocked(s, 2)).toBe(true);
    expect(stageUnlocked(s, 3)).toBe(false);
  });
  it.each([
    [5, 1, 1, 1], [10, 3, 2, 2], [15, 6, 4, 3], [20, 10, 6, 4], [25, 15, 10, 5],
  ])('após a fase %i: moedas=%i, selos grandes=%i, recompensas liberadas=%i', (phase, coins, big, rewards) => {
    const s = completeUpTo(fresh(), phase);
    const t = totals(s);
    expect(t.coins).toBe(coins);
    // selos grandes incluem o bônus final (+1) após a fase 25
    expect(t.bigStamps).toBe(big);
    expect(pendingDeliveries(s)).toHaveLength(phase === 25 ? 6 : rewards);
  });
  it('bônus final: 15 moedas + 9 selos grandes => +1 selo grande e recompensa grande extra', () => {
    const s24 = completeUpTo(fresh(), 24);
    expect(totals(s24)).toMatchObject({ coins: 10, bigStamps: 6 });
    expect(s24.rewardEvents.some((e) => e.kind === 'final_bonus')).toBe(false);
    const s = run(s24, { type: 'complete_phase', phase: 25 }).s;
    expect(totals(s)).toMatchObject({ smallStamps: 25, coins: 15, bigStamps: 10 });
    expect(s.rewardEvents.filter((e) => e.kind === 'final_bonus')).toHaveLength(1);
    expect(campaignComplete(s)).toBe(true);
  });
  it('registro de recompensa recebida é separado da liberação e não duplica', () => {
    let s = completeUpTo(fresh(), 5);
    expect(pendingDeliveries(s)).toHaveLength(1);
    expect(run(s, { type: 'deliver_reward', ref: 'reward:stage:2', choice: 'x' }).o).toMatchObject({ code: 'unknown_reward' });
    s = run(s, { type: 'deliver_reward', ref: 'reward:stage:1', choice: 'assistir mais 1 desenho' }).s;
    expect(pendingDeliveries(s)).toHaveLength(0);
    expect(run(s, { type: 'deliver_reward', ref: 'reward:stage:1', choice: 'y' }).o).toMatchObject({ duplicate: true });
    expect(s.rewardEvents.filter((e) => e.kind === 'delivery')).toHaveLength(1);
  });
  it('criança não avança fase', () => {
    expect(run(fresh(), { type: 'complete_phase', phase: 1 }, C).o).toMatchObject({ code: 'forbidden' });
  });
});

describe('créditos e minigames', () => {
  it('medalha confirmada rende 1 crédito; sessão consome 1', () => {
    let s = giveCredits(fresh(), 2);
    s = run(s, { type: 'start_session', sessionId: 'a', gameId: 'stars' }, C).s;
    expect(creditBalance(s)).toBe(1);
    expect(s.sessions).toHaveLength(1);
  });
  it('sem crédito não inicia; repetição do mesmo sessionId não consome de novo', () => {
    expect(run(fresh(), { type: 'start_session', sessionId: 'a', gameId: 'stars' }).o).toMatchObject({ code: 'insufficient_credits' });
    let s = giveCredits(fresh(), 3);
    s = run(s, { type: 'start_session', sessionId: 'a', gameId: 'stars' }).s;
    const r = run(s, { type: 'start_session', sessionId: 'a', gameId: 'stars' });
    expect(r.o).toMatchObject({ duplicate: true });
    expect(creditBalance(r.s)).toBe(2);
  });
  it('créditos não usados permanecem (sem expiração)', () => {
    let s = giveCredits(fresh(), 5);
    s = completeUpTo(s, 25);
    expect(creditBalance(s)).toBe(5);
  });
  it('desbloqueio: cristais após etapa 2, jardim após etapa 4', () => {
    let s = giveCredits(fresh(), 5);
    expect(gameUnlocked(s, 'stars')).toBe(true);
    expect(gameUnlocked(s, 'crystals')).toBe(false);
    expect(run(s, { type: 'start_session', sessionId: 'c', gameId: 'crystals' }).o).toMatchObject({ code: 'game_locked' });
    s = completeUpTo(s, 10);
    expect(gameUnlocked(s, 'crystals')).toBe(true);
    expect(gameUnlocked(s, 'garden')).toBe(false);
    expect(run(s, { type: 'start_session', sessionId: 'c', gameId: 'crystals' }, C).o.status).toBe('ok');
    s = completeUpTo(s, 20);
    expect(gameUnlocked(s, 'garden')).toBe(true);
  });
  it('minigames não geram medalhas, moedas ou selos nem alteram metas', () => {
    const s0 = giveCredits(fresh(), 1);
    const before = { ...totals(s0), goals: s0.goalReviews.length, medals: s0.medals.length };
    const s = run(s0, { type: 'start_session', sessionId: 'a', gameId: 'stars' }).s;
    expect({ ...totals(s), goals: s.goalReviews.length, medals: s.medals.length }).toEqual(before);
  });
  it('ajuste manual negativo não deixa saldo abaixo de zero', () => {
    const s = giveCredits(fresh(), 1);
    expect(run(s, { type: 'adjust_credits', amount: -2, reason: 'x' }).o).toMatchObject({ code: 'insufficient_credits' });
    expect(run(s, { type: 'adjust_credits', amount: 1, reason: '' }).o.status).toBe('rejected');
    expect(run(s, { type: 'adjust_credits', amount: 1, reason: 'x' }, C).o).toMatchObject({ code: 'forbidden' });
  });
  it('crédito otimista pendente não pode ser gasto até confirmação', () => {
    const s0 = allDone(fresh(), D);
    const opt = { ...G, optimistic: true };
    void opt;
    const s = { ...s0, creditEvents: [{ key: 'medal:x', kind: 'earn_medal' as const, amount: 1, at: '', by: '', pending: true }] };
    expect(creditBalance(s)).toBe(0);
  });
});

describe('jardim (estado salvo)', () => {
  it('exige desbloqueio, versiona e detecta conflito', () => {
    let s = fresh();
    expect(run(s, { type: 'save_game_state', gameId: 'garden', data: { items: [] }, expectedVersion: 0 }, C).o).toMatchObject({ code: 'game_locked' });
    s = completeUpTo(s, 20);
    s = run(s, { type: 'save_game_state', gameId: 'garden', data: { items: [1] }, expectedVersion: 0 }, C).s;
    const c = run(s, { type: 'save_game_state', gameId: 'garden', data: { items: [2] }, expectedVersion: 0 }, C);
    expect(c.o).toMatchObject({ status: 'conflict', entity: 'game', serverVersion: 1 });
    const ok = run(s, { type: 'save_game_state', gameId: 'garden', data: { items: [2] }, expectedVersion: 1 }, C);
    expect(ok.s.gameStates[0].version).toBe(2);
  });
});

describe('configurações', () => {
  it('validam limites e exigem responsável', () => {
    const base = fresh().settings;
    expect(run(fresh(), { type: 'update_settings', settings: { ...base, medalMinGoals: 0 } }).o.status).toBe('rejected');
    expect(run(fresh(), { type: 'update_settings', settings: { ...base, medalMinGoals: 9 } }).o.status).toBe('rejected');
    expect(run(fresh(), { type: 'update_settings', settings: { ...base, medalMinGoals: 6 } }, C).o).toMatchObject({ code: 'forbidden' });
    expect(run(fresh(), { type: 'update_settings', settings: { ...base, medalMinGoals: 6 } }).o.status).toBe('ok');
  });
});
