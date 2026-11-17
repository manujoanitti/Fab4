import { useEffect, useMemo, useRef, useState } from 'react';
import { SvgArt, artTextSpot } from '../art/components';
import { useArt, useArtEnv } from '../art/context';
import { ART } from '../art/ids';
import type { ArtStateName } from '../art/types';
import { RULES, TOTAL_PHASES, phaseLabel, stageOfPhase } from '../domain/rules';
import { campaignComplete, completedPhases, nextPhase, phaseDone, stageCompleted, stageUnlocked } from '../domain/selectors';
import type { CampaignState } from '../domain/types';
import { MAP_H, MAP_W, RH, SPARKLES, TOP, buildLayout, regionRect, regionTop, smoothPath, type Pt } from './mapGeometry';

// Mapa 2,5D em SVG: 5 regiões empilhadas (etapa 1 embaixo → etapa 5 no topo), 25 casas interativas.
// A GEOMETRIA (posições, áreas clicáveis, trilha) vem de ./mapGeometry; a ARTE vem da camada src/art (por ID lógico),
// sempre com o desenho vetorial abaixo como fallback.
export { MAP_W, nodePos, WALK } from './mapGeometry';

export const STAGE_COLORS = ['#ec6fa0', '#9b7fd4', '#4aaee6', '#f0b429', '#e8548c'];
const THEMES = [
  ['#c9ecb0', '#8fd194'],
  ['#ece3fa', '#cfbcf0'],
  ['#c4eafc', '#90d2f4'],
  ['#e4ecf8', '#b9cae7'],
  ['#ffe6f0', '#fbc2d8'],
];

const wavyTop = (y: number, h: number) => {
  let d = `M0,${y + 14}`;
  for (let x = 0; x <= MAP_W; x += 50) d += ` Q${x + 25},${y - 4 + ((x / 50) % 2 ? 14 : 0)} ${x + 50},${y + 14}`;
  return d + ` L${MAP_W},${y + h} L0,${y + h} Z`;
};

// ---------- Decorações ----------
const Tree = ({ x, y, s = 1, c = '#5fb36b' }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <ellipse cx="0" cy="24" rx="20" ry="5" fill="#000" opacity=".1" />
    <rect x="-4" y="0" width="8" height="24" rx="3" fill="#8d6e63" />
    <circle cy="-6" r="22" fill={c} />
    <circle cx="-8" cy="-13" r="9" fill="#fff" opacity=".2" />
  </g>
);
const Pine = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <rect x="-3" y="14" width="6" height="12" fill="#795548" />
    <polygon points="0,-34 -20,2 20,2" fill="#3f8f5c" />
    <polygon points="0,-18 -24,16 24,16" fill="#4aa56b" />
  </g>
);
const Flower = ({ x, y, c = '#ff8fb8', s = 1 }: { x: number; y: number; c?: string; s?: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    {[0, 72, 144, 216, 288].map((a) => (
      <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 6} cy={Math.sin((a * Math.PI) / 180) * 6} r="5" fill={c} />
    ))}
    <circle r="3.5" fill="#ffe27a" />
  </g>
);
const Castle = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <ellipse cx="0" cy="70" rx="80" ry="9" fill="#000" opacity=".1" />
    {[[-56, 30], [56, 30], [-30, 6], [30, 6]].map(([tx, th], i) => (
      <g key={i}>
        <rect x={tx - 12} y={70 - th - 40} width="24" height={th + 40} fill="#fbe9f0" stroke="#e6c5d6" />
        <polygon points={`${tx - 16},${70 - th - 40} ${tx},${70 - th - 78} ${tx + 16},${70 - th - 40}`} fill="#9575cd" />
        <rect x={tx - 3} y={70 - th - 24} width="6" height="10" rx="3" fill="#ffd54f" />
      </g>
    ))}
    <rect x="-34" y="-8" width="68" height="78" fill="#fff3f8" stroke="#e6c5d6" />
    <polygon points="-40,-8 0,-62 40,-8" fill="#7e57c2" />
    <path d="M-12,70 v-26 a12,12 0 0 1 24,0 v26 z" fill="#8d6e63" />
    <line x1="0" y1="-62" x2="0" y2="-82" stroke="#795548" strokeWidth="2" />
    <polygon points="0,-82 16,-77 0,-72" fill="#ec6fa0" />
  </g>
);
const Crystal = ({ x, y, s = 1, c = '#b39ddb' }: { x: number; y: number; s?: number; c?: string }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <polygon points="0,-40 10,-10 0,10 -10,-10" fill={c} />
    <polygon points="-16,-20 -8,0 -16,12 -24,0" fill={c} opacity=".8" />
    <polygon points="16,-14 24,6 16,14 8,6" fill={c} opacity=".8" />
    <polygon points="0,-40 10,-10 0,-14" fill="#fff" opacity=".4" />
  </g>
);
const Mountain = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <g>
    <polygon points={`${x - w / 2},${y} ${x},${y - h} ${x + w / 2},${y}`} fill="#8aa4cf" />
    <polygon points={`${x},${y - h} ${x + w / 2},${y} ${x + w * 0.1},${y}`} fill="#6f8bbd" opacity=".6" />
    <polygon points={`${x - w * 0.14},${y - h * 0.72} ${x},${y - h} ${x + w * 0.14},${y - h * 0.72} ${x + w * 0.05},${y - h * 0.8} ${x - w * 0.04},${y - h * 0.7}`} fill="#fff" />
  </g>
);
const Lily = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x},${y})`}>
    <ellipse rx="16" ry="6" fill="#5cb85c" />
    <circle cy="-3" r="5" fill="#ff9ec7" />
  </g>
);
const Lantern = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x},${y})`}>
    <line y1="-20" y2="0" stroke="#795548" strokeWidth="2" />
    <rect x="-6" y="0" width="12" height="16" rx="4" fill="#ffd54f" />
    <circle cy="8" r="14" fill="#ffe082" opacity=".35" />
  </g>
);

function Decor({ stage }: { stage: number }) {
  switch (stage) {
    case 1:
      return (
        <g>
          <Tree x={40} y={90} s={1.3} /><Tree x={360} y={150} s={1.1} c="#6bc17a" /><Tree x={50} y={300} s={1} c="#58a867" />
          <Tree x={355} y={400} s={1.4} /><Tree x={42} y={470} s={1.2} c="#6bc17a" />
          <circle cx="330" cy="260" r="11" fill="#ffb3c7" /><rect x="326" y="266" width="8" height="12" fill="#fff4e0" />
          {[[70, 200], [330, 330], [90, 420], [320, 80]].map(([a, b], i) => <Flower key={i} x={a} y={b} c={['#ff8fb8', '#fff', '#ffd54f', '#ce93d8'][i]} />)}
        </g>
      );
    case 2:
      return (
        <g>
          <Castle x={200} y={150} s={0.8} />
          <Tree x={45} y={240} s={0.9} c="#b39ddb" /><Tree x={355} y={300} s={1} c="#ce93d8" />
          {[[60, 120], [340, 90], [70, 400], [335, 460]].map(([a, b], i) => <Flower key={i} x={a} y={b} c="#f48fb1" />)}
          <path d="M30,60 q10,-14 20,0 q10,-14 20,0" fill="none" stroke="#fff" strokeWidth="3" opacity=".7" />
        </g>
      );
    case 3:
      return (
        <g>
          <ellipse cx="200" cy="260" rx="170" ry="210" fill="#7fcdf2" opacity=".6" />
          <path d="M40,200 q20,-8 40,0 M290,320 q20,-8 40,0 M60,400 q20,-8 40,0 M250,120 q20,-8 40,0" stroke="#fff" strokeWidth="2.5" fill="none" opacity=".8" />
          <Lily x={60} y={300} /><Lily x={340} y={210} /><Lily x={330} y={430} /><Lily x={70} y={130} />
          <Crystal x={36} y={80} s={0.9} /><Crystal x={366} y={470} s={1} c="#90caf9" /><Crystal x={30} y={480} s={0.8} c="#ce93d8" />
        </g>
      );
    case 4:
      return (
        <g>
          <Mountain x={70} y={160} w={170} h={140} /><Mountain x={330} y={120} w={190} h={150} /><Mountain x={60} y={420} w={150} h={120} />
          <Mountain x={345} y={470} w={160} h={110} />
          <Pine x={30} y={250} s={0.9} /><Pine x={372} y={260} s={1} /><Pine x={40} y={320} s={0.8} /><Pine x={365} y={340} s={0.9} />
          <line x1="200" y1="40" x2="200" y2="75" stroke="#795548" strokeWidth="3" /><polygon points="200,40 228,50 200,60" fill="#f0b429" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M140,140 v-70 a60,60 0 0 1 120,0 v70" fill="none" stroke="#f48fb1" strokeWidth="10" />
          {[[150, 80], [170, 38], [200, 24], [230, 38], [250, 80]].map(([a, b], i) => <Flower key={i} x={a} y={b} c={i % 2 ? '#ff80ab' : '#fff'} s={0.9} />)}
          <Lantern x={128} y={80} /><Lantern x={272} y={80} />
          <Tree x={45} y={210} s={1.1} c="#f48fb1" /><Tree x={355} y={230} s={1.2} c="#f8bbd0" /><Tree x={50} y={430} s={1.2} c="#f06292" />
          {[[330, 330], [70, 330], [320, 470], [90, 500], [340, 140], [60, 160]].map(([a, b], i) => <Flower key={i} x={a} y={b} c={['#ff80ab', '#ce93d8', '#fff', '#ffd54f'][i % 4]} />)}
        </g>
      );
  }
}

// ---------- Personagem ----------
function Bianca() {
  return (
    <g className="bianca">
      <ellipse cx="0" cy="22" rx="16" ry="5" fill="#000" opacity=".18" />
      <g className="bianca-bob">
        <ellipse cx="-17" cy="-4" rx="12" ry="7" fill="#b3e5fc" opacity=".75" transform="rotate(-25 -17 -4)" />
        <ellipse cx="17" cy="-4" rx="12" ry="7" fill="#b3e5fc" opacity=".75" transform="rotate(25 17 -4)" />
        <circle cy="-24" r="13" fill="#8d5524" />
        <path d="M-9,0 L9,0 L15,22 L-15,22 Z" fill="#f48fb1" />
        <circle cy="-1" r="9" fill="#ffd9b8" transform="translate(0,-12)" />
        <path d="M-10,-26 q10,-14 20,0 q-3,-4 -10,-4 q-7,0 -10,4z" fill="#8d5524" />
        <circle cx="-3.5" cy="-14" r="1.5" fill="#4e342e" /><circle cx="3.5" cy="-14" r="1.5" fill="#4e342e" />
        <path d="M-3,-9 q3,3 6,0" stroke="#c2185b" strokeWidth="1.5" fill="none" />
        <polygon points="-6,-33 -3,-40 0,-34 3,-40 6,-33" fill="#ffd54f" />
      </g>
    </g>
  );
}

export function useWalker(target: number) {
  const [idx, setIdx] = useState(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; setIdx(target); return; }
    if (target < idx) { setIdx(target); return; }
    if (target === idx) return;
    const t = setTimeout(() => setIdx((i) => i + 1), 520);
    return () => clearTimeout(t);
  }, [target, idx]);
  return idx;
}

export interface MapViewProps {
  state: CampaignState;
  onSelect: (phase: number) => void;
  onBonus: () => void;
  /** Fase com a folha de detalhes aberta (estado visual "selecionado"). */
  selected?: number | null;
}

/** Casa de fase: área clicável própria (inalterada) + arte por estado (ou o círculo vetorial de fallback). */
function PhaseNode({ p, x, y, isDone, isNext, selected, priority, onSelect }: { p: number; x: number; y: number; isDone: boolean; isNext: boolean; selected: boolean; priority: 'high' | 'low'; onSelect: (p: number) => void }) {
  const s = stageOfPhase(p);
  const locked = !isDone && !isNext;
  const c = STAGE_COLORS[s - 1];
  const artState: ArtStateName = isDone ? 'done' : isNext ? 'available' : 'locked';
  const art = useArt(ART.map.node(s, artState), priority);
  return (
    <g
      transform={`translate(${x},${y})`}
      className={`node ${isDone ? 'done' : ''} ${isNext ? 'next' : ''} ${locked ? 'locked' : ''}`}
      data-testid={`phase-${p}`}
      data-state={isDone ? 'done' : isNext ? 'next' : 'locked'}
      data-selected={selected ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={`Fase ${phaseLabel(p)}${isDone ? ', concluída' : isNext ? ', próxima fase' : ', bloqueada'}`}
      onClick={() => onSelect(p)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(p)}
    >
      {/* com arte, o halo pulsante cede lugar ao anel de seleção (evita sobreposição de dois indicadores) */}
      {isNext && !(selected && art) && <circle r="30" className="pulse" fill={c} opacity=".35" />}
      {art ? (
        <>
          <circle r="28" fill="transparent" />
          <SvgArt ids={ART.map.node(s, artState)} at={{ x: 0, y: 0 }} priority={priority} />
        </>
      ) : (
        <circle r="25" fill={isDone ? '#fff8e1' : '#fff'} stroke={isDone ? '#ffb300' : c} strokeWidth={isDone ? 5 : 4} />
      )}
      {selected && <SvgArt ids={ART.map.nodeSelected(s)} at={{ x: 0, y: 0 }} priority={priority} pointerEvents="none" />}
      {isDone ? (art ? null : <text y="8" textAnchor="middle" className="node-star">⭐</text>) : art ? (
        // Com arte externa o número precisa ser legível sobre QUALQUER cor: texto escuro com contorno branco.
        <text y="5" textAnchor="middle" className="node-label" fill="#37474f" stroke="#fff" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">{phaseLabel(p)}</text>
      ) : <text y="5" textAnchor="middle" className="node-label" fill={locked ? '#9e9e9e' : '#37474f'}>{phaseLabel(p)}</text>}
      {isDone && <text y="-30" textAnchor="middle" className="node-mini">{phaseLabel(p)}</text>}
    </g>
  );
}

/** Faixa do nome da região: arte (inclusive em fatias adaptáveis) com o texto desenhado pelo app dentro da área reservada. */
function RegionRibbon({ stage, name, sub, priority }: { stage: number; name: string; sub: string; priority: 'high' | 'low' }) {
  const art = useArt(ART.map.ribbon(stage), priority);
  const c = STAGE_COLORS[stage - 1];
  const spot = artTextSpot(art, { x: 0, y: 0 });
  return (
    <>
      <SvgArt ids={ART.map.ribbon(stage)} at={{ x: 0, y: 0 }} priority={priority}
        fallback={<rect x="-118" y="-17" width="236" height="34" rx="17" fill={c} stroke="#fff" strokeWidth="3" />} />
      {spot ? (
        <text textAnchor="middle" x={spot.cx} y={spot.cy + 5} className="ribbon-text" stroke="#a23d6b" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">Etapa {stage} · {name}</text>
      ) : (
        <text textAnchor="middle" y="5" className="ribbon-text">Etapa {stage} · {name}</text>
      )}
      <text textAnchor="middle" y="36" className="ribbon-sub">{sub}</text>
    </>
  );
}

/** Marco "Início": a base do poste é a âncora da arte; o texto vai para a área reservada na placa (ou na posição padrão sem arte). */
function StartSign({ priority }: { priority: 'high' | 'low' }) {
  const art = useArt(ART.map.start, priority);
  const spot = artTextSpot(art, { x: 0, y: 46 });
  return (
    <>
      <SvgArt ids={ART.map.start} at={{ x: 0, y: 46 }} priority={priority}
        fallback={<><rect x="-4" y="0" width="8" height="46" fill="#8d6e63" /><rect x="-34" y="-8" width="72" height="30" rx="8" fill="#e8c28c" stroke="#a1743d" strokeWidth="2" /></>} />
      {spot ? (
        <text x={spot.cx} y={spot.cy + 5} textAnchor="middle" className="sign-text" stroke="#fff1d6" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke">Início</text>
      ) : (
        <text x="2" y="12" textAnchor="middle" className="sign-text">Início</text>
      )}
    </>
  );
}

function BonusNode({ at, complete, onBonus }: { at: Pt; complete: boolean; onBonus: () => void }) {
  const art = useArt(ART.map.bonus(complete), 'low');
  return (
    <g transform={`translate(${at.x},${at.y})`} className={`bonus ${complete ? 'unlocked' : ''}`} role="button" tabIndex={0} aria-label="Bônus final" data-testid="bonus-node" onClick={onBonus} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onBonus()}>
      {art ? (
        <>
          <circle r="34" fill="transparent" />
          <SvgArt ids={ART.map.bonus(complete)} at={{ x: 0, y: 0 }} priority="low" />
        </>
      ) : (
        <>
          <circle r="34" fill="#fff8e1" stroke="#ffb300" strokeWidth="5" opacity={complete ? 1 : 0.7} />
          <text y="12" textAnchor="middle" fontSize="34">{complete ? '👑' : '🎁'}</text>
        </>
      )}
      <text y="52" textAnchor="middle" className="node-mini">Bônus final</text>
    </g>
  );
}

/** Personagem: sprite da animação atual (cai para idle enquanto a nova carrega) ou o vetor atual. */
function BiancaActor({ anim }: { anim: 'idle' | 'walk' | 'celebrate' }) {
  const ids = anim === 'idle' ? [ART.char.bianca('idle')] : [ART.char.bianca(anim), ART.char.bianca('idle')];
  return <SvgArt ids={ids} at={{ x: 0, y: 22 }} priority="high" fallback={<Bianca />} />;
}

function Sparkle({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <SvgArt ids={ART.fx.sparkle} at={{ x: x + 9, y: y - 5 }} priority="low" className="sparkle" style={{ animationDelay: `${i * 0.4}s` }}
      fallback={<text x={x} y={y} className="sparkle" style={{ animationDelay: `${i * 0.4}s` }}>✨</text>} />
  );
}

export default function MapView({ state, onSelect, onBonus, selected = null }: MapViewProps) {
  const { registry } = useArtEnv();
  const layout = useMemo(() => buildLayout(registry.layout()), [registry]);
  const { start: START, bonus: BONUS, walk: WALK } = layout;
  const done = completedPhases(state);
  const complete = campaignComplete(state);
  const walkTarget = complete ? 26 : done;
  const at = useWalker(walkTarget);
  const pos = WALK[at];
  const next = nextPhase(state);
  const scroller = useRef<HTMLDivElement>(null);
  const path = useMemo(() => smoothPath(WALK), [WALK]);
  const progressRatio = at / 26;
  const curStage = stageOfPhase(Math.min(TOTAL_PHASES, done + 1));
  /** Regiões próximas da posição atual carregam primeiro; as demais em segundo plano. */
  const prio = (s: number): 'high' | 'low' => (Math.abs(s - curStage) <= 1 ? 'high' : 'low');
  const stages = [1, 2, 3, 4, 5];
  // Há arte de trilha em alguma região? Então o traçado padrão é recortado nessas regiões.
  const pathArt = stages.map((s) => useArt(ART.map.regionPath(s), prio(s)));
  const anyPathArt = pathArt.some(Boolean);

  // Efeito de progressão: ao chegar a uma casa recém-concluída (só existe com arte; sem arte nada muda).
  const burstArt = useArt(ART.fx.nodeComplete, 'low');
  const [burst, setBurst] = useState<{ phase: number; key: number } | null>(null);
  const prevAt = useRef(at);
  useEffect(() => {
    if (at > prevAt.current && at >= 1 && at <= TOTAL_PHASES) setBurst({ phase: at, key: Date.now() });
    prevAt.current = at;
  }, [at]);
  useEffect(() => {
    if (!burst || !burstArt) return;
    const sp = burstArt.sprite;
    const t = setTimeout(() => setBurst(null), (sp ? (sp.frames / sp.fps) * 1000 : 1000) + 150);
    return () => clearTimeout(t);
  }, [burst, burstArt]);

  // Rola para a posição atual ao abrir e quando a personagem avança.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const scale = el.clientWidth / MAP_W;
    el.scrollTo({ top: Math.max(0, pos.y * scale - el.clientHeight * 0.55), behavior: 'smooth' });
  }, [pos.y]);

  const trail = (
    <>
      <path d={path} fill="none" stroke="#f3d9b1" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke="#fff5e4" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke="#e7c58f" strokeWidth="3" strokeDasharray="2 12" strokeLinecap="round" />
    </>
  );

  return (
    <div className="map-scroll" ref={scroller} data-testid="map">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="map-svg" role="img" aria-label="Mapa do Reino da Bianca">
        <defs>
          {THEMES.map(([a, b], i) => (
            <linearGradient id={`rg${i + 1}`} key={i} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
          ))}
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe3ff" /><stop offset="1" stopColor="#fff0f7" /></linearGradient>
        </defs>
        <rect width={MAP_W} height={MAP_H} fill="url(#sky)" />
        {/* regiões, da etapa 5 (topo) para a 1: fundo e decoração de segundo plano */}
        {[5, 4, 3, 2, 1].map((s) => (
          <g key={s} data-region={s}>
            <SvgArt ids={ART.map.regionBg(s)} rect={regionRect(s)} priority={prio(s)}
              fallback={<path d={wavyTop(regionTop(s) - 14, RH + 14 + (s === 1 ? 130 : 0))} fill={`url(#rg${s})`} />} />
            <SvgArt ids={ART.map.regionMid(s)} rect={regionRect(s)} priority={prio(s)}
              fallback={<g transform={`translate(0,${regionTop(s)})`}><Decor stage={s} /></g>} />
          </g>
        ))}
        <SvgArt ids={ART.map.topBg} rect={{ x: 0, y: 0, w: MAP_W, h: TOP }} priority={prio(5)} />
        <SvgArt ids={ART.map.bottomBg} rect={{ x: 0, y: TOP + 5 * RH, w: MAP_W, h: MAP_H - TOP - 5 * RH }} priority={prio(1)} />
        {/* trilha (traçado padrão; recortado onde há arte de trilha) */}
        {anyPathArt ? (
          <>
            <defs>
              <clipPath id="trail-clip">
                <rect x="0" y="0" width={MAP_W} height={TOP} />
                <rect x="0" y={TOP + 5 * RH} width={MAP_W} height={MAP_H - TOP - 5 * RH} />
                {stages.filter((s) => !pathArt[s - 1]).map((s) => <rect key={s} {...regionRect(s)} width={MAP_W} height={RH} />)}
              </clipPath>
            </defs>
            <g clipPath="url(#trail-clip)">{trail}</g>
          </>
        ) : trail}
        {stages.map((s) => <SvgArt key={s} ids={ART.map.regionPath(s)} rect={regionRect(s)} priority={prio(s)} />)}
        <path d={path} fill="none" stroke="#ffd54f" strokeWidth="7" strokeLinecap="round" pathLength={1} strokeDasharray={`${progressRatio} 1`} opacity=".85" />

        {/* faixas com o nome das regiões (o texto é sempre desenhado pelo app) */}
        {RULES.stages.map((st) => {
          const unlocked = stageUnlocked(state, st.stage);
          const finished = stageCompleted(state, st.stage);
          return (
            <g key={st.stage} transform={`translate(200,${regionTop(st.stage) + 36})`} data-testid={`region-${st.stage}`} data-unlocked={unlocked} data-completed={finished}>
              <RegionRibbon stage={st.stage} name={st.name} sub={finished ? '✓ etapa concluída' : unlocked ? '' : '🔒 conclua a etapa anterior'} priority={prio(st.stage)} />
            </g>
          );
        })}
        {/* véu nas regiões bloqueadas */}
        {RULES.stages.filter((st) => !stageUnlocked(state, st.stage)).map((st) => (
          <SvgArt key={st.stage} ids={ART.map.fog} rect={regionRect(st.stage)} pointerEvents="none" priority={prio(st.stage)}
            fallback={<rect x="0" y={regionTop(st.stage)} width={MAP_W} height={RH} fill="#fff" opacity=".38" pointerEvents="none" />} />
        ))}

        {/* Início (a base do poste é a âncora da arte; o texto é do app) */}
        <g transform={`translate(${START.x - 80},${START.y - 8})`}>
          <StartSign priority={prio(1)} />
        </g>

        {/* casas */}
        {Array.from({ length: TOTAL_PHASES }, (_, i) => i + 1).map((p) => (
          <PhaseNode key={p} p={p} x={layout.nodes[p - 1].x} y={layout.nodes[p - 1].y} isDone={phaseDone(state, p)} isNext={p === next} selected={selected === p} priority={prio(stageOfPhase(p))} onSelect={onSelect} />
        ))}

        {/* Bônus final */}
        <BonusNode at={BONUS} complete={complete} onBonus={onBonus} />

        {/* efeito de progressão (somente com arte) */}
        {burst && burstArt && <SvgArt key={burst.key} ids={ART.fx.nodeComplete} at={layout.nodes[burst.phase - 1]} pointerEvents="none" once />}

        {/* personagem */}
        <g className="walker" style={{ transform: `translate(${pos.x}px,${pos.y - 10}px)` }} data-testid="bianca" data-at={at}>
          <BiancaActor anim={at !== walkTarget ? 'walk' : complete && at === 26 ? 'celebrate' : 'idle'} />
        </g>
        {/* primeiro plano (à frente da personagem; sem capturar toques) */}
        {stages.map((s) => <SvgArt key={s} ids={ART.map.regionFg(s)} rect={regionRect(s)} pointerEvents="none" priority={prio(s)} />)}
        {/* brilhos */}
        {SPARKLES.map(({ x, y }, i) => <Sparkle key={i} x={x} y={y} i={i} />)}
      </svg>
    </div>
  );
}
