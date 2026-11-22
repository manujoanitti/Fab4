import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { openDb } from '../server/db/connection';
import { buildApp } from '../server/app';
import { runImport } from '../server/import/importer';
import { REPORT, pkg } from './fixtures/rossi';

const TOKEN = 'token-de-teste-1234567890';
let app: FastifyInstance; let db: ReturnType<typeof openDb>;
const auth = { authorization: `Bearer ${TOKEN}` };
const j = (r: any) => JSON.parse(r.body);

beforeAll(() => {
  db = openDb(':memory:'); runImport(db, pkg(), REPORT, { mode: 'apply', actor: 'teste' });
  app = buildApp(db, { adminToken: TOKEN, publicRead: true, backupDir: '/tmp/atlas-test-backups' });
});

describe('autenticação e privacidade', () => {
  it('leitura pública é permitida; escrita exige token', async () => {
    expect((await app.inject('/api/snapshot')).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/admin/person', payload: { preferred_name: 'x' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/admin/person', payload: { preferred_name: 'x' }, headers: { authorization: 'Bearer errado' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/admin/integrity' })).statusCode).toBe(401);
  });
  it('visão pública oculta pessoa viva (nome, datas, notas, eventos, fontes e afirmações ligadas)', async () => {
    const pub = j(await app.inject('/api/snapshot')); const raw = JSON.stringify(pub);
    expect(raw).not.toContain('Paola'); expect(raw).not.toContain('dado privado'); expect(raw).not.toContain('Registro sobre Paola'); expect(raw).not.toContain('Paola trabalha');
    const anon = pub.persons.find((p: any) => p.id === 'per_paola'); expect(anon).toMatchObject({ redacted: true, birth_from: null, notes: null });
    expect(pub.claims.find((c: any) => c.code === 'H2').content).toMatch(/ocult/); expect(pub.investigations.find((v: any) => v.id === 'inv_inv2').redacted).toBe(true);
    expect(pub.reviewItems).toEqual([]); expect(pub.reports).toEqual([]);
    expect(pub.persons.find((p: any) => p.id === 'per_giuseppe').preferred_name).toBe('Giuseppe Rossi'); // falecidos permanecem visíveis
  });
  it('administrador vê tudo; "ver como público" aplica a redação', async () => {
    const adm = j(await app.inject({ url: '/api/snapshot', headers: auth })); expect(JSON.stringify(adm)).toContain('Paola'); expect(adm.reviewItems.length).toBeGreaterThan(0);
    const prev = j(await app.inject({ url: '/api/snapshot?view=public', headers: auth })); expect(JSON.stringify(prev)).not.toContain('Paola');
  });
  it('busca pública também não vaza pessoa viva', async () => {
    expect(j(await app.inject('/api/search?q=paola'))).toEqual([]); expect(j(await app.inject({ url: '/api/search?q=paola', headers: auth })).length).toBeGreaterThan(0);
  });
  it('modo privado (ATLAS_PUBLIC_READ=0) exige autenticação até para leitura', async () => {
    const priv = buildApp(db, { adminToken: TOKEN, publicRead: false, backupDir: '/tmp/atlas-test-backups' });
    expect((await priv.inject('/api/snapshot')).statusCode).toBe(401); expect((await priv.inject({ url: '/api/snapshot', headers: auth })).statusCode).toBe(200);
  });
});

describe('edição validada', () => {
  it('rejeita relação circular e auto-relação; aceita filiação desconhecida', async () => {
    const post = (b: any) => app.inject({ method: 'POST', url: '/api/admin/relationship', headers: auth, payload: b });
    const circ = await post({ type: 'filiacao', person_a: 'per_antonio1', person_b: 'per_giuseppe', status: 'documentado' }); expect(circ.statusCode).toBe(400); expect(circ.body).toMatch(/ciclo/);
    expect((await post({ type: 'filiacao', person_a: 'per_luigi', person_b: 'per_luigi', status: 'documentado' })).statusCode).toBe(400);
    expect((await post({ type: 'filiacao', subtype: 'indeterminada', person_a: 'per_luigi', person_b: 'per_antonio2', status: 'nao_confirmado' })).statusCode).toBe(201);
  });
  it('valida datas e hierarquia de lugares', async () => {
    const bad = await app.inject({ method: 'POST', url: '/api/admin/person', headers: auth, payload: { preferred_name: 'X', birth_from: '1900', birth_to: '1890', birth_precision: 'intervalo' } }); expect(bad.statusCode).toBe(400);
    const pl = await app.inject({ method: 'POST', url: '/api/admin/place', headers: auth, payload: { name: 'Vila', level: 'pais', parent_id: 'pl_roma' } }); expect(pl.statusCode).toBe(400);
    const vivo = await app.inject({ method: 'POST', url: '/api/admin/person', headers: auth, payload: { preferred_name: 'Y', living_status: 'vivo', death_from: '2000', death_precision: 'ano' } }); expect(vivo.statusCode).toBe(400);
  });
  it('mudança de estado gera histórico e aviso se não há evidência favorável', async () => {
    const c = await app.inject({ method: 'POST', url: '/api/admin/status/claim/cl_h1', headers: auth, payload: { status: 'documentado', note: 'teste' } }); expect(c.statusCode).toBe(200); expect(j(c).warnings.join()).toMatch(/nenhuma evidência favorável/);
    const log = j(await app.inject({ url: '/api/admin/changelog?entity_type=claim&entity_id=cl_h1', headers: auth })); expect(log[0].action).toBe('status');
  });
  it('nunca apaga: DELETE arquiva e é reversível', async () => {
    const created = j(await app.inject({ method: 'POST', url: '/api/admin/person', headers: auth, payload: { preferred_name: 'Temporário', living_status: 'falecido' } })).row;
    await app.inject({ method: 'DELETE', url: `/api/admin/person/${created.id}`, headers: auth });
    expect(j(await app.inject('/api/snapshot')).persons.some((p: any) => p.id === created.id)).toBe(false); expect(db.get('SELECT 1 x FROM person WHERE id=?', [created.id])).toBeTruthy();
    expect((await app.inject({ method: 'POST', url: `/api/admin/person/${created.id}/restore`, headers: auth })).statusCode).toBe(200);
    expect(j(await app.inject('/api/snapshot')).persons.some((p: any) => p.id === created.id)).toBe(true);
  });
  it('ligações e evidências podem ser criadas e removidas (com registro)', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/admin/link/person_nucleus', headers: auth, payload: { person_id: 'per_luigi', nucleus_id: 'nuc_rossi' } })).statusCode).toBe(200);
    const ev = j(await app.inject({ method: 'POST', url: '/api/admin/evidence', headers: auth, payload: { subject_type: 'person', subject_id: 'per_luigi', source_id: 'src_arq', stance: 'favoravel', excerpt: 'livro 12' } })).row;
    expect((await app.inject({ method: 'DELETE', url: `/api/admin/evidence/${ev.id}`, headers: auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/admin/evidence', headers: auth, payload: { subject_type: 'person', subject_id: 'per_luigi', source_id: 'src_inexistente' } })).statusCode).toBe(400);
  });
});

describe('exportação, backup e restauração', () => {
  it('GEDCOM: famílias só com relações confiáveis; hipóteses viram NOTE; vivos excluídos', async () => {
    const ged = (await app.inject({ url: '/api/export/gedcom', headers: auth })).body;
    expect(ged).toMatch(/^0 HEAD/); expect(ged).toContain('0 TRLR'); expect(ged).toContain('Giuseppe /Rossi/'); expect(ged).not.toContain('Paola');
    expect(ged).toMatch(/1 HUSB @I\d+@/); expect(ged).toMatch(/1 CHIL @I\d+@/); expect(ged).toContain('1 BIRT'); expect(ged).toContain('2 DATE 1880'); expect(ged).toMatch(/NOTE Evento não exportado como fato \(Hipótese plausível\)/);
    const withLiving = (await app.inject({ url: '/api/export/gedcom?includeLiving=1', headers: auth })).body; expect(withLiving).toContain('Paola');
    const pubLiving = (await app.inject({ url: '/api/export/gedcom?includeLiving=1' })).body; expect(pubLiving).not.toContain('Paola'); // público nunca inclui vivos
    const hyp = (await app.inject({ url: '/api/export/gedcom?minStatus=nao_confirmado', headers: auth })).body; expect(hyp.split('\n').filter((l) => / FAM\r?$/.test(l)).length).toBeGreaterThan(0);
  });
  it('CSV com BOM e separador configurável', async () => {
    const r = await app.inject({ url: '/api/export/csv/pessoas', headers: auth }); expect(r.body.charCodeAt(0)).toBe(0xfeff); expect(r.body).toContain('id;nome;'); expect(r.body).toContain('Giuseppe Rossi');
    expect((await app.inject({ url: '/api/export/csv/pessoas?sep=comma' })).body).toContain('id,nome,'); expect((await app.inject('/api/export/csv/invalida')).statusCode).toBe(404);
    expect((await app.inject('/api/export/csv/pessoas')).body).not.toContain('Paola');
  });
  it('backup JSON e restauração reproduzem o banco (round-trip)', async () => {
    const dump = j(await app.inject({ url: '/api/admin/export/backup.json', headers: auth })); expect(dump.format).toBe('joanitti-atlas-backup'); expect(dump.counts.person).toBeGreaterThan(5);
    const before = JSON.stringify(j(await app.inject({ url: '/api/snapshot', headers: auth })).persons.map((p: any) => [p.id, p.preferred_name]));
    db.run('DELETE FROM evidence'); expect(db.get<any>('SELECT COUNT(*) n FROM evidence').n).toBe(0);
    const res = await app.inject({ method: 'POST', url: '/api/admin/restore', headers: auth, payload: dump }); expect(res.statusCode).toBe(200);
    expect(db.get<any>('SELECT COUNT(*) n FROM evidence').n).toBe(dump.counts.evidence);
    expect(JSON.stringify(j(await app.inject({ url: '/api/snapshot', headers: auth })).persons.map((p: any) => [p.id, p.preferred_name]))).toBe(before);
    expect((await app.inject({ method: 'POST', url: '/api/admin/restore', headers: auth, payload: { x: 1 } })).statusCode).toBe(400);
  });
  it('importação pela API: pré-visualiza e consolida', async () => {
    const db2 = openDb(':memory:'); const a2 = buildApp(db2, { adminToken: TOKEN, publicRead: true, backupDir: '/tmp/atlas-test-backups' });
    const dry = j(await a2.inject({ method: 'POST', url: '/api/admin/import', headers: auth, payload: { package: pkg(), reportText: REPORT, mode: 'dry_run' } })); expect(dry.counts.person.created).toBe(6);
    expect(db2.get<any>('SELECT COUNT(*) n FROM person').n).toBe(0);
    await a2.inject({ method: 'POST', url: '/api/admin/import', headers: auth, payload: { package: pkg(), reportText: REPORT, mode: 'apply' } }); expect(db2.get<any>('SELECT COUNT(*) n FROM person').n).toBe(6);
    const again = j(await a2.inject({ method: 'POST', url: '/api/admin/import', headers: auth, payload: { package: pkg(), reportId: dry.reportId, mode: 'apply' } })); expect(again.counts.person.unchanged).toBe(6);
    expect((await a2.inject({ method: 'POST', url: '/api/admin/import', headers: auth, payload: { package: { x: 1 }, reportText: REPORT } })).statusCode).toBe(400);
  });
  it('relatório de inconsistências e auditoria de integridade', async () => {
    const md = (await app.inject({ url: '/api/admin/inconsistencias.md', headers: auth })).body; expect(md).toContain('# Relatório de inconsistências'); expect(md).toContain('Homônimos Antonio Rossi');
    const a = j(await app.inject({ url: '/api/admin/integrity', headers: auth })); expect(a.summary).toHaveProperty('aviso');
  });
});

describe('defesa em profundidade da privacidade', () => {
  it('remove nome de pessoa viva até de textos livres (descrição de lugar, notas de fonte)', async () => {
    db.run("UPDATE place SET description = 'Cidade onde Paola Rossi trabalha.' WHERE id = 'pl_campinas'");
    db.run("UPDATE source SET notes = 'Contato: Paola Rossi' WHERE id = 'src_arq'");
    const pub = JSON.stringify(j(await app.inject('/api/snapshot')));
    expect(pub).not.toContain('Paola Rossi'); expect(pub).toContain('pessoa viva');
    expect(JSON.stringify(j(await app.inject({ url: '/api/snapshot', headers: auth }))).includes('Paola Rossi')).toBe(true);
  });
});
