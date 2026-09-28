import React, { useState } from 'react';
import { X, Plus, RotateCw, Check, Sparkles, Brain, Layers, Trash2 } from 'lucide-react';
import { Flashcard, Category } from '../../types';
import { generateUUID } from '../../services/repository';

interface FlashcardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashcards: Flashcard[];
  categories: Category[];
  onReviewCard: (cardId: string, quality: number) => void;
  onSaveCard: (card: Omit<Flashcard, 'id'> & { id?: string }) => void;
  onDeleteCard: (cardId: string) => void;
}

export const FlashcardsModal: React.FC<FlashcardsModalProps> = ({
  isOpen,
  onClose,
  flashcards,
  categories,
  onReviewCard,
  onSaveCard,
  onDeleteCard,
}) => {
  const [tab, setTab] = useState<'study' | 'manage'>('study');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // New card fields
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [topicName, setTopicName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || 'cat-estudo');

  if (!isOpen) return null;

  const today = new Date().toISOString().split('T')[0];
  const dueCards = flashcards.filter(f => !f.dueDate || f.dueDate <= today);
  const activeDeck = dueCards.length > 0 ? dueCards : flashcards;
  const currentCard = activeDeck[currentIndex % (activeDeck.length || 1)];

  const handleGrade = (quality: number) => {
    if (!currentCard) return;
    onReviewCard(currentCard.id, quality);
    setIsFlipped(false);
    setCurrentIndex(prev => prev + 1);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    onSaveCard({
      categoryId: selectedCatId,
      topicName: topicName.trim() || undefined,
      front: front.trim(),
      back: back.trim(),
      intervalDays: 1,
      repetitions: 0,
      easeFactor: 2.5,
      dueDate: today,
    });

    setFront('');
    setBack('');
    setTopicName('');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--borda)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[var(--texto)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--borda)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--texto)]">Flashcards & Repetição Espaçada SM-2</h2>
              <p className="text-xs text-[var(--texto-suave)]">Algoritmo SuperMemo de retenção máxima de longo prazo</p>
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

        {/* Tabs */}
        <div className="flex border-b border-[var(--borda)] px-6 bg-[var(--surface-secondary)]/30">
          <button
            type="button"
            onClick={() => setTab('study')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'study'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--texto-suave)] hover:text-[var(--texto)]'
            }`}
          >
            Sessão de Revisão ({dueCards.length} para hoje)
          </button>
          <button
            type="button"
            onClick={() => setTab('manage')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              tab === 'manage'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--texto-suave)] hover:text-[var(--texto)]'
            }`}
          >
            Gerenciar Cards ({flashcards.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'study' ? (
            currentCard ? (
              <div className="flex flex-col items-center max-w-lg mx-auto space-y-5">
                {/* Topic Pill & Progress */}
                <div className="flex items-center justify-between w-full text-xs text-[var(--texto-suave)] tabular-nums">
                  <span className="font-bold text-[var(--primary)]">
                    {currentCard.topicName || 'Geral'}
                  </span>
                  <span>
                    Card {(currentIndex % activeDeck.length) + 1} de {activeDeck.length}
                  </span>
                </div>

                {/* Flip Card Container */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full min-h-[220px] p-6 rounded-2xl border border-[var(--borda)] bg-[var(--surface)] hover:border-[var(--primary)] transition-all cursor-pointer shadow-md flex flex-col justify-between text-center relative group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--texto-muted)] mb-2">
                    {isFlipped ? 'VERSO (Resposta)' : 'FRENTE (Pergunta)'} · Clique para virar
                  </span>

                  <div className="text-base sm:text-lg font-bold text-[var(--texto)] my-auto px-2">
                    {isFlipped ? currentCard.back : currentCard.front}
                  </div>

                  <div className="text-[11px] text-[var(--texto-muted)] flex items-center justify-center gap-1 mt-2">
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{isFlipped ? 'Voltar para a pergunta' : 'Revelar resposta'}</span>
                  </div>
                </div>

                {/* SM-2 Rating Controls (Shown after flip) */}
                {isFlipped ? (
                  <div className="w-full space-y-2 animate-fadeIn">
                    <span className="block text-center text-xs font-semibold text-[var(--texto-suave)]">
                      Como foi a sua lembrança?
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGrade(1)}
                        className="py-2.5 px-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        <div>Errei</div>
                        <div className="text-[9px] font-normal opacity-80">(1 dia)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGrade(3)}
                        className="py-2.5 px-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        <div>Difícil</div>
                        <div className="text-[9px] font-normal opacity-80">(curto)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGrade(4)}
                        className="py-2.5 px-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        <div>Bom</div>
                        <div className="text-[9px] font-normal opacity-80">(médio)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGrade(5)}
                        className="py-2.5 px-1 rounded-xl bg-[var(--primary-soft)] hover:bg-[var(--primary)] hover:text-white text-[var(--primary)] border border-[var(--primary)] text-xs font-bold transition-all cursor-pointer"
                      >
                        <div>Fácil</div>
                        <div className="text-[9px] font-normal opacity-80">(ótimo)</div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsFlipped(true)}
                    className="h-11 px-6 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    Mostrar Resposta
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12 space-y-3">
                <Check className="w-10 h-10 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-[var(--texto)]">Todos os cards foram revisados!</h3>
                <p className="text-xs text-[var(--texto-suave)] max-w-sm mx-auto">
                  Você concluiu sua rodada de repetição espaçada SM-2. Os próximos cards reaparecerão nas datas calculadas.
                </p>
              </div>
            )
          ) : (
            /* Manage / Add Cards */
            <div className="space-y-6">
              {/* Form */}
              <form onSubmit={handleAddCard} className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)]/30 space-y-3">
                <h4 className="text-xs font-bold text-[var(--texto)]">Adicionar novo Flashcard</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    placeholder="Assunto / Tópico (ex: Funções)"
                    className="h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
                  />
                  <select
                    value={selectedCatId}
                    onChange={(e) => setSelectedCatId(e.target.value)}
                    className="h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  placeholder="Frente (Pergunta ou Conceito)..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] resize-none"
                  required
                />
                <textarea
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder="Verso (Resposta ou Explicação detalhada)..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] resize-none"
                  required
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Criar Flashcard
                </button>
              </form>

              {/* Deck List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--texto-suave)]">
                  Cards Existentes ({flashcards.length})
                </h4>
                {flashcards.map(c => (
                  <div key={c.id} className="p-3 rounded-xl border border-[var(--borda)] bg-[var(--surface)] flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-[var(--texto)]">{c.front}</div>
                      <div className="text-[var(--texto-suave)]">{c.back}</div>
                      <div className="text-[10px] text-[var(--texto-muted)] tabular-nums">
                        Repetições: {c.repetitions} · Intervalo: {c.intervalDays}d · Próxima: {c.dueDate}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteCard(c.id)}
                      className="text-[var(--texto-muted)] hover:text-rose-500 cursor-pointer p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
