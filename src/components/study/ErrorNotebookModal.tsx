import React, { useState } from 'react';
import { X, Plus, Trash2, AlertTriangle, BookOpen, CheckCircle, Sparkles } from 'lucide-react';
import { ErrorLogEntry, ErrorReason, Category } from '../../types';
import { generateUUID } from '../../services/repository';

interface ErrorNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorLogs: ErrorLogEntry[];
  categories: Category[];
  onSaveErrorLog: (entry: Omit<ErrorLogEntry, 'id'> & { id?: string }) => void;
  onDeleteErrorLog: (id: string) => void;
  onCreateReviewTask: (entry: ErrorLogEntry) => void;
}

export const ErrorNotebookModal: React.FC<ErrorNotebookModalProps> = ({
  isOpen,
  onClose,
  errorLogs,
  categories,
  onSaveErrorLog,
  onDeleteErrorLog,
  onCreateReviewTask,
}) => {
  const [topicName, setTopicName] = useState('');
  const [questionDescription, setQuestionDescription] = useState('');
  const [correctExplanation, setCorrectExplanation] = useState('');
  const [reason, setReason] = useState<ErrorReason>('atencao');
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || 'cat-estudo');
  const [filterReason, setFilterReason] = useState<'all' | ErrorReason>('all');

  if (!isOpen) return null;

  // Diagnostic pattern counts
  const total = errorLogs.length;
  const atencaoCount = errorLogs.filter(e => e.reason === 'atencao').length;
  const naoSabiaCount = errorLogs.filter(e => e.reason === 'nao_sabia').length;
  const confundiCount = errorLogs.filter(e => e.reason === 'confundi').length;

  const atencaoPct = total > 0 ? Math.round((atencaoCount / total) * 100) : 0;
  const naoSabiaPct = total > 0 ? Math.round((naoSabiaCount / total) * 100) : 0;
  const confundiPct = total > 0 ? Math.round((confundiCount / total) * 100) : 0;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim() || !questionDescription.trim()) return;

    onSaveErrorLog({
      categoryId: selectedCatId,
      topicName: topicName.trim(),
      reason,
      questionDescription: questionDescription.trim(),
      correctExplanation: correctExplanation.trim() || undefined,
      date: new Date().toISOString().split('T')[0],
      reviewed: false,
    });

    setTopicName('');
    setQuestionDescription('');
    setCorrectExplanation('');
  };

  const filteredLogs = errorLogs.filter(e => filterReason === 'all' || e.reason === filterReason);

  const reasonLabels: Record<ErrorReason, { label: string; color: string }> = {
    atencao: { label: 'Falta de Atenção', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
    nao_sabia: { label: 'Lacuna Teórica', color: 'bg-rose-500/10 text-rose-700 border-rose-500/30' },
    confundi: { label: 'Confusão Conceitual', color: 'bg-purple-500/10 text-purple-700 border-purple-500/30' },
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[var(--texto)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--borda)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--texto)]">Caderno de Erros Estratégico</h2>
              <p className="text-xs text-[var(--texto-suave)]">Diagnostique a causa dos seus erros e agende revisões ativas</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Banner */}
        <div className="p-4 bg-[var(--surface-secondary)]/50 border-b border-[var(--borda)] flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
          <div className="font-semibold text-[var(--texto)]">
            Total registrado: <strong>{total} erros</strong>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Atenção: <strong>{atencaoPct}%</strong> ({atencaoCount})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Teoria: <strong>{naoSabiaPct}%</strong> ({naoSabiaCount})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Confusão: <strong>{confundiPct}%</strong> ({confundiCount})</span>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* New Error Form */}
          <form onSubmit={handleAdd} className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)]/30 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--texto-suave)]">
              Registrar Nova Questão Incorreta
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--texto-suave)] mb-1">Tópico ou Assunto</label>
                <input
                  type="text"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="Ex: Circuitos Elétricos - Associação Mista"
                  className="w-full h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--texto-suave)] mb-1">Qual foi o Motivo do Erro?</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ErrorReason)}
                  className="w-full h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
                >
                  <option value="atencao">⚠️ Falta de Atenção (leitura rápida, erro de conta)</option>
                  <option value="nao_sabia">❌ Lacuna Teórica (não sabia a fórmula ou teoria)</option>
                  <option value="confundi">🔄 Confusão Conceitual (trocou conceitos semelhantes)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--texto-suave)] mb-1">Descrição do Enunciado ou Erro</label>
              <textarea
                value={questionDescription}
                onChange={(e) => setQuestionDescription(e.target.value)}
                placeholder="Ex: Questão 14 da lista ENEM 2024: errei o sentido da corrente e calculei resistência equivalente errada..."
                rows={2}
                className="w-full p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--texto-suave)] mb-1">Resolução Correta / Aprendizado Chave</label>
              <textarea
                value={correctExplanation}
                onChange={(e) => setCorrectExplanation(e.target.value)}
                placeholder="Ex: Lembrar que em paralelo a ddp é igual para todos os ramos: 1/Req = 1/R1 + 1/R2..."
                rows={2}
                className="w-full p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] resize-none"
              />
            </div>

            <button
              type="submit"
              className="h-10 px-5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-98"
            >
              <Plus className="w-4 h-4" /> Salvar no Caderno de Erros
            </button>
          </form>

          {/* Filter Pills */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--texto-suave)]">
              Histórico de Erros ({filteredLogs.length})
            </h4>
            <div className="flex gap-1.5 text-xs">
              {(['all', 'atencao', 'nao_sabia', 'confundi'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterReason(f)}
                  className={`px-2.5 py-1 rounded-lg font-semibold border transition-all cursor-pointer ${
                    filterReason === f
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--borda)] bg-[var(--surface)] text-[var(--texto-suave)] hover:text-[var(--texto)]'
                  }`}
                >
                  {f === 'all' ? 'Todos' : reasonLabels[f].label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {filteredLogs.map(item => (
              <div 
                key={item.id} 
                className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface)] shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${reasonLabels[item.reason].color}`}>
                      {reasonLabels[item.reason].label}
                    </span>
                    <h5 className="text-xs font-bold text-[var(--texto)]">{item.topicName}</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--texto-muted)] tabular-nums">{item.date}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteErrorLog(item.id)}
                      className="text-[var(--texto-muted)] hover:text-rose-500 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[var(--texto)]">{item.questionDescription}</p>

                {item.correctExplanation && (
                  <div className="p-2.5 rounded-lg bg-[var(--surface-secondary)] text-[11px] text-[var(--texto-suave)] border border-[var(--borda)]">
                    <span className="font-bold text-[var(--texto)]">Como acertar: </span>
                    {item.correctExplanation}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onCreateReviewTask(item);
                      onClose();
                    }}
                    className="h-8 px-3 rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Criar Revisão Deste Erro</span>
                  </button>
                </div>
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-xs text-[var(--texto-muted)]">
                Nenhum erro registrado neste filtro. Excelente desempenho!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
