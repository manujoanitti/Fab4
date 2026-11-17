// Valida as variáveis públicas do Supabase ANTES do build (o site é público: nada secreto pode entrar no bundle).
// Aceita a chave "Publishable" (sb_publishable_…) ou a "anon" legada (JWT). Recusa sb_secret_… e JWT service_role.
export function checkEnv(env) {
  const url = (env.VITE_SUPABASE_URL ?? '').trim();
  const key = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  const errors = [];
  const warnings = [];
  if (!url && !key) return { mode: 'demo', errors, warnings: ['Supabase não configurado: o build terá somente o modo demonstração.'] };
  if (!url || !key) errors.push('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY juntas (uma delas está vazia).');
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url))
    errors.push('VITE_SUPABASE_URL deve ter o formato https://<projeto>.supabase.co');
  if (key) {
    if (key.startsWith('sb_secret_')) errors.push('VITE_SUPABASE_ANON_KEY contém uma chave SECRETA (sb_secret_…). Use a chave Publishable.');
    else if (key.startsWith('sb_publishable_')) {
      /* ok: nova chave pública */
    } else if (key.split('.').length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
        if (payload.role === 'service_role') errors.push('VITE_SUPABASE_ANON_KEY contém a chave service_role (PRIVILEGIADA). Use a chave anon/publishable.');
        else if (payload.role !== 'anon') warnings.push(`JWT com papel inesperado: ${payload.role}`);
      } catch {
        errors.push('VITE_SUPABASE_ANON_KEY parece um JWT inválido.');
      }
    } else errors.push('Formato de chave não reconhecido (esperado sb_publishable_… ou JWT anon).');
  }
  return { mode: errors.length ? 'invalid' : 'cloud', errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = checkEnv(process.env);
  for (const w of r.warnings) console.warn(`::warning::${w}`);
  for (const e of r.errors) console.error(`::error::${e}`);
  console.log(`[check-env] modo do build: ${r.mode}`);
  process.exit(r.errors.length ? 1 : 0);
}
