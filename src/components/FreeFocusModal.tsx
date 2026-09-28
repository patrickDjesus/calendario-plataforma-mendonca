import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Sparkles, Volume2, VolumeX, X, Save, Clock } from 'lucide-react';
import { Category } from '../types';
import { formatSecondsToDigital } from '../utils/dateUtils';
import { audioSynthesizer } from '../services/audioSynthesizer';

interface FreeFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveFreeSession: (title: string, categoryId: string, durationSeconds: number, note?: string) => void;
}

export const FreeFocusModal: React.FC<FreeFocusModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveFreeSession,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || 'cat-estudo');
  const [sessionNote, setSessionNote] = useState('');
  const [showSaveStep, setShowSaveStep] = useState(false);
  const [ambientSound, setAmbientSound] = useState<'none' | 'chuva' | 'ruido_branco' | 'ruido_marrom'>('none');

  useEffect(() => {
    let interval: number | null = null;
    if (isOpen && isRunning && !showSaveStep) {
      interval = window.setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, isRunning, showSaveStep]);

  useEffect(() => {
    if (ambientSound !== 'none') {
      audioSynthesizer.setAmbientSound(ambientSound, 0.4);
    } else {
      audioSynthesizer.stopAmbient();
    }
    return () => {
      audioSynthesizer.stopAmbient();
    };
  }, [ambientSound]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        audioSynthesizer.stopAmbient();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStopAndSave = () => {
    setIsRunning(false);
    audioSynthesizer.stopAmbient();
    setShowSaveStep(true);
  };

  const handleFinalSave = () => {
    const finalTitle = sessionTitle.trim() || `Sessão Livre (${Math.ceil(seconds / 60)}min)`;
    onSaveFreeSession(finalTitle, selectedCategoryId, seconds, sessionNote.trim() || undefined);
    // Reset
    setSeconds(0);
    setIsRunning(true);
    setSessionTitle('');
    setShowSaveStep(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-modal">
      <div className="w-full max-w-md rounded-[28px] bg-[var(--surface)] p-6 sm:p-8 shadow-2xl border border-[var(--borda)] text-center relative">
        
        {/* Close Button */}
        <button
          onClick={() => {
            audioSynthesizer.stopAmbient();
            onClose();
          }}
          className="absolute top-5 right-5 p-2 rounded-xl text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!showSaveStep ? (
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sessão de Foco Livre</span>
            </div>

            <h2 className="text-xl font-extrabold text-[var(--texto)] mb-1">
              Mente em Foco Total
            </h2>
            <p className="text-xs text-[var(--texto-suave)] font-medium mb-6">
              Cronômetro independente. Ao pausar ou concluir, salve os minutos no seu histórico.
            </p>

            {/* Huge Digital Timer */}
            <div className="py-8 px-4 rounded-3xl bg-[var(--surface-secondary)] border border-[var(--borda)] mb-6 shadow-inner">
              <span className="text-5xl sm:text-6xl font-black text-[var(--texto)] tracking-tight tabular-nums">
                {formatSecondsToDigital(seconds)}
              </span>
            </div>

            {/* Ambient Sound Selector */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <Volume2 className="w-4 h-4 text-[var(--texto-suave)]" />
              <div className="flex items-center gap-1 bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--borda)] text-xs">
                {(['none', 'chuva', 'ruido_branco', 'ruido_marrom'] as const).map(sound => (
                  <button
                    key={sound}
                    onClick={() => setAmbientSound(sound)}
                    className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                      ambientSound === sound
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                    }`}
                  >
                    {sound === 'none' ? 'Sem som' : sound.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isRunning ? 'Pausar' : 'Retomar'}</span>
              </button>

              <button
                onClick={handleStopAndSave}
                disabled={seconds < 5}
                className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Sessão</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-left">
            <h3 className="text-lg font-extrabold text-[var(--texto)] mb-1 text-center">
              Salvar Sessão de Foco
            </h3>
            <p className="text-xs text-[var(--texto-suave)] text-center mb-5 font-medium">
              Você acumulou <strong className="text-[var(--primary)]">{formatSecondsToDigital(seconds)}</strong> de foco livre!
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--texto)] block mb-1">
                  O que você estudou ou fez?
                </label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="Ex.: Resolução de exercícios de cálculo..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-sm text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--texto)] block mb-1">
                  Matéria / Categoria
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-sm text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--texto)] block mb-1">
                  Nota rápida / Reflexão (opcional)
                </label>
                <textarea
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  placeholder="Ex.: Rendimento bom, fixei o conceito de derivadas..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-sm text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveStep(false)}
                  className="flex-1 py-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--borda)] text-xs font-bold text-[var(--texto)] transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleFinalSave}
                  className="flex-1 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-xs font-extrabold text-white shadow-md transition-all cursor-pointer"
                >
                  Salvar no Histórico
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
