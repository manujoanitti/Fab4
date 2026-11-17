import { describe, expect, it } from 'vitest';
import { checkEnv } from '../../scripts/check-env.mjs';

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.assinatura`;
const URL_OK = 'https://abcdefgh.supabase.co';

describe('guardas de build: variáveis públicas do Supabase', () => {
  it('sem variáveis: build somente demonstração (não falha)', () => {
    expect(checkEnv({})).toMatchObject({ mode: 'demo', errors: [] });
  });
  it('aceita a chave Publishable e a anon legada', () => {
    expect(checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnop' })).toMatchObject({ mode: 'cloud', errors: [] });
    expect(checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) })).toMatchObject({ mode: 'cloud', errors: [] });
  });
  it('recusa chaves privilegiadas (o site é público)', () => {
    expect(checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: 'sb_secret_abcdefghijklmnop' }).errors[0]).toMatch(/SECRETA/);
    expect(checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) }).errors[0]).toMatch(/service_role/);
  });
  it('recusa configuração incompleta, URL fora do padrão e formato desconhecido', () => {
    expect(checkEnv({ VITE_SUPABASE_URL: URL_OK }).mode).toBe('invalid');
    expect(checkEnv({ VITE_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnop' }).mode).toBe('invalid');
    expect(checkEnv({ VITE_SUPABASE_URL: 'https://evil.example.com', VITE_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnop' }).mode).toBe('invalid');
    expect(checkEnv({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: 'qualquer-coisa' }).mode).toBe('invalid');
  });
});
