import React, { useState, useMemo } from 'react';
import { Clock, AlertTriangle, Play, Plus, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Task, Category } from '../types';
import { formatSecondsToDigital, getTodayISO } from '../utils/dateUtils';
import { tasksForDate } from '../services/recurrence';
import { CategoryIcon } from './CategoryIcon';

interface DailyTimelineProps {
  tasks: Task[];
  categories: Category[];
  activeTaskId: string | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  onToggleTimer: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onAssignTaskTime: (taskId: string, time: string) => void;
  onQuickNewTaskForTime: (time: string) => void;
}

const HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', 
  '19:00', '20:00', '21:00', '22:00'
];

export const DailyTimeline: React.FC<DailyTimelineProps> = ({
  tasks,
  categories,
  activeTaskId,
  activeTimerRunning,
  activeTimerElapsed,
  onToggleTimer,
  onEditTask,
  onAssignTaskTime,
  onQuickNewTaskForTime,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);

  const todayISO = getTodayISO();
  const todayTasks = useMemo(() => {
    return tasksForDate(tasks, todayISO).filter(t => !t.deletedAt);
  }, [tasks, todayISO]);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Group scheduled tasks by hour
  const tasksByHour = useMemo(() => {
    const map: Record<string, Task[]> = {};
    HOURS.forEach(h => {
      map[h] = [];
    });

    todayTasks.forEach(task => {
      if (task.time) {
        // Match exact or closest prefix "HH:00"
        const hourPrefix = task.time.split(':')[0] + ':00';
        if (map[hourPrefix]) {
          map[hourPrefix].push(task);
        } else if (map[task.time]) {
          map[task.time].push(task);
        }
      }
    });

    return map;
  }, [todayTasks]);

  // Count conflicts
  const conflictCount = useMemo(() => {
    let count = 0;
    Object.values(tasksByHour).forEach(list => {
      if (list.length > 1) count += list.length;
    });
    return count;
  }, [tasksByHour]);

  const unscheduledTasks = useMemo(() => {
    return todayTasks.filter(t => !t.time && !t.completed);
  }, [todayTasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e: React.DragEvent, hour: string) => {
    e.preventDefault();
    setDragOverHour(hour);
  };

  const handleDrop = (e: React.DragEvent, hour: string) => {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onAssignTaskTime(taskId, hour);
    }
  };

  return (
    <div className="card-hover rounded-[24px] bg-[var(--surface)] p-5 sm:p-6 shadow-[var(--shadow-card)] border border-[var(--borda)]">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[var(--texto)]">
              Linha do Tempo de Hoje (Blocos de Horário)
            </h3>
            <span className="text-xs text-[var(--texto-suave)] font-semibold">
              Arraste tarefas para os horários de 07:00 às 22:00
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conflictCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{conflictCount} em conflito de horário</span>
            </span>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--borda)] text-xs font-bold text-[var(--texto)] transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Recolher' : 'Expandir Agenda'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Unscheduled draggable chips */}
      {unscheduledTasks.length > 0 && (
        <div className="mb-4 p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)]">
          <div className="text-xs font-bold text-[var(--texto-suave)] mb-2">
            Tarefas sem horário definido (arraste para um horário abaixo):
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduledTasks.map(task => {
              const cat = catMap.get(task.categoryId) || categories[0];
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)] shadow-xs hover:border-[var(--primary)] cursor-grab active:cursor-grabbing transition-colors"
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="truncate max-w-[160px]">{task.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline Slots */}
      <div className={`space-y-2 transition-all ${isExpanded ? 'max-h-none' : 'max-h-[380px] overflow-y-auto pr-1'}`}>
        {HOURS.map(hour => {
          const slotTasks = tasksByHour[hour] || [];
          const hasConflict = slotTasks.length > 1;
          const isTarget = dragOverHour === hour;

          return (
            <div
              key={hour}
              onDragOver={(e) => handleDragOver(e, hour)}
              onDragLeave={() => setDragOverHour(null)}
              onDrop={(e) => handleDrop(e, hour)}
              className={`flex items-start gap-3 p-2.5 rounded-2xl transition-all border ${
                isTarget
                  ? 'bg-violet-50/60 border-[var(--primary)] ring-2 ring-[var(--primary)]/30'
                  : hasConflict
                  ? 'bg-amber-50/50 border-amber-300 '
                  : slotTasks.length > 0
                  ? 'bg-[var(--surface-secondary)] border-[var(--borda)]'
                  : 'bg-[var(--surface)] hover:bg-[var(--surface-secondary)]/50 border-dashed border-[var(--borda)]'
              }`}
            >
              {/* Hour Label */}
              <div className="w-14 shrink-0 font-black text-xs text-[var(--texto-suave)] pt-1 tabular-nums">
                {hour}
              </div>

              {/* Slots Content */}
              <div className="flex-1 min-w-0">
                {slotTasks.length === 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--texto-muted)] font-medium">Livre</span>
                    <button
                      onClick={() => onQuickNewTaskForTime(hour)}
                      className="opacity-0 hover:opacity-100 group-hover:opacity-100 px-2 py-0.5 rounded-lg text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-opacity cursor-pointer"
                    >
                      + Agendar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hasConflict && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 ">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Conflito: {slotTasks.length} tarefas agendadas para o mesmo horário</span>
                      </div>
                    )}

                    {slotTasks.map(task => {
                      const cat = catMap.get(task.categoryId) || categories[0];
                      const isTimerOn = activeTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--surface)] border transition-all shadow-xs ${
                            isTimerOn ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30' : 'border-[var(--borda)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            <span className="text-xs font-bold text-[var(--texto)] truncate">
                              {task.title}
                            </span>
                            <span className="text-xs font-semibold text-[var(--texto-suave)] shrink-0">
                              ({task.estimatedMinutes ? `${task.estimatedMinutes}min` : '45min'})
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => onToggleTimer(task)}
                              className="p-1.5 rounded-lg bg-[var(--primary-soft)] hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white transition-colors cursor-pointer"
                              title={isTimerOn && activeTimerRunning ? 'Pausar' : 'Iniciar Foco'}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              onClick={() => onEditTask(task)}
                              className="px-2 py-1 rounded-lg text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
