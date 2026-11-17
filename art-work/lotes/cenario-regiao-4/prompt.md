# Cenário da Região 4 — Montanhas da Coragem

- **Lote:** `cenario-regiao-4` · prioridade P1 · recursos: 1
- **Depende de (aprovados antes):** `cenario-regiao-3`

## 1. Anexe estes arquivos ao Gemini

- **Obrigatório** — `art-work/referencias/folha-de-estilo.png` — Folha de estilo visual aprovada (traço, paleta, atmosfera) ✅ presente
- Recomendado — `art-work/referencias/layout-regiao-4.png` — Layout de referência da Região 4 (opcional: use se você tiver) ⚠️ AINDA NÃO ENVIADO
- **Obrigatório** — `docs/arte/guias/regiao-4.png` — Guia de layout com a posição real das 5 casas, o corredor da trilha e as zonas livres ✅ presente

## 2. Cole este prompt no Gemini

````text
Gere UMA ÚNICA ILUSTRAÇÃO de cenário, em formato retrato (proporção próxima de 800:1080), na MAIOR resolução disponível: o cenário da Região 4 de um jogo infantil que parece um livro de contos.

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

TEMA DA REGIÃO 4 — Montanhas da Coragem:
- Cena: montanhas azul-acinzentadas de picos nevados, pinheiros, névoa baixa e, ao longe, uma bandeira dourada no ponto mais alto.
- Cores dominantes: azul-acinzentados frios (do cinza-azulado muito claro no alto ao azul-aço suave embaixo), com pequenos toques de dourado.
- Continuidade: a borda INFERIOR deve se fundir suavemente com a paisagem de "Lago Cristalino" (a região logo abaixo) e a borda SUPERIOR com a de "Jardim da Magia" quando houver; mesma luz, mesma escala dos elementos e o mesmo traço das ilustrações anteriores desta conversa.

COMPOSIÇÃO (siga o guia anexo e, se anexado, o layout de referência):
- O cenário é o FUNDO do mapa. NÃO desenhe trilha, caminho, casas, círculos, números, faixas, placas nem texto: o aplicativo desenha tudo isso por cima.
- Mantenha LIVRE e calmo (sem objetos grandes nem contrastes fortes) o corredor sinuoso e os 5 círculos marcados no guia; decoração só nas laterais e no fundo.
- Iluminação suave vinda de cima, à esquerda. Bordas superior e inferior devem poder continuar nas regiões vizinhas (sem moldura, sem corte abrupto de cor).
- Proporção final aproximada 800:1080.

Responda somente com a imagem.
````

## 3. Depois de gerar

1. Escolha a melhor imagem.
2. Salve o arquivo (PNG ou JPG, maior resolução possível) e entregue com: `npm run art:process -- cenario-regiao-4 caminho/do/arquivo.png`
3. Confira o relatório com `npm run art:review -- cenario-regiao-4` (abre `revisao/relatorio.html`).

## Observações

- Entrega o cenário como camada de FUNDO: a trilha, as casas, a faixa e o véu continuam sendo desenhados pelo app.
- A arte NÃO deve conter trilha, casas, números nem texto; deixe livres o corredor e os círculos das casas.
