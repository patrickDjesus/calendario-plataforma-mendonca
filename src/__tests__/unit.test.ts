import { describe, it, expect } from 'vitest';
import { 
  calculateTaskXP, 
  calculateLevelFromXP, 
  getLevelTitle, 
  calculateStreak, 
  calculateSM2 
} from '../utils/xpSystem';
import { parseNaturalLanguageTask } from '../utils/nlpParser';
import { Task, Category } from '../types';

describe('XP & Gamification System', () => {
  const baseTask: Task = {
    id: 't-1',
    title: 'Exercícios de Termodinâmica',
    categoryId: 'cat-estudo',
    priority: 'media',
    date: '2026-09-28',
    spentSeconds: 0,
    completed: true,
    tags: [],
    subtasks: [],
    order: 0,
    createdAt: '2026-09-28T10:00:00Z',
    updatedAt: '2026-09-28T10:00:00Z',
  };

  it('calculates base XP by priority without duration bonus when spentSeconds < 900s (15 min)', () => {
    const baixaXp = calculateTaskXP({ ...baseTask, priority: 'baixa', spentSeconds: 300 });
    expect(baixaXp).toBe(15);

    const mediaXp = calculateTaskXP({ ...baseTask, priority: 'media', spentSeconds: 899 });
    expect(mediaXp).toBe(25);

    const altaXp = calculateTaskXP({ ...baseTask, priority: 'alta', spentSeconds: 0 });
    expect(altaXp).toBe(40);

    const urgenteXp = calculateTaskXP({ ...baseTask, priority: 'urgente', spentSeconds: 600 });
    expect(urgenteXp).toBe(50);
  });

  it('rewards duration bonus only after minimum 15 minutes of focus', () => {
    // 15 min (900s) => +10 XP
    const with15m = calculateTaskXP({ ...baseTask, priority: 'media', spentSeconds: 900 });
    expect(with15m).toBe(35); // 25 base + 10

    // 45 min (2700s) => +30 XP
    const with45m = calculateTaskXP({ ...baseTask, priority: 'media', spentSeconds: 2700 });
    expect(with45m).toBe(55); // 25 base + 30
  });

  it('rewards quality bonuses (Top 3, on-time review, high accuracy)', () => {
    const top3Task: Task = { ...baseTask, priority: 'alta', isTop3: true, spentSeconds: 900 };
    const xp = calculateTaskXP(top3Task, { onTimeReview: true, highAccuracy: true });
    // 40 (alta) + 10 (15m) + 25 (top 3) + 20 (on-time review) + 20 (accuracy) = 115
    expect(xp).toBe(115);
  });

  it('enforces anti-abuse daily cap per task (max 120 XP)', () => {
    const hugeTask: Task = {
      ...baseTask,
      priority: 'urgente', // 50
      isTop3: true, // +25
      spentSeconds: 7200, // 2h => +40 max time bonus
      subtasks: [
        { id: '1', title: 's1', completed: true },
        { id: '2', title: 's2', completed: true },
        { id: '3', title: 's3', completed: true },
        { id: '4', title: 's4', completed: true },
      ], // +20 subtasks
    };
    // Sum = 50 + 25 + 40 + 20 = 135 => capped at 120
    const xp = calculateTaskXP(hugeTask, { onTimeReview: true, highAccuracy: true });
    expect(xp).toBe(120);
  });

  it('scales levels up to 25+ with titles', () => {
    const l1 = calculateLevelFromXP(50);
    expect(l1.level).toBe(1);
    expect(getLevelTitle(1)).toBe('Iniciante Focado');

    const l10 = calculateLevelFromXP(5000);
    expect(l10.level).toBeGreaterThanOrEqual(8);

    expect(getLevelTitle(20)).toBe('Iluminado da Eficiência');
    expect(getLevelTitle(25)).toBe('Mito Eterno do Foco');
  });
});

describe('Streak & Shield Calculation', () => {
  it('increments streak on consecutive days', () => {
    const res = calculateStreak('2026-09-27', '2026-09-28', 5, true);
    expect(res.streak).toBe(6);
    expect(res.shieldUsed).toBe(false);
    expect(res.shieldAvailable).toBe(true);
  });

  it('uses streak shield when user misses 1 day', () => {
    // Missed 2026-09-27 (2 days diff from 26 to 28)
    const res = calculateStreak('2026-09-26', '2026-09-28', 5, true);
    expect(res.streak).toBe(6);
    expect(res.shieldUsed).toBe(true);
    expect(res.shieldAvailable).toBe(false);
  });

  it('resets streak to 1 when user misses more than 1 day or has no shield', () => {
    const resNoShield = calculateStreak('2026-09-26', '2026-09-28', 5, false);
    expect(resNoShield.streak).toBe(1);

    const resTooLong = calculateStreak('2026-09-24', '2026-09-28', 5, true);
    expect(resTooLong.streak).toBe(1);
  });
});

describe('SuperMemo SM-2 Spaced Repetition', () => {
  it('schedules correct intervals for good quality responses', () => {
    const today = '2026-09-28';
    // First review, quality 4 (Good)
    const r1 = calculateSM2(4, 0, 1, 2.5, today);
    expect(r1.repetitions).toBe(1);
    expect(r1.intervalDays).toBe(1);
    expect(r1.dueDate).toBe('2026-09-29');

    // Second review, quality 5 (Perfect)
    const r2 = calculateSM2(5, 1, 1, r1.easeFactor, today);
    expect(r2.repetitions).toBe(2);
    expect(r2.intervalDays).toBe(6);

    // Third review, quality 4 (Good)
    const r3 = calculateSM2(4, 2, 6, r2.easeFactor, today);
    expect(r3.repetitions).toBe(3);
    expect(r3.intervalDays).toBeGreaterThan(12);
  });

  it('resets repetitions on quality < 3 (failure)', () => {
    const today = '2026-09-28';
    const failed = calculateSM2(1, 4, 15, 2.5, today);
    expect(failed.repetitions).toBe(0);
    expect(failed.intervalDays).toBe(1);
    expect(failed.dueDate).toBe('2026-09-29');
  });
});

describe('NLP Natural Language Parser', () => {
  const categories: Category[] = [
    { id: 'cat-estudo', name: 'Estudo', color: '#3B6CF5', icon: 'book' },
    { id: 'cat-saude', name: 'Saúde & Treino', color: '#F97316', icon: 'heart-pulse' },
  ];

  it('parses urgent priority, duration, time and tags', () => {
    const res = parseNaturalLanguageTask('Revisar física quântica !urgente às 15:30 45min #prova', categories, '2026-09-28');
    expect(res.priority).toBe('urgente');
    expect(res.time).toBe('15:30');
    expect(res.estimatedMinutes).toBe(45);
    expect(res.tags).toContain('prova');
    expect(res.title).toContain('Revisar física quântica');
  });

  it('routes math and physics keywords to unified study category', () => {
    const res = parseNaturalLanguageTask('Resolver 15 exercícios de matemática e física', categories, '2026-09-28');
    expect(res.categoryId).toBe('cat-estudo');
  });
});
