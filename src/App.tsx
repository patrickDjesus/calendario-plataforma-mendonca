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
  WorkoutTemplate,
  Subject,
  Topic,
  StudyGoal,
  ReviewItem,
  QuestionLog,
  ErrorNote
} from './types';
import { repository, DEFAULT_CATEGORIES, generateUUID } from './services/repository';
import {
  cloudSync,
  SyncKeyRequiredError,
  CloudUnavailableError,
  CloudDataCorruptedError,
  type SyncStatus,
} from './services/supabase';
import { hasSyncKey, setSyncKey, clearSyncKey } from './services/syncKey';
import { audioSynthesizer } from './services/audioSynthesizer';
import {
  isRecurring,
  isVirtualId,
  baseId,
  occurrenceDate,
  taskForDate,
  tasksForDate,
  withOccurrenceCompleted,
  withOccurrenceRemoved,
  withOccurrenceSpent,
  spentSecondsOn,
} from './services/recurrence';
import { CloudOff, Loader2, AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';

/* Transição Elástica: Física de rebote pop dinâmico com descompressão suave */
const pageVariants: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    scale: 0.84,
    y: direction > 0 ? 55 : -55,
    rotateZ: direction > 0 ? 3 : -3,
    filter: 'blur(7px)',
  }),
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotateZ: 0,
    filter: 'blur(0px)',
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 19,
      mass: 0.7,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    scale: 0.86,
    y: direction > 0 ? -45 : 45,
    rotateZ: direction > 0 ? -2.5 : 2.5,
    filter: 'blur(7px)',
    transition: {
      duration: 0.19,
      ease: [0.4, 0, 1, 1] as const,
    },
  }),
};

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Fases da carga: sem nuvem nao ha app, entao isso e estado de verdade. */
type BootState =
  | { phase: 'loading' }
  | { phase: 'needs-key' }
  | { phase: 'offline'; detalhe: string }
  | { phase: 'corrompido'; detalhe: string; userId: string }
  | { phase: 'ready' };
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
import { FullscreenFocusMode } from './components/FullscreenFocusMode';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { WhatToDoModal } from './components/WhatToDoModal';
import { PlanWeekModal } from './components/PlanWeekModal';
import { TemplatesModal } from './components/TemplatesModal';
import { OnboardingModal } from './components/OnboardingModal';
import { SyncKeyGate } from './components/SyncKeyGate';
import { RolloverBanner } from './components/RolloverBanner';
import { CloseDayModal } from './components/CloseDayModal';
import { InactivityPromptModal } from './components/InactivityPromptModal';
import { FloatingMiniTimer } from './components/FloatingMiniTimer';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ToastContainer, ToastMessage } from './components/ToastContainer';
import { MicroConfetti } from './components/MicroConfetti';
import { CoverScreen } from './components/CoverScreen';
import { getTodayISO, formatDateToISO, formatSecondsToDigital, getISOWeek } from './utils/dateUtils';
import { recommendNextTask, checkAchievements, calculateLevelFromXP, calculateStreak, STUDY_MODES } from './utils/xpSystem';
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
  const [moods, setMoods] = useState<Record<string, DailyMood>>({});
  const [trash, setTrash] = useState<Array<Task & { originalDeletedAt: string }>>([]);
  const [spacedReps, setSpacedReps] = useState<SpacedRepetitionItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [studyGoals, setStudyGoals] = useState<StudyGoal[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [questionLogs, setQuestionLogs] = useState<QuestionLog[]>([]);
  const [errorNotes, setErrorNotes] = useState<ErrorNote[]>([]);

  // Navigation & UI state
  const [showCover, setShowCover] = useState(true);
  const [currentTab, setCurrentTab] = useState<'hoje' | 'tarefas' | 'semana' | 'jornada'>('hoje');
  const [tabDirection, setTabDirection] = useState<number>(0);
  const shouldReduceMotion = useReducedMotion();

  const handleSelectTab = useCallback((newTab: string) => {
    const validTabs: Array<'hoje' | 'tarefas' | 'semana' | 'jornada'> = ['hoje', 'tarefas', 'semana', 'jornada'];
    if (!validTabs.includes(newTab as any)) return;
    const target = newTab as 'hoje' | 'tarefas' | 'semana' | 'jornada';
    if (target === currentTab) return;
    const tabOrder: Record<'hoje' | 'tarefas' | 'semana' | 'jornada', number> = {
      hoje: 0,
      tarefas: 1,
      semana: 2,
      jornada: 3,
    };
    const prevOrder = tabOrder[currentTab] ?? 0;
    const nextOrder = tabOrder[target] ?? 0;
    setTabDirection(nextOrder >= prevOrder ? 1 : -1);
    setCurrentTab(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confettiActive, setConfettiActive] = useState(false);
  const [dismissedOverdue, setDismissedOverdue] = useState(false);

  // Modals & Drawers state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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
  const [isInactivityPromptOpen, setIsInactivityPromptOpen] = useState(false);

  // Active Timer state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTimerRunning, setActiveTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const [accumulatedTimerSeconds, setAccumulatedTimerSeconds] = useState(0);

  // Inactivity tracking
  const lastUserInteractionTime = useRef<number>(Date.now());
  const hasRestoredTimerRef = useRef(false);

  // "Aviso sonoro" e um portao global no sintetizador: efeito de som respeita a
  // preferencia, ambiente e trilha do modo foco nao (sao som de fundo, nao aviso).
  useEffect(() => {
    audioSynthesizer.setSoundEnabled(settings?.pomodoro?.soundEnabled ?? true);
  }, [settings?.pomodoro?.soundEnabled]);

  const todayISO = getTodayISO();

  // ==== BOOT: a nuvem e a fonte, entao a carga pode falhar de verdade ====
  const [boot, setBoot] = useState<BootState>(
    hasSyncKey() ? { phase: 'loading' } : { phase: 'needs-key' }
  );

  /** Falha de carga vira uma tela explicita — nunca um banco ficticio em silencio. */
  const handleBootError = useCallback((err: unknown) => {
    if (err instanceof SyncKeyRequiredError) {
      setBoot({ phase: 'needs-key' });
      return;
    }
    if (err instanceof CloudDataCorruptedError) {
      // Nao se resolve com "tentar de novo": so o painel do Supabase ve a linha.
      setBoot({
        phase: 'corrompido',
        detalhe:
          'Seu banco esta no Supabase, mas o conteudo dele chegou incompleto. ' +
          'Nao vou abrir um banco vazio por cima disso e fingir que esta tudo bem.',
        userId: err.userId,
      });
      return;
    }
    const detalhe = err instanceof CloudUnavailableError
      ? 'Nao consegui falar com o Supabase. Sem ele nao existe onde salvar.'
      : 'Erro inesperado ao carregar seu banco.';
    setBoot({ phase: 'offline', detalhe });
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [
        loadedTasks,
        loadedCats,
        loadedProf,
        loadedSettings,
        loadedAchs,
        loadedTemplates,
        loadedWorkoutTpls,
        loadedMoods,
        loadedTrash,
        loadedSpaced,
        loadedSubjects,
        loadedTopics,
        loadedGoals,
        loadedReviewItems,
        loadedQuestionLogs,
        loadedErrorNotes,
      ] = await Promise.all([
        repository.getTasks(),
        repository.getCategories(),
        repository.getProfile(),
        repository.getSettings(),
        repository.getAchievements(),
        repository.getTemplates(),
        repository.getWorkoutTemplates(),
        repository.getAllMoods(),
        repository.getTrash(),
        repository.getSpacedRepetitions(),
        repository.getSubjects(),
        repository.getTopics(),
        repository.getGoals(),
        repository.getReviewItems(),
        repository.getQuestionLogs(),
        repository.getErrorNotes(),
      ]);

      setTasks(loadedTasks);
      setCategories(loadedCats);
      setProfile(loadedProf);
      setSettings(loadedSettings);
      setAchievements(loadedAchs);
      setTemplates(loadedTemplates);
      setWorkoutTemplates(loadedWorkoutTpls);
      setMoods(loadedMoods);
      setTrash(loadedTrash);
      setSpacedReps(loadedSpaced);
      setSubjects(loadedSubjects);
      setTopics(loadedTopics);
      setStudyGoals(loadedGoals);
      setReviewItems(loadedReviewItems);
      setQuestionLogs(loadedQuestionLogs);
      setErrorNotes(loadedErrorNotes);

      setBoot({ phase: 'ready' });
      // Banco nasceu vazio? A unica explicacao possivel e chave sem linha na
      // nuvem. Dizer isso evita que o usuario conclua que perdeu os dados.
      setAvisoBancoVazio(repository.getBootOrigin() === 'criado-do-zero');

      if (!loadedSettings.onboardingCompleted) {
        setIsOnboardingOpen(true);
      }
    } catch (err) {
      handleBootError(err);
    }
  }, [handleBootError]);

  useEffect(() => {
    loadInitialData().catch(handleBootError);
  }, [loadInitialData, handleBootError]);

  const handleConnectKey = useCallback(async (key: string) => {
    setSyncKey(key);
    repository.reset();
    setBoot({ phase: 'loading' });
    await loadInitialData();
  }, [loadInitialData]);

  const handleRetryBoot = useCallback(() => {
    repository.reset();
    setBoot({ phase: 'loading' });
    loadInitialData().catch(handleBootError);
  }, [loadInitialData, handleBootError]);

  // ==== AVISO DE "NAO SALVO" ====
  // A nuvem e a fonte unica: se uma gravacao falhou, o usuario precisa ver isso
  // em vez de acreditar que salvou. Volta a sumir sozinho na proxima que der certo.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => cloudSync.getStatus());
  const [avisoBancoVazio, setAvisoBancoVazio] = useState(false);
  useEffect(() => cloudSync.onChange(setSyncStatus), []);

  useEffect(() => {
    const reenviar = () => { void repository.retryPendingSave(); };
    window.addEventListener('online', reenviar);
    return () => window.removeEventListener('online', reenviar);
  }, []);

  // Toast notification helper
  const showToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = generateUUID();
    setToasts(prev => [...prev, { ...msg, id }]);
  }, []);

  const handleRetrySave = useCallback(async () => {
    const ok = await repository.retryPendingSave();
    showToast({
      text: ok
        ? 'Salvo no Supabase.'
        : 'Ainda nao consegui salvar. Voce esta sem internet?',
      type: ok ? 'success' : 'warning',
    });
  }, [showToast]);

  /** Volta para a tela da chave. O banco no Supabase nao e tocado. */
  const handleTrocarChave = useCallback(() => {
    repository.reset();
    clearSyncKey();
    setProfile(null);
    setSettings(null);
    setIsSettingsOpen(false);
    setBoot({ phase: 'needs-key' });
  }, []);

  const handleDesconectar = useCallback(() => {
    clearSyncKey();
    handleTrocarChave();
    showToast({ text: 'Chave apagada deste navegador. O banco no Supabase segue intacto.' });
  }, [handleTrocarChave, showToast]);

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Find currently active task object
  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    if (isVirtualId(activeTaskId)) {
      const base = tasks.find(t => t.id === baseId(activeTaskId));
      const iso = occurrenceDate(activeTaskId);
      if (base && iso) {
        return taskForDate(base, iso);
      }
      return null;
    }
    return tasks.find(t => t.id === activeTaskId) || null;
  }, [tasks, activeTaskId]);

  const activeCategory = useMemo(() => {
    if (!activeTask) return categories[0] || DEFAULT_CATEGORIES[0];
    return categories.find(c => c.id === activeTask.categoryId) || categories[0] || DEFAULT_CATEGORIES[0];
  }, [activeTask, categories]);

  // Calculate live elapsed seconds for active task
  const [currentTickElapsed, setCurrentTickElapsed] = useState(0);

  // ==== POMODORO ====
  type PomodoroPhase = 'foco' | 'pausa_curta' | 'pausa_longa';
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('foco');
  const [completedFocusBlocks, setCompletedFocusBlocks] = useState(0);
  const [breakAccumulatedSeconds, setBreakAccumulatedSeconds] = useState(0);
  const [breakTickElapsed, setBreakTickElapsed] = useState(0);

  const pomodoroCfg = settings?.pomodoro;

  const phaseTargetSeconds = useMemo(() => {
    if (!pomodoroCfg) return 25 * 60;
    const minutes =
      pomodoroPhase === 'foco'
        ? pomodoroCfg.focusMinutes
        : pomodoroPhase === 'pausa_longa'
          ? pomodoroCfg.longBreakMinutes
          : pomodoroCfg.shortBreakMinutes;
    return Math.max(1, Number(minutes) || 1) * 60;
  }, [pomodoroCfg, pomodoroPhase]);

  /** O que o anel e o relogio do modo foco mostram: o bloco atual. */
  const displayElapsed = pomodoroPhase === 'foco' ? currentTickElapsed : breakTickElapsed;

  // Inicio (Date.now) do segmento atual: quando a fase em curso comecou ou foi
  // retomada. Cada fase tem um BANCO (`accumulatedTimerSeconds` para foco,
  // `breakAccumulatedSeconds` para pausa) mais um fragmento vivo medido aqui.
  const segmentStartRef = useRef<number | null>(null);
  // Timestamp ate onde o tempo de foco foi gravado no banco, para garantir que
  // cada segundo corrido seja salvo exatamente uma vez (sem perda e sem duplicacao).
  const lastFlushTimestampRef = useRef<number | null>(null);

  // Ticker: enquanto a fase roda, soma o segmento vivo ao banco da fase.
  useEffect(() => {
    let interval: any = null;
    if (activeTimerRunning && timerStartTime && segmentStartRef.current) {
      interval = setInterval(() => {
        const vivo = Math.floor((Date.now() - segmentStartRef.current!) / 1000);
        if (pomodoroPhase === 'foco') {
          setCurrentTickElapsed(accumulatedTimerSeconds + vivo);
        } else {
          setBreakTickElapsed(breakAccumulatedSeconds + vivo);
        }
      }, 500);
    } else {
      setCurrentTickElapsed(accumulatedTimerSeconds);
      setBreakTickElapsed(breakAccumulatedSeconds);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimerRunning, timerStartTime, accumulatedTimerSeconds, pomodoroPhase, breakAccumulatedSeconds]);


  // Dynamic Browser Favicon & Title Sync
  useEffect(() => {
    if (activeTask && activeTimerRunning) {
      const timeStr = formatSecondsToDigital(currentTickElapsed);
      updateDynamicFavicon(true, timeStr);
      const catName = activeCategory?.name || 'Foco';
      document.title = `▶ ${timeStr} · ${catName} | Plataforma Mendonça`;
    } else {
      updateDynamicFavicon(false);
      document.title = 'Plataforma Mendonça';
    }
  }, [activeTimerRunning, activeTask, currentTickElapsed, activeCategory]);

  // XP & Gamification helper
  const addXP = useCallback(async (amount: number) => {
    if (!profile) return;

    // A sequencia e a gamificacao andam juntas: quem desliga a gamificacao nao
    // espera ver streak subindo nem confete. `lastActiveDate` continua sendo
    // gravado, porque ele tambem resolve conflito de sincronizacao.
    const gamificacaoAtiva = settings?.gamificationEnabled ?? true;

    // Sequencia: antes de qualquer coisa, o dia de hoje ja conta.
    const antes = calculateStreak(
      profile.lastActiveDate,
      todayISO,
      profile.streak || 0,
      profile.streakShieldAvailable ?? true,
      profile.streakShieldLastUsedWeek,
    );

    const updated = await repository.updateProfile({
      lastActiveDate: todayISO,
      ...(gamificacaoAtiva
        ? {
            xp: (profile.xp || 0) + amount,
            level: calculateLevelFromXP((profile.xp || 0) + amount).level,
            xpHistory: {
              ...(profile.xpHistory || {}),
              [todayISO]: (profile.xpHistory?.[todayISO] || 0) + amount,
            },
            streak: antes.streak,
            longestStreak: Math.max(profile.longestStreak || 0, antes.streak),
            streakShieldAvailable: antes.shieldAvailable,
            streakShieldLastUsedWeek: antes.shieldUsed ? getISOWeek() : profile.streakShieldLastUsedWeek,
          }
        : {}),
    });
    setProfile(updated);

    if (!gamificacaoAtiva) return;

    if (antes.shieldUsed) {
      showToast({ text: 'Escudo usado: a sequencia foi salva mesmo com um dia pulado.' });
    }

    if (updated.level > profile.level) {
      audioSynthesizer.playLevelUp();
      setConfettiActive(true);
      showToast({
        text: `Parabéns! Você alcançou o Nível ${updated.level} na Plataforma Mendonça!`,
        type: 'success',
      });
      sendBrowserNotification('Nível Avançado! 🌟', {
        body: `Parabéns! Você alcançou o Nível ${updated.level} na Plataforma Mendonça!`,
      });
    }

    // Conquistas: o mesmo evento que da XP tambem avança o progresso delas.
    const focoTotal = tasks.reduce((acc, t) => acc + (t.spentSeconds || 0), 0);
    const { updated: achsAtualizados, newlyUnlocked: novasConquistas } = checkAchievements(achievements, updated, tasks, focoTotal);
    if (novasConquistas.length > 0) {
      setAchievements(achsAtualizados);
      void repository.updateAchievements(achsAtualizados);
      if (novasConquistas.length === 1) {
        showToast({ text: `Conquista desbloqueada: ${novasConquistas[0].title}! 🏆`, type: 'success' });
      } else {
        showToast({ text: `${novasConquistas.length} conquistas desbloqueadas! 🏆`, type: 'success' });
      }
    }
  }, [profile, todayISO, showToast, settings?.gamificationEnabled, achievements, tasks]);

  /**
   * A sequencia sozinha nao se arruma: `calculateStreak` so roda quando ha XP
   * ganho, entao quem abriu o app depois de dois dias ainda veria a sequencia
   * antiga. Aqui o valor e reconciliado quando o dia vira — e so grava quando
   * o numero realmente muda, para nao escrever na nuvem a cada abertura.
   */
  useEffect(() => {
    if (!profile) return;
    if ((settings?.gamificationEnabled ?? true) === false) return;

    // Se o dia de hoje já foi registrado em lastActiveDate, não recalcula/reescreve a streak
    if (profile.lastActiveDate === todayISO) return;

    // Proteção contra streak corrompido por loop infinito anterior
    let currentStreak = profile.streak || 0;
    const historyDates = Object.keys(profile.xpHistory || {});
    const maxReasonable = Math.max(14, historyDates.length + 7);
    if (currentStreak > maxReasonable && currentStreak > 30) {
      currentStreak = Math.max(1, historyDates.length);
    }

    const calculado = calculateStreak(
      profile.lastActiveDate,
      todayISO,
      currentStreak,
      profile.streakShieldAvailable ?? true,
      profile.streakShieldLastUsedWeek,
    );

    void repository.updateProfile({
      streak: calculado.streak,
      longestStreak: Math.max(profile.longestStreak || 0, calculado.streak),
      lastActiveDate: todayISO,
      streakShieldAvailable: calculado.shieldAvailable,
      streakShieldLastUsedWeek: calculado.shieldUsed ? getISOWeek() : profile.streakShieldLastUsedWeek,
    }).then(setProfile);
  }, [profile, todayISO, settings?.gamificationEnabled]);

  // Resolve uma referencia de tarefa (id solto ou Task) para a tarefa-base.
  // Ids virtuais (`serie#2026-09-30`) apontam para a serie, nunca para uma linha.
  const resolveTaskRef = useCallback((taskOrId: Task | string): { original: Task; iso: string; isOccurrence: boolean } | null => {
    const id = typeof taskOrId === 'string' ? taskOrId : taskOrId.id;
    if (isVirtualId(id)) {
      const base = tasks.find(t => t.id === baseId(id));
      const iso = occurrenceDate(id);
      if (base && iso) return { original: base, iso, isOccurrence: true };
      return null;
    }
    const original = tasks.find(t => t.id === id);
    return original ? { original, iso: original.date, isOccurrence: false } : null;
  }, [tasks]);

  // Grava tempo de foco na tarefa/ocorrencia correta e atualiza o estado local e nuvem imediatamente.
  const persistFocusTime = useCallback(async (taskOrId: Task | string, extraSec: number): Promise<Task | null> => {
    if (!extraSec || extraSec <= 0) return null;
    const ref = resolveTaskRef(taskOrId);
    if (!ref) return null;

    // Uma unica escrita: tarefa + agregado do dia. Ler do banco dentro do
    // repositorio evita o stale closure que fazia dois flushes seguidos
    // sobrescrevrem o `spentSeconds` um do outro.
    const saved = await repository.addFocusSeconds(ref.original.id, ref.iso, extraSec);
    if (!saved) return null;

    // Sincroniza estado de tarefas imediatamente
    setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));

    // Sincroniza a tarefa aberta no drawer/modal para nao reter dados defasados
    setSelectedTaskForDrawer(prev => {
      if (!prev) return null;
      if (prev.id === saved.id || prev.id === ref.original.id) {
        return saved;
      }
      return prev;
    });

    return saved;
  }, [resolveTaskRef]);

  // Função central para persistir qualquer segundo pendente no momento exato (pause, close modal, beforeunload, etc.)
  const flushActiveFocusTime = useCallback(async (): Promise<void> => {
    if (!activeTask || !activeTimerRunning || pomodoroPhase !== 'foco' || !lastFlushTimestampRef.current) {
      return;
    }
    const now = Date.now();
    const deltaSec = Math.floor((now - lastFlushTimestampRef.current) / 1000);
    if (deltaSec > 0) {
      lastFlushTimestampRef.current = now;
      await persistFocusTime(activeTask, deltaSec);
    }
  }, [activeTask, activeTimerRunning, pomodoroPhase, persistFocusTime]);

  // Virada de bloco: quando o alvo da fase bate, grava o foco, zera os contadores e inverte a fase.
  useEffect(() => {
    if (!activeTimerRunning || !activeTask || !timerStartTime) return;

    if (pomodoroPhase === 'foco') {
      if (currentTickElapsed < phaseTargetSeconds) return;
      const blocks = completedFocusBlocks + 1;
      setCompletedFocusBlocks(blocks);
      audioSynthesizer.playChime();

      // Grava qualquer saldo de foco pendente antes de virar para descanso
      if (lastFlushTimestampRef.current) {
        const unpersisted = Math.floor((Date.now() - lastFlushTimestampRef.current) / 1000);
        if (unpersisted > 0) {
          void persistFocusTime(activeTask, unpersisted);
        }
      }
      lastFlushTimestampRef.current = null;

      const interval = Math.max(1, pomodoroCfg?.longBreakInterval || 4);
      const longa = blocks % interval === 0;
      const now = Date.now();
      setAccumulatedTimerSeconds(0);
      setCurrentTickElapsed(0);
      setBreakAccumulatedSeconds(0);
      setBreakTickElapsed(0);
      setPomodoroPhase(longa ? 'pausa_longa' : 'pausa_curta');
      segmentStartRef.current = now;
      setTimerStartTime(now);
      
      const breakDuration = longa ? (pomodoroCfg?.longBreakMinutes ?? 15) : (pomodoroCfg?.shortBreakMinutes ?? 5);
      showToast({
        text: longa
          ? `Bloco ${blocks} concluído. Pausa longa de ${breakDuration} min.`
          : `Bloco ${blocks} concluído. Pausa curta de ${breakDuration} min.`,
        type: 'success',
      });
      sendBrowserNotification('Bloco de Foco Concluído! 🎯', {
        body: `Excelente trabalho! Bloco ${blocks} concluído. Hora de uma pausa ${longa ? 'longa' : 'curta'} de ${breakDuration} min.`,
      });
    } else {
      if (breakTickElapsed < phaseTargetSeconds) return;
      const now = Date.now();
      setPomodoroPhase('foco');
      setAccumulatedTimerSeconds(0);
      setCurrentTickElapsed(0);
      setBreakAccumulatedSeconds(0);
      setBreakTickElapsed(0);
      segmentStartRef.current = now;
      setTimerStartTime(now);
      lastFlushTimestampRef.current = now;
      audioSynthesizer.playChime();
      showToast({ text: 'Pausa encerrada. De volta ao foco.', type: 'success' });
      sendBrowserNotification('Fim da Pausa! ⚡', {
        body: 'Sua pausa acabou! De volta ao foco.',
      });
    }
    // A troca de fase no final zera as dependencias; o efeito nao volta a rodar.
  }, [activeTimerRunning, activeTask, timerStartTime, currentTickElapsed, breakTickElapsed, phaseTargetSeconds, pomodoroPhase, completedFocusBlocks, pomodoroCfg, showToast, persistFocusTime]);

  // Periodic Auto-Save for Focus Timer (every 10s & on unload)
  useEffect(() => {
    if (!activeTimerRunning || !activeTask || pomodoroPhase !== 'foco') return;

    const autoSaveInterval = setInterval(() => {
      void flushActiveFocusTime();
    }, 10000);

    const handleBeforeUnload = () => {
      if (lastFlushTimestampRef.current) {
        const deltaSec = Math.floor((Date.now() - lastFlushTimestampRef.current) / 1000);
        if (deltaSec > 0) {
          void persistFocusTime(activeTask, deltaSec);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(autoSaveInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTimerRunning, activeTask, pomodoroPhase, flushActiveFocusTime, persistFocusTime]);

  // Back up the active timer state to localStorage synchronously on every tick/state change
  useEffect(() => {
    if (activeTaskId) {
      localStorage.setItem('focosemanal_active_timer_state', JSON.stringify({
        activeTaskId,
        activeTimerRunning,
        timerStartTime,
        accumulatedTimerSeconds,
        pomodoroPhase,
        completedFocusBlocks,
        breakAccumulatedSeconds,
        currentTickElapsed,
        breakTickElapsed,
        timestamp: Date.now()
      }));
    } else {
      localStorage.removeItem('focosemanal_active_timer_state');
    }
  }, [
    activeTaskId,
    activeTimerRunning,
    timerStartTime,
    accumulatedTimerSeconds,
    pomodoroPhase,
    completedFocusBlocks,
    breakAccumulatedSeconds,
    currentTickElapsed,
    breakTickElapsed
  ]);

  // Restore active timer state on boot (e.g. page refresh / F5)
  useEffect(() => {
    if (boot.phase !== 'ready' || hasRestoredTimerRef.current) return;
    hasRestoredTimerRef.current = true;

    const savedTimerRaw = localStorage.getItem('focosemanal_active_timer_state');
    if (savedTimerRaw) {
      try {
        const savedState = JSON.parse(savedTimerRaw);
        // Verify task exists in the loaded tasks (allowing virtual/recurring tasks check)
        const taskExists = tasks.some(t => t.id === savedState.activeTaskId || (isVirtualId(savedState.activeTaskId) && baseId(savedState.activeTaskId) === t.id));
        if (taskExists) {
          const timePassedSec = savedState.activeTimerRunning ? Math.floor((Date.now() - savedState.timestamp) / 1000) : 0;
          
          // If the page was closed for more than 5 minutes (300 seconds), assume they walked away.
          // In this case, save their study progress up to the point they closed the tab, then clean up.
          if (savedState.activeTimerRunning && timePassedSec > 300) {
            const extraSec = (savedState.currentTickElapsed || 0);
            if (extraSec > 0 && savedState.pomodoroPhase === 'foco') {
              void persistFocusTime(savedState.activeTaskId, extraSec);
            }
            localStorage.removeItem('focosemanal_active_timer_state');
            return;
          }

          setActiveTaskId(savedState.activeTaskId);
          setPomodoroPhase(savedState.pomodoroPhase || 'foco');
          setCompletedFocusBlocks(savedState.completedFocusBlocks || 0);
          
          if (savedState.activeTimerRunning) {
            const now = Date.now();
            segmentStartRef.current = now;
            setTimerStartTime(now);
            
            if (savedState.pomodoroPhase === 'foco') {
              const totalElapsed = (savedState.currentTickElapsed || 0) + timePassedSec;
              setAccumulatedTimerSeconds(totalElapsed);
              setCurrentTickElapsed(totalElapsed);
              setBreakAccumulatedSeconds(0);
              setBreakTickElapsed(0);
              lastFlushTimestampRef.current = now;
            } else {
              const totalElapsedBreak = (savedState.breakTickElapsed || 0) + timePassedSec;
              setBreakAccumulatedSeconds(totalElapsedBreak);
              setBreakTickElapsed(totalElapsedBreak);
              setAccumulatedTimerSeconds(0);
              setCurrentTickElapsed(0);
            }
            setActiveTimerRunning(true);
          } else {
            setActiveTimerRunning(false);
            setTimerStartTime(null);
            segmentStartRef.current = null;
            
            setAccumulatedTimerSeconds(savedState.accumulatedTimerSeconds || 0);
            setCurrentTickElapsed(savedState.currentTickElapsed || 0);
            setBreakAccumulatedSeconds(savedState.breakAccumulatedSeconds || 0);
            setBreakTickElapsed(savedState.breakTickElapsed || 0);
          }
        } else {
          localStorage.removeItem('focosemanal_active_timer_state');
        }
      } catch (e) {
        console.warn('Failed to restore active timer state:', e);
      }
    }
  }, [boot.phase, tasks, persistFocusTime]);

  // Start / Toggle Timer for a specific task
  const handleStartTimer = useCallback((task: Task) => {
    lastUserInteractionTime.current = Date.now();

    if (activeTaskId === task.id) {
      if (activeTimerRunning) {
        // Pausar: congela o segmento vivo no banco da fase e persiste imediatamente
        const vivo = segmentStartRef.current ? Math.floor((Date.now() - segmentStartRef.current) / 1000) : 0;
        if (pomodoroPhase === 'foco') {
          const total = accumulatedTimerSeconds + vivo;
          setAccumulatedTimerSeconds(total);
          setCurrentTickElapsed(total);
          if (lastFlushTimestampRef.current) {
            const unpersisted = Math.floor((Date.now() - lastFlushTimestampRef.current) / 1000);
            if (unpersisted > 0) {
              void persistFocusTime(activeTask || task, unpersisted);
            }
          }
        } else {
          const totalBreak = breakAccumulatedSeconds + vivo;
          setBreakAccumulatedSeconds(totalBreak);
          setBreakTickElapsed(totalBreak);
        }
        lastFlushTimestampRef.current = null;
        setActiveTimerRunning(false);
        setTimerStartTime(null);
        segmentStartRef.current = null;
        audioSynthesizer.playTimerPause();
      } else {
        // Retoma a fase exatamente de onde parou.
        const now = Date.now();
        segmentStartRef.current = now;
        setTimerStartTime(now);
        if (pomodoroPhase === 'foco') {
          lastFlushTimestampRef.current = now;
        }
        setActiveTimerRunning(true);
        audioSynthesizer.playTimerStart();
      }
    } else {
      // Trocar de tarefa: se havia foco rolando, congela e grava tudo antes.
      if (activeTask && activeTimerRunning && pomodoroPhase === 'foco' && lastFlushTimestampRef.current) {
        const unpersisted = Math.floor((Date.now() - lastFlushTimestampRef.current) / 1000);
        if (unpersisted > 0) {
          void persistFocusTime(activeTask, unpersisted);
        }
      }

      const now = Date.now();
      setActiveTaskId(task.id);
      setPomodoroPhase('foco');
      setBreakAccumulatedSeconds(0);
      setBreakTickElapsed(0);
      setAccumulatedTimerSeconds(0);
      setCurrentTickElapsed(0);
      setCompletedFocusBlocks(0);
      segmentStartRef.current = now;
      setTimerStartTime(now);
      lastFlushTimestampRef.current = now;
      setActiveTimerRunning(true);
      audioSynthesizer.playTimerStart();
    }
  }, [activeTaskId, activeTimerRunning, accumulatedTimerSeconds, activeTask, pomodoroPhase, breakAccumulatedSeconds, persistFocusTime]);

  // Inicia foco em uma tarefa e leva para a janela de foco imediatamente
  const handleStartFocusTask = useCallback((task: Task) => {
    if (activeTaskId === task.id && activeTimerRunning) {
      handleStartTimer(task);
    } else {
      handleStartTimer(task);
      setIsFocusModeOpen(true);
    }
  }, [activeTaskId, activeTimerRunning, handleStartTimer]);

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

    const ref = resolveTaskRef(task);
    const freshTask = (ref ? await repository.getTaskById(ref.original.id) : (task.id ? await repository.getTaskById(task.id) : null)) || (ref ? ref.original : task);
    const baseTask = ref ? freshTask : task;

    // A tarefa-base e a ancora da comparacao: uma ocorrencia (`serie#dia`) e a
    // propria serie que esta em foco.
    const activeRef = activeTaskId ? resolveTaskRef(activeTaskId) : null;
    const activeBaseId = activeRef ? activeRef.original.id : (activeTaskId || null);
    const targetBaseId = ref ? ref.original.id : (task.id || null);
    const isActiveTarget = !!targetBaseId && activeBaseId === targetBaseId;

    let finalSpent = ref ? spentSecondsOn(freshTask, ref.iso) : (freshTask.spentSeconds || 0);
    if (isActiveTarget && activeTimerRunning) {
      if (pomodoroPhase === 'foco') {
        const vivo = segmentStartRef.current ? Math.floor((Date.now() - segmentStartRef.current) / 1000) : 0;
        setAccumulatedTimerSeconds(accumulatedTimerSeconds + vivo);
        if (lastFlushTimestampRef.current) {
          const unpersisted = Math.floor((Date.now() - lastFlushTimestampRef.current) / 1000);
          if (unpersisted > 0) {
            finalSpent += unpersisted;
          }
        }
      }
      lastFlushTimestampRef.current = null;
      segmentStartRef.current = null;
      setActiveTimerRunning(false);
      setTimerStartTime(null);
    } else if (isActiveTarget) {
      lastFlushTimestampRef.current = null;
      segmentStartRef.current = null;
      setActiveTimerRunning(false);
      setTimerStartTime(null);
    }

    // Concluir encerra a sessao. Sem limpar `activeTaskId`, o mini-cronometro do
    // canto inferior direito continua oferecendo "continuar estudando" (e o
    // cabecalho mantem o relogio) numa tarefa que acabou de ser fechada.
    if (isCompleted && isActiveTarget) {
      setActiveTaskId(null);
      setPomodoroPhase('foco');
      setCompletedFocusBlocks(0);
      setBreakAccumulatedSeconds(0);
      setBreakTickElapsed(0);
      setAccumulatedTimerSeconds(0);
      setCurrentTickElapsed(0);
    }

    // A ocorrencia de uma serie volta para a tarefa-base: concluir o dia X
    // grava so o dia X, e o dia Y da mesma rotina continua pendente.
    let updatedTaskData: Task;

    if (ref?.isOccurrence) {
      updatedTaskData = withOccurrenceCompleted(baseTask, ref.iso, isCompleted);
      updatedTaskData = withOccurrenceSpent(updatedTaskData, ref.iso, finalSpent);
      if (note) updatedTaskData = { ...updatedTaskData, reflectionNote: note };
    } else {
      updatedTaskData = {
        ...task,
        completed: isCompleted,
        completedAt: isCompleted ? now : undefined,
        spentSeconds: finalSpent,
        reflectionNote: note || task.reflectionNote,
        updatedAt: now,
      };
    }

    const saved = await repository.saveTask(updatedTaskData);
    setTasks(prev => prev.map(t => t.id === updatedTaskData.id ? saved : t));

    if (ref?.isOccurrence) {
      if (selectedTaskForDrawer?.id === ref.original.id) setSelectedTaskForDrawer(saved);
    } else if (selectedTaskForDrawer?.id === updatedTaskData.id) {
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
  }, [activeTaskId, activeTimerRunning, timerStartTime, accumulatedTimerSeconds, breakAccumulatedSeconds, addXP, showToast, selectedTaskForDrawer, resolveTaskRef, pomodoroPhase]);

  // Save / Update Task handler
  const handleSaveTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    // Editar uma ocorrencia edita a serie inteira. A data da ancora nao pode ser
    // sobrescrita pela data do dia exibido, senao a serie se parte ao meio.
    let payload = taskData;
    if (taskData.id && isVirtualId(taskData.id)) {
      const ref = resolveTaskRef(taskData.id);
      if (ref?.isOccurrence) {
        payload = {
          ...taskData,
          id: ref.original.id,
          date: ref.original.date,
          completed: ref.original.completed,
          completedAt: ref.original.completedAt,
          spentSeconds: ref.original.spentSeconds,
        } as typeof taskData;
      }
    }

    // Protecao contra regressao de tempo de foco: se o banco ja tiver mais tempo gravado do que o payload,
    // preservamos o tempo mais recente para nenhuma edicao de formulario apagar foco acumulado.
    if (payload.id) {
      const freshExisting = await repository.getTaskById(payload.id);
      if (freshExisting) {
        payload = {
          ...payload,
          spentSeconds: Math.max(freshExisting.spentSeconds || 0, payload.spentSeconds || 0),
          spentSecondsByDay: { ...(freshExisting.spentSecondsByDay || {}), ...(payload.spentSecondsByDay || {}) },
        };
      }
    }

    const saved = await repository.saveTask(payload);
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

    showToast({ text: payload.id ? 'Tarefa atualizada!' : 'Tarefa criada com sucesso!', type: 'success' });
  }, [showToast, selectedTaskForDrawer, resolveTaskRef]);

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

    // Numa serie, apagar remove so o dia; apagar a ancora desliga a serie toda.
    const ref = resolveTaskRef(taskId);
    if (ref?.isOccurrence) {
      const updated = withOccurrenceRemoved(ref.original, ref.iso);
      const saved = await repository.saveTask(updated);
      setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
      showToast({ text: 'Ocorrência removida. A rotina continua nos outros dias.' });
      return;
    }

    await repository.softDeleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (selectedTaskForDrawer?.id === taskId) {
      setIsDrawerOpen(false);
      setSelectedTaskForDrawer(null);
    }
    showToast({ text: 'Tarefa enviada para a lixeira (recuperável por 30 dias).' });
  }, [activeTaskId, selectedTaskForDrawer, showToast, resolveTaskRef]);

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

  // Toggle "choveu": só faz sentido em tarefa de saúde
  const handleToggleRain = useCallback(async (task: Task) => {
    const updated = await repository.saveTask({ ...task, blockedByRain: !task.blockedByRain });
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    if (selectedTaskForDrawer?.id === task.id) setSelectedTaskForDrawer(updated);
    showToast({
      text: updated.blockedByRain
        ? 'Chuva marcada: tarefa registrada como inviável hoje.'
        : 'Marcação de chuva removida.'
    });
  }, [selectedTaskForDrawer, showToast]);

  // Move task date
  const handleMoveTaskDate = useCallback(async (taskId: string, newDate: string) => {
    const ref = resolveTaskRef(taskId);
    if (!ref) return;
    // Arrastar uma ocorrencia move a serie inteira: a ancora e o que define
    // a partir de quando a rotina vale.
    const updated = await repository.saveTask({ ...ref.original, date: newDate });
    setTasks(prev => prev.map(t => t.id === ref.original.id ? updated : t));
    showToast({ text: `Tarefa agendada para ${newDate === todayISO ? 'Hoje' : newDate}` });
  }, [resolveTaskRef, todayISO, showToast]);

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
        handleSelectTab('hoje');
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
        setIsInactivityPromptOpen(false);
        setIsDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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
    // Series recorrentes nao ficam "atrasadas": elas reaparecem nos proprios dias.
    return tasks.filter(t => !t.completed && !t.deletedAt && !isRecurring(t) && t.date < todayISO);
  }, [tasks, todayISO]);

  const todayStudiedMinutes = useMemo(() => {
    const todayTasks = tasksForDate(tasks, todayISO);
    const totalSecs = todayTasks.reduce((acc, t) => acc + (t.spentSeconds || 0), 0);
    return Math.round(totalSecs / 60);
  }, [tasks, todayISO]);

  /**
   * Rollover automático. Com a preferencia ligada, o que ficou para trás vem
   * junto para hoje sem perguntar; desligada, o banner continua perguntando —
   * por isso os dois caminhos precisam existir, e nao um substitui o outro.
   *
   * `dismissedOverdue` respeita a recusa do usuário: quem escolheu "manter onde
   * estão" não vai ter o cronograma mexido atrás das costas no mesmo dia.
   */
  useEffect(() => {
    if (dismissedOverdue) return;
    if ((settings?.autoRollover ?? true) === false) return;
    if (overdueTasks.length === 0) return;

    const ids = overdueTasks.map(t => t.id);
    const toUpdate = overdueTasks.map(t => ({ ...t, date: todayISO }));
    void repository.saveTasksBatch(toUpdate).then(() => {
      setTasks(prev => prev.map(t => (ids.includes(t.id) ? { ...t, date: todayISO } : t)));
      setDismissedOverdue(true);
      showToast({ text: `${ids.length} ${ids.length === 1 ? 'tarefa levada' : 'tarefas levadas'} para Hoje (rollover automático).` });
    });
  }, [dismissedOverdue, settings?.autoRollover, overdueTasks, todayISO, showToast]);


  /** A abertura fica por cima de qualquer fase: a logo roda enquanto o banco carrega. */
  const withCover = (tela: React.ReactNode) => (
    <>
      {showCover && <CoverScreen onDismiss={() => setShowCover(false)} />}
      {tela}
    </>
  );

  if (boot.phase === 'needs-key') {
    return withCover(<SyncKeyGate onConnect={handleConnectKey} />);
  }

  if (boot.phase === 'corrompido') {
    return withCover(
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl border border-[var(--borda)] shadow-xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-amber-500" />
          </div>
          <h1 className="text-lg font-black text-[var(--texto)] mb-2">Seu banco precisa de um olhar</h1>
          <p className="text-sm text-[var(--texto-suave)] leading-relaxed mb-4">{boot.detalhe}</p>
          <p className="text-xs text-[var(--texto-suave)] leading-relaxed mb-4">
            Para olhar o conteudo, rode no painel do Supabase (SQL Editor):
          </p>
          <pre className="text-[11px] bg-[var(--surface-secondary)] border border-[var(--borda)] rounded-xl p-3 overflow-x-auto mb-4">
{`select data
from app_state
where user_id = '${boot.userId}';`}
          </pre>
          <p className="text-xs text-[var(--texto-suave)] leading-relaxed mb-6">
            Com o que estiver la em maos, use a exportacao/importacao JSON em Configuracoes
            — ou apague essa linha se ela nao contiver nada que voce queira.
          </p>
          <button
            type="button"
            onClick={handleTrocarChave}
            className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Voltar para a chave
          </button>
        </div>
      </div>
    );
  }

  if (boot.phase === 'offline') {
    return withCover(
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[var(--surface)] rounded-3xl border border-[var(--borda)] shadow-xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <CloudOff size={24} className="text-red-500" />
          </div>
          <h1 className="text-lg font-black text-[var(--texto)] mb-2">Nao consegui abrir seu banco</h1>
          <p className="text-sm text-[var(--texto-suave)] leading-relaxed mb-1">
            {boot.detalhe}
          </p>
          <p className="text-xs text-[var(--texto-suave)] mb-6">
            Seus dados estao no Supabase e continuam la. Nenhum banco ficticio foi
            criado: o app so abre com o que a nuvem confirmar.
          </p>
          <button
            type="button"
            onClick={handleRetryBoot}
            className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (boot.phase === 'loading' || !profile || !settings) {
    return withCover(
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-violet-500/30">
            M
          </div>
          <span className="text-sm font-bold text-[var(--texto-suave)]">Carregando Plataforma Mendonça...</span>
        </div>
      </div>
    );
  }

  return withCover(
    <div className="min-h-screen bg-[var(--bg)] text-[var(--texto)] flex flex-col antialiased selection:bg-violet-500/20 selection:text-violet-600 transition-colors duration-200">
      
      {/* Toast Notifications & Confetti */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      <MicroConfetti active={confettiActive} onDone={() => setConfettiActive(false)} />
      <OfflineIndicator />

      {/* Gravacao recusada pela nuvem: o dado esta na tela mas NAO esta salvo. */}
      {syncStatus === 'error' && (
        <div className="sticky top-0 z-50 bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-3 text-xs font-bold shadow-lg">
          <CloudOff size={14} className="shrink-0" />
          <span>Não consegui salvar no Supabase. O que você fez agora pode se perder.</span>
          <button
            type="button"
            onClick={handleRetrySave}
            className="shrink-0 underline underline-offset-2 hover:no-underline cursor-pointer"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {avisoBancoVazio && (
        <div className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-xs font-bold shadow-lg">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="text-left">
            Este banco nasceu vazio: nao havia nada no Supabase para esta chave. Se voce
            esperava ver seus dados, a chave pode estar errada.
          </span>
          <button
            type="button"
            onClick={handleTrocarChave}
            className="shrink-0 underline underline-offset-2 hover:no-underline cursor-pointer"
          >
            Conferir a chave
          </button>
          <button
            type="button"
            onClick={() => setAvisoBancoVazio(false)}
            aria-label="Dispensar aviso"
            className="shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {syncStatus === 'syncing' && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-slate-900/90 text-white px-3.5 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md border border-slate-700/50 pointer-events-none animate-fade-in">
          <Loader2 size={13} className="animate-spin text-violet-400" />
          <span>Salvando no Supabase...</span>
        </div>
      )}

      {/* Floating Picture-in-Picture Mini Timer */}
      <FloatingMiniTimer
        activeTask={activeTask}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={displayElapsed}
        category={activeCategory}
        onToggleTimer={handleToggleActiveTimer}
        onOpenFullscreenFocus={() => setIsFocusModeOpen(true)}
      />

      {/* Global Header (72px) */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        activeTask={activeTask}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={displayElapsed}
        onToggleActiveTimer={handleToggleActiveTimer}
        onStopActiveTimer={handleToggleActiveTimer}
        onOpenFullscreenFocus={() => setIsFocusModeOpen(true)}
        categories={categories}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto p-3 sm:p-5 lg:p-6 pb-24 lg:pb-8 flex flex-col gap-5 sm:gap-6">
        
        {/* Welcome & Study Mode Card */}
        <WelcomeCard
          profile={profile}
          onWhatToDoNow={() => setIsWhatToDoOpen(true)}
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
            onOpenCloseDay={() => setIsCloseDayOpen(true)}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
            onOpenSpacedRep={() => handleSelectTab('jornada')}
            onOpenSettings={(section) => {
              setIsSettingsOpen(true);
            }}
          />

          {/* Dynamic Content Panel with Elastic Page Transition */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait" custom={tabDirection}>
              <motion.div
                key={currentTab}
                custom={tabDirection}
                variants={shouldReduceMotion ? reducedVariants : pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full transform-gpu"
              >
                {currentTab === 'hoje' ? (
                  <DayDashboard
                    tasks={tasks}
                    categories={categories}
                    profile={profile}
                    settings={settings}
                    activeTask={activeTask}
                    activeTimerRunning={activeTimerRunning}
                    activeTimerElapsed={displayElapsed}
                    dailyMood={moods[todayISO] || null}
                    onToggleTimer={handleStartFocusTask}
                    onSelectTaskToDrawer={(task) => {
                      setSelectedTaskForDrawer(task);
                      setIsDrawerOpen(true);
                    }}
                    onToggleComplete={handleToggleComplete}
                    onEditTask={(task) => {
                      setTaskToEdit(task);
                      setIsTaskModalOpen(true);
                    }}
                    onDeleteTask={handleDeleteTask}
                    onToggleTop3={handleToggleTop3}
                    onTogglePin={handleTogglePin}
                    onToggleSubtask={handleToggleSubtask}
                    onToggleRain={handleToggleRain}
                    onAddTask={handleSaveTask}
                    onSelectTab={handleSelectTab}
                    onSaveMood={handleSaveMood}
                    onOpenTemplates={() => setIsTemplatesOpen(true)}
                    onOpenFocusMode={() => setIsFocusModeOpen(true)}
                    onChangeStudyMode={async (mode) => {
                      const updated = await repository.updateProfile({ studyMode: mode });
                      setProfile(updated);
                      showToast({ text: `Modo de estudo alterado para ${STUDY_MODES[mode]?.name || mode} (Meta: ${STUDY_MODES[mode]?.dailyXpGoal || 400} XP/dia)` });
                    }}
                  />
                ) : currentTab === 'tarefas' ? (
                  <TasksInboxView
                    tasks={tasks}
                    categories={categories}
                    activeTaskId={activeTaskId}
                    activeTimerRunning={activeTimerRunning}
                    activeTimerElapsed={displayElapsed}
                    onToggleTimer={handleStartFocusTask}
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
                    activeTimerElapsed={displayElapsed}
                    onToggleTimer={handleStartFocusTask}
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
              </motion.div>
            </AnimatePresence>
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
        onClose={async () => {
          await flushActiveFocusTime();
          setIsDrawerOpen(false);
          setSelectedTaskForDrawer(null);
        }}
        onUpdateTask={(updatedTask) => {
          handleSaveTask(updatedTask);
        }}
        onDeleteTask={(taskId) => {
          handleDeleteTask(taskId);
        }}
        onToggleComplete={handleToggleComplete}
        onStartFocus={(task) => {
          handleStartTimer(task);
          setIsFocusModeOpen(true);
        }}
        categories={categories}
        workoutTemplates={workoutTemplates}
        activeTaskId={activeTaskId}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={displayElapsed}
        pomodoroPhase={pomodoroPhase}
        completedFocusBlocks={completedFocusBlocks}
        onToggleActiveTimer={handleToggleActiveTimer}
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
          if (settings?.gamificationEnabled ?? true) {
            setConfettiActive(true);
            showToast({ text: 'Dia fechado com sucesso (+20 XP)! Bom descanso. 🌙', type: 'success' });
          } else {
            showToast({ text: 'Dia fechado com sucesso! Bom descanso. 🌙', type: 'success' });
          }
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
        onClose={async () => {
          await flushActiveFocusTime();
          setIsFocusModeOpen(false);
        }}
        activeTask={activeTask}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={displayElapsed}
        onToggleTimer={handleToggleActiveTimer}
        onCompleteTask={handleToggleComplete}
        category={activeCategory}
        phaseTargetSeconds={phaseTargetSeconds}
        phaseLabel={pomodoroPhase === 'foco' ? 'Foco' : pomodoroPhase === 'pausa_longa' ? 'Pausa longa' : 'Pausa curta'}
        pomodoroPhase={pomodoroPhase}
        completedFocusBlocks={completedFocusBlocks}
      />

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tasks={tasks}
        categories={categories}
        onSelectTab={(tab) => handleSelectTab(tab as any)}
        onStartTimer={(task) => {
          handleStartTimer(task);
          setIsFocusModeOpen(true);
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
        }}
        onTrocarChave={handleTrocarChave}
        onDesconectar={handleDesconectar}
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
