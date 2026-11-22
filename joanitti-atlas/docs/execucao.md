# Execução

## Requisitos
Node.js **≥ 22.13** (usa `node:sqlite`). Nenhum serviço externo, nenhuma chave de API.

## Desenvolvimento
```bash
npm install
npm run dev          # API :3001 + Vite :5173 (proxy /api). Token: dev-admin-token
```
## Dados reais (locais, fora do git)
Coloque em `data/real/`: `relatorio-gemini-2026-11-22.md` (texto original) e `extracao/` (pacote). Depois:
```bash
npm run seed              # importa/atualiza (idempotente) → data/real/atlas.sqlite, relatorio-importacao.md, relatorio-inconsistencias-e-lacunas.md
npm run seed -- --dry     # só mostra o plano
npm run seed -- --reset   # recria o banco do zero
npm run extraction:json   # exporta o pacote como JSON (para reimportar pela interface)
```
## Produção (um único processo serve API + app)
```bash
npm run build
ATLAS_ADMIN_TOKEN='um-token-longo-e-aleatorio' PORT=3001 HOST=0.0.0.0 npm start
```
Variáveis: ver `.env.example` (`ATLAS_ADMIN_TOKEN`, `ATLAS_PUBLIC_READ`, `ATLAS_DB`, `ATLAS_BACKUP_DIR`, `PORT`, `HOST`). Coloque atrás de HTTPS. Faça backup: Administração → Exportar e backup (JSON lossless, cópia SQLite) — a restauração cria antes uma cópia de segurança do banco atual.

## Testes
```bash
npm run typecheck
npm test                 # Vitest; tests/real-data.test.ts roda só se data/real existir
npm run build && npm run e2e
```
O e2e (`scripts/e2e-smoke.ts`) sobe o servidor sobre uma **cópia temporária** do banco real, percorre todas as telas no Chromium (visão pública e administrador, desktop e celular), confere que nomes de vivos não aparecem na visão pública, cadastra pessoa, tenta criar filiação circular e grava capturas em `shots/`. Neste ambiente: `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run e2e`.

## Solução de problemas
* *“ExperimentalWarning: SQLite”* — esperado no Node 22 (`node:sqlite`).
* Mapa sem fundo — os *tiles* do OpenStreetMap precisam de internet; marcadores e painéis funcionam sem ela.
* “Token inválido” — confira `ATLAS_ADMIN_TOKEN` do servidor; o token fica só na aba (sessionStorage).
* Importação recusada por “citações não encontradas” — o pacote cita um trecho que não existe no texto do relatório; corrija o trecho (ou o relatório correto não foi carregado).
