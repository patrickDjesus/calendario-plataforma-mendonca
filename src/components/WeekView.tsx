import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Task, Category, UserProfile, UserSettings } from '../types';
import { useInfiniteDays } from '../hooks/useInfiniteDays';
import { WeekHeader } from './week/WeekHeader';
import { WeekStrip } from './week/WeekStrip';
import { formatMinutesHuman } from '../utils/dateUtils';
import { tasksByDate, tasksForDate } from '../services/recurrence';
import { CategoryIcon } from './CategoryIcon';
import { Check, Clock, Play, Pause, Trash2 } from 'lucide-react';

interface WeekViewProps {
  tasks: Task[];
  categories: Category[];
  profile: UserProfile;
  settings: UserSettings;
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  onToggleTimer: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTop3: (task: Task) => void;
  onTogglePin: (task: Task) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onMoveTaskDate: (taskId: string, newDate: string) => void;
  onQuickAddTaskForDate: (dateISO: string) => void;
  onPlanWeek: () => void;
  onExportICS: () => void;
  onOpenTemplates?: () => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  tasks,
  categories,
  profile,
  settings,
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  onToggleTimer,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onToggleTop3,
  onTogglePin,
  onMoveTaskDate,
  onQuickAddTaskForDate,
  onPlanWeek,
  onExportICS,
  onOpenTemplates,
}) => {
  const {
    days,
    todayISO,
    selectedYear,
    selectedMonth,
    monthName,
    isCurrentMonth,
    MONTH_NAMES,
    goToNextMonth,
    goToPrevMonth,
    goToTodayMonth,
    setMonthAndYear,
  } = useInfiniteDays();

  const containerRef = useRef<HTMLDivElement>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileSelectedDate, setMobileSelectedDate] = useState<string | null>(null);

  const scrollToToday = useCallback(() => {
    if (!containerRef.current) return;
    const todayEl = containerRef.current.querySelector(`[data-date="${todayISO}"]`) as HTMLElement | null;
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [todayISO]);

  // Center on today on initial mount or when returning to current month
  useEffect(() => {
    if (isCurrentMonth) {
      const timer = setTimeout(() => {
        scrollToToday();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isCurrentMonth, scrollToToday]);

  const handleGoToToday = () => {
    goToTodayMonth();
    setTimeout(() => {
      scrollToToday();
    }, 120);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;

      if (e.key === 'Home' || e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleGoToToday();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Total visible metrics for current month
  const activeTasksList = useMemo(() => tasks.filter(t => !t.deletedAt), [tasks]);
  
  // Filter tasks belonging to current visible month, counting each day of a
  // recurring series as an occurrence of its own
  const monthTasks = useMemo(() => {
    const visibleDates = days.map(d => d.dateISO);
    const map = tasksByDate(activeTasksList, visibleDates);
    return visibleDates.flatMap(d => map.get(d) ?? []);
  }, [activeTasksList, days]);

  const totalTasks = monthTasks.length;
  const completedTasks = monthTasks.filter(t => t.completed).length;
  const totalPlannedMinutes = monthTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 45), 0);
  const totalPlannedHours = formatMinutesHuman(totalPlannedMinutes);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg)] text-[var(--texto)] overflow-hidden">
      {/* Sticky Top Header */}
      <WeekHeader
        monthName={monthName}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        monthNames={MONTH_NAMES}
        isCurrentMonth={isCurrentMonth}
        totalTasks={totalTasks}
        completedTasks={completedTasks}
        totalPlannedHours={totalPlannedHours}
        onGoToToday={handleGoToToday}
        onPrevMonth={goToPrevMonth}
        onNextMonth={goToNextMonth}
        onSelectMonth={setMonthAndYear}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onPlanWeek={onPlanWeek}
        onExportICS={onExportICS}
        onOpenTemplates={onOpenTemplates}
      />

      {/* Main View Area */}
      {/* Mobile: 7-Day Strip + Single Day View (Bloco B4) */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        {/* 7-Day Strip with Capacity / Load Bars */}
        <div className="flex items-center justify-between gap-1 p-2 bg-[var(--surface)] border-b border-[var(--borda)] overflow-x-auto">
          {days.slice(0, 7).map((d) => {
            const isSelected = (mobileSelectedDate || todayISO) === d.dateISO;
            const dTasks = tasksForDate(activeTasksList, d.dateISO);
            const plannedMin = dTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
            const weekday = new Date(d.dateISO + 'T00:00:00').getDay();
            const capacityMin = settings?.dailyCapacityMinutes?.[weekday] || 240; // 4h padrão
            const loadRatio = capacityMin > 0 ? plannedMin / capacityMin : 0;
            const loadColor = loadRatio > 1.0 ? 'bg-red-500' : loadRatio > 0.8 ? 'bg-amber-500' : 'bg-emerald-500';

            return (
              <button
                key={d.dateISO}
                type="button"
                onClick={() => setMobileSelectedDate(d.dateISO)}
                className={`flex-1 min-w-[42px] py-1.5 px-1 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)] ring-2 ring-[var(--primary)] font-bold'
                    : 'text-[var(--texto-suave)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <span className="text-[11px] uppercase font-bold">{d.dayName.slice(0, 1)}</span>
                <span className="text-sm tabular-nums font-bold">{d.dayNumber}</span>
                {/* Mini Load Bar */}
                <div className="w-full h-1 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                  <div className={`h-full ${loadColor} rounded-full`} style={{ width: `${Math.min(100, Math.round(loadRatio * 100))}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
          {(() => {
            const currentDayISO = mobileSelectedDate || todayISO;
            const dayObj = days.find(d => d.dateISO === currentDayISO) || days[0];
            const dTasks = tasksForDate(activeTasksList, currentDayISO);
            const plannedMin = dTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
            const weekday = new Date(currentDayISO + 'T00:00:00').getDay();
            const capacityMin = settings?.dailyCapacityMinutes?.[weekday] || 240;

            const shiftDate = (dateStr: string, daysOffset: number) => {
              const d = new Date(dateStr + 'T00:00:00');
              d.setDate(d.getDate() + daysOffset);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
            };

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--borda)]">
                  <div>
                    <span className="text-base font-bold text-[var(--texto)]">
                      {dayObj?.dayName}, {dayObj?.dayNumber} de {dayObj?.monthName}
                    </span>
                    <span className="text-xs text-[var(--texto-suave)] block">
                      {(plannedMin / 60).toFixed(1)}h planejadas de {(capacityMin / 60).toFixed(1)}h de capacidade
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onQuickAddTaskForDate(currentDayISO)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
                  >
                    + Tarefa
                  </button>
                </div>

                {dTasks.length === 0 ? (
                  <div className="text-center py-10 text-sm text-[var(--texto-suave)]">
                    Nenhuma tarefa para este dia. Aproveite para descansar ou adiantar matérias!
                  </div>
                ) : (
                  dTasks.map(task => {
                    const cat = categories.find(c => c.id === task.categoryId) || categories[0];
                    return (
                      <div
                        key={task.id}
                        className="bg-[var(--surface)] border border-[var(--borda)] rounded-2xl p-3.5 shadow-sm space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => onToggleComplete(task)}
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                                task.completed ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-[var(--borda)]'
                              }`}
                            >
                              {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                            <span className={`text-sm font-semibold truncate ${task.completed ? 'line-through text-[var(--texto-suave)]' : 'text-[var(--texto)]'}`}>
                              {task.title}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--texto-suave)] tabular-nums">
                            {task.estimatedMinutes || 30}m
                          </span>
                        </div>

                        {/* Botões de Mover Dia Rápidos (Bloco B4) */}
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--borda)] text-xs text-[var(--texto-suave)]">
                          <button
                            type="button"
                            onClick={() => onMoveTaskDate(task.id, shiftDate(currentDayISO, -1))}
                            className="hover:text-[var(--primary)] font-medium cursor-pointer"
                          >
                            ← Ontem
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleTimer(task)}
                            className="font-bold text-[var(--primary)] cursor-pointer"
                          >
                            {activeTask?.id === task.id && activeTimerRunning ? 'Pausar Foco' : 'Iniciar Foco ▶'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveTaskDate(task.id, shiftDate(currentDayISO, 1))}
                            className="hover:text-[var(--primary)] font-medium cursor-pointer"
                          >
                            Amanhã →
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Desktop (≥ md): Full Grid / List as before */}
      <div className="hidden md:flex flex-1 overflow-hidden flex-col">
        {viewMode === 'grid' ? (
          <WeekStrip
            days={days}
            tasks={activeTasksList}
            categories={categories}
            activeTask={activeTask}
            activeTimerRunning={activeTimerRunning}
            activeTimerElapsed={activeTimerElapsed}
            draggedTaskId={draggedTaskId}
            onDragStart={setDraggedTaskId}
            onDragEnd={() => setDraggedTaskId(null)}
            onMoveTaskDate={onMoveTaskDate}
            onToggleTimer={onToggleTimer}
            onToggleComplete={onToggleComplete}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onToggleTop3={onToggleTop3}
            onTogglePin={onTogglePin}
            onQuickAddTask={onQuickAddTaskForDate}
            onNextMonth={goToNextMonth}
            onPrevMonth={goToPrevMonth}
            containerRef={containerRef}
          />
        ) : (
          /* Alternative Dense List Mode */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-4">
            {days.map((day) => {
              const dayTasks = tasksForDate(activeTasksList, day.dateISO);
              if (dayTasks.length === 0) return null;

              return (
                <div key={day.dateISO} className="card-hover bg-[var(--surface)] border border-[var(--borda)] rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-[var(--borda)] pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--texto)]">
                        {day.dayName}, {day.dayNumber} de {day.monthName}
                      </span>
                      {day.isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)] text-white">
                          Hoje
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--texto-muted)] tabular-nums">
                      {dayTasks.length} {dayTasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {dayTasks.map(task => {
                      const cat = categories.find(c => c.id === task.categoryId) || categories[0];
                      return (
                        <div
                          key={task.id}
                          data-gif-host
                          onClick={() => onEditTask(task)}
                          className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] hover:border-[var(--primary)] transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete(task);
                              }}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                task.completed ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-[var(--borda-hover)]'
                              }`}
                            >
                              {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                            <CategoryIcon category={cat} size="sm" className="!w-4 !h-4 !rounded" />
                            <span className={`text-xs font-semibold truncate ${task.completed ? 'line-through text-[var(--texto-muted)]' : 'text-[var(--texto)]'}`}>
                              {task.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--texto-muted)] tabular-nums">
                            {task.time && <span className="font-bold text-[var(--texto)]">{task.time}</span>}
                            <span>{task.estimatedMinutes || 45}m</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleTimer(task);
                              }}
                              className="p-1 text-[var(--texto-suave)] hover:text-[var(--primary)]"
                            >
                              {activeTask?.id === task.id && activeTimerRunning ? (
                                <Pause className="w-3.5 h-3.5 fill-current text-[var(--primary)]" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
