// Confere o build publicado em subdiretório (GitHub Pages): node scripts/check-dist.mjs /Fab4/
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function checkDist(dist, base, { expectCloud = false, env = {} } = {}) {
  const errors = [];
  const read = (f) => readFileSync(join(dist, f), 'utf8');
  if (!existsSync(join(dist, 'index.html'))) return ['dist/index.html não existe (rode o build).'];
  const html = read('index.html');
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]*)"/g)) if (!m[1].startsWith(base)) errors.push(`index.html referencia ${m[1]} fora de ${base}`);
  if (!html.includes(`${base}assets/`)) errors.push(`index.html não aponta para ${base}assets/`);
  const manifest = JSON.parse(read('manifest.webmanifest'));
  if (manifest.start_url !== base) errors.push(`manifest.start_url=${manifest.start_url} (esperado ${base})`);
  if (manifest.scope !== base) errors.push(`manifest.scope=${manifest.scope} (esperado ${base})`);
  for (const i of manifest.icons) if (!existsSync(join(dist, i.src.replace(/^\//, '')))) errors.push(`ícone ausente: ${i.src}`);
  const sw = read('sw.js');
  if (!sw.includes(`${base}index.html`)) errors.push('sw.js sem navigateFallback no caminho-base');
  const js = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => read(join('assets', f))).join('\n');
  if (!js.includes(`${base}sw.js`) && !js.includes('sw.js')) errors.push('registro do service worker não encontrado no bundle');
  const all = [html, js, sw].join('\n');
  if (/sb_secret_[A-Za-z0-9_-]{16,}/.test(all)) errors.push('o bundle contém uma chave sb_secret_ (valor real)');
  for (const m of all.matchAll(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url').toString('utf8')).role === 'service_role') errors.push('o bundle contém um JWT service_role');
    } catch { /* não é JWT */ }
  }
  if (expectCloud) {
    const host = new URL(env.VITE_SUPABASE_URL).host;
    if (!js.includes(host)) errors.push('VITE_SUPABASE_URL não foi injetada no bundle');
    if (!js.includes(env.VITE_SUPABASE_ANON_KEY)) errors.push('VITE_SUPABASE_ANON_KEY não foi injetada no bundle');
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2] ?? '/';
  const expectCloud = !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY);
  const errors = checkDist('dist', base, { expectCloud, env: process.env });
  for (const e of errors) console.error(`::error::${e}`);
  console.log(`[check-dist] base=${base} nuvem=${expectCloud ? 'sim' : 'não'} → ${errors.length ? 'FALHOU' : 'ok'}`);
  process.exit(errors.length ? 1 : 0);
}
