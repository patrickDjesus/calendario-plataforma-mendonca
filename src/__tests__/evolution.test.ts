import { describe, it, expect } from 'vitest';
import { parseQuickTask } from '../utils/quickTaskParser';
import { calculateNextReview, getGradeIntervalLabels } from '../utils/sm2';
import { applyMigrations } from '../services/migrations';
import { mergeSnapshots } from '../services/syncConflict';
import { generateDeterministicInsights } from '../utils/insights';
import { DatabaseSchema, Task } from '../types';

describe('BLOCO B3: Quick Task Natural Language Parser', () => {
  const refDate = new Date(2026, 8, 30, 10, 0, 0); // 30 de Setembro de 2026 (Quarta-feira)

  it('casos de teste mínimos do prompt', () => {
    // 1. "comprar café" -> título "comprar café", sem data
    const r1 = parseQuickTask('comprar café', refDate);
    expect(r1.title).toBe('comprar café');
    expect(r1.date).toBeUndefined();

    // 2. "reunião sex 14h" -> próxima sexta às 14:00
    const r2 = parseQuickTask('reunião sex 14h', refDate);
    expect(r2.title).toBe('reunião');
    expect(r2.date).toBe('2026-10-02'); // Quarta 30/09 -> Sexta 02/10
    expect(r2.time).toBe('14:00');

    // 3. "ler cap 3 amanhã ~45min #direito !alta" -> amanhã, 45 min, categoria direito, prioridade alta
    const r3 = parseQuickTask('ler cap 3 amanhã ~45min #direito !alta', refDate);
    expect(r3.title).toBe('ler cap 3');
    expect(r3.date).toBe('2026-10-01');
    expect(r3.estimatedMinutes).toBe(45);
    expect(r3.categoryTag).toBe('direito');
    expect(r3.priority).toBe('alta');

    // 4. "pagar boleto 05/11" -> 5 de novembro de 2026
    const r4 = parseQuickTask('pagar boleto 05/11', refDate);
    expect(r4.title).toBe('pagar boleto');
    expect(r4.date).toBe('2026-11-05');

    // 5. "treino !top" -> hoje, fixada no Top 3
    const r5 = parseQuickTask('treino !top', refDate);
    expect(r5.title).toBe('treino');
    expect(r5.date).toBe('2026-09-30');
    expect(r5.isTop3).toBe(true);
  });

  it('suporta recorrências como 3x por semana e todo dia', () => {
    const r = parseQuickTask('academia 3x por semana #saude', refDate);
    expect(r.title).toBe('academia');
    expect(r.recurrence?.vezesPorSemana).toBe(3);
    expect(r.categoryTag).toBe('saude');

    const r2 = parseQuickTask('meditar todo dia ~15min', refDate);
    expect(r2.title).toBe('meditar');
    expect(r2.recurrence?.type).toBe('diaria');
    expect(r2.estimatedMinutes).toBe(15);
  });
});

describe('BLOCO D3: SuperMemo SM-2 Algoritmo Autêntico', () => {
  const baseItem = {
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
    lapses: 0,
  };
  const today = '2026-09-30';

  it('primeira repetição com sucesso (Bom q=4)', () => {
    const res = calculateNextReview(baseItem, 4, today);
    expect(res.repetitions).toBe(1);
    expect(res.intervalDays).toBe(1);
    expect(res.lapses).toBe(0);
    expect(res.dueDate).toBe('2026-10-01');
  });

  it('segunda repetição com sucesso avança para 6 dias', () => {
    const secondStep = { ...baseItem, repetitions: 1, intervalDays: 1 };
    const res = calculateNextReview(secondStep, 4, today);
    expect(res.repetitions).toBe(2);
    expect(res.intervalDays).toBe(6);
    expect(res.dueDate).toBe('2026-10-06');
  });

  it('falha (De novo q=1) reseta repetições para 0, intervalo para 1 e incrementa lapses', () => {
    const advanced = { easeFactor: 2.6, intervalDays: 15, repetitions: 4, lapses: 0 };
    const res = calculateNextReview(advanced, 1, today);
    expect(res.repetitions).toBe(0);
    expect(res.intervalDays).toBe(1);
    expect(res.lapses).toBe(1);
    expect(res.easeFactor).toBeLessThan(2.6);
    expect(res.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('gera rótulos de previsão de intervalo para os 4 botões', () => {
    const labels = getGradeIntervalLabels(baseItem, today);
    expect(labels[1]).toBe('< 1d');
    expect(labels[3]).toBeDefined();
    expect(labels[4]).toBeDefined();
    expect(labels[5]).toBeDefined();
  });
});

describe('BLOCO A1 & A2: Migrações e Resolução de Conflitos', () => {
  it('aplica migrações em dados legados e inicializa coleções e schemaVersion', () => {
    const legacyDb = {
      version: 5,
      profile: { xp: 100, level: 1, streak: 2, xpHistory: { '2026-09-29': 50 } },
      settings: {},
      categories: [],
      tasks: [
        {
          id: 't-old-1',
          title: 'Tarefa Antiga',
          spentSeconds: 1800,
          completed: true,
          date: '2026-09-29',
          createdAt: '2026-09-29T10:00:00Z',
          updatedAt: '2026-09-29T10:00:00Z',
        },
      ],
      trash: [],
    };

    const res = applyMigrations(legacyDb);
    expect(res.migrated).toBe(true);
    expect(res.data.schemaVersion).toBe(2);
    expect(res.data.focusSessions?.length).toBe(1);
    expect(res.data.focusSessions?.[0].actualSeconds).toBe(1800);
    expect(res.data.dailyStats).toBeDefined();
    expect(res.data.dailyStats?.['2026-09-29']?.tasksDone).toBe(1);
    expect(res.data.reviewItems).toBeDefined();
    expect(res.data.subjects).toBeDefined();
    expect(res.data.topics).toBeDefined();
  });

  it('resolve conflitos dando vitória ao updatedAt mais recente por entidade', () => {
    const local = {
      version: 1,
      tasks: [
        {
          id: 'task-1',
          title: 'Versão Local Mais Nova',
          updatedAt: '2026-09-30T12:00:00Z',
          completed: false,
        } as Task,
      ],
      profile: { xp: 500, level: 2, streak: 3 },
    } as any;

    const remote = {
      version: 1,
      tasks: [
        {
          id: 'task-1',
          title: 'Versão Remota Desatualizada',
          updatedAt: '2026-09-30T10:00:00Z',
          completed: false,
        } as Task,
      ],
      profile: { xp: 400, level: 1, streak: 2 },
    } as any;

    const merged = mergeSnapshots(local, remote);
    expect(merged.hasConflict).toBe(true);
    expect(merged.merged.tasks[0].title).toBe('Versão Local Mais Nova');
    expect(merged.merged.profile.xp).toBe(500);
  });
});

describe('BLOCO E4: Geração de Insights Determinísticos', () => {
  it('gera insights quando há dados suficientes de sessões e tarefas', () => {
    const db: any = {
      subjects: [
        { id: 's-1', nome: 'Direito Administrativo', cor: '#3B6CF5', metaSemanalMin: 300, createdAt: '2026-09-01' },
      ],
      tasks: [
        { id: '1', completed: true, estimatedMinutes: 30, spentSeconds: 3600 },
        { id: '2', completed: true, estimatedMinutes: 30, spentSeconds: 3600 },
        { id: '3', completed: true, estimatedMinutes: 30, spentSeconds: 3600 },
        { id: '4', completed: true, estimatedMinutes: 30, spentSeconds: 3600 },
      ],
      focusSessions: [
        { id: '1', subjectId: 's-other', actualSeconds: 1800, startedAt: new Date().toISOString() },
      ],
    };

    const insights = generateDeterministicInsights(db);
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeLessThanOrEqual(3);
    const neglected = insights.find(i => i.tipo === 'materia');
    expect(neglected).toBeDefined();
  });
});
