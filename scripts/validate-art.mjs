// Valida o pacote gráfico: manifesto × catálogo × arquivos de public/art.
//   node scripts/validate-art.mjs            (usa src/art/manifest.json e public/art)
// Erros bloqueiam o build (prebuild); avisos são informativos.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export const MAP_W = 400;
export const MAP_H = 2960;
const ID_RE = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const SIZE_BUDGET_WARN = 6 * 1024 * 1024;
const SIZE_BUDGET_ERROR = 12 * 1024 * 1024;

/** Lê largura/altura/alfa do cabeçalho de PNG, WebP (VP8X/VP8L/VP8) e SVG. Retorna null se não reconhecer. */
export function imageInfo(buf, ext) {
  if (ext === 'png') {
    if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47) return null;
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), ct = buf[25];
    let alpha = ct === 4 || ct === 6;
    if (ct === 3) { // paleta: alfa só se houver chunk tRNS
      for (let o = 8; o + 8 <= buf.length;) { const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8); if (type === 'tRNS') { alpha = true; break; } if (type === 'IDAT') break; o += 12 + len; }
    }
    return { w, h, alpha };
  }
  if (ext === 'webp') {
    if (buf.length < 25 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
    const f = buf.toString('ascii', 12, 16);
    if (f === 'VP8X' && buf.length >= 30) return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)), alpha: (buf[20] & 0x10) !== 0 };
    if (f === 'VP8L' && buf[20] === 0x2f) { const v = buf.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1, alpha: ((v >> 28) & 1) === 1 }; }
    if (f === 'VP8 ' && buf.length >= 30) return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, alpha: false };
    return null;
  }
  if (ext === 'svg') {
    const text = buf.toString('utf8');
    const m = text.match(/<svg\b[^>]*>/i);
    if (!m) return null;
    const tag = m[0];
    const vb = tag.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1].trim().split(/[\s,]+/).map(Number);
    const num = (n) => { const v = tag.match(new RegExp(`\\s${n}\\s*=\\s*"([\\d.]+)(px)?"`, 'i')); return v ? Number(v[1]) : null; };
    const w = vb && vb.length === 4 ? vb[2] : num('width'), h = vb && vb.length === 4 ? vb[3] : num('height');
    if (!w || !h) return null;
    return { w, h, alpha: true, svgText: text };
  }
  return null;
}

/** SVG externo é código: recusa script, manipuladores de evento, foreignObject e referências externas. */
export function unsafeSvgReason(text) {
  if (/<script\b/i.test(text)) return 'contém <script>';
  if (/\son[a-z]+\s*=/i.test(text)) return 'contém manipulador de evento (onload, onclick…)';
  if (/<foreignObject\b/i.test(text)) return 'contém <foreignObject>';
  if (/javascript:/i.test(text)) return 'contém javascript:';
  if (/(href|xlink:href|src)\s*=\s*["']\s*(https?:)?\/\//i.test(text)) return 'referencia recurso externo (http/https)';
  if (/url\(\s*["']?\s*(https?:)?\/\//i.test(text)) return 'usa url() externa';
  return null;
}

const posNum = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const inMap = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= MAP_W && p.y >= 0 && p.y <= MAP_H;

export function validateArt({ manifest, catalog, publicDir }) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const slots = new Map(catalog.catalog.map((c) => [c.id, c]));
  if (!manifest || manifest.schema !== 1) { err('manifest.schema deve ser 1'); return { errors, warnings, stats: { assets: 0, bytes: 0 } }; }
  const packs = manifest.packs ?? {};
  if (manifest.activePack != null && !packs[manifest.activePack]) err(`activePack "${manifest.activePack}" não existe em packs`);
  let totalAssets = 0, totalBytes = 0;
  for (const [name, pack] of Object.entries(packs)) {
    const tag = `[${name}]`;
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) err(`${tag} nome de pacote inválido`);
    if (typeof pack.dir !== 'string' || !pack.dir || pack.dir.startsWith('/') || pack.dir.split('/').includes('..')) { err(`${tag} "dir" inválido (use subpasta relativa, sem ".." nem "/" inicial)`); continue; }
    const root = join(publicDir, pack.dir);
    if (!existsSync(root)) { err(`${tag} pasta ausente: public/art/${pack.dir}`); continue; }
    const referenced = new Set();
    let packBytes = 0;
    for (const [id, e] of Object.entries(pack.assets ?? {})) {
      const t = `${tag} ${id}`;
      if (!ID_RE.test(id)) { err(`${t}: ID fora do padrão (minúsculas, pontos e hífens)`); continue; }
      const slot = slots.get(id);
      if (!slot) { err(`${t}: ID não existe no catálogo (src/art/catalog.json)`); continue; }
      if (!e || typeof e.file !== 'string') { err(`${t}: falta "file"`); continue; }
      if (e.file.startsWith('/') || e.file.split('/').includes('..')) { err(`${t}: caminho inválido "${e.file}"`); continue; }
      const ext = extname(e.file).slice(1).toLowerCase();
      if (!slot.formats.includes(ext)) err(`${t}: formato .${ext} não permitido (use ${slot.formats.map((f) => '.' + f).join(', ')})`);
      const expected = `${slot.stem}${ext === 'svg' ? '' : '@2x'}.${ext}`;
      if (e.file !== expected) err(`${t}: nome fora da convenção — esperado "${expected}", recebido "${e.file}"`);
      if (e.kind && e.kind !== slot.kind) err(`${t}: kind "${e.kind}" difere do catálogo ("${slot.kind}")`);
      if (e.box && !(posNum(e.box.w) && posNum(e.box.h))) err(`${t}: box inválido`);
      if (e.anchor && !(e.anchor.x >= 0 && e.anchor.x <= 1 && e.anchor.y >= 0 && e.anchor.y <= 1)) err(`${t}: anchor deve estar entre 0 e 1`);
      referenced.add(e.file);
      const path = join(root, e.file);
      if (!existsSync(path)) { err(`${t}: arquivo ausente (${pack.dir}/${e.file})`); continue; }
      const buf = readFileSync(path);
      packBytes += buf.length;
      if (buf.length > slot.maxKB * 1024) warn(`${t}: ${(buf.length / 1024).toFixed(0)} KB excede o orçamento de ${slot.maxKB} KB`);
      const info = imageInfo(buf, ext);
      if (!info) { err(`${t}: não foi possível ler as dimensões (arquivo corrompido ou ${ext} não suportado)`); continue; }
      if (ext === 'svg') { const r = unsafeSvgReason(info.svgText); if (r) err(`${t}: SVG inseguro — ${r}`); }
      const isSprite = slot.kind === 'sprite';
      const sp = e.sprite ?? slot.sprite;
      if (isSprite) {
        if (ext === 'svg') { err(`${t}: sprite deve ser raster (webp/png)`); continue; }
        if (e.sprite && (e.sprite.frames !== slot.sprite.frames || e.sprite.fps !== slot.sprite.fps)) warn(`${t}: metadados de sprite diferem do catálogo`);
        if (!(sp.frames >= 1 && sp.frameW > 0 && sp.frameH > 0 && sp.fps > 0)) { err(`${t}: metadados de sprite inválidos`); continue; }
        if (info.w !== sp.frames * sp.frameW || info.h !== sp.frameH) err(`${t}: tira de quadros deve ter ${sp.frames * sp.frameW}×${sp.frameH}px (${sp.frames} quadros de ${sp.frameW}×${sp.frameH}); recebido ${info.w}×${info.h}`);
      } else if (ext !== 'svg') {
        if (slot.dimMode === 'exact') { if (info.w !== slot.px.w || info.h !== slot.px.h) err(`${t}: dimensões devem ser exatamente ${slot.px.w}×${slot.px.h}px; recebido ${info.w}×${info.h}`); }
        else {
          const ratio = info.w / info.h, want = slot.px.w / slot.px.h;
          if (Math.abs(ratio - want) / want > 0.01) err(`${t}: proporção ${info.w}:${info.h} difere de ${slot.px.w}:${slot.px.h}`);
          if (info.w < slot.px.w * 0.5 || info.w > slot.px.w * 2) warn(`${t}: largura ${info.w}px fora da faixa recomendada (${slot.px.w * 0.5}–${slot.px.w * 2}px)`);
        }
      } else {
        const ratio = info.w / info.h, want = slot.px.w / slot.px.h;
        if (Math.abs(ratio - want) / want > 0.01) err(`${t}: proporção do SVG ${info.w}:${info.h} difere de ${slot.px.w}:${slot.px.h}`);
      }
      if (slot.transparent && ext !== 'svg' && !info.alpha) err(`${t}: este recurso exige fundo transparente (canal alfa), mas o arquivo é opaco`);
      totalAssets++;
    }
    const lay = pack.layout;
    if (lay) {
      for (const [k, p] of Object.entries(lay.nodes ?? {})) if (!(Number.isInteger(+k) && +k >= 1 && +k <= 25) || !inMap(p)) err(`${tag} layout.nodes["${k}"] inválido (fase 1–25 e x 0–${MAP_W}, y 0–${MAP_H})`);
      for (const k of ['start', 'bonus']) if (lay[k] && !inMap(lay[k])) err(`${tag} layout.${k} fora do mapa`);
    }
    // arquivos não referenciados
    const walk = (d, rel = '') => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f), rel + f + '/') : [rel + f]));
    for (const f of walk(root)) if (!referenced.has(f)) warn(`${tag} arquivo não registrado no manifesto: ${pack.dir}/${f}`);
    if (packBytes > SIZE_BUDGET_ERROR) err(`${tag} pacote com ${(packBytes / 1048576).toFixed(1)} MB excede o limite de ${SIZE_BUDGET_ERROR / 1048576} MB`);
    else if (packBytes > SIZE_BUDGET_WARN) warn(`${tag} pacote com ${(packBytes / 1048576).toFixed(1)} MB acima do orçamento recomendado (${SIZE_BUDGET_WARN / 1048576} MB)`);
    totalBytes += packBytes;
  }
  return { errors, warnings, stats: { assets: totalAssets, bytes: totalBytes } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(readFileSync('src/art/manifest.json', 'utf8'));
  const catalog = JSON.parse(readFileSync('src/art/catalog.json', 'utf8'));
  const r = validateArt({ manifest, catalog, publicDir: 'public/art' });
  for (const w of r.warnings) console.warn(`::warning::${w}`);
  for (const e of r.errors) console.error(`::error::${e}`);
  const names = Object.keys(manifest.packs ?? {});
  console.log(`[art] pacote ativo: ${manifest.activePack ?? 'nenhum (somente fallback)'} · pacotes: ${names.length} · recursos válidos: ${r.stats.assets} · ${r.errors.length} erro(s), ${r.warnings.length} aviso(s)`);
  process.exit(r.errors.length ? 1 : 0);
}
