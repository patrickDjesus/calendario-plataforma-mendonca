import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Download, 
  Sparkles, 
  Layers, 
  List, 
  Grid,
  ChevronDown
} from 'lucide-react';

interface WeekHeaderProps {
  monthName: string;
  selectedYear: number;
  selectedMonth: number;
  monthNames: string[];
  isCurrentMonth: boolean;
  totalTasks: number;
  completedTasks: number;
  totalPlannedHours: string;
  onGoToToday: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectMonth: (year: number, month: number) => void;
  viewMode: 'grid' | 'list';
  onToggleViewMode: (mode: 'grid' | 'list') => void;
  onPlanWeek: () => void;
  onExportICS: () => void;
  onOpenTemplates?: () => void;
}

export const WeekHeader: React.FC<WeekHeaderProps> = ({
  monthName,
  selectedYear,
  selectedMonth,
  monthNames,
  isCurrentMonth,
  totalTasks,
  completedTasks,
  totalPlannedHours,
  onGoToToday,
  onPrevMonth,
  onNextMonth,
  onSelectMonth,
  viewMode,
  onToggleViewMode,
  onPlanWeek,
  onExportICS,
  onOpenTemplates,
}) => {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="sticky top-0 z-20 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--borda)] px-4 py-3 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
      {/* Left: Month Nav & Picker */}
      <div className="flex items-center gap-3 flex-wrap relative">
        <div className="flex items-center gap-1 bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--borda)]">
          <button
            type="button"
            onClick={onPrevMonth}
            title="Mês anterior"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface)] transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onGoToToday}
            title="Ir para mês atual e hoje"
            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              isCurrentMonth
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--primary)] hover:bg-[var(--primary-soft)]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Hoje</span>
          </button>

          <button
            type="button"
            onClick={onNextMonth}
            title="Próximo mês"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface)] transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month Selector Dropdown Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--borda)] transition-all cursor-pointer"
          >
            <span className="text-sm font-extrabold text-[var(--texto)] tracking-tight">
              {monthName} de {selectedYear}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[var(--texto-suave)] transition-transform duration-200 ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Month Picker Dropdown */}
          {isMonthPickerOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 rounded-2xl bg-[var(--surface)] border border-[var(--borda)] shadow-xl animate-fadeIn">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--borda)]">
                <span className="text-xs font-bold text-[var(--texto-suave)]">Selecionar Mês</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectMonth(selectedYear - 1, selectedMonth)}
                    className="p-1 rounded text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)]"
                  >
                    &laquo; {selectedYear - 1}
                  </button>
                  <span className="text-xs font-extrabold text-[var(--primary)]">{selectedYear}</span>
                  <button
                    type="button"
                    onClick={() => onSelectMonth(selectedYear + 1, selectedMonth)}
                    className="p-1 rounded text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)]"
                  >
                    {selectedYear + 1} &raquo;
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {monthNames.map((mName, idx) => {
                  const isSel = idx === selectedMonth;
                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => {
                        onSelectMonth(selectedYear, idx);
                        setIsMonthPickerOpen(false);
                      }}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--texto)] hover:bg-[var(--surface-secondary)]'
                      }`}
                    >
                      {mName.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center/Right: Metrics & Actions */}
      <div className="flex items-center gap-2.5 flex-wrap justify-between md:justify-end">
        {/* Metrics Pill */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs font-semibold text-[var(--texto-suave)] tabular-nums">
          <div>
            <span className="text-[var(--texto)] font-bold">{completedTasks}</span>/{totalTasks} tarefas
          </div>
          <span className="w-1 h-1 rounded-full bg-[var(--texto-muted)]" />
          <div>
            <span className="text-[var(--texto)] font-bold">{totalPlannedHours}</span> planejadas
          </div>
          <span className="w-1 h-1 rounded-full bg-[var(--texto-muted)]" />
          <div className="text-[var(--primary)] font-bold">
            {completionPercent}%
          </div>
        </div>

        {/* View Toggle (Grid vs List) */}
        <div className="flex items-center p-1 bg-[var(--surface-secondary)] border border-[var(--borda)] rounded-xl">
          <button
            type="button"
            onClick={() => onToggleViewMode('grid')}
            title="Visualização em colunas"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs'
                : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode('list')}
            title="Visualização em lista"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs'
                : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Templates, Plan Week & Export */}
        {onOpenTemplates && (
          <button
            type="button"
            onClick={onOpenTemplates}
            title="Modelos de rotina"
            className="h-9 px-3 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-semibold text-[var(--texto)] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-[var(--texto-suave)]" />
            <span className="hidden sm:inline">Modelos</span>
          </button>
        )}

        <button
          type="button"
          onClick={onPlanWeek}
          className="h-9 px-3 rounded-xl border border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Planejar semana</span>
        </button>

        <button
          type="button"
          onClick={onExportICS}
          title="Exportar calendário .ICS"
          className="w-9 h-9 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-[var(--texto-suave)] hover:text-[var(--texto)] transition-all flex items-center justify-center cursor-pointer"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

