# Configuração do Supabase (plano Free, custo R$ 0)

O app funciona sem Supabase apenas no **modo demonstração**. Para usar a campanha real e sincronizar celulares/tablets:

1. Crie um projeto em <https://supabase.com> (plano **Free**; não ative planos pagos nem "spend cap" off).
2. **Aplicar o esquema** — em *SQL Editor*, execute em ordem o conteúdo de `supabase/migrations/`:
   `0001_schema.sql` → `0002_rules.sql` → `0003_rls.sql` → `0004_functions.sql`.
   (Ou com a CLI: `supabase link` + `supabase db push`.) Não execute `seed.sql` em produção (é só para desenvolvimento).
3. **Autenticação** (*Authentication › Providers › Email*): habilite e-mail+senha. Crie as contas (responsáveis e a conta da criança)
   e depois **desative "Allow new users to sign up"** (*Authentication › Sign In / Providers*) para que ninguém mais crie conta.
   Mesmo com cadastro aberto, RLS impede ver/alterar qualquer campanha da qual a pessoa não seja membro.
4. **Chaves** (*Project Settings › API*): copie **Project URL** e a chave **anon/public**.
   - Local: copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
   - Publicação: crie as *Variables* de repositório `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ver `publicacao.md`).
   - **Nunca** use `service_role` no front-end ou no repositório.
5. **Primeiro acesso**: entre no app com a conta do responsável › *Nova campanha familiar*. Em *Responsável › Mais › Convidar*,
   gere um **código de convite** (uso único, 7 dias) para a conta da criança (papel *criança*) ou para outro responsável; a pessoa entra, escolhe
   "Tenho um convite" e informa o código.
6. **Papéis**: *responsável* pode tudo; *criança* só lê, inicia sessões de minigame e salva a decoração do jardim.
   A autorização é feita no banco (`apply_op` + RLS), não pela interface.

## Modelo de dados (resumo)
`profiles`, `campaigns` (inclui `settings`), `campaign_members` (papel), `campaign_invites`, `goal_reviews` + `goal_review_history`,
`daily_medals` (selo do dia — PK campanha+data impede concessão dupla), `phase_progress`, `reward_events`, `game_credit_events` (saldo = soma),
`game_sessions`, `game_state`, `applied_ops` (idempotência). Regras originais em `rule_*` (somente leitura).
Entidades sugeridas `daily_reviews`/`goal_reviews` foram consolidadas em `goal_reviews`+`daily_medals`.

## Funções (RPC) — todas `SECURITY DEFINER`, executáveis só por `authenticated`
`apply_op` (metas, selo do dia + crédito atômico, fases e recompensas, créditos, sessões, jardim, configurações), `get_snapshot`, `create_campaign`,
`list_my_campaigns`, `create_invite`, `redeem_invite`, `restore_backup`.

## Verificação
`npm run test:db` aplica as migrações do zero em um Postgres real (PGlite), testa RLS por papel (`authenticated`/`anon`), isolamento entre famílias,
escrita direta bloqueada, convites, restauração, e compara o motor TypeScript com o SQL em 1.400 operações aleatórias.
**Pendência externa:** a execução contra um projeto Supabase real exige credenciais da pessoa responsável e não foi realizada nesta sessão.

## Limites do plano Free (a título de orientação)
Projetos Free podem ser pausados após período de inatividade; use o app periodicamente ou exporte backups regularmente (*Mais › Exportar backup*).
