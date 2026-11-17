# Catálogo de recursos gráficos

> **Gerado automaticamente** de `src/art/catalog.json` (`npm run art:docs`). Não edite este arquivo: altere o JSON e regenere.

Total: **116 recursos** em 23 grupos. Contrato completo (formatos, camadas, nomes, cache): [contrato-integracao.md](contrato-integracao.md). Ordem de produção: [plano-producao-gemini.md](plano-producao-gemini.md).

**Leitura das colunas** — *Px* = tamanho do arquivo (@2x; o mapa lógico tem 400 unidades de largura). *Exato* = o arquivo precisa ter exatamente esse tamanho; *proporção* = qualquer tamanho com a mesma proporção entre 0,5× e 2× do indicado. *Alfa* = exige fundo transparente. **Todos os recursos são opcionais**: sem o arquivo, o app usa o visual atual (fallback). **Nenhum recurso deve conter texto** (números, nomes de regiões, "Início" e "Bônus final" são desenhados pelo app).

## Resumo por lote

| Lote | Recursos | Prioridades |
|---|---:|---|
| Lote 0 — Região 1 + personagem + marcos (referência de estilo) | 14 | P0, P1 |
| Lote 1 — Ícones de interface | 28 | P0, P1, P2 |
| Lote 2 — Região 2 (Castelo das Fadas) e névoa | 6 | P1 |
| Lote 3 — Região 3 (Lago Cristalino) | 5 | P1 |
| Lote 4 — Região 4 (Montanhas da Coragem) | 5 | P1 |
| Lote 5 — Região 5 (Jardim da Magia), topo e bônus final | 8 | P1 |
| Lote 6 — Minigames: Caça às Estrelas e Memória dos Cristais | 14 | P1 |
| Lote 7 — Minigame: Jardim Encantado | 13 | P1 |
| Lote 8 — Fundos de interface e efeitos | 6 | P2 |
| Lote 9 — Opcionais (marcos por região, celebrações) | 17 | P2 |

## Mapa · Região 1 — Floresta dos Sonhos

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.region.1.bg` | `map/region-1-bg@2x.webp` ou `map/region-1-bg@2x.png` | 800×1080 | exato | .webp / .png | não | P0 · L0 | MapView › fundo da região (src/ui/MapView.tsx) |
| `map.region.1.mid` | `map/region-1-mid@2x.webp` ou `map/region-1-mid@2x.png` | 800×1080 | exato | .webp / .png | sim | P0 · L0 | MapView › decoração da região |
| `map.region.1.path` | `map/region-1-path@2x.webp` ou `map/region-1-path@2x.png` | 800×1080 | exato | .webp / .png | sim | P0 · L0 | MapView › trilha |
| `map.region.1.fg` | `map/region-1-fg@2x.webp` ou `map/region-1-fg@2x.png` | 800×1080 | exato | .webp / .png | sim | P0 · L0 | MapView › primeiro plano |
| `map.ribbon.1` | `map/ribbon-1@2x.webp` ou `map/ribbon-1@2x.png` ou `map/ribbon-1.svg` | 480×96 | proporção | .webp / .png / .svg | sim | P1 · L0 | MapView › faixa da região |

- **`map.region.1.bg`** — Fundo opaco da região 1 (Floresta dos Sonhos): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas, sem texto.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 450 KB
  - Posicionamento/ancoragem: Faixa 400×540 unidades do mapa em x=0, y=2290 (de cima para baixo: região 5 no topo, região 1 embaixo). Sem sobreposição com as faixas vizinhas.
  - Relação com outras camadas: Base de mid, path e fg da mesma região — gerar em conjunto com .mid/.path/.fg e o guia de layout; bordas superior e inferior devem casar com as regiões vizinhas.
- **`map.region.1.mid`** — Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 500 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540 do fundo. Manter as faixas laterais; não cobrir o corredor da trilha nem as posições das casas (ver guia).
  - Relação com outras camadas: Desenhada sobre .bg e sob .path; coordenada com .fg (mesma iluminação).
- **`map.region.1.path`** — Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 400 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. A linha central da trilha DEVE passar pelos centros das 5 casas da região (guia de layout) e encontrar as regiões vizinhas nas bordas (x=200 no topo da região).
  - Relação com outras camadas: Substitui o traçado padrão da trilha nesta região; casas e personagem ficam por cima.
- **`map.region.1.fg`** — Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente, esparso.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 300 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. Não cobrir as casas (toque) nem o texto das faixas; elementos pequenos e nas bordas.
  - Relação com outras camadas: Desenhado por último (acima da personagem), sem capturar toques.
- **`map.ribbon.1`** — Faixa/fita do título da região 1, SEM texto (o nome é desenhado pelo app).
  - Proporção/orientação: 480:96 (paisagem) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centro em x=200, y=2326 (36 unidades abaixo do topo da região). Tamanho exibido 240×48. Espaço livre no centro para o texto.
  - Relação com outras camadas: Usa a cor de destaque da região; texto branco sobreposto pelo app.

## Mapa · Região 2 — Castelo das Fadas

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.region.2.bg` | `map/region-2-bg@2x.webp` ou `map/region-2-bg@2x.png` | 800×1080 | exato | .webp / .png | não | P1 · L2 | MapView › fundo da região (src/ui/MapView.tsx) |
| `map.region.2.mid` | `map/region-2-mid@2x.webp` ou `map/region-2-mid@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L2 | MapView › decoração da região |
| `map.region.2.path` | `map/region-2-path@2x.webp` ou `map/region-2-path@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L2 | MapView › trilha |
| `map.region.2.fg` | `map/region-2-fg@2x.webp` ou `map/region-2-fg@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L2 | MapView › primeiro plano |
| `map.ribbon.2` | `map/ribbon-2@2x.webp` ou `map/ribbon-2@2x.png` ou `map/ribbon-2.svg` | 480×96 | proporção | .webp / .png / .svg | sim | P1 · L2 | MapView › faixa da região |

- **`map.region.2.bg`** — Fundo opaco da região 2 (Castelo das Fadas): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas, sem texto.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 450 KB
  - Posicionamento/ancoragem: Faixa 400×540 unidades do mapa em x=0, y=1750 (de cima para baixo: região 5 no topo, região 1 embaixo). Sem sobreposição com as faixas vizinhas.
  - Relação com outras camadas: Base de mid, path e fg da mesma região — gerar em conjunto com .mid/.path/.fg e o guia de layout; bordas superior e inferior devem casar com as regiões vizinhas.
- **`map.region.2.mid`** — Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 500 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540 do fundo. Manter as faixas laterais; não cobrir o corredor da trilha nem as posições das casas (ver guia).
  - Relação com outras camadas: Desenhada sobre .bg e sob .path; coordenada com .fg (mesma iluminação).
- **`map.region.2.path`** — Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 400 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. A linha central da trilha DEVE passar pelos centros das 5 casas da região (guia de layout) e encontrar as regiões vizinhas nas bordas (x=200 no topo da região).
  - Relação com outras camadas: Substitui o traçado padrão da trilha nesta região; casas e personagem ficam por cima.
- **`map.region.2.fg`** — Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente, esparso.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 300 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. Não cobrir as casas (toque) nem o texto das faixas; elementos pequenos e nas bordas.
  - Relação com outras camadas: Desenhado por último (acima da personagem), sem capturar toques.
- **`map.ribbon.2`** — Faixa/fita do título da região 2, SEM texto (o nome é desenhado pelo app).
  - Proporção/orientação: 480:96 (paisagem) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centro em x=200, y=1786 (36 unidades abaixo do topo da região). Tamanho exibido 240×48. Espaço livre no centro para o texto.
  - Relação com outras camadas: Usa a cor de destaque da região; texto branco sobreposto pelo app.

## Mapa · Região 3 — Lago Cristalino

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.region.3.bg` | `map/region-3-bg@2x.webp` ou `map/region-3-bg@2x.png` | 800×1080 | exato | .webp / .png | não | P1 · L3 | MapView › fundo da região (src/ui/MapView.tsx) |
| `map.region.3.mid` | `map/region-3-mid@2x.webp` ou `map/region-3-mid@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L3 | MapView › decoração da região |
| `map.region.3.path` | `map/region-3-path@2x.webp` ou `map/region-3-path@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L3 | MapView › trilha |
| `map.region.3.fg` | `map/region-3-fg@2x.webp` ou `map/region-3-fg@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L3 | MapView › primeiro plano |
| `map.ribbon.3` | `map/ribbon-3@2x.webp` ou `map/ribbon-3@2x.png` ou `map/ribbon-3.svg` | 480×96 | proporção | .webp / .png / .svg | sim | P1 · L3 | MapView › faixa da região |

- **`map.region.3.bg`** — Fundo opaco da região 3 (Lago Cristalino): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas, sem texto.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 450 KB
  - Posicionamento/ancoragem: Faixa 400×540 unidades do mapa em x=0, y=1210 (de cima para baixo: região 5 no topo, região 1 embaixo). Sem sobreposição com as faixas vizinhas.
  - Relação com outras camadas: Base de mid, path e fg da mesma região — gerar em conjunto com .mid/.path/.fg e o guia de layout; bordas superior e inferior devem casar com as regiões vizinhas.
- **`map.region.3.mid`** — Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 500 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540 do fundo. Manter as faixas laterais; não cobrir o corredor da trilha nem as posições das casas (ver guia).
  - Relação com outras camadas: Desenhada sobre .bg e sob .path; coordenada com .fg (mesma iluminação).
- **`map.region.3.path`** — Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 400 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. A linha central da trilha DEVE passar pelos centros das 5 casas da região (guia de layout) e encontrar as regiões vizinhas nas bordas (x=200 no topo da região).
  - Relação com outras camadas: Substitui o traçado padrão da trilha nesta região; casas e personagem ficam por cima.
- **`map.region.3.fg`** — Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente, esparso.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 300 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. Não cobrir as casas (toque) nem o texto das faixas; elementos pequenos e nas bordas.
  - Relação com outras camadas: Desenhado por último (acima da personagem), sem capturar toques.
- **`map.ribbon.3`** — Faixa/fita do título da região 3, SEM texto (o nome é desenhado pelo app).
  - Proporção/orientação: 480:96 (paisagem) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centro em x=200, y=1246 (36 unidades abaixo do topo da região). Tamanho exibido 240×48. Espaço livre no centro para o texto.
  - Relação com outras camadas: Usa a cor de destaque da região; texto branco sobreposto pelo app.

## Mapa · Região 4 — Montanhas da Coragem

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.region.4.bg` | `map/region-4-bg@2x.webp` ou `map/region-4-bg@2x.png` | 800×1080 | exato | .webp / .png | não | P1 · L4 | MapView › fundo da região (src/ui/MapView.tsx) |
| `map.region.4.mid` | `map/region-4-mid@2x.webp` ou `map/region-4-mid@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L4 | MapView › decoração da região |
| `map.region.4.path` | `map/region-4-path@2x.webp` ou `map/region-4-path@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L4 | MapView › trilha |
| `map.region.4.fg` | `map/region-4-fg@2x.webp` ou `map/region-4-fg@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L4 | MapView › primeiro plano |
| `map.ribbon.4` | `map/ribbon-4@2x.webp` ou `map/ribbon-4@2x.png` ou `map/ribbon-4.svg` | 480×96 | proporção | .webp / .png / .svg | sim | P1 · L4 | MapView › faixa da região |

- **`map.region.4.bg`** — Fundo opaco da região 4 (Montanhas da Coragem): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas, sem texto.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 450 KB
  - Posicionamento/ancoragem: Faixa 400×540 unidades do mapa em x=0, y=670 (de cima para baixo: região 5 no topo, região 1 embaixo). Sem sobreposição com as faixas vizinhas.
  - Relação com outras camadas: Base de mid, path e fg da mesma região — gerar em conjunto com .mid/.path/.fg e o guia de layout; bordas superior e inferior devem casar com as regiões vizinhas.
- **`map.region.4.mid`** — Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 500 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540 do fundo. Manter as faixas laterais; não cobrir o corredor da trilha nem as posições das casas (ver guia).
  - Relação com outras camadas: Desenhada sobre .bg e sob .path; coordenada com .fg (mesma iluminação).
- **`map.region.4.path`** — Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 400 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. A linha central da trilha DEVE passar pelos centros das 5 casas da região (guia de layout) e encontrar as regiões vizinhas nas bordas (x=200 no topo da região).
  - Relação com outras camadas: Substitui o traçado padrão da trilha nesta região; casas e personagem ficam por cima.
- **`map.region.4.fg`** — Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente, esparso.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 300 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. Não cobrir as casas (toque) nem o texto das faixas; elementos pequenos e nas bordas.
  - Relação com outras camadas: Desenhado por último (acima da personagem), sem capturar toques.
- **`map.ribbon.4`** — Faixa/fita do título da região 4, SEM texto (o nome é desenhado pelo app).
  - Proporção/orientação: 480:96 (paisagem) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centro em x=200, y=706 (36 unidades abaixo do topo da região). Tamanho exibido 240×48. Espaço livre no centro para o texto.
  - Relação com outras camadas: Usa a cor de destaque da região; texto branco sobreposto pelo app.

## Mapa · Região 5 — Jardim da Magia

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.region.5.bg` | `map/region-5-bg@2x.webp` ou `map/region-5-bg@2x.png` | 800×1080 | exato | .webp / .png | não | P1 · L5 | MapView › fundo da região (src/ui/MapView.tsx) |
| `map.region.5.mid` | `map/region-5-mid@2x.webp` ou `map/region-5-mid@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L5 | MapView › decoração da região |
| `map.region.5.path` | `map/region-5-path@2x.webp` ou `map/region-5-path@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L5 | MapView › trilha |
| `map.region.5.fg` | `map/region-5-fg@2x.webp` ou `map/region-5-fg@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L5 | MapView › primeiro plano |
| `map.ribbon.5` | `map/ribbon-5@2x.webp` ou `map/ribbon-5@2x.png` ou `map/ribbon-5.svg` | 480×96 | proporção | .webp / .png / .svg | sim | P1 · L5 | MapView › faixa da região |

- **`map.region.5.bg`** — Fundo opaco da região 5 (Jardim da Magia): terreno, céu/água/montanha e iluminação. Sem trilha, sem casas, sem texto.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 450 KB
  - Posicionamento/ancoragem: Faixa 400×540 unidades do mapa em x=0, y=130 (de cima para baixo: região 5 no topo, região 1 embaixo). Sem sobreposição com as faixas vizinhas.
  - Relação com outras camadas: Base de mid, path e fg da mesma região — gerar em conjunto com .mid/.path/.fg e o guia de layout; bordas superior e inferior devem casar com as regiões vizinhas.
- **`map.region.5.mid`** — Elementos decorativos de segundo plano (árvores, rochas, flores, construções) ATRÁS da trilha. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 500 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540 do fundo. Manter as faixas laterais; não cobrir o corredor da trilha nem as posições das casas (ver guia).
  - Relação com outras camadas: Desenhada sobre .bg e sob .path; coordenada com .fg (mesma iluminação).
- **`map.region.5.path`** — Trilha (caminho de pedras/areia) da região, com bordas e relevo. Fundo transparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 400 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. A linha central da trilha DEVE passar pelos centros das 5 casas da região (guia de layout) e encontrar as regiões vizinhas nas bordas (x=200 no topo da região).
  - Relação com outras camadas: Substitui o traçado padrão da trilha nesta região; casas e personagem ficam por cima.
- **`map.region.5.fg`** — Elementos de primeiro plano (copas, arcos, folhagem) que passam À FRENTE da personagem. Fundo transparente, esparso.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 300 KB
  - Posicionamento/ancoragem: Mesma faixa 400×540. Não cobrir as casas (toque) nem o texto das faixas; elementos pequenos e nas bordas.
  - Relação com outras camadas: Desenhado por último (acima da personagem), sem capturar toques.
- **`map.ribbon.5`** — Faixa/fita do título da região 5, SEM texto (o nome é desenhado pelo app).
  - Proporção/orientação: 480:96 (paisagem) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centro em x=200, y=166 (36 unidades abaixo do topo da região). Tamanho exibido 240×48. Espaço livre no centro para o texto.
  - Relação com outras camadas: Usa a cor de destaque da região; texto branco sobreposto pelo app.

## Mapa · Topo e base

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.top.bg` | `map/top-bg@2x.webp` ou `map/top-bg@2x.png` | 800×260 | exato | .webp / .png | não | P1 · L5 | MapView › topo |
| `map.bottom.bg` | `map/bottom-bg@2x.webp` ou `map/bottom-bg@2x.png` | 800×260 | exato | .webp / .png | não | P0 · L0 | MapView › base |
| `map.fog` | `map/fog@2x.webp` ou `map/fog@2x.png` | 800×1080 | exato | .webp / .png | sim | P1 · L2 | MapView › véu de região bloqueada |

- **`map.top.bg`** — Faixa superior do mapa: céu e horizonte do "final do reino" (atrás do bônus final).
  - Proporção/orientação: 800:260 (paisagem) · variações/estados: 1 · orçamento: ≤ 150 KB
  - Posicionamento/ancoragem: Faixa 400×130 em x=0, y=0 (topo do mapa).
  - Relação com outras camadas: Deve casar com a borda superior da Região 5.
- **`map.bottom.bg`** — Faixa inferior do mapa: ponto de partida ("Início"), chão e entrada do reino.
  - Proporção/orientação: 800:260 (paisagem) · variações/estados: 1 · orçamento: ≤ 150 KB
  - Posicionamento/ancoragem: Faixa 400×130 em x=0, y=2830 (rodapé do mapa).
  - Relação com outras camadas: Deve casar com a borda inferior da Região 1.
- **`map.fog`** — Véu/névoa mágica sobre regiões ainda bloqueadas. Semitransparente.
  - Proporção/orientação: 800:1080 (retrato) · variações/estados: 1 · orçamento: ≤ 250 KB
  - Posicionamento/ancoragem: Faixa 400×540; desenhada sobre a região bloqueada, sem capturar toques; as casas continuam legíveis.
  - Relação com outras camadas: Aplicada às regiões 2–5 enquanto a anterior não estiver concluída.

## Mapa · Marcos

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.start` | `map/start@2x.webp` ou `map/start@2x.png` ou `map/start.svg` | 192×128 | proporção | .webp / .png / .svg | sim | P0 · L0 | MapView › marco de início |
| `map.bonus.locked` | `map/bonus-locked@2x.webp` ou `map/bonus-locked@2x.png` ou `map/bonus-locked.svg` | 160×160 | proporção | .webp / .png / .svg | sim | P1 · L5 | MapView › bônus final |
| `map.bonus.unlocked` | `map/bonus-unlocked@2x.webp` ou `map/bonus-unlocked@2x.png` ou `map/bonus-unlocked.svg` | 160×160 | proporção | .webp / .png / .svg | sim | P1 · L5 | MapView › bônus final |

- **`map.start`** — Placa/marco "Início" (poste e placa), SEM texto.
  - Proporção/orientação: 192:128 (paisagem) · variações/estados: 1 · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Base do poste no ponto (120, 2913); âncora na base (x=.5,y=1). Tamanho exibido 96×64.
  - Relação com outras camadas: Fica ao lado da casa 1.1; o app escreve "Início" sobre a placa.
- **`map.bonus.locked`** — Bônus final ainda bloqueado: presente/baú fechado e discreto. SEM texto.
  - Proporção/orientação: 160:160 (quadrado) · variações/estados: 2 estados · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Centrado em (200, 62); exibido 80×80.
  - Relação com outras camadas: Par coordenado (locked/unlocked); o app escreve "Bônus final" abaixo.
- **`map.bonus.unlocked`** — Bônus final conquistado: coroa/baú aberto, radiante. SEM texto.
  - Proporção/orientação: 160:160 (quadrado) · variações/estados: 2 estados · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Centrado em (200, 62); exibido 80×80.
  - Relação com outras camadas: Par coordenado (locked/unlocked); o app escreve "Bônus final" abaixo.

## Mapa · Marcos das fases

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.node.locked` | `map/node-locked@2x.webp` ou `map/node-locked@2x.png` ou `map/node-locked.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P0 · L0 | MapView › casas (25) |
| `map.node.available` | `map/node-available@2x.webp` ou `map/node-available@2x.png` ou `map/node-available.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P0 · L0 | MapView › casas (25) |
| `map.node.done` | `map/node-done@2x.webp` ou `map/node-done@2x.png` ou `map/node-done.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P0 · L0 | MapView › casas (25) |
| `map.node.selected` | `map/node-selected@2x.webp` ou `map/node-selected@2x.png` ou `map/node-selected.svg` | 152×152 | proporção | .webp / .png / .svg | sim | P1 · L0 | MapView › casa selecionada |

- **`map.node.locked`** — Marco de fase — casa BLOQUEADA (ainda não alcançável): apagada/cinza/com cadeado discreto. SEM número (o app desenha o número).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 3 estados (locked, available, done) · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centrado na posição da casa; tamanho exibido 64×64 (a área de toque do app é 56×56 e não muda).
  - Relação com outras camadas: Mesmo contorno nos 3 estados para troca sem "pulo"; 3 arquivos coordenados.
- **`map.node.available`** — Marco de fase — casa DISPONÍVEL (próxima fase): viva, convidativa, com brilho. SEM número (o app desenha o número).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 3 estados (locked, available, done) · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centrado na posição da casa; tamanho exibido 64×64 (a área de toque do app é 56×56 e não muda).
  - Relação com outras camadas: Mesmo contorno nos 3 estados para troca sem "pulo"; 3 arquivos coordenados.
- **`map.node.done`** — Marco de fase — casa CONCLUÍDA: carimbo/selo dourado já conquistado. SEM número (o app desenha o número).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 3 estados (locked, available, done) · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centrado na posição da casa; tamanho exibido 64×64 (a área de toque do app é 56×56 e não muda).
  - Relação com outras camadas: Mesmo contorno nos 3 estados para troca sem "pulo"; 3 arquivos coordenados.
- **`map.node.selected`** — Anel/halo de SELEÇÃO sobreposto à casa tocada (overlay, não substitui o estado).
  - Proporção/orientação: 152:152 (quadrado) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centrado na casa; tamanho exibido 76×76; desenhado sobre o marco e sob o número.
  - Relação com outras camadas: Combina com qualquer estado de casa.

## Mapa · Marcos por região (opcional)

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `map.node.1.locked` | `map/node-1-locked@2x.webp` ou `map/node-1-locked@2x.png` ou `map/node-1-locked.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.1.available` | `map/node-1-available@2x.webp` ou `map/node-1-available@2x.png` ou `map/node-1-available.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.1.done` | `map/node-1-done@2x.webp` ou `map/node-1-done@2x.png` ou `map/node-1-done.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.2.locked` | `map/node-2-locked@2x.webp` ou `map/node-2-locked@2x.png` ou `map/node-2-locked.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.2.available` | `map/node-2-available@2x.webp` ou `map/node-2-available@2x.png` ou `map/node-2-available.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.2.done` | `map/node-2-done@2x.webp` ou `map/node-2-done@2x.png` ou `map/node-2-done.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.3.locked` | `map/node-3-locked@2x.webp` ou `map/node-3-locked@2x.png` ou `map/node-3-locked.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.3.available` | `map/node-3-available@2x.webp` ou `map/node-3-available@2x.png` ou `map/node-3-available.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.3.done` | `map/node-3-done@2x.webp` ou `map/node-3-done@2x.png` ou `map/node-3-done.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.4.locked` | `map/node-4-locked@2x.webp` ou `map/node-4-locked@2x.png` ou `map/node-4-locked.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.4.available` | `map/node-4-available@2x.webp` ou `map/node-4-available@2x.png` ou `map/node-4-available.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.4.done` | `map/node-4-done@2x.webp` ou `map/node-4-done@2x.png` ou `map/node-4-done.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.5.locked` | `map/node-5-locked@2x.webp` ou `map/node-5-locked@2x.png` ou `map/node-5-locked.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.5.available` | `map/node-5-available@2x.webp` ou `map/node-5-available@2x.png` ou `map/node-5-available.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |
| `map.node.5.done` | `map/node-5-done@2x.webp` ou `map/node-5-done@2x.png` ou `map/node-5-done.svg` | 128×128 | proporção | .webp / .png / .svg | sim | P2 · L9 | MapView › casas da região |

- **`map.node.1.locked`** — Variante do marco locked com a identidade da região 1. Opcional: se ausente, usa map.node.locked.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.locked
  - Relação com outras camadas: Substitui map.node.locked apenas nas casas da região 1
- **`map.node.1.available`** — Variante do marco available com a identidade da região 1. Opcional: se ausente, usa map.node.available.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.available
  - Relação com outras camadas: Substitui map.node.available apenas nas casas da região 1
- **`map.node.1.done`** — Variante do marco done com a identidade da região 1. Opcional: se ausente, usa map.node.done.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.done
  - Relação com outras camadas: Substitui map.node.done apenas nas casas da região 1
- **`map.node.2.locked`** — Variante do marco locked com a identidade da região 2. Opcional: se ausente, usa map.node.locked.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.locked
  - Relação com outras camadas: Substitui map.node.locked apenas nas casas da região 2
- **`map.node.2.available`** — Variante do marco available com a identidade da região 2. Opcional: se ausente, usa map.node.available.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.available
  - Relação com outras camadas: Substitui map.node.available apenas nas casas da região 2
- **`map.node.2.done`** — Variante do marco done com a identidade da região 2. Opcional: se ausente, usa map.node.done.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.done
  - Relação com outras camadas: Substitui map.node.done apenas nas casas da região 2
- **`map.node.3.locked`** — Variante do marco locked com a identidade da região 3. Opcional: se ausente, usa map.node.locked.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.locked
  - Relação com outras camadas: Substitui map.node.locked apenas nas casas da região 3
- **`map.node.3.available`** — Variante do marco available com a identidade da região 3. Opcional: se ausente, usa map.node.available.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.available
  - Relação com outras camadas: Substitui map.node.available apenas nas casas da região 3
- **`map.node.3.done`** — Variante do marco done com a identidade da região 3. Opcional: se ausente, usa map.node.done.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.done
  - Relação com outras camadas: Substitui map.node.done apenas nas casas da região 3
- **`map.node.4.locked`** — Variante do marco locked com a identidade da região 4. Opcional: se ausente, usa map.node.locked.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.locked
  - Relação com outras camadas: Substitui map.node.locked apenas nas casas da região 4
- **`map.node.4.available`** — Variante do marco available com a identidade da região 4. Opcional: se ausente, usa map.node.available.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.available
  - Relação com outras camadas: Substitui map.node.available apenas nas casas da região 4
- **`map.node.4.done`** — Variante do marco done com a identidade da região 4. Opcional: se ausente, usa map.node.done.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.done
  - Relação com outras camadas: Substitui map.node.done apenas nas casas da região 4
- **`map.node.5.locked`** — Variante do marco locked com a identidade da região 5. Opcional: se ausente, usa map.node.locked.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.locked
  - Relação com outras camadas: Substitui map.node.locked apenas nas casas da região 5
- **`map.node.5.available`** — Variante do marco available com a identidade da região 5. Opcional: se ausente, usa map.node.available.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.available
  - Relação com outras camadas: Substitui map.node.available apenas nas casas da região 5
- **`map.node.5.done`** — Variante do marco done com a identidade da região 5. Opcional: se ausente, usa map.node.done.
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: opcional · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Idem map.node.done
  - Relação com outras camadas: Substitui map.node.done apenas nas casas da região 5

## Personagem · Bianca

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `char.bianca.idle` | `char/bianca-idle@2x.webp` ou `char/bianca-idle@2x.png` | 1536×256 (6× 256×256) | proporção | .webp / .png | sim | P0 · L0 | MapView › personagem |
| `char.bianca.walk` | `char/bianca-walk@2x.webp` ou `char/bianca-walk@2x.png` | 2048×256 (8× 256×256) | proporção | .webp / .png | sim | P0 · L0 | MapView › personagem |
| `char.bianca.celebrate` | `char/bianca-celebrate@2x.webp` ou `char/bianca-celebrate@2x.png` | 2048×256 (8× 256×256) | proporção | .webp / .png | sim | P1 · L0 | MapView › personagem |

- **`char.bianca.idle`** — Bianca — animação "idle": respiração/balanço leve em pé. Tira horizontal (6 quadros 256×256).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 6 quadros · orçamento: ≤ 700 KB
  - Posicionamento/ancoragem: Âncora nos pés (x=.5, y=.875 do quadro). Exibida 72×72 unidades. Mesma escala, proporção e linha dos pés em TODAS as animações.
  - Relação com outras camadas: Mesmo personagem/traje em idle, walk e celebrate — gerar na mesma sessão com folha de modelo.
  - Animação: tira horizontal, 6 quadros de 256×256px, 8 fps, em laço.
- **`char.bianca.walk`** — Bianca — animação "walk": caminhada (para a direita; o app não espelha). Tira horizontal (8 quadros 256×256).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 quadros · orçamento: ≤ 700 KB
  - Posicionamento/ancoragem: Âncora nos pés (x=.5, y=.875 do quadro). Exibida 72×72 unidades. Mesma escala, proporção e linha dos pés em TODAS as animações.
  - Relação com outras camadas: Mesmo personagem/traje em idle, walk e celebrate — gerar na mesma sessão com folha de modelo.
  - Animação: tira horizontal, 8 quadros de 256×256px, 12 fps, em laço.
- **`char.bianca.celebrate`** — Bianca — animação "celebrate": comemoração ao concluir o reino. Tira horizontal (8 quadros 256×256).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 quadros · orçamento: ≤ 700 KB
  - Posicionamento/ancoragem: Âncora nos pés (x=.5, y=.875 do quadro). Exibida 72×72 unidades. Mesma escala, proporção e linha dos pés em TODAS as animações.
  - Relação com outras camadas: Mesmo personagem/traje em idle, walk e celebrate — gerar na mesma sessão com folha de modelo.
  - Animação: tira horizontal, 8 quadros de 256×256px, 10 fps, em laço.

## Efeitos

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `fx.sparkle` | `fx/sparkle@2x.webp` ou `fx/sparkle@2x.png` ou `fx/sparkle.svg` | 96×96 | proporção | .webp / .png / .svg | sim | P2 · L8 | MapView › brilhos |
| `fx.node.complete` | `fx/node-complete@2x.webp` ou `fx/node-complete@2x.png` | 1536×192 (8× 192×192) | proporção | .webp / .png | sim | P2 · L8 | MapView › efeito de progressão |

- **`fx.sparkle`** — Brilho mágico decorativo (substitui o ✨ espalhado pelo mapa).
  - Proporção/orientação: 96:96 (quadrado) · variações/estados: 1 · orçamento: ≤ 30 KB
  - Posicionamento/ancoragem: Centro no ponto do brilho; exibido 24×24; o app aplica o piscar (opacidade).
  - Relação com outras camadas: Independente das regiões.
- **`fx.node.complete`** — Explosão de estrelas/pétalas ao chegar a uma casa concluída (toca uma vez).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 1 · orçamento: ≤ 400 KB
  - Posicionamento/ancoragem: Centrada na casa; exibida 96×96; 8 quadros 192×192, sem repetição.
  - Relação com outras camadas: Toca quando a personagem alcança uma fase recém-concluída.
  - Animação: tira horizontal, 8 quadros de 192×192px, 14 fps, toca uma vez.

## UI · Indicadores

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `ui.icon.stamp-small` | `ui/icon-stamp-small.svg` ou `ui/icon-stamp-small@2x.webp` ou `ui/icon-stamp-small@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Stats, Conquistas |
| `ui.icon.coin` | `ui/icon-coin.svg` ou `ui/icon-coin@2x.webp` ou `ui/icon-coin@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Stats |
| `ui.icon.stamp-big` | `ui/icon-stamp-big.svg` ou `ui/icon-stamp-big@2x.webp` ou `ui/icon-stamp-big@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Stats |
| `ui.icon.stamp-day` | `ui/icon-stamp-day.svg` ou `ui/icon-stamp-day@2x.webp` ou `ui/icon-stamp-day@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Stats |
| `ui.icon.credit` | `ui/icon-credit.svg` ou `ui/icon-credit@2x.webp` ou `ui/icon-credit@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Stats |

- **`ui.icon.stamp-small`** — Selo pequeno (1 por fase) (substitui ⭐).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.icon.coin`** — Moeda (substitui 🪙).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.icon.stamp-big`** — Selo grande (por etapa) (substitui 🏅).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.icon.stamp-day`** — Selo do dia (medalha diária) (substitui 🌟).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.icon.credit`** — Crédito de minigame (substitui 🎮).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.

## UI · Marca

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `ui.brand.crown` | `ui/brand-crown.svg` ou `ui/brand-crown@2x.webp` ou `ui/brand-crown@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Cabeçalho, abertura |

- **`ui.brand.crown`** — Coroa da marca (cabeçalho e abertura) (substitui 👑).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.

## UI · Navegação

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `ui.icon.mode-child` | `ui/icon-mode-child.svg` ou `ui/icon-mode-child@2x.webp` ou `ui/icon-mode-child@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Cabeçalho |
| `ui.icon.mode-guardian` | `ui/icon-mode-guardian.svg` ou `ui/icon-mode-guardian@2x.webp` ou `ui/icon-mode-guardian@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Cabeçalho |
| `ui.tab.map` | `ui/tab-map.svg` ou `ui/tab-map@2x.webp` ou `ui/tab-map@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.goals` | `ui/tab-goals.svg` ou `ui/tab-goals@2x.webp` ou `ui/tab-goals@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.achievements` | `ui/tab-achievements.svg` ou `ui/tab-achievements@2x.webp` ou `ui/tab-achievements@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.games` | `ui/tab-games.svg` ou `ui/tab-games@2x.webp` ou `ui/tab-games@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.review` | `ui/tab-review.svg` ou `ui/tab-review@2x.webp` ou `ui/tab-review@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.prizes` | `ui/tab-prizes.svg` ou `ui/tab-prizes@2x.webp` ou `ui/tab-prizes@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.credits` | `ui/tab-credits.svg` ou `ui/tab-credits@2x.webp` ou `ui/tab-credits@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.history` | `ui/tab-history.svg` ou `ui/tab-history@2x.webp` ou `ui/tab-history@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |
| `ui.tab.more` | `ui/tab-more.svg` ou `ui/tab-more@2x.webp` ou `ui/tab-more@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P1 · L1 | Barra de abas |

- **`ui.icon.mode-child`** — Alternar para o modo da Bianca (substitui 👧).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.icon.mode-guardian`** — Alternar para o modo responsável (cadeado) (substitui 🔒).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.map`** — Aba "Mapa" (substitui 🗺️).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.goals`** — Aba "Metas" (substitui 📝).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.achievements`** — Aba "Conquistas" (substitui 🏅).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.games`** — Aba "Jogos" (substitui 🎮).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.review`** — Aba "Hoje (revisão)" (substitui 📝).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.prizes`** — Aba "Prêmios" (substitui 🎁).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.credits`** — Aba "Créditos" (substitui 🎮).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.history`** — Aba "Histórico" (substitui 📜).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.tab.more`** — Aba "Mais" (substitui ⚙️).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.

## UI · Estados das metas

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `ui.status.pending` | `ui/status-pending.svg` ou `ui/status-pending@2x.webp` ou `ui/status-pending@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Metas (criança e responsável) |
| `ui.status.done` | `ui/status-done.svg` ou `ui/status-done@2x.webp` ou `ui/status-done@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Metas (criança e responsável) |
| `ui.status.not-done` | `ui/status-not-done.svg` ou `ui/status-not-done@2x.webp` ou `ui/status-not-done@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Metas (criança e responsável) |
| `ui.status.not-evaluated` | `ui/status-not-evaluated.svg` ou `ui/status-not-evaluated@2x.webp` ou `ui/status-not-evaluated@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P0 · L1 | Metas (criança e responsável) |

- **`ui.status.pending`** — Meta pendente (substitui ⏳).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.status.done`** — Meta cumprida (substitui ✅).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.status.not-done`** — Meta não cumprida (substitui ❌).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.status.not-evaluated`** — Meta não avaliada (substitui ➖).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.

## UI · Sincronização

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `ui.sync.loading` | `ui/sync-loading.svg` ou `ui/sync-loading@2x.webp` ou `ui/sync-loading@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P2 · L1 | Selo de sincronização |
| `ui.sync.synced` | `ui/sync-synced.svg` ou `ui/sync-synced@2x.webp` ou `ui/sync-synced@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P2 · L1 | Selo de sincronização |
| `ui.sync.syncing` | `ui/sync-syncing.svg` ou `ui/sync-syncing@2x.webp` ou `ui/sync-syncing@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P2 · L1 | Selo de sincronização |
| `ui.sync.pending` | `ui/sync-pending.svg` ou `ui/sync-pending@2x.webp` ou `ui/sync-pending@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P2 · L1 | Selo de sincronização |
| `ui.sync.offline` | `ui/sync-offline.svg` ou `ui/sync-offline@2x.webp` ou `ui/sync-offline@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P2 · L1 | Selo de sincronização |
| `ui.sync.conflict` | `ui/sync-conflict.svg` ou `ui/sync-conflict@2x.webp` ou `ui/sync-conflict@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P2 · L1 | Selo de sincronização |
| `ui.sync.error` | `ui/sync-error.svg` ou `ui/sync-error@2x.webp` ou `ui/sync-error@2x.png` | 128×128 | proporção | .svg / .webp / .png | sim | P2 · L1 | Selo de sincronização |

- **`ui.sync.loading`** — Carregando (substitui ⏳).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.sync.synced`** — Sincronizado (substitui ☁️).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.sync.syncing`** — Sincronizando (substitui 🔄).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.sync.pending`** — Alterações pendentes (substitui 🕓).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.sync.offline`** — Offline (substitui 📴).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.sync.conflict`** — Conflito a resolver (substitui ⚠️).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.
- **`ui.sync.error`** — Erro de sincronização (substitui ❌).
  - Proporção/orientação: 128:128 (quadrado) · variações/estados: 1 · orçamento: ≤ 40 KB
  - Posicionamento/ancoragem: Quadrado, centrado, com respiro de 6%; exibido em 1em (acompanha o texto).
  - Relação com outras camadas: Mesmo estilo e traço dos demais ícones do conjunto.

## UI · Celebração

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `ui.celebration.stage` | `ui/celebration-stage@2x.webp` ou `ui/celebration-stage@2x.png` ou `ui/celebration-stage.svg` | 384×384 | proporção | .webp / .png / .svg | sim | P2 · L9 | Aviso de celebração |
| `ui.celebration.final` | `ui/celebration-final@2x.webp` ou `ui/celebration-final@2x.png` ou `ui/celebration-final.svg` | 384×384 | proporção | .webp / .png / .svg | sim | P2 · L9 | Aviso de celebração |

- **`ui.celebration.stage`** — Celebração de etapa concluída (substitui 🎉 no aviso).
  - Proporção/orientação: 384:384 (quadrado) · variações/estados: 1 · orçamento: ≤ 120 KB
  - Posicionamento/ancoragem: Centrado no topo do aviso; exibido ~3rem×3rem na versão atual (pode crescer no futuro).
  - Relação com outras camadas: Par coordenado.
- **`ui.celebration.final`** — Celebração do reino conquistado (substitui 🎉 no aviso).
  - Proporção/orientação: 384:384 (quadrado) · variações/estados: 1 · orçamento: ≤ 120 KB
  - Posicionamento/ancoragem: Centrado no topo do aviso; exibido ~3rem×3rem na versão atual (pode crescer no futuro).
  - Relação com outras camadas: Par coordenado.

## UI · Fundos (CSS)

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `ui.bg.app` | `ui/bg-app@2x.webp` ou `ui/bg-app@2x.png` | 1080×1920 | proporção | .webp / .png | não | P2 · L8 | Container do app |
| `ui.bg.topbar` | `ui/bg-topbar@2x.webp` ou `ui/bg-topbar@2x.png` | 1080×192 | proporção | .webp / .png | não | P2 · L8 | Cabeçalho |
| `ui.button.primary` | `ui/button-primary@2x.webp` ou `ui/button-primary@2x.png` | 640×128 | proporção | .webp / .png | não | P2 · L8 | Botões .btn.primary |
| `ui.panel.sheet` | `ui/panel-sheet@2x.webp` ou `ui/panel-sheet@2x.png` | 1080×1440 | proporção | .webp / .png | não | P2 · L8 | Folhas e diálogos |

- **`ui.bg.app`** — Fundo geral do app (atrás das telas), sutil, sem elementos no centro.
  - Proporção/orientação: 1080:1920 (retrato) · variações/estados: 1 · orçamento: ≤ 350 KB
  - Posicionamento/ancoragem: Aplicado como fundo CSS (cover; botões: esticado). Variável --art-ui-bg-app.
  - Relação com outras camadas: Substitui o gradiente atual somente quando existe.
- **`ui.bg.topbar`** — Fundo do cabeçalho (faixa superior).
  - Proporção/orientação: 1080:192 (paisagem) · variações/estados: 1 · orçamento: ≤ 350 KB
  - Posicionamento/ancoragem: Aplicado como fundo CSS (cover; botões: esticado). Variável --art-ui-bg-topbar.
  - Relação com outras camadas: Substitui o gradiente atual somente quando existe.
- **`ui.button.primary`** — Fundo do botão principal (esticado, sem 9-slice nesta versão): sem texto, bordas arredondadas completas.
  - Proporção/orientação: 640:128 (paisagem) · variações/estados: 1 · orçamento: ≤ 350 KB
  - Posicionamento/ancoragem: Aplicado como fundo CSS (cover; botões: esticado). Variável --art-ui-button-primary.
  - Relação com outras camadas: Substitui o gradiente atual somente quando existe.
- **`ui.panel.sheet`** — Fundo das folhas (bottom sheet): papel/pergaminho suave.
  - Proporção/orientação: 1080:1440 (retrato) · variações/estados: 1 · orçamento: ≤ 350 KB
  - Posicionamento/ancoragem: Aplicado como fundo CSS (cover; botões: esticado). Variável --art-ui-panel-sheet.
  - Relação com outras camadas: Substitui o gradiente atual somente quando existe.

## Minigames · Fundos

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `game.stars.bg` | `game/stars-bg@2x.webp` ou `game/stars-bg@2x.png` | 1080×1920 | proporção | .webp / .png | não | P1 · L6 | Minigame Estrelas |
| `game.garden.bg` | `game/garden-bg@2x.webp` ou `game/garden-bg@2x.png` | 1080×1350 | proporção | .webp / .png | não | P1 · L7 | Minigame Jardim |

- **`game.stars.bg`** — Céu noturno do jogo Caça às Estrelas (sem estrelas; elas vêm do jogo).
  - Proporção/orientação: 1080:1920 (retrato) · variações/estados: 1 · orçamento: ≤ 350 KB
  - Posicionamento/ancoragem: Aplicado como fundo CSS (cover; botões: esticado). Variável --art-game-stars-bg.
  - Relação com outras camadas: Substitui o gradiente atual somente quando existe.
- **`game.garden.bg`** — Cenário do Jardim Encantado: céu e gramado vazios (proporção 4:5).
  - Proporção/orientação: 1080:1350 (retrato) · variações/estados: 1 · orçamento: ≤ 350 KB
  - Posicionamento/ancoragem: Aplicado como fundo CSS (cover; botões: esticado). Variável --art-game-garden-bg.
  - Relação com outras camadas: Substitui o gradiente atual somente quando existe.

## Minigame · Caça às Estrelas

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `game.stars.star` | `game/stars-star@2x.webp` ou `game/stars-star@2x.png` ou `game/stars-star.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L6 | StarHunt |
| `game.stars.star.hit` | `game/stars-star-hit@2x.webp` ou `game/stars-star-hit@2x.png` ou `game/stars-star-hit.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L6 | StarHunt |

- **`game.stars.star`** — Estrela tocável (substitui ⭐).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Centrada; tamanho decidido pelo jogo (44–70 px); borda sem corte.
  - Relação com outras camadas: Par com game.stars.star.hit.
- **`game.stars.star.hit`** — Estrela atingida (brilho/explosão curta) (substitui ✨).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 1 · orçamento: ≤ 60 KB
  - Posicionamento/ancoragem: Mesmo centro e tamanho de game.stars.star.
  - Relação com outras camadas: Par com game.stars.star.

## Minigame · Memória dos Cristais

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `game.crystals.back` | `game/crystals-back@2x.webp` ou `game/crystals-back@2x.png` ou `game/crystals-back.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.crystal` | `game/crystals-symbol-crystal@2x.webp` ou `game/crystals-symbol-crystal@2x.png` ou `game/crystals-symbol-crystal.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.orb` | `game/crystals-symbol-orb@2x.webp` ou `game/crystals-symbol-orb@2x.png` ou `game/crystals-symbol-orb.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.moon` | `game/crystals-symbol-moon@2x.webp` ou `game/crystals-symbol-moon@2x.png` ou `game/crystals-symbol-moon.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.star` | `game/crystals-symbol-star@2x.webp` ou `game/crystals-symbol-star@2x.png` ou `game/crystals-symbol-star.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.unicorn` | `game/crystals-symbol-unicorn@2x.webp` ou `game/crystals-symbol-unicorn@2x.png` ou `game/crystals-symbol-unicorn.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.blossom` | `game/crystals-symbol-blossom@2x.webp` ou `game/crystals-symbol-blossom@2x.png` ou `game/crystals-symbol-blossom.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.mushroom` | `game/crystals-symbol-mushroom@2x.webp` ou `game/crystals-symbol-mushroom@2x.png` ou `game/crystals-symbol-mushroom.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |
| `game.crystals.symbol.butterfly` | `game/crystals-symbol-butterfly@2x.webp` ou `game/crystals-symbol-butterfly@2x.png` ou `game/crystals-symbol-butterfly.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | CrystalMemory |

- **`game.crystals.back`** — Verso da carta virada (substitui ❔).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 1 · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Preenche a carta (quadrada); cantos arredondados do app recortam.
  - Relação com outras camadas: Mesmo estilo das faces.
- **`game.crystals.symbol.crystal`** — Símbolo da carta: Cristal (substitui 💎).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.
- **`game.crystals.symbol.orb`** — Símbolo da carta: Orbe mágico (substitui 🔮).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.
- **`game.crystals.symbol.moon`** — Símbolo da carta: Lua (substitui 🌙).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.
- **`game.crystals.symbol.star`** — Símbolo da carta: Estrela (substitui ⭐).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.
- **`game.crystals.symbol.unicorn`** — Símbolo da carta: Unicórnio (substitui 🦄).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.
- **`game.crystals.symbol.blossom`** — Símbolo da carta: Flor de cerejeira (substitui 🌸).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.
- **`game.crystals.symbol.mushroom`** — Símbolo da carta: Cogumelo (substitui 🍄).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.
- **`game.crystals.symbol.butterfly`** — Símbolo da carta: Borboleta (substitui 🦋).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 8 símbolos · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado centrado com respiro; legível em ~64 px.
  - Relação com outras camadas: Conjunto de 8 símbolos com estilo e paleta coerentes e silhuetas distintas.

## Minigame · Jardim Encantado

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `game.garden.item.tulip` | `game/garden-item-tulip@2x.webp` ou `game/garden-item-tulip@2x.png` ou `game/garden-item-tulip.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.blossom` | `game/garden-item-blossom@2x.webp` ou `game/garden-item-blossom@2x.png` ou `game/garden-item-blossom.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.sunflower` | `game/garden-item-sunflower@2x.webp` ou `game/garden-item-sunflower@2x.png` ou `game/garden-item-sunflower.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.tree` | `game/garden-item-tree@2x.webp` ou `game/garden-item-tree@2x.png` ou `game/garden-item-tree.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.mushroom` | `game/garden-item-mushroom@2x.webp` ou `game/garden-item-mushroom@2x.png` ou `game/garden-item-mushroom.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.butterfly` | `game/garden-item-butterfly@2x.webp` ou `game/garden-item-butterfly@2x.png` ou `game/garden-item-butterfly.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.rabbit` | `game/garden-item-rabbit@2x.webp` ou `game/garden-item-rabbit@2x.png` ou `game/garden-item-rabbit.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.rainbow` | `game/garden-item-rainbow@2x.webp` ou `game/garden-item-rainbow@2x.png` ou `game/garden-item-rainbow.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.unicorn` | `game/garden-item-unicorn@2x.webp` ou `game/garden-item-unicorn@2x.png` ou `game/garden-item-unicorn.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.castle` | `game/garden-item-castle@2x.webp` ou `game/garden-item-castle@2x.png` ou `game/garden-item-castle.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |
| `game.garden.item.fairy` | `game/garden-item-fairy@2x.webp` ou `game/garden-item-fairy@2x.png` ou `game/garden-item-fairy.svg` | 192×192 | proporção | .webp / .png / .svg | sim | P1 · L7 | EnchantedGarden, Palette |

- **`game.garden.item.tulip`** — Item de decoração: Tulipa (substitui 🌷).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.blossom`** — Item de decoração: Flor de cerejeira (substitui 🌸).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.sunflower`** — Item de decoração: Girassol (substitui 🌻).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.tree`** — Item de decoração: Árvore (substitui 🌳).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.mushroom`** — Item de decoração: Cogumelo (substitui 🍄).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.butterfly`** — Item de decoração: Borboleta (substitui 🦋).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.rabbit`** — Item de decoração: Coelhinho (substitui 🐰).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.rainbow`** — Item de decoração: Arco-íris (substitui 🌈).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.unicorn`** — Item de decoração: Unicórnio (bônus da etapa 5) (substitui 🦄).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.castle`** — Item de decoração: Castelo (bônus da etapa 5) (substitui 🏰).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.
- **`game.garden.item.fairy`** — Item de decoração: Fada (bônus da etapa 5) (substitui 🧚).
  - Proporção/orientação: 192:192 (quadrado) · variações/estados: 11 itens · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado, objeto centrado e apoiado na metade inferior; sem sombra queimada.
  - Relação com outras camadas: Conjunto de 11 itens com a mesma escala visual.

## Minigames · Cartões do hub

| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |
|---|---|---|---|---|:-:|---|---|
| `game.icon.stars` | `game/icon-stars@2x.webp` ou `game/icon-stars@2x.png` ou `game/icon-stars.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | Hub de jogos |
| `game.icon.crystals` | `game/icon-crystals@2x.webp` ou `game/icon-crystals@2x.png` ou `game/icon-crystals.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L6 | Hub de jogos |
| `game.icon.garden` | `game/icon-garden@2x.webp` ou `game/icon-garden@2x.png` ou `game/icon-garden.svg` | 256×256 | proporção | .webp / .png / .svg | sim | P1 · L7 | Hub de jogos |

- **`game.icon.stars`** — Ícone do cartão do jogo Caça às Estrelas (substitui ⭐).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 3 ícones · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado; exibido ~2.4rem.
  - Relação com outras camadas: Trio coerente.
- **`game.icon.crystals`** — Ícone do cartão do jogo Memória dos Cristais (substitui 💎).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 3 ícones · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado; exibido ~2.4rem.
  - Relação com outras camadas: Trio coerente.
- **`game.icon.garden`** — Ícone do cartão do jogo Jardim Encantado (substitui 🌷).
  - Proporção/orientação: 256:256 (quadrado) · variações/estados: 3 ícones · orçamento: ≤ 80 KB
  - Posicionamento/ancoragem: Quadrado; exibido ~2.4rem.
  - Relação com outras camadas: Trio coerente.

