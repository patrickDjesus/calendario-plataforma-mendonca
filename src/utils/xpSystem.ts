import { Task, StudyMode, UserProfile, Achievement, DailyMission, Flashcard, Priority } from '../types';
import { tasksForDate } from '../services/recurrence';

export interface StudyModeConfig {
  name: string;
  dailyXpGoal: number;
  maxDailyHours: number;
  description: string;
  badge: string;
}

export const STUDY_MODES: Record<StudyMode, StudyModeConfig> = {
  leve: {
    name: 'Leve',
    dailyXpGoal: 200,
    maxDailyHours: 2.5,
    description: 'Ritmo suave para manter a constância diária sem sobrecarga.',
    badge: '🌱',
  },
  regular: {
    name: 'Regular',
    dailyXpGoal: 400,
    maxDailyHours: 4.5,
    description: 'Equilíbrio ideal entre rendimento, teoria e resolução de questões.',
    badge: '⚡',
  },
  intenso: {
    name: 'Intenso',
    dailyXpGoal: 600,
    maxDailyHours: 7.0,
    description: 'Maratona focada para períodos de prova, vestibulares ou concursos.',
    badge: '🔥',
  },
};

/**
 * 25+ Levels Progression Titles
 */
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Iniciante Focado',
  2: 'Aprendiz Disciplinado',
  3: 'Praticante Constante',
  4: 'Explorador Metódico',
  5: 'Estudante Focado',
  6: 'Mente Atenta',
  7: 'Estrategista Iniciante',
  8: 'Produtividade Ágil',
  9: 'Mente Disciplinada',
  10: 'Maratonista de Metas',
  11: 'Estrategista de Alta Performance',
  12: 'Mestre da Eficiência',
  13: 'Mestre do Hiperfoco',
  14: 'Guardião da Constância',
  15: 'Arquiteto do Próprio Destino',
  16: 'Especialista Imparável',
  17: 'Filósofo da Disciplina',
  18: 'Sábio Imparável',
  19: 'Grão-Mestre da Sabedoria',
  20: 'Iluminado da Eficiência',
  21: 'Titã do Conhecimento',
  22: 'Lenda Cósmica',
  23: 'Vanguardista do Saber',
  24: 'Soberano do Tempo',
  25: 'Mito Eterno do Foco',
};

export function getLevelTitle(level: number): string {
  if (level >= 25) return LEVEL_TITLES[25];
  return LEVEL_TITLES[level] || `Mestre Nível ${level}`;
}

export function calculateLevelFromXP(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
} {
  let level = 1;
  while (true) {
    const xpNeededForNext = Math.round(Math.pow(level, 1.75) * 85);
    if (totalXp < xpNeededForNext) {
      const prevLevelBase = level === 1 ? 0 : Math.round(Math.pow(level - 1, 1.75) * 85);
      const span = xpNeededForNext - prevLevelBase;
      const currentInLevel = totalXp - prevLevelBase;
      const progressPercent = Math.min(100, Math.max(0, Math.round((currentInLevel / span) * 100)));
      return {
        level,
        currentLevelXp: currentInLevel,
        nextLevelXp: span,
        progressPercent,
      };
    }
    level++;
    if (level > 100) {
      return { level: 100, currentLevelXp: 0, nextLevelXp: 1, progressPercent: 100 };
    }
  }
}

/**
 * Anti-abuse XP Calculation:
 * - Base by priority
 * - Minimum 15 min focus time for duration bonuses
 * - Difficulty & Quality weights
 * - Hard daily ceiling per task (max 120 XP)
 */
export interface TaskXPBonusContext {
  onTimeReview?: boolean;
  highAccuracy?: boolean;
}

export function calculateTaskXP(task: Task, context?: TaskXPBonusContext): number {
  // 1. Base by priority
  const priorityXP: Record<Priority, number> = {
    baixa: 15,
    media: 25,
    alta: 40,
    urgente: 50,
  };
  let earned = priorityXP[task.priority] || 25;

  // 2. Subtasks difficulty bonus (+5 per completed subtask, max +20)
  if (task.subtasks && task.subtasks.length > 0) {
    const completedSubs = task.subtasks.filter(s => s.completed).length;
    earned += Math.min(20, completedSubs * 5);
  }

  // 3. Minimum 15 min (900s) spent for time bonus (+10 per full 15 min, max 40)
  const spentSec = task.spentSeconds || 0;
  if (spentSec >= 900) {
    const intervalsOf15Min = Math.floor(spentSec / 900);
    earned += Math.min(40, intervalsOf15Min * 10);
  }

  // 4. Quality bonuses
  if (task.isTop3) {
    earned += 25; // Top 3 concluído
  }

  if (context?.onTimeReview) {
    earned += 20; // Revisão no dia certo
  }

  if (context?.highAccuracy) {
    earned += 20; // Acerto de questões >= 80%
  }

  // 5. Anti-abuse hard cap per task execution (120 XP)
  return Math.min(120, earned);
}

/**
 * Streak calculation with Shield support (1 day off per week without breaking)
 */
export function calculateStreak(
  lastActiveDate: string,
  todayISO: string,
  currentStreak: number,
  shieldAvailable: boolean,
  shieldLastUsedWeek?: string
): { streak: number; shieldUsed: boolean; shieldAvailable: boolean } {
  if (!lastActiveDate) {
    return { streak: 1, shieldUsed: false, shieldAvailable };
  }

  if (lastActiveDate === todayISO) {
    return { streak: Math.max(1, currentStreak), shieldUsed: false, shieldAvailable };
  }

  const lastDate = new Date(lastActiveDate + 'T00:00:00');
  const todayDate = new Date(todayISO + 'T00:00:00');
  const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day
    return { streak: currentStreak + 1, shieldUsed: false, shieldAvailable };
  }

  if (diffDays === 2 && shieldAvailable) {
    // Missed exactly 1 day and shield is available!
    return { streak: currentStreak + 1, shieldUsed: true, shieldAvailable: false };
  }

  // Streak broken
  return { streak: 1, shieldUsed: false, shieldAvailable };
}

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm
 * Quality grade: 0 to 5
 * 5: Resposta perfeita sem hesitação
 * 4: Resposta correta com pouca hesitação
 * 3: Resposta correta com dificuldade considerável
 * 2: Resposta incorreta onde a correta parecia familiar
 * 1: Resposta incorreta lembrada após ver
 * 0: Completo esquecimento (blackout)
 */
export function calculateSM2(
  quality: number,
  repetitions: number,
  previousInterval: number,
  previousEaseFactor: number,
  todayISO: string
): { intervalDays: number; repetitions: number; easeFactor: number; dueDate: string } {
  const q = Math.max(0, Math.min(5, quality));
  let interval: number;
  let reps: number;

  if (q >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(previousInterval * previousEaseFactor);
    }
    reps = repetitions + 1;
  } else {
    reps = 0;
    interval = 1;
  }

  // Calculate new ease factor
  const newEF = Math.max(
    1.3,
    previousEaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  // Compute next due date
  const baseDate = new Date(todayISO + 'T00:00:00');
  baseDate.setDate(baseDate.getDate() + interval);
  const dueDate = baseDate.toISOString().split('T')[0];

  return {
    intervalDays: interval,
    repetitions: reps,
    easeFactor: Math.round(newEF * 100) / 100,
    dueDate,
  };
}

export function getDynamicMotivationPhrase(currentXp: number, goalXp: number): { phrase: string; icon: string } {
  if (goalXp <= 0) return { phrase: 'Mantenha o foco e a disciplina!', icon: '✨' };
  const ratio = currentXp / goalXp;

  if (ratio === 0) {
    return { phrase: 'Hora de começar a sua jornada de hoje!', icon: '🚀' };
  }
  if (ratio < 0.35) {
    return { phrase: 'Você está pegando ritmo! Continue firme.', icon: '💪' };
  }
  if (ratio < 0.70) {
    return { phrase: 'Excelente foco! Já passou da metade da meta.', icon: '⚡' };
  }
  if (ratio < 1.0) {
    return { phrase: 'Quase lá! Só mais um pouco para bater a meta do dia.', icon: '🎯' };
  }
  return { phrase: 'Meta do dia batida com maestria! Você é imparável!', icon: '🎉' };
}

/**
 * Intelligent Next Task Recommendation Algorithm
 */
export function recommendNextTask(
  tasks: Task[],
  todayISO: string,
  studyMode: StudyMode = 'regular'
): { task: Task | null; reason: string } {
  const pendingTasks = tasks.filter(t => !t.completed && !t.deletedAt);
  if (pendingTasks.length === 0) {
    return { task: null, reason: 'Todas as tarefas foram concluídas! Aproveite para descansar ou planejar o próximo dia.' };
  }

  const todayTasks = tasksForDate(pendingTasks, todayISO);
  const pool = todayTasks.length > 0 ? todayTasks : pendingTasks;

  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  let bestTask: Task | null = null;
  let highestScore = -Infinity;
  let bestReason = '';

  for (const t of pool) {
    let score = 0;
    const reasons: string[] = [];

    // Urgente has highest weight
    if (t.priority === 'urgente') {
      score += 180;
      reasons.push('é uma tarefa urgente');
    }

    // Top 3
    if (t.isTop3) {
      score += 150;
      reasons.push('faz parte das 3 principais metas de hoje');
    }

    // Priority
    if (t.priority === 'alta') {
      score += 90;
      if (!t.isTop3) reasons.push('tem prioridade alta');
    } else if (t.priority === 'media') {
      score += 40;
    } else {
      score += 10;
    }

    // Pinned
    if (t.pinned) {
      score += 60;
      reasons.push('está fixada no topo');
    }

    // Time scheduled
    if (t.time) {
      const [h, m] = t.time.split(':').map(Number);
      const scheduledMinutes = h * 60 + (m || 0);
      const diff = Math.abs(currentTimeMinutes - scheduledMinutes);
      if (diff <= 60) {
        score += 85;
        reasons.push(`está agendada para este horário (${t.time})`);
      }
    }

    // Momentum
    if (t.spentSeconds > 0) {
      score += 45;
      reasons.push('já está em andamento');
    }

    // Subtasks progress
    if (t.subtasks && t.subtasks.length > 0) {
      const doneSub = t.subtasks.filter(s => s.completed).length;
      if (doneSub > 0 && doneSub < t.subtasks.length) {
        score += 30;
        reasons.push('tem subtarefas em progresso');
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestTask = t;
      bestReason = reasons.length > 0
        ? `Recomendada porque ${reasons.slice(0, 2).join(' e ')}.`
        : 'Próxima tarefa ideal para manter o seu ritmo de estudos.';
    }
  }

  return { task: bestTask, reason: bestReason };
}

/**
 * Check and update achievements progression
 */
export function checkAchievements(
  currentAchievements: Achievement[],
  profile: UserProfile,
  tasks: Task[],
  totalFocusSeconds: number
): { updated: Achievement[]; newlyUnlocked: Achievement[] } {
  const newlyUnlocked: Achievement[] = [];
  const completedTasks = tasks.filter(t => t.completed && !t.deletedAt);
  const totalFocusMinutes = Math.floor(totalFocusSeconds / 60);

  const updated = currentAchievements.map(ach => {
    let progress = ach.progress;
    const wasUnlocked = !!ach.unlockedAt;

    if (ach.id === 'ach-first-task') {
      progress = completedTasks.length > 0 ? 1 : 0;
    } else if (ach.id === 'ach-focus-1h') {
      progress = Math.min(ach.maxProgress, totalFocusMinutes);
    } else if (ach.id === 'ach-focus-5h') {
      progress = Math.min(ach.maxProgress, totalFocusMinutes);
    } else if (ach.id === 'ach-streak-3') {
      progress = Math.min(ach.maxProgress, profile.streak);
    } else if (ach.id === 'ach-streak-7') {
      progress = Math.min(ach.maxProgress, profile.streak);
    } else if (ach.id === 'ach-level-5') {
      progress = Math.min(ach.maxProgress, profile.level);
    } else if (ach.id === 'ach-top3-clean') {
      const top3Done = tasks.filter(t => t.isTop3 && t.completed).length;
      progress = Math.min(ach.maxProgress, top3Done);
    }

    const isNowUnlocked = progress >= ach.maxProgress;
    const unlockedAt = isNowUnlocked && !wasUnlocked ? new Date().toISOString() : ach.unlockedAt;

    const modified = { ...ach, progress, unlockedAt };
    if (isNowUnlocked && !wasUnlocked) {
      newlyUnlocked.push(modified);
    }
    return modified;
  });

  return { updated, newlyUnlocked };
}
