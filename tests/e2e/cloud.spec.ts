import { expect, test, type Page, type Route } from '@playwright/test';
import { EngineServer } from '../../src/sync/engineServer';

// Servidor Supabase SIMULADO (Auth + PostgREST/RPC) com uma única conta familiar.
// Usa o mesmo motor de regras das funções SQL (paridade verificada em tests/db/parity.test.ts).
const HOST = 'https://fake-project.supabase.co';
const PUBLISHABLE = 'sb_publishable_TESTE_E2E_0123456789';
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'familia@example.test', password: 'senha-de-teste-123' };

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const makeToken = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.assinatura-falsa`;

function makeMock() {
  const campaigns = new Map<string, { name: string; server: EngineServer }>();
  const seen: { path: string; apikey: string | null; auth: string | null }[] = [];
  const m = { campaigns, seen, down: false, rpcCalls: [] as string[], handle: async (_r: Route): Promise<void> => {} };
  const session = () => {
    const access_token = makeToken();
    return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-falso', user: { id: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } };
  };
  m.handle = async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const cors = { 'access-control-allow-origin': req.headers().origin ?? '*', 'access-control-allow-headers': req.headers()['access-control-request-headers'] ?? '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (m.down) return route.abort('failed');
    const json = (status: number, body: unknown) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const h = req.headers();
    if (url.pathname === '/auth/v1/token') {
      const body = JSON.parse(req.postData() ?? '{}');
      if (url.searchParams.get('grant_type') === 'password') {
        if (body.email !== USER.email || body.password !== USER.password) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      }
      return json(200, session());
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
    if (url.pathname === '/auth/v1/signup') return json(422, { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' });
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.split('/').pop()!;
      m.seen.push({ path: fn, apikey: h['apikey'] ?? null, auth: h['authorization'] ?? null });
      m.rpcCalls.push(fn);
      if (!h['authorization']?.startsWith('Bearer ey') || h['apikey'] !== PUBLISHABLE) return json(401, { message: 'JWT expired', code: 'PGRST301' });
      const args = JSON.parse(req.postData() || '{}');
      switch (fn) {
        case 'list_my_campaigns': return json(200, [...campaigns].map(([id, c]) => ({ id, name: c.name, role: 'guardian' })));
        case 'create_campaign': {
          const id = crypto.randomUUID();
          campaigns.set(id, { name: args.p_name, server: new EngineServer(undefined, id, args.p_name) });
          return json(200, id);
        }
        case 'get_snapshot': return json(200, campaigns.get(args.p_campaign)!.server.snapshot('guardian'));
        case 'apply_op': return json(200, campaigns.get(args.p_campaign)!.server.submit(args.p_op, { role: 'guardian', userId: USER.id }));
        default: return json(404, { message: `rpc ${fn} não simulada` });
      }
    }
    return json(404, { message: 'não simulado' });
  };
  return m;
}

async function setup(page: Page) {
  const mock = makeMock();
  await page.route(`${HOST}/**`, mock.handle);
  return mock;
}
const login = async (page: Page, password = USER.password) => {
  await page.getByLabel('E-mail').fill(USER.email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
};

test('nuvem com conta única: login, campanha familiar, metas, selo, offline e recarga', async ({ page }) => {
  const mock = await setup(page);
  await page.goto('./');
  // base /Fab4/: o app e seus ativos carregam no subdiretório
  expect(new URL(page.url()).pathname).toBe('/Fab4/');
  await expect(page.getByTestId('start-login')).toBeEnabled(); // build com URL+chave => nuvem configurada
  await page.getByTestId('start-login').click();

  // cadastro público desativado: sem botão "Criar conta"; credencial errada gera mensagem clara
  await expect(page.getByRole('button', { name: 'Criar conta' })).toHaveCount(0);
  await login(page, 'senha-errada');
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
  await login(page);

  // campanha familiar com UM usuário, sem convites
  await expect(page.getByTestId('campaigns')).toBeVisible();
  await page.getByLabel('Nome da campanha').fill('Reino da família');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.getByTestId('demo-tag')).toHaveCount(0); // não é demonstração
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-status', 'synced');
  const [camp] = [...mock.campaigns.values()];
  expect(camp.server.state.name).toBe('Reino da família');

  // o próprio usuário é responsável: modo responsável disponível; aviso de PIN para conta compartilhada
  await page.getByTestId('mode-toggle').click();
  await expect(page.getByTestId('pin-notice')).toBeVisible();
  await page.getByTestId('tab-review').click();
  for (const g of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8']) await page.getByTestId(`goal-${g}-done`).click();
  await page.getByTestId('medal-grant').click();
  await page.getByTestId('medal-confirm').click();
  await expect(page.getByTestId('medal-granted')).toBeVisible();
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-status', 'synced');
  // a verdade está no "servidor": 1 selo, 1 crédito criado no servidor
  expect(camp.server.state.medals).toHaveLength(1);
  expect(camp.server.state.creditEvents.filter((c) => c.kind === 'earn_medal')).toHaveLength(1);

  // queda de rede: alteração fica na fila, selo continua único, nada se perde
  mock.down = true;
  await page.getByTestId('goal-g1-not_done').click();
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-status', /offline|pending/);
  expect(camp.server.state.goalReviews.find((g) => g.goalId === 'g1')?.status).toBe('done');
  mock.down = false;
  await page.getByTestId('sync-badge').click(); // modo responsável: abre "Mais"
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-status', 'synced');
  expect(camp.server.state.goalReviews.find((g) => g.goalId === 'g1')?.status).toBe('not_done');
  expect(camp.server.state.medals).toHaveLength(1);

  // recarregar: volta direto à campanha (lembrada), dados íntegros, e retorna ao modo infantil
  await page.reload();
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.locator('.app')).toHaveAttribute('data-mode', 'child');
  await expect(page.getByTestId('stat-daily')).toHaveText('1');
  await expect(page.getByTestId('stat-credits')).toHaveText('1');

  // compatibilidade com a chave Publishable: apikey sempre presente; Bearer é o JWT do usuário, NUNCA a chave
  expect(mock.seen.length).toBeGreaterThan(5);
  for (const r of mock.seen) {
    expect(r.apikey, r.path).toBe(PUBLISHABLE);
    expect(r.auth, r.path).toMatch(/^Bearer ey/);
    expect(r.auth, r.path).not.toContain(PUBLISHABLE);
  }
});

test('sem rede ao abrir: mostra o cache local da campanha', async ({ page }) => {
  const mock = await setup(page);
  await page.goto('./');
  await page.getByTestId('start-login').click();
  await login(page);
  await page.getByLabel('Nome da campanha').fill('Reino offline');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-status', 'synced');
  mock.down = true; // servidor inacessível na próxima abertura
  await page.reload();
  await expect(page.getByTestId('map')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-status', 'offline');
});
