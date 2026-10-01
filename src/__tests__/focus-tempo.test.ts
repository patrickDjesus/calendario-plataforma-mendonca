import { describe, it, expect } from 'vitest';
import { generateRoadmapSteps } from '../components/PomodoroRoadmap';
import { withOccurrenceSpent, spentSecondsOn } from '../services/recurrence';
import { Task } from '../types';

/**
 * Regressoes do modo foco relatadas na pratica: o "43%" que nao batia com a
 * meta de 1h30, o mini-cronometro que sobrevivia a "Concluir" e as horas do dia
 * que mostravam 0.2h com 1h10 ja estudadas.
 */
describe('Modo Foco: percentual do roadmap', () => {
  const roadmapPercent = (
    estimatedMinutes: number,
    completedFocusBlocks: number,
    spentSeconds: number,
    activeTimerElapsed = 0,
    currentPhase: 'foco' | 'pausa_curta' | 'pausa_longa' = 'foco',
  ) => {
    const steps = generateRoadmapSteps(
      estimatedMinutes, 25, 5, 15, 4, completedFocusBlocks, currentPhase, true,
    );
    const focusSteps = steps.filter(s => s.type === 'focus');
    const doneFocus = focusSteps.filter(s => s.status === 'completed').length;
    const activeFocus = focusSteps.find(s => s.status === 'active');
    const partialFocus = activeFocus && activeFocus.durationMinutes > 0
      ? Math.min(1, (activeTimerElapsed / 60) / activeFocus.durationMinutes)
      : 0;
    return focusSteps.length > 0
      ? Math.min(100, Math.round(((doneFocus + partialFocus) / focusSteps.length) * 100))
      : 0;
  };

  it('3 blocos de 25 min numa meta de 90 min nao e 43% (pausa nao conta como "nao feito")', () => {
    // 90min = 25+25+25+15 -> 4 blocos de foco + 3 pausas = 7 passos.
    // A conta antiga (3 de 7 passos) dava 43%.
    const steps = generateRoadmapSteps(90, 25, 5, 15, 4, 3, 'foco', true);
    expect(steps).toHaveLength(7);
    expect(steps.filter(s => s.type === 'break')).toHaveLength(3);
    expect(roadmapPercent(90, 3, 0)).toBe(75);
  });

  it('conta o bloco em andamento pela fracao percorrida', () => {
    // O ultimo bloco e o que sobra da meta: 90 - 75 = 15 min.
    // 10 min dentro dele: 3 completos + 10/15 do 4o -> 92%.
    expect(roadmapPercent(90, 3, 0, 600)).toBe(92);
  });

  it('um bloco pausado continua contando o que ja foi percorrido', () => {
    const steps = generateRoadmapSteps(90, 25, 5, 15, 4, 3, 'foco', false);
    const focusSteps = steps.filter(s => s.type === 'focus');
    const activeFocus = focusSteps.find(s => s.status === 'active');
    expect(activeFocus?.status).toBe('active');
    expect(
      focusSteps.filter(s => s.status === 'completed').length,
    ).toBe(3);
  });

  it('atinge 100% quando a soma dos blocos fecha a meta', () => {
    expect(roadmapPercent(90, 4, 5400, 0)).toBe(100);
  });
});

describe('Modo Foco: tempo gravado na tarefa', () => {
  const base: Task = {
    id: 't1',
    title: 'Revisao',
    date: '2026-09-30',
    createdAt: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:00:00.000Z',
    categoryId: 'cat-estudo',
    completed: false,
    priority: 'media',
    estimatedMinutes: 90,
    spentSeconds: 0,
    tags: [],
    subtasks: [],
    order: 0,
  };

  it('acumula blocos sequenciais sem perder nem duplicar segundos', () => {
    let task = base;
    for (let i = 0; i < 4; i++) {
      task = withOccurrenceSpent(task, task.date, spentSecondsOn(task, task.date) + 1500);
    }
    expect(spentSecondsOn(task, '2026-09-30')).toBe(6000);
    expect((spentSecondsOn(task, '2026-09-30') / 3600).toFixed(1)).toBe('1.7');
  });

  it('1h10 de foco aparece como 1.2h, e nao como os 0.2h do bloco em andamento', () => {
    // O bug: o total do dia trocava o tempo acumulado da tarefa pelo bloco
    // POMODORO em andamento. Com 1h10 na tarefa e 10 min no bloco corrente, o
    // cartao "Sessoes de foco" mostrava 10/60 = 0.2h.
    const acumuladoNaTarefa = 70 * 60;
    const blocoEmAndamento = 10 * 60;

    const totalDoDia = (segundos: number) => (segundos / 3600).toFixed(1);

    expect(totalDoDia(blocoEmAndamento)).toBe('0.2');
    expect(totalDoDia(acumuladoNaTarefa)).toBe('1.2');
  });

  it('serie recorrente guarda o tempo por dia, sem vazar para o dia seguinte', () => {
    // A ancora e 28/09; 29 e 30/09 sao ocorrencias, cada uma com seu tempo.
    const serie: Task = { ...base, date: '2026-09-28', recurringDays: [1, 2, 3, 4, 5] };
    const comOntem = withOccurrenceSpent(serie, '2026-09-29', 3600);
    const comHoje = withOccurrenceSpent(comOntem, '2026-09-30', 1800);

    expect(spentSecondsOn(comHoje, '2026-09-29')).toBe(3600);
    expect(spentSecondsOn(comHoje, '2026-09-30')).toBe(1800);
    // O total da ancora nao acumula os dias da serie.
    expect(comHoje.spentSeconds).toBe(0);
  });
});