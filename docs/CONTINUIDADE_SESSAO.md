# Continuidade de sessão — Reino da Bianca

Documento de transferência para uma nova sessão do Claude Code. Complementa `CLAUDE.md` (regras e comandos) e `docs/progresso.md` (histórico).
Não contém o histórico da conversa; só o necessário para retomar.

## 1. Objetivo e arquitetura
- **Objetivo:** PWA que gamifica um tabuleiro físico de metas pessoais da Bianca: 5 etapas, 25 fases, 8 metas diárias, 2 metas especiais semanais,
  selo do dia, selos pequenos/grandes, moedas, recompensas, bônus final e 3 minigames. Fonte das regras: `docs/regras-originais.md`.
- **Custo adicional R$ 0:** GitHub público + Pages + Supabase Free. Nenhuma API paga.
- **Stack:** React 18 + TypeScript estrito + Vite 5 + vite-plugin-pwa. Vitest (+ PGlite) e Playwright.
- **Camadas:**
  - `src/domain` — engine pura (regras em `rules.ts`, espelhadas em `supabase/migrations/0002_rules.sql`).
  - `src/sync` — `SyncManager` (cache IndexedDB, fila, conflitos otimistas) sobre `Backend`: `SupabaseBackend` (nuvem) ou `EngineBackend` (demo/testes).
  - `supabase/migrations` 0001–0004 + `seed.sql` — RLS, escrita só por RPC `SECURITY DEFINER`; `apply_op` espelha `engine.ts`.
  - `src/ui`, `src/games` — telas mobile-first com `data-testid` estáveis (usados no e2e).
  - `src/art` — camada gráfica por ID lógico → `catalog.json` (116 recursos) → `manifest.json` → registro → componentes com fallback.
  - `scripts/art` + `art-work` — pipeline de produção gráfica (Gemini manual → processamento local).
- Detalhes: `docs/arquitetura.md`, `docs/arte/contrato-integracao.md`, `docs/arte/fluxo-producao-automatizado.md`.

## 2. Estado atual
**Aplicativo (concluído e publicado na `main`, commit d2d48d0):**
- Regras, engine, sync offline-first, painel do responsável, mapa, conquistas, minigames, demo (`/?demo`), backup.
- Supabase configurado pelo usuário: 4 migrações executadas, conta única da família, cadastro público desativado, variáveis do repositório definidas, chave `sb_publishable_`. Pages publicado.
- Testes: 227 unitários/banco, 26 e2e; CI verde no commit 3fea314.

**Pipeline gráfico (na branch de desenvolvimento, NÃO mergeado):**
- Planejador: 25 lotes (14 pranchas, 5 cenários, 6 fundos individuais) cobrindo 82 recursos; 34 adiados com motivo (`npm run art:plan -- --adiados`).
- Prompts/guias, processador (`sharp`), QA técnico, relatório de revisão, fluxo de cenários, registro de estados com retomada, integração controlada.
- Lote piloto `piloto-marcos-regiao-1` em **"Aguardando geração"**; nenhuma imagem real foi processada ainda.
- **Nada integrado ao app:** `src/art/manifest.json` = `{schema:1,activePack:null,packs:{}}`; `public/art` não existe; visual atual é o fallback.

## 3. Decisões aprovadas
**Técnicas**
- Regras originais só em `rules.ts` + `0002_rules.sql` (iguais; `tests/db/schema.test.ts` confere). Parâmetros operacionais em `Settings`/`docs/pendencias-regras.md`.
- Migrações já executadas não podem ser alteradas sem plano prévio apresentado ao usuário. PIN no servidor (`docs/plano-atualizacao-banco.md`) **não** aplicado.
- Telas pedem arte por ID lógico, nunca por caminho; sem arte = fallback. Geometria do mapa (`src/ui/mapGeometry.ts`) não muda sem decisão explícita.
- Chaves persistidas dos minigames (emoji do Jardim) não mudam.
- Golden de aparência em `tests/golden/*.html` (`UPDATE_GOLDEN=1 npx vitest run tests/unit/golden` só para mudança visual intencional).
- Validação técnica ≠ aprovação artística (sempre manual). Originais do Gemini ficam em `art-work/lotes/*/recebido/`.
- Bianca inicia como imagem estática (ao integrar, ajustar o catálogo para estática por padrão).

**Artísticas (folha de estilo aprovada)**
- Fantasia onírica e poética; aquarela e lápis de cor com textura de papel; formas orgânicas levemente surreais; paleta pastel rica (lavanda, rosa, pêssego, azul, turquesa, verde, dourado, creme); atmosfera de livro ilustrado infantil.
- Evitar: aparência genérica de jogo mobile (plástico, gloss, gemas 3D), UI desenhada dentro da imagem, 3D, foto, pixel art.
- Regiões: Floresta dos Sonhos, Castelo das Fadas, Lago Cristalino, Montanhas da Coragem, Jardim da Magia.
- Fundo chapado por lote para recorte: #00FF00 (piloto), #FF00FF, #00FFFF nos demais.

## 4. Referências visuais recebidas
| Referência | Caminho | Situação |
|---|---|---|
| Folha de estilo visual aprovada | `art-work/referencias/folha-de-estilo.png` (1493×2000) | versionada |
| Guia de posições do piloto | `art-work/lotes/piloto-marcos-regiao-1/guia-prancha.png` (+ `.svg`) | versionado |
| Modelo da Bianca | — | **ainda não recebido** (aparece apenas na folha de estilo) |
| Layouts de referência das 5 regiões | — | **ainda não recebidos** |
| Prancha gerada do piloto | — | **ainda não recebida** |
| Fotos do tabuleiro físico | transcritas em `docs/regras-originais.md` | só a transcrição |

## 5. Branch e último commit
- Branch de trabalho: `claude/reino-bianca-desenvolvimento-x0lr62` (empurrada ao remoto).
- `main` = d2d48d0 (publicada). A branch tem à frente: 3fea314 (pipeline) e c1ddd3b (prompt do piloto corrigido + folha de estilo) + o commit deste documento.
- **Merge na main NÃO autorizado.** Hash exato do último commit: `git log -1 --oneline`.

## 6. Tarefas
**Concluídas**
- App completo, banco, sync, demo, minigames, backup; CI e deploy no Pages.
- Camada gráfica (etapa 1) sem alteração visual; guias de layout; validador.
- Pipeline de produção gráfica e piloto preparado; 107 testes de arte passam.
- Prompt do piloto reescrito: 6 áreas em 3 faixas, com coordenadas em % derivadas dos mesmos retângulos do guia e do `processamento.json` (teste confere). Geometria do processamento **não** alterada.

**Pendentes**
- Validar o prompt corrigido, gerar a prancha no Gemini, processar e revisar o piloto.
- Receber modelo da Bianca e layouts das 5 regiões.
- Demais 24 lotes (ícones, jogos, bônus final, Bianca, cenários, fundos), cada um só após aprovação do anterior.
- Integrar arte ao app, publicar e mergear: **só com autorização explícita**.
- Opcional: PIN no servidor; `art-src/` para originais; Realtime; revogação de selo.

## 7. PRÓXIMO PASSO EXATO
**Piloto `piloto-marcos-regiao-1`: aprovado e integrado** (pacote `v1` ativo; `proposta-app.patch` aplicado; testes, typecheck, build e e2e verdes). Nada publicado nem mergeado na `main`.
Pendências não bloqueantes: proximidade marco Início × fase 1.1; possível distorção da textura da faixa; adequar as faixas das demais regiões. Sem novas rodadas de refinamento do piloto.

**Agora: cenários das 5 regiões.** Pacote pronto em `art-work/pacote-cenarios/` (leia `LEIA-ME.md`): 5 prompts temáticos + guias + manifestos.
1. O usuário gera as 5 imagens no Gemini (um único chat, ordem 1→5) e salva em `art-work/entrada-cenarios/regiao-1.png … regiao-5.png`.
2. Quando disser "Cenários entregues": `npm run art:cenarios -- processar` (processa as presentes, gera relatórios); depois prévia no mapa real; **aprovação e integração só com ordem do usuário** (`art:approve`, `art:integrate -- --confirmar`).
3. Regerar o pacote: `npm run art:cenarios -- pacote`.

## 8. Comandos
```
npm install
npm run dev                 # http://localhost:5173/?demo
npm run typecheck           # ou: npx tsc --noEmit -p .
npm test                    # Vitest: unidade + banco (PGlite)
npx vitest run tests/unit/art   # só a parte gráfica (107 testes)
npm run test:db             # obrigatório ao mudar SQL/engine.ts (paridade)
npm run test:e2e            # CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
npm run build               # VITE_BASE=/<repo>/ para Pages
node scripts/check-dist.mjs /Fab4/
npm run art:validate        # manifesto × catálogo × public/art
npm run art:docs | art:guides
# pipeline gráfico
npm run art:plan [-- --adiados]
npm run art:prompt [-- lote]
npm run art:process -- [lote] imagem.png
npm run art:review [-- lote]
npm run art:approve -- lote --todos | --ids a,b --rejeitar c
npm run art:integrate -- lote --confirmar   # só com autorização
npm run art:status | art:reopen | art:ajuda
```
Retomada: ler `docs/progresso.md` → `npm test` → executar o passo 7.

## 9. Restrições (inegociáveis)
- Nenhuma API paga, serviço com custo, nem automação da interface do Gemini; sem chaves de serviço armazenadas. A geração de imagem é manual pelo usuário.
- Claude **não gera imagens** por conta própria.
- Preservar todas as funcionalidades, regras, banco e dados; fallback visual sempre funcional; testes verdes.
- **Não integrar arte, publicar ou fazer merge sem autorização explícita.** Não substituir assets atuais sem aprovação.
- Não alterar migrações executadas sem plano prévio; não mexer em regras sem a fonte.
- Repositório público: nunca commitar dados reais da criança, backups, senhas, tokens ou `service_role`. Só URL e chave `anon`/publishable no front-end.
- Pronomes: usar "o usuário"/"a Bianca" conforme o projeto; textos em pt-BR; dados de exemplo fictícios.
- Commits terminam com as linhas de atribuição indicadas pela sessão; PR só se o usuário pedir.
