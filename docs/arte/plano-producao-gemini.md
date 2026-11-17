# Plano de produção no Gemini — lotes pequenos e sequenciais

> **Atualização:** o planejamento agora é automático e é a fonte vigente dos lotes: `npm run art:plan` (25 lotes: 14 pranchas, 5 cenários, 6 fundos individuais; 34 recursos adiados com motivo). Prompts, guias e processamento: [fluxo-producao-automatizado.md](fluxo-producao-automatizado.md). A tabela abaixo é o plano original (referência de raciocínio).

Objetivo: produzir a nova identidade visual **sem interromper o app publicado**. Cada lote é integrado e aprovado antes do próximo.
Lista completa de recursos (IDs, tamanhos, prioridades): [catalogo-recursos.md](catalogo-recursos.md). Gabaritos para enviar como referência ao Gemini: [guias/](guias/) (PNG/SVG).

## 0. Realidade técnica da geração por IA (leia antes)
- Geradores de imagem costumam entregar **imagens opacas em proporções fixas**, não camadas com transparência nem tamanhos exatos. Portanto **todo arquivo precisa de pós-produção**: recortar/redimensionar para o tamanho exato, remover fundo (quando exige alfa) e converter para WebP.
- **Camadas com transparência** (`.mid`, `.path`, `.fg`, marcos, itens, personagem): peça o objeto sobre **fundo chapado de cor única** (ex.: magenta #FF00FF, sem sombras nem gradiente) e remova a cor depois (GIMP/Krita/ImageMagick), ou use a opção de fundo transparente se a ferramenta oferecer.
- **Consistência entre imagens** é o maior risco (mesmo personagem, mesma paleta, bordas que casam). Por isso os lotes abaixo agrupam o que **precisa ser gerado junto** (mesma conversa, mesmas referências, mesma sessão).
- **Animação:** a Bianca em vários quadros é a parte mais difícil. Alternativas aceitas pelo app: (a) tira completa de 6–8 quadros; (b) **1 quadro só** (`sprite.frames = 1` no manifesto — o app já anima um leve balanço por CSS no vetor atual; com 1 quadro ela fica estática); (c) menos quadros (ex.: 4) ajustando `frames` e a largura da tira.
- Respeite os direitos de uso do material enviado como referência (as fotos do tabuleiro são do seu uso pessoal; confirme se a nova arte pode ser publicada em repositório público).

## 1. Pacote de referência (antes do Lote 0 — não é integrado)
Gere e aprove, **nesta ordem**, e use como referência fixa em todos os lotes:
1. **Folha de estilo:** paleta (8–10 cores hex), tipo de traço (aquarela suave/pastel como o tabuleiro físico), iluminação (luz vinda de cima à esquerda), nível de detalhe, 3 exemplos de elementos (árvore, flor, pedra).
2. **Folha de modelo da Bianca:** frente, 3/4 e costas, expressões (neutra, alegre), traje e cabelo, proporção (cabeça ≈ 1/3 do corpo), cor de cada parte.
3. **Layout de referência da Região 1** (baixa resolução, só composição) sobre o guia `guias/regiao-1.png`: onde ficam árvores, lago, trilha.
**Aprovação:** você valida estilo e personagem antes de gerar qualquer arquivo final.

## 2. Lotes de produção
| Lote | Conteúdo (IDs) | Qtde | Gerar em conjunto (coordenado) | Depende de |
|---|---|---:|---|---|
| **0a** | `map.region.1.bg` + `map.bottom.bg` | 2 | **Sim**: mesma cena contínua (a base é a continuação do pé da região 1); gerar como uma imagem alta (800×1340) e cortar em 1080 + 260 | Referência 1 e 3 |
| **0b** | `map.region.1.mid`, `.path`, `.fg` | 3 | **Sim**, com o `.bg` aprovado como referência e o guia (trilha passa pelos centros das casas; decoração fora do corredor; primeiro plano esparso) | 0a |
| **0c** | `map.node.locked/available/done` + `map.node.selected` + `map.start` + `map.ribbon.1` | 6 | **Sim**: mesma família de formas, trio de estados com o mesmo contorno | Estilo |
| **0d** | `char.bianca.idle`, `char.bianca.walk` (e depois `.celebrate`) | 2–3 | **Sim**: mesma folha de modelo, mesma escala e linha dos pés (y=224/256) em todos os quadros | Modelo da Bianca |
| **1a** | Indicadores: `ui.icon.stamp-small/stamp-big/stamp-day/coin/credit`, `ui.brand.crown` | 6 | **Sim**: um conjunto (folha única) | Estilo |
| **1b** | Estados das metas (`ui.status.*` ×4) + modo (`ui.icon.mode-*` ×2) | 6 | **Sim** | 1a |
| **1c** | Abas (`ui.tab.*` ×9) | 9 | **Sim** | 1a |
| **1d** | Sincronização (`ui.sync.*` ×7) | 7 | Sim | 1a |
| **2** | Região 2: `bg`, `mid`, `path`, `fg`, `ribbon.2`, `map.fog` | 6 | Sim; **a borda inferior casa com a superior da região 1** (envie a faixa de 40 unidades da região 1 como contexto) | 0b |
| **3** | Região 3 (mesmo formato) | 5 | Sim; borda com a região 2 | 2 |
| **4** | Região 4 | 5 | Sim; borda com a região 3 | 3 |
| **5** | Região 5 + `map.top.bg` + `map.bonus.locked/unlocked` | 8 | Sim; topo casa com a região 5; bônus em par | 4 |
| **6a** | Estrelas: `game.stars.bg`, `game.stars.star`, `game.stars.star.hit` | 3 | Sim | Estilo |
| **6b** | Memória: `game.crystals.back` + 8 `game.crystals.symbol.*` | 9 | **Sim**: conjunto de 8 símbolos + verso numa só folha | Estilo |
| **7** | Jardim: `game.garden.bg` + 11 `game.garden.item.*` + `game.icon.*` ×3 | 15 | Sim: itens na mesma escala visual | Estilo |
| **8** | Fundos de interface (`ui.bg.*`, `ui.button.primary`, `ui.panel.sheet`), `fx.sparkle`, `fx.node.complete` | 6 | Parcial | Estilo |
| **9** | Opcionais: `map.node.<região>.<estado>` ×15, `ui.celebration.*` | 17 | Por região | Regiões |

## 3. O que precisa ser coordenado (resumo)
1. **Cada região (bg/mid/path/fg/ribbon):** mesma iluminação, paleta e composição; a trilha da `.path` tem de passar pelos centros das casas (guia) e **encontrar a região vizinha no mesmo ponto** (x indicado no guia).
2. **Regiões adjacentes:** as bordas superior/inferior casam (gerar com contexto da vizinha).
3. **Região 1 + base** (0a): contínuas.
4. **Estados da casa** (locked/available/done/selected) e o **par do bônus**: mesmo contorno e tamanho.
5. **Bianca** (idle/walk/celebrate): mesmo modelo, escala, linha dos pés e tamanho de quadro.
6. **Conjuntos de ícones** por categoria e os **8 símbolos + verso** da Memória, os **11 itens** do Jardim: estilo e escala uniformes.

## 4. Como pedir (modelo de instrução)
> Ilustração infantil de conto de fados, aquarela suave e pastel, contornos delicados, luz vinda de cima à esquerda, paleta [colar hex]. **Sem texto, sem letras, sem números, sem moldura, sem interface.** Proporção [800:1080 / 1:1 …]. [Descrição do elemento]. Use a imagem anexa como guia de composição: manter livre o corredor da trilha e as posições marcadas em vermelho (não desenhar nada sobre os círculos). Para camadas: fundo chapado magenta #FF00FF, sem sombra no chão.

## 5. Critérios para aprovar um lote
Checklist do contrato (seção 12), mais: aprovado por você em tela de celular real; bordas casam; nada cobre as casas; peso dentro do orçamento; `npm run art:validate` sem erros.
