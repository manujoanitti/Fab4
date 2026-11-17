import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Substitui o schema "auth" do Supabase (apenas o necessário às migrações).
const AUTH_STUB = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`;
const MIG_DIR = join(__dirname, '../../supabase/migrations');

export type Db = PGlite;
export async function newDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(MIG_DIR).filter((x) => x.endsWith('.sql')).sort()) await db.exec(readFileSync(join(MIG_DIR, f), 'utf8'));
  return db;
}
export async function addUser(db: Db, email: string): Promise<string> {
  const r = await db.query<{ id: string }>('insert into auth.users(email) values ($1) returning id', [email]);
  return r.rows[0].id;
}
/** Executa fn como o usuário autenticado (papel "authenticated", RLS ativa) ou como anônimo (uid=null). */
export async function as<T>(db: Db, uid: string | null, fn: () => Promise<T>, role: 'authenticated' | 'anon' = 'authenticated'): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}
export const rpc = async (db: Db, fn: string, args: unknown[] = [], casts: string[] = []) => {
  const ph = args.map((_, i) => `$${i + 1}${casts[i] ?? ''}`).join(',');
  const r = await db.query<{ r: unknown }>(
    `select public.${fn}(${ph}) as r`,
    args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : a)),
  );
  return r.rows[0].r as any;
};
export const applyOp = (db: Db, camp: string, op: unknown) => rpc(db, 'apply_op', [camp, op], ['::uuid', '::jsonb']);
export const snapshot = (db: Db, camp: string) => rpc(db, 'get_snapshot', [camp], ['::uuid']);
export const newCampaign = (db: Db, name = 'Campanha Fictícia') => rpc(db, 'create_campaign', [name]) as Promise<string>;
