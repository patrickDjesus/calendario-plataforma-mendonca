import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Task, 
  Category, 
  UserProfile, 
  UserSettings, 
  DailyMood, 
  DayTemplate, 
  Achievement, 
  SpacedRepetitionItem, 
  StudyMode,
  SubjectStructure,
  WorkoutTemplate,
  Module,
  Topic
} from './types';
import { repository, DEFAULT_CATEGORIES, generateUUID } from './services/repository';
import { audioSynthesizer } from './services/audioSynthesizer';
import { Header } from './components/Header';
import { WelcomeCard } from './components/WelcomeCard';
import { Sidebar } from './components/Sidebar';
import { DayDashboard } from './components/DayDashboard';
import { TasksInboxView } from './components/TasksInboxView';
import { WeekView } from './components/WeekView';
import { JourneyView } from './components/JourneyView';
import { AchievementsView } from './components/AchievementsView';
import { TaskModal } from './components/TaskModal';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { SubjectsCurriculumModal } from './components/SubjectsCurriculumModal';
import { FullscreenFocusMode } from './components/FullscreenFocusMode';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { WhatToDoModal } from './components/WhatToDoModal';
import { PlanWeekModal } from './components/PlanWeekModal';
import { TemplatesModal } from './components/TemplatesModal';
import { OnboardingModal } from './components/OnboardingModal';
import { RolloverBanner } from './components/RolloverBanner';
import { CloseDayModal } from './components/CloseDayModal';
import { FreeFocusModal } from './components/FreeFocusModal';
import { InactivityPromptModal } from './components/InactivityPromptModal';
import { FloatingMiniTimer } from './components/FloatingMiniTimer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastContainer, ToastMessage } from './components/ToastContainer';
import { MicroConfetti } from './components/MicroConfetti';
import { getTodayISO, formatDateToISO, formatSecondsToDigital } from './utils/dateUtils';
import { recommendNextTask, checkAchievements, calculateLevelFromXP, STUDY_MODES } from './utils/xpSystem';
import { downloadICSFile } from './utils/icsExport';
import { updateDynamicFavicon } from './utils/dynamicFavicon';
import { requestNotificationPermission, sendBrowserNotification } from './utils/notifications';

export default function App() {
  // Core database state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>([]);
  const [subjectStructures, setSubjectStructures] = useState<SubjectStructure[]>([]);
  const [moods, setMoods] = useState<Record<string, DailyMood>>({});
  const [trash, setTrash] = useState<Array<Task & { originalDeletedAt: string }>>([]);
  const [spacedReps, setSpacedReps] = useState<SpacedRepetitionItem[]>([]);

  // Navigation & UI state
  const [currentTab, setCurrentTab] = useState<'hoje' | 'tarefas' | 'semana' | 'jornada'>('hoje');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confettiActive, setConfettiActive] = useState(false);
  const [dismissedOverdue, setDismissedOverdue] = useState(false);

  // Modals & Drawers state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isWhatToDoOpen, setIsWhatToDoOpen] = useState(false);
  const [isPlanWeekOpen, setIsPlanWeekOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isCloseDayOpen, setIsCloseDayOpen] = useState(false);
  const [isFreeFocusOpen, setIsFreeFocusOpen] = useState(false);
  const [isInactivityPromptOpen, setIsInactivityPromptOpen] = useState(false);

  // Active Timer state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTimerRunning, setActiveTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [accumulatedTimerSeconds, setAccumulatedTimerSeconds] = useState(0);

  // Inactivity tracking
  const lastUserInteractionTime = useRef<number>(Date.now());

  const todayISO = getTodayISO();

  // Load initial database data
  const loadInitialData = useCallback(async () => {
    const [
      loadedTasks,
      loadedCats,
      loadedProf,
      loadedSettings,
      loadedAchs,
      loadedTemplates,
      loadedWorkoutTpls,
      loadedStructures,
      loadedMoods,
      loadedTrash,
      loadedSpaced,
    ] = await Promise.all([
      repository.getTasks(),
      repository.getCategories(),
      repository.getProfile(),
      repository.getSettings(),
      repository.getAchievements(),
      repository.getTemplates(),
      repository.getWorkoutTemplates(),
      repository.getSubjectStructures(),
      repository.getAllMoods(),
      repository.getTrash(),
      repository.getSpacedRepetitions(),
    ]);

    setTasks(loadedTasks);
    setCategories(loadedCats);
    setProfile(loadedProf);
    setSettings(loadedSettings);
    setAchievements(loadedAchs);
    setTemplates(loadedTemplates);
    setWorkoutTemplates(loadedWorkoutTpls);
    setSubjectStructures(loadedStructures);
    setMoods(loadedMoods);
    setTrash(loadedTrash);
    setSpacedReps(loadedSpaced);

    if (!loadedSettings.onboardingCompleted) {
      setIsOnboardingOpen(true);
    }

    // Apply dark/light theme on root
    if (loadedSettings.theme === 'dark' || (loadedSettings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Toast notification helper
  const showToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = generateUUID();
    setToasts(prev => [...prev, { ...msg, id }]);
  }, []);

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Find currently active task object
  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === activeTaskId) || null;
  }, [tasks, activeTaskId]);

  const activeCategory = useMemo(() => {
    if (!activeTask) return categories[0] || DEFAULT_CATEGORIES[0];
    return categories.find(c => c.id === activeTask.categoryId) || categories[0] || DEFAULT_CATEGORIES[0];
  }, [activeTask, categories]);

  // Calculate live elapsed seconds for active task
  const [currentTickElapsed, setCurrentTickElapsed] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (activeTimerRunning && timerStartTime) {
      interval = setInterval(() => {
        const delta = Math.floor((Date.now() - timerStartTime) / 1000);
        setCurrentTickElapsed(accumulatedTimerSeconds + delta);
      }, 500);
    } else {
      setCurrentTickElapsed(accumulatedTimerSeconds);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimerRunning, timerStartTime, accumulatedTimerSeconds]);

  // Dynamic Browser Favicon & Title Sync
  useEffect(() => {
    if (activeTask && activeTimerRunning) {
      const timeStr = formatSecondsToDigital(currentTickElapsed);
      updateDynamicFavicon(true, timeStr);
      const catName = activeCategory?.name || 'Foco';
      document.title = `▶ ${timeStr} · ${catName} | Plataforma Mendonça`;
    } else {
      updateDynamicFavicon(false);
      document.title = 'Plataforma Mendonça · Cockpit de Estudos & Produtividade';
    }
  }, [activeTimerRunning, activeTask, currentTickElapsed, activeCategory]);

  // XP & Gamification helper
  const addXP = useCallback(async (amount: number) => {
    if (!profile) return;
    const currentXP = profile.xp || 0;
    const newXP = currentXP + amount;
    const levelInfo = calculateLevelFromXP(newXP);
    const newLevel = levelInfo.level;
    const todayXP = (profile.xpHistory?.[todayISO] || 0) + amount;

    const updated = await repository.updateProfile({
      xp: newXP,
      level: newLevel,
      xpHistory: {
        ...(profile.xpHistory || {}),
        [todayISO]: todayXP,
      },
      lastActiveDate: todayISO,
    });
    setProfile(updated);

    if (newLevel > profile.level) {
      audioSynthesizer.playLevelUp();
      setConfettiActive(true);
      showToast({
        text: `Parabéns! Você alcançou o Nível ${newLevel} na Plataforma Mendonça!`,
        type: 'success',
      });
      sendBrowserNotification('Nível Avançado! 🌟', {
        body: `Parabéns! Você alcançou o Nível ${newLevel} na Plataforma Mendonça!`,
      });
    }
  }, [profile, todayISO, showToast]);

  // Start / Toggle Timer for a specific task
  const handleStartTimer = useCallback((task: Task) => {
    lastUserInteractionTime.current = Date.now();
    requestNotificationPermission();

    if (activeTaskId === task.id) {
      if (activeTimerRunning) {
        // Pause timer
        const delta = timerStartTime ? Math.floor((Date.now() - timerStartTime) / 1000) : 0;
        const total = accumulatedTimerSeconds + delta;
        setAccumulatedTimerSeconds(total);
        setActiveTimerRunning(false);
        setTimerStartTime(null);
        repository.saveTask({ ...task, spentSeconds: total });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, spentSeconds: total } : t));
        audioSynthesizer.playTimerPause();
        showToast({ text: `Cronômetro pausado: ${task.title}` });
      } else {
        // Resume timer
        setTimerStartTime(Date.now());
        setActiveTimerRunning(true);
        audioSynthesizer.playTimerStart();
        showToast({ text: `Foco retomado: ${task.title}`, type: 'success' });
      }
    } else {
      // Switch task timer
      if (activeTask && activeTimerRunning) {
        const delta = timerStartTime ? Math.floor((Date.now() - timerStartTime) / 1000) : 0;
        const total = accumulatedTimerSeconds + delta;
        repository.saveTask({ ...activeTask, spentSeconds: total });
        setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, spentSeconds: total } : t));
      }

      setActiveTaskId(task.id);
      setAccumulatedTimerSeconds(task.spentSeconds || 0);
      setTimerStartTime(Date.now());
      setActiveTimerRunning(true);
      audioSynthesizer.playTimerStart();
      showToast({ text: `Foco iniciado: ${task.title}`, type: 'success' });
    }
  }, [activeTaskId, activeTimerRunning, timerStartTime, accumulatedTimerSeconds, activeTask, showToast]);

  // Toggle active timer from header or spacebar
  const handleToggleActiveTimer = useCallback(() => {
    if (!activeTask) {
      const topTask = tasks.find(t => !t.completed && t.date === todayISO);
      if (topTask) {
        handleStartTimer(topTask);
      } else {
        showToast({ text: 'Selecione ou crie uma tarefa para focar!' });
      }
      return;
    }
    handleStartTimer(activeTask);
  }, [activeTask, tasks, todayISO, handleStartTimer, showToast]);

  // Toggle Complete Task
  const handleToggleComplete = useCallback(async (task: Task, note?: string) => {
    lastUserInteractionTime.current = Date.now();
    const isCompleted = !task.completed;
    const now = new Date().toISOString();

    let finalSpent = task.spentSeconds || 0;
    if (activeTaskId === task.id && activeTimerRunning && timerStartTime) {
      const delta = Math.floor((Date.now() - timerStartTime) / 1000);
      finalSpent += delta;
      setActiveTimerRunning(false);
      setTimerStartTime(null);
      setAccumulatedTimerSeconds(finalSpent);
    }

    const updatedTaskData: Task = {
      ...task,
      completed: isCompleted,
      completedAt: isCompleted ? now : undefined,
      spentSeconds: finalSpent,
      reflectionNote: note || task.reflectionNote,
      updatedAt: now,
    };

    const saved = await repository.saveTask(updatedTaskData);
    setTasks(prev => prev.map(t => t.id === task.id ? saved : t));

    if (selectedTaskForDrawer?.id === task.id) {
      setSelectedTaskForDrawer(saved);
    }

    if (isCompleted) {
      audioSynthesizer.playTaskComplete();
      let earnedXP = 20;
      if (task.isTop3) earnedXP += 15;
      if (task.priority === 'alta') earnedXP += 10;
      if (finalSpent >= 1500) earnedXP += 15; // 25+ min

      addXP(earnedXP);
      showToast({
        text: `Tarefa Concluída! +${earnedXP} XP adicionados ao seu perfil!`,
        type: 'success',
      });
    }
  }, [activeTaskId, activeTimerRunning, timerStartTime, addXP, showToast, selectedTaskForDrawer]);

  // Save / Update Task handler
  const handleSaveTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const saved = await repository.saveTask(taskData);
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });

    if (selectedTaskForDrawer?.id === saved.id) {
      setSelectedTaskForDrawer(saved);
    }

    showToast({ text: taskData.id ? 'Tarefa atualizada!' : 'Tarefa criada com sucesso!', type: 'success' });
  }, [showToast, selectedTaskForDrawer]);

  // Batch Update Tasks
  const handleBatchUpdateTasks = useCallback(async (taskIds: string[], updates: Partial<Task>) => {
    const toUpdate = tasks.filter(t => taskIds.includes(t.id)).map(t => ({
      ...t,
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
    await repository.saveTasksBatch(toUpdate);
    setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, ...updates } : t));
    showToast({ text: `${taskIds.length} tarefas atualizadas com sucesso!`, type: 'success' });
  }, [tasks, showToast]);

  // Batch Delete Tasks
  const handleBatchDeleteTasks = useCallback(async (taskIds: string[]) => {
    for (const id of taskIds) {
      await repository.softDeleteTask(id);
    }
    setTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
    showToast({ text: `${taskIds.length} tarefas enviadas para a lixeira.` });
  }, [showToast]);

  // Delete single task
  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (activeTaskId === taskId) {
      setActiveTimerRunning(false);
      setActiveTaskId(null);
      setTimerStartTime(null);
    }
    await repository.softDeleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (selectedTaskForDrawer?.id === taskId) {
      setIsDrawerOpen(false);
      setSelectedTaskForDrawer(null);
    }
    showToast({ text: 'Tarefa enviada para a lixeira (recuperável por 30 dias).' });
  }, [activeTaskId, selectedTaskForDrawer, showToast]);

  // Toggle Top 3
  const handleToggleTop3 = useCallback(async (task: Task) => {
    const updated = await repository.saveTask({ ...task, isTop3: !task.isTop3 });
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    if (selectedTaskForDrawer?.id === task.id) setSelectedTaskForDrawer(updated);
  }, [selectedTaskForDrawer]);

  // Toggle Pin
  const handleTogglePin = useCallback(async (task: Task) => {
    const updated = await repository.saveTask({ ...task, pinned: !task.pinned });
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    if (selectedTaskForDrawer?.id === task.id) setSelectedTaskForDrawer(updated);
  }, [selectedTaskForDrawer]);

  // Move task date
  const handleMoveTaskDate = useCallback(async (taskId: string, newDate: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updated = await repository.saveTask({ ...task, date: newDate });
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    showToast({ text: `Tarefa agendada para ${newDate === todayISO ? 'Hoje' : newDate}` });
  }, [tasks, todayISO, showToast]);

  // Toggle Subtask
  const handleToggleSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedSubtasks = (task.subtasks || []).map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    const updated = await repository.saveTask({ ...task, subtasks: updatedSubtasks });
    setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    if (selectedTaskForDrawer?.id === taskId) setSelectedTaskForDrawer(updated);
  }, [tasks, selectedTaskForDrawer]);

  // Save Mood
  const handleSaveMood = useCallback(async (moodVal: DailyMood['mood'], energyVal: number, noteVal?: string) => {
    const newMood: DailyMood = {
      date: todayISO,
      mood: moodVal,
      energy: energyVal,
      note: noteVal,
      createdAt: new Date().toISOString(),
    };
    await repository.saveDailyMood(newMood);
    setMoods(prev => ({ ...prev, [todayISO]: newMood }));
    showToast({ text: 'Registro de humor e energia salvo!', type: 'success' });
  }, [todayISO, showToast]);

  // Save Subject Curriculum Structure
  const handleSaveSubjectStructure = useCallback(async (structure: SubjectStructure) => {
    await repository.saveSubjectStructure(structure);
    setSubjectStructures(prev => {
      const idx = prev.findIndex(s => s.categoryId === structure.categoryId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = structure;
        return next;
      }
      return [...prev, structure];
    });
    showToast({ text: 'Grade curricular da matéria atualizada!', type: 'success' });
  }, [showToast]);

  // Create Task from Curriculum Topic
  const handleCreateTaskFromTopic = useCallback((category: Category, module: Module, topic: Topic) => {
    setTaskToEdit({
      id: undefined as any,
      title: `Estudo: ${topic.name} (${module.name})`,
      categoryId: category.id,
      priority: 'alta',
      date: todayISO,
      estimatedMinutes: 45,
      spentSeconds: 0,
      completed: false,
      tags: ['estudo', 'edital'],
      subtasks: [
        { id: generateUUID(), title: 'Revisar teoria e conceitos essenciais', completed: false },
        { id: generateUUID(), title: 'Resolver 10 exercícios práticos', completed: false },
        { id: generateUUID(), title: 'Registrar dúvidas e erros no resumo', completed: false },
      ],
      details: {
        type: 'estudo',
        moduleId: module.id,
        moduleName: module.name,
        topicId: topic.id,
        topicName: topic.name,
        studyType: 'teoria',
        questionsDone: 0,
        questionsCorrect: 0,
      },
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsTaskModalOpen(true);
  }, [todayISO]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') {
          (target as HTMLInputElement).blur();
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleActiveTimer();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setTaskToEdit(null);
        setModalInitialDate(todayISO);
        setIsTaskModalOpen(true);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const topTask = tasks.find(t => !t.completed && t.date === todayISO);
        if (topTask) {
          setSelectedTaskForDrawer(topTask);
          setIsDrawerOpen(true);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (activeTask) {
          e.preventDefault();
          setIsFocusModeOpen(prev => !prev);
        }
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setCurrentTab('hoje');
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key === 'Escape') {
        setIsTaskModalOpen(false);
        setIsFocusModeOpen(false);
        setIsCommandPaletteOpen(false);
        setIsSettingsOpen(false);
        setIsShortcutsOpen(false);
        setIsWhatToDoOpen(false);
        setIsPlanWeekOpen(false);
        setIsTemplatesOpen(false);
        setIsCloseDayOpen(false);
        setIsFreeFocusOpen(false);
        setIsInactivityPromptOpen(false);
        setIsDrawerOpen(false);
        setIsCurriculumOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Toggle Theme
  const handleToggleTheme = async () => {
    if (!settings) return;
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = await repository.updateSettings({ theme: nextTheme });
    setSettings(updated);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // What to do now recommendation
  const recommendation = useMemo(() => {
    return recommendNextTask(tasks, todayISO, profile?.studyMode || 'regular');
  }, [tasks, todayISO, profile?.studyMode]);

  // Onboarding Complete
  const handleCompleteOnboarding = async (
    name: string,
    avatar: string,
    studyMode: StudyMode,
    subjectNames: string[],
    loadSampleTasks: boolean
  ) => {
    const updatedProfile = await repository.updateProfile({ name, avatar, studyMode });
    const updatedSettings = await repository.updateSettings({ onboardingCompleted: true });

    const colors = ['#8B5CF6', '#06B6D4', '#EC4899', '#F97316', '#10B981', '#6366F1'];
    for (let i = 0; i < subjectNames.length; i++) {
      const subName = subjectNames[i];
      if (!categories.some(c => c.name.toLowerCase() === subName.toLowerCase())) {
        await repository.saveCategory({
          id: 'cat-' + generateUUID(),
          name: subName,
          color: colors[i % colors.length],
          icon: 'book',
          isCustom: true,
        });
      }
    }

    if (loadSampleTasks) {
      const sampleTasks: Task[] = [
        {
          id: generateUUID(),
          title: 'Revisar fórmulas e conceitos principais',
          categoryId: 'cat-estudo',
          priority: 'alta',
          date: todayISO,
          time: '09:00',
          estimatedMinutes: 45,
          spentSeconds: 0,
          completed: false,
          isTop3: true,
          tags: ['exemplo', 'revisão'],
          subtasks: [
            { id: generateUUID(), title: 'Leitura atenta dos tópicos', completed: false },
            { id: generateUUID(), title: 'Criar 3 flashcards', completed: false },
          ],
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: generateUUID(),
          title: 'Treino de Força: Peito e Tríceps',
          categoryId: 'cat-saude',
          priority: 'media',
          date: todayISO,
          time: '17:30',
          estimatedMinutes: 60,
          spentSeconds: 0,
          completed: false,
          isTop3: false,
          tags: ['saúde', 'treino'],
          details: {
            type: 'treino_forca',
            muscleGroup: 'peito',
            exercises: [
              { id: 'ex-sample-1', name: 'Supino Reto', sets: 4, reps: '10', loadKg: 50, restSec: 60, setsDone: [false, false, false, false] },
              { id: 'ex-sample-2', name: 'Tríceps Corda', sets: 3, reps: '12', loadKg: 20, restSec: 45, setsDone: [false, false, false] },
            ]
          },
          subtasks: [],
          order: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];
      await repository.saveTasksBatch(sampleTasks);
    }

    setProfile(updatedProfile);
    setSettings(updatedSettings);
    await loadInitialData();
    setIsOnboardingOpen(false);
    showToast({ text: `Bem-vindo(a), ${name}! Plataforma configurada com sucesso. 🚀`, type: 'success' });
  };

  const overdueTasks = useMemo(() => {
    return tasks.filter(t => !t.completed && t.date < todayISO);
  }, [tasks, todayISO]);

  const todayStudiedMinutes = useMemo(() => {
    const todayTasks = tasks.filter(t => t.date === todayISO);
    const totalSecs = todayTasks.reduce((acc, t) => acc + (t.spentSeconds || 0), 0);
    return Math.round(totalSecs / 60);
  }, [tasks, todayISO]);


  if (!profile || !settings) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/30">
            M
          </div>
          <span className="text-sm font-bold text-[var(--texto-suave)]">Carregando Plataforma Mendonça...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--texto)] flex flex-col antialiased selection:bg-blue-500/20 selection:text-blue-600 transition-colors duration-200">
      
      {/* Toast Notifications & Confetti */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      <MicroConfetti active={confettiActive} onDone={() => setConfettiActive(false)} />
      <OfflineIndicator />

      {/* Floating Picture-in-Picture Mini Timer */}
      <FloatingMiniTimer
        activeTask={activeTask}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={currentTickElapsed}
        category={activeCategory}
        onToggleTimer={handleToggleActiveTimer}
        onOpenFullscreenFocus={() => setIsFocusModeOpen(true)}
      />

      {/* Global Header (72px) */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
        activeTask={activeTask}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={currentTickElapsed}
        onToggleActiveTimer={handleToggleActiveTimer}
        onStopActiveTimer={handleToggleActiveTimer}
        onOpenFullscreenFocus={() => setIsFocusModeOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsSettingsOpen(true)}
        profile={profile}
        settings={settings}
        categories={categories}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto p-3 sm:p-5 lg:p-6 pb-24 lg:pb-8 flex flex-col gap-5 sm:gap-6">
        
        {/* Welcome & Study Mode Card */}
        <WelcomeCard
          profile={profile}
          onWhatToDoNow={() => setIsWhatToDoOpen(true)}
          onChangeStudyMode={async (mode) => {
            const updated = await repository.updateProfile({ studyMode: mode });
            setProfile(updated);
            showToast({ text: `Modo de estudo alterado para ${STUDY_MODES[mode]?.name || mode} (Meta: ${STUDY_MODES[mode]?.dailyXpGoal || 400} XP/dia)` });
          }}
          todayStudiedMinutes={todayStudiedMinutes}
        />

        {/* Rollover Overdue Banner */}
        {!dismissedOverdue && (
          <RolloverBanner
            overdueTasks={overdueTasks}
            onDismissOverdue={() => setDismissedOverdue(true)}
            onMoveAllToToday={async () => {
              const overdueIds = overdueTasks.map(t => t.id);
              const toUpdate = overdueTasks.map(t => ({ ...t, date: todayISO }));
              await repository.saveTasksBatch(toUpdate);
              setTasks(prev => prev.map(t => overdueIds.includes(t.id) ? { ...t, date: todayISO } : t));
              setDismissedOverdue(true);
              showToast({ text: `${overdueTasks.length} tarefas reagendadas para Hoje!` });
            }}
          />
        )}

        {/* Content Area with Sidebar */}
        <div className="flex items-start gap-4 sm:gap-6 flex-1">
          
          {/* Quick Tools Sidebar (96px) */}
          <Sidebar
            onQuickNewTask={() => {
              setTaskToEdit(null);
              setModalInitialDate(todayISO);
              setIsTaskModalOpen(true);
            }}
            onOpenFocusMode={() => {
              if (activeTask) setIsFocusModeOpen(true);
              else showToast({ text: 'Inicie o foco em uma tarefa primeiro!' });
            }}
            onOpenFreeFocus={() => setIsFreeFocusOpen(true)}
            onOpenCloseDay={() => setIsCloseDayOpen(true)}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
            onOpenSpacedRep={() => setCurrentTab('jornada')}
            onOpenCurriculum={() => setIsCurriculumOpen(true)}
            onOpenSettings={(section) => {
              setIsSettingsOpen(true);
            }}
          />

          {/* Dynamic Content Panel */}
          <div className="flex-1 min-w-0">
            {currentTab === 'hoje' ? (
              <DayDashboard
                tasks={tasks}
                categories={categories}
                profile={profile}
                settings={settings}
                activeTask={activeTask}
                activeTimerRunning={activeTimerRunning}
                activeTimerElapsed={currentTickElapsed}
                dailyMood={moods[todayISO] || null}
                onToggleTimer={handleStartTimer}
                onToggleComplete={handleToggleComplete}
                onEditTask={(task) => {
                  setTaskToEdit(task);
                  setIsTaskModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
                onToggleTop3={handleToggleTop3}
                onTogglePin={handleTogglePin}
                onToggleSubtask={handleToggleSubtask}
                onAddTask={handleSaveTask}
                onSelectTab={(tab) => setCurrentTab(tab as any)}
                onSaveMood={handleSaveMood}
                onOpenTemplates={() => setIsTemplatesOpen(true)}
                onOpenFocusMode={() => setIsFocusModeOpen(true)}
              />
            ) : currentTab === 'tarefas' ? (
              <TasksInboxView
                tasks={tasks}
                categories={categories}
                activeTaskId={activeTaskId}
                activeTimerRunning={activeTimerRunning}
                activeTimerElapsed={currentTickElapsed}
                onToggleTimer={handleStartTimer}
                onToggleComplete={handleToggleComplete}
                onEditTask={(task) => {
                  if (task.id) {
                    handleSaveTask(task);
                  } else {
                    handleSaveTask(task);
                  }
                }}
                onDeleteTask={handleDeleteTask}
                onToggleTop3={handleToggleTop3}
                onTogglePin={handleTogglePin}
                onMoveTaskDate={handleMoveTaskDate}
                onQuickAddTask={(initDate, catId) => {
                  setTaskToEdit(null);
                  setModalInitialDate(initDate || undefined);
                  setIsTaskModalOpen(true);
                }}
                onSelectTaskToDrawer={(task) => {
                  setSelectedTaskForDrawer(task);
                  setIsDrawerOpen(true);
                }}
                onBatchUpdateTasks={handleBatchUpdateTasks}
                onBatchDeleteTasks={handleBatchDeleteTasks}
              />
            ) : currentTab === 'semana' ? (
              <WeekView
                tasks={tasks}
                categories={categories}
                profile={profile}
                settings={settings}
                activeTask={activeTask}
                activeTimerRunning={activeTimerRunning}
                activeTimerElapsed={currentTickElapsed}
                onToggleTimer={handleStartTimer}
                onToggleComplete={handleToggleComplete}
                onEditTask={(task) => {
                  setTaskToEdit(task);
                  setIsTaskModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
                onToggleTop3={handleToggleTop3}
                onTogglePin={handleTogglePin}
                onToggleSubtask={handleToggleSubtask}
                onMoveTaskDate={handleMoveTaskDate}
                onQuickAddTaskForDate={(dateISO) => {
                  setTaskToEdit(null);
                  setModalInitialDate(dateISO);
                  setIsTaskModalOpen(true);
                }}
                onPlanWeek={() => setIsPlanWeekOpen(true)}
                onExportICS={() => downloadICSFile(tasks, categories)}
                onOpenTemplates={() => setIsTemplatesOpen(true)}
              />
            ) : (
              <JourneyView
                tasks={tasks}
                categories={categories}
                profile={profile}
                moods={moods}
              />
            )}
          </div>

        </div>

      </main>

      {/* ======================================================== */}
      {/* DRAWERS & MODALS                                         */}
      {/* ======================================================== */}

      {/* Asana Style Task Detail Drawer */}
      <TaskDetailDrawer
        isOpen={isDrawerOpen}
        task={selectedTaskForDrawer}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTaskForDrawer(null);
        }}
        onUpdateTask={(updatedTask) => {
          handleSaveTask(updatedTask);
        }}
        onDeleteTask={(taskId) => {
          handleDeleteTask(taskId);
        }}
        onStartFocus={(task) => {
          handleStartTimer(task);
          setIsFocusModeOpen(true);
        }}
        categories={categories}
        subjectStructures={subjectStructures}
        workoutTemplates={workoutTemplates}
      />

      {/* Subjects Curriculum Modal (Fase 3B) */}
      <SubjectsCurriculumModal
        isOpen={isCurriculumOpen}
        onClose={() => setIsCurriculumOpen(false)}
        categories={categories}
        subjectStructures={subjectStructures}
        onSaveStructure={handleSaveSubjectStructure}
        onCreateTaskFromTopic={handleCreateTaskFromTopic}
      />

      {/* Close Day Modal ("Fechar o dia") */}
      <CloseDayModal
        isOpen={isCloseDayOpen}
        onClose={() => setIsCloseDayOpen(false)}
        tasks={tasks}
        profile={profile}
        onSaveDailyMood={handleSaveMood}
        onMoveTasksToTomorrow={async (taskIds) => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowISO = formatDateToISO(tomorrow);
          const toUpdate = tasks.filter(t => taskIds.includes(t.id)).map(t => ({ ...t, date: tomorrowISO }));
          await repository.saveTasksBatch(toUpdate);
          setTasks(prev => prev.map(t => taskIds.includes(t.id) ? { ...t, date: tomorrowISO } : t));
          showToast({ text: `${taskIds.length} tarefas movidas para amanhã!` });
        }}
        onCreateTomorrowTask={async (title) => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowISO = formatDateToISO(tomorrow);
          await handleSaveTask({
            title,
            categoryId: categories[0]?.id || 'cat-estudo',
            priority: 'alta',
            date: tomorrowISO,
            isTop3: true,
            spentSeconds: 0,
            completed: false,
            tags: ['planejado'],
            subtasks: [],
            order: 0,
          });
        }}
        onCompleteDay={() => {
          addXP(20);
          setConfettiActive(true);
          showToast({ text: 'Dia fechado com sucesso (+20 XP)! Bom descanso. 🌙', type: 'success' });
        }}
      />

      {/* Free Focus Modal ("Foco livre") */}
      <FreeFocusModal
        isOpen={isFreeFocusOpen}
        onClose={() => setIsFreeFocusOpen(false)}
        categories={categories}
        onSaveFreeSession={async (title, categoryId, durationSeconds, note) => {
          const saved = await repository.saveTask({
            title,
            categoryId,
            priority: 'media',
            date: todayISO,
            spentSeconds: durationSeconds,
            completed: true,
            completedAt: new Date().toISOString(),
            reflectionNote: note,
            tags: ['foco-livre'],
            subtasks: [],
            order: tasks.length,
          });
          setTasks(prev => [saved, ...prev]);
          const earnedXP = Math.max(10, Math.floor(durationSeconds / 60));
          addXP(earnedXP);
          showToast({ text: `Sessão de foco livre salva (+${earnedXP} XP)! 🎉`, type: 'success' });
        }}
      />

      {/* Inactivity Prompt Modal */}
      <InactivityPromptModal
        isOpen={isInactivityPromptOpen}
        onClose={() => setIsInactivityPromptOpen(false)}
        activeTask={activeTask}
        elapsedSeconds={currentTickElapsed}
        onConfirmStillFocused={() => {
          lastUserInteractionTime.current = Date.now();
        }}
        onPauseWithNote={(note) => {
          handleToggleActiveTimer();
          if (note && activeTask) {
            handleSaveTask({ ...activeTask, reflectionNote: note });
          }
        }}
        onCompleteWithNote={(note) => {
          if (activeTask) {
            handleToggleComplete(activeTask, note);
          }
        }}
      />

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        categories={categories}
        initialDate={modalInitialDate}
      />

      {/* Fullscreen Focus Mode */}
      <FullscreenFocusMode
        isOpen={isFocusModeOpen}
        onClose={() => setIsFocusModeOpen(false)}
        activeTask={activeTask}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={currentTickElapsed}
        onToggleTimer={handleToggleActiveTimer}
        onCompleteTask={handleToggleComplete}
        category={activeCategory}
        pomodoroSettings={settings.pomodoro}
        onUpdatePomodoroSettings={async (pom) => {
          const updated = await repository.updateSettings({ pomodoro: pom });
          setSettings(updated);
        }}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tasks={tasks}
        categories={categories}
        onSelectTab={(tab) => setCurrentTab(tab as any)}
        onStartTimer={(task) => {
          handleStartTimer(task);
          setIsFocusModeOpen(true);
        }}
        onToggleTheme={handleToggleTheme}
        onExportJSON={async () => {
          const json = await repository.exportFullDatabaseJSON();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `plataforma_mendonca_backup_${todayISO}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast({ text: 'Backup exportado com sucesso!', type: 'success' });
        }}
        onExportICS={() => {
          downloadICSFile(tasks, categories);
          showToast({ text: 'Calendário .ICS exportado com sucesso!', type: 'success' });
        }}
        onOpenFocusMode={() => setIsFocusModeOpen(true)}
        onPlanWeek={() => setIsPlanWeekOpen(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        categories={categories}
        profile={profile}
        trash={trash}
        onUpdateSettings={async (s) => {
          const updated = await repository.updateSettings(s);
          setSettings(updated);
        }}
        onSaveCategory={async (cat) => {
          const saved = await repository.saveCategory(cat);
          setCategories(prev => {
            const idx = prev.findIndex(c => c.id === saved.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = saved;
              return next;
            }
            return [...prev, saved];
          });
        }}
        onDeleteCategory={async (id) => {
          await repository.deleteCategory(id);
          setCategories(prev => prev.filter(c => c.id !== id));
        }}
        onExportJSON={async () => {
          const json = await repository.exportFullDatabaseJSON();
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `plataforma_mendonca_backup_${todayISO}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast({ text: 'Backup exportado com sucesso!', type: 'success' });
        }}
        onImportJSON={async (json) => {
          const success = await repository.importFullDatabaseJSON(json);
          if (success) {
            await loadInitialData();
            showToast({ text: 'Backup restaurado com sucesso!', type: 'success' });
          } else {
            showToast({ text: 'Erro ao importar backup. Arquivo inválido.', type: 'warning' });
          }
        }}
        onExportICS={() => {
          downloadICSFile(tasks, categories);
          showToast({ text: 'Calendário .ICS exportado com sucesso!', type: 'success' });
        }}
        onResetDemo={async () => {
          await repository.resetToDemo();
          await loadInitialData();
          showToast({ text: 'Banco restaurado para o padrão inicial.' });
        }}
        onRestoreTrashTask={async (id) => {
          const restored = await repository.restoreTask(id);
          if (restored) {
            setTasks(prev => [...prev, restored]);
            setTrash(prev => prev.filter(t => t.id !== id));
            showToast({ text: 'Tarefa restaurada com sucesso!', type: 'success' });
          }
        }}
        onEmptyTrash={async () => {
          await repository.emptyTrash();
          setTrash([]);
          showToast({ text: 'Lixeira esvaziada permanentemente.' });
        }}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* What To Do Modal */}
      <WhatToDoModal
        isOpen={isWhatToDoOpen}
        onClose={() => setIsWhatToDoOpen(false)}
        recommendation={recommendation}
        category={recommendation.task ? categories.find(c => c.id === recommendation.task?.categoryId) : undefined}
        onStartFocus={(task) => {
          handleStartTimer(task);
          setIsFocusModeOpen(true);
        }}
      />

      {/* Plan Week Modal */}
      <PlanWeekModal
        isOpen={isPlanWeekOpen}
        onClose={() => setIsPlanWeekOpen(false)}
        tasks={tasks}
        categories={categories}
        profile={profile}
        firstDayOfWeek={settings.firstDayOfWeek || 1}
        onApplyPlan={async (reallocatedTasks) => {
          await repository.saveTasksBatch(reallocatedTasks);
          setTasks(prev => {
            const reallocatedMap = new Map(reallocatedTasks.map(t => [t.id, t]));
            return prev.map(t => reallocatedMap.get(t.id) || t);
          });
          setIsPlanWeekOpen(false);
          showToast({ text: `${reallocatedTasks.length} tarefas redistribuídas na semana!`, type: 'success' });
        }}
      />

      {/* Templates Modal */}
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        templates={templates}
        categories={categories}
        onApplyTemplate={async (template) => {
          const newTasks: Task[] = template.tasks.map(t => ({
            id: generateUUID(),
            title: t.title,
            categoryId: t.categoryId,
            priority: t.priority,
            date: todayISO,
            time: t.time,
            estimatedMinutes: t.estimatedMinutes,
            spentSeconds: 0,
            completed: false,
            tags: [...t.tags],
            subtasks: [],
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          await repository.saveTasksBatch(newTasks);
          setTasks(prev => [...prev, ...newTasks]);
          setIsTemplatesOpen(false);
          showToast({ text: `Modelo "${template.name}" aplicado para hoje!`, type: 'success' });
        }}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={handleCompleteOnboarding}
      />

    </div>
  );
}
