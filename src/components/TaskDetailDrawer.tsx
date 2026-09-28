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
  CheckCircle2, 
  Circle, 
  ExternalLink, 
  Link as LinkIcon, 
  Dumbbell, 
  HeartPulse, 
  Flame, 
  BookOpen, 
  Copy, 
  Sparkles, 
  ChevronRight,
  TrendingUp,
  Activity,
  History,
  AlertCircle,
  Trophy,
  Share2,
  Droplet,
  Moon,
  TimerReset,
  Award
} from 'lucide-react';
import { 
  Task, 
  Category, 
  Priority, 
  Subtask, 
  Attachment, 
  TaskDetails, 
  WorkoutDetails, 
  CardioDetails, 
  NutritionHydrationDetails, 
  StudyDetails,
  MuscleGroup,
  HealthActivityType,
  WorkoutExercise,
  SubjectStructure,
  WorkoutTemplate
} from '../types';
import { generateUUID, repository } from '../services/repository';
import { CategoryIcon } from './CategoryIcon';
import { APP_NAME } from '../constants/app';
import { audioSynthesizer } from '../services/audioSynthesizer';

interface TaskDetailDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStartFocus: (task: Task) => void;
  categories: Category[];
  subjectStructures?: SubjectStructure[];
  workoutTemplates?: WorkoutTemplate[];
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onStartFocus,
  categories,
  subjectStructures = [],
  workoutTemplates = [],
}) => {
  const [currentTask, setCurrentTask] = useState<Task | null>(task);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'detalhes_categoria' | 'anexos' | 'historico'>('geral');
  
  // Treino e Saúde states
  const [isResting, setIsResting] = useState(false);
  const [restRemainingSec, setRestRemainingSec] = useState<number | null>(null);
  const [prAlert, setPrAlert] = useState<{ name: string; load: number } | null>(null);
  const [copiedWorkout, setCopiedWorkout] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTask(task);
  }, [task]);

  // Rest countdown timer
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

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentTask) return null;

  const activeCategory = categories.find(c => c.id === currentTask.categoryId) || categories[0];
  const isHealthCategory = activeCategory.id === 'cat-saude' || activeCategory.icon === 'heart-pulse' || activeCategory.name.toLowerCase().includes('saúde') || activeCategory.name.toLowerCase().includes('treino');
  const isStudyCategory = activeCategory.icon === 'book' || activeCategory.icon === 'calculator' || activeCategory.icon === 'atom' || activeCategory.name.toLowerCase().includes('estudo') || activeCategory.name.toLowerCase().includes('matemática') || activeCategory.name.toLowerCase().includes('física');

  // Find curriculum structure for active category
  const currentStructure = subjectStructures.find(s => s.categoryId === activeCategory.id) ||
    (isStudyCategory ? subjectStructures.find(s => s.categoryId === 'cat-estudo') : undefined);

  const handleFieldChange = <K extends keyof Task>(field: K, value: Task[K]) => {
    if (!currentTask) return;
    const updated: Task = {
      ...currentTask,
      [field]: value,
      updatedAt: new Date().toISOString(),
    };
    setCurrentTask(updated);
    onUpdateTask(updated);
  };

  const handleToggleComplete = () => {
    if (!currentTask) return;
    const isCompleted = !currentTask.completed;
    const updated: Task = {
      ...currentTask,
      completed: isCompleted,
      completedAt: isCompleted ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
      activityLog: [
        {
          id: generateUUID(),
          action: isCompleted ? 'Tarefa concluída no Drawer' : 'Tarefa reaberta',
          timestamp: new Date().toISOString(),
        },
        ...(currentTask.activityLog || []),
      ]
    };
    setCurrentTask(updated);
    onUpdateTask(updated);
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
  };

  const handleRemoveTag = (tag: string) => {
    if (!currentTask) return;
    handleFieldChange('tags', currentTask.tags.filter(t => t !== tag));
  };

  // Attachment / Link handlers
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

  // ----------------------------------------------------
  // FASE 3A: Workout handlers
  // ----------------------------------------------------
  const handleApplyWorkoutTemplate = (template: WorkoutTemplate) => {
    if (!currentTask) return;
    const workoutDetails: WorkoutDetails = {
      type: 'treino_forca',
      muscleGroup: template.muscleGroup,
      exercises: template.exercises.map(ex => ({
        ...ex,
        id: generateUUID(),
        setsDone: new Array(ex.sets).fill(false),
      })),
      lastSessionSummary: `Modelo "${template.name}" aplicado`,
    };
    handleFieldChange('details', workoutDetails);
  };

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

    // When marking a set as done:
    if (willBeDone && targetEx) {
      // 1. Trigger rest timer countdown
      const restTime = targetEx.restSec || 60;
      setRestRemainingSec(restTime);
      setIsResting(true);
      audioSynthesizer.playTimerStart();

      // 2. PR check and celebrate
      if (targetEx.loadKg && targetEx.loadKg > 0) {
        repository.recordExerciseLoad(targetEx.name, targetEx.loadKg, targetEx.reps).then(res => {
          if (res.isPR) {
            setPrAlert({ name: targetEx.name, load: targetEx.loadKg! });
            audioSynthesizer.playSuccessTone();
          }
        });
      }
    }
  };

  const handleExportWorkoutWhatsApp = () => {
    if (!currentTask || currentTask.details?.type !== 'treino_forca') return;
    const exercises = currentTask.details.exercises;
    let text = `🏋️ *Treino: ${currentTask.title}*\n📅 Data: ${new Date(currentTask.date).toLocaleDateString('pt-BR')}\n\n`;
    exercises.forEach((ex, i) => {
      const doneCount = ex.setsDone.filter(Boolean).length;
      text += `${i + 1}. *${ex.name}*\n   • ${ex.sets} séries x ${ex.reps} reps @ ${ex.loadKg || 0}kg (Realizadas: ${doneCount}/${ex.sets})\n`;
      if (ex.notes) text += `   • Obs: ${ex.notes}\n`;
    });
    text += `\nGerado pelo ${APP_NAME} ⚡`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedWorkout(true);
      setTimeout(() => setCopiedWorkout(false), 3000);
    }
  };

  const handleDuplicateExercise = (exercise: WorkoutExercise) => {
    if (!currentTask || currentTask.details?.type !== 'treino_forca') return;
    const currentWorkout = currentTask.details as WorkoutDetails;
    const duplicated: WorkoutExercise = {
      ...exercise,
      id: generateUUID(),
      name: `${exercise.name} (Cópia)`,
      setsDone: new Array(exercise.sets).fill(false),
    };
    handleFieldChange('details', {
      ...currentWorkout,
      exercises: [...currentWorkout.exercises, duplicated],
    });
  };

  const handleRemoveExercise = (exerciseId: string) => {
    if (!currentTask || currentTask.details?.type !== 'treino_forca') return;
    const currentWorkout = currentTask.details as WorkoutDetails;
    handleFieldChange('details', {
      ...currentWorkout,
      exercises: currentWorkout.exercises.filter(ex => ex.id !== exerciseId),
    });
  };

  // ----------------------------------------------------
  // FASE 3B: Study Cascade handlers
  // ----------------------------------------------------
  const handleSelectStudyTopic = (moduleId: string, moduleName: string, topic: { id: string; name: string }) => {
    if (!currentTask) return;
    const studyDetails: StudyDetails = {
      type: 'estudo',
      moduleId,
      moduleName,
      topicId: topic.id,
      topicName: topic.name,
      studyType: 'teoria',
      questionsDone: 0,
      questionsCorrect: 0,
    };
    handleFieldChange('details', studyDetails);
    // Suggest in description if empty
    if (!currentTask.description) {
      handleFieldChange('description', `Estudo do tópico: ${topic.name} (${moduleName})\n• Teoria e conceitos principais\n• Resolução de exercícios de fixação\n• Resumo para revisão ativa`);
    }
  };

  const subtasksCompletedCount = (currentTask.subtasks || []).filter(s => s.completed).length;
  const subtasksTotalCount = (currentTask.subtasks || []).length;
  const subtasksProgressPercent = subtasksTotalCount > 0 ? Math.round((subtasksCompletedCount / subtasksTotalCount) * 100) : 0;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={drawerRef}
        role="dialog"
        aria-label={`Detalhes da tarefa: ${currentTask.title}`}
        aria-modal="true"
        className="w-full sm:w-[500px] md:w-[540px] lg:w-[580px] bg-[var(--surface)] text-[var(--texto)] h-full shadow-2xl border-l border-[var(--borda)] flex flex-col justify-between overflow-hidden animate-slideLeft"
      >
        {/* Drawer Header (Fixed) */}
        <div className="px-6 py-4 border-b border-[var(--borda)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleComplete}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                currentTask.completed
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] border-[var(--borda)] hover:border-[var(--primary)]'
              }`}
            >
              {currentTask.completed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Concluída</span>
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4" />
                  <span>Marcar como feita</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onStartFocus(currentTask)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Focar</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Tem certeza que deseja enviar esta tarefa para a lixeira?')) {
                  onDeleteTask(currentTask.id);
                  onClose();
                }
              }}
              aria-label="Excluir tarefa"
              className="w-8 h-8 rounded-xl text-[var(--texto-muted)] hover:text-rose-500 hover:bg-[var(--surface-secondary)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel"
              className="w-8 h-8 rounded-xl text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside Drawer */}
        <div className="px-6 border-b border-[var(--borda)] flex items-center gap-2 overflow-x-auto shrink-0 bg-[var(--surface-secondary)]/40">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'geral'
                ? 'border-[var(--primary)] text-[var(--primary-text-on-soft)]'
                : 'border-transparent text-[var(--texto-suave)] hover:text-[var(--texto)]'
            }`}
          >
            Visão Geral
          </button>

          {(isHealthCategory || isStudyCategory || currentTask.details) && (
            <button
              type="button"
              onClick={() => setActiveTab('detalhes_categoria')}
              className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'detalhes_categoria'
                  ? 'border-[var(--primary)] text-[var(--primary-text-on-soft)]'
                  : 'border-transparent text-[var(--texto-suave)] hover:text-[var(--texto)]'
              }`}
            >
              {isHealthCategory ? <Dumbbell className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
              <span>{isHealthCategory ? 'Treino & Saúde' : 'Conteúdo & Tópicos'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('anexos')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'anexos'
                ? 'border-[var(--primary)] text-[var(--primary-text-on-soft)]'
                : 'border-transparent text-[var(--texto-suave)] hover:text-[var(--texto)]'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Links & Anexos ({currentTask.attachments?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('historico')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'historico'
                ? 'border-[var(--primary)] text-[var(--primary-text-on-soft)]'
                : 'border-transparent text-[var(--texto-suave)] hover:text-[var(--texto)]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Atividade</span>
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          
          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'geral' && (
            <>
              {/* Inline Title Editing */}
              <div>
                <input
                  type="text"
                  value={currentTask.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="Nome da tarefa..."
                  className="w-full text-lg font-bold text-[var(--texto)] bg-transparent border-b border-transparent hover:border-[var(--borda)] focus:border-[var(--primary)] focus:outline-none pb-1 transition-all"
                />
              </div>

              {/* Meta Grid: Category, Priority, Date, Time, Duration */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs">
                {/* Category */}
                <div>
                  <span className="block text-[11px] font-semibold text-[var(--texto-muted)] mb-1">Matéria / Categoria</span>
                  <select
                    value={currentTask.categoryId}
                    onChange={(e) => handleFieldChange('categoryId', e.target.value)}
                    className="w-full h-9 px-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <span className="block text-[11px] font-semibold text-[var(--texto-muted)] mb-1">Prioridade</span>
                  <select
                    value={currentTask.priority}
                    onChange={(e) => handleFieldChange('priority', e.target.value as Priority)}
                    className="w-full h-9 px-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] capitalize focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>

                {/* Date */}
                <div>
                  <span className="block text-[11px] font-semibold text-[var(--texto-muted)] mb-1">Data</span>
                  <input
                    type="date"
                    value={currentTask.date}
                    onChange={(e) => handleFieldChange('date', e.target.value)}
                    className="w-full h-9 px-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] tabular-nums focus:outline-none"
                  />
                </div>

                {/* Time & Duration */}
                <div>
                  <span className="block text-[11px] font-semibold text-[var(--texto-muted)] mb-1">Tempo Estimado (min)</span>
                  <input
                    type="number"
                    step="5"
                    min="5"
                    value={currentTask.estimatedMinutes || 45}
                    onChange={(e) => handleFieldChange('estimatedMinutes', parseInt(e.target.value, 10) || 45)}
                    className="w-full h-9 px-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] tabular-nums focus:outline-none"
                  />
                </div>
              </div>

              {/* Toggles: Top 3 & Pin */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleFieldChange('isTop3', !currentTask.isTop3)}
                  className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    currentTask.isTop3
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'border-[var(--borda)] bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)]'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${currentTask.isTop3 ? 'fill-current text-amber-500' : ''}`} />
                  <span>Top 3 do dia</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFieldChange('pinned', !currentTask.pinned)}
                  className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    currentTask.pinned
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)]'
                      : 'border-[var(--borda)] bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)]'
                  }`}
                >
                  <Pin className={`w-3.5 h-3.5 ${currentTask.pinned ? 'fill-current' : ''}`} />
                  <span>Fixar no topo</span>
                </button>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block text-[13px] font-semibold text-[var(--texto-suave)] mb-1.5">
                  Descrição & Anotações
                </label>
                <textarea
                  value={currentTask.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  placeholder="Instruções, capítulos do livro, referências ou anotações..."
                  rows={4}
                  className="w-full p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs sm:text-sm text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y transition-all placeholder:text-[var(--texto-muted)]"
                />
              </div>

              {/* Subtasks Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-[var(--texto-suave)]">
                    Subtarefas / Checklist
                  </span>
                  {subtasksTotalCount > 0 && (
                    <span className="text-xs font-semibold text-[var(--texto-muted)] tabular-nums">
                      {subtasksCompletedCount} / {subtasksTotalCount} ({subtasksProgressPercent}%)
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                {subtasksTotalCount > 0 && (
                  <div className="w-full h-1.5 bg-[var(--track-gray)] rounded-full overflow-hidden mb-3">
                    <div 
                      className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
                      style={{ width: `${subtasksProgressPercent}%` }}
                    />
                  </div>
                )}

                {/* Subtask Input */}
                <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mb-2.5">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Adicionar subtarefa e pressionar Enter..."
                    className="flex-1 h-9 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] placeholder:text-[var(--texto-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* Subtask Items */}
                <div className="space-y-1.5">
                  {(currentTask.subtasks || []).map(st => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs group"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSubtask(st.id)}
                        className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                      >
                        {st.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-[var(--texto-muted)] shrink-0" />
                        )}
                        <span className={`font-medium ${st.completed ? 'line-through text-[var(--texto-muted)]' : 'text-[var(--texto)]'}`}>
                          {st.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(st.id)}
                        className="text-[var(--texto-muted)] hover:text-rose-500 transition-colors cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[13px] font-semibold text-[var(--texto-suave)] mb-1.5">
                  Tags
                </label>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {(currentTask.tags || []).map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-medium text-[var(--texto-suave)]"
                    >
                      <span>#{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Adicionar tag..."
                    className="flex-1 h-8 px-2.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="h-8 px-2.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto-suave)] hover:text-[var(--texto)]"
                  >
                    + Tag
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DETALHES DE CATEGORIA (FASE 3A & 3B) */}
          {activeTab === 'detalhes_categoria' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Seção de Saúde / Treino (3A) */}
              {isHealthCategory && (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="w-5 h-5 text-[var(--primary-text-on-soft)]" />
                      <div>
                        <div className="text-xs font-bold text-[var(--texto)]">Módulo de Treino & Saúde</div>
                        <div className="text-[11px] text-[var(--texto-suave)]">Acompanhamento de séries, cargas, descanso e 1RM</div>
                      </div>
                    </div>

                    {currentTask.details?.type === 'treino_forca' && (
                      <button
                        type="button"
                        onClick={handleExportWorkoutWhatsApp}
                        className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Exportar resumo formatado do treino"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{copiedWorkout ? 'Copiado! ✓' : 'WhatsApp'}</span>
                      </button>
                    )}
                  </div>

                  {/* PR Celebration Alert */}
                  {prAlert && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-extrabold text-[var(--texto)]">Novo Recorde Pessoal (PR)! 🎉</div>
                          <div className="text-[11px] text-[var(--texto-suave)]">{prAlert.name}: {prAlert.load} kg batidos com sucesso!</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrAlert(null)}
                        className="text-[var(--texto-muted)] hover:text-[var(--texto)] p-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Rest Countdown Timer Banner */}
                  {isResting && restRemainingSec !== null && (
                    <div className="p-3.5 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-black tabular-nums text-sm">
                          {restRemainingSec}s
                        </div>
                        <div>
                          <div className="font-bold text-[var(--texto)]">Descanso entre séries</div>
                          <div className="text-[11px] text-[var(--texto-suave)]">Contagem regressiva sonora ativa</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRestRemainingSec(prev => (prev || 0) + 15)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-[11px] font-bold text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                        >
                          +15s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsResting(false);
                            setRestRemainingSec(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold hover:bg-[var(--primary-hover)] cursor-pointer"
                        >
                          Pular
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modelos rápidos de treino */}
                  {workoutTemplates.length > 0 && (
                    <div>
                      <span className="block text-[11px] font-semibold text-[var(--texto-muted)] mb-1.5">
                        Carregar Rotina Pré-definida (Modelos):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {workoutTemplates.map(tpl => (
                          <button
                            type="button"
                            key={tpl.id}
                            onClick={() => handleApplyWorkoutTemplate(tpl)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--borda)] text-[var(--texto-suave)] hover:text-[var(--texto)] transition-all cursor-pointer"
                          >
                            {tpl.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exercícios do Treino */}
                  {currentTask.details?.type === 'treino_forca' && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-[var(--texto)]">
                          Exercícios ({currentTask.details.exercises.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleAddWorkoutExercise}
                          className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Exercício
                        </button>
                      </div>

                      <div className="space-y-3">
                        {currentTask.details.exercises.map((ex, exIndex) => {
                          const est1RM = ex.loadKg && ex.loadKg > 0
                            ? Math.round(ex.loadKg * (1 + (parseInt(ex.reps) || 10) / 30))
                            : null;

                          return (
                            <div 
                              key={ex.id}
                              className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-2.5 text-xs shadow-2xs"
                            >
                              <div className="flex items-center justify-between">
                                <input
                                  type="text"
                                  value={ex.name}
                                  onChange={(e) => {
                                    if (currentTask.details?.type !== 'treino_forca') return;
                                    const exercises = [...currentTask.details.exercises];
                                    exercises[exIndex] = { ...ex, name: e.target.value };
                                    handleFieldChange('details', { ...currentTask.details, exercises });
                                  }}
                                  className="font-bold text-sm text-[var(--texto)] bg-transparent border-b border-transparent hover:border-[var(--borda)] focus:outline-none flex-1 mr-2"
                                />
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateExercise(ex)}
                                    title="Duplicar exercício"
                                    className="p-1 text-[var(--texto-muted)] hover:text-[var(--texto)] cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExercise(ex.id)}
                                    title="Remover exercício"
                                    className="p-1 text-[var(--texto-muted)] hover:text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Sets, Reps, Load, 1RM */}
                              <div className="grid grid-cols-4 gap-2 text-[11px] font-medium text-[var(--texto-suave)] pt-1">
                                <div>Séries: <span className="font-bold text-[var(--texto)] tabular-nums">{ex.sets}</span></div>
                                <div>Reps: <span className="font-bold text-[var(--texto)] tabular-nums">{ex.reps}</span></div>
                                <div>Carga: <span className="font-bold text-[var(--texto)] tabular-nums">{ex.loadKg || 0} kg</span></div>
                                <div>
                                  {est1RM ? (
                                    <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">1RM: ~{est1RM}kg</span>
                                  ) : (
                                    <span className="text-[var(--texto-muted)]">1RM: -</span>
                                  )}
                                </div>
                              </div>

                              {/* Sets tracker checkboxes */}
                              <div className="pt-1.5 flex items-center justify-between flex-wrap gap-2 border-t border-[var(--borda-soft)]">
                                <span className="text-[10px] font-bold text-[var(--texto-muted)] uppercase tracking-wider">
                                  Registrar Séries ({ex.setsDone.filter(Boolean).length}/{ex.sets}):
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {ex.setsDone.map((done, setIdx) => (
                                    <button
                                      type="button"
                                      key={setIdx}
                                      onClick={() => handleToggleExerciseSet(ex.id, setIdx)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tabular-nums border transition-all cursor-pointer ${
                                        done
                                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                                          : 'bg-[var(--surface)] text-[var(--texto-suave)] border-[var(--borda)] hover:border-[var(--primary)]'
                                      }`}
                                    >
                                      Série {setIdx + 1} {done ? '✓' : ''}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Registro Rápido de Água & Sono */}
                  <div className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-[var(--texto)]">
                        <Droplet className="w-4 h-4 text-cyan-500" />
                        <span>Hidratação Diária</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--texto-suave)]">Meta: 2.500 ml</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const current = (currentTask.details as any)?.waterConsumedMl || 0;
                          handleFieldChange('details', {
                            ...(currentTask.details || {}),
                            type: 'hidratacao',
                            waterConsumedMl: current + 250,
                          } as any);
                          audioSynthesizer.playSuccessTone();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold hover:border-cyan-500 text-cyan-600 dark:text-cyan-400 cursor-pointer shadow-xs"
                      >
                        +250 ml (1 copo)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const current = (currentTask.details as any)?.waterConsumedMl || 0;
                          handleFieldChange('details', {
                            ...(currentTask.details || {}),
                            type: 'hidratacao',
                            waterConsumedMl: current + 500,
                          } as any);
                          audioSynthesizer.playSuccessTone();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold hover:border-cyan-500 text-cyan-600 dark:text-cyan-400 cursor-pointer shadow-xs"
                      >
                        +500 ml (garrafa)
                      </button>

                      {(currentTask.details as any)?.waterConsumedMl > 0 && (
                        <span className="text-xs font-bold text-[var(--texto)] tabular-nums ml-auto">
                          {(currentTask.details as any)?.waterConsumedMl} ml registrados
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Conteúdos das Matérias (3B) */}
              {isStudyCategory && (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-[var(--primary-soft)] border border-[var(--primary)]/20 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[var(--primary-text-on-soft)]" />
                    <div>
                      <div className="text-xs font-bold text-[var(--texto)]">Grade Curricular & Tópicos</div>
                      <div className="text-[11px] text-[var(--texto-suave)]">Vincule a tarefa ao tópico do edital / cronograma</div>
                    </div>
                  </div>

                  {currentStructure ? (
                    <div className="space-y-3">
                      <span className="block text-[11px] font-semibold text-[var(--texto-muted)]">
                        Selecione o Módulo / Tópico para vincular:
                      </span>

                      <div className="space-y-2.5">
                        {currentStructure.modules.map(mod => (
                          <div key={mod.id} className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-2">
                            <div className="text-sm font-bold text-[var(--texto)]">{mod.name}</div>
                            <div className="space-y-1.5 pl-1">
                              {mod.topics.map(top => (
                                <button
                                  type="button"
                                  key={top.id}
                                  onClick={() => handleSelectStudyTopic(mod.id, mod.name, top)}
                                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer text-left ${
                                    currentTask.details?.type === 'estudo' && currentTask.details.topicId === top.id
                                      ? 'bg-[var(--primary)] text-white font-bold shadow-xs'
                                      : 'hover:bg-[var(--surface)] text-[var(--texto-suave)] hover:text-[var(--texto)]'
                                  }`}
                                >
                                  <span>• {top.name}</span>
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10 capitalize">
                                    {top.status.replace('_', ' ')}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-center text-xs text-[var(--texto-muted)]">
                      Nenhum tópico cadastrado para esta matéria ainda. Você pode adicionar módulos e tópicos em <strong>Ajustes &gt; Conteúdos</strong>.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ANEXOS & LINKS */}
          {activeTab === 'anexos' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[var(--texto)]">
                  Links Úteis & Anexos
                </span>
                {!isAddingLink && (
                  <button
                    type="button"
                    onClick={() => setIsAddingLink(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Link
                  </button>
                )}
              </div>

              {isAddingLink && (
                <form onSubmit={handleAddAttachment} className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--texto-muted)] mb-1">Título do Link</label>
                    <input
                      type="text"
                      required
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="Ex: Videoaula no YouTube ou PDF de Questões"
                      className="w-full h-8 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--texto-muted)] mb-1">URL / Link</label>
                    <input
                      type="text"
                      required
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://exemplo.com/material"
                      className="w-full h-8 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingLink(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--texto-suave)] hover:text-[var(--texto)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer"
                    >
                      Salvar Link
                    </button>
                  </div>
                </form>
              )}

              {/* Attachments List */}
              <div className="space-y-2">
                {(currentTask.attachments || []).map(att => (
                  <div 
                    key={att.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs hover:border-[var(--primary)] transition-all"
                  >
                    <a 
                      href={att.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[var(--texto)] hover:text-[var(--primary)] font-semibold truncate flex-1 mr-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                      <span className="truncate">{att.title}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-[var(--texto-muted)] hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {(!currentTask.attachments || currentTask.attachments.length === 0) && !isAddingLink && (
                  <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-center text-xs text-[var(--texto-muted)]">
                    Nenhum link anexado. Adicione PDFs, videoaulas ou links de exercícios.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HISTÓRICO & ATIVIDADE */}
          {activeTab === 'historico' && (
            <div className="space-y-3 animate-fadeIn">
              <span className="text-[13px] font-semibold text-[var(--texto)]">
                Registro de Atividade
              </span>
              <div className="space-y-2">
                {(currentTask.activityLog || [
                  { id: 'init', action: 'Tarefa criada', timestamp: currentTask.createdAt }
                ]).map(log => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs flex items-center justify-between">
                    <span className="font-medium text-[var(--texto)]">{log.action}</span>
                    <span className="text-[10px] text-[var(--texto-muted)] tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Drawer Sticky Footer */}
        <div className="px-6 py-3 border-t border-[var(--borda)] flex items-center justify-between shrink-0 bg-[var(--surface)] text-xs text-[var(--texto-muted)]">
          <span className="tabular-nums">
            Criada em: {new Date(currentTask.createdAt).toLocaleDateString('pt-BR')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--borda)] text-[var(--texto)] font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
