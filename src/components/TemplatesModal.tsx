import React from 'react';
import { X, Plus, Check, GraduationCap, Sun, Flame, Sparkles } from 'lucide-react';
import { DayTemplate, Category } from '../types';
import { formatMinutesHuman } from '../utils/dateUtils';
import { CategoryIcon } from './CategoryIcon';
import { GifIcon } from './GifIcon';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: DayTemplate[];
  categories: Category[];
  onApplyTemplate: (template: DayTemplate) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  categories,
  onApplyTemplate,
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

  const catMap = new Map(categories.map(c => [c.id, c]));

  const getTemplateIcon = (icon: string) => {
    switch (icon) {
      case 'graduation-cap': return <GraduationCap className="w-6 h-6 text-indigo-500" />;
      case 'sun': return <Sun className="w-6 h-6 text-amber-500" />;
      case 'flame': return <Flame className="w-6 h-6 text-rose-500" />;
      default: return <Sparkles className="w-6 h-6 text-[var(--primary)]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div data-gif-host className="w-full max-w-2xl rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl p-6 sm:p-7 text-[var(--texto)] my-8 animate-modal">
        
        <div className="flex items-center justify-between pb-4 border-b border-[var(--borda)]">
          <div className="flex items-center gap-3">
              <GifIcon name="modelos-rotina" className="w-11 h-11 shrink-0" />
            <div>
              <h2 className="text-xl font-extrabold text-[var(--texto)]">
                Modelos de Rotina de Estudo
              </h2>
              <p className="text-xs text-[var(--texto-suave)] font-medium">
                Aplique uma estrutura pronta de tarefas para o seu dia com 1 clique
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

        <div className="mt-5 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-[22px] bg-[var(--surface-secondary)] border border-[var(--borda)] hover:border-[var(--primary)] transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--borda)] flex items-center justify-center shadow-sm">
                    {getTemplateIcon(tpl.icon)}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[var(--texto)]">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-[var(--texto-suave)] mt-0.5">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onApplyTemplate(tpl);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0 hover:scale-105"
                >
                  Aplicar ao Dia
                </button>
              </div>

              {/* Task Items Preview */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--borda)]">
                {tpl.tasks.map((task, idx) => {
                  const cat = catMap.get(task.categoryId) || categories[0];
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-[var(--surface)]/80 text-[var(--texto)]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#3B6CF5' }} />
                        <span className="font-semibold truncate">{task.title}</span>
                      </div>
                      <span className="text-[var(--texto-suave)] shrink-0 font-medium">
                        {formatMinutesHuman(task.estimatedMinutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
