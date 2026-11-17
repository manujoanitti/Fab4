// Tipos do pipeline de produção gráfica (planejar → prompt → receber → processar → revisar → aprovar → integrar).

export interface CatalogEntry {
  id: string; category: string; group: string; stem: string; kind: 'image' | 'sprite'; formats: string[];
  px: { w: number; h: number }; sheet?: { w: number; h: number };
  sprite?: { frames: number; fps: number; loop: boolean; frameW: number; frameH: number };
  dimMode: 'exact' | 'aspect'; transparent: boolean; aspect: string; variants: string; desc: string; placement: string;
  relations: string; priority: 'P0' | 'P1' | 'P2'; lot: number; usedIn: string; maxKB: number;
}
export interface CatalogFile { version: number; defaults: Record<string, { box?: { w: number; h: number }; anchor?: { x: number; y: number } }>; catalog: CatalogEntry[] }

export type Estado = 'planejado' | 'aguardando_geracao' | 'recebido' | 'processado' | 'em_revisao' | 'aprovado' | 'integrado';
export const ESTADOS: Estado[] = ['planejado', 'aguardando_geracao', 'recebido', 'processado', 'em_revisao', 'aprovado', 'integrado'];
export const ROTULO_ESTADO: Record<Estado, string> = {
  planejado: 'Planejado', aguardando_geracao: 'Aguardando geração', recebido: 'Recebido', processado: 'Processado',
  em_revisao: 'Em revisão', aprovado: 'Aprovado', integrado: 'Integrado',
};

export type TipoLote = 'prancha' | 'cenario' | 'individual';
export interface Retangulo { x: number; y: number; w: number; h: number }
export type Alinhamento = 'centro' | 'base';

/** Como um recurso final é produzido a partir da célula/imagem recebida. */
export interface SaidaSpec {
  arquivo: string; // relativo à pasta do pacote, ex.: "map/node-locked@2x.webp"
  formato: 'webp' | 'png';
  px: { w: number; h: number }; // tamanho final do arquivo (1 quadro, para sprites)
  alfa: boolean;
  alinhamento: Alinhamento;
  ancora: { x: number; y: number };
  margemSeguranca: number; // fração da célula livre em cada lado
  maxKB: number;
  dimMode: 'exact' | 'aspect';
  /** Sprite de 1 quadro (Bianca estática): o manifesto declara sprite.frames = 1. */
  spriteUmQuadro?: { frameW: number; frameH: number };
}
export interface Celula {
  id: string; ordem: number; linha: number; coluna: number;
  rect: Retangulo; // frações da folha inteira (0..1)
  descricao: string; saida: SaidaSpec;
}
export interface Folha {
  aspecto: [number, number]; // ex.: [1, 1], [3, 4]
  largura: number; // sempre 1 (unidade = largura da folha); altura = aspecto[1]/aspecto[0]
  fundo: string; // cor chapada solicitada (#RRGGBB)
  fundoNome: string;
  linhas: Array<{ y: number; celulas: string[] }>;
  celulas: Celula[];
  margemSeguranca: number;
}
export interface Referencia { arquivo: string; obrigatoria: boolean; descricao: string; gerada?: boolean }

export interface LotePlano {
  id: string; titulo: string; tipo: TipoLote; prioridade: 'P0' | 'P1' | 'P2'; lote: number; ordem: number;
  dependeDe: string[]; ids: string[]; pacote: string;
  referencias: Referencia[];
  folha?: Folha; // tipo "prancha"
  cenario?: { regiao: number; comBase: boolean; comTopo: boolean; px: { w: number; h: number }; partes: Array<{ id: string; arquivo: string; y: number; h: number; formato: 'webp' | 'png'; maxKB: number }> };
  individual?: { id: string; arquivo: string; px: { w: number; h: number }; formato: 'webp' | 'png'; maxKB: number; aspecto: [number, number] };
  observacoes: string[];
}
export interface Adiado { id: string; motivo: string }
export interface Plano { lotes: LotePlano[]; adiados: Adiado[] }

export interface AprovacaoMap { [id: string]: 'pendente' | 'aprovado' | 'rejeitado' }
export interface EtapaRegistro { em: string; chave: string }
export interface RegistroLote {
  id: string; estado: Estado;
  historico: Array<{ estado: Estado; em: string; nota?: string }>;
  etapas: Record<string, EtapaRegistro>;
  recebido?: { arquivo: string; sha256: string; largura: number; altura: number; em: string };
  aprovacao: AprovacaoMap;
  qa?: { ok: number; revisar: number; falha: number };
}
export interface Registro { versao: 1; pacote: string; lotes: RegistroLote[] }
