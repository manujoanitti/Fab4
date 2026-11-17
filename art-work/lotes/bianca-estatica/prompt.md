# Bianca — imagem estática (idle)

- **Lote:** `bianca-estatica` · prioridade P0 · recursos: 1
- **Prancha:** proporção **1:1**, fundo **#00FF00** (verde puro), 1 linha(s), 1 célula(s)

## 1. Anexe estes arquivos ao Gemini

- **Obrigatório** — `art-work/referencias/folha-de-estilo.png` — Folha de estilo visual aprovada (traço, paleta, atmosfera) ✅ presente
- **Obrigatório** — `guia-prancha.png` — Guia de posições desta prancha (gerado; usar só como referência de posição) (gerado junto com este prompt, na pasta do lote)
- **Obrigatório** — `art-work/referencias/modelo-bianca.png` — Modelo oficial da personagem Bianca ⚠️ AINDA NÃO ENVIADO

## 2. Cole este prompt no Gemini

````text
Gere UMA ÚNICA IMAGEM, em formato 1:1 (quadrada), na MAIOR resolução disponível: uma prancha de produção com 1 elemento ilustrado para um jogo infantil que parece um livro de contos.

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
- A prancha tem 1 área de conteúdo distribuídas em 1 faixa horizontal (cada área é uma “célula”). Cada área contém UM único elemento, centralizado, com folga livre de pelo menos 10% do tamanho da célula em todos os lados.

A imagem tem 1 faixa horizontal empilhadas (de cima para baixo), com fundo livre entre elas. Posições em % da largura (x) e da altura (y) da imagem, medidas a partir do canto superior esquerdo:
- FAIXA 1 (1ª), y de 32% a 68%: 1 área, centralizada horizontalmente.
    · área 1: x de 32% a 68%, y de 32% a 68%
- Todo o espaço fora dessas áreas é fundo chapado vazio.

- Nenhum elemento toca a borda da célula nem da imagem; nenhum elemento se sobrepõe a outro; cada elemento aparece por inteiro, sem cortes.
- NENHUM texto, letra, número, legenda, título, moldura, linha de grade ou marca d'água em lugar algum da imagem.

CONTEÚDO DAS CÉLULAS:
Linha 1 (de cima para baixo) — 1 célula, da esquerda para a direita:
  1. [célula quadrada, proporção 1:1] Bianca — animação "idle": respiração/balanço leve em pé. Tira horizontal (6 quadros 256×256).

REGRAS PARA O RECORTE POSTERIOR (importantes):
- Contornos nítidos e limpos contra o fundo; sem brilho difuso, halos, fumaça ou luz que extravase para fora do contorno (qualquer brilho fica dentro do próprio elemento).
- NÃO use a cor do fundo (#00FF00) nem tons próximos dela dentro dos elementos.
- Elementos vazados (anéis, molduras): o vão interno deve ser EXATAMENTE a cor do fundo.
- Mantenha a mesma escala e o mesmo estilo entre os elementos da prancha.
- Elementos que pisam no chão (poste, personagem): a base/os pés ficam na parte inferior da célula, sem sombra no chão.

Responda somente com a imagem.
````

## 3. Depois de gerar

1. Escolha a melhor imagem (a prancha deve respeitar a grade e o fundo #00FF00). Se vier torta, com texto ou com elementos tocando a borda, peça novamente.
2. Salve o arquivo (PNG ou JPG, maior resolução possível) e entregue com: `npm run art:process -- bianca-estatica caminho/do/arquivo.png`
3. Confira o relatório com `npm run art:review -- bianca-estatica` (abre `revisao/relatorio.html`).

## Observações

- Quadro único (sprite de 1 quadro); pés apoiados na base do quadro. Animação (walk/celebrate) fica para uma etapa posterior.
