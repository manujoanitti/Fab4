import { expect, test, type Page } from '@playwright/test';

const external: string[] = [];
test.beforeEach(async ({ page }) => {
  external.length = 0;
  // Qualquer requisição fora do próprio servidor local é registrada (demo não pode falar com a nuvem).
  page.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
});

const openDemo = async (page: Page) => {
  await page.goto('/?demo');
  await expect(page.getByTestId('demo-tag')).toBeVisible();
  await expect(page.getByTestId('map')).toBeVisible();
};
const guardian = async (page: Page) => { await page.getByTestId('mode-toggle').click(); await expect(page.locator('.app')).toHaveAttribute('data-mode', 'guardian'); };
const child = async (page: Page) => { await page.getByTestId('mode-toggle').click(); await expect(page.locator('.app')).toHaveAttribute('data-mode', 'child'); };
const stat = (page: Page, k: string) => page.getByTestId(`stat-${k}`);
const closeBanner = async (page: Page) => { const b = page.getByTestId('celebration'); if (await b.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Que maravilha!' }).click(); };

test('início: nuvem não configurada desabilita login e oferece demonstração', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('landing')).toBeVisible();
  await expect(page.getByTestId('start-login')).toBeDisabled();
  await page.getByTestId('start-demo').click();
  await expect(page.getByTestId('demo-tag')).toBeVisible();
  expect(external).toEqual([]);
});

test('mapa: 5 regiões, 25 casas, progresso inicial da demonstração', async ({ page }) => {
  await openDemo(page);
  for (let s = 1; s <= 5; s++) await expect(page.getByTestId(`region-${s}`)).toBeAttached();
  await expect(page.locator('[data-testid^="phase-"]')).toHaveCount(25);
  await expect(page.getByTestId('phase-1')).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('phase-2')).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('phase-3')).toHaveAttribute('data-state', 'next');
  await expect(page.getByTestId('phase-9')).toHaveAttribute('data-state', 'locked');
  await expect(page.getByTestId('region-1')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('region-2')).toHaveAttribute('data-unlocked', 'false');
  await expect(stat(page, 'small')).toHaveText('2');
  await expect(stat(page, 'daily')).toHaveText('3');
  await expect(stat(page, 'credits')).toHaveText('3');
  await page.getByTestId('phase-3').dispatchEvent('click');
  await expect(page.getByTestId('sheet')).toContainText('próxima fase');
  await page.screenshot({ path: 'test-results/mapa.png' });
});

test('modo infantil não oferece ações do responsável', async ({ page }) => {
  await openDemo(page);
  await page.getByTestId('phase-3').dispatchEvent('click');
  await expect(page.getByTestId('complete-phase')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.getByTestId('tab-review')).toHaveCount(0);
  await page.getByTestId('tab-goals').click();
  await expect(page.getByTestId('goals-child')).toContainText('Não bater em ninguém');
  await expect(page.locator('[data-testid^="child-goal-g"]')).toHaveCount(8);
  await page.screenshot({ path: 'test-results/metas-crianca.png' });
});

test('responsável: avalia metas, concede selo do dia (+1 crédito) sem duplicar', async ({ page }) => {
  await openDemo(page);
  await guardian(page);
  await page.getByTestId('tab-review').click();
  await expect(page.getByTestId('medal-grant')).toBeDisabled();
  await page.getByTestId('goal-g1-not_evaluated').click();
  await expect(page.getByTestId('goal-g1')).toHaveAttribute('data-status', 'not_evaluated');
  for (const g of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8']) await page.getByTestId(`goal-${g}-done`).click();
  await expect(page.getByTestId('day-summary')).toContainText('8 de 8');
  await expect(page.getByTestId('medal-grant')).toBeEnabled();
  await page.getByTestId('medal-grant').click();
  await page.getByTestId('medal-confirm').click();
  await expect(page.getByTestId('medal-granted')).toBeVisible();
  await page.screenshot({ path: 'test-results/revisao.png' });
  await page.getByTestId('tab-credits').click();
  await expect(page.getByTestId('credit-balance')).toHaveText('4 🎮');
  await expect(page.getByTestId('credit-log')).toContainText('Selo do dia confirmado');
  // histórico de correção
  await page.getByTestId('tab-review').click();
  await page.getByTestId('goal-g1-not_done').click();
  await expect(page.locator('details summary')).toContainText('Histórico de alterações');
  await page.getByTestId('tab-credits').click();
  await expect(page.getByTestId('credit-balance')).toHaveText('4 🎮'); // corrigir meta não mexe no crédito
});

test('ajuste de créditos exige motivo e registra no histórico', async ({ page }) => {
  await openDemo(page);
  await guardian(page);
  await page.getByTestId('tab-credits').click();
  await page.getByTestId('adjust-submit').click();
  await expect(page.locator('.toast.error')).toBeVisible();
  await page.getByTestId('adjust-reason').fill('Bônus de teste');
  await page.getByTestId('adjust-amount').fill('2');
  await page.getByTestId('adjust-submit').click();
  await expect(page.getByTestId('credit-balance')).toHaveText('5 🎮');
  await expect(page.getByTestId('credit-log')).toContainText('Bônus de teste');
});

test('avanço de fase e etapa: selos, moedas, recompensa e desbloqueios', async ({ page }) => {
  await openDemo(page);
  await guardian(page);
  await page.getByTestId('tab-map').click();
  await page.getByTestId('phase-3').dispatchEvent('click');
  await page.getByTestId('complete-phase').click();
  await page.getByTestId('confirm-phase').click();
  await expect(page.getByTestId('phase-3')).toHaveAttribute('data-state', 'done');
  await expect(stat(page, 'small')).toHaveText('3');
  await expect(page.getByTestId('bianca')).toHaveAttribute('data-at', '3', { timeout: 5000 });
  // concluir a etapa 1 (fases 4 e 5): +1 moeda, +1 selo grande
  await page.getByTestId('tab-more').click();
  await page.getByTestId('demo-stage').click();
  await expect(stat(page, 'coins')).toHaveText('1');
  await expect(stat(page, 'big')).toHaveText('1');
  await expect(page.getByTestId('celebration')).toBeVisible();
  await closeBanner(page);
  // recompensa da etapa: escolher e registrar como recebida
  await page.getByTestId('tab-prizes').click();
  const card = page.locator('[data-testid^="reward-reward:stage:1"]').first();
  await expect(card).toContainText('pequena');
  await card.getByLabel('assistir mais 1 desenho').check();
  await card.getByRole('button', { name: 'Registrar como recebida' }).click();
  await expect(page.getByTestId('reward-done-reward:stage:1')).toContainText('assistir mais 1 desenho');
  await page.screenshot({ path: 'test-results/premios.png' });
});

test('campanha completa: 25 fases, 15 moedas, 10 selos grandes (bônus final) e jogos liberados', async ({ page }) => {
  await openDemo(page);
  await guardian(page);
  await page.getByTestId('tab-more').click();
  await page.getByTestId('demo-all').click();
  await expect(stat(page, 'small')).toHaveText('25', { timeout: 20_000 });
  await expect(stat(page, 'coins')).toHaveText('15');
  await expect(stat(page, 'big')).toHaveText('10');
  await closeBanner(page);
  await page.getByTestId('tab-map').click();
  for (const p of [1, 13, 25]) await expect(page.getByTestId(`phase-${p}`)).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('bianca')).toHaveAttribute('data-at', '26', { timeout: 20_000 });
  await page.screenshot({ path: 'test-results/mapa-final.png' });
  await child(page);
  await page.getByTestId('tab-games').click();
  for (const g of ['stars', 'crystals', 'garden']) await expect(page.getByTestId(`game-card-${g}`)).toHaveAttribute('data-unlocked', 'true');
});

test('Caça às Estrelas consome 1 crédito e funciona', async ({ page }) => {
  await openDemo(page);
  await page.getByTestId('tab-games').click();
  await expect(page.getByTestId('game-card-garden')).toHaveAttribute('data-unlocked', 'false');
  await expect(page.getByTestId('play-garden')).toBeDisabled();
  await page.getByTestId('play-stars').click();
  await expect(page.getByTestId('game-stars')).toBeVisible();
  const star = page.getByTestId('star').first();
  await star.waitFor();
  await star.dispatchEvent('pointerdown');
  await expect(page.getByTestId('stars-score')).toHaveText('1');
  await page.screenshot({ path: 'test-results/estrelas.png' });
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByTestId('games-credits')).toContainText('2');
  await expect(stat(page, 'daily')).toHaveText('3'); // jogo não concede selo
});

test('Memória dos Cristais: desbloqueia após a etapa 2; pares e níveis progressivos', async ({ page }) => {
  await openDemo(page);
  await page.getByTestId('tab-games').click();
  await expect(page.getByTestId('game-card-crystals')).toHaveAttribute('data-unlocked', 'false');
  await expect(page.getByTestId('play-crystals')).toBeDisabled();
  await guardian(page);
  await page.getByTestId('tab-more').click();
  await page.getByTestId('demo-stage').click(); // conclui a etapa 1
  await expect(stat(page, 'coins')).toHaveText('1');
  await closeBanner(page);
  await page.getByTestId('demo-stage').click(); // conclui a etapa 2
  await expect(stat(page, 'coins')).toHaveText('3');
  await closeBanner(page);
  await child(page);
  await page.getByTestId('tab-games').click();
  await expect(page.getByTestId('game-card-crystals')).toHaveAttribute('data-unlocked', 'true');
  await expect(page.getByTestId('game-card-garden')).toHaveAttribute('data-unlocked', 'false');
  await page.getByTestId('play-crystals').click();
  await expect(page.getByTestId('game-crystals')).toBeVisible();
  for (const expectedCards of [6, 8]) {
    await expect(page.getByTestId('mcard')).toHaveCount(expectedCards);
    const symbols = await page.getByTestId('mcard').evaluateAll((els) => els.map((e) => e.getAttribute('data-symbol')));
    const used = new Set<number>();
    for (let i = 0; i < symbols.length; i++) {
      if (used.has(i)) continue;
      const j = symbols.findIndex((s, k) => k > i && s === symbols[i] && !used.has(k));
      used.add(i); used.add(j);
      await page.getByTestId('mcard').nth(i).click();
      await page.getByTestId('mcard').nth(j).click();
    }
    await expect(page.getByTestId('memory-won')).toBeVisible();
    if (expectedCards === 6) { await page.screenshot({ path: 'test-results/memoria.png' }); await page.getByTestId('memory-next').click(); }
  }
});
