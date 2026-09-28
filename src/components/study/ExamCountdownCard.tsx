import React, { useState } from 'react';
import { Target, Calendar, Clock, Edit2, Check } from 'lucide-react';
import { ExamCountdown } from '../../types';

interface ExamCountdownCardProps {
  countdown: ExamCountdown;
  onUpdate: (updated: ExamCountdown) => void;
}

export const ExamCountdownCard: React.FC<ExamCountdownCardProps> = ({
  countdown,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [targetName, setTargetName] = useState(countdown.targetName);
  const [examDate, setExamDate] = useState(countdown.examDate);
  const [totalTopics, setTotalTopics] = useState(countdown.totalTopics);
  const [completedTopics, setCompletedTopics] = useState(countdown.completedTopics);

  // Calculate days remaining
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(countdown.examDate + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));

  const remainingTopics = Math.max(0, countdown.totalTopics - countdown.completedTopics);
  const topicsPerWeek = Math.ceil(remainingTopics / weeksLeft);
  const progressPct = countdown.totalTopics > 0 
    ? Math.min(100, Math.round((countdown.completedTopics / countdown.totalTopics) * 100))
    : 0;

  const handleSave = () => {
    onUpdate({
      targetName: targetName.trim() || 'Prova / Concurso Alvo',
      examDate,
      totalTopics: Number(totalTopics) > 0 ? Number(totalTopics) : 50,
      completedTopics: Math.min(Number(totalTopics), Math.max(0, Number(completedTopics))),
    });
    setIsEditing(false);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-[var(--borda)] bg-[var(--surface)] shadow-xs relative group">
      {!isEditing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                  Meta da Prova
                </span>
                <h3 className="text-sm font-bold text-[var(--texto)]">
                  {countdown.targetName}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-lg font-black text-[var(--primary)] tabular-nums">
                  {daysLeft} <span className="text-xs font-bold text-[var(--texto-suave)]">dias</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Editar meta da prova"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--texto-muted)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--texto-suave)] tabular-nums">
              <span>{countdown.completedTopics} de {countdown.totalTopics} tópicos estudados</span>
              <span className="font-bold text-[var(--primary)]">{progressPct}%</span>
            </div>
            <div className="w-full bg-[var(--surface-secondary)] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-[var(--primary)] h-full rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Weekly Velocity Callout */}
          <div className="p-2.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--borda)] flex items-center justify-between text-xs tabular-nums">
            <div className="text-[var(--texto-suave)]">
              Faltam <strong>{daysLeft} dias</strong> ({remainingTopics} tópicos)
            </div>
            <div className="font-bold text-[var(--primary)]">
              ~{topicsPerWeek} tópicos / semana
            </div>
          </div>
        </div>
      ) : (
        /* Edit Form */
        <div className="space-y-3 animate-fadeIn">
          <h4 className="text-xs font-bold text-[var(--texto)]">Configurar Meta da Prova</h4>
          <input
            type="text"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            placeholder="Nome do exame (ex: ENEM 2026)"
            className="w-full h-9 px-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)]"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <span className="block text-[10px] text-[var(--texto-muted)] mb-1">Data da Prova</span>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full h-8 px-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
              />
            </div>
            <div>
              <span className="block text-[10px] text-[var(--texto-muted)] mb-1">Total de Tópicos</span>
              <input
                type="number"
                value={totalTopics}
                onChange={(e) => setTotalTopics(Number(e.target.value))}
                className="w-full h-8 px-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
              />
            </div>
            <div>
              <span className="block text-[10px] text-[var(--texto-muted)] mb-1">Concluídos</span>
              <input
                type="number"
                value={completedTopics}
                onChange={(e) => setCompletedTopics(Number(e.target.value))}
                className="w-full h-8 px-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="h-8 px-3 rounded-lg border border-[var(--borda)] text-xs text-[var(--texto-suave)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-8 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-bold cursor-pointer"
            >
              Salvar Meta
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
