// Normalização e busca tolerante para nomes italianos/brasileiros (Giovannitti ≈ Giovanitti ≈ Joanitti ≈ Joanite).

/** minúsculas, sem acentos, só letras/dígitos/espaços. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Chave fonética simplificada para o domínio ítalo-brasileiro. Não é uma prova de identidade — só ajuda a busca. */
export function phoneticKey(token: string): string {
  let t = fold(token).replace(/ /g, '');
  if (!t) return '';
  t = t.replace(/^gio/, 'jo').replace(/^gi(?=[aou])/, 'j').replace(/^joh/, 'jo');
  t = t.replace(/ph/g, 'f').replace(/ck|ch/g, 'c').replace(/y/g, 'i').replace(/k/g, 'c').replace(/w/g, 'v').replace(/h/g, '');
  t = t.replace(/([aeiou])v([aeiou])/g, '$1$2');       // Giovanitti → Joanitti (elisão do -v-)
  t = t.replace(/(.)\1+/g, '$1');                         // consoantes/vogais duplas
  t = t.replace(/[eo]$/, 'i');                            // terminações -e/-o/-i oscilam (Joanitte, Giovannitto)
  return t;
}

export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export const tokens = (s: string) => fold(s).split(' ').filter(Boolean);

/** Similaridade [0..1] entre dois tokens. */
export function tokenScore(q: string, t: string): number {
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.startsWith(q) && q.length >= 2) return 0.9;
  const pq = phoneticKey(q), pt = phoneticKey(t);
  if (pq && pq === pt) return 0.85;
  if (pt.startsWith(pq) && pq.length >= 3) return 0.75;
  const d = levenshtein(pq, pt, 2);
  if (pq.length >= 4 && d <= 1) return 0.7;
  if (pq.length >= 7 && d <= 2) return 0.55;
  const d2 = levenshtein(q, t, 2);
  if (q.length >= 4 && d2 <= 1) return 0.7;
  return 0;
}

/**
 * Pontuação de uma consulta contra um texto (ex.: nome + variantes + lugares).
 * Todos os termos da consulta precisam casar com algo (E lógico). Retorna 0 se algum não casar.
 */
export function searchScore(query: string, text: string): number {
  const qs = tokens(query);
  if (!qs.length) return 0;
  const ts = tokens(text);
  if (!ts.length) return 0;
  let sum = 0;
  for (const q of qs) {
    let best = 0;
    for (const t of ts) {
      const s = tokenScore(q, t);
      if (s > best) best = s;
      if (best === 1) break;
    }
    if (best === 0) return 0;
    sum += best;
  }
  return sum / qs.length;
}

/** Slug estável (ids e import_keys). */
export const slug = (s: string) => fold(s).replace(/ /g, '-').slice(0, 80);
