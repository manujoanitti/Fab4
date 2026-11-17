# Cenário da Região 2 — Castelo das Fadas

- **Lote:** `cenario-regiao-2` · prioridade P1 · recursos: 1
- **Depende de (aprovados antes):** `cenario-regiao-1`

## 1. Anexe estes arquivos ao Gemini

- **Obrigatório** — `art-work/referencias/folha-de-estilo.png` — Folha de estilo visual aprovada (traço, paleta, atmosfera) ✅ presente
- Recomendado — `art-work/referencias/layout-regiao-2.png` — Layout de referência da Região 2 (opcional: use se você tiver) ⚠️ AINDA NÃO ENVIADO
- **Obrigatório** — `docs/arte/guias/regiao-2.png` — Guia de layout com a posição real das 5 casas, o corredor da trilha e as zonas livres ✅ presente

## 2. Cole este prompt no Gemini

````text
Gere UMA ÚNICA ILUSTRAÇÃO de cenário, em formato retrato (proporção próxima de 800:1080), na MAIOR resolução disponível: o cenário da Região 2 de um jogo infantil que parece um livro de contos.

IDENTIDADE ARTÍSTICA (siga a folha de estilo anexa):
- Fantasia onírica e poética.
- Aquarela e lápis de cor, com a textura do papel visível e pequenas imperfeições manuais.
- Formas orgânicas e ligeiramente surreais (proporções suavemente fora do comum, curvas vivas, nada rígido).
- Paleta delicada, rica e harmoniosa: pastéis com profundidade, nunca neon nem saturação plástica.
- Atmosfera de livro ilustrado infantil, acolhedora e contemplativa.

EVITE:
- qualquer aparência genérica de jogo mobile (botões brilhantes de plástico, gemas 3D, brilho metálico, "gloss", contornos grossos de desenho animado vetorial)
- elementos de interface de jogo desenhados dentro da imagem (barras, molduras, ícones de moeda genéricos)
- estilo 3D, render, fotografia ou pixel art

TEMA DA REGIÃO 2 — Castelo das Fadas:
- Cena: castelo das fadas ao fundo, de torres finas em rosa e creme com telhados de ametista, bandeirinhas, árvores lilases, flores cor-de-rosa e nuvens como algodão.
- Cores dominantes: lavanda e lilás-ametista (do lavanda quase branco no alto ao lilás mais profundo embaixo), com rosa e creme.
- Continuidade: a borda INFERIOR deve se fundir suavemente com a paisagem de "Floresta dos Sonhos" (a região logo abaixo) e a borda SUPERIOR com a de "Lago Cristalino" quando houver; mesma luz, mesma escala dos elementos e o mesmo traço das ilustrações anteriores desta conversa.

COMPOSIÇÃO (siga o guia anexo e, se anexado, o layout de referência):
- O cenário é o FUNDO do mapa. NÃO desenhe trilha, caminho, casas, círculos, números, faixas, placas nem texto: o aplicativo desenha tudo isso por cima.
- Mantenha LIVRE e calmo (sem objetos grandes nem contrastes fortes) o corredor sinuoso e os 5 círculos marcados no guia; decoração só nas laterais e no fundo.
- Iluminação suave vinda de cima, à esquerda. Bordas superior e inferior devem poder continuar nas regiões vizinhas (sem moldura, sem corte abrupto de cor).
- Proporção final aproximada 800:1080.

Responda somente com a imagem.
````

## 3. Depois de gerar

1. Escolha a melhor imagem.
2. Salve o arquivo (PNG ou JPG, maior resolução possível) e entregue com: `npm run art:process -- cenario-regiao-2 caminho/do/arquivo.png`
3. Confira o relatório com `npm run art:review -- cenario-regiao-2` (abre `revisao/relatorio.html`).

## Observações

- Entrega o cenário como camada de FUNDO: a trilha, as casas, a faixa e o véu continuam sendo desenhados pelo app.
- A arte NÃO deve conter trilha, casas, números nem texto; deixe livres o corredor e os círculos das casas.
