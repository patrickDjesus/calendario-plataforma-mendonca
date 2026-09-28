import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APP_NAME } from '../constants/app';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'sidebar' | 'banner' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    if (variant === 'sidebar') {
      return (
        <button
          onClick={install}
          className="w-full py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 bg-[var(--primary-soft)] hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white transition-all cursor-pointer group"
          title={`Instalar ${APP_NAME} no Computador / Celular`}
        >
          <Download className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="text-xs font-bold leading-tight">Instalar App</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
        title={`Instalar ${APP_NAME} como Aplicativo`}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-[var(--texto)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] text-xs font-bold transition-all cursor-pointer"
          title="Instalar no iPhone / iPad"
        >
          <Share className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-modal">
            <div className="w-full max-w-sm rounded-[24px] bg-[var(--surface)] p-6 shadow-2xl border border-[var(--borda)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-extrabold text-[var(--texto)]">Instalar no iPhone / iPad</h3>
                <button 
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-[var(--texto-suave)] hover:text-[var(--texto)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[var(--texto-suave)] space-y-2">
                1. Toque no botão de <strong>Compartilhar</strong> (<Share className="w-4 h-4 inline" />) na barra do Safari.<br />
                2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.<br />
                3. Pronto! Acesse offline com visual de aplicativo nativo.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold cursor-pointer hover:bg-[var(--primary-hover)]"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
