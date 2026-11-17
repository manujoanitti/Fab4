import { describe, expect, it } from 'vitest';
import { mergeBackup, validateBackup, type BackupFile } from '../../src/domain/backup';
import { emptyState } from '../../src/domain/selectors';
import { GARDEN_ITEMS, gardenSlug } from '../../src/games/gardenCatalog';
import { BASE_ITEMS, BONUS_ITEMS, addItem, availableItems, emptyGarden, parseGarden } from '../../src/games/gardenLogic';
import { SYMBOLS } from '../../src/games/memoryLogic';
import { SYMBOL_SLUGS, symbolSlug } from '../../src/games/crystalSymbols';

// Dados REAIS já gravados usam o emoji como identificador do item (GardenItem.kind).
const LEGACY_ITEMS = [{ id: 'a', kind: '🌷', x: 30, y: 60 }, { id: 'b', kind: '🦄', x: 70, y: 50 }, { id: 'c', kind: '🍄', x: 10, y: 10 }];

describe('Jardim Encantado — identificadores persistidos (emoji) preservados', () => {
  it('a paleta e os itens novos continuam gravando o EMOJI (nunca o slug)', () => {
    expect(BASE_ITEMS).toEqual(['🌷', '🌸', '🌻', '🌳', '🍄', '🦋', '🐰', '🌈']);
    expect(BONUS_ITEMS).toEqual(['🦄', '🏰', '🧚']);
    expect(availableItems(false)).toEqual(BASE_ITEMS);
    expect(availableItems(true)).toEqual([...BASE_ITEMS, ...BONUS_ITEMS]);
    const g = addItem(emptyGarden(), availableItems(false)[0], 20, 30, 'n1');
    expect(g.items[0].kind).toBe('🌷');
  });
  it('dados antigos continuam legíveis e idênticos', () => {
    const g = parseGarden({ items: LEGACY_ITEMS });
    expect(g.items).toEqual(LEGACY_ITEMS);
  });
  it('emoji → slug da arte; aceita o slug; desconhecido → null (continua como texto)', () => {
    expect(gardenSlug('🌷')).toBe('tulip');
    expect(gardenSlug('🦄')).toBe('unicorn');
    expect(gardenSlug('tulip')).toBe('tulip');
    expect(gardenSlug('❓')).toBeNull();
    expect(new Set(GARDEN_ITEMS.map((i) => i.slug)).size).toBe(GARDEN_ITEMS.length);
    expect(new Set(GARDEN_ITEMS.map((i) => i.emoji)).size).toBe(GARDEN_ITEMS.length);
  });
  it('símbolos da Memória: todo emoji do jogo tem slug de arte', () => {
    for (const s of SYMBOLS) expect(symbolSlug(s), s).toBeTruthy();
    expect(Object.keys(SYMBOL_SLUGS).sort()).toEqual([...SYMBOLS].sort());
  });
});

describe('compatibilidade com backups existentes', () => {
  const legacy: BackupFile = {
    format: 'reino-bianca-backup', schemaVersion: 1, exportedAt: '2026-03-01T12:00:00.000Z', demo: false,
    state: { ...emptyState('c1', 'Reino Fictício'), gameStates: [{ gameId: 'garden', data: { items: LEGACY_ITEMS }, version: 3, updatedAt: '2026-03-01T11:00:00.000Z', updatedBy: 'u' }] },
  };
  it('o formato do backup (v1) é aceito sem alterações e restaura o jardim byte a byte', () => {
    const v = validateBackup(JSON.stringify(legacy));
    expect(v.ok).toBe(true);
    const r = mergeBackup(emptyState('c2', 'Novo'), legacy);
    expect(r.state.gameStates[0].data).toEqual({ items: LEGACY_ITEMS });
    expect(JSON.stringify(r.state.gameStates[0].data)).toBe(JSON.stringify({ items: LEGACY_ITEMS }));
    expect(r.state.gameStates[0].version).toBe(3);
  });
});
