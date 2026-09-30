import { DatabaseSchema, FocusSession, Subject, Task } from '../types';

export interface InsightCard {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'foco' | 'materia' | 'estimativa' | 'constancia' | 'humor';
  acaoLabel?: string;
}

/**
 * Gera até 3 insights determinísticos, claros e acionáveis baseados em fatos reais
 */
export function generateDeterministicInsights(db: DatabaseSchema): InsightCard[] {
  const insights: InsightCard[] = [];
  const sessions = db.focusSessions || [];
  const tasks = db.tasks || [];
  const subjects = db.subjects || [];

  // 1. Matéria negligenciada
  if (subjects.length > 0) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const subjectFocusMin: Record<string, number> = {};

    sessions.forEach(s => {
      if (s.subjectId && s.startedAt >= oneWeekAgo) {
        subjectFocusMin[s.subjectId] = (subjectFocusMin[s.subjectId] || 0) + Math.round(s.actualSeconds / 60);
      }
    });

    const neglected = subjects.find(s => {
      const done = subjectFocusMin[s.id] || 0;
      return s.metaSemanalMin > 60 && done < s.metaSemanalMin * 0.35;
    });

    if (neglected) {
      const done = subjectFocusMin[neglected.id] || 0;
      const doneHours = (done / 60).toFixed(1);
      const targetHours = (neglected.metaSemanalMin / 60).toFixed(1);
      insights.push({
        id: `ins-subj-${neglected.id}`,
        tipo: 'materia',
        titulo: `Atenção com ${neglected.nome}`,
        descricao: `Você acumulou ${doneHours}h de ${targetHours}h planejadas para esta semana. Que tal um bloco de 25 min hoje?`,
        acaoLabel: 'Estudar agora',
      });
    }
  }

  // 2. Precisão das estimativas (Tempo Real vs Estimado)
  const completedWithEstimate = tasks.filter(
    t => t.completed && t.estimatedMinutes && t.estimatedMinutes >= 15 && t.spentSeconds && t.spentSeconds >= 300
  );

  if (completedWithEstimate.length >= 4) {
    let totalEstimatedSec = 0;
    let totalRealSec = 0;
    completedWithEstimate.slice(-20).forEach(t => {
      totalEstimatedSec += (t.estimatedMinutes || 0) * 60;
      totalRealSec += t.spentSeconds;
    });

    if (totalEstimatedSec > 0) {
      const ratio = totalRealSec / totalEstimatedSec;
      if (ratio > 1.25) {
        const perc = Math.round((ratio - 1) * 100);
        insights.push({
          id: 'ins-accuracy-over',
          tipo: 'estimativa',
          titulo: 'Precisão das estimativas',
          descricao: `Nas tarefas recentes, você levou em média ${perc}% a mais de tempo do que estimou. Experimente arredondar suas estimativas para cima.`,
        });
      } else if (ratio < 0.8) {
        const perc = Math.round((1 - ratio) * 100);
        insights.push({
          id: 'ins-accuracy-under',
          tipo: 'estimativa',
          titulo: 'Ritmo mais rápido que o previsto',
          descricao: `Você concluiu suas tarefas recentes ${perc}% mais rápido do que havia estimado!`,
        });
      }
    }
  }

  // 3. Melhor horário e dia de foco (Pico biológico)
  if (sessions.length >= 6) {
    const hourCounts: Record<number, number> = {};
    const weekdayCounts: Record<number, number> = {};
    const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    sessions.forEach(s => {
      if (s.startedAt) {
        const d = new Date(s.startedAt);
        const hour = d.getHours();
        const wd = d.getDay();
        hourCounts[hour] = (hourCounts[hour] || 0) + s.actualSeconds;
        weekdayCounts[wd] = (weekdayCounts[wd] || 0) + s.actualSeconds;
      }
    });

    let bestHour = 9;
    let maxHourSec = 0;
    Object.entries(hourCounts).forEach(([h, sec]) => {
      if (sec > maxHourSec) {
        maxHourSec = sec;
        bestHour = Number(h);
      }
    });

    let bestDay = 1;
    let maxDaySec = 0;
    Object.entries(weekdayCounts).forEach(([wd, sec]) => {
      if (sec > maxDaySec) {
        maxDaySec = sec;
        bestDay = Number(wd);
      }
    });

    if (maxHourSec > 3600) {
      insights.push({
        id: 'ins-peak-hour',
        tipo: 'foco',
        titulo: 'Seu pico de concentração',
        descricao: `Seu horário mais produtivo é por volta das ${bestHour}:00 e seu dia de maior rendimento costuma ser ${weekdayNames[bestDay]}.`,
      });
    }
  }

  // 4. Comparação da semana com a média das últimas 4 semanas
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentSessions = sessions.filter(s => s.startedAt >= fourWeeksAgo);
  if (recentSessions.length >= 10 && insights.length < 3) {
    const totalRecentHours = recentSessions.reduce((acc, s) => acc + s.actualSeconds, 0) / 3600;
    const avgWeeklyHours = totalRecentHours / 4;

    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const thisWeekHours = sessions
      .filter(s => new Date(s.startedAt).getTime() >= thisWeekStart.getTime())
      .reduce((acc, s) => acc + s.actualSeconds, 0) / 3600;

    if (avgWeeklyHours > 2) {
      const diff = Math.round(((thisWeekHours - avgWeeklyHours) / avgWeeklyHours) * 100);
      if (Math.abs(diff) >= 20) {
        insights.push({
          id: 'ins-weekly-trend',
          tipo: 'constancia',
          titulo: diff > 0 ? 'Ritmo acima da média' : 'Semana de menor volume',
          descricao: diff > 0
            ? `${thisWeekHours.toFixed(1)}h de foco esta semana (${diff}% acima da sua média de 4 semanas). Ótimo progresso!`
            : `${thisWeekHours.toFixed(1)}h de foco esta semana (${Math.abs(diff)}% abaixo da média). Tudo bem desacelerar para recarregar.`,
        });
      }
    }
  }

  return insights.slice(0, 3);
}
