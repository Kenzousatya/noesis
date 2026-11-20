import type { Task, TaskCategory, TaskImportance, TaskStatus, Weekday } from './types';

export const IMPORTANCE_WEIGHT: Record<TaskImportance, number> = {
  low: 8,
  normal: 20,
  high: 38,
  critical: 58,
};

export const IMPORTANCE_LABEL: Record<TaskImportance, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

export const CATEGORY_LABEL: Record<TaskCategory, string> = {
  homework: 'Homework',
  project: 'Project',
  exam: 'Exam preparation',
  quiz: 'Quiz preparation',
  presentation: 'Presentation',
  reading: 'Reading',
  other: 'Other',
};

export const CATEGORY_WEIGHT: Record<TaskCategory, number> = {
  exam: 10,
  project: 8,
  quiz: 6,
  presentation: 5,
  homework: 2,
  reading: 1,
  other: 0,
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  done: 'Completed',
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

/* ——— Dates ——— */

const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

/** Milliseconds until the deadline (end of the due day when no time is given). */
export function dueTimestamp(task: Pick<Task, 'dueDate' | 'dueTime'>): number | null {
  if (!task.dueDate) return null;
  const date = fromDateKey(task.dueDate);
  if (!date) return null;
  if (task.dueTime) {
    const [hours, minutes] = task.dueTime.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      date.setHours(hours, minutes, 0, 0);
      return date.getTime();
    }
  }
  date.setHours(23, 59, 0, 0);
  return date.getTime();
}

export function wholeDaysUntil(task: Pick<Task, 'dueDate'>): number | null {
  if (!task.dueDate) return null;
  const due = fromDateKey(task.dueDate);
  if (!due) return null;
  const today = startOfDay(new Date());
  return Math.round((startOfDay(due).getTime() - today.getTime()) / DAY_MS);
}

export function isOverdue(task: Task): boolean {
  if (task.status === 'done') return false;
  const due = dueTimestamp(task);
  return due !== null && due < Date.now();
}

export function isDueToday(task: Task): boolean {
  if (task.status === 'done' || !task.dueDate) return false;
  return task.dueDate === toDateKey(new Date());
}

export type TaskUrgency = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'unscheduled';

export interface TaskPriority {
  score: number;
  urgency: TaskUrgency;
  /** Short human explanation shown next to the task. */
  label: string;
  reasons: string[];
}

/**
 * Transparent priority score. Deadline proximity dominates, manual importance
 * shapes the middle, and workload only nudges — a huge task never outranks an
 * urgent one on size alone.
 */
export function priorityOf(task: Task, now = Date.now()): TaskPriority {
  const due = dueTimestamp(task);
  const days = wholeDaysUntil(task);
  const hoursLeft = due === null ? null : (due - now) / 3_600_000;
  const reasons: string[] = [];
  let score = IMPORTANCE_WEIGHT[task.importance];
  let urgency: TaskUrgency = 'unscheduled';

  if (due === null) {
    score -= 12;
    urgency = 'unscheduled';
    reasons.push('No deadline');
  } else if (due < now) {
    const overdueDays = Math.max(1, Math.floor((now - due) / DAY_MS));
    score += 70 + Math.min(20, overdueDays * 3);
    urgency = 'overdue';
    reasons.push(`Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}`);
  } else if (days !== null && days <= 0) {
    score += 60;
    urgency = 'today';
    reasons.push(task.dueTime ? `Due today at ${task.dueTime}` : 'Due today');
  } else if (days === 1) {
    score += 48;
    urgency = 'tomorrow';
    reasons.push('Due tomorrow');
  } else if (days !== null && days <= 5) {
    score += 34;
    urgency = 'week';
    reasons.push(`Due in ${days} days`);
  } else if (days !== null && days <= 10) {
    score += 20;
    urgency = 'later';
    reasons.push(`Due in ${days} days`);
  } else if (days !== null && days <= 21) {
    score += 10;
    urgency = 'later';
    reasons.push(`Due in ${days} days`);
  } else {
    score += 4;
    urgency = 'later';
    reasons.push(`Due in ${days} days`);
  }

  if (task.category === 'exam' || task.category === 'project' || task.category === 'quiz') {
    score += CATEGORY_WEIGHT[task.category];
    reasons.push(CATEGORY_LABEL[task.category]);
  }

  if (task.estimatedMinutes) {
    score += Math.min(8, task.estimatedMinutes / 120);
    if (task.estimatedMinutes >= 90) reasons.push(`About ${formatEstimate(task.estimatedMinutes)} of work`);
  }

  if (task.status === 'in_progress') {
    score += 4;
    reasons.push('In progress');
  }

  if (task.importance === 'critical' || task.importance === 'high') {
    reasons.push(`${IMPORTANCE_LABEL[task.importance]} importance`);
  }

  // A near deadline can still be worth more than a distant "critical" flag.
  if (hoursLeft !== null && hoursLeft > 0 && hoursLeft <= 12) {
    score += 6;
  }

  return {
    score: Math.round(score * 10) / 10,
    urgency,
    label: reasons.slice(0, 3).join(' · '),
    reasons,
  };
}

export function sortByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const delta = priorityOf(b).score - priorityOf(a).score;
    if (Math.abs(delta) > 0.01) return delta;
    return (dueTimestamp(a) ?? Number.POSITIVE_INFINITY) - (dueTimestamp(b) ?? Number.POSITIVE_INFINITY);
  });
}

export function formatEstimate(minutes: number | null): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatDueLabel(task: Task): string {
  if (!task.dueDate) return 'No deadline';
  const days = wholeDaysUntil(task);
  const date = fromDateKey(task.dueDate);
  const formatted = date
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : task.dueDate;
  const time = task.dueTime ? `, ${task.dueTime}` : '';
  if (days === null) return `${formatted}${time}`;
  if (days < 0) {
    const overdue = Math.abs(days);
    return `${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`;
  }
  if (days === 0) return `Today${time}`;
  if (days === 1) return `Tomorrow${time}`;
  if (days < 7) return `${formatted}${time} · in ${days} days`;
  return `${formatted}${time}`;
}

export function checklistProgress(task: Task): { done: number; total: number; percent: number } {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((entry) => entry.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function upcomingGroup(task: Task): 'today' | 'tomorrow' | 'week' | 'next' | 'later' | 'unscheduled' {
  const days = wholeDaysUntil(task);
  if (days === null) return 'unscheduled';
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  if (days <= 14) return 'next';
  return 'later';
}

export function emptyTask(): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    title: '',
    description: '',
    subject: null,
    category: 'homework',
    dueDate: toDateKey(new Date()),
    dueTime: null,
    importance: 'normal',
    estimatedMinutes: 60,
    status: 'todo',
    subtasks: [],
    notes: '',
    attachments: [],
    completedAt: null,
  };
}
