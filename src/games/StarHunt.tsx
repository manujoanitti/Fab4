import { useEffect, useRef, useState } from 'react';

interface Star { id: number; x: number; y: number; size: number; hit?: boolean }

/** Caça às Estrelas: toque nas estrelas antes que sumam. Totalmente offline. */
export default function StarHunt({ duration = 30, onExit }: { duration?: number; onExit: () => void }) {
  const [stars, setStars] = useState<Star[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(duration);
  const nextId = useRef(1);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  useEffect(() => {
    if (left <= 0) return;
    const spawn = setInterval(() => {
      setStars((cur) => {
        if (cur.filter((s) => !s.hit).length >= 4) return cur;
        const id = nextId.current++;
        const s: Star = { id, x: 8 + Math.random() * 80, y: 8 + Math.random() * 78, size: 44 + Math.random() * 26 };
        setTimeout(() => setStars((c) => c.filter((x) => x.id !== id)), 1900);
        return [...cur, s];
      });
    }, 600);
    return () => clearInterval(spawn);
  }, [left <= 0]);

  const tap = (id: number) => {
    setScore((n) => n + 1);
    setStars((c) => c.map((s) => (s.id === id ? { ...s, hit: true } : s)));
    setTimeout(() => setStars((c) => c.filter((s) => s.id !== id)), 450);
  };
  const over = left <= 0;
  return (
    <div className="game stars" data-testid="game-stars">
      <div className="game-bar"><span>⏱ {Math.max(0, left)}s</span><span>⭐ <b data-testid="stars-score">{score}</b></span><button className="btn" onClick={onExit}>Sair</button></div>
      <div className="sky-field">
        {!over && stars.map((s) => (
          <button key={s.id} data-testid="star" className={`star ${s.hit ? 'hit' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.size }} onPointerDown={() => !s.hit && tap(s.id)} aria-label="Estrela">
            {s.hit ? '✨' : '⭐'}
          </button>
        ))}
        {over && (
          <div className="game-over" data-testid="stars-over">
            <h3>Muito bem! 🌟</h3>
            <p>Você pegou <b>{score}</b> estrelas!</p>
            <button className="btn primary" onClick={onExit}>Voltar ao reino</button>
          </div>
        )}
      </div>
      <p className="muted small center">Este jogo é só diversão: não muda selos, moedas nem metas.</p>
    </div>
  );
}
