import React, { useState, useMemo } from 'react';
import { Sparkles, Calendar, Check, X, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { Task, Category, UserProfile, Priority } from '../types';
import { getWeekDays, formatDateToISO, formatMinutesHuman } from '../utils/dateUtils';
import { STUDY_MODES } from '../utils/xpSystem';
import { CategoryIcon } from './CategoryIcon';

interface PlanWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  categories: Category[];
  profile: UserProfile;
  firstDayOfWeek: 0 | 1;
  onApplyPlan: (reallocatedTasks: Task[]) => void;
}

export const PlanWeekModal: React.FC<PlanWeekModalProps> = ({
  isOpen,
  onClose,
  tasks,
  categories,
  profile,
  firstDayOfWeek,
  onApplyPlan,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const weekDays = useMemo(() => getWeekDays(new Date(), firstDayOfWeek), [firstDayOfWeek]);
  const studyModeConfig = STUDY_MODES[profile.studyMode] || STUDY_MODES.regular;
  const maxDailyMinutes = Math.round(studyModeConfig.maxDailyHours * 60);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Compute proposed distribution
  const proposal = useMemo(() => {
    // Uncompleted tasks
    const pending = tasks.filter(t => !t.completed && !t.deletedAt);
    
    // Day loads initialized with 0
    const dayLoads: Record<string, number> = {};
    weekDays.forEach(d => { dayLoads[d.isoString] = 0 });

    // Distribute sorted by priority (urgente first)
    const sorted = [...pending].sort((a, b) => {
      const pMap: Record<Priority, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
      return pMap[b.priority] - pMap[a.priority];
    });

    const planned: Array<{ task: Task; targetDate: string; targetDayName: string }> = [];

    sorted.forEach((task) => {
      const taskDuration = task.estimatedMinutes || 45;
      
      // Find day with smallest load that fits under limit
      let bestDay = weekDays[0];
      let minLoad = Infinity;

      for (const d of weekDays) {
        const currentLoad = dayLoads[d.isoString] || 0;
        if (currentLoad < minLoad) {
          minLoad = currentLoad;
          bestDay = d;
        }
      }

      dayLoads[bestDay.isoString] = (dayLoads[bestDay.isoString] || 0) + taskDuration;
      planned.push({
        task: { ...task, date: bestDay.isoString },
        targetDate: bestDay.isoString,
        targetDayName: bestDay.dayName,
      });
    });

    return planned;
  }, [tasks, weekDays, maxDailyMinutes]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onApplyPlan(proposal.map(p => p.task));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-2xl rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl p-6 sm:p-7 text-[var(--texto)] my-8 animate-modal">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--borda)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-indigo-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--texto)]">
                Planejar Minha Semana
              </h2>
              <p className="text-xs text-[var(--texto-suave)] font-medium">
                Distribuição equilibrada respeitando o limite do Modo {studyModeConfig.name} ({studyModeConfig.maxDailyHours}h/dia)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--borda)] flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Proposed Schedule Preview */}
        <div className="mt-5 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {proposal.length === 0 ? (
            <p className="text-sm text-center text-[var(--texto-muted)] py-8">
              Não há tarefas pendentes para distribuir. Adicione tarefas ao backlog primeiro!
            </p>
          ) : (
            proposal.map(({ task, targetDayName }) => {
              const cat = catMap.get(task.categoryId) || categories[0];
              return (
                <div
                  key={task.id}
                  className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon category={cat} size="sm" />
                    <div className="min-w-0">
                      <span className="text-[11px] font-extrabold uppercase text-[var(--primary)]">
                        {cat.name}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-[var(--texto)] truncate">
                        {task.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[var(--primary-soft)] text-[var(--primary)] border border-blue-500/20">
                      📅 {targetDayName}
                    </span>
                    {task.estimatedMinutes && (
                      <span className="text-xs font-semibold text-[var(--texto-suave)]">
                        {formatMinutesHuman(task.estimatedMinutes)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-5 mt-4 border-t border-[var(--borda)]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-[var(--surface-secondary)] text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
          >
            Recusar
          </button>
          <button
            type="button"
            disabled={proposal.length === 0}
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white text-xs font-extrabold shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
          >
            <Check className="w-4 h-4" />
            <span>Aceitar Distribuição</span>
          </button>
        </div>

      </div>
    </div>
  );
};
