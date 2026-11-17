# Procedimento de recebimento e integração

Para cada lote aprovado (ver [plano-producao-gemini.md](plano-producao-gemini.md)). Tempo típico: poucos minutos por lote.

## 1. Entrega
Envie um `.zip` com a estrutura final, por pacote:
```
v1/
  map/region-1-bg@2x.webp  map/region-1-mid@2x.webp  map/node-done@2x.webp …
  char/bianca-idle@2x.webp
  ui/icon-coin.svg …
  game/…  fx/…
LEIA-ME.txt   (lista de IDs entregues e observações, ex.: "idle com 1 quadro")
```
Nomes **exatamente** como no [catálogo](catalogo-recursos.md) (regra: `<categoria>/<id sem pontos>[@2x].<ext>`).

## 2. Pré-processamento (se ainda não feito)
| Necessidade | Ferramenta gratuita | Exemplo |
|---|---|---|
| Redimensionar para o tamanho exato | ImageMagick / GIMP / Krita | `magick in.png -resize 800x1080! out.png` |
| Remover fundo chapado (alfa) | ImageMagick / GIMP | `magick in.png -fuzz 8% -transparent "#FF00FF" -trim +repage out.png` (depois recentre no quadro) |
| Converter para WebP | `cwebp` / Squoosh | `cwebp -q 82 in.png -o out.webp` (opaco) · `cwebp -q 92 -alpha_q 100 in.png -o out.webp` (alfa) |
| Montar a tira de quadros | ImageMagick | `magick frame-*.png +append bianca-walk@2x.png` |
Confira: dimensões, alfa onde exigido, sem franja de cor, orçamento de peso.

## 3. Integração no repositório (branch de desenvolvimento)
1. **Copie** os arquivos para `public/art/<pacote>/…` (pacote novo ou o existente do lote).
2. **Registre** cada arquivo em `src/art/manifest.json` (mínimo: o `file` de cada ID; exemplo no contrato, seção 6). Para tamanho, âncora e quadros, o catálogo já fornece os padrões.
3. Se for o primeiro pacote, defina `"activePack": "<pacote>"`.
4. **Valide:** `npm run art:validate` — corrija todos os **erros** (ID/nome/formato/dimensões/alfa/SVG inseguro/arquivo ausente) e leia os **avisos** (peso, arquivos não registrados).
5. **Prévia local:** `npm run dev` → `http://localhost:5173/?demo` (com arte) · `…?demo&artpack=none` (sem arte, para comparar) · `…?demo&artpack=<outro>` (outro pacote). Use "Simular campanha completa" para ver todos os estados. Sobreponha os [guias](guias/) em captura de tela para conferir o alinhamento.
6. **Testes:** `npm test` e `npm run test:e2e`. O golden de aparência continua valendo (sem arte = visual atual); se o pacote definir `layout` (novas posições), atualize o golden conscientemente (`UPDATE_GOLDEN=1`).
7. **Build:** `npm run build` (o `prebuild` roda `art:validate`; falha = build bloqueado) e `node scripts/check-dist.mjs /Fab4/`.
8. **Publicação:** commit na branch → CI → pull request → (após sua aprovação) merge → deploy automático. O hash `?v=` invalida o cache dos aparelhos que já têm a versão anterior.

## 4. Reversão
- Voltar para o pacote anterior: trocar `activePack` e publicar. Sem arte: `"activePack": null`.
- Testar a reversão sem publicar: `?artpack=<pacote anterior>` / `?artpack=none`.
- Pacotes antigos podem ser apagados (pasta + bloco do manifesto) só quando o novo estiver estável.

## 5. Problemas comuns
| Sintoma | Causa provável | Solução |
|---|---|---|
| `ID não existe no catálogo` | ID digitado diferente | copie o ID do catálogo |
| `nome fora da convenção` | arquivo com nome livre | renomeie para o esperado (mensagem mostra o nome) |
| `dimensões devem ser exatamente…` | exportou em 1× ou com margem | exporte @2x no tamanho do catálogo |
| `exige fundo transparente` | WebP/PNG sem alfa | refazer o recorte; salve com canal alfa |
| `tira de quadros deve ter…` | nº de quadros ≠ catálogo | ajuste a tira ou declare `sprite.frames` coerente no manifesto |
| A arte não aparece, mas o validador passou | cache antigo / arquivo não registrado | recarregue; confira `?artpack=` e o `activePack` |
| Casas desalinhadas com a trilha | trilha não passa pelo centro das casas | refaça com o guia; ou (último recurso) ajuste `layout.nodes` do pacote |
| Aparece o desenho antigo num recurso | falhou ao carregar (404/rede) | abra o arquivo direto na URL; confira nome e pasta |
