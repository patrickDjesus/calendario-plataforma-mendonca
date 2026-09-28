import React, { useState, useMemo } from 'react';
import { Send } from 'lucide-react';
import { Category, Task } from '../types';
import { parseNaturalLanguageTask } from '../utils/nlpParser';
import { getTodayISO } from '../utils/dateUtils';
import { GifIcon } from './GifIcon';

interface SmartInputBarProps {
  categories: Category[];
  onAddTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'spentSeconds' | 'completed'>) => void;
  selectedDate?: string;
}

export const SmartInputBar: React.FC<SmartInputBarProps> = ({
  categories,
  onAddTask,
  selectedDate = getTodayISO(),
}) => {
  const [inputVal, setInputVal] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const parsed = useMemo(() => {
    if (!inputVal.trim()) return null;
    return parseNaturalLanguageTask(inputVal, categories, selectedDate);
  }, [inputVal, categories, selectedDate]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;

    const result = parseNaturalLanguageTask(inputVal, categories, selectedDate);

    onAddTask({
      title: result.title,
      categoryId: result.categoryId || (categories[0] ? categories[0].id : 'cat-estudo'),
      priority: result.priority,
      date: result.date,
      time: result.time,
      estimatedMinutes: result.estimatedMinutes,
      tags: result.tags,
      recurringDays: result.recurringDays,
      subtasks: [],
      order: 0,
    });

    setInputVal('');
  };

  const handleAppendToken = (token: string) => {
    setInputVal(prev => (prev.trim() ? `${prev.trim()} ${token}` : token));
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div data-gif-host className="flex items-center gap-2.5 h-[52px] px-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)] transition-all">
          <GifIcon name="nova-tarefa" className="w-7 h-7 shrink-0" />

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Adicionar tarefa… (ex.: Estudar biologia amanhã 45min #estudo)"
            className="flex-1 bg-transparent text-sm font-semibold text-[var(--texto)] placeholder:text-[var(--texto-muted)] focus:outline-none"
            aria-label="Adicionar tarefa rápida"
          />

          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="w-8 h-8 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-30 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm shrink-0"
            title="Adicionar tarefa (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Token Understanding Preview */}
        {parsed && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs animate-fadeIn">
            <span className="text-[var(--texto-suave)] font-bold mr-1">Entendido:</span>
            <span className="px-2 py-0.5 rounded-lg bg-[var(--surface)] text-[var(--texto)] font-bold border border-[var(--borda)]">
              "{parsed.title}"
            </span>
            {parsed.rawMatches.dateLabel && (
              <span className="px-2 py-0.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold">
                📅 {parsed.rawMatches.dateLabel}
              </span>
            )}
            {parsed.rawMatches.durationLabel && (
              <span className="px-2 py-0.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold">
                ⏱️ {parsed.rawMatches.durationLabel}
              </span>
            )}
            {parsed.categoryName && (
              <span className="px-2 py-0.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)] font-bold">
                #{parsed.categoryName}
              </span>
            )}
          </div>
        )}

        {/* Quick Helper Token Buttons (Visible only on focus) */}
        {isFocused && !parsed && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-[var(--texto-suave)] animate-fadeIn">
            <span className="text-xs mr-1 font-bold">Atalhos:</span>
            <button
              type="button"
              onClick={() => handleAppendToken('amanhã')}
              className="px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--borda)] text-[var(--texto)] font-semibold transition-colors cursor-pointer"
            >
              + amanhã
            </button>
            <button
              type="button"
              onClick={() => handleAppendToken('45min')}
              className="px-2 py-0.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--borda)] text-[var(--texto)] font-semibold transition-colors cursor-pointer"
            >
              + 45min
            </button>
            <button
              type="button"
              onClick={() => handleAppendToken('!alta')}
              className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 font-bold transition-colors cursor-pointer"
            >
              + !alta
            </button>
            <button
              type="button"
              onClick={() => handleAppendToken('#estudo')}
              className="px-2 py-0.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold transition-colors cursor-pointer"
            >
              + #estudo
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
