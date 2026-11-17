import { useEffect, useState } from 'react';
import { closeOpen, columnsForPairs, flip, isWon, newGame, pairsForLevel, type MemoryState } from './memoryLogic';
import { Icon } from '../art/components';
import { ART } from '../art/ids';
import { symbolSlug } from './crystalSymbols';

const symbolArt = (emoji: string) => { const slug = symbolSlug(emoji); return slug ? ART.game.crystalsSymbol(slug) : null; };

/** Memória dos Cristais: encontre os pares. A dificuldade aumenta a cada nível. */
export default function CrystalMemory({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState(1);
  const [g, setG] = useState<MemoryState>(() => newGame(1));

  useEffect(() => {
    if (!g.locked) return;
    const t = setTimeout(() => setG((s) => closeOpen(s)), 800);
    return () => clearTimeout(t);
  }, [g.locked, g.open]);

  const won = isWon(g);
  const cols = columnsForPairs(pairsForLevel(level));
  return (
    <div className="game memory" data-testid="game-crystals">
      <div className="game-bar"><span>Nível {level}</span><span>Jogadas: <b data-testid="memory-moves">{g.moves}</b></span><button className="btn" onClick={onExit}>Sair</button></div>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {g.cards.map((c, i) => {
          const up = c.matched || g.open.includes(i);
          return (
            <button key={c.id} className={`mcard ${up ? 'up' : ''} ${c.matched ? 'matched' : ''}`} data-testid="mcard" data-symbol={c.symbol} aria-label={up ? c.symbol : 'carta virada'} onClick={() => setG((s) => flip(s, i))}>
              <span>{up ? <Icon id={symbolArt(c.symbol)} fallback={c.symbol} fill /> : <Icon id={ART.game.crystalsBack} fallback="❔" fill />}</span>
            </button>
          );
        })}
      </div>
      {won && (
        <div className="game-over" data-testid="memory-won">
          <h3>Todos os pares! 💎</h3>
          <div className="row">
            <button className="btn primary" data-testid="memory-next" onClick={() => { setLevel(level + 1); setG(newGame(level + 1)); }}>Próximo nível</button>
            <button className="btn" onClick={onExit}>Voltar ao reino</button>
          </div>
        </div>
      )}
      <p className="muted small center">Este jogo é só diversão: não muda selos, moedas nem metas.</p>
    </div>
  );
}
