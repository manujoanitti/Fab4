import { defineConfig, devices } from '@playwright/test';

// Chave FALSA, apenas para o build de teste da nuvem (o servidor Supabase é simulado em tests/e2e/cloud.spec.ts).
const CLOUD_ENV = 'export VITE_BASE=/Fab4/ VITE_SUPABASE_URL=https://fake-project.supabase.co VITE_SUPABASE_ANON_KEY=sb_publishable_TESTE_E2E_0123456789;';

// Build com o PACOTE GRÁFICO SINTÉTICO (tests/fixtures/art) servido em /Fab4/, para testar a camada de arte externa.
const ART_ENV = 'export ART_FIXTURE=1 ART_OUT_DIR=dist-art VITE_BASE=/Fab4/;';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'off', launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } },
  webServer: [
    { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180_000 },
    // Build "com nuvem" servido no subdiretório /Fab4/ (como no GitHub Pages).
    { command: `${CLOUD_ENV} npx vite build --outDir dist-cloud && npx vite preview --outDir dist-cloud --port 4174 --strictPort`, url: 'http://localhost:4174/Fab4/', reuseExistingServer: true, timeout: 180_000 },
    { command: `${ART_ENV} npx vite build --outDir dist-art && npx vite preview --outDir dist-art --port 4175 --strictPort`, url: 'http://localhost:4175/Fab4/', reuseExistingServer: true, timeout: 180_000 },
  ],
  projects: [
    { name: 'mobile', testIgnore: /(cloud|art)\.spec/, use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'tablet', testIgnore: /(cloud|art)\.spec/, use: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, browserName: 'chromium' }, grep: /responsivo/ },
    { name: 'art', testMatch: /art\.spec/, use: { ...devices['Pixel 7'], browserName: 'chromium', baseURL: 'http://localhost:4175/Fab4/' } },
    { name: 'cloud', testMatch: /cloud\.spec/, use: { ...devices['Pixel 7'], browserName: 'chromium', baseURL: 'http://localhost:4174/Fab4/', serviceWorkers: 'block' } },
  ],
});
