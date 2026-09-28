import React, { useState, useEffect } from 'react';
import { Play, Pause, Maximize2, X, Sparkles, ExternalLink } from 'lucide-react';
import { Task, Category } from '../types';
import { formatSecondsToDigital } from '../utils/dateUtils';
import { APP_NAME } from '../constants/app';

interface FloatingMiniTimerProps {
  activeTask: Task | null;
  activeTimerRunning: boolean;
  activeTimerElapsed: number;
  category?: Category;
  onToggleTimer: () => void;
  onOpenFullscreenFocus: () => void;
}

export const FloatingMiniTimer: React.FC<FloatingMiniTimerProps> = ({
  activeTask,
  activeTimerRunning,
  activeTimerElapsed,
  category,
  onToggleTimer,
  onOpenFullscreenFocus,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      setPipSupported(true);
    }
  }, []);

  const openDocumentPiP = async () => {
    if (typeof window === 'undefined' || !('documentPictureInPicture' in window)) return;
    try {
      const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: 320,
        height: 180,
      });

      // Copy styles
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
          const style = document.createElement('style');
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
        } catch (e) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type;
          link.media = styleSheet.media.toString();
          link.href = (styleSheet as any).href;
          pipWindow.document.head.appendChild(link);
        }
      });

      // Simple HTML inside PiP
      pipWindow.document.body.innerHTML = `
        <div style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0E1117; color: #FFFFFF; padding: 16px; text-align: center;">
          <div style="font-size: 11px; font-weight: 800; color: #38BDF8; text-transform: uppercase;">${category?.name || 'Foco'}</div>
          <div style="font-size: 14px; font-weight: 700; margin: 4px 0 12px 0; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${activeTask?.title || APP_NAME}</div>
          <div id="pipTime" style="font-size: 36px; font-weight: 900; font-family: monospace; letter-spacing: -1px; color: #60A5FA;">${formatSecondsToDigital(activeTimerElapsed)}</div>
        </div>
      `;
    } catch (err) {
      console.warn('PiP window failed to open:', err);
    }
  };

  if (!activeTask) return null;
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-slate-900 text-white shadow-2xl border border-slate-700 flex items-center gap-2 animate-bounce cursor-pointer"
        title="Restaurar Mini Cronômetro"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="text-xs font-bold tabular-nums">{formatSecondsToDigital(activeTimerElapsed)}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 hidden sm:flex items-center gap-3 p-3.5 pr-4 rounded-2xl bg-slate-900/95 text-white shadow-2xl border border-slate-800 backdrop-blur-md animate-modal">
      
      {/* Category indicator & title */}
      <div className="flex items-center gap-2.5 min-w-0 max-w-[180px]">
        <div 
          className="w-3 h-3 rounded-full shrink-0" 
          style={{ backgroundColor: category?.color || '#3B6CF5' }} 
        />
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-400 uppercase truncate">
            {category?.name || 'Foco'}
          </div>
          <div className="text-xs font-extrabold text-white truncate">
            {activeTask.title}
          </div>
        </div>
      </div>

      {/* Digital Elapsed Time */}
      <div className="text-base font-black text-sky-400 tabular-nums px-2 border-l border-slate-800">
        {formatSecondsToDigital(activeTimerElapsed)}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleTimer}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title={activeTimerRunning ? 'Pausar' : 'Retomar'}
        >
          {activeTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        {pipSupported && (
          <button
            onClick={openDocumentPiP}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Mini Janela Flutuante (Picture-in-Picture)"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onOpenFullscreenFocus}
          className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Tela Cheia"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsMinimized(true)}
          className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Minimizar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
