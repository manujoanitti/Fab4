import { useEffect, useState } from 'react';

const COLORS = ['#ff80ab', '#ffd54f', '#81d4fa', '#b39ddb', '#a5d6a7', '#ffab91'];
/** Chuva de confete leve em CSS (sem biblioteca). `burst` muda => nova rodada. */
export function Confetti({ burst, big }: { burst: number; big?: boolean }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!burst) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), big ? 3800 : 2400);
    return () => clearTimeout(t);
  }, [burst, big]);
  if (!on) return null;
  const n = big ? 70 : 32;
  return (
    <div className="confetti" aria-hidden="true" data-testid="confetti">
      {Array.from({ length: n }, (_, i) => (
        <i
          key={`${burst}-${i}`}
          style={{
            left: `${(i * 137.5) % 100}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i % 10) * 0.07}s`,
            animationDuration: `${1.6 + (i % 7) * 0.2}s`,
            transform: `rotate(${i * 47}deg)`,
          }}
        />
      ))}
    </div>
  );
}
