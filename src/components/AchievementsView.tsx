import React, { useMemo } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Flame, 
  Zap, 
  Award, 
  CalendarCheck, 
  Target, 
  Repeat, 
  CheckCircle, 
  Star, 
  TrendingUp, 
  Clock 
} from 'lucide-react';
import { Achievement, UserProfile, Task, Category } from '../types';
import { calculateLevelFromXP, getLevelTitle } from '../utils/xpSystem';
import { formatMinutesHuman } from '../utils/dateUtils';

interface AchievementsViewProps {
  achievements: Achievement[];
  profile: UserProfile;
  tasks: Task[];
  categories: Category[];
}

export const AchievementsView: React.FC<AchievementsViewProps> = ({
  achievements,
  profile,
  tasks,
  categories,
}) => {
  const levelInfo = calculateLevelFromXP(profile.xp);
  const levelTitle = getLevelTitle(profile.level);
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const unlockedCount = achievements.filter(a => a.unlockedAt).length;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'sparkles': return <Sparkles className="w-6 h-6" />;
      case 'flame': return <Flame className="w-6 h-6" />;
      case 'zap': return <Zap className="w-6 h-6" />;
      case 'award': return <Award className="w-6 h-6" />;
      case 'calendar-check': return <CalendarCheck className="w-6 h-6" />;
      case 'crown': return <Trophy className="w-6 h-6" />;
      case 'target': return <Target className="w-6 h-6" />;
      case 'repeat': return <Repeat className="w-6 h-6" />;
      default: return <Star className="w-6 h-6" />;
    }
  };

  // Weekly review recap calculations
  const weeklyRecap = useMemo(() => {
    const totalFocusSeconds = tasks.reduce((acc, t) => acc + (t.spentSeconds || 0), 0);
    const completedTasks = tasks.filter(t => t.completed).length;

    // Find top studied category
    const catCounts: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.spentSeconds > 0) {
        catCounts[t.categoryId] = (catCounts[t.categoryId] || 0) + t.spentSeconds;
      }
    });

    let topCatId = '';
    let maxSec = 0;
    Object.entries(catCounts).forEach(([cId, sec]) => {
      if (sec > maxSec) {
        maxSec = sec;
        topCatId = cId;
      }
    });

    const topCategory = catMap.get(topCatId) || categories[0];

    return {
      totalFocusMinutes: Math.round(totalFocusSeconds / 60),
      completedTasks,
      topCategoryName: topCategory?.name || 'Estudo Geral',
      topCategoryColor: topCategory?.color || '#3B6CF5',
    };
  }, [tasks, categories, catMap]);

  return (
    <div className="space-y-6">
      
      {/* Level Header Banner */}
      <div className="rounded-[28px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-7 sm:p-8 shadow-xl shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-md flex items-center justify-center text-4xl shadow-inner border border-white/20">
              {profile.avatar || '🏆'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/20">
                  Nível {profile.level}
                </span>
                <span className="text-sm font-bold text-blue-200">
                  {levelTitle}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">
                {profile.xp} Pontos de Experiência
              </h2>
              <p className="text-xs text-blue-100 mt-0.5">
                Desbloqueie conquistas e continue acumulando minutos de foco para subir de nível.
              </p>
            </div>
          </div>

          {/* Level Progress */}
          <div className="w-full md:w-64 bg-black/20 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span>Próximo Nível ({profile.level + 1})</span>
              <span className="tabular-nums">{levelInfo.currentLevelXp}/{levelInfo.nextLevelXp} XP</span>
            </div>
            <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-700"
                style={{ width: `${levelInfo.progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-blue-200 block text-right mt-1 font-semibold">
              {levelInfo.progressPercent}% completo
            </span>
          </div>
        </div>
      </div>

      {/* Automatic Weekly Review Card */}
      <div className="p-6 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[var(--texto)]">
                Relatório de Desempenho & Revisão Semanal
              </h3>
              <p className="text-xs text-[var(--texto-suave)]">
                Insights consolidados da sua rotina de estudos
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--primary-soft)] text-[var(--primary)]">
            Automático
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)]">
            <span className="text-xs font-bold text-[var(--texto-suave)] uppercase tracking-wider block mb-1">
              Foco Total
            </span>
            <div className="text-xl font-black text-[var(--texto)]">
              {formatMinutesHuman(weeklyRecap.totalFocusMinutes)}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
              Minutos cronometrados
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)]">
            <span className="text-xs font-bold text-[var(--texto-suave)] uppercase tracking-wider block mb-1">
              Matéria Mais Estudada
            </span>
            <div className="text-xl font-black text-[var(--texto)] truncate" style={{ color: weeklyRecap.topCategoryColor }}>
              {weeklyRecap.topCategoryName}
            </div>
            <span className="text-[11px] text-[var(--texto-suave)] font-semibold mt-0.5 block">
              Maior tempo de dedicação
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)]">
            <span className="text-xs font-bold text-[var(--texto-suave)] uppercase tracking-wider block mb-1">
              Tarefas Finalizadas
            </span>
            <div className="text-xl font-black text-[var(--texto)]">
              {weeklyRecap.completedTasks} tarefas
            </div>
            <span className="text-[11px] text-blue-600 font-semibold mt-0.5 block">
              Progresso no checklist
            </span>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="p-6 rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--texto)] tracking-tight">
              Galeria de Conquistas ({unlockedCount}/{achievements.length})
            </h3>
            <p className="text-xs text-[var(--texto-suave)] font-medium">
              Marcos de consistência e maestria nos estudos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {achievements.map((ach) => {
            const isUnlocked = !!ach.unlockedAt;
            const pct = Math.min(100, Math.round((ach.progress / ach.maxProgress) * 100));

            return (
              <div
                key={ach.id}
                className={`p-5 rounded-[22px] border transition-all duration-300 flex flex-col justify-between ${
                  isUnlocked
                    ? 'bg-[var(--surface)] border-amber-500/40 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30'
                    : 'bg-[var(--surface-secondary)]/60 border-[var(--borda)] opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isUnlocked
                        ? 'bg-gradient-to-tr from-amber-400 to-yellow-500 text-white shadow-md shadow-amber-500/30'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                    }`}>
                      {getIcon(ach.icon)}
                    </div>

                    {isUnlocked ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        CONCLUÍDO
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[var(--texto-muted)]">
                        {ach.progress}/{ach.maxProgress}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-extrabold text-[var(--texto)] leading-snug">
                    {ach.title}
                  </h4>
                  <p className="text-xs text-[var(--texto-suave)] mt-1 leading-relaxed">
                    {ach.description}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="mt-4 pt-3 border-t border-[var(--borda-soft)]">
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isUnlocked ? 'bg-amber-500' : 'bg-[var(--primary)]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {isUnlocked && ach.unlockedAt && (
                    <span className="text-[10px] text-amber-600 font-semibold mt-1.5 block">
                      Desbloqueado em {new Date(ach.unlockedAt).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
