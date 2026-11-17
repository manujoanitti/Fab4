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
/** Tema visual de cada região (cenário). `tons` espelham o degradê do visual atual (topo mais claro → base mais saturada) para as bordas das regiões se encontrarem. */
export const REGIAO_TEMA: Array<{ tema: string; tons: string }> = [
  { tema: 'floresta encantada de árvores arredondadas e frondosas, cogumelos grandes e delicados, flores silvestres e clareiras com vaga-lumes discretos', tons: 'verdes frescos e suaves (do verde-limão claro no alto ao verde-menta mais profundo embaixo), com toques de rosa e amarelo' },
  { tema: 'castelo das fadas ao fundo, de torres finas em rosa e creme com telhados de ametista, bandeirinhas, árvores lilases, flores cor-de-rosa e nuvens como algodão', tons: 'lavanda e lilás-ametista (do lavanda quase branco no alto ao lilás mais profundo embaixo), com rosa e creme' },
  { tema: 'lago cristalino de águas calmas azul-turquesa com vitórias-régias e flores, cristais translúcidos azulados e lilases nas margens e reflexos suaves', tons: 'azuis e turquesas (do azul-céu claro no alto ao azul-lago mais profundo embaixo), com toques de lilás' },
  { tema: 'montanhas azul-acinzentadas de picos nevados, pinheiros, névoa baixa e, ao longe, uma bandeira dourada no ponto mais alto', tons: 'azul-acinzentados frios (do cinza-azulado muito claro no alto ao azul-aço suave embaixo), com pequenos toques de dourado' },
  { tema: 'jardim mágico com um arco de flores cor-de-rosa, lanternas penduradas, árvores floridas em rosa e magenta e vaga-lumes; o horizonte do alto é um céu rosado de aurora, o final do reino', tons: 'rosas e magentas suaves (do rosa-pétala claro no alto ao rosa-framboesa mais profundo embaixo), com dourado nas lanternas' },
];
