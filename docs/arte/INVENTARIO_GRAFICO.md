# Inventário gráfico do Reino da Bianca

> Gerado por `npm run art:inventario` a partir do estado real do repositório (catálogo × plano × `art-work/registro.json` × manifesto × arquivos). **Não edite à mão**: regenere.
> **Imagem-base** = a imagem que o Gemini gera (prancha, cenário ou imagem individual). **Recurso** = cada arquivo final extraído dela. As colunas "recebida/processada/aprovada" de um recurso refletem o estado da imagem-base do seu lote.

## 1. Resumo

| Indicador | Valor |
|---|---|
| Recursos previstos (catálogo) | **116** |
| Integrados ao app (`public/art/v1`) | **6** |
| Pendentes | **110** (76 em lotes planejados + 34 adiados) |
| Imagens-base planejadas (lotes) | 25 (14 pranchas, 5 cenários, 6 individuais) |
| Imagens-base já recebidas do Gemini | **1** (`piloto-marcos-regiao-1`) |
| Imagens-base ainda necessárias | **24** |
| Lotes com prompt e guia prontos | 6 (`piloto-marcos-regiao-1`, `cenario-regiao-1`, `cenario-regiao-2`, `cenario-regiao-3`, `cenario-regiao-4`, `cenario-regiao-5`) |
| Prioridade P0 / P1 / P2 (recursos) | 21 / 65 / 30 — integrados: 4 / 2 / 0 |

## 2. Tabela única de recursos

Prioridade visual: P0 = essencial para o visual do app; P1 = importante; P2 = refinamento. "Prompt e guia" = existem prompt do Gemini **e** guia de posição já preparados para o lote do recurso.

| ID | Região / conjunto | Descrição | Prio | Recebida? | Processada? | Aprovada? | Integrada? | Prompt e guia? | Próxima ação |
|---|---|---|---|---|---|---|---|---|---|
| `map.region.1.bg` | Mapa · Região 1 — Floresta dos Sonhos | Fundo opaco da região 1 (Floresta dos Sonhos): terreno, céu/água/montanha e iluminação. Sem trilha, sem… | P0 | não | não | não | não | sim | Gerar imagem-base no Gemini (cenario-regiao-1) |
| `map.region.1.mid` | Mapa · Região 1 — Floresta dos Sonhos | Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo… | P0 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.1.path` | Mapa · Região 1 — Floresta dos Sonhos | Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente. | P0 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.1.fg` | Mapa · Região 1 — Floresta dos Sonhos | Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente… | P0 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.ribbon.1` | Mapa · Região 1 — Floresta dos Sonhos | Faixa/fita do título da região 1, SEM texto (o nome é desenhado pelo app). | P1 | sim | sim | sim | sim | sim | Concluído — não refazer |
| `map.region.2.bg` | Mapa · Região 2 — Castelo das Fadas | Fundo opaco da região 2 (Castelo das Fadas): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas… | P1 | não | não | não | não | sim | Gerar imagem-base no Gemini (cenario-regiao-2) |
| `map.region.2.mid` | Mapa · Região 2 — Castelo das Fadas | Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.2.path` | Mapa · Região 2 — Castelo das Fadas | Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente. | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.2.fg` | Mapa · Região 2 — Castelo das Fadas | Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.ribbon.2` | Mapa · Região 2 — Castelo das Fadas | Faixa/fita do título da região 2, SEM texto (o nome é desenhado pelo app). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (faixas-regioes-2-5) |
| `map.region.3.bg` | Mapa · Região 3 — Lago Cristalino | Fundo opaco da região 3 (Lago Cristalino): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas… | P1 | não | não | não | não | sim | Gerar imagem-base no Gemini (cenario-regiao-3) |
| `map.region.3.mid` | Mapa · Região 3 — Lago Cristalino | Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.3.path` | Mapa · Região 3 — Lago Cristalino | Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente. | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.3.fg` | Mapa · Região 3 — Lago Cristalino | Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.ribbon.3` | Mapa · Região 3 — Lago Cristalino | Faixa/fita do título da região 3, SEM texto (o nome é desenhado pelo app). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (faixas-regioes-2-5) |
| `map.region.4.bg` | Mapa · Região 4 — Montanhas da Coragem | Fundo opaco da região 4 (Montanhas da Coragem): terreno, céu/água/montanha e iluminação. Sem trilha, sem… | P1 | não | não | não | não | sim | Gerar imagem-base no Gemini (cenario-regiao-4) |
| `map.region.4.mid` | Mapa · Região 4 — Montanhas da Coragem | Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.4.path` | Mapa · Região 4 — Montanhas da Coragem | Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente. | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.4.fg` | Mapa · Região 4 — Montanhas da Coragem | Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.ribbon.4` | Mapa · Região 4 — Montanhas da Coragem | Faixa/fita do título da região 4, SEM texto (o nome é desenhado pelo app). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (faixas-regioes-2-5) |
| `map.region.5.bg` | Mapa · Região 5 — Jardim da Magia | Fundo opaco da região 5 (Jardim da Magia): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas… | P1 | não | não | não | não | sim | Gerar imagem-base no Gemini (cenario-regiao-5) |
| `map.region.5.mid` | Mapa · Região 5 — Jardim da Magia | Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.5.path` | Mapa · Região 5 — Jardim da Magia | Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente. | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.region.5.fg` | Mapa · Região 5 — Jardim da Magia | Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente… | P1 | não | não | não | não | não | Adiado: camadas (cenário entra como fundo único) |
| `map.ribbon.5` | Mapa · Região 5 — Jardim da Magia | Faixa/fita do título da região 5, SEM texto (o nome é desenhado pelo app). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (faixas-regioes-2-5) |
| `map.top.bg` | Mapa · Topo e base | Faixa superior do mapa: céu e horizonte do "final do reino" (atrás do bônus final). | P1 | não | não | não | não | sim | Gerar imagem-base no Gemini (cenario-regiao-5) |
| `map.bottom.bg` | Mapa · Topo e base | Faixa inferior do mapa: ponto de partida ("Início"), chão e entrada do reino. | P0 | não | não | não | não | sim | Gerar imagem-base no Gemini (cenario-regiao-1) |
| `map.fog` | Mapa · Topo e base | Véu/névoa mágica sobre regiões ainda bloqueadas. Semitransparente. | P1 | não | não | não | não | não | Adiado: véu: método próprio ou mantido pelo app |
| `map.start` | Mapa · Marcos | Placa/marco "Início" (poste e placa), SEM texto. | P0 | sim | sim | sim | sim | sim | Concluído — não refazer |
| `map.node.locked` | Mapa · Marcos das fases | Marco de fase — casa BLOQUEADA (ainda não alcançável): apagada/cinza/com cadeado discreto. SEM número (o app… | P0 | sim | sim | sim | sim | sim | Concluído — não refazer |
| `map.node.available` | Mapa · Marcos das fases | Marco de fase — casa DISPONÍVEL (próxima fase): viva, convidativa, com brilho. SEM número (o app desenha o… | P0 | sim | sim | sim | sim | sim | Concluído — não refazer |
| `map.node.done` | Mapa · Marcos das fases | Marco de fase — casa CONCLUÍDA: carimbo/selo dourado já conquistado. SEM número (o app desenha o número). | P0 | sim | sim | sim | sim | sim | Concluído — não refazer |
| `map.node.selected` | Mapa · Marcos das fases | Anel/halo de SELEÇÃO sobreposto à casa tocada (overlay, não substitui o estado). | P1 | sim | sim | sim | sim | sim | Concluído — não refazer |
| `map.node.1.locked` | Mapa · Marcos por região (opcional) | Variante do marco locked com a identidade da região 1. Opcional: se ausente, usa map.node.locked. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.1.available` | Mapa · Marcos por região (opcional) | Variante do marco available com a identidade da região 1. Opcional: se ausente, usa map.node.available. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.1.done` | Mapa · Marcos por região (opcional) | Variante do marco done com a identidade da região 1. Opcional: se ausente, usa map.node.done. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.2.locked` | Mapa · Marcos por região (opcional) | Variante do marco locked com a identidade da região 2. Opcional: se ausente, usa map.node.locked. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.2.available` | Mapa · Marcos por região (opcional) | Variante do marco available com a identidade da região 2. Opcional: se ausente, usa map.node.available. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.2.done` | Mapa · Marcos por região (opcional) | Variante do marco done com a identidade da região 2. Opcional: se ausente, usa map.node.done. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.3.locked` | Mapa · Marcos por região (opcional) | Variante do marco locked com a identidade da região 3. Opcional: se ausente, usa map.node.locked. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.3.available` | Mapa · Marcos por região (opcional) | Variante do marco available com a identidade da região 3. Opcional: se ausente, usa map.node.available. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.3.done` | Mapa · Marcos por região (opcional) | Variante do marco done com a identidade da região 3. Opcional: se ausente, usa map.node.done. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.4.locked` | Mapa · Marcos por região (opcional) | Variante do marco locked com a identidade da região 4. Opcional: se ausente, usa map.node.locked. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.4.available` | Mapa · Marcos por região (opcional) | Variante do marco available com a identidade da região 4. Opcional: se ausente, usa map.node.available. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.4.done` | Mapa · Marcos por região (opcional) | Variante do marco done com a identidade da região 4. Opcional: se ausente, usa map.node.done. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.5.locked` | Mapa · Marcos por região (opcional) | Variante do marco locked com a identidade da região 5. Opcional: se ausente, usa map.node.locked. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.5.available` | Mapa · Marcos por região (opcional) | Variante do marco available com a identidade da região 5. Opcional: se ausente, usa map.node.available. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.node.5.done` | Mapa · Marcos por região (opcional) | Variante do marco done com a identidade da região 5. Opcional: se ausente, usa map.node.done. | P2 | não | não | não | não | não | Adiado: variante por região (após marcos genéricos) |
| `map.bonus.locked` | Mapa · Marcos | Bônus final ainda bloqueado: presente/baú fechado e discreto. SEM texto. | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (bonus-final) |
| `map.bonus.unlocked` | Mapa · Marcos | Bônus final conquistado: coroa/baú aberto, radiante. SEM texto. | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (bonus-final) |
| `char.bianca.idle` | Personagem · Bianca | Bianca — animação "idle": respiração/balanço leve em pé. Tira horizontal (6 quadros 256×256). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (bianca-estatica) — falta modelo-bianca.png |
| `char.bianca.walk` | Personagem · Bianca | Bianca — animação "walk": caminhada (para a direita; o app não espelha). Tira horizontal (8 quadros 256×256). | P0 | não | não | não | não | não | Adiado: animação da Bianca (começa estática) |
| `char.bianca.celebrate` | Personagem · Bianca | Bianca — animação "celebrate": comemoração ao concluir o reino. Tira horizontal (8 quadros 256×256). | P1 | não | não | não | não | não | Adiado: animação da Bianca (começa estática) |
| `fx.sparkle` | Efeitos | Brilho mágico decorativo (substitui o ✨ espalhado pelo mapa). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (efeitos-brilho) |
| `fx.node.complete` | Efeitos | Explosão de estrelas/pétalas ao chegar a uma casa concluída (toca uma vez). | P2 | não | não | não | não | não | Adiado: sprite de efeito (após arte estática) |
| `ui.icon.stamp-small` | UI · Indicadores | Selo pequeno (1 por fase) (substitui ⭐). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-1) |
| `ui.icon.coin` | UI · Indicadores | Moeda (substitui 🪙). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-1) |
| `ui.icon.stamp-big` | UI · Indicadores | Selo grande (por etapa) (substitui 🏅). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-1) |
| `ui.icon.stamp-day` | UI · Indicadores | Selo do dia (medalha diária) (substitui 🌟). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-1) |
| `ui.icon.credit` | UI · Indicadores | Crédito de minigame (substitui 🎮). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-1) |
| `ui.brand.crown` | UI · Marca | Coroa da marca (cabeçalho e abertura) (substitui 👑). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-1) |
| `ui.icon.mode-child` | UI · Navegação | Alternar para o modo da Bianca (substitui 👧). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-2) |
| `ui.icon.mode-guardian` | UI · Navegação | Alternar para o modo responsável (cadeado) (substitui 🔒). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-2) |
| `ui.tab.map` | UI · Navegação | Aba "Mapa" (substitui 🗺️). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-2) |
| `ui.tab.goals` | UI · Navegação | Aba "Metas" (substitui 📝). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-2) |
| `ui.tab.achievements` | UI · Navegação | Aba "Conquistas" (substitui 🏅). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-2) |
| `ui.tab.games` | UI · Navegação | Aba "Jogos" (substitui 🎮). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-2) |
| `ui.tab.review` | UI · Navegação | Aba "Hoje (revisão)" (substitui 📝). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.tab.prizes` | UI · Navegação | Aba "Prêmios" (substitui 🎁). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.tab.credits` | UI · Navegação | Aba "Créditos" (substitui 🎮). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.tab.history` | UI · Navegação | Aba "Histórico" (substitui 📜). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.tab.more` | UI · Navegação | Aba "Mais" (substitui ⚙️). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.status.pending` | UI · Estados das metas | Meta pendente (substitui ⏳). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.status.done` | UI · Estados das metas | Meta cumprida (substitui ✅). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.status.not-done` | UI · Estados das metas | Meta não cumprida (substitui ❌). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.status.not-evaluated` | UI · Estados das metas | Meta não avaliada (substitui ➖). | P0 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-3) |
| `ui.sync.loading` | UI · Sincronização | Carregando (substitui ⏳). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-4) |
| `ui.sync.synced` | UI · Sincronização | Sincronizado (substitui ☁️). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-4) |
| `ui.sync.syncing` | UI · Sincronização | Sincronizando (substitui 🔄). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-4) |
| `ui.sync.pending` | UI · Sincronização | Alterações pendentes (substitui 🕓). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-4) |
| `ui.sync.offline` | UI · Sincronização | Offline (substitui 📴). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-4) |
| `ui.sync.conflict` | UI · Sincronização | Conflito a resolver (substitui ⚠️). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-4) |
| `ui.sync.error` | UI · Sincronização | Erro de sincronização (substitui ❌). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (icones-ui-4) |
| `ui.celebration.stage` | UI · Celebração | Celebração de etapa concluída (substitui 🎉 no aviso). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (celebracoes) |
| `ui.celebration.final` | UI · Celebração | Celebração do reino conquistado (substitui 🎉 no aviso). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (celebracoes) |
| `ui.bg.app` | UI · Fundos (CSS) | Fundo geral do app (atrás das telas), sutil, sem elementos no centro. | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (fundo-ui-bg-app) |
| `ui.bg.topbar` | UI · Fundos (CSS) | Fundo do cabeçalho (faixa superior). | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (fundo-ui-bg-topbar) |
| `ui.button.primary` | UI · Fundos (CSS) | Fundo do botão principal (esticado, sem 9-slice nesta versão): sem texto, bordas arredondadas completas. | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (fundo-ui-button-primary) |
| `ui.panel.sheet` | UI · Fundos (CSS) | Fundo das folhas (bottom sheet): papel/pergaminho suave. | P2 | não | não | não | não | não | Gerar prompt/guia e imagem-base (fundo-ui-panel-sheet) |
| `game.stars.bg` | Minigames · Fundos | Céu noturno do jogo Caça às Estrelas (sem estrelas; elas vêm do jogo). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (fundo-game-stars-bg) |
| `game.garden.bg` | Minigames · Fundos | Cenário do Jardim Encantado: céu e gramado vazios (proporção 4:5). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (fundo-game-garden-bg) |
| `game.stars.star` | Minigame · Caça às Estrelas | Estrela tocável (substitui ⭐). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-1) |
| `game.stars.star.hit` | Minigame · Caça às Estrelas | Estrela atingida (brilho/explosão curta) (substitui ✨). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-1) |
| `game.crystals.back` | Minigame · Memória dos Cristais | Verso da carta virada (substitui ❔). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.crystal` | Minigame · Memória dos Cristais | Símbolo da carta: Cristal (substitui 💎). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.orb` | Minigame · Memória dos Cristais | Símbolo da carta: Orbe mágico (substitui 🔮). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.moon` | Minigame · Memória dos Cristais | Símbolo da carta: Lua (substitui 🌙). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.star` | Minigame · Memória dos Cristais | Símbolo da carta: Estrela (substitui ⭐). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.unicorn` | Minigame · Memória dos Cristais | Símbolo da carta: Unicórnio (substitui 🦄). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.blossom` | Minigame · Memória dos Cristais | Símbolo da carta: Flor de cerejeira (substitui 🌸). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.mushroom` | Minigame · Memória dos Cristais | Símbolo da carta: Cogumelo (substitui 🍄). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.crystals.symbol.butterfly` | Minigame · Memória dos Cristais | Símbolo da carta: Borboleta (substitui 🦋). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-2) |
| `game.garden.item.tulip` | Minigame · Jardim Encantado | Item de decoração: Tulipa (substitui 🌷). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-1) |
| `game.garden.item.blossom` | Minigame · Jardim Encantado | Item de decoração: Flor de cerejeira (substitui 🌸). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-1) |
| `game.garden.item.sunflower` | Minigame · Jardim Encantado | Item de decoração: Girassol (substitui 🌻). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-1) |
| `game.garden.item.tree` | Minigame · Jardim Encantado | Item de decoração: Árvore (substitui 🌳). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-1) |
| `game.garden.item.mushroom` | Minigame · Jardim Encantado | Item de decoração: Cogumelo (substitui 🍄). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-1) |
| `game.garden.item.butterfly` | Minigame · Jardim Encantado | Item de decoração: Borboleta (substitui 🦋). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-1) |
| `game.garden.item.rabbit` | Minigame · Jardim Encantado | Item de decoração: Coelhinho (substitui 🐰). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-2) |
| `game.garden.item.rainbow` | Minigame · Jardim Encantado | Item de decoração: Arco-íris (substitui 🌈). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-2) |
| `game.garden.item.unicorn` | Minigame · Jardim Encantado | Item de decoração: Unicórnio (bônus da etapa 5) (substitui 🦄). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-2) |
| `game.garden.item.castle` | Minigame · Jardim Encantado | Item de decoração: Castelo (bônus da etapa 5) (substitui 🏰). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-2) |
| `game.garden.item.fairy` | Minigame · Jardim Encantado | Item de decoração: Fada (bônus da etapa 5) (substitui 🧚). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-2) |
| `game.icon.stars` | Minigames · Cartões do hub | Ícone do cartão do jogo Caça às Estrelas (substitui ⭐). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-1) |
| `game.icon.crystals` | Minigames · Cartões do hub | Ícone do cartão do jogo Memória dos Cristais (substitui 💎). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l6-1) |
| `game.icon.garden` | Minigames · Cartões do hub | Ícone do cartão do jogo Jardim Encantado (substitui 🌷). | P1 | não | não | não | não | não | Gerar prompt/guia e imagem-base (jogos-l7-1) |

## 3. Lotes (imagens-base)

| # | Lote | Tipo | Recursos | Prio | Estado | Prompt e guia | Pré-requisito que falta |
|---|---|---|---|---|---|---|---|
| 1 | `piloto-marcos-regiao-1` | prancha | 6 | P0 | integrado | sim | — |
| 2 | `cenario-regiao-1` | cenario | 2 | P0 | aguardando_geracao | sim | — |
| 3 | `cenario-regiao-2` | cenario | 1 | P1 | aguardando_geracao | sim | — |
| 4 | `cenario-regiao-3` | cenario | 1 | P1 | aguardando_geracao | sim | — |
| 5 | `cenario-regiao-4` | cenario | 1 | P1 | aguardando_geracao | sim | — |
| 6 | `cenario-regiao-5` | cenario | 2 | P1 | aguardando_geracao | sim | — |
| 7 | `bianca-estatica` | prancha | 1 | P0 | planejado | não | `art-work/referencias/modelo-bianca.png` |
| 8 | `icones-ui-1` | prancha | 6 | P0 | planejado | não | — |
| 9 | `icones-ui-2` | prancha | 6 | P1 | planejado | não | — |
| 10 | `icones-ui-3` | prancha | 9 | P0 | planejado | não | — |
| 11 | `icones-ui-4` | prancha | 7 | P2 | planejado | não | — |
| 12 | `faixas-regioes-2-5` | prancha | 4 | P1 | planejado | não | — |
| 13 | `bonus-final` | prancha | 2 | P1 | planejado | não | — |
| 14 | `jogos-l6-1` | prancha | 4 | P1 | planejado | não | — |
| 15 | `jogos-l6-2` | prancha | 9 | P1 | planejado | não | — |
| 16 | `jogos-l7-1` | prancha | 7 | P1 | planejado | não | — |
| 17 | `jogos-l7-2` | prancha | 5 | P1 | planejado | não | — |
| 18 | `fundo-game-stars-bg` | individual | 1 | P1 | planejado | não | — |
| 19 | `fundo-game-garden-bg` | individual | 1 | P1 | planejado | não | — |
| 20 | `fundo-ui-bg-app` | individual | 1 | P2 | planejado | não | — |
| 21 | `fundo-ui-bg-topbar` | individual | 1 | P2 | planejado | não | — |
| 22 | `fundo-ui-button-primary` | individual | 1 | P2 | planejado | não | — |
| 23 | `fundo-ui-panel-sheet` | individual | 1 | P2 | planejado | não | — |
| 24 | `efeitos-brilho` | prancha | 1 | P2 | planejado | não | — |
| 25 | `celebracoes` | prancha | 2 | P2 | planejado | não | — |

## 4. Diagnóstico

- **Concluídos:** 6 recursos (piloto `piloto-marcos-regiao-1`): 4 estados de casa, anel de seleção, marco Início e faixa da Região 1. Não refazer.
- **Pranchas que rendem vários recursos:** `piloto-marcos-regiao-1` (6), `bianca-estatica` (1), `icones-ui-1` (6), `icones-ui-2` (6), `icones-ui-3` (9), `icones-ui-4` (7), `faixas-regioes-2-5` (4), `bonus-final` (2), `jogos-l6-1` (4), `jogos-l6-2` (9), `jogos-l7-1` (7), `jogos-l7-2` (5), `efeitos-brilho` (1), `celebracoes` (2).
- **Cenários:** 5 imagens-base (uma por região) → 7 recursos (`map.region.N.bg`, `map.bottom.bg`, `map.top.bg`). São o maior ganho visual por geração e já têm prompt e guia.
- **Imagens individuais** (1 imagem = 1 recurso): `fundo-game-stars-bg`, `fundo-game-garden-bg`, `fundo-ui-bg-app`, `fundo-ui-bg-topbar`, `fundo-ui-button-primary`, `fundo-ui-panel-sheet` — fundos de minigames e de interface; baixo risco, podem esperar.
- **Adiados (34) sem prejuízo à experiência:** 15 marcos por região (os genéricos aprovados já cobrem todas as regiões), 15 camadas extras do mapa (`mid`/`path`/`fg`: o cenário entra como fundo e o app desenha trilha e casas), 3 animações (Bianca andando/comemorando e brilho de conclusão) e o véu de região bloqueada (o app mantém o véu atual).
- **Bloqueio conhecido:** `bianca-estatica` exige `art-work/referencias/modelo-bianca.png` (ainda não recebido). Os layouts `layout-regiao-N.png` são opcionais.
- **Pendências não bloqueantes do piloto:** marco Início próximo da fase 1.1; possível distorção da textura da faixa; adequar as faixas das demais regiões (lote `faixas-regioes-2-5`).

## 5. Plano de produção (minimiza gerações e intervenções)

Ordem por impacto visual. "Sessão" = um bloco de gerações no Gemini sem voltar ao Claude entre elas; depois entrega-se tudo de uma vez.

| Sessão | Lotes | Imagens-base | Recursos | Por quê | Pré-requisito |
|---|---|---|---|---|---|
| A | `cenario-regiao-1` … `cenario-regiao-5` | 5 | 7 | Troca o fundo do mapa inteiro (maior efeito visual). Pacote pronto em `art-work/pacote-cenarios/`. | — |
| B | `icones-ui-1`, `icones-ui-3` | 2 | 15 | Todos os ícones P0 (moedas, selos, navegação principal). | — |
| C | `bianca-estatica` | 1 | 1 | A personagem é o centro do mapa. | **modelo-bianca.png** (você envia) |
| D | `faixas-regioes-2-5`, `bonus-final` | 2 | 6 | Completa as faixas (usa a mesma técnica de fatias) e o prêmio final. | Piloto aprovado ✅ |
| E | `icones-ui-2`, `jogos-l6-1`, `jogos-l6-2` | 3 | 19 | Estados das metas e minigame Cristais. | — |
| F | `jogos-l7-1`, `jogos-l7-2`, `fundo-game-stars-bg`, `fundo-game-garden-bg` | 4 | 14 | Minigames restantes e seus fundos. | — |
| G | `icones-ui-4`, `fundo-ui-*` (4), `efeitos-brilho`, `celebracoes` | 7 | 14 | Refinamentos P2. | — |

### Próximos cinco lotes recomendados

1. **Cenários das 5 regiões** (`cenario-regiao-1` … `5`) — 5 imagens, 7 recursos; pacote pronto.
2. **`icones-ui-1`** (P0, 6 recursos).
3. **`icones-ui-3`** (P0, 9 recursos).
4. **`bianca-estatica`** (P0, 1 recurso) — depende do modelo da Bianca.
5. **`faixas-regioes-2-5`** (P1, 4 recursos) — resolve a pendência das faixas.

> Antes de gerar qualquer prompt novo desses lotes (2–5), peça `npm run art:prompt -- <lote>` (ou o pacote em lote, como o dos cenários): hoje só o piloto e os cenários têm prompt e guia.
