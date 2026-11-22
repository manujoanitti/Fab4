# Limitações, inconsistências e lacunas

Este documento é a versão **pública** (sem nomes de pessoas vivas). A versão completa é gerada pelo app a partir dos itens de revisão: Administração → Revisão → “Exportar relatório de inconsistências e lacunas”, e `npm run seed` a grava em `data/real/relatorio-inconsistencias-e-lacunas.md` (fora do git).

## 1. O que foi efetivamente implementado
Banco SQLite normalizado e migrado (pessoas, relações, eventos, lugares hierárquicos, fontes, evidências, afirmações, investigações, núcleos, agrupamentos, identidades, sobrenomes, contexto); importador idempotente com auditoria; relatório real importado (29 pessoas, 5 núcleos, 26 lugares, 61 fontes, 42 eventos, 24 afirmações, 155 evidências, 8 investigações, 39 itens de revisão); as 8 telas pedidas; árvore com zoom, arraste, reorganização automática, foco em ancestrais/descendentes, expandir/recolher, linhagem destacada, busca, orientação vertical/horizontal, painel lateral e exportação PNG/PDF; mapa com rotas hipotéticas tracejadas; linha do tempo com filtros e contexto; acervo de documentos; investigações com hipóteses A/B/C, documentos pendentes, evidências e histórico; administração com edição validada, histórico, arquivamento/restauração, integridade, revisão, importação incremental, exportação JSON/GEDCOM/CSV/SQLite, backup e restauração; visão pública com redação de pessoas vivas; 76 testes automatizados + e2e em Chromium.

## 2. Limitações conhecidas (não implementado ou parcial)
* **Autenticação**: um token administrativo único; não há usuários, papéis nem autoria real (o autor do histórico é um rótulo).
* **Arquivos**: documentos e fotografias são referências (URL, `local_file`, `avatar_url`); não há upload/armazenamento binário nem visualizador de PDF/imagem.
* **GEDCOM**: só exportação (e só o que o formato comporta: hipóteses viram notas). Não há importação de GEDCOM; o JSON de backup é a via de ida e volta sem perdas.
* **Imagens/PDF**: PNG da árvore e PDF por impressão; mapa e linha do tempo não têm exportação dedicada.
* **Mapa**: *tiles* do OSM exigem internet; as coordenadas foram acrescentadas pelo operador (aproximadas) e estão todas marcadas como **não verificadas**.
* **Extração**: feita por leitura humana/assistida do relatório e conferida por citações — não há PLN automático (decisão consciente: evitar inventar fatos). Novos relatórios exigem produzir um pacote.
* **Duplicatas**: há ligação de identidade e mesclagem assistida na importação, mas não uma ferramenta de fusão de pessoas.
* **Escala**: snapshot inteiro em memória; layout ELK superlinear (ver arquitetura) — mitigado por recolhimento automático acima de 500 pessoas e foco por geração. Desempenho no navegador não foi medido (só em Node).
* **Usabilidade**: revisada por inspeção das capturas e testes e2e (desktop e celular, claro/escuro por tokens), **sem testes com usuários nem auditoria formal de acessibilidade** (leitor de tela). Há ARIA/rótulos, foco visível e a legenda não depende de cor.
* **Plataforma**: `node:sqlite` é experimental no Node 22 e exige Node ≥ 22.13.
* **Busca fuzzy**: heurística fonética própria; ajuda a achar variantes, não prova identidade.
* **Contexto histórico**: 5 faixas vêm do relatório; 3 são contexto geral do operador (marcadas como tal).

## 3. Inconsistências do relatório e como foram tratadas
| # | Inconsistência | Tratamento |
|---|---|---|
| 1 | Resumo fala em “fontes históricas primárias”, mas o único documento primário citado (relação pastoral de 1712) nunca foi examinado. | Fonte registrada como **citada, não examinada**; eventos apoiados nela ficaram “fortemente corroborado”, não “documentado”. |
| 2 | Tabela da Árvore A fala em “irmãos de…” e “prováveis pais/filhos”, mas o texto admite que os extratos não mostram rótulos relacionais. | **Nenhuma filiação/casamento/irmandade criada**; só agrupamento investigativo + hipóteses (H3…). Gerações do relatório = cronologia. |
| 3 | Linha do tempo situa o nascimento do casal indexado “na Itália”, mas o índice não informa locais. | Local só em nível de país, com nota; evento “hipótese plausível”. |
| 4 | Linha malformada na tabela da linha do tempo (óbito de 1738: colunas deslocadas, sem fontes). | Evento importado como “hipótese plausível” + item de revisão. |
| 5 | Distribuição moderna de sobrenomes (Cognomix) usada como evidência de origem histórica; rótulos regionais não recuperados. | H2 dividida: **H2a** (a matriz do sobrenome concentra-se no Molise: fortemente corroborada) × **H2b** (esta família veio do Molise: hipótese plausível). |
| 6 | H1 (Giovanitti → Joanitti) rotulada “fortemente corroborado” com base em ausência em repertórios + um índice inacessível. | Rebaixada para **hipótese plausível** (rótulo original preservado). |
| 7 | “Pista” sobre o artesão italiano “solucionada”, mas a pista original não foi fornecida. | H5 dividida: existência/ofício dos escultores (documentado) × identificação com a pista (hipótese plausível, não avaliável). |
| 8 | Município “San Giuliano di […]” truncado. | Lugar sem coordenadas; **não presumido**. |
| 9 | Décadas de nascimento inferidas de listas municipais (idade), não de documentos. | Precisão “década”; item de revisão. |
| 10 | Possível erro de sexo/prenome no índice (marcador feminino em nome possivelmente masculino). | Sexo “desconhecido”; variante do prenome registrada. |
| 11 | “Saverio” × “Silverio”; dois homônimos de mesmo nome e sobrenome; “Giovannitti/Giovannitto” do mesmo indivíduo. | Ligações de identidade (hipótese), registros separados; variantes no mesmo registro apenas onde o relatório afirma ser a mesma pessoa. |

## 4. Lacunas documentais que impedem fechar a árvore
1. Consulta autenticada aos perfis do FamilySearch (rótulos relacionais, fontes anexadas, colaborador).
2. Hospedaria dos Imigrantes, listas do Porto de Santos (1885–1930) e naturalizações (Arquivo Nacional): nenhuma entrada portuária localizada.
3. Certidões de inteiro teor dos cartórios de Duartina e Bauru (nascimento/casamento/óbito de 1909–1972 e das gerações seguintes).
4. Livros de *Stato Civile* (1809–1865 e seguintes) e registros paroquiais de Campobasso (Baranello, Oratino, Ripabottoni); registros de casamento c. 1897–1908 cruzando os dois sobrenomes.
5. Exame direto do documento primário de 1712 (hoje só citado) e do assento de óbito de 1738.
6. Hiato de 81 anos (1788 → 1869) entre os escultores setecentistas e o candidato a imigrante.
Cada item está em **Investigações**, ligado à hipótese que ajudaria a confirmar, com instituição indicada.

## 5. Decisões de privacidade
Pessoas vivas/possivelmente vivas só aparecem na administração; matrícula funcional, CNPJ e teor de processos judiciais/administrativos não foram importados (só a existência da citação); os dados reais não são versionados no repositório público.
