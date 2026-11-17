// Geometria das pranchas: células de proporção conhecida, margens, espaçamento e escolha da proporção da folha.
export type Aspecto = [number, number];
/** Proporções de imagem normalmente oferecidas pelo Gemini. */
export const ASPECTOS_PERMITIDOS: Aspecto[] = [[1, 1], [4, 3], [3, 4], [16, 9], [9, 16]];
export const MARGEM_PAGINA = 0.03; // fração da largura
export const ESPACO = 0.03; // entre células
export const ALTURA_MAX_LINHA = 0.36;

export interface ItemGrade { id: string; proporcao: number } // largura/altura do recurso final
export interface CelulaGrade { id: string; x: number; y: number; w: number; h: number; linha: number; coluna: number } // unidades: largura da folha = 1
export interface LayoutFolha {
  aspecto: Aspecto; altura: number; celulas: CelulaGrade[];
  linhas: Array<{ y: number; h: number; ids: string[] }>;
  pontuacao: number; // menor dimensão de célula (proxy de resolução), em frações da largura
}

function empacotar(itens: ItemGrade[], hNominal: number, util: number) {
  const linhas: ItemGrade[][] = [];
  let atual: ItemGrade[] = [], soma = 0;
  for (const it of itens) {
    const w = it.proporcao * hNominal;
    if (atual.length && soma + ESPACO + w > util) { linhas.push(atual); atual = []; soma = 0; }
    soma += (atual.length ? ESPACO : 0) + w;
    atual.push(it);
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

/** Distribui os itens em linhas (altura única por linha, largura = altura × proporção) e escolhe a melhor proporção de folha. */
export function layoutFolha(itens: ItemGrade[]): LayoutFolha {
  if (!itens.length) throw new Error('layoutFolha: sem itens');
  const util = 1 - 2 * MARGEM_PAGINA;
  let melhor: LayoutFolha | null = null;
  for (const aspecto of ASPECTOS_PERMITIDOS) {
    const alturaFolha = aspecto[1] / aspecto[0];
    for (let h0 = 0.08; h0 <= 0.5001; h0 += 0.01) {
      const grupos = empacotar(itens, h0, util);
      const alturas = grupos.map((g) => Math.min(ALTURA_MAX_LINHA, (util - ESPACO * (g.length - 1)) / g.reduce((s, i) => s + i.proporcao, 0)));
      const total = alturas.reduce((s, h) => s + h, 0) + ESPACO * (grupos.length - 1) + 2 * MARGEM_PAGINA;
      if (total > alturaFolha + 1e-9) continue;
      // folga vertical distribuída entre as linhas (e margens) para não deixar vazios no rodapé
      const folga = (alturaFolha - total) / (grupos.length + 1);
      let y = MARGEM_PAGINA + folga;
      const celulas: CelulaGrade[] = [];
      const linhas: LayoutFolha['linhas'] = [];
      grupos.forEach((g, li) => {
        const h = alturas[li];
        const largLinha = g.reduce((s, i) => s + i.proporcao * h, 0) + ESPACO * (g.length - 1);
        let x = (1 - largLinha) / 2;
        g.forEach((it, ci) => {
          const w = it.proporcao * h;
          celulas.push({ id: it.id, x, y, w, h, linha: li + 1, coluna: ci + 1 });
          x += w + ESPACO;
        });
        linhas.push({ y, h, ids: g.map((i) => i.id) });
        y += h + ESPACO + folga;
      });
      const pontuacao = Math.min(...celulas.map((c) => Math.min(c.w, c.h)));
      const cand: LayoutFolha = { aspecto, altura: alturaFolha, celulas, linhas, pontuacao };
      const melhorQue = !melhor || cand.pontuacao > melhor.pontuacao + 0.005 ||
        (Math.abs(cand.pontuacao - melhor.pontuacao) <= 0.005 && Math.abs(Math.log(cand.altura)) < Math.abs(Math.log(melhor.altura)) - 1e-9);
      if (melhorQue) melhor = cand;
    }
  }
  if (!melhor) throw new Error(`layoutFolha: não coube em nenhuma proporção (${itens.length} itens)`);
  return melhor;
}

/** Converte uma célula (unidades da largura) em frações da folha inteira. */
export function fracaoDaFolha(c: CelulaGrade, altura: number) {
  return { x: c.x, y: c.y / altura, w: c.w, h: c.h / altura };
}
export const proporcaoTexto = (a: Aspecto) => `${a[0]}:${a[1]}`;
export const orientacaoTexto = (a: Aspecto) => (a[0] === a[1] ? 'quadrada' : a[0] > a[1] ? 'paisagem (horizontal)' : 'retrato (vertical)');
