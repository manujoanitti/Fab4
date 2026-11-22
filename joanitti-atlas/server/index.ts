import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db/connection';
import { buildApp } from './app';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prod = process.env.NODE_ENV === 'production';
let token = process.env.ATLAS_ADMIN_TOKEN;
if (!token) {
  if (prod) { console.error('ATLAS_ADMIN_TOKEN é obrigatório em produção.'); process.exit(1); }
  token = 'dev-admin-token';
  console.warn('⚠  Usando token administrativo de DESENVOLVIMENTO ("dev-admin-token"). Defina ATLAS_ADMIN_TOKEN para qualquer uso real.');
}
if (prod && token.length < 16) { console.error('ATLAS_ADMIN_TOKEN muito curto (mínimo 16 caracteres).'); process.exit(1); }

const dbPath = process.env.ATLAS_DB ?? join(root, 'data', 'real', 'atlas.sqlite');
const db = openDb(dbPath);
const app = buildApp(db, {
  adminToken: token, publicRead: process.env.ATLAS_PUBLIC_READ !== '0',
  staticDir: prod || process.env.ATLAS_SERVE_STATIC === '1' ? join(root, 'dist') : undefined, backupDir: process.env.ATLAS_BACKUP_DIR ?? join(root, 'backups'),
});
const port = +(process.env.PORT ?? 3001), host = process.env.HOST ?? '127.0.0.1';
app.listen({ port, host }).then(() => console.log(`Joanitti Atlas — API em http://${host}:${port}  (banco: ${dbPath})`));
