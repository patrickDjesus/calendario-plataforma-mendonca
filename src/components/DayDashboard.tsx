import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, 
  CheckCircle2
} from 'lucide-react';
import { Task, Category, UserProfile, UserSettings, DailyMood } from '../types';
import { TaskCard } from './TaskCard';
import { SmartInputBar } from './SmartInputBar';
import { NowNextBar } from './NowNextBar';
import { DailyTimeline } from './DailyTimeline';
import { STUDY_MODES, getDynamicMotivationPhrase, recommendNextTask } from '../utils/xpSystem';
import { getTodayISO } from '../utils/dateUtils';
import { tasksForDate } from '../services/recurrence';
import { GifIcon } from './GifIcon';

interface DayDashboardProps {
  tasks: Task[];
  categories: Category[];
  profile: UserProfile;
  settings: UserSettings;
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  dailyMood: DailyMood | null;
  onToggleTimer: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTop3: (task: Task) => void;
  onTogglePin: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  /** Marca que choveu e a tarefa de saúde ficou inviável. */
  onToggleRain?: (task: Task) => void;
  onAddTask: (data: any) => void;
  onSelectTab: (tab: string) => void;
  onSaveMood: (mood: 'otimo' | 'bom' | 'neutro' | 'cansado' | 'estressado', energy: number) => void;
  onOpenTemplates: () => void;
  onOpenFocusMode?: () => void;
}

export const DayDashboard: React.FC<DayDashboardProps> = ({
  tasks,
  categories,
  profile,
  settings,
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  dailyMood,
  onToggleTimer,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onToggleTop3,
  onTogglePin,
  onToggleSubtask,
  onToggleRain,
  onAddTask,
  onSelectTab,
  onSaveMood,
  onOpenFocusMode,
}) => {
  const [filter, setFilter] = useState<'todas' | 'pendentes' | 'concluidas'>('todas');
  const todayISO = getTodayISO();

  const studyModeConfig = STUDY_MODES[profile.studyMode] || STUDY_MODES.regular;
  const dailyXpGoal = studyModeConfig.dailyXpGoal;
  const todayXp = profile.xpHistory[todayISO] || 0;
  const xpPercentage = Math.min(100, Math.round((todayXp / dailyXpGoal) * 100));
  const missingXp = Math.max(0, dailyXpGoal - todayXp);
  const motivation = getDynamicMotivationPhrase(todayXp, dailyXpGoal);

  // Filter tasks for today, including each recurring series as an occurrence
  const todayTasks = useMemo(() => {
    return tasksForDate(tasks, todayISO).filter(t => !t.deletedAt);
  }, [tasks, todayISO]);

  // Recommendation for next task
  const { task: recommendedTask, reason: recommendationReason } = useMemo(() => {
    return recommendNextTask(tasks, todayISO, profile.studyMode);
  }, [tasks, todayISO, profile.studyMode]);

  const recommendedCat = useMemo(() => {
    if (!recommendedTask) return undefined;
    return categories.find(c => c.id === recommendedTask.categoryId) || categories[0];
  }, [recommendedTask, categories]);

  const activeCategory = useMemo(() => {
    if (!activeTask) return undefined;
    return categories.find(c => c.id === activeTask.categoryId) || categories[0];
  }, [activeTask, categories]);

  // Last task to resume
  const lastTask = useMemo(() => {
    const sorted = [...todayTasks].filter(t => !t.completed).sort((a, b) => b.spentSeconds - a.spentSeconds);
    return sorted[0] || todayTasks.find(t => !t.completed) || null;
  }, [todayTasks]);

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Goals calculations
  const completedCount = todayTasks.filter(t => t.completed).length;
  const totalCount = todayTasks.length;
  const totalSecondsToday = todayTasks.reduce((acc, t) => {
    return acc + (activeTask?.id === t.id ? activeTimerElapsed : t.spentSeconds);
  }, 0);
  const totalHoursToday = (totalSecondsToday / 3600).toFixed(1);
  const maxHours = studyModeConfig.maxDailyHours;

  const filteredTasks = useMemo(() => {
    let list = [...todayTasks];
    if (filter === 'pendentes') list = list.filter(t => !t.completed);
    if (filter === 'concluidas') list = list.filter(t => t.completed);

    // Sort: Top 3 & pinned first, then regular order
    return list.sort((a, b) => {
      if (a.isTop3 !== b.isTop3) return a.isTop3 ? -1 : 1;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.order - b.order;
    });
  }, [todayTasks, filter]);

  // Gauge SVG Math for 220px Ring
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (xpPercentage / 100) * circumference;

  return (
    <div className="space-y-6">
      
      {/* Faixa AGORA / PRÓXIMO */}
      {(activeTask || recommendedTask) && (
        <NowNextBar
          activeTask={activeTask}
          activeTimerRunning={activeTimerRunning}
          activeTimerElapsed={activeTimerElapsed}
          recommendedTask={recommendedTask}
          recommendationReason={recommendationReason}
          category={activeCategory || recommendedCat}
          onStartFocus={onToggleTimer}
          onToggleActiveTimer={() => activeTask && onToggleTimer(activeTask)}
          onOpenFocusMode={onOpenFocusMode}
        />
      )}

      {/* 3-Column Equal Height Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* COLUNA 1: XP DIÁRIO (lg:col-span-4) */}
        <div data-gif-host className="card-hover lg:col-span-4 rounded-[24px] bg-[var(--surface)] p-6 sm:p-7 shadow-[var(--shadow-card)] flex flex-col justify-between">
          <div>
            {/* Header com ícone e título */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GifIcon name="experiencia-acumulada" className="w-8 h-8" />
                <h2 className="text-lg sm:text-xl font-bold text-[var(--texto)]">XP Diário</h2>
              </div>
              <span className="text-xs font-bold text-[var(--texto-suave)]">
                Modo {studyModeConfig.name}
              </span>
            </div>

            {/* Anel de 220px com trilho cinza claro #E8ECF4 e arco azul/ciano */}
            <div className="relative w-56 h-56 mx-auto my-2 flex items-center justify-center group cursor-pointer">
              
              {/* Pílula com a porcentagem acima do anel (apenas ao passar o mouse) */}
              <div className="absolute top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-[var(--primary)] text-white shadow-md border border-white/20">
                  {xpPercentage}%
                </span>
              </div>

              <svg className="w-full h-full transform -rotate-90">
                {/* Trilho cinza claro #E8ECF4 */}
                <circle
                  cx="112"
                  cy="112"
                  r={radius}
                  className="text-[#E8ECF4] "
                  strokeWidth="14"
                  stroke="currentColor"
                  fill="transparent"
                />
                {/* Arco azul vibrante com pontas arredondadas */}
                <circle
                  cx="112"
                  cy="112"
                  r={radius}
                  className="transition-all duration-700 ease-out"
                  strokeWidth="14"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  stroke="url(#xpBlueGradient)"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="xpBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B6CF5" />
                    <stop offset="100%" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Centro: Número grande 56px bold e meta */}
              <div className="absolute flex flex-col items-center justify-center text-center mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-[52px] font-extrabold text-[var(--texto)] tracking-tight tabular-nums leading-none">
                    {todayXp}
                  </span>
                  <span className="text-sm font-bold text-[var(--texto-suave)]">
                    /{dailyXpGoal}
                  </span>
                </div>
                <span className="text-xs font-semibold text-[var(--texto-suave)] mt-1">
                  Sua XP hoje
                </span>
              </div>
            </div>

            {/* Frase dinâmica em 20px bold + Faltam X XP */}
            <div className="text-center px-2 mt-3">
              <h3 className="text-lg sm:text-xl font-extrabold text-[var(--texto)] leading-snug">
                {motivation.phrase}
              </h3>
              <p className="text-sm font-semibold text-[var(--texto-suave)] mt-1">
                {missingXp > 0 ? `Faltam ${missingXp} XP para a meta` : 'Meta batida! 🎉'}
              </p>
            </div>
          </div>

          {/* Botões de Ação na base do cartão (margin-top: auto) */}
          <div className="space-y-2.5 mt-6 pt-2">
            {lastTask && (
              <button
                onClick={() => onToggleTimer(lastTask)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[var(--primary-soft)] hover:opacity-90 text-[var(--primary-text-on-soft)] text-sm font-bold transition-all cursor-pointer group"
              >
                <div className="text-left truncate pr-2">
                  <div className="text-xs font-semibold opacity-75">Continuar de onde parei</div>
                  <div className="truncate font-extrabold text-[var(--texto)] text-sm">{lastTask.title}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            )}

            <button
              onClick={() => onSelectTab('jornada')}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[var(--primary-soft)] hover:opacity-90 text-[var(--primary-text-on-soft)] text-sm font-bold transition-all cursor-pointer group"
            >
              <span className="text-sm font-extrabold text-[var(--texto)]">Ir ao mapa de progresso</span>
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        {/* COLUNA 2: TAREFAS DO DIA (lg:col-span-5) */}
        <div data-gif-host className="card-hover lg:col-span-5 rounded-[24px] bg-[var(--surface)] p-6 sm:p-7 shadow-[var(--shadow-card)] flex flex-col justify-between">
          <div>
            {/* Header: Título "Tarefas do dia" + Contador + Filtros segmentados */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-2">
                <GifIcon name="tarefas" className="w-8 h-8" />
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[var(--texto)]">Tarefas do dia</h2>
                  <span className="text-xs text-[var(--texto-suave)] font-medium">
                    {completedCount} de {totalCount} concluídas
                  </span>
                </div>
              </div>

              {/* Filtros segmentados */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)]">
                {(['todas', 'pendentes', 'concluidas'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                      filter === f
                        ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                        : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Barra de adição inteligente embutida (52px) */}
            <div className="mb-4">
              <SmartInputBar 
                categories={categories} 
                onAddTask={onAddTask} 
                selectedDate={todayISO} 
              />
            </div>

            {/* Lista de tarefas */}
            <div className="divide-y divide-[var(--borda)]">
              {filteredTasks.length === 0 ? (
                <div className="py-12 text-center text-[var(--texto-suave)]">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--primary)]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[var(--texto)]">Nenhuma tarefa encontrada</p>
                  <p className="text-xs text-[var(--texto-muted)] mt-0.5">Use o campo acima para adicionar.</p>
                </div>
              ) : (
                filteredTasks.map(task => {
                  const cat = catMap.get(task.categoryId) || categories[0];
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      category={cat}
                      isActiveTimer={activeTask?.id === task.id}
                      isTimerRunning={activeTimerRunning}
                      activeElapsedSeconds={activeTimerElapsed}
                      onToggleTimer={onToggleTimer}
                      onToggleComplete={onToggleComplete}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onToggleTop3={onToggleTop3}
                      onTogglePin={onTogglePin}
                      onToggleSubtask={onToggleSubtask}
                      onToggleRain={onToggleRain}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUNA 3: METAS & ENERGIA (lg:col-span-3) */}
        <div className="lg:col-span-3 space-y-6 flex flex-col justify-between">
          
          {/* Cartão METAS */}
          <div data-gif-host className="card-hover rounded-[24px] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] flex-1">
            <div className="flex items-center gap-2 mb-5">
              <GifIcon name="metas" className="w-8 h-8" />
              <h3 className="text-lg font-bold text-[var(--texto)]">Metas</h3>
            </div>

            <div className="space-y-5">
              {/* Meta 1: Tarefas concluídas */}
              <div>
                <div className="flex items-center justify-between text-sm font-bold mb-1.5">
                  <div className="flex items-center gap-2">
                    <GifIcon name="tarefas-concluidas" className="w-8 h-8" />
                    <span className="text-[var(--texto)]">Tarefas concluídas</span>
                  </div>
                  <span className="text-[var(--primary)] font-extrabold tabular-nums">
                    {completedCount}/{totalCount || 4}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--track-gray)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completedCount >= totalCount && totalCount > 0 ? 'bg-emerald-500' : 'bg-[var(--primary)]'
                    }`}
                    style={{ width: `${totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Meta 2: Horas de estudo */}
              <div>
                <div className="flex items-center justify-between text-sm font-bold mb-1.5">
                  <div className="flex items-center gap-2">
                    <GifIcon name="tempo-total-cronometrado" className="w-8 h-8" />
                    <span className="text-[var(--texto)]">Sessões de foco</span>
                  </div>
                  <span className="text-[var(--primary)] font-extrabold tabular-nums">
                    {totalHoursToday}h / {maxHours}h
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--track-gray)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      Number(totalHoursToday) >= maxHours ? 'bg-emerald-500' : 'bg-[var(--primary)]'
                    }`}
                    style={{ width: `${Math.min(100, (Number(totalHoursToday) / maxHours) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Meta 3: Top 3 prioridades */}
              <div>
                <div className="flex items-center justify-between text-sm font-bold mb-1.5">
                  <div className="flex items-center gap-2">
                    <GifIcon name="fogo-sequencia" className="w-8 h-8" />
                    <span className="text-[var(--texto)]">Top 3 Prioridades</span>
                  </div>
                  <span className="text-[var(--primary)] font-extrabold tabular-nums">
                    {todayTasks.filter(t => t.isTop3 && t.completed).length}/3
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--track-gray)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                    style={{ width: `${(todayTasks.filter(t => t.isTop3 && t.completed).length / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cartão / Faixa ENERGIA */}
          <div className="rounded-[24px] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h4 className="text-sm font-bold text-[var(--texto)] mb-3 text-center sm:text-left">
              Como está sua energia hoje?
            </h4>

            <div className="grid grid-cols-5 gap-1.5 text-center">
              {[
                { key: 'otimo', emoji: '🤩', label: 'Ótima', energy: 5 },
                { key: 'bom', emoji: '😊', label: 'Boa', energy: 4 },
                { key: 'neutro', emoji: '😐', label: 'Normal', energy: 3 },
                { key: 'cansado', emoji: '😴', label: 'Cansada', energy: 2 },
                { key: 'estressado', emoji: '🤯', label: 'Sem foco', energy: 1 },
              ].map((m) => {
                const isSelected = dailyMood?.mood === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => onSaveMood(m.key as any, m.energy)}
                    className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary-soft)] ring-2 ring-[var(--primary)]'
                        : 'hover:bg-[var(--surface-secondary)]'
                    }`}
                    title={m.label}
                  >
                    <span className="text-3xl leading-none">{m.emoji}</span>
                    <span className="text-xs font-bold text-[var(--texto)] mt-1.5 whitespace-nowrap">
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Linha do Tempo Interativa de Hoje */}
      <DailyTimeline
        tasks={tasks}
        categories={categories}
        activeTaskId={activeTask?.id || null}
        activeTimerRunning={activeTimerRunning}
        activeTimerElapsed={activeTimerElapsed}
        onToggleTimer={onToggleTimer}
        onEditTask={onEditTask}
        onAssignTaskTime={async (taskId, time) => {
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            onAddTask({ ...task, time });
          }
        }}
        onQuickNewTaskForTime={(time) => {
          onEditTask({
            id: '',
            title: '',
            categoryId: categories[0]?.id || 'cat-estudo',
            priority: 'media',
            date: todayISO,
            time,
            spentSeconds: 0,
            completed: false,
            tags: [],
            subtasks: [],
            order: 0,
            createdAt: '',
            updatedAt: '',
          });
        }}
      />

    </div>
  );
};
