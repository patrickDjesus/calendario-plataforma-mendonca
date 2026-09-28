import React, { useState } from 'react';
import { X, Plus, Award, BarChart2, Calendar, Clock, Trash2 } from 'lucide-react';
import { SimulatedExam, Category, SimulatedExamSubjectScore } from '../../types';
import { generateUUID } from '../../services/repository';

interface SimulatedExamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: SimulatedExam[];
  categories: Category[];
  onSaveExam: (exam: Omit<SimulatedExam, 'id'> & { id?: string }) => void;
  onDeleteExam: (id: string) => void;
}

export const SimulatedExamsModal: React.FC<SimulatedExamsModalProps> = ({
  isOpen,
  onClose,
  exams,
  categories,
  onSaveExam,
  onDeleteExam,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState(240);
  const [totalQuestions, setTotalQuestions] = useState(90);
  const [totalCorrect, setTotalCorrect] = useState(68);
  const [essayScore, setEssayScore] = useState<number | ''>(840);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const subjectScores: SimulatedExamSubjectScore[] = categories.map(c => ({
      categoryId: c.id,
      subjectName: c.name,
      questionsTotal: Math.round(totalQuestions / categories.length),
      questionsCorrect: Math.round(totalCorrect / categories.length),
    }));

    onSaveExam({
      title: title.trim(),
      date,
      durationMinutes,
      totalQuestions,
      totalCorrect,
      essayScore: typeof essayScore === 'number' ? essayScore : undefined,
      subjectScores,
      notes: notes.trim() || undefined,
    });

    setIsAdding(false);
    setTitle('');
  };

  // Evolution Stats
  const avgAccuracy = exams.length > 0
    ? Math.round((exams.reduce((sum, e) => sum + (e.totalCorrect / e.totalQuestions), 0) / exams.length) * 100)
    : 0;

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
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--texto)]">Simulados & Evolução de Notas</h2>
              <p className="text-xs text-[var(--texto-suave)]">Monitore seu percentual de acertos e tempo de prova</p>
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

        {/* Performance Overview Banner */}
        <div className="p-4 bg-[var(--surface-secondary)]/40 border-b border-[var(--borda)] flex items-center justify-between flex-wrap gap-4 text-xs tabular-nums">
          <div>
            <span className="text-[var(--texto-muted)]">Simulados Realizados:</span>{' '}
            <strong className="text-[var(--texto)]">{exams.length} provas</strong>
          </div>
          <div>
            <span className="text-[var(--texto-muted)]">Média Geral de Acertos:</span>{' '}
            <strong className="text-[var(--primary)]">{avgAccuracy}%</strong>
          </div>
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="h-8 px-3 rounded-lg bg-[var(--primary)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Simulado</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Add Form */}
          {isAdding && (
            <form onSubmit={handleSave} className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface-secondary)]/30 space-y-3 animate-fadeIn">
              <h4 className="text-xs font-bold text-[var(--texto)]">Novo Resultado de Simulado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome do Simulado (ex: Simulado 03 ENEM 2026)"
                  className="h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
                  required
                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <span className="block text-[11px] text-[var(--texto-muted)] mb-1">Total Questões</span>
                  <input
                    type="number"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--texto-muted)] mb-1">Total Acertos</span>
                  <input
                    type="number"
                    value={totalCorrect}
                    onChange={(e) => setTotalCorrect(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--texto-muted)] mb-1">Duração (min)</span>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-[var(--texto-muted)] mb-1">Redação (opcional)</span>
                  <input
                    type="number"
                    value={essayScore}
                    onChange={(e) => setEssayScore(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Nota redação"
                    className="w-full h-9 px-2 rounded-lg bg-[var(--surface)] border border-[var(--borda)] text-xs text-[var(--texto)] tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="h-9 px-3 rounded-lg border border-[var(--borda)] text-xs text-[var(--texto-suave)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-bold cursor-pointer"
                >
                  Salvar Simulado
                </button>
              </div>
            </form>
          )}

          {/* List of Exams with Visual Evolution Bars */}
          <div className="space-y-3">
            {exams.map(exam => {
              const accuracy = Math.round((exam.totalCorrect / exam.totalQuestions) * 100);
              return (
                <div key={exam.id} className="p-4 rounded-xl border border-[var(--borda)] bg-[var(--surface)] shadow-xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--texto)]">{exam.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-[var(--texto-muted)] tabular-nums mt-0.5">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {exam.date}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {exam.durationMinutes} min</span>
                        {exam.essayScore && <span className="font-bold text-[var(--primary)]">Redação: {exam.essayScore} pts</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-base font-extrabold text-[var(--primary)] tabular-nums">{accuracy}%</div>
                        <div className="text-[11px] text-[var(--texto-muted)] tabular-nums">
                          {exam.totalCorrect} de {exam.totalQuestions} acertos
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteExam(exam.id)}
                        className="text-[var(--texto-muted)] hover:text-rose-500 cursor-pointer p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-[var(--surface-secondary)] h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        accuracy >= 80 ? 'bg-emerald-500' : accuracy >= 65 ? 'bg-[var(--primary)]' : 'bg-amber-500'
                      }`}
                      style={{ width: `${accuracy}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {exams.length === 0 && !isAdding && (
              <div className="text-center py-10 text-xs text-[var(--texto-muted)]">
                Nenhum simulado cadastrado ainda. Registre seu primeiro para acompanhar o gráfico de evolução!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
