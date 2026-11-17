# Contrato de integração gráfica — Reino da Bianca

Especificação para produzir **externamente** (Gemini ou qualquer ferramenta) os recursos visuais e integrá-los sem reescrever telas nem regras.
Fonte única dos IDs, tamanhos e formatos: [`src/art/catalog.json`](../../src/art/catalog.json) → [catálogo legível](catalogo-recursos.md).

## 1. Princípios
1. **ID lógico estável.** As telas pedem arte por ID (`map.region.1.bg`, `ui.icon.coin`…), nunca por caminho. O ID não muda; o arquivo pode mudar.
2. **Tudo é opcional, com fallback.** Sem o arquivo (ou se ele falhar ao carregar, ou ainda não carregou), o app mostra o desenho atual (SVG/CSS/emoji). Nunca há imagem quebrada.
3. **Geometria é do código; arte é da imagem.** Posição das casas, áreas de toque, trilha lógica e caminhada da personagem ficam em `src/ui/mapGeometry.ts`. A arte só "encaixa" (use os [guias de layout](guias/)).
4. **Texto é do app.** Nenhum recurso pode conter texto (números das casas, nome das regiões, "Início", "Bônus final" são desenhados pelo app).
5. **Pacotes versionados.** Cada entrega vive num pacote (`public/art/<pacote>/`); o manifesto escolhe o pacote ativo. Reverter = apontar para o pacote anterior.

## 2. Arquitetura resultante
```
src/art/manifest.json  ──►  registry (ID → URL, base-independente)  ──►  <Icon>/<SvgArt>/<SpriteStrip>  ──►  telas
        │                           │                                         │ (arte pronta? senão fallback)
public/art/<pacote>/…       catalog.json (tamanhos, âncoras, sprites)   loader (pré-carga com prioridade) ◄── service worker (cache offline)
```
- `src/art/registry.ts` — resolve IDs (com lista de candidatos: variante da região → genérico), junta padrões do catálogo, monta a URL com a base do site (`import.meta.env.BASE_URL`, funciona em `/` e em `/Fab4/`) e `?v=<hash do conteúdo>`.
- `src/art/loader.ts` — pré-carrega imagens (alta prioridade: região atual e vizinhas; baixa: o resto, com fila). A arte só é exibida depois de carregada.
- `src/art/components.tsx` — `Icon` (HTML, 1em), `SvgArt` (dentro do mapa, por âncora ou retângulo), `SpriteStrip` (tira de quadros animada por CSS), `ArtRuntime` (fundos CSS, pré-aquecimento offline, retentativa ao voltar a conexão).
- `src/art/ids.ts` — todos os IDs que o código pede (testado contra o catálogo).
- `src/ui/mapGeometry.ts` — geometria funcional; um pacote pode redefinir posições via `layout` (opcional; padrão = posições atuais).

## 3. Formatos
| Natureza | Formato | Observações |
|---|---|---|
| Fundos opacos (faixas de região, topo/base, fundos de jogo) | **WebP** (qualidade 80–85) ou PNG | sRGB, sem perfil ICC embutido |
| Camadas com transparência (decoração, trilha, primeiro plano, marcos, itens) | **WebP com alfa** (qualidade ≥ 90 ou lossless) ou PNG | alfa **não pré-multiplicado**, bordas suaves, sem halo/franja |
| Ícones simples, marcos, faixas | **SVG** (preferido) ou WebP/PNG | SVG sem `<script>`, eventos, `foreignObject`, recursos externos nem texto |
| Personagem e efeitos animados | **WebP/PNG em tira horizontal** (spritesheet) | 1 linha, quadros iguais da esquerda para a direita |
| Ícones do PWA | PNG 192, 512 e *maskable* 512 | já existem; ver `npm run icons` |
Não use JPEG, GIF, AVIF (nesta versão), vídeo nem fontes embutidas na arte.

## 4. Dimensões e proporções
- O mapa lógico mede **400 × 2960 unidades**: topo 130 + 5 regiões de 540 + base 130. Entregue em **@2x** (1 unidade = 2 px).
- **Faixas do mapa (tamanho EXATO):** região = **800 × 1080 px**; topo e base = **800 × 260 px**. Sem sobreposição entre faixas; as bordas devem casar com as vizinhas.
- **Marcos/ícones:** proporção fixa do catálogo (ex.: casa 128×128, bônus 160×160, faixa 480×96); qualquer tamanho com a mesma proporção entre 0,5× e 2× é aceito.
- **Sprites:** quadro 256×256 (efeito de casa 192×192); a tira tem `quadros × largura` de largura e 1 quadro de altura (ex.: caminhada = 8 × 256 = 2048×256).
- Cartas/itens de jogo: quadrados (256 / 192 px). Fundos de jogo: 1080 de largura (estrelas 1080×1920; jardim 4:5 = 1080×1350).

## 5. Transparência, camadas e ordem de desenho (mapa)
Cada região é entregue em até 4 camadas **do mesmo tamanho**, desenhadas nesta ordem (de trás para a frente):
1. `map.region.N.bg` — fundo opaco · 2. `map.region.N.mid` — decoração atrás da trilha (alfa) · 3. `map.region.N.path` — trilha (alfa; substitui a trilha padrão **nessa região**) ·
4. faixa `map.ribbon.N` e véu `map.fog` (regiões bloqueadas) · 5. marcos de fase `map.node.*` (+ anel `map.node.selected`) e bônus · 6. personagem `char.bianca.*` · 7. `map.region.N.fg` — primeiro plano **à frente** da personagem (alfa, esparso; não captura toques) · 8. brilhos `fx.sparkle`.
O arquivo-fonte em camadas (PSD/XCF) **não entra no repositório**; entregue só os exports acima.

## 6. Nomes, IDs e diretórios
- **Regra do nome do arquivo:** `<primeiro segmento do ID>/<resto do ID com "." → "-">` + `@2x` (só raster) + extensão. Exemplos:
  `map.region.1.bg` → `map/region-1-bg@2x.webp` · `char.bianca.walk` → `char/bianca-walk@2x.webp` · `ui.icon.coin` → `ui/icon-coin.svg` (ou `ui/icon-coin@2x.webp`).
- IDs: minúsculas, números, hífen; níveis separados por ponto. **Nunca renomeie um ID existente**; para mudar, crie um novo pacote.
- Diretório: `public/art/<pacote>/{map,char,fx,ui,game}/…`. Pacotes sugeridos: `v1`, `v2`… O manifesto fica em `src/art/manifest.json`.
- Entrada do manifesto (o mínimo é só o arquivo; tamanho/âncora/sprite vêm do catálogo):
```json
{ "schema": 1, "activePack": "v1",
  "packs": { "v1": { "label": "Região 1", "dir": "v1",
    "assets": {
      "map.region.1.bg":   { "file": "map/region-1-bg@2x.webp" },
      "map.node.done":     { "file": "map/node-done@2x.webp" },
      "char.bianca.idle":  { "file": "char/bianca-idle@2x.webp" },
      "ui.icon.coin":      { "file": "ui/icon-coin.svg" } } } } }
```
- Ajustes finos opcionais por recurso: `box` (tamanho exibido, unidades do mapa), `anchor` (0–1), `offset` (unidades), `sprite` (`frames`, `fps`, `loop`, `frameW`, `frameH` — a largura da tira deve bater). Um pacote também pode ter `layout` (novas posições de casas/início/bônus dentro de 0–400 × 0–2960).

## 7. Estados visuais
| Estado (domínio) | ID de arte | Observação |
|---|---|---|
| fase concluída (`done`) | `map.node.done` | traz a estrela/selo; o app desenha só o número pequeno acima |
| próxima fase (`next` → *available*) | `map.node.available` | o app mantém o pulso animado por trás |
| bloqueada (`locked`) | `map.node.locked` | |
| selecionada (folha aberta) | `map.node.selected` | **overlay** sobre qualquer estado; o app acrescenta `data-selected` |
| variante por região (opcional) | `map.node.<região>.<estado>` | se ausente, usa o genérico |
| bônus | `map.bonus.locked` / `map.bonus.unlocked` | |
| região bloqueada | `map.fog` | véu semitransparente |
O número da casa é texto do app (escuro, com contorno branco quando há arte): deixe o centro do marco com contraste razoável.

## 8. Responsividade
O mapa é um único SVG que escala pela largura (retrato, rolagem vertical). Todas as camadas esticam juntas; por isso **proporções e posições devem ser exatas**. Área de toque das casas: círculo de raio 28 unidades (≈ 56–70 px num celular) **fixo e independente da imagem**. Mantenha uma margem de segurança de ~10 unidades nas bordas (nada importante colado nelas). `prefers-reduced-motion` desliga animações (a tira mostra o quadro 1).

## 9. Carregamento e cache offline
- A arte **não entra no precache de instalação** (o app continua leve). Ela é carregada sob demanda (região atual e vizinhas primeiro), **pré-aquecida em segundo plano** (~2,5 s após abrir) e guardada pelo service worker no cache `art-assets` (CacheFirst). Depois de carregada uma vez, funciona **offline**.
- A URL leva `?v=<hash do conteúdo de public/art>`: trocar um arquivo mantendo o nome invalida o cache automaticamente.
- **Orçamento:** ≤ 1,5 MB por região (4 camadas), ≤ 6 MB no total (aviso do validador) e 12 MB (erro). Cada recurso tem `maxKB` no catálogo (aviso).
- Falha de rede ao carregar → fallback atual; ao voltar a conexão o app tenta de novo.

## 10. Substituição, versionamento e reversão
- **Entrega parcial é normal:** registre só o que chegou; o resto segue com o desenho atual.
- **Novo pacote** (`v2`) = nova pasta + novo bloco no manifesto; `activePack` troca a versão. **Reverter** = voltar `activePack` (os arquivos antigos continuam na pasta) ou `null` (somente fallback).
- **Pré-visualização sem publicar:** `?artpack=v2` mostra outro pacote; `?artpack=none` mostra o app sem arte.

## 11. Limitações desta versão
- Sprites: apenas **tira horizontal** (uma linha). Sem grade, sem espelhamento/direção.
- Fundos CSS (botão, painel, topo, fundos de jogo): imagem **esticada/`cover`**, sem 9-slice.
- Só ícones **estruturais** foram migrados (indicadores, abas, estados de meta, sincronização, coroa, modo, ícones dos jogos, mapa, minigames, celebração). Emojis dentro de frases de texto (mensagens, títulos, listas do modo responsável) continuam texto.
- Um único anel de seleção e uma única imagem de celebração (etapa/final).
- Chaves de dados do Jardim continuam sendo o **emoji** salvo; a arte do item é localizada por tabela emoji → ID (não migre dados).

## 12. Checklist de aceitação por recurso
☐ ID e nome de arquivo conforme o catálogo · ☐ formato permitido · ☐ dimensões (exatas ou proporção) · ☐ alfa onde exigido, sem franjas ·
☐ sem texto · ☐ dentro do orçamento de peso · ☐ casa com as vizinhas (bordas) e com o guia de layout · ☐ legível em 360 px de largura ·
☐ estilo/paleta coerentes com o restante do lote · ☐ `npm run art:validate` sem erros.
