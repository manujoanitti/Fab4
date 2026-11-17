import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useArt, useArtEnv } from './context';
import { CSS_ART, cssVarName } from './ids';
import type { ArtBox, ResolvedArt } from './types';

type Ids = string | readonly string[] | null | undefined;

/** Tira horizontal de quadros animada por CSS (steps). Funciona dentro de SVG (aninhado) e em HTML (<svg> inline). */
export function SpriteStrip({ art, x = 0, y = 0, w, h, className, once }: { art: ResolvedArt; x?: number | string; y?: number | string; w: number | string; h: number | string; className?: string; once?: boolean }) {
  const s = art.sprite;
  if (!s) return null;
  const loop = !once && s.loop !== false;
  const shift = -(loop ? s.frames : s.frames - 1) * s.frameW;
  const steps = loop ? s.frames : Math.max(1, s.frames - 1);
  const style = { '--art-shift': `${shift}px`, animation: `art-sprite-run ${(s.frames / s.fps).toFixed(3)}s steps(${steps}) ${loop ? 'infinite' : '1 forwards'}` } as CSSProperties;
  return (
    <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${s.frameW} ${s.frameH}`} className={className} overflow="hidden" aria-hidden="true" data-art={art.id}>
      <image href={art.url} x="0" y="0" width={s.frameW * s.frames} height={s.frameH} preserveAspectRatio="none" className="art-sprite" style={style} />
    </svg>
  );
}

/** Ícone no fluxo do texto (1em). Sem arte → renderiza exatamente o `fallback` (ex.: o emoji atual). */
export function Icon({ id, fallback, fill, className, alt = '', priority }: { id: Ids; fallback: ReactNode; fill?: boolean; className?: string; alt?: string; priority?: 'high' | 'low' }) {
  const art = useArt(id, priority);
  if (!art) return <>{fallback}</>;
  const cls = [fill ? 'art-fill' : 'art-icon', className].filter(Boolean).join(' ');
  if (art.kind === 'sprite') return <SpriteStrip art={art} w={fill ? '100%' : '1em'} h={fill ? '100%' : '1em'} className={cls} />;
  return <img src={art.url} className={cls} alt={alt} aria-hidden={alt ? undefined : true} draggable={false} decoding="async" data-art={art.id} />;
}

/** Largura nativa (em unidades do mapa) do arquivo, na altura `h` da caixa: base da escala das pontas de um recurso em fatias. */
const nativeWidth = (art: ResolvedArt, h: number) => (art.nativeBox ? (art.nativeBox.w / art.nativeBox.h) * h : h);
/** Imagem horizontal adaptável: pontas na escala nativa, miolo esticado até a largura da caixa (sem mudar a altura). */
function SlicedImage({ art, x, y, w, h, className, style, opacity, pointerEvents }: { art: ResolvedArt; x: number; y: number; w: number; h: number; className?: string; style?: CSSProperties; opacity?: number | string; pointerEvents?: 'none' | 'auto' }) {
  const { l, r } = art.slice!;
  const nat = nativeWidth(art, h);
  const capL = l * nat, capR = r * nat, mid = Math.max(0, w - capL - capR);
  const part = (f0: number, f1: number, px: number, pw: number, k: string) => (
    <svg key={k} x={px} y={y} width={pw} height={h} viewBox={`${f0} 0 ${f1 - f0} 1`} preserveAspectRatio="none" overflow="hidden" className={className} style={style} opacity={opacity} pointerEvents={pointerEvents}>
      <image href={art.url} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
    </svg>
  );
  return <g data-art={art.id} data-sliced="true">{part(0, l, x, capL, 'l')}{part(l, 1 - r, x + capL, mid, 'm')}{part(1 - r, 1, x + capL + mid, capR, 'r')}</g>;
}

/** Centro e largura da área de texto do recurso (coordenadas do mapa), ou null se o recurso não declara `textArea`. */
export function artTextSpot(art: ResolvedArt | null, at: { x: number; y: number }, box?: ArtBox): { cx: number; cy: number; w: number } | null {
  const b = box ?? art?.box;
  if (!art || !art.textArea || !b) return null;
  const x0 = at.x - art.anchor.x * b.w + art.offset.x, y0 = at.y - art.anchor.y * b.h + art.offset.y;
  const mapX = (f: number) => {
    if (!art.slice) return f * b.w;
    const { l, r } = art.slice, nat = nativeWidth(art, b.h), capL = l * nat, capR = r * nat, mid = Math.max(0, b.w - capL - capR);
    return f <= l ? f * nat : f >= 1 - r ? b.w - (1 - f) * nat : capL + ((f - l) / (1 - l - r)) * mid;
  };
  const a = art.textArea, xa = mapX(a.x), xb = mapX(a.x + a.w);
  return { cx: x0 + (xa + xb) / 2, cy: y0 + (a.y + a.h / 2) * b.h, w: xb - xa };
}

export interface SvgArtProps {
  ids: Ids;
  /** Ponto lógico + âncora/tamanho do recurso. */
  at?: { x: number; y: number };
  /** Ou retângulo exato (faixas de fundo): ignora âncora. */
  rect?: { x: number; y: number; w: number; h: number };
  box?: ArtBox;
  fallback?: ReactNode;
  priority?: 'high' | 'low';
  className?: string;
  opacity?: number | string;
  pointerEvents?: 'none' | 'auto';
  once?: boolean;
  style?: CSSProperties;
}
/** Imagem/sprite dentro de um <svg>, posicionada por ponto lógico + âncora ou por retângulo. Sem arte → `fallback`. */
export function SvgArt({ ids, at, rect, box, fallback = null, priority, className, opacity, pointerEvents, once, style }: SvgArtProps) {
  const art = useArt(ids, priority);
  if (!art) return <>{fallback}</>;
  const b = rect ?? box ?? art.box;
  if (!b || (!rect && !at)) return <>{fallback}</>;
  const w = 'w' in b ? b.w : 0, h = 'h' in b ? b.h : 0;
  const x = rect ? rect.x : at!.x - art.anchor.x * w + art.offset.x;
  const y = rect ? rect.y : at!.y - art.anchor.y * h + art.offset.y;
  if (art.kind === 'sprite') return <SpriteStrip art={art} x={x} y={y} w={w} h={h} className={className} once={once} />;
  if (art.slice && !rect) return <SlicedImage art={art} x={x} y={y} w={w} h={h} className={className} style={style} opacity={opacity} pointerEvents={pointerEvents} />;
  return <image href={art.url} x={x} y={y} width={w} height={h} preserveAspectRatio="none" className={className} style={style} opacity={opacity} pointerEvents={pointerEvents} data-art={art.id} />;
}

/**
 * Efeitos de ambiente da camada gráfica (montar uma vez, na raiz):
 * • aplica fundos CSS (variáveis --art-*) quando a imagem já carregou;
 * • pré-aquece TODO o pacote ativo em segundo plano (alimenta o cache offline do service worker);
 * • tenta de novo o que falhou quando a conexão volta.
 */
export function ArtRuntime() {
  const { registry, loader } = useArtEnv();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.artPack = registry.packName ?? 'none';
    const css = CSS_ART.map((c) => ({ ...c, art: registry.resolve(c.id) })).filter((c) => c.art);
    const apply = () => {
      for (const c of css) {
        const ok = loader.status(c.art!.url) === 'ok';
        const name = cssVarName(c.id);
        if (ok) root.style.setProperty(name, `url("${c.art!.url}") center / ${c.stretch ? '100% 100%' : 'cover'} no-repeat`);
        else root.style.removeProperty(name);
      }
    };
    css.forEach((c) => loader.load(c.art!.url, 'high'));
    const unsub = loader.subscribe(apply);
    apply();
    const warm = () => registry.all().forEach((a) => loader.load(a.url, 'low'));
    const t = setTimeout(warm, 2500);
    const online = () => { loader.retry(); warm(); };
    window.addEventListener('online', online);
    return () => { unsub(); clearTimeout(t); window.removeEventListener('online', online); css.forEach((c) => root.style.removeProperty(cssVarName(c.id))); };
  }, [registry, loader]);
  return null;
}
