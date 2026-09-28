import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Check, 
  Clock, 
  MoreVertical, 
  Star, 
  Pin, 
  Trash2, 
  Edit3 
} from 'lucide-react';
import { Task, Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatSecondsToDigital, formatMinutesHuman } from '../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  category: Category;
  isActiveTimer: boolean;
  isTimerRunning: boolean;
  activeElapsedSeconds: number;
  onToggleTimer: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggleTop3: (task: Task) => void;
  onTogglePin: (task: Task) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  category,
  isActiveTimer,
  isTimerRunning,
  activeElapsedSeconds,
  onToggleTimer,
  onToggleComplete,
  onEdit,
  onDelete,
  onToggleTop3,
  onTogglePin,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const displaySeconds = isActiveTimer ? activeElapsedSeconds : task.spentSeconds;
  const estimatedSeconds = (task.estimatedMinutes || 0) * 60;
  const progressPercent = estimatedSeconds > 0
    ? Math.min(100, Math.round((displaySeconds / estimatedSeconds) * 100))
    : 0;

  return (
    <div
      className={`group relative py-3.5 px-3 rounded-2xl transition-all duration-150 flex items-center gap-4 ${
        isActiveTimer && isTimerRunning
          ? 'bg-[var(--primary-soft)] ring-1 ring-[var(--primary)]'
          : 'hover:bg-[var(--surface-secondary)]'
      } ${task.completed ? 'opacity-60' : ''}`}
    >
      {/* 48px Category Tile */}
      <CategoryIcon category={category} size="md" />

      {/* Main Text Content (flex: 1, min-width: 0) */}
      <div className="flex-1 min-w-0">
        
        {/* Category name in category color + inline chips */}
        <div className="flex items-center flex-wrap gap-2 mb-0.5">
          <span 
            className="text-xs font-bold"
            style={{ color: category.color }}
          >
            {category.name}
          </span>

          {task.isTop3 && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Top 3</span>
            </span>
          )}

          {task.pinned && (
            <span className="flex items-center gap-1 text-xs font-bold text-[var(--primary)]">
              <Pin className="w-3 h-3 fill-current" />
            </span>
          )}

          {task.time && (
            <span className="text-xs font-semibold text-[var(--texto-suave)]">
              🕒 {task.time}
            </span>
          )}
        </div>

        {/* Task Title (16px bold, 2-line clamp max, natural word wrapping) */}
        <h3 className={`text-base font-bold text-[var(--texto)] leading-snug line-clamp-2 ${
          task.completed ? 'line-through text-[var(--texto-suave)]' : ''
        }`}>
          {task.title}
        </h3>

        {/* Metadata: Spent / Estimated time */}
        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--texto-suave)]">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span className="font-bold text-[var(--texto)] tabular-nums">
              {formatSecondsToDigital(displaySeconds)}
            </span>
            {task.estimatedMinutes && (
              <span>/ {formatMinutesHuman(task.estimatedMinutes)}</span>
            )}
          </div>
        </div>

        {/* Thin progress bar ONLY if time has been spent */}
        {displaySeconds > 0 && estimatedSeconds > 0 && (
          <div className="mt-2 w-full h-1.5 rounded-full bg-[var(--track-gray)] overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                task.completed ? 'bg-emerald-500' : 'bg-[var(--primary)]'
              }`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        )}

      </div>

      {/* Right Side Actions: Play Button & 24px Animated Checkbox */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* Play / Pause button (Hover on desktop, always visible on mobile) */}
        <button
          onClick={() => onToggleTimer(task)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
            isActiveTimer && isTimerRunning
              ? 'bg-[var(--primary)] text-white shadow-md shadow-blue-500/25'
              : 'text-[var(--primary)] hover:bg-[var(--primary-soft)] opacity-80 sm:opacity-0 group-hover:opacity-100'
          }`}
          title={isActiveTimer && isTimerRunning ? 'Pausar foco (Espaço)' : 'Iniciar foco'}
          aria-label="Iniciar cronômetro"
        >
          {isActiveTimer && isTimerRunning ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* 24px Custom Checkbox */}
        <button
          onClick={() => onToggleComplete(task)}
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border-2 ${
            task.completed
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
              : 'border-slate-300 dark:border-slate-600 hover:border-[var(--primary)] bg-[var(--surface)]'
          }`}
          title={task.completed ? 'Concluída' : 'Marcar como concluída (+XP)'}
          aria-label="Concluir tarefa"
        >
          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3] check-icon-animated" />}
        </button>

        {/* Context Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Opções"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-[var(--surface)] border border-[var(--borda)] shadow-xl p-1.5 z-30 animate-modal">
              <button
                onClick={() => { onToggleTop3(task); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                <Star className={`w-3.5 h-3.5 ${task.isTop3 ? 'fill-amber-500 text-amber-500' : ''}`} />
                {task.isTop3 ? 'Remover do Top 3' : 'Definir como Top 3'}
              </button>

              <button
                onClick={() => { onTogglePin(task); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                <Pin className={`w-3.5 h-3.5 ${task.pinned ? 'fill-blue-500 text-blue-500' : ''}`} />
                {task.pinned ? 'Desafixar' : 'Fixar no topo'}
              </button>

              <button
                onClick={() => { onEdit(task); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>

              <div className="h-px bg-[var(--borda)] my-1" />

              <button
                onClick={() => { onDelete(task.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
