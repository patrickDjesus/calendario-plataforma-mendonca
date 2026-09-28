import { Task, Category } from '../types';
import { APP_NAME } from '../constants/app';

/**
 * Generate iCalendar RFC 5545 string from a list of tasks
 */
export function generateICS(tasks: Task[], categories: Category[]): string {
  const catMap = new Map<string, string>(categories.map(c => [c.id, c.name]));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${APP_NAME}//Planejamento de Estudos//PT-BR`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${APP_NAME} Planejamento`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
  ];

  for (const task of tasks) {
    if (task.deletedAt) continue;

    const [year, month, day] = task.date.split('-').map(Number);
    const startHour = task.time ? parseInt(task.time.split(':')[0], 10) : 9;
    const startMin = task.time ? parseInt(task.time.split(':')[1], 10) : 0;
    const durationMin = task.estimatedMinutes || 45;

    const dtStart = new Date(Date.UTC(year, month - 1, day, startHour + 3, startMin)); // UTC offset
    const dtEnd = new Date(dtStart.getTime() + durationMin * 60 * 1000);

    const formatICSDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const categoryName = catMap.get(task.categoryId) || 'Estudo';
    const status = task.completed ? 'COMPLETED' : 'CONFIRMED';
    const description = [
      task.description || '',
      `Categoria: ${categoryName}`,
      `Prioridade: ${task.priority.toUpperCase()}`,
      task.spentSeconds > 0 ? `Tempo dedicado: ${Math.round(task.spentSeconds / 60)} min` : '',
    ].filter(Boolean).join('\\n');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@focosemanal.app`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART:${formatICSDate(dtStart)}`);
    lines.push(`DTEND:${formatICSDate(dtEnd)}`);
    lines.push(`SUMMARY:${task.title.replace(/[,;]/g, ' ')}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`CATEGORIES:${categoryName}`);
    lines.push(`STATUS:${status}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICSFile(tasks: Task[], categories: Category[], filename: string = 'agenda_focosemanal.ics'): void {
  const content = generateICS(tasks, categories);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
