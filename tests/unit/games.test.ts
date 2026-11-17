import { describe, expect, it } from 'vitest';
import { addItem, availableItems, emptyGarden, MAX_ITEMS, moveItem, parseGarden, removeItem } from '../../src/games/gardenLogic';
import { closeOpen, columnsForPairs, flip, isWon, newGame, pairsForLevel } from '../../src/games/memoryLogic';

const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe('Memória dos Cristais (lógica)', () => {
  it('dificuldade progressiva: 3 pares no nível 1, até 8 pares', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(pairsForLevel)).toEqual([3, 4, 5, 6, 7, 8, 8]);
    expect(columnsForPairs(3)).toBe(3);
    expect(columnsForPairs(8)).toBe(4);
  });
  it('baralho tem pares exatos e embaralha de forma reproduzível', () => {
    const g = newGame(3, seeded());
    expect(g.cards).toHaveLength(10);
    const count = new Map<string, number>();
    for (const c of g.cards) count.set(c.symbol, (count.get(c.symbol) ?? 0) + 1);
    expect([...count.values()].every((n) => n === 2)).toBe(true);
    expect(newGame(3, seeded()).cards.map((c) => c.symbol)).toEqual(g.cards.map((c) => c.symbol));
  });
  it('acerto fixa o par; erro bloqueia até desvirar; vence ao achar todos', () => {
    let g = newGame(1, seeded());
    const [a, b] = [0, g.cards.findIndex((c, i) => i > 0 && c.symbol === g.cards[0].symbol)];
    const wrong = g.cards.findIndex((c) => c.symbol !== g.cards[0].symbol);
    g = flip(flip(g, a), wrong);
    expect(g.locked).toBe(true);
    expect(flip(g, b)).toBe(g); // bloqueado: ignora toque
    g = closeOpen(g);
    expect(g.open).toEqual([]);
    g = flip(flip(g, a), b);
    expect(g.cards[a].matched && g.cards[b].matched).toBe(true);
    expect(g.moves).toBe(2);
    expect(flip(g, a)).toBe(g); // carta já encontrada
    for (const c of g.cards) if (!c.matched) { const m = g.cards.find((x) => x.id !== c.id && x.symbol === c.symbol)!; g = flip(flip(g, c.id), m.id); }
    expect(isWon(g)).toBe(true);
  });
});

describe('Jardim Encantado (lógica)', () => {
  it('adiciona, move, remove e limita a quantidade', () => {
    let g = addItem(emptyGarden(), '🌷', 50, 50, 'a');
    g = moveItem(addItem(g, '🌳', 200, -5, 'b'), 'a', 10, 20);
    expect(g.items.find((i) => i.id === 'a')).toMatchObject({ x: 10, y: 20 });
    expect(g.items.find((i) => i.id === 'b')).toMatchObject({ x: 96, y: 4 }); // dentro dos limites
    expect(removeItem(g, 'a').items.map((i) => i.id)).toEqual(['b']);
    let full = emptyGarden();
    for (let i = 0; i < MAX_ITEMS + 5; i++) full = addItem(full, '🌸', 10, 10, String(i));
    expect(full.items).toHaveLength(MAX_ITEMS);
  });
  it('dados salvos inválidos viram jardim vazio; itens extras liberam na etapa 5', () => {
    expect(parseGarden('lixo')).toEqual(emptyGarden());
    expect(parseGarden({ items: 3 })).toEqual(emptyGarden());
    expect(availableItems(true).length).toBeGreaterThan(availableItems(false).length);
  });
});
