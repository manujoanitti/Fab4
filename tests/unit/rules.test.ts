import { describe, expect, it } from 'vitest';
import { GAMES, RULES, TOTAL_PHASES, phaseLabel } from '../../src/domain/rules';

describe('regras originais do tabuleiro', () => {
  it('tem 5 etapas com os nomes do tabuleiro, 5 fases cada, 25 no total', () => {
    expect(RULES.stages.map((s) => s.name)).toEqual([
      'Floresta dos Sonhos', 'Castelo das Fadas', 'Lago Cristalino', 'Montanhas da Coragem', 'Jardim da Magia',
    ]);
    expect(RULES.phasesPerStage).toBe(5);
    expect(TOTAL_PHASES).toBe(25);
    expect(phaseLabel(1)).toBe('1.1');
    expect(phaseLabel(13)).toBe('3.3');
    expect(phaseLabel(25)).toBe('5.5');
  });
  it('tem oito metas diárias com a redação original', () => {
    expect(RULES.goals).toHaveLength(8);
    expect(RULES.goals[0].text).toBe('Não bater em ninguém e, se o colega provocar, falar com a professora.');
    expect(RULES.goals[5].text).toContain('respirar fundo 15 vezes e contar bem devagar até 30');
    expect(RULES.goals[7].text).toBe('Ler com a mamãe ou o papai uma história antes de dormir.');
  });
  it('tem duas metas especiais (terça/quarta e sexta/sábado)', () => {
    expect(RULES.specialGoals.map((g) => g.weekdays)).toEqual([[2, 3], [5, 6]]);
  });
  it('moedas e selos grandes por etapa seguem o tabuleiro (1,2,3,4,5 moedas; 1,1,2,2,3 selos)', () => {
    expect(RULES.stages.map((s) => s.coins)).toEqual([1, 2, 3, 4, 5]);
    expect(RULES.stages.map((s) => s.bigStamps)).toEqual([1, 1, 2, 2, 3]);
    expect(RULES.stages.map((s) => s.rewardSize)).toEqual(['small', 'small', 'medium', 'medium', 'large']);
  });
  it('totais batem com o bônus final: 15 moedas e 9 selos grandes', () => {
    expect(RULES.stages.reduce((a, s) => a + s.coins, 0)).toBe(RULES.finalBonus.coinsRequired);
    expect(RULES.stages.reduce((a, s) => a + s.bigStamps, 0)).toBe(RULES.finalBonus.bigStampsRequired);
    expect(RULES.finalBonus.bigStamps).toBe(1);
  });
  it('opções de recompensa transcritas', () => {
    expect(RULES.stages[0].rewardOptions).toHaveLength(4);
    expect(RULES.stages[1].rewardOptions).toHaveLength(3); // etapa 2 não lista lanche no tabuleiro
    expect(RULES.stages[4].rewardOptions).toContain('1 dia no clube ou parque');
  });
  it('desbloqueio de jogos (regra digital adicional)', () => {
    expect(GAMES.map((g) => g.unlockStage)).toEqual([null, 2, 4]);
  });
});
