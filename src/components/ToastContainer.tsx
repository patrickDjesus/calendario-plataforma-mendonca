import React, { useEffect, useState } from 'react';
import { RotateCcw, X, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning';
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const duration = toast.durationMs || 5000;
  const [progress, setProgress] = useState(100);

  // Use a ref for onDismiss to prevent resetting the interval when onDismiss changes
  const onDismissRef = React.useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismissRef.current();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div className="pointer-events-auto rounded-2xl bg-slate-900 text-white p-3.5 shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-fadeIn">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold truncate">{toast.text}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {toast.onAction && (
            <button
              onClick={() => {
                toast.onAction!();
                onDismiss();
              }}
              className="px-2.5 py-1 rounded-lg bg-[var(--primary)] text-white text-[11px] font-extrabold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{toast.actionLabel || 'Desfazer'}</span>
            </button>
          )}

          <button
            onClick={onDismiss}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Countdown Progress Bar */}
      <div className="w-full h-1 bg-slate-800 rounded-full mt-2.5 overflow-hidden">
        <div
          className="h-full bg-[var(--primary)] transition-all ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
