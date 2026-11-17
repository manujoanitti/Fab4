import type { CreditKind, GoalStatus, RewardSize } from '../domain/types';

export const STATUS_META: Record<GoalStatus, { label: string; icon: string }> = {
  pending: { label: 'Pendente', icon: '⏳' },
  done: { label: 'Cumprida', icon: '✅' },
  not_done: { label: 'Não cumprida', icon: '❌' },
  not_evaluated: { label: 'Não avaliada', icon: '➖' },
};
export const CREDIT_KIND: Record<CreditKind, string> = {
  earn_medal: 'Selo do dia confirmado',
  spend_session: 'Sessão de minigame',
  adjust: 'Ajuste do responsável',
};
export const SIZE_LABEL: Record<RewardSize | 'final', string> = { small: 'pequena', medium: 'média', large: 'grande', final: 'grande (bônus final)' };
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const weekdayName = (date: string) => WD[new Date(date + 'T00:00:00Z').getUTCDay()];
export const fmtDate = (date: string) => `${weekdayName(date)}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
