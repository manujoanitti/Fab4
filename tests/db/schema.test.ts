import { describe, expect, it } from 'vitest';
import { RULES } from '../../src/domain/rules';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addUser, newDb } from './harness';

describe('migrações e dados de regras', () => {
  it('aplicam do zero e o seed das regras espelha src/domain/rules.ts', async () => {
    const db = await newDb();
    const st = await db.query<any>('select * from rule_stages order by stage');
    expect(st.rows.map((r) => [r.name, r.coins, r.big_stamps, r.reward_size])).toEqual(
      RULES.stages.map((s) => [s.name, s.coins, s.bigStamps, s.rewardSize]),
    );
    const g = await db.query<any>('select * from rule_goals order by id');
    expect(g.rows.filter((r) => r.kind === 'daily').map((r) => r.id)).toEqual(RULES.goals.map((x) => x.id));
    expect(g.rows.filter((r) => r.kind === 'special').map((r) => [r.id, r.weekdays])).toEqual(
      RULES.specialGoals.map((x) => [x.id, x.weekdays]),
    );
    const f = (await db.query<any>('select * from rule_final')).rows[0];
    expect([f.coins_required, f.big_stamps_required, f.big_stamps]).toEqual([
      RULES.finalBonus.coinsRequired,
      RULES.finalBonus.bigStampsRequired,
      RULES.finalBonus.bigStamps,
    ]);
  });

  it('seed fictício de desenvolvimento roda (e é ignorado sem o usuário fictício)', async () => {
    const seed = readFileSync(join(__dirname, '../../supabase/seed.sql'), 'utf8');
    const db = await newDb();
    await db.exec(seed); // sem usuário: nada acontece
    expect((await db.query<any>('select count(*)::int as n from campaigns')).rows[0].n).toBe(0);
    await addUser(db, 'responsavel.demo@example.test');
    await db.exec(seed);
    expect((await db.query<any>('select count(*)::int as n from daily_medals')).rows[0].n).toBe(2);
    expect((await db.query<any>('select coalesce(sum(amount),0)::int as n from game_credit_events')).rows[0].n).toBe(2);
  });
});
