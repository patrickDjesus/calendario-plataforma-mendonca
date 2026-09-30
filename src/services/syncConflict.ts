import { DatabaseSchema, Task } from '../types';

export interface ConflictMergeResult {
  merged: DatabaseSchema;
  hasConflict: boolean;
  conflictedTaskTitles: string[];
}

/**
 * Merge determinístico de dois snapshots (local x remoto)
 * Princípio: O updatedAt mais recente vence por entidade.
 * Exclusões respeitam deletedAt.
 */
export function mergeSnapshots(local: DatabaseSchema, remote: DatabaseSchema): ConflictMergeResult {
  const conflictedTaskTitles: string[] = [];
  let hasConflict = false;

  // 1. Merge de Tarefas
  const taskMap = new Map<string, Task>();

  // Adiciona locais
  local.tasks.forEach(t => taskMap.set(t.id, t));

  // Merge com remotas
  remote.tasks.forEach(remoteTask => {
    const localTask = taskMap.get(remoteTask.id);
    if (!localTask) {
      taskMap.set(remoteTask.id, remoteTask);
    } else {
      const localUpdated = localTask.updatedAt || localTask.createdAt || '';
      const remoteUpdated = remoteTask.updatedAt || remoteTask.createdAt || '';

      if (localUpdated !== remoteUpdated) {
        hasConflict = true;
        // Se ambos foram modificados com dados diferentes
        if (remoteUpdated > localUpdated) {
          taskMap.set(remoteTask.id, remoteTask);
        } else if (localUpdated === remoteUpdated) {
          // Empate: prefere a versão concluída ou a mais completa
          if (!localTask.completed && remoteTask.completed) {
            taskMap.set(remoteTask.id, remoteTask);
          }
        } else {
          conflictedTaskTitles.push(localTask.title);
        }
      }
    }
  });

  const mergedTasks = Array.from(taskMap.values());

  // 2. Merge de Profile: XP acumulativo e maior sequência
  const localXp = local.profile?.xp || 0;
  const remoteXp = remote.profile?.xp || 0;
  const mergedProfile = {
    ...(local.profile || remote.profile),
    xp: Math.max(localXp, remoteXp),
    level: Math.max(local.profile?.level || 1, remote.profile?.level || 1),
    streak: Math.max(local.profile?.streak || 0, remote.profile?.streak || 0),
    longestStreak: Math.max(local.profile?.longestStreak || 0, remote.profile?.longestStreak || 0),
    xpHistory: {
      ...(remote.profile?.xpHistory || {}),
      ...(local.profile?.xpHistory || {}),
    },
  };

  // 3. Merge de Coleções complementares
  const mergeById = <T extends { id: string; updatedAt?: string; createdAt?: string }>(
    locArr: T[] = [],
    remArr: T[] = []
  ): T[] => {
    const map = new Map<string, T>();
    locArr.forEach(i => map.set(i.id, i));
    remArr.forEach(i => {
      const existing = map.get(i.id);
      if (!existing) {
        map.set(i.id, i);
      } else {
        const locTime = existing.updatedAt || existing.createdAt || '';
        const remTime = i.updatedAt || i.createdAt || '';
        if (remTime > locTime) {
          map.set(i.id, i);
        }
      }
    });
    return Array.from(map.values());
  };

  const merged: DatabaseSchema = {
    ...remote,
    ...local,
    version: Math.max(local.version || 0, remote.version || 0) + 1,
    schemaVersion: Math.max(local.schemaVersion || 1, remote.schemaVersion || 1),
    profile: mergedProfile,
    settings: local.settings || remote.settings,
    tasks: mergedTasks,
    dailyMoods: {
      ...(remote.dailyMoods || {}),
      ...(local.dailyMoods || {}),
    },
    focusSessions: mergeById(local.focusSessions || [], remote.focusSessions || []),
    subjects: mergeById(local.subjects || [], remote.subjects || []),
    topics: mergeById(local.topics || [], remote.topics || []),
    goals: mergeById(local.goals || [], remote.goals || []),
    reviewItems: mergeById(local.reviewItems || [], remote.reviewItems || []),
    questionLogs: mergeById(local.questionLogs || [], remote.questionLogs || []),
    errorNotes: mergeById(local.errorNotes || [], remote.errorNotes || []),
    objectives: mergeById(local.objectives || [], remote.objectives || []),
    projects: mergeById(local.projects || [], remote.projects || []),
    reviews: mergeById(local.reviews || [], remote.reviews || []),
    rewards: mergeById(local.rewards || [], remote.rewards || []),
    archive: mergeById(local.archive || [], remote.archive || []),
  };

  return {
    merged,
    hasConflict,
    conflictedTaskTitles,
  };
}
