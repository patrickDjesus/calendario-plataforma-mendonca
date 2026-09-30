import React, { useRef, useEffect, useState } from 'react';
import { InfiniteDayItem } from '../../hooks/useInfiniteDays';
import { DayColumn } from './DayColumn';
import { Task, Category } from '../../types';
import { tasksByDate as tasksByDateMap } from '../../services/recurrence';
import { ArrowLeft, ArrowRight, Calendar } from 'lucide-react';

interface WeekStripProps {
  days: InfiniteDayItem[];
  tasks: Task[];
  categories: Category[];
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  draggedTaskId: string | null;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onMoveTaskDate: (taskId: string, newDate: string) => void;
  onToggleTimer: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTop3: (task: Task) => void;
  onTogglePin: (task: Task) => void;
  onQuickAddTask: (dateISO: string) => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const WeekStrip: React.FC<WeekStripProps> = ({
  days,
  tasks,
  categories,
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  draggedTaskId,
  onDragStart,
  onDragEnd,
  onMoveTaskDate,
  onToggleTimer,
  onToggleComplete,
  onEditTask,
  onDeleteTask,
  onToggleTop3,
  onTogglePin,
  onQuickAddTask,
  onNextMonth,
  onPrevMonth,
  containerRef,
}) => {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Mouse pan with momentum / inertia
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const velocity = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const momentumRaf = useRef<number | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only pan if clicking on empty space or container background, not on interactive cards/buttons
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, [draggable="true"]')) return;

    if (momentumRaf.current) cancelAnimationFrame(momentumRaf.current);
    isMouseDown.current = true;
    startX.current = e.pageX - (containerRef.current?.offsetLeft || 0);
    scrollLeftStart.current = containerRef.current?.scrollLeft || 0;
    lastX.current = e.pageX;
    lastTime.current = performance.now();
    velocity.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - (containerRef.current.offsetLeft || 0);
    const walk = (x - startX.current) * 1.2;
    containerRef.current.scrollLeft = scrollLeftStart.current - walk;

    const now = performance.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = (e.pageX - lastX.current) / dt;
    }
    lastX.current = e.pageX;
    lastTime.current = now;
  };

  const handleMouseUp = () => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;

    // Apply smooth inertia release
    if (Math.abs(velocity.current) > 0.2 && containerRef.current) {
      let currentVelocity = velocity.current * 14;
      const step = () => {
        if (!containerRef.current || Math.abs(currentVelocity) < 0.5) return;
        containerRef.current.scrollLeft -= currentVelocity;
        currentVelocity *= 0.92; // friction
        momentumRaf.current = requestAnimationFrame(step);
      };
      momentumRaf.current = requestAnimationFrame(step);
    }
  };

  // Edge auto-scroll during task drag
  useEffect(() => {
    if (!draggedTaskId) return;

    let autoScrollRaf: number | null = null;

    const handleDragOverWindow = (e: DragEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const edgeThreshold = 70;

      if (e.clientX < rect.left + edgeThreshold) {
        container.scrollLeft -= 14;
      } else if (e.clientX > rect.right - edgeThreshold) {
        container.scrollLeft += 14;
      }
    };

    window.addEventListener('dragover', handleDragOverWindow);
    return () => {
      window.removeEventListener('dragover', handleDragOverWindow);
      if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
    };
  }, [draggedTaskId, containerRef]);

  // Group tasks by date, materializando as ocorrencias das tarefas recorrentes
  const tasksByDate = React.useMemo(
    () => tasksByDateMap(tasks, days.map(d => d.dateISO)),
    [tasks, days],
  );

  return (
    <div className="relative w-full flex-1 overflow-hidden">
      {/* Subtle edge fades */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--bg)] to-transparent pointer-events-none z-10 opacity-70" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--bg)] to-transparent pointer-events-none z-10 opacity-70" />

      {/* Horizontal Strip */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="w-full h-full overflow-x-auto p-4 sm:p-6 flex items-start gap-3 snap-x snap-mandatory scroll-smooth focus:outline-none"
        style={{
          scrollbarWidth: 'thin',
          cursor: isMouseDown.current ? 'grabbing' : 'default',
        }}
      >
        {/* Previous Month Card */}
        <div className="w-[180px] shrink-0 rounded-2xl border border-dashed border-[var(--borda)] bg-[var(--surface-secondary)]/30 hover:bg-[var(--surface-secondary)]/70 flex flex-col items-center justify-center p-6 gap-3 transition-all snap-start text-center my-auto self-stretch min-h-[480px]">
          <div className="w-10 h-10 rounded-2xl bg-[var(--surface)] border border-[var(--borda)] flex items-center justify-center text-[var(--texto-suave)]">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-[var(--texto-suave)]">Mês Anterior</span>
            <p className="text-[11px] text-[var(--texto-muted)] mt-0.5">Navegar para o mês anterior</p>
          </div>
          <button
            type="button"
            onClick={onPrevMonth}
            className="px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] hover:border-[var(--primary)] text-xs font-bold text-[var(--primary)] hover:bg-[var(--primary-soft)] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar Mês</span>
          </button>
        </div>

        {/* Days of current month */}
        {days.map((day) => {
          const dayTasks = tasksByDate.get(day.dateISO) || [];

          return (
            <React.Fragment key={day.dateISO}>
              <DayColumn
                day={day}
                tasks={dayTasks}
                categories={categories}
                activeTask={activeTask}
                activeTimerRunning={activeTimerRunning}
                activeTimerElapsed={activeTimerElapsed}
                draggedTaskId={draggedTaskId}
                isDragOver={dragOverDate === day.dateISO}
                onDragStart={onDragStart}
                onDragEnd={() => {
                  setDragOverDate(null);
                  onDragEnd();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverDate !== day.dateISO) setDragOverDate(day.dateISO);
                }}
                onDragLeave={() => {
                  if (dragOverDate === day.dateISO) setDragOverDate(null);
                }}
                onDrop={(targetDate) => {
                  setDragOverDate(null);
                  if (draggedTaskId) {
                    onMoveTaskDate(draggedTaskId, targetDate);
                  }
                  onDragEnd();
                }}
                onToggleTimer={onToggleTimer}
                onToggleComplete={onToggleComplete}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onToggleTop3={onToggleTop3}
                onTogglePin={onTogglePin}
                onQuickAddTask={onQuickAddTask}
              />
            </React.Fragment>
          );
        })}

        {/* Next Month Transition Card */}
        <div className="w-[200px] shrink-0 rounded-2xl border border-dashed border-[var(--primary)]/40 bg-[var(--primary-soft)]/10 hover:bg-[var(--primary-soft)]/20 flex flex-col items-center justify-center p-6 gap-3 transition-all snap-start text-center my-auto self-stretch min-h-[480px]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center shadow-md shadow-violet-500/20">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--primary)]">Próximo Mês</span>
            <p className="text-xs text-[var(--texto-suave)] mt-1 font-medium">Avançar para os dias do próximo mês</p>
          </div>
          <button
            type="button"
            onClick={onNextMonth}
            className="px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2 hover:scale-105"
          >
            <span>Avançar Mês</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

