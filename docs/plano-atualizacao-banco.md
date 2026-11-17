# Plano de atualização do banco — PIN do responsável verificado no servidor (PROPOSTA)

**Status: proposta para aprovação. Nada foi aplicado ao banco nem criado em `supabase/migrations/`.** As migrações 0001–0004 já executadas permanecem intactas.

## Problema
Com uma conta única da família, todo aparelho logado é *responsável* para o banco. O PIN atual é só de interface (por aparelho).

## Alternativas
| Opção | Segurança | Esforço | Observação |
|---|---|---|---|
| A. Manter como está (PIN de interface + bloqueio automático) | baixa contra quem manipula a API | nenhum | adequada se a criança não tem perfil técnico |
| **B. PIN verificado no banco (esta proposta)** | média/alta | 1 migração + ajustes de cliente e testes | continua com **uma conta**; a ação privilegiada exige desbloqueio válido na *sessão* do aparelho |
| C. Conta separada para a criança (papel `child`) | alta | nenhum (já suportado) | exige 2 logins; recomendada para o aparelho da Bianca |

## Desenho da opção B (migração aditiva `0005_guardian_pin.sql`)
1. **Tabelas novas** (RLS ativa, sem políticas, sem grants ao cliente):
   `campaign_secrets(campaign_id pk, pin_hash text, failed_attempts int, locked_until timestamptz)` e
   `guardian_unlocks(campaign_id, session_id text, expires_at timestamptz, pk(campaign_id, session_id))`.
2. **Funções novas** (`SECURITY DEFINER`, `search_path` fixo, só `authenticated`):
   - `set_guardian_pin(p_campaign, p_pin, p_current_pin default null)` — só responsável; 4–8 dígitos; `crypt(pin, gen_salt('bf'))` (pgcrypto, schema `extensions`).
   - `unlock_guardian(p_campaign, p_pin)` — compara o hash; **limite de tentativas** (5 falhas ⇒ bloqueio de 15 min); grava desbloqueio de **10 min** para o `session_id` do JWT (`auth.jwt()->>'session_id'`), renovável.
   - `lock_guardian(p_campaign)`.
3. **Alteração de `apply_op`** (`create or replace`, mesmo contrato): se a campanha tem `pin_hash`, as operações privilegiadas (`set_goal`, `grant_medal`, `complete_phase`, `deliver_reward`, `adjust_credits`, `update_settings`) e as RPC `restore_backup`/`create_invite`
   exigem desbloqueio ativo na sessão; senão retornam `rejected/locked`. **Sem PIN definido, o comportamento é idêntico ao atual** (compatível).
4. **Motor TypeScript** (`engine.ts`): novo código `locked` e flag `unlocked` no contexto; **teste de paridade** estendido.
5. **Cliente**: o botão "Responsável" chama `unlock_guardian` (no lugar do PIN local) quando a campanha tem PIN no servidor; bloqueio automático chama `lock_guardian`.
6. **Testes novos** (PGlite): força bruta/limite, desbloqueio por sessão (duas sessões do mesmo usuário), expiração, `apply_op` sem PIN inalterado, `anon` sem acesso às tabelas novas.

## Procedimento de aplicação (após sua aprovação)
1. Eu crio `0005_guardian_pin.sql` na branch, com testes verdes. 2. Você revisa o arquivo e o executa no *SQL Editor* (uma única vez; é idempotente nas criações `if not exists`/`create or replace`).
3. Você define o PIN no app (*Mais › PIN do responsável*). 4. Validação: ação privilegiada sem desbloqueio deve retornar "locked".

## Reversão
`drop function` das três funções novas e das tabelas novas; restaurar `apply_op` com o corpo de `0004_functions.sql` (arquivo existente, `create or replace`). Nenhum dado de jogo é alterado pela migração.

## Riscos residuais da opção B
Observação do PIN digitado (*shoulder-surfing*); PIN esquecido (redefinição exigiria acesso ao banco, ou a senha da conta + função de redefinição a especificar); `session_id` depende de o Supabase manter essa claim no JWT (é padrão atualmente).
