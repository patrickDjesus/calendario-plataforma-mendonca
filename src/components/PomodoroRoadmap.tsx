import React from 'react';
import { BookOpen, Coffee, Check, Flame, Trophy } from 'lucide-react';
import { formatSecondsToDigital } from '../utils/dateUtils';

export interface RoadmapStep {
  id: string;
  type: 'focus' | 'break';
  title: string;
  durationMinutes: number;
  blockNumber?: number;
  status: 'completed' | 'active' | 'upcoming';
}

export interface PomodoroRoadmapProps {
  estimatedMinutes?: number;
  spentSeconds?: number;
  completedFocusBlocks?: number;
  currentPhase?: 'foco' | 'pausa_curta' | 'pausa_longa';
  isTimerRunning?: boolean;
  activeTimerElapsed?: number;
  focusMinutes?: number;
  shortBreakMinutes?: number;
  longBreakMinutes?: number;
  longBreakInterval?: number;
  className?: string;
  compact?: boolean;
}

export function generateRoadmapSteps(
  estimatedMinutes: number = 90,
  focusMinutes: number = 25,
  shortBreakMinutes: number = 5,
  longBreakMinutes: number = 15,
  longBreakInterval: number = 4,
  completedBlocks: number = 0,
  currentPhase: 'foco' | 'pausa_curta' | 'pausa_longa' = 'foco',
  _isTimerRunning: boolean = false
): RoadmapStep[] {
  const targetMinutes = Math.max(15, estimatedMinutes || 90);
  const steps: RoadmapStep[] = [];

  let accumulatedFocusMinutes = 0;
  let focusBlockCounter = 1;

  while (accumulatedFocusMinutes < targetMinutes) {
    const remainingFocus = targetMinutes - accumulatedFocusMinutes;
    const currentBlockDuration = Math.min(focusMinutes, remainingFocus);
    accumulatedFocusMinutes += currentBlockDuration;

    // Status calculation for Focus Block
    const blockIndex = focusBlockCounter - 1;
    let focusStatus: 'completed' | 'active' | 'upcoming' = 'upcoming';

    if (currentPhase === 'foco') {
      if (blockIndex < completedBlocks) {
        focusStatus = 'completed';
      } else if (blockIndex === completedBlocks) {
        focusStatus = 'active';
      } else {
        focusStatus = 'upcoming';
      }
    } else {
      // Currently in break phase
      if (blockIndex < completedBlocks) {
        focusStatus = 'completed';
      } else {
        focusStatus = 'upcoming';
      }
    }

    steps.push({
      id: `focus-${focusBlockCounter}`,
      type: 'focus',
      title: `Bloco ${focusBlockCounter} · Estudo`,
      durationMinutes: currentBlockDuration,
      blockNumber: focusBlockCounter,
      status: focusStatus,
    });

    // Add Break Step if not at final target
    if (accumulatedFocusMinutes < targetMinutes) {
      const isLongBreak = focusBlockCounter % longBreakInterval === 0;
      const breakDuration = isLongBreak ? longBreakMinutes : shortBreakMinutes;
      let breakStatus: 'completed' | 'active' | 'upcoming' = 'upcoming';

      if (currentPhase !== 'foco') {
        // We are currently in a break phase
        if (blockIndex === completedBlocks - 1) {
          breakStatus = 'active';
        } else if (blockIndex < completedBlocks - 1) {
          breakStatus = 'completed';
        } else {
          breakStatus = 'upcoming';
        }
      } else {
        // We are currently in focus phase
        if (blockIndex < completedBlocks) {
          breakStatus = 'completed';
        } else {
          breakStatus = 'upcoming';
        }
      }

      steps.push({
        id: `break-${focusBlockCounter}`,
        type: 'break',
        title: isLongBreak ? 'Pausa Longa' : 'Pausa Curta',
        durationMinutes: breakDuration,
        status: breakStatus,
      });
    }

    focusBlockCounter++;
  }

  return steps;
}

export const PomodoroRoadmap: React.FC<PomodoroRoadmapProps> = ({
  estimatedMinutes = 90,
  spentSeconds = 0,
  completedFocusBlocks = 0,
  currentPhase = 'foco',
  isTimerRunning = false,
  activeTimerElapsed = 0,
  focusMinutes = 25,
  shortBreakMinutes = 5,
  longBreakMinutes = 15,
  longBreakInterval = 4,
  className = '',
}) => {
  // `completedFocusBlocks` vive na memoria: um F5, um crash ou uma troca de
  // tarefa o zeram. O tempo nao e assim — ele fica gravado em `spentSeconds`.
  // Entao os blocos feitos sao o maior dos dois, e o roadmap nao pode voltar
  // a zero depois de um F5 no meio do dia.
  const blocksBySpent = focusMinutes > 0 ? Math.floor((spentSeconds / 60) / focusMinutes) : 0;
  const doneBlocks = Math.max(completedFocusBlocks, blocksBySpent);

  const steps = generateRoadmapSteps(
    estimatedMinutes,
    focusMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    longBreakInterval,
    doneBlocks,
    currentPhase,
    isTimerRunning
  );

  const focusSteps = steps.filter(s => s.type === 'focus');
  const totalFocusPlanned = focusSteps.reduce((acc, s) => acc + s.durationMinutes, 0);

  const totalBreakPlanned = steps
    .filter(s => s.type === 'break')
    .reduce((acc, s) => acc + s.durationMinutes, 0);

  // O progresso e de ESTUDO, nao de passos: uma pausa nao e "trabalho nao
  // feito". Contando pausa no denominador, 3 blocos de 25 min numa meta de 90
  // min apareciam como 43% (3 de 7 passos) em vez de 75%.
  const doneFocus = focusSteps.filter(s => s.status === 'completed').length;

  // O bloco ativo conta pela fracao ja percorrida, pausado ou nao: os 10 min de
  // um bloco pausado continuam sendo 10 min de bloco feito.
  const activeFocus = focusSteps.find(s => s.status === 'active');
  const partialFocus = activeFocus && activeFocus.durationMinutes > 0
    ? Math.min(1, (activeTimerElapsed / 60) / activeFocus.durationMinutes)
    : 0;

  const progressPercent = focusSteps.length > 0
    ? Math.min(100, Math.round(((doneFocus + partialFocus) / focusSteps.length) * 100))
    : 0;

  return (
    <div className={`flex flex-col gap-3.5 bg-[var(--surface)] border border-[var(--borda)] rounded-2xl p-4 shadow-sm ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--borda-soft)] pb-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--texto)]">
            <Flame className="w-4 h-4 text-blue-600" />
            <span>Jornada de Foco</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            {doneFocus}/{focusSteps.length} blocos · {totalFocusPlanned}m estudo · {totalBreakPlanned}m pausas
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-600 transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Simplified Vertical Connected Timeline */}
      <div className="relative pl-2 pr-1 py-1 space-y-2.5 max-h-[340px] overflow-y-auto">
        {/* Continuous Connecting Line passing through node centers */}
        <div className="absolute top-3.5 bottom-3.5 left-[19px] w-0.5 bg-slate-200 z-0" />

        {steps.map((step) => {
          const isFocus = step.type === 'focus';
          const isCompleted = step.status === 'completed';
          const isActive = step.status === 'active';

          return (
            <div 
              key={step.id} 
              className={`relative z-10 flex items-center gap-3 transition-opacity duration-200 ${
                isActive 
                  ? 'opacity-100' 
                  : 'opacity-30 hover:opacity-60'
              }`}
            >
              {/* Node Icon on connected line */}
              <div 
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white ring-4 ring-blue-500/20 shadow-md shadow-blue-500/30 scale-105'
                    : isCompleted
                    ? 'bg-slate-400 text-white'
                    : 'bg-slate-100 border-2 border-slate-300 text-slate-400'
                }`}
              >
                {isActive ? (
                  isFocus ? <BookOpen className="w-3 h-3" /> : <Coffee className="w-3 h-3" />
                ) : isCompleted ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  isFocus ? <BookOpen className="w-2.5 h-2.5 opacity-60" /> : <Coffee className="w-2.5 h-2.5 opacity-60" />
                )}
              </div>

              {/* Step Content */}
              <div 
                className={`flex-1 flex items-center justify-between py-1.5 px-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-xs'
                    : 'bg-transparent border-transparent text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs font-semibold truncate ${
                    isActive ? 'text-blue-700 font-extrabold' : isCompleted ? 'line-through text-slate-500' : 'text-slate-600'
                  }`}>
                    {step.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {isActive ? (
                    <span className="text-[11px] font-mono font-black text-white bg-blue-600 px-2 py-0.5 rounded-full shadow-xs tabular-nums">
                      {isTimerRunning ? formatSecondsToDigital(activeTimerElapsed) : `${step.durationMinutes}m`}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {step.durationMinutes}m
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Conclusion Node */}
        <div className={`relative z-10 flex items-center gap-3 transition-opacity pt-1 ${
          progressPercent === 100 ? 'opacity-100' : 'opacity-30'
        }`}>
          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
            <Trophy className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-slate-600 truncate">
            Meta concluída ({estimatedMinutes || 90}m)
          </span>
        </div>
      </div>
    </div>
  );
};
