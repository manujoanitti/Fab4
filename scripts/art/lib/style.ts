// Identidade artística aprovada (fonte única dos prompts). Mantém coerência com a folha de estilo e o modelo da Bianca.
export const IDENTIDADE: string[] = [
  'Fantasia onírica e poética.',
  'Aquarela e lápis de cor, com a textura do papel visível e pequenas imperfeições manuais.',
  'Formas orgânicas e ligeiramente surreais (proporções suavemente fora do comum, curvas vivas, nada rígido).',
  'Paleta delicada, rica e harmoniosa: pastéis com profundidade, nunca neon nem saturação plástica.',
  'Atmosfera de livro ilustrado infantil, acolhedora e contemplativa.',
];
export const EVITAR: string[] = [
  'qualquer aparência genérica de jogo mobile (botões brilhantes de plástico, gemas 3D, brilho metálico, "gloss", contornos grossos de desenho animado vetorial)',
  'elementos de interface de jogo desenhados dentro da imagem (barras, molduras, ícones de moeda genéricos)',
  'estilo 3D, render, fotografia ou pixel art',
];
export const REFERENCIAS_FIXAS = {
  estilo: { arquivo: 'art-work/referencias/folha-de-estilo.png', descricao: 'Folha de estilo visual aprovada (traço, paleta, atmosfera)' },
  bianca: { arquivo: 'art-work/referencias/modelo-bianca.png', descricao: 'Modelo oficial da personagem Bianca' },
  layout: (n: number) => ({ arquivo: `art-work/referencias/layout-regiao-${n}.png`, descricao: `Layout de referência aprovado da Região ${n}` }),
};
/** Cores de fundo candidatas para recorte (cromakey) e o que elas colidem na paleta. */
export const FUNDOS: Array<{ hex: string; nome: string }> = [
  { hex: '#00FF00', nome: 'verde puro' },
  { hex: '#FF00FF', nome: 'magenta puro' },
  { hex: '#00FFFF', nome: 'ciano puro' },
];
export const REGIOES = ['Floresta dos Sonhos', 'Castelo das Fadas', 'Lago Cristalino', 'Montanhas da Coragem', 'Jardim da Magia'];
export const COR_REGIAO = ['rosa-framboesa (#EC6FA0)', 'lilás-ametista (#9B7FD4)', 'azul-lago (#4AAEE6)', 'dourado-âmbar (#F0B429)', 'rosa-magenta (#E8548C)'];
