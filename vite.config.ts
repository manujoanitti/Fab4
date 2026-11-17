import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Compatível com subdiretório do GitHub Pages: defina VITE_BASE=/<repo>/ (o workflow faz isso).
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
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
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        // Chamadas ao Supabase nunca são cacheadas pelo service worker (o cache de dados é o IndexedDB).
        navigateFallbackDenylist: [/^\/rest\//, /supabase\.co/],
      },
    }),
  ],
});
