import React from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  summary?: React.ReactNode;
  summaryWhenClosed?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  actionButton?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({
  id,
  title,
  icon,
  summary,
  summaryWhenClosed,
  isOpen,
  onToggle,
  actionButton,
  children,
  className = '',
}) => {
  const contentId = `${id}-content`;
  const headerId = `${id}-header`;
  const closedSummaryText = summary || summaryWhenClosed;

  return (
    <div className={`border border-[var(--borda)] rounded-2xl bg-[var(--surface)] overflow-hidden transition-all duration-200 ${className}`}>
      <div className="flex items-center justify-between p-1 pr-2 bg-[var(--surface-secondary)]/80 hover:bg-[var(--surface-secondary)] transition-colors">
        <button
          id={headerId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={onToggle}
          className="flex-1 h-11 px-3 flex items-center justify-between gap-2.5 text-xs font-semibold text-[var(--texto)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] rounded-xl"
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-[var(--primary)] shrink-0">{icon}</span>}
            <span className="font-bold text-[var(--texto)] truncate">{title}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isOpen && closedSummaryText && (
              <span className="text-[11px] font-medium text-[var(--texto-suave)] truncate max-w-[160px] sm:max-w-[220px]">
                {closedSummaryText}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-[var(--texto-suave)] shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {actionButton && <div className="pl-2 shrink-0">{actionButton}</div>}
      </div>

      {isOpen && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={headerId}
          className="p-4 border-t border-[var(--borda-soft)] space-y-4 animate-fadeIn motion-reduce:animate-none"
        >
          {children}
        </div>
      )}
    </div>
  );
};
