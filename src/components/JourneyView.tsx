import React, { useMemo, useState } from 'react';
import { 
  Flame, 
  Trophy, 
  Clock, 
  Calendar, 
  PieChart, 
  TrendingUp, 
  Smile, 
  Zap, 
  HelpCircle,
  Layers
} from 'lucide-react';
import { Task, Category, UserProfile, DailyMood } from '../types';
import { formatDateToISO, formatMinutesHuman, parseISODate, getTodayISO } from '../utils/dateUtils';
import { CategoryIcon } from './CategoryIcon';

interface JourneyViewProps {
  tasks: Task[];
  categories: Category[];
  profile: UserProfile;
  moods: Record<string, DailyMood>;
}

export const JourneyView: React.FC<JourneyViewProps> = ({
  tasks,
  categories,
  profile,
  moods,
}) => {
  const [hoveredDay, setHoveredDay] = useState<{ dateISO: string; minutes: number; xp: number } | null>(null);
  const todayISO = getTodayISO();

  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Aggregate focus time by date
  const minutesByDate = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.spentSeconds > 0) {
        map[t.date] = (map[t.date] || 0) + Math.round(t.spentSeconds / 60);
      }
    });
    return map;
  }, [tasks]);

  // Total study focus statistics
  const totalFocusSeconds = useMemo(() => {
    return tasks.reduce((acc, t) => acc + (t.spentSeconds || 0), 0);
  }, [tasks]);

  const totalFocusHours = (totalFocusSeconds / 3600).toFixed(1);

  // Time spent per category
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    let totalSec = 0;
    tasks.forEach(t => {
      if (t.spentSeconds > 0) {
        map[t.categoryId] = (map[t.categoryId] || 0) + t.spentSeconds;
        totalSec += t.spentSeconds;
      }
    });

    return categories
      .map(c => {
        const sec = map[c.id] || 0;
        const pct = totalSec > 0 ? Math.round((sec / totalSec) * 100) : 0;
        return { category: c, seconds: sec, percentage: pct };
      })
      .filter(item => item.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
  }, [tasks, categories]);

  // Generate 52 weeks (364 days) heat map matrix
  const heatMapDays = useMemo(() => {
    const days: Array<{ dateISO: string; minutes: number; xp: number; intensity: number; isToday: boolean }> = [];
    const today = new Date();
    // Go back 52 weeks (364 days)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);

    for (let i = 0; i <= 364; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      const iso = formatDateToISO(current);
      const mins = minutesByDate[iso] || 0;
      const xp = profile.xpHistory[iso] || 0;

      // 5 intensities
      let intensity = 0;
      if (mins > 0) {
        if (mins < 30) intensity = 1;
        else if (mins < 75) intensity = 2;
        else if (mins < 150) intensity = 3;
        else intensity = 4;
      }

      days.push({
        dateISO: iso,
        minutes: mins,
        xp,
        intensity,
        isToday: iso === todayISO,
      });
    }

    return days;
  }, [minutesByDate, profile.xpHistory, todayISO]);

  // Estimation calibration metric ("Você costuma levar +X% do estimado")
  const calibrationRatio = useMemo(() => {
    const tasksWithEstimate = tasks.filter(t => t.completed && t.estimatedMinutes && t.estimatedMinutes > 0 && t.spentSeconds > 0);
    if (tasksWithEstimate.length < 2) return null;

    let totalEst = 0;
    let totalReal = 0;
    tasksWithEstimate.forEach(t => {
      totalEst += (t.estimatedMinutes || 0) * 60;
      totalReal += t.spentSeconds;
    });

    const diffPct = Math.round(((totalReal - totalEst) / totalEst) * 100);
    return diffPct;
  }, [tasks]);

  const intensityColors = [
    'bg-[var(--surface-secondary)] border border-[var(--borda)]',
    'bg-blue-300 dark:bg-blue-900/60',
    'bg-blue-400 dark:bg-blue-700',
    'bg-blue-600 dark:bg-blue-500',
    'bg-blue-800 dark:bg-blue-400 shadow-sm shadow-blue-500/50',
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Streak card */}
        <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Flame className="w-6 h-6 fill-current" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
              {profile.streak} dias
            </span>
            <p className="text-xs font-semibold text-[var(--texto-suave)]">Sequência Atual</p>
          </div>
        </div>

        {/* Total Focus Hours */}
        <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
              {totalFocusHours} horas
            </span>
            <p className="text-xs font-semibold text-[var(--texto-suave)]">Tempo Total Cronometrado</p>
          </div>
        </div>

        {/* Total XP */}
        <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
              {profile.xp} XP
            </span>
            <p className="text-xs font-semibold text-[var(--texto-suave)]">Experiência Acumulada</p>
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
              {tasks.filter(t => t.completed).length}
            </span>
            <p className="text-xs font-semibold text-[var(--texto-suave)]">Tarefas Concluídas</p>
          </div>
        </div>

      </div>

      {/* 365-Day Annual Heat Map */}
      <div className="p-6 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--texto)] tracking-tight">
              Mapa de Constância Anual
            </h3>
            <p className="text-xs text-[var(--texto-suave)] font-medium">
              365 dias de dedicação e blocos de estudo registrados
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-xs text-[var(--texto-suave)]">
            <span>Menos</span>
            <div className="flex items-center gap-1">
              {intensityColors.map((colorClass, idx) => (
                <div key={idx} className={`w-3.5 h-3.5 rounded-md ${colorClass}`} />
              ))}
            </div>
            <span>Mais</span>
          </div>
        </div>

        {/* Grid of 52 columns x 7 days */}
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-flow-col grid-rows-7 gap-1.5 w-max">
            {heatMapDays.map((d) => (
              <div
                key={d.dateISO}
                onMouseEnter={() => setHoveredDay(d)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-3.5 h-3.5 rounded-md transition-transform hover:scale-125 cursor-pointer ${
                  intensityColors[d.intensity]
                } ${d.isToday ? 'ring-2 ring-[var(--primary)]' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Hovered Day Tooltip Bar */}
        <div className="mt-3 pt-3 border-t border-[var(--borda)] flex items-center justify-between text-xs text-[var(--texto-suave)]">
          {hoveredDay ? (
            <div className="flex items-center gap-3 animate-fadeIn">
              <span className="font-bold text-[var(--texto)]">
                📅 {new Date(parseISODate(hoveredDay.dateISO)).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })}
              </span>
              <span className="font-semibold text-[var(--primary)]">
                ⏱️ {formatMinutesHuman(hoveredDay.minutes)} estudados
              </span>
              {hoveredDay.xp > 0 && (
                <span className="font-semibold text-purple-600">
                  ⚡ +{hoveredDay.xp} XP
                </span>
              )}
            </div>
          ) : (
            <span>Passe o mouse sobre os blocos para ver os detalhes diários.</span>
          )}
        </div>
      </div>

      {/* Grid: Category Breakdown + Estimate Calibrator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Category breakdown (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-[var(--texto)] tracking-tight">
              Tempo Dedicado por Matéria / Categoria
            </h3>
            <PieChart className="w-5 h-5 text-[var(--primary)]" />
          </div>

          {categoryStats.length === 0 ? (
            <p className="text-xs text-[var(--texto-muted)] py-6 text-center">
              Inicie o cronômetro em tarefas para registrar métricas por categoria.
            </p>
          ) : (
            <div className="space-y-4">
              {categoryStats.map(({ category, seconds, percentage }) => (
                <div key={category.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <CategoryIcon category={category} size="sm" />
                      <span className="text-[var(--texto)]">{category.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--texto-suave)] font-mono">
                        {formatMinutesHuman(Math.round(seconds / 60))}
                      </span>
                      <span className="text-[var(--primary)] font-extrabold w-8 text-right">
                        {percentage}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estimate Calibrator & Insights (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Calibrator Card */}
          <div className="p-6 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2.5 text-xs font-extrabold uppercase tracking-wider text-[var(--primary)] mb-2">
              <TrendingUp className="w-4 h-4" />
              <span>Calibrador de Estimativas</span>
            </div>

            <h4 className="text-base font-extrabold text-[var(--texto)]">
              Precisão do seu Tempo
            </h4>

            {calibrationRatio !== null ? (
              <div className="mt-3 p-4 rounded-2xl bg-[var(--primary-soft)] border border-blue-500/20">
                <p className="text-sm font-bold text-[var(--texto)]">
                  {calibrationRatio > 0 ? (
                    <>Você costuma levar <span className="text-rose-600">+{calibrationRatio}% a mais</span> do que estima inicialmente.</>
                  ) : calibrationRatio < 0 ? (
                    <>Você costuma terminar <span className="text-emerald-600">{Math.abs(calibrationRatio)}% mais rápido</span> do que estima.</>
                  ) : (
                    <>Suas estimativas de tempo estão perfeitamente calibradas!</>
                  )}
                </p>
                <p className="text-xs text-[var(--texto-suave)] mt-1 font-medium">
                  Dica: Utilize essa calibragem para programar blocos com folga de segurança.
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--texto-suave)] mt-2">
                Conclua pelo menos 2 tarefas com tempo estimado e cronômetro para desbloquear o calibrador.
              </p>
            )}
          </div>

          {/* Weekly automated tip */}
          <div className="p-6 rounded-[28px] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/10 border border-indigo-500/20 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
              <Zap className="w-4 h-4" />
              <span>Dica de Alta Performance</span>
            </div>
            <p className="text-xs font-semibold text-[var(--texto)] leading-relaxed">
              "Estudar em blocos de 25 a 50 minutos com intervalos de 5 minutos estimula a consolidação da memória de longo prazo e previne a fadiga mental."
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
