# Pendências e ambiguidades das regras

Nada abaixo foi inventado: são pontos em que o tabuleiro não diz o suficiente. Cada item tem o tratamento adotado
e como o responsável pode ajustá-lo. Peça de revisão: conferir com o tabuleiro físico.

## Ambiguidades de interpretação
1. **Critério da "meta do dia" para o selo.** O painel diz "Se não cumprir a meta do dia, não ganha o selo", mas há 8 metas diárias.
   *Adotado:* exigir as 8 (configurável de 1 a 8 em Configurações). O responsável sempre confirma.
2. **Metas especiais e o selo do dia.** Não está dito se contam para o selo. *Adotado:* não contam (configurável).
3. **Quantos selos do dia (ou quanto tempo) fazem uma fase.** O tabuleiro só diz "A cada fase concluída…" sem critério de conclusão.
   *Adotado:* o responsável confirma cada fase; há uma sugestão informativa opcional (`medalsPerPhaseHint`), desligada.
4. **Selo "grande" por etapa.** As quantidades por etapa (1,1,2,2,3) estão no tabuleiro; a mecânica de "quando" é a conclusão da etapa
   (5ª fase), conforme "Ao completar 5 fases e finalizar uma etapa, ela recebe a recompensa da etapa".
5. **Meta especial "terça ou quarta" / "sexta ou sábado".** Interpretado como uma meta por semana, cumprível em qualquer um dos dois dias.
6. **Semana.** Considerada de segunda a domingo (fuso do aparelho do responsável; datas gravadas como `YYYY-MM-DD`).
7. **Bônus final — "mais 1 selo grande e pode trocar por outra recompensa grande (outro passeio ou brinquedo)".**
   Interpretado como: +1 selo grande (total 10) e liberação de uma recompensa grande extra, escolhida entre "outro passeio" e "brinquedo".
8. **Recompensa da etapa 2** lista apenas 3 opções (sem "lanche fora de casa"); mantido como no tabuleiro.
9. **"Regras de exceção".** Só a regra do selo do dia (brigar com o colega ⇒ apenas perde o selo do dia). Nenhuma outra exceção aparece nas fotos.
10. **Moedas, selos grandes e recompensas ao concluir a etapa** são liberados automaticamente quando o responsável confirma a 5ª fase da etapa;
    a escolha da opção e a entrega são registradas separadamente.

## Trechos ilegíveis
Nenhum trecho do painel de regras ficou ilegível nas fotografias. O mapa ("A Trilha encantada da Bianca") foi usado para a numeração e os nomes das etapas;
a posição exata das casas no desenho original não é reproduzida (o mapa digital é uma releitura 2,5D).

## Pendências externas (não dependem de regra)
- Criar o projeto Supabase e aplicar as migrações (ver `configuracao-supabase.md`) — requer credenciais da pessoa responsável.
- Publicar no GitHub Pages (ver `publicacao.md`) — requer ativar Pages no repositório.
