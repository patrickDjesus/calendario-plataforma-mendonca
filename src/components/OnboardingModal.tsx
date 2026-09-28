import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, BookOpen, User, Zap, Flame, Shield } from 'lucide-react';
import { StudyMode } from '../types';
import { STUDY_MODES } from '../utils/xpSystem';
import { APP_NAME } from '../constants/app';
import { AVATAR_OPTIONS, GifIcon, StudyModeBadge } from './GifIcon';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (
    name: string, 
    avatar: string, 
    studyMode: StudyMode, 
    selectedSubjectNames: string[],
    loadSampleTasks: boolean
  ) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>('avatar-homem');
  const [studyMode, setStudyMode] = useState<StudyMode>('regular');
  const [loadSampleTasks, setLoadSampleTasks] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([
    'Linguagens & Redação', 'História / Humanas', 'Programação / TI'
  ]);

  if (!isOpen) return null;

  const avatars = AVATAR_OPTIONS;

  const availableSubjects = [
    'Linguagens & Redação', 'História / Humanas', 'Química & Biologia',
    'Inglês / Idiomas', 'Programação / TI', 'Concursos / Direito', 'Projetos Pessoais'
  ];

  const handleToggleSubject = (sub: string) => {
    if (selectedSubjects.includes(sub)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== sub));
    } else {
      setSelectedSubjects([...selectedSubjects, sub]);
    }
  };

  const handleFinish = () => {
    onComplete(
      name.trim() || 'Patrick',
      avatar,
      studyMode,
      selectedSubjects,
      loadSampleTasks
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-xl rounded-[32px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl p-7 sm:p-9 text-[var(--texto)] animate-modal relative overflow-hidden">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-[var(--primary)]'
                    : s < step
                    ? 'w-4 bg-emerald-500'
                    : 'w-4 bg-slate-200 '
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-[var(--texto-suave)] uppercase tracking-wider">
            Passo {step} de 3
          </span>
        </div>

        {/* STEP 1: Name & Avatar */}
        {step === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-black text-[var(--texto)] tracking-tight">
                Boas-vindas ao {APP_NAME}! 🚀
              </h2>
              <p className="text-xs sm:text-sm text-[var(--texto-suave)] mt-1">
                Seu novo cockpit de estudos e alta produtividade. Como prefere ser chamado?
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[var(--texto-suave)] mb-1.5">
                Seu nome ou apelido
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ana Clara"
                className="w-full h-11 px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-base font-semibold text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[var(--texto-suave)] mb-2">
                Escolha seu avatar
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {avatars.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setAvatar(av)}
                    aria-label={`Avatar ${av}`}
                    aria-pressed={avatar === av}
                    className={`h-14 flex items-center justify-center transition-all cursor-pointer ${
                      avatar === av
                        ? 'ring-2 ring-[var(--primary)] rounded-2xl scale-110'
                        : 'opacity-70 hover:opacity-100 rounded-2xl'
                    }`}
                  >
                    <GifIcon name={av} className="w-11 h-11" playOnHover />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
              >
                <span>Avançar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Study Mode */}
        {step === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-black text-[var(--texto)] tracking-tight">
                Qual é o seu Ritmo de Estudos?
              </h2>
              <p className="text-xs sm:text-sm text-[var(--texto-suave)] mt-1">
                Isso define sua meta diária de XP e limite saudável de horas por dia.
              </p>
            </div>

            <div className="space-y-3">
              {(['leve', 'regular', 'intenso'] as StudyMode[]).map((mode) => {
                const conf = STUDY_MODES[mode];
                const isSelected = studyMode === mode;
                return (
                  <div
                    key={mode}
                    data-gif-host
                    onClick={() => setStudyMode(mode)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-4 ${
                      isSelected
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)] shadow-md'
                        : 'border-[var(--borda)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <StudyModeBadge badge={conf.badge} className="w-8 h-8" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-[var(--texto)]">{conf.name}</span>
                          <span className="text-xs font-bold text-[var(--primary)]">
                            {conf.dailyXpGoal} XP/dia • até {conf.maxDailyHours}h
                          </span>
                        </div>
                        <p className="text-xs text-[var(--texto-suave)] mt-0.5">{conf.description}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-[var(--primary)] stroke-[3]" />}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-3 rounded-2xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
              >
                <span>Avançar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Subjects & Sample Tasks Choice */}
        {step === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-2xl font-black text-[var(--texto)] tracking-tight">
                Quais matérias você estuda?
              </h2>
              <p className="text-xs sm:text-sm text-[var(--texto-suave)] mt-1">
                Selecione suas matérias e escolha se deseja carregar tarefas de exemplo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
              {availableSubjects.map((sub) => {
                const isSelected = selectedSubjects.includes(sub);
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleToggleSubject(sub)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] border border-[var(--borda)]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{sub}</span>
                  </button>
                );
              })}
            </div>

            {/* Option to load removable sample tasks */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-[var(--texto)] block">
                  Carregar tarefas de exemplo para testar
                </span>
                <span className="text-xs text-[var(--texto-suave)] font-medium">
                  Cria 3 tarefas demonstrativas que você pode editar ou remover com 1 clique.
                </span>
              </div>
              <input
                type="checkbox"
                checked={loadSampleTasks}
                onChange={(e) => setLoadSampleTasks(e.target.checked)}
                className="w-5 h-5 rounded-lg text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
              />
            </div>

            <div className="pt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="px-7 py-3 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-blue-600 text-white text-xs font-extrabold shadow-xl shadow-blue-500/25 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
              >
                <Sparkles className="w-4 h-4" />
                <span>Começar Jornada!</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
