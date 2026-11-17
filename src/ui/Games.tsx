import { useState } from 'react';
import CrystalMemory from '../games/CrystalMemory';
import EnchantedGarden from '../games/EnchantedGarden';
import StarHunt from '../games/StarHunt';
import { startSessionOp } from '../domain/ops';
import { GAMES } from '../domain/rules';
import { RULES } from '../domain/rules';
import { creditBalance, gameUnlocked, pendingCredits } from '../domain/selectors';
import type { GameId } from '../domain/types';
import { useApp } from './ctx';

export function GamesScreen() {
  const { state, act, notify } = useApp();
  const [playing, setPlaying] = useState<GameId | null>(null);
  const balance = creditBalance(state);
  const exit = () => setPlaying(null);

  if (playing === 'stars') return <StarHunt onExit={exit} />;
  if (playing === 'crystals') return <CrystalMemory onExit={exit} />;
  if (playing === 'garden') return <EnchantedGarden onExit={exit} />;

  const play = async (id: GameId) => {
    const r = await act(startSessionOp(id));
    if (r.status === 'ok') setPlaying(id);
  };
  return (
    <section className="panel" data-testid="games">
      <h2>Jogos mágicos</h2>
      <p className="credits" data-testid="games-credits">🎮 Créditos: <b>{balance}</b>{pendingCredits(state) ? <small> (+{pendingCredits(state)} a confirmar)</small> : null}</p>
      <p className="muted small">Cada selo do dia vale 1 crédito. Cada vez que você começa um jogo, 1 crédito é usado.</p>
      <div className="game-cards">
        {GAMES.map((g) => {
          const unlocked = gameUnlocked(state, g.id);
          return (
            <div key={g.id} className={`card game-card ${unlocked ? '' : 'locked'}`} data-testid={`game-card-${g.id}`} data-unlocked={unlocked}>
              <div className="game-icon">{g.icon}</div>
              <div>
                <b>{g.name}</b>
                {unlocked ? (
                  <div className="muted small">{balance > 0 ? 'Pronto para jogar!' : 'Ganhe um selo do dia para jogar.'}</div>
                ) : (
                  <div className="muted small">🔒 Conclua a etapa {g.unlockStage} — {RULES.stages[g.unlockStage! - 1].name}</div>
                )}
              </div>
              <button className="btn primary" disabled={!unlocked || balance < 1} data-testid={`play-${g.id}`} onClick={() => play(g.id)}>Jogar (1 🎮)</button>
            </div>
          );
        })}
      </div>
      {gameUnlocked(state, 'garden') && (
        <>
          <h3>Meu jardim</h3>
          <EnchantedGarden readOnly />
        </>
      )}
      <button className="btn" onClick={() => notify('Os jogos não dão selos nem moedas — são só diversão!')}>Como funciona?</button>
    </section>
  );
}
