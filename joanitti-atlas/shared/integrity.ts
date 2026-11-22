// Regras de integridade genealógica (puras, testáveis). Relações "descartadas" não contam como parentesco válido.
import type { RelType, Status } from './types';

export interface RelLite { id?: string; type: RelType; a: string; b: string; status: Status; subtype?: string | null }
export interface PersonLite { id: string; birthYear?: number | null; deathYear?: number | null }
export interface Validation { errors: string[]; warnings: string[] }

const active = (r: RelLite) => r.status !== 'descartado';
const SYMMETRIC: RelType[] = ['casamento', 'uniao', 'parentesco_inferido', 'desconhecida'];

export function childrenIndex(rels: RelLite[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rels) if (r.type === 'filiacao' && active(r)) (m.get(r.a) ?? m.set(r.a, []).get(r.a)!).push(r.b);
  return m;
}
export function parentsIndex(rels: RelLite[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rels) if (r.type === 'filiacao' && active(r)) (m.get(r.b) ?? m.set(r.b, []).get(r.b)!).push(r.a);
  return m;
}

/** Conjunto de descendentes (qualquer grau) de `id` por filiações válidas. */
export function descendantsOf(rels: RelLite[], id: string, max = Infinity): Set<string> {
  const ch = childrenIndex(rels);
  const seen = new Set<string>();
  let frontier = [id];
  for (let d = 0; d < max && frontier.length; d++) {
    const next: string[] = [];
    for (const p of frontier) for (const c of ch.get(p) ?? []) if (!seen.has(c)) { seen.add(c); next.push(c); }
    frontier = next;
  }
  return seen;
}
export function ancestorsOf(rels: RelLite[], id: string, max = Infinity): Set<string> {
  const pa = parentsIndex(rels);
  const seen = new Set<string>();
  let frontier = [id];
  for (let d = 0; d < max && frontier.length; d++) {
    const next: string[] = [];
    for (const c of frontier) for (const p of pa.get(c) ?? []) if (!seen.has(p)) { seen.add(p); next.push(p); }
    frontier = next;
  }
  return seen;
}

/** Criar filiação parent→child fecharia um ciclo (alguém seria ancestral de si mesmo)? */
export function wouldCreateCycle(rels: RelLite[], parent: string, child: string): boolean {
  if (parent === child) return true;
  return descendantsOf(rels, child).has(parent);
}

/** Irmandade é DERIVADA de filiações em comum (nunca armazenada). Meio-irmãos: só um genitor em comum. */
export function siblingsOf(rels: RelLite[], id: string): { id: string; half: boolean }[] {
  const pa = parentsIndex(rels), ch = childrenIndex(rels);
  const mine = new Set(pa.get(id) ?? []);
  const count = new Map<string, number>();
  for (const p of mine) for (const c of ch.get(p) ?? []) if (c !== id) count.set(c, (count.get(c) ?? 0) + 1);
  return [...count].map(([sid, n]) => ({ id: sid, half: n < mine.size }));
}

export function validateRelationship(
  existing: RelLite[], cand: RelLite, persons: Map<string, PersonLite> = new Map(),
): Validation {
  const errors: string[] = [], warnings: string[] = [];
  if (cand.a === cand.b) errors.push('Uma pessoa não pode ter relação consigo mesma.');
  const others = existing.filter((r) => r.id === undefined || r.id !== cand.id);

  const dup = others.some((r) => r.type === cand.type && (
    r.a === cand.a && r.b === cand.b || (SYMMETRIC.includes(cand.type) && r.a === cand.b && r.b === cand.a)));
  if (dup) errors.push('Já existe uma relação do mesmo tipo entre essas pessoas.');

  if (active(cand) && cand.a !== cand.b) {
    if (cand.type === 'filiacao') {
      if (wouldCreateCycle(others, cand.a, cand.b)) errors.push('Relação inválida: criaria um ciclo (uma pessoa seria ancestral de si mesma).');
      const bio = others.filter((r) => r.type === 'filiacao' && active(r) && r.b === cand.b && (r.subtype ?? 'indeterminada') === 'biologica').length;
      if ((cand.subtype ?? 'indeterminada') === 'biologica' && bio >= 2) warnings.push('A pessoa já possui dois genitores biológicos registrados.');
      const pa = persons.get(cand.a), ch = persons.get(cand.b);
      if (pa?.birthYear != null && ch?.birthYear != null) {
        if (pa.birthYear >= ch.birthYear) warnings.push(`Genitor(a) nasceu em ${pa.birthYear}, não antes do(a) filho(a) (${ch.birthYear}).`);
        else if (ch.birthYear - pa.birthYear < 12) warnings.push(`Diferença de idade improvável (${ch.birthYear - pa.birthYear} anos) entre genitor(a) e filho(a).`);
      }
      if (pa?.deathYear != null && ch?.birthYear != null && ch.birthYear - pa.deathYear > 1) warnings.push('Genitor(a) faleceu mais de um ano antes do nascimento do(a) filho(a).');
    }
    if (cand.type === 'casamento' || cand.type === 'uniao') {
      if (descendantsOf(others, cand.a).has(cand.b) || descendantsOf(others, cand.b).has(cand.a)) {
        errors.push('Casamento/união entre ascendente e descendente direto não é permitido.');
      }
    }
  }
  return { errors, warnings };
}
