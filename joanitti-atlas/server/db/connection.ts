// Camada de acesso mínima sobre SQLite embutido (node:sqlite, Node ≥ 22.13).
// Toda a aplicação usa apenas esta interface `Db` + SQL padrão; migrar para PostgreSQL/Supabase = escrever
// outro adaptador (placeholders `?` → `$n`) e portar as migrações (ver docs/arquitetura.md).
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export type Param = string | number | null | boolean | undefined;
export interface Db {
  all<T = any>(sql: string, params?: Param[]): T[];
  get<T = any>(sql: string, params?: Param[]): T | undefined;
  run(sql: string, params?: Param[]): { changes: number };
  exec(sql: string): void;
  tx<T>(fn: () => T): T;
  vacuumInto(path: string): void;
  close(): void;
}

const norm = (p?: Param[]) => (p ?? []).map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

export function openDb(path = ':memory:'): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new DatabaseSync(path);
  raw.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') raw.exec('PRAGMA journal_mode = WAL;');
  let depth = 0;
  const db: Db = {
    all: (sql, p) => raw.prepare(sql).all(...norm(p)).map((r: any) => ({ ...r })),
    get: (sql, p) => { const r = raw.prepare(sql).get(...norm(p)); return r ? { ...r } : undefined; },
    run: (sql, p) => ({ changes: Number(raw.prepare(sql).run(...norm(p)).changes) }),
    exec: (sql) => raw.exec(sql),
    tx<T>(fn: () => T): T {
      const name = `sp${depth++}`;
      raw.exec(`SAVEPOINT ${name}`);
      try { const r = fn(); raw.exec(`RELEASE ${name}`); return r; }
      catch (e) { raw.exec(`ROLLBACK TO ${name}`); raw.exec(`RELEASE ${name}`); throw e; }
      finally { depth--; }
    },
    vacuumInto: (path) => raw.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`),
    close: () => raw.close(),
  };
  migrate(db);
  return db;
}

export function migrate(db: Db) {
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const done = new Set(db.all<{ name: string }>('SELECT name FROM _migrations').map((r) => r.name));
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    db.tx(() => { db.exec(readFileSync(join(dir, f), 'utf8')); db.run('INSERT INTO _migrations VALUES (?,?)', [f, new Date().toISOString()]); });
  }
}
