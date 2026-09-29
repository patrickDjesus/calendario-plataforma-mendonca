import { describe, it, expect } from 'vitest';
import { Task } from '../types';
import {
  occursOn,
  isCompletedOn,
  taskForDate,
  tasksForDate,
  tasksByDate,
  isVirtualId,
  baseId,
  occurrenceDate,
  withOccurrenceCompleted,
  withOccurrenceRemoved,
  spentSecondsOn,
  describeRecurrence,
} from '../services/recurrence';

// 2026-09-28 e uma segunda-feira. A semana de referencia:
// Dom 27, Seg 28, Ter 29, Qua 30, Qui 01/10, Sex 02/10, Sab 03/10
const SEG = '2026-09-28';
const TER = '2026-09-29';
const QUA = '2026-09-30';
const SEX = '2026-10-02';
const DOM = '2026-09-27';
const ANTES = '2026-09-21'; // segunda anterior

const tarefa = (over: Partial<Task> = {}): Task => ({
  id: 'serie-1',
  title: 'Revisar matematica',
  categoryId: 'matematica',
  priority: 'media',
  date: SEG,
  spentSeconds: 0,
  completed: false,
  tags: [],
  subtasks: [],
  order: 0,
  createdAt: '2026-09-28T10:00:00.000Z',
  updatedAt: '2026-09-28T10:00:00.000Z',
  ...over,
});

describe('occursOn', () => {
  it('tarefa sem recorrencia so ocorre no proprio dia', () => {
    const t = tarefa();
    expect(occursOn(t, SEG)).toBe(true);
    expect(occursOn(t, TER)).toBe(false);
  });

  it('serie repete so nos dias marcados da semana', () => {
    const t = tarefa({ recurringDays: [1, 3, 5] });
    expect(occursOn(t, SEG)).toBe(true);
    expect(occursOn(t, QUA)).toBe(true);
    expect(occursOn(t, SEX)).toBe(true);
    expect(occursOn(t, TER)).toBe(false);
    expect(occursOn(t, DOM)).toBe(false);
  });

  it('"todos os dias" cobre a semana inteira, para frente', () => {
    const t = tarefa({ recurringDays: [0, 1, 2, 3, 4, 5, 6] });
    expect(occursOn(t, DOM)).toBe(false);
    expect(occursOn(t, SEG)).toBe(true);
    expect(occursOn(t, TER)).toBe(true);
    expect(occursOn(t, QUA)).toBe(true);
    expect(occursOn(t, SEX)).toBe(true);
  });

  it('a serie nao aparece antes do dia em que foi criada', () => {
    const t = tarefa({ recurringDays: [1] });
    expect(occursOn(t, ANTES)).toBe(false);
  });

  it('dia excluido some, mas a serie continua', () => {
    const t = tarefa({ recurringDays: [1], recurrenceExceptions: [ANTES] });
    expect(occursOn(t, ANTES)).toBe(false);
    expect(occursOn(t, SEG)).toBe(true);
  });

  it('tarefa deletada nao ocorre em dia nenhum', () => {
    const t = tarefa({ recurringDays: [0, 1, 2, 3, 4, 5, 6], deletedAt: '2026-09-28T12:00:00.000Z' });
    expect(occursOn(t, SEG)).toBe(false);
    expect(occursOn(t, TER)).toBe(false);
  });
});

describe('isCompletedOn', () => {
  it('na ancora vale o completed da propria tarefa', () => {
    const t = tarefa({ completed: true });
    expect(isCompletedOn(t, SEG)).toBe(true);
  });

  it('cada dia da serie tem conclusao propria', () => {
    const t = tarefa({
      recurringDays: [1, 3, 5],
      recurrenceCompletions: { [TER]: true },
    });
    expect(isCompletedOn(t, TER)).toBe(true);
    expect(isCompletedOn(t, SEG)).toBe(false);
    expect(isCompletedOn(t, SEX)).toBe(false);
  });
});

describe('taskForDate', () => {
  it('devolve null quando a serie nao ocorre no dia', () => {
    const t = tarefa({ recurringDays: [1] });
    expect(taskForDate(t, TER)).toBeNull();
  });

  it('materializa a ocorrencia com id proprio e data do dia', () => {
    const t = tarefa({ recurringDays: [1, 3] });
    const occ = taskForDate(t, QUA)!;
    expect(occ.date).toBe(QUA);
    expect(occ.id).toBe(`serie-1#${QUA}`);
    expect(occ.title).toBe(t.title);
    expect(occ.completed).toBe(false);
  });

  it('tarefa simples nao ganha id virtual', () => {
    const t = tarefa();
    const occ = taskForDate(t, SEG)!;
    expect(occ.id).toBe('serie-1');
    expect(isVirtualId(occ.id)).toBe(false);
  });

  it('a ocorrencia carrega o tempo gasto daquele dia', () => {
    const t = tarefa({ recurringDays: [1, 3], spentSecondsByDay: { [QUA]: 1800 } });
    expect(spentSecondsOn(t, QUA)).toBe(1800);
    expect(taskForDate(t, QUA)!.spentSeconds).toBe(1800);
    expect(taskForDate(t, SEG)!.spentSeconds).toBe(0);
  });
});

describe('ids virtuais', () => {
  it('extrai a base e a data de um id virtual', () => {
    const id = `serie-1#${QUA}`;
    expect(isVirtualId(id)).toBe(true);
    expect(baseId(id)).toBe('serie-1');
    expect(occurrenceDate(id)).toBe(QUA);
  });

  it('id normal nao e tratado como virtual', () => {
    expect(isVirtualId('serie-1')).toBe(false);
    expect(baseId('serie-1')).toBe('serie-1');
    expect(occurrenceDate('serie-1')).toBeNull();
  });
});

describe('withOccurrenceCompleted', () => {
  it('conclui so o dia, sem marcar os outros', () => {
    const t = tarefa({ recurringDays: [1, 3, 5] });
    const depois = withOccurrenceCompleted(t, QUA, true);
    expect(depois.recurrenceCompletions?.[QUA]).toBe(true);
    expect(depois.completed).toBe(false);
    expect(isCompletedOn(depois, SEG)).toBe(false);
    expect(isCompletedOn(depois, SEX)).toBe(false);
  });

  it('desmarcar remove so aquela data do registro', () => {
    const t = tarefa({ recurringDays: [1], recurrenceCompletions: { [SEG]: true, [QUA]: true } });
    const depois = withOccurrenceCompleted(t, QUA, false);
    expect(depois.recurrenceCompletions?.[QUA]).toBeUndefined();
    expect(depois.recurrenceCompletions?.[SEG]).toBe(true);
  });

  it('concluir a ancora conclui a serie', () => {
    const t = tarefa({ recurringDays: [1, 3, 5] });
    const depois = withOccurrenceCompleted(t, SEG, true);
    expect(depois.completed).toBe(true);
    expect(depois.completedAt).toBeTruthy();
  });
});

describe('withOccurrenceRemoved', () => {
  it('apagar um dia nao desliga a serie', () => {
    const t = tarefa({ recurringDays: [1, 3] });
    const depois = withOccurrenceRemoved(t, QUA);
    expect(depois.recurrenceExceptions).toEqual([QUA]);
    expect(depois.deletedAt).toBeUndefined();
    expect(occursOn(depois, SEG)).toBe(true);
    expect(occursOn(depois, QUA)).toBe(false);
  });

  it('apagar a ancora desliga a serie', () => {
    const t = tarefa({ recurringDays: [1] });
    const depois = withOccurrenceRemoved(t, SEG);
    expect(depois.deletedAt).toBeTruthy();
  });
});

describe('tasksForDate', () => {
  it('reune tarefas avulsas e ocorrencias do mesmo dia', () => {
    const serie = tarefa({ id: 'serie-1', recurringDays: [1, 3, 5] });
    const avulsa = tarefa({ id: 'avulsa-1', date: QUA, recurringDays: undefined });
    const ids = tasksForDate([serie, avulsa], QUA).map(t => t.id).sort();
    expect(ids).toEqual([`serie-1#${QUA}`, 'avulsa-1'].sort());
  });

  it('nao traz tarefa de outro dia', () => {
    const serie = tarefa({ recurringDays: [1] });
    expect(tasksForDate([serie], TER)).toEqual([]);
  });
});

describe('tasksByDate', () => {
  it('materializa cada ocorrencia no mapa de dias', () => {
    const serie = tarefa({ recurringDays: [1, 3, 5] });
    const mapa = tasksByDate([serie], [SEG, TER, QUA, SEX]);
    expect(mapa.get(SEG)!.map(t => t.id)).toEqual([`serie-1#${SEG}`]);
    expect(mapa.get(TER)).toEqual([]);
    expect(mapa.get(QUA)!.map(t => t.id)).toEqual([`serie-1#${QUA}`]);
    expect(mapa.get(SEX)!.map(t => t.id)).toEqual([`serie-1#${SEX}`]);
  });

  it('conta concluicoes separadas na contagem do mes', () => {
    const serie = tarefa({
      recurringDays: [1, 3, 5],
      recurrenceCompletions: { [QUA]: true },
    });
    const mapa = tasksByDate([serie], [SEG, QUA]);
    expect(mapa.get(SEG)![0].completed).toBe(false);
    expect(mapa.get(QUA)![0].completed).toBe(true);
  });
});

describe('describeRecurrence', () => {
  it('descreve a regra em portugues', () => {
    expect(describeRecurrence(tarefa({ recurringDays: [1, 3, 5] }))).toBe('Repete: Seg, Qua, Sex');
    expect(describeRecurrence(tarefa({ recurringDays: [0, 1, 2, 3, 4, 5, 6] }))).toBe('Todo dia');
    expect(describeRecurrence(tarefa())).toBeNull();
  });
});
