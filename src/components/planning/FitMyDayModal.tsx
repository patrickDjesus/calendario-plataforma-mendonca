import React, { useState } from 'react';
import { X, Sparkles, Clock, Calendar, Check, ArrowRight } from 'lucide-react';
import { Task, Category } from '../../types';
import { formatMinutesHuman } from '../../utils/dateUtils';
import { CategoryIcon } from '../CategoryIcon';

interface FitMyDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  categories: Category[];
  todayISO: string;
  onApplySchedule: (updatedTasks: Task[]) => void;
}

export const FitMyDayModal: React.FC<FitMyDayModalProps> = ({
  isOpen,
  onClose,
  tasks,
  categories,
  todayISO,
  onApplySchedule,
}) => {
  const [startHour, setStartHour] = useState(8); // 08:00
  const [endHour, setEndHour] = useState(21); // 21:00
  const [breakMinutes, setBreakMinutes] = useState(15);

  if (!isOpen) return null;

  // Unscheduled pending tasks for today
  const todayTasks = tasks.filter(t => t.date === todayISO && !t.completed && !t.deletedAt);
  const unscheduledTasks = todayTasks.filter(t => !t.time);
  const alreadyScheduled = todayTasks.filter(t => !!t.time);

  // Sort unscheduled by priority and Top 3
  const priorityWeight: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
  const sortedToFit = [...unscheduledTasks].sort((a, b) => {
    if (a.isTop3 && !b.isTop3) return -1;
    if (!a.isTop3 && b.isTop3) return 1;
    return (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
  });

  // Calculate simulated plan
  let currentMinute = startHour * 60;
  const proposedAssignments: Array<{ task: Task; proposedTime: string; endTime: string }> = [];

  for (const task of sortedToFit) {
    const dur = task.estimatedMinutes || 45;
    
    // Check conflicts with already scheduled tasks
    while (currentMinute + dur <= endHour * 60) {
      const startH = Math.floor(currentMinute / 60);
      const startM = currentMinute % 60;
      const endMTotal = currentMinute + dur;
      const endH = Math.floor(endMTotal / 60);
      const endM = endMTotal % 60;

      const formattedStart = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
      const formattedEnd = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      // Check collision
      const hasConflict = alreadyScheduled.some(s => {
        if (!s.time) return false;
        const [sh, sm] = s.time.split(':').map(Number);
        const sStart = sh * 60 + sm;
        const sEnd = sStart + (s.estimatedMinutes || 45);
        return (currentMinute < sEnd && endMTotal > sStart);
      });

      if (!hasConflict) {
        proposedAssignments.push({
          task: { ...task, time: formattedStart },
          proposedTime: formattedStart,
          endTime: formattedEnd,
        });
        currentMinute = endMTotal + breakMinutes;
        break;
      } else {
        currentMinute += 30; // step forward
      }
    }
  }

  const handleApply = () => {
    const updated = proposedAssignments.map(p => p.task);
    onApplySchedule(updated);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[var(--texto)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--borda)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--texto)]">Encaixar meu dia</h2>
              <p className="text-xs text-[var(--texto-suave)]">Distribuição inteligente das tarefas nos horários livres da timeline</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 bg-[var(--surface-secondary)]/40 border-b border-[var(--borda)] flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--texto-muted)]">Janela do dia:</span>
            <input 
              type="number" 
              min="5" 
              max="12" 
              value={startHour} 
              onChange={e => setStartHour(Number(e.target.value))}
              className="w-14 h-8 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-center font-bold text-[var(--texto)]"
            />
            <span>às</span>
            <input 
              type="number" 
              min="14" 
              max="24" 
              value={endHour} 
              onChange={e => setEndHour(Number(e.target.value))}
              className="w-14 h-8 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-center font-bold text-[var(--texto)]"
            />
            <span>h</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[var(--texto-muted)]">Pausa entre blocos:</span>
            <select
              value={breakMinutes}
              onChange={e => setBreakMinutes(Number(e.target.value))}
              className="h-8 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
            >
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
            </select>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between text-xs text-[var(--texto-suave)]">
            <span>Tarefas a encaixar: <strong>{unscheduledTasks.length}</strong></span>
            <span>Encaixadas com sucesso: <strong>{proposedAssignments.length}</strong></span>
          </div>

          {proposedAssignments.length > 0 ? (
            <div className="space-y-2">
              {proposedAssignments.map(({ task, proposedTime, endTime }) => {
                const cat = categories.find(c => c.id === task.categoryId) || categories[0];
                return (
                  <div 
                    key={task.id}
                    data-gif-host
                    className="p-3 rounded-xl border border-[var(--borda)] bg-[var(--surface)] flex items-center justify-between gap-3 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CategoryIcon category={cat} size="sm" className="!w-5 !h-5 !rounded-md" />
                      <span className="font-semibold text-[var(--texto)] truncate">{task.title}</span>
                      {task.isTop3 && <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">Top 3</span>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 tabular-nums">
                      <span className="text-[var(--texto-muted)]">{task.estimatedMinutes || 45}m</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--texto-muted)]" />
                      <span className="px-2 py-1 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs">
                        {proposedTime} - {endTime}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-[var(--texto-muted)]">
              Todas as tarefas de hoje já possuem horário definido ou não há tarefas pendentes!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--borda)] bg-[var(--surface)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-xs font-semibold text-[var(--texto-suave)] hover:text-[var(--texto)] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={proposedAssignments.length === 0}
            onClick={handleApply}
            className="h-10 px-6 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Agendamento Inteligente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
