/**
 * Date manipulation utilities in Brazilian Portuguese
 */

export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseISODate(isoString: string): Date {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function getTodayISO(): string {
  return formatDateToISO(new Date());
}

export function addDaysToDate(isoString: string, daysToAdd: number): string {
  const date = parseISODate(isoString);
  date.setDate(date.getDate() + daysToAdd);
  return formatDateToISO(date);
}

export function getDayOfWeekLabel(isoString: string): string {
  const date = parseISODate(isoString);
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dayNames[date.getDay()];
}

export function formatDayDisplay(isoString: string): string {
  const date = parseISODate(isoString);
  const day = date.getDate();
  const monthNames = [
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez'
  ];
  return `${day} ${monthNames[date.getMonth()]}`;
}

export function getWeekDays(referenceDate: Date, firstDayOfWeek: 0 | 1 = 1): Array<{ date: Date; isoString: string; dayName: string; shortName: string; isToday: boolean }> {
  const dayOfWeek = referenceDate.getDay(); // 0 is Sunday
  const diff = firstDayOfWeek === 1 
    ? (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) // Start on Monday
    : -dayOfWeek; // Start on Sunday

  const weekStart = new Date(referenceDate);
  weekStart.setDate(referenceDate.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);

  const days = [];
  const fullDayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const shortNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const todayISO = getTodayISO();

  for (let i = 0; i < 7; i++) {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + i);
    const iso = formatDateToISO(current);
    const dayIndex = current.getDay();

    days.push({
      date: current,
      isoString: iso,
      dayName: fullDayNames[dayIndex],
      shortName: shortNames[dayIndex],
      isToday: iso === todayISO,
    });
  }

  return days;
}

export function formatSecondsToDigital(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatMinutesHuman(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`;
}

export function formatSecondsHuman(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return formatMinutesHuman(mins);
}
