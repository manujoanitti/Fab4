import { useCallback, useEffect, useState } from 'react';
import { openDemo } from '../demo';
import { cloud, cloudConfigured, getClient, SupabaseBackend, type CampaignRow } from '../sync/cloud';
import { defaultKV } from '../storage/kv';
import { SyncManager } from '../sync/syncManager';
import Kingdom from './Kingdom';

type Screen =
  | { k: 'boot' }
  | { k: 'start' }
  | { k: 'login' }
  | { k: 'campaigns'; list: CampaignRow[]; userId: string }
  | { k: 'main'; sm: SyncManager; demo: boolean };

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* indisponível */ } },
};
const kv = defaultKV();

export default function App() {
  const [screen, setScreen] = useState<Screen>({ k: 'boot' });
  const [err, setErr] = useState('');

  const openCampaign = useCallback(async (id: string, userId: string) => {
    ls.set('rb:campaign', id);
    ls.set('rb:mode', 'cloud');
    const sm = new SyncManager(new SupabaseBackend(getClient(), id, userId), kv, id);
    setScreen({ k: 'main', sm, demo: false });
  }, []);

  const loadCampaigns = useCallback(async (auto = true) => {
    const s = await cloud.session();
    if (!s) return setScreen({ k: 'login' });
    let list: CampaignRow[] = [];
    try { list = await cloud.campaigns(); } catch { /* offline: usa campanha lembrada */ }
    const remembered = ls.get('rb:campaign');
    if (auto && remembered && (list.length === 0 || list.some((c) => c.id === remembered))) return void openCampaign(remembered, s.user.id);
    if (auto && list.length === 1) return void openCampaign(list[0].id, s.user.id);
    setScreen({ k: 'campaigns', list, userId: s.user.id });
  }, [openCampaign]);

  const startDemo = useCallback(async () => {
    ls.set('rb:mode', 'demo');
    setScreen({ k: 'main', sm: await openDemo(kv), demo: true });
  }, []);

  useEffect(() => {
    (async () => {
      if (new URLSearchParams(location.search).has('demo') || ls.get('rb:mode') === 'demo') return startDemo();
      if (cloudConfigured && ls.get('rb:mode') === 'cloud') {
        try { return await loadCampaigns(); } catch { /* cai para início */ }
      }
      setScreen({ k: 'start' });
    })();
  }, [loadCampaigns, startDemo]);

  const exit = () => { ls.set('rb:mode', null); ls.set('rb:campaign', null); setScreen({ k: 'start' }); };
  const signOut = async () => { await cloud.signOut(); exit(); };

  if (screen.k === 'boot') return <div className="splash"><div className="splash-crown">👑</div><p>Abrindo o reino…</p></div>;
  if (screen.k === 'main') return <Kingdom key={screen.demo ? 'demo' : 'cloud'} sm={screen.sm} isDemo={screen.demo} exit={exit} signOut={screen.demo ? undefined : signOut} />;

  if (screen.k === 'start')
    return (
      <div className="landing" data-testid="landing">
        <div className="splash-crown">👑</div>
        <h1>Reino da Bianca</h1>
        <p>A trilha encantada das metas, agora em um jogo.</p>
        <button className="btn primary big" data-testid="start-login" disabled={!cloudConfigured} onClick={() => setScreen({ k: 'login' })}>Entrar (responsáveis e Bianca)</button>
        {!cloudConfigured && <p className="muted small">A nuvem (Supabase) ainda não foi configurada neste build — veja <code>docs/configuracao-supabase.md</code>.</p>}
        <button className="btn big" data-testid="start-demo" onClick={startDemo}>Experimentar a demonstração</button>
        <p className="muted small">A demonstração usa dados fictícios, fica só neste aparelho e nunca toca a campanha real.</p>
      </div>
    );

  if (screen.k === 'login') return <Login onDone={() => loadCampaigns(false).catch((e) => setErr(String(e)))} onBack={() => setScreen({ k: 'start' })} err={err} />;
  return <Campaigns list={screen.list} userId={screen.userId} onOpen={openCampaign} reload={() => loadCampaigns(false)} signOut={signOut} />;
}

function Login({ onDone, onBack, err }: { onDone: () => void; onBack: () => void; err: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(err);
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true); setMsg('');
    try { await fn(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <form className="landing" data-testid="login" onSubmit={(e) => { e.preventDefault(); void run(async () => { await cloud.signIn(email, password); onDone(); })(); }}>
      <h2>Entrar</h2>
      <input type="email" autoComplete="email" placeholder="e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="E-mail" />
      <input type="password" autoComplete="current-password" placeholder="senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} aria-label="Senha" />
      {msg && <p className="error">{msg}</p>}
      <button className="btn primary big" type="submit" disabled={busy}>Entrar</button>
      <button className="btn" type="button" disabled={busy} onClick={run(async () => { const r = await cloud.signUp(email, password); if (r.needsConfirmation) setMsg('Conta criada. Confirme o e-mail e entre.'); else onDone(); })}>Criar conta</button>
      <button className="btn" type="button" onClick={onBack}>Voltar</button>
    </form>
  );
}

function Campaigns({ list, userId, onOpen, reload, signOut }: { list: CampaignRow[]; userId: string; onOpen: (id: string, userId: string) => void; reload: () => void; signOut: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div className="landing" data-testid="campaigns">
      <h2>Suas campanhas</h2>
      {list.map((c) => <button key={c.id} className="btn big" onClick={() => onOpen(c.id, userId)}>{c.name} <small>({c.role === 'guardian' ? 'responsável' : 'criança'})</small></button>)}
      {list.length === 0 && <p className="muted">Você ainda não participa de nenhuma campanha.</p>}
      <h3>Nova campanha familiar</h3>
      <div className="row"><input placeholder="Nome (ex.: Reino da família)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da campanha" /><button className="btn primary" disabled={!name.trim()} onClick={async () => { try { const id = await cloud.createCampaign(name); onOpen(id, userId); } catch (e) { setMsg((e as Error).message); } }}>Criar</button></div>
      <h3>Tenho um convite</h3>
      <div className="row"><input placeholder="código do convite" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código do convite" /><button className="btn" disabled={!code.trim()} onClick={async () => { try { const id = await cloud.redeemInvite(code); onOpen(id, userId); } catch (e) { setMsg((e as Error).message); reload(); } }}>Entrar</button></div>
      {msg && <p className="error">{msg}</p>}
      <button className="btn" onClick={signOut}>Sair da conta</button>
    </div>
  );
}
