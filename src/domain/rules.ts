import type { RuleSet, Settings } from './types';

/**
 * REGRAS ORIGINAIS DO TABULEIRO ("Regras do Reino da Bianca" e "A Trilha encantada da Bianca").
 * Redação preservada conforme as fotografias. Ver docs/regras-originais.md.
 * Qualquer alteração aqui exige migração equivalente em supabase/migrations (tabelas rule_*),
 * verificada por tests/unit/rules.test.ts.
 */
export const RULES: RuleSet = {
  phasesPerStage: 5,
  howItWorks: [
    'A cada fase concluída, Bianca ganha 1 selo pequeno.',
    'Ao completar 5 fases e finalizar uma etapa, ela recebe a recompensa da etapa.',
  ],
  dailyStampRules: [
    'Se não cumprir a meta do dia, não ganha o selo.',
    'Se brigar com o colega, apenas não ganha o selo do dia.',
  ],
  goals: [
    { id: 'g1', text: 'Não bater em ninguém e, se o colega provocar, falar com a professora.' },
    { id: 'g2', text: 'Fazer todas as tarefas de casa.' },
    { id: 'g3', text: 'Arrumar a cama pela manhã.' },
    { id: 'g4', text: 'Escovar os dentes em todas as refeições.' },
    { id: 'g5', text: 'Não gritar quando ficar chateada.' },
    { id: 'g6', text: 'Se ficar muito nervosa, respirar fundo 15 vezes e contar bem devagar até 30.' },
    { id: 'g7', text: 'Não enrolar para tomar banho quando a mamãe pedir.' },
    { id: 'g8', text: 'Ler com a mamãe ou o papai uma história antes de dormir.' },
  ],
  specialGoals: [
    {
      id: 's1',
      text: 'Pintar algum desenho junto com a mamãe.',
      weekdays: [2, 3],
      weekdaysLabel: 'terça ou quarta',
    },
    {
      id: 's2',
      text: 'Escolher 1 história lida durante a semana e desenhar a parte de que mais gostou.',
      weekdays: [5, 6],
      weekdaysLabel: 'sexta ou sábado',
    },
  ],
  stages: [
    {
      stage: 1,
      name: 'Floresta dos Sonhos',
      coins: 1,
      bigStamps: 1,
      rewardSize: 'small',
      rewardOptions: [
        'dormir 1 hora mais tarde',
        'assistir mais 1 desenho',
        'ganhar 1 item de papelaria',
        'ganhar 1 lanche fora de casa',
      ],
      sourceText: 'Etapa 1: 1 moeda, 1 selo grande e 1 recompensa pequena.',
    },
    {
      stage: 2,
      name: 'Castelo das Fadas',
      coins: 2,
      bigStamps: 1,
      rewardSize: 'small',
      rewardOptions: ['dormir 1 hora mais tarde', 'assistir mais 1 desenho', 'ganhar 1 item de papelaria'],
      sourceText: 'Etapa 2: 2 moedas, 1 selo grande e 1 recompensa pequena.',
    },
    {
      stage: 3,
      name: 'Lago Cristalino',
      coins: 3,
      bigStamps: 2,
      rewardSize: 'medium',
      rewardOptions: [
        'fazer uma noite do pijama com 2 amiguinhas',
        'ganhar um lanche fora de casa',
        'ganhar 1 bolsinha ou 1 óculos novo',
      ],
      sourceText: 'Etapa 3: 3 moedas, 2 selos grandes e 1 recompensa média.',
    },
    {
      stage: 4,
      name: 'Montanhas da Coragem',
      coins: 4,
      bigStamps: 2,
      rewardSize: 'medium',
      rewardOptions: [
        'fazer uma noite do pijama com 2 amiguinhas',
        'ganhar um lanche fora de casa',
        'ganhar 1 bolsinha ou 1 óculos novo',
      ],
      sourceText: 'Etapa 4: 4 moedas, 2 selos grandes e 1 recompensa média.',
    },
    {
      stage: 5,
      name: 'Jardim da Magia',
      coins: 5,
      bigStamps: 3,
      rewardSize: 'large',
      rewardOptions: ['um brinquedo novo', 'uma ida ao cinema com 1 amiga', '1 dia no clube ou parque'],
      sourceText: 'Etapa 5: 5 moedas, 3 selos grandes e 1 recompensa grande.',
    },
  ],
  finalBonus: {
    coinsRequired: 15,
    bigStampsRequired: 9,
    bigStamps: 1,
    rewardOptions: ['outro passeio', 'brinquedo'],
    sourceText:
      'Se juntar todas as 15 moedas e os 9 selos grandes, ganha mais 1 selo grande e pode trocar por outra recompensa grande (outro passeio ou brinquedo).',
  },
};

/** Padrões operacionais (NÃO originais). */
export const DEFAULT_SETTINGS: Settings = {
  medalMinGoals: 8,
  medalIncludesSpecial: false,
  medalsPerPhaseHint: null,
};

export const TOTAL_PHASES = RULES.stages.length * RULES.phasesPerStage;
export const phaseLabel = (phase: number) =>
  `${Math.ceil(phase / RULES.phasesPerStage)}.${((phase - 1) % RULES.phasesPerStage) + 1}`;
export const stageOfPhase = (phase: number) => Math.ceil(phase / RULES.phasesPerStage);

/** Jogos: desbloqueio é regra DIGITAL adicional (não original do tabuleiro). */
export const GAMES: { id: 'stars' | 'crystals' | 'garden'; name: string; unlockStage: number | null; icon: string }[] = [
  { id: 'stars', name: 'Caça às Estrelas', unlockStage: null, icon: '⭐' },
  { id: 'crystals', name: 'Memória dos Cristais', unlockStage: 2, icon: '💎' },
  { id: 'garden', name: 'Jardim Encantado', unlockStage: 4, icon: '🌷' },
];
