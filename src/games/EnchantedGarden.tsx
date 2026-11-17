import { useEffect, useRef, useState } from 'react';
import { saveGameStateOp, newId } from '../domain/ops';
import { gameState, stageCompleted } from '../domain/selectors';
import { useApp } from '../ui/ctx';
import { addItem, availableItems, moveItem, parseGarden, removeItem, type GardenData } from './gardenLogic';

/** Jardim Encantado: decore o jardim; o resultado é salvo no perfil e sincronizado. Sem compras nem anúncios. */
export default function EnchantedGarden({ onExit, readOnly = false }: { onExit?: () => void; readOnly?: boolean }) {
  const { state, sm, sv, act } = useApp();
  const server = gameState(state, 'garden');
  const [data, setData] = useState<GardenData>(() => parseGarden(server?.data));
  const [kind, setKind] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const dirty = useRef(false);
  const field = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const items = availableItems(stageCompleted(state, 5));

  // Atualiza quando outro aparelho salvou e não há edição local pendente.
  useEffect(() => {
    if (!dirty.current) setData(parseGarden(server?.data));
  }, [server?.version]);

  // Salvamento automático (com pequena espera).
  useEffect(() => {
    if (!dirty.current || readOnly) return;
    const t = setTimeout(async () => {
      dirty.current = false;
      await act(saveGameStateOp(sm.getView().view!, 'garden', data));
    }, 600);
    return () => clearTimeout(t);
  }, [data, readOnly]);

  const edit = (fn: (g: GardenData) => GardenData) => { dirty.current = true; setData(fn); };
  const pos = (e: React.PointerEvent | React.MouseEvent) => {
    const r = field.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const conflict = sv.queue.find((q) => q.status === 'conflict' && q.op.type === 'save_game_state');

  return (
    <div className="game garden" data-testid="game-garden">
      {!readOnly && <div className="game-bar"><span>🌷 Meu jardim</span><span className="muted small">{data.items.length} itens</span>{onExit && <button className="btn" onClick={onExit}>Sair</button>}</div>}
      {conflict && (
        <div className="callout" data-testid="garden-conflict">
          Seu jardim é diferente do que foi salvo em outro aparelho.
          <div className="row">
            <button className="btn" data-testid="garden-keep-server" onClick={async () => { await sm.resolveKeepServer(conflict.op.opId); dirty.current = false; setData(parseGarden(gameState(sm.getView().view!, 'garden')?.data)); }}>Usar o do outro aparelho</button>
            <button className="btn primary" data-testid="garden-use-mine" onClick={() => sm.resolveUseMine(conflict.op.opId)}>Usar o meu</button>
          </div>
        </div>
      )}
      <div
        className={`garden-field ${readOnly ? 'ro' : ''}`}
        ref={field}
        data-testid="garden-field"
        onClick={(e) => {
          if (readOnly || !kind || drag.current?.moved) return;
          const p = pos(e);
          edit((g) => addItem(g, kind, p.x, p.y, newId()));
        }}
      >
        {data.items.map((it) => (
          <span
            key={it.id}
            data-testid="garden-item"
            className={`gitem ${sel === it.id ? 'sel' : ''}`}
            style={{ left: `${it.x}%`, top: `${it.y}%` }}
            onClick={(e) => { e.stopPropagation(); if (!readOnly) setSel(sel === it.id ? null : it.id); }}
            onPointerDown={(e) => { if (readOnly) return; drag.current = { id: it.id, moved: false }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => { if (drag.current?.id === it.id && e.buttons) { drag.current.moved = true; const p = pos(e); edit((g) => moveItem(g, it.id, p.x, p.y)); } }}
            onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
          >{it.kind}</span>
        ))}
        {data.items.length === 0 && <div className="garden-hint">{readOnly ? 'Seu jardim ainda está vazio.' : 'Escolha um item e toque no jardim ✨'}</div>}
      </div>
      {!readOnly && (
        <>
          <div className="palette" role="radiogroup" aria-label="Elementos">
            {items.map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} className={`pal ${kind === k ? 'on' : ''}`} data-testid="palette-item" onClick={() => { setKind(kind === k ? null : k); setSel(null); }}>{k}</button>
            ))}
          </div>
          <div className="row">
            <button className="btn" disabled={!sel} data-testid="garden-remove" onClick={() => { edit((g) => removeItem(g, sel!)); setSel(null); }}>Remover item</button>
            <button className="btn" disabled={!data.items.length} onClick={() => { edit(() => ({ items: [] })); setSel(null); }}>Limpar jardim</button>
          </div>
        </>
      )}
    </div>
  );
}
