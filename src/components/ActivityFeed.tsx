import React, { useState } from 'react';
import { History, MessageSquare, Plus, CheckCircle2, Edit3, Sparkles } from 'lucide-react';
import { ActivityLog } from '../types';

interface ActivityFeedProps {
  activityLog?: ActivityLog[];
  onAddNote: (noteText: string) => void;
  createdAt: string;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'agora';
    if (diffSec < 3600) return `há ${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `há ${Math.floor(diffSec / 3600)}h`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return 'recente';
  }
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activityLog = [],
  onAddNote,
  createdAt,
}) => {
  const [newNote, setNewNote] = useState('');

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    onAddNote(newNote.trim());
    setNewNote('');
  };

  const logs = activityLog.length > 0
    ? activityLog
    : [{ id: 'init', action: 'Tarefa criada', timestamp: createdAt }];

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--texto-suave)] uppercase tracking-wider">
          Atividade & Histórico
        </span>
      </div>

      {/* User Quick Note Input */}
      <form onSubmit={handleSubmitNote} className="flex items-center gap-2">
        <div className="relative flex-1">
          <MessageSquare className="w-3.5 h-3.5 text-[var(--texto-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escrever uma nota ou atualização sobre o progresso..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-[var(--surface-secondary)]/80 border border-[var(--borda-soft)] hover:border-[var(--borda)] focus:border-[var(--primary)] focus:bg-[var(--surface)] text-xs text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-3 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          Enviar
        </button>
      </form>

      {/* Chronological Activity List */}
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {logs.map((log) => {
          const isCreation = log.action.toLowerCase().includes('criada');
          const isCompletion = log.action.toLowerCase().includes('concluída');
          const isNote = log.action.startsWith('Nota:');

          return (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-[var(--surface-secondary)]/60 border border-[var(--borda-soft)] text-xs flex items-center justify-between gap-3 hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCompletion ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : isNote ? (
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                ) : isCreation ? (
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : (
                  <Edit3 className="w-3.5 h-3.5 text-[var(--texto-muted)] shrink-0" />
                )}
                <span className="font-medium text-[var(--texto)] truncate">
                  {log.action}
                </span>
              </div>
              <span className="text-[10px] text-[var(--texto-muted)] tabular-nums shrink-0 font-medium">
                {formatRelativeTime(log.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
