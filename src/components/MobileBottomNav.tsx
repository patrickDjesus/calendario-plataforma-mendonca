import React from 'react';
import { Plus } from 'lucide-react';
import { GifIcon, GifName } from './GifIcon';

interface MobileBottomNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenQuickCapture: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickCapture,
}) => {
  const items: Array<{ id: string; label: string; gif: GifName }> = [
    { id: 'hoje', label: 'Início', gif: 'inicio' },
    { id: 'tarefas', label: 'Tarefas', gif: 'tarefas' },
    { id: 'semana', label: 'Semana', gif: 'semana' },
    { id: 'jornada', label: 'Jornada', gif: 'jornada' },
    { id: 'estudos', label: 'Estudos', gif: 'revisao-espacada' },
  ];

  return (
    <>
      {/* Floating Action Button (+) 56px for Quick Capture (Bloco B2) */}
      <button
        type="button"
        onClick={onOpenQuickCapture}
        aria-label="Captura Rápida de Tarefa"
        className="fixed right-5 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden z-40 w-14 h-14 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white shadow-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Fixed Bottom Bar */}
      <nav
        aria-label="Navegação Inferior Mobile"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--borda)] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      >
        <div className="flex items-center justify-around h-16 px-1">
          {items.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer ${
                  isActive ? 'text-[var(--primary)]' : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                }`}
              >
                <div className="relative">
                  <GifIcon name={item.gif} className="w-6 h-6" playOnHover eager={isActive} />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
