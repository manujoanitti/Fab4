# Arquitetura

```
React + TypeScript + Vite (PWA)                       Supabase (Free)
┌───────────────────────────────────────┐            ┌──────────────────────────────┐
│ UI (src/ui, src/games)                │            │ Auth (e-mail/senha)          │
│   useSyncExternalStore ◄─ SyncManager │  RPC       │ PostgreSQL + RLS             │
│                           │  fila + cache  ───────► │ apply_op / get_snapshot ...  │
│ Domínio puro (src/domain) │  IndexedDB     ◄─────── │ (SECURITY DEFINER, atômicas) │
│  rules, engine, selectors │                         └──────────────────────────────┘
│  backup, ops              │
│ Backends: SupabaseBackend | EngineBackend (demo/testes)
└───────────────────────────────────────┘
```

- **Fonte oficial = Supabase.** O cliente guarda um *snapshot* em cache (IndexedDB) e uma **fila de operações** (cada uma com `opId`).
  A tela mostra `servidor + operações pendentes` (overlay otimista). Créditos ganhos offline aparecem como *a confirmar* e só podem ser gastos após o servidor confirmar.
- **Idempotência:** `applied_ops(campaign_id, op_id)`; selo do dia único por `(campanha, data)`; chaves únicas em eventos de crédito/recompensa;
  `pg_advisory_xact_lock` por campanha serializa as operações.
- **Conflitos:** metas e jardim usam versão otimista (`expectedVersion`). Divergência ⇒ o servidor **não** sobrescreve; a operação fica na fila como *conflito*
  e o responsável escolhe "manter o servidor" ou "usar a minha" (nova versão, histórico preservado). O jardim tem a mesma escolha na própria tela.
- **Motor único:** `src/domain/engine.ts` implementa as regras; `apply_op` (SQL) as espelha — `tests/db/parity.test.ts` compara ambos.
- **Segurança:** RLS de leitura para membros; **sem políticas de escrita** nas tabelas (todas as escritas via funções); `anon` sem acesso; criança sem privilégios.
  Não existe coluna de saldo (saldo = soma de eventos). Só a chave `anon` pública vai ao front-end.
- **Modo demonstração:** `EngineBackend('demo')` em IndexedDB com chaves `demo:*`; nunca importa credenciais nem envia dados; backups de demo não restauram em campanha real (e vice-versa).
- **Mapa:** SVG 2,5D (5 regiões, 25 casas, trilha em curva, personagem que caminha casa a casa, véu em regiões bloqueadas, confete em CSS). Sem biblioteca de jogos.
- **Minigames:** DOM + CSS; lógica pura testável (`memoryLogic`, `gardenLogic`).

## Estrutura do repositório
```
src/domain     regras originais, tipos, motor, seletores, backup, construtores de operação
src/sync       backends, SyncManager (cache/fila/conflitos), cliente Supabase
src/storage    IndexedDB (com fallback em memória)
src/ui, games  telas, mapa, minigames
supabase/      migrations 0001–0004 + seed fictício
tests/         unit (Vitest), db (PGlite), e2e (Playwright)
docs/          regras, pendências, arquitetura, Supabase, publicação, progresso
.github/       CI e deploy
```
