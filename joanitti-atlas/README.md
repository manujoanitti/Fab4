# Joanitti — Atlas Genealógico

Aplicação web para organizar, visualizar e expandir a investigação genealógica e histórica da família Joanitti (origem italiana, descendentes no Brasil) **com base em evidências**: árvore interativa, mapa histórico, linha do tempo, acervo de documentos, afirmações/hipóteses com estado de verificação e investigações abertas.

> **Princípio central:** o app nunca transforma hipótese em fato. Pessoas que apenas aparecem juntas num índice ficam em *agrupamentos investigativos*, sem arestas de pai/mãe/filho/cônjuge; hipóteses viram nós tracejados; relações descartadas não são desenhadas como parentesco.

## Telas
Visão Geral · Árvore Genealógica (React Flow + ELK) · Pessoas (+ perfil histórico, sobrenomes) · Mapa Histórico (Leaflet/OSM) · Linha do Tempo · Documentos · Investigações · Administração (edição validada, revisão, importação incremental, exportação/backup, integridade, histórico).

## Início rápido
```bash
cd joanitti-atlas
npm install                 # Node ≥ 22.13 (SQLite embutido: node:sqlite)
npm run dev                 # API http://localhost:3001  +  app http://localhost:5173
```
Token administrativo em desenvolvimento: `dev-admin-token` (use **“entrar como administrador”** no topo). Em produção defina `ATLAS_ADMIN_TOKEN` (≥ 16 caracteres) — veja [docs/execucao.md](docs/execucao.md).

### Dados reais × repositório público
Este repositório é **público** e o relatório traz dados de pessoas vivas. Por isso o relatório original, o pacote de extração e o banco ficam em `data/real/` (**ignorado pelo git**). Com esses arquivos presentes:

```bash
npm run seed                # importa o relatório (idempotente) → data/real/atlas.sqlite
npm run dev
```
Sem eles, o app abre vazio; para experimentar a importação use o **exemplo fictício** em `data/fixtures/` (Administração → Importar relatório).

## Verificação
```bash
npm run typecheck && npm test      # 76 testes (domínio, grafo/desempenho, importador, API/privacidade/exportações, dados reais se existirem)
npm run build && npm run e2e       # Chromium: percorre todas as telas e fluxos sobre uma cópia temporária do banco
```

## Documentação
| Documento | Conteúdo |
|---|---|
| [docs/arquitetura.md](docs/arquitetura.md) | Stack, decisões e justificativas, API, autenticação, privacidade, migração para PostgreSQL/Supabase, limites de escala |
| [docs/modelo-de-dados.md](docs/modelo-de-dados.md) | Entidades, estados de verificação, datas incertas, evidências, regras de integridade |
| [docs/metodologia-importacao.md](docs/metodologia-importacao.md) | Pacote de extração, conferência de citações, idempotência, fusão em 3 vias, critérios de classificação |
| [docs/execucao.md](docs/execucao.md) | Instalação, variáveis, produção, backup/restauração, testes, solução de problemas |
| [docs/limitacoes-e-lacunas.md](docs/limitacoes-e-lacunas.md) | O que foi/não foi implementado, limitações técnicas, inconsistências e lacunas do relatório |
