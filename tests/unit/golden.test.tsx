import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setGoalOp } from '../../src/domain/ops';
import type { CampaignState } from '../../src/domain/types';
import CrystalMemory from '../../src/games/CrystalMemory';
import EnchantedGarden from '../../src/games/EnchantedGarden';
import StarHunt from '../../src/games/StarHunt';
import { saveGameStateOp } from '../../src/domain/ops';
import { memoryKV } from '../../src/storage/kv';
import { EngineBackend, EngineServer } from '../../src/sync/engineServer';
import { SyncManager, type SyncView } from '../../src/sync/syncManager';
import App from '../../src/ui/App';
import { AchievementsScreen, GoalsScreen, MapScreen, Stats } from '../../src/ui/ChildViews';
import { Ctx, type AppCtx } from '../../src/ui/ctx';
import { GamesScreen } from '../../src/ui/Games';
import { CreditsScreen, HistoryScreen, MoreScreen, PrizesScreen, ReviewScreen } from '../../src/ui/Guardian';
import Kingdom from '../../src/ui/Kingdom';
import MapView from '../../src/ui/MapView';
import { applyOp } from '../../src/domain/engine';
import { completeUpTo, fresh, giveCredits, G } from './helpers';

/**
 * GOLDEN DE APARÊNCIA (regressão visual determinística).
 * Cada caso renderiza a marcação HTML/SVG dos componentes no modo FALLBACK (sem arte externa) e compara
 * com tests/golden/*.html. Marcação idêntica => pixels idênticos (mesmo CSS). Os comentários "<!-- -->" que o
 * React insere entre textos adjacentes não têm efeito visual e são ignorados na comparação.
 * Regerar SOMENTE quando a mudança visual for intencional:  UPDATE_GOLDEN=1 npx vitest run tests/unit/golden
 */
const GOLDEN_DIR = join(__dirname, '../golden');
const norm = (html: string) => html.replace(/<!-- -->/g, '').replace(/></g, '>\n<') + '\n';
function expectGolden(name: string, el: ReactElement) {
  const html = norm(renderToStaticMarkup(el));
  const file = join(GOLDEN_DIR, `${name}.html`);
  if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
    if (!process.env.UPDATE_GOLDEN) throw new Error(`golden ausente: ${name} (rode com UPDATE_GOLDEN=1 para criar)`);
    writeFileSync(file, html);
    return;
  }
  expect(html, `golden ${name}`).toBe(readFileSync(file, 'utf8'));
}

function ctxFor(state: CampaignState, over: Partial<AppCtx> = {}): AppCtx {
  const sv: SyncView = { server: state, view: state, queue: [], role: 'guardian', status: 'synced', online: true, lastSyncAt: '2026-03-03T12:00:00.000Z' };
  return { sm: {} as never, sv, state, isDemo: false, canBeGuardian: true, guardianMode: true, act: async () => ({ status: 'ok' }), notify: () => {}, exit: () => {}, ...over };
}
const withCtx = (state: CampaignState, el: ReactElement, over: Partial<AppCtx> = {}) => <Ctx.Provider value={ctxFor(state, over)}>{el}</Ctx.Provider>;

const seeded = (seed = 11) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const D = '2026-03-03'; // terça-feira (meta especial s1 aparece)

let s0: CampaignState, s2: CampaignState, s7: CampaignState, s10: CampaignState, s25: CampaignState;
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 3, 12, 0, 0));
  vi.spyOn(Math, 'random').mockImplementation(seeded());
  s0 = fresh();
  s2 = giveCredits(completeUpTo(fresh(), 2), 3);
  for (const [g, st] of [['g1', 'done'], ['g2', 'done'], ['g3', 'not_done'], ['g4', 'not_evaluated'], ['s1', 'done']] as const)
    s2 = applyOp(s2, { opId: `gold-${g}`, at: G.now, ...setGoalOp(s2, D, g, st) }, G).state;
  s7 = completeUpTo(s2, 7);
  s10 = completeUpTo(s2, 10);
  s25 = completeUpTo(s2, 25);
  s25 = applyOp(s25, { opId: 'garden', at: G.now, ...saveGameStateOp(s25, 'garden', { items: [{ id: 'a', kind: '🌷', x: 30, y: 60 }, { id: 'b', kind: '🦄', x: 70, y: 50 }, { id: 'c', kind: '❓', x: 50, y: 80 }] }) } as never, G).state;
  s25 = applyOp(s25, { opId: 'deliver', at: G.now, type: 'deliver_reward', ref: 'reward:stage:1', choice: 'assistir mais 1 desenho' }, G).state;
});
afterAll(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const noop = () => {};
describe('golden: mapa (fallback atual)', () => {
  it.each([['empty', () => s0], ['2', () => s2], ['7', () => s7], ['10', () => s10], ['25', () => s25]] as const)('mapa com %s fases', (name, get) => {
    expectGolden(`map-${name}`, <MapView state={get()} onSelect={noop} onBonus={noop} />);
  });
  it('tela do mapa (estados e atributos de teste)', () => expectGolden('mapscreen-7', withCtx(s7, <MapScreen />)));
});

describe('golden: interface infantil', () => {
  it('indicadores', () => { expectGolden('stats-2', withCtx(s2, <Stats />)); expectGolden('stats-25', withCtx(s25, <Stats />)); });
  it('metas de hoje', () => expectGolden('goals-child', withCtx(s2, <GoalsScreen />, { guardianMode: false })));
  it('conquistas', () => { expectGolden('achievements-2', withCtx(s2, <AchievementsScreen />)); expectGolden('achievements-25', withCtx(s25, <AchievementsScreen />)); });
  it('jogos', () => { expectGolden('games-2', withCtx(s2, <GamesScreen />)); expectGolden('games-25', withCtx(s25, <GamesScreen />)); });
});

describe('golden: modo responsável', () => {
  it('telas', () => {
    expectGolden('review', withCtx(s2, <ReviewScreen />));
    expectGolden('prizes-7', withCtx(s7, <PrizesScreen />));
    expectGolden('prizes-25', withCtx(s25, <PrizesScreen />));
    expectGolden('credits-25', withCtx(s25, <CreditsScreen />));
    expectGolden('history-25', withCtx(s25, <HistoryScreen />));
    expectGolden('more', withCtx(s2, <MoreScreen />));
  });
});

describe('golden: minigames', () => {
  it('Caça às Estrelas (início), Memória (início) e Jardim (edição e leitura)', () => {
    expectGolden('game-stars', <StarHunt duration={30} onExit={noop} />);
    vi.spyOn(Math, 'random').mockImplementation(seeded(5));
    expectGolden('game-crystals', <CrystalMemory onExit={noop} />);
    expectGolden('game-garden', withCtx(s25, <EnchantedGarden onExit={noop} />));
    expectGolden('game-garden-ro', withCtx(s25, <EnchantedGarden readOnly />));
  });
});

describe('golden: casca do app', () => {
  it('splash de abertura e reino (modo infantil / carregando)', async () => {
    expectGolden('app-boot', <App />);
    const server = new EngineServer(s7, 'camp-1', 'Reino de Teste');
    const sm = new SyncManager(new EngineBackend('demo', server, 'u', 'guardian'), memoryKV(), 'camp-1');
    expectGolden('kingdom-loading', <Kingdom sm={sm} isDemo={false} exit={noop} />);
    await sm.init();
    expectGolden('kingdom-child', <Kingdom sm={sm} isDemo exit={noop} />);
  });
});
