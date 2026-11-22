# Modelo de dados

Esquema completo em `server/db/migrations/0001_init.sql`. Ids são `TEXT` estáveis; nada é apagado (`archived_at`), toda mudança vai para `change_log` (antes/depois, autor, nota).

## Estados de verificação (5) — editáveis e independentes
`documentado` · `fortemente_corroborado` · `hipotese_plausivel` · `nao_confirmado` · `descartado`.
Existem em pessoa (`verification_status`), relação, evento, afirmação, ocupação e ligação de identidade. O estado **não é calculado** pela quantidade de fontes; `reported_status` guarda a classificação do relatório de origem e `status_rationale` o porquê da diferença. A auditoria avisa quando um estado ≥ “fortemente corroborado” não tem evidência favorável, ou “documentado” sem nenhuma fonte examinada.
Na árvore: contínua = documentado/fortemente corroborado · tracejada = hipótese plausível · pontilhada = não confirmado · descartado não é desenhado. Ícones SVG (círculo cheio/meio/quarto/vazio/riscado) e texto acompanham a cor.

## Entidades
| Tabela | Papel |
|---|---|
| `person` (+ `person_name`, `person_occupation`, `person_nucleus`) | Nome preferencial, variantes (`variante`, `grafia_indexada`, `apelido`, `nome_de_registro`), sobrenome, sexo (**nunca presumido**), `living_status` (privacidade), nascimento/óbito com **data difusa** e lugar, biografia, `identity_note`, `external_ids` (JSON), avatar. |
| `identity_link` | Hipótese de identidade entre dois registros (homônimos, variantes). **Nunca funde.** |
| `research_group` (+ `_member`) | Agrupamento investigativo: pessoas do mesmo núcleo documental **sem** relação especificada. |
| `relationship` | `filiacao` (A = genitor/a, B = filho/a; `biologica`/`adotiva`/`indeterminada`), `casamento`, `uniao`, `parentesco_inferido`, `desconhecida`; estado e `confidence` (0–100) próprios; evidências próprias. **Irmandade é derivada** de filiações em comum (inclui meio-irmãos). |
| `event` (+ `event_person`) | 14 tipos (nascimento, batismo, casamento, óbito, imigração/emigração, naturalização, residência, cargo, participação histórica, registro documental, obra, toponímia…), várias pessoas, lugar de origem e destino (`route_to_place_id`), `is_route_speculative`. |
| `place` | Hierarquia País → Região → Província → Município → Localidade/Porto; nome atual, `historic_names`, lat/lon, `coord_precision`, `coord_verified`. |
| `source` (+ `source_person`, `source_place`) | `kind`: primária · secundária · colaborativa · não verificada · oficial contemporânea; tipo de documento; instituição, URL(s), referência arquivística, página, datas de produção/consulta, trecho, transcrição, arquivo local, `access_status` (examinada integral/extrato, apenas indexada, **citada e não examinada**, acervo para consulta futura), `reliability` 1–5 editável. |
| `evidence` | Liga **qualquer** sujeito (pessoa, relação, evento, lugar, afirmação, sobrenome, ocupação, identidade) a uma fonte: `favoravel` · `contraria` · `contexto`, com trecho. |
| `claim` (+ `claim_entity`, `claim_history`) | Afirmações verificáveis: fato / hipótese / interpretação; contradições; histórico de mudanças de estado com nota. |
| `investigation` (+ hipóteses, entidades, `investigation_task`, `investigation_log`) | Pergunta de pesquisa, prioridade, hipóteses alternativas (A/B/C…), documentos pendentes **por hipótese**, próximos passos, conclusão e histórico de decisões. |
| `nucleus` | Frentes de investigação: documental, geográfico, histórico, paralelo. |
| `surname_variant`, `historical_context` | Formas do sobrenome (com estado) e faixas de contexto (do relatório × contexto geral do operador). |
| `report`, `import_run`, `provenance`, `review_item`, `import_state`, `import_alias` | Texto original do relatório (por hash), execuções e auditoria, citação de origem de cada registro, pendências de revisão, estado para fusão em 3 vias e mapeamentos manuais. |

## Datas incertas
`(date_from, date_to, precision, text)` com `YYYY`, `YYYY-MM` ou `YYYY-MM-DD`. Precisões: exata · mês · ano · década · circa · intervalo · desconhecida. Eventos sem data aparecem numa seção própria da linha do tempo; o texto original da fonte é preservado.

## Regras de integridade (servidor, `repo.ts` + `shared/integrity.ts`)
* sem auto-relação; sem relação duplicada do mesmo tipo; **sem ciclos de filiação** (ninguém é ancestral de si mesmo); relações descartadas não contam;
* sem casamento/união entre ascendente e descendente direto;
* avisos (não bloqueiam, datas são incertas): genitor nascido depois do filho, diferença < 12 anos, genitor morto > 1 ano antes do nascimento, > 2 genitores biológicos;
* datas válidas e coerentes; pessoa com óbito não pode estar “viva”; hierarquia de lugares sem ciclos e com níveis coerentes; chaves estrangeiras verificadas;
* auditoria global (`/api/admin/integrity`): ciclos, referências a arquivados, idade improvável, status sem evidência, confiabilidade incoerente, homônimos sem hipótese de identidade, pessoas isoladas, vivos sem marcação, coordenadas não verificadas.
