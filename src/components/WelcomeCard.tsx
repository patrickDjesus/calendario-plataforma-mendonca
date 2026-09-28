import React from 'react';
import { Sparkles, Flame, ArrowRight, Calendar } from 'lucide-react';
import { UserProfile, StudyMode } from '../types';
import { STUDY_MODES, calculateLevelFromXP, getLevelTitle } from '../utils/xpSystem';

interface WelcomeCardProps {
  profile: UserProfile;
  onWhatToDoNow: () => void;
  onChangeStudyMode: (mode: StudyMode) => void;
  todayStudiedMinutes: number;
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({
  profile,
  onWhatToDoNow,
  onChangeStudyMode,
}) => {
  const currentMode = STUDY_MODES[profile.studyMode] || STUDY_MODES.regular;
  const levelInfo = calculateLevelFromXP(profile.xp);
  const levelTitle = getLevelTitle(profile.level);

  // Formatar data em português do Brasil correto em minúsculas
  const today = new Date();
  const dateFormatted = today.toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  return (
    <div className="w-full rounded-[24px] bg-[var(--surface)] p-5 sm:p-6 shadow-[var(--shadow-card)] relative overflow-hidden">
      {/* Leve brilho sutil no canto */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
        
        {/* Esquerda: Avatar + Saudação + Barra de XP */}
        <div className="flex items-center gap-4.5 sm:gap-5 min-w-0">
          {/* Avatar com selo de nível */}
          <div className="relative shrink-0" title={`${profile.name} - ${levelTitle}`}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-blue-400 flex items-center justify-center text-3xl shadow-md">
              {profile.avatar || '🚀'}
            </div>
            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-slate-900 text-amber-300 text-xs font-black tracking-wider border border-slate-700">
              NV.{profile.level}
            </span>
          </div>

          {/* Nome, Data e Barra de XP */}
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-[var(--texto)] tracking-tight leading-tight">
              Olá, {profile.name}! 👋
            </h1>
            <p className="text-sm text-[var(--texto-suave)] font-medium mt-0.5">
              {dateFormatted}
            </p>

            {/* Barra de XP */}
            <div className="mt-2.5 flex items-center gap-3 max-w-xs">
              <div className="flex-1 h-2.5 rounded-full bg-[var(--track-gray)] overflow-hidden">
                <div 
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
                  style={{ width: `${levelInfo.progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[var(--texto)] tabular-nums shrink-0">
                {levelInfo.currentLevelXp}/{levelInfo.nextLevelXp} XP
              </span>
            </div>
          </div>
        </div>

        {/* Direita: Mini tiles (Sequência, Modo de Estudo) */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
          
          {/* Tile de Dias Estudados / Sequência */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] h-[66px]">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-base font-extrabold text-[var(--texto)] tabular-nums leading-tight">
                {profile.streak} {profile.streak === 1 ? 'dia' : 'dias'}
              </div>
              <div className="text-xs text-[var(--texto-suave)] font-medium">
                sequência ativa
              </div>
            </div>
          </div>

          {/* Seletor Segmentado: Modo de Estudo (altura combinada idêntica 66px) */}
          <div className="flex flex-col justify-center px-4 py-2 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] h-[66px]">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs font-bold text-[var(--texto-suave)]">Modo de estudo</span>
              <span className="text-xs font-semibold text-[var(--primary)]">{currentMode.badge}</span>
            </div>
            <div className="flex items-center gap-1 bg-[var(--surface)] p-0.5 rounded-lg border border-[var(--borda)]">
              {(['leve', 'regular', 'intenso'] as StudyMode[]).map((mode) => {
                const isSelected = profile.studyMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onChangeStudyMode(mode)}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold capitalize transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white shadow-sm'
                        : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
