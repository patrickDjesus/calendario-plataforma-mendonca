import { Priority, Category } from '../types';
import { getTodayISO, formatDateToISO } from './dateUtils';

export interface ParsedTaskResult {
  title: string;
  date: string;
  time?: string;
  estimatedMinutes?: number;
  categoryId?: string;
  categoryName?: string;
  priority: Priority;
  recurringDays?: number[];
  tags: string[];
  rawMatches: {
    dateLabel?: string;
    timeLabel?: string;
    durationLabel?: string;
    priorityLabel?: string;
    categoryLabel?: string;
    recurringLabel?: string;
  };
}

export function parseNaturalLanguageTask(
  input: string,
  categories: Category[],
  defaultDate: string = getTodayISO()
): ParsedTaskResult {
  let workingText = input.trim();
  const rawMatches: ParsedTaskResult['rawMatches'] = {};
  const tags: string[] = [];

  let date = defaultDate;
  let time: string | undefined = undefined;
  let estimatedMinutes: number | undefined = undefined;
  let priority: Priority = 'media';
  let categoryId: string | undefined = undefined;
  let categoryName: string | undefined = undefined;
  let recurringDays: number[] | undefined = undefined;

  // 1. Check priority (!urgente, !alta, !media, !baixa)
  const priorityRegex = /!(urgente|alta\+|alta|media|média|baixa)/i;
  const pMatch = workingText.match(priorityRegex);
  if (pMatch) {
    const pWord = pMatch[1].toLowerCase();
    if (pWord === 'urgente' || pWord === 'alta+') {
      priority = 'urgente';
      rawMatches.priorityLabel = 'Prioridade Urgente';
    } else if (pWord === 'alta') {
      priority = 'alta';
      rawMatches.priorityLabel = 'Prioridade Alta';
    } else if (pWord === 'baixa') {
      priority = 'baixa';
      rawMatches.priorityLabel = 'Prioridade Baixa';
    } else {
      priority = 'media';
      rawMatches.priorityLabel = 'Prioridade Média';
    }
    workingText = workingText.replace(pMatch[0], ' ').trim();
  }

  // 2. Check category hashtags (#estudo, #matematica, etc.)
  const hashMatches = workingText.match(/#([\w\u00C0-\u00FF-]+)/g);
  if (hashMatches) {
    for (const h of hashMatches) {
      const tagContent = h.substring(1).toLowerCase();
      // If tag is math/physics/science, map to unified study category
      if (['matematica', 'matemática', 'fisica', 'física', 'ciencias', 'ciências'].includes(tagContent)) {
        const studyCat = categories.find(c => c.id === 'cat-estudo') || categories[0];
        if (studyCat && !categoryId) {
          categoryId = studyCat.id;
          categoryName = studyCat.name;
          rawMatches.categoryLabel = `#${studyCat.name}`;
        }
        tags.push(tagContent);
      } else {
        // Try to match with an existing category
        const matchedCat = categories.find(
          c => c.name.toLowerCase() === tagContent || c.id.toLowerCase().includes(tagContent)
        );
        if (matchedCat && !categoryId) {
          categoryId = matchedCat.id;
          categoryName = matchedCat.name;
          rawMatches.categoryLabel = `#${matchedCat.name}`;
        } else {
          tags.push(tagContent);
        }
      }
      workingText = workingText.replace(h, ' ').trim();
    }
  }

  // 3. Check Time of day first (ex: às 14h, às 14:30, 09h15, 18:00, 15:30)
  const timeRegex = /(?:^|\s)(?:(?:às|as)\s+)?([0-1]?[0-9]|2[0-3])(?:h|:)([0-5][0-9])?(?:h)?\b/i;
  const tMatch = workingText.match(timeRegex);
  if (tMatch) {
    const hours = tMatch[1].padStart(2, '0');
    const mins = tMatch[2] ? tMatch[2].padStart(2, '0') : '00';
    time = `${hours}:${mins}`;
    rawMatches.timeLabel = `Às ${time}`;
    workingText = workingText.replace(tMatch[0], ' ').trim();
  }

  // 4. Check Duration (ex.: 45min, 1h30, 2h, 1h 20m, 30m, 90 min)
  const durationRegex = /\b(\d+)\s*(?:h|hora|horas)\s*(?:e\s*)?(\d+)?\s*(?:min|minutos|m)?\b|\b(\d+)\s*(?:min|minutos|m)\b/i;
  const durMatch = workingText.match(durationRegex);
  if (durMatch) {
    if (durMatch[3]) {
      // e.g. "45min"
      estimatedMinutes = parseInt(durMatch[3], 10);
      rawMatches.durationLabel = `${durMatch[3]}min`;
    } else if (durMatch[1] && durMatch[2]) {
      // e.g. "1h30"
      estimatedMinutes = parseInt(durMatch[1], 10) * 60 + parseInt(durMatch[2], 10);
      rawMatches.durationLabel = `${durMatch[1]}h ${durMatch[2]}min`;
    } else if (durMatch[1]) {
      // e.g. "2h"
      estimatedMinutes = parseInt(durMatch[1], 10) * 60;
      rawMatches.durationLabel = `${durMatch[1]}h`;
    }
    workingText = workingText.replace(durMatch[0], ' ').trim();
  }

  // 5. Check Recurring patterns (ex: "toda seg e qua", "todo dia", "todas terças")
  const recurringRegex = /\b(?:toda|todas|todo|todos|repetir)\s+([a-zA-Z\s,e]+)/i;
  const recMatch = workingText.match(recurringRegex);
  if (recMatch) {
    const daysStr = recMatch[1].toLowerCase();
    const daysMap: Record<string, number> = {
      dom: 0, domingo: 0,
      seg: 1, segunda: 1,
      ter: 2, terca: 2, terça: 2,
      qua: 3, quarta: 3,
      qui: 4, quinta: 4,
      sex: 5, sexta: 5,
      sab: 6, sabado: 6, sábado: 6,
    };

    if (daysStr.includes('dia')) {
      recurringDays = [0, 1, 2, 3, 4, 5, 6];
      rawMatches.recurringLabel = 'Todo dia';
    } else {
      const foundDays: number[] = [];
      Object.keys(daysMap).forEach(key => {
        if (new RegExp(`\\b${key}\\b`, 'i').test(daysStr)) {
          const d = daysMap[key];
          if (!foundDays.includes(d)) foundDays.push(d);
        }
      });
      if (foundDays.length > 0) {
        recurringDays = foundDays.sort((a, b) => a - b);
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        rawMatches.recurringLabel = `Repete: ${recurringDays.map(d => dayNames[d]).join(', ')}`;
      }
    }
    if (recurringDays) {
      workingText = workingText.replace(recMatch[0], ' ').trim();
    }
  }

  // 6. Check Date indicators ("hoje", "amanhã", "depois de amanhã", "segunda", "terça", etc.)
  const today = new Date();
  if (/\bdepois\s+de\s+amanh[aã]\b/i.test(workingText)) {
    const target = new Date(today);
    target.setDate(today.getDate() + 2);
    date = formatDateToISO(target);
    rawMatches.dateLabel = 'Depois de amanhã';
    workingText = workingText.replace(/\bdepois\s+de\s+amanh[aã]\b/i, ' ').trim();
  } else if (/\bamanh[aã]\b/i.test(workingText)) {
    const target = new Date(today);
    target.setDate(today.getDate() + 1);
    date = formatDateToISO(target);
    rawMatches.dateLabel = 'Amanhã';
    workingText = workingText.replace(/\bamanh[aã]\b/i, ' ').trim();
  } else if (/\bhoje\b/i.test(workingText)) {
    date = formatDateToISO(today);
    rawMatches.dateLabel = 'Hoje';
    workingText = workingText.replace(/\bhoje\b/i, ' ').trim();
  } else {
    // Check specific days of the week (e.g., "segunda", "terça", "sexta")
    const weekDaysMap: Record<string, number> = {
      domingo: 0, dom: 0,
      segunda: 1, seg: 1,
      'terça': 2, terca: 2, ter: 2,
      quarta: 3, qua: 3,
      quinta: 4, qui: 4,
      sexta: 5, sex: 5,
      'sábado': 6, sabado: 6, sab: 6,
    };

    for (const [dayName, targetDayNum] of Object.entries(weekDaysMap)) {
      const regex = new RegExp(`\\b(?:na\\s+|no\\s+|pr[oó]xim[ao]\\s+)?${dayName}\\b`, 'i');
      const dMatch = workingText.match(regex);
      if (dMatch) {
        const currentDay = today.getDay();
        let daysToAdd = targetDayNum - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // Next occurrence
        const target = new Date(today);
        target.setDate(today.getDate() + daysToAdd);
        date = formatDateToISO(target);
        rawMatches.dateLabel = `Próx. ${dayName}`;
        workingText = workingText.replace(dMatch[0], ' ').trim();
        break;
      }
    }
  }

  // Fallback category if none matched via hashtag
  if (!categoryId && categories.length > 0) {
    // Try to find if the text contains category name words (e.g., "matemática")
    for (const cat of categories) {
      if (new RegExp(`\\b${cat.name}\\b`, 'i').test(workingText)) {
        categoryId = cat.id;
        categoryName = cat.name;
        rawMatches.categoryLabel = cat.name;
        break;
      }
    }
    if (!categoryId) {
      categoryId = categories[0].id; // Default Estudo
      categoryName = categories[0].name;
    }
  }

  // Clean title
  let title = workingText.replace(/\s+/g, ' ').trim();
  if (!title) {
    title = 'Nova tarefa';
  }

  return {
    title,
    date,
    time,
    estimatedMinutes,
    categoryId,
    categoryName,
    priority,
    recurringDays,
    tags,
    rawMatches,
  };
}
