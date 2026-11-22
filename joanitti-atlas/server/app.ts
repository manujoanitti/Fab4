import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fstatic from '@fastify/static';
import { timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ZodError } from 'zod';
import type { Db } from './db/connection';
import { ENTITIES, LINKS, createEntity, updateEntity, removeEntity, upsertLink, deleteLink, getRow, log, statusWarning, ValidationError, NotFoundError, type Ctx } from './repo';
import { loadSnapshot, statsOf, type Mode } from './snapshot';
import { auditIntegrity } from './audit';
import { runImport } from './import/importer';
import { dumpAll, restoreAll } from './export/dump';
import { toGedcom } from './export/gedcom';
import { toCsv, csvRows, CSV_TABLES } from './export/csv';
import { searchScore } from '../shared/names';
import { yearRange } from '../shared/dates';
import { STATUSES, type Status } from '../shared/types';

export interface AppConfig { adminToken: string; publicRead: boolean; staticDir?: string; backupDir: string }

export function buildApp(db: Db, cfg: AppConfig): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 30 * 1024 * 1024 });
  app.register(cors, { origin: true, allowedHeaders: ['Authorization', 'Content-Type'], methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'] });
  mkdirSync(cfg.backupDir, { recursive: true });
  // aceita corpo JSON vazio (ex.: DELETE com Content-Type) em vez de responder 400
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => { try { done(null, body ? JSON.parse(body as string) : {}); } catch (e: any) { e.statusCode = 400; done(e, undefined); } });

  const fails = new Map<string, { n: number; t: number }>();
  const tokenOk = (req: FastifyRequest): boolean => {
    const h = req.headers.authorization; if (!h?.startsWith('Bearer ')) return false;
    const a = Buffer.from(h.slice(7)), b = Buffer.from(cfg.adminToken);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const isAdmin = (req: FastifyRequest) => (req as any).admin === true;
  const ctxOf = (req: FastifyRequest): Ctx => ({ actor: (req.headers['x-actor'] as string)?.slice(0, 60) || 'admin' });

  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/api')) return;
    const hasAuth = !!req.headers.authorization;
    if (hasAuth) {
      const f = fails.get(req.ip); if (f && f.n >= 8 && Date.now() - f.t < 60_000) return reply.code(429).send({ error: 'Muitas tentativas. Aguarde um minuto.' });
      if (tokenOk(req)) (req as any).admin = true;
      else { const cur = fails.get(req.ip); fails.set(req.ip, { n: (cur && Date.now() - cur.t < 60_000 ? cur.n : 0) + 1, t: Date.now() }); if (url.startsWith('/api/admin') || url === '/api/auth/check') return reply.code(401).send({ error: 'Token inválido.' }); }
    }
    if (url.startsWith('/api/admin') && !isAdmin(req)) return reply.code(401).send({ error: 'Autenticação administrativa necessária.' });
    if (!cfg.publicRead && !isAdmin(req) && url !== '/api/health') return reply.code(401).send({ error: 'Acesso restrito.' });
  });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof ValidationError) return reply.code(400).send({ error: err.message, details: err.details });
    if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
    if (err instanceof ZodError) return reply.code(400).send({ error: 'Dados inválidos', details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    if (/constraint failed/i.test(err?.message ?? '')) return reply.code(400).send({ error: `Violação de integridade: ${err.message}` });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message });
    console.error(err);
    return reply.code(500).send({ error: 'Erro interno' });
  });

  const modeOf = (req: FastifyRequest, preview = false): Mode => (isAdmin(req) && !preview ? 'admin' : 'public');

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/auth/check', async (req) => ({ admin: isAdmin(req), publicRead: cfg.publicRead }));
  app.get('/api/snapshot', async (req) => {
    const preview = (req.query as any).view === 'public';
    const snap = loadSnapshot(db, modeOf(req, preview));
    return { ...snap, stats: statsOf(snap) };
  });

  app.get('/api/search', async (req) => {
    const q = req.query as Record<string, string>;
    const snap = loadSnapshot(db, modeOf(req));
    const out: any[] = [];
    const nuc = q.nucleus, st = q.status, yFrom = q.from ? +q.from : null, yTo = q.to ? +q.to : null;
    const placeName = (id: string) => snap.places.find((p: any) => p.id === id)?.name ?? '';
    const inPeriod = (d: any) => { if (yFrom == null && yTo == null) return true; const r = yearRange(d); return !!r && (yTo == null || r[0] <= yTo) && (yFrom == null || r[1] >= yFrom); };
    const push = (type: string, id: string, title: string, subtitle: string, score: number) => { if (score > 0) out.push({ type, id, title, subtitle, score }); };
    for (const p of snap.persons) {
      if (nuc && !p.nucleusIds.includes(nuc)) continue; if (st && p.verification_status !== st) continue;
      if (!inPeriod({ from: p.birth_from, to: p.death_to ?? p.death_from, precision: 'intervalo' }) && (yFrom != null || yTo != null)) continue;
      const hay = [p.preferred_name, ...p.names.map((n: any) => n.name), ...p.occupations.map((o: any) => o.title), placeName(p.birth_place_id), p.birth_from, p.death_from].filter(Boolean).join(' ');
      push('pessoa', p.id, p.preferred_name, [p.birth_from, p.death_from].filter(Boolean).join('–'), searchScore(q.q ?? '', hay) + (searchScore(q.q ?? '', p.preferred_name) > 0 ? 0.2 : 0));
    }
    for (const e of snap.events) { if (st && e.status !== st) continue; if (!inPeriod({ from: e.date_from, to: e.date_to, precision: e.date_precision })) continue; push('evento', e.id, e.title, [e.date_from, placeName(e.place_id)].filter(Boolean).join(' · '), searchScore(q.q ?? '', `${e.title} ${e.description ?? ''} ${placeName(e.place_id)} ${e.date_from ?? ''}`) * 0.9); }
    for (const p of snap.places) push('lugar', p.id, p.name, p.level, searchScore(q.q ?? '', `${p.name} ${p.historic_names.join(' ')}`) * 0.95);
    for (const s of snap.sources) push('fonte', s.id, s.title, s.institution ?? '', searchScore(q.q ?? '', `${s.title} ${s.institution ?? ''} ${s.excerpt ?? ''}`) * 0.8);
    for (const v of snap.investigations) push('investigacao', v.id, v.title, v.question, searchScore(q.q ?? '', `${v.title} ${v.question}`) * 0.85);
    for (const s of snap.surnames) push('sobrenome', s.id, s.form, s.attested_places ?? '', searchScore(q.q ?? '', s.form) * 0.9);
    return out.sort((a, b) => b.score - a.score).slice(0, 60);
  });

  // ---------- exportações ----------
  app.get('/api/export/snapshot.json', async (req, reply) => reply.header('Content-Disposition', 'attachment; filename="atlas-visao.json"').send(loadSnapshot(db, modeOf(req))));
  app.get('/api/export/gedcom', async (req, reply) => {
    const q = req.query as any; const mode = modeOf(req);
    const ged = toGedcom(loadSnapshot(db, mode), { includeLiving: mode === 'admin' && q.includeLiving === '1', minStatus: STATUSES.includes(q.minStatus) ? q.minStatus : 'fortemente_corroborado' });
    return reply.header('Content-Type', 'text/plain; charset=utf-8').header('Content-Disposition', 'attachment; filename="joanitti-atlas.ged"').send(ged);
  });
  app.get('/api/export/csv/:name', async (req, reply) => {
    const { name } = req.params as any; if (!(CSV_TABLES as readonly string[]).includes(name)) throw new NotFoundError('Tabela CSV desconhecida');
    const sep = (req.query as any).sep === 'comma' ? ',' : ';';
    return reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="${name}.csv"`).send(toCsv(csvRows(name, loadSnapshot(db, modeOf(req))), sep));
  });
  app.get('/api/admin/export/backup.json', async (_req, reply) => reply.header('Content-Disposition', 'attachment; filename="joanitti-atlas-backup.json"').send(dumpAll(db)));
  app.get('/api/admin/export/sqlite', async (_req, reply) => {
    const file = join(cfg.backupDir, `atlas-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
    db.vacuumInto(file);
    return reply.header('Content-Type', 'application/octet-stream').header('Content-Disposition', 'attachment; filename="joanitti-atlas.sqlite"').send(readFileSync(file));
  });
  app.post('/api/admin/restore', async (req) => {
    const safety = join(cfg.backupDir, `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
    db.vacuumInto(safety);
    const r = restoreAll(db, req.body);
    log(db, ctxOf(req), 'import', 'backup', 'restore', null, r, `restauração; cópia de segurança em ${safety}`);
    return { ...r, safetyCopy: safety };
  });

  // ---------- administração ----------
  app.get('/api/admin/integrity', async () => auditIntegrity(db));
  app.get('/api/admin/changelog', async (req) => {
    const q = req.query as any; const where: string[] = [], p: any[] = [];
    if (q.entity_type) { where.push('entity_type = ?'); p.push(q.entity_type); } if (q.entity_id) { where.push('entity_id = ?'); p.push(q.entity_id); }
    return db.all(`SELECT * FROM change_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`, [...p, Math.min(+q.limit || 100, 500)]);
  });
  app.get('/api/admin/archived', async () => {
    const label: Record<string, string> = { person: 'preferred_name', place: 'name', nucleus: 'name', relationship: 'type', event: 'title', source: 'title', claim: 'content', investigation: 'title', research_group: 'name' };
    return Object.entries(label).flatMap(([type, col]) => db.all<any>(`SELECT id, ${col} AS label, archived_at FROM ${ENTITIES[type].table} WHERE archived_at IS NOT NULL`).map((r) => ({ type, ...r })));
  });
  app.get('/api/admin/reports/:id', async (req) => { const r = db.get<any>('SELECT * FROM report WHERE id = ?', [(req.params as any).id]); if (!r) throw new NotFoundError('Relatório não encontrado'); return r; });
  app.get('/api/admin/import-runs', async () => db.all('SELECT id, report_id, package_id, package_version, mode, at, actor, summary FROM import_run ORDER BY at DESC'));
  app.get('/api/admin/import-runs/:id', async (req) => { const r = db.get<any>('SELECT * FROM import_run WHERE id = ?', [(req.params as any).id]); if (!r) throw new NotFoundError('Importação não encontrada'); return { ...r, summary: JSON.parse(r.summary), audit: JSON.parse(r.audit) }; });
  app.post('/api/admin/import', async (req) => {
    const b = req.body as any;
    const text: string | undefined = b.reportText ?? (b.reportId ? db.get<any>('SELECT content FROM report WHERE id = ?', [b.reportId])?.content : undefined);
    if (!text) throw new ValidationError(['Informe reportText (texto original do relatório) ou reportId de um relatório já armazenado.']);
    return runImport(db, b.package, text, { mode: b.mode === 'apply' ? 'apply' : 'dry_run', actor: ctxOf(req).actor, resolutions: b.resolutions });
  });
  app.get('/api/admin/inconsistencias.md', async (_req, reply) => reply.header('Content-Type', 'text/markdown; charset=utf-8').send(inconsistenciesMarkdown(db)));

  app.post('/api/admin/status/:type/:id', async (req) => {
    const { type, id } = req.params as any; const { status, note } = req.body as any;
    if (!STATUSES.includes(status)) throw new ValidationError(['Estado inválido.']);
    const col = type === 'person' ? 'verification_status' : 'status';
    if (!['person', 'relationship', 'event', 'claim', 'identity_link', 'person_occupation'].includes(type)) throw new ValidationError(['Tipo sem estado de verificação.']);
    const r = updateEntity(db, ctxOf(req), type, id, { [col]: status }, note);
    const w = statusWarning(db, type === 'person_occupation' ? 'occupation' : type, id, status as Status);
    return { ...r, warnings: [...r.warnings, ...(w ? [w] : [])] };
  });
  app.post('/api/admin/investigation/:id/log', async (req) => {
    const { id } = req.params as any; const { kind, text } = req.body as any;
    if (!text?.trim()) throw new ValidationError(['Texto obrigatório.']);
    if (!getRow(db, 'investigation', id)) throw new NotFoundError('Investigação não encontrada');
    db.run('INSERT INTO investigation_log (investigation_id, at, actor, kind, text) VALUES (?,?,?,?,?)', [id, new Date().toISOString(), ctxOf(req).actor, ['nota', 'decisao', 'status', 'evidencia'].includes(kind) ? kind : 'nota', text]);
    return { ok: true };
  });
  app.post('/api/admin/investigation/:id/conclude', async (req) => {
    const { id } = req.params as any; const { status, conclusion } = req.body as any;
    const r = updateEntity(db, ctxOf(req), 'investigation', id, { status, conclusion }, 'mudança de estado da investigação');
    db.run('INSERT INTO investigation_log (investigation_id, at, actor, kind, text) VALUES (?,?,?,?,?)', [id, new Date().toISOString(), ctxOf(req).actor, 'status', `Estado → ${status}${conclusion ? `. Conclusão: ${conclusion}` : ''}`]);
    return r;
  });
  app.post('/api/admin/review/:id', async (req) => {
    const { id } = req.params as any; const { status, resolution } = req.body as any;
    if (!['pendente', 'resolvido', 'recusado'].includes(status)) throw new ValidationError(['Estado inválido.']);
    const r = db.run('UPDATE review_item SET status = ?, resolution = ?, updated_at = ? WHERE id = ?', [status, resolution ?? null, new Date().toISOString(), id]);
    if (!r.changes) throw new NotFoundError('Item não encontrado');
    log(db, ctxOf(req), 'update', 'review_item', id, null, { status, resolution });
    return { ok: true };
  });

  app.post('/api/admin/link/:table', async (req) => upsertLink(db, ctxOf(req), (req.params as any).table, req.body as any));
  app.delete('/api/admin/link/:table', async (req) => deleteLink(db, ctxOf(req), (req.params as any).table, req.body as any));
  app.post('/api/admin/:type', async (req, reply) => { const r = createEntity(db, ctxOf(req), (req.params as any).type, req.body as any); return reply.code(201).send(r); });
  app.patch('/api/admin/:type/:id', async (req) => { const { type, id } = req.params as any; return updateEntity(db, ctxOf(req), type, id, req.body as any); });
  app.delete('/api/admin/:type/:id', async (req) => { const { type, id } = req.params as any; return removeEntity(db, ctxOf(req), type, id); });
  app.post('/api/admin/:type/:id/restore', async (req) => { const { type, id } = req.params as any; return removeEntity(db, ctxOf(req), type, id, true); });
  void ENTITIES; void LINKS;

  // ---------- front-end estático (produção) ----------
  if (cfg.staticDir && existsSync(cfg.staticDir)) {
    app.register(fstatic, { root: cfg.staticDir, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.code(404).send({ error: 'Rota não encontrada' });
      return reply.type('text/html').send(readFileSync(join(cfg.staticDir!, 'index.html')));
    });
  }
  return app;
}

/** Relatório de inconsistências e lacunas, gerado a partir dos itens de revisão + auditoria de integridade. */
export function inconsistenciesMarkdown(db: Db): string {
  const items = db.all<any>('SELECT * FROM review_item ORDER BY kind, title');
  const audit = auditIntegrity(db);
  const sec: Record<string, string> = { contradicao: 'Contradições e incoerências', ambiguidade: 'Ambiguidades de extração', lacuna: 'Lacunas documentais', identidade: 'Identidade / homônimos / possíveis duplicatas',
    proposta_relacao: 'Propostas de relação (não aplicadas)', privacidade: 'Decisões de privacidade', nao_importado: 'Menções não convertidas em registros', conflito_importacao: 'Conflitos de importação' };
  const L = ['# Relatório de inconsistências e lacunas documentais', '', `Gerado em ${new Date().toISOString()} a partir dos itens de revisão da importação e da auditoria de integridade.`, ''];
  for (const [k, title] of Object.entries(sec)) {
    const xs = items.filter((i) => i.kind === k); if (!xs.length) continue;
    L.push(`## ${title} (${xs.length})`, '');
    for (const i of xs) L.push(`- **${i.title}** — _${i.status}_${i.section ? ` (relatório, seção ${i.section})` : ''}`, ...(i.detail ? [`  ${i.detail}`] : []), ...(i.quote ? [`  > ${i.quote}`] : []));
    L.push('');
  }
  L.push(`## Auditoria de integridade do banco (${audit.summary.erro} erro(s), ${audit.summary.aviso} aviso(s), ${audit.summary.info} informação(ões))`, '');
  for (const i of audit.issues.filter((x) => x.severity !== 'info')) L.push(`- [${i.severity}] ${i.message}`);
  return L.join('\n') + '\n';
}
