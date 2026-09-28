import React from 'react';
import { Sparkles, Play, ArrowRight, X, Clock, Star, Target } from 'lucide-react';
import { Task, Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { formatMinutesHuman } from '../utils/dateUtils';

interface WhatToDoModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: { task: Task | null; reason: string };
  category?: Category;
  onStartFocus: (task: Task) => void;
}

export const WhatToDoModal: React.FC<WhatToDoModalProps> = ({
  isOpen,
  onClose,
  recommendation,
  category,
  onStartFocus,
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

  if (!isOpen) return null;

  const { task, reason } = recommendation;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-lg rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl p-6 sm:p-7 text-[var(--texto)] animate-modal relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-[var(--borda)]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-blue-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--texto)]">
                O que faço agora?
              </h2>
              <p className="text-xs text-[var(--texto-suave)] font-medium">
                Recomendação inteligente para manter seu ritmo
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

        {task ? (
          <div className="mt-5 space-y-4">
            {/* Reason Pill */}
            <div className="p-3 rounded-2xl bg-[var(--primary-soft)] border border-blue-500/20 flex items-start gap-2.5">
              <Target className="w-4 h-4 text-[var(--primary)] mt-0.5 shrink-0" />
              <p className="text-xs font-semibold text-[var(--primary)] leading-relaxed">
                {reason}
              </p>
            </div>

            {/* Task Highlight Card */}
            <div className="p-5 rounded-[22px] bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-start gap-4">
              {category && <CategoryIcon category={category} size="md" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--primary)]">
                    {category?.name || 'Estudo'}
                  </span>
                  {task.isTop3 && (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-600 border border-amber-500/20">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      TOP 3
                    </span>
                  )}
                </div>

                <h3 className="text-base font-extrabold text-[var(--texto)] leading-snug">
                  {task.title}
                </h3>

                {task.description && (
                  <p className="text-xs text-[var(--texto-suave)] mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs text-[var(--texto-suave)]">
                  {task.estimatedMinutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span className="font-bold text-[var(--texto)]">
                        {formatMinutesHuman(task.estimatedMinutes)}
                      </span>
                    </div>
                  )}
                  <span className="px-2 py-0.5 rounded uppercase font-bold text-[10px] bg-white/40 dark:bg-black/20 border border-[var(--borda)]">
                    {task.priority}
                  </span>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-[var(--surface-secondary)] text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
              >
                Escolher Outra
              </button>
              <button
                onClick={() => {
                  onStartFocus(task);
                  onClose();
                }}
                className="flex-1 py-3 px-5 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Começar Foco Agora</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm font-bold text-[var(--texto)]">{reason}</p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-2xl bg-[var(--primary)] text-white text-xs font-bold cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
