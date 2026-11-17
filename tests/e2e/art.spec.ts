import { expect, test, type Page } from '@playwright/test';

// Pacote gráfico SINTÉTICO (tests/fixtures/art) ativo; app publicado no subdiretório /Fab4/ como no GitHub Pages.
const open = async (page: Page, q = '?demo') => {
  await page.goto(`./${q}`);
  await expect(page.getByTestId('map')).toBeVisible();
};
const artRequests: string[] = [];
test.beforeEach(({ page }) => {
  artRequests.length = 0;
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.includes('/art/')) artRequests.push(u.pathname); });
});

test('carrega a arte do pacote com o caminho-base /Fab4/ (compatível com o GitHub Pages)', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('data-art-pack', 'test');
  const bg = page.locator('[data-art="map.region.1.bg"]');
  await expect(bg).toBeAttached();
  expect((await bg.getAttribute('href'))!.replace(/\?v=[0-9a-f]+$/, '')).toBe('/Fab4/art/test/map/region-1-bg@2x.png'); // ?v= = hash de public/art (invalida cache)
  await expect(page.locator('[data-art="map.region.1.path"]')).toBeAttached();
  expect(artRequests.length).toBeGreaterThan(3);
  expect(artRequests.every((p) => p.startsWith('/Fab4/art/test/'))).toBe(true);
  await page.screenshot({ path: 'test-results/arte-fixture.png' });
});

test('estados e eventos do mapa preservados com arte (casas, seleção, teclado, aria)', async ({ page }) => {
  await open(page);
  const n = (p: number) => page.getByTestId(`phase-${p}`);
  await expect(n(1)).toHaveAttribute('data-state', 'done');
  await expect(n(3)).toHaveAttribute('data-state', 'next');
  await expect(n(9)).toHaveAttribute('data-state', 'locked');
  await expect(n(1).locator('[data-art="map.node.done"]')).toBeAttached();
  await expect(n(3).locator('[data-art="map.node.available"]')).toBeAttached();
  await expect(n(9).locator('[data-art="map.node.locked"]')).toBeAttached();
  await expect(n(3)).toHaveAttribute('aria-label', 'Fase 1.3, próxima fase');
  await expect(n(3)).toHaveAttribute('role', 'button');
  await expect(n(3).locator('.node-label')).toHaveText('1.3'); // o número continua sendo texto do app
  await n(3).dispatchEvent('click'); // clique
  await expect(page.getByTestId('sheet')).toContainText('próxima fase');
  await expect(n(3)).toHaveAttribute('data-selected', 'true');
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(n(3)).not.toHaveAttribute('data-selected', 'true');
  await n(4).focus();
  await page.keyboard.press('Enter'); // teclado
  await expect(page.getByTestId('sheet')).toBeVisible();
  await expect(page.getByTestId('bianca')).toHaveAttribute('data-at', '2');
});

test('avançar de fase troca a arte do marco (disponível → concluído) sem perder funcionalidades', async ({ page }) => {
  await open(page);
  await page.getByTestId('mode-toggle').click();
  await page.getByTestId('tab-map').click();
  await page.getByTestId('phase-3').dispatchEvent('click');
  await page.getByTestId('complete-phase').click();
  await page.getByTestId('confirm-phase').click();
  await expect(page.getByTestId('phase-3')).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('phase-3').locator('[data-art="map.node.done"]')).toBeAttached();
  await expect(page.getByTestId('stat-small')).toHaveText('3');
});

test('ícones por ID e fallback: arquivo ausente/sem arte mantém o emoji atual, sem imagem quebrada', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-testid="stats"] img[data-art="ui.icon.stamp-small"]')).toBeAttached();
  await expect(page.locator('[data-testid="tab-map"] img[data-art="ui.tab.map"]')).toBeAttached();
  // sem arte no pacote: continua o emoji
  await expect(page.getByTestId('stats')).toContainText('🪙');
  await expect(page.locator('[data-testid="tab-goals"]')).toContainText('📝');
  // registrado, mas arquivo inexistente (404): fica o emoji e nenhuma <img> quebrada
  await expect(page.getByTestId('sync-badge')).toContainText('☁️');
  await expect(page.locator('img[data-art="ui.sync.synced"]')).toHaveCount(0);
  await expect.poll(() => artRequests.some((p) => p.endsWith('/ui/sync-synced.svg'))).toBe(true); // tentou carregar (arquivo inexistente) e voltou ao fallback
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).length);
  expect(broken).toBe(0);
});

test('personagem em spritesheet: tira animada por CSS com os metadados do catálogo', async ({ page }) => {
  await open(page);
  const sprite = page.locator('[data-testid="bianca"] svg[data-art="char.bianca.idle"] image.art-sprite');
  await expect(sprite).toBeAttached();
  const css = await sprite.evaluate((el) => { const c = getComputedStyle(el); return { name: c.animationName, timing: c.animationTimingFunction, count: c.animationIterationCount, dur: c.animationDuration }; });
  expect(css).toEqual({ name: 'art-sprite-run', timing: 'steps(6)', count: 'infinite', dur: '0.75s' });
  await expect(page.getByTestId('bianca')).toHaveAttribute('data-at', '2');
});

test('layout do pacote: posição da casa 1 vem do manifesto; ?artpack=none restaura tudo', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('phase-1')).toHaveAttribute('transform', 'translate(100,2700)');
  await expect(page.getByTestId('phase-2')).toHaveAttribute('transform', 'translate(275,2666.25)'); // inalterada
  artRequests.length = 0;
  await open(page, '?demo&artpack=none');
  await expect(page.locator('html')).toHaveAttribute('data-art-pack', 'none');
  await expect(page.getByTestId('phase-1')).toHaveAttribute('transform', 'translate(110,2750)'); // posição original
  await expect(page.locator('[data-art]')).toHaveCount(0);
  expect(artRequests.filter((p) => p.includes('/art/test/'))).toEqual([]); // nenhum pedido de arte
});

test('troca de pacote (?artpack=alt): só os recursos do outro pacote aparecem', async ({ page }) => {
  await open(page, '?demo&artpack=alt');
  await expect(page.locator('html')).toHaveAttribute('data-art-pack', 'alt');
  await expect(page.locator('[data-testid="stats"] img[data-art="ui.icon.coin"]')).toBeAttached();
  await expect(page.locator('[data-art="map.region.1.bg"]')).toHaveCount(0);
  await expect(page.getByTestId('phase-1')).toHaveAttribute('transform', 'translate(110,2750)'); // alt não tem layout
});

test('offline: a arte já carregada continua disponível sem rede (cache do service worker)', async ({ page, context }) => {
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // o SW passa a controlar a página e a guardar a arte
  await expect(page.locator('[data-art="map.region.1.bg"]')).toBeAttached();
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('art-assets')).keys()).length), { timeout: 15_000 }).toBeGreaterThan(5);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('map')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-art="map.region.1.bg"]')).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('[data-testid="stats"] img[data-art="ui.icon.stamp-small"]')).toBeAttached();
  await expect(page.getByTestId('phase-1')).toHaveAttribute('transform', 'translate(100,2700)');
  await context.setOffline(false);
});
