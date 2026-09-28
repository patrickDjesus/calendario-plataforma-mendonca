import React from 'react';
import { 
  Maximize2, 
  Layers, 
  Repeat, 
  Trash2, 
  Moon
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { GifIcon, GifName } from './GifIcon';

interface SidebarProps {
  onQuickNewTask: () => void;
  onOpenFocusMode: () => void;
  onOpenCloseDay: () => void;
  onOpenTemplates: () => void;
  onOpenSpacedRep: () => void;
  onOpenSettings: (section?: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onQuickNewTask,
  onOpenFocusMode,
  onOpenCloseDay,
  onOpenTemplates,
  onOpenSpacedRep,
  onOpenSettings,
}) => {
  const toolItems: Array<{
    id: string;
    label1: string;
    label2: string;
    icon?: React.ComponentType<{ className?: string }>;
    gif: GifName;
    isPrimary?: boolean;
    action: () => void;
  }> = [
    {
      id: 'nova',
      label1: 'Nova',
      label2: 'tarefa',
      gif: 'nova-tarefa',
      isPrimary: true,
      action: onQuickNewTask,
    },
    {
      id: 'foco',
      label1: 'Modo',
      label2: 'Foco',
      gif: 'modo-foco',
      action: onOpenFocusMode,
    },
    {
      id: 'fechar-dia',
      label1: 'Fechar',
      label2: 'o dia',
      gif: 'finalizar-dia',
      action: onOpenCloseDay,
    },
    {
      id: 'modelos',
      label1: 'Modelos',
      label2: 'de rotina',
      gif: 'modelos-rotina',
      action: onOpenTemplates,
    },
    {
      id: 'revisoes',
      label1: 'Revisões',
      label2: 'espaçadas',
      gif: 'revisao-espacada',
      action: onOpenSpacedRep,
    },
    {
      id: 'lixeira',
      label1: 'Lixeira',
      label2: '30 dias',
      gif: 'lixeira',
      action: () => onOpenSettings('lixeira'),
    },
    {
      id: 'ajustes',
      label1: 'Ajustes',
      label2: 'e backup',
      gif: 'configuracao',
      action: () => onOpenSettings('geral'),
    },
  ];

  const renderToolIcon = (item: (typeof toolItems)[number], className: string) => {
    if (item.gif) {
      return <GifIcon name={item.gif} className={className} playOnHover eager />;
    }
    const Fallback = item.icon;
    return Fallback ? <Fallback className={className} /> : null;
  };

  return (
    <>
      {/* Desktop Quick Tools Column (96px) */}
      <aside className="hidden lg:flex flex-col items-center w-24 shrink-0 rounded-[24px] bg-[var(--sidebar)] p-2.5 text-white shadow-xl sticky top-24 self-start space-y-1.5">
        {toolItems.map((item) => {
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`w-full py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group ${
                item.isPrimary
                  ? 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-md shadow-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-[var(--sidebar-surface)]'
              }`}
              title={`${item.label1} ${item.label2}`}
            >
              {renderToolIcon(item, 'w-6 h-6 transition-transform group-hover:scale-110')}
              <div className="text-xs font-bold leading-tight text-center">
                <div>{item.label1}</div>
                <div className="opacity-80 font-medium">{item.label2}</div>
              </div>
            </button>
          );
        })}

        <div className="w-full pt-1">
          <PWAInstallButton variant="sidebar" />
        </div>
      </aside>

      {/* Mobile Bottom Bar for Tools */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-[var(--borda)] px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-inset">
        {toolItems.slice(0, 5).map((item) => {
          return (
            <button
              key={item.id}
              onClick={item.action}
              className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
                item.isPrimary ? 'text-[var(--primary)] font-bold' : 'text-[var(--texto-suave)]'
              }`}
            >
              {renderToolIcon(item, 'w-6 h-6 mb-0.5')}
              <span className="text-xs leading-tight">{item.label1}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
