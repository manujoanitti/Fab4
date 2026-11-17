# Publicação no GitHub Pages (custo R$ 0)

Pré-requisito: repositório **público** no GitHub (o código não contém dados reais, senhas nem `service_role`).

1. *Settings › Pages › Build and deployment › Source*: **GitHub Actions**.
2. *Settings › Secrets and variables › Actions › Variables*: crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (valores públicos; ver `configuracao-supabase.md`).
   Sem elas o site publica normalmente, mas somente com o modo demonstração.
3. Faça *merge/push* na branch `main`: o workflow `Deploy GitHub Pages` roda os testes, compila com `VITE_BASE=/<nome-do-repo>/` e publica.
   Endereço: `https://<usuario>.github.io/<nome-do-repo>/`.
4. O workflow `CI` roda em todo push/PR: typecheck, testes de unidade/banco e e2e (Playwright).

## Instalação no Android
1. Abra o endereço no **Chrome**. 2. Menu ⋮ › **Instalar app** (ou "Adicionar à tela inicial"). 3. O ícone "Reino" aparece como app.
Funciona offline após o primeiro acesso: o mapa, as metas e o Caça às Estrelas abrem sem internet; alterações ficam em fila e sincronizam ao reconectar.

## Desenvolvimento local
```
npm install
npm run dev            # http://localhost:5173/?demo  (demonstração, sem Supabase)
npm test               # unidade + banco (PGlite)
npm run test:e2e       # compila, sobe o preview e roda o Playwright
npm run build          # produção (dist/); use VITE_BASE=/<repo>/ para Pages
npm run icons          # regenera os PNG do PWA a partir de public/icons/icon.svg
```
