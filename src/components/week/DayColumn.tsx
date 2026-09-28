import React from 'react';
import { 
  Plus, 
  Play, 
  Pause, 
  Check, 
  Clock, 
  Star, 
  Pin, 
  MoreVertical,
  Edit2,
  Trash2
} from 'lucide-react';
import { Task, Category } from '../../types';
import { InfiniteDayItem } from '../../hooks/useInfiniteDays';
import { CategoryIcon } from '../CategoryIcon';
import { formatSecondsToDigital, formatMinutesHuman } from '../../utils/dateUtils';

interface DayColumnProps {
  day: InfiniteDayItem;
  tasks: Task[];
  categories: Category[];
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  draggedTaskId: string | null;
  isDragOver: boolean;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (dateISO: string) => void;
  onToggleTimer: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTop3: (task: Task) => void;
  onTogglePin: (task: Task) => void;
  onQuickAddTask: (dateISO: string) => void;
}

export const DayColumn: React.FC<DayColumnProps> = ({
  day,
  tasks,
  categories,
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  draggedTaskId,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onToggleTimer,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onToggleTop3,
  onTogglePin,
  onQuickAddTask,
}) => {
  const catMap = new Map(categories.map(c => [c.id, c]));
  
  // Total planned minutes for this day
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 45), 0);
  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div
      data-date={day.dateISO}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(day.dateISO)}
      className={`w-[85vw] sm:w-[280px] shrink-0 rounded-2xl border flex flex-col transition-all snap-start select-none ${
        day.isToday
          ? 'bg-[var(--surface)] border-[var(--primary)] ring-1 ring-[var(--primary)]/30 shadow-md'
          : 'bg-[var(--surface)] border-[var(--borda)] hover:border-[var(--borda-hover)] shadow-xs'
      } ${isDragOver ? 'ring-2 ring-[var(--primary)] bg-[var(--primary-soft)]/20' : ''}`}
      style={{ minHeight: '520px' }}
    >
      {/* Column Header */}
      <div className={`p-3.5 border-b border-[var(--borda)] flex items-center justify-between rounded-t-2xl ${
        day.isToday ? 'bg-[var(--primary-soft)]/30' : 'bg-[var(--surface-secondary)]/40'
      }`}>
        <div className="flex items-center gap-2">
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                day.isToday ? 'text-[var(--primary)]' : 'text-[var(--texto-suave)]'
              }`}>
                {day.dayName}
              </span>
              {day.isToday && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[var(--primary)] text-white">
                  Hoje
                </span>
              )}
            </div>
            <div className="text-lg font-extrabold text-[var(--texto)] tabular-nums leading-none mt-0.5">
              {day.dayNumber} <span className="text-xs font-semibold text-[var(--texto-muted)]">{day.monthName.slice(0, 3)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div className="text-right mr-1 tabular-nums">
            <div className="text-[11px] font-bold text-[var(--texto-suave)]">
              {completedCount}/{tasks.length}
            </div>
            <div className="text-[10px] text-[var(--texto-muted)]">
              {formatMinutesHuman(totalMinutes)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onQuickAddTask(day.dateISO)}
            title={`Adicionar tarefa em ${day.dayNumber} de ${day.monthName}`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--primary)] hover:bg-[var(--surface)] border border-[var(--borda)] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="p-2.5 flex-1 flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-250px)]">
        {tasks.map((task) => {
          const category = catMap.get(task.categoryId) || { id: task.categoryId, name: 'Geral', color: '#64748B', icon: 'tag' };
          const isCurrentActive = activeTask?.id === task.id;
          const isRunning = isCurrentActive && activeTimerRunning;
          const currentSpent = isCurrentActive ? activeTimerElapsed : task.spentSeconds;

          const priorityBadgeStyles: Record<string, string> = {
            baixa: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
            media: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
            alta: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
            urgente: 'bg-rose-500/10 text-rose-700 border-rose-500/30',
          };

          return (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', task.id);
                onDragStart(task.id);
              }}
              onDragEnd={onDragEnd}
              onClick={() => onEditTask(task)}
              className={`p-3 rounded-xl border transition-all cursor-pointer group text-left relative ${
                task.completed
                  ? 'bg-[var(--surface-secondary)]/50 border-[var(--borda)] opacity-60'
                  : isRunning
                  ? 'bg-[var(--primary-soft)] border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]'
                  : 'bg-[var(--surface)] border-[var(--borda)] hover:border-[var(--primary)] shadow-xs hover:shadow-sm'
              } ${draggedTaskId === task.id ? 'opacity-40' : ''}`}
            >
              {/* Category, Badges & Actions */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CategoryIcon category={category} size="sm" className="!w-4 !h-4 !rounded" />
                  <span className="text-[11px] font-semibold text-[var(--texto-suave)] truncate">
                    {category.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {task.isTop3 && (
                    <span title="Top 3 do dia" className="text-amber-500">
                      <Star className="w-3 h-3 fill-amber-500" />
                    </span>
                  )}
                  {task.pinned && (
                    <span title="Fixada" className="text-[var(--primary)]">
                      <Pin className="w-3 h-3 fill-[var(--primary)]" />
                    </span>
                  )}
                  {task.priority && (
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border capitalize ${
                      priorityBadgeStyles[task.priority] || priorityBadgeStyles.media
                    }`}>
                      {task.priority}
                    </span>
                  )}
                </div>
              </div>

              {/* Task Title */}
              <div className="flex items-start gap-2 mb-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(task);
                  }}
                  className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                    task.completed
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                      : 'border-[var(--borda-hover)] hover:border-[var(--primary)] bg-transparent'
                  }`}
                >
                  {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </button>
                <span className={`text-xs font-semibold leading-snug break-words ${
                  task.completed ? 'line-through text-[var(--texto-muted)]' : 'text-[var(--texto)]'
                }`}>
                  {task.title}
                </span>
              </div>

              {/* Subtasks Progress if any */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="text-[10px] text-[var(--texto-muted)] mb-2 flex items-center gap-1.5">
                  <div className="w-full bg-[var(--surface-secondary)] h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-[var(--primary)] h-full transition-all"
                      style={{
                        width: `${Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100)}%`
                      }}
                    />
                  </div>
                  <span className="tabular-nums shrink-0">
                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                  </span>
                </div>
              )}

              {/* Footer: Time & Timer Button */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--borda)]/60 text-[11px] text-[var(--texto-suave)] tabular-nums">
                <div className="flex items-center gap-1.5">
                  {task.time ? (
                    <span className="font-bold text-[var(--texto)]">{task.time}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[var(--texto-muted)]">
                      <Clock className="w-3 h-3" />
                      {task.estimatedMinutes || 45}m
                    </span>
                  )}
                  {currentSpent > 0 && (
                    <span className="text-[10px] text-[var(--primary)] font-semibold">
                      · {formatSecondsToDigital(currentSpent)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {!task.completed && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTimer(task);
                      }}
                      title={isRunning ? 'Pausar foco' : 'Iniciar foco'}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        isRunning
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--primary)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {isRunning ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTask(task.id);
                    }}
                    title="Excluir tarefa"
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--texto-muted)] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Compact Empty State */}
        {tasks.length === 0 && (
          <button
            type="button"
            onClick={() => onQuickAddTask(day.dateISO)}
            className="flex-1 min-h-[140px] rounded-xl border border-dashed border-[var(--borda)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]/20 text-[var(--texto-muted)] hover:text-[var(--primary)] flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer p-4 group"
          >
            <Plus className="w-4 h-4 text-[var(--texto-muted)] group-hover:text-[var(--primary)]" />
            <span>Adicionar tarefa</span>
          </button>
        )}
      </div>
    </div>
  );
};
