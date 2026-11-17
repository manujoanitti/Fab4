# Imagens de referência (entradas aprovadas por você)

Coloque aqui, com estes nomes, os arquivos que acompanham os prompts no Gemini:

| Arquivo | O que é | Quando é necessário |
|---|---|---|
| `folha-de-estilo.png` | Folha de estilo visual aprovada (traço, paleta, atmosfera) | todos os lotes |
| `modelo-bianca.png` | Modelo oficial da personagem Bianca | lote `bianca-estatica` (e futuras animações) |
| `layout-regiao-1.png` … `layout-regiao-5.png` | Layout/composição aprovado de cada região | lotes `cenario-regiao-N` |

O comando `npm run art:prompt` mostra, para cada lote, quais anexos estão presentes (✅) ou faltando (⚠️).
Estes arquivos podem ficar no repositório público (decisão registrada).
