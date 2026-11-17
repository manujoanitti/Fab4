// Lógica pura do "Jardim Encantado": decoração salva no perfil (game_state).
export interface GardenItem { id: string; kind: string; x: number; y: number } // x,y em % do canvas
export interface GardenData { items: GardenItem[] }
export const MAX_ITEMS = 60;

export const BASE_ITEMS = ['🌷', '🌸', '🌻', '🌳', '🍄', '🦋', '🐰', '🌈'];
/** Elementos extras (lúdico adicional): liberados ao concluir a etapa 5. */
export const BONUS_ITEMS = ['🦄', '🏰', '🧚'];
export const availableItems = (stage5Done: boolean) => (stage5Done ? [...BASE_ITEMS, ...BONUS_ITEMS] : BASE_ITEMS);

export const emptyGarden = (): GardenData => ({ items: [] });
export const parseGarden = (d: unknown): GardenData =>
  d && typeof d === 'object' && Array.isArray((d as GardenData).items) ? { items: (d as GardenData).items.slice(0, MAX_ITEMS) } : emptyGarden();
const clamp = (n: number) => Math.min(96, Math.max(4, n));
export function addItem(g: GardenData, kind: string, x: number, y: number, id: string): GardenData {
  if (g.items.length >= MAX_ITEMS) return g;
  return { items: [...g.items, { id, kind, x: clamp(x), y: clamp(y) }] };
}
export const moveItem = (g: GardenData, id: string, x: number, y: number): GardenData => ({ items: g.items.map((i) => (i.id === id ? { ...i, x: clamp(x), y: clamp(y) } : i)) });
export const removeItem = (g: GardenData, id: string): GardenData => ({ items: g.items.filter((i) => i.id !== id) });
