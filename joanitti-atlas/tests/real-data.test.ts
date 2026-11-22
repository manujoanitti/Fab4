// Roda somente quando os dados reais existem localmente (data/real/ é ignorado pelo git — repositório público).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDb } from '../server/db/connection';
import { runImport } from '../server/import/importer';
import { loadSnapshot } from '../server/snapshot';
import { auditIntegrity } from '../server/audit';
import { searchScore } from '../shared/names';

const real = join(__dirname, '..', 'data', 'real');
const has = existsSync(join(real, 'extracao', 'index.ts'));

describe.skipIf(!has)('dados reais do relatório (local)', async () => {
  const { pacote, REPORT_FILE } = has ? await import(join(real, 'extracao', 'index.ts')) : ({} as any);
  const text = has ? readFileSync(join(real, REPORT_FILE), 'utf8') : '';
  const db = openDb(':memory:');
  const audit = has ? runImport(db, pacote, text, { mode: 'apply', actor: 'teste' }) : (null as any);
  const snap = has ? loadSnapshot(db, 'admin') : (null as any);

  it('todas as citações do pacote existem no texto original do relatório', () => { expect(audit.quotes.failed).toEqual([]); expect(audit.quotes.checked).toBeGreaterThan(100); });
  it('reimportar não duplica nada', () => {
    const again = runImport(db, pacote, text, { mode: 'apply', actor: 'teste' });
    expect(Object.values(again.counts).every((c: any) => c.created === 0 && c.updated === 0 && c.conflicts === 0)).toBe(true);
  });
  it('nenhuma filiação/casamento foi criada a partir de índice: só 1 relação (parentesco inferido, hipótese)', () => {
    expect(snap.relationships).toHaveLength(1); expect(snap.relationships[0]).toMatchObject({ type: 'parentesco_inferido', status: 'hipotese_plausivel' });
    expect(snap.relationships.some((r: any) => ['filiacao', 'casamento', 'uniao'].includes(r.type))).toBe(false);
  });
  it('o núcleo FamilySearch está em agrupamento investigativo com os 11 nomes indexados', () => {
    const g = snap.groups.find((x: any) => x.name.includes('GWQ9-XJG')); expect(g.memberIds).toHaveLength(11);
  });
  it('homônimos João Joanitti permanecem distintos, com hipótese de identidade', () => {
    const js = snap.persons.filter((p: any) => p.preferred_name === 'João Joanitti'); expect(js).toHaveLength(2);
    expect(snap.identityLinks.some((l: any) => l.status === 'hipotese_plausivel')).toBe(true);
  });
  it('estados do relatório não foram herdados cegamente (H1 rebaixada; ADCB 1712 não examinado)', () => {
    const h1 = snap.claims.find((c: any) => c.code === 'H1'); expect(h1.reported_status).toBe('Fortemente corroborado'); expect(h1.status).toBe('hipotese_plausivel');
    const adcb = snap.sources.find((s: any) => s.archival_ref === 'ADCB, Atti, relazione 1712'); expect(adcb.access_status).toBe('citada_nao_examinada');
    expect(snap.sources.filter((s: any) => s.kind === 'primaria' && s.access_status.startsWith('examinada'))).toHaveLength(0);
  });
  it('hipóteses descartadas (Joanito) preservadas; investigações obrigatórias presentes', () => {
    expect(snap.claims.find((c: any) => c.code === 'H8').status).toBe('descartado');
    const titles = snap.investigations.map((v: any) => v.question + ' ' + v.title).join(' | ');
    for (const t of ['município de nascimento do imigrante', 'efetivamente o pai de João Joanitti', 'escultores', 'primeira vez o sobrenome Joanitti']) expect(titles.toLowerCase()).toContain(t.toLowerCase());
  });
  it('busca tolerante encontra o núcleo por qualquer variante', () => {
    for (const q of ['Giovanitti', 'Joanite', 'Giovannitto']) expect(snap.persons.some((p: any) => searchScore(q, `${p.preferred_name} ${p.names.map((n: any) => n.name).join(' ')}`) > 0)).toBe(true);
  });
  it('visão pública não contém nomes de pessoas vivas; matrícula e CNPJ não foram importados', () => {
    const pub = JSON.stringify(loadSnapshot(db, 'public'));
    const priv = snap.persons.filter((p: any) => p.isPrivate); expect(priv.length).toBeGreaterThan(5);
    const publicNames = snap.persons.filter((p: any) => !p.isPrivate).map((p: any) => `${p.preferred_name} ${p.names.map((n: any) => n.name).join(' ')}`).join(' ').toLowerCase();
    for (const p of priv) {
      expect(pub).not.toContain(p.preferred_name);
      for (const n of p.names) if (n.name.split(' ').length > 1) expect(pub).not.toContain(n.name);
      const first = (p.given_names ?? '').split(' ')[0];
      if (first.length >= 6 && !publicNames.includes(first.toLowerCase())) expect(pub).not.toContain(first);
    }
    const raw = JSON.stringify(snap); expect(raw).not.toContain('2544-5'); expect(raw).not.toContain('08.493.862');
  });
  it('banco real passa na auditoria sem erros de integridade', () => { expect(auditIntegrity(db).summary.erro).toBe(0); });
  it('o relatório original está preservado integralmente no banco', () => { expect(db.get<any>('SELECT content FROM report').content).toBe(text); });
});
