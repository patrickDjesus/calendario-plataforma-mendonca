import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Timer,
  Tag, 
  CheckSquare, 
  Repeat, 
  AlertCircle, 
  Star, 
  Pin,
  ChevronDown,
  Check,
  ChevronUp,
  CornerDownLeft
} from 'lucide-react';
import { Task, Category, Priority, Subtask } from '../types';
import { generateUUID } from '../services/repository';
import { getTodayISO } from '../utils/dateUtils';
import { CategoryIcon } from './CategoryIcon';
import { GifIcon } from './GifIcon';
import { categoryGifName } from '../utils/taskCategory';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  taskToEdit?: Task | null;
  categories: Category[];
  initialDate?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  categories,
  initialDate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-estudo');
  const [priority, setPriority] = useState<Priority>('media');
  const [hoveredPriority, setHoveredPriority] = useState<Priority | null>(null);
  const [date, setDate] = useState(initialDate || getTodayISO());
  const [time, setTime] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(45);
  const [isTop3, setIsTop3] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Initialize form state
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      setHasAttemptedSubmit(false);

      if (taskToEdit) {
        setTitle(taskToEdit.title);
        setDescription(taskToEdit.description || '');
        setCategoryId(taskToEdit.categoryId);
        setPriority(taskToEdit.priority || 'media');
        setDate(taskToEdit.date);
        setTime(taskToEdit.time || '');
        setEstimatedMinutes(taskToEdit.estimatedMinutes ?? 45);
        setIsTop3(taskToEdit.isTop3 || false);
        setPinned(taskToEdit.pinned || false);
        setTags(taskToEdit.tags || []);
        setTagInputValue('');
        setSubtasks(taskToEdit.subtasks || []);
        setRecurringDays(taskToEdit.recurringDays || []);

        const hasExtraData = Boolean(
          (taskToEdit.description && taskToEdit.description.trim().length > 0) ||
          (taskToEdit.tags && taskToEdit.tags.length > 0) ||
          (taskToEdit.subtasks && taskToEdit.subtasks.length > 0) ||
          (taskToEdit.recurringDays && taskToEdit.recurringDays.length > 0)
        );
        setIsMoreOptionsOpen(hasExtraData);
      } else {
        setTitle('');
        setDescription('');
        setCategoryId(categories[0]?.id || 'cat-estudo');
        setPriority('media');
        setDate(initialDate || getTodayISO());
        setTime('');
        setEstimatedMinutes(45);
        setIsTop3(false);
        setPinned(false);
        setTags([]);
        setTagInputValue('');
        setSubtasks([]);
        setRecurringDays([]);
        setIsMoreOptionsOpen(false);
      }

      const focusTimer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);

      return () => clearTimeout(focusTimer);
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
    }
  }, [taskToEdit, isOpen, initialDate, categories]);

  // Escape key, Ctrl/Cmd + Enter, and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitForm();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, title, description, categoryId, priority, date, time, estimatedMinutes, isTop3, pinned, tags, subtasks, recurringDays]);

  if (!isOpen) return null;

  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([
      ...subtasks,
      { id: generateUUID(), title: newSubtaskTitle.trim(), completed: false },
    ]);
    setNewSubtaskTitle('');
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleToggleDay = (dayNum: number) => {
    if (recurringDays.includes(dayNum)) {
      setRecurringDays(recurringDays.filter(d => d !== dayNum));
    } else {
      setRecurringDays([...recurringDays, dayNum].sort((a, b) => a - b));
    }
  };

  const handleAddTag = () => {
    const cleaned = tagInputValue.trim().toLowerCase().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
    }
    setTagInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const submitForm = () => {
    setHasAttemptedSubmit(true);
    if (!title.trim()) {
      titleInputRef.current?.focus();
      return;
    }

    onSave({
      id: taskToEdit?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId,
      priority,
      date,
      time: time.trim() || undefined,
      estimatedMinutes: Number(estimatedMinutes) > 0 ? Number(estimatedMinutes) : 45,
      spentSeconds: taskToEdit?.spentSeconds || 0,
      completed: taskToEdit?.completed || false,
      completedAt: taskToEdit?.completedAt,
      isTop3,
      pinned,
      tags,
      subtasks,
      recurringDays: recurringDays.length > 0 ? recurringDays : undefined,
      order: taskToEdit?.order ?? 0,
    });

    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm();
  };

  const dayLabels = [
    { num: 1, label: 'Seg' },
    { num: 2, label: 'Ter' },
    { num: 3, label: 'Qua' },
    { num: 4, label: 'Qui' },
    { num: 5, label: 'Sex' },
    { num: 6, label: 'Sáb' },
    { num: 0, label: 'Dom' },
  ];

  const durationShortcuts = [15, 30, 45, 60, 90];

  const prioritiesList: Array<{ id: Priority; label: string; img: string; activeStyle: string }> = [
    { id: 'baixa', label: 'Baixa', img: '/gifs/baixa-prioridade.jpg', activeStyle: 'bg-emerald-500/10 border-emerald-500/30' },
    { id: 'media', label: 'Média', img: '/gifs/media-prioridade.jpg', activeStyle: 'bg-amber-500/10 border-amber-500/30' },
    { id: 'alta', label: 'Alta', img: '/gifs/alta-prioridade.jpg', activeStyle: 'bg-orange-500/10 border-orange-500/30' },
    { id: 'urgente', label: 'Urgente', img: '/gifs/urgente-prioridade.jpg', activeStyle: 'bg-rose-500/10 border-rose-500/30' },
  ];

  const isTitleInvalid = hasAttemptedSubmit && !title.trim();

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="w-full max-w-[620px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl rounded-t-[24px] sm:rounded-[20px] flex flex-col max-h-[92vh] sm:max-h-[88vh] text-[var(--texto)] animate-modal overflow-hidden focus:outline-none"
      >
        {/* Header (Fixed) */}
        <div className="px-6 pt-5 pb-4 border-b border-[var(--borda)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div>
            <h2 id="task-modal-title" className="text-lg font-bold text-[var(--texto)] tracking-tight">
              {taskToEdit ? 'Editar tarefa' : 'Nova tarefa'}
            </h2>
            <p className="text-xs text-[var(--texto-suave)] mt-0.5">
              Defina seu próximo bloco de trabalho com metas claras e objetivas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
            
            {/* 1. Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="task-title-input" className="text-xs font-semibold text-[var(--texto-suave)]">
                  Título da tarefa <span className="text-rose-500 font-normal" aria-hidden="true">*</span>
                </label>
                {isTitleInvalid && (
                  <span className="text-xs font-medium text-rose-500 flex items-center gap-1 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5" /> Campo obrigatório
                  </span>
                )}
              </div>
              <input
                ref={titleInputRef}
                id="task-title-input"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (hasAttemptedSubmit && e.target.value.trim()) {
                    setHasAttemptedSubmit(false);
                  }
                }}
                placeholder="Ex: Resolver 15 questões de Eletrodinâmica"
                className={`w-full h-12 px-4 rounded-xl bg-[var(--surface-secondary)] border text-sm font-semibold text-[var(--texto)] placeholder:text-[var(--texto-muted)] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all ${
                  isTitleInvalid ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-[var(--borda)]'
                }`}
                aria-required="true"
                aria-invalid={isTitleInvalid}
              />
            </div>

            {/* 2. Category Chips (No truncation) */}
            <div>
              <label className="block text-xs font-semibold text-[var(--texto-suave)] mb-2">
                Categoria
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
                {categories.map((cat) => {
                  const isSelected = categoryId === cat.id;
                  const gifName = categoryGifName(cat);
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      aria-pressed={isSelected}
                      onClick={() => setCategoryId(cat.id)}
                      className={`inline-flex flex-col items-center justify-center gap-2 min-w-[100px] min-h-[104px] px-3 py-4 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--texto)] ring-1 ring-[var(--primary)] shadow-xs font-bold'
                          : 'border-[var(--borda)] bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {gifName ? (
                        <GifIcon name={gifName} className="w-9 h-9 shrink-0" alt="" />
                      ) : (
                        <CategoryIcon category={cat} size="md" className="!w-9 !h-9 !rounded-lg" />
                      )}
                      <span className="whitespace-normal leading-tight text-center">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Priority (imagens em uma row que preenche a largura) */}
            <div>
              <label className="block text-xs font-semibold text-[var(--texto-suave)] mb-1.5">
                Prioridade
              </label>
              <div className="p-1.5 bg-[var(--surface-secondary)] border border-[var(--borda)] rounded-xl grid grid-cols-4 gap-1.5">
                {prioritiesList.map((p) => {
                  const isSelected = priority === p.id;
                  const isHovered = hoveredPriority === p.id;
                  const siblingsDimmed = hoveredPriority !== null && !isHovered;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setPriority(p.id)}
                      onMouseEnter={() => setHoveredPriority(p.id)}
                      onMouseLeave={() => setHoveredPriority(null)}
                      title={p.label}
                      aria-pressed={isSelected}
                      className={`relative h-16 sm:h-20 rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 ${
                        isHovered
                          ? 'border-[var(--primary)] z-10 scale-x-110 shadow-md'
                          : isSelected
                            ? `${p.activeStyle} shadow-sm`
                            : 'border-transparent hover:border-[var(--borda-hover)]'
                      } ${siblingsDimmed ? 'opacity-40 blur-[1.5px]' : 'opacity-100 blur-0'}`}
                    >
                      <img
                        src={p.img}
                        alt={`Prioridade ${p.label}`}
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover transition-all duration-200 ${
                          isSelected && !isHovered ? '' : !isHovered && !isSelected ? 'grayscale-[0.2]' : 'grayscale-0'
                        }`}
                      />
                      {/* Check de seleção */}
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. When, Time and Duration in same responsive grid with shortcuts */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[var(--texto-suave)]">
                  Data, horário e duração
                </label>
                {/* Quick duration shortcuts */}
                <div className="flex items-center gap-1 text-[11px] text-[var(--texto-muted)]">
                  <span>Atalhos:</span>
                  {durationShortcuts.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setEstimatedMinutes(mins)}
                      className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer tabular-nums ${
                        estimatedMinutes === mins
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-bold'
                          : 'border-[var(--borda)] text-[var(--texto-suave)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Date */}
                <div className="relative">
                  <Calendar className="w-4 h-4 text-[var(--texto-suave)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Data da tarefa"
                    className="w-full h-11 pl-9 pr-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                  />
                </div>

                {/* Time */}
                <div className="relative">
                  <Clock className="w-4 h-4 text-[var(--texto-suave)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    aria-label="Horário específico"
                    placeholder="Horário (opcional)"
                    className="w-full h-11 pl-9 pr-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                  />
                </div>

                {/* Estimated Minutes */}
                <div className="relative">
                  <Timer className="w-4 h-4 text-[var(--texto-suave)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(Math.max(5, parseInt(e.target.value || '0', 10)))}
                    aria-label="Minutos estimados"
                    placeholder="Tempo (min)"
                    className="w-full h-11 pl-9 pr-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 5. Accessible Toggles for Top 3 and Fixar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                role="switch"
                aria-checked={isTop3}
                onClick={() => setIsTop3(!isTop3)}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isTop3
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-[var(--borda)] bg-[var(--surface-secondary)] hover:border-[var(--borda-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star className={`w-4 h-4 ${isTop3 ? 'text-amber-500 fill-amber-500' : 'text-[var(--texto-muted)]'}`} />
                  <div>
                    <div className="text-xs font-bold text-[var(--texto)]">Top 3 do dia</div>
                    <div className="text-[11px] text-[var(--texto-suave)]">Foco de alta relevância (+25 XP)</div>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full transition-colors relative ${isTop3 ? 'bg-amber-500' : 'bg-[var(--borda)]'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.25 transition-transform ${isTop3 ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={pinned}
                onClick={() => setPinned(!pinned)}
                className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  pinned
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                    : 'border-[var(--borda)] bg-[var(--surface-secondary)] hover:border-[var(--borda-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Pin className={`w-4 h-4 ${pinned ? 'text-[var(--primary)] fill-[var(--primary)]' : 'text-[var(--texto-muted)]'}`} />
                  <div>
                    <div className="text-xs font-bold text-[var(--texto)]">Fixar no topo</div>
                    <div className="text-[11px] text-[var(--texto-suave)]">Destacar na timeline e nas listas</div>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full transition-colors relative ${pinned ? 'bg-[var(--primary)]' : 'bg-[var(--borda)]'}`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.25 transition-transform ${pinned ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </button>
            </div>

            {/* 6. Collapsible "Mais opções" */}
            <div className="pt-2 border-t border-[var(--borda)]">
              <button
                type="button"
                onClick={() => setIsMoreOptionsOpen(!isMoreOptionsOpen)}
                className="w-full py-2 flex items-center justify-between text-xs font-semibold text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span>Mais opções</span>
                  {(description.trim() || recurringDays.length > 0 || subtasks.length > 0 || tags.length > 0) && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[var(--primary-soft)] text-[var(--primary)]">
                      ativo
                    </span>
                  )}
                </span>
                {isMoreOptionsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isMoreOptionsOpen && (
                <div className="space-y-4 pt-3 pb-1 animate-fadeIn">
                  {/* Notes / Description */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--texto-suave)] mb-1">
                      Descrição ou anotações
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Pontos de atenção, materiais necessários ou links..."
                      className="w-full px-3 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] placeholder:text-[var(--texto-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all resize-none"
                    />
                  </div>

                  {/* Recurring Days */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--texto-suave)] mb-1.5 flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5" /> Repetir nos dias
                    </label>
                    <div className="flex gap-1.5">
                      {dayLabels.map((d) => {
                        const isSelected = recurringDays.includes(d.num);
                        return (
                          <button
                            type="button"
                            key={d.num}
                            onClick={() => handleToggleDay(d.num)}
                            className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                                : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] border-[var(--borda)] hover:text-[var(--texto)]'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subtasks */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--texto-suave)] mb-1.5 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5" /> Subtarefas ({subtasks.length})
                    </label>
                    {subtasks.length > 0 && (
                      <div className="space-y-1.5 mb-2 max-h-36 overflow-y-auto pr-1">
                        {subtasks.map((st) => (
                          <div 
                            key={st.id} 
                            className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs"
                          >
                            <span className="truncate pr-2 text-[var(--texto)]">{st.title}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubtask(st.id)}
                              className="text-[var(--texto-muted)] hover:text-rose-500 cursor-pointer p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtask();
                          }
                        }}
                        placeholder="Adicionar subtarefa e pressionar Enter..."
                        className="flex-1 h-9 px-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] placeholder:text-[var(--texto-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSubtask()}
                        className="h-9 px-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)] hover:bg-[var(--surface)] cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--texto-suave)] mb-1.5 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Tags
                    </label>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tags.map((t) => (
                          <span 
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-secondary)] border border-[var(--borda)] text-[var(--texto-suave)]"
                          >
                            #{t}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(t)}
                              className="hover:text-rose-500 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={tagInputValue}
                      onChange={(e) => setTagInputValue(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="Digite uma tag e pressione Enter..."
                      className="w-full h-9 px-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] placeholder:text-[var(--texto-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Fixed Footer */}
          <div className="px-6 py-4 border-t border-[var(--borda)] bg-[var(--surface)] flex items-center justify-between shrink-0">
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--texto-muted)]">
              <CornerDownLeft className="w-3.5 h-3.5" />
              <span>Pressione <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] border border-[var(--borda)] font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] border border-[var(--borda)] font-mono text-[10px]">Enter</kbd> para criar</span>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-xl text-xs font-semibold text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="h-10 px-6 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
              >
                {taskToEdit ? 'Salvar alterações' : 'Criar tarefa'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
