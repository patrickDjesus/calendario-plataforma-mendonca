import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Check, 
  X, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  RotateCcw, 
  Waves, 
  Wind, 
  Headphones, 
  Coffee,
  Sparkles, 
  Clock, 
  Repeat,
  PenTool,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { Task, Category, PomodoroSettings } from '../types';
import { formatSecondsToDigital, formatMinutesHuman } from '../utils/dateUtils';
import { audioSynthesizer } from '../services/audioSynthesizer';
import { repository } from '../services/repository';
import { CategoryIcon } from './CategoryIcon';
import { GifIcon } from './GifIcon';

interface FullscreenFocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  onToggleTimer: () => void;
  onCompleteTask: (task: Task, reflectionNote?: string, enableSpacedRepetition?: boolean) => void;
  category?: Category;
  pomodoroSettings: PomodoroSettings;
  onUpdatePomodoroSettings: (settings: PomodoroSettings) => void;
}

export const FullscreenFocusMode: React.FC<FullscreenFocusModeProps> = ({
  isOpen,
  onClose,
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  onToggleTimer,
  onCompleteTask,
  category,
  pomodoroSettings,
  onUpdatePomodoroSettings,
}) => {
  const [reflectionNote, setReflectionNote] = useState('');
  const [obstacleNote, setObstacleNote] = useState('');
  const [enableSpacedRep, setEnableSpacedRep] = useState(true);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [showDistractionModal, setShowDistractionModal] = useState(false);
  const [distractionText, setDistractionText] = useState('');
  const [examMode, setExamMode] = useState(false);
  const [pausesCount, setPausesCount] = useState(0);

  const [selectedAmbient, setSelectedAmbient] = useState<PomodoroSettings['ambientSound']>(pomodoroSettings.ambientSound || 'none');
  const [ambientVolume, setAmbientVolume] = useState(pomodoroSettings.ambientVolume ?? 0.5);

  const lastExamChimeMinute = useRef(0);

  // Track pause count
  useEffect(() => {
    if (!activeTimerRunning && activeTimerElapsed > 0) {
      setPausesCount(prev => prev + 1);
    }
  }, [activeTimerRunning]);

  // Exam Mode 30-min reminder
  useEffect(() => {
    if (examMode && activeTimerRunning) {
      const elapsedMinutes = Math.floor(activeTimerElapsed / 60);
      if (elapsedMinutes > 0 && elapsedMinutes % 30 === 0 && elapsedMinutes !== lastExamChimeMinute.current) {
        lastExamChimeMinute.current = elapsedMinutes;
        audioSynthesizer.playExamReminderChime();
      }
    }
  }, [examMode, activeTimerRunning, activeTimerElapsed]);

  // Ambient sound management
  useEffect(() => {
    if (isOpen) {
      if (selectedAmbient !== 'none') {
        audioSynthesizer.setAmbientSound(selectedAmbient as any, ambientVolume);
      }
    } else {
      audioSynthesizer.stopAmbient();
    }
  }, [isOpen, selectedAmbient, ambientVolume]);

  if (!isOpen || !activeTask) return null;

  const estimatedSeconds = (activeTask.estimatedMinutes || 45) * 60;
  const progressPercent = Math.min(100, Math.round((activeTimerElapsed / estimatedSeconds) * 100));

  // Big SVG Ring Math
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const handleAmbientChange = (type: 'none' | 'chuva' | 'ruido_branco' | 'ruido_marrom' | 'cafe' | 'binaural') => {
    setSelectedAmbient(type);
    audioSynthesizer.setAmbientSound(type, ambientVolume);
    onUpdatePomodoroSettings({
      ...pomodoroSettings,
      ambientSound: type,
      ambientVolume,
    });
  };

  const handleVolumeChange = (vol: number) => {
    setAmbientVolume(vol);
    audioSynthesizer.setAmbientVolume(vol);
    onUpdatePomodoroSettings({
      ...pomodoroSettings,
      ambientVolume: vol,
    });
  };

  const handleSaveDistraction = async () => {
    if (!distractionText.trim()) return;
    await repository.addDistractionNote(distractionText.trim(), activeTask);
    setDistractionText('');
    setShowDistractionModal(false);
  };

  const handleFinish = () => {
    setShowReflectionModal(true);
  };

  const confirmFinish = async () => {
    // Save session summary
    const todayISO = new Date().toISOString().split('T')[0];
    await repository.saveFocusSummary({
      date: todayISO,
      startTime: new Date().toLocaleTimeString().slice(0, 5),
      durationMinutes: Math.max(1, Math.round(activeTimerElapsed / 60)),
      taskTitle: activeTask.title,
      categoryId: activeTask.categoryId,
      pausesCount,
      obstacleNote: obstacleNote.trim() || undefined,
      examMode,
    });

    onCompleteTask(activeTask, reflectionNote, enableSpacedRep);
    setShowReflectionModal(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F6FA] text-[#0F172A] flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden animate-fadeIn">
      
      {/* Dynamic atmospheric background gradient (light) */}
      <div 
        className="absolute inset-0 opacity-70 transition-all duration-1000 pointer-events-none"
        style={{
          background: activeTimerRunning 
            ? 'radial-gradient(circle at 50% 50%, rgba(59, 108, 245, 0.16) 0%, rgba(243, 246, 250, 0) 70%)'
            : 'radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.14) 0%, rgba(243, 246, 250, 0) 70%)',
        }}
      />

      {/* Top Header: Ambient Sound Controls & Actions */}
      <div className="relative z-10 flex items-center justify-between gap-4 max-w-5xl mx-auto w-full flex-wrap">
        {/* Category badge */}
        <div className="flex items-center gap-3">
          {category && <CategoryIcon category={category} size="sm" />}
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">
              {category?.name || 'Foco'}
            </span>
            <h2 className="text-sm font-bold text-slate-600 max-w-md truncate">
              {activeTask.title}
            </h2>
          </div>
        </div>

        {/* Ambient Sound Bar */}
        <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-black/10 shadow-sm">
          <button
            onClick={() => handleAmbientChange('none')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              selectedAmbient === 'none' ? 'bg-black/5 text-[#0F172A]' : 'text-slate-500 hover:text-[#0F172A]'
            }`}
            title="Silêncio"
          >
            Silêncio
          </button>
          <button
            onClick={() => handleAmbientChange('chuva')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              selectedAmbient === 'chuva' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:text-[#0F172A]'
            }`}
            title="Chuva relaxante"
          >
            <GifIcon name="dia-chuvoso" className="w-5 h-5" playOnHover blend={false} />
            <span className="hidden sm:inline">Chuva</span>
          </button>
          <button
            onClick={() => handleAmbientChange('cafe')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              selectedAmbient === 'cafe' ? 'bg-amber-700 text-white' : 'text-slate-500 hover:text-[#0F172A]'
            }`}
            title="Sons de cafeteria"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Café</span>
          </button>
          <button
            onClick={() => handleAmbientChange('ruido_marrom')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              selectedAmbient === 'ruido_marrom' ? 'bg-amber-600 text-white' : 'text-slate-500 hover:text-[#0F172A]'
            }`}
            title="Ruído marrom profundo"
          >
            <Waves className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Marrom</span>
          </button>
          <button
            onClick={() => handleAmbientChange('binaural')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              selectedAmbient === 'binaural' ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-[#0F172A]'
            }`}
            title="Ondas Alfa Binaurais (10Hz)"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Alfa</span>
          </button>

          {/* Volume Slider */}
          {selectedAmbient !== 'none' && (
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={ambientVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-16 accent-blue-500 h-1 bg-black/10 rounded-lg cursor-pointer ml-1"
              title="Volume do som ambiente"
            />
          )}
        </div>

        {/* Right Tools: Anotar Distração & Modo Prova & Fechar */}
        <div className="flex items-center gap-2">
          {/* Anotar Distração Button */}
          <button
            type="button"
            onClick={() => setShowDistractionModal(true)}
            title="Anotar pensamento ou distração"
            className="h-9 px-3 rounded-full bg-white hover:bg-black/5 text-xs font-semibold text-slate-600 border border-black/10 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PenTool className="w-3.5 h-3.5 text-amber-500" />
            <span>Anotar distração</span>
          </button>

          {/* Modo Prova Toggle */}
          <button
            type="button"
            onClick={() => setExamMode(!examMode)}
            title="Modo Prova (aviso a cada 30 min)"
            className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              examMode 
                ? 'bg-rose-500 text-white shadow-xs' 
                : 'bg-white hover:bg-black/5 text-slate-600 border border-black/10'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{examMode ? 'Modo Prova Ativo' : 'Modo Prova'}</span>
          </button>

          {/* Exit Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-black/5 flex items-center justify-center text-slate-500 hover:text-[#0F172A] border border-black/10 transition-colors cursor-pointer"
            title="Sair do modo foco (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: Giant Ring & Digital Chronometer */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto">
        <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
          
          {/* Circular Progress Gauge */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              className="text-slate-200"
              strokeWidth="12"
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              className="text-[var(--primary)] transition-all duration-700 ease-out"
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="url(#focusGradient)"
              fill="transparent"
            />
            <defs>
              <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B6CF5" />
                <stop offset="50%" stopColor="#818CF8" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>
          </svg>

          {/* Time & Task Inside Ring */}
          <div className="absolute flex flex-col items-center justify-center text-center px-6">
            <span className="text-5xl sm:text-7xl font-black font-mono tracking-widest text-[#0F172A] tabular-nums">
              {formatSecondsToDigital(activeTimerElapsed)}
            </span>
            
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${activeTimerRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span className="text-xs uppercase font-extrabold tracking-widest text-slate-500">
                {activeTimerRunning ? 'Hiperfoco Ativo' : 'Sessão Pausada'}
              </span>
            </div>

            {activeTask.estimatedMinutes && (
              <span className="text-xs text-slate-500 mt-1 font-medium">
                Meta: {formatMinutesHuman(activeTask.estimatedMinutes)} ({progressPercent}%)
              </span>
            )}
          </div>
        </div>

        {/* Task Title in Big Bold Typography */}
        <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] mt-6 max-w-2xl text-center leading-snug">
          {activeTask.title}
        </h1>
      </div>

      {/* Bottom Action Controls */}
      <div className="relative z-10 flex items-center justify-center gap-4 max-w-md mx-auto w-full">
        {/* Pause / Resume */}
        <button
          onClick={onToggleTimer}
          className={`flex-1 py-4 px-6 rounded-2xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg ${
            activeTimerRunning
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
              : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-blue-500/40'
          }`}
        >
          {activeTimerRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          <span>{activeTimerRunning ? 'Pausar (Espaço)' : 'Retomar (Espaço)'}</span>
        </button>

        {/* Complete Task */}
        <button
          onClick={handleFinish}
          className="flex-1 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
        >
          <Check className="w-5 h-5 stroke-[3]" />
          <span>Concluir (+XP)</span>
        </button>
      </div>

      {/* Anotar Distração Modal */}
      {showDistractionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--borda)] p-5 shadow-2xl text-[var(--texto)] animate-modal">
            <h3 className="text-sm font-bold text-[var(--texto)] mb-1 flex items-center gap-2">
              <PenTool className="w-4 h-4 text-amber-500" />
              <span>Anotar Distração</span>
            </h3>
            <p className="text-xs text-[var(--texto-suave)] mb-3">
              Descarregue sua mente agora para continuar focado. Você poderá revisar depois.
            </p>
            <textarea
              autoFocus
              value={distractionText}
              onChange={e => setDistractionText(e.target.value)}
              placeholder="Ex: Lembrar de responder o e-mail da faculdade..."
              rows={3}
              className="w-full p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs text-[var(--texto)] resize-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDistractionModal(false)}
                className="h-8 px-3 rounded-lg text-xs text-[var(--texto-suave)] hover:text-[var(--texto)] cursor-pointer"
              >
                Voltar ao foco
              </button>
              <button
                type="button"
                onClick={handleSaveDistraction}
                className="h-8 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer"
              >
                Salvar Distração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Session Reflection & Summary Modal */}
      {showReflectionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-lg rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] p-6 sm:p-7 shadow-2xl text-[var(--texto)] animate-modal">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold">Resumo da Sessão de Foco 🎉</h3>
                <p className="text-xs text-[var(--texto-suave)] tabular-nums">
                  Duração: {formatSecondsToDigital(activeTimerElapsed)} · {pausesCount} {pausesCount === 1 ? 'pausa' : 'pausas'}
                </p>
              </div>
            </div>

            {/* Obstacle Note: O que travou? */}
            <div className="space-y-1 mb-3">
              <label className="text-xs font-bold text-[var(--texto-suave)]">
                O que travou ou onde sentiu atrito? (Opcional):
              </label>
              <input
                type="text"
                value={obstacleNote}
                onChange={(e) => setObstacleNote(e.target.value)}
                placeholder="Ex: Fórmulas de refração foram difíceis..."
                className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            {/* Reflection Note */}
            <div className="space-y-1 mb-4">
              <label className="text-xs font-bold text-[var(--texto-suave)]">
                Anotações sobre a matéria:
              </label>
              <textarea
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                placeholder="Ex: Resolvi 8 questões de Cinemática, acertei 6. Revisar fórmulas de aceleração."
                className="w-full h-16 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              />
            </div>

            {/* Spaced Repetition Checkbox */}
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <Repeat className="w-4 h-4 text-purple-600" />
                <div>
                  <div className="text-xs font-bold text-[var(--texto)]">Agendar Revisão Espaçada</div>
                  <div className="text-[11px] text-[var(--texto-suave)]">Revisões automáticas no algoritmo SM-2</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableSpacedRep}
                onChange={(e) => setEnableSpacedRep(e.target.checked)}
                className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowReflectionModal(false)}
                className="flex-1 py-3 rounded-xl bg-[var(--surface-secondary)] text-xs font-bold text-[var(--texto)] hover:bg-[var(--borda)] transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={confirmFinish}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
              >
                Salvar & Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
