// Teste de ponta a ponta (Chromium): percorre as telas, confere privacidade e fluxos de edição, e grava capturas em shots/.
//   npm run build && npm run e2e   (sobe o servidor sobre uma cópia temporária do banco real e usa o Chromium)
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Sempre roda sobre uma CÓPIA temporária do banco real (o e2e cria/edita registros de teste).
if (!existsSync('data/real/atlas.sqlite')) { console.error('Este e2e usa os dados reais locais (data/real/). Rode `npm run seed` antes.'); process.exit(2); }
const tmpDb = join(tmpdir(), `atlas-e2e-${process.pid}.sqlite`); copyFileSync('data/real/atlas.sqlite', tmpDb);
const PORT = 3100 + (process.pid % 700), TOKEN = process.env.TOKEN ?? 'token-e2e-0123456789abcdef';
const server: ChildProcess = spawn('npx', ['tsx', 'server/index.ts'], { env: { ...process.env, PORT: String(PORT), ATLAS_DB: tmpDb, ATLAS_ADMIN_TOKEN: TOKEN, ATLAS_SERVE_STATIC: '1', ATLAS_BACKUP_DIR: join(tmpdir(), `atlas-e2e-bk-${process.pid}`) }, stdio: 'ignore' });
const BASE = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* aguardando */ } await new Promise((r) => setTimeout(r, 250)); }
const cleanup = () => { server.kill(); for (const s of ['', '-wal', '-shm']) rmSync(tmpDb + s, { force: true }); };
process.on('exit', cleanup);

mkdirSync('shots', { recursive: true });
// nomes (completos) de pessoas vivas, lidos do próprio banco — nenhum nome real fica no código versionado
const adminSnap = await (await fetch(`${BASE}/api/snapshot`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
const FREE_PRIVATE: string[] = adminSnap.persons.filter((p: any) => p.isPrivate && !p.redacted).map((p: any) => p.preferred_name);
let failed = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? '✔' : '✘'} ${msg}`); if (!ok) failed++; };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page: Page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/tile\.openstreetmap|ERR_|Failed to load resource|net::/.test(m.text())) errors.push(m.text()); });
const go = async (path: string, wait = 600) => { await page.goto(BASE + path); await page.waitForLoadState('networkidle'); await page.waitForTimeout(wait); };
const shot = (n: string) => page.screenshot({ path: `shots/${n}.png`, fullPage: false });

// ---- visão pública ----
await go('/'); await shot('01-visao-geral');
check((await page.locator('[data-testid^="tile-"]').count()) >= 6, 'Visão Geral exibe os indicadores');
const bodyText = await page.locator('body').innerText();
check(FREE_PRIVATE.every((n) => !bodyText.includes(n)), 'Visão pública não expõe nomes de pessoas vivas (Visão Geral)');

await go('/pessoas'); check((await page.locator('[data-testid="person-card"]').count()) >= 20, 'Lista de pessoas carregada'); await shot('02-pessoas');
const pe = await page.locator('body').innerText(); check(FREE_PRIVATE.every((n) => !pe.includes(n)), 'Visão pública não expõe nomes de vivos (Pessoas)');
await page.fill('[data-testid="people-filter"]', 'Joanite'); await page.waitForTimeout(300);
check((await page.locator('[data-testid="person-card"]').count()) >= 4, 'Busca tolerante: "Joanite" encontra Joanitte/Joanite/Joanitti');
const apiSearch = await (await fetch(`${BASE}/api/search?q=giovanitti`)).json();
check(apiSearch.some((h: any) => /Nicola|Silverio|Domenico/.test(h.title)), 'API de busca tolera variações (giovanitti → Giovannitti/Giovanitti)');

await go('/arvore'); await shot('03-arvore');
check((await page.locator('[data-testid="tree-node"]').count()) >= 10, 'Árvore renderiza nós de pessoa');
check((await page.locator('.react-flow__edge').count()) >= 1, 'Árvore renderiza conexões');
check((await page.locator('[data-testid="hyp-node"]').count()) >= 1, 'Nós de hipótese presentes');
await page.locator('[data-testid="tree-node"]').first().click(); await page.waitForTimeout(300);
check(await page.locator('[data-testid="person-panel"]').isVisible(), 'Clique no nó abre o painel lateral'); await shot('04-arvore-painel');
await page.click('[data-testid="orientation"]'); await page.waitForTimeout(1200); await shot('05-arvore-horizontal');
await page.selectOption('[data-testid="nucleus-select"]', { index: 3 }); await page.waitForTimeout(1200); await shot('06-arvore-nucleo');

await go('/mapa', 1200); await shot('07-mapa');
check((await page.locator('.leaflet-marker-icon').count()) >= 5, 'Mapa exibe marcadores das localidades');
await page.locator('.leaflet-marker-icon').first().click({ force: true }); await page.waitForTimeout(400);
check(await page.locator('[data-testid="place-panel"] h2').first().isVisible(), 'Clique em localidade abre o painel'); await shot('08-mapa-painel');

await go('/linha-do-tempo'); await shot('09-linha-do-tempo');
check((await page.locator('[data-testid="timeline-event"]').count()) >= 10, 'Linha do tempo lista eventos');
await page.locator('[data-testid="timeline-event"]').first().click(); await page.waitForTimeout(300); check(await page.locator('[role="dialog"]').isVisible(), 'Evento abre detalhe'); await page.keyboard.press('Escape');

await go('/documentos'); await shot('10-documentos'); check((await page.locator('[data-testid="doc-card"]').count()) >= 30, 'Documentos listados');
await page.locator('[data-testid="doc-card"]').first().click(); await page.waitForTimeout(300); check(await page.locator('[role="dialog"]').isVisible(), 'Documento abre metadados'); await page.keyboard.press('Escape');

await go('/investigacoes'); await shot('11-investigacoes'); await page.locator('[data-testid="inv-list"] button').first().click(); await page.waitForTimeout(400); await shot('12-investigacao-detalhe');
check((await page.locator('[data-testid="hypothesis"]').count()) >= 1, 'Investigação mostra hipóteses');
check((await page.locator('[data-testid="claim-status-save"]').count()) === 0, 'Controles de edição ocultos na visão pública');

await go('/admin'); check(/Área restrita/.test(await page.locator('main').innerText()), 'Administração exige autenticação');

// ---- administrador ----
await page.click('[data-testid="login-open"]'); await page.fill('[data-testid="token-input"]', 'token-errado'); await page.click('[data-testid="token-submit"]'); await page.waitForTimeout(400);
check(/Token inválido/.test(await page.locator('[role="dialog"]').innerText()), 'Token inválido é recusado');
await page.fill('[data-testid="token-input"]', TOKEN); await page.click('[data-testid="token-submit"]'); await page.waitForTimeout(800);
await go('/admin'); await shot('13-admin-painel'); // sessionStorage persiste na mesma aba
check((await page.locator('[data-testid="integrity-list"]').count()) >= 0 && /Verificações de integridade/.test(await page.locator('main').innerText()), 'Painel de integridade visível ao administrador');
await go('/pessoas'); const adminBody = await page.locator('body').innerText(); check(FREE_PRIVATE.some((n) => adminBody.includes(n)), 'Administrador vê os nomes completos'); await shot('14-pessoas-admin');

// cadastrar pessoa
await go('/admin?aba=pessoas'); await page.click('[data-testid="new-entity"]'); await page.fill('#f_preferred_name', 'Pessoa de Teste E2E'); await page.fill('[aria-label="Nascimento início"]', '1900'); await page.selectOption('[aria-label="Nascimento precisão"]', 'ano');
await page.selectOption('#f_living_status', 'falecido'); await page.click('[data-testid="save-entity"]'); await page.waitForTimeout(800);
check(await page.locator('[data-testid="entity-list"]').getByText('Pessoa de Teste E2E').count() > 0, 'Admin cadastra pessoa');
// validação: ciclo de filiação / auto-relação
const tok = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const ppl = await (await fetch(`${BASE}/api/snapshot`, { headers: tok })).json();
const a = ppl.persons.find((p: any) => p.preferred_name === 'Pessoa de Teste E2E'), n = ppl.persons.find((p: any) => p.preferred_name === 'Nicola Giovannitti');
const r1 = await fetch(`${BASE}/api/admin/relationship`, { method: 'POST', headers: tok, body: JSON.stringify({ type: 'filiacao', person_a: a.id, person_b: n.id, status: 'documentado' }) });
const r2 = await fetch(`${BASE}/api/admin/relationship`, { method: 'POST', headers: tok, body: JSON.stringify({ type: 'filiacao', person_a: n.id, person_b: a.id, status: 'documentado' }) });
check(r1.status === 201 && r2.status === 400 && /ciclo/.test(JSON.stringify(await r2.json())), 'Integridade: filiação circular é recusada');
await fetch(`${BASE}/api/admin/relationship/${(await (await fetch(`${BASE}/api/snapshot`, { headers: tok })).json()).relationships.find((r: any) => r.person_a === a.id)?.id}`, { method: 'DELETE', headers: tok });
await fetch(`${BASE}/api/admin/person/${a.id}`, { method: 'DELETE', headers: tok });
const rel = ppl.relationships.length; void rel;
await go('/arvore'); await shot('15-arvore-admin');
await go('/pessoas/per_domenico'); await shot('16-perfil'); check(/Relações familiares/.test(await page.locator('main').innerText()) && /sem relação de parentesco especificada/i.test(await page.locator('main').innerText()), 'Perfil mostra agrupamento investigativo sem relação inventada');
await page.mouse.wheel(0, 1400); await page.waitForTimeout(300); await shot('17-perfil-meio');
await go('/admin?aba=revisao'); await shot('18-admin-revisao'); check((await page.locator('[data-testid="review-list"] li').count()) >= 10, 'Itens de revisão listados');
await go('/admin?aba=importar'); await shot('19-admin-importar');
await go('/admin?aba=pessoas&id=per_nicola'); await shot('20-admin-editar-pessoa');
await go('/investigacoes?inv=inv_filiacao_joao'); await shot('21-investigacao-admin'); check((await page.locator('[data-testid="claim-status-save"]').count()) >= 1, 'Administrador vê controles de estado das hipóteses');
// fluxo: mudar estado de hipótese com justificativa → histórico
await page.locator('[data-testid="hypothesis"] summary').first().click(); await page.locator('[data-testid="claim-status-save"]').first().scrollIntoViewIfNeeded();
await page.fill('input[placeholder="Justificativa da mudança"] >> nth=0', 'Teste e2e'); await page.selectOption('select[aria-label="Novo estado"] >> nth=0', 'nao_confirmado'); await page.locator('[data-testid="claim-status-save"]').first().click(); await page.waitForTimeout(800);
const hist = await (await fetch(`${BASE}/api/admin/changelog?entity_type=claim&limit=3`, { headers: tok })).json(); check(hist.some((h: any) => h.action === 'status' && /e2e/.test(h.note ?? '')), 'Mudança de estado de hipótese registrada no histórico');
await fetch(`${BASE}/api/admin/status/claim/cl_h3`, { method: 'POST', headers: tok, body: JSON.stringify({ status: 'hipotese_plausivel', note: 'restaurado após teste e2e' }) });

check(errors.length === 0, `Sem erros de console/página${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);

// celular
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
for (const [p, n] of [['/', 'm1-visao'], ['/arvore', 'm2-arvore'], ['/mapa', 'm3-mapa']] as const) { await mp.goto(BASE + p); await mp.waitForLoadState('networkidle'); await mp.waitForTimeout(1200); await mp.screenshot({ path: `shots/${n}.png` }); }
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
check(!overflow, 'Mobile: sem rolagem horizontal da página');
await browser.close();
console.log(failed ? `\n${failed} verificação(ões) falharam` : '\nTodas as verificações passaram');
process.exit(failed ? 1 : 0);
