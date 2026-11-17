import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const openDemo = async (page: Page) => {
  await page.goto('/?demo');
  await expect(page.getByTestId('map')).toBeVisible();
};
const guardian = async (page: Page) => { await page.getByTestId('mode-toggle').click(); await expect(page.locator('.app')).toHaveAttribute('data-mode', 'guardian'); };

test('Jardim Encantado: decorar, salvar no perfil e persistir após recarregar', async ({ page }) => {
  await openDemo(page);
  await guardian(page);
  await page.getByTestId('tab-more').click();
  await page.getByTestId('demo-all').click();
  await expect(page.getByTestId('stat-small')).toHaveText('25', { timeout: 20_000 });
  if (await page.getByTestId('celebration').isVisible().catch(() => false)) await page.getByRole('button', { name: 'Que maravilha!' }).click();
  await page.getByTestId('mode-toggle').click();
  await page.getByTestId('tab-games').click();
  await page.getByTestId('play-garden').click();
  await expect(page.getByTestId('game-garden')).toBeVisible();
  await page.getByTestId('palette-item').first().click();
  const field = page.getByTestId('garden-field');
  const box = (await field.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.7);
  await expect(page.getByTestId('garden-item')).toHaveCount(2);
  await page.getByTestId('garden-item').first().click();
  await page.getByTestId('garden-remove').click();
  await expect(page.getByTestId('garden-item')).toHaveCount(1);
  await page.waitForTimeout(1500); // salvamento automático
  await page.screenshot({ path: 'test-results/jardim.png' });
  await page.reload();
  await expect(page.getByTestId('map')).toBeVisible();
  await page.getByTestId('tab-games').click();
  await expect(page.getByTestId('garden-item')).toHaveCount(1); // decoração salva no perfil
});

test('PWA: manifesto, ícones e service worker', async ({ page, request }) => {
  await openDemo(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest).toMatchObject({ name: 'Reino da Bianca', display: 'standalone', lang: 'pt-BR' });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, page.url()).toString())).ok()).toBe(true);
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, active: !!r.active }; });
  expect(reg.active).toBe(true);
});

test('offline: app abre sem rede e mantém os dados locais', async ({ page, context }) => {
  await openDemo(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // garante que o SW controla a página
  await expect(page.getByTestId('map')).toBeVisible();
  await guardian(page);
  await page.getByTestId('tab-more').click();
  await page.getByTestId('demo-phase').click();
  await expect(page.getByTestId('stat-small')).toHaveText('3');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('map')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('stat-small')).toHaveText('3');
  await expect(page.getByTestId('phase-3')).toHaveAttribute('data-state', 'done');
  // jogo funciona offline
  await page.getByTestId('tab-games').click();
  await page.getByTestId('play-stars').click();
  await expect(page.getByTestId('game-stars')).toBeVisible();
  await context.setOffline(false);
});

test('responsivo: sem rolagem horizontal e alvos de toque grandes', async ({ page }) => {
  await openDemo(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(1);
  for (const tab of ['goals', 'achv', 'games', 'map']) {
    await page.getByTestId(`tab-${tab}`).click();
    expect(await overflow(), tab).toBeLessThanOrEqual(1);
  }
  const heights = await page.locator('.tabbar button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(48);
  await guardian(page);
  for (const tab of ['review', 'prizes', 'credits', 'history', 'more']) {
    await page.getByTestId(`tab-${tab}`).click();
    expect(await overflow(), tab).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: `test-results/responsivo-${test.info().project.name}.png` });
});

test('backup: exporta, valida formato e restaura com confirmação sem duplicar', async ({ page }) => {
  await openDemo(page);
  await guardian(page);
  await page.getByTestId('tab-more').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()]);
  const path = await dl.path();
  const json = JSON.parse(readFileSync(path!, 'utf8'));
  expect(json).toMatchObject({ format: 'reino-bianca-backup', schemaVersion: 1, demo: true });
  // formato inválido
  await page.getByTestId('import-file').setInputFiles({ name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
  await expect(page.getByTestId('backup-errors')).toContainText('Formato desconhecido');
  // arquivo válido: pede confirmação e não duplica
  await page.getByTestId('import-file').setInputFiles(path!);
  await expect(page.getByTestId('restore-confirm')).toBeVisible();
  await page.getByTestId('restore-go').click();
  await expect(page.getByTestId('restore-report')).toContainText('medals: 0');
  await expect(page.getByTestId('stat-small')).toHaveText('2');
});

test('PIN protege a troca para o modo responsável neste aparelho', async ({ page }) => {
  await openDemo(page);
  await guardian(page);
  await page.getByTestId('tab-more').click();
  await page.getByLabel('Novo PIN').fill('1234');
  await page.getByRole('button', { name: 'Definir PIN' }).click();
  await page.getByTestId('mode-toggle').click(); // volta ao modo infantil
  await page.getByTestId('mode-toggle').click();
  await page.getByTestId('pin-input').fill('0000');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('PIN incorreto.')).toBeVisible();
  await page.getByTestId('pin-input').fill('1234');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-mode', 'guardian');
});
