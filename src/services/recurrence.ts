/**
 * Tarefas recorrentes — a regra e as ocorrências.
 *
 * O campo `recurringDays` (0 = Dom ... 6 = Sáb) é a REGRA da série. Ela vive na
 * tarefa original, que é a âncora: a tarefa nasce em `task.date` e a regra vale
 * daquele dia em diante.
 *
 * Uma recorrência não vira uma linha nova por dia no banco. A ocorrência é
 * derivada na leitura: para o dia 30/09, uma tarefa com recurringDays [1..5]
 * produz uma ocorrência cuja `date` é 30/09 e cujo `id` é
 * `<id-da-serie>#2026-09-30`. Isso importa porque o restante do app já trata
 * "tarefa" como "algo que pertence a uma data" — o XP diário, o completedAt, o
 * resumo de foco e a exportação ICS dependem disso. Materializar cópias reais
 * obrigaria a duplicar estado e a reconciliar na nuvem.
 *
 * O que é gravado por dia, e só isso:
 *  - `recurrenceCompletions[iso]`: concluída aquele dia. Concluir terça não
 *    marca quarta, que é exatamente o que se espera de uma rotina.
 *  - `recurrenceExceptions[iso]`: aquele dia foi pulado de propósito (o usuário
 *    deletou só a ocorrência). Some a regra, não a série.
 *
 * Concluir ou apagar a tarefa-âncora desliga a série inteira: é o comportamento
 * de remover um evento repetido de um calendário, e evita deixar uma regra
 * órfã produzindo tarefas invisíveis.
 */

import { Task } from '../types';
import { parseISODate } from '../utils/dateUtils';

/** Separador do id virtual. Não pode aparecer em id gerado por generateUUID. */
const SEP = '#';

export const isRecurring = (task: Task): boolean =>
  Array.isArray(task.recurringDays) && task.recurringDays.length > 0;

/** `tarefa-1#2026-09-30` -> true */
export const isVirtualId = (id: string): boolean => id.includes(SEP);

/** `tarefa-1#2026-09-30` -> `tarefa-1` */
export const baseId = (id: string): string => {
  const i = id.indexOf(SEP);
  return i === -1 ? id : id.slice(0, i);
};

/** `tarefa-1#2026-09-30` -> `2026-09-30` */
export const occurrenceDate = (id: string): string | null => {
  const i = id.indexOf(SEP);
  if (i === -1) return null;
  return id.slice(i + 1);
};

const virtualId = (base: string, iso: string): string => `${base}${SEP}${iso}`;

/**
 * A série ocorre neste dia?Datas ISO em YYYY-MM-DD comparam lexicograficamente,
 * então a comparação com a âncora é segura e não depende de fuso.
 */
export const occursOn = (task: Task, iso: string): boolean => {
  if (task.deletedAt) return false;
  if (!isRecurring(task)) return task.date === iso;
  if (iso < task.date) return false;
  if (task.recurrenceExceptions?.includes(iso)) return false;
  const weekday = parseISODate(iso).getDay();
  return (task.recurringDays as number[]).includes(weekday);
};

/** Concluída especificamente neste dia. */
export const isCompletedOn = (task: Task, iso: string): boolean => {
  if (iso === task.date) return task.completed;
  return task.recurrenceCompletions?.[iso] === true;
};

/**
 * A ocorrência da série `task` no dia `iso`, ou null se a série não ocorre nele.
 * Tarefas sem recorrência devolvem a própria tarefa, sem id virtual.
 */
export const taskForDate = (task: Task, iso: string): Task | null => {
  if (!occursOn(task, iso)) return null;
  if (!isRecurring(task)) return task;
  return {
    ...task,
    id: virtualId(task.id, iso),
    date: iso,
    completed: isCompletedOn(task, iso),
    completedAt: isCompletedOn(task, iso) ? task.updatedAt : undefined,
    spentSeconds: spentSecondsOn(task, iso),
  };
};

/** Todas as tarefas — reais e ocorrências — que pertencem a um dia. */
export const tasksForDate = (tasks: Task[], iso: string): Task[] => {
  const out: Task[] = [];
  for (const t of tasks) {
    const occurrence = taskForDate(t, iso);
    if (occurrence) out.push(occurrence);
  }
  return out;
};

/**
 * mapped de tarefas por dia, para as listas que varrem um intervalo.
 * Só os dias pedidos são materializados, então não há janela artificial:
 * um mês listado mostra a série em todos os dias do mês, ano adentro.
 */
export const tasksByDate = (tasks: Task[], dates: string[]): Map<string, Task[]> => {
  const map = new Map<string, Task[]>();
  for (const d of dates) map.set(d, []);
  for (const t of tasks) {
    for (const d of map.keys()) {
      const occurrence = taskForDate(t, d);
      if (occurrence) map.get(d)!.push(occurrence);
    }
  }
  return map;
};

/**
 * Marca/desmarca a ocorrência e devolve a tarefa-base atualizada.
 * Concluir a âncora (o dia em que a série nasceu) conclui a série, porque o
 * usuário está encerrando o item em si, não só o dia de hoje.
 */
export const withOccurrenceCompleted = (task: Task, iso: string, completed: boolean): Task => {
  if (!isRecurring(task) || iso === task.date) {
    return {
      ...task,
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  const completions = { ...(task.recurrenceCompletions ?? {}) };
  if (completed) completions[iso] = true;
  else delete completions[iso];

  return { ...task, recurrenceCompletions: completions, updatedAt: new Date().toISOString() };
};

/**
 * Remove só a ocorrência do dia, via exceção. Na âncora, apagar desliga a série.
 */
export const withOccurrenceRemoved = (task: Task, iso: string): Task => {
  if (!isRecurring(task) || iso === task.date) {
    return { ...task, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  const exceptions = Array.from(new Set([...(task.recurrenceExceptions ?? []), iso]));
  return { ...task, recurrenceExceptions: exceptions, updatedAt: new Date().toISOString() };
};

/** Aplica o spentSeconds só na ocorrência do timer, mantendo a regra na base. */
export const withOccurrenceSpent = (task: Task, iso: string, spentSeconds: number): Task => {
  if (!isRecurring(task) || iso === task.date) {
    return { ...task, spentSeconds };
  }
  const spentByDay = { ...(task.spentSecondsByDay ?? {}) };
  spentByDay[iso] = spentSeconds;
  return { ...task, spentSecondsByDay: spentByDay };
};

/** Minutos gastos no dia — some com a âncora, soma o total dos dias da série. */
export const spentSecondsOn = (task: Task, iso: string): number => {
  if (!isRecurring(task) || iso === task.date) return task.spentSeconds || 0;
  return task.spentSecondsByDay?.[iso] ?? 0;
};

/** "Repete: Seg, Qua, Sex" para a UI. */
export const describeRecurrence = (task: Task): string | null => {
  if (!isRecurring(task)) return null;
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const sorted = [...(task.recurringDays as number[])].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Todo dia';
  return `Repete: ${sorted.map(d => days[d]).join(', ')}`;
};
