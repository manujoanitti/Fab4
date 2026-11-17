# Regras originais — Reino da Bianca

Fonte primária: duas fotografias do tabuleiro físico — **"Regras do Reino da Bianca"** (painel de regras) e
**"A Trilha encantada da Bianca"** (mapa com as 25 casas). A redação abaixo foi transcrita das fotos.
Os dados de código correspondentes estão em `src/domain/rules.ts` (e espelhados em `supabase/migrations/0002_rules.sql`);
`tests/unit/rules.test.ts` e `tests/db/*` garantem a consistência.

Legenda das seções do documento:
**[A]** regra expressamente prevista no tabuleiro · **[B]** regra operacional necessária ao app (configurável) · **[C]** elemento lúdico adicional.

Correspondência de termos: o tabuleiro fala em **"selo do dia"**; o código/UI técnico usa *medalha diária* (`medal`). São a mesma coisa.

## [A] Como funciona
- A cada fase concluída, Bianca ganha 1 selo pequeno.
- Ao completar 5 fases e finalizar uma etapa, ela recebe a recompensa da etapa.

## [A] Trilha (mapa)
Cinco etapas, cada uma com 5 fases numeradas `E.F` (1.1 … 5.5), totalizando **25 fases**; ponto de partida "Início".

| Etapa | Nome (região) | Fases |
|---|---|---|
| 1 | Floresta dos Sonhos | 1.1 – 1.5 |
| 2 | Castelo das Fadas | 2.1 – 2.5 |
| 3 | Lago Cristalino | 3.1 – 3.5 |
| 4 | Montanhas da Coragem | 4.1 – 4.5 |
| 5 | Jardim da Magia | 5.1 – 5.5 |

## [A] Metas diárias (8)
1. Não bater em ninguém e, se o colega provocar, falar com a professora.
2. Fazer todas as tarefas de casa.
3. Arrumar a cama pela manhã.
4. Escovar os dentes em todas as refeições.
5. Não gritar quando ficar chateada.
6. Se ficar muito nervosa, respirar fundo 15 vezes e contar bem devagar até 30.
7. Não enrolar para tomar banho quando a mamãe pedir.
8. Ler com a mamãe ou o papai uma história antes de dormir.

## [A] Metas especiais da semana (2)
- **Meta de terça ou quarta:** pintar algum desenho junto com a mamãe.
- **Meta de sexta ou sábado:** escolher 1 história lida durante a semana e desenhar a parte de que mais gostou.

## [A] Regra do selo do dia
- Se não cumprir a meta do dia, não ganha o selo.
- Se brigar com o colega, apenas não ganha o selo do dia.

(Consequência: brigar com o colega **não** tem nenhuma outra penalidade — não remove selos, moedas nem fases. O app só registra a meta como "não cumprida".)

## [A] Recompensas por etapa
| Etapa | Moedas | Selos grandes | Recompensa | Opções (redação original) |
|---|---|---|---|---|
| 1 | 1 | 1 | 1 pequena | dormir 1 hora mais tarde; assistir mais 1 desenho; ganhar 1 item de papelaria; ganhar 1 lanche fora de casa |
| 2 | 2 | 1 | 1 pequena | dormir 1 hora mais tarde; assistir mais 1 desenho; ganhar 1 item de papelaria |
| 3 | 3 | 2 | 1 média | fazer uma noite do pijama com 2 amiguinhas; ganhar um lanche fora de casa; ganhar 1 bolsinha ou 1 óculos novo |
| 4 | 4 | 2 | 1 média | fazer uma noite do pijama com 2 amiguinhas; ganhar um lanche fora de casa; ganhar 1 bolsinha ou 1 óculos novo |
| 5 | 5 | 3 | 1 grande | um brinquedo novo; uma ida ao cinema com 1 amiga; 1 dia no clube ou parque |

Totais: **15 moedas**, **9 selos grandes**, **25 selos pequenos** (1 por fase), mais os selos do dia.

## [A] Bônus final
> Se juntar todas as 15 moedas e os 9 selos grandes, ganha mais 1 selo grande e pode trocar por outra recompensa grande (outro passeio ou brinquedo).

Implementação: ao concluir a fase 5.5 (quando moedas ≥ 15 e selos grandes ≥ 9), o sistema registra +1 selo grande (total 10) e libera uma recompensa grande extra (opções: "outro passeio", "brinquedo").

## [B] Regras operacionais (não estão no tabuleiro; configuráveis/documentadas)
| Regra | Padrão | Onde configurar |
|---|---|---|
| Quantas metas diárias "cumpridas" são necessárias para o responsável poder conceder o selo do dia | **8 de 8** (leitura estrita de "cumprir a meta do dia") | Responsável › Configurações (`medalMinGoals`) |
| Metas especiais entram na exigência do selo do dia nos dias em que aparecem | **não** | Configurações (`medalIncludesSpecial`) |
| Meta especial vale uma vez por semana (segunda a domingo): cumprida em um dos dois dias, a outra data aparece como "já cumprida" | sim | fixo (derivado do texto "terça **ou** quarta") |
| Meta "não avaliada" ≠ "não cumprida": só `cumprida` conta para o selo | sim | fixo |
| O selo do dia só é concedido por **confirmação do responsável** | sim | fixo |
| A conclusão de fase é **confirmada pelo responsável**, em ordem (não há regra original que permita automatizar) | sim | fixo |
| Sugestão informativa de "N selos do dia por fase" | desligada | Configurações (`medalsPerPhaseHint`) |
| Fases não podem ser desfeitas pelo app (para não reverter moedas/selos); correções são feitas pelo backup/restauração ou pelo banco | — | — |
| Seleção da recompensa escolhida e registro de "recebida" feitos pelo responsável | — | Responsável › Recompensas |

## [C] Elementos lúdicos adicionais (não fazem parte do tabuleiro)
- **Modelo híbrido de minigames**: cada selo do dia confirmado concede 1 crédito; cada sessão consome 1; créditos não expiram; o histórico fica visível ao responsável.
- Minigames: *Caça às Estrelas* (livre), *Memória dos Cristais* (desbloqueado ao concluir a etapa 2), *Jardim Encantado* (desbloqueado ao concluir a etapa 4). **Esses critérios de desbloqueio são regras digitais adicionais.**
- Os minigames **não** concedem selos do dia, moedas, selos do tabuleiro, nem alteram metas.
- Personagem animada, celebrações, mapa 2,5D, modo infantil / responsável, modo demonstração.
