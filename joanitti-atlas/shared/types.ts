// Tipos e vocabulários compartilhados entre servidor e cliente.

export const STATUSES = ['documentado', 'fortemente_corroborado', 'hipotese_plausivel', 'nao_confirmado', 'descartado'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  documentado: 'Documentado',
  fortemente_corroborado: 'Fortemente corroborado',
  hipotese_plausivel: 'Hipótese plausível',
  nao_confirmado: 'Não confirmado',
  descartado: 'Descartado',
};
export const STATUS_HINT: Record<Status, string> = {
  documentado: 'Há documento examinado que afirma o fato diretamente.',
  fortemente_corroborado: 'Várias fontes independentes convergem, mas sem documento primário examinado.',
  hipotese_plausivel: 'Compatível com os indícios; ainda depende de confirmação documental.',
  nao_confirmado: 'Sem evidência suficiente — não deve ser tratado como fato.',
  descartado: 'Refutado ou invalidado; preservado apenas no histórico da investigação.',
};
/** Marcadores não-cromáticos (a navegação não depende só de cor). */
export const STATUS_GLYPH: Record<Status, string> = {
  documentado: '●', fortemente_corroborado: '◐', hipotese_plausivel: '◔', nao_confirmado: '○', descartado: '✕',
};
/** Estilo de linha na árvore: contínua / tracejada / pontilhada. */
export const STATUS_LINE: Record<Status, 'solid' | 'dashed' | 'dotted' | 'none'> = {
  documentado: 'solid', fortemente_corroborado: 'solid', hipotese_plausivel: 'dashed', nao_confirmado: 'dotted', descartado: 'none',
};
/** Ordem de força (para "o elo mais fraco" de um caminho). */
export const STATUS_RANK: Record<Status, number> = {
  descartado: 0, nao_confirmado: 1, hipotese_plausivel: 2, fortemente_corroborado: 3, documentado: 4,
};
export const weakest = (...s: Status[]): Status => s.reduce((a, b) => (STATUS_RANK[a] <= STATUS_RANK[b] ? a : b));

export const LIVING = ['vivo', 'possivelmente_vivo', 'falecido', 'presumido_falecido', 'desconhecido'] as const;
export type LivingStatus = (typeof LIVING)[number];
export const LIVING_LABEL: Record<LivingStatus, string> = {
  vivo: 'Vivo', possivelmente_vivo: 'Possivelmente vivo', falecido: 'Falecido', presumido_falecido: 'Presumido falecido', desconhecido: 'Desconhecido',
};
/** Pessoas cujos dados pessoais NÃO podem aparecer na visão pública. */
export const isPrivateLiving = (s: string | null | undefined) => s === 'vivo' || s === 'possivelmente_vivo' || s === 'desconhecido';

export const REL_TYPES = ['filiacao', 'casamento', 'uniao', 'parentesco_inferido', 'desconhecida'] as const;
export type RelType = (typeof REL_TYPES)[number];
export const REL_LABEL: Record<RelType, string> = {
  filiacao: 'Filiação', casamento: 'Casamento', uniao: 'União / parceria', parentesco_inferido: 'Parentesco inferido', desconhecida: 'Relação de natureza desconhecida',
};
export const FILIATION_SUBTYPES = ['biologica', 'adotiva', 'indeterminada'] as const;

export const EVENT_TYPES = ['nascimento', 'batismo', 'casamento', 'falecimento', 'imigracao', 'emigracao', 'naturalizacao', 'residencia',
  'profissao_cargo', 'participacao_historica', 'registro_documental', 'obra', 'toponimia', 'outro'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_LABEL: Record<EventType, string> = {
  nascimento: 'Nascimento', batismo: 'Batismo', casamento: 'Casamento', falecimento: 'Falecimento', imigracao: 'Imigração', emigracao: 'Emigração',
  naturalizacao: 'Naturalização', residencia: 'Residência', profissao_cargo: 'Profissão / cargo', participacao_historica: 'Participação histórica',
  registro_documental: 'Registro documental', obra: 'Obra / produção', toponimia: 'Toponímia / homenagem', outro: 'Outro',
};

export const SOURCE_KINDS = ['primaria', 'secundaria', 'colaborativa', 'nao_verificada', 'oficial'] as const;
export const SOURCE_KIND_LABEL: Record<string, string> = {
  primaria: 'Documento primário', secundaria: 'Fonte secundária', colaborativa: 'Árvore colaborativa',
  nao_verificada: 'Resultado não verificado', oficial: 'Registro oficial contemporâneo',
};
export const ACCESS_LABEL: Record<string, string> = {
  examinada_integral: 'Examinada na íntegra', examinada_extrato: 'Examinada em extrato', apenas_indexada: 'Apenas indexada (página integral inacessível)',
  citada_nao_examinada: 'Citada, não examinada', para_consulta_futura: 'Acervo para consulta futura',
};
export const DOC_TYPES = ['certidao_nascimento', 'batismo', 'casamento', 'obito', 'lista_passageiros', 'imigracao', 'fotografia', 'publicacao',
  'pesquisa', 'perfil_arvore', 'registro_administrativo', 'ficha_patrimonial', 'diretorio', 'acervo', 'registro_judicial', 'outro'] as const;
export const DOC_TYPE_LABEL: Record<string, string> = {
  certidao_nascimento: 'Certidão de nascimento', batismo: 'Registro de batismo', casamento: 'Registro de casamento', obito: 'Registro de óbito',
  lista_passageiros: 'Lista de passageiros', imigracao: 'Documento de imigração', fotografia: 'Fotografia', publicacao: 'Publicação histórica',
  pesquisa: 'Pesquisa / relatório genealógico', perfil_arvore: 'Perfil de árvore colaborativa', registro_administrativo: 'Registro administrativo',
  ficha_patrimonial: 'Ficha patrimonial / catálogo', diretorio: 'Diretório / repertório', acervo: 'Acervo / arquivo', registro_judicial: 'Registro judicial', outro: 'Outro',
};

export const PLACE_LEVELS = ['pais', 'regiao', 'provincia', 'municipio', 'localidade', 'porto'] as const;
export const PLACE_LEVEL_LABEL: Record<string, string> = {
  pais: 'País', regiao: 'Região / Estado', provincia: 'Província', municipio: 'Município', localidade: 'Localidade', porto: 'Porto',
};

export const COORD_PRECISION_LABEL: Record<string, string> = {
  exata: 'Exata', municipio: 'Centro do município', regiao: 'Centro da região', aproximada: 'Aproximada', desconhecida: 'Desconhecida',
};

export const INVESTIGATION_STATUS_LABEL: Record<string, string> = {
  aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída', arquivada: 'Arquivada',
};

export type ISODatePartial = string; // 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD'
