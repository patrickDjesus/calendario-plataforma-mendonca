import { useState, useCallback, useMemo } from 'react';
import { formatDateToISO } from '../utils/dateUtils';

export interface InfiniteDayItem {
  date: Date;
  dateISO: string;
  isToday: boolean;
  dayName: string;
  dayNumber: number;
  monthName: string;
  monthIndex: number;
  year: number;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function createDayItem(d: Date, todayISO: string): InfiniteDayItem {
  const dateISO = formatDateToISO(d);
  return {
    date: new Date(d),
    dateISO,
    isToday: dateISO === todayISO,
    dayName: DAY_NAMES[d.getDay()],
    dayNumber: d.getDate(),
    monthName: MONTH_NAMES[d.getMonth()],
    monthIndex: d.getMonth(),
    year: d.getFullYear(),
  };
}

export function useInfiniteDays() {
  const today = useMemo(() => new Date(), []);
  const todayISO = useMemo(() => formatDateToISO(today), [today]);

  // Default automatically to current year and current month
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());

  // Generate days strictly for the selected month (Day 1 to Last Day of Month)
  const days = useMemo(() => {
    const list: InfiniteDayItem[] = [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const d = new Date(selectedYear, selectedMonth, dayNum, 12, 0, 0);
      list.push(createDayItem(d, todayISO));
    }
    return list;
  }, [selectedYear, selectedMonth, todayISO]);

  const monthName = MONTH_NAMES[selectedMonth];
  const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth();

  // Navigate to next month
  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => {
      if (prevMonth === 11) {
        setSelectedYear((prevYear) => prevYear + 1);
        return 0;
      }
      return prevMonth + 1;
    });
  }, []);

  // Navigate to previous month
  const goToPrevMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => {
      if (prevMonth === 0) {
        setSelectedYear((prevYear) => prevYear - 1);
        return 11;
      }
      return prevMonth - 1;
    });
  }, []);

  // Return to today's month
  const goToTodayMonth = useCallback(() => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  }, []);

  // Set explicit month and year
  const setMonthAndYear = useCallback((year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
  }, []);

  return {
    days,
    todayISO,
    selectedYear,
    selectedMonth,
    monthName,
    isCurrentMonth,
    MONTH_NAMES,
    goToNextMonth,
    goToPrevMonth,
    goToTodayMonth,
    setMonthAndYear,
  };
}

