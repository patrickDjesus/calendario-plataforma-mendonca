import { ReviewItem } from '../types';

export type ReviewGrade = 1 | 3 | 4 | 5; // 1 = De novo, 3 = Difícil, 4 = Bom, 5 = Fácil

export interface SM2Result {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueDate: string; // YYYY-MM-DD
}

/**
 * Calcula a próxima repetição segundo o algoritmo SuperMemo SM-2 autêntico
 * @param item Item atual ou parâmetros iniciais
 * @param grade Nota dada (1: De novo, 3: Difícil, 4: Bom, 5: Fácil)
 * @param todayISO Data base de referência (YYYY-MM-DD)
 */
export function calculateNextReview(
  item: Pick<ReviewItem, 'easeFactor' | 'intervalDays' | 'repetitions' | 'lapses'>,
  grade: ReviewGrade,
  todayISO: string
): SM2Result {
  const currentEase = item.easeFactor || 2.5;
  let repetitions = item.repetitions || 0;
  let lapses = item.lapses || 0;
  let intervalDays = 1;

  if (grade < 3) {
    // Falha: reseta repetições e volta para 1 dia
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
  } else {
    // Sucesso
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = grade === 3 ? 3 : 6;
    } else {
      const prevInterval = item.intervalDays || 1;
      const multiplier = grade === 3 ? 1.2 : currentEase;
      intervalDays = Math.max(1, Math.round(prevInterval * multiplier));
    }
    repetitions += 1;
  }

  // Atualização do fator de facilidade (Ease Factor)
  // Fórmula clássica: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02);
  const newEase = Math.max(1.3, Number((currentEase + delta).toFixed(3)));

  // Calcula nova data de vencimento
  const [year, month, day] = todayISO.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day + intervalDays);
  const nextYear = targetDate.getFullYear();
  const nextMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const nextDay = String(targetDate.getDate()).padStart(2, '0');
  const nextDueDate = `${nextYear}-${nextMonth}-${nextDay}`;

  return {
    easeFactor: newEase,
    intervalDays,
    repetitions,
    lapses,
    dueDate: nextDueDate,
  };
}

/**
 * Retorna os rótulos de próximo intervalo para exibição visual nos 4 botões
 */
export function getGradeIntervalLabels(
  item: Pick<ReviewItem, 'easeFactor' | 'intervalDays' | 'repetitions' | 'lapses'>,
  todayISO: string
): Record<ReviewGrade, string> {
  const r1 = calculateNextReview(item, 1, todayISO);
  const r3 = calculateNextReview(item, 3, todayISO);
  const r4 = calculateNextReview(item, 4, todayISO);
  const r5 = calculateNextReview(item, 5, todayISO);

  return {
    1: `< 1d`,
    3: `${r3.intervalDays}d`,
    4: `${r4.intervalDays}d`,
    5: `${r5.intervalDays}d`,
  };
}
