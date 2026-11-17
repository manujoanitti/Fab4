# Progresso

## Incrementos concluídos
1. **Arquitetura e regras** — fotos transcritas (`regras-originais.md`, `pendencias-regras.md`), motor de domínio, testes.
2. **App funcional** — metas diárias/especiais (4 estados), modo responsável, histórico de alterações, recompensas (escolha + entrega), créditos, modo infantil.
3. **Mapa** — SVG 2,5D com 5 regiões, 25 casas, personagem animada, regiões bloqueadas, celebrações.
4. **Minigames** — Caça às Estrelas, Memória dos Cristais (níveis), Jardim Encantado (salvo no perfil), créditos e desbloqueios.
5. **Banco e sincronização** — migrações 0001–0004, RLS, `apply_op` atômico, convites, backup/restauração, SyncManager (fila offline, conflitos, idempotência).
6. **Finalização** — PWA (manifesto, ícones, service worker), modo demonstração isolado, backup JSON versionado, CI e deploy (GitHub Actions), documentação.

## Testes executados (neste ambiente)
| Suíte | Resultado |
|---|---|
| `npm run typecheck` | passou |
| Unidade (Vitest): regras, motor, jogos, sync, cloud, backup | passou |
| Banco (PGlite = Postgres real em WASM): migrações, seed, RLS, isolamento, escrita direta bloqueada, papéis, convites, concorrência/duplicação, restauração, **paridade motor × SQL (1.400 ops)** | passou |
| E2E (Playwright/Chromium, Pixel 7 e tablet): mapa, modo infantil/responsável, selo do dia, fases/etapas, campanha completa, jogos, jardim persistente, PWA, offline, responsivo, backup, PIN, isolamento do demo | passou |
| `npm run build` (produção, com `VITE_BASE=/Fab4/`) | passou |
Contagens exatas: ver saída de `npm test` / `npm run test:e2e`.

## Verificação pré-publicação (Supabase configurado pela pessoa responsável)
- Chave Publishable: supabase-js 2.119 envia `sb_publishable_…` só em `apikey` (Bearer = JWT do usuário); verificado por e2e com Supabase simulado. Build recusa `sb_secret_`/`service_role`.
- Variáveis `VITE_*`: o workflow de deploy as lê via `vars.*`; guardas `check-env`/`check-dist` e resumo da execução indicam se o build saiu com nuvem.
- Caminho-base `/Fab4/`: build servido em `/Fab4/` no e2e (projeto "cloud") + `check-dist`.
- Conta única: fluxo criar campanha → metas → selo → offline → recarga testado; limites de segurança documentados; plano de reforço em `plano-atualizacao-banco.md`.
- CI no GitHub (run 1) falhou em 1 teste e2e (`offline`): corrigida a durabilidade da fila (gravação confirmada antes de refletir na tela).

## Funcionalidades pendentes / limites conhecidos
- **Supabase real não foi exercitado** (exige credenciais da pessoa responsável): migrações e RPC foram testadas em Postgres local (PGlite) e o cliente por mock. Passo a passo em `configuracao-supabase.md`.
- **Deploy no GitHub Pages não foi realizado** (exige ativar Pages no repositório); workflows prontos em `.github/workflows`. Sem URL publicada.
- Concorrência real entre conexões não foi testada em PGlite (conexão única); a proteção é advisory lock + chaves únicas.
- Fases concluídas **não podem ser desfeitas** pelo app (documentado); correção via banco/backup.
- Selo do dia concedido não pode ser revogado pelo app; ajustes de crédito são manuais com motivo.
- Sincronização por *polling* (abrir, voltar ao app, reconectar, a cada 30 s, após cada alteração); sem Realtime.
- Reconciliação de conflitos testada em unidade; não há teste e2e do painel de conflitos.
- Interpretações operacionais (selo = 8 de 8 metas etc.) em `pendencias-regras.md` — conferir com o tabuleiro físico.
- Ilustrações são vetoriais originais (inspiradas no tabuleiro), não reproduzem a arte do tabuleiro.

## Próximas ações
1. Criar projeto Supabase, aplicar migrações, criar contas e testar com dois aparelhos reais.
2. Ativar GitHub Pages e configurar as *Variables* `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. Revisar `pendencias-regras.md` com a família e ajustar Configurações.
4. (Opcional) Realtime do Supabase; revogação de selo; e2e do painel de conflitos.
