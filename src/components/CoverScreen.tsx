import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface CoverScreenProps {
  onDismiss: () => void;
}

/** A animacao da logo dura ~5s (desenho, deslize, capa cai e impacto). */
const DISPLAY_MS = 5000;
const FADE_MS = 400;
const LOGO_SRC = '/brand/mendonca-horizontal-claro-animado-v2.svg';

/**
 * Abertura do site: a logo animada aparece, roda a propria animacao por 5s e
 * depois o overlay some sozinho. Clicar (ou apertar Esc) encurta a espera.
 */
export const CoverScreen: React.FC<CoverScreenProps> = ({ onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);
  // Prazo ancorado no primeiro render: o StrictMode remonta os efeitos e um
  // `setTimeout` puro faria a abertura durar duas vezes.
  const deadlineRef = useRef<number>(Date.now() + DISPLAY_MS);

  const handleDismiss = useCallback(() => {
    setIsExiting((exiting) => {
      if (exiting) return exiting;
      exitTimerRef.current = window.setTimeout(() => {
        onDismiss();
      }, FADE_MS);
      return true;
    });
  }, [onDismiss]);

  useEffect(() => {
    const remaining = Math.max(0, deadlineRef.current - Date.now());
    const timer = window.setTimeout(handleDismiss, remaining);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleDismiss]);

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          onClick={handleDismiss}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_MS / 1000, ease: 'easeInOut' }}
          className="CoverScreen fixed inset-0 z-[100] bg-[#F3F5F9] flex items-center justify-center p-6 cursor-pointer select-none overflow-hidden"
        >
          <img
            src={LOGO_SRC}
            alt="Plataforma Mendonça"
            draggable={false}
            className="w-[min(82vw,560px)] h-auto drop-shadow-xl"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
