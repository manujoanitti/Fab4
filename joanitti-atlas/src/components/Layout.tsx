import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAtlas } from '../lib/api';
import { searchAll } from '../lib/search';
import { Modal } from './ui';

const NAV: [string, string][] = [['/', 'Visão Geral'], ['/arvore', 'Árvore Genealógica'], ['/pessoas', 'Pessoas'], ['/mapa', 'Mapa Histórico'], ['/linha-do-tempo', 'Linha do Tempo'], ['/documentos', 'Documentos'], ['/investigacoes', 'Investigações'], ['/admin', 'Administração']];
const TYPE_ICON: Record<string, string> = { pessoa: '👤', evento: '📜', lugar: '📍', fonte: '🗂', investigacao: '🔎', sobrenome: 'Aa', afirmacao: '⚖' };

export function Layout() {
  const { snap, ix, admin, preview, setPreview, login, logout, error, loading } = useAtlas();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [theme, setTheme] = useState<string>(() => { try { return localStorage.getItem('atlas_theme') ?? 'auto'; } catch { return 'auto'; } });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const r = document.documentElement; theme === 'auto' ? r.removeAttribute('data-theme') : r.setAttribute('data-theme', theme); try { localStorage.setItem('atlas_theme', theme); } catch { /* ok */ } }, [theme]);
  useEffect(() => { const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  const hits = useMemo(() => (snap && ix && q.trim().length > 1 ? searchAll(snap, ix, q).slice(0, 7) : []), [snap, ix, q]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-[1500] border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2">
          <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label="Joanitti — Atlas Genealógico">
            <span className="serif grid h-9 w-9 place-items-center rounded-lg bg-blue text-lg text-card">J</span>
            <span className="serif hidden leading-tight sm:block"><span className="block text-base text-blue">Joanitti</span><span className="block text-[11px] uppercase tracking-widest text-ink2">Atlas Genealógico</span></span>
          </NavLink>
          <nav className="ml-2 hidden flex-1 flex-wrap items-center gap-0.5 xl:flex" aria-label="Principal">
            {NAV.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `rounded-lg px-2 py-1.5 text-[13px] whitespace-nowrap ${isActive ? 'bg-blue text-card' : 'text-ink2 hover:bg-paper2 hover:text-blue'}`}>{l}</NavLink>)}
          </nav>
          <div className="relative ml-auto w-full max-w-[15rem]" ref={box}>
            <input className="input" placeholder="Buscar: nome, variante, lugar, ano…" value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { setOpen(false); nav(`/busca?q=${encodeURIComponent(q)}`); } }} aria-label="Busca global" data-testid="global-search" />
            {open && hits.length > 0 && (
              <ul className="card absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto p-1 shadow-lg" role="listbox">
                {hits.map((h) => <li key={h.type + h.id}><button className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper2" onClick={() => { setOpen(false); setQ(''); nav(h.to); }}>
                  <span className="w-5 shrink-0 text-center">{TYPE_ICON[h.type]}</span><span className="min-w-0"><span className="block truncate">{h.title}</span><span className="block truncate text-xs text-ink2">{h.type} · {h.subtitle}</span></span></button></li>)}
                <li><button className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-blue hover:bg-paper2" onClick={() => { setOpen(false); nav(`/busca?q=${encodeURIComponent(q)}`); }}>Ver todos os resultados e filtros →</button></li>
              </ul>
            )}
          </div>
          <button className="btn px-2.5" title="Alternar tema (auto / claro / escuro)" aria-label="Alternar tema" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}><span className="text-xs">{theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Auto'}</span></button>
          <button className="btn xl:hidden" aria-label="Menu" onClick={() => setMenu(!menu)}><svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M2 4h12M2 8h12M2 12h12" /></svg></button>
        </div>
        {menu && <nav className="grid grid-cols-2 gap-1 border-t border-line p-2 sm:grid-cols-4 xl:hidden">{NAV.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenu(false)} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-blue text-card' : 'bg-card'}`}>{l}</NavLink>)}</nav>}
        <div className="border-t border-line bg-paper2 px-4 py-1 text-xs text-ink2">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-1">
            {admin ? <span><b className="text-ok">● Administrador</b>{preview ? ' — pré-visualizando a visão pública' : ' — vê todos os dados'}</span> : <span><b className="text-sepia">Visão pública</b> — dados de pessoas vivas protegidos.</span>}
            <span className="ml-auto flex items-center gap-2">
              {admin && <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />ver como público</label>}
              {admin ? <button className="underline" onClick={logout}>sair</button> : <button className="underline" onClick={() => setLoginOpen(true)} data-testid="login-open">entrar como administrador</button>}
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1">{loading ? <p className="p-8 text-center text-ink2">Carregando o acervo…</p> : error ? <p className="m-8 rounded-lg border border-bad p-4 text-bad">Não foi possível carregar os dados: {error}. Verifique se a API está em execução (<code>npm run dev</code>).</p> : <Outlet />}</main>
      <footer className="border-t border-line px-4 py-3 text-center text-xs text-ink2">Joanitti Atlas — genealogia baseada em evidências. Hipóteses são exibidas como hipóteses; nada aqui substitui os documentos originais.</footer>
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={login} />}
    </div>
  );
}

function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (t: string) => Promise<boolean> }) {
  const [t, setT] = useState(''); const [err, setErr] = useState('');
  return (
    <Modal title="Entrar como administrador" onClose={onClose}>
      <form onSubmit={async (e) => { e.preventDefault(); if (await onLogin(t)) onClose(); else setErr('Token inválido.'); }} className="space-y-3">
        <p className="text-sm text-ink2">Informe o token administrativo (variável <code>ATLAS_ADMIN_TOKEN</code> do servidor). Ele fica apenas nesta sessão do navegador.</p>
        <input className="input" type="password" autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="Token" data-testid="token-input" />
        {err && <p className="text-sm text-bad">{err}</p>}
        <button className="btn btn-primary" type="submit" data-testid="token-submit">Entrar</button>
      </form>
    </Modal>
  );
}
