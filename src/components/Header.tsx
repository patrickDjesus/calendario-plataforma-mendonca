import React, { useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  Search, 
  HelpCircle, 
  ChevronDown,
  Cloud,
  CloudOff,
  Loader,
} from 'lucide-react';

import { Task, Category, UserProfile } from '../types';
import { formatSecondsToDigital } from '../utils/dateUtils';
import { CategoryIcon } from './CategoryIcon';
import { GifIcon, GifName, ProfileAvatar } from './GifIcon';
import { PWAInstallButton } from './PWAInstallButton';
import { APP_NAME } from '../constants/app';
import { cloudSync, SyncStatus } from '../services/supabase';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  onToggleActiveTimer: () => void;
  onStopActiveTimer: () => void;
  onOpenFullscreenFocus: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
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
  onOpenCommandPalette,
  onOpenShortcuts,
  onOpenSettings,
  onOpenProfile,
  profile,
  categories,
}) => {
  const [isTimerExpanded, setIsTimerExpanded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloudSync.getStatus());

  useEffect(() => cloudSync.onChange(setSyncStatus), []);

  const syncMeta: Record<SyncStatus, { icon: typeof Cloud; cls: string; label: string }> = {
    synced: { icon: Cloud, cls: 'text-emerald-500', label: 'Nuvem sincronizada' },
    syncing: { icon: Loader, cls: 'text-[var(--primary)] animate-spin', label: 'Sincronizando...' },
    offline: { icon: CloudOff, cls: 'text-slate-400', label: 'Offline — usando dados locais' },
    error: { icon: Cloud, cls: 'text-rose-500', label: 'Erro na sincronização' },
  };
  const SyncIcon = syncMeta[syncStatus].icon;

  const activeCategory = activeTask
    ? categories.find(c => c.id === activeTask.categoryId) || categories[0]
    : null;

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
            className="flex items-center gap-2.5 cursor-pointer focus:outline-none group"
            aria-label={`${APP_NAME} — ir para o início`}
          >
            <span
              className="font-extrabold text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-[var(--primary)] via-indigo-500 to-violet-500 bg-clip-text text-transparent bg-gradient-to-r bg-[length:200%_100%] transition-[background-position] duration-700 group-hover:bg-[position:100%_0] [text-shadow:none]"
            >
              {APP_NAME}
            </span>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Navegação Principal">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer relative ${
                    isActive
                      ? 'text-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  <GifIcon name={item.gif} className="w-6 h-6" playOnHover eager />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-[3px] bg-[var(--primary)] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: PWA Install, Active Timer, Search, Shortcuts, Settings, Avatar */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* In-App PWA Install */}
          <PWAInstallButton variant="header" />

          {/* Active Timer Dark Pill */}
          {activeTask && (
            <div className="relative">
              <div 
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 text-white shadow-md border border-slate-800 cursor-pointer ${
                  activeTimerRunning ? 'animate-pulse-glow ring-2 ring-[var(--primary)]/40' : ''
                }`}
                onClick={() => setIsTimerExpanded(!isTimerExpanded)}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${activeTimerRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-sm font-bold tabular-nums">
                  {formatSecondsToDigital(activeTimerElapsed)}
                </span>
                <span className="max-w-[120px] truncate text-xs text-slate-300 hidden sm:inline font-medium">
                  {activeTask.title}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleActiveTimer();
                  }}
                  className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer ml-0.5"
                  title={activeTimerRunning ? 'Pausar (Espaço)' : 'Retomar (Espaço)'}
                >
                  {activeTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                </button>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isTimerExpanded ? 'rotate-180' : ''}`} />
              </div>

              {/* Timer Dropdown Menu */}
              {isTimerExpanded && (
                <div className="absolute right-0 mt-2 w-72 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--borda)] shadow-xl z-50 animate-modal">
                  <div className="flex items-center gap-2.5 mb-2">
                    {activeCategory && <CategoryIcon category={activeCategory} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold uppercase text-[var(--primary)]">{activeCategory?.name}</span>
                      <h4 className="text-sm font-bold text-[var(--texto)] truncate">{activeTask.title}</h4>
                    </div>
                  </div>

                  <div className="text-center py-2 bg-[var(--surface-secondary)] rounded-xl my-2">
                    <span className="text-2xl font-extrabold text-[var(--texto)] tabular-nums">
                      {formatSecondsToDigital(activeTimerElapsed)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      onClick={onToggleActiveTimer}
                      className="py-1.5 px-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold cursor-pointer"
                    >
                      {activeTimerRunning ? 'Pausar' : 'Focar'}
                    </button>
                    <button
                      onClick={onOpenFullscreenFocus}
                      className="py-1.5 px-2 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold cursor-pointer"
                    >
                      Tela Cheia
                    </button>
                    <button
                      onClick={onStopActiveTimer}
                      className="py-1.5 px-2 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold cursor-pointer"
                    >
                      Zerar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Icon Button */}
          <button
            onClick={onOpenCommandPalette}
            className="w-10 h-10 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] flex items-center justify-center transition-colors cursor-pointer"
            title="Buscar ou comando (Ctrl+K)"
            aria-label="Buscar"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Shortcuts Help Button */}
          <button
            onClick={onOpenShortcuts}
            className="w-10 h-10 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] flex items-center justify-center transition-colors cursor-pointer"
            title="Atalhos do teclado (?)"
            aria-label="Atalhos"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] flex items-center justify-center transition-colors cursor-pointer"
            title="Configurações"
            aria-label="Ajustes"
          >
            <GifIcon name="configuracao" className="w-6 h-6" playOnHover eager />
          </button>

          {/* Cloud Sync Status */}
          <div
            className={`w-10 h-10 rounded-xl hover:bg-[var(--surface-secondary)] flex items-center justify-center transition-colors cursor-default ${syncMeta[syncStatus].cls}`}
            title={syncMeta[syncStatus].label}
            role="status"
            aria-label={syncMeta[syncStatus].label}
          >
            <SyncIcon className="w-4 h-4" />
          </div>

          {/* Avatar: ilustracao solta, sem fundo, borda ou sombra */}
          <button
            onClick={onOpenProfile}
            className="w-11 h-11 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shrink-0 ml-1"
            title={`Perfil de ${profile.name}`}
            aria-label="Perfil"
          >
            <ProfileAvatar value="avatar-homem" className="w-full h-full" playOnHover eager />
          </button>

        </div>

      </div>
    </header>
  );
};
