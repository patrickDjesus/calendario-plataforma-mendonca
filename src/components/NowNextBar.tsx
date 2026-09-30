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

  // Calculate task progress and remaining percentage based on estimate
  const estimatedMinutes = currentTask.estimatedMinutes || 45;
  const estimatedSeconds = estimatedMinutes * 60;
  const spentSeconds = currentTask.spentSeconds || 0;
  const remainingSeconds = Math.max(0, estimatedSeconds - spentSeconds);
  const remainingPercent = Math.max(0, Math.min(100, Math.round((remainingSeconds / estimatedSeconds) * 100)));
  const progressPercent = Math.max(0, Math.min(100, Math.round((spentSeconds / estimatedSeconds) * 100)));

  return (
    <div
      data-gif-host
      className={`card-hover w-full rounded-[20px] p-4 sm:p-5 transition-all border ${
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

        {/* Right Area: Controls & Percentage */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 self-end sm:self-center">
          <div className="flex items-center gap-3 shrink-0">
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
                    className="px-3 py-2.5 rounded-xl bg-[var(--primary-soft)] hover:bg-violet-100 text-[var(--primary)] text-xs font-bold transition-all cursor-pointer"
                    title="Abrir Modo Foco Tela Cheia"
                  >
                    Tela Cheia
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => onStartFocus(currentTask)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-md shadow-violet-500/25 transition-all cursor-pointer hover:scale-105"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Iniciar Foco</span>
              </button>
            )}
          </div>

          {/* Elegant Progress Bar */}
          <div className="w-full min-w-[160px] sm:min-w-[210px] mt-2.5 select-none">
            <div className="h-5 w-full bg-[var(--surface-secondary)] border border-[var(--borda)] rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-[var(--primary)] to-cyan-400 rounded-full transition-all duration-500 ease-out flex items-center justify-end"
                style={{ width: `${progressPercent}%` }}
              >
                {progressPercent >= 15 && (
                  <span className="text-[10px] sm:text-[11px] font-black text-white px-2.5 leading-none tabular-nums whitespace-nowrap">
                    {progressPercent}%
                  </span>
                )}
              </div>
              {/* Fallback absolute label if the progress bar is too narrow to hold the percentage text inside the colored filling */}
              {progressPercent < 15 && (
                <span className="absolute inset-y-0 left-2.5 flex items-center text-[10px] sm:text-[11px] font-black text-[var(--texto-suave)] leading-none tabular-nums">
                  {progressPercent}%
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
