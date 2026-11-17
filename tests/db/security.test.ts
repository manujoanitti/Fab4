import { beforeAll, describe, expect, it } from 'vitest';
import { GUARDIAN_ONLY } from '../../src/domain/types';
import { addUser, applyOp, as, newCampaign, newDb, rpc, snapshot, type Db } from './harness';

let db: Db;
let guardian: string, guardian2: string, child: string, stranger: string;
let camp: string, otherCamp: string;
const D = '2026-03-02';
let n = 0;
const op = (o: Record<string, unknown>) => ({ opId: `s-${++n}`, at: new Date().toISOString(), ...o });

beforeAll(async () => {
  db = await newDb();
  guardian = await addUser(db, 'responsavel.a@example.test');
  guardian2 = await addUser(db, 'responsavel.b@example.test');
  child = await addUser(db, 'crianca@example.test');
  stranger = await addUser(db, 'estranho@example.test');
  camp = await as(db, guardian, () => newCampaign(db, 'Campanha A'));
  otherCamp = await as(db, stranger, () => newCampaign(db, 'Campanha de outra família'));
  const code = await as(db, guardian, () => rpc(db, 'create_invite', [camp, 'child']));
  await as(db, child, () => rpc(db, 'redeem_invite', [code]));
});

const q = (uid: string | null, sql: string, role: 'authenticated' | 'anon' = 'authenticated') =>
  as(db, uid, () => db.query<any>(sql), role);

describe('acesso anônimo', () => {
  it('não lê nenhuma tabela com dados e não executa funções', async () => {
    for (const t of ['campaigns', 'campaign_members', 'goal_reviews', 'daily_medals', 'game_credit_events', 'profiles', 'applied_ops'])
      await expect(q(null, `select * from public.${t}`, 'anon')).rejects.toThrow(/permission denied/);
    await expect(as(db, null, () => applyOp(db, camp, op({ type: 'grant_medal', date: D })), 'anon')).rejects.toThrow(/permission denied/);
    await expect(as(db, null, () => snapshot(db, camp), 'anon')).rejects.toThrow(/permission denied/);
    await expect(as(db, null, () => newCampaign(db), 'anon')).rejects.toThrow(/permission denied/);
  });
  it('usuário sem sessão (uid nulo) não executa operações', async () => {
    await expect(as(db, null, () => applyOp(db, camp, op({ type: 'grant_medal', date: D })))).rejects.toThrow(/not authenticated/);
  });
});

describe('isolamento entre campanhas/usuários', () => {
  it('estranho não vê nem altera a campanha A', async () => {
    expect((await q(stranger, `select id from campaigns where id = '${camp}'`)).rows).toHaveLength(0);
    expect((await q(stranger, `select * from campaign_members where campaign_id = '${camp}'`)).rows).toHaveLength(0);
    await expect(as(db, stranger, () => snapshot(db, camp))).rejects.toThrow(/not a campaign member/);
    await expect(as(db, stranger, () => applyOp(db, camp, op({ type: 'complete_phase', phase: 1 })))).rejects.toThrow(/not a campaign member/);
    await expect(as(db, stranger, () => rpc(db, 'create_invite', [camp, 'guardian']))).rejects.toThrow(/forbidden/);
    await expect(as(db, stranger, () => rpc(db, 'restore_backup', [camp, {}], ['::uuid', '::jsonb']))).rejects.toThrow(/forbidden/);
  });
  it('responsável A não acessa a campanha de outra família', async () => {
    await expect(as(db, guardian, () => snapshot(db, otherCamp))).rejects.toThrow(/not a campaign member/);
    expect((await q(guardian, `select * from campaigns`)).rows.map((r) => r.name)).toEqual(['Campanha A']);
  });
  it('cada usuário só lê o próprio perfil', async () => {
    expect((await q(guardian, 'select id from profiles')).rows.map((r) => r.id)).toEqual([guardian]);
  });
});

describe('escrita direta bloqueada (sem política / sem privilégio)', () => {
  it('membros, inclusive responsável, não fazem INSERT/UPDATE/DELETE direto', async () => {
    await expect(q(guardian, `insert into daily_medals(campaign_id, medal_date, granted_by) values ('${camp}','${D}','${guardian}')`)).rejects.toThrow(/permission denied/);
    await expect(q(guardian, `insert into game_credit_events(campaign_id,key,kind,amount,by) values ('${camp}','x','adjust',99,'${guardian}')`)).rejects.toThrow(/permission denied/);
    await expect(q(guardian, `update campaigns set settings = '{}' where id = '${camp}'`)).rejects.toThrow(/permission denied/);
    await expect(q(guardian, `insert into campaign_members(campaign_id,user_id,role) values ('${camp}','${stranger}','guardian')`)).rejects.toThrow(/permission denied/);
    await expect(q(child, `update campaign_members set role = 'guardian' where user_id = '${child}'`)).rejects.toThrow(/permission denied/);
    await expect(q(child, `delete from phase_progress`)).rejects.toThrow(/permission denied/);
    await expect(q(guardian, `update rule_stages set coins = 99`)).rejects.toThrow(/permission denied/);
  });
  it('perfil: só insere/atualiza o próprio', async () => {
    await expect(q(guardian, `insert into profiles(id) values ('${stranger}')`)).rejects.toThrow(/row-level security/);
    expect((await q(guardian, `update profiles set display_name = 'Responsável Fictício' where id = '${guardian}' returning id`)).rows).toHaveLength(1);
  });
  it('não há saldo editável: não existe coluna/tabela de saldo', async () => {
    const r = await db.query<any>(`select column_name from information_schema.columns where table_schema='public' and column_name ilike '%balance%'`);
    expect(r.rows).toHaveLength(0);
  });
});

describe('papéis (autorização real no banco)', () => {
  it('criança não executa nenhuma ação privilegiada', async () => {
    const ops: Record<string, unknown>[] = [
      { type: 'set_goal', date: D, goalId: 'g1', status: 'done', expectedVersion: 0 },
      { type: 'grant_medal', date: D },
      { type: 'complete_phase', phase: 1 },
      { type: 'deliver_reward', ref: 'reward:stage:1', choice: 'x' },
      { type: 'adjust_credits', amount: 5, reason: 'x' },
      { type: 'update_settings', settings: { medalMinGoals: 1, medalIncludesSpecial: false, medalsPerPhaseHint: null } },
    ];
    expect(ops.map((o) => o.type).sort()).toEqual([...GUARDIAN_ONLY].sort()); // cobre todas as ações privilegiadas
    for (const o of ops) {
      const r = await as(db, child, () => applyOp(db, camp, op(o)));
      expect(r, String(o.type)).toMatchObject({ status: 'rejected', code: 'forbidden' });
    }
    const snap = await as(db, guardian, () => snapshot(db, camp));
    expect(snap.medals).toHaveLength(0);
    expect(snap.phases).toHaveLength(0);
  });
  it('criança não cria convites nem restaura backup', async () => {
    await expect(as(db, child, () => rpc(db, 'create_invite', [camp, 'guardian']))).rejects.toThrow(/forbidden/);
    await expect(as(db, child, () => rpc(db, 'restore_backup', [camp, {}], ['::uuid', '::jsonb']))).rejects.toThrow(/forbidden/);
  });
  it('criança vê o estado (somente leitura) e seu papel', async () => {
    const snap = await as(db, child, () => snapshot(db, camp));
    expect(snap.role).toBe('child');
    expect((await q(child, `select count(*)::int as n from campaigns`)).rows[0].n).toBe(1);
  });
});

describe('convites', () => {
  it('são de uso único, expiram e não promovem a criança', async () => {
    const code = await as(db, guardian, () => rpc(db, 'create_invite', [camp, 'guardian']));
    expect(await as(db, guardian2, () => rpc(db, 'redeem_invite', [code]))).toBe(camp);
    await expect(as(db, stranger, () => rpc(db, 'redeem_invite', [code]))).rejects.toThrow(/invalid or expired/);
    await expect(as(db, stranger, () => rpc(db, 'redeem_invite', ['codigo-inexistente']))).rejects.toThrow(/invalid or expired/);
    const exp = await as(db, guardian, () => rpc(db, 'create_invite', [camp, 'child']));
    await db.query(`update campaign_invites set expires_at = now() - interval '1 day' where code = $1`, [exp]);
    await expect(as(db, stranger, () => rpc(db, 'redeem_invite', [exp]))).rejects.toThrow(/invalid or expired/);
    expect((await q(stranger, `select * from campaign_invites`)).rows).toHaveLength(0); // convites só visíveis a responsáveis
    expect((await q(child, `select * from campaign_invites`)).rows).toHaveLength(0);
  });
  it('responsável convidado passa a operar na campanha', async () => {
    const r = await as(db, guardian2, () => applyOp(db, camp, op({ type: 'set_goal', date: D, goalId: 'g1', status: 'done', expectedVersion: 0 })));
    expect(r.status).toBe('ok');
  });
});

describe('atomicidade, concorrência e duplicação', () => {
  it('dois aparelhos concedendo a mesma medalha: 1 medalha e 1 crédito', async () => {
    for (const g of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'])
      await as(db, guardian, () => applyOp(db, camp, op({ type: 'set_goal', date: D, goalId: g, status: 'done', expectedVersion: g === 'g1' ? 1 : 0 })));
    // PGlite tem uma única conexão: as chamadas são serializadas (no Postgres real, o advisory lock
    // por campanha + a chave primária produzem o mesmo resultado sob concorrência).
    const a = await as(db, guardian, () => applyOp(db, camp, op({ type: 'grant_medal', date: D })));
    const b = await as(db, guardian2, () => applyOp(db, camp, op({ type: 'grant_medal', date: D })));
    expect([a.status, b.status]).toEqual(['ok', 'ok']);
    expect([a.duplicate, b.duplicate].filter(Boolean)).toHaveLength(1);
    const snap = await as(db, guardian, () => snapshot(db, camp));
    expect(snap.medals).toHaveLength(1);
    expect(snap.creditEvents.filter((c: any) => c.kind === 'earn_medal')).toHaveLength(1);
  });
  it('reenvio do mesmo opId (fila offline) não duplica efeito', async () => {
    const o = op({ type: 'adjust_credits', amount: 3, reason: 'teste' });
    const r1 = await as(db, guardian, () => applyOp(db, camp, o));
    const r2 = await as(db, guardian, () => applyOp(db, camp, o));
    expect(r1.status).toBe('ok');
    expect(r2).toMatchObject({ status: 'ok', duplicate: true });
    const snap = await as(db, guardian, () => snapshot(db, camp));
    expect(snap.creditEvents.filter((c: any) => c.kind === 'adjust')).toHaveLength(1);
  });
  it('conflito de meta: servidor mais recente não é sobrescrito', async () => {
    const mine = await as(db, guardian2, () => applyOp(db, camp, op({ type: 'set_goal', date: '2026-03-03', goalId: 'g2', status: 'done', expectedVersion: 0 })));
    expect(mine.status).toBe('ok');
    const late = await as(db, guardian, () => applyOp(db, camp, op({ type: 'set_goal', date: '2026-03-03', goalId: 'g2', status: 'not_done', expectedVersion: 0 })));
    expect(late).toMatchObject({ status: 'conflict', entity: 'goal', serverVersion: 1 });
    expect(late.serverValue.status).toBe('done');
  });
  it('sessões concorrentes com 1 crédito: só uma é aceita (saldo nunca negativo)', async () => {
    const before = await as(db, guardian, () => snapshot(db, camp));
    const bal = before.creditEvents.reduce((a: number, c: any) => a + c.amount, 0);
    const tries = [];
    for (let i = 0; i < bal + 2; i++)
      tries.push(await as(db, i % 2 ? child : guardian, () => applyOp(db, camp, op({ type: 'start_session', sessionId: `race-${i}`, gameId: 'stars' }))));
    expect(tries.filter((t) => t.status === 'ok')).toHaveLength(bal);
    const after = await as(db, guardian, () => snapshot(db, camp));
    expect(after.creditEvents.reduce((a: number, c: any) => a + c.amount, 0)).toBe(0);
  });
  it('restrições de unicidade no banco (última barreira)', async () => {
    await expect(db.query(`insert into daily_medals(campaign_id, medal_date, granted_by) values ($1,$2,$3)`, [camp, D, guardian])).rejects.toThrow(/duplicate key/);
    await expect(db.query(`insert into game_credit_events(campaign_id,key,kind,amount,by) values ($1,'medal:${D}','earn_medal',1,$2)`, [camp, guardian])).rejects.toThrow(/duplicate key/);
  });
});

describe('restauração de backup', () => {
  it('é idempotente, valida o formato e não sobrescreve divergências', async () => {
    const snap = await as(db, guardian, () => snapshot(db, camp));
    const backup = { format: 'reino-bianca-backup', schemaVersion: 1, state: snap };
    const fresh = await as(db, guardian, () => newCampaign(db, 'Campanha restaurada'));
    const r1 = await as(db, guardian, () => rpc(db, 'restore_backup', [fresh, backup], ['::uuid', '::jsonb']));
    expect(r1.medals).toBe(1);
    const r2 = await as(db, guardian, () => rpc(db, 'restore_backup', [fresh, backup], ['::uuid', '::jsonb']));
    expect(r2).toMatchObject({ medals: 0, phases: 0, creditEvents: 0, sessions: 0, skippedDifferent: 0 });
    const restored = await as(db, guardian, () => snapshot(db, fresh));
    expect(restored.medals).toHaveLength(snap.medals.length);
    expect(restored.creditEvents).toHaveLength(snap.creditEvents.length);
    // divergência não é sobrescrita
    await db.query(`update goal_reviews set status='not_done' where campaign_id=$1 and goal_id='g1'`, [fresh]);
    const r3 = await as(db, guardian, () => rpc(db, 'restore_backup', [fresh, backup], ['::uuid', '::jsonb']));
    expect(r3.skippedDifferent).toBeGreaterThan(0);
    await expect(as(db, guardian, () => rpc(db, 'restore_backup', [fresh, { format: 'x' }], ['::uuid', '::jsonb']))).rejects.toThrow(/invalid backup format/);
  });
});
