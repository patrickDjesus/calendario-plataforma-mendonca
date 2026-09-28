import React from 'react';
import { Clock, ArrowRight, Check, Trash2, Calendar, Sparkles } from 'lucide-react';
import { Task } from '../types';

interface RolloverBannerProps {
  overdueTasks: Task[];
  onMoveAllToToday: () => void;
  onDismissOverdue: () => void;
}

export const RolloverBanner: React.FC<RolloverBannerProps> = ({
  overdueTasks,
  onMoveAllToToday,
  onDismissOverdue,
}) => {
  if (overdueTasks.length === 0) return null;

  return (
    <div className="w-full rounded-[24px] bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 p-4 sm:p-5 shadow-md animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-[var(--texto)]">
              Você deixou {overdueTasks.length} {overdueTasks.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'} de dias anteriores
            </h4>
            <p className="text-xs text-[var(--texto-suave)] font-medium mt-0.5">
              Deseja reorganizar seu cronograma agora?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onDismissOverdue}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-transparent hover:bg-black/5 text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
          >
            Manter onde estão
          </button>

          <button
            onClick={onMoveAllToToday}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:scale-105"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mover todas para Hoje</span>
          </button>
        </div>

      </div>
    </div>
  );
};
