import React, { useState } from 'react';
import { 
  X, 
  Settings as SettingsIcon, 
  Tag, 
  Sliders, 
  Download, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Plus, 
  Sparkles, 
  Bell, 
  Volume2, 
  Calendar, 
  KeyRound,
} from 'lucide-react';
import { Category, UserSettings, UserProfile, Task } from '../types';
import { generateUUID } from '../services/repository';
import { getSyncKey } from '../services/syncKey';
import { CategoryIcon } from './CategoryIcon';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  categories: Category[];
  profile: UserProfile;
  trash: Array<Task & { originalDeletedAt: string }>;
  onUpdateSettings: (settings: UserSettings) => void;
  onSaveCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => void;
  onExportICS: () => void;
  onResetDemo: () => void;
  onRestoreTrashTask: (id: string) => void;
  onEmptyTrash: () => void;
  /** Leva de volta para a tela de chave (trocar ou reconectar). */
  onTrocarChave: () => void;
  onDesconectar: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  categories,
  profile,
  trash,
  onUpdateSettings,
  onSaveCategory,
  onDeleteCategory,
  onExportJSON,
  onImportJSON,
  onExportICS,
  onResetDemo,
  onRestoreTrashTask,
  onEmptyTrash,
  onTrocarChave,
  onDesconectar,
}) => {
  const [mostrarChave, setMostrarChave] = useState(false);
  const [activeSection, setActiveSection] = useState<'geral' | 'materias' | 'pomodoro' | 'backup' | 'lixeira'>('geral');
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B6CF5');
  const [newCatIcon, setNewCatIcon] = useState('book');

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

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onSaveCategory({
      id: 'cat-' + generateUUID(),
      name: newCatName.trim(),
      color: newCatColor,
      icon: newCatIcon,
      isCustom: true,
    });
    setNewCatName('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportJSON(content);
      }
    };
    reader.readAsText(file);
  };

  const colors = [
    '#3B6CF5', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#84CC16'
  ];

  const icons = ['book', 'calculator', 'atom', 'briefcase', 'user', 'heart-pulse', 'code', 'graduation-cap', 'palette', 'music', 'globe'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-3xl rounded-[32px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl p-6 sm:p-8 text-[var(--texto)] my-8 animate-modal flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--borda)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--primary)]">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[var(--texto)]">
                Ajustes & Configurações
              </h2>
              <p className="text-xs text-[var(--texto-suave)] font-medium">
                Personalização, matérias, cronômetro e backup
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

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-secondary)] rounded-2xl my-4 shrink-0 overflow-x-auto">
          {[
            { id: 'geral', label: 'Geral & Preferências' },
            { id: 'materias', label: 'Matérias & Categorias' },
            { id: 'pomodoro', label: 'Pomodoro & Sons' },
            { id: 'backup', label: 'Backup & Exportação' },
            { id: 'lixeira', label: `Lixeira (${trash.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-[var(--surface)] text-[var(--primary)] shadow-sm'
                  : 'text-[var(--texto-suave)] hover:text-[var(--texto)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-6">
          
          {/* SECTION: GERAL */}
          {activeSection === 'geral' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Gamification toggle */}
              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[var(--texto)]">Sistema de XP e Níveis</div>
                  <div className="text-xs text-[var(--texto-suave)]">Ganhe pontos por minutos de foco e conclusão de tarefas</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.gamificationEnabled}
                  onChange={(e) => onUpdateSettings({ ...settings, gamificationEnabled: e.target.checked })}
                  className="w-5 h-5 rounded accent-[var(--primary)] cursor-pointer"
                />
              </div>

              {/* First day of week */}
              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[var(--texto)]">Primeiro Dia da Semana</div>
                  <div className="text-xs text-[var(--texto-suave)]">Define a primeira coluna da visão semanal</div>
                </div>
                <select
                  value={settings.firstDayOfWeek}
                  onChange={(e) => onUpdateSettings({ ...settings, firstDayOfWeek: parseInt(e.target.value, 10) as 0 | 1 })}
                  className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)]"
                >
                  <option value={1}>Segunda-feira</option>
                  <option value={0}>Domingo</option>
                </select>
              </div>

              {/* Automatic Rollover */}
              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[var(--texto)]">Aviso de Rolagem de Pendentes</div>
                  <div className="text-xs text-[var(--texto-suave)]">Exibe card para reorganizar tarefas não concluídas do dia anterior</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoRollover}
                  onChange={(e) => onUpdateSettings({ ...settings, autoRollover: e.target.checked })}
                  className="w-5 h-5 rounded accent-[var(--primary)] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* SECTION: MATERIAS & CATEGORIAS */}
          {activeSection === 'materias' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Create new category form */}
              <form onSubmit={handleCreateCategory} className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-4">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--texto-suave)] block">
                  Criar Nova Matéria / Categoria
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nome da matéria (ex: Biologia)"
                    className="sm:col-span-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar</span>
                  </button>
                </div>

                {/* Color and Icon pickers */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div>
                    <span className="text-xs font-bold text-[var(--texto-suave)] block mb-1.5">Cor:</span>
                    <div className="flex items-center gap-1.5">
                      {colors.map((c) => (
                        <button
                          type="button"
                          key={c}
                          onClick={() => setNewCatColor(c)}
                          className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                            newCatColor === c ? 'scale-125 ring-2 ring-slate-400 ring-offset-2' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-[var(--texto-suave)] block mb-1.5">Ícone:</span>
                    <div className="flex items-center gap-1.5">
                      {icons.slice(0, 6).map((ic) => (
                        <button
                          type="button"
                          key={ic}
                          onClick={() => setNewCatIcon(ic)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            newCatIcon === ic ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface)] text-[var(--texto-suave)]'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </form>

              {/* List of existing categories */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-[var(--texto-suave)] block">
                  Matérias Ativas ({categories.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      data-gif-host
                      className="p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <CategoryIcon category={cat} size="sm" />
                        <span className="text-xs font-bold text-[var(--texto)]">{cat.name}</span>
                      </div>
                      {cat.isCustom && (
                        <button
                          onClick={() => onDeleteCategory(cat.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          title="Excluir matéria"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION: POMODORO & SONS */}
          {activeSection === 'pomodoro' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-3">
                <div className="text-sm font-extrabold text-[var(--texto)]">Tempos do Pomodoro</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--texto-suave)] block mb-1">Foco (min)</label>
                    <input
                      type="number"
                      value={settings.pomodoro.focusMinutes}
                      onChange={(e) => onUpdateSettings({
                        ...settings,
                        pomodoro: { ...settings.pomodoro, focusMinutes: parseInt(e.target.value, 10) || 25 }
                      })}
                      className="w-full p-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--texto-suave)] block mb-1">Pausa Curta (min)</label>
                    <input
                      type="number"
                      value={settings.pomodoro.shortBreakMinutes}
                      onChange={(e) => onUpdateSettings({
                        ...settings,
                        pomodoro: { ...settings.pomodoro, shortBreakMinutes: parseInt(e.target.value, 10) || 5 }
                      })}
                      className="w-full p-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--texto-suave)] block mb-1">Pausa Longa (min)</label>
                    <input
                      type="number"
                      value={settings.pomodoro.longBreakMinutes}
                      onChange={(e) => onUpdateSettings({
                        ...settings,
                        pomodoro: { ...settings.pomodoro, longBreakMinutes: parseInt(e.target.value, 10) || 15 }
                      })}
                      className="w-full p-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)]"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-bold text-[var(--texto-suave)] block mb-1">
                    A cada quantos blocos de foco vem a pausa longa
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={settings.pomodoro.longBreakInterval}
                    onChange={(e) => onUpdateSettings({
                      ...settings,
                      pomodoro: { ...settings.pomodoro, longBreakInterval: Math.max(2, parseInt(e.target.value, 10) || 4) }
                    })}
                    className="w-28 p-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)]"
                  />
                  <div className="text-[11px] text-[var(--texto-muted)] mt-1">
                    Entre os blocos de foco roda a pausa curta. A cada {settings.pomodoro.longBreakInterval} blocos
                    completados, a pausa é a longa.
                  </div>
                </div>
              </div>

              {/* Sound and vibration toggles */}
              <div className="p-4 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[var(--texto)]">Aviso Sonoro de Fim de Bloco</div>
                  <div className="text-xs text-[var(--texto-suave)]">Toca um sino harmônico zen sintetizado via Web Audio API</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.pomodoro.soundEnabled}
                  onChange={(e) => onUpdateSettings({
                    ...settings,
                    pomodoro: { ...settings.pomodoro, soundEnabled: e.target.checked }
                  })}
                  className="w-5 h-5 rounded accent-[var(--primary)] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* SECTION: BACKUP & EXPORTACAO */}
          {activeSection === 'backup' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Chave de sincronização: é o que abre o banco no Supabase. */}
              <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-3">
                <div className="flex items-start gap-2">
                  <KeyRound size={16} className="text-[var(--primary)] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-[var(--texto)]">Chave de sincronização</div>
                    <div className="text-xs text-[var(--texto-suave)]">
                      Seus dados ficam no Supabase, não neste navegador. A chave é o
                      que abre o seu banco em qualquer dispositivo.
                    </div>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  <code className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--borda)] text-xs font-mono text-[var(--texto)]">
                    {mostrarChave ? (getSyncKey() ?? '—') : '•'.repeat(12)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setMostrarChave(v => !v)}
                    className="px-3 py-2 rounded-xl border border-[var(--borda)] text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
                  >
                    {mostrarChave ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard?.writeText(getSyncKey() ?? ''); }}
                    className="px-3 py-2 rounded-xl border border-[var(--borda)] text-xs font-bold text-[var(--texto-suave)] hover:text-[var(--texto)] transition-colors cursor-pointer"
                  >
                    Copiar
                  </button>
                </div>

                <p className="text-[11px] text-[var(--texto-suave)] leading-relaxed">
                  Guarde essa chave em um gerenciador de senhas. Ela não tem como ser
                  recuperada pelo app: sem ela, a linha do seu banco fica inacessível.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onTrocarChave}
                    className="px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    Trocar de chave
                  </button>
                  <button
                    type="button"
                    onClick={onDesconectar}
                    className="px-4 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--borda)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)] transition-colors cursor-pointer"
                  >
                    Desconectar neste dispositivo
                  </button>
                </div>
                <p className="text-[11px] text-[var(--texto-suave)]">
                  Desconectar só apaga a chave deste navegador. Nada é apagado no Supabase:
                  basta digitar a mesma chave de novo para voltar ao mesmo banco.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-3">
                <div>
                  <div className="text-sm font-extrabold text-[var(--texto)]">Exportar e Importar Backup (JSON)</div>
                  <div className="text-xs text-[var(--texto-suave)]">Faça o download do seu banco completo ou restaure seus dados em outro navegador.</div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={onExportJSON}
                    className="px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar Backup (.json)</span>
                  </button>

                  <label className="px-4 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--borda)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)] flex items-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-[var(--primary)]" />
                    <span>Restaurar Backup (.json)</span>
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* ICS Export */}
              <div className="p-5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] space-y-3">
                <div>
                  <div className="text-sm font-extrabold text-[var(--texto)]">Sincronização de Calendário (.ICS)</div>
                  <div className="text-xs text-[var(--texto-suave)]">Exporte o cronograma para Google Calendar, Apple Calendar ou Outlook.</div>
                </div>

                <button
                  onClick={onExportICS}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--borda)] border border-[var(--borda)] text-xs font-bold text-[var(--texto)] flex items-center gap-2 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-[var(--primary)]" />
                  <span>Baixar Agenda (.ics)</span>
                </button>
              </div>

              {/* Reset to demo */}
              <div className="p-5 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                <div className="text-sm font-extrabold text-rose-600">Restaurar Dados de Exemplo</div>
                <div className="text-xs text-[var(--texto-suave)]">Limpa alterações locais e recarrega os dados padrão de demonstração.</div>
                <button
                  onClick={onResetDemo}
                  className="mt-2 px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-colors cursor-pointer"
                >
                  Restaurar Exemplo
                </button>
              </div>
            </div>
          )}

          {/* SECTION: LIXEIRA (30 DIAS) */}
          {activeSection === 'lixeira' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[var(--texto)]">Lixeira de Tarefas</div>
                  <div className="text-xs text-[var(--texto-suave)]">Itens excluídos permanecem disponíveis para restauração por 30 dias</div>
                </div>

                {trash.length > 0 && (
                  <button
                    onClick={onEmptyTrash}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-bold hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    Esvaziar Lixeira
                  </button>
                )}
              </div>

              {trash.length === 0 ? (
                <div className="py-12 text-center text-[var(--texto-suave)]">
                  <Trash2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold">A lixeira está vazia.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trash.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--borda)] flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-[var(--texto)] truncate">{item.title}</h4>
                        <span className="text-xs text-[var(--texto-suave)]">
                          Excluída em {new Date(item.originalDeletedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <button
                        onClick={() => onRestoreTrashTask(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
