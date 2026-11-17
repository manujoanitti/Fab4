import { describe, expect, it } from 'vitest';
import { exportBackup, mergeBackup, validateBackup } from '../../src/domain/backup';
import { completePhaseOp, grantMedalOp, setGoalOp, startSessionOp, adjustCreditsOp } from '../../src/domain/ops';
import { creditBalance, creditBalanceProjected, findReview, goalStatus, hasMedal, pendingCredits } from '../../src/domain/selectors';
import type { Op, Role } from '../../src/domain/types';
import { EngineBackend, EngineServer, FakeNet } from '../../src/sync/engineServer';
import { NetworkError } from '../../src/sync/backend';
import { SyncManager } from '../../src/sync/syncManager';
import { memoryKV, type KV } from '../../src/storage/kv';

const D = '2026-03-02';
const GOALS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'];

async function device(server: EngineServer, opts: { kv?: KV; role?: Role; user?: string; net?: FakeNet; kind?: 'demo' | 'cloud' } = {}) {
  const net = opts.net ?? new FakeNet();
  const kv = opts.kv ?? memoryKV();
  const be = new EngineBackend(opts.kind ?? 'cloud', server, opts.user ?? 'guardian-1', opts.role ?? 'guardian', net, undefined);
  const sm = new SyncManager(be, kv, server.state.campaignId);
  await sm.init();
  return { sm, net, kv, be };
}
const allGoals = async (sm: SyncManager, date = D) => {
  for (const g of GOALS) await sm.act(setGoalOp(sm.getView().view!, date, g, 'done'));
  await sm.sync();
};

describe('sincronização multi-aparelho', () => {
  it('alteração em um aparelho aparece no outro após atualizar', async () => {
    const server = new EngineServer();
    const a = await device(server), b = await device(server);
    await a.sm.act(setGoalOp(a.sm.getView().view!, D, 'g1', 'done'));
    await a.sm.sync();
    expect(goalStatus(b.sm.getView().view!, D, 'g1')).toBe('pending');
    await b.sm.sync(); // ao abrir/voltar ao app
    expect(goalStatus(b.sm.getView().view!, D, 'g1')).toBe('done');
    expect(b.sm.getView().status).toBe('synced');
  });

  it('offline: fila local, overlay otimista e envio ao reconectar', async () => {
    const server = new EngineServer();
    const a = await device(server);
    a.net.online = false;
    await allGoals(a.sm);
    expect(a.sm.getView().status).toBe('offline');
    expect(a.sm.getView().queue).toHaveLength(8);
    expect(goalStatus(a.sm.getView().view!, D, 'g3')).toBe('done'); // otimista
    expect(server.state.goalReviews).toHaveLength(0); // servidor intacto
    expect((await a.sm.act(grantMedalOp(D))).status).toBe('ok');
    const v = a.sm.getView().view!;
    expect(hasMedal(v, D)).toBe(true);
    expect(pendingCredits(v)).toBe(1); // crédito provisório
    expect(creditBalance(v)).toBe(0); // ainda não utilizável
    a.net.online = true;
    await a.sm.sync();
    expect(a.sm.getView().queue).toHaveLength(0);
    expect(a.sm.getView().status).toBe('synced');
    expect(server.state.medals).toHaveLength(1);
    expect(creditBalance(a.sm.getView().view!)).toBe(1); // crédito confirmado pelo servidor
    expect(pendingCredits(a.sm.getView().view!)).toBe(0);
  });

  it('dois aparelhos concedendo a mesma medalha: uma única medalha e um único crédito', async () => {
    const server = new EngineServer();
    const a = await device(server), b = await device(server);
    await allGoals(a.sm);
    await b.sm.sync();
    a.net.online = false; b.net.online = false;
    await a.sm.act(grantMedalOp(D));
    await b.sm.act(grantMedalOp(D));
    a.net.online = true; b.net.online = true;
    await Promise.all([a.sm.sync(), b.sm.sync()]);
    expect(server.state.medals).toHaveLength(1);
    expect(server.state.creditEvents.filter((c) => c.kind === 'earn_medal')).toHaveLength(1);
    expect(a.sm.getView().queue).toHaveLength(0);
    expect(b.sm.getView().queue).toHaveLength(0);
    expect(creditBalance(b.sm.getView().view!)).toBe(1);
  });

  it('conflito offline x servidor mais recente não sobrescreve; reconciliação explícita', async () => {
    const server = new EngineServer();
    const a = await device(server), b = await device(server);
    a.net.online = false;
    await a.sm.act(setGoalOp(a.sm.getView().view!, D, 'g1', 'not_done')); // a: offline, versão 0
    await b.sm.act(setGoalOp(b.sm.getView().view!, D, 'g1', 'done'));
    await b.sm.sync(); // servidor: done (v1)
    a.net.online = true;
    await a.sm.sync();
    expect(goalStatus(server.state as never, D, 'g1')).toBe('done'); // não sobrescreveu
    const view = a.sm.getView();
    expect(view.status).toBe('conflict');
    const item = view.queue.find((q) => q.status === 'conflict')!;
    expect(item.outcome).toMatchObject({ status: 'conflict', entity: 'goal', serverVersion: 1 });
    expect(goalStatus(view.view!, D, 'g1')).toBe('done'); // overlay ignora o conflito
    // opção 1: manter o servidor
    await a.sm.resolveKeepServer(item.op.opId);
    expect(a.sm.getView().queue).toHaveLength(0);
    expect(a.sm.getView().status).toBe('synced');
    // opção 2: usar o meu valor, com nova versão
    a.net.online = false;
    await a.sm.act(setGoalOp(a.sm.getView().view!, D, 'g2', 'not_done'));
    await b.sm.act(setGoalOp(b.sm.getView().view!, D, 'g2', 'done'));
    await b.sm.sync();
    a.net.online = true;
    await a.sm.sync();
    const c2 = a.sm.getView().queue.find((q) => q.status === 'conflict')!;
    await a.sm.resolveUseMine(c2.op.opId);
    expect(findReview(server.state, D, 'g2')).toMatchObject({ status: 'not_done', version: 2 });
    expect(server.state.history.filter((h) => h.goalId === 'g2').map((h) => h.to)).toEqual(['done', 'not_done']); // histórico preservado
    expect(a.sm.getView().status).toBe('synced');
  });

  it('falha de rede após o servidor aplicar (sem ack): reenvio não duplica', async () => {
    const server = new EngineServer();
    const a = await device(server);
    await allGoals(a.sm);
    const be = a.be;
    const orig = be.submit.bind(be);
    let crashed = false;
    be.submit = async (op: Op) => {
      const r = await orig(op);
      if (!crashed && op.type === 'grant_medal') { crashed = true; throw new NetworkError(); }
      return r;
    };
    await a.sm.act(grantMedalOp(D)); // servidor aplica, cliente não recebe resposta
    await a.sm.idle();
    expect(server.state.medals).toHaveLength(1);
    expect(a.sm.getView().queue).toHaveLength(1);
    expect(a.sm.getView().online).toBe(false);
    await a.sm.sync(); // reenvia o mesmo opId
    expect(a.sm.getView().queue).toHaveLength(0);
    expect(server.state.creditEvents.filter((c) => c.kind === 'earn_medal')).toHaveLength(1);
  });

  it('créditos pendentes não podem ser gastos; confirmados podem, mesmo offline', async () => {
    const server = new EngineServer();
    const a = await device(server);
    await a.sm.act(adjustCreditsOp(1, 'confirmado'));
    await a.sm.sync();
    a.net.online = false;
    expect((await a.sm.act(startSessionOp('stars'))).status).toBe('ok');
    expect(creditBalanceProjected(a.sm.getView().view!)).toBe(0);
    expect(await a.sm.act(startSessionOp('stars'))).toMatchObject({ status: 'rejected', code: 'insufficient_credits' });
    a.net.online = true;
    await a.sm.sync();
    expect(server.state.sessions).toHaveLength(1);
    expect(creditBalance(a.sm.getView().view!)).toBe(0);
  });

  it('criança é barrada nas ações do responsável (cliente e servidor)', async () => {
    const server = new EngineServer();
    const kid = await device(server, { role: 'child', user: 'child-1' });
    expect(await kid.sm.act(completePhaseOp(1))).toMatchObject({ status: 'rejected', code: 'forbidden' });
    // mesmo forjando a operação direto no backend, o servidor rejeita
    const forged = { type: 'complete_phase', phase: 1, opId: 'forged', at: new Date().toISOString() } as Op;
    expect(await kid.be.submit(forged)).toMatchObject({ code: 'forbidden' });
    expect(server.state.phases).toHaveLength(0);
  });

  it('rejeição pelo servidor fica visível na fila e não entra no overlay', async () => {
    const server = new EngineServer();
    const a = await device(server), b = await device(server);
    await a.sm.act(adjustCreditsOp(1, 'x'));
    await a.sm.sync();
    await b.sm.sync();
    b.net.online = false;
    await b.sm.act(startSessionOp('stars'));
    await a.sm.act(startSessionOp('stars')); // a consome o único crédito primeiro
    await a.sm.sync();
    b.net.online = true;
    await b.sm.sync();
    expect(server.state.sessions).toHaveLength(1);
    expect(b.sm.getView().queue[0]).toMatchObject({ status: 'rejected' });
    expect(creditBalance(b.sm.getView().view!)).toBe(0);
    await b.sm.dismiss(b.sm.getView().queue[0].op.opId);
    expect(b.sm.getView().queue).toHaveLength(0);
  });
});

describe('persistência local', () => {
  it('cache e fila sobrevivem ao reinício do app (offline) e são enviados depois', async () => {
    const server = new EngineServer();
    const kv = memoryKV();
    const a = await device(server, { kv });
    a.net.online = false;
    await a.sm.act(setGoalOp(a.sm.getView().view!, D, 'g1', 'done'));
    // "reinício": novo SyncManager sobre o mesmo armazenamento, ainda sem rede
    const net2 = new FakeNet(); net2.online = false;
    const again = await device(server, { kv, net: net2 });
    expect(again.sm.getView().queue).toHaveLength(1);
    expect(goalStatus(again.sm.getView().view!, D, 'g1')).toBe('done');
    net2.online = true;
    await again.sm.sync();
    expect(findReview(server.state, D, 'g1')?.status).toBe('done');
    expect(again.sm.getView().queue).toHaveLength(0);
  });
});

describe('modo demonstração', () => {
  it('é isolado: chaves próprias, sem rede e sem tocar a campanha real', async () => {
    const realFetch = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = (() => { fetched++; throw new Error('rede proibida no demo'); }) as never;
    try {
      const kv = memoryKV();
      const demoServer = new EngineServer(undefined, 'demo', 'Demo');
      const real = new EngineServer(undefined, 'real-1', 'Real');
      const demo = await device(demoServer, { kv, kind: 'demo' });
      await allGoals(demo.sm);
      await demo.sm.act(grantMedalOp(D));
      await demo.sm.act(completePhaseOp(1));
      await demo.sm.sync();
      expect(hasMedal(demo.sm.getView().view!, D)).toBe(true);
      expect(real.state.medals).toHaveLength(0);
      expect((await kv.keys()).every((k) => k.includes(':demo'))).toBe(true);
      expect(fetched).toBe(0);
      // backup de demo não restaura em campanha real e vice-versa
      const real1 = await device(real, { kv, kind: 'cloud' });
      const bk = exportBackup(demo.sm.getView().view!, { demo: true });
      await expect(real1.sm.restoreBackup(bk)).rejects.toThrow(/demonstração/);
      await expect(demo.sm.restoreBackup({ ...bk, demo: false })).rejects.toThrow(/reais/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('backup e recuperação', () => {
  async function populated() {
    const server = new EngineServer();
    const a = await device(server);
    await allGoals(a.sm);
    await a.sm.act(grantMedalOp(D));
    for (let p = 1; p <= 6; p++) await a.sm.act(completePhaseOp(p));
    await a.sm.sync();
    return { server, a };
  }
  it('exporta com versão de esquema e valida o formato', async () => {
    const { a } = await populated();
    const bk = exportBackup(a.sm.getView().view!, { demo: false });
    expect(bk).toMatchObject({ format: 'reino-bianca-backup', schemaVersion: 1, demo: false });
    expect(validateBackup(JSON.stringify(bk)).ok).toBe(true);
    for (const bad of ['{', '{}', JSON.stringify({ ...bk, schemaVersion: 99 }), JSON.stringify({ ...bk, format: 'x' }), JSON.stringify({ ...bk, state: { ...bk.state, phases: [{ phase: 99 }] } }), JSON.stringify({ ...bk, state: { ...bk.state, medals: null } })])
      expect(validateBackup(bad).ok, bad.slice(0, 40)).toBe(false);
  });
  it('restaura em novo dispositivo/campanha vazia e não duplica ao repetir', async () => {
    const { a } = await populated();
    const bk = exportBackup(a.sm.getView().view!, { demo: false });
    const fresh = new EngineServer(undefined, 'camp-2', 'Nova');
    const b = await device(fresh);
    const r1 = await b.sm.restoreBackup(bk);
    expect(r1.inserted.medals).toBe(1);
    expect(fresh.state.phases).toHaveLength(6);
    const before = JSON.stringify(fresh.state);
    const r2 = await b.sm.restoreBackup(bk);
    expect(Object.values(r2.inserted).every((n) => n === 0)).toBe(true);
    expect(JSON.stringify(fresh.state)).toBe(before);
    expect(creditBalance(b.sm.getView().view!)).toBe(1);
  });
  it('divergências não são sobrescritas', async () => {
    const { a } = await populated();
    const bk = exportBackup(a.sm.getView().view!, { demo: false });
    const other = mergeBackup(new EngineServer().state, bk).state;
    other.goalReviews[0].status = 'not_done';
    const r = mergeBackup(other, bk);
    expect(r.report.skippedDifferent).toBe(1);
    expect(r.state.goalReviews[0].status).toBe('not_done');
  });
});
