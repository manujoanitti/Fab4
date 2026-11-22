import { describe, expect, it } from 'vitest';
import { formatFuzzyDate, parsePartial, sortKey, validateFuzzyDate, yearRange } from '../shared/dates';
import { phoneticKey, searchScore, fold, levenshtein } from '../shared/names';
import { ancestorsOf, descendantsOf, siblingsOf, validateRelationship, wouldCreateCycle, type RelLite } from '../shared/integrity';
import { isPrivatePerson } from '../server/snapshot';

const F = (a: string, b: string, status: any = 'documentado'): RelLite => ({ type: 'filiacao', a, b, status });

describe('datas incertas', () => {
  it('interpreta datas parciais e rejeita inválidas', () => {
    expect(parsePartial('1884-01-07')).toEqual({ y: 1884, m: 1, d: 7 });
    expect(parsePartial('1869')).toEqual({ y: 1869, m: undefined, d: undefined });
    expect(parsePartial('1900-02-30')).toBeNull(); expect(parsePartial('1900-13')).toBeNull(); expect(parsePartial('abc')).toBeNull();
  });
  it('formata aproximações, intervalos, décadas e datas ausentes', () => {
    expect(formatFuzzyDate({ from: '1888', precision: 'circa' })).toBe('c. 1888');
    expect(formatFuzzyDate({ from: '1888', to: '1909', precision: 'intervalo' })).toBe('1888–1909');
    expect(formatFuzzyDate({ from: '1940', to: '1949', precision: 'decada' })).toBe('década de 1940');
    expect(formatFuzzyDate({ from: '1884-01-07', precision: 'exata' })).toBe('07/01/1884');
    expect(formatFuzzyDate({ precision: 'desconhecida' })).toBe('data desconhecida');
    expect(formatFuzzyDate({ precision: 'desconhecida', text: 'século XX' })).toBe('século XX');
  });
  it('ordena (sem data por último) e calcula intervalo de anos', () => {
    expect(sortKey({ from: '1869' })).toBeLessThan(sortKey({ from: '1909-03' })); expect(sortKey({ precision: 'desconhecida' } as any)).toBe(Infinity);
    expect(yearRange({ from: '1940', to: '1949', precision: 'decada' })).toEqual([1940, 1949]); expect(yearRange({ from: '1888', to: '1909', precision: 'intervalo' })).toEqual([1888, 1909]);
  });
  it('valida coerência', () => {
    expect(validateFuzzyDate({ from: '1910', to: '1900', precision: 'intervalo' })).not.toHaveLength(0);
    expect(validateFuzzyDate({ from: '1900', precision: 'intervalo' })).not.toHaveLength(0);
    expect(validateFuzzyDate({ precision: 'ano' })).not.toHaveLength(0);
    expect(validateFuzzyDate({ from: '1900', precision: 'ano' })).toHaveLength(0);
  });
});

describe('nomes e busca tolerante', () => {
  it('normaliza acentos e pontuação', () => expect(fold('Januário  Joanitti!')).toBe('januario joanitti'));
  it('chave fonética aproxima Giovanitti ↔ Joanitti ↔ Joanitte ↔ Joanite ↔ Giovannitto', () => {
    const keys = ['Giovanitti', 'Giovannitti', 'Giovannitto', 'Joanitti', 'Joanitte', 'Joanite'].map(phoneticKey);
    expect(new Set(keys).size).toBeLessThanOrEqual(2);
    expect(phoneticKey('Joanitti')).toBe(phoneticKey('Giovanitti'));
  });
  it('não confunde sobrenomes diferentes', () => { expect(searchScore('Joanitti', 'Montefusco')).toBe(0); expect(searchScore('Rossi', 'Bianchi')).toBe(0); });
  it('encontra variantes por qualquer grafia e exige todos os termos', () => {
    for (const q of ['Joanite', 'giovanitti', 'Giovannitto', 'joanite montefusco']) expect(searchScore(q, 'Zelinda Joanitte Montefusco')).toBeGreaterThan(0);
    expect(searchScore('zelinda silva', 'Zelinda Joanitte Montefusco')).toBe(0);
  });
  it('tolera erros de digitação pequenos', () => { expect(searchScore('Oratinno', 'Oratino')).toBeGreaterThan(0); expect(levenshtein('abc', 'abd')).toBe(1); });
});

describe('integridade genealógica', () => {
  it('impede ciclo (pessoa ancestral de si mesma)', () => {
    const rels = [F('a', 'b'), F('b', 'c')];
    expect(wouldCreateCycle(rels, 'c', 'a')).toBe(true); expect(wouldCreateCycle(rels, 'a', 'a')).toBe(true); expect(wouldCreateCycle(rels, 'a', 'c')).toBe(false);
    expect(validateRelationship(rels, F('c', 'a')).errors.join()).toMatch(/ciclo/);
  });
  it('relação descartada não conta como parentesco', () => {
    const rels = [F('a', 'b', 'descartado'), F('b', 'c')];
    expect(wouldCreateCycle(rels, 'c', 'a')).toBe(false); expect(descendantsOf(rels, 'a').size).toBe(0); expect(ancestorsOf(rels, 'c').has('a')).toBe(false);
  });
  it('filiação desconhecida/indeterminada é aceita; duplicatas e auto-relação não', () => {
    expect(validateRelationship([], { type: 'filiacao', subtype: 'indeterminada', a: 'a', b: 'b', status: 'nao_confirmado' }).errors).toHaveLength(0);
    expect(validateRelationship([F('a', 'b')], F('a', 'b')).errors.join()).toMatch(/Já existe/); expect(validateRelationship([], F('a', 'a')).errors.length).toBeGreaterThan(0);
    expect(validateRelationship([{ type: 'casamento', a: 'a', b: 'b', status: 'documentado' }], { type: 'casamento', a: 'b', b: 'a', status: 'documentado' }).errors.join()).toMatch(/Já existe/);
  });
  it('proíbe casamento entre ascendente e descendente', () => {
    expect(validateRelationship([F('a', 'b')], { type: 'casamento', a: 'a', b: 'b', status: 'documentado' }).errors.join()).toMatch(/ascendente/);
  });
  it('avisa sobre idades improváveis (sem bloquear: datas são incertas)', () => {
    const persons = new Map([['p', { id: 'p', birthYear: 1900 }], ['c', { id: 'c', birthYear: 1905 }], ['q', { id: 'q', birthYear: 1850, deathYear: 1860 }]]);
    expect(validateRelationship([], F('p', 'c'), persons)).toMatchObject({ errors: [], warnings: [expect.stringMatching(/improvável/)] });
    expect(validateRelationship([], F('q', 'c'), persons).warnings.join()).toMatch(/faleceu/);
  });
  it('irmandade é derivada das filiações (meio-irmãos detectados)', () => {
    const rels = [F('p1', 'x'), F('p2', 'x'), F('p1', 'y'), F('p2', 'y'), F('p1', 'z')];
    const sib = siblingsOf(rels, 'x'); expect(sib.find((s) => s.id === 'y')?.half).toBe(false); expect(sib.find((s) => s.id === 'z')?.half).toBe(true);
  });
});

describe('privacidade', () => {
  it('vivos, possivelmente vivos e indeterminados recentes são privados', () => {
    expect(isPrivatePerson({ living_status: 'vivo' })).toBe(true); expect(isPrivatePerson({ living_status: 'possivelmente_vivo' })).toBe(true);
    expect(isPrivatePerson({ living_status: 'falecido' })).toBe(false); expect(isPrivatePerson({ living_status: 'presumido_falecido', birth_from: '1911' })).toBe(false);
    expect(isPrivatePerson({ living_status: 'desconhecido', birth_from: '1950' })).toBe(true); expect(isPrivatePerson({ living_status: 'desconhecido', birth_from: '1850' })).toBe(false);
    expect(isPrivatePerson({ living_status: 'desconhecido' })).toBe(true);
  });
});

import { gedcomDate } from '../server/export/gedcom';
describe('datas no GEDCOM', () => {
  it('converte aproximações, intervalos e datas exatas', () => {
    expect(gedcomDate('1888', null, 'circa')).toBe('ABT 1888'); expect(gedcomDate('1888', '1909', 'intervalo')).toBe('BET 1888 AND 1909'); expect(gedcomDate('1940', '1949', 'decada')).toBe('BET 1940 AND 1949');
    expect(gedcomDate('1884-01-07', null, 'exata')).toBe('7 JAN 1884'); expect(gedcomDate('1884-03', null, 'mes')).toBe('MAR 1884'); expect(gedcomDate(null, null, 'desconhecida')).toBeNull();
  });
});
