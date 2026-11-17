# Fluxo automatizado de produção gráfica (Gemini → app)

A geração das imagens é feita **por você, na interface do Gemini** (sem API, sem custo, sem automatizar o site). Tudo o mais — planejar lotes, escrever os prompts,
recortar, remover fundo, converter, nomear, conferir e preparar a integração — é feito por comandos locais e gratuitos (`sharp`, processamento 100% local).

```
art:plan ─► art:prompt ─► [você: Gemini] ─► art:process ─► art:review ─► [você: olha] ─► art:approve ─► art:integrate
 planejar     prompt+guia   gerar a imagem    recorta/valida   relatório     decide          aprovação      public/art + manifesto
                                                                                            ARTÍSTICA      (só com autorização)
```

## Os passos (poucas operações)
| # | Você faz | Comando | Resultado |
|---|---|---|---|
| 1 | Ver o que produzir | `npm run art:plan` | lista os lotes, estados e o **próximo lote** |
| 2 | Pegar o prompt | `npm run art:prompt` (ou `-- <lote>`) | imprime o prompt e grava `art-work/lotes/<lote>/prompt-gemini.txt` + `guia-prancha.png` |
| 3 | No Gemini: anexar os arquivos listados, colar o prompt, escolher a melhor imagem e salvá-la | — | — |
| 4 | Entregar a imagem | `npm run art:process -- <lote> caminho/da/imagem.png` | recorta, remove fundo, converte e valida; mostra ✅/⚠️/⛔ por recurso |
| 5 | Conferir | `npm run art:review -- <lote>` | `art-work/lotes/<lote>/revisao/relatorio.html` (abrir no navegador) |
| 6 | Decidir (arte) | `npm run art:approve -- <lote> --todos` (ou `--ids a,b` / `--rejeitar c`) | estado "Aprovado" quando todos aprovados |
| 7 | Integrar (**só com autorização**) | `npm run art:integrate -- <lote> --confirmar` | copia para `public/art/<pacote>` e atualiza o manifesto (não ativa nem publica) |

Sem argumentos, `art:prompt` escolhe o próximo lote liberado, e `art:process <arquivo>` descobre o lote que está aguardando geração.
`npm run art:ajuda` lista todos os comandos; `npm run art:status -- <lote>` mostra histórico e aprovações; `npm run art:reopen -- <lote>` manda refazer.

### Entregando a imagem pela conversa com o Claude
Anexe a imagem na conversa e escreva "processe o lote `<lote>`": o Claude roda `art:process` e `art:review`, mostra o relatório e só integra com a sua autorização.

## Pastas (`art-work/`, fora de `public/`: nada daqui é publicado)
```
art-work/
  registro.json                 estado de todos os lotes (versionado)
  referencias/                  folha-de-estilo.png, modelo-bianca.png, layout-regiao-N.png (suas entradas aprovadas)
  lotes/<lote>/
    prompt.md, prompt-gemini.txt, guia-prancha.png/.svg, processamento.json   o que foi pedido (versionado)
    recebido/                   imagens originais do Gemini, nunca sobrescritas (versionado, auditoria)
    resultado.json, manifesto-proposta.json                                   o que foi produzido (versionado)
    celulas/, saida/, revisao/  intermediários, arquivos finais e relatório (regeneráveis; não versionados)
```

## Estados de um lote
Planejado → Aguardando geração → Recebido → Processado → Em revisão → Aprovado → Integrado.
- O lote só **libera os dependentes** (ex.: ícones dependem do piloto) depois de **Aprovado**.
- Retomada: se o processo for interrompido, repetir o mesmo comando continua de onde parou; a mesma imagem não é reprocessada (use `--forcar`).
- Imagem nova no mesmo lote: os originais anteriores ficam guardados; as aprovações voltam a "pendente".

## Como funciona o recorte (e por que é tolerante)
1. **Prancha com grade conhecida**: o planejador calcula células (com a proporção do recurso final), margens e a proporção da folha (1:1, 3:4, 4:3, 9:16, 16:9). O `guia-prancha.png` mostra as posições.
2. **Fundo chapado** (verde/magenta/ciano puro, escolhido por lote para não colidir com a paleta). O processador mede a cor real do contorno, apaga **só o que está conectado ao fundo**
   (uma folha verde dentro do desenho é preservada), esvazia vãos fechados (anéis) e faz borda suave **descontaminando a cor do fundo**.
3. **Detecção por componentes**: cada elemento é associado à célula pelo centro dele; pequenos desvios do Gemini não quebram o recorte.
4. **Escala uniforme** da célula para o arquivo final (o anel de seleção fica ~19% maior que o medalhão, como no catálogo), centralização (ou base no chão para postes/personagem) e margem de segurança.
5. **Conversão** para WebP com alfa respeitando o orçamento de peso, nomes oficiais do catálogo e proposta de manifesto; depois roda a validação já existente (`validate-art`).

## Verificações automáticas (validação TÉCNICA)
| Alerta | Gravidade | Significa |
|---|---|---|
| célula vazia | ⛔ | nada foi encontrado na posição do recurso |
| cortado (borda da imagem/do arquivo) | ⛔ | o elemento encosta na borda: provavelmente cortado |
| sem transparência | ⛔ | o fundo não foi removido |
| dimensões / integridade / formato | ⛔ | arquivo final fora do catálogo ou ilegível |
| resíduos da cor do fundo | ⚠️ (⛔ se > 5%) | pixels na cor do fundo dentro do desenho |
| franja de cor do fundo nas bordas | ⚠️ | halo esverdeado/magenta |
| invade a célula vizinha / partes separadas | ⚠️ | elemento maior que a célula ou duplicado/fragmentado |
| margem / célula apertada | ⚠️ | o elemento precisou ser reduzido para respeitar a margem |
| resolução baixa | ⚠️ | a célula recebida é menor que o arquivo final (será ampliada) |
| peso | ⚠️ | acima do orçamento de KB do catálogo |
**Aprovação artística nunca é automática.** `art:approve` recusa recursos com ⛔ (reprocesse, rejeite ou gere de novo).

## Quando exige revisão humana
Sempre: estilo, coerência com a folha de estilo e com a Bianca, legibilidade em tela pequena, sombras e brilhos delicados (o recorte por fundo chapado pode comê-los ou deixar halo),
elementos que parecem com a cor do fundo, e qualquer ⚠️/⛔. A prancha `revisao/conferencia.png` mostra cada recurso sobre xadrez, fundo escuro e claro, com ID e status.

## Cenários das regiões
`art:process -- cenario-regiao-N <imagem>`: ajusta a ilustração aprovada ao tamanho exato (800×1080; região 1 + base e região 5 + topo vêm numa só imagem 800×1340 e são fatiadas),
analisa as **zonas que precisam ficar livres** (as 5 casas, o corredor da trilha, a faixa do título: mede excesso de detalhe/contraste), compara as emendas com as regiões vizinhas
e gera `revisao/previa-regiao-N.png` com a **geometria real do app** (trilha, casas, faixa) desenhada por cima.
**Não há separação em camadas**: o cenário entra como fundo; trilha, casas e faixa continuam desenhadas pelo app. As camadas `mid/path/fg` ficam adiadas (podem entrar depois como imagens próprias).

## Instalação local
Node 22 e `npm install` (o `sharp` baixa um binário pré-compilado; licença Apache-2.0, sem serviços externos nem chaves). Fontes do sistema são usadas só nos rótulos das imagens de conferência.

## Limitações conhecidas
- A remoção de fundo por cor chapada **não é perfeita**: sombras, brilhos difusos e elementos na cor do fundo exigem revisão (o prompt pede contornos nítidos e sem brilho externo).
- O Gemini pode não respeitar a grade ou desenhar texto/linhas: o processador tolera pequenos desvios, mas imagens muito tortas devem ser geradas de novo.
- A análise de zonas livres é uma heurística (densidade de bordas), não substitui o olhar na prévia.
- Véu semitransparente (`map.fog`), animações (Bianca walk/celebrate, efeito de casa) e variantes por região estão **adiados** (ver `art:plan -- --adiados`).
