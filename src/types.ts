export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';

export type StudyMode = 'leve' | 'regular' | 'intenso' | 'caverna';

export interface Category {
  id: string;
  name: string;
  color: string; // hex
  icon: string; // icon identifier
  isCustom?: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TimeLog {
  id: string;
  startTime: number;
  endTime?: number;
  durationSeconds: number;
  note?: string;
  date: string; // YYYY-MM-DD
}

export interface Attachment {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  timestamp: string;
}

// ----------------------------------------------------
// FASE 3A: Modelos para Treino & Saúde
// ----------------------------------------------------
export type HealthActivityType = 
  | 'treino_forca' 
  | 'cardio' 
  | 'mobilidade' 
  | 'refeicao' 
  | 'sono' 
  | 'hidratacao' 
  | 'consulta' 
  | 'outro';

export type MuscleGroup = 'peito' | 'costas' | 'pernas' | 'ombros' | 'bracos' | 'core' | 'fullbody';

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string; // ex: "10-12" ou "12"
  loadKg?: number;
  restSec?: number;
  notes?: string;
  setsDone: boolean[]; // array booleano para cada série
}

export interface WorkoutDetails {
  type: 'treino_forca';
  muscleGroup: MuscleGroup;
  exercises: WorkoutExercise[];
  effortRating?: number; // 1 a 5
  maxLoadRecordKg?: number;
  lastSessionSummary?: string;
}

export interface CardioDetails {
  type: 'cardio';
  modality: string; // ex: "Corrida", "Ciclismo", "Natação", "Caminhada"
  durationMinutes: number;
  distanceKm?: number;
  intensity: 'leve' | 'moderada' | 'intensa';
  paceOrHr?: string; // ex: "5:20 min/km" ou "145 bpm"
}

export interface NutritionHydrationDetails {
  type: 'refeicao' | 'hidratacao' | 'sono' | 'mobilidade' | 'consulta' | 'outro';
  mealDescription?: string;
  mealTime?: string;
  waterTargetMl?: number;
  waterConsumedMl?: number;
  sleepHoursTarget?: number;
  sleepQuality?: string;
  notes?: string;
}

// ----------------------------------------------------
// FASE 3B: Modelos para Conteúdo das Matérias (Árvore Matéria -> Módulo -> Tópico)
// ----------------------------------------------------
export type TopicStatus = 'nao_iniciado' | 'estudando' | 'revisando' | 'dominado' | 'nao_visto' | 'visto' | 'revisado';

export interface Topic {
  id: string;
  name?: string;
  nome?: string;
  subjectId?: string;
  parentId?: string;
  status: TopicStatus;
  sources?: string[]; // ex: ["Livro Halliday Cap. 3", "Videoaula 12"]
  questionsDone?: number;
  questionsCorrect?: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  revisionStage?: number; // 1 (1 dia), 2 (7 dias), 3 (30 dias)
  ordem?: number;
  ultimoEstudoEm?: string;
  notas?: string;
}

export interface Module {
  id: string;
  name: string;
  topics: Topic[];
}

export interface SubjectStructure {
  categoryId: string; // ID da Category correspondente
  modules: Module[];
}

export interface StudyDetails {
  type: 'estudo';
  moduleId?: string;
  moduleName?: string;
  topicId?: string;
  topicName?: string;
  studyType?: 'teoria' | 'exercicios' | 'revisao' | 'resumo';
  questionsDone?: number;
  questionsCorrect?: number;
  sourcesUsed?: string;
}

export type TaskDetails = WorkoutDetails | CardioDetails | NutritionHydrationDetails | StudyDetails;

export interface Task {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  priority: Priority;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm format for time blocking
  estimatedMinutes?: number;
  spentSeconds: number;
  completed: boolean;
  completedAt?: string;
  isTop3?: boolean;
  pinned?: boolean;
  tags: string[];
  subtasks: Subtask[];
  recurringDays?: number[]; // 0 = Dom, 1 = Seg, ..., 6 = Sab
  recurringId?: string;
  /** Dias pulados de propósito numa série: YYYY-MM-DD. Some a ocorrência, não a regra. */
  recurrenceExceptions?: string[];
  /** Conclusão por dia da série: { 'YYYY-MM-DD': true }. Concluir um dia não afeta outro. */
  recurrenceCompletions?: Record<string, boolean>;
  /** Tempo gasto por dia da série: { 'YYYY-MM-DD': segundos }. */
  spentSecondsByDay?: Record<string, number>;
  reflectionNote?: string;
  /** Choveu no dia e a tarefa ficou inviável (só faz sentido em tarefa de saúde). */
  blockedByRain?: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  // Detalhes enriquecidos (Fase 2 & Fase 3)
  details?: TaskDetails;
  attachments?: Attachment[];
  activityLog?: ActivityLog[];
  // Bloco C & D: Recorrência flexível, hábitos, estimativas, matérias e projetos
  recurrenceRule?: {
    type: 'diaria' | 'semanal' | 'mensal' | 'cada_n_dias';
    interval: number;
    weekdays?: number[];
    vezesPorSemana?: number;
    ate?: string;
  };
  isHabit?: boolean;
  vezesPorSemana?: number;
  postponeCount?: number;
  subjectId?: string;
  topicId?: string;
  projectId?: string;
  archivedAt?: string | null;
}

export interface DailyMood {
  date: string; // YYYY-MM-DD
  mood: 'otimo' | 'bom' | 'neutro' | 'cansado' | 'estressado';
  energy: number; // 1 to 5
  note?: string;
  createdAt: string;
}

export interface DayTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  tasks: Array<{
    title: string;
    categoryId: string;
    priority: Priority;
    estimatedMinutes: number;
    tags: string[];
    time?: string;
  }>;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  exercises: WorkoutExercise[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  category: 'foco' | 'constancia' | 'xp' | 'organizacao';
  progress: number;
  maxProgress: number;
}

// ----------------------------------------------------
// ESTUDO AVANÇADO: Caderno de Erros, Ciclo, Prova, Flashcards SM-2, Simulados
// ----------------------------------------------------
export type ErrorReason = 'atencao' | 'nao_sabia' | 'confundi';

export interface ErrorLogEntry {
  id: string;
  categoryId: string;
  moduleName?: string;
  topicName: string;
  reason: ErrorReason;
  questionDescription: string;
  correctExplanation?: string;
  date: string; // YYYY-MM-DD
  reviewed: boolean;
  reviewedAt?: string;
}

export interface StudyCycleItem {
  id: string;
  categoryId: string;
  categoryName: string;
  weight: number; // 1 a 5
  targetMinutes: number;
  completedMinutes: number;
  order: number;
}

export interface StudyCycleConfig {
  enabled: boolean;
  currentIndex: number;
  items: StudyCycleItem[];
}

export interface ExamCountdown {
  targetName: string; // ex: "ENEM", "Concurso PRF", "Residência Médica"
  examDate: string; // YYYY-MM-DD
  totalTopics: number;
  completedTopics: number;
}

export interface Flashcard {
  id: string;
  categoryId: string;
  topicId?: string;
  topicName?: string;
  front: string;
  back: string;
  // SM-2 fields
  intervalDays: number;
  repetitions: number;
  easeFactor: number; // default 2.5
  dueDate: string; // YYYY-MM-DD
  lastReviewedAt?: string;
}

export interface SimulatedExamSubjectScore {
  categoryId: string;
  subjectName: string;
  questionsTotal: number;
  questionsCorrect: number;
}

export interface SimulatedExam {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  totalQuestions: number;
  totalCorrect: number;
  essayScore?: number; // Redação opcional
  subjectScores: SimulatedExamSubjectScore[];
  notes?: string;
}

// ----------------------------------------------------
// TREINO & SAÚDE: Hábitos, Medidas Corporais, PRs
// ----------------------------------------------------
export interface Habit {
  id: string;
  title: string;
  icon: string;
  category: 'saude' | 'estudo' | 'mente' | 'rotina';
  targetDaysPerWeek: number;
  completedDates: string[]; // array de datas YYYY-MM-DD
}

export interface BodyMeasurement {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  chestCm?: number;
  waistCm?: number;
  armsCm?: number;
  legsCm?: number;
  notes?: string;
}

export interface ExercisePR {
  exerciseName: string;
  maxLoadKg: number;
  date: string;
  reps: string;
}

// ----------------------------------------------------
// FOCO & SESSÕES: Resumos de Sessão e Distrações
// ----------------------------------------------------
export interface DistractionNote {
  id: string;
  timestamp: string;
  text: string;
  taskId?: string;
  taskTitle?: string;
}

export interface FocusSessionSummary {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  durationMinutes: number;
  taskTitle: string;
  categoryId: string;
  pausesCount: number;
  obstacleNote?: string;
  examMode?: boolean;
}

// ----------------------------------------------------
// GAMIFICAÇÃO AVANÇADA: Missões & Escudo
// ----------------------------------------------------
export interface DailyMission {
  id: string;
  title: string;
  xpReward: number;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  type: 'pomodoro' | 'top3' | 'study_minutes' | 'questions' | 'habit';
}

export interface UserProfile {
  name: string;
  avatar: string;
  studyMode: StudyMode;
  level: number;
  xp: number;
  xpHistory: Record<string, number>; // date -> xp earned
  streak: number;
  longestStreak: number;
  streakShieldAvailable: boolean; // 1 folga por semana
  streakShieldLastUsedWeek?: string; // YYYY-Www
  lastActiveDate: string;
  createdAt: string;
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface DashboardCardConfig {
  id: 'stats' | 'today_tasks' | 'cycle' | 'countdown' | 'habits' | 'next_task' | 'revisions';
  visible: boolean;
  order: number;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  accentColor: string;
  density: 'confortavel' | 'compacta';
  fontSize: 'sm' | 'md' | 'lg';
  firstDayOfWeek: 0 | 1; // 0: Dom, 1: Seg
  gamificationEnabled: boolean;
  pomodoro: PomodoroSettings;
  dailyGoalHours: number;
  autoRollover: boolean;
  reminderHydration: boolean;
  reminderPosture: boolean;
  onboardingCompleted: boolean;
  dashboardCards?: DashboardCardConfig[];
  lastBackupExportPrompt?: string; // YYYY-MM-DD
  // Bloco B, C, D, E
  animations?: 'completa' | 'suave' | 'desligada';
  splashMode?: 'diaria' | 'sempre' | 'nunca';
  dailyCapacityMinutes?: Record<number, number>; // 0 (Dom) a 6 (Sáb) -> minutos planejados
  notificationsEnabled?: boolean;
  notificationTimes?: {
    taskReminderMin: number;
    dailyReviewTime: string; // HH:mm
    closeDayTime: string; // HH:mm
  };
  dailyReviewLimit?: number; // padrão 30
  accuracyThreshold?: number; // padrão 70%
  aiEnabled?: boolean;
  aiSendNotes?: boolean;
  minimumDayMode?: boolean;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  subjectId?: string;
  topicId?: string;
  type: 'teoria' | 'questoes' | 'revisao' | 'outro';
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  actualSeconds: number;
  interrupted: boolean;
  rating?: number; // 1 a 5
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  tasksDone: number;
  xp: number;
  focusSeconds: number;
  mood?: 'otimo' | 'bom' | 'neutro' | 'cansado' | 'estressado';
  energy?: number;
  activeDay: boolean;
}

export interface Subject {
  id: string;
  nome: string;
  cor: string;
  metaSemanalMin: number;
  createdAt: string;
}

export interface StudyGoal {
  id: string;
  nome: string;
  data: string; // YYYY-MM-DD
  subjectIds: string[];
}

export interface ReviewItem {
  id: string;
  kind: 'card' | 'topic';
  front?: string;
  back?: string;
  topicId?: string;
  subjectId?: string;
  easeFactor: number; // default 2.5
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueDate: string; // YYYY-MM-DD
  lastReviewedAt?: string;
}

export interface QuestionLog {
  id: string;
  data: string; // YYYY-MM-DD
  subjectId: string;
  topicId?: string;
  total: number;
  acertos: number;
  tipo: 'questoes' | 'simulado';
  duracaoMin?: number;
  fonte?: string;
}

export interface ErrorNote {
  id: string;
  subjectId?: string;
  topicId?: string;
  texto: string;
  criadoEm: string;
  resolvido: boolean;
}

export interface Objective {
  id: string;
  titulo: string;
  title?: string;
  description?: string;
  horizonte?: 'ano' | 'trimestre' | 'mes';
  horizon?: 'ano' | 'trimestre' | 'mes';
  periodo?: string; // ex: "2026", "2026-Q4", "2026-10"
  status: 'em_andamento' | 'concluido' | 'cancelado' | 'pausado';
  progress?: number;
  createdAt?: string;
}

export interface ProjectMilestone {
  id: string;
  titulo: string;
  data: string;
  feito: boolean;
}

export interface Project {
  id: string;
  objectiveId?: string;
  titulo?: string;
  name?: string;
  marcos?: ProjectMilestone[];
  status: 'ativo' | 'concluido' | 'arquivado' | 'planejado' | 'em_andamento' | 'pausado';
  createdAt?: string;
}

export interface PeriodicReview {
  id: string;
  tipo: 'semanal' | 'mensal' | 'trimestral';
  periodo: string; // ex: "2026-W40"
  data?: string; // YYYY-MM-DD
  createdAt?: string;
  focusHours?: number;
  tasksDone?: number;
  activeDays?: number;
  subjectHours?: Record<string, number>;
  ans1?: string; // O que rendeu?
  ans2?: string; // O que travou?
  ans3?: string; // O que muda na próxima semana?
  nextGoals?: string[];
  respostas?: {
    oQueFuncionou?: string;
    oQueTravou?: string;
    oQueAjustar?: string;
  };
  statsCalculadas?: {
    tarefasConcluidas: number;
    horasFoco: number;
    diasAtivos: number;
  };
  metasProximoCiclo?: string[];
}

export interface CustomReward {
  id: string;
  titulo: string;
  metrica: 'horasFoco' | 'diasAtivos' | 'tarefas' | 'revisoes';
  alvo: number;
  periodo: 'semana' | 'mes';
  resgatadoEm?: string;
}

export interface CloudBackupRecord {
  id: string;
  snapshot_date: string;
  data_size: number;
  created_at: string;
  source: 'auto' | 'manual' | 'pre_restore';
}

export interface SpacedRepetitionItem {
  id: string;
  originalTaskId: string;
  title: string;
  categoryId: string;
  dueDates: string[]; // [1d, 3d, 7d, 15d]
  currentIntervalIndex: number;
  completedIntervals: number[];
  createdAt: string;
}

export interface DatabaseSchema {
  version: number;
  schemaVersion?: number; // Bloco A1: rastreamento de migrações sequenciais
  profile: UserProfile;
  settings: UserSettings;
  categories: Category[];
  tasks: Task[];
  templates: DayTemplate[];
  workoutTemplates?: WorkoutTemplate[];
  subjectStructures?: SubjectStructure[];
  achievements: Achievement[];
  dailyMoods: Record<string, DailyMood>;
  spacedRepetitions: SpacedRepetitionItem[];
  errorLogs?: ErrorLogEntry[];
  studyCycle?: StudyCycleConfig;
  examCountdown?: ExamCountdown;
  flashcards?: Flashcard[];
  simulatedExams?: SimulatedExam[];
  habits?: Habit[];
  bodyMeasurements?: BodyMeasurement[];
  exercisePRs?: Record<string, ExercisePR>;
  distractionNotes?: DistractionNote[];
  focusSummaries?: FocusSessionSummary[];
  trash: Array<Task & { originalDeletedAt: string }>;
  // Bloco A a E
  focusSessions?: FocusSession[];
  dailyStats?: Record<string, DailyStat>;
  archive?: Task[];
  subjects?: Subject[];
  topics?: Topic[];
  goals?: StudyGoal[];
  reviewItems?: ReviewItem[];
  questionLogs?: QuestionLog[];
  errorNotes?: ErrorNote[];
  objectives?: Objective[];
  projects?: Project[];
  reviews?: PeriodicReview[];
  rewards?: CustomReward[];
  cloudBackups?: CloudBackupRecord[];
}

