// Lógica pura do jogo "Memória dos Cristais" (testável sem interface).
export const SYMBOLS = ['💎', '🔮', '🌙', '⭐', '🦄', '🌸', '🍄', '🦋'];
export interface Card { id: number; symbol: string; matched: boolean }
export interface MemoryState { cards: Card[]; open: number[]; moves: number; locked: boolean }

/** Dificuldade progressiva: nível 1 = 3 pares … nível 6+ = 8 pares. */
export const pairsForLevel = (level: number) => Math.min(SYMBOLS.length, 2 + Math.max(1, level));
export const columnsForPairs = (pairs: number) => (pairs <= 3 ? 3 : 4);

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function newGame(level: number, rnd: () => number = Math.random): MemoryState {
  const pairs = pairsForLevel(level);
  const symbols = shuffle(SYMBOLS, rnd).slice(0, pairs);
  const cards = shuffle([...symbols, ...symbols], rnd).map((symbol, id) => ({ id, symbol, matched: false }));
  return { cards, open: [], moves: 0, locked: false };
}
export function flip(s: MemoryState, i: number): MemoryState {
  const c = s.cards[i];
  if (!c || s.locked || c.matched || s.open.includes(i)) return s;
  const open = [...s.open, i];
  if (open.length < 2) return { ...s, open };
  const [a, b] = open;
  if (s.cards[a].symbol === s.cards[b].symbol) {
    const cards = s.cards.map((x) => (x.id === a || x.id === b ? { ...x, matched: true } : x));
    return { cards, open: [], moves: s.moves + 1, locked: false };
  }
  return { ...s, open, moves: s.moves + 1, locked: true };
}
/** Desvira o par errado (chamado após uma pequena pausa). */
export const closeOpen = (s: MemoryState): MemoryState => ({ ...s, open: [], locked: false });
export const isWon = (s: MemoryState) => s.cards.every((c) => c.matched);
