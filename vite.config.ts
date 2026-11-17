import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

// Compatível com subdiretório do GitHub Pages: defina VITE_BASE=/<repo>/ (o workflow faz isso).
const base = process.env.VITE_BASE ?? '/';

/** Hash do conteúdo de public/art: vai na URL (?v=) para invalidar o cache quando um arquivo muda de conteúdo mantendo o nome. */
function artRev(): string {
  const root = resolve('public/art');
  if (!existsSync(root)) return '';
  const h = createHash('sha1');
  const walk = (dir: string) => {
    for (const f of readdirSync(dir).sort()) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(p.slice(root.length)).update(readFileSync(p));
    }
  };
  walk(root);
  return h.digest('hex').slice(0, 10);
}

/** Somente testes (ART_FIXTURE=1): usa o manifesto e o pacote de tests/fixtures/art no lugar dos reais. */
function artFixturePlugin(): Plugin | null {
  if (!process.env.ART_FIXTURE) return null;
  const fixture = resolve('tests/fixtures/art');
  return {
    name: 'art-fixture',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === './manifest.json' && importer?.replace(/\\/g, '/').endsWith('src/art/registry.ts')) return join(fixture, 'manifest.json');
      return null;
    },
    closeBundle() {
      cpSync(join(fixture, 'public'), resolve(process.env.ART_OUT_DIR ?? 'dist'), { recursive: true }); // → <outDir>/art/{test,alt}
    },
  };
}

export default defineConfig({
  base,
  define: { __ART_REV__: JSON.stringify(artRev()) },
  plugins: [
    react(),
    artFixturePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Reino da Bianca',
        short_name: 'Reino',
        description: 'A trilha encantada das metas da Bianca, em um jogo.',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fde7f1',
        theme_color: '#f8b8d4',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        // A arte externa NÃO entra no precache de instalação (manteria o app pesado): é guardada sob demanda e
        // pré-aquecida em segundo plano (ArtRuntime); fica disponível offline depois de carregada uma vez.
        globIgnores: ['art/**'],
        runtimeCaching: [
          {
            // RegExp literal (uma função aqui seria serializada para o service worker sem acesso a `base`).
            urlPattern: new RegExp(`${base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}art/`),
            handler: 'CacheFirst',
            options: { cacheName: 'art-assets', expiration: { maxEntries: 400, purgeOnQuotaError: true }, cacheableResponse: { statuses: [200] } },
          },
        ],
        navigateFallback: `${base}index.html`,
        // Chamadas ao Supabase nunca são cacheadas pelo service worker (o cache de dados é o IndexedDB).
        navigateFallbackDenylist: [/^\/rest\//, /supabase\.co/],
      },
    }),
  ],
});
