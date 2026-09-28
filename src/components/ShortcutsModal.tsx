import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Espaço', desc: 'Pausar ou retomar o cronômetro ativo em qualquer tela' },
    { key: 'N', desc: 'Abrir formulário de nova tarefa' },
    { key: 'Ctrl + K / ⌘K', desc: 'Abrir paleta de comandos inteligentes e busca' },
    { key: 'F', desc: 'Entrar / sair do Modo Foco imersivo em tela cheia' },
    { key: 'T', desc: 'Ir rapidamente para o dia de Hoje' },
    { key: '←  /  →', desc: 'Navegar semanas na visão da agenda' },
    { key: '?', desc: 'Abrir este guia de atalhos' },
    { key: 'Esc', desc: 'Fechar modais, gavetas ou sair do modo foco' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-lg rounded-[28px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl p-6 sm:p-7 text-[var(--texto)] animate-modal">
        
        <div className="flex items-center justify-between pb-4 border-b border-[var(--borda)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--texto)]">
                Atalhos do Teclado
              </h2>
              <p className="text-xs text-[var(--texto-suave)] font-medium">
                Produtividade ultrarrápida sem tirar as mãos do teclado
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--borda)] flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)]"
            >
              <span className="text-xs font-semibold text-[var(--texto)] pr-3">
                {sc.desc}
              </span>
              <kbd className="px-2.5 py-1 rounded-xl bg-[var(--surface)] text-[var(--primary)] text-xs font-mono font-black border border-[var(--borda)] shadow-sm shrink-0">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
