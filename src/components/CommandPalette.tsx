import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Calendar, 
  Play, 
  Download, 
  CheckCircle, 
  Sparkles, 
  ArrowRight, 
  Tag, 
  Maximize2, 
  Layers 
} from 'lucide-react';
import { Task, Category } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  categories: Category[];
  onSelectTab: (tab: string) => void;
  onStartTimer: (task: Task) => void;
  onExportJSON: () => void;
  onExportICS: () => void;
  onOpenFocusMode: () => void;
  onPlanWeek: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tasks,
  categories,
  onSelectTab,
  onStartTimer,
  onExportJSON,
  onExportICS,
  onOpenFocusMode,
  onPlanWeek,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // General navigation commands
  const defaultCommands = [
    {
      id: 'cmd-hoje',
      title: 'Ir para Visão de Hoje',
      subtitle: 'Dashboard diário e metas',
      icon: Calendar,
      action: () => { onSelectTab('hoje'); onClose(); },
    },
    {
      id: 'cmd-semana',
      title: 'Ir para Visão Semanal',
      subtitle: 'Agenda e colunas de Seg a Dom',
      icon: Calendar,
      action: () => { onSelectTab('semana'); onClose(); },
    },
    {
      id: 'cmd-foco',
      title: 'Entrar em Modo Foco Imersivo (F)',
      subtitle: 'Tela cheia com sons ambiente e timer gigante',
      icon: Maximize2,
      action: () => { onOpenFocusMode(); onClose(); },
    },
    {
      id: 'cmd-plan-week',
      title: 'Planejar Minha Semana com IA',
      subtitle: 'Distribuir tarefas equilibradas nos dias',
      icon: Sparkles,
      action: () => { onPlanWeek(); onClose(); },
    },
    {
      id: 'cmd-ics',
      title: 'Exportar Agenda para .ICS',
      subtitle: 'Sincronizar com Google Calendar / Apple Calendar',
      icon: Download,
      action: () => { onExportICS(); onClose(); },
    },
    {
      id: 'cmd-backup',
      title: 'Fazer Backup Completo (JSON)',
      subtitle: 'Salvar todos os dados em arquivo local',
      icon: Download,
      action: () => { onExportJSON(); onClose(); },
    },
  ];

  // Filter tasks based on query
  const filteredTasks = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return tasks
      .filter(t => !t.deletedAt && (
        t.title.toLowerCase().includes(q) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q))) ||
        (catMap.get(t.categoryId)?.name.toLowerCase().includes(q))
      ))
      .slice(0, 8);
  }, [query, tasks, catMap]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return defaultCommands;
    const q = query.toLowerCase();
    return defaultCommands.filter(c => 
      c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
    );
  }, [query, defaultCommands]);

  const allItems = useMemo(() => {
    const list: Array<{ type: 'task' | 'cmd'; item: any }> = [];
    filteredTasks.forEach(t => list.push({ type: 'task', item: t }));
    filteredCommands.forEach(c => list.push({ type: 'cmd', item: c }));
    return list;
  }, [filteredTasks, filteredCommands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (allItems.length || 1)) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        const selected = allItems[selectedIndex];
        if (selected.type === 'task') {
          onStartTimer(selected.item);
          onClose();
        } else {
          selected.item.action();
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-2xl rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-modal"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[var(--borda)] flex items-center gap-3">
          <Search className="w-5 h-5 text-[var(--primary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="O que você deseja fazer ou buscar? (Digite para pesquisar)..."
            className="flex-1 bg-transparent text-base font-semibold text-[var(--texto)] placeholder:text-[var(--texto-muted)] focus:outline-none"
          />
          <kbd className="px-2 py-1 rounded-lg bg-[var(--surface-secondary)] text-[var(--texto-suave)] text-xs font-mono font-bold border border-[var(--borda)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-1.5 flex-1">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-[var(--texto-suave)]">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-[var(--primary)]" />
              <p className="text-sm font-semibold">Nenhum comando ou tarefa encontrada.</p>
              <p className="text-xs text-[var(--texto-muted)] mt-1">Tente pesquisar por palavras-chave, matérias ou tags.</p>
            </div>
          ) : (
            allItems.map((entry, idx) => {
              const isSelected = idx === selectedIndex;

              if (entry.type === 'task') {
                const task = entry.item as Task;
                const cat = catMap.get(task.categoryId) || categories[0];
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      onStartTimer(task);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]'
                        : 'hover:bg-[var(--surface-secondary)] text-[var(--texto)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={cat} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                            {cat.name}
                          </span>
                          {task.completed && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                              Concluída
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold truncate text-[var(--texto)]">
                          {task.title}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Focar</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // Command item
              const cmd = entry.item;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--primary)]'
                      : 'hover:bg-[var(--surface-secondary)] text-[var(--texto)]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)]'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--texto)] leading-tight">{cmd.title}</h4>
                      <p className="text-xs text-[var(--texto-suave)]">{cmd.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--texto-muted)]" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="p-3 bg-[var(--surface-secondary)] border-t border-[var(--borda)] flex items-center justify-between text-xs text-[var(--texto-suave)]">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono font-bold">↑↓</kbd> Navegar</span>
            <span><kbd className="font-mono font-bold">ENTER</kbd> Executar</span>
          </div>
          <span>Paleta de Ações Inteligentes</span>
        </div>
      </div>
    </div>
  );
};
