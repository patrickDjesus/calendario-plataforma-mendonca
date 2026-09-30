import { Priority } from '../types';

export interface ParsedQuickChip {
  id: string;
  label: string;
  type: 'date' | 'time' | 'duration' | 'priority' | 'top3' | 'category' | 'recurrence';
  value: any;
}

export interface QuickTaskParseResult {
  title: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  estimatedMinutes?: number;
  priority: Priority;
  isTop3?: boolean;
  categoryTag?: string;
  recurrence?: {
    type: 'diaria' | 'semanal' | 'mensal' | 'cada_n_dias';
    interval: number;
    weekdays?: number[];
    vezesPorSemana?: number;
  };
  chips: ParsedQuickChip[];
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseQuickTask(input: string, now: Date = new Date()): QuickTaskParseResult {
  let text = input.trim();
  const chips: ParsedQuickChip[] = [];
  const todayISO = formatDate(now);

  let date: string | undefined = undefined;
  let time: string | undefined = undefined;
  let estimatedMinutes: number | undefined = undefined;
  let priority: Priority = 'media';
  let isTop3 = false;
  let categoryTag: string | undefined = undefined;
  let recurrence: QuickTaskParseResult['recurrence'] = undefined;

  // 1. Recorrência (ex: "3x por semana", "todo dia", "toda seg e qua", "toda seg")
  const xPerWeekRegex = /(\d+)x\s+por\s+semana/i;
  const xMatch = text.match(xPerWeekRegex);
  if (xMatch) {
    const times = parseInt(xMatch[1], 10);
    recurrence = { type: 'semanal', interval: 1, vezesPorSemana: times };
    chips.push({ id: 'rec', label: `🔄 ${times}x por semana`, type: 'recurrence', value: recurrence });
    text = text.replace(xMatch[0], ' ');
  }

  const todoDiaRegex = /\btodo\s+dia\b/i;
  if (todoDiaRegex.test(text)) {
    recurrence = { type: 'diaria', interval: 1 };
    chips.push({ id: 'rec', label: '🔄 Todo dia', type: 'recurrence', value: recurrence });
    text = text.replace(todoDiaRegex, ' ');
  }

  const todaSemanaRegex = /\btoda\s+(seg(?:unda)?|ter(?:ça|ca)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|s[aá]b(?:ado)?|dom(?:ingo)?)(?:\s+e\s+(seg(?:unda)?|ter(?:ça|ca)?|qua(?:rta)?|qui(?:nta)?|sex(?:ta)?|s[aá]b(?:ado)?|dom(?:ingo)?))?\b/i;
  const todaMatch = text.match(todaSemanaRegex);
  if (todaMatch && !recurrence) {
    const dayMap: Record<string, number> = {
      seg: 1, segunda: 1,
      ter: 2, terca: 2, terça: 2,
      qua: 3, quarta: 3,
      qui: 4, quinta: 4,
      sex: 5, sexta: 5,
      sab: 6, sábado: 6, sabado: 6,
      dom: 0, domingo: 0,
    };
    const weekdays: number[] = [];
    const d1 = todaMatch[1].toLowerCase().slice(0, 3);
    if (dayMap[d1] !== undefined) weekdays.push(dayMap[d1]);
    if (todaMatch[2]) {
      const d2 = todaMatch[2].toLowerCase().slice(0, 3);
      if (dayMap[d2] !== undefined) weekdays.push(dayMap[d2]);
    }
    recurrence = { type: 'semanal', interval: 1, weekdays };
    chips.push({ id: 'rec', label: `🔄 ${todaMatch[0].trim()}`, type: 'recurrence', value: recurrence });
    text = text.replace(todaMatch[0], ' ');
  }

  // 2. Data relativa ou absoluta
  // "depois de amanhã"
  const depoisRegex = /(?:^|\s)depois\s+de\s+amanh[aã](?:\s|$)/i;
  const depoisMatch = text.match(depoisRegex);
  if (depoisMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    date = formatDate(d);
    chips.push({ id: 'date', label: '📅 Depois de amanhã', type: 'date', value: date });
    text = text.replace(depoisMatch[0], ' ');
  } else {
    const amanhaRegex = /(?:^|\s)amanh[aã](?:\s|$)/i;
    const amanhaMatch = text.match(amanhaRegex);
    if (amanhaMatch) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      date = formatDate(d);
      chips.push({ id: 'date', label: '📅 Amanhã', type: 'date', value: date });
      text = text.replace(amanhaMatch[0], ' ');
    } else if (/(?:^|\s)hoje(?:\s|$)/i.test(text)) {
      date = todayISO;
      chips.push({ id: 'date', label: '📅 Hoje', type: 'date', value: date });
      text = text.replace(/(?:^|\s)hoje(?:\s|$)/i, ' ');
    }
  }

  // "em N dias"
  const emNDiasRegex = /\bem\s+(\d+)\s+dias?\b/i;
  const emNMatch = text.match(emNDiasRegex);
  if (emNMatch && !date) {
    const count = parseInt(emNMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() + count);
    date = formatDate(d);
    chips.push({ id: 'date', label: `📅 em ${count} dias`, type: 'date', value: date });
    text = text.replace(emNMatch[0], ' ');
  }

  // dd/mm ou dd/mm/aaaa
  const dateNumRegex = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
  const dateNumMatch = text.match(dateNumRegex);
  if (dateNumMatch && !date) {
    const day = parseInt(dateNumMatch[1], 10);
    const month = parseInt(dateNumMatch[2], 10);
    let year = dateNumMatch[3] ? parseInt(dateNumMatch[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    if (!dateNumMatch[3]) {
      // Se não indicou o ano e o mês/dia já passou, agendar para o próximo ano
      const candidate = new Date(year, month - 1, day);
      if (candidate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) {
        year += 1;
      }
    }
    date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    chips.push({ id: 'date', label: `📅 ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`, type: 'date', value: date });
    text = text.replace(dateNumMatch[0], ' ');
  }

  // Dias da semana avulsos ("seg", "ter", "qua", "qui", "sex", "sáb", "dom")
  const dayNamesRegex = /\b(seg|ter|qua|qui|sex|s[aá]b|dom)\b/i;
  const dayMatch = text.match(dayNamesRegex);
  if (dayMatch && !date) {
    const map: Record<string, number> = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, sáb: 6, dom: 0 };
    const targetDay = map[dayMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Próxima ocorrência
      const d = new Date(now);
      d.setDate(d.getDate() + diff);
      date = formatDate(d);
      chips.push({ id: 'date', label: `📅 ${dayMatch[1].toUpperCase()}`, type: 'date', value: date });
      text = text.replace(dayMatch[0], ' ');
    }
  }

  // 3. Hora (19h, 19:30, 19h30)
  const timeRegex = /\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const mins = parseInt(timeMatch[2] || timeMatch[3] || '0', 10);
    if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
      time = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      chips.push({ id: 'time', label: `🕖 ${time}`, type: 'time', value: time });
      text = text.replace(timeMatch[0], ' ');
    }
  }

  // 4. Estimativa de duração (~30min, ~1h, ~1h30)
  const durationRegex = /~(\d+)(?:h(\d{2}|\d{1})?|min|m|h)?/i;
  const durMatch = text.match(durationRegex);
  if (durMatch) {
    const raw = durMatch[0].toLowerCase();
    if (raw.includes('h') && raw.includes('min')) {
      const parts = raw.replace('~', '').split('h');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1].replace('min', ''), 10) || 0;
      estimatedMinutes = h * 60 + m;
    } else if (raw.includes('h')) {
      const parts = raw.replace('~', '').split('h');
      const h = parseInt(parts[0], 10) || 0;
      const m = parts[1] ? parseInt(parts[1], 10) || 0 : 0;
      estimatedMinutes = h * 60 + m;
    } else {
      estimatedMinutes = parseInt(durMatch[1], 10) || 30;
    }
    const label = estimatedMinutes >= 60 
      ? `${Math.floor(estimatedMinutes / 60)}h${estimatedMinutes % 60 ? `${estimatedMinutes % 60}m` : ''}` 
      : `${estimatedMinutes}min`;
    chips.push({ id: 'dur', label: `⏱ ~${label}`, type: 'duration', value: estimatedMinutes });
    text = text.replace(durMatch[0], ' ');
  }

  // 5. Prioridade (!alta, !media, !baixa, !urgente, !1, !2, !3, !top)
  const topMatch = text.match(/!top\b/i);
  if (topMatch) {
    isTop3 = true;
    chips.push({ id: 'top3', label: '⭐ Top 3', type: 'top3', value: true });
    text = text.replace(topMatch[0], ' ');
    if (!date) date = todayISO;
  }

  const prioMatch = text.match(/!(alta\+|alta|urgente|m[eé]dia|baixa|1|2|3)\b/i);
  if (prioMatch) {
    const val = prioMatch[1].toLowerCase();
    if (val === 'alta' || val === '1') {
      priority = 'alta';
      chips.push({ id: 'prio', label: '🔴 Alta', type: 'priority', value: 'alta' });
    } else if (val === 'urgente' || val === 'alta+') {
      priority = 'urgente';
      chips.push({ id: 'prio', label: '🔥 Urgente', type: 'priority', value: 'urgente' });
    } else if (val === 'baixa' || val === '3') {
      priority = 'baixa';
      chips.push({ id: 'prio', label: '🟢 Baixa', type: 'priority', value: 'baixa' });
    } else {
      priority = 'media';
      chips.push({ id: 'prio', label: '🟡 Média', type: 'priority', value: 'media' });
    }
    text = text.replace(prioMatch[0], ' ');
  }

  // 6. Categoria / Matéria (#direito, #concurso, #estudo)
  const catMatch = text.match(/#([\w\u00C0-\u00FF-]+)/i);
  if (catMatch) {
    categoryTag = catMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    chips.push({ id: 'cat', label: `#${catMatch[1]}`, type: 'category', value: categoryTag });
    text = text.replace(catMatch[0], ' ');
  }

  // Limpa múltiplos espaços
  const title = text.replace(/\s+/g, ' ').trim();

  return {
    title: title || 'Nova tarefa',
    date,
    time,
    estimatedMinutes,
    priority,
    isTop3,
    categoryTag,
    recurrence,
    chips,
  };
}
