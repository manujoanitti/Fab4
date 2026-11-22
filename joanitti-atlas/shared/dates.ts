// Datas genealógicas incertas: intervalos, aproximações e eventos sem data.

export const DATE_PRECISIONS = ['exata', 'mes', 'ano', 'decada', 'circa', 'intervalo', 'desconhecida'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];
export const PRECISION_LABEL: Record<DatePrecision, string> = {
  exata: 'Data exata', mes: 'Mês e ano', ano: 'Somente o ano', decada: 'Década', circa: 'Aproximada (c.)', intervalo: 'Intervalo', desconhecida: 'Desconhecida',
};

export interface FuzzyDate {
  from?: string | null;   // 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'
  to?: string | null;
  precision: DatePrecision;
  text?: string | null;   // texto original da fonte
}

const RE = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

export function parsePartial(s?: string | null): { y: number; m?: number; d?: number } | null {
  if (!s) return null;
  const m = RE.exec(s.trim());
  if (!m) return null;
  const y = +m[1], mo = m[2] ? +m[2] : undefined, d = m[3] ? +m[3] : undefined;
  if (mo !== undefined && (mo < 1 || mo > 12)) return null;
  if (d !== undefined) {
    if (mo === undefined) return null;
    const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > dim) return null;
  }
  return { y, m: mo, d };
}

export const isValidPartial = (s?: string | null) => !s || parsePartial(s) !== null;

export function yearOf(s?: string | null): number | null {
  return parsePartial(s)?.y ?? null;
}

/** Chave numérica de ordenação (início do intervalo). Eventos sem data → +Infinity. */
export function sortKey(d: Partial<FuzzyDate> | null | undefined): number {
  const p = parsePartial(d?.from ?? d?.to ?? null);
  if (!p) return Number.POSITIVE_INFINITY;
  return p.y * 10000 + (p.m ?? 1) * 100 + (p.d ?? 1);
}

/** Intervalo de anos [min,max] ocupado pela data (para filtros de período). */
export function yearRange(d: Partial<FuzzyDate> | null | undefined): [number, number] | null {
  const a = yearOf(d?.from), b = yearOf(d?.to);
  if (a === null && b === null) return null;
  const lo = a ?? (b as number), hi = b ?? (a as number);
  if (d?.precision === 'decada') return [Math.floor(lo / 10) * 10, Math.floor(lo / 10) * 10 + 9];
  return [Math.min(lo, hi), Math.max(lo, hi)];
}

const fmtOne = (s: string): string => {
  const p = parsePartial(s);
  if (!p) return s;
  if (p.d) return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
  if (p.m) return `${String(p.m).padStart(2, '0')}/${p.y}`;
  return String(p.y);
};

export function formatFuzzyDate(d: Partial<FuzzyDate> | null | undefined, opts: { short?: boolean } = {}): string {
  if (!d || (!d.from && !d.to)) return d?.text ? d.text : 'data desconhecida';
  const p = d.precision ?? 'ano';
  const f = d.from ? fmtOne(d.from) : '';
  const t = d.to ? fmtOne(d.to) : '';
  switch (p) {
    case 'circa': return `c. ${f || t}`;
    case 'decada': return `década de ${Math.floor((yearOf(d.from ?? d.to) ?? 0) / 10) * 10}`;
    case 'intervalo': return f && t && f !== t ? `${f}–${t}` : f || t;
    default: return f && t && f !== t ? `${f}–${t}` : f || t;
  }
}

/** Valida coerência de uma data difusa. Retorna lista de erros (vazia = ok). */
export function validateFuzzyDate(d: Partial<FuzzyDate>): string[] {
  const errs: string[] = [];
  if (d.from && !isValidPartial(d.from)) errs.push(`Data inicial inválida: ${d.from}`);
  if (d.to && !isValidPartial(d.to)) errs.push(`Data final inválida: ${d.to}`);
  if (d.from && d.to && isValidPartial(d.from) && isValidPartial(d.to)) {
    const a = parsePartial(d.from)!, b = parsePartial(d.to)!;
    const ka = a.y * 10000 + (a.m ?? 1) * 100 + (a.d ?? 1), kb = b.y * 10000 + (b.m ?? 12) * 100 + (b.d ?? 28);
    if (ka > kb) errs.push('A data inicial é posterior à data final.');
  }
  if (d.precision === 'intervalo' && !(d.from && d.to)) errs.push('Intervalo exige data inicial e final.');
  if (d.precision && d.precision !== 'desconhecida' && !d.from && !d.to) errs.push('Precisão informada sem data.');
  return errs;
}
