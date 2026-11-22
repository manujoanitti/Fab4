import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABEL, STATUS_HINT, type Status } from '../../shared/types';

const TONE: Record<Status, string> = {
  documentado: 'border-ok/50 text-ok', fortemente_corroborado: 'border-blue/50 text-blue', hipotese_plausivel: 'border-warn/60 text-warn',
  nao_confirmado: 'border-ink2/40 text-ink2', descartado: 'border-bad/50 text-bad line-through',
};
/** Ícone de estado em SVG: círculo cheio, meio, quarto, vazio ou riscado — a leitura não depende de cor nem de fonte. */
export function StatusIcon({ status, size = 12 }: { status: Status; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className="shrink-0 inline-block align-[-1px]" fill="none" stroke="currentColor" strokeWidth="1.3">
      {status === 'documentado' && <circle cx="6" cy="6" r="5" fill="currentColor" />}
      {status === 'fortemente_corroborado' && <><circle cx="6" cy="6" r="5" /><path d="M6 1 A5 5 0 0 1 6 11 Z" fill="currentColor" /></>}
      {status === 'hipotese_plausivel' && <><circle cx="6" cy="6" r="5" /><path d="M6 6 L6 1 A5 5 0 0 1 11 6 Z" fill="currentColor" /></>}
      {status === 'nao_confirmado' && <circle cx="6" cy="6" r="5" strokeDasharray="2 2" />}
      {status === 'descartado' && <><circle cx="6" cy="6" r="5" /><path d="M3.5 3.5 L8.5 8.5 M8.5 3.5 L3.5 8.5" /></>}
    </svg>
  );
}
export function StatusBadge({ status, small }: { status: Status; small?: boolean }) {
  return <span title={STATUS_HINT[status]} className={`chip ${TONE[status]} ${small ? '' : 'font-medium'}`}><StatusIcon status={status} />{STATUS_LABEL[status]}</span>;
}

export function Page({ title, subtitle, actions, children, wide }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => { document.title = `${title} · Joanitti Atlas`; }, [title]);
  return (
    <div className={`mx-auto w-full ${wide ? 'max-w-[1500px]' : 'max-w-6xl'} px-4 py-6 fade-in`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="serif text-3xl text-blue">{title}</h1>{subtitle && <p className="mt-1 max-w-3xl text-sm text-ink2">{subtitle}</p>}</div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
export const Section = ({ title, children, right, id }: { title: string; children: ReactNode; right?: ReactNode; id?: string }) => (
  <section id={id} className="card mb-4 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="serif text-lg text-blue">{title}</h2>{right}</div>{children}</section>
);
export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-ink2">{children}</p>;
export const Kv = ({ k, children }: { k: string; children: ReactNode }) => <div><div className="label">{k}</div><div className="text-sm">{children ?? '—'}</div></div>;

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal aria-label={title}>
      <div className={`card fade-in mt-8 w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} p-5`}>
        <div className="mb-3 flex items-center justify-between"><h2 className="serif text-xl text-blue">{title}</h2><button className="btn" onClick={onClose} aria-label="Fechar">✕</button></div>
        {children}
      </div>
    </div>
  );
}
export const PersonLink = ({ id, name }: { id: string; name: string }) => <Link className="text-blue underline decoration-line underline-offset-2 hover:decoration-blue" to={`/pessoas/${id}`}>{name}</Link>;
export const Tabs = ({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) => (
  <div className="mb-4 flex flex-wrap gap-1 border-b border-line" role="tablist">
    {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={`-mb-px rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${value === k ? 'border-line bg-card text-blue' : 'border-transparent text-ink2 hover:text-blue'}`}>{l}</button>)}
  </div>
);
export const Stars = ({ n }: { n: number }) => <span title={`Confiabilidade ${n}/5`} className="text-gold" aria-label={`Confiabilidade ${n} de 5`}>{'★'.repeat(n)}<span className="text-line">{'★'.repeat(5 - n)}</span></span>;
