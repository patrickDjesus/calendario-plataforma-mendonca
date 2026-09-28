import React, { useState } from 'react';
import { HelpCircle, Play, Pause, CheckCircle2, X } from 'lucide-react';
import { Task } from '../types';
import { formatSecondsToDigital } from '../utils/dateUtils';

interface InactivityPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTask: Task | null;
  elapsedSeconds: number;
  onConfirmStillFocused: () => void;
  onPauseWithNote: (note?: string) => void;
  onCompleteWithNote: (note?: string) => void;
}

export const InactivityPromptModal: React.FC<InactivityPromptModalProps> = ({
  isOpen,
  onClose,
  activeTask,
  elapsedSeconds,
  onConfirmStillFocused,
  onPauseWithNote,
  onCompleteWithNote,
}) => {
  const [reflectionNote, setReflectionNote] = useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !activeTask) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-modal">
      <div className="w-full max-w-md rounded-[24px] bg-[var(--surface)] p-6 sm:p-7 shadow-2xl border border-[var(--borda)] text-center relative">
        
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--texto-suave)] hover:text-[var(--texto)]"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <HelpCircle className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-extrabold text-[var(--texto)]">
          Ainda está focado nesta tarefa?
        </h3>
        <p className="text-xs text-[var(--texto-suave)] mt-1 font-medium">
          Você está com o cronômetro ativo em <strong>"{activeTask.title}"</strong> ({formatSecondsToDigital(elapsedSeconds)}).
        </p>

        {/* Optional Reflection Note */}
        <div className="my-4 text-left">
          <label className="text-xs font-bold text-[var(--texto-suave)] block mb-1">
            Nota rápida da sessão (opcional):
          </label>
          <input
            type="text"
            value={reflectionNote}
            onChange={(e) => setReflectionNote(e.target.value)}
            placeholder="O que você avançou até aqui?"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => {
              onConfirmStillFocused();
              onClose();
            }}
            className="w-full py-3 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-md transition-all cursor-pointer"
          >
            Sim, continuo focado! 🚀
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                onPauseWithNote(reflectionNote.trim() || undefined);
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--borda)] text-xs font-bold text-[var(--texto)] transition-colors cursor-pointer"
            >
              Pausar Agora
            </button>

            <button
              onClick={() => {
                onCompleteWithNote(reflectionNote.trim() || undefined);
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              Concluir Tarefa
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
