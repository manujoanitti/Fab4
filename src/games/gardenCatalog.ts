// Catálogo dos itens do Jardim Encantado.
// IMPORTANTE (compatibilidade): o valor PERSISTIDO em game_state / backups (GardenItem.kind) continua sendo o EMOJI.
// O slug serve só para localizar a arte (game.garden.item.<slug>). Nunca migre os dados salvos: dados antigos
// (emoji) e novos devem coexistir, e um emoji desconhecido continua sendo desenhado como texto.
export interface GardenItemDef { slug: string; emoji: string; bonus: boolean }
export const GARDEN_ITEMS: GardenItemDef[] = [
  { slug: 'tulip', emoji: '🌷', bonus: false },
  { slug: 'blossom', emoji: '🌸', bonus: false },
  { slug: 'sunflower', emoji: '🌻', bonus: false },
  { slug: 'tree', emoji: '🌳', bonus: false },
  { slug: 'mushroom', emoji: '🍄', bonus: false },
  { slug: 'butterfly', emoji: '🦋', bonus: false },
  { slug: 'rabbit', emoji: '🐰', bonus: false },
  { slug: 'rainbow', emoji: '🌈', bonus: false },
  { slug: 'unicorn', emoji: '🦄', bonus: true },
  { slug: 'castle', emoji: '🏰', bonus: true },
  { slug: 'fairy', emoji: '🧚', bonus: true },
];
/** Aceita o valor persistido (emoji) ou o próprio slug; devolve o slug ou null se desconhecido. */
export function gardenSlug(kind: string): string | null {
  return GARDEN_ITEMS.find((i) => i.emoji === kind || i.slug === kind)?.slug ?? null;
}
