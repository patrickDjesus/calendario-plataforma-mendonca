import React, { useMemo, useState, useRef } from 'react';
import { 
  Calendar, 
  PieChart, 
  TrendingUp, 
  Smile, 
  Zap, 
  HelpCircle,
  Layers,
  Target,
  Folder,
  CheckCircle2,
  Plus,
  Sparkles,
  Lightbulb,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Task, Category, UserProfile, DailyMood, Objective, Project, PeriodicReview, CustomReward, DailyStat } from '../types';
import { formatDateToISO, formatMinutesHuman, parseISODate, getTodayISO } from '../utils/dateUtils';
import { CategoryIcon } from './CategoryIcon';
import { GifIcon } from './GifIcon';
import { calculateActiveDaysThisWeek } from '../utils/xpSystem';
import { generateDeterministicInsights } from '../utils/insights';
import { repository } from '../services/repository';

interface JourneyViewProps {
  tasks: Task[];
  categories: Category[];
  profile: UserProfile;
  moods: Record<string, DailyMood>;
  objectives?: Objective[];
  projects?: Project[];
  reviews?: PeriodicReview[];
  rewards?: CustomReward[];
  dailyStats?: Record<string, DailyStat>;
  onRefresh?: () => Promise<void>;
}

export const JourneyView: React.FC<JourneyViewProps> = ({
  tasks,
  categories,
  profile,
  moods,
  objectives = [],
  projects = [],
  reviews = [],
  rewards = [],
  dailyStats = {},
  onRefresh,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'acumulado' | 'diario'>('acumulado');
  const chartContainerRef = useRef<HTMLDivElement>(null);
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

  // Generate 26 weeks (182 days) semiannual data timeline with running totals
  const semiannualDays = useMemo(() => {
    const days: Array<{
      dateISO: string;
      dateObj: Date;
      minutes: number;
      hours: number;
      cumulativeMinutes: number;
      cumulativeHours: number;
      xp: number;
      cumulativeXp: number;
      isToday: boolean;
    }> = [];

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 181);

    let runMinutes = 0;
    let runXp = 0;

    for (let i = 0; i <= 181; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      const iso = formatDateToISO(current);
      const mins = minutesByDate[iso] || 0;
      const xp = profile.xpHistory[iso] || 0;

      runMinutes += mins;
      runXp += xp;

      days.push({
        dateISO: iso,
        dateObj: current,
        minutes: mins,
        hours: Number((mins / 60).toFixed(2)),
        cumulativeMinutes: runMinutes,
        cumulativeHours: Number((runMinutes / 60).toFixed(2)),
        xp,
        cumulativeXp: runXp,
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

  // Linear Chart Math & Metrics
  const totalPeriodMinutes = semiannualDays[semiannualDays.length - 1]?.cumulativeMinutes || 0;
  const peakDayMinutes = useMemo(() => Math.max(0, ...semiannualDays.map(d => d.minutes)), [semiannualDays]);
  const activeDaysCount = useMemo(() => semiannualDays.filter(d => d.minutes > 0).length, [semiannualDays]);

  const svgWidth = 1000;
  const svgHeight = 280;
  const padLeft = 45;
  const padRight = 25;
  const padTop = 24;
  const padBottom = 38;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotHeight;

  // Max value calculation for Y axis scaling
  const maxValue = useMemo(() => {
    if (chartMode === 'acumulado') {
      const maxCumHours = semiannualDays[semiannualDays.length - 1]?.cumulativeHours || 0;
      if (maxCumHours <= 0) return 10;
      return Math.max(5, Math.ceil(maxCumHours * 1.15));
    } else {
      const maxDailyHours = Math.max(...semiannualDays.map(d => d.hours));
      if (maxDailyHours <= 0) return 4;
      return Math.max(2, Math.ceil(maxDailyHours * 1.25));
    }
  }, [chartMode, semiannualDays]);

  // Generate SVG coordinates for each of the 182 days
  const points = useMemo(() => {
    const count = semiannualDays.length;
    return semiannualDays.map((d, i) => {
      const x = padLeft + (i / (count - 1)) * plotWidth;
      const val = chartMode === 'acumulado' ? d.cumulativeHours : d.hours;
      const ratio = Math.min(1, Math.max(0, val / maxValue));
      const y = baselineY - ratio * plotHeight;
      return { x, y, data: d, val };
    });
  }, [semiannualDays, chartMode, maxValue, plotWidth, plotHeight, baselineY, padLeft]);

  // Construct smooth bezier curve path and filled area
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      // Tension factor for organic, smooth curve
      const tension = 0.16;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      const clampedCp1Y = Math.min(baselineY, Math.max(padTop - 6, cp1y));
      const clampedCp2Y = Math.min(baselineY, Math.max(padTop - 6, cp2y));

      d += ` C ${cp1x.toFixed(1)} ${clampedCp1Y.toFixed(1)}, ${cp2x.toFixed(1)} ${clampedCp2Y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const lastX = points[points.length - 1].x.toFixed(1);
    const firstX = points[0].x.toFixed(1);
    const area = `${d} L ${lastX} ${baselineY.toFixed(1)} L ${firstX} ${baselineY.toFixed(1)} Z`;

    return { linePath: d, areaPath: area };
  }, [points, baselineY, padTop]);

  // Month markers for the X axis
  const monthLabels = useMemo(() => {
    const labels: Array<{ x: number; label: string }> = [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const count = semiannualDays.length;

    for (let i = 0; i < count; i++) {
      const curr = semiannualDays[i].dateObj;
      const isFirst = i === 0;
      const isNewMonth = i > 0 && curr.getMonth() !== semiannualDays[i - 1].dateObj.getMonth();

      if (isNewMonth || (isFirst && curr.getDate() < 18)) {
        const x = padLeft + (i / (count - 1)) * plotWidth;
        labels.push({
          x,
          label: monthNames[curr.getMonth()],
        });
      }
    }
    return labels;
  }, [semiannualDays, padLeft, plotWidth]);

  // Y axis ticks (0%, 33%, 66%, 100%)
  const yTicks = useMemo(() => {
    return [0, 0.33, 0.66, 1].map(ratio => {
      const val = Math.round(maxValue * ratio);
      const y = baselineY - ratio * plotHeight;
      return { val, y };
    });
  }, [maxValue, baselineY, plotHeight]);

  // Pointer interaction handling across the full card width
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!chartContainerRef.current) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const plotLeftPx = (padLeft / svgWidth) * rect.width;
    const plotWidthPx = (plotWidth / svgWidth) * rect.width;
    const ratio = Math.max(0, Math.min(1, (mouseX - plotLeftPx) / plotWidthPx));
    const idx = Math.round(ratio * (semiannualDays.length - 1));
    setHoverIndex(Math.max(0, Math.min(semiannualDays.length - 1, idx)));
  };

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  const [journeyTab, setJourneyTab] = useState<'resumo' | 'objetivos' | 'revisoes' | 'insights'>('resumo');
  const [newObjTitle, setNewObjTitle] = useState('');
  const [newObjHorizon, setNewObjHorizon] = useState<'ano' | 'trimestre' | 'mes'>('mes');
  const [isNewObjModalOpen, setIsNewObjModalOpen] = useState(false);

  // Guided Review Wizard State
  const [isReviewWizardOpen, setIsReviewWizardOpen] = useState(false);
  const [revStep, setRevStep] = useState<1 | 2 | 3>(1);
  const [revAns1, setRevAns1] = useState('');
  const [revAns2, setRevAns2] = useState('');
  const [revAns3, setRevAns3] = useState('');
  const [revGoal1, setRevGoal1] = useState('');
  const [revGoal2, setRevGoal2] = useState('');
  const [revGoal3, setRevGoal3] = useState('');

  // Active days this week
  const activeDaysData = useMemo(() => {
    return calculateActiveDaysThisWeek(dailyStats, todayISO, 1);
  }, [dailyStats, todayISO]);

  // Deterministic insights
  const deterministicInsights = useMemo(() => {
    return generateDeterministicInsights({
      tasks,
      categories,
      profile,
      settings: {} as any,
      dailyMoods: moods,
      objectives,
      projects,
      focusSessions: [],
    } as any);
  }, [tasks, categories, profile, moods, objectives, projects]);

  return (
    <div className="space-y-6">
      {/* 4 Internal Tabs: Resumo · Objetivos · Revisões · Insights */}
      <div className="flex items-center gap-2 border-b border-[var(--borda)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setJourneyTab('resumo')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            journeyTab === 'resumo' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface)]'
          }`}
        >
          Resumo & Constância
        </button>
        <button
          type="button"
          onClick={() => setJourneyTab('objetivos')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            journeyTab === 'objetivos' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface)]'
          }`}
        >
          Objetivos & Projetos ({objectives?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setJourneyTab('revisoes')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            journeyTab === 'revisoes' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface)]'
          }`}
        >
          Revisões Periódicas ({reviews?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setJourneyTab('insights')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            journeyTab === 'insights' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface)]'
          }`}
        >
          Insights & Padrões
        </button>
      </div>

      {journeyTab === 'resumo' && (
        <div className="space-y-6">
          {/* Top Overview Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Dias ativos esta semana */}
            <div data-gif-host className="card-hover animate-card-cascade stagger-1 p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
              <GifIcon name="fogo-sequencia" className="w-14 h-14 shrink-0" />
              <div>
                <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
                  {activeDaysData.activeDays} de 7
                </span>
                <p className="text-xs font-semibold text-[var(--texto-suave)]">Dias Ativos Esta Semana</p>
                <span className="text-[10px] text-[var(--texto-suave)] opacity-80">(Sequência: {profile.streak} dias)</span>
              </div>
            </div>

        {/* Total Focus Hours */}
        <div data-gif-host className="card-hover animate-card-cascade stagger-2 p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
          <GifIcon name="tempo-total-cronometrado" className="w-14 h-14 shrink-0" />
          <div>
            <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
              {totalFocusHours} horas
            </span>
            <p className="text-xs font-semibold text-[var(--texto-suave)]">Tempo Total Cronometrado</p>
          </div>
        </div>

        {/* Total XP */}
        <div data-gif-host className="card-hover animate-card-cascade stagger-3 p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
          <GifIcon name="experiencia-acumulada" className="w-14 h-14 shrink-0" />
          <div>
            <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
              {profile.xp} XP
            </span>
            <p className="text-xs font-semibold text-[var(--texto-suave)]">Experiência Acumulada</p>
          </div>
        </div>

        {/* Completed Tasks */}
        <div data-gif-host className="card-hover animate-card-cascade stagger-4 p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex items-center gap-4">
          <GifIcon name="tarefas-concluidas" className="w-14 h-14 shrink-0" />
          <div>
            <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
              {tasks.filter(t => t.completed).length}
            </span>
            <p className="text-xs font-semibold text-[var(--texto-suave)]">Tarefas Concluídas</p>
          </div>
        </div>

      </div>

      {/* 182-Day Semiannual Linear Constancy Chart (Full Width Card) */}
      <div className="card-hover animate-card-cascade stagger-5 p-6 sm:p-7 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] flex flex-col">
        {/* Card Header: Title, Live Stats, and Mode Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
              <h3 className="text-lg font-extrabold text-[var(--texto)] tracking-tight">
                Constância Semestral
              </h3>
            </div>
            <p className="text-xs text-[var(--texto-suave)] font-medium mt-0.5">
              Evolução e ritmo de estudo contínuo ao longo dos últimos 6 meses
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Metrics */}
            <div className="flex items-center gap-2 text-xs font-semibold bg-[var(--surface-secondary)] px-3 py-1.5 rounded-xl border border-[var(--borda)]">
              <span className="text-[var(--texto-suave)]">
                Semestre: <strong className="text-[var(--texto)] font-bold">{(totalPeriodMinutes / 60).toFixed(1)}h</strong>
              </span>
              <span className="text-[var(--texto-suave)] opacity-40">·</span>
              <span className="text-[var(--texto-suave)]">
                Recorde: <strong className="text-[var(--primary)] font-bold">{formatMinutesHuman(peakDayMinutes)}</strong>
              </span>
              <span className="text-[var(--texto-suave)] opacity-40">·</span>
              <span className="text-[var(--texto-suave)]">
                Ativos: <strong className="text-emerald-500 font-bold">{activeDaysCount}d</strong>
              </span>
            </div>

            {/* Segmented Mode Control */}
            <div className="flex items-center p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)]">
              <button
                type="button"
                onClick={() => setChartMode('acumulado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'acumulado'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                    : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                }`}
              >
                Crescimento Acumulado
              </button>
              <button
                type="button"
                onClick={() => setChartMode('diario')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'diario'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                    : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                }`}
              >
                Ritmo Diário
              </button>
            </div>
          </div>
        </div>

        {/* Full Card Area Graph Canvas */}
        <div 
          ref={chartContainerRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          className="relative w-full h-72 sm:h-80 select-none cursor-crosshair"
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Luminous line gradient */}
              <linearGradient id="constancyLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="60%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>

              {/* Area gradient fading downwards */}
              <linearGradient id="constancyAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
                <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.00" />
              </linearGradient>

              {/* Subtle shadow filter for active point */}
              <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#2563EB" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Horizontal Gridlines & Y-Axis Value Labels */}
            {yTicks.map(({ val, y }, idx) => (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-[var(--borda)]"
                  strokeDasharray={idx === 0 ? 'none' : '4 4'}
                  strokeWidth={idx === 0 ? '1.5' : '1'}
                  opacity={idx === 0 ? '0.8' : '0.45'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[11px] font-mono font-bold fill-[var(--texto-suave)]"
                >
                  {val}h
                </text>
              </g>
            ))}

            {/* Month Boundaries & X-Axis Labels */}
            {monthLabels.map(({ x, label }, idx) => (
              <g key={idx}>
                <line
                  x1={x}
                  y1={baselineY}
                  x2={x}
                  y2={baselineY + 5}
                  stroke="currentColor"
                  className="text-[var(--borda)]"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={baselineY + 20}
                  textAnchor="middle"
                  className="text-[11px] font-bold fill-[var(--texto-suave)] capitalize"
                >
                  {label}
                </text>
              </g>
            ))}

            {/* Area Fill Under Curve */}
            {areaPath && (
              <path
                d={areaPath}
                fill="url(#constancyAreaGradient)"
                className="transition-all duration-300 ease-out"
              />
            )}

            {/* Linear Curve Path */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="url(#constancyLineGradient)"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300 ease-out"
              />
            )}

            {/* Interactive Crosshair and Glowing Dot */}
            {activePoint && (
              <g className="pointer-events-none transition-transform duration-75">
                {/* Vertical Crosshair Line */}
                <line
                  x1={activePoint.x}
                  y1={padTop}
                  x2={activePoint.x}
                  y2={baselineY}
                  stroke="var(--primary)"
                  strokeDasharray="3 3"
                  strokeWidth="1.5"
                  opacity="0.75"
                />

                {/* Outer Glow Halo */}
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="12"
                  fill="var(--primary)"
                  opacity="0.22"
                />

                {/* Inner Glowing Center */}
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="5.5"
                  fill="var(--primary)"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  filter="url(#pointGlow)"
                />
              </g>
            )}
          </svg>

          {/* Floating Hover Tooltip Card */}
          {activePoint && (
            <div
              className="absolute pointer-events-none z-30 transition-all duration-100 ease-out"
              style={{
                left: `${(activePoint.x / svgWidth) * 100}%`,
                top: `${Math.max(12, Math.min(220, (activePoint.y / svgHeight) * 100))}%`,
                transform:
                  activePoint.x < 180
                    ? 'translate(10px, -50%)'
                    : activePoint.x > svgWidth - 180
                    ? 'translate(-105%, -50%)'
                    : 'translate(-50%, -120%)',
              }}
            >
              <div className="bg-[var(--surface)] text-[var(--texto)] border border-[var(--borda)] shadow-[0_12px_28px_rgba(0,0,0,0.15)] rounded-2xl p-3 min-w-[190px] backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--borda)] pb-1.5 mb-1.5">
                  <span className="text-xs font-extrabold capitalize text-[var(--texto)]">
                    {activePoint.data.dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  {activePoint.data.isToday && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                      Hoje
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--texto-suave)] font-medium">Tempo no dia:</span>
                    <strong className="text-[var(--primary)] font-bold">
                      {formatMinutesHuman(activePoint.data.minutes)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[var(--texto-suave)] font-medium">Total acumulado:</span>
                    <strong className="text-[var(--texto)] font-bold">
                      {activePoint.data.cumulativeHours}h
                    </strong>
                  </div>

                  {activePoint.data.xp > 0 && (
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[var(--texto-suave)] font-medium">Experiência:</span>
                      <strong className="text-purple-600 font-bold">
                        +{activePoint.data.xp} XP
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Guide hint when not hovering */}
          {!activePoint && (
            <div className="absolute bottom-2 right-4 text-[10px] font-semibold text-[var(--texto-suave)] opacity-70 pointer-events-none">
              Passe o mouse pelo gráfico para inspecionar cada dia
            </div>
          )}
        </div>
      </div>

      {/* Grid: Category Breakdown + Estimate Calibrator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Category breakdown (7 cols) */}
        <div className="card-hover lg:col-span-7 p-6 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)]">
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
                <div key={category.id} data-gif-host className="space-y-1.5">
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
          <div className="card-hover p-6 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)]">
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
          <div className="card-hover p-6 rounded-[28px] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/10 border border-indigo-500/20 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-600 uppercase tracking-wider mb-2">
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
  )}

  {/* ================================================================= */}
  {/* TAB 2: OBJETIVOS & PROJETOS                                       */}
  {/* ================================================================= */}
  {journeyTab === 'objetivos' && (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-[var(--texto)]">Objetivos & Metas de Longo Prazo</h3>
          <p className="text-xs text-[var(--texto-suave)]">Conecte suas tarefas diárias aos seus grandes marcos de vida e carreira</p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewObjModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-bold text-xs shadow-sm hover:opacity-90 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Objetivo
        </button>
      </div>

      {objectives.length === 0 ? (
        <div className="p-10 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] mx-auto flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <h4 className="text-base font-extrabold text-[var(--texto)]">Nenhum objetivo cadastrado ainda</h4>
          <p className="text-xs text-[var(--texto-suave)] max-w-md mx-auto">
            Defina marcos semestrais, anuais ou trimestrais para guiar seu foco semanal e acompanhar seu progresso real.
          </p>
          <button
            type="button"
            onClick={() => setIsNewObjModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-bold text-xs shadow-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Criar Primeiro Objetivo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {objectives.map(obj => {
            const linkedProjects = projects.filter(p => p.objectiveId === obj.id);
            return (
              <div key={obj.id} className="p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-[var(--texto)]">{obj.title}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--texto-suave)] px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--borda)] inline-block mt-0.5">
                        Horizonte: {obj.horizon === 'ano' ? 'Anual' : obj.horizon === 'trimestre' ? 'Trimestral' : 'Mensal'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                    obj.status === 'concluido' ? 'bg-emerald-500/10 text-emerald-600' :
                    obj.status === 'em_andamento' ? 'bg-blue-500/10 text-[var(--primary)]' :
                    obj.status === 'pausado' ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-500/10 text-slate-500'
                  }`}>
                    {obj.status === 'concluido' ? 'Concluído' : obj.status === 'em_andamento' ? 'Em Andamento' : obj.status === 'pausado' ? 'Pausado' : 'Planejado'}
                  </span>
                </div>

                {obj.description && (
                  <p className="text-xs text-[var(--texto-suave)] leading-relaxed">{obj.description}</p>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-[var(--texto-suave)]">Progresso</span>
                    <span className="text-[var(--primary)]">{obj.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                    <div className="h-full bg-[var(--primary)] rounded-full transition-all duration-500" style={{ width: `${obj.progress}%` }} />
                  </div>
                </div>

                {/* Linked projects */}
                {linkedProjects.length > 0 && (
                  <div className="pt-2 border-t border-[var(--borda)] space-y-2">
                    <span className="text-[11px] font-bold text-[var(--texto-suave)]">Projetos Conectados ({linkedProjects.length})</span>
                    <div className="space-y-1.5">
                      {linkedProjects.map(proj => (
                        <div key={proj.id} className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-secondary)] text-xs">
                          <div className="flex items-center gap-2">
                            <Folder className="w-3.5 h-3.5 text-[var(--primary)]" />
                            <span className="font-semibold text-[var(--texto)]">{proj.name}</span>
                          </div>
                          <span className="text-[10px] font-bold text-[var(--texto-suave)]">{proj.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar Objetivo */}
      {isNewObjModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--borda)] rounded-[28px] p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-extrabold text-[var(--texto)]">Novo Objetivo</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[var(--texto-suave)] block mb-1">Título do Objetivo</label>
                <input
                  type="text"
                  placeholder="Ex: Aprovação no Vestibular / Concurso"
                  value={newObjTitle}
                  onChange={e => setNewObjTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-sm text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--texto-suave)] block mb-1">Horizonte Temporal</label>
                <select
                  value={newObjHorizon}
                  onChange={e => setNewObjHorizon(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-sm text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="mes">Mensal</option>
                  <option value="trimestre">Trimestral</option>
                  <option value="ano">Anual</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewObjModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--texto-suave)] hover:bg-[var(--surface-secondary)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newObjTitle.trim()) return;
                  const newObj: Objective = {
                    id: `obj-${Date.now()}`,
                    titulo: newObjTitle.trim(),
                    title: newObjTitle.trim(),
                    status: 'em_andamento',
                    horizon: newObjHorizon,
                    horizonte: newObjHorizon,
                    progress: 0,
                    createdAt: new Date().toISOString(),
                  };
                  await repository.saveObjective(newObj);
                  setNewObjTitle('');
                  setIsNewObjModalOpen(false);
                  if (onRefresh) await onRefresh();
                }}
                disabled={!newObjTitle.trim()}
                className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Salvar Objetivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

  {/* ================================================================= */}
  {/* TAB 3: REVISÕES PERIÓDICAS                                        */}
  {/* ================================================================= */}
  {journeyTab === 'revisoes' && (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-[var(--texto)]">Revisões Periódicas Guiadas</h3>
          <p className="text-xs text-[var(--texto-suave)]">Reflita sobre vitórias, gargalos e calibre suas metas para o próximo ciclo</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRevStep(1);
            setIsReviewWizardOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-bold text-xs shadow-sm hover:opacity-90 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Fazer Revisão da Semana
        </button>
      </div>

      {/* Histórico de revisões */}
      {reviews.length === 0 ? (
        <div className="p-10 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 mx-auto flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h4 className="text-base font-extrabold text-[var(--texto)]">Nenhuma revisão registrada</h4>
          <p className="text-xs text-[var(--texto-suave)] max-w-md mx-auto">
            Ao final de cada semana ou mês, reserve 5 minutos para registrar seus aprendizados e direcionar a próxima etapa.
          </p>
          <button
            type="button"
            onClick={() => {
              setRevStep(1);
              setIsReviewWizardOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white font-bold text-xs shadow-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> Iniciar Primeira Revisão
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(rev => (
            <div key={rev.id} className="p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--primary)] px-2.5 py-1 rounded-lg bg-[var(--primary-soft)]">
                    Revisão {rev.tipo === 'semanal' ? 'Semanal' : rev.tipo === 'mensal' ? 'Mensal' : 'Trimestral'}
                  </span>
                  <span className="text-xs font-semibold text-[var(--texto-suave)]">{rev.periodo}</span>
                </div>
                <span className="text-xs text-[var(--texto-suave)] font-medium">
                  {new Date(rev.createdAt || rev.data || Date.now()).toLocaleDateString('pt-BR')}
                </span>
              </div>

              {/* Estatísticas do período */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[var(--surface-secondary)] text-center">
                <div>
                  <span className="text-sm font-extrabold text-[var(--texto)]">{rev.statsCalculadas?.tarefasConcluidas ?? rev.tasksDone ?? 0}</span>
                  <p className="text-[10px] text-[var(--texto-suave)] font-semibold">Tarefas Feitas</p>
                </div>
                <div>
                  <span className="text-sm font-extrabold text-[var(--primary)]">{(rev.statsCalculadas?.horasFoco ?? rev.focusHours ?? 0).toFixed(1)}h</span>
                  <p className="text-[10px] text-[var(--texto-suave)] font-semibold">Horas de Foco</p>
                </div>
                <div>
                  <span className="text-sm font-extrabold text-emerald-500">{rev.statsCalculadas?.diasAtivos ?? rev.activeDays ?? 0} dias</span>
                  <p className="text-[10px] text-[var(--texto-suave)] font-semibold">Constância</p>
                </div>
              </div>

              {/* Respostas qualitativas */}
              <div className="space-y-2 text-xs">
                {(rev.respostas?.oQueFuncionou || rev.ans1) && (
                  <div>
                    <strong className="text-emerald-600 block">O que funcionou bem:</strong>
                    <p className="text-[var(--texto)] font-medium mt-0.5">{rev.respostas?.oQueFuncionou || rev.ans1}</p>
                  </div>
                )}
                {(rev.respostas?.oQueTravou || rev.ans2) && (
                  <div>
                    <strong className="text-rose-500 block">O que travou / atrapalhou:</strong>
                    <p className="text-[var(--texto)] font-medium mt-0.5">{rev.respostas?.oQueTravou || rev.ans2}</p>
                  </div>
                )}
                {(rev.respostas?.oQueAjustar || rev.ans3) && (
                  <div>
                    <strong className="text-[var(--primary)] block">Ajustes para o próximo ciclo:</strong>
                    <p className="text-[var(--texto)] font-medium mt-0.5">{rev.respostas?.oQueAjustar || rev.ans3}</p>
                  </div>
                )}
              </div>

              {/* Metas do próximo ciclo */}
              {((rev.metasProximoCiclo && rev.metasProximoCiclo.length > 0) || (rev.nextGoals && rev.nextGoals.length > 0)) && (
                <div className="pt-2 border-t border-[var(--borda)]">
                  <span className="text-[11px] font-bold text-[var(--texto-suave)] block mb-1.5">Foco Principal Definido:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(rev.metasProximoCiclo || rev.nextGoals || []).map((meta: string, mIdx: number) => (
                      <span key={mIdx} className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-[var(--surface-secondary)] text-[var(--texto)] border border-[var(--borda)]">
                        🎯 {meta}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Wizard de Revisão Modal */}
      {isReviewWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--borda)] rounded-[28px] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--borda)] pb-3">
              <div>
                <h4 className="text-base font-extrabold text-[var(--texto)]">Revisão Semanal Guiada</h4>
                <p className="text-xs text-[var(--texto-suave)]">Passo {revStep} de 3</p>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewWizardOpen(false)}
                className="text-xs text-[var(--texto-suave)] hover:text-[var(--texto)] font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Passo 1: Resumo numérico & Vitórias */}
            {revStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-[var(--surface-secondary)] text-center text-xs">
                  <div>
                    <span className="text-sm font-extrabold text-[var(--texto)]">{tasks.filter(t => t.completed).length}</span>
                    <p className="text-[10px] text-[var(--texto-suave)]">Concluídas</p>
                  </div>
                  <div>
                    <span className="text-sm font-extrabold text-[var(--primary)]">{totalFocusHours}h</span>
                    <p className="text-[10px] text-[var(--texto-suave)]">Foco Total</p>
                  </div>
                  <div>
                    <span className="text-sm font-extrabold text-emerald-500">{activeDaysData.activeDays}d</span>
                    <p className="text-[10px] text-[var(--texto-suave)]">Ativos</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-600 block mb-1">1. O que funcionou bem nesta semana?</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Consegui manter a rotina matinal e bati a meta de exercícios de Matemática..."
                    value={revAns1}
                    onChange={e => setRevAns1(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-xs text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setRevStep(2)}
                    className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Próximo <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Passo 2: O que travou e Ajustes */}
            {revStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-rose-500 block mb-1">2. O que travou ou gerou procrastinação?</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Perdi muito tempo no celular à tarde, o bloco de Física estava muito longo..."
                    value={revAns2}
                    onChange={e => setRevAns2(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-xs text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--primary)] block mb-1">3. O que você fará diferente na próxima semana?</label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Vou dividir o bloco de Física em duas partes de 30 minutos e deixar o celular em outro cômodo..."
                    value={revAns3}
                    onChange={e => setRevAns3(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-xs text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setRevStep(1)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--texto-suave)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevStep(3)}
                    className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Definir Metas <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Passo 3: Metas do próximo ciclo */}
            {revStep === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[var(--texto)] block mb-1">Até 3 Focos Principais da Próxima Semana</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Meta 1: Fechar Módulo de Álgebra"
                      value={revGoal1}
                      onChange={e => setRevGoal1(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-xs text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                    />
                    <input
                      type="text"
                      placeholder="Meta 2: Fazer 1 Simulado Completo no Sábado"
                      value={revGoal2}
                      onChange={e => setRevGoal2(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-xs text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                    />
                    <input
                      type="text"
                      placeholder="Meta 3: Dormir 8h todos os dias"
                      value={revGoal3}
                      onChange={e => setRevGoal3(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] text-xs text-[var(--texto)] focus:outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setRevStep(2)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--texto-suave)] hover:bg-[var(--surface-secondary)] cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const newReview: PeriodicReview = {
                        id: `rev-${Date.now()}`,
                        tipo: 'semanal',
                        periodo: `Semana de ${todayISO}`,
                        respostas: {
                          oQueFuncionou: revAns1,
                          oQueTravou: revAns2,
                          oQueAjustar: revAns3,
                        },
                        statsCalculadas: {
                          tarefasConcluidas: tasks.filter(t => t.completed).length,
                          horasFoco: parseFloat(totalFocusHours),
                          diasAtivos: activeDaysData.activeDays,
                        },
                        metasProximoCiclo: [revGoal1, revGoal2, revGoal3].filter(Boolean),
                        createdAt: new Date().toISOString(),
                      };
                      await repository.savePeriodicReview(newReview);
                      setIsReviewWizardOpen(false);
                      setRevAns1('');
                      setRevAns2('');
                      setRevAns3('');
                      setRevGoal1('');
                      setRevGoal2('');
                      setRevGoal3('');
                      if (onRefresh) await onRefresh();
                    }}
                    className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Concluir e Salvar Revisão
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )}

  {/* ================================================================= */}
  {/* TAB 4: INSIGHTS & PADRÕES                                         */}
  {/* ================================================================= */}
  {journeyTab === 'insights' && (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-extrabold text-[var(--texto)]">Insights & Diagnósticos Automáticos</h3>
        <p className="text-xs text-[var(--texto-suave)]">Análises determinísticas baseadas no seu histórico real de estudo e produtividade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deterministicInsights.map(insight => (
          <div key={insight.id} className="p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)] space-y-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                insight.tipo === 'foco' ? 'bg-blue-500/10 text-[var(--primary)]' :
                insight.tipo === 'materia' ? 'bg-amber-500/10 text-amber-600' :
                insight.tipo === 'estimativa' ? 'bg-purple-500/10 text-purple-600' :
                insight.tipo === 'constancia' ? 'bg-emerald-500/10 text-emerald-600' :
                'bg-rose-500/10 text-rose-500'
              }`}>
                <Lightbulb className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-extrabold text-[var(--texto)]">{insight.titulo}</h4>
            </div>

            <p className="text-xs text-[var(--texto-suave)] leading-relaxed">{insight.descricao}</p>

            {insight.acaoLabel && (
              <div className="pt-2 border-t border-[var(--borda)]">
                <span className="text-[11px] font-bold text-[var(--primary)] inline-flex items-center gap-1">
                  💡 Sugestão prática: {insight.acaoLabel}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )}

</div>
  );
};
