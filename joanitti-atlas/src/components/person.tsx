import { Link } from 'react-router-dom';
import type { Person } from '../lib/model';
import { personDates } from '../lib/model';
import { useAtlas } from '../lib/api';
import { StatusBadge } from './ui';

export function Avatar({ p, size = 40 }: { p: Person; size?: number }) {
  const { snap } = useAtlas();
  const color = snap?.nuclei.find((n: any) => n.id === p.nucleusIds[0])?.color ?? '#6b7280';
  if (p.avatar_url && !p.redacted) return <img src={p.avatar_url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />;
  const initials = p.redacted ? '🔒' : p.preferred_name.split(' ').filter((w) => /^[A-ZÀ-Ý]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
  return <span aria-hidden style={{ width: size, height: size, background: color, fontSize: size * 0.36 }} className="serif grid shrink-0 place-items-center rounded-full text-white">{initials}</span>;
}

export function PersonCard({ p }: { p: Person }) {
  const { snap, ix } = useAtlas();
  const origin = ix?.placePath(p.birth_place_id)?.split(',')[0];
  return (
    <Link to={`/pessoas/${p.id}`} className="card flex items-start gap-3 p-3 transition hover:border-blue" data-testid="person-card">
      <Avatar p={p} />
      <div className="min-w-0 flex-1">
        <div className="serif truncate text-base text-ink">{p.preferred_name}</div>
        <div className="text-xs text-ink2">{personDates(p) || 'sem datas'}{origin ? ` · ${origin}` : ''}</div>
        <div className="mt-1.5 flex flex-wrap gap-1"><StatusBadge status={p.verification_status} small />
          {p.nucleusIds.slice(0, 1).map((n) => <span key={n} className="chip max-w-[12rem] truncate">{snap?.nuclei.find((x: any) => x.id === n)?.name.split('—')[0]}</span>)}</div>
      </div>
    </Link>
  );
}
