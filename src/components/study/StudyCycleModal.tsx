import React, { useState } from 'react';
import { X, Play, Plus, Trash2, RotateCw, CheckCircle2, BookOpen } from 'lucide-react';
import { StudyCycleConfig, StudyCycleItem, Category } from '../../types';
import { generateUUID } from '../../services/repository';

interface StudyCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycle: StudyCycleConfig;
  categories: Category[];
  onSaveCycle: (cycle: StudyCycleConfig) => void;
  onStartCycleBlock: (item: StudyCycleItem) => void;
}

export const StudyCycleModal: React.FC<StudyCycleModalProps> = ({
  isOpen,
  onClose,
  cycle,
  categories,
  onSaveCycle,
  onStartCycleBlock,
}) => {
  const [items, setItems] = useState<StudyCycleItem[]>(cycle.items || []);
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || 'cat-estudo');
  const [blockName, setBlockName] = useState('');
  const [weight, setWeight] = useState(3);
  const [targetMinutes, setTargetMinutes] = useState(50);

  if (!isOpen) return null;

  const currentItem = items[cycle.currentIndex % (items.length || 1)] || items[0];

  const handleAddItem = () => {
    const cat = categories.find(c => c.id === selectedCatId) || categories[0];
    const newItem: StudyCycleItem = {
      id: generateUUID(),
      categoryId: cat.id,
      categoryName: blockName.trim() || cat.name,
      weight,
      targetMinutes,
      completedMinutes: 0,
      order: items.length,
    };
    const nextList = [...items, newItem];
    setItems(nextList);
    onSaveCycle({ ...cycle, items: nextList });
    setBlockName('');
  };

  const handleRemoveItem = (id: string) => {
    const nextList = items.filter(i => i.id !== id);
    setItems(nextList);
    onSaveCycle({ ...cycle, items: nextList });
  };

  const handleAdvance = () => {
    const nextIdx = (cycle.currentIndex + 1) % (items.length || 1);
    onSaveCycle({ ...cycle, currentIndex: nextIdx });
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
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--texto)]">Ciclo de Estudos Inteligente</h2>
              <p className="text-xs text-[var(--texto-suave)]">Alterne entre disciplinas equilibrando pesos e tempo</p>
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Current Recommended Block Banner */}
          {currentItem ? (
            <div className="p-5 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-soft)]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
                  Próximo Bloco do Rodízio
                </span>
                <h3 className="text-lg font-bold text-[var(--texto)] mt-0.5">
                  {currentItem.categoryName}
                </h3>
                <div className="flex items-center gap-3 text-xs text-[var(--texto-suave)] mt-1 tabular-nums">
                  <span>Meta: <strong>{currentItem.targetMinutes} min</strong></span>
                  <span>·</span>
                  <span>Peso: <strong>{currentItem.weight}x</strong></span>
                  <span>·</span>
                  <span>Progresso: <strong>{currentItem.completedMinutes} min concluídos</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAdvance}
                  title="Pular para próximo bloco"
                  className="h-10 px-3 rounded-xl border border-[var(--borda)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] text-xs font-semibold text-[var(--texto-suave)] cursor-pointer"
                >
                  Pular
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartCycleBlock(currentItem);
                    onClose();
                  }}
                  className="h-10 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer active:scale-98"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Iniciar Bloco</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-[var(--texto-muted)]">
              Nenhum bloco cadastrado no ciclo. Adicione abaixo para iniciar o rodízio.
            </div>
          )}

          {/* List of Blocks in Cycle */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--texto-suave)] mb-3">
              Sequência do Rodízio ({items.length} blocos)
            </h4>
            <div className="space-y-2">
              {items.map((item, idx) => {
                const isCurrent = idx === cycle.currentIndex % (items.length || 1);
                return (
                  <div 
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'border-[var(--primary)] bg-[var(--surface)] shadow-xs'
                        : 'border-[var(--borda)] bg-[var(--surface-secondary)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
                        isCurrent ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface)] text-[var(--texto-muted)] border border-[var(--borda)]'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[var(--texto)]">{item.categoryName}</div>
                        <div className="text-[11px] text-[var(--texto-muted)] tabular-nums">
                          {item.targetMinutes} min · Peso {item.weight}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-[var(--texto-muted)] hover:text-rose-500 cursor-pointer p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Block Form */}
          <div className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)]/30 space-y-3">
            <h4 className="text-xs font-bold text-[var(--texto)]">Adicionar novo bloco ao ciclo</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="Ex: Teoria & Resumos"
                className="h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
              />
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--texto-suave)] whitespace-nowrap">Peso:</span>
                <select
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="flex-1 h-10 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
                >
                  <option value={1}>1 (Leve)</option>
                  <option value={2}>2 (Moderado)</option>
                  <option value={3}>3 (Padrão)</option>
                  <option value={4}>4 (Alto)</option>
                  <option value={5}>5 (Intenso)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--texto-suave)] whitespace-nowrap">Tempo:</span>
                <input
                  type="number"
                  min="15"
                  step="5"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="flex-1 h-10 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--borda)] hover:border-[var(--primary)] text-xs font-bold text-[var(--texto)] hover:text-[var(--primary)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Bloco ao Rodízio
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--borda)] bg-[var(--surface)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
