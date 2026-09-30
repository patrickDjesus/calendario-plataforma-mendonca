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
  Database,
  Check,
  Eye,
  EyeOff,
  Copy,
  Info
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
  onTrocarChave: () => void;
  onDesconectar: () => void;
}

// iOS-Style Toggle Switch Component for premium tactile look & feel
const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-violet-500/10 cursor-pointer shrink-0 ${
        checked ? 'bg-[var(--primary)]' : 'bg-slate-200'
      }`}
    >
      <div className={`bg-white w-5 h-5 rounded-full shadow-md transform duration-300 ease-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
};

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
  const [copiedKey, setCopiedKey] = useState(false);

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

  const handleCopyKey = () => {
    void navigator.clipboard?.writeText(getSyncKey() ?? '');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const colors = [
    '#3B6CF5', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#84CC16'
  ];

  const icons = ['book', 'calculator', 'atom', 'briefcase', 'user', 'heart-pulse', 'code', 'graduation-cap', 'palette', 'music', 'globe'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-4xl h-[700px] max-h-[90vh] rounded-[32px] bg-[var(--surface)] border border-[var(--borda)] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-modal">
        
        {/* SIDEBAR DE AJUSTES */}
        <div className="w-full md:w-[260px] bg-slate-50 border-b md:border-b-0 md:border-r border-[var(--borda)] flex flex-col p-5 sm:p-6 shrink-0 justify-between select-none">
          <div className="space-y-6">
            
            {/* Logo/Título */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-[var(--primary)] shadow-sm">
                <SettingsIcon className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[var(--texto)] tracking-tight">
                  Ajustes
                </h2>
                <p className="text-[11px] text-[var(--texto-suave)] font-semibold uppercase tracking-wider">
                  Mendonça OS
                </p>
              </div>
            </div>

            {/* Abas */}
            <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-3 md:pb-0 scrollbar-none">
              {[
                { id: 'geral', label: 'Geral', icon: Sliders },
                { id: 'materias', label: 'Matérias', icon: Tag },
                { id: 'pomodoro', label: 'Pomodoro', icon: Volume2 },
                { id: 'backup', label: 'Sincronização', icon: KeyRound },
                { id: 'lixeira', label: 'Lixeira', icon: Trash2, badge: trash.length },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id as any)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap md:w-full select-none ${
                      isSelected
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                        : 'text-[var(--texto-suave)] hover:bg-slate-100 hover:text-[var(--texto)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                        isSelected ? 'bg-white text-violet-600' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Versão do Sistema */}
          <div className="hidden md:block pt-4 border-t border-slate-200/60">
            <div className="flex items-center gap-2 text-[11px] text-[var(--texto-suave)] font-bold">
              <Database className="w-3.5 h-3.5 text-violet-500" />
              <span>Plataforma Mendonça v2.4</span>
            </div>
            <span className="text-[10px] text-[var(--texto-muted)] block mt-0.5">Sincronizado com Supabase</span>
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          
          {/* Top Bar / Header de Fechamento */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-[var(--borda)] shrink-0">
            <h3 className="text-sm font-extrabold text-[var(--texto-suave)] uppercase tracking-wider flex items-center gap-2">
              <span>Ajustes</span>
              <span className="text-slate-300">/</span>
              <span className="text-[var(--primary)]">
                {activeSection === 'geral' && 'Preferências Gerais'}
                {activeSection === 'materias' && 'Minhas Matérias & Categorias'}
                {activeSection === 'pomodoro' && 'Sessões do Pomodoro'}
                {activeSection === 'backup' && 'Backup & Sincronização de Dados'}
                {activeSection === 'lixeira' && 'Arquivo de Lixeira'}
              </span>
            </h3>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-[var(--texto-suave)] hover:text-[var(--texto)] transition-all cursor-pointer border border-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Painel do Conteúdo Dinâmico */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            
            {/* CONTENT: GERAL */}
            {activeSection === 'geral' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-l-4 border-violet-500 pl-3">
                  <h4 className="text-base font-extrabold text-[var(--texto)]">Preferências de Estilo & Interface</h4>
                  <p className="text-xs text-[var(--texto-suave)] mt-0.5">Customize o comportamento e as mecânicas diárias da plataforma.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Gamification Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-[var(--borda)] hover:border-violet-500/30 transition-all flex items-center justify-between gap-4 group">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-[var(--texto)]">Gamificação & Sistema de XP</div>
                        <div className="text-xs text-[var(--texto-suave)] mt-0.5">Ganhe pontos por blocos de foco, streaks de estudo e tarefas concluídas. Desligar esconde os elementos de gameficação da interface.</div>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={settings.gamificationEnabled}
                      onChange={(checked) => onUpdateSettings({ ...settings, gamificationEnabled: checked })}
                    />
                  </div>

                  {/* Calendar Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-[var(--borda)] hover:border-violet-500/30 transition-all flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-[var(--texto)]">Início da Semana</div>
                        <div className="text-xs text-[var(--texto-suave)] mt-0.5">Escolha o primeiro dia exibido nas colunas do cronograma semanal.</div>
                      </div>
                    </div>
                    <select
                      value={settings.firstDayOfWeek}
                      onChange={(e) => onUpdateSettings({ ...settings, firstDayOfWeek: parseInt(e.target.value, 10) as 0 | 1 })}
                      className="p-2.5 rounded-xl bg-white border border-[var(--borda)] text-xs font-bold text-[var(--texto)] focus:ring-2 focus:ring-violet-500/20 focus:outline-none cursor-pointer"
                    >
                      <option value={1}>Segunda-feira</option>
                      <option value={0}>Domingo</option>
                    </select>
                  </div>

                  {/* Rollover Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 border border-[var(--borda)] hover:border-violet-500/30 transition-all flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-[var(--texto)]">Transferência de Tarefas Atrasadas (Rollover)</div>
                        <div className="text-xs text-[var(--texto-suave)] mt-0.5">Exibe automaticamente um lembrete para arrastar tarefas não concluídas do ontem para a agenda de hoje.</div>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={settings.autoRollover}
                      onChange={(checked) => onUpdateSettings({ ...settings, autoRollover: checked })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT: MATERIAS */}
            {activeSection === 'materias' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="border-l-4 border-violet-500 pl-3">
                  <h4 className="text-base font-extrabold text-[var(--texto)]">Gerenciar Matérias & Categorias</h4>
                  <p className="text-xs text-[var(--texto-suave)] mt-0.5">Organize as matérias e categorias das suas tarefas com cores e ícones personalizados.</p>
                </div>

                {/* Formulário de Criação */}
                <form onSubmit={handleCreateCategory} className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-[var(--borda)] space-y-5">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                    <Plus className="w-4 h-4 text-violet-500" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--texto-suave)]">
                      Criar Nova Categoria
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      required
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Nome da categoria (ex: Cálculo III)"
                      className="sm:col-span-3 p-3 rounded-xl bg-white border border-[var(--borda)] text-xs font-bold text-[var(--texto)] focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="p-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-md shadow-violet-600/10 hover:shadow-violet-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4.5 h-4.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {/* Pickers de Estética */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                    {/* Cores */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[var(--texto-suave)] block">Escolha uma Cor:</span>
                      <div className="flex flex-wrap gap-2">
                        {colors.map((c) => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => setNewCatColor(c)}
                            className={`w-7 h-7 rounded-full transition-all duration-200 cursor-pointer border border-white hover:scale-110 flex items-center justify-center ${
                              newCatColor === c ? 'scale-115 ring-2 ring-violet-500 ring-offset-2' : ''
                            }`}
                            style={{ backgroundColor: c }}
                          >
                            {newCatColor === c && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ícones */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[var(--texto-suave)] block">Selecione um Ícone:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {icons.map((ic) => (
                          <button
                            type="button"
                            key={ic}
                            onClick={() => setNewCatIcon(ic)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all capitalize cursor-pointer border ${
                              newCatIcon === ic 
                                ? 'bg-violet-600 text-white border-violet-600' 
                                : 'bg-white text-[var(--texto-suave)] border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </form>

                {/* Listagem */}
                <div className="space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--texto-suave)] block">
                    Suas Matérias Cadastradas ({categories.length})
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-[var(--borda)] flex items-center justify-between hover:border-violet-500/20 hover:bg-slate-50/50 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryIcon category={cat} size="sm" />
                          <span className="text-xs font-extrabold text-[var(--texto)]">{cat.name}</span>
                        </div>
                        {cat.isCustom ? (
                          <button
                            onClick={() => onDeleteCategory(cat.id)}
                            className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50/20 transition-all cursor-pointer"
                            title="Remover matéria"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--texto-muted)] bg-slate-200/50 px-2 py-0.5 rounded-md">
                            Padrão
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CONTENT: POMODORO */}
            {activeSection === 'pomodoro' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-l-4 border-violet-500 pl-3">
                  <h4 className="text-base font-extrabold text-[var(--texto)]">Temporizador do Pomodoro</h4>
                  <p className="text-xs text-[var(--texto-suave)] mt-0.5">Customize as fases de estudo profundo e relaxamento.</p>
                </div>

                <div className="p-6 rounded-2xl bg-slate-50 border border-[var(--borda)] space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    
                    {/* Foco */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-[var(--texto)] block">Foco Produtivo</label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={settings.pomodoro.focusMinutes}
                          onChange={(e) => onUpdateSettings({
                            ...settings,
                            pomodoro: { ...settings.pomodoro, focusMinutes: parseInt(e.target.value, 10) || 25 }
                          })}
                          className="w-full p-3 pr-12 rounded-xl bg-white border border-[var(--borda)] text-xs font-bold text-[var(--texto)] focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                        />
                        <span className="absolute right-3 text-[10px] font-black uppercase text-[var(--texto-suave)]">Min</span>
                      </div>
                    </div>

                    {/* Pausa Curta */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-[var(--texto)] block">Pausa Curta</label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={settings.pomodoro.shortBreakMinutes}
                          onChange={(e) => onUpdateSettings({
                            ...settings,
                            pomodoro: { ...settings.pomodoro, shortBreakMinutes: parseInt(e.target.value, 10) || 5 }
                          })}
                          className="w-full p-3 pr-12 rounded-xl bg-white border border-[var(--borda)] text-xs font-bold text-[var(--texto)] focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                        />
                        <span className="absolute right-3 text-[10px] font-black uppercase text-[var(--texto-suave)]">Min</span>
                      </div>
                    </div>

                    {/* Pausa Longa */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-[var(--texto)] block">Pausa Longa</label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={settings.pomodoro.longBreakMinutes}
                          onChange={(e) => onUpdateSettings({
                            ...settings,
                            pomodoro: { ...settings.pomodoro, longBreakMinutes: parseInt(e.target.value, 10) || 15 }
                          })}
                          className="w-full p-3 pr-12 rounded-xl bg-white border border-[var(--borda)] text-xs font-bold text-[var(--texto)] focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                        />
                        <span className="absolute right-3 text-[10px] font-black uppercase text-[var(--texto-suave)]">Min</span>
                      </div>
                    </div>

                  </div>

                  {/* Intervalo */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200/50">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-[var(--texto)] block">Frequência da Pausa Longa</span>
                      <span className="text-[11px] text-[var(--texto-suave)] block">Alterna pausa curta entre blocos e pausa longa a cada X ciclos.</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 shrink-0">A cada</span>
                      <input
                        type="number"
                        min={2}
                        max={12}
                        value={settings.pomodoro.longBreakInterval}
                        onChange={(e) => onUpdateSettings({
                          ...settings,
                          pomodoro: { ...settings.pomodoro, longBreakInterval: Math.max(2, parseInt(e.target.value, 10) || 4) }
                        })}
                        className="w-18 p-2 rounded-xl bg-white border border-[var(--borda)] text-xs font-bold text-[var(--texto)] text-center focus:ring-2 focus:ring-violet-500/20 focus:outline-none"
                      />
                      <span className="text-xs font-extrabold text-[var(--texto)] shrink-0">ciclos de foco</span>
                    </div>
                  </div>
                </div>

                {/* Sons */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-[var(--borda)] flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-[var(--texto)]">Notificação Sonora (Sinos)</div>
                      <div className="text-xs text-[var(--texto-suave)] mt-0.5">Toca um som harmônico suave gerado via sintetizador de áudio nativo quando o tempo expira.</div>
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={settings.pomodoro.soundEnabled}
                    onChange={(checked) => onUpdateSettings({
                      ...settings,
                      pomodoro: { ...settings.pomodoro, soundEnabled: checked }
                    })}
                  />
                </div>
              </div>
            )}

            {/* CONTENT: BACKUP / KEY */}
            {activeSection === 'backup' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-l-4 border-violet-500 pl-3">
                  <h4 className="text-base font-extrabold text-[var(--texto)]">Segurança & Sincronização em Nuvem</h4>
                  <p className="text-xs text-[var(--texto-suave)] mt-0.5">Gerencie seu banco persistente no Supabase e exporte cópias.</p>
                </div>

                {/* Chave de Sincronização */}
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-[var(--borda)] space-y-4">
                  <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-[var(--texto)]">Sua Chave de Acesso Exclusiva</div>
                      <div className="text-xs text-[var(--texto-suave)] mt-0.5">
                        Todos os seus dados estão protegidos por criptografia de chave. Cole-a em outro dispositivo para ter acesso imediato ao mesmo banco sincronizado.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="px-3.5 py-3 rounded-xl bg-white border border-slate-200/80 text-xs font-mono text-slate-800 tracking-wider shadow-inner shrink-0 min-w-[200px]">
                      {mostrarChave ? (getSyncKey() ?? '—') : '•'.repeat(24)}
                    </code>

                    <button
                      type="button"
                      onClick={() => setMostrarChave(v => !v)}
                      className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-[var(--texto-suave)] hover:text-[var(--texto)] hover:border-slate-300 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {mostrarChave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span>{mostrarChave ? 'Ocultar' : 'Revelar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyKey}
                      className={`px-3 py-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                        copiedKey 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : 'bg-white text-[var(--texto-suave)] border-slate-200 hover:text-[var(--texto)] hover:border-slate-300'
                      }`}
                    >
                      {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedKey ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>

                  <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100 flex items-start gap-2 text-[10px] text-violet-700/90 leading-relaxed font-bold">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Importante: Não compartilhe esta chave com ninguém. Caso perca esta chave, não há como recuperar os dados já gravados na nuvem.</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-200/50">
                    <button
                      type="button"
                      onClick={onTrocarChave}
                      className="px-4.5 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-extrabold shadow-md shadow-violet-500/20 hover:shadow-violet-500/30 transition-all cursor-pointer"
                    >
                      Trocar de chave
                    </button>
                    <button
                      type="button"
                      onClick={onDesconectar}
                      className="px-4.5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-extrabold text-[var(--texto)] transition-all cursor-pointer"
                    >
                      Desconectar deste dispositivo
                    </button>
                  </div>
                </div>

                {/* Import/Export */}
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-[var(--borda)] space-y-4">
                  <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-500 flex items-center justify-center shrink-0 shadow-sm">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-[var(--texto)]">Exportar / Importar Dados em JSON</div>
                      <div className="text-xs text-[var(--texto-suave)] mt-0.5">
                        Útil para salvar cópias de segurança manuais ou migrar dados para ambientes offline.
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      onClick={onExportJSON}
                      className="px-4.5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-md shadow-teal-600/10 hover:shadow-teal-600/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar JSON (.json)</span>
                    </button>

                    <label className="px-4.5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-extrabold text-[var(--texto)] flex items-center gap-2 cursor-pointer transition-all">
                      <Upload className="w-4 h-4 text-teal-600" />
                      <span>Subir Backup (.json)</span>
                      <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Calendário ICS */}
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-[var(--borda)] space-y-4">
                  <div className="flex gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 shadow-sm">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-[var(--texto)]">Calendário de Agenda (.ICS)</div>
                      <div className="text-xs text-[var(--texto-suave)] mt-0.5">
                        Integre suas tarefas datadas diretamente no seu Google Calendar, Apple iCal ou Outlook Calendar.
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={onExportICS}
                    className="px-4.5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-extrabold text-[var(--texto)] flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <span>Exportar Calendário (.ics)</span>
                  </button>
                </div>

                {/* Reset Perigoso */}
                <div className="p-5 rounded-3xl border border-rose-500/20 bg-rose-500/5 space-y-2">
                  <div className="text-sm font-extrabold text-rose-600">Restaurar Banco de Demonstração</div>
                  <div className="text-xs text-[var(--texto-suave)]">Limpa todos os dados locais/nuvem da chave atual e reescreve o banco com tarefas e metas iniciais de teste.</div>
                  <button
                    onClick={onResetDemo}
                    className="px-4 py-2.5 rounded-xl bg-rose-500 text-white text-xs font-extrabold hover:bg-rose-600 shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 transition-all cursor-pointer border-0 mt-1"
                  >
                    Confirmar Restauro de Exemplo
                  </button>
                </div>
              </div>
            )}

            {/* CONTENT: LIXEIRA */}
            {activeSection === 'lixeira' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="border-l-4 border-rose-500 pl-3">
                  <h4 className="text-base font-extrabold text-[var(--texto)]">Lixeira de Tarefas Deletadas</h4>
                  <p className="text-xs text-[var(--texto-suave)] mt-0.5">Visualize e recupere as tarefas excluídas. Elas expiram permanentemente após 30 dias.</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--texto-suave)]">
                    Histórico Recente
                  </span>

                  {trash.length > 0 && (
                    <button
                      onClick={onEmptyTrash}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-extrabold hover:bg-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Esvaziar Lixeira</span>
                    </button>
                  )}
                </div>

                {trash.length === 0 ? (
                  <div className="py-16 text-center text-[var(--texto-suave)] bg-slate-50 border border-[var(--borda)] rounded-3xl">
                    <Trash2 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-extrabold text-[var(--texto)]">Sua lixeira está vazia</p>
                    <p className="text-xs text-[var(--texto-muted)] mt-0.5">Todas as tarefas deletadas expiram automaticamente.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {trash.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-[var(--borda)] flex items-center justify-between gap-4 hover:border-slate-300 transition-all"
                      >
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-[var(--texto)] truncate">{item.title}</h4>
                          <span className="text-[10px] font-bold text-[var(--texto-suave)] block mt-0.5">
                            Excluída em {new Date(item.originalDeletedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <button
                          onClick={() => onRestoreTrashTask(item.id)}
                          className="px-4 py-2.5 rounded-xl bg-violet-50 text-[var(--primary)] border border-violet-100 hover:bg-[var(--primary)] hover:text-white text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
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
    </div>
  );
};
