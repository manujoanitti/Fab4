import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import catalogJson from '../../src/art/catalog.json';
import { validateArt } from '../../scripts/validate-art.mjs';
import { ambientePadrao, cmdApprove, cmdIntegrate, cmdPlan, cmdProcess, cmdPrompt, cmdReopen, cmdReview, cmdStatus, type Ambiente } from '../../scripts/art/lib/executar';
import { lerRaw, paraPng } from '../../scripts/art/lib/imaging';
import { PILOTO_ID, PILOTO_IDS, planejar } from '../../scripts/art/lib/planner';
import { pastaLote, transicao, carregarRegistro, sincronizarComPlano, obter } from '../../scripts/art/lib/registry';
import { compararBordas, processarCenario, processarIndividual } from '../../scripts/art/lib/scenario';
import { pastaSaida } from '../../scripts/art/lib/process';
import { DEFAULT_LAYOUT } from '../../src/ui/mapGeometry';
import type { CatalogFile } from '../../scripts/art/lib/types';
import { FORMAS_PILOTO, gravarPng, sintetizar, tmp } from './art-sinteticos';

const cat = catalogJson as unknown as CatalogFile;
const plano = planejar(cat);
const piloto = plano.lotes.find((l) => l.id === PILOTO_ID)!;

function ambiente(): Ambiente & { raiz: string } {
  const raiz = tmp();
  let n = 0;
  mkdirSync(join(raiz, 'public', 'art'), { recursive: true });
  writeFileSync(join(raiz, 'manifest.json'), JSON.stringify({ schema: 1, activePack: null, packs: {} }));
  return { ...ambientePadrao(() => {}), raiz, workDir: join(raiz, 'art-work'), publicDir: join(raiz, 'public', 'art'), manifestoPath: join(raiz, 'manifest.json'), agora: () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++)).toISOString() };
}
async function prancha(raiz: string, nome = 'gemini.png', formas = FORMAS_PILOTO, ruido = 3) {
  return gravarPng(sintetizar(piloto.folha!, formas, { largura: 1024, ruido }), join(raiz, 'entrada'), nome);
}

describe('máquina de estados do registro', () => {
  it('só permite transições válidas e guarda histórico', () => {
    const a = ambiente();
    let r = sincronizarComPlano(carregarRegistro(a.workDir), plano.lotes, a.agora);
    expect(obter(r, PILOTO_ID).estado).toBe('planejado');
    expect(() => transicao(r, PILOTO_ID, 'aprovado', a.agora)).toThrow(/transição inválida/);
    r = transicao(r, PILOTO_ID, 'aguardando_geracao', a.agora, 'prompt');
    r = transicao(r, PILOTO_ID, 'recebido', a.agora);
    expect(obter(r, PILOTO_ID).historico.map((h) => h.estado)).toEqual(['planejado', 'aguardando_geracao', 'recebido']);
    expect(() => transicao(r, PILOTO_ID, 'integrado', a.agora)).toThrow();
  });
  it('sincronizar com o plano não apaga estados existentes e é idempotente', () => {
    const a = ambiente();
    let r = sincronizarComPlano(carregarRegistro(a.workDir), plano.lotes, a.agora);
    r = transicao(r, PILOTO_ID, 'aguardando_geracao', a.agora);
    const r2 = sincronizarComPlano(r, plano.lotes, a.agora);
    expect(r2.lotes).toHaveLength(plano.lotes.length);
    expect(obter(r2, PILOTO_ID).estado).toBe('aguardando_geracao');
  });
});

describe('ciclo completo do lote piloto (imagem sintética no lugar do Gemini)', () => {
  it('plan → prompt → process → review → approve → integrate, com estados, retomada e auditoria', async () => {
    const a = ambiente();
    // 1) plano
    const p = cmdPlan(a);
    expect(p.proximo).toBe(PILOTO_ID);
    expect(p.linhas.find((l) => l.id === 'icones-ui-1')!.bloqueadoPor).toEqual([PILOTO_ID]);
    // 2) prompt (idempotente)
    const pr = await cmdPrompt(a, PILOTO_ID);
    for (const f of ['prompt.md', 'prompt-gemini.txt', 'processamento.json', 'guia-prancha.png', 'guia-prancha.svg']) expect(existsSync(join(pr.pasta, f)), f).toBe(true);
    const antes = readFileSync(join(pr.pasta, 'prompt-gemini.txt'), 'utf8');
    await cmdPrompt(a, PILOTO_ID);
    expect(readFileSync(join(pr.pasta, 'prompt-gemini.txt'), 'utf8')).toBe(antes);
    expect(cmdStatus(a, PILOTO_ID).registro.estado).toBe('aguardando_geracao');
    // aprovar antes de revisar é recusado
    expect(() => cmdApprove(a, PILOTO_ID, { todos: true })).toThrow(/depois da revisão/);
    // 3) process (lote inferido: único aguardando geração)
    const arq = await prancha(a.raiz);
    const r1 = await cmdProcess(a, undefined, arq);
    expect(r1.lote.id).toBe(PILOTO_ID);
    expect(r1.pulou).toBe(false);
    expect(r1.resultado.recursos.every((q) => q.status !== 'falha')).toBe(true);
    let st = cmdStatus(a, PILOTO_ID).registro;
    expect(st.estado).toBe('processado');
    expect(st.recebido!.sha256).toHaveLength(64);
    expect(readdirSync(join(pr.pasta, 'recebido'))).toHaveLength(1);
    // 4) mesma imagem de novo: nada é refeito
    const saida = join(pastaSaida(pr.pasta, 'v1'), 'map/node-done@2x.webp');
    const m1 = statSync(saida).mtimeMs;
    const r2 = await cmdProcess(a, PILOTO_ID, arq);
    expect(r2.pulou).toBe(true);
    expect(statSync(saida).mtimeMs).toBe(m1);
    expect(cmdStatus(a, PILOTO_ID).registro.historico.map((h) => h.estado)).toEqual(['planejado', 'aguardando_geracao', 'recebido', 'processado']);
    // 5) interrupção simulada: lote ficou em "recebido" sem resultado → retoma sem duplicar o original
    const regFile = join(a.workDir, 'registro.json');
    const reg = JSON.parse(readFileSync(regFile, 'utf8'));
    const l = reg.lotes.find((x: { id: string }) => x.id === PILOTO_ID);
    l.estado = 'recebido'; delete l.etapas.processar;
    writeFileSync(regFile, JSON.stringify(reg));
    rmSyncSafe(join(pr.pasta, 'resultado.json'));
    const r3 = await cmdProcess(a, PILOTO_ID, arq);
    expect(r3.pulou).toBe(false);
    expect(cmdStatus(a, PILOTO_ID).registro.estado).toBe('processado');
    expect(readdirSync(join(pr.pasta, 'recebido'))).toHaveLength(1);
    // 6) nova imagem: os dois originais são preservados
    const arq2 = await prancha(a.raiz, 'gemini-2.png', FORMAS_PILOTO, 5);
    await cmdProcess(a, PILOTO_ID, arq2);
    expect(readdirSync(join(pr.pasta, 'recebido'))).toHaveLength(2);
    // 7) revisão
    const rv = await cmdReview(a, PILOTO_ID);
    expect(existsSync(rv.rev.relatorioHtml) && existsSync(rv.rev.conferencia) && existsSync(rv.rev.qaJson) && !!rv.rev.deteccao).toBe(true);
    const meta = await sharp(rv.rev.conferencia).metadata();
    expect(meta.width).toBeGreaterThan(500);
    const html = readFileSync(rv.rev.relatorioHtml, 'utf8');
    expect(html).toContain('Validação técnica ≠ aprovação artística');
    for (const id of PILOTO_IDS) expect(html).toContain(id);
    expect((JSON.parse(readFileSync(rv.rev.qaJson, 'utf8')) as { recursos: Array<{ aprovacaoArtistica: string }> }).recursos.every((x) => x.aprovacaoArtistica === 'pendente')).toBe(true);
    expect(cmdStatus(a, PILOTO_ID).registro.estado).toBe('em_revisao');
    // 8) aprovação artística é manual e por recurso
    const parcial = cmdApprove(a, PILOTO_ID, { ids: ['map.node.locked', 'map.node.done'] });
    expect(parcial.estado).toBe('em_revisao');
    expect(parcial.pendentes).toHaveLength(4);
    const rej = cmdApprove(a, PILOTO_ID, { todos: true, rejeitar: ['map.start'] });
    expect(rej.estado).toBe('em_revisao');
    expect(rej.rejeitados).toEqual(['map.start']);
    expect(() => cmdIntegrate(a, PILOTO_ID, { confirmar: true })).toThrow(/APROVADO/);
    const ok = cmdApprove(a, PILOTO_ID, { ids: ['map.start'] });
    expect(ok.estado).toBe('aprovado');
    // dependentes liberados
    expect(cmdPlan(a).linhas.find((x) => x.id === 'icones-ui-1')!.bloqueadoPor).toEqual([]);
    // 9) integração: simulação não altera nada; confirmação copia, valida e atualiza o manifesto (sem ativar o pacote)
    const sim = cmdIntegrate(a, PILOTO_ID, {});
    expect(sim.simulacao).toBe(true);
    expect(existsSync(join(a.publicDir, 'v1'))).toBe(false);
    const res = cmdIntegrate(a, PILOTO_ID, { confirmar: true });
    expect(res.ok).toBe(true);
    const man = JSON.parse(readFileSync(a.manifestoPath, 'utf8'));
    expect(man.activePack).toBeNull(); // nada é ativado automaticamente
    expect(Object.keys(man.packs.v1.assets)).toEqual(PILOTO_IDS);
    expect(validateArt({ manifest: man, catalog: cat, publicDir: a.publicDir }).errors).toEqual([]);
    expect(cmdStatus(a, PILOTO_ID).registro.estado).toBe('integrado');
  }, 120_000);

  it('recurso com FALHA técnica não pode ser aprovado (a menos que se assuma a responsabilidade)', async () => {
    const a = ambiente();
    await cmdPrompt(a, PILOTO_ID);
    await cmdProcess(a, PILOTO_ID, await prancha(a.raiz, 'g.png', { ...FORMAS_PILOTO, 'map.node.available': { t: 'vazio' } }));
    await cmdReview(a, PILOTO_ID);
    expect(() => cmdApprove(a, PILOTO_ID, { todos: true })).toThrow(/FALHA técnica.*map\.node\.available/);
    expect(() => cmdApprove(a, PILOTO_ID, { ids: ['nao.existe'] })).toThrow(/fora do lote/);
    const r = cmdApprove(a, PILOTO_ID, { todos: true, rejeitar: ['map.node.available'] });
    expect(r.rejeitados).toEqual(['map.node.available']);
    expect(r.estado).toBe('em_revisao');
  }, 60_000);

  it('integração é desfeita por completo se a validação falhar (nenhum arquivo, manifesto intacto)', async () => {
    const a = ambiente();
    await cmdPrompt(a, PILOTO_ID);
    await cmdProcess(a, PILOTO_ID, await prancha(a.raiz));
    await cmdReview(a, PILOTO_ID);
    cmdApprove(a, PILOTO_ID, { todos: true });
    const staged = join(pastaSaida(pastaLote(a.workDir, PILOTO_ID), 'v1'), 'map/node-done@2x.webp');
    writeFileSync(staged, await sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).webp().toBuffer()); // proporção errada (2:1 em vez de 1:1)
    const antes = readFileSync(a.manifestoPath, 'utf8');
    const r = cmdIntegrate(a, PILOTO_ID, { confirmar: true });
    expect(r.ok).toBe(false);
    expect(r.erros.join(' ')).toMatch(/proporção|dimensões/);
    expect(readFileSync(a.manifestoPath, 'utf8')).toBe(antes);
    expect(existsSync(join(a.publicDir, 'v1', 'map', 'node-locked@2x.webp'))).toBe(false);
    expect(cmdStatus(a, PILOTO_ID).registro.estado).toBe('aprovado'); // continua aprovado; nada foi integrado
  }, 60_000);

  it('reabrir devolve o lote para "aguardando geração" e zera aprovações', async () => {
    const a = ambiente();
    await cmdPrompt(a, PILOTO_ID);
    await cmdProcess(a, PILOTO_ID, await prancha(a.raiz));
    const r = cmdReopen(a, PILOTO_ID, 'estilo não aprovado');
    expect(r.estado).toBe('aguardando_geracao');
    expect(r.aprovacao).toEqual({});
    expect(r.historico.at(-1)!.nota).toBe('estilo não aprovado');
  }, 60_000);
  it('lote aprovado não é reprocessado sem --forcar', async () => {
    const a = ambiente();
    await cmdPrompt(a, PILOTO_ID);
    const arq = await prancha(a.raiz);
    await cmdProcess(a, PILOTO_ID, arq);
    await cmdReview(a, PILOTO_ID);
    cmdApprove(a, PILOTO_ID, { todos: true });
    await expect(cmdProcess(a, PILOTO_ID, await prancha(a.raiz, 'outra.png', FORMAS_PILOTO, 6))).rejects.toThrow(/já está aprovado/);
    const f = await cmdProcess(a, PILOTO_ID, await prancha(a.raiz, 'outra.png', FORMAS_PILOTO, 6), { forcar: true });
    expect(f.pulou).toBe(false);
    expect(cmdStatus(a, PILOTO_ID).registro.estado).toBe('processado');
  }, 90_000);
  it('mensagens claras para entradas inválidas', async () => {
    const a = ambiente();
    await expect(cmdProcess(a, PILOTO_ID, join(a.raiz, 'nao-existe.png'))).rejects.toThrow(/arquivo não encontrado/);
    const lixo = join(a.raiz, 'lixo.png'); writeFileSync(lixo, 'isto não é uma imagem');
    await expect(cmdProcess(a, PILOTO_ID, lixo)).rejects.toThrow(/não foi possível ler a imagem/);
    await expect(cmdPrompt(a, 'lote-inexistente')).rejects.toThrow(/lote desconhecido/);
    await expect(cmdProcess(a, undefined, await prancha(a.raiz))).rejects.toThrow(/informe o lote/);
  });
});

describe('cenários das regiões', () => {
  const lote1 = plano.lotes.find((l) => l.id === 'cenario-regiao-1')!;
  /** Cenário calmo (gradiente suave + ruído leve) com uma "zona agitada" (xadrez fino) sobre a casa 1.3. */
  async function cena(w: number, h: number, agitadoEm?: { x: number; y: number; r: number }) {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let v = 170 + 40 * Math.sin(x / 90) + 20 * (y / h);
      if (agitadoEm && (x - agitadoEm.x) ** 2 + (y - agitadoEm.y) ** 2 < agitadoEm.r ** 2) v = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? 255 : 0;
      data[i] = v; data[i + 1] = v * 0.9; data[i + 2] = v * 0.8 + 20; data[i + 3] = 255;
    }
    return { data, width: w, height: h };
  }
  const posCena = (fase: number, w: number) => { const n = DEFAULT_LAYOUT.nodes[fase - 1]; const k = w / 800; return { x: n.x * 2 * k, y: (n.y - 2290) * 2 * k, r: 36 * 2 * k }; };

  it('prepara região 1 + base com resolução exata, prévia com a geometria real e sem zonas agitadas', async () => {
    const raiz = tmp();
    const arq = join(raiz, 'cena.png'); writeFileSync(arq, await paraPng(await cena(600, 1005)));
    const r = await processarCenario({ pastaLote: join(raiz, 'lote'), lote: lote1, original: arq });
    expect(r.recursos.map((x) => x.id)).toEqual(['map.region.1.bg', 'map.bottom.bg']);
    const dims = await Promise.all(r.arquivosSaida.map(async (f) => { const m = await sharp(f).metadata(); return [m.format, m.width, m.height, m.hasAlpha]; }));
    expect(dims[0].slice(0, 3)).toEqual(['webp', 800, 1080]);
    expect(dims[1].slice(0, 3)).toEqual(['webp', 800, 260]);
    expect(r.recursos.every((q) => q.status !== 'falha')).toBe(true);
    expect(r.zonas.zonas.filter((z) => z.status === 'revisar')).toEqual([]);
    expect(r.avisosGerais.join(' ')).toMatch(/Camadas.*não foram separadas/);
    // a prévia desenha a casa (círculo branco com número) exatamente na posição funcional
    const previa = await lerRaw(r.previa);
    expect([previa.width, previa.height]).toEqual([800, 1340]);
    const n = DEFAULT_LAYOUT.nodes[0];
    const x = Math.round(n.x * 2), y = Math.round((n.y - 2290) * 2) - 36; // acima do número, dentro do círculo branco (r=25 → 50 px)
    const i = (y * previa.width + x) * 4;
    expect(previa.data[i] + previa.data[i + 1] + previa.data[i + 2]).toBeGreaterThan(740);
  });
  it('sinaliza a zona agitada exatamente na casa afetada', async () => {
    const raiz = tmp();
    const ag = posCena(3, 600);
    const arq = join(raiz, 'cena.png'); writeFileSync(arq, await paraPng(await cena(600, 1005, ag)));
    const r = await processarCenario({ pastaLote: join(raiz, 'lote'), lote: lote1, original: arq });
    expect(r.zonas.zonas.filter((z) => z.status === 'revisar').map((z) => z.nome)).toEqual(['casa 1.3']);
    const bg = r.recursos.find((q) => q.id === 'map.region.1.bg')!;
    expect(bg.status).toBe('revisar');
    expect(bg.problemas.map((p) => p.codigo)).toContain('zona-carregada');
  });
  it('proporção muito diferente é recusada; diferença moderada recorta ao centro com aviso', async () => {
    const raiz = tmp();
    const larga = join(raiz, 'larga.png'); writeFileSync(larga, await paraPng(await cena(1000, 800)));
    await expect(processarCenario({ pastaLote: join(raiz, 'a'), lote: lote1, original: larga })).rejects.toThrow(/proporção/);
    const quase = join(raiz, 'quase.png'); writeFileSync(quase, await paraPng(await cena(600, 900)));
    const r = await processarCenario({ pastaLote: join(raiz, 'b'), lote: lote1, original: quase });
    expect(r.avisosGerais.join(' ')).toMatch(/recortada ao centro/);
  });
  it('emenda entre regiões vizinhas: mede a diferença das bordas que se tocam', async () => {
    const igual = await cena(800, 1080);
    expect(compararBordas(igual, igual)).toBeLessThan(40); // mesma imagem: borda inferior × superior do mesmo padrão
    const preta = { data: new Uint8Array(800 * 1080 * 4).fill(0), width: 800, height: 1080 }; preta.data.forEach((_, i) => { if (i % 4 === 3) preta.data[i] = 255; });
    const branca = { ...preta, data: new Uint8Array(preta.data.length).fill(255) };
    expect(compararBordas(preta, branca)).toBeCloseTo(255, 0);
    expect(compararBordas(preta, preta)).toBe(0);
    const raiz = tmp();
    const lote2 = plano.lotes.find((l) => l.id === 'cenario-regiao-2')!;
    const arq2 = join(raiz, 'c2.png'); writeFileSync(arq2, await paraPng(await cena(600, 810)));
    const r = await processarCenario({ pastaLote: join(raiz, 'l2'), lote: lote2, original: arq2, vizinhas: { abaixo: branca } });
    expect(r.recursos[0].problemas.map((p) => p.codigo)).toContain('emenda');
  });
  it('fundo individual (ex.: céu do minigame): resolução exata e conferência técnica', async () => {
    const lote = plano.lotes.find((l) => l.id === 'fundo-game-stars-bg')!;
    const raiz = tmp();
    const arq = join(raiz, 'ceu.png'); writeFileSync(arq, await paraPng(await cena(720, 1280)));
    const r = await processarIndividual({ pastaLote: join(raiz, 'l'), lote, original: arq });
    const m = await sharp(r.arquivosSaida[0]).metadata();
    expect([m.width, m.height, m.format]).toEqual([1080, 1920, 'webp']);
    expect(r.recursos[0].status).not.toBe('falha');
  });
  it('imagem uniforme (vazia) é marcada como falha técnica', async () => {
    const raiz = tmp();
    const arq = join(raiz, 'vazio.png');
    writeFileSync(arq, await sharp({ create: { width: 600, height: 810, channels: 3, background: '#808080' } }).png().toBuffer());
    const r = await processarCenario({ pastaLote: join(raiz, 'c'), lote: plano.lotes.find((l) => l.id === 'cenario-regiao-2')!, original: arq });
    expect(r.recursos[0].status).toBe('falha');
    expect(r.recursos[0].problemas.map((p) => p.codigo)).toContain('uniforme');
  });
});

describe('interface de comandos e arquivos versionados', () => {
  it('npm run art:plan / prompt funcionam de ponta a ponta (processo real) e o erro sai com mensagem amigável', () => {
    const raiz = tmp();
    const env = { ...process.env, ART_WORK_DIR: join(raiz, 'aw') };
    const cli = (...args: string[]) => execFileSync('npx', ['vite-node', 'scripts/art/cli.ts', ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const plan = cli('plan');
    expect(plan).toContain('LOTES DE PRODUÇÃO');
    expect(plan).toContain(`Próximo lote: ${PILOTO_ID}`);
    expect(plan).toMatch(/25 lotes/);
    const prompt = cli('prompt');
    expect(prompt).toContain('Fantasia onírica e poética');
    expect(prompt).toContain('npm run art:process -- piloto-marcos-regiao-1');
    expect(existsSync(join(raiz, 'aw', 'lotes', PILOTO_ID, 'guia-prancha.png'))).toBe(true);
    let erro = '';
    try { cli('process', 'nao-existe.png'); } catch (e) { erro = String((e as { stderr?: string }).stderr); }
    expect(erro).toMatch(/arquivo não encontrado/);
    expect(cli('help')).toContain('art:process');
  }, 90_000);

  it('os arquivos do piloto versionados em art-work/ estão atualizados em relação ao planejador', async () => {
    const a = ambiente();
    const r = await cmdPrompt(a, PILOTO_ID);
    for (const f of ['prompt.md', 'prompt-gemini.txt', 'processamento.json', 'guia-prancha.svg']) {
      const versionado = join(__dirname, '../../art-work/lotes', PILOTO_ID, f);
      expect(existsSync(versionado), f).toBe(true);
      expect(readFileSync(versionado, 'utf8'), f).toBe(readFileSync(join(r.pasta, f), 'utf8'));
    }
  });
  it('o registro versionado cobre todos os lotes; o piloto avançou, mas nunca aprovado/integrado sem ordem', () => {
    const reg = JSON.parse(readFileSync(join(__dirname, '../../art-work/registro.json'), 'utf8')) as { lotes: Array<{ id: string; estado: string }> };
    expect(reg.lotes.map((l) => l.id)).toEqual(plano.lotes.map((l) => l.id));
    expect(['aguardando_geracao', 'recebido', 'processado', 'em_revisao']).toContain(reg.lotes.find((l) => l.id === PILOTO_ID)!.estado);
    expect(reg.lotes.filter((l) => l.id !== PILOTO_ID).every((l) => l.estado === 'planejado')).toBe(true);
  });
  it('nada foi integrado ao app: manifesto sem pacote e public/art inexistente', () => {
    const man = JSON.parse(readFileSync(join(__dirname, '../../src/art/manifest.json'), 'utf8'));
    expect(man).toEqual({ schema: 1, activePack: null, packs: {} });
    expect(existsSync(join(__dirname, '../../public/art'))).toBe(false);
  });
});

import { rmSync } from 'node:fs';
function rmSyncSafe(p: string) { rmSync(p, { force: true }); }
