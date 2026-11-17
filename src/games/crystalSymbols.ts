// Símbolos das cartas da Memória dos Cristais: emoji (usado no jogo e nos testes via data-symbol) → slug da arte.
export const SYMBOL_SLUGS: Record<string, string> = {
  '💎': 'crystal', '🔮': 'orb', '🌙': 'moon', '⭐': 'star', '🦄': 'unicorn', '🌸': 'blossom', '🍄': 'mushroom', '🦋': 'butterfly',
};
export const symbolSlug = (emoji: string): string | null => SYMBOL_SLUGS[emoji] ?? null;
