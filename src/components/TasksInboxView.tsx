import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  Star, 
  Pin, 
  Play, 
  Pause,
  Check, 
  Edit3, 
  Trash2, 
  Tag, 
  Plus,
  ArrowRight,
  CheckCircle2,
  Circle,
  LayoutList,
  Kanban,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
  MoveRight,
  Flame,
  Dumbbell,
  BookOpen
} from 'lucide-react';
import { Task, Category, Priority } from '../types';
import { formatSecondsToDigital, formatMinutesHuman, getTodayISO, addDaysToDate, getDayOfWeekLabel } from '../utils/dateUtils';
import { occursOn } from '../services/recurrence';
import { CategoryIcon } from './CategoryIcon';
import { GifIcon } from './GifIcon';

interface TasksInboxViewProps {
  tasks: Task[];
  categories: Category[];
  activeTaskId: string | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  onToggleTimer: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTop3: (task: Task) => void;
  onTogglePin: (task: Task) => void;
  onMoveTaskDate: (taskId: string, newDate: string) => void;
  onQuickAddTask: (initialDate?: string, categoryId?: string) => void;
  onSelectTaskToDrawer?: (task: Task) => void;
  onBatchUpdateTasks?: (taskIds: string[], updates: Partial<Task>) => void;
  onBatchDeleteTasks?: (taskIds: string[]) => void;
}

export const TasksInboxView: React.FC<TasksInboxViewProps> = ({
  tasks,
  categories,
  activeTaskId,
  activeTimerRunning,
  activeTimerElapsed,
  onToggleTimer,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onToggleTop3,
  onTogglePin,
  onMoveTaskDate,
  onQuickAddTask,
  onSelectTaskToDrawer,
  onBatchUpdateTasks,
  onBatchDeleteTasks,
}) => {
  // Views: Asana List | Kanban Board | Calendar View
  const [currentView, setCurrentView] = useState<'lista' | 'quadro' | 'calendario'>('lista');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'nodate' | 'today' | 'tomorrow' | 'top3' | 'completed'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'data' | 'materia' | 'prioridade' | 'nenhum'>('data');
  const [sortBy, setSortBy] = useState<'data' | 'prioridade' | 'duracao' | 'alfabetica'>('data');

  // Collapsible section state for Asana list
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    concluidas: true, // Default collapsed
  });

  // Multi-selection for batch actions
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [inlineNewTaskSection, setInlineNewTaskSection] = useState<string | null>(null);
  const [inlineNewTaskTitle, setInlineNewTaskTitle] = useState('');

  const todayISO = getTodayISO();
  const tomorrowISO = addDaysToDate(todayISO, 1);
  const nextWeekISO = addDaysToDate(todayISO, 7);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (!t.deletedAt && t.tags) {
        t.tags.forEach(tag => set.add(tag));
      }
    });
    return Array.from(set);
  }, [tasks]);

  // Toggle section collapse
  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Multi-selection handlers
  const handleToggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = (allIds: string[]) => {
    if (selectedTaskIds.length === allIds.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(allIds);
    }
  };

  // Batch actions
  const handleBatchMoveDate = (newDate: string) => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(selectedTaskIds, { date: newDate });
    } else {
      selectedTaskIds.forEach(id => onMoveTaskDate(id, newDate));
    }
    setSelectedTaskIds([]);
  };

  const handleBatchChangeCategory = (categoryId: string) => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(selectedTaskIds, { categoryId });
    }
    setSelectedTaskIds([]);
  };

  const handleBatchChangePriority = (priority: Priority) => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(selectedTaskIds, { priority });
    }
    setSelectedTaskIds([]);
  };

  const handleBatchComplete = () => {
    if (selectedTaskIds.length === 0) return;
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(selectedTaskIds, { completed: true, completedAt: new Date().toISOString() });
    }
    setSelectedTaskIds([]);
  };

  const handleBatchDelete = () => {
    if (selectedTaskIds.length === 0) return;
    if (window.confirm(`Tem certeza que deseja excluir ${selectedTaskIds.length} tarefas selecionadas?`)) {
      if (onBatchDeleteTasks) {
        onBatchDeleteTasks(selectedTaskIds);
      } else {
        selectedTaskIds.forEach(id => onDeleteTask(id));
      }
      setSelectedTaskIds([]);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.deletedAt) return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        const matchesTags = task.tags?.some(t => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      // Quick status filters
      if (statusFilter === 'nodate' && task.date) return false;
      if (statusFilter === 'today' && !occursOn(task, todayISO)) return false;
      if (statusFilter === 'tomorrow' && !occursOn(task, tomorrowISO)) return false;
      if (statusFilter === 'top3' && !task.isTop3) return false;
      if (statusFilter === 'completed' && !task.completed) return false;

      // Category filter
      if (selectedCategory !== 'all' && task.categoryId !== selectedCategory) return false;

      // Tag filter
      if (selectedTag !== 'all' && !task.tags?.includes(selectedTag)) return false;

      return true;
    }).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sortBy === 'prioridade') {
        const pOrder: Record<Priority, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
        return pOrder[a.priority] - pOrder[b.priority];
      }
      if (sortBy === 'duracao') {
        return (b.estimatedMinutes || 0) - (a.estimatedMinutes || 0);
      }
      if (sortBy === 'alfabetica') {
        return a.title.localeCompare(b.title);
      }
      return (a.date || '').localeCompare(b.date || '');
    });
  }, [tasks, searchQuery, statusFilter, selectedCategory, selectedTag, sortBy, todayISO, tomorrowISO]);

  // Grouped tasks for Asana list view
  const groupedSections = useMemo(() => {
    if (groupBy === 'materia') {
      const groups: Record<string, { title: string; tasks: Task[]; icon?: string; color?: string; categoryId?: string }> = {};
      categories.forEach(cat => {
        groups[cat.id] = { title: cat.name, tasks: [], color: cat.color, categoryId: cat.id };
      });
      groups['outras'] = { title: 'Sem Matéria', tasks: [] };

      filteredTasks.forEach(t => {
        if (groups[t.categoryId]) {
          groups[t.categoryId].tasks.push(t);
        } else {
          groups['outras'].tasks.push(t);
        }
      });
      return groups;
    }

    if (groupBy === 'prioridade') {
      return {
        alta: { title: 'Alta Prioridade', tasks: filteredTasks.filter(t => t.priority === 'alta') },
        media: { title: 'Média Prioridade', tasks: filteredTasks.filter(t => t.priority === 'media') },
        baixa: { title: 'Baixa Prioridade', tasks: filteredTasks.filter(t => t.priority === 'baixa') },
      };
    }

    // Default: Group by Date (Asana Classic)
    const hoje: Task[] = [];
    const amanha: Task[] = [];
    const estaSemana: Task[] = [];
    const depois: Task[] = [];
    const concluidas: Task[] = [];

    filteredTasks.forEach(t => {
      if (t.completed) {
        concluidas.push(t);
      } else if (!t.date) {
        depois.push(t);
      } else if (t.date === todayISO) {
        hoje.push(t);
      } else if (t.date === tomorrowISO) {
        amanha.push(t);
      } else if (t.date > tomorrowISO && t.date <= nextWeekISO) {
        estaSemana.push(t);
      } else {
        depois.push(t);
      }
    });

    return {
      hoje: { title: 'Hoje', tasks: hoje, dateParam: todayISO },
      amanha: { title: 'Amanhã', tasks: amanha, dateParam: tomorrowISO },
      estaSemana: { title: 'Esta Semana', tasks: estaSemana, dateParam: addDaysToDate(todayISO, 2) },
      depois: { title: 'Depois & Sem Data', tasks: depois, dateParam: undefined },
      concluidas: { title: 'Concluídas', tasks: concluidas, isCompletedSection: true },
    };
  }, [filteredTasks, groupBy, categories, todayISO, tomorrowISO, nextWeekISO]);

  // Inline quick task submit
  const handleInlineTaskSubmit = (sectionKey: string, dateParam?: string, categoryIdParam?: string) => {
    if (!inlineNewTaskTitle.trim()) return;
    onEditTask({
      id: undefined as any,
      title: inlineNewTaskTitle.trim(),
      categoryId: categoryIdParam || (categories[0]?.id || 'cat-estudo'),
      priority: 'media',
      date: dateParam || todayISO,
      estimatedMinutes: 45,
      spentSeconds: 0,
      completed: false,
      tags: [],
      subtasks: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setInlineNewTaskTitle('');
    setInlineNewTaskSection(null);
  };

  // Kanban drag and drop
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleKanbanDrop = (e: React.DragEvent, statusColumn: 'todo' | 'doing' | 'done') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (statusColumn === 'done') {
      onToggleComplete(task);
    } else if (statusColumn === 'doing') {
      onToggleTimer(task);
    } else {
      if (task.completed) onToggleComplete(task);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      
      {/* Top Controls: Views & Search Bar */}
      <div data-gif-host className="card-hover p-4 sm:p-5 rounded-[24px] bg-[var(--surface)] shadow-[var(--shadow-card)] space-y-4">
        
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GifIcon name="tarefas" className="w-11 h-11 shrink-0" eager />
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[var(--texto)]">Tarefas & Fluxo</h2>
              <p className="text-xs text-[var(--texto-suave)]">
                {filteredTasks.length} {filteredTasks.length === 1 ? 'tarefa' : 'tarefas'} no painel
              </p>
            </div>
          </div>

          {/* View Switcher: Lista | Quadro | Calendário */}
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentView('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentView === 'lista'
                    ? 'bg-[var(--surface)] text-[var(--primary-text-on-soft)] shadow-xs font-bold'
                    : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('quadro')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentView === 'quadro'
                    ? 'bg-[var(--surface)] text-[var(--primary-text-on-soft)] shadow-xs font-bold'
                    : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Quadro</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('calendario')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  currentView === 'calendario'
                    ? 'bg-[var(--surface)] text-[var(--primary-text-on-soft)] shadow-xs font-bold'
                    : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendário</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onQuickAddTask()}
              className="h-9 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <GifIcon name="nova-tarefa" className="w-5 h-5" />
              <span className="hidden sm:inline">Nova Tarefa</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-1">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-[var(--texto-suave)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, resumo ou #tag..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] placeholder:text-[var(--texto-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
            />
          </div>

          {/* Group By */}
          <div>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="data">Agrupar: Por Data</option>
              <option value="materia">Agrupar: Por Matéria</option>
              <option value="prioridade">Agrupar: Por Prioridade</option>
              <option value="nenhum">Sem Agrupamento</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              <option value="data">Ordenar: Por Data</option>
              <option value="prioridade">Ordenar: Por Prioridade</option>
              <option value="duracao">Ordenar: Por Duração</option>
              <option value="alfabetica">Ordenar: Alfabética</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'today', label: 'Hoje' },
            { id: 'tomorrow', label: 'Amanhã' },
            { id: 'top3', label: '⭐ Top 3' },
            { id: 'nodate', label: 'Sem Data' },
            { id: 'completed', label: 'Concluídas' },
          ].map(chip => (
            <button
              type="button"
              key={chip.id}
              onClick={() => setStatusFilter(chip.id as any)}
              className={`h-8 sm:h-8.5 px-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                statusFilter === chip.id
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)] ring-1 ring-[var(--primary)] font-bold shadow-2xs'
                  : 'border-[var(--borda)] bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. ASANA LIST VIEW                                      */}
      {/* ======================================================== */}
      {currentView === 'lista' && (
        <div className="space-y-5">
          {Object.entries(groupedSections).map(([sectionKey, section]) => {
            const isCollapsed = Boolean(collapsedSections[sectionKey]);
            const taskList = section.tasks || [];

            if (taskList.length === 0 && section.isCompletedSection) return null;

            return (
              <div 
                key={sectionKey} 
                className="card-hover rounded-[20px] bg-[var(--surface)] border border-[var(--borda)] shadow-xs overflow-hidden"
              >
                {/* Section Header */}
                <div 
                  onClick={() => toggleSectionCollapse(sectionKey)}
                  className="px-4 py-3 bg-[var(--surface-secondary)]/60 border-b border-[var(--borda)] flex items-center justify-between cursor-pointer hover:bg-[var(--surface-secondary)] transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-[var(--texto-suave)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--texto-suave)]" />
                    )}
                    <span className="text-xs font-bold text-[var(--texto)] tracking-wide">
                      {section.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--surface)] text-[var(--texto-suave)] border border-[var(--borda)] tabular-nums">
                      {taskList.length}
                    </span>
                  </div>

                  {!section.isCompletedSection && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineNewTaskSection(sectionKey);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  )}
                </div>

                {/* Section Content */}
                {!isCollapsed && (
                  <div>
                    {taskList.length === 0 && inlineNewTaskSection !== sectionKey ? (
                      <div className="p-4 text-center text-xs text-[var(--texto-muted)]">
                        Nenhuma tarefa nesta seção.
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--borda)]">
                        {taskList.map((task: Task) => {
                          const category = catMap.get(task.categoryId) || categories[0];
                          const isTimerActive = activeTaskId === task.id;
                          const isSelected = selectedTaskIds.includes(task.id);

                          return (
                            <div
                              key={task.id}
                              data-gif-host
                              onClick={() => onSelectTaskToDrawer?.(task)}
                              className={`px-4 sm:px-5 py-3.5 sm:py-4 flex items-center justify-between gap-3 sm:gap-4 hover:bg-[var(--surface-secondary)]/50 transition-colors cursor-pointer group ${
                                isSelected ? 'bg-[var(--primary-soft)]/50' : ''
                              }`}
                            >
                              {/* Left: Checkbox + Title + Category Tile */}
                              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                                {/* Batch Checkbox */}
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleToggleSelectTask(task.id, e as any)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4.5 h-4.5 rounded border-[var(--borda)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer shrink-0"
                                />

                                {/* Complete Checkbox */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleComplete(task);
                                  }}
                                  aria-label="Marcar concluída"
                                  className="text-[var(--texto-muted)] hover:text-emerald-500 cursor-pointer shrink-0"
                                >
                                  {task.completed ? (
                                    <CheckCircle2 className="w-5.5 h-5.5 sm:w-6 sm:h-6 text-emerald-500" />
                                  ) : (
                                    <Circle className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
                                  )}
                                </button>

                                {/* Category Icon Tile */}
                                <CategoryIcon category={category} size="md" className="!w-7 !h-7 sm:!w-8 sm:!h-8 !rounded-xl shrink-0" />

                                {/* Task Title */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm sm:text-base font-semibold truncate ${
                                      task.completed ? 'line-through text-[var(--texto-muted)]' : 'text-[var(--texto)]'
                                    }`}>
                                      {task.title}
                                    </span>
                                    {task.isTop3 && (
                                      <Star className="w-4 h-4 text-amber-500 fill-current shrink-0" />
                                    )}
                                    {task.pinned && (
                                      <Pin className="w-4 h-4 text-[var(--primary)] fill-current shrink-0" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Meta chips (Date, Priority, Time, Play Focus) */}
                              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                                {/* Date Badge */}
                                {task.date && (
                                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--texto-suave)] tabular-nums px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)]">
                                    <Calendar className="w-3.5 h-3.5 text-[var(--texto-muted)]" />
                                    {task.date === todayISO ? 'Hoje' : task.date === tomorrowISO ? 'Amanhã' : task.date.slice(5)}
                                  </span>
                                )}

                                {/* Priority Pill */}
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg capitalize ${
                                  task.priority === 'urgente'
                                    ? 'bg-red-500/10 text-red-700 border border-red-500/30 font-extrabold'
                                    : task.priority === 'alta'
                                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                    : task.priority === 'media'
                                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                }`}>
                                  {task.priority === 'media' ? 'Média' : task.priority}
                                </span>

                                {/* Duration */}
                                <span className="text-xs font-bold text-[var(--texto-muted)] tabular-nums hidden md:inline px-2 py-1 rounded-lg bg-[var(--surface-secondary)]">
                                  {task.estimatedMinutes || 45}m
                                </span>

                                {/* Focus Timer Play */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleTimer(task);
                                  }}
                                  title="Iniciar cronômetro de foco"
                                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                                    isTimerActive && activeTimerRunning
                                      ? 'bg-rose-500 text-white animate-pulse shadow-sm'
                                      : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:bg-[var(--primary)] hover:text-white'
                                  }`}
                                >
                                  {isTimerActive && activeTimerRunning ? (
                                    <Pause className="w-4 h-4 fill-current" />
                                  ) : (
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Inline Task Creation Row */}
                    {inlineNewTaskSection === sectionKey && (
                      <div className="p-3 bg-[var(--surface-secondary)]/30 border-t border-[var(--borda)] flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={inlineNewTaskTitle}
                          onChange={(e) => setInlineNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInlineTaskSubmit(sectionKey, section.dateParam, section.categoryId);
                            } else if (e.key === 'Escape') {
                              setInlineNewTaskSection(null);
                              setInlineNewTaskTitle('');
                            }
                          }}
                          placeholder="Nome da nova tarefa (pressione Enter para salvar)..."
                          className="flex-1 h-9 px-3 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleInlineTaskSubmit(sectionKey, section.dateParam, section.categoryId)}
                          className="h-9 px-3 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineNewTaskSection(null);
                            setInlineNewTaskTitle('');
                          }}
                          className="h-9 px-2.5 rounded-xl text-xs text-[var(--texto-suave)] hover:text-[var(--texto)] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. KANBAN BOARD VIEW                                     */}
      {/* ======================================================== */}
      {currentView === 'quadro' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column 1: A Fazer */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleKanbanDrop(e, 'todo')}
            className="card-hover p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--borda)] shadow-xs flex flex-col min-h-[450px]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--borda)] mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-xs font-bold text-[var(--texto)]">A Fazer</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-secondary)] text-[var(--texto-suave)] tabular-nums">
                  {filteredTasks.filter(t => !t.completed && activeTaskId !== t.id).length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onQuickAddTask(todayISO)}
                className="text-[var(--primary)] hover:underline text-xs font-semibold"
              >
                + Tarefa
              </button>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {filteredTasks
                .filter(t => !t.completed && activeTaskId !== t.id)
                .map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onClick={() => onSelectTaskToDrawer?.(task)}
                    className="card-hover p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] hover:border-[var(--primary)] transition-all cursor-grab active:cursor-grabbing space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-[var(--texto)] leading-snug">{task.title}</span>
                      {task.isTop3 && <Star className="w-4 h-4 text-amber-500 fill-current shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--texto-suave)]">
                      <span className="tabular-nums font-semibold">{task.estimatedMinutes || 45}m</span>
                      <span className="capitalize text-[11px] px-2 py-0.5 rounded-md bg-[var(--surface)] font-bold">{task.priority}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Column 2: Em Foco / Fazendo */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleKanbanDrop(e, 'doing')}
            className="card-hover p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--primary)]/30 shadow-xs flex flex-col min-h-[450px]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--borda)] mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] animate-ping" />
                <h3 className="text-xs font-bold text-[var(--texto)]">Em Foco Agora</h3>
              </div>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {activeTaskId ? (
                (() => {
                  const task = tasks.find(t => t.id === activeTaskId);
                  if (!task) return null;
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTaskToDrawer?.(task)}
                      className="p-4 rounded-xl bg-[var(--primary-soft)] border border-[var(--primary)] shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-[var(--texto)]">{task.title}</span>
                        <Play className="w-4 h-4 text-[var(--primary-text-on-soft)] fill-current" />
                      </div>
                      <div className="text-sm font-extrabold text-[var(--primary-text-on-soft)] tabular-nums">
                        {formatSecondsToDigital(activeTimerElapsed)} decorridos
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task);
                        }}
                        className="w-full py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-bold cursor-pointer hover:bg-[var(--primary-hover)]"
                      >
                        Concluir Foco
                      </button>
                    </div>
                  );
                })()
              ) : (
                <div className="p-8 text-center text-xs text-[var(--texto-muted)]">
                  Arraste uma tarefa aqui ou clique em "Focar" para iniciar a sessão.
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Concluídas */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleKanbanDrop(e, 'done')}
            className="card-hover p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--borda)] shadow-xs flex flex-col min-h-[450px]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--borda)] mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold text-[var(--texto)]">Concluídas</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-secondary)] text-[var(--texto-suave)] tabular-nums">
                  {filteredTasks.filter(t => t.completed).length}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto">
              {filteredTasks
                .filter(t => t.completed)
                .map(task => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTaskToDrawer?.(task)}
                    className="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-secondary)]/60 border border-[var(--borda)] space-y-2 opacity-75 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="text-sm font-medium text-[var(--texto-muted)] line-through truncate">{task.title}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CALENDAR OVERVIEW VIEW                                */}
      {/* ======================================================== */}
      {currentView === 'calendario' && (
        <div className="card-hover p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-xs text-center space-y-3">
          <CalendarDays className="w-8 h-8 text-[var(--primary)] mx-auto" />
          <h3 className="text-sm font-bold text-[var(--texto)]">Visão Semanal Integrada</h3>
          <p className="text-xs text-[var(--texto-suave)] max-w-md mx-auto">
            Acompanhe suas tarefas distribuídas no tempo. Para planejar os blocos detalhados por hora, use a aba <strong>Semana</strong>.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* FLOATING BATCH ACTIONS BAR (Ações em Massa)              */}
      {/* ======================================================== */}
      {selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--sidebar)] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp border border-white/10 flex-wrap justify-center">
          <span className="text-xs font-bold tabular-nums">
            {selectedTaskIds.length} {selectedTaskIds.length === 1 ? 'selecionada' : 'selecionadas'}
          </span>

          <div className="h-4 w-[1px] bg-white/20" />

          {/* Move Date buttons */}
          <button
            type="button"
            onClick={() => handleBatchMoveDate(todayISO)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={() => handleBatchMoveDate(tomorrowISO)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            Amanhã
          </button>

          {/* Change Priority */}
          <button
            type="button"
            onClick={() => handleBatchChangePriority('alta')}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
          >
            ! Alta
          </button>

          {/* Complete */}
          <button
            type="button"
            onClick={handleBatchComplete}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1"
          >
            <Check className="w-3.5 h-3.5" /> Concluir
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleBatchDelete}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors cursor-pointer"
          >
            Excluir
          </button>

          {/* Desmarcar */}
          <button
            type="button"
            onClick={() => setSelectedTaskIds([])}
            className="text-xs text-white/60 hover:text-white ml-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
};
