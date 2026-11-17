# Produção gráfica restante — pacote para o Gemini

19 imagens-base (pranchas e imagens individuais), em ordem de prioridade. Geração **manual** (sem API paga), em sequência, sem voltar ao Claude entre elas.

## ⚠️ Dependência

- Falta `art-work/referencias/modelo-bianca.png` (necessária para o passo da Bianca). **Não bloqueia os demais**: gere os outros passos e deixe a Bianca para quando tiver o arquivo (ou anexe o modelo direto no chat do Gemini, sem salvá-lo no repositório).

## Como gerar

1. Abra **um chat novo** do Gemini e use-o para todos os passos (mantém traço e paleta). Peça sempre a **maior resolução** e a **proporção indicada no prompt**.
2. Para cada passo, na ordem da tabela: anexe os arquivos indicados (a folha de estilo e, nas pranchas, o `guia-prancha.png`), cole o `prompt.txt` e gere.
3. **Confira antes de salvar:** (pranchas) cada elemento dentro da sua célula, fundo chapado liso, nenhum texto, nada tocando a borda; (individuais) sem texto nem molduras. Se falhar, peça de novo.
4. Salve cada imagem (PNG/JPG, maior resolução) com o nome da coluna "Salvar como". O guia serve só de referência de posição: não deve aparecer linha ou número na imagem final.

## Sequência

| # | Lote | Recursos | Prio | Proporção | Fundo | Anexar | Colar | Salvar como |
|---|---|---|---|---|---|---|---|---|
| 1 | `bianca-estatica` ⚠️ modelo-bianca | 1 | P0 | 1:1 | #00FF00 | `00-anexos-comuns/folha-de-estilo.png` + `01-bianca-estatica/guia-prancha.png` | `01-bianca-estatica/prompt.txt` | `bianca-estatica.png` |
| 2 | `icones-ui-1` | 6 | P0 | 3:4 | #00FF00 | `00-anexos-comuns/folha-de-estilo.png` + `02-icones-ui-1/guia-prancha.png` | `02-icones-ui-1/prompt.txt` | `icones-ui-1.png` |
| 3 | `icones-ui-3` | 9 | P0 | 1:1 | #00FF00 | `00-anexos-comuns/folha-de-estilo.png` + `03-icones-ui-3/guia-prancha.png` | `03-icones-ui-3/prompt.txt` | `icones-ui-3.png` |
| 4 | `faixas-regioes-2-5` | 4 | P1 | 1:1 | #00FF00 | `00-anexos-comuns/folha-de-estilo.png` + `04-faixas-regioes-2-5/faixa-regiao-1-aprovada.png` + `04-faixas-regioes-2-5/guia-prancha.png` | `04-faixas-regioes-2-5/prompt.txt` | `faixas-regioes-2-5.png` |
| 5 | `bonus-final` | 2 | P1 | 1:1 | #00FFFF | `00-anexos-comuns/folha-de-estilo.png` + `05-bonus-final/guia-prancha.png` | `05-bonus-final/prompt.txt` | `bonus-final.png` |
| 6 | `jogos-l6-1` | 4 | P1 | 1:1 | #00FF00 | `00-anexos-comuns/folha-de-estilo.png` + `06-jogos-l6-1/guia-prancha.png` | `06-jogos-l6-1/prompt.txt` | `jogos-l6-1.png` |
| 7 | `jogos-l6-2` | 9 | P1 | 1:1 | #00FF00 | `00-anexos-comuns/folha-de-estilo.png` + `07-jogos-l6-2/guia-prancha.png` | `07-jogos-l6-2/prompt.txt` | `jogos-l6-2.png` |
| 8 | `jogos-l7-1` | 7 | P1 | 9:16 | #FF00FF | `00-anexos-comuns/folha-de-estilo.png` + `08-jogos-l7-1/guia-prancha.png` | `08-jogos-l7-1/prompt.txt` | `jogos-l7-1.png` |
| 9 | `jogos-l7-2` | 5 | P1 | 3:4 | #FF00FF | `00-anexos-comuns/folha-de-estilo.png` + `09-jogos-l7-2/guia-prancha.png` | `09-jogos-l7-2/prompt.txt` | `jogos-l7-2.png` |
| 10 | `fundo-game-stars-bg` | 1 | P1 | 9:16 | — | `00-anexos-comuns/folha-de-estilo.png` | `10-fundo-game-stars-bg/prompt.txt` | `fundo-game-stars-bg.png` |
| 11 | `fundo-game-garden-bg` | 1 | P1 | 3:4 | — | `00-anexos-comuns/folha-de-estilo.png` | `11-fundo-game-garden-bg/prompt.txt` | `fundo-game-garden-bg.png` |
| 12 | `icones-ui-2` | 6 | P1 | 3:4 | #FF00FF | `00-anexos-comuns/folha-de-estilo.png` + `12-icones-ui-2/guia-prancha.png` | `12-icones-ui-2/prompt.txt` | `icones-ui-2.png` |
| 13 | `icones-ui-4` | 7 | P2 | 9:16 | #FF00FF | `00-anexos-comuns/folha-de-estilo.png` + `13-icones-ui-4/guia-prancha.png` | `13-icones-ui-4/prompt.txt` | `icones-ui-4.png` |
| 14 | `fundo-ui-bg-app` | 1 | P2 | 9:16 | — | `00-anexos-comuns/folha-de-estilo.png` | `14-fundo-ui-bg-app/prompt.txt` | `fundo-ui-bg-app.png` |
| 15 | `fundo-ui-bg-topbar` | 1 | P2 | 16:9 | — | `00-anexos-comuns/folha-de-estilo.png` | `15-fundo-ui-bg-topbar/prompt.txt` | `fundo-ui-bg-topbar.png` |
| 16 | `fundo-ui-button-primary` | 1 | P2 | 16:9 | — | `00-anexos-comuns/folha-de-estilo.png` | `16-fundo-ui-button-primary/prompt.txt` | `fundo-ui-button-primary.png` |
| 17 | `fundo-ui-panel-sheet` | 1 | P2 | 3:4 | — | `00-anexos-comuns/folha-de-estilo.png` | `17-fundo-ui-panel-sheet/prompt.txt` | `fundo-ui-panel-sheet.png` |
| 18 | `efeitos-brilho` | 1 | P2 | 1:1 | #00FFFF | `00-anexos-comuns/folha-de-estilo.png` + `18-efeitos-brilho/guia-prancha.png` | `18-efeitos-brilho/prompt.txt` | `efeitos-brilho.png` |
| 19 | `celebracoes` | 2 | P2 | 1:1 | #00FFFF | `00-anexos-comuns/folha-de-estilo.png` + `19-celebracoes/guia-prancha.png` | `19-celebracoes/prompt.txt` | `celebracoes.png` |

## Entrega

1. Coloque as imagens em `art-work/entrada-producao/` (nomes da última coluna; pode ser .png/.jpg/.webp). Pode entregar só parte: as ausentes são apenas sinalizadas.
2. Diga ao Claude: **"Produção entregue"**. Ele roda `npm run art:producao -- processar`, gera os relatórios e **espera a sua aprovação** antes de integrar.

## Arquivos de cada passo

- `prompt.txt`: texto para colar.
- `guia-prancha.png`: posição das células (só referência).
- `manifesto-processamento.json`: geometria usada no recorte automático (não editar).
- `manifesto-proposta.json`: arquivos finais e nomes oficiais que o passo vai gerar.
