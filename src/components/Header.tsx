import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { Task, Category } from '../types';
import { GifIcon, GifName } from './GifIcon';
import { PWAInstallButton } from './PWAInstallButton';
import { APP_NAME } from '../constants/app';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  onToggleActiveTimer: () => void;
  onStopActiveTimer: () => void;
  onOpenFullscreenFocus: () => void;
  categories: Category[];
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  onToggleActiveTimer,
  onStopActiveTimer,
  onOpenFullscreenFocus,
  categories,
}) => {
  const reduceMotion = useReducedMotion();

  const navItems: Array<{
    id: string;
    label: string;
    gif: GifName;
  }> = [
    { id: 'hoje', label: 'Início', gif: 'inicio' },
    { id: 'tarefas', label: 'Tarefas', gif: 'tarefas' },
    { id: 'semana', label: 'Semana', gif: 'semana' },
    { id: 'jornada', label: 'Jornada', gif: 'jornada' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full h-[72px] bg-[var(--surface)] border-b border-[var(--borda)]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        
        {/* Left: Brand & Single-row Navigation */}
        <div className="flex items-center gap-6 lg:gap-8">
          <button 
            onClick={() => onSelectTab('hoje')} 
            className="flex items-center gap-2.5 cursor-pointer focus:outline-none group hover:opacity-90 transition-opacity shrink-0"
            aria-label="Plataforma Mendonça — ir para o início"
          >
            <img 
              src="/brand/mendonca-horizontal-claro.svg" 
              alt="Plataforma Mendonça" 
              className="h-9 sm:h-10 w-auto object-contain" 
            />
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Navegação Principal">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer relative ${
                    isActive
                      ? 'text-[var(--primary)]'
                      : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="header-nav-active"
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-xl bg-[var(--primary-soft)]"
                    >
                      <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-[var(--primary)] rounded-full" />
                    </motion.span>
                  )}
                  <GifIcon name={item.gif} className="w-6 h-6 relative" playOnHover eager />
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: PWA Install */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* In-App PWA Install */}
          <PWAInstallButton variant="header" />
        </div>

      </div>
    </header>
  );
};
