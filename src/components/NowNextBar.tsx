import React from 'react';
import { Play, Pause, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { Task, Category } from '../types';
import { formatSecondsToDigital, formatMinutesHuman } from '../utils/dateUtils';
import { CategoryIcon } from './CategoryIcon';

interface NowNextBarProps {
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  recommendedTask: Task | null;
  recommendationReason?: string;
  category?: Category;
  onStartFocus: (task: Task) => void;
  onToggleActiveTimer: () => void;
  onOpenFocusMode?: () => void;
}

export const NowNextBar: React.FC<NowNextBarProps> = ({
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  recommendedTask,
  recommendationReason,
  category,
  onStartFocus,
  onToggleActiveTimer,
  onOpenFocusMode,
}) => {
  const currentTask = activeTask || recommendedTask;
  if (!currentTask) return null;

  const isCurrentActive = !!activeTask;

  return (
    <div className={`w-full rounded-[20px] p-4 sm:p-5 transition-all border ${
      isCurrentActive
        ? 'bg-[var(--surface)] border-[var(--primary)] shadow-[var(--shadow-card)] ring-2 ring-[var(--primary)]/20'
        : 'bg-[var(--surface)] border-[var(--borda)] shadow-[var(--shadow-subtle)]'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Left: Badge + Category + Title */}
        <div className="flex items-center gap-3.5 min-w-0">
          {category && <CategoryIcon category={category} size="md" />}
          
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-normal ${
                isCurrentActive
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)]'
              }`}>
                {isCurrentActive ? 'Em andamento agora' : 'Próximo recomendado'}
              </span>

              {category && (
                <span className="text-xs font-bold" style={{ color: category.color }}>
                  {category.name}
                </span>
              )}

              {currentTask.time && (
                <span className="text-xs font-bold text-[var(--texto-suave)] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {currentTask.time}
                </span>
              )}
            </div>

            <h3 className="text-base font-extrabold text-[var(--texto)] mt-1 truncate">
              {currentTask.title}
            </h3>

            {!isCurrentActive && recommendationReason && (
              <p className="text-xs text-[var(--texto-suave)] font-medium mt-0.5 truncate">
                💡 {recommendationReason}
              </p>
            )}
          </div>
        </div>

        {/* Right: Time + Play/Pause Action Button */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <div className="text-right">
            <div className="text-base font-black text-[var(--texto)] tabular-nums">
              {isCurrentActive
                ? formatSecondsToDigital(activeTimerElapsed)
                : currentTask.estimatedMinutes
                ? formatMinutesHuman(currentTask.estimatedMinutes)
                : '45min'}
            </div>
            <div className="text-xs text-[var(--texto-suave)] font-medium">
              {isCurrentActive ? (activeTimerRunning ? 'Focando...' : 'Pausado') : 'Estimado'}
            </div>
          </div>

          {isCurrentActive ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleActiveTimer}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
              >
                {activeTimerRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Retomar</span>
                  </>
                )}
              </button>

              {onOpenFocusMode && (
                <button
                  onClick={onOpenFocusMode}
                  className="px-3 py-2.5 rounded-xl bg-[var(--primary-soft)] hover:bg-blue-100 text-[var(--primary)] text-xs font-bold transition-all cursor-pointer"
                  title="Abrir Modo Foco Tela Cheia"
                >
                  Tela Cheia
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => onStartFocus(currentTask)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-md shadow-blue-500/25 transition-all cursor-pointer hover:scale-105"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar Foco</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
