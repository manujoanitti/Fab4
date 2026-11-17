// Núcleo de imagem (puro, em memória): fundo chapado → alfa, bordas suaves com descontaminação, componentes e células.
import sharp from 'sharp';

export interface Raw { data: Uint8Array; width: number; height: number } // RGBA, 4 bytes por pixel
export type RGB = { r: number; g: number; b: number };

export const hexRgb = (hex: string): RGB => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
export const distRgb = (a: RGB, b: RGB) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

export async function lerRaw(input: string | Buffer): Promise<Raw> {
  const { data, info } = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height };
}
export const paraPng = (raw: Raw) => sharp(Buffer.from(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength), { raw: { width: raw.width, height: raw.height, channels: 4 } }).png().toBuffer();

/** A imagem já tem transparência real (ex.: PNG recortado)? Então não se remove fundo. */
export function jaTransparente(raw: Raw): boolean {
  let t = 0;
  const n = raw.width * raw.height;
  for (let i = 0; i < n; i += 7) if (raw.data[i * 4 + 3] < 250) t++;
  return t / (n / 7) > 0.01;
}

/** Cor de fundo = mediana do contorno da imagem; `confianca` = fração do contorno próxima dessa cor. */
export function estimarFundo(raw: Raw): RGB & { confianca: number } {
  const { width: W, height: H, data } = raw;
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const amostra = (x: number, y: number) => { const i = (y * W + x) * 4; rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]); };
  const passo = Math.max(1, Math.floor(Math.max(W, H) / 800));
  for (let x = 0; x < W; x += passo) { amostra(x, 0); amostra(x, H - 1); }
  for (let y = 0; y < H; y += passo) { amostra(0, y); amostra(W - 1, y); }
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
  const cor = { r: med(rs), g: med(gs), b: med(bs) };
  let perto = 0;
  for (let k = 0; k < rs.length; k++) if (Math.hypot(rs[k] - cor.r, gs[k] - cor.g, bs[k] - cor.b) <= 40) perto++;
  return { ...cor, confianca: perto / rs.length };
}

export interface Tolerancia { duro: number; solto: number; borda: number }
export const TOLERANCIAS: Record<'baixa' | 'media' | 'alta', Tolerancia> = {
  baixa: { duro: 20, solto: 50, borda: 100 },
  media: { duro: 28, solto: 70, borda: 130 },
  alta: { duro: 40, solto: 100, borda: 170 },
};

export interface ResultadoFundo { rgba: Uint8Array; fundo: Uint8Array; vaos: number; semi: number }

/**
 * Remove o fundo chapado:
 *  1) preenchimento a partir da borda (tolerância "solta") — só apaga o que está CONECTADO ao fundo (uma folha verde interna é preservada);
 *  2) vãos internos (anéis): regiões fechadas na cor do fundo com tolerância "dura" e área mínima também viram transparentes;
 *  3) faixa de borda: alfa suave por distância à cor do fundo e descontaminação C = (O − (1−α)·fundo)/α.
 */
export function removerFundo(raw: Raw, bg: RGB, tol: Tolerancia = TOLERANCIAS.media): ResultadoFundo {
  const { width: W, height: H, data } = raw;
  const N = W * H;
  const d2 = new Float32Array(N);
  for (let i = 0; i < N; i++) { const o = i * 4; const dr = data[o] - bg.r, dg = data[o + 1] - bg.g, db = data[o + 2] - bg.b; d2[i] = dr * dr + dg * dg + db * db; }
  const solto2 = tol.solto * tol.solto, duro2 = tol.duro * tol.duro;
  const fundo = new Uint8Array(N);
  const pilha = new Int32Array(N);
  let sp = 0;
  const empurra = (i: number) => { if (!fundo[i] && d2[i] <= solto2) { fundo[i] = 1; pilha[sp++] = i; } };
  for (let x = 0; x < W; x++) { empurra(x); empurra((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { empurra(y * W); empurra(y * W + W - 1); }
  while (sp) {
    const i = pilha[--sp], x = i % W, y = (i / W) | 0;
    if (x > 0) empurra(i - 1);
    if (x < W - 1) empurra(i + 1);
    if (y > 0) empurra(i - W);
    if (y < H - 1) empurra(i + W);
  }
  // vãos internos
  const minVao = Math.max(60, Math.round(N * 0.00015));
  const nucleo2 = (tol.duro * 0.35) ** 2;
  const visto = new Uint8Array(N);
  const lista = new Int32Array(N);
  let vaos = 0;
  for (let s = 0; s < N; s++) {
    if (fundo[s] || visto[s] || d2[s] > duro2) continue;
    let n = 0, p = 0, nucleo = 0;
    visto[s] = 1; pilha[p++] = s;
    while (p) {
      const i = pilha[--p]; lista[n++] = i;
      if (d2[i] <= nucleo2) nucleo++;
      const x = i % W, y = (i / W) | 0;
      const viz = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of viz) if (j >= 0 && !visto[j] && !fundo[j] && d2[j] <= duro2) { visto[j] = 1; pilha[p++] = j; }
    }
    // bolsões pequenos (frestas entre folhas, p. ex.) só saem se tiverem um NÚCLEO de cor praticamente igual à do fundo
    if (n >= minVao || (n >= 3 && nucleo >= 2)) { for (let k = 0; k < n; k++) fundo[lista[k]] = 1; vaos++; }
  }
  // faixa de borda (profundidade proporcional ao tamanho da imagem)
  const prof = Math.max(2, Math.round(Math.max(W, H) / 700));
  const nivel = new Uint8Array(N);
  let fila: number[] = [];
  const viz8 = (i: number, f: (j: number) => void) => {
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < W && yy >= 0 && yy < H) f(yy * W + xx);
    }
  };
  for (let i = 0; i < N; i++) if (fundo[i]) viz8(i, (j) => { if (!fundo[j] && !nivel[j]) { nivel[j] = 1; fila.push(j); } });
  for (let n = 1; n < prof; n++) {
    const prox: number[] = [];
    for (const i of fila) viz8(i, (j) => { if (!fundo[j] && !nivel[j]) { nivel[j] = n + 1; prox.push(j); } });
    fila = prox;
  }
  // cor do objeto (F) mais próxima de cada pixel da faixa de borda: propagada a partir dos pixels sólidos vizinhos
  const Fr = new Float32Array(N), Fg = new Float32Array(N), Fb = new Float32Array(N), temF = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (!fundo[i] && !nivel[i]) { temF[i] = 1; Fr[i] = data[i * 4]; Fg[i] = data[i * 4 + 1]; Fb[i] = data[i * 4 + 2]; }
  for (let passo = 0; passo <= prof; passo++) {
    const novos: number[] = [];
    for (let i = 0; i < N; i++) {
      if (!nivel[i] || temF[i] || fundo[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      viz8(i, (j) => { if (temF[j] && !nivel[j]) { r += Fr[j]; g += Fg[j]; b += Fb[j]; n++; } });
      if (!n) viz8(i, (j) => { if (temF[j]) { r += Fr[j]; g += Fg[j]; b += Fb[j]; n++; } });
      if (n) { Fr[i] = r / n; Fg[i] = g / n; Fb[i] = b / n; novos.push(i); }
    }
    for (const i of novos) temF[i] = 1;
    if (!novos.length) break;
  }
  const out = new Uint8Array(N * 4);
  let semi = 0;
  const t0 = tol.duro, tB = tol.borda;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (fundo[i]) continue; // transparente (RGB 0)
    let a = 1;
    let corR = data[o], corG = data[o + 1], corB = data[o + 2];
    if (nivel[i]) {
      const O = [data[o] - bg.r, data[o + 1] - bg.g, data[o + 2] - bg.b];
      if (temF[i]) {
        const F = [Fr[i] - bg.r, Fg[i] - bg.g, Fb[i] - bg.b];
        const f2 = F[0] * F[0] + F[1] * F[1] + F[2] * F[2];
        if (f2 > 900) {
          // mistura O = α·F + (1−α)·fundo  ⇒  α = projeção de (O−fundo) sobre (F−fundo)
          a = Math.min(1, Math.max(0, (O[0] * F[0] + O[1] * F[1] + O[2] * F[2]) / f2));
          if (a > 0.965) a = 1;
        } else { const d = Math.sqrt(d2[i]), u = Math.min(1, Math.max(0, (d - t0) / (tB - t0))); a = u * u * (3 - 2 * u); }
      } else { const d = Math.sqrt(d2[i]), u = Math.min(1, Math.max(0, (d - t0) / (tB - t0))); a = u * u * (3 - 2 * u); }
      if (a < 0.999 && a > 0.04) {
        const dr = (data[o] - (1 - a) * bg.r) / a, dg = (data[o + 1] - (1 - a) * bg.g) / a, db = (data[o + 2] - (1 - a) * bg.b) / a;
        const w = Math.min(1, a / 0.4); // com pouca cobertura a estimativa é ruidosa: mistura com a cor do objeto vizinho
        corR = clamp8(temF[i] ? Fr[i] * (1 - w) + dr * w : dr); corG = clamp8(temF[i] ? Fg[i] * (1 - w) + dg * w : dg); corB = clamp8(temF[i] ? Fb[i] * (1 - w) + db * w : db);
      }
    }
    if (a <= 0.04) continue;
    if (a < 0.999) semi++;
    out[o] = corR; out[o + 1] = corG; out[o + 2] = corB;
    out[o + 3] = Math.round(a * 255);
  }
  return { rgba: out, fundo, vaos, semi };
}
/**
 * Resíduo de fundo-chave DENTRO do desenho (frestas entre folhas onde o verde/magenta/ciano vazou misturado pela compressão JPEG).
 * Só age quando o fundo é uma cor-chave saturada (canais dominantes ≥ 200, os demais ≤ 80). Para cada pixel: excesso = menor canal
 * dominante − maior canal restante. excesso > 90 → o pixel era fundo (vira transparente); 40–90 → "despill" (traz o canal para perto dos demais).
 * Paletas pastel/oliva do projeto ficam muito abaixo (excesso < 35). Devolve quantos pixels foram afetados.
 */
export function limparResiduoChave(rgba: Uint8Array, bg: RGB, largura: number, altura: number): { removidos: number; corrigidos: number } {
  const c = [bg.r, bg.g, bg.b];
  const dom = [0, 1, 2].filter((k) => c[k] >= 200), outros = [0, 1, 2].filter((k) => c[k] <= 80);
  if (!dom.length || dom.length + outros.length !== 3) return { removidos: 0, corrigidos: 0 };
  // Só frestas PRÓXIMAS do fundo já removido (entre folhas, junto ao contorno). Manchas grandes no meio do objeto não são tocadas:
  // continuam visíveis para o QA ("residuo-fundo") em vez de virar um buraco silencioso.
  const W = largura, H = altura, N = W * H, prox = Math.max(6, Math.round(Math.max(W, H) / 45));
  let perto = new Uint8Array(N);
  for (let i = 0; i < N; i++) perto[i] = rgba[i * 4 + 3] < 20 ? 1 : 0;
  for (let passo = 0; passo < 2; passo++) { // dilatação separável (horizontal e vertical) com janela ±prox
    const t = new Uint8Array(N), o = new Uint8Array(N);
    for (let y = 0; y < H; y++) { let ult = -1e9; for (let x = 0; x < W; x++) { if (perto[y * W + x]) ult = x; if (x - ult <= prox) t[y * W + x] = 1; } ult = 1e9; for (let x = W - 1; x >= 0; x--) { if (perto[y * W + x]) ult = x; if (ult - x <= prox) t[y * W + x] = 1; } }
    for (let x = 0; x < W; x++) { let ult = -1e9; for (let y = 0; y < H; y++) { if (t[y * W + x]) ult = y; if (y - ult <= prox) o[y * W + x] = 1; } ult = 1e9; for (let y = H - 1; y >= 0; y--) { if (t[y * W + x]) ult = y; if (ult - y <= prox) o[y * W + x] = 1; } }
    perto = o; break;
  }
  let removidos = 0, corrigidos = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 20 || !perto[i / 4]) continue;
    const exc = Math.min(...dom.map((k) => rgba[i + k])) - Math.max(...outros.map((k) => rgba[i + k]));
    if (exc > 90) { rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0; removidos++; }
    else if (exc > 40) {
      const teto = Math.max(...outros.map((k) => rgba[i + k])) + 40;
      for (const k of dom) rgba[i + k] = Math.min(rgba[i + k], teto);
      corrigidos++;
    }
  }
  return { removidos, corrigidos };
}
const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

// ---------------- componentes conectados e células ----------------
export interface Componente { id: number; area: number; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }
export interface Rotulos { labels: Int32Array; sw: number; sh: number; fator: number; comps: Componente[] }

/** Rotula componentes (8-conexo) numa grade reduzida com dilatação leve; estatísticas medidas em resolução total. */
export function rotular(alpha: Uint8Array, W: number, H: number, limiar = 20): Rotulos {
  const fator = Math.max(1, Math.floor(Math.max(W, H) / 512));
  const sw = Math.ceil(W / fator), sh = Math.ceil(H / fator);
  const m = new Uint8Array(sw * sh);
  for (let y = 0; y < H; y++) { const ry = ((y / fator) | 0) * sw; for (let x = 0; x < W; x++) if (alpha[y * W + x] > limiar) m[ry + ((x / fator) | 0)] = 1; }
  const r = Math.max(1, Math.round((0.006 * Math.max(W, H)) / fator));
  const tmp = new Uint8Array(sw * sh), dil = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const xx = x + k; if (xx >= 0 && xx < sw && m[y * sw + xx]) v = 1; } tmp[y * sw + x] = v; }
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let v = 0; for (let k = -r; k <= r && !v; k++) { const yy = y + k; if (yy >= 0 && yy < sh && tmp[yy * sw + x]) v = 1; } dil[y * sw + x] = v; }
  const labels = new Int32Array(sw * sh);
  const pilha = new Int32Array(sw * sh);
  let prox = 0;
  for (let s = 0; s < sw * sh; s++) {
    if (!dil[s] || labels[s]) continue;
    prox++;
    let p = 0; labels[s] = prox; pilha[p++] = s;
    while (p) {
      const i = pilha[--p], x = i % sw, y = (i / sw) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
        const j = yy * sw + xx;
        if (dil[j] && !labels[j]) { labels[j] = prox; pilha[p++] = j; }
      }
    }
  }
  const comps: Componente[] = Array.from({ length: prox }, (_, k) => ({ id: k + 1, area: 0, x0: W, y0: H, x1: -1, y1: -1, cx: 0, cy: 0 }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha[y * W + x] <= limiar) continue;
    const c = comps[labels[((y / fator) | 0) * sw + ((x / fator) | 0)] - 1];
    if (!c) continue;
    c.area++; c.cx += x; c.cy += y;
    if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
  }
  const validos = comps.filter((c) => c.area > 0).map((c) => ({ ...c, cx: c.cx / c.area, cy: c.cy / c.area }));
  return { labels, sw, sh, fator, comps: validos };
}

export interface CelulaPx { id: string; x: number; y: number; w: number; h: number }
export interface Atribuicao {
  porCelula: Map<string, { comps: Componente[]; x0: number; y0: number; x1: number; y1: number; area: number }>;
  foraDaGrade: Componente[];
  ruido: Componente[];
}
/** Associa cada componente à célula que contém seu centroide (tolerância de deriva); descarta ruído minúsculo. */
export function atribuir(comps: Componente[], celulas: CelulaPx[], deriva = 0.08): Atribuicao {
  const porCelula: Atribuicao['porCelula'] = new Map();
  const foraDaGrade: Componente[] = [], ruido: Componente[] = [];
  const areaMax = Math.max(...comps.map((c) => c.area), 1);
  for (const c of comps) {
    const cand = celulas.filter((k) => c.cx >= k.x - k.w * deriva && c.cx <= k.x + k.w * (1 + deriva) && c.cy >= k.y - k.h * deriva && c.cy <= k.y + k.h * (1 + deriva));
    if (!cand.length) { (c.area < 0.001 * celulas[0].w * celulas[0].h ? ruido : foraDaGrade).push(c); continue; }
    const k = cand.reduce((b, q) => (Math.hypot(c.cx - (q.x + q.w / 2), c.cy - (q.y + q.h / 2)) < Math.hypot(c.cx - (b.x + b.w / 2), c.cy - (b.y + b.h / 2)) ? q : b));
    if (c.area < Math.max(12, 0.0008 * k.w * k.h) && c.area < areaMax * 0.02) { ruido.push(c); continue; }
    const g = porCelula.get(k.id) ?? { comps: [], x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, area: 0 };
    g.comps.push(c); g.area += c.area;
    g.x0 = Math.min(g.x0, c.x0); g.y0 = Math.min(g.y0, c.y0); g.x1 = Math.max(g.x1, c.x1); g.y1 = Math.max(g.y1, c.y1);
    porCelula.set(k.id, g);
  }
  return { porCelula, foraDaGrade, ruido };
}

/** Recorta (bbox) mantendo apenas os pixels dos componentes dados. */
export function extrair(rgba: Uint8Array, W: number, rot: Rotulos, ids: Set<number>, bb: { x0: number; y0: number; x1: number; y1: number }): Raw {
  const w = bb.x1 - bb.x0 + 1, h = bb.y1 - bb.y0 + 1;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = bb.x0 + x, Y = bb.y0 + y;
    const lab = rot.labels[((Y / rot.fator) | 0) * rot.sw + ((X / rot.fator) | 0)];
    if (!ids.has(lab)) continue;
    const s = (Y * W + X) * 4, d = (y * w + x) * 4;
    out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
  }
  return { data: out, width: w, height: h };
}
export const alphaDe = (raw: Raw): Uint8Array => { const a = new Uint8Array(raw.width * raw.height); for (let i = 0; i < a.length; i++) a[i] = raw.data[i * 4 + 3]; return a; };
