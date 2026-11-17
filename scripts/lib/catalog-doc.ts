// Gera o catálogo de recursos (Markdown) a partir de src/art/catalog.json — fonte única do contrato gráfico.
interface Entry {
  id: string; category: string; group: string; stem: string; kind: string; formats: string[]; px: { w: number; h: number };
  sheet?: { w: number; h: number }; sprite?: { frames: number; fps: number; loop: boolean; frameW: number; frameH: number };
  dimMode: 'exact' | 'aspect'; transparent: boolean; aspect: string; orientation: string; variants: string; desc: string;
  placement: string; relations: string; priority: string; lot: number; usedIn: string; maxKB: number;
}
export interface Catalog { version: number; catalog: Entry[] }

export const LOT_TITLES: Record<number, string> = {
  0: 'Lote 0 — Região 1 + personagem + marcos (referência de estilo)',
  1: 'Lote 1 — Ícones de interface',
  2: 'Lote 2 — Região 2 (Castelo das Fadas) e névoa',
  3: 'Lote 3 — Região 3 (Lago Cristalino)',
  4: 'Lote 4 — Região 4 (Montanhas da Coragem)',
  5: 'Lote 5 — Região 5 (Jardim da Magia), topo e bônus final',
  6: 'Lote 6 — Minigames: Caça às Estrelas e Memória dos Cristais',
  7: 'Lote 7 — Minigame: Jardim Encantado',
  8: 'Lote 8 — Fundos de interface e efeitos',
  9: 'Lote 9 — Opcionais (marcos por região, celebrações)',
};

const fmtPx = (e: Entry) => (e.kind === 'sprite' ? `${e.sheet!.w}×${e.sheet!.h} (${e.sprite!.frames}× ${e.px.w}×${e.px.h})` : `${e.px.w}×${e.px.h}`);
const fmtFormats = (e: Entry) => e.formats.map((f) => `.${f}`).join(' / ');
const fileFor = (e: Entry, ext: string) => `${e.stem}${ext === 'svg' ? '' : '@2x'}.${ext}`;
const file = (e: Entry) => e.formats.map((f) => `\`${fileFor(e, f)}\``).join(' ou ');

export function renderCatalogDoc(c: Catalog): string {
  const out: string[] = [];
  const P = (s = '') => out.push(s);
  P('# Catálogo de recursos gráficos');
  P();
  P('> **Gerado automaticamente** de `src/art/catalog.json` (`npm run art:docs`). Não edite este arquivo: altere o JSON e regenere.');
  P();
  P(`Total: **${c.catalog.length} recursos** em ${new Set(c.catalog.map((e) => e.group)).size} grupos. Contrato completo (formatos, camadas, nomes, cache): [contrato-integracao.md](contrato-integracao.md). Ordem de produção: [plano-producao-gemini.md](plano-producao-gemini.md).`);
  P();
  P('**Leitura das colunas** — *Px* = tamanho do arquivo (@2x; o mapa lógico tem 400 unidades de largura). *Exato* = o arquivo precisa ter exatamente esse tamanho; *proporção* = qualquer tamanho com a mesma proporção entre 0,5× e 2× do indicado. *Alfa* = exige fundo transparente. **Todos os recursos são opcionais**: sem o arquivo, o app usa o visual atual (fallback). **Nenhum recurso deve conter texto** (números, nomes de regiões, "Início" e "Bônus final" são desenhados pelo app).');
  P();
  P('## Resumo por lote');
  P();
  P('| Lote | Recursos | Prioridades |');
  P('|---|---:|---|');
  for (const lot of [...new Set(c.catalog.map((e) => e.lot))].sort((a, b) => a - b)) {
    const es = c.catalog.filter((e) => e.lot === lot);
    const pr = [...new Set(es.map((e) => e.priority))].sort().join(', ');
    P(`| ${LOT_TITLES[lot] ?? `Lote ${lot}`} | ${es.length} | ${pr} |`);
  }
  P();
  const groups = [...new Set(c.catalog.map((e) => e.group))];
  for (const g of groups) {
    const es = c.catalog.filter((e) => e.group === g);
    P(`## ${g}`);
    P();
    P('| ID lógico | Arquivo esperado (em `public/art/<pacote>/`; use UM dos formatos) | Px | Dimensão | Formato | Alfa | Prior. · Lote | Integra em |');
    P('|---|---|---|---|---|:-:|---|---|');
    for (const e of es) P(`| \`${e.id}\` | ${file(e)} | ${fmtPx(e)} | ${e.dimMode === 'exact' ? 'exato' : 'proporção'} | ${fmtFormats(e)} | ${e.transparent ? 'sim' : 'não'} | ${e.priority} · L${e.lot} | ${e.usedIn} |`);
    P();
    for (const e of es) {
      P(`- **\`${e.id}\`** — ${e.desc}`);
      P(`  - Proporção/orientação: ${e.aspect} (${e.orientation}) · variações/estados: ${e.variants} · orçamento: ≤ ${e.maxKB} KB`);
      P(`  - Posicionamento/ancoragem: ${e.placement}`);
      P(`  - Relação com outras camadas: ${e.relations}`);
      if (e.sprite) P(`  - Animação: tira horizontal, ${e.sprite.frames} quadros de ${e.sprite.frameW}×${e.sprite.frameH}px, ${e.sprite.fps} fps, ${e.sprite.loop ? 'em laço' : 'toca uma vez'}.`);
    }
    P();
  }
  return out.join('\n') + '\n';
}
