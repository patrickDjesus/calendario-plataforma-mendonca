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
  WorkoutTemplate
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
  tasksForDate,
  withOccurrenceCompleted,
  withOccurrenceRemoved,
  withOccurrenceSpent,
  spentSecondsOn,
} from './services/recurrence';
import { CloudOff, Loader2, AlertTriangle, X } from 'lucide-react';

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
    return tasks.find(t => t.id === activeTaskId) || null;
  }, [tasks, activeTaskId]);

  const activeCategory = useMemo(() => {
    if (!activeTask) return categories[0] || DEFAULT_CATEGORIES[0];
    return categories.find(c => c.id === activeTask.categoryId) || categories[0] || DEFAULT_CATEGORIES[0];
  }, [activeTask, categories]);

  // Calculate live elapsed seconds for active task
  const [currentTickElapsed, setCurrentTickElapsed] = useState(0);

  // ==== POMODORO ====
  // O tempo de foco e o tempo de pausa sao dois contadores porque so o foco
  // conta como trabalho: a pausa nao pode inflar `spentSeconds` da tarefa nem
  // disparar o bonus de 25 min do XP.
  type PomodoroPhase = 'foco' | 'pausa_curta' | 'pausa_longa';
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>('foco');
  const [completedFocusBlocks, setCompletedFocusBlocks] = useState(0);
  const [breakAccumulatedSeconds, setBreakAccumulatedSeconds] = useState(0);

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
  const displayElapsed = pomodoroPhase === 'foco' ? currentTickElapsed : breakAccumulatedSeconds;

  // Inicio (Date.now) do segmento atual: quando a fase em curso comecou ou foi
  // retomada. Cada fase tem um BANCO (`accumulatedTimerSeconds` para foco,
  // `breakAccumulatedSeconds` para pausa) mais um fragmento vivo medido aqui.
  const segmentStartRef = useRef<number | null>(null);

  // Ticker: enquanto a fase roda, soma o segmento vivo ao banco da fase.
  useEffect(() => {
    let interval: any = null;
    if (activeTimerRunning && timerStartTime && segmentStartRef.current) {
      interval = setInterval(() => {
        const vivo = Math.floor((Date.now() - segmentStartRef.current!) / 1000);
        if (pomodoroPhase === 'foco') {
          setCurrentTickElapsed(accumulatedTimerSeconds + vivo);
        } else {
          setBreakAccumulatedSeconds(breakAccumulatedSeconds + vivo);
        }
      }, 500);
    } else {
      setCurrentTickElapsed(accumulatedTimerSeconds);
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
      document.title = 'Plataforma Mendonça · Cockpit de Estudos & Produtividade';
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
    const calculado = calculateStreak(
      profile.lastActiveDate,
      todayISO,
      profile.streak || 0,
      profile.streakShieldAvailable ?? true,
      profile.streakShieldLastUsedWeek,
    );
    if (calculado.streak === profile.streak && !calculado.shieldUsed) return;
    void repository.updateProfile({
      streak: calculado.streak,
      longestStreak: Math.max(profile.longestStreak || 0, calculado.streak),
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

  // Grava tempo de foco na tarefa/ocorrencia correta e atualiza o estado local.
  const persistFocusTime = useCallback(async (task: Task, extraSec: number) => {
    if (!extraSec || extraSec <= 0) return;
    const ref = resolveTaskRef(task);
    if (!ref) return;
    const jaTem = spentSecondsOn(ref.original, ref.iso);
    const saved = await repository.saveTask(withOccurrenceSpent(ref.original, ref.iso, jaTem + extraSec));
    setTasks(prev => prev.map(t => t.id === saved.id ? saved : t));
  }, [resolveTaskRef]);

  // Virada de bloco: quando o alvo da fase bate, grava o foco, zera os dois
  // contadores e inverte a fase, com o segmento recomeçando do zero.
  useEffect(() => {
    if (!activeTimerRunning || !activeTask || !timerStartTime) return;

    if (pomodoroPhase === 'foco') {
      if (currentTickElapsed < phaseTargetSeconds) return;
      const blocks = completedFocusBlocks + 1;
      setCompletedFocusBlocks(blocks);
      audioSynthesizer.playChime();

      // Grava o bloco completo de foco (nunca a pausa) e reinicia a fase.
      void persistFocusTime(activeTask, phaseTargetSeconds);

      const interval = Math.max(1, pomodoroCfg?.longBreakInterval || 4);
      const longa = blocks % interval === 0;
      setAccumulatedTimerSeconds(0);
      setCurrentTickElapsed(0);
      setBreakAccumulatedSeconds(0);
      setPomodoroPhase(longa ? 'pausa_longa' : 'pausa_curta');
      segmentStartRef.current = Date.now();
      showToast({
        text: longa
          ? `Bloco ${blocks} concluído. Pausa longa de ${pomodoroCfg?.longBreakMinutes ?? 15} min.`
          : `Bloco ${blocks} concluído. Pausa curta de ${pomodoroCfg?.shortBreakMinutes ?? 5} min.`,
        type: 'success',
      });
    } else {
      if (breakAccumulatedSeconds < phaseTargetSeconds) return;
      setPomodoroPhase('foco');
      setAccumulatedTimerSeconds(0);
      setCurrentTickElapsed(0);
      setBreakAccumulatedSeconds(0);
      segmentStartRef.current = Date.now();
      showToast({ text: 'Pausa encerrada. De volta ao foco.', type: 'success' });
    }
    // A troca de fase no final zera as dependencias; o efeito nao volta a rodar.
  }, [activeTimerRunning, activeTask, timerStartTime, currentTickElapsed, breakAccumulatedSeconds, phaseTargetSeconds, pomodoroPhase, completedFocusBlocks, pomodoroCfg, showToast, persistFocusTime]);

  // Start / Toggle Timer for a specific task
  const handleStartTimer = useCallback((task: Task) => {
    lastUserInteractionTime.current = Date.now();
    requestNotificationPermission();

    if (activeTaskId === task.id) {
      if (activeTimerRunning) {
        // Pausar: congela o segmento vivo no banco da fase. Foco grava na
        // tarefa; pausa nao absorve nada.
        const vivo = segmentStartRef.current ? Math.floor((Date.now() - segmentStartRef.current) / 1000) : 0;
        if (pomodoroPhase === 'foco') {
          const total = accumulatedTimerSeconds + vivo;
          setAccumulatedTimerSeconds(total);
          setCurrentTickElapsed(total);
          void persistFocusTime(activeTask || task, vivo);
        } else {
          setBreakAccumulatedSeconds(breakAccumulatedSeconds + vivo);
        }
        setActiveTimerRunning(false);
        setTimerStartTime(null);
        segmentStartRef.current = null;
        audioSynthesizer.playTimerPause();
        showToast({ text: `Cronômetro pausado: ${task.title}` });
      } else {
        // Retoma a fase exatamente de onde parou.
        segmentStartRef.current = Date.now();
        setTimerStartTime(Date.now());
        setActiveTimerRunning(true);
        audioSynthesizer.playTimerStart();
        showToast({ text: `Foco retomado: ${task.title}`, type: 'success' });
      }
    } else {
      // Trocar de tarefa: se havia foco rolando, congela e grava antes.
      if (activeTask && activeTimerRunning && pomodoroPhase === 'foco') {
        const vivo = segmentStartRef.current ? Math.floor((Date.now() - segmentStartRef.current) / 1000) : 0;
        void persistFocusTime(activeTask, vivo);
        setAccumulatedTimerSeconds(accumulatedTimerSeconds + vivo);
      }

      setActiveTaskId(task.id);
      setPomodoroPhase('foco');
      setBreakAccumulatedSeconds(0);
      // O bloco comeca zerado: o tempo ja gravado na tarefa nao e o bloco atual.
      setAccumulatedTimerSeconds(0);
      setCurrentTickElapsed(0);
      setCompletedFocusBlocks(0);
      segmentStartRef.current = Date.now();
      setTimerStartTime(Date.now());
      setActiveTimerRunning(true);
      audioSynthesizer.playTimerStart();
      showToast({ text: `Foco iniciado: ${task.title}`, type: 'success' });
    }
  }, [activeTaskId, activeTimerRunning, timerStartTime, accumulatedTimerSeconds, activeTask, showToast, pomodoroPhase, breakAccumulatedSeconds, persistFocusTime]);

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
    const baseTask = ref ? { ...ref.original } : task;

    let finalSpent = ref ? spentSecondsOn(ref.original, ref.iso) : (task.spentSeconds || 0);
    if (activeTaskId === baseTask.id && activeTimerRunning) {
      // Congela o segmento vivo agora, para nao perder a fracao final.
      const vivo = segmentStartRef.current ? Math.floor((Date.now() - segmentStartRef.current) / 1000) : 0;
      if (pomodoroPhase === 'foco') {
        finalSpent += vivo;
        setAccumulatedTimerSeconds(accumulatedTimerSeconds + vivo);
      } else {
        // Estava em pausa: so o tempo de foco entra na tarefa.
        setBreakAccumulatedSeconds(breakAccumulatedSeconds + vivo);
      }
      setActiveTimerRunning(false);
      setTimerStartTime(null);
      segmentStartRef.current = null;
    } else if (activeTaskId === baseTask.id) {
      setActiveTimerRunning(false);
      setTimerStartTime(null);
      segmentStartRef.current = null;
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


  if (boot.phase === 'needs-key') {
    return <SyncKeyGate onConnect={handleConnectKey} />;
  }

  if (boot.phase === 'corrompido') {
    return (
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
    return (
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
        <div className="sticky top-0 z-50 bg-blue-600 text-white px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] font-bold">
          <Loader2 size={12} className="animate-spin" />
          Salvando no Supabase...
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
        onSelectTab={(tab) => setCurrentTab(tab as any)}
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
            onOpenCloseDay={() => setIsCloseDayOpen(true)}
            onOpenTemplates={() => setIsTemplatesOpen(true)}
            onOpenSpacedRep={() => setCurrentTab('jornada')}
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
                activeTimerElapsed={displayElapsed}
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
                onToggleRain={handleToggleRain}
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
                activeTimerElapsed={displayElapsed}
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
                activeTimerElapsed={displayElapsed}
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
        workoutTemplates={workoutTemplates}
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
        onClose={() => setIsFocusModeOpen(false)}
        activeTask={activeTask}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={displayElapsed}
        onToggleTimer={handleToggleActiveTimer}
        onCompleteTask={handleToggleComplete}
        category={activeCategory}
        phaseTargetSeconds={phaseTargetSeconds}
        phaseLabel={pomodoroPhase === 'foco' ? 'Foco' : pomodoroPhase === 'pausa_longa' ? 'Pausa longa' : 'Pausa curta'}
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
