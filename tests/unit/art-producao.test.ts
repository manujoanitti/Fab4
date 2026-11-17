import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ambientePadrao, planoAtual, type Ambiente } from '../../scripts/art/lib/executar';
import { ORDEM_PRODUCAO, cmdProducaoPacote } from '../../scripts/art/lib/producao';
import { processarPrancha } from '../../scripts/art/lib/process';
import { gravarPng, sintetizar, tmp, type Forma } from './art-sinteticos';

const plano = planoAtual(ambientePadrao(() => {}));
const pranchas = ORDEM_PRODUCAO.map((id) => plano.lotes.find((l) => l.id === id)!).filter((l) => l.tipo === 'prancha');

describe('lotes restantes: pranchas compatíveis com o processamento automático', () => {
  it('a ordem de produção cobre exatamente os lotes restantes (sem piloto nem cenários)', () => {
    expect([...ORDEM_PRODUCAO].sort()).toEqual(plano.lotes.filter((l) => l.id !== 'piloto-marcos-regiao-1' && l.tipo !== 'cenario').map((l) => l.id).sort());
    expect(ORDEM_PRODUCAO).toHaveLength(19);
  });
  for (const lote of pranchas) {
    it(`${lote.id}: células dentro da folha, sem sobreposição, e uma prancha sintética é extraída sem falhas`, async () => {
      const f = lote.folha!;
      const H = f.aspecto[1] / f.aspecto[0];
      for (const c of f.celulas) {
        expect(c.rect.x).toBeGreaterThanOrEqual(0); expect(c.rect.y).toBeGreaterThanOrEqual(0);
        expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(1 + 1e-9); expect((c.rect.y + c.rect.h) * 1).toBeLessThanOrEqual(1 + 1e-9);
      }
      for (const [i, a] of f.celulas.entries()) for (const b of f.celulas.slice(i + 1)) {
        const sep = a.rect.x + a.rect.w <= b.rect.x + 1e-9 || b.rect.x + b.rect.w <= a.rect.x + 1e-9 || a.rect.y + a.rect.h <= b.rect.y + 1e-9 || b.rect.y + b.rect.h <= a.rect.y + 1e-9;
        expect(sep, `${a.id} × ${b.id}`).toBe(true);
      }
      expect(H).toBeGreaterThan(0);
      const formas: Record<string, Forma> = {};
      f.celulas.forEach((c, i) => { formas[c.id] = { t: 'ret', cor: [(60 + i * 37) % 200, (120 + i * 53) % 200, (200 - i * 29 + 200) % 200], fw: 0.6, fh: 0.6 }; });
      const pasta = tmp();
      const original = await gravarPng(sintetizar(f, formas, { largura: 1024, ruido: 3 }), pasta);
      const res = await processarPrancha({ pastaLote: pasta, lote, original });
      expect(res.recursos).toHaveLength(f.celulas.length);
      for (const r of res.recursos) expect(r.status, `${r.id}: ${r.problemas.map((p) => p.codigo).join(',')}`).not.toBe('falha');
    }, 60_000);
  }
});

describe('pacote de produção', () => {
  it('gera 19 passos com prompt, manifestos e (nas pranchas) guia; sinaliza a dependência do modelo da Bianca sem bloquear', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'prod-'));
    mkdirSync(join(raiz, 'public', 'art'), { recursive: true });
    writeFileSync(join(raiz, 'manifest.json'), JSON.stringify({ schema: 1, activePack: null, packs: {} }));
    let n = 0;
    const a: Ambiente = { ...ambientePadrao(() => {}), workDir: join(raiz, 'art-work'), publicDir: join(raiz, 'public', 'art'), manifestoPath: join(raiz, 'manifest.json'), agora: () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++)).toISOString() };
    const pacote = join(raiz, 'pacote');
    const r = await cmdProducaoPacote(a, pacote);
    expect(r.passos).toHaveLength(19);
    expect(r.dependencias).toEqual(existsSync('art-work/referencias/modelo-bianca.png') ? [] : ['art-work/referencias/modelo-bianca.png']);
    for (const p of r.passos) {
      expect(existsSync(String(p.prompt)), String(p.lote)).toBe(true);
      expect(existsSync(join(String(p.pasta), 'manifesto-proposta.json'))).toBe(true);
      expect(existsSync(join(String(p.pasta), 'manifesto-processamento.json'))).toBe(true);
      if (p.tipo === 'prancha') expect(existsSync(String(p.guia))).toBe(true);
    }
    expect(r.passos.filter((p) => (p.dependenciasFaltando as string[]).length).map((p) => p.lote)).toEqual(['bianca-estatica']);
    expect(existsSync(join(pacote, '04-faixas-regioes-2-5', 'faixa-regiao-1-aprovada.png'))).toBe(true);
    expect(readFileSync(join(pacote, 'LEIA-ME.md'), 'utf8')).toContain('Produção entregue');
  }, 120_000);
});
