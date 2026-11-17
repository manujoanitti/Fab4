# Configuração do Supabase (plano Free, custo R$ 0)

O app funciona sem Supabase apenas no **modo demonstração**. Para usar a campanha real e sincronizar celulares/tablets:

1. Crie um projeto em <https://supabase.com> (plano **Free**; não ative planos pagos nem "spend cap" off).
2. **Aplicar o esquema** — em *SQL Editor*, execute em ordem o conteúdo de `supabase/migrations/`:
   `0001_schema.sql` → `0002_rules.sql` → `0003_rls.sql` → `0004_functions.sql`.
   (Ou com a CLI: `supabase link` + `supabase db push`.) Não execute `seed.sql` em produção (é só para desenvolvimento).
3. **Autenticação** (*Authentication › Providers › Email*): habilite e-mail+senha. Crie as contas (responsáveis e a conta da criança)
   e depois **desative "Allow new users to sign up"** (*Authentication › Sign In / Providers*) para que ninguém mais crie conta.
   Mesmo com cadastro aberto, RLS impede ver/alterar qualquer campanha da qual a pessoa não seja membro.
4. **Chaves** (*Project Settings › API Keys*): copie a **Project URL** e a chave **Publishable** (`sb_publishable_…`; a chave `anon` legada também funciona).
   - A variável continua se chamando `VITE_SUPABASE_ANON_KEY` (guarda a Publishable). O cliente `@supabase/supabase-js` ≥ 2.119 a envia somente no cabeçalho `apikey`
     (nunca como Bearer) e usa o JWT do usuário após o login — verificado em `tests/e2e/cloud.spec.ts`.
   - Local: copie `.env.example` para `.env.local` e preencha as duas variáveis.
   - Publicação: crie as *Variables* **de repositório** (Settings › Secrets and variables › Actions › **Variables › Repository variables**) com os mesmos nomes (ver `publicacao.md`).
   - **Nunca** use `sb_secret_…` ou `service_role` no front-end ou no repositório: o build **falha** se detectar uma delas (`scripts/check-env.mjs`).
5. **Primeiro acesso**: entre no app com a conta da família › *Nova campanha familiar* (basta **uma conta**; convites são opcionais).
   Para ter contas separadas, em *Responsável › Mais › Convidar outra conta* gere um **código de convite** (uso único, 7 dias) para a conta da criança
   (papel *criança*) ou para outro responsável; a pessoa entra, abre "Tenho um convite" e informa o código.
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

## Uma conta só para a família — o que muda e quais são os limites de segurança
**Funciona sem ajustes de banco:** `create_campaign` torna quem cria o *responsável*; metas, selo do dia, fases, recompensas, créditos, jogos e backup operam com essa única conta.
O app sempre abre no **modo da Bianca**; o modo responsável é uma troca de interface (com PIN opcional por aparelho e bloqueio automático após 5 min sem toque).

**Limitação importante:** com uma conta única, **todo aparelho conectado tem, no banco, permissões de responsável**. O PIN e o bloqueio automático são barreiras
**de interface**, não de banco: alguém com conhecimento técnico, no aparelho já conectado, poderia chamar a API diretamente e conceder um selo. Além disso, o histórico não
distingue *quem* (todas as ações aparecem como o mesmo usuário). Mitigações já disponíveis:
1. Defina o PIN em *Mais* (o app avisa quando não há PIN) e não deixe o modo responsável aberto.
2. **Separação real:** use uma conta *criança* no aparelho da Bianca (convite com papel "criança"): o banco recusa toda ação de responsável nessa conta.
3. Faça *Sair da conta* em aparelhos compartilhados; a recusa de cadastro novo (item 3) evita contas estranhas.
4. Exporte backups periodicamente.
Proposta de reforço no servidor (PIN verificado no banco), **não aplicada**, em `docs/plano-atualizacao-banco.md`.

## Revisão das políticas RLS e RPC (resumo)
- Leitura: só membros da campanha; `anon` não acessa nenhuma tabela nem função; convites só aparecem a responsáveis.
- Escrita: nenhuma política de INSERT/UPDATE/DELETE nas tabelas de dados; só as funções `SECURITY DEFINER` (`search_path` fixo) escrevem, validando `auth.uid()` e o papel.
- Funções internas ficam no schema `private` (não exposto pela API) e sem `EXECUTE` para `anon`/`public`.
- Saldo de créditos não é editável (soma de eventos). Selo único por data (PK) e idempotência por `opId`.
- Atenção futura: tabelas novas criadas no schema `public` recebem, por padrão do Supabase, privilégios para `anon`/`authenticated`; ao criar tabelas, repita `revoke all … from anon, authenticated` e ative RLS.
