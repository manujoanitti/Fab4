-- Joanitti Atlas — esquema inicial (SQLite, compatível em espírito com PostgreSQL: sem recursos exclusivos do SQLite
-- além de CHECK/JSON-em-TEXT; datas parciais em TEXT ISO).
-- Convenções:
--   * ids são TEXT estáveis (slug/uuid) → facilitam importação idempotente e migração futura.
--   * datas genealógicas = (date_from, date_to, precision, text): intervalos, aproximações e "sem data".
--   * status de verificação (5 estados) é editável; `reported_status` guarda a classificação do relatório de origem.
--   * nada é apagado de forma irreversível: entidades usam `archived_at`; toda mudança vai para `change_log`.

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE nucleus (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'documental' CHECK (kind IN ('documental','geografico','historico','paralelo')),
  description TEXT,
  color TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE place (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES place(id),
  level TEXT NOT NULL CHECK (level IN ('pais','regiao','provincia','municipio','localidade','porto')),
  name TEXT NOT NULL,                       -- nome atual
  historic_names TEXT NOT NULL DEFAULT '[]', -- JSON array de nomes históricos/variantes
  lat REAL, lon REAL,
  coord_precision TEXT NOT NULL DEFAULT 'desconhecida' CHECK (coord_precision IN ('exata','municipio','regiao','aproximada','desconhecida')),
  coord_verified INTEGER NOT NULL DEFAULT 0,
  coord_note TEXT,
  description TEXT,
  notes TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX place_parent ON place(parent_id);

CREATE TABLE person (
  id TEXT PRIMARY KEY,
  preferred_name TEXT NOT NULL,
  given_names TEXT,
  surname TEXT,
  sex TEXT NOT NULL DEFAULT 'desconhecido' CHECK (sex IN ('M','F','desconhecido')),
  living_status TEXT NOT NULL DEFAULT 'desconhecido'
    CHECK (living_status IN ('vivo','possivelmente_vivo','falecido','presumido_falecido','desconhecido')),
  birth_from TEXT, birth_to TEXT, birth_precision TEXT NOT NULL DEFAULT 'desconhecida', birth_text TEXT, birth_place_id TEXT REFERENCES place(id),
  death_from TEXT, death_to TEXT, death_precision TEXT NOT NULL DEFAULT 'desconhecida', death_text TEXT, death_place_id TEXT REFERENCES place(id),
  biography TEXT,
  verification_status TEXT NOT NULL DEFAULT 'nao_confirmado'
    CHECK (verification_status IN ('documentado','fortemente_corroborado','hipotese_plausivel','nao_confirmado','descartado')),
  reported_status TEXT,
  status_rationale TEXT,
  identity_note TEXT,                       -- cuidado com homônimos / identidade
  notes TEXT,                               -- anotações do pesquisador
  external_ids TEXT NOT NULL DEFAULT '{}',  -- JSON: {"familysearch":"GWQ9-XJG", ...}
  avatar_url TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX person_surname ON person(surname);

CREATE TABLE person_name (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'variante' CHECK (kind IN ('preferido','variante','grafia_indexada','apelido','nome_de_registro')),
  historic_surname TEXT,
  note TEXT,
  UNIQUE (person_id, name, kind)
);
CREATE INDEX person_name_person ON person_name(person_id);

CREATE TABLE person_occupation (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES person(id),
  title TEXT NOT NULL,
  period_text TEXT,
  place_id TEXT REFERENCES place(id),
  status TEXT NOT NULL DEFAULT 'nao_confirmado'
    CHECK (status IN ('documentado','fortemente_corroborado','hipotese_plausivel','nao_confirmado','descartado')),
  note TEXT,
  import_key TEXT UNIQUE
);

CREATE TABLE person_nucleus (
  person_id TEXT NOT NULL REFERENCES person(id),
  nucleus_id TEXT NOT NULL REFERENCES nucleus(id),
  note TEXT,
  PRIMARY KEY (person_id, nucleus_id)
);

-- Agrupamento investigativo: pessoas do mesmo núcleo documental SEM relação especificada.
CREATE TABLE research_group (
  id TEXT PRIMARY KEY,
  nucleus_id TEXT REFERENCES nucleus(id),
  name TEXT NOT NULL,
  description TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE research_group_member (
  group_id TEXT NOT NULL REFERENCES research_group(id),
  person_id TEXT NOT NULL REFERENCES person(id),
  note TEXT,
  PRIMARY KEY (group_id, person_id)
);

-- Hipótese de identidade entre dois registros (homônimos / variantes): nunca funde automaticamente.
CREATE TABLE identity_link (
  id TEXT PRIMARY KEY,
  person_a TEXT NOT NULL REFERENCES person(id),
  person_b TEXT NOT NULL REFERENCES person(id),
  status TEXT NOT NULL DEFAULT 'nao_confirmado'
    CHECK (status IN ('documentado','fortemente_corroborado','hipotese_plausivel','nao_confirmado','descartado')),
  note TEXT,
  import_key TEXT UNIQUE,
  CHECK (person_a <> person_b)
);

CREATE TABLE relationship (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('filiacao','casamento','uniao','parentesco_inferido','desconhecida')),
  subtype TEXT CHECK (subtype IS NULL OR subtype IN ('biologica','adotiva','indeterminada')),
  -- filiacao: person_a = genitor(a), person_b = filho(a). Demais: simétricas.
  person_a TEXT NOT NULL REFERENCES person(id),
  person_b TEXT NOT NULL REFERENCES person(id),
  status TEXT NOT NULL DEFAULT 'nao_confirmado'
    CHECK (status IN ('documentado','fortemente_corroborado','hipotese_plausivel','nao_confirmado','descartado')),
  reported_status TEXT,
  status_rationale TEXT,
  confidence INTEGER CHECK (confidence IS NULL OR (confidence BETWEEN 0 AND 100)),
  date_from TEXT, date_to TEXT, date_precision TEXT NOT NULL DEFAULT 'desconhecida', date_text TEXT,
  place_id TEXT REFERENCES place(id),
  notes TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (person_a <> person_b)
);
CREATE INDEX rel_a ON relationship(person_a);
CREATE INDEX rel_b ON relationship(person_b);

CREATE TABLE source (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('primaria','secundaria','colaborativa','nao_verificada','oficial')),
  doc_type TEXT NOT NULL DEFAULT 'outro',   -- certidao_nascimento, batismo, casamento, obito, lista_passageiros, imigracao,
                                            -- fotografia, publicacao, pesquisa, perfil_arvore, registro_administrativo,
                                            -- ficha_patrimonial, diretorio, acervo, outro
  title TEXT NOT NULL,
  institution TEXT,
  url TEXT,
  extra_urls TEXT NOT NULL DEFAULT '[]',
  archival_ref TEXT,                        -- referência arquivística / livro / registro
  page_ref TEXT,
  produced_date TEXT,
  consulted_date TEXT,
  excerpt TEXT,
  transcription TEXT,
  local_file TEXT,
  access_status TEXT NOT NULL DEFAULT 'citada_nao_examinada'
    CHECK (access_status IN ('examinada_integral','examinada_extrato','apenas_indexada','citada_nao_examinada','para_consulta_futura')),
  reliability INTEGER NOT NULL DEFAULT 2 CHECK (reliability BETWEEN 1 AND 5),
  reliability_note TEXT,
  notes TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE source_person (
  source_id TEXT NOT NULL REFERENCES source(id),
  person_id TEXT NOT NULL REFERENCES person(id),
  note TEXT,
  PRIMARY KEY (source_id, person_id)
);
CREATE TABLE source_place (
  source_id TEXT NOT NULL REFERENCES source(id),
  place_id TEXT NOT NULL REFERENCES place(id),
  PRIMARY KEY (source_id, place_id)
);

CREATE TABLE event (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('nascimento','batismo','casamento','falecimento','imigracao','emigracao','naturalizacao',
     'residencia','profissao_cargo','participacao_historica','registro_documental','obra','toponimia','outro')),
  title TEXT NOT NULL,
  description TEXT,
  date_from TEXT, date_to TEXT, date_precision TEXT NOT NULL DEFAULT 'desconhecida', date_text TEXT,
  place_id TEXT REFERENCES place(id),
  place_note TEXT,
  status TEXT NOT NULL DEFAULT 'nao_confirmado'
    CHECK (status IN ('documentado','fortemente_corroborado','hipotese_plausivel','nao_confirmado','descartado')),
  reported_status TEXT,
  status_rationale TEXT,
  is_route_speculative INTEGER NOT NULL DEFAULT 0,
  route_to_place_id TEXT REFERENCES place(id),   -- p/ migrações: origem = place_id, destino = route_to_place_id
  notes TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE event_person (
  event_id TEXT NOT NULL REFERENCES event(id),
  person_id TEXT NOT NULL REFERENCES person(id),
  role TEXT NOT NULL DEFAULT 'participante',
  PRIMARY KEY (event_id, person_id)
);

CREATE TABLE historical_context (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  year_from INTEGER NOT NULL, year_to INTEGER,
  country TEXT,
  origin TEXT NOT NULL DEFAULT 'relatorio' CHECK (origin IN ('relatorio','contexto_geral')),
  import_key TEXT UNIQUE
);

-- Camada de afirmações verificáveis
CREATE TABLE claim (
  id TEXT PRIMARY KEY,
  code TEXT,                                -- ex.: H1…H8, IT-A
  kind TEXT NOT NULL DEFAULT 'hipotese' CHECK (kind IN ('fato','hipotese','interpretacao')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nao_confirmado'
    CHECK (status IN ('documentado','fortemente_corroborado','hipotese_plausivel','nao_confirmado','descartado')),
  reported_status TEXT,
  confidence INTEGER CHECK (confidence IS NULL OR (confidence BETWEEN 0 AND 100)),
  justification TEXT,
  contradictions TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE claim_entity (
  claim_id TEXT NOT NULL REFERENCES claim(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person','place','event','relationship','nucleus','source')),
  entity_id TEXT NOT NULL,
  role TEXT,
  PRIMARY KEY (claim_id, entity_type, entity_id)
);
CREATE TABLE claim_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id TEXT NOT NULL REFERENCES claim(id),
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  from_status TEXT, to_status TEXT,
  note TEXT
);

-- Evidência polimórfica: liga qualquer afirmação (pessoa, relação, evento, lugar, claim, sobrenome) a fontes.
CREATE TABLE evidence (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('person','relationship','event','place','claim','surname','occupation','identity_link')),
  subject_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES source(id),
  stance TEXT NOT NULL DEFAULT 'favoravel' CHECK (stance IN ('favoravel','contraria','contexto')),
  excerpt TEXT,
  note TEXT,
  import_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX evidence_subject ON evidence(subject_type, subject_id);
CREATE INDEX evidence_source ON evidence(source_id);

CREATE TABLE surname_variant (
  id TEXT PRIMARY KEY,
  form TEXT NOT NULL,
  family_group TEXT NOT NULL DEFAULT 'giovannitti',
  status TEXT NOT NULL DEFAULT 'nao_confirmado'
    CHECK (status IN ('documentado','fortemente_corroborado','hipotese_plausivel','nao_confirmado','descartado')),
  attested_places TEXT, period_text TEXT, linguistic_note TEXT,
  import_key TEXT UNIQUE
);

-- Investigações
CREATE TABLE investigation (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_andamento','concluida','arquivada')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  conclusion TEXT,
  import_key TEXT UNIQUE,
  archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE investigation_hypothesis (
  investigation_id TEXT NOT NULL REFERENCES investigation(id),
  claim_id TEXT NOT NULL REFERENCES claim(id),
  label TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (investigation_id, claim_id)
);
CREATE TABLE investigation_entity (
  investigation_id TEXT NOT NULL REFERENCES investigation(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person','place','nucleus','source','event')),
  entity_id TEXT NOT NULL,
  PRIMARY KEY (investigation_id, entity_type, entity_id)
);
CREATE TABLE investigation_task (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL REFERENCES investigation(id),
  claim_id TEXT REFERENCES claim(id),       -- documento necessário p/ confirmar uma hipótese específica
  kind TEXT NOT NULL CHECK (kind IN ('documento_pendente','proximo_passo')),
  text TEXT NOT NULL,
  institution TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','feito','impossivel')),
  sort INTEGER NOT NULL DEFAULT 0,
  import_key TEXT UNIQUE
);
CREATE TABLE investigation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investigation_id TEXT NOT NULL REFERENCES investigation(id),
  at TEXT NOT NULL, actor TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'nota' CHECK (kind IN ('nota','decisao','status','evidencia')),
  text TEXT NOT NULL
);

-- Proveniência e importação
CREATE TABLE report (
  id TEXT PRIMARY KEY,                      -- hash do conteúdo (sha256 hex)
  title TEXT NOT NULL,
  origin TEXT NOT NULL,                     -- ex.: "Gemini Deep Research"
  imported_at TEXT NOT NULL,
  content TEXT NOT NULL                     -- TEXTO ORIGINAL preservado integralmente
);
CREATE TABLE import_run (
  id TEXT PRIMARY KEY,
  report_id TEXT REFERENCES report(id),
  package_id TEXT NOT NULL,
  package_version TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('dry_run','apply')),
  at TEXT NOT NULL, actor TEXT NOT NULL,
  summary TEXT NOT NULL,                    -- JSON: contagens create/update/unchanged por entidade
  audit TEXT NOT NULL                       -- JSON: relatório completo de auditoria
);
CREATE TABLE provenance (
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  report_id TEXT NOT NULL REFERENCES report(id),
  section TEXT, quote TEXT,
  PRIMARY KEY (entity_type, entity_id, report_id)
);
CREATE TABLE review_item (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ambiguidade','contradicao','lacuna','identidade','proposta_relacao','privacidade','nao_importado','conflito_importacao')),
  title TEXT NOT NULL,
  detail TEXT,
  entity_type TEXT, entity_id TEXT,
  report_id TEXT REFERENCES report(id),
  section TEXT, quote TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','resolvido','recusado')),
  resolution TEXT,
  import_key TEXT UNIQUE,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','archive','restore','status','import')),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  before TEXT, after TEXT, note TEXT
);
CREATE INDEX change_log_entity ON change_log(entity_type, entity_id);

-- Estado da última importação por registro: permite fusão em 3 vias (não sobrescreve edições do pesquisador).
CREATE TABLE import_state (
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  report_id TEXT, hash TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

-- Mapeamentos manuais "registro do pacote → registro já existente" (resolução de duplicatas), persistentes.
CREATE TABLE import_alias (
  import_key TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  PRIMARY KEY (import_key, entity_type)
);
