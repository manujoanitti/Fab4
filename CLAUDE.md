# Reino da Bianca — guia para continuidade

## Objetivo
App PWA que gamifica um **tabuleiro físico de metas pessoais** (5 etapas, 25 fases, 8 metas diárias, 2 metas especiais semanais, selos do dia,
selos pequenos/grandes, moedas, recompensas e bônus final). Fonte primária das regras: duas fotos do tabuleiro, transcritas em `docs/regras-originais.md`.
Custo adicional **R$ 0**: GitHub público + Pages + Supabase Free.

## Arquitetura (ver docs/arquitetura.md)
React + TS + Vite (PWA). Domínio puro em `src/domain` (engine = regras). `SyncManager` (cache IndexedDB + fila + conflitos) sobre um `Backend`:
`SupabaseBackend` (nuvem) ou `EngineBackend` (demo/testes). Banco: `supabase/migrations` (RLS + funções `SECURITY DEFINER`; `apply_op` espelha `engine.ts`).

## Regras essenciais (não alterar sem a fonte)
- Regras originais só em `src/domain/rules.ts` + `supabase/migrations/0002_rules.sql` (mantê-los iguais; `tests/db/schema.test.ts` confere).
- Parâmetros **operacionais** (não originais) ficam em `Settings` e em `docs/pendencias-regras.md`; nunca hardcode novas suposições sem documentar.
- Selo do dia (medalha): só por confirmação do responsável; único por data+campanha; rende 1 crédito **no servidor** (mesma transação).
- Fase: confirmada pelo responsável, em ordem; selos/moedas/recompensas por etapa vêm da tabela de regras. Entrega de recompensa é registro separado.
- Minigames (regra digital adicional): 1 crédito por sessão; não concedem selos/moedas nem alteram metas; desbloqueio: cristais após etapa 2, jardim após etapa 4.
- Meta "não avaliada" ≠ "não cumprida".
- Conflito nunca sobrescreve silenciosamente (versão otimista + reconciliação).

## Camada gráfica (arte externa)
- Telas pedem arte por **ID lógico** (`src/art/ids.ts` → `catalog.json`); nunca por caminho. Sem arte = visual atual (fallback). Contrato: `docs/arte/contrato-integracao.md`.
- Geometria do mapa (posições, toque, trilha) em `src/ui/mapGeometry.ts`; **não** mudar posições sem decisão explícita.
- Chaves persistidas dos minigames (emoji do Jardim) **não** mudam; a arte usa a tabela emoji → slug (`src/games/gardenCatalog.ts`).
- Golden de aparência: `tests/golden/*.html`. Mudança visual intencional → `UPDATE_GOLDEN=1 npx vitest run tests/unit/golden`.
- Integrar arte: arquivo em `public/art/<pacote>/…` → registrar em `src/art/manifest.json` → `npm run art:validate` → `npm run build`.

## Pipeline de produção gráfica (Gemini → app)
- Geração no Gemini é manual (sem API/custo); o resto é local: `npm run art:plan | art:prompt | art:process | art:review | art:approve | art:integrate` (ver `docs/arte/fluxo-producao-automatizado.md`).
- Código em `scripts/art/` (planejador, prompts, processador `sharp`, QA, revisão, cenários, integração); estado em `art-work/registro.json`.
- Validação técnica ≠ aprovação artística (sempre manual). Integrar ao app e publicar só com autorização do usuário; originais do Gemini ficam em `art-work/lotes/*/recebido/`.

## Comandos
```
npm install
npm run dev                 # http://localhost:5173/?demo
npm run typecheck
npm test                    # Vitest: unidade + banco (PGlite)
npm run test:e2e            # Playwright (compila e roda o preview). Neste ambiente: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
npm run build               # VITE_BASE=/<repo>/ para GitHub Pages
npm run icons               # regenera PNGs do PWA
npm run art:validate        # confere manifesto × catálogo × arquivos de public/art (roda no prebuild)
npm run art:docs            # regenera docs/arte/catalogo-recursos.md a partir de src/art/catalog.json
npm run art:guides          # regenera os guias de layout (docs/arte/guias)
node scripts/check-dist.mjs /Fab4/   # confere o build do Pages (base, manifesto, SW, sem chaves secretas)
```
Ao mudar SQL (`apply_op` etc.) ou `engine.ts`, rode `npm run test:db`: o teste de paridade deve continuar verde.

## Convenções
TypeScript estrito; sem dependências novas sem necessidade; UI mobile-first com `data-testid` estáveis (usados no e2e); textos em pt-BR;
dados de exemplo sempre fictícios; funções de domínio puras e testadas.

## Segurança
O build (`prebuild`) recusa `sb_secret_`/`service_role` em `VITE_SUPABASE_ANON_KEY`. Conta única da família: o banco não distingue aparelhos (ver `docs/configuracao-supabase.md` e `docs/plano-atualizacao-banco.md`).
Repositório **público**: nunca commitar dados reais da criança, backups (`*reino-backup*.json` é ignorado), senhas, tokens, `service_role`.
Só `VITE_SUPABASE_URL` e a chave `anon` no front-end. Todas as tabelas com RLS; escritas só por RPC; `anon` sem acesso.

## Continuidade
1. Ler `docs/progresso.md` (feito / pendente / problemas). 2. Rodar `npm test`. 3. Implementar o próximo item, testar, atualizar `progresso.md`, commitar.
