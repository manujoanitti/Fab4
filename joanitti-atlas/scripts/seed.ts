// Importa o relatório real (data/real) para o banco. Idempotente: pode ser executado quantas vezes quiser.
//   npm run seed            → importa/atualiza
//   npm run seed -- --reset → recria o banco do zero
//   npm run seed -- --dry   → só mostra o plano (nada é gravado)
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db/connection';
import { runImport } from '../server/import/importer';
import { inconsistenciesMarkdown } from '../server/app';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const real = join(root, 'data', 'real');
const dbPath = process.env.ATLAS_DB ?? join(real, 'atlas.sqlite');
const args = process.argv.slice(2);

if (!existsSync(join(real, 'extracao', 'index.ts'))) {
  console.error('Dados reais não encontrados em data/real/ (pasta ignorada pelo git). Veja docs/execucao.md.');
  process.exit(1);
}
const { pacote, REPORT_FILE } = await import(join(real, 'extracao', 'index.ts'));
const reportText = readFileSync(join(real, REPORT_FILE), 'utf8');

if (args.includes('--reset')) for (const s of ['', '-wal', '-shm']) rmSync(dbPath + s, { force: true });
const db = openDb(dbPath);
const mode = args.includes('--dry') ? 'dry_run' : 'apply';
const audit = runImport(db, pacote, reportText, { mode, actor: 'seed' });

const rows = Object.entries(audit.counts).map(([t, c]) => `| ${t} | ${c.created} | ${c.updated} | ${c.unchanged} | ${c.conflicts} |`);
const md = [`# Relatório de importação (${mode})`, '', `Pacote: ${audit.packageId} · relatório sha256: ${audit.reportId}`, '',
  '| Entidade | Criados | Atualizados | Inalterados | Conflitos |', '|---|---:|---:|---:|---:|', ...rows, '',
  `Ligações novas: ${audit.links.added}`, `Citações conferidas no texto original: ${audit.quotes.checked} (falhas: ${audit.quotes.failed.length})`,
  `Itens de revisão criados: ${audit.reviewItems.created} ${JSON.stringify(audit.reviewItems.byKind)}`, `Possíveis duplicatas: ${audit.duplicates.length}`, `Órfãos: ${audit.orphans.length}`,
  ...(audit.warnings.length ? ['', '## Avisos', ...audit.warnings.map((w) => `- ${w}`)] : []),
  ...(audit.quotes.failed.length ? ['', '## Citações não encontradas', ...audit.quotes.failed.map((f) => `- ${f.type}:${f.key} — "${f.quote}"`)] : [])].join('\n');
console.log(md);
if (mode === 'apply') {
  writeFileSync(join(real, 'relatorio-importacao.md'), md + '\n');
  writeFileSync(join(real, 'relatorio-inconsistencias-e-lacunas.md'), inconsistenciesMarkdown(db));
  console.log(`\nBanco: ${dbPath}`);
}
db.close();
