import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ArrowRight, X, Clock, Calendar, CheckSquare } from 'lucide-react';
import { GifIcon } from './GifIcon';
import { Task, DailyMood, UserProfile } from '../types';
import { formatSecondsToDigital, getTodayISO } from '../utils/dateUtils';

interface CloseDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  profile: UserProfile;
  onSaveDailyMood: (mood: 'otimo' | 'bom' | 'neutro' | 'cansado' | 'estressado', energy: number) => void;
  onMoveTasksToTomorrow: (taskIds: string[]) => void;
  onCreateTomorrowTask: (title: string) => void;
  onCompleteDay: () => void;
}

export const CloseDayModal: React.FC<CloseDayModalProps> = ({
  isOpen,
  onClose,
  tasks,
  profile,
  onSaveDailyMood,
  onMoveTasksToTomorrow,
  onCreateTomorrowTask,
  onCompleteDay,
}) => {
  const [selectedMood, setSelectedMood] = useState<'otimo' | 'bom' | 'neutro' | 'cansado' | 'estressado'>('otimo');
  const [selectedEnergy, setSelectedEnergy] = useState<number>(5);
  const [tomorrowTaskTitle, setTomorrowTaskTitle] = useState('');
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  const todayISO = getTodayISO();
  const todayTasks = tasks.filter(t => t.date === todayISO && !t.deletedAt);
  const completedTasks = todayTasks.filter(t => t.completed);
  const pendingTasks = todayTasks.filter(t => !t.completed);

  const totalSecondsToday = todayTasks.reduce((acc, t) => acc + t.spentSeconds, 0);
  const totalHours = (totalSecondsToday / 3600).toFixed(1);
  const todayXP = profile.xpHistory[todayISO] || 0;

  React.useEffect(() => {
    if (isOpen) {
      setSelectedPendingIds(pendingTasks.map(t => t.id));
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, pendingTasks.length, onClose]);

  if (!isOpen) return null;

  const handleFinish = () => {
    onSaveDailyMood(selectedMood, selectedEnergy);
    if (selectedPendingIds.length > 0) {
      onMoveTasksToTomorrow(selectedPendingIds);
    }
    if (tomorrowTaskTitle.trim()) {
      onCreateTomorrowTask(tomorrowTaskTitle.trim());
    }
    onCompleteDay();
    onClose();
  };

  const togglePendingSelect = (id: string) => {
    setSelectedPendingIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-modal">
      <div className="w-full max-w-lg rounded-[24px] bg-[var(--surface)] p-6 sm:p-7 shadow-2xl border border-[var(--borda)] relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <GifIcon name="finalizar-dia" className="w-14 h-14 shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-[var(--texto)]">Fechar o Dia</h2>
            <p className="text-xs text-[var(--texto-suave)] font-medium">
              Revise suas conquistas de hoje e deixe tudo pronto para amanhã.
            </p>
          </div>
        </div>

        {/* Day Stats Summary */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] mb-5 text-center">
          <div>
            <span className="text-xs font-semibold text-[var(--texto-suave)] block">XP Ganho</span>
            <span className="text-lg font-black text-[var(--primary)] tabular-nums">+{todayXP} XP</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--texto-suave)] block">Tempo Focado</span>
            <span className="text-lg font-black text-[var(--texto)] tabular-nums">{totalHours}h</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--texto-suave)] block">Concluídas</span>
            <span className="text-lg font-black text-emerald-600 tabular-nums">
              {completedTasks.length}/{todayTasks.length}
            </span>
          </div>
        </div>

        {/* Section 1: Mood Rating */}
        <div className="mb-5">
          <label className="text-xs font-extrabold text-[var(--texto)] block mb-2.5">
            Como você se sente com o rendimento de hoje?
          </label>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { key: 'otimo', emoji: '🤩', label: 'Ótima', energy: 5 },
              { key: 'bom', emoji: '😊', label: 'Boa', energy: 4 },
              { key: 'neutro', emoji: '😐', label: 'Normal', energy: 3 },
              { key: 'cansado', emoji: '😴', label: 'Cansada', energy: 2 },
              { key: 'estressado', emoji: '🤯', label: 'Sem foco', energy: 1 },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  setSelectedMood(m.key as any);
                  setSelectedEnergy(m.energy);
                }}
                className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  selectedMood === m.key
                    ? 'bg-[var(--primary-soft)] ring-2 ring-[var(--primary)]'
                    : 'bg-[var(--surface-secondary)] hover:bg-[var(--borda)]'
                }`}
              >
                <span className="text-2xl leading-none">{m.emoji}</span>
                <span className="text-xs font-bold text-[var(--texto)] mt-1">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Move Pending Tasks to Tomorrow */}
        {pendingTasks.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-extrabold text-[var(--texto)]">
                Tarefas pendentes de hoje ({pendingTasks.length})
              </label>
              <button
                type="button"
                onClick={() => {
                  if (selectedPendingIds.length === pendingTasks.length) setSelectedPendingIds([]);
                  else setSelectedPendingIds(pendingTasks.map(t => t.id));
                }}
                className="text-xs text-[var(--primary)] font-bold cursor-pointer"
              >
                {selectedPendingIds.length === pendingTasks.length ? 'Desmarcar todas' : 'Mover todas'}
              </button>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {pendingTasks.map(task => (
                <label
                  key={task.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--borda-soft)] transition-colors cursor-pointer text-xs"
                >
                  <span className="font-bold text-[var(--texto)] truncate max-w-[280px]">
                    {task.title}
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedPendingIds.includes(task.id)}
                    onChange={() => togglePendingSelect(task.id)}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Tomorrow's First Task */}
        <div className="mb-6">
          <label className="text-xs font-extrabold text-[var(--texto)] block mb-1.5">
            Qual será a sua 1ª tarefa de amanhã?
          </label>
          <input
            type="text"
            value={tomorrowTaskTitle}
            onChange={(e) => setTomorrowTaskTitle(e.target.value)}
            placeholder="Ex.: Revisar redação ou fazer 10 questões de matemática..."
            className="w-full px-4 py-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-sm font-semibold text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--texto-muted)]"
          />
        </div>

        {/* Action Button */}
        <button
          onClick={handleFinish}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-extrabold shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Concluir e Fechar o Dia (+20 XP)</span>
        </button>

      </div>
    </div>
  );
};
