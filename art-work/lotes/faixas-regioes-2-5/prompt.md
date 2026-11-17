# Faixas das regiões 2 a 5

- **Lote:** `faixas-regioes-2-5` · prioridade P1 · recursos: 4
- **Prancha:** proporção **1:1**, fundo **#00FF00** (verde puro), 4 linha(s), 4 célula(s)
- **Depende de (aprovados antes):** `piloto-marcos-regiao-1`

## 1. Anexe estes arquivos ao Gemini

- **Obrigatório** — `art-work/referencias/folha-de-estilo.png` — Folha de estilo visual aprovada (traço, paleta, atmosfera) ✅ presente
- **Obrigatório** — `guia-prancha.png` — Guia de posições desta prancha (gerado; usar só como referência de posição) (gerado junto com este prompt, na pasta do lote)

## 2. Cole este prompt no Gemini

````text
Gere UMA ÚNICA IMAGEM, em formato 1:1 (quadrada), na MAIOR resolução disponível: uma prancha de produção com 4 elementos ilustrados para um jogo infantil que parece um livro de contos.

IDENTIDADE ARTÍSTICA (siga a folha de estilo anexa — mesmo traço, mesma paleta, mesma atmosfera):
- Fantasia onírica e poética.
- Aquarela e lápis de cor, com a textura do papel visível e pequenas imperfeições manuais.
- Formas orgânicas e ligeiramente surreais (proporções suavemente fora do comum, curvas vivas, nada rígido).
- Paleta delicada, rica e harmoniosa: pastéis com profundidade, nunca neon nem saturação plástica.
- Atmosfera de livro ilustrado infantil, acolhedora e contemplativa.

EVITE:
- qualquer aparência genérica de jogo mobile (botões brilhantes de plástico, gemas 3D, brilho metálico, "gloss", contornos grossos de desenho animado vetorial)
- elementos de interface de jogo desenhados dentro da imagem (barras, molduras, ícones de moeda genéricos)
- estilo 3D, render, fotografia ou pixel art

ESTRUTURA DA PRANCHA (siga o guia de posições anexo; use-o SOMENTE como referência de posição — não reproduza linhas, cruzes, marcas nem números):
- Fundo: uma única cor chapada e uniforme, #00FF00 (verde puro), em TODA a imagem, sem textura, sem gradiente, sem vinheta e sem sombra projetada no fundo.
- A prancha tem 4 áreas de conteúdo distribuídas em 4 faixas horizontais (cada área é uma “célula”). Cada área contém UM único elemento, centralizado, com folga livre de pelo menos 10% do tamanho da célula em todos os lados.

A imagem tem 4 faixas horizontais empilhadas (de cima para baixo), com fundo livre entre elas. Posições em % da largura (x) e da altura (y) da imagem, medidas a partir do canto superior esquerdo:
- FAIXA 1 (1ª), y de 5% a 24%: 1 área, centralizada horizontalmente.
    · área 1: x de 3% a 97%, y de 5% a 24%
- FAIXA 2 (2ª), y de 29% a 48%: 1 área, centralizada horizontalmente.
    · área 2: x de 3% a 97%, y de 29% a 48%
- FAIXA 3 (3ª), y de 52% a 71%: 1 área, centralizada horizontalmente.
    · área 3: x de 3% a 97%, y de 52% a 71%
- FAIXA 4 (4ª), y de 76% a 95%: 1 área, centralizada horizontalmente.
    · área 4: x de 3% a 97%, y de 76% a 95%
- Todo o espaço fora dessas áreas é fundo chapado vazio.

- Nenhum elemento toca a borda da célula nem da imagem; nenhum elemento se sobrepõe a outro; cada elemento aparece por inteiro, sem cortes.
- NENHUM texto, letra, número, legenda, título, moldura, linha de grade ou marca d'água em lugar algum da imagem.

CONTEÚDO DAS CÉLULAS:
Linha 1 (de cima para baixo) — 1 célula, da esquerda para a direita:
  1. [célula faixa muito larga, proporção 5:1] Faixa/fita horizontal de pontas onduladas na cor lilás-ametista (#9B7FD4) (Castelo das Fadas), mesmo desenho da faixa da Região 1, centro vazio e liso.
Linha 2 (de cima para baixo) — 1 célula, da esquerda para a direita:
  2. [célula faixa muito larga, proporção 5:1] Faixa/fita horizontal de pontas onduladas na cor azul-lago (#4AAEE6) (Lago Cristalino), mesmo desenho da faixa da Região 1, centro vazio e liso.
Linha 3 (de cima para baixo) — 1 célula, da esquerda para a direita:
  3. [célula faixa muito larga, proporção 5:1] Faixa/fita horizontal de pontas onduladas na cor dourado-âmbar (#F0B429) (Montanhas da Coragem), mesmo desenho da faixa da Região 1, centro vazio e liso.
Linha 4 (de cima para baixo) — 1 célula, da esquerda para a direita:
  4. [célula faixa muito larga, proporção 5:1] Faixa/fita horizontal de pontas onduladas na cor rosa-magenta (#E8548C) (Jardim da Magia), mesmo desenho da faixa da Região 1, centro vazio e liso.

REGRAS PARA O RECORTE POSTERIOR (importantes):
- Contornos nítidos e limpos contra o fundo; sem brilho difuso, halos, fumaça ou luz que extravase para fora do contorno (qualquer brilho fica dentro do próprio elemento).
- NÃO use a cor do fundo (#00FF00) nem tons próximos dela dentro dos elementos.
- Elementos vazados (anéis, molduras): o vão interno deve ser EXATAMENTE a cor do fundo.
- Mantenha a mesma escala e o mesmo estilo entre os elementos da prancha.

Responda somente com a imagem.
````

## 3. Depois de gerar

1. Escolha a melhor imagem (a prancha deve respeitar a grade e o fundo #00FF00). Se vier torta, com texto ou com elementos tocando a borda, peça novamente.
2. Salve o arquivo (PNG ou JPG, maior resolução possível) e entregue com: `npm run art:process -- faixas-regioes-2-5 caminho/do/arquivo.png`
3. Confira o relatório com `npm run art:review -- faixas-regioes-2-5` (abre `revisao/relatorio.html`).

## Observações

- Mesmo desenho da faixa da Região 1 (aprovada no piloto), mudando só a cor de cada região.
