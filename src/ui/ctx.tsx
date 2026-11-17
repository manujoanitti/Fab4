import { createContext, useContext, useSyncExternalStore } from 'react';
import type { OpInput } from '../domain/ops';
import type { CampaignState, OpOutcome } from '../domain/types';
import type { SyncManager, SyncView } from '../sync/syncManager';

export interface AppCtx {
  sm: SyncManager;
  sv: SyncView;
  state: CampaignState;
  isDemo: boolean;
  /** Papel real no banco (a UI apenas reflete; o servidor é quem autoriza). */
  canBeGuardian: boolean;
  guardianMode: boolean;
  act: (input: OpInput) => Promise<OpOutcome>;
  notify: (msg: string, kind?: 'ok' | 'error') => void;
  /** Sai da campanha (volta à seleção). */
  exit: () => void;
  signOut?: () => Promise<void>;
}
export const Ctx = createContext<AppCtx>(null as never);
export const useApp = () => useContext(Ctx);
export const useSyncView = (sm: SyncManager) => useSyncExternalStore(sm.subscribe, sm.getView, sm.getView);
