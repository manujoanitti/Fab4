// Camada gráfica: tipos do manifesto e dos recursos resolvidos.
// A arte externa NUNCA é referenciada por caminho físico nas regras/telas: só por ID lógico (ver catalog.json).

export type ArtStateName = 'locked' | 'available' | 'done';
export interface ArtBox { w: number; h: number }
export interface ArtAnchor { x: number; y: number } // fração 0..1 do quadro que coincide com o ponto lógico
export interface SpriteMeta {
  frames: number; // quadros na tira horizontal
  fps: number;
  loop?: boolean; // padrão: true
  frameW: number; // px de um quadro
  frameH: number;
}
export interface ArtEntry {
  /** Arquivo relativo à pasta do pacote (ex.: "map/region-1-bg@2x.webp"). */
  file: string;
  kind?: 'image' | 'sprite';
  /** Tamanho de exibição (unidades do mapa SVG). Padrão: do catálogo. */
  box?: ArtBox;
  anchor?: ArtAnchor;
  /** Ajuste fino em unidades do mapa. */
  offset?: { x: number; y: number };
  sprite?: SpriteMeta;
  /** Área reservada ao texto do app (frações do arquivo). Sem ela, o app usa a posição padrão do texto. */
  textArea?: { x: number; y: number; w: number; h: number };
  /** Recurso horizontal adaptável (3 fatias): frações da largura que são as pontas fixas (esquerda `l`, direita `r`); o miolo estica até a largura de `box`. */
  slice?: { l: number; r: number };
}
/** Posições lógicas que um pacote pode redefinir (unidades do mapa; padrão = layout atual). */
export interface LayoutOverride {
  nodes?: Record<string, { x: number; y: number }>; // chave = número da fase (1..25)
  start?: { x: number; y: number };
  bonus?: { x: number; y: number };
}
export interface ArtPack {
  label?: string;
  /** Subpasta em public/art/ (sem "..", sem "/" inicial). */
  dir: string;
  assets: Record<string, ArtEntry>;
  layout?: LayoutOverride;
}
export interface ArtManifest {
  schema: 1;
  /** Pacote ativo; null = sem arte externa (somente o visual de fallback). */
  activePack: string | null;
  packs: Record<string, ArtPack>;
}
export interface DefaultSlot { kind: 'image' | 'sprite'; box?: ArtBox; anchor?: ArtAnchor; sprite?: SpriteMeta }

export interface ResolvedArt {
  id: string;
  url: string;
  kind: 'image' | 'sprite';
  box?: ArtBox;
  anchor: ArtAnchor;
  offset: { x: number; y: number };
  sprite?: SpriteMeta;
  textArea?: { x: number; y: number; w: number; h: number };
  slice?: { l: number; r: number };
  /** Tamanho nativo do catálogo (referência de escala das pontas de um recurso em fatias). */
  nativeBox?: ArtBox;
}
export type ArtStatus = 'idle' | 'queued' | 'loading' | 'ok' | 'error';
