// Formato do "pacote de extração": saída estruturada da leitura de um relatório (feita por pessoa ou por assistente).
// O importador NÃO interpreta texto livre: ele valida, reconcilia e consolida o pacote — e confere que cada
// citação (`prov.quote`) realmente existe no texto original do relatório. Ver docs/metodologia.md.
import { z } from 'zod';
import { STATUSES, REL_TYPES, EVENT_TYPES, SOURCE_KINDS, LIVING } from '../../shared/types';
import { DATE_PRECISIONS } from '../../shared/dates';

const St = z.enum(STATUSES);
const Key = z.string().min(1).regex(/^[a-z0-9_]+$/, 'chave: a-z, 0-9 e _');
export const Prov = z.object({ sec: z.string().optional(), quote: z.string().optional() }).optional();
const D = z.object({
  from: z.string().nullish(), to: z.string().nullish(), precision: z.enum(DATE_PRECISIONS).default('desconhecida'), text: z.string().nullish(),
});

const place = z.object({ key: Key, parent: Key.optional(), level: z.enum(['pais', 'regiao', 'provincia', 'municipio', 'localidade', 'porto']), name: z.string(),
  historic: z.array(z.string()).optional(), lat: z.number().optional(), lon: z.number().optional(),
  precision: z.enum(['exata', 'municipio', 'regiao', 'aproximada', 'desconhecida']).optional(), verified: z.boolean().optional(), coordNote: z.string().optional(),
  description: z.string().optional(), notes: z.string().optional(), prov: Prov });
const nucleus = z.object({ key: Key, name: z.string(), kind: z.enum(['documental', 'geografico', 'historico', 'paralelo']), description: z.string().optional(), color: z.string().optional(), sort: z.number().optional(), prov: Prov });
const person = z.object({
  key: Key, name: z.string(), given: z.string().optional(), surname: z.string().optional(), sex: z.enum(['M', 'F', 'desconhecido']).optional(),
  living: z.enum(LIVING), birth: D.optional(), death: D.optional(), birthPlace: Key.optional(), deathPlace: Key.optional(),
  status: St, reportedStatus: z.string().optional(), rationale: z.string().optional(), identityNote: z.string().optional(), notes: z.string().optional(),
  externalIds: z.record(z.string(), z.string()).optional(), bio: z.string().optional(),
  names: z.array(z.object({ name: z.string(), kind: z.enum(['preferido', 'variante', 'grafia_indexada', 'apelido', 'nome_de_registro']).optional(), historicSurname: z.string().optional(), note: z.string().optional() })).optional(),
  occupations: z.array(z.object({ key: Key, title: z.string(), period: z.string().optional(), place: Key.optional(), status: St.optional(), note: z.string().optional() })).optional(),
  nuclei: z.array(Key).optional(), prov: Prov,
});
const group = z.object({ key: Key, nucleus: Key.optional(), name: z.string(), description: z.string().optional(), members: z.array(Key), prov: Prov });
const rel = z.object({ key: Key, type: z.enum(REL_TYPES), subtype: z.enum(['biologica', 'adotiva', 'indeterminada']).optional(), a: Key, b: Key, status: St,
  reportedStatus: z.string().optional(), rationale: z.string().optional(), confidence: z.number().min(0).max(100).optional(), date: D.optional(), place: Key.optional(), notes: z.string().optional(), prov: Prov });
const identity = z.object({ key: Key, a: Key, b: Key, status: St, note: z.string().optional(), prov: Prov });
const event = z.object({ key: Key, type: z.enum(EVENT_TYPES), title: z.string(), description: z.string().optional(), date: D, place: Key.optional(), placeNote: z.string().optional(),
  status: St, reportedStatus: z.string().optional(), rationale: z.string().optional(), speculative: z.boolean().optional(), routeTo: Key.optional(),
  persons: z.array(z.object({ person: Key, role: z.string().optional() })).optional(), notes: z.string().optional(), prov: Prov });
const source = z.object({ key: Key, kind: z.enum(SOURCE_KINDS), docType: z.string(), title: z.string(), institution: z.string().optional(), url: z.string().optional(), extraUrls: z.array(z.string()).optional(),
  archivalRef: z.string().optional(), pageRef: z.string().optional(), produced: z.string().optional(), consulted: z.string().optional(), excerpt: z.string().optional(),
  access: z.enum(['examinada_integral', 'examinada_extrato', 'apenas_indexada', 'citada_nao_examinada', 'para_consulta_futura']), reliability: z.number().int().min(1).max(5),
  reliabilityNote: z.string().optional(), notes: z.string().optional(), persons: z.array(Key).optional(), places: z.array(Key).optional(), prov: Prov });
const SUBJ = /^(person|relationship|event|place|claim|surname|occupation|identity_link):[a-z0-9_]+$/;
const evidence = z.object({ key: Key, subject: z.string().regex(SUBJ), source: Key, stance: z.enum(['favoravel', 'contraria', 'contexto']).optional(), excerpt: z.string().optional(), note: z.string().optional(), prov: Prov });
const claim = z.object({ key: Key, code: z.string().optional(), kind: z.enum(['fato', 'hipotese', 'interpretacao']), content: z.string(), status: St, reportedStatus: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(), justification: z.string().optional(), contradictions: z.string().optional(),
  entities: z.array(z.object({ type: z.enum(['person', 'place', 'event', 'relationship', 'nucleus', 'source']), key: Key, role: z.string().optional() })).optional(), prov: Prov });
const investigation = z.object({ key: Key, title: z.string(), question: z.string(), description: z.string().optional(), status: z.enum(['aberta', 'em_andamento', 'concluida', 'arquivada']), priority: z.number().int().min(1).max(5),
  conclusion: z.string().optional(), hypotheses: z.array(z.object({ claim: Key, label: z.string().optional() })).optional(),
  entities: z.array(z.object({ type: z.enum(['person', 'place', 'nucleus', 'source', 'event']), key: Key })).optional(),
  tasks: z.array(z.object({ key: Key, kind: z.enum(['documento_pendente', 'proximo_passo']), text: z.string(), institution: z.string().optional(), claim: Key.optional(), status: z.enum(['pendente', 'em_andamento', 'feito', 'impossivel']).optional() })).optional(), prov: Prov });
const surname = z.object({ key: Key, form: z.string(), group: z.string().optional(), status: St, places: z.string().optional(), period: z.string().optional(), note: z.string().optional(), prov: Prov });
const context = z.object({ key: Key, title: z.string(), description: z.string().optional(), from: z.number().int(), to: z.number().int().optional(), country: z.string().optional(), origin: z.enum(['relatorio', 'contexto_geral']) });
const review = z.object({ key: Key, kind: z.enum(['ambiguidade', 'contradicao', 'lacuna', 'identidade', 'proposta_relacao', 'privacidade', 'nao_importado']), title: z.string(), detail: z.string().optional(), entity: z.string().regex(SUBJ).optional(), prov: Prov });

export const PackageSchema = z.object({
  format: z.literal('joanitti-atlas-extraction'),
  version: z.number().int(),
  id: z.string().min(3),
  report: z.object({ title: z.string(), origin: z.string() }),
  nuclei: z.array(nucleus).default([]), places: z.array(place).default([]), persons: z.array(person).default([]), groups: z.array(group).default([]),
  relationships: z.array(rel).default([]), identityLinks: z.array(identity).default([]), events: z.array(event).default([]), sources: z.array(source).default([]),
  evidence: z.array(evidence).default([]), claims: z.array(claim).default([]), investigations: z.array(investigation).default([]), surnames: z.array(surname).default([]),
  contexts: z.array(context).default([]), reviewItems: z.array(review).default([]),
});
export type ExtractionPackage = z.input<typeof PackageSchema>;
export type ParsedPackage = z.output<typeof PackageSchema>;
export type PkgDate = z.infer<typeof D>;
