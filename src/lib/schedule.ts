import type { ScheduleClass, ScheduleDoc, ScheduleEntry, SchedulePeriod, SubjectName, Weekday } from './types';
import { WEEKDAY_LABEL } from './tasks';

export const SCHOOL_DAYS: Weekday[] = [1, 2, 3, 4, 5];

export const SUBJECT_TINT: Record<SubjectName, string> = {
  Mathematics: '#8BBFA8',
  Physics: '#8FA6C4',
  Biology: '#9DBE8A',
  'Social Studies': '#C4AD84',
  Indonesian: '#C99A82',
  English: '#A6A9C9',
  Deutsch: '#C6B98C',
  Sundanese: '#B6C48B',
  Religion: '#C79FB0',
  Pancasila: '#D0A77E',
};

export function parseTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

export function minutesNow(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function todayWeekday(date = new Date()): Weekday | null {
  const day = date.getDay();
  return day >= 1 && day <= 5 ? (day as Weekday) : null;
}

export function sortPeriods(periods: SchedulePeriod[]): SchedulePeriod[] {
  return [...periods].sort((a, b) => parseTime(a.start) - parseTime(b.start));
}

export function entriesFor(doc: ScheduleDoc, classId: string, day: Weekday): ScheduleEntry[] {
  return doc.entries.filter((entry) => entry.classId === classId && entry.day === day);
}

export function entryAt(
  doc: ScheduleDoc,
  classId: string,
  day: Weekday,
  periodId: string,
): ScheduleEntry | undefined {
  return doc.entries.find(
    (entry) => entry.classId === classId && entry.day === day && entry.periodId === periodId,
  );
}

export function periodById(doc: ScheduleDoc, periodId: string): SchedulePeriod | undefined {
  return doc.periods.find((period) => period.id === periodId);
}

export interface Slot {
  entry: ScheduleEntry;
  period: SchedulePeriod;
  teacher?: string;
  room?: string;
}

/** Every lesson in the week, resolved with its period and ordered chronologically. */
export function weekSlots(doc: ScheduleDoc, classId: string): Array<Slot & { day: Weekday }> {
  const slots: Array<Slot & { day: Weekday }> = [];
  for (const day of SCHOOL_DAYS) {
    for (const entry of entriesFor(doc, classId, day)) {
      const period = periodById(doc, entry.periodId);
      if (period && period.kind === 'lesson') slots.push({ entry, period, day, teacher: entry.teacher, room: entry.room });
    }
  }
  return slots.sort((a, b) => a.day - b.day || parseTime(a.period.start) - parseTime(b.period.start));
}

export interface ScheduleStatus {
  current: (Slot & { day: Weekday }) | null;
  next: (Slot & { day: Weekday }) | null;
  minutesUntilNext: number | null;
}

export function scheduleStatus(doc: ScheduleDoc, classId: string, now = new Date()): ScheduleStatus {
  const slots = weekSlots(doc, classId);
  const day = todayWeekday(now);
  const minutes = minutesNow(now);

  let current: (Slot & { day: Weekday }) | null = null;
  if (day) {
    for (const slot of slots) {
      if (slot.day !== day) continue;
      const start = parseTime(slot.period.start);
      const end = parseTime(slot.period.end);
      if (minutes >= start && minutes < end) current = slot;
    }
  }

  let next: (Slot & { day: Weekday }) | null = null;
  let minutesUntilNext: number | null = null;

  if (day) {
    const todayLater = slots.filter(
      (slot) => slot.day === day && parseTime(slot.period.start) > minutes,
    );
    if (todayLater.length) {
      next = todayLater[0];
      minutesUntilNext = parseTime(next.period.start) - minutes;
    }
  }

  if (!next) {
    const currentDay = day ?? 1;
    const laterDays = slots
      .filter((slot) => slot.day > currentDay)
      .sort((a, b) => a.day - b.day || parseTime(a.period.start) - parseTime(b.period.start));
    next = laterDays[0] ?? slots[0] ?? null;
    if (next) {
      const dayDelta = day ? next.day - day : 0;
      minutesUntilNext = dayDelta * 24 * 60 + parseTime(next.period.start) - minutes;
    }
  }

  return { current, next, minutesUntilNext };
}

export function todaySlots(doc: ScheduleDoc, classId: string, now = new Date()): Slot[] {
  const day = todayWeekday(now);
  if (!day) return [];
  const periods = sortPeriods(doc.periods);
  const slots: Slot[] = [];
  for (const period of periods) {
    const entry = entryAt(doc, classId, day, period.id);
    if (entry) slots.push({ entry, period, teacher: entry.teacher, room: entry.room });
  }
  return slots;
}

export function countLessons(doc: ScheduleDoc, classId?: string): number {
  return doc.entries.filter((entry) => (classId ? entry.classId === classId : true)).length;
}

export function emptySchedule(): ScheduleDoc {
  return {
    id: 'school-schedule',
    classes: [],
    periods: [],
    entries: [],
    activeClassId: null,
    source: '',
    updatedAt: Date.now(),
  };
}

export function classLabel(classes: ScheduleClass[], classId: string | null): string {
  if (!classId) return 'No class selected';
  return classes.find((entry) => entry.id === classId)?.name ?? 'No class selected';
}

export { WEEKDAY_LABEL };
