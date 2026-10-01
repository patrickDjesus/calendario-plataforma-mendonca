import { DatabaseSchema, FocusSession, DailyStat, ReviewItem, Subject, Topic } from '../types';

export const CURRENT_SCHEMA_VERSION = 2;

export interface MigrationStep {
  version: number;
  description: string;
  migrate: (db: any) => any;
}

/**
 * Lista sequencial de migrações puras.
 * Toda migração recebe um snapshot de versão N e retorna N+1 sem perda de dados.
 */
export const MIGRATIONS: MigrationStep[] = [
  {
    version: 1,
    description: 'Inicializa schemaVersion, coleções de estudos, sessões de foco e agregações',
    migrate: (db: any): any => {
      const migrated = { ...db };
      migrated.schemaVersion = 1;

      // 1. Sessões de foco como registros próprios
      if (!Array.isArray(migrated.focusSessions)) {
        migrated.focusSessions = [];
        // Se houver tarefas com tempo gasto e sem sessões, criar sessões legadas
        if (Array.isArray(migrated.tasks)) {
          migrated.tasks.forEach((t: any) => {
            if (t.spentSeconds && t.spentSeconds > 0) {
              const session: FocusSession = {
                id: `legacy-session-${t.id}`,
                taskId: t.id,
                type: t.details?.type === 'estudo' ? 'teoria' : 'outro',
                startedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
                endedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
                plannedSeconds: (t.estimatedMinutes || 25) * 60,
                actualSeconds: t.spentSeconds,
                interrupted: false,
              };
              migrated.focusSessions.push(session);
            }
          });
        }
      }

      // 2. Arquivamento: tarefas concluídas há mais de 90 dias
      if (!Array.isArray(migrated.archive)) {
        migrated.archive = [];
      }
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (Array.isArray(migrated.tasks)) {
        const remainingTasks: any[] = [];
        migrated.tasks.forEach((t: any) => {
          if (t.completed && (t.completedAt || t.date) && (t.completedAt || t.date) < ninetyDaysAgo) {
            migrated.archive.push({ ...t, archivedAt: new Date().toISOString() });
          } else {
            remainingTasks.push(t);
          }
        });
        migrated.tasks = remainingTasks;
      }

      // 3. Matérias e tópicos unificados
      if (!Array.isArray(migrated.subjects)) {
        migrated.subjects = [];
        // Se já existiam subjectStructures da Fase 3B, migrar para a nova estrutura de estudos
        if (Array.isArray(migrated.subjectStructures)) {
          migrated.subjectStructures.forEach((struct: any) => {
            const subjectId = `subj-${struct.id}`;
            const subj: Subject = {
              id: subjectId,
              nome: struct.name,
              cor: struct.color || '#6366F1',
              metaSemanalMin: 360, // 6h padrão
              createdAt: new Date().toISOString(),
            };
            migrated.subjects.push(subj);

            if (!Array.isArray(migrated.topics)) migrated.topics = [];
            if (Array.isArray(struct.modules)) {
              struct.modules.forEach((mod: any, mIdx: number) => {
                if (Array.isArray(mod.topics)) {
                  mod.topics.forEach((top: any, tIdx: number) => {
                    const topic: Topic = {
                      id: `topic-${top.id || `${mod.id}-${tIdx}`}`,
                      subjectId: subjectId,
                      nome: `${mod.name} › ${top.name}`,
                      ordem: mIdx * 100 + tIdx,
                      status: top.status === 'dominado' ? 'dominado' : top.status === 'revisando' ? 'revisando' : top.status === 'estudando' ? 'estudando' : 'nao_iniciado',
                      notas: top.notes || undefined,
                    };
                    migrated.topics.push(topic);
                  });
                }
              });
            }
          });
        }
      }
      if (!Array.isArray(migrated.topics)) {
        migrated.topics = [];
      }

      // 4. Revisão Espaçada (SM-2): migrar spacedRepetitions e flashcards legados
      if (!Array.isArray(migrated.reviewItems)) {
        migrated.reviewItems = [];
        if (Array.isArray(migrated.spacedRepetitions)) {
          migrated.spacedRepetitions.forEach((sr: any) => {
            const reviewItem: ReviewItem = {
              id: `sm2-${sr.id}`,
              kind: 'topic',
              front: sr.title,
              back: `Revisão vinculada à tarefa ${sr.originalTaskId}`,
              easeFactor: 2.5,
              intervalDays: sr.currentIntervalIndex > 0 ? (sr.currentIntervalIndex === 1 ? 3 : 7) : 1,
              repetitions: sr.completedIntervals?.length || 0,
              lapses: 0,
              dueDate: sr.dueDates?.[sr.currentIntervalIndex] || new Date().toISOString().split('T')[0],
              lastReviewedAt: sr.createdAt,
            };
            migrated.reviewItems.push(reviewItem);
          });
        }
        if (Array.isArray(migrated.flashcards)) {
          migrated.flashcards.forEach((fc: any) => {
            const reviewItem: ReviewItem = {
              id: `sm2-fc-${fc.id}`,
              kind: 'card',
              front: fc.front,
              back: fc.back,
              topicId: fc.topicId,
              easeFactor: fc.easeFactor || 2.5,
              intervalDays: fc.intervalDays || 1,
              repetitions: fc.repetitions || 0,
              lapses: 0,
              dueDate: fc.dueDate || new Date().toISOString().split('T')[0],
              lastReviewedAt: fc.lastReviewedAt,
            };
            migrated.reviewItems.push(reviewItem);
          });
        }
      }

      // 5. Novas coleções de estudos e longo prazo
      if (!Array.isArray(migrated.questionLogs)) migrated.questionLogs = [];
      if (!Array.isArray(migrated.errorNotes)) migrated.errorNotes = [];
      if (!Array.isArray(migrated.objectives)) migrated.objectives = [];
      if (!Array.isArray(migrated.projects)) migrated.projects = [];
      if (!Array.isArray(migrated.reviews)) migrated.reviews = [];
      if (!Array.isArray(migrated.rewards)) migrated.rewards = [];
      if (!Array.isArray(migrated.cloudBackups)) migrated.cloudBackups = [];

      // 6. Settings default updates
      if (migrated.settings) {
        if (!migrated.settings.animations) migrated.settings.animations = 'suave';
        if (!migrated.settings.dailyCapacityMinutes) {
          migrated.settings.dailyCapacityMinutes = { 0: 180, 1: 300, 2: 300, 3: 300, 4: 300, 5: 240, 6: 180 };
        }
        if (!migrated.settings.dailyReviewLimit) migrated.settings.dailyReviewLimit = 30;
        if (!migrated.settings.accuracyThreshold) migrated.settings.accuracyThreshold = 70;
      }

      // 7. Estatísticas diárias agregadas (dailyStats)
      migrated.dailyStats = buildInitialDailyStats(migrated);

      return migrated;
    },
  },
  {
    version: 2,
    description: 'Garante integridade de metas semanais e histórico de matérias',
    migrate: (db: any): any => {
      const migrated = { ...db };
      migrated.schemaVersion = 2;
      if (!Array.isArray(migrated.subjects)) migrated.subjects = [];
      if (!Array.isArray(migrated.topics)) migrated.topics = [];
      if (!Array.isArray(migrated.goals)) migrated.goals = [];
      return migrated;
    },
  },
];

/**
 * Reconstrói ou calcula dailyStats a partir do histórico de tarefas, foco e humor
 */
export function buildInitialDailyStats(db: any): Record<string, DailyStat> {
  const stats: Record<string, DailyStat> = {};

  const ensureDate = (date: string) => {
    if (!stats[date]) {
      stats[date] = {
        date,
        tasksDone: 0,
        xp: 0,
        focusSeconds: 0,
        activeDay: false,
      };
    }
    return stats[date];
  };

  // 1. Tarefas completadas
  const allTasks = [...(db.tasks || []), ...(db.archive || [])];
  allTasks.forEach((t: any) => {
    if (t.completed && (t.completedAt || t.date)) {
      const d = (t.completedAt || t.date).split('T')[0];
      const entry = ensureDate(d);
      entry.tasksDone += 1;
      entry.activeDay = true;
    }
  });

  // 2. Histórico de XP no perfil
  if (db.profile?.xpHistory) {
    Object.entries(db.profile.xpHistory).forEach(([date, xp]) => {
      const entry = ensureDate(date);
      entry.xp = Number(xp) || 0;
      if (entry.xp > 0) entry.activeDay = true;
    });
  }

  // 3. Tempo de foco: o que o cronometro mediu e gravou nas tarefas.
  //    A FocusSession e o REGISTRO de quando a sessao foi encerrada, e os
  //    segundos dela ja estao dentro de `spentSeconds` — somar os dois aqui
  //    contaria o mesmo tempo duas vezes. Por isso `focusSessions` nao entra
  //    nesta reconstrucao.
  const addFocus = (date: string | undefined, seconds: number | undefined) => {
    if (!date || !seconds || seconds <= 0) return;
    const entry = ensureDate(date);
    entry.focusSeconds += seconds;
    if (entry.focusSeconds >= 600) entry.activeDay = true;
  };

  allTasks.forEach((t: any) => {
    if (t.deletedAt) return;
    // Serie recorrente: o tempo foi divided por dia, e o total da ancora nao
    // pode ser somado de novo.
    if (Array.isArray(t.recurringDays) && t.recurringDays.length > 0) {
      Object.entries(t.spentSecondsByDay || {}).forEach(([date, seconds]) => {
        addFocus(date, Number(seconds) || 0);
      });
      return;
    }
    addFocus(t.date, t.spentSeconds);
  });

  // 4. Humor diário
  if (db.dailyMoods) {
    Object.entries(db.dailyMoods).forEach(([date, moodObj]: [string, any]) => {
      const entry = ensureDate(date);
      entry.mood = moodObj.mood;
      entry.energy = moodObj.energy;
    });
  }

  return stats;
}

/**
 * Aplica migrações sequenciais em cascata de forma determinística
 */
export function applyMigrations(data: any): { data: DatabaseSchema; migrated: boolean; fromVersion: number; toVersion: number } {
  if (!data || typeof data !== 'object') {
    return { data, migrated: false, fromVersion: 0, toVersion: 0 };
  }

  let current = { ...data };
  const fromVersion = Number(current.schemaVersion) || 0;
  let migrated = false;

  for (const step of MIGRATIONS) {
    if (fromVersion < step.version) {
      current = step.migrate(current);
      migrated = true;
    }
  }

  current.schemaVersion = CURRENT_SCHEMA_VERSION;
  return {
    data: current as DatabaseSchema,
    migrated,
    fromVersion,
    toVersion: CURRENT_SCHEMA_VERSION,
  };
}
