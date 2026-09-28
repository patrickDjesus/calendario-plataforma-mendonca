/**
 * Isolated Data Repository Layer - FocoSemanal
 * Integrates IndexedDB storage, auto-migrations, 7-day rolling backups,
 * inter-tab synchronization, and complete domain CRUD operations.
 */

import { 
  DatabaseSchema, 
  Task, 
  Category, 
  UserProfile, 
  UserSettings, 
  DailyMood, 
  DayTemplate, 
  Achievement, 
  SpacedRepetitionItem,
  WorkoutTemplate,
  SubjectStructure,
  WorkoutExercise,
  ErrorLogEntry,
  StudyCycleConfig,
  ExamCountdown,
  Flashcard,
  SimulatedExam,
  Habit,
  BodyMeasurement,
  ExercisePR,
  DistractionNote,
  FocusSessionSummary
} from '../types';
import { 
  APP_NAME, 
  DB_VERSION, 
  STORAGE_KEY_V5, 
  STORAGE_KEY_V4 
} from '../constants/app';
import { idbManager } from './db';
import { cloudSync } from './supabase';
import { calculateSM2 } from '../utils/xpSystem';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-estudo', name: 'Estudo', color: '#3B6CF5', icon: 'book' },
  { id: 'cat-trabalho', name: 'Trabalho', color: '#10B981', icon: 'briefcase' },
  { id: 'cat-pessoal', name: 'Pessoal', color: '#EC4899', icon: 'user' },
  { id: 'cat-saude', name: 'Saúde & Treino', color: '#F97316', icon: 'heart-pulse' },
  { id: 'cat-outro', name: 'Outro', color: '#64748B', icon: 'tag' },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach-first-task',
    title: 'Primeiro Passo',
    description: 'Conclua sua primeira tarefa no sistema.',
    icon: 'sparkles',
    category: 'organizacao',
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'ach-focus-1h',
    title: 'Hiperfoco Ativado',
    description: 'Acumule 60 minutos de foco no cronômetro.',
    icon: 'flame',
    category: 'foco',
    progress: 0,
    maxProgress: 60,
  },
  {
    id: 'ach-focus-5h',
    title: 'Mestre da Concentração',
    description: 'Acumule 300 minutos de foco no total.',
    icon: 'zap',
    category: 'foco',
    progress: 0,
    maxProgress: 300,
  },
  {
    id: 'ach-streak-3',
    title: 'Ritmo Constante',
    description: 'Mantenha uma sequência de 3 dias produtivos.',
    icon: 'calendar-check',
    category: 'constancia',
    progress: 0,
    maxProgress: 3,
  },
  {
    id: 'ach-streak-7',
    title: 'Semana de Ouro',
    description: 'Complete 7 dias consecutivos de estudo.',
    icon: 'crown',
    category: 'constancia',
    progress: 0,
    maxProgress: 7,
  },
  {
    id: 'ach-level-5',
    title: 'Evolução Cósmica',
    description: 'Alcance o Nível 5 do seu perfil.',
    icon: 'award',
    category: 'xp',
    progress: 1,
    maxProgress: 5,
  },
  {
    id: 'ach-top3-clean',
    title: 'Foco Cirúrgico',
    description: 'Conclua as 3 principais tarefas do dia.',
    icon: 'target',
    category: 'organizacao',
    progress: 0,
    maxProgress: 3,
  },
  {
    id: 'ach-spaced-rep',
    title: 'Memória Blindada',
    description: 'Conclua uma rodada de revisão espaçada.',
    icon: 'repeat',
    category: 'foco',
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'ach-error-master',
    title: 'Aprendizado com Erros',
    description: 'Revise 5 questões do caderno de erros.',
    icon: 'book-open',
    category: 'organizacao',
    progress: 0,
    maxProgress: 5,
  },
  {
    id: 'ach-flashcard-50',
    title: 'Mente Retentiva',
    description: 'Revise 50 flashcards com o algoritmo SM-2.',
    icon: 'layers',
    category: 'foco',
    progress: 0,
    maxProgress: 50,
  },
];

export const DEFAULT_TEMPLATES: DayTemplate[] = [
  {
    id: 'tmpl-estudo-completo',
    name: 'Dia de Estudo & Foco',
    description: 'Rotina equilibrada com blocos de teoria, resolução de questões e revisão.',
    icon: 'graduation-cap',
    tasks: [
      { title: 'Revisão ativa de fórmulas e resumos', categoryId: 'cat-estudo', priority: 'alta', estimatedMinutes: 45, tags: ['revisão', 'prova'] },
      { title: 'Bloco de Resolução: 20 Exercícios', categoryId: 'cat-estudo', priority: 'urgente', estimatedMinutes: 60, tags: ['exercícios'] },
      { title: 'Estudo Teórico / Aprofundamento', categoryId: 'cat-estudo', priority: 'media', estimatedMinutes: 50, tags: ['teoria'] },
      { title: 'Alongamento & Caminhada de Descompressão', categoryId: 'cat-saude', priority: 'baixa', estimatedMinutes: 20, tags: ['saúde'] },
    ]
  },
  {
    id: 'tmpl-maratona-vestibular',
    name: 'Maratona Focada de Questões',
    description: 'Planejamento intenso voltado para alto rendimento e fixação.',
    icon: 'flame',
    tasks: [
      { title: 'Bloco Teórico: Módulo Principal', categoryId: 'cat-estudo', priority: 'alta', estimatedMinutes: 60, tags: ['teoria'] },
      { title: 'Lista de 15 Exercícios Difíceis', categoryId: 'cat-estudo', priority: 'alta', estimatedMinutes: 75, tags: ['exercícios'] },
      { title: 'Correção de Erros & Caderno de Dúvidas', categoryId: 'cat-estudo', priority: 'media', estimatedMinutes: 40, tags: ['revisão'] },
    ]
  }
];

export const DEFAULT_WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'tmpl-treino-a',
    name: 'Treino A - Peito, Tríceps & Ombros (Push)',
    muscleGroup: 'peito',
    exercises: [
      { id: 'ex-1', name: 'Supino Reto com Barra', sets: 4, reps: '8-10', loadKg: 60, restSec: 90, setsDone: [false, false, false, false], notes: 'Foco na descida controlada' },
      { id: 'ex-2', name: 'Supino Inclinado com Halteres', sets: 3, reps: '10-12', loadKg: 22, restSec: 60, setsDone: [false, false, false] },
      { id: 'ex-3', name: 'Desenvolvimento Militar com Halteres', sets: 3, reps: '10-12', loadKg: 16, restSec: 60, setsDone: [false, false, false] },
      { id: 'ex-4', name: 'Elevação Lateral na Polia', sets: 4, reps: '12-15', loadKg: 7, restSec: 45, setsDone: [false, false, false, false] },
      { id: 'ex-5', name: 'Tríceps Corda na Polia', sets: 3, reps: '12-15', loadKg: 20, restSec: 45, setsDone: [false, false, false] },
    ]
  },
  {
    id: 'tmpl-treino-b',
    name: 'Treino B - Costas, Bíceps & Deltoide Posterior (Pull)',
    muscleGroup: 'costas',
    exercises: [
      { id: 'ex-6', name: 'Puxada Frontal na Barra', sets: 4, reps: '8-10', loadKg: 55, restSec: 90, setsDone: [false, false, false, false] },
      { id: 'ex-7', name: 'Remada Curvada com Barra', sets: 4, reps: '8-10', loadKg: 50, restSec: 90, setsDone: [false, false, false, false] },
      { id: 'ex-8', name: 'Remada Baixa no Triângulo', sets: 3, reps: '10-12', loadKg: 45, restSec: 60, setsDone: [false, false, false] },
      { id: 'ex-9', name: 'Rosca Direta com Barra W', sets: 3, reps: '10-12', loadKg: 25, restSec: 60, setsDone: [false, false, false] },
      { id: 'ex-10', name: 'Rosca Martelo com Halteres', sets: 3, reps: '12', loadKg: 12, restSec: 45, setsDone: [false, false, false] },
    ]
  },
  {
    id: 'tmpl-treino-c',
    name: 'Treino C - Pernas Completo & Panturrilhas (Legs)',
    muscleGroup: 'pernas',
    exercises: [
      { id: 'ex-11', name: 'Agachamento Livre com Barra', sets: 4, reps: '8-10', loadKg: 70, restSec: 120, setsDone: [false, false, false, false] },
      { id: 'ex-12', name: 'Leg Press 45°', sets: 4, reps: '10-12', loadKg: 140, restSec: 90, setsDone: [false, false, false, false] },
      { id: 'ex-13', name: 'Cadeira Extensora', sets: 3, reps: '12-15', loadKg: 40, restSec: 60, setsDone: [false, false, false] },
      { id: 'ex-14', name: 'Mesa Flexora', sets: 4, reps: '10-12', loadKg: 35, restSec: 60, setsDone: [false, false, false, false] },
      { id: 'ex-15', name: 'Panturrilha em Pé', sets: 4, reps: '15-20', loadKg: 50, restSec: 45, setsDone: [false, false, false, false] },
    ]
  }
];

export const DEFAULT_SUBJECT_STRUCTURES: SubjectStructure[] = [
  {
    categoryId: 'cat-estudo',
    modules: [
      {
        id: 'mod-mat-1',
        name: 'Matemática: Funções e Álgebra',
        topics: [
          { id: 'top-mat-1', name: 'Função Afim e Linear (1º Grau)', status: 'dominado', sources: ['Livro Iezzi Vol. 1'], questionsDone: 35, questionsCorrect: 32, lastReviewedAt: '2026-09-20' },
          { id: 'top-mat-2', name: 'Função Quadrática e Vértice da Parábola', status: 'estudando', sources: ['Videoaula 04', 'Lista PDF'], questionsDone: 18, questionsCorrect: 14 },
          { id: 'top-mat-3', name: 'Funções Exponenciais e Logaritmos', status: 'nao_iniciado', sources: ['Apostila Módulo 3'], questionsDone: 0, questionsCorrect: 0 },
        ]
      },
      {
        id: 'mod-mat-2',
        name: 'Matemática: Geometria Plana e Espacial',
        topics: [
          { id: 'top-mat-4', name: 'Triângulos, Pitágoras e Trigonometria', status: 'revisando', sources: ['Resumo Fórmulas'], questionsDone: 25, questionsCorrect: 22, lastReviewedAt: '2026-09-24', nextReviewAt: '2026-10-01', revisionStage: 2 },
          { id: 'top-mat-5', name: 'Áreas de Figuras Planas e Círculos', status: 'estudando', sources: ['Banco Questões'], questionsDone: 12, questionsCorrect: 10 },
        ]
      },
      {
        id: 'mod-fis-1',
        name: 'Física / Ciências: Mecânica Clássica',
        topics: [
          { id: 'top-fis-1', name: 'Cinemática Escalar: MU e MUV', status: 'dominado', sources: ['Livro Ramalho Cap. 2'], questionsDone: 30, questionsCorrect: 28, lastReviewedAt: '2026-09-18' },
          { id: 'top-fis-2', name: 'Leis de Newton e Força de Atrito', status: 'revisando', sources: ['Videoaula 08'], questionsDone: 20, questionsCorrect: 17, lastReviewedAt: '2026-09-25', nextReviewAt: '2026-10-02', revisionStage: 1 },
          { id: 'top-fis-3', name: 'Trabalho, Energia Mecânica e Potência', status: 'nao_iniciado', sources: ['Livro Ramalho Cap. 5'], questionsDone: 0, questionsCorrect: 0 },
        ]
      },
      {
        id: 'mod-met-1',
        name: 'Metodologias e Técnicas de Estudo',
        topics: [
          { id: 'top-est-1', name: 'Prática Distribuída e Flashcards SM-2', status: 'dominado', sources: ['Guia de Estudos'], questionsDone: 10, questionsCorrect: 10, lastReviewedAt: '2026-09-15' },
          { id: 'top-est-2', name: 'Técnica de Feynman para Conceitos Complexos', status: 'revisando', sources: ['Artigo Científico'], questionsDone: 5, questionsCorrect: 5, lastReviewedAt: '2026-09-22', nextReviewAt: '2026-09-29', revisionStage: 2 },
        ]
      }
    ]
  }
];

export const DEFAULT_HABITS: Habit[] = [
  { id: 'h-1', title: 'Beber 2.5L de água', icon: 'droplet', category: 'saude', targetDaysPerWeek: 7, completedDates: [] },
  { id: 'h-2', title: 'Revisão ativa diária (30 min)', icon: 'book-open', category: 'estudo', targetDaysPerWeek: 6, completedDates: [] },
  { id: 'h-3', title: 'Treino de Força / Cardio', icon: 'dumbbell', category: 'saude', targetDaysPerWeek: 5, completedDates: [] },
  { id: 'h-4', title: 'Dormir 7h30+', icon: 'moon', category: 'mente', targetDaysPerWeek: 7, completedDates: [] },
];

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createInitialDatabase(): DatabaseSchema {
  const today = getTodayString();
  return {
    version: DB_VERSION,
    profile: {
      name: 'Estudante',
      avatar: '🚀',
      studyMode: 'regular',
      level: 1,
      xp: 0,
      xpHistory: {},
      streak: 0,
      longestStreak: 0,
      streakShieldAvailable: true,
      lastActiveDate: today,
      createdAt: new Date().toISOString(),
    },
    settings: {
      theme: 'auto',
      accentColor: '#3B6CF5',
      density: 'confortavel',
      fontSize: 'md',
      firstDayOfWeek: 1, // Segunda-feira
      gamificationEnabled: true,
      dailyGoalHours: 4.5,
      autoRollover: true,
      reminderHydration: false,
      reminderPosture: false,
      onboardingCompleted: true,
      dashboardCards: [
        { id: 'stats', visible: true, order: 0 },
        { id: 'cycle', visible: true, order: 1 },
        { id: 'countdown', visible: true, order: 2 },
        { id: 'next_task', visible: true, order: 3 },
        { id: 'today_tasks', visible: true, order: 4 },
        { id: 'habits', visible: true, order: 5 },
        { id: 'revisions', visible: true, order: 6 },
      ],
      pomodoro: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        longBreakInterval: 4,
        soundEnabled: true,
        vibrationEnabled: true,
        ambientSound: 'none',
        ambientVolume: 0.5,
      },
    },
    categories: DEFAULT_CATEGORIES,
    tasks: [],
    templates: DEFAULT_TEMPLATES,
    workoutTemplates: DEFAULT_WORKOUT_TEMPLATES,
    subjectStructures: DEFAULT_SUBJECT_STRUCTURES,
    achievements: INITIAL_ACHIEVEMENTS,
    dailyMoods: {},
    spacedRepetitions: [],
    errorLogs: [],
    studyCycle: {
      enabled: true,
      currentIndex: 0,
      items: [
        { id: 'cy-1', categoryId: 'cat-estudo', categoryName: 'Matemática & Teoria', weight: 4, targetMinutes: 60, completedMinutes: 0, order: 0 },
        { id: 'cy-2', categoryId: 'cat-estudo', categoryName: 'Física & Resolução', weight: 3, targetMinutes: 50, completedMinutes: 0, order: 1 },
        { id: 'cy-3', categoryId: 'cat-estudo', categoryName: 'Revisão Espaçada & Flashcards', weight: 2, targetMinutes: 35, completedMinutes: 0, order: 2 },
        { id: 'cy-4', categoryId: 'cat-saude', categoryName: 'Treino de Força / Cardio', weight: 3, targetMinutes: 45, completedMinutes: 0, order: 3 },
      ]
    },
    examCountdown: {
      targetName: 'Exame Principal / Concurso',
      examDate: '2026-11-15',
      totalTopics: 80,
      completedTopics: 28,
    },
    flashcards: [
      {
        id: 'fc-1',
        categoryId: 'cat-estudo',
        topicName: 'Funções e Álgebra',
        front: 'Qual é a fórmula do vértice da parábola (Xv e Yv)?',
        back: 'Xv = -b / (2a) e Yv = -Δ / (4a)',
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: today,
      },
      {
        id: 'fc-2',
        categoryId: 'cat-estudo',
        topicName: 'Leis de Newton',
        front: 'Qual a diferença entre massa e peso?',
        back: 'Massa é quantidade de matéria (kg, escalar). Peso é a força gravitacional exercida sobre a massa: P = m × g (N, vetorial).',
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: today,
      },
      {
        id: 'fc-3',
        categoryId: 'cat-estudo',
        topicName: 'Técnicas de Estudo',
        front: 'Como funciona o ciclo da curva do esquecimento de Ebbinghaus?',
        back: 'A retenção cai drasticamente nas primeiras 24 horas; revisões espaçadas (1d, 7d, 30d) estabilizam a retenção na memória de longo prazo.',
        intervalDays: 3,
        repetitions: 1,
        easeFactor: 2.5,
        dueDate: today,
      }
    ],
    simulatedExams: [],
    habits: DEFAULT_HABITS,
    bodyMeasurements: [],
    exercisePRs: {},
    distractionNotes: [],
    focusSummaries: [],
    trash: [],
  };
}

export function migrateDatabase(parsed: DatabaseSchema): DatabaseSchema {
  if (!parsed.version || parsed.version < DB_VERSION) {
    parsed.version = DB_VERSION;
  }
  if (!parsed.trash) parsed.trash = [];
  if (!parsed.dailyMoods) parsed.dailyMoods = {};
  if (!parsed.spacedRepetitions) parsed.spacedRepetitions = [];
  if (!parsed.achievements) parsed.achievements = INITIAL_ACHIEVEMENTS;
  if (!parsed.templates) parsed.templates = DEFAULT_TEMPLATES;
  if (!parsed.workoutTemplates || parsed.workoutTemplates.length === 0) {
    parsed.workoutTemplates = DEFAULT_WORKOUT_TEMPLATES;
  }
  if (!parsed.subjectStructures || parsed.subjectStructures.length === 0) {
    parsed.subjectStructures = DEFAULT_SUBJECT_STRUCTURES;
  }
  if (!parsed.profile.xpHistory) parsed.profile.xpHistory = {};
  if (typeof parsed.profile.streakShieldAvailable === 'undefined') {
    parsed.profile.streakShieldAvailable = true;
  }
  if (!parsed.settings.fontSize) {
    parsed.settings.fontSize = 'md';
  }
  if (!parsed.errorLogs) parsed.errorLogs = [];
  if (!parsed.studyCycle) {
    parsed.studyCycle = createInitialDatabase().studyCycle;
  }
  if (!parsed.flashcards) {
    parsed.flashcards = createInitialDatabase().flashcards;
  }
  if (!parsed.simulatedExams) parsed.simulatedExams = [];
  if (!parsed.habits || parsed.habits.length === 0) {
    parsed.habits = DEFAULT_HABITS;
  }
  if (!parsed.bodyMeasurements) parsed.bodyMeasurements = [];
  if (!parsed.exercisePRs) parsed.exercisePRs = {};
  if (!parsed.distractionNotes) parsed.distractionNotes = [];
  if (!parsed.focusSummaries) parsed.focusSummaries = [];

  // Migrate standalone categories to cat-estudo
  if (parsed.categories && parsed.categories.length > 0) {
    parsed.categories = parsed.categories.filter(
      c => c.id !== 'cat-matematica' && c.id !== 'cat-fisica'
    );
    if (!parsed.categories.some(c => c.id === 'cat-estudo')) {
      parsed.categories.unshift({ id: 'cat-estudo', name: 'Estudo', color: '#3B6CF5', icon: 'book' });
    }
  } else {
    parsed.categories = DEFAULT_CATEGORIES;
  }

  // Migrate tasks to cat-estudo
  if (parsed.tasks && parsed.tasks.length > 0) {
    parsed.tasks.forEach(t => {
      if (t.categoryId === 'cat-matematica') {
        t.categoryId = 'cat-estudo';
        if (!t.tags) t.tags = [];
        if (!t.tags.includes('matemática')) t.tags.push('matemática');
      } else if (t.categoryId === 'cat-fisica') {
        t.categoryId = 'cat-estudo';
        if (!t.tags) t.tags = [];
        if (!t.tags.includes('física')) t.tags.push('física');
      }
    });
  }

  return parsed;
}

class DataRepository {
  private inMemoryDb: DatabaseSchema | null = null;
  private initPromise: Promise<DatabaseSchema> | null = null;
  private cloudPushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Listen for tab sync
    idbManager.onSync((syncedDb) => {
      this.inMemoryDb = syncedDb;
    });
  }

  public async initialize(): Promise<DatabaseSchema> {
    if (this.inMemoryDb) return this.inMemoryDb;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const fromIdb = await idbManager.loadState();
        if (fromIdb) {
          const migrated = migrateDatabase(fromIdb);
          this.inMemoryDb = migrated;
          await idbManager.saveState(migrated);
          return await this.reconcileWithCloud(migrated);
        }

        // Check localStorage migration
        const stored = this.loadFromLocalStorageFallback();
        if (stored) {
          const migrated = migrateDatabase(stored);
          this.inMemoryDb = migrated;
          await idbManager.saveState(migrated);
          return await this.reconcileWithCloud(migrated);
        }

        // First run
        const initial = createInitialDatabase();
        this.inMemoryDb = initial;
        await idbManager.saveState(initial);
        return await this.reconcileWithCloud(initial);
      } catch (err) {
        console.error('Error initializing repository:', err);
        const fallback = createInitialDatabase();
        this.inMemoryDb = fallback;
        return fallback;
      }
    })();

    return this.initPromise;
  }

  private loadFromLocalStorageFallback(): DatabaseSchema | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const v5 = localStorage.getItem(STORAGE_KEY_V5);
      if (v5) return JSON.parse(v5);

      const v4 = localStorage.getItem(STORAGE_KEY_V4);
      if (v4) return JSON.parse(v4);

      const v3 = localStorage.getItem('focosemanal_clean_db_v3');
      if (v3) return JSON.parse(v3);
    } catch (e) {
      console.warn('LocalStorage fallback read error:', e);
    }
    return null;
  }

  private loadRawSync(): DatabaseSchema {
    if (this.inMemoryDb) return this.inMemoryDb;
    const fallback = this.loadFromLocalStorageFallback();
    if (fallback) {
      const migrated = migrateDatabase(fallback);
      this.inMemoryDb = migrated;
      return migrated;
    }
    const initial = createInitialDatabase();
    this.inMemoryDb = initial;
    return initial;
  }

  private async persist(db: DatabaseSchema): Promise<void> {
    this.inMemoryDb = db;
    await idbManager.saveState(db);
    this.scheduleCloudPush(db);
  }

  /**
   * Se a nuvem tiver um snapshot mais novo (rev maior), adota-o localmente.
   * Caso contrário, mantém o local (ele será empurrado pelo scheduleCloudPush).
   */
  private async reconcileWithCloud(db: DatabaseSchema): Promise<DatabaseSchema> {
    const chosen = await cloudSync.reconcile(db);
    if (chosen === db) return db;
    const migrated = migrateDatabase(chosen);
    this.inMemoryDb = migrated;
    await idbManager.saveState(migrated);
    return migrated;
  }

  /** Empurra o snapshot local para a nuvem com debounce (coalesce rajadas). */
  private scheduleCloudPush(db: DatabaseSchema): void {
    if (this.cloudPushTimer) clearTimeout(this.cloudPushTimer);
    this.cloudPushTimer = setTimeout(() => {
      this.cloudPushTimer = null;
      cloudSync.push(db).catch(() => {});
    }, 1500);
  }

  // ==== UNDO STACK ====
  public registerUndo(description: string, undoFn: () => Promise<void>): void {
    idbManager.registerUndo(description, undoFn);
  }

  public canUndo(): boolean {
    return idbManager.canUndo();
  }

  public async executeUndo(): Promise<{ description: string } | null> {
    const res = await idbManager.executeUndo();
    if (res && this.inMemoryDb) {
      await this.persist(this.inMemoryDb);
    }
    return res;
  }

  // ==== TASKS ====
  public async getTasks(): Promise<Task[]> {
    const db = await this.initialize();
    return db.tasks.filter(t => !t.deletedAt);
  }

  public async getTaskById(id: string): Promise<Task | null> {
    const db = await this.initialize();
    const task = db.tasks.find(t => t.id === id && !t.deletedAt);
    return task || null;
  }

  public async saveTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Task> {
    const db = await this.initialize();
    const now = new Date().toISOString();

    if (task.id) {
      const index = db.tasks.findIndex(t => t.id === task.id);
      if (index >= 0) {
        const existing = db.tasks[index];
        const activityLog = [...(existing.activityLog || [])];
        
        if (existing.completed !== task.completed) {
          activityLog.unshift({
            id: generateUUID(),
            action: task.completed ? 'Tarefa marcada como concluída' : 'Tarefa reaberta',
            timestamp: now,
          });
        }

        const updated: Task = {
          ...existing,
          ...task,
          id: task.id,
          activityLog,
          updatedAt: now,
        };
        db.tasks[index] = updated;
        await this.persist(db);
        return updated;
      }
    }

    const newTask: Task = {
      ...task,
      id: task.id || generateUUID(),
      spentSeconds: task.spentSeconds || 0,
      completed: task.completed ?? false,
      tags: task.tags || [],
      subtasks: task.subtasks || [],
      order: task.order ?? db.tasks.length,
      activityLog: [
        {
          id: generateUUID(),
          action: 'Tarefa criada',
          timestamp: now,
        }
      ],
      createdAt: now,
      updatedAt: now,
    };

    db.tasks.push(newTask);
    await this.persist(db);
    return newTask;
  }

  public async saveTasksBatch(tasks: Task[]): Promise<void> {
    const db = await this.initialize();
    const map = new Map<string, Task>(tasks.map(t => [t.id, t]));
    
    db.tasks = db.tasks.map(existing => {
      if (map.has(existing.id)) {
        const updated = map.get(existing.id)!;
        map.delete(existing.id);
        return { ...updated, updatedAt: new Date().toISOString() };
      }
      return existing;
    });

    for (const newTask of map.values()) {
      db.tasks.push({
        ...newTask,
        createdAt: newTask.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await this.persist(db);
  }

  public async softDeleteTask(id: string): Promise<Task | null> {
    const db = await this.initialize();
    const index = db.tasks.findIndex(t => t.id === id);
    if (index >= 0) {
      const task = db.tasks[index];
      const now = new Date().toISOString();
      task.deletedAt = now;
      db.trash.push({ ...task, originalDeletedAt: now });
      db.tasks.splice(index, 1);

      // Register undo
      this.registerUndo(`Excluir "${task.title}"`, async () => {
        const currentDb = await this.initialize();
        const trashIdx = currentDb.trash.findIndex(t => t.id === id);
        if (trashIdx >= 0) {
          const [restored] = currentDb.trash.splice(trashIdx, 1);
          delete restored.deletedAt;
          currentDb.tasks.push(restored);
          await this.persist(currentDb);
        }
      });

      await this.persist(db);
      return task;
    }
    return null;
  }

  public async deleteTasksBatch(taskIds: string[]): Promise<void> {
    const db = await this.initialize();
    const now = new Date().toISOString();
    const deletedTasks: Task[] = [];

    db.tasks = db.tasks.filter(t => {
      if (taskIds.includes(t.id)) {
        deletedTasks.push({ ...t, deletedAt: now });
        db.trash.push({ ...t, deletedAt: now, originalDeletedAt: now });
        return false;
      }
      return true;
    });

    if (deletedTasks.length > 0) {
      this.registerUndo(`Excluir ${deletedTasks.length} tarefas`, async () => {
        const currentDb = await this.initialize();
        deletedTasks.forEach(dt => {
          const trashIdx = currentDb.trash.findIndex(t => t.id === dt.id);
          if (trashIdx >= 0) {
            const [restored] = currentDb.trash.splice(trashIdx, 1);
            delete restored.deletedAt;
            currentDb.tasks.push(restored);
          }
        });
        await this.persist(currentDb);
      });
    }

    await this.persist(db);
  }

  // ==== PROFILE & SETTINGS ====
  public async getProfile(): Promise<UserProfile> {
    const db = await this.initialize();
    return db.profile;
  }

  public async updateProfile(profileUpdates: Partial<UserProfile>): Promise<UserProfile> {
    const db = await this.initialize();
    db.profile = { ...db.profile, ...profileUpdates };
    await this.persist(db);
    return db.profile;
  }

  public async getSettings(): Promise<UserSettings> {
    const db = await this.initialize();
    return db.settings;
  }

  public async updateSettings(settingsUpdates: Partial<UserSettings>): Promise<UserSettings> {
    const db = await this.initialize();
    db.settings = { ...db.settings, ...settingsUpdates };
    await this.persist(db);
    return db.settings;
  }

  // ==== CATEGORIES ====
  public async getCategories(): Promise<Category[]> {
    const db = await this.initialize();
    return db.categories;
  }

  public async saveCategory(category: Category): Promise<Category> {
    const db = await this.initialize();
    const index = db.categories.findIndex(c => c.id === category.id);
    if (index >= 0) {
      db.categories[index] = category;
    } else {
      db.categories.push(category);
    }
    await this.persist(db);
    return category;
  }

  public async deleteCategory(id: string): Promise<boolean> {
    const db = await this.initialize();
    const cat = db.categories.find(c => c.id === id);
    if (!cat) return false;
    db.categories = db.categories.filter(c => c.id !== id);
    await this.persist(db);
    return true;
  }

  // ==== SUBJECT STRUCTURES (FASE 3B) ====
  public async getSubjectStructures(): Promise<SubjectStructure[]> {
    const db = await this.initialize();
    return db.subjectStructures || DEFAULT_SUBJECT_STRUCTURES;
  }

  public async saveSubjectStructure(structure: SubjectStructure): Promise<void> {
    const db = await this.initialize();
    if (!db.subjectStructures) db.subjectStructures = [...DEFAULT_SUBJECT_STRUCTURES];
    const idx = db.subjectStructures.findIndex(s => s.categoryId === structure.categoryId);
    if (idx >= 0) {
      db.subjectStructures[idx] = structure;
    } else {
      db.subjectStructures.push(structure);
    }
    await this.persist(db);
  }

  // ==== CADERNO DE ERROS ====
  public async getErrorLogs(): Promise<ErrorLogEntry[]> {
    const db = await this.initialize();
    return db.errorLogs || [];
  }

  public async saveErrorLog(entry: Omit<ErrorLogEntry, 'id'> & { id?: string }): Promise<ErrorLogEntry> {
    const db = await this.initialize();
    if (!db.errorLogs) db.errorLogs = [];
    const item: ErrorLogEntry = {
      ...entry,
      id: entry.id || generateUUID(),
    };
    const idx = db.errorLogs.findIndex(e => e.id === item.id);
    if (idx >= 0) {
      db.errorLogs[idx] = item;
    } else {
      db.errorLogs.unshift(item);
    }
    await this.persist(db);
    return item;
  }

  public async deleteErrorLog(id: string): Promise<void> {
    const db = await this.initialize();
    if (db.errorLogs) {
      db.errorLogs = db.errorLogs.filter(e => e.id !== id);
      await this.persist(db);
    }
  }

  // ==== CICLO DE ESTUDOS ====
  public async getStudyCycle(): Promise<StudyCycleConfig> {
    const db = await this.initialize();
    return db.studyCycle || createInitialDatabase().studyCycle!;
  }

  public async saveStudyCycle(cycle: StudyCycleConfig): Promise<void> {
    const db = await this.initialize();
    db.studyCycle = cycle;
    await this.persist(db);
  }

  public async advanceStudyCycle(minutesSpent: number): Promise<StudyCycleConfig> {
    const db = await this.initialize();
    if (!db.studyCycle || db.studyCycle.items.length === 0) return createInitialDatabase().studyCycle!;
    const curIdx = db.studyCycle.currentIndex;
    const curItem = db.studyCycle.items[curIdx];
    if (curItem) {
      curItem.completedMinutes += minutesSpent;
    }
    db.studyCycle.currentIndex = (curIdx + 1) % db.studyCycle.items.length;
    await this.persist(db);
    return db.studyCycle;
  }

  // ==== CONTAGEM REGRESSIVA DA PROVA ====
  public async getExamCountdown(): Promise<ExamCountdown | null> {
    const db = await this.initialize();
    return db.examCountdown || null;
  }

  public async saveExamCountdown(countdown: ExamCountdown): Promise<void> {
    const db = await this.initialize();
    db.examCountdown = countdown;
    await this.persist(db);
  }

  // ==== FLASHCARDS SM-2 ====
  public async getFlashcards(): Promise<Flashcard[]> {
    const db = await this.initialize();
    return db.flashcards || [];
  }

  public async saveFlashcard(card: Omit<Flashcard, 'id'> & { id?: string }): Promise<Flashcard> {
    const db = await this.initialize();
    if (!db.flashcards) db.flashcards = [];
    const item: Flashcard = {
      ...card,
      id: card.id || generateUUID(),
      intervalDays: card.intervalDays || 1,
      repetitions: card.repetitions || 0,
      easeFactor: card.easeFactor || 2.5,
      dueDate: card.dueDate || getTodayString(),
    };
    const idx = db.flashcards.findIndex(f => f.id === item.id);
    if (idx >= 0) {
      db.flashcards[idx] = item;
    } else {
      db.flashcards.push(item);
    }
    await this.persist(db);
    return item;
  }

  public async reviewFlashcardSM2(id: string, quality: number, todayISO: string): Promise<Flashcard | null> {
    const db = await this.initialize();
    if (!db.flashcards) return null;
    const idx = db.flashcards.findIndex(f => f.id === id);
    if (idx < 0) return null;

    const existing = db.flashcards[idx];
    const sm2 = calculateSM2(
      quality,
      existing.repetitions,
      existing.intervalDays,
      existing.easeFactor,
      todayISO
    );

    const updated: Flashcard = {
      ...existing,
      ...sm2,
      lastReviewedAt: todayISO,
    };
    db.flashcards[idx] = updated;
    await this.persist(db);
    return updated;
  }

  public async deleteFlashcard(id: string): Promise<void> {
    const db = await this.initialize();
    if (db.flashcards) {
      db.flashcards = db.flashcards.filter(f => f.id !== id);
      await this.persist(db);
    }
  }

  // ==== SIMULADOS ====
  public async getSimulatedExams(): Promise<SimulatedExam[]> {
    const db = await this.initialize();
    return db.simulatedExams || [];
  }

  public async saveSimulatedExam(exam: Omit<SimulatedExam, 'id'> & { id?: string }): Promise<SimulatedExam> {
    const db = await this.initialize();
    if (!db.simulatedExams) db.simulatedExams = [];
    const item: SimulatedExam = {
      ...exam,
      id: exam.id || generateUUID(),
    };
    const idx = db.simulatedExams.findIndex(s => s.id === item.id);
    if (idx >= 0) {
      db.simulatedExams[idx] = item;
    } else {
      db.simulatedExams.unshift(item);
    }
    await this.persist(db);
    return item;
  }

  // ==== HÁBITOS ====
  public async getHabits(): Promise<Habit[]> {
    const db = await this.initialize();
    return db.habits || DEFAULT_HABITS;
  }

  public async saveHabit(habit: Habit): Promise<void> {
    const db = await this.initialize();
    if (!db.habits) db.habits = [];
    const idx = db.habits.findIndex(h => h.id === habit.id);
    if (idx >= 0) {
      db.habits[idx] = habit;
    } else {
      db.habits.push(habit);
    }
    await this.persist(db);
  }

  public async toggleHabitDate(habitId: string, dateISO: string): Promise<Habit | null> {
    const db = await this.initialize();
    if (!db.habits) return null;
    const h = db.habits.find(item => item.id === habitId);
    if (!h) return null;

    if (h.completedDates.includes(dateISO)) {
      h.completedDates = h.completedDates.filter(d => d !== dateISO);
    } else {
      h.completedDates.push(dateISO);
    }
    await this.persist(db);
    return h;
  }

  // ==== MEDIDAS CORPORAIS ====
  public async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    const db = await this.initialize();
    return db.bodyMeasurements || [];
  }

  public async saveBodyMeasurement(measurement: Omit<BodyMeasurement, 'id'> & { id?: string }): Promise<BodyMeasurement> {
    const db = await this.initialize();
    if (!db.bodyMeasurements) db.bodyMeasurements = [];
    const item: BodyMeasurement = {
      ...measurement,
      id: measurement.id || generateUUID(),
    };
    const idx = db.bodyMeasurements.findIndex(b => b.id === item.id);
    if (idx >= 0) {
      db.bodyMeasurements[idx] = item;
    } else {
      db.bodyMeasurements.unshift(item);
    }
    await this.persist(db);
    return item;
  }

  // ==== PRs (RECORDES DE CARGA) ====
  public async getExercisePRs(): Promise<Record<string, ExercisePR>> {
    const db = await this.initialize();
    return db.exercisePRs || {};
  }

  public async recordExerciseLoad(exerciseName: string, loadKg: number, reps: string): Promise<{ isPR: boolean; previousRecord?: number }> {
    const db = await this.initialize();
    if (!db.exercisePRs) db.exercisePRs = {};
    const key = exerciseName.trim().toLowerCase();
    const existing = db.exercisePRs[key];

    if (!existing || loadKg > existing.maxLoadKg) {
      const prev = existing ? existing.maxLoadKg : undefined;
      db.exercisePRs[key] = {
        exerciseName,
        maxLoadKg: loadKg,
        date: getTodayString(),
        reps,
      };
      await this.persist(db);
      return { isPR: true, previousRecord: prev };
    }
    return { isPR: false, previousRecord: existing.maxLoadKg };
  }

  // ==== DISTRAÇÕES & RESUMO DE FOCO ====
  public async getDistractionNotes(): Promise<DistractionNote[]> {
    const db = await this.initialize();
    return db.distractionNotes || [];
  }

  public async addDistractionNote(text: string, task?: Task): Promise<DistractionNote> {
    const db = await this.initialize();
    if (!db.distractionNotes) db.distractionNotes = [];
    const note: DistractionNote = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      text: text.trim(),
      taskId: task?.id,
      taskTitle: task?.title,
    };
    db.distractionNotes.unshift(note);
    await this.persist(db);
    return note;
  }

  public async deleteDistractionNote(id: string): Promise<void> {
    const db = await this.initialize();
    if (db.distractionNotes) {
      db.distractionNotes = db.distractionNotes.filter(n => n.id !== id);
      await this.persist(db);
    }
  }

  public async getFocusSummaries(): Promise<FocusSessionSummary[]> {
    const db = await this.initialize();
    return db.focusSummaries || [];
  }

  public async saveFocusSummary(summary: Omit<FocusSessionSummary, 'id'>): Promise<FocusSessionSummary> {
    const db = await this.initialize();
    if (!db.focusSummaries) db.focusSummaries = [];
    const item: FocusSessionSummary = {
      ...summary,
      id: generateUUID(),
    };
    db.focusSummaries.unshift(item);
    await this.persist(db);
    return item;
  }

  // ==== MOOD & DIARY ====
  public async getDailyMood(date: string): Promise<DailyMood | null> {
    const db = await this.initialize();
    return db.dailyMoods[date] || null;
  }

  public async saveDailyMood(mood: DailyMood): Promise<void> {
    const db = await this.initialize();
    db.dailyMoods[mood.date] = mood;
    await this.persist(db);
  }

  public async getAllMoods(): Promise<Record<string, DailyMood>> {
    const db = await this.initialize();
    return db.dailyMoods;
  }

  // ==== ACHIEVEMENTS ====
  public async getAchievements(): Promise<Achievement[]> {
    const db = await this.initialize();
    return db.achievements;
  }

  public async updateAchievements(achievements: Achievement[]): Promise<void> {
    const db = await this.initialize();
    db.achievements = achievements;
    await this.persist(db);
  }

  // ==== TEMPLATES ====
  public async getTemplates(): Promise<DayTemplate[]> {
    const db = await this.initialize();
    return db.templates;
  }

  public async saveTemplate(template: DayTemplate): Promise<void> {
    const db = await this.initialize();
    const idx = db.templates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      db.templates[idx] = template;
    } else {
      db.templates.push(template);
    }
    await this.persist(db);
  }

  // ==== SPACED REPETITION ====
  public async getSpacedRepetitions(): Promise<SpacedRepetitionItem[]> {
    const db = await this.initialize();
    return db.spacedRepetitions;
  }

  public async addSpacedRepetition(item: SpacedRepetitionItem): Promise<void> {
    const db = await this.initialize();
    db.spacedRepetitions.push(item);
    await this.persist(db);
  }

  public async updateSpacedRepetition(item: SpacedRepetitionItem): Promise<void> {
    const db = await this.initialize();
    const idx = db.spacedRepetitions.findIndex(s => s.id === item.id);
    if (idx >= 0) {
      db.spacedRepetitions[idx] = item;
      await this.persist(db);
    }
  }

  // ==== BACKUP & EXPORT ====
  public async exportFullDatabaseJSON(): Promise<string> {
    const db = await this.initialize();
    return JSON.stringify(db, null, 2);
  }

  public async importFullDatabaseJSON(jsonStr: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(jsonStr) as DatabaseSchema;
      if (!parsed || !Array.isArray(parsed.tasks) || !parsed.profile) {
        throw new Error('Formato de backup inválido');
      }
      const migrated = migrateDatabase(parsed);
      await this.persist(migrated);
      return true;
    } catch (err) {
      console.error('Erro ao importar backup:', err);
      return false;
    }
  }

  // ==== WORKOUT TEMPLATES ====
  public async getWorkoutTemplates(): Promise<WorkoutTemplate[]> {
    const db = await this.initialize();
    return db.workoutTemplates || DEFAULT_WORKOUT_TEMPLATES;
  }

  public async saveWorkoutTemplate(template: WorkoutTemplate): Promise<void> {
    const db = await this.initialize();
    if (!db.workoutTemplates) db.workoutTemplates = [...DEFAULT_WORKOUT_TEMPLATES];
    const idx = db.workoutTemplates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      db.workoutTemplates[idx] = template;
    } else {
      db.workoutTemplates.push(template);
    }
    await this.persist(db);
  }

  // ==== TRASH ====
  public async getTrash(): Promise<Array<Task & { originalDeletedAt: string }>> {
    const db = await this.initialize();
    return db.trash || [];
  }

  public async restoreTask(id: string): Promise<Task | null> {
    const db = await this.initialize();
    if (!db.trash) return null;
    const idx = db.trash.findIndex(t => t.id === id);
    if (idx >= 0) {
      const [restored] = db.trash.splice(idx, 1);
      delete restored.deletedAt;
      db.tasks.push(restored);
      await this.persist(db);
      return restored;
    }
    return null;
  }

  public async emptyTrash(): Promise<void> {
    const db = await this.initialize();
    db.trash = [];
    await this.persist(db);
  }

  public async resetToDemo(): Promise<void> {
    const fresh = createInitialDatabase();
    await this.persist(fresh);
  }
}

export const repository = new DataRepository();
