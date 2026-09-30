import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Sparkles, CornerDownLeft, Calendar, Clock, Tag, Flame, Repeat } from 'lucide-react';
import { parseQuickTask, QuickTaskParseResult, ParsedQuickChip } from '../utils/quickTaskParser';
import { Category, Task, Priority } from '../types';
import { getTodayISO } from '../utils/dateUtils';

interface QuickTaskBottomSheetProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSaveTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any>;
}

export const QuickTaskBottomSheet: React.FC<QuickTaskBottomSheetProps> = ({
  isOpen,
  categories,
  onClose,
  onSaveTask,
}) => {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<QuickTaskParseResult>(() => parseQuickTask(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setParsed(parseQuickTask(''));
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  useEffect(() => {
    setParsed(parseQuickTask(text));
  }, [text]);

  const handleCreate = async (keepOpen = false) => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Determina categoria
      let matchedCategoryId = categories[0]?.id || 'cat-estudo';
      if (parsed.categoryTag) {
        const found = categories.find(c =>
          c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === parsed.categoryTag
        );
        if (found) matchedCategoryId = found.id;
      }

      const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
        title: parsed.title || text.trim(),
        categoryId: matchedCategoryId,
        priority: parsed.priority || 'media',
        date: parsed.date || getTodayISO(),
        time: parsed.time,
        estimatedMinutes: parsed.estimatedMinutes,
        spentSeconds: 0,
        completed: false,
        isTop3: parsed.isTop3,
        tags: parsed.categoryTag ? [parsed.categoryTag] : [],
        subtasks: [],
        recurrenceRule: parsed.recurrence,
        isHabit: !!parsed.recurrence?.vezesPorSemana,
        vezesPorSemana: parsed.recurrence?.vezesPorSemana,
        order: 0,
      };

      await onSaveTask(newTask);

      if (keepOpen) {
        setText('');
        setParsed(parseQuickTask(''));
        inputRef.current?.focus();
      } else {
        onClose();
      }
    } catch (e) {
      console.error('Erro ao salvar captura rápida:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate(false);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          {/* Backdrop escurecido */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Sheet container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--borda)] rounded-t-3xl md:rounded-2xl shadow-2xl p-5 z-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            {/* Alça de arraste no mobile */}
            <div className="w-12 h-1.5 rounded-full bg-[var(--borda)] mx-auto mb-4 md:hidden" />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--texto)]">
                <Sparkles className="w-4 h-4 text-[var(--primary)]" />
                <span>Captura Rápida</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Input com foco imediato */}
            <div className="relative mb-3">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: revisar penal amanhã 19h #concurso !alta ~1h"
                className="w-full bg-[var(--surface-secondary)] text-[var(--texto)] text-base font-medium px-4 py-3.5 rounded-xl border border-[var(--borda)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--texto-suave)]/70 transition-all"
              />
            </div>

            {/* Chips em tempo real do que foi entendido */}
            {parsed.chips.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--texto-suave)] mb-1.5">
                  Entendi:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.chips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 animate-fade-in"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dica de sintaxe discreta */}
            {parsed.chips.length === 0 && (
              <p className="text-xs text-[var(--texto-suave)] mb-4">
                💡 Dica: digite <code className="text-[var(--primary)]">amanhã</code>, <code className="text-[var(--primary)]">19h</code>, <code className="text-[var(--primary)]">~45min</code>, <code className="text-[var(--primary)]">!alta</code>, <code className="text-[var(--primary)]">#matéria</code> ou <code className="text-[var(--primary)]">!top</code>.
              </p>
            )}

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--borda)]">
              <button
                type="button"
                onClick={() => handleCreate(true)}
                disabled={!text.trim() || isSubmitting}
                className="px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--texto)] bg-[var(--surface-secondary)] border border-[var(--borda)] hover:border-[var(--primary)]/40 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Criar e outra
              </button>
              <button
                type="button"
                onClick={() => handleCreate(false)}
                disabled={!text.trim() || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-md disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              >
                <span>Criar</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
