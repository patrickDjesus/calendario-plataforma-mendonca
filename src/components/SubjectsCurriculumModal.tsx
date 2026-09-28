import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  BookOpen, 
  Plus, 
  Trash2, 
  Sparkles, 
  Upload, 
  CheckCircle2, 
  GraduationCap,
  Layers,
  Calculator,
  Atom,
  HelpCircle
} from 'lucide-react';
import { Category, SubjectStructure, Module, Topic, TopicStatus } from '../types';
import { generateUUID } from '../services/repository';
import { CategoryIcon } from './CategoryIcon';

interface SubjectsCurriculumModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  subjectStructures: SubjectStructure[];
  onSaveStructure: (structure: SubjectStructure) => void;
  onCreateTaskFromTopic: (category: Category, module: Module, topic: Topic) => void;
}

export const SubjectsCurriculumModal: React.FC<SubjectsCurriculumModalProps> = ({
  isOpen,
  onClose,
  categories,
  subjectStructures,
  onSaveStructure,
  onCreateTaskFromTopic,
}) => {
  // Only display non-legacy categories (Matemática and Física are clausured inside Estudo)
  const activeCategories = useMemo(() => {
    return categories.filter(c => c.id !== 'cat-matematica' && c.id !== 'cat-fisica');
  }, [categories]);

  const defaultCategory = useMemo(() => {
    return activeCategories.find(c => c.id === 'cat-estudo') || activeCategories[0] || categories[0];
  }, [activeCategories, categories]);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCategory?.id || 'cat-estudo');
  const [newModuleName, setNewModuleName] = useState('');
  const [addingTopicModuleId, setAddingTopicModuleId] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<'all' | 'matematica' | 'fisica' | 'metodologia' | 'outros'>('all');

  useEffect(() => {
    if (defaultCategory && !activeCategories.some(c => c.id === selectedCategoryId)) {
      setSelectedCategoryId(defaultCategory.id);
    }
  }, [activeCategories, defaultCategory, selectedCategoryId]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentCategory = activeCategories.find(c => c.id === selectedCategoryId) || defaultCategory;
  const currentStructure = subjectStructures.find(s => s.categoryId === selectedCategoryId) || {
    categoryId: selectedCategoryId,
    modules: [],
  };

  // Helper to categorize module by discipline
  const getModuleDiscipline = (moduleName: string): 'matematica' | 'fisica' | 'metodologia' | 'outros' => {
    const lower = moduleName.toLowerCase();
    if (lower.includes('matemática') || lower.includes('algebra') || lower.includes('funç') || lower.includes('geometria') || lower.includes('cálculo') || lower.includes('trigonometria')) {
      return 'matematica';
    }
    if (lower.includes('física') || lower.includes('ciência') || lower.includes('mecânica') || lower.includes('termologia') || lower.includes('óptica') || lower.includes('ondulatória')) {
      return 'fisica';
    }
    if (lower.includes('metodologia') || lower.includes('técnica') || lower.includes('estudo') || lower.includes('anki') || lower.includes('revisão')) {
      return 'metodologia';
    }
    return 'outros';
  };

  // Discipline counts for quick filtering inside "Estudo"
  const disciplineCounts = {
    all: currentStructure.modules.length,
    matematica: currentStructure.modules.filter(m => getModuleDiscipline(m.name) === 'matematica').length,
    fisica: currentStructure.modules.filter(m => getModuleDiscipline(m.name) === 'fisica').length,
    metodologia: currentStructure.modules.filter(m => getModuleDiscipline(m.name) === 'metodologia').length,
    outros: currentStructure.modules.filter(m => getModuleDiscipline(m.name) === 'outros').length,
  };

  const displayedModules = currentStructure.modules.filter(m => {
    if (disciplineFilter === 'all') return true;
    return getModuleDiscipline(m.name) === disciplineFilter;
  });

  // Calculate mastery progress
  const allTopics = currentStructure.modules.flatMap(m => m.topics);
  const masteredTopics = allTopics.filter(t => t.status === 'dominado');
  const studyingTopics = allTopics.filter(t => t.status === 'estudando' || t.status === 'revisando');
  const masteryPercent = allTopics.length > 0 ? Math.round((masteredTopics.length / allTopics.length) * 100) : 0;

  // Add new module
  const handleAddModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim()) return;
    const newModule: Module = {
      id: generateUUID(),
      name: newModuleName.trim(),
      topics: [],
    };
    const updated: SubjectStructure = {
      ...currentStructure,
      modules: [...currentStructure.modules, newModule],
    };
    onSaveStructure(updated);
    setNewModuleName('');
  };

  // Add new topic
  const handleAddTopic = (moduleId: string) => {
    if (!newTopicName.trim()) return;
    const newTopic: Topic = {
      id: generateUUID(),
      name: newTopicName.trim(),
      status: 'nao_iniciado',
      sources: [],
      questionsDone: 0,
      questionsCorrect: 0,
    };
    const updatedModules = currentStructure.modules.map(m => {
      if (m.id === moduleId) {
        return { ...m, topics: [...m.topics, newTopic] };
      }
      return m;
    });
    onSaveStructure({ ...currentStructure, modules: updatedModules });
    setNewTopicName('');
    setAddingTopicModuleId(null);
  };

  // Change topic status
  const handleStatusChange = (moduleId: string, topicId: string, status: TopicStatus) => {
    const updatedModules = currentStructure.modules.map(m => {
      if (m.id === moduleId) {
        const updatedTopics = m.topics.map(t => {
          if (t.id === topicId) {
            const isStudied = status === 'estudando' || status === 'dominado';
            return {
              ...t,
              status,
              lastReviewedAt: isStudied ? new Date().toISOString().slice(0, 10) : t.lastReviewedAt,
            };
          }
          return t;
        });
        return { ...m, topics: updatedTopics };
      }
      return m;
    });
    onSaveStructure({ ...currentStructure, modules: updatedModules });
  };

  // Remove module
  const handleRemoveModule = (moduleId: string) => {
    if (!window.confirm('Excluir este módulo e todos os seus tópicos?')) return;
    const updatedModules = currentStructure.modules.filter(m => m.id !== moduleId);
    onSaveStructure({ ...currentStructure, modules: updatedModules });
  };

  // Remove topic
  const handleRemoveTopic = (moduleId: string, topicId: string) => {
    const updatedModules = currentStructure.modules.map(m => {
      if (m.id === moduleId) {
        return { ...m, topics: m.topics.filter(t => t.id !== topicId) };
      }
      return m;
    });
    onSaveStructure({ ...currentStructure, modules: updatedModules });
  };

  // Parse & Import text
  const handleImportText = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const newModules: Module[] = [];
    let currentModule: Module = {
      id: generateUUID(),
      name: 'Módulo de Estudos',
      topics: [],
    };

    lines.forEach(line => {
      if (line.startsWith('#') || line.toUpperCase().startsWith('MÓDULO') || line.toUpperCase().startsWith('MODULO')) {
        if (currentModule.topics.length > 0) {
          newModules.push(currentModule);
        }
        currentModule = {
          id: generateUUID(),
          name: line.replace(/^[#\-\*]\s*/, ''),
          topics: [],
        };
      } else {
        const topicName = line.replace(/^[•\-\*0-9\.]+\s*/, '');
        if (topicName) {
          currentModule.topics.push({
            id: generateUUID(),
            name: topicName,
            status: 'nao_iniciado',
            sources: [],
            questionsDone: 0,
            questionsCorrect: 0,
          });
        }
      }
    });

    if (currentModule.topics.length > 0) {
      newModules.push(currentModule);
    }

    onSaveStructure({
      ...currentStructure,
      modules: [...currentStructure.modules, ...newModules],
    });

    setImportText('');
    setIsImportModalOpen(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="curriculum-modal-title"
        className="w-full max-w-4xl lg:max-w-5xl bg-[var(--surface)] text-[var(--texto)] rounded-[28px] border border-[var(--borda)] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-modal"
      >
        {/* Header - Improved size & prominence */}
        <div className="px-6 sm:px-8 py-5 border-b border-[var(--borda)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)] flex items-center justify-center shadow-xs">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="curriculum-modal-title" className="text-xl sm:text-2xl font-black text-[var(--texto)] tracking-tight">
                  Grade Curricular & Conteúdos de Estudo
                </h2>
                <span className="hidden sm:inline-flex text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)]">
                  Estudo Clausurado
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--texto-suave)] mt-0.5">
                Matemática, Física, Ciências e Métodos unificados sob a categoria Estudo com hierarquia clara
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--borda)] text-xs sm:text-sm font-semibold text-[var(--texto)] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[var(--primary)]" />
              <span className="hidden sm:inline">Importar Lista</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Selector Tabs (Unified - Matemática and Física are now inside Estudo) */}
        <div className="px-6 sm:px-8 py-3 border-b border-[var(--borda)] bg-[var(--surface-secondary)]/50 flex items-center gap-2 overflow-x-auto shrink-0">
          {activeCategories.map(cat => (
            <button
              type="button"
              key={cat.id}
              onClick={() => {
                setSelectedCategoryId(cat.id);
                setDisciplineFilter('all');
              }}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                selectedCategoryId === cat.id
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)] shadow-xs ring-1 ring-[var(--primary)]/30'
                  : 'border-[var(--borda)] bg-[var(--surface)] text-[var(--texto-suave)] hover:text-[var(--texto)]'
              }`}
            >
              <CategoryIcon category={cat} size="sm" className="!w-5 !h-5 !rounded-lg" />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* Mastery Progress Card - Generous and clear */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[var(--primary)]" />
                <span className="text-base sm:text-lg font-bold text-[var(--texto)]">
                  Domínio da Matéria: {currentCategory.name}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-[var(--texto-suave)] flex items-center gap-3">
                <span><strong>{masteredTopics.length}</strong> dominados</span>
                <span>•</span>
                <span><strong>{studyingTopics.length}</strong> em estudo/revisão</span>
                <span>•</span>
                <span>Total de <strong>{allTopics.length}</strong> tópicos</span>
              </div>
            </div>

            <div className="flex items-center gap-4 min-w-[240px]">
              <div className="flex-1 h-3.5 bg-[var(--track-gray)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--primary)] transition-all duration-300 rounded-full"
                  style={{ width: `${masteryPercent}%` }}
                />
              </div>
              <span className="text-base sm:text-lg font-black text-[var(--primary-text-on-soft)] tabular-nums">
                {masteryPercent}%
              </span>
            </div>
          </div>

          {/* If Estudo is selected: Internal Discipline Filter (Matemática, Física & Ciências, Metodologias) */}
          {selectedCategoryId === 'cat-estudo' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--texto-suave)] uppercase tracking-wider">
                  Filtro por Disciplina Clausurada
                </span>
                <span className="text-xs text-[var(--texto-muted)]">
                  {displayedModules.length} {displayedModules.length === 1 ? 'módulo exibido' : 'módulos exibidos'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDisciplineFilter('all')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                    disciplineFilter === 'all'
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                      : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] border-[var(--borda)]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Todos os Módulos ({disciplineCounts.all})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDisciplineFilter('matematica')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                    disciplineFilter === 'matematica'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                      : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-purple-600 border-[var(--borda)]'
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                  <span>Matemática ({disciplineCounts.matematica})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDisciplineFilter('fisica')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                    disciplineFilter === 'fisica'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                      : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-cyan-600 border-[var(--borda)]'
                  }`}
                >
                  <Atom className="w-4 h-4" />
                  <span>Física / Ciências ({disciplineCounts.fisica})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDisciplineFilter('metodologia')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                    disciplineFilter === 'metodologia'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-blue-600 border-[var(--borda)]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Metodologias ({disciplineCounts.metodologia})</span>
                </button>

                {disciplineCounts.outros > 0 && (
                  <button
                    type="button"
                    onClick={() => setDisciplineFilter('outros')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                      disciplineFilter === 'outros'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                        : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] hover:text-[var(--texto)] border-[var(--borda)]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>Outros ({disciplineCounts.outros})</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Add Module Input - Larger touch target */}
          <form onSubmit={handleAddModule} className="flex items-center gap-3">
            <input
              type="text"
              value={newModuleName}
              onChange={(e) => setNewModuleName(e.target.value)}
              placeholder="Criar novo módulo (ex: Matemática: Geometria Espacial, Física: Eletromagnetismo)..."
              className="flex-1 h-12 px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-sm text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--texto-muted)] transition-all"
            />
            <button
              type="submit"
              className="h-12 px-5 rounded-xl bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-hover)] flex items-center gap-2 transition-all cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Módulo</span>
            </button>
          </form>

          {/* Modules and Topics List */}
          <div className="space-y-5">
            {displayedModules.map(mod => {
              const disc = getModuleDiscipline(mod.name);
              const modMastered = mod.topics.filter(t => t.status === 'dominado').length;
              const modPercent = mod.topics.length > 0 ? Math.round((modMastered / mod.topics.length) * 100) : 0;

              return (
                <div 
                  key={mod.id} 
                  className="rounded-2xl bg-[var(--surface-secondary)]/50 border border-[var(--borda)] overflow-hidden space-y-3 p-5 sm:p-6 transition-all hover:border-[var(--borda)]/80"
                >
                  {/* Module Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--borda)] gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Discipline Badge */}
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider ${
                        disc === 'matematica'
                          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                          : disc === 'fisica'
                          ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                          : disc === 'metodologia'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                          : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30'
                      }`}>
                        {disc === 'matematica' ? 'Matemática' : disc === 'fisica' ? 'Física / Ciências' : disc === 'metodologia' ? 'Método' : 'Geral'}
                      </span>

                      <h3 className="text-base sm:text-lg font-bold text-[var(--texto)]">
                        {mod.name}
                      </h3>

                      <span className="text-xs font-semibold text-[var(--texto-muted)] tabular-nums">
                        ({mod.topics.length} {mod.topics.length === 1 ? 'tópico' : 'tópicos'} • {modPercent}% dominado)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setAddingTopicModuleId(mod.id)}
                        className="h-8 px-3 rounded-lg bg-[var(--primary-soft)] text-[var(--primary-text-on-soft)] hover:bg-[var(--primary)] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> 
                        <span>Adicionar Tópico</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveModule(mod.id)}
                        aria-label="Excluir módulo"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--texto-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline Topic Input */}
                  {addingTopicModuleId === mod.id && (
                    <div className="flex items-center gap-2 pt-1 pb-3">
                      <input
                        type="text"
                        autoFocus
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTopic(mod.id);
                          } else if (e.key === 'Escape') {
                            setAddingTopicModuleId(null);
                          }
                        }}
                        placeholder="Nome do novo tópico (ex: Função Quadrática e Vértice da Parábola)..."
                        className="flex-1 h-11 px-4 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-sm text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--texto-muted)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTopic(mod.id)}
                        className="h-11 px-4 rounded-xl bg-[var(--primary)] text-white text-xs sm:text-sm font-bold hover:bg-[var(--primary-hover)] cursor-pointer shadow-xs"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingTopicModuleId(null)}
                        className="h-11 px-3 text-xs sm:text-sm text-[var(--texto-suave)] hover:text-[var(--texto)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Topics in Module - Larger card size & comfortable touch */}
                  <div className="space-y-2 pt-1">
                    {mod.topics.map(topic => (
                      <div 
                        key={topic.id}
                        className="p-3.5 sm:p-4 rounded-xl bg-[var(--surface)] border border-[var(--borda)] flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm hover:border-[var(--primary)]/50 transition-all shadow-2xs"
                      >
                        {/* Left: Name + Sources */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-[var(--texto)] text-sm sm:text-base">
                              {topic.name}
                            </span>
                          </div>

                          {/* Sources & Metrics */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--texto-suave)]">
                            {topic.sources && topic.sources.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-[var(--surface-secondary)] text-[var(--texto-muted)]">
                                📖 {topic.sources.join(', ')}
                              </span>
                            )}
                            {topic.questionsDone > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  🎯 {topic.questionsCorrect}/{topic.questionsDone} acertos ({Math.round((topic.questionsCorrect / topic.questionsDone) * 100)}%)
                                </span>
                                {(() => {
                                  const acc = Math.round((topic.questionsCorrect / topic.questionsDone) * 100);
                                  if (acc < 60) {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                        💡 Ação: 1 bloco de teoria + 20 questões
                                      </span>
                                    );
                                  } else if (acc < 80) {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        💡 Ação: +15 exercícios de fixação
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                        💡 Ação: Agendar revisão em 7 dias
                                      </span>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                            {topic.lastReviewedAt && (
                              <span className="text-[11px] text-[var(--texto-muted)]">
                                Revisto em: {topic.lastReviewedAt}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right controls: Status selector, Create Task button, Delete */}
                        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                          <select
                            value={topic.status}
                            onChange={(e) => handleStatusChange(mod.id, topic.id, e.target.value as TopicStatus)}
                            className={`h-9 sm:h-10 px-3 rounded-xl text-xs sm:text-sm font-bold border focus:outline-none cursor-pointer transition-colors ${
                              topic.status === 'dominado'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : topic.status === 'revisando'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : topic.status === 'estudando'
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                : 'bg-[var(--surface-secondary)] text-[var(--texto-suave)] border-[var(--borda)]'
                            }`}
                          >
                            <option value="nao_iniciado">Não iniciado</option>
                            <option value="estudando">Estudando</option>
                            <option value="revisando">Revisando</option>
                            <option value="dominado">Dominado</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              onCreateTaskFromTopic(currentCategory, mod, topic);
                              onClose();
                            }}
                            className="h-9 sm:h-10 px-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Criar Tarefa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(mod.id, topic.id)}
                            aria-label="Excluir tópico"
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-[var(--texto-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {mod.topics.length === 0 && (
                      <div className="text-center py-4 text-xs sm:text-sm text-[var(--texto-muted)] bg-[var(--surface)]/50 rounded-xl border border-dashed border-[var(--borda)]">
                        Nenhum tópico cadastrado neste módulo. Clique em <strong>"+ Adicionar Tópico"</strong> acima.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {displayedModules.length === 0 && (
              <div className="p-10 text-center rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-3">
                <BookOpen className="w-10 h-10 text-[var(--texto-muted)] mx-auto" />
                <div className="text-base font-bold text-[var(--texto)]">
                  Nenhum módulo encontrado no filtro atual
                </div>
                <p className="text-xs sm:text-sm text-[var(--texto-suave)] max-w-md mx-auto">
                  Crie novos módulos usando a barra acima ou clique em <strong>Importar Lista</strong> para colar sua grade de edital.
                </p>
                {disciplineFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setDisciplineFilter('all')}
                    className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold cursor-pointer"
                  >
                    Ver Todos os Módulos
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Import Sub-Modal */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-lg bg-[var(--surface)] p-6 sm:p-7 rounded-[24px] border border-[var(--borda)] shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--texto)]">Importar Lista de Tópicos</h3>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs sm:text-sm text-[var(--texto-suave)]">
                Cole sua lista de tópicos abaixo (uma linha por tópico). Use linhas com `# Módulo` para separar assuntos:
              </p>

              <textarea
                rows={7}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="# Matemática: Funções&#10;• Função Afim e Linear&#10;• Função Quadrática&#10;# Física: Mecânica&#10;• Cinemática Escalar MRU e MRUV&#10;• Leis de Newton"
                className="w-full p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--borda)] text-xs sm:text-sm text-[var(--texto)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] font-mono"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[var(--texto-suave)] hover:text-[var(--texto)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImportText}
                  className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs sm:text-sm font-bold hover:bg-[var(--primary-hover)] cursor-pointer shadow-xs"
                >
                  Importar Tópicos
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
