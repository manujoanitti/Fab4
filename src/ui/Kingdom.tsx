import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OpInput } from '../domain/ops';
import { RULES, phaseLabel } from '../domain/rules';
import { campaignComplete, stageCompleted } from '../domain/selectors';
import type { OpOutcome } from '../domain/types';
import type { SyncManager } from '../sync/syncManager';
import { AchievementsScreen, GoalsScreen, MapScreen, Stats } from './ChildViews';
import { Confetti } from './Celebration';
import { Ctx, useSyncView, type AppCtx } from './ctx';
import { GamesScreen } from './Games';
import { CreditsScreen, HistoryScreen, MoreScreen, PrizesScreen, ReviewScreen } from './Guardian';
import { checkPin, hasPin } from './pin';

type Tab = 'map' | 'goals' | 'achv' | 'games' | 'review' | 'prizes' | 'credits' | 'history' | 'more';
const CHILD_TABS: [Tab, string, string][] = [['map', '🗺️', 'Mapa'], ['goals', '📝', 'Metas'], ['achv', '🏅', 'Conquistas'], ['games', '🎮', 'Jogos']];
const GUARDIAN_TABS: [Tab, string, string][] = [['map', '🗺️', 'Mapa'], ['review', '📝', 'Hoje'], ['prizes', '🎁', 'Prêmios'], ['credits', '🎮', 'Créditos'], ['history', '📜', 'Histórico'], ['more', '⚙️', 'Mais']];

/** Volta sozinho ao modo da Bianca após inatividade (proteção contra esquecimento em aparelho compartilhado). */
const AUTO_LOCK_MS = 5 * 60 * 1000;

const SYNC_LABEL: Record<string, string> = {
  loading: '⏳ Carregando', synced: '☁️ Sincronizado', syncing: '🔄 Sincronizando…', pending: '🕓 Alterações pendentes',
  offline: '📴 Offline', conflict: '⚠️ Conflito a resolver', error: '❌ Erro de sincronização',
};

export default function Kingdom({ sm, isDemo, exit, signOut }: { sm: SyncManager; isDemo: boolean; exit: () => void; signOut?: () => Promise<void> }) {
  const sv = useSyncView(sm);
  const [tab, setTab] = useState<Tab>('map');
  const [guardianMode, setGuardianMode] = useState(false);
  const [pinAsk, setPinAsk] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinErr, setPinErr] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: 'ok' | 'error' }[]>([]);
  const [burst, setBurst] = useState({ n: 0, big: false });
  const [banner, setBanner] = useState<string | null>(null);
  const [pinNoticeDismissed, setPinNoticeDismissed] = useState(false);
  const toastId = useRef(0);

  // Bloqueio automático do modo responsável.
  useEffect(() => {
    if (!guardianMode) return;
    let timer = setTimeout(lock, AUTO_LOCK_MS);
    function lock() { setGuardianMode(false); setTab('map'); }
    const reset = () => { clearTimeout(timer); timer = setTimeout(lock, AUTO_LOCK_MS); };
    const evs = ['pointerdown', 'keydown', 'touchstart'] as const;
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => { clearTimeout(timer); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [guardianMode]);

  // Inicialização + atualização ao abrir, voltar ao app e recuperar conexão.
  useEffect(() => {
    void sm.init();
    const kick = () => void sm.sync();
    const vis = () => document.visibilityState === 'visible' && kick();
    window.addEventListener('online', kick);
    window.addEventListener('offline', kick);
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', vis);
    const timer = isDemo ? undefined : setInterval(() => document.visibilityState === 'visible' && kick(), 30000);
    return () => {
      window.removeEventListener('online', kick);
      window.removeEventListener('offline', kick);
      window.removeEventListener('focus', kick);
      document.removeEventListener('visibilitychange', vis);
      if (timer) clearInterval(timer);
    };
  }, [sm, isDemo]);

  const notify = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.filter((x) => x.msg !== msg), { id, msg, kind }].slice(-2));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const act = useCallback(async (input: OpInput): Promise<OpOutcome> => {
    const r = await sm.act(input);
    if (r.status === 'rejected') notify(r.message, 'error');
    return r;
  }, [sm, notify]);

  const state = sv.view;
  const phases = state?.phases.length ?? 0;
  const medals = state?.medals.length ?? 0;
  const complete = state ? campaignComplete(state) : false;
  const prev = useRef<{ phases: number; medals: number; complete: boolean } | null>(null);
  useEffect(() => {
    if (!state) return;
    const p = prev.current;
    prev.current = { phases, medals, complete };
    if (!p) return; // primeira carga: sem festa
    const dPhases = phases - p.phases, dMedals = medals - p.medals;
    if (dPhases > 0) {
      const last = state.phases.reduce((a, x) => Math.max(a, x.phase), 0);
      const stage = Math.ceil(last / RULES.phasesPerStage);
      if (complete && !p.complete) { setBurst((b) => ({ n: b.n + 1, big: true })); setBanner('🎉 O Reino da Bianca foi conquistado! Todas as 25 fases e o bônus final!'); }
      else if (last % RULES.phasesPerStage === 0 && stageCompleted(state, stage)) { setBurst((b) => ({ n: b.n + 1, big: true })); setBanner(`🏰 Etapa concluída: ${RULES.stages[stage - 1].name}! ${RULES.stages[stage - 1].coins} 🪙 + ${RULES.stages[stage - 1].bigStamps} 🏅 + uma recompensa!`); }
      else { setBurst((b) => ({ n: b.n + 1, big: false })); notify(dPhases > 1 ? `⭐ ${dPhases} fases concluídas!` : `⭐ Fase ${phaseLabel(last)} concluída!`); }
    } else if (dMedals > 0) { setBurst((b) => ({ n: b.n + 1, big: false })); notify(dMedals > 1 ? `🌟 ${dMedals} selos do dia!` : '🌟 Selo do dia conquistado! +1 crédito de jogo'); }
  }, [state, phases, medals, complete, notify]);

  const canBeGuardian = sv.role === 'guardian';
  const ctx: AppCtx | null = useMemo(
    () => (state ? { sm, sv, state, isDemo, canBeGuardian, guardianMode: guardianMode && canBeGuardian, act, notify, exit, signOut } : null),
    [sm, sv, state, isDemo, canBeGuardian, guardianMode, act, notify, exit, signOut],
  );

  const toggleMode = async () => {
    if (guardianMode) { setGuardianMode(false); setTab('map'); return; }
    if (hasPin()) { setPinAsk(true); setPinValue(''); setPinErr(false); } else { setGuardianMode(true); setTab('review'); }
  };

  if (!ctx) {
    return (
      <div className="splash" data-testid="loading">
        <div className="splash-crown">👑</div>
        {sv.error ? <><p>{sv.error}</p><button className="btn primary" onClick={() => sm.sync()}>Tentar de novo</button><button className="btn" onClick={exit}>Voltar</button></> : sv.status === 'offline' ? <><p>Sem conexão e nenhum dado salvo neste aparelho ainda.</p><button className="btn primary" onClick={() => sm.sync()}>Tentar de novo</button></> : <p>Abrindo o reino…</p>}
      </div>
    );
  }
  const tabs = ctx.guardianMode ? GUARDIAN_TABS : CHILD_TABS;
  const current = tabs.some(([t]) => t === tab) ? tab : 'map';
  const pendingN = sv.queue.length;

  return (
    <Ctx.Provider value={ctx}>
      <div className={`app ${ctx.guardianMode ? 'guardian' : 'child'}`} data-mode={ctx.guardianMode ? 'guardian' : 'child'}>
        <header className="topbar">
          <div className="brand">👑 <span>Reino da Bianca</span>{isDemo && <em className="demo-tag" data-testid="demo-tag">demonstração</em>}</div>
          <button className={`sync-badge ${sv.status}`} data-testid="sync-badge" data-status={sv.status} onClick={() => { if (ctx.guardianMode) setTab('more'); else void sm.sync(); }} aria-label={`Estado: ${SYNC_LABEL[sv.status]}`}>
            {SYNC_LABEL[sv.status]}{pendingN ? ` (${pendingN})` : ''}
          </button>
          {canBeGuardian && <button className="btn mode" data-testid="mode-toggle" aria-label={ctx.guardianMode ? 'Voltar ao modo Bianca' : 'Entrar no modo responsável'} onClick={toggleMode}><span aria-hidden="true">{ctx.guardianMode ? '👧' : '🔒'}</span><span className="lbl"> {ctx.guardianMode ? 'Modo Bianca' : 'Responsável'}</span></button>}
        </header>
        <Stats />
        {ctx.guardianMode && !isDemo && !hasPin() && !pinNoticeDismissed && (
          <div className="callout notice" data-testid="pin-notice">
            🔐 Esta conta é usada por toda a família: defina um <b>PIN</b> neste aparelho para a Bianca não entrar no modo responsável sem querer.
            <div className="row"><button className="btn primary" onClick={() => setTab('more')}>Definir PIN</button><button className="btn" onClick={() => setPinNoticeDismissed(true)}>Agora não</button></div>
          </div>
        )}
        <main className="content">
          {current === 'map' && <MapScreen />}
          {current === 'goals' && <GoalsScreen />}
          {current === 'achv' && <AchievementsScreen />}
          {current === 'games' && <GamesScreen />}
          {current === 'review' && <ReviewScreen />}
          {current === 'prizes' && <PrizesScreen />}
          {current === 'credits' && <CreditsScreen />}
          {current === 'history' && <HistoryScreen />}
          {current === 'more' && <MoreScreen />}
        </main>
        <nav className="tabbar" aria-label="Navegação">
          {tabs.map(([t, icon, label]) => (
            <button key={t} className={current === t ? 'on' : ''} data-testid={`tab-${t}`} onClick={() => setTab(t)}><span>{icon}</span>{label}</button>
          ))}
        </nav>
        <Confetti burst={burst.n} big={burst.big} />
        <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
        {banner && (
          <div className="sheet-backdrop" onClick={() => setBanner(null)}>
            <div className="sheet celebrate" role="dialog" data-testid="celebration" onClick={(e) => e.stopPropagation()}>
              <p className="big-emoji">🎉</p><h3>{banner}</h3>
              <button className="btn primary" onClick={() => setBanner(null)}>Que maravilha!</button>
            </div>
          </div>
        )}
        {pinAsk && (
          <div className="sheet-backdrop" onClick={() => setPinAsk(false)}>
            <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={async (e) => {
              e.preventDefault();
              if (await checkPin(pinValue)) { setPinAsk(false); setGuardianMode(true); setTab('review'); } else setPinErr(true);
            }}>
              <h3>PIN do responsável</h3>
              <input autoFocus inputMode="numeric" type="password" value={pinValue} onChange={(e) => setPinValue(e.target.value)} aria-label="PIN" data-testid="pin-input" />
              {pinErr && <p className="error">PIN incorreto.</p>}
              <button className="btn primary" type="submit">Entrar</button>
            </form>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
