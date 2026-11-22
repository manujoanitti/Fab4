# Joanitti Atlas — guia para continuidade

App web (React + TS + Vite + Tailwind, API Fastify, SQLite embutido) para organizar a pesquisa genealógica da família Joanitti **com base em evidências**.
Vive em `joanitti-atlas/` dentro do repositório (o app "Reino da Bianca" da raiz é outro projeto e não é tocado).

## Regras que não podem ser quebradas
- **Repositório público**: dados reais (relatório, pacote de extração, banco, backups) ficam em `data/real/` (ignorado pelo git). Nunca commitar nomes de pessoas vivas, matrículas, CNPJ, tokens. Fixtures/testes usam a família fictícia Rossi.
- **Nunca inventar parentesco.** Coocorrência em índice → `research_group` (agrupamento), não filiação/casamento. Hipótese → nó de hipótese/`claim`, nunca relação "documentada". Relação descartada não é desenhada.
- **Estado de verificação (5 níveis) é decisão do pesquisador**, independente do número de fontes e do rótulo do relatório (`reported_status` guarda o original).
- **Homônimos não se fundem**: usar `identity_link` (hipótese de identidade).
- Visão pública redige pessoas vivas (`server/snapshot.ts`: `isPrivatePerson` + `redact` + varredura de nomes). Toda rota nova de leitura deve passar pelo snapshot/redação.
- Nada é apagado: `archived_at` (reversível) e `change_log`.
- Importador idempotente (`server/import`), fusão em 3 vias, citações conferidas contra o texto original.

## Comandos
```
npm install
npm run dev          # API :3001 + Vite :5173 (token dev: dev-admin-token)
npm run seed         # importa data/real (idempotente; --reset recria; --dry só mostra o plano)
npm test             # Vitest (unidade, importador, API/privacidade/exportações; + dados reais se existirem)
npm run typecheck && npm run build
npm run e2e          # Chromium sobre CÓPIA temporária do banco real (CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome neste ambiente)
npm start            # produção: exige ATLAS_ADMIN_TOKEN ≥ 16 caracteres e `npm run build`
```
Mudou o esquema? Crie `server/db/migrations/000N_*.sql` (nunca edite migrações já aplicadas em bancos reais).

## Mapa do código
`shared/` domínio puro (datas, nomes/busca fuzzy, integridade, grafo, layout ELK) · `server/` API, repo genérico, snapshot/privacidade, importador, exportações (GEDCOM/CSV/JSON) · `src/` interface · `data/real/extracao/` pacote real (local) · `docs/` arquitetura, modelo, metodologia, execução, limitações.
