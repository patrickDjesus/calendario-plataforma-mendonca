import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Timer, 
  Tag, 
  Plus, 
  Trash2, 
  Star, 
  Pin, 
  Play, 
  Check, 
  BookOpen, 
  ChevronDown,
  Flag,
  Link as LinkIcon,
  ExternalLink,
  Dumbbell,
  Trophy,
  Copy
} from 'lucide-react';
import type { Priority } from '../types';
import { 
  Task, 
  Category, 
  Subtask, 
  Attachment, 
  WorkoutDetails, 
  StudyDetails,
  WorkoutExercise,
  SubjectStructure,
  WorkoutTemplate,
  ActivityLog
} from '../types';
import { generateUUID, repository } from '../services/repository';
import { CategoryIcon } from './CategoryIcon';
import { GifIcon } from './GifIcon';
import { categoryGifName, isHealthCategory as categoryIsHealth } from '../utils/taskCategory';
import { APP_NAME } from '../constants/app';
import { audioSynthesizer } from '../services/audioSynthesizer';
import { formatSecondsToDigital } from '../utils/dateUtils';
import { PomodoroRoadmap } from './PomodoroRoadmap';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleComplete?: (task: Task) => void;
  onStartFocus: (task: Task) => void;
  categories: Category[];
  subjectStructures?: SubjectStructure[];
  workoutTemplates?: WorkoutTemplate[];
  activeTaskId?: string | null;
  activeTimerRunning?: boolean;
  activeTimerElapsed?: number;
  pomodoroPhase?: 'foco' | 'pausa_curta' | 'pausa_longa';
  completedFocusBlocks?: number;
  onToggleActiveTimer?: () => void;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return 'Data';
  const todayISO = new Date().toISOString().split('T')[0];
  if (dateStr === todayISO) return 'Hoje';

  const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === tomorrowISO) return 'Amanhã';

  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onToggleComplete,
  onStartFocus,
  categories,
  subjectStructures = [],
  workoutTemplates = [],
  activeTaskId,
  activeTimerRunning = false,
  activeTimerElapsed = 0,
  pomodoroPhase = 'foco',
  completedFocusBlocks = 0,
  onToggleActiveTimer,
}) => {
  const [currentTask, setCurrentTask] = useState<Task | null>(task);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTagInput, setIsAddingTagInput] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  
  // Popovers & Actions State
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
  const [isPriorityPopoverOpen, setIsPriorityPopoverOpen] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isTimePopoverOpen, setIsTimePopoverOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showAutosaveBadge, setShowAutosaveBadge] = useState(false);

  // Accordions Expand/Collapse States
  const [isCategoryAccordionOpen, setIsCategoryAccordionOpen] = useState(false);
  const [isAttachmentsAccordionOpen, setIsAttachmentsAccordionOpen] = useState(false);

  // Workout / Health States
  const [isResting, setIsResting] = useState(false);
  const [restRemainingSec, setRestRemainingSec] = useState<number | null>(null);
  const [prAlert, setPrAlert] = useState<{ name: string; load: number } | null>(null);
  const [copiedWorkout, setCopiedWorkout] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const categoryPopoverRef = useRef<HTMLDivElement>(null);
  const priorityPopoverRef = useRef<HTMLDivElement>(null);
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const timePopoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal state when task prop changes
  useEffect(() => {
    if (!task) {
      setCurrentTask(null);
      return;
    }
    setCurrentTask(prev => {
      if (!prev || prev.id !== task.id) {
        return task;
      }
      return {
        ...task,
        title: prev.title !== task.title && prev.title !== '' ? prev.title : task.title,
        description: prev.description !== task.description && prev.description !== '' ? prev.description : task.description,
        spentSeconds: task.spentSeconds,
        spentSecondsByDay: task.spentSecondsByDay,
      };
    });
    setIsConfirmingDelete(false);

    const hasCategoryDetails = Boolean(task.details);
    const hasAttachments = Boolean(task.attachments && task.attachments.length > 0);

    setIsCategoryAccordionOpen(hasCategoryDetails);
    setIsAttachmentsAccordionOpen(hasAttachments);
  }, [task]);

  // Rest timer countdown
  useEffect(() => {
    if (restRemainingSec === null) return;
    if (restRemainingSec <= 0) {
      audioSynthesizer.playChime();
      setIsResting(false);
      setRestRemainingSec(null);
      return;
    }
    const interval = setInterval(() => {
      setRestRemainingSec(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [restRemainingSec]);

  // Handle Escape key and click outside popovers
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCategoryPopoverOpen) { setIsCategoryPopoverOpen(false); return; }
        if (isPriorityPopoverOpen) { setIsPriorityPopoverOpen(false); return; }
        if (isDatePopoverOpen) { setIsDatePopoverOpen(false); return; }
        if (isTimePopoverOpen) { setIsTimePopoverOpen(false); return; }
        if (isConfirmingDelete) { setIsConfirmingDelete(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isCategoryPopoverOpen, isPriorityPopoverOpen, isDatePopoverOpen, isTimePopoverOpen, isConfirmingDelete]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryPopoverRef.current && !categoryPopoverRef.current.contains(e.target as Node)) {
        setIsCategoryPopoverOpen(false);
      }
      if (priorityPopoverRef.current && !priorityPopoverRef.current.contains(e.target as Node)) {
        setIsPriorityPopoverOpen(false);
      }
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target as Node)) {
        setIsDatePopoverOpen(false);
      }
      if (timePopoverRef.current && !timePopoverRef.current.contains(e.target as Node)) {
        setIsTimePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || !currentTask) return null;

  const activeCategory = categories.find(c => c.id === currentTask.categoryId) || categories[0];
  const activeCategoryGif = categoryGifName(activeCategory);
  const isHealthCategory = categoryIsHealth(activeCategory);
  const isStudyCategory = activeCategory.icon === 'book' || activeCategory.icon === 'calculator' || activeCategory.icon === 'atom' || activeCategory.name.toLowerCase().includes('estudo') || activeCategory.name.toLowerCase().includes('matemática') || activeCategory.name.toLowerCase().includes('física') || activeCategory.name.toLowerCase().includes('enem');
  const isTaskActiveTimer = activeTaskId === currentTask.id;

  const currentStructure = subjectStructures.find(s => s.categoryId === activeCategory.id) ||
    (isStudyCategory ? subjectStructures.find(s => s.categoryId === 'cat-estudo') : undefined);

  const priorityOptions: Array<{ id: Priority; label: string; dotClass: string }> = [
    { id: 'baixa', label: 'Baixa', dotClass: 'bg-emerald-500' },
    { id: 'media', label: 'Média', dotClass: 'bg-amber-500' },
    { id: 'alta', label: 'Alta', dotClass: 'bg-rose-500' },
    { id: 'urgente', label: 'Urgente', dotClass: 'bg-red-700' },
  ];

  const currentPriorityObj = priorityOptions.find(p => p.id === (currentTask.priority || 'media')) || priorityOptions[1];

  // Debounced Autosave Handler
  const handleFieldChange = <K extends keyof Task>(field: K, value: Task[K]) => {
    if (!currentTask) return;
    const updated: Task = {
      ...currentTask,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    setCurrentTask(updated);

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      onUpdateTask(updated);
      setShowAutosaveBadge(true);
      setTimeout(() => setShowAutosaveBadge(false), 2000);
    }, 500);
  };

  const handleToggleComplete = () => {
    if (!currentTask) return;
    if (onToggleComplete) {
      onToggleComplete(currentTask);
    } else {
      const isCompleted = !currentTask.completed;
      const updated: Task = {
        ...currentTask,
        completed: isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
        activityLog: [
          {
            id: generateUUID(),
            action: isCompleted ? 'Tarefa concluída no Modal' : 'Tarefa reaberta',
            timestamp: new Date().toISOString(),
          },
          ...(currentTask.activityLog || []),
        ]
      };
      setCurrentTask(updated);
      onUpdateTask(updated);
    }
    setShowAutosaveBadge(true);
    setTimeout(() => setShowAutosaveBadge(false), 2000);
  };

  // Subtask handlers
  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubtaskTitle.trim() || !currentTask) return;
    const updatedSubtasks: Subtask[] = [
      ...(currentTask.subtasks || []),
      { id: generateUUID(), title: newSubtaskTitle.trim(), completed: false },
    ];
    handleFieldChange('subtasks', updatedSubtasks);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subtaskId: string) => {
    if (!currentTask) return;
    const updatedSubtasks = (currentTask.subtasks || []).map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    handleFieldChange('subtasks', updatedSubtasks);
  };

  const handleRemoveSubtask = (subtaskId: string) => {
    if (!currentTask) return;
    const updatedSubtasks = (currentTask.subtasks || []).filter(st => st.id !== subtaskId);
    handleFieldChange('subtasks', updatedSubtasks);
  };

  // Tag handlers
  const handleAddTag = () => {
    if (!newTagInput.trim() || !currentTask) return;
    const cleaned = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!currentTask.tags.includes(cleaned)) {
      handleFieldChange('tags', [...currentTask.tags, cleaned]);
    }
    setNewTagInput('');
    setIsAddingTagInput(false);
  };

  const handleRemoveTag = (tag: string) => {
    if (!currentTask) return;
    handleFieldChange('tags', currentTask.tags.filter(t => t !== tag));
  };

  // Attachment handlers
  const handleAddAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim() || !currentTask) return;
    let url = newLinkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const newAttachment: Attachment = {
      id: generateUUID(),
      title: newLinkTitle.trim(),
      url,
      createdAt: new Date().toISOString(),
    };
    const updatedAttachments = [...(currentTask.attachments || []), newAttachment];
    handleFieldChange('attachments', updatedAttachments);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setIsAddingLink(false);
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!currentTask) return;
    const updatedAttachments = (currentTask.attachments || []).filter(a => a.id !== attachmentId);
    handleFieldChange('attachments', updatedAttachments);
  };

  // Workout handlers
  const handleAddWorkoutExercise = () => {
    if (!currentTask) return;
    const currentWorkout = (currentTask.details?.type === 'treino_forca' ? currentTask.details : null) as WorkoutDetails | null;
    const newEx: WorkoutExercise = {
      id: generateUUID(),
      name: 'Novo Exercício',
      sets: 3,
      reps: '10-12',
      loadKg: 20,
      restSec: 60,
      setsDone: [false, false, false],
    };
    const updatedWorkout: WorkoutDetails = {
      type: 'treino_forca',
      muscleGroup: currentWorkout?.muscleGroup || 'peito',
      exercises: [...(currentWorkout?.exercises || []), newEx],
      effortRating: currentWorkout?.effortRating || 3,
    };
    handleFieldChange('details', updatedWorkout);
  };

  const handleToggleExerciseSet = (exerciseId: string, setIndex: number) => {
    if (!currentTask || currentTask.details?.type !== 'treino_forca') return;
    const currentWorkout = currentTask.details as WorkoutDetails;
    const targetEx = currentWorkout.exercises.find(e => e.id === exerciseId);
    const willBeDone = targetEx ? !targetEx.setsDone[setIndex] : false;

    const updatedExercises = currentWorkout.exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSetsDone = [...ex.setsDone];
        newSetsDone[setIndex] = !newSetsDone[setIndex];
        return { ...ex, setsDone: newSetsDone };
      }
      return ex;
    });

    handleFieldChange('details', { ...currentWorkout, exercises: updatedExercises });

    if (willBeDone && targetEx) {
      const restTime = targetEx.restSec || 60;
      setRestRemainingSec(restTime);
      setIsResting(true);
      audioSynthesizer.playTimerStart();
    }
  };

  const handleExportWorkoutWhatsApp = () => {
    if (!currentTask || currentTask.details?.type !== 'treino_forca') return;
    const exercises = currentTask.details.exercises;
    let text = `🏋️ *Treino: ${currentTask.title}*\n📅 Data: ${new Date(currentTask.date).toLocaleDateString('pt-BR')}\n\n`;
    exercises.forEach((ex, i) => {
      const doneCount = ex.setsDone.filter(Boolean).length;
      text += `${i + 1}. *${ex.name}*\n   • ${ex.sets} séries x ${ex.reps} reps @ ${ex.loadKg || 0}kg (Realizadas: ${doneCount}/${ex.sets})\n`;
    });
    text += `\nGerado pelo ${APP_NAME} ⚡`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedWorkout(true);
      setTimeout(() => setCopiedWorkout(false), 3000);
    }
  };

  // Study Cascade handlers
  const handleSelectStudyTopic = (moduleId: string, moduleName: string, topic: { id: string; name?: string; nome?: string }) => {
    if (!currentTask) return;
    const studyDetails: StudyDetails = {
      type: 'estudo',
      moduleId,
      moduleName,
      topicId: topic.id,
      topicName: topic.name || topic.nome || '',
      studyType: 'teoria',
      questionsDone: 0,
      questionsCorrect: 0,
    };
    handleFieldChange('details', studyDetails);
  };

  const subtasksCompletedCount = (currentTask.subtasks || []).filter(s => s.completed).length;
  const subtasksTotalCount = (currentTask.subtasks || []).length;
  const subtasksProgressPercent = subtasksTotalCount > 0 ? Math.round((subtasksCompletedCount / subtasksTotalCount) * 100) : 0;

  // Time calculations (inclui cronômetro ativo em tempo real se a tarefa estiver em foco)
  const totalLiveSeconds = (currentTask.spentSeconds || 0) + (isTaskActiveTimer && activeTimerRunning ? activeTimerElapsed : 0);
  const actualMinutes = Math.floor(totalLiveSeconds / 60);
  const estimatedMins = currentTask.estimatedMinutes || 90;
  const focusedFraction = estimatedMins > 0 ? totalLiveSeconds / (estimatedMins * 60) : 0;

  let categorySummaryWhenClosed = 'Nenhum vinculado';
  if (isStudyCategory && currentTask.details?.type === 'estudo' && currentTask.details.topicName) {
    categorySummaryWhenClosed = `${currentTask.details.moduleName || 'Módulo'} · ${currentTask.details.topicName}`;
  } else if (isHealthCategory && currentTask.details?.type === 'treino_forca') {
    categorySummaryWhenClosed = `${currentTask.details.exercises.length} exerc. cadastrados`;
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-label={`Detalhes da tarefa: ${currentTask.title}`}
        aria-modal="true"
        className="w-full max-w-[820px] max-h-[88vh] bg-[var(--surface)] rounded-[24px] shadow-2xl overflow-hidden flex flex-col border border-[var(--borda)] border-l-0 animate-modal relative"
      >
        {/* Category Accent Stripe on left edge replacing left border with diagonal shine glow */}
        <div 
          className="absolute -top-[1px] -bottom-[1px] -left-[1px] w-2 z-30 overflow-hidden pointer-events-none transition-colors duration-300 rounded-l-[24px]"
          style={{ backgroundColor: activeCategory.color }}
        >
          <div 
            className="absolute inset-0 w-[400%] h-[200%] -top-1/2 -left-full animate-shimmer-diagonal pointer-events-none opacity-85"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0) 70%)'
            }}
          />
        </div>

        {/* Modal Top Header */}
        <div className="px-6 pt-5 pb-3.5 border-b border-[var(--borda-soft)] flex flex-col gap-2 shrink-0 bg-[var(--surface)]">
          <div className="flex items-center justify-between gap-3">
            {/* Circular Checkbox + Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={handleToggleComplete}
                aria-label={currentTask.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
                title={currentTask.completed ? 'Marcar como pendente' : 'Marcar como concluída'}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer focus:outline-none ${
                  currentTask.completed
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                    : 'border-slate-300 hover:border-blue-600 bg-transparent'
                }`}
              >
                {currentTask.completed && <Check className="w-4 h-4 stroke-[3]" />}
              </button>

              <input
                type="text"
                value={currentTask.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="Título da tarefa..."
                className="flex-1 text-xl font-bold text-[var(--texto)] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-none px-1 py-0.5 rounded-lg transition-colors truncate"
              />
            </div>

            {/* Header Right Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Star Switch */}
              <button
                type="button"
                onClick={() => handleFieldChange('isTop3', !currentTask.isTop3)}
                title={currentTask.isTop3 ? 'Remover dos Top 3' : 'Marcar como Top 3'}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  currentTask.isTop3 ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                }`}
              >
                <Star className="w-5 h-5 fill-current" />
              </button>

              {/* Pin Switch */}
              <button
                type="button"
                onClick={() => handleFieldChange('pinned', !currentTask.pinned)}
                title={currentTask.pinned ? 'Desafixar do topo' : 'Fixar no topo'}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  currentTask.pinned ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                }`}
              >
                <Pin className="w-5 h-5 fill-current" />
              </button>

              {/* Focus Button */}
              <button
                type="button"
                onClick={() => {
                  if (isTaskActiveTimer) {
                    if (onToggleActiveTimer) onToggleActiveTimer();
                  } else {
                    if (onStartFocus) onStartFocus(currentTask);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                {isTaskActiveTimer ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <Timer className="w-3.5 h-3.5" />
                    <span className="tabular-nums font-extrabold">{formatSecondsToDigital(activeTimerElapsed || 0)}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Focar</span>
                  </>
                )}
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                title="Excluir tarefa"
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                title="Fechar (Esc)"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Meta Bar Under Title (Category · Priority · Date · Duration) */}
          <div className="flex items-center gap-2 pl-10 text-xs text-slate-500 font-medium flex-wrap">
            {/* Category */}
            <div className="relative" ref={categoryPopoverRef}>
              <button
                type="button"
                onClick={() => setIsCategoryPopoverOpen(!isCategoryPopoverOpen)}
                className="flex items-center gap-1.5 text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                <CategoryIcon category={activeCategory} className="w-3.5 h-3.5" />
                <span>{activeCategory.name}</span>
              </button>

              {isCategoryPopoverOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-xl p-2 z-50 animate-scaleUp">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Selecionar Categoria</div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          handleFieldChange('categoryId', cat.id);
                          setIsCategoryPopoverOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                          cat.id === activeCategory.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-[var(--texto)]'
                        }`}
                      >
                        <CategoryIcon category={cat} className="w-4 h-4" />
                        <span className="truncate">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className="text-slate-300">·</span>

            {/* Priority */}
            <div className="relative" ref={priorityPopoverRef}>
              <button
                type="button"
                onClick={() => setIsPriorityPopoverOpen(!isPriorityPopoverOpen)}
                className="flex items-center gap-1.5 font-semibold text-[var(--texto)] hover:opacity-80 cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full ${
                  currentTask.priority === 'urgente' ? 'bg-red-700' :
                  currentTask.priority === 'alta' ? 'bg-rose-500' :
                  currentTask.priority === 'media' ? 'bg-amber-500' : 'bg-slate-400'
                }`} />
                <span>{currentPriorityObj.label}</span>
              </button>

              {isPriorityPopoverOpen && (
                <div className="absolute top-full left-0 mt-2 w-44 bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-xl p-2 z-50 animate-scaleUp">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Prioridade</div>
                  {priorityOptions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleFieldChange('priority', p.id);
                        setIsPriorityPopoverOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-100 text-[var(--texto)] cursor-pointer"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${p.dotClass}`} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-slate-300">·</span>

            {/* Date */}
            <div className="relative" ref={datePopoverRef}>
              <button
                type="button"
                onClick={() => setIsDatePopoverOpen(!isDatePopoverOpen)}
                className="font-medium text-slate-600 hover:text-blue-600 cursor-pointer"
              >
                {formatDateLabel(currentTask.date)}
              </button>

              {isDatePopoverOpen && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-xl z-50 animate-scaleUp min-w-[220px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Definir Data</div>
                  <input
                    type="date"
                    value={currentTask.date}
                    onChange={(e) => {
                      handleFieldChange('date', e.target.value);
                      setIsDatePopoverOpen(false);
                    }}
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 bg-transparent text-[var(--texto)]"
                  />
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange('date', new Date().toISOString().split('T')[0]);
                        setIsDatePopoverOpen(false);
                      }}
                      className="flex-1 text-[11px] font-semibold py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                        handleFieldChange('date', tomorrow);
                        setIsDatePopoverOpen(false);
                      }}
                      className="flex-1 text-[11px] font-semibold py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      Amanhã
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="text-slate-300">·</span>

            {/* Duration */}
            <div className="relative" ref={timePopoverRef}>
              <button
                type="button"
                onClick={() => setIsTimePopoverOpen(!isTimePopoverOpen)}
                className="font-bold text-[var(--texto)] hover:text-violet-600 cursor-pointer"
              >
                {currentTask.estimatedMinutes || 0} min
              </button>

              {isTimePopoverOpen && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-xl z-50 animate-scaleUp min-w-[200px]">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tempo Estimado</div>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {[15, 30, 45, 60, 90, 120].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          handleFieldChange('estimatedMinutes', m);
                          setIsTimePopoverOpen(false);
                        }}
                        className={`text-xs font-bold py-1.5 rounded-xl border transition-colors ${
                          currentTask.estimatedMinutes === m ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-[var(--texto)] hover:bg-slate-100'
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    placeholder="Outro valor (min)"
                    value={currentTask.estimatedMinutes || ''}
                    onChange={(e) => handleFieldChange('estimatedMinutes', parseInt(e.target.value, 10) || 0)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:outline-none focus:border-violet-600 bg-transparent text-[var(--texto)]"
                  />
                </div>
              )}
            </div>

            {showAutosaveBadge && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-fadeIn ml-2">
                ✓ Salvo
              </span>
            )}
          </div>
        </div>

        {/* Modal Body - Two Column Layout */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8 bg-[var(--surface)]">
          
          {/* Left Column (60% ~ 7 cols) */}
          <div className="md:col-span-7 flex flex-col gap-6">
            
            {/* Description Section */}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-2 block">
                Descrição
              </label>
              <div className="relative rounded-2xl border border-dashed border-[var(--borda)] p-3.5 bg-[var(--surface-secondary)]/30 hover:border-slate-300 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={currentTask.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Estudo livre para qualquer assunto, sendo necessário anotação de tudo."
                  rows={3}
                  className="w-full bg-transparent text-sm text-[var(--texto)] focus:outline-none resize-none placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Subtasks Section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-500">Subtarefas</span>
                <span className="text-xs font-semibold text-slate-400">
                  {subtasksCompletedCount}/{subtasksTotalCount}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${subtasksProgressPercent}%` }}
                />
              </div>

              {/* Subtasks List */}
              <div className="space-y-2 mb-3">
                {(currentTask.subtasks || []).map((st) => (
                  <div key={st.id} className="flex items-center gap-2.5 group">
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(st.id)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        st.completed
                          ? 'bg-emerald-500 text-white'
                          : 'border border-slate-300 hover:border-blue-500 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </button>
                    <span 
                      onClick={() => handleToggleSubtask(st.id)}
                      className={`flex-1 text-xs cursor-pointer transition-all ${
                        st.completed ? 'line-through text-slate-400 font-medium' : 'text-[var(--texto)] font-semibold'
                      }`}
                    >
                      {st.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(st.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Subtask Form */}
              <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                <button
                  type="submit"
                  className="w-5 h-5 rounded-full border border-dashed border-slate-300 hover:border-blue-500 flex items-center justify-center text-slate-400 hover:text-blue-500 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Adicionar nova subtarefa..."
                  className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-slate-400 text-[var(--texto)] py-1"
                />
              </form>
            </div>

            {/* Conteúdo e tópicos Accordion Card */}
            <div className="rounded-2xl border border-[var(--borda)] bg-[var(--surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsCategoryAccordionOpen(!isCategoryAccordionOpen)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-[var(--texto)] hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  <span>{isHealthCategory ? 'Treino e Saúde' : 'Conteúdo e tópicos'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 font-normal">
                  <span className="truncate max-w-[180px]">{categorySummaryWhenClosed}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCategoryAccordionOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isCategoryAccordionOpen && (
                <div className="p-4 border-t border-[var(--borda-soft)] bg-slate-50/50 space-y-3">
                  {/* Study Cascade Topic Selector */}
                  {isStudyCategory && currentStructure && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-slate-500">Módulos e Tópicos do Edital:</div>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {currentStructure.modules.map(mod => (
                          <div key={mod.id} className="bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--borda)]">
                            <div className="text-xs font-bold text-[var(--texto)] mb-1.5">{mod.name}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {mod.topics.map(top => (
                                <button
                                  key={top.id}
                                  type="button"
                                  onClick={() => handleSelectStudyTopic(mod.id, mod.name, top)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                    currentTask.details?.type === 'estudo' && currentTask.details.topicId === top.id
                                      ? 'bg-violet-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  {top.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Workout Exercises Control */}
                  {isHealthCategory && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--texto)]">Exercícios do Treino</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleAddWorkoutExercise}
                            className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 transition-colors"
                          >
                            + Exercício
                          </button>
                          <button
                            type="button"
                            onClick={handleExportWorkoutWhatsApp}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-colors"
                          >
                            {copiedWorkout ? 'Copiado!' : 'WhatsApp'}
                          </button>
                        </div>
                      </div>

                      {/* Exercises list */}
                      {currentTask.details?.type === 'treino_forca' && (
                        <div className="space-y-2">
                          {currentTask.details.exercises.map((ex, idx) => (
                            <div key={ex.id} className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--borda)] flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[var(--texto)]">{idx + 1}. {ex.name}</span>
                                <span className="text-[11px] font-semibold text-slate-500">{ex.sets}x {ex.reps} @ {ex.loadKg || 0}kg</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {ex.setsDone.map((done, setIdx) => (
                                  <button
                                    key={setIdx}
                                    type="button"
                                    onClick={() => handleToggleExerciseSet(ex.id, setIdx)}
                                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                      done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    Série {setIdx + 1}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right Column (40% ~ 5 cols - Donut Progress & Attributes) */}
          <div className="md:col-span-5 flex flex-col gap-4">
            
            {/* Donut Progress Ring (Tempo Focado) */}
            <div className="flex flex-col items-center justify-center pt-1 pb-1">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#E8ECF4"
                    strokeWidth="8"
                    className="fill-none"
                  />
                  {/* Progress Fill */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#3B6CF5"
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * Math.min(1, focusedFraction))}
                    strokeLinecap="round"
                    className="fill-none transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-extrabold text-[var(--texto)] leading-none tabular-nums">
                    {actualMinutes === 0 && totalLiveSeconds > 0 ? '< 1' : actualMinutes}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                    de {currentTask.estimatedMinutes || 0} min
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500 mt-2">
                Tempo focado
              </span>
            </div>

            {/* Pomodoro Session Roadmap / Timeline */}
            <PomodoroRoadmap
              estimatedMinutes={currentTask.estimatedMinutes || 90}
              spentSeconds={totalLiveSeconds}
              completedFocusBlocks={completedFocusBlocks}
              currentPhase={pomodoroPhase}
              isTimerRunning={isTaskActiveTimer && activeTimerRunning}
              activeTimerElapsed={activeTimerElapsed}
            />

            {/* Attributes Rows Stack */}
            <div className="flex flex-col space-y-3">
              
              {/* Data Row */}
              <div className="pt-3 border-t border-[var(--borda-soft)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Data</span>
                    <span className="text-xs font-bold text-[var(--texto)]">{formatDateLabel(currentTask.date)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDatePopoverOpen(true)}
                  className="text-xs text-violet-600 font-semibold hover:underline cursor-pointer"
                >
                  Alterar
                </button>
              </div>

              {/* Prioridade Row */}
              <div className="pt-3 border-t border-[var(--borda-soft)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                    <Flag className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Prioridade</span>
                    <span className="text-xs font-bold text-[var(--texto)]">{currentPriorityObj.label}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPriorityPopoverOpen(true)}
                  className="text-xs text-violet-600 font-semibold hover:underline cursor-pointer"
                >
                  Alterar
                </button>
              </div>

              {/* Tags Row */}
              <div className="pt-3 border-t border-[var(--borda-soft)] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4" />
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-1.5">
                  {currentTask.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                      #{tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-rose-500 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  
                  {isAddingTagInput ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        placeholder="Tag..."
                        className="text-xs px-2 py-0.5 border border-slate-200 rounded-md focus:outline-none w-20"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddTag();
                          }
                        }}
                      />
                      <button type="button" onClick={handleAddTag} className="text-xs text-violet-600 font-bold">OK</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingTagInput(true)}
                      className="text-xs text-violet-600 font-semibold hover:underline cursor-pointer"
                    >
                      + Adicionar tag
                    </button>
                  )}
                </div>
              </div>

              {/* Links e anexos Accordion */}
              <div className="pt-3 border-t border-[var(--borda-soft)]">
                <button
                  type="button"
                  onClick={() => setIsAttachmentsAccordionOpen(!isAttachmentsAccordionOpen)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-[var(--texto)] hover:text-violet-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-slate-500" />
                    <span>Links e anexos</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAttachmentsAccordionOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAttachmentsAccordionOpen && (
                  <div className="mt-3 space-y-2 pl-6">
                    {(currentTask.attachments || []).map(att => (
                      <div key={att.id} className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl">
                        <a href={att.url} target="_blank" rel="noreferrer" className="text-violet-600 font-semibold hover:underline truncate max-w-[150px]">
                          {att.title}
                        </a>
                        <button type="button" onClick={() => handleRemoveAttachment(att.id)} className="text-slate-400 hover:text-rose-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <form onSubmit={handleAddAttachment} className="flex flex-col gap-1.5 pt-1">
                      <input
                        type="text"
                        placeholder="Título do link..."
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        className="text-xs p-1.5 border border-slate-200 rounded-lg bg-transparent text-[var(--texto)] focus:outline-none"
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        className="text-xs p-1.5 border border-slate-200 rounded-lg bg-transparent text-[var(--texto)] focus:outline-none"
                      />
                      <button type="submit" className="text-xs font-bold py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                        Adicionar Anexo
                      </button>
                    </form>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--borda-soft)] flex items-center justify-between bg-slate-50/50 shrink-0">
          <span className="text-xs text-slate-400 font-medium">
            Criada em {new Date(currentTask.createdAt || Date.now()).toLocaleDateString('pt-BR')}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--surface)] hover:bg-slate-100 border border-[var(--borda)] rounded-xl text-xs font-semibold text-[var(--texto)] transition-colors cursor-pointer shadow-xs"
          >
            Fechar
          </button>
        </div>

        {/* Delete Confirmation Modal Overlay */}
        {isConfirmingDelete && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-[var(--surface)] p-6 rounded-2xl max-w-sm w-full border border-[var(--borda)] shadow-2xl text-center">
              <h3 className="text-base font-bold text-[var(--texto)] mb-2">Excluir esta tarefa?</h3>
              <p className="text-xs text-slate-500 mb-5">Esta ação não poderá ser desfeita.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteTask(currentTask.id);
                    onClose();
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 cursor-pointer"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Export alias for seamless backward compatibility
export const TaskDetailDrawer = TaskDetailModal;
