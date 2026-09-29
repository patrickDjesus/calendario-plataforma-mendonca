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
  );
};
