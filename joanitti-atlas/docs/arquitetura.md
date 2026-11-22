# Arquitetura e decisões

```
┌──────────────── navegador ────────────────┐        ┌────────────── servidor (Node ≥ 22.13) ─────────────┐
│ React + TS + Tailwind  (src/)             │  JSON  │ Fastify (server/app.ts)                             │
│  • React Flow + ELK (Web Worker)          │◄──────►│  • auth Bearer · redação de vivos (snapshot.ts)      │
│  • Leaflet + OpenStreetMap                │ /api/* │  • repo genérico + change_log (repo.ts)              │
│  • busca fuzzy, síntese biográfica        │        │  • importador idempotente (import/)                  │
│  shared/: datas, nomes, integridade, grafo│        │  • exportações GEDCOM/CSV/JSON (export/)             │
└───────────────────────────────────────────┘        │ Db (connection.ts) ── SQLite (node:sqlite) + migrações│
                                                      └───────────────────────────────────────────────────────┘
```
`shared/` é TypeScript puro usado dos dois lados (e nos testes): o servidor valida com as mesmas regras que a interface usa para desenhar.

## Escolhas e justificativas
| Tema | Escolha | Por quê |
|---|---|---|
| UI | React 19 + TypeScript + Vite + Tailwind v4 | Pedido no briefing; tokens de tema em CSS (claro/escuro/auto). |
| Grafo | `@xyflow/react` + `elkjs` | Nós customizados (pessoa, união, agrupamento, hipótese), zoom/arraste, mini-mapa. ELK (layered) posiciona automaticamente e roda em **Web Worker** no navegador. Agrupamentos são posicionados por grade própria e tratados como caixas pelo ELK. |
| Mapa | Leaflet + OSM | Gratuito e sem chave. Os *tiles* exigem internet; os marcadores não. |
| Linha do tempo | Implementação própria | Bibliotecas prontas não modelam datas aproximadas/intervalos/sem data nem contexto histórico em faixas. |
| Banco | SQLite via `node:sqlite` (embutido no Node) | Zero compilação nativa, arquivo único, WAL. *Experimental* no Node 22 (emite aviso). |
| API | Fastify + Zod | Leve, tipada; Zod valida o pacote de importação. |
| Busca | Própria (`shared/names.ts`) | Chave fonética para grafias ítalo-brasileiras (Giovannitti ≈ Giovanitti ≈ Joanitti ≈ Joanite) + distância de edição; sem serviço externo. |
| GEDCOM / CSV | Próprios | Exportam só o que o formato comporta; o resto vai no JSON lossless. |
| Armazenamento no navegador | Nenhum dado de domínio | Só `sessionStorage` (token) e `localStorage` (tema). **Não** se usa localStorage como banco. |

## Camada de acesso e migração para PostgreSQL/Supabase
Todo SQL passa pela interface `Db` (`all/get/run/exec/tx`). Para migrar: (1) escrever um adaptador `pg` (`?` → `$n`); (2) portar `server/db/migrations/*.sql` (tipos `TEXT`→`text/jsonb/timestamptz`, `INTEGER` booleanos → `boolean`, `AUTOINCREMENT` → `identity`, `strftime` → `now()`); (3) mover a redação de privacidade para *row-level security* se o acesso passar a ser direto (Supabase). Ids são `TEXT` estáveis (slugs), o que torna o carregamento de dados portátil. A rota `GET /api/admin/export/backup.json` + `POST /api/admin/restore` é independente de SGBD.

## Autenticação e privacidade
* Leitura **pública** (padrão) devolve um *snapshot redigido*; `ATLAS_PUBLIC_READ=0` exige token até para ler.
* Edição/importação/exportação completa: `Authorization: Bearer <ATLAS_ADMIN_TOKEN>` (comparação em tempo constante; 8 falhas/min por IP → 429). Em produção o servidor **recusa iniciar** sem token ≥ 16 caracteres.
* **Pessoas vivas** (`vivo`, `possivelmente_vivo`, ou `desconhecido` sem nascimento anterior a 110 anos): na visão pública perdem nome, datas, locais, biografia, notas, ocupações, ids externos; eventos e fontes ligados a elas somem; afirmações/investigações que as envolvem são mascaradas; e uma varredura final troca por “pessoa viva” qualquer ocorrência dos nomes completos delas em textos livres (defesa em profundidade, coberta por teste). Busca, GEDCOM, CSV e JSON públicos usam o mesmo snapshot redigido.
* Publicando na internet: use HTTPS (proxy reverso), `ATLAS_HOST`/`HOST` adequado e um token forte. O token único não distingue usuários; para múltiplos editores, migrar para autenticação real (ex.: Supabase Auth) é o passo natural.

## API (resumo)
Públicas: `GET /api/snapshot`, `/api/search?q=&nucleus=&status=&from=&to=`, `/api/export/{gedcom,csv/:tabela,snapshot.json}`, `/api/auth/check`, `/api/health`.
Administrativas (`/api/admin/…`): `POST|PATCH|DELETE :type[/:id]` (arquiva), `POST :type/:id/restore`, `POST|DELETE link/:tabela`, `POST status/:type/:id`, `POST investigation/:id/{log,conclude}`, `POST review/:id`, `POST import` (`dry_run`|`apply`), `GET integrity|changelog|archived|import-runs|reports/:id|inconsistencias.md|export/backup.json|export/sqlite`, `POST restore`.

## Limites de escala (medidos)
* `buildGraph` (pura): ~10 ms para 2.186 pessoas.
* Layout ELK em Node: 242 pessoas ≈ 0,9 s · 728 ≈ 4,6 s · 2.186 ≈ 50 s (cresce de forma superlinear). Por isso a interface **recolhe automaticamente gerações** quando a árvore passa de 500 pessoas (mensagem na tela; “＋” expande por ramo; “Expandir tudo” pede confirmação) e o ELK roda em worker. Com foco por pessoa e 3 gerações o posicionamento é instantâneo.
* O snapshot carrega o acervo inteiro em memória (adequado a milhares de pessoas; acima de ~20 mil, paginar/filtrar no servidor).
