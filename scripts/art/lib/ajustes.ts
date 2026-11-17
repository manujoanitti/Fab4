// Ajustes de extração POR LOTE: um arquivo opcional `art-work/lotes/<lote>/ajustes.json` sobrepõe campos da saída de células
// específicas (escala por corpo, margem, tamanho do arquivo, exibição, área de texto, fatias) sem alterar o planejador, o catálogo
// global nem os arquivos gerados (prompt, processamento.json). Lotes sem o arquivo não mudam.
import { existsSync, readFileSync } from 'node:fs';
import type { LotePlano, SaidaSpec } from './types';

export interface AjustesLote { versao: 1; nota?: string; celulas: Record<string, Partial<SaidaSpec>> }

export function lerAjustes(caminho: string): AjustesLote | null {
  if (!existsSync(caminho)) return null;
  const j = JSON.parse(readFileSync(caminho, 'utf8')) as AjustesLote;
  if (j.versao !== 1 || typeof j.celulas !== 'object' || !j.celulas) throw new Error(`ajustes inválidos em ${caminho} (esperado { versao: 1, celulas: {…} })`);
  return j;
}

/** Devolve uma CÓPIA do lote com os ajustes aplicados (campo a campo; objetos aninhados são substituídos inteiros). */
export function aplicarAjustes(lote: LotePlano, caminho: string): LotePlano {
  const aj = lerAjustes(caminho);
  if (!aj || !lote.folha) return lote;
  const ids = new Set(lote.folha.celulas.map((c) => c.id));
  for (const id of Object.keys(aj.celulas)) if (!ids.has(id)) throw new Error(`ajustes.json: célula desconhecida "${id}" no lote ${lote.id}`);
  const copia = JSON.parse(JSON.stringify(lote)) as LotePlano;
  for (const c of copia.folha!.celulas) {
    const a = aj.celulas[c.id];
    if (a) c.saida = { ...c.saida, ...JSON.parse(JSON.stringify(a)) } as SaidaSpec;
  }
  return copia;
}
