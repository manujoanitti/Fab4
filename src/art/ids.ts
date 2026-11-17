// IDs lógicos estáveis da camada gráfica. As telas pedem arte por estes IDs; nunca por caminho de arquivo.
// Cada ID aqui existe em catalog.json (testado em tests/unit/art-catalog.test.ts).
import type { ArtStateName } from './types';

export const STAGES = [1, 2, 3, 4, 5] as const;
export type MapNodeState = ArtStateName;

export const ART = {
  map: {
    topBg: 'map.top.bg',
    bottomBg: 'map.bottom.bg',
    fog: 'map.fog',
    start: 'map.start',
    regionBg: (s: number) => `map.region.${s}.bg`,
    regionMid: (s: number) => `map.region.${s}.mid`,
    regionPath: (s: number) => `map.region.${s}.path`,
    regionFg: (s: number) => `map.region.${s}.fg`,
    ribbon: (s: number) => `map.ribbon.${s}`,
    /** Candidatos em ordem de preferência: variante da região, depois a genérica. */
    node: (stage: number, state: MapNodeState) => [`map.node.${stage}.${state}`, `map.node.${state}`],
    /** Anel de seleção (overlay): um só para todas as regiões. */
    nodeSelected: (_stage: number) => ['map.node.selected'],
    bonus: (unlocked: boolean) => `map.bonus.${unlocked ? 'unlocked' : 'locked'}`,
  },
  char: { bianca: (anim: 'idle' | 'walk' | 'celebrate') => `char.bianca.${anim}` },
  fx: { sparkle: 'fx.sparkle', nodeComplete: 'fx.node.complete' },
  icon: { stampSmall: 'ui.icon.stamp-small', coin: 'ui.icon.coin', stampBig: 'ui.icon.stamp-big', stampDay: 'ui.icon.stamp-day', credit: 'ui.icon.credit', modeChild: 'ui.icon.mode-child', modeGuardian: 'ui.icon.mode-guardian' },
  crown: 'ui.brand.crown',
  tab: (t: string) => `ui.tab.${t}`,
  status: (s: string) => `ui.status.${s.replace(/_/g, '-')}`,
  sync: (s: string) => `ui.sync.${s}`,
  celebration: (k: 'stage' | 'final') => `ui.celebration.${k}`,
  game: {
    icon: (g: string) => `game.icon.${g}`,
    starsStar: 'game.stars.star',
    starsHit: 'game.stars.star.hit',
    crystalsBack: 'game.crystals.back',
    crystalsSymbol: (slug: string) => `game.crystals.symbol.${slug}`,
    gardenItem: (slug: string) => `game.garden.item.${slug}`,
  },
} as const;

export const TAB_IDS = ['map', 'goals', 'achievements', 'games', 'review', 'prizes', 'credits', 'history', 'more'] as const;
export const GOAL_STATUS_IDS = ['pending', 'done', 'not_done', 'not_evaluated'] as const;
export const SYNC_IDS = ['loading', 'synced', 'syncing', 'pending', 'offline', 'conflict', 'error'] as const;
export const GAME_IDS = ['stars', 'crystals', 'garden'] as const;

/** Fundos aplicados como variável CSS (--art-<id com pontos→hífens>). `stretch` = esticado; senão cover. */
export const CSS_ART: { id: string; stretch?: boolean }[] = [
  { id: 'ui.bg.app' }, { id: 'ui.bg.topbar' }, { id: 'ui.button.primary', stretch: true }, { id: 'ui.panel.sheet' },
  { id: 'game.stars.bg' }, { id: 'game.garden.bg' },
];
export const cssVarName = (id: string) => `--art-${id.replace(/\./g, '-')}`;
