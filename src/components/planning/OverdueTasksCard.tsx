import React, { useState } from 'react';
import { AlertCircle, Calendar, ArrowRight, Trash2, CheckCircle2, X } from 'lucide-react';
import { Task } from '../../types';

interface OverdueTasksCardProps {
  overdueTasks: Task[];
  todayISO: string;
  onMoveAllToToday: () => void;
  onDistributeAcrossWeek: () => void;
  onDiscardAll: () => void;
}

export const OverdueTasksCard: React.FC<OverdueTasksCardProps> = ({
  overdueTasks,
  todayISO,
  onMoveAllToToday,
  onDistributeAcrossWeek,
  onDiscardAll,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || overdueTasks.length === 0) return null;

  return (
    <div className="mb-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-[var(--texto)] shadow-xs animate-fadeIn flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-[var(--texto)] flex items-center gap-2">
            <span>Tarefas atrasadas de dias anteriores ({overdueTasks.length})</span>
          </div>
          <p className="text-xs text-[var(--texto-suave)] mt-0.5">
            Deseja reorganizar seu cronograma para manter seu plano de estudos realista?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button
          type="button"
          onClick={onMoveAllToToday}
          className="h-8 px-3 rounded-lg bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-xs"
        >
          Mover para hoje
        </button>
        <button
          type="button"
          onClick={onDistributeAcrossWeek}
          className="h-8 px-3 rounded-lg border border-[var(--borda)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--texto)] transition-all cursor-pointer"
        >
          Distribuir na semana
        </button>
        <button
          type="button"
          onClick={onDiscardAll}
          className="h-8 px-2.5 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
          title="Descartar tarefas atrasadas"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--texto-muted)] hover:text-[var(--texto)] cursor-pointer"
          title="Ignorar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
