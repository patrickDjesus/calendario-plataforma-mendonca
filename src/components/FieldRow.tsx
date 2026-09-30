import React from 'react';

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const FieldRow: React.FC<FieldRowProps> = ({
  label,
  children,
  icon,
  onClick,
  className = '',
}) => {
  return (
    <div 
      onClick={onClick}
      className={`group flex items-center justify-between p-2.5 -mx-2 rounded-xl hover:bg-[var(--surface)] transition-all cursor-pointer ${className}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--texto-suave)] shrink-0 w-28 sm:w-32">
        {icon && <span className="text-[var(--texto-muted)]">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-end text-xs font-semibold text-[var(--texto)] text-right">
        {children}
      </div>
    </div>
  );
};
