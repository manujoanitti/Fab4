import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ambientePadrao, type Ambiente } from '../../scripts/art/lib/executar';
import { cmdCenariosPacote, cmdCenariosProcessar, imagensEntregues } from '../../scripts/art/lib/cenarios';

function amb(): Ambiente & { raiz: string } {
  const raiz = mkdtempSync(join(tmpdir(), 'cen-'));
  let n = 0;
  mkdirSync(join(raiz, 'public', 'art'), { recursive: true });
  writeFileSync(join(raiz, 'manifest.json'), JSON.stringify({ schema: 1, activePack: null, packs: {} }));
  return { ...ambientePadrao(() => {}), raiz, workDir: join(raiz, 'art-work'), publicDir: join(raiz, 'public', 'art'), manifestoPath: join(raiz, 'manifest.json'), agora: () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++)).toISOString() };
}

describe('pacote de produção dos cenários', () => {
  it('gera 5 prompts temáticos, com guia e manifesto por região, sem exigir layout de referência', async () => {
    const a = amb();
    const raiz = join(a.raiz, 'pacote');
    const r = await cmdCenariosPacote(a, raiz);
    expect(r.passos).toHaveLength(5);
    const temas = ['Floresta dos Sonhos', 'Castelo das Fadas', 'Lago Cristalino', 'Montanhas da Coragem', 'Jardim da Magia'];
    temas.forEach((t, i) => {
      const dir = join(raiz, `0${i + 1}-regiao-${i + 1}`);
      const prompt = readFileSync(join(dir, 'prompt.txt'), 'utf8');
      expect(prompt).toContain(`TEMA DA REGIÃO ${i + 1} — ${t}`);
      expect(prompt).toContain('NÃO desenhe trilha');
      expect(existsSync(join(dir, `guia-regiao-${i + 1}.png`))).toBe(true);
      const man = JSON.parse(readFileSync(join(dir, 'manifesto-proposta.json'), 'utf8')) as { assets: Record<string, { file: string }> };
      expect(man.assets[`map.region.${i + 1}.bg`].file).toBe(`map/region-${i + 1}-bg@2x.webp`);
    });
    expect(new Set(r.passos.map((p) => p.sha256Prompt)).size).toBe(5); // prompts distintos
    expect(readFileSync(join(raiz, 'LEIA-ME.md'), 'utf8')).toContain('Cenários entregues');
    expect(existsSync(join(raiz, '00-anexos-comuns', 'folha-de-estilo.png'))).toBe(true);
  }, 90_000);

  it('processa só as imagens entregues e avisa as ausentes; nada é aprovado/integrado', async () => {
    const a = amb();
    const dir = join(a.raiz, 'entrada');
    mkdirSync(dir, { recursive: true });
    // cenário sintético 800×1340 (região 1: com base) — gradiente suave
    const w = 800, h = 1340, buf = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 3; buf[o] = 190 + (y % 40) / 8; buf[o + 1] = 225 - y / 40; buf[o + 2] = 170 + x / 60; }
    await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toFile(join(dir, 'regiao-1.png'));
    expect(imagensEntregues(a, dir).map((x) => !!x.arquivo)).toEqual([true, false, false, false, false]);
    const r = await cmdCenariosProcessar(a, dir);
    expect(r.map((x) => x.presente)).toEqual([true, false, false, false, false]);
    expect(r[0].resumo!.ok + r[0].resumo!.revisar + r[0].resumo!.falha).toBe(2); // região 1 = cenário + base
    expect(existsSync(a.manifestoPath) && JSON.parse(readFileSync(a.manifestoPath, 'utf8')).activePack).toBeNull();
  }, 120_000);
});
