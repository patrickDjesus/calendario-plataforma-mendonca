import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Target, ArrowRight, ArrowLeft, Sparkles, Award } from 'lucide-react';
import { Task, UserProfile } from '../../types';
import { formatMinutesHuman } from '../../utils/dateUtils';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  profile: UserProfile;
  onSaveReviewSummary: (summary: string) => void;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  tasks,
  profile,
  onSaveReviewSummary,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reflectionText, setReflectionText] = useState('');
  const [nextWeekGoals, setNextWeekGoals] = useState('');

  if (!isOpen) return null;

  // Review calculations
  const completedTasks = tasks.filter(t => t.completed && !t.deletedAt);
  const pendingTasks = tasks.filter(t => !t.completed && !t.deletedAt);
  const totalFocusSeconds = tasks.reduce((sum, t) => sum + (t.spentSeconds || 0), 0);
  const totalFocusHours = formatMinutesHuman(Math.floor(totalFocusSeconds / 60));

  const handleFinish = () => {
    const combined = `[Feito: ${completedTasks.length} tarefas (${totalFocusHours})] Reflexão: ${reflectionText} | Metas: ${nextWeekGoals}`;
    onSaveReviewSummary(combined);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[var(--texto)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--borda)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--texto)]">Revisão Semanal Guiada</h2>
              <p className="text-xs text-[var(--texto-suave)]">Passo {step} de 3 · Fechamento do ciclo semanal</p>
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

        {/* Stepper Progress */}
        <div className="flex h-1 bg-[var(--surface-secondary)]">
          <div className={`h-full bg-[var(--primary)] transition-all ${step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'}`} />
        </div>

        {/* Step Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-[var(--texto)] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Passo 1: O que foi conquistado</span>
              </h3>
              <p className="text-xs text-[var(--texto-suave)]">
                Celebre suas vitórias da semana antes de analisar o que precisa de ajustes.
              </p>

              <div className="grid grid-cols-2 gap-3 text-center tabular-nums">
                <div className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)]/40">
                  <div className="text-2xl font-black text-[var(--primary)]">{completedTasks.length}</div>
                  <div className="text-xs font-semibold text-[var(--texto-suave)] mt-1">Tarefas Concluídas</div>
                </div>
                <div className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)]/40">
                  <div className="text-2xl font-black text-[var(--texto)]">{totalFocusHours}</div>
                  <div className="text-xs font-semibold text-[var(--texto-suave)] mt-1">Tempo Total de Foco</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-soft)]/20 text-xs text-[var(--texto)] flex items-center gap-2.5">
                <Award className="w-5 h-5 text-[var(--primary)] shrink-0" />
                <span>Você manteve seu nível e acumulou <strong>{profile.xp} XP</strong> na jornada!</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-[var(--texto)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Passo 2: Onde escorregou ou travou?</span>
              </h3>
              <p className="text-xs text-[var(--texto-suave)]">
                Houve alguma tarefa que ficou para trás ({pendingTasks.length} pendentes)? Anote o que causou atrito (cansaço, imprevistos, falta de clareza).
              </p>

              <textarea
                value={reflectionText}
                onChange={e => setReflectionText(e.target.value)}
                placeholder="Ex: Tive dificuldade na lista de questões de Cinemática porque faltou revisar a teoria antes..."
                rows={4}
                className="w-full p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] resize-none"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-[var(--texto)] flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--primary)]" />
                <span>Passo 3: Metas e Compromissos da Próxima Semana</span>
              </h3>
              <p className="text-xs text-[var(--texto-suave)]">
                Defina seus 3 principais focos para iniciar a próxima semana com direção clara.
              </p>

              <textarea
                value={nextWeekGoals}
                onChange={e => setNextWeekGoals(e.target.value)}
                placeholder="Ex: 1. Finalizar Módulo de Funções&#10;2. Fazer 1 simulado completo no sábado&#10;3. Bater meta de 4 treinos..."
                rows={4}
                className="w-full p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-[var(--borda)] bg-[var(--surface)] flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="h-10 px-4 rounded-xl border border-[var(--borda)] text-xs font-semibold text-[var(--texto)] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as 2 | 3)}
              className="h-10 px-5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Avançar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="h-10 px-6 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer shadow-xs active:scale-98"
            >
              Finalizar Revisão Semanal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
