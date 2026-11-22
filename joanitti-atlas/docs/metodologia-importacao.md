# Importação de relatórios — metodologia

## O que o importador faz (e o que não faz)
O importador **não interpreta texto livre**. A extração (nomes, variantes, datas, lugares, relações explícitas, hipóteses, fontes, dúvidas) é feita por uma pessoa ou por um assistente que lê o relatório e produz um **pacote de extração** (JSON, formato em `server/import/package.ts`, exemplo em `data/fixtures/`). O importador então:
1. valida o pacote (Zod) e **guarda o texto original** do relatório (hash SHA-256) — o texto nunca é resumido nem substituído;
2. **confere cada citação** (`prov.quote`) contra o texto original (ignorando caixa, acentos e pontuação); citações inexistentes **bloqueiam a consolidação** (proteção contra extrações inventadas) — no relatório real foram conferidas 179, 0 falhas;
3. reconcilia com o banco por chaves estáveis (`<id-do-pacote>/<prefixo>:<chave>`): reimportar **não duplica** nada;
4. gera o plano (`dry_run`: o mesmo fluxo dentro de um SAVEPOINT revertido) com criar/atualizar/inalterado/conflito por entidade, possíveis duplicatas, órfãos e avisos;
5. consolida em uma transação e registra auditoria (`import_run`) e proveniência (seção + citação por registro);
6. gera **itens de revisão** para tudo que não decidiu sozinho: ambiguidades, contradições, lacunas, propostas de relação **não aplicadas**, decisões de privacidade, menções não convertidas em registros.

## Fusão em 3 vias (não sobrescreve o pesquisador)
`import_state` guarda o hash da última importação de cada registro. Se o pacote mudou **e** o registro foi editado depois, nada é sobrescrito: vira item “conflito de importação”. Se só o pacote mudou, atualiza. Se o pacote não mudou, não toca (mesmo que você tenha editado). Registros que sumiram de uma nova versão do pacote são **preservados** e listados como órfãos.

## Novos relatórios e duplicatas
Pacotes com `id` diferente não colidem por chave; pessoas novas são comparadas (busca fonética + ano de nascimento ±3) com as existentes e listadas como **possíveis duplicatas**, sem fusão automática. Na tela Importar, escolha “criar nova” ou “mesclar com X”: a mesclagem **só preenche campos vazios**, nunca sobrescreve, e fica gravada (`import_alias`) para reimportações.

## Critérios de classificação usados na importação real (decisão do operador, editável)
O relatório classifica seus achados; o app **não adota o rótulo automaticamente** (`reported_status` guarda o original).
* **Documentado**: registro oficial/institucional examinado (ainda que em extrato) afirma o fato diretamente.
* **Fortemente corroborado**: duas ou mais fontes independentes, nenhuma primária examinada.
* **Hipótese plausível**: compatível com os indícios; fonte única secundária ou índice inacessível.
* **Não confirmado**: sem evidência suficiente / só condicional.
* **Descartado**: refutado.
* Documentos primários apenas **citados** (ex.: livro de 1712 do arquivo diocesano) entram como fonte `citada_nao_examinada` — nunca como verificados.
* Coocorrência em índice → agrupamento investigativo; **nenhuma filiação/casamento** foi criada a partir de índice.
* Dados sensíveis desnecessários (matrícula funcional, CNPJ, teor de processos) **não foram importados**.

## Como importar um novo relatório
1. Salve o texto original (`.md`/`.txt`). 2. Gere o pacote (ex.: peça a um assistente que preencha o formato, citando trechos literais, *sem* inferir parentescos). 3. Administração → Importar relatório → carregue os dois arquivos → **Pré-visualizar** → resolva duplicatas → **Consolidar**. 4. Revise os itens pendentes em Administração → Revisão.
