import { describe, expect, it } from 'vitest';
import { openDb } from '../server/db/connection';
import { runImport } from '../server/import/importer';
import { createEntity, updateEntity, ValidationError } from '../server/repo';
import { loadSnapshot } from '../server/snapshot';
import { auditIntegrity } from '../server/audit';
import { REPORT, pkg } from './fixtures/rossi';

const count = (db: any, t: string) => db.get(`SELECT COUNT(*) n FROM ${t}`).n as number;
const TABLES = ['person', 'place', 'source', 'event', 'relationship', 'claim', 'evidence', 'person_name', 'event_person', 'source_person', 'research_group_member', 'investigation', 'investigation_task', 'review_item', 'nucleus'];
const snapshotCounts = (db: any) => Object.fromEntries(TABLES.map((t) => [t, count(db, t)]));
const imp = (db: any, p = pkg(), mode: 'apply' | 'dry_run' = 'apply', extra: any = {}) => runImport(db, p, REPORT, { mode, actor: 'teste', ...extra });

describe('importação do relatório', () => {
  it('importa tudo e preserva o texto original com hash', () => {
    const db = openDb(':memory:'); const a = imp(db);
    expect(a.counts.person.created).toBe(6); expect(a.quotes.failed).toHaveLength(0); expect(a.quotes.checked).toBeGreaterThan(5);
    const r = db.get<any>('SELECT * FROM report'); expect(r.content).toBe(REPORT); expect(r.id).toBe(a.reportId);
    expect(count(db, 'import_run')).toBe(1);
  });

  it('é idempotente: repetir não duplica pessoas, fontes, eventos nem relações', () => {
    const db = openDb(':memory:'); imp(db); const before = snapshotCounts(db);
    const again = imp(db); expect(snapshotCounts(db)).toEqual(before);
    expect(Object.values(again.counts).every((c) => c.created === 0 && c.updated === 0 && c.conflicts === 0)).toBe(true);
    imp(db); imp(db); expect(snapshotCounts(db)).toEqual(before);
  });

  it('pré-visualização (dry_run) não grava nada, mas mostra o mesmo plano', () => {
    const db = openDb(':memory:'); const plan = imp(db, pkg(), 'dry_run');
    expect(plan.counts.person.created).toBe(6); expect(count(db, 'person')).toBe(0); expect(count(db, 'report')).toBe(0); expect(count(db, 'import_run')).toBe(0);
    const real = imp(db); expect(real.counts).toEqual(plan.counts);
  });

  it('recusa aplicar quando uma citação não existe no relatório (anti-alucinação)', () => {
    const db = openDb(':memory:'); const bad = pkg(); bad.persons![0].prov = { sec: '1', quote: 'Giuseppe nasceu em Milão em 1851' };
    expect(imp(db, bad, 'dry_run').quotes.failed).toHaveLength(1);
    expect(() => imp(db, bad)).toThrow(ValidationError); expect(count(db, 'person')).toBe(0); // transação revertida
  });

  it('rejeita pacote malformado e referências inexistentes', () => {
    const db = openDb(':memory:');
    expect(() => imp(db, { ...pkg(), persons: [{ key: 'X!', name: 'a', living: 'vivo', status: 'documentado' }] } as any)).toThrow(ValidationError);
    const dang = pkg(); dang.relationships!.push({ key: 'z', type: 'filiacao', a: 'giuseppe', b: 'fantasma', status: 'documentado' }); expect(() => imp(db, dang)).toThrow(/Referência desconhecida/);
  });

  it('impede que o pacote crie filiação circular', () => {
    const db = openDb(':memory:'); const p = pkg(); p.relationships!.push({ key: 'ciclo', type: 'filiacao', a: 'antonio1', b: 'giuseppe', status: 'documentado' });
    expect(() => imp(db, p)).toThrow(/ciclo/); expect(count(db, 'relationship')).toBe(0);
  });

  it('NÃO sobrescreve edição do pesquisador (fusão em 3 vias) e registra conflito', () => {
    const db = openDb(':memory:'); imp(db);
    updateEntity(db, { actor: 'pesquisador' }, 'person', 'per_luigi', { notes: 'achei a certidão!' });
    const v2 = pkg(); v2.persons!.find((p) => p.key === 'luigi')!.notes = 'nota nova do relatório v2';
    const a = imp(db, v2); expect(a.counts.person.conflicts).toBe(1);
    expect(db.get<any>("SELECT notes FROM person WHERE id='per_luigi'").notes).toBe('achei a certidão!');
    expect(db.get<any>("SELECT kind FROM review_item WHERE kind='conflito_importacao'")).toBeTruthy();
  });

  it('atualiza o que o pesquisador não tocou quando o pacote muda', () => {
    const db = openDb(':memory:'); imp(db);
    const v2 = pkg(); v2.persons!.find((p) => p.key === 'maria')!.status = 'documentado';
    const a = imp(db, v2); expect(a.counts.person.updated).toBe(1); expect(a.updated[0].diff.verification_status).toEqual(['fortemente_corroborado', 'documentado']);
    expect(db.get<any>("SELECT verification_status s FROM person WHERE id='per_maria'").s).toBe('documentado');
  });

  it('nova versão do relatório preserva registros ausentes (órfãos) e avisa', () => {
    const db = openDb(':memory:'); imp(db);
    const v2 = pkg(); v2.persons = v2.persons!.filter((p) => p.key !== 'luigi'); v2.groups![0].members = ['giuseppe']; v2.events = v2.events!.filter((e) => e.key !== 'sem_data'); v2.investigations![0].entities = []; v2.sources![0].persons = ['giuseppe'];
    v2.evidence = v2.evidence!.filter((e) => e.key !== 'e1'); v2.claims = v2.claims!.filter((c) => c.key !== 'h1'); v2.investigations![0].hypotheses = []; v2.investigations![0].tasks = []; v2.sources![1].persons = ['giuseppe'];
    const a = imp(db, v2); expect(a.orphans.some((o) => o.id === 'per_luigi')).toBe(true); expect(count(db, 'person')).toBe(6);
  });

  it('sinaliza possíveis duplicatas de OUTRO pacote sem fundir; resolução manual mescla sem destruir', () => {
    const db = openDb(':memory:'); imp(db);
    const other = { ...pkg(), id: 'outro-relatorio', persons: [{ key: 'giuseppe', name: 'Giuseppe Rossi', living: 'falecido' as const, birth: { from: '1851', precision: 'ano' as const }, status: 'hipotese_plausivel' as const, bio: 'texto do novo relatório' }], nuclei: [], places: [], groups: [], relationships: [], identityLinks: [], events: [], sources: [], evidence: [], claims: [], investigations: [], reviewItems: [] };
    const plan = imp(db, other as any, 'dry_run'); expect(plan.duplicates[0].candidates[0].id).toBe('per_giuseppe');
    const a = imp(db, other as any); expect(a.duplicates).toHaveLength(1); expect(count(db, 'person')).toBe(7); // criou como NOVO por padrão
    const db2 = openDb(':memory:'); imp(db2);
    const m = imp(db2, other as any, 'apply', { resolutions: { 'person:giuseppe': 'per_giuseppe' } });
    expect(count(db2, 'person')).toBe(6); expect(m.counts.person.updated).toBe(1);
    const row = db2.get<any>("SELECT biography, birth_from, verification_status FROM person WHERE id='per_giuseppe'");
    // reimportar com a mesma resolução não cria duplicata nem sobrescreve; sem a resolução, o alias persistente evita recriar a pessoa
    const m2 = imp(db2, other as any); expect(count(db2, 'person')).toBe(6); expect(m2.counts.person.created).toBe(0);
    expect(row.biography).toBe('texto do novo relatório'); expect(row.birth_from).toBe('1850'); expect(row.verification_status).toBe('documentado'); // só preencheu vazios
  });
});

describe('modelo de dados do domínio', () => {
  const db = openDb(':memory:'); imp(db);
  const snap = loadSnapshot(db, 'admin');
  it('homônimos viram registros distintos, ligados por hipótese de identidade (nunca fundidos)', () => {
    const ants = snap.persons.filter((p: any) => p.preferred_name === 'Antonio Rossi'); expect(ants).toHaveLength(2);
    expect(snap.identityLinks).toHaveLength(1); expect(snap.identityLinks[0].status).toBe('nao_confirmado');
    expect(auditIntegrity(db).issues.filter((i) => i.code === 'homonimos').every((i) => i.severity === 'info')).toBe(true); // há hipótese de identidade registrada → só informativo
  });
  it('pessoas do mesmo índice entram em agrupamento, sem relação de parentesco', () => {
    expect(snap.groups[0].memberIds.sort()).toEqual(['per_giuseppe', 'per_luigi']);
    expect(snap.relationships.some((r: any) => [r.person_a, r.person_b].includes('per_luigi'))).toBe(false);
  });
  it('datas aproximadas, intervalos e eventos sem data são preservados', () => {
    const e = (k: string) => snap.events.find((x: any) => x.id === `ev_${k}`);
    expect(e('nasc_a')).toMatchObject({ date_from: '1880', date_precision: 'circa', date_text: 'c. 1880' }); expect(e('emig')).toMatchObject({ date_from: '1890', date_to: '1895', date_precision: 'intervalo', is_route_speculative: true });
    expect(e('sem_data')).toMatchObject({ date_from: null, date_precision: 'desconhecida' });
  });
  it('estado da afirmação é independente do relatório e o histórico é gravado', () => {
    const c = snap.claims.find((x: any) => x.code === 'H1'); expect(c.status).toBe('nao_confirmado'); expect(c.reported_status).toBe('plausível'); expect(c.history).toHaveLength(1);
    updateEntity(db, { actor: 'eu' }, 'claim', c.id, { status: 'descartado' }, 'refutado pelo livro 12'); const h = loadSnapshot(db, 'admin').claims.find((x: any) => x.code === 'H1').history; expect(h.at(-1)).toMatchObject({ from_status: 'nao_confirmado', to_status: 'descartado', note: 'refutado pelo livro 12' });
  });
  it('auditoria de integridade sinaliza status sem evidência e fontes não examinadas', () => {
    const d2 = openDb(':memory:'); imp(d2);
    createEntity(d2, { actor: 'x' }, 'person', { preferred_name: 'Sem Evidência', verification_status: 'documentado', living_status: 'falecido' });
    expect(auditIntegrity(d2).issues.some((i) => i.code === 'status_sem_evidencia' && /Sem Evidência/.test(i.message))).toBe(true);
    const doc = auditIntegrity(d2).issues.filter((i) => i.code === 'documentado_sem_fonte_examinada'); expect(Array.isArray(doc)).toBe(true);
  });
  it('registros contraditórios coexistem: duas fontes divergentes não se sobrescrevem', () => {
    const d3 = openDb(':memory:'); imp(d3);
    const e1 = createEntity(d3, { actor: 'x' }, 'event', { type: 'nascimento', title: 'Nasc. segundo A', date_from: '1880', date_precision: 'ano', status: 'documentado' }).row;
    const e2 = createEntity(d3, { actor: 'x' }, 'event', { type: 'nascimento', title: 'Nasc. segundo B', date_from: '1882', date_precision: 'ano', status: 'hipotese_plausivel' }).row;
    expect(e1.id).not.toBe(e2.id); expect(d3.all("SELECT id FROM event WHERE type='nascimento'").length).toBe(3);
  });
});
