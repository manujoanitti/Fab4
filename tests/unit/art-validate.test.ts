import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalog from '../../src/art/catalog.json';
import { imageInfo, unsafeSvgReason, validateArt } from '../../scripts/validate-art.mjs';
import { png } from '../fixtures/art/generate.mjs';
import fixture from '../fixtures/art/manifest.json';

const FIX_DIR = join(__dirname, '../fixtures/art/public/art');
const run = (manifest: unknown, publicDir: string) => validateArt({ manifest, catalog: catalog as never, publicDir });

/** Cria uma pasta temporária com arquivos {caminho: conteúdo}. */
function pack(files: Record<string, Buffer | string>): string {
  const root = mkdtempSync(join(tmpdir(), 'art-'));
  for (const [rel, data] of Object.entries(files)) { const p = join(root, 'p', rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); }
  mkdirSync(join(root, 'p'), { recursive: true });
  return root;
}
const man = (assets: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ schema: 1, activePack: 'p', packs: { p: { dir: 'p', assets, ...extra } } });
const svgOk = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><circle r="5"/></svg>';
const solid = (w: number, h: number, alpha = true) => png(w, h, () => [200, 100, 50, alpha ? 255 : 255], alpha);
const errs = (m: unknown, dir: string) => run(m, dir).errors.join(' | ');

describe('validação do pacote gráfico — leitura de cabeçalhos', () => {
  it('PNG: dimensões e canal alfa', () => {
    expect(imageInfo(solid(10, 20), 'png')).toEqual({ w: 10, h: 20, alpha: true });
    expect(imageInfo(solid(10, 20, false), 'png')).toEqual({ w: 10, h: 20, alpha: false });
    expect(imageInfo(Buffer.from('lixo'), 'png')).toBeNull();
  });
  it('WebP: VP8X (com e sem alfa), VP8L e VP8', () => {
    const riff = (fourcc: string, body: Buffer) => { const b = Buffer.alloc(20 + body.length); b.write('RIFF', 0); b.writeUInt32LE(12 + body.length, 4); b.write('WEBP', 8); b.write(fourcc, 12); b.writeUInt32LE(body.length, 16); body.copy(b, 20); return b; };
    const vp8x = (w: number, h: number, alpha: boolean) => { const b = Buffer.alloc(10); b[0] = alpha ? 0x10 : 0; b.writeUIntLE(w - 1, 4, 3); b.writeUIntLE(h - 1, 7, 3); return riff('VP8X', b); };
    expect(imageInfo(vp8x(800, 1080, true), 'webp')).toEqual({ w: 800, h: 1080, alpha: true });
    expect(imageInfo(vp8x(800, 260, false), 'webp')).toEqual({ w: 800, h: 260, alpha: false });
    const l = Buffer.alloc(5); l[0] = 0x2f; l.writeUInt32LE(((127) | (63 << 14) | (1 << 28)) >>> 0, 1);
    expect(imageInfo(riff('VP8L', l), 'webp')).toEqual({ w: 128, h: 64, alpha: true });
    const v = Buffer.alloc(10); v[3] = 0x9d; v[4] = 0x01; v[5] = 0x2a; v.writeUInt16LE(256, 6); v.writeUInt16LE(128, 8);
    expect(imageInfo(riff('VP8 ', v), 'webp')).toEqual({ w: 256, h: 128, alpha: false });
  });
  it('SVG: viewBox ou width/height; recusa conteúdo ativo ou externo', () => {
    expect(imageInfo(Buffer.from(svgOk), 'svg')).toMatchObject({ w: 128, h: 128 });
    expect(imageInfo(Buffer.from('<svg width="64" height="32"></svg>'), 'svg')).toMatchObject({ w: 64, h: 32 });
    for (const bad of ['<svg viewBox="0 0 1 1"><script>x</script></svg>', '<svg viewBox="0 0 1 1" onload="x()"></svg>', '<svg viewBox="0 0 1 1"><image href="https://x.com/a.png"/></svg>', '<svg viewBox="0 0 1 1"><foreignObject/></svg>', '<svg viewBox="0 0 1 1"><a href="javascript:alert(1)"/></svg>'])
      expect(unsafeSvgReason(bad), bad).toBeTruthy();
    expect(unsafeSvgReason(svgOk)).toBeNull();
  });
});

describe('validação do pacote gráfico — manifesto × catálogo × arquivos', () => {
  it('pacote de fixture: único erro é o arquivo registrado e ausente (ui.sync.synced)', () => {
    const r = run(fixture, FIX_DIR);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/ui\.sync\.synced.*arquivo ausente/);
    expect(r.stats.assets).toBe(11); // 10 válidos do pacote "test" (o 11º está ausente) + 1 do pacote "alt"
  });
  it('manifesto vazio (estado atual do app) é válido e não exige nenhuma arte', () => {
    expect(run({ schema: 1, activePack: null, packs: {} }, FIX_DIR)).toMatchObject({ errors: [], warnings: [] });
  });
  it('aceita um pacote correto (png opaco/alfa, svg, sprite) sem erros', () => {
    const dir = pack({ 'map/region-1-bg@2x.png': solid(800, 1080, false), 'map/node-done@2x.png': solid(128, 128), 'ui/icon-coin.svg': svgOk, 'char/bianca-walk@2x.png': solid(2048, 256) });
    const r = run(man({ 'map.region.1.bg': { file: 'map/region-1-bg@2x.png' }, 'map.node.done': { file: 'map/node-done@2x.png' }, 'ui.icon.coin': { file: 'ui/icon-coin.svg' }, 'char.bianca.walk': { file: 'char/bianca-walk@2x.png' } }), dir);
    expect(r.errors).toEqual([]);
    expect(r.stats.assets).toBe(4);
  });
  it('ID desconhecido, nome fora da convenção e formato não permitido', () => {
    const dir = pack({ 'x.png': solid(10, 10), 'map/node-done.png': solid(128, 128), 'map/node-locked@2x.gif': Buffer.from('GIF89a') });
    const e = errs(man({ 'map.inventado.x': { file: 'x.png' }, 'map.node.done': { file: 'map/node-done.png' }, 'map.node.locked': { file: 'map/node-locked@2x.gif' } }), dir);
    expect(e).toMatch(/map\.inventado\.x: ID não existe no catálogo/);
    expect(e).toMatch(/nome fora da convenção — esperado "map\/node-done@2x\.png"/);
    expect(e).toMatch(/formato \.gif não permitido/);
  });
  it('dimensões exatas, proporção, transparência e sprite', () => {
    const dir = pack({
      'map/region-1-bg@2x.png': solid(800, 1000, false), // dimensão errada
      'map/region-1-mid@2x.png': solid(800, 1080, false), // deveria ter alfa
      'map/node-done@2x.png': solid(128, 64), // proporção errada
      'char/bianca-walk@2x.png': solid(2000, 256), // tira incompatível (8×256 = 2048)
    });
    const e = errs(man({ 'map.region.1.bg': { file: 'map/region-1-bg@2x.png' }, 'map.region.1.mid': { file: 'map/region-1-mid@2x.png' }, 'map.node.done': { file: 'map/node-done@2x.png' }, 'char.bianca.walk': { file: 'char/bianca-walk@2x.png' } }), dir);
    expect(e).toMatch(/region\.1\.bg: dimensões devem ser exatamente 800×1080px; recebido 800×1000/);
    expect(e).toMatch(/region\.1\.mid: este recurso exige fundo transparente/);
    expect(e).toMatch(/node\.done: proporção 128:64 difere de 128:128/);
    expect(e).toMatch(/bianca\.walk: tira de quadros deve ter 2048×256px/);
  });
  it('SVG inseguro e SVG com proporção errada', () => {
    const dir = pack({ 'ui/icon-coin.svg': '<svg viewBox="0 0 128 128"><script>alert(1)</script></svg>', 'ui/icon-credit.svg': '<svg viewBox="0 0 200 100"></svg>' });
    const e = errs(man({ 'ui.icon.coin': { file: 'ui/icon-coin.svg' }, 'ui.icon.credit': { file: 'ui/icon-credit.svg' } }), dir);
    expect(e).toMatch(/icon\.coin: SVG inseguro — contém <script>/);
    expect(e).toMatch(/icon\.credit: proporção do SVG 200:100/);
  });
  it('caminhos perigosos, pasta ausente, activePack inexistente e layout inválido', () => {
    const dir = pack({});
    expect(errs(man({ 'ui.icon.coin': { file: '../x.svg' } }), dir)).toMatch(/caminho inválido/);
    expect(errs({ schema: 1, activePack: 'z', packs: { p: { dir: '../fora', assets: {} } } }, dir)).toMatch(/activePack "z" não existe[\s\S]*"dir" inválido/);
    expect(errs({ schema: 1, activePack: 'p', packs: { p: { dir: 'sumiu', assets: {} } } }, dir)).toMatch(/pasta ausente/);
    expect(errs(man({}, { layout: { nodes: { '0': { x: 1, y: 1 }, '3': { x: -1, y: 2 } }, bonus: { x: 9999, y: 1 } } }), dir)).toMatch(/layout\.nodes\["0"\][\s\S]*layout\.nodes\["3"\][\s\S]*layout\.bonus/);
    expect(errs({ schema: 2 }, dir)).toMatch(/schema deve ser 1/);
  });
  it('arquivos não registrados e orçamento de peso viram avisos (não bloqueiam)', () => {
    const big = png(128, 128, (x, y) => [(x * 7 + y * 13) & 255, (x * 3) & 255, (y * 11) & 255, 255]);
    const dir = pack({ 'map/node-done@2x.png': big, 'sobra.txt': 'x' });
    const r = run(man({ 'map.node.done': { file: 'map/node-done@2x.png' } }), dir);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('|')).toMatch(/arquivo não registrado no manifesto: p\/sobra\.txt/);
  });
});
