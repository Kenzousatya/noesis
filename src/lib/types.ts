export const SUBJECT_NAMES = [
  'Mathematics',
  'Physics',
  'Biology',
  'Social Studies',
  'Indonesian',
  'English',
  'Deutsch',
  'Sundanese',
  'Religion',
  'Pancasila',
] as const;

export type SubjectName = (typeof SUBJECT_NAMES)[number];

export const GRADES = [7, 8, 9] as const;
export type Grade = (typeof GRADES)[number];

export type ResourceType = 'pdf' | 'quiz' | 'video';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ViewMode = 'grid' | 'list';

export type DashboardSectionKey =
  | 'today'
  | 'priority'
  | 'timetable'
  | 'continue'
  | 'subjects'
  | 'recent'
  | 'activity';

export interface AppSettings {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  libraryView: ViewMode;
  dashboardHidden: DashboardSectionKey[];
}

export interface BaseResource {
  id: string;
  type: ResourceType;
  subject: SubjectName;
  grade: Grade;
  title: string;
  description?: string;
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface PdfResource extends BaseResource {
  type: 'pdf';
  filename: string;
  size: number;
  fileId?: string;
  /** Used by the bundled repository library, which is served as static files. */
  sourceUrl?: string;
  lastPage?: number;
}

export interface QuizOption {
  id: string;
  text: string;
}

export type QuestionType = 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: QuizOption[];
  /** Option ids, 'true'/'false', or accepted short-answer strings. */
  correctAnswer: string[];
  explanation?: string;
  points: number;
}

export interface QuizSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanations: boolean;
  timerMinutes: number | null;
  passingScore: number;
}

export interface QuizResource extends BaseResource {
  type: 'quiz';
  difficulty?: 'easy' | 'medium' | 'hard';
  settings: QuizSettings;
  questions: QuizQuestion[];
}

export interface VideoResource extends BaseResource {
  type: 'video';
  videoId: string;
  url: string;
  thumbnail?: string;
  /** Optional folder inside this subject and grade. Absent means the root collection. */
  folderId?: string;
}

export type FolderAccent = 'sage' | 'brass' | 'slate' | 'clay' | 'olive';

export interface VideoFolder {
  id: string;
  name: string;
  subject: SubjectName;
  grade: Grade;
  description?: string;
  accent: FolderAccent;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/* ——— Homework & Tasks ——— */

export type TaskCategory =
  | 'homework'
  | 'project'
  | 'exam'
  | 'quiz'
  | 'presentation'
  | 'reading'
  | 'other';

export type TaskImportance = 'low' | 'normal' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskAttachment {
  id: string;
  label: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  /** null means a general task that spans subjects. */
  subject: SubjectName | null;
  category: TaskCategory;
  /** Local calendar date as YYYY-MM-DD, or null when the task is unscheduled. */
  dueDate: string | null;
  /** Local time as HH:MM, optional. */
  dueTime: string | null;
  importance: TaskImportance;
  estimatedMinutes: number | null;
  status: TaskStatus;
  subtasks: Subtask[];
  notes?: string;
  attachments: TaskAttachment[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

/* ——— School schedule ——— */

export type Weekday = 1 | 2 | 3 | 4 | 5;
export type PeriodKind = 'lesson' | 'break';

export interface SchedulePeriod {
  id: string;
  label: string;
  /** Local time as HH:MM. */
  start: string;
  end: string;
  kind: PeriodKind;
}

export interface ScheduleClass {
  id: string;
  name: string;
}

export interface ScheduleEntry {
  id: string;
  classId: string;
  day: Weekday;
  periodId: string;
  subject: SubjectName;
  teacher?: string;
  room?: string;
}

export interface ScheduleDoc {
  id: 'school-schedule';
  classes: ScheduleClass[];
  periods: SchedulePeriod[];
  entries: ScheduleEntry[];
  /** The class currently shown in the timetable. */
  activeClassId: string | null;
  /** Where the period structure came from, for honesty in the interface. */
  source: string;
  updatedAt: number;
}

export type Resource = PdfResource | QuizResource | VideoResource;

export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NormPoint {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  page: number;
  kind: 'highlight' | 'pen';
  color: string;
  rects?: NormRect[];
  points?: NormPoint[];
  text?: string;
  createdAt: number;
}

export interface AnnotationRecord {
  pdfId: string;
  annotations: Annotation[];
  updatedAt: number;
}

export interface PdfFileRecord {
  id: string;
  name: string;
  size: number;
  mime: string;
  blob: Blob;
}

export type AnswerMap = Record<string, string[]>;

export interface Attempt {
  id: string;
  quizId: string;
  quizTitle: string;
  subject: SubjectName;
  grade: Grade;
  startedAt: number;
  completedAt: number;
  score: number;
  maxScore: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  timeSpentMs: number;
  answers: AnswerMap;
}

export type MenuTone = 'default' | 'danger';

export interface SearchHit {
  resource: Resource;
  score: number;
  matchedField: string;
}
