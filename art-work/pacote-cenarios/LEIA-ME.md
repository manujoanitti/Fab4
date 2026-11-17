# Cenários das 5 regiões — pacote de produção (Gemini)

Tudo o que você precisa para gerar as 5 imagens **numa única sessão**, sem voltar ao Claude entre elas. Nada aqui usa API paga: você gera manualmente no Gemini.

## Antes de começar

- Use **um único chat novo** do Gemini para as 5 imagens (ele mantém o traço e a paleta entre elas). Peça sempre a **maior resolução** disponível.
- Siga a ordem **1 → 5** (a Região 1 é a de baixo do mapa; a 5, a do topo).
- Em **cada passo**: anexe os 2 arquivos indicados, cole o prompt (`prompt.txt`) e gere. Se a imagem vier com trilha, casas, texto ou moldura, ou com o estilo diferente, peça de novo (ou cole: "Refaça sem trilha, casas ou texto, mantendo o mesmo estilo").
- A partir do passo 2, se o estilo se afastar da Região 1, **anexe também a imagem da Região 1 já aprovada** e acrescente ao prompt: "Mantenha exatamente o mesmo traço, textura e paleta desta imagem".
- O layout de referência de cada região (`layout-regiao-N.png`) é **opcional**: o guia da região já basta.

## Sequência

| # | Região | Anexar (2 arquivos) | Colar | Salvar como | Proporção |
|---|---|---|---|---|---|
| 1 | Floresta dos Sonhos | `00-anexos-comuns/folha-de-estilo.png` + `01-regiao-1/guia-regiao-1.png` | `01-regiao-1/prompt.txt` | `regiao-1.png` | 800:1340 |
| 2 | Castelo das Fadas | `00-anexos-comuns/folha-de-estilo.png` + `02-regiao-2/guia-regiao-2.png` | `02-regiao-2/prompt.txt` | `regiao-2.png` | 800:1080 |
| 3 | Lago Cristalino | `00-anexos-comuns/folha-de-estilo.png` + `03-regiao-3/guia-regiao-3.png` | `03-regiao-3/prompt.txt` | `regiao-3.png` | 800:1080 |
| 4 | Montanhas da Coragem | `00-anexos-comuns/folha-de-estilo.png` + `04-regiao-4/guia-regiao-4.png` | `04-regiao-4/prompt.txt` | `regiao-4.png` | 800:1080 |
| 5 | Jardim da Magia | `00-anexos-comuns/folha-de-estilo.png` + `05-regiao-5/guia-regiao-5.png` | `05-regiao-5/prompt.txt` | `regiao-5.png` | 800:1340 |

## Entrega das 5 imagens

1. Salve as 5 imagens (PNG ou JPG, na maior resolução) na pasta `art-work/entrada-cenarios/` com os nomes `regiao-1.png` … `regiao-5.png` (a extensão pode ser .jpg/.webp).
2. Volte ao Claude e diga: **"Cenários entregues"**. Ele processa as cinco (`npm run art:cenarios -- processar`), gera o relatório e a prévia no mapa real e **espera a sua aprovação** antes de integrar qualquer coisa.
3. Se faltar alguma imagem, o processamento segue com as presentes e avisa quais faltam.

## Arquivos de cada passo

- `prompt.txt`: texto para colar no Gemini.
- `guia-regiao-N.png`: posição das 5 casas e do corredor da trilha (use só como referência de posição).
- `manifesto-proposta.json`: arquivos finais que cada imagem vai gerar (nomes e proporções); não precisa abrir.
- `pacote.json`: o mesmo, em formato de máquina.
