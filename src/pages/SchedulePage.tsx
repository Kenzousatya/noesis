import { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Info,
  MapPin,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { ScheduleDoc, ScheduleEntry, SchedulePeriod, SubjectName, Weekday } from '../lib/types';
import { SUBJECTS } from '../lib/constants';
import { useWorkspace } from '../state/WorkspaceProvider';
import {
  SCHOOL_DAYS,
  SUBJECT_TINT,
  minutesNow,
  parseTime,
  scheduleStatus,
  sortPeriods,
  todayWeekday,
} from '../lib/schedule';
import { WEEKDAY_LABEL } from '../lib/tasks';
import { cn, uid } from '../lib/utils';
import { Badge, Button, EmptyState, Field, Input, Segmented, Select } from '../components/ui';
import { Dialog, ConfirmDialog } from '../components/Dialog';
import { useToast } from '../state/ToastProvider';

const DEFAULT_PERIODS: Array<Pick<SchedulePeriod, 'label' | 'start' | 'end' | 'kind'>> = [
  { label: 'Period 1', start: '07:00', end: '07:40', kind: 'lesson' },
  { label: 'Period 2', start: '07:40', end: '08:20', kind: 'lesson' },
  { label: 'Break', start: '08:20', end: '08:40', kind: 'break' },
  { label: 'Period 3', start: '08:40', end: '09:20', kind: 'lesson' },
];

function TimeText({ value }: { value: string }) {
  return <span className="tabular-nums">{value}</span>;
}

/* ————————————————— Setup ————————————————— */

function SetupWizard({ onDone }: { onDone: (doc: ScheduleDoc) => void }) {
  const [step, setStep] = useState(0);
  const [names, setNames] = useState(['', '', '']);
  const [periods, setPeriods] = useState<SchedulePeriod[]>(() =>
    DEFAULT_PERIODS.map((entry) => ({ ...entry, id: uid('per') })),
  );
  const [error, setError] = useState('');

  const validNames = names.every((name) => name.trim().length > 0);
  const lessonCount = periods.filter((period) => period.kind === 'lesson').length;

  const start = () => {
    if (!validNames) {
      setError('Name all three bilingual classes exactly as they appear on the timetable.');
      return;
    }
    if (lessonCount === 0) {
      setError('Add at least one lesson period, or edit the sample rows to match the official times.');
      return;
    }
    const classes = names.map((name) => ({ id: uid('c'), name: name.trim() }));
    const ordered = sortPeriods(periods).map((period, index) => ({ ...period, label: period.label || `Period ${index + 1}` }));
    onDone({
      id: 'school-schedule',
      classes,
      periods: ordered,
      entries: [],
      activeClassId: classes[0].id,
      source: 'Entered from the official timetable by the user',
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">School schedule</p>
        <h1 className="editorial mt-2 text-[28px] leading-tight text-ink sm:text-[34px]">Build your timetable.</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink2">
          NOEMA starts empty on purpose: it will not guess class names, period times or lessons. Enter the three
          bilingual classes and the official period structure, then place each lesson in the grid.
        </p>
      </header>

      <div className="flex items-center gap-2 text-[11px] text-muted">
        {['Classes', 'Periods', 'Lessons'].map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                index === step
                  ? 'border-accent bg-accent text-onaccent'
                  : index < step
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-line bg-panel2 text-muted',
              )}
            >
              {index < step ? <Check size={10} strokeWidth={3} /> : index + 1}
            </span>
            <span className={index === step ? 'text-ink' : undefined}>{label}</span>
            {index < 2 && <span className="h-px w-6 bg-line" aria-hidden="true" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <section className="rounded-panel border border-line bg-panel p-5">
          <h2 className="text-[14px] font-semibold text-ink">The three intended bilingual classes</h2>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-ink2">
            Copy the identifiers from the timetable document — for example the three BIL columns that belong to your
            schedule. Other class columns are never imported.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {names.map((name, index) => (
              <Field key={index} label={`Class ${index + 1}`} htmlFor={`class-${index}`}>
                <Input
                  id={`class-${index}`}
                  value={name}
                  onChange={(event) => {
                    const next = [...names];
                    next[index] = event.target.value;
                    setNames(next);
                    setError('');
                  }}
                  placeholder={index === 0 ? 'e.g. 7 BIL' : index === 1 ? 'e.g. 8 BIL' : 'e.g. 9 BIL'}
                />
              </Field>
            ))}
          </div>
          {error && <p className="mt-3 text-[11.5px] text-danger">{error}</p>}
          <div className="mt-5 flex justify-end">
            <Button
              onClick={() => {
                if (!validNames) {
                  setError('Name all three bilingual classes exactly as they appear on the timetable.');
                  return;
                }
                setError('');
                setStep(1);
              }}
            >
              Continue <ChevronRight size={14} />
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="rounded-panel border border-line bg-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Period structure</h2>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-ink2">
                Enter the times printed on the official schedule, including breaks. The sample rows below are
                placeholders to replace — they are not claimable as your school&apos;s times.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPeriods((current) => [
                  ...current,
                  { id: uid('per'), label: `Period ${current.filter((p) => p.kind === 'lesson').length + 1}`, start: '09:00', end: '09:40', kind: 'lesson' },
                ])
              }
            >
              <Plus size={13} /> Add row
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {periods.map((period, index) => (
              <div key={period.id} className="grid grid-cols-2 items-end gap-2 rounded-card border border-line bg-panel2/40 p-2.5 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                <Field label="Label" htmlFor={`p-label-${period.id}`}>
                  <Input
                    id={`p-label-${period.id}`}
                    value={period.label}
                    onChange={(event) =>
                      setPeriods((current) =>
                        current.map((entry) => (entry.id === period.id ? { ...entry, label: event.target.value } : entry)),
                      )
                    }
                  />
                </Field>
                <Field label="Start" htmlFor={`p-start-${period.id}`}>
                  <Input
                    id={`p-start-${period.id}`}
                    type="time"
                    value={period.start}
                    onChange={(event) =>
                      setPeriods((current) =>
                        current.map((entry) => (entry.id === period.id ? { ...entry, start: event.target.value } : entry)),
                      )
                    }
                  />
                </Field>
                <Field label="End" htmlFor={`p-end-${period.id}`}>
                  <Input
                    id={`p-end-${period.id}`}
                    type="time"
                    value={period.end}
                    onChange={(event) =>
                      setPeriods((current) =>
                        current.map((entry) => (entry.id === period.id ? { ...entry, end: event.target.value } : entry)),
                      )
                    }
                  />
                </Field>
                <Field label="Kind" htmlFor={`p-kind-${period.id}`}>
                  <Select
                    id={`p-kind-${period.id}`}
                    className="w-full"
                    value={period.kind}
                    onChange={(event) =>
                      setPeriods((current) =>
                        current.map((entry) =>
                          entry.id === period.id ? { ...entry, kind: event.target.value as 'lesson' | 'break' } : entry,
                        ),
                      )
                    }
                  >
                    <option value="lesson">Lesson</option>
                    <option value="break">Break</option>
                  </Select>
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${period.label || `row ${index + 1}`}`}
                  onClick={() => setPeriods((current) => current.filter((entry) => entry.id !== period.id))}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>

          {error && <p className="mt-3 text-[11.5px] text-danger">{error}</p>}

          <div className="mt-5 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(0)}>
              <ChevronLeft size={14} /> Back
            </Button>
            <Button onClick={start}>
              Create timetable <ArrowRight size={14} />
            </Button>
          </div>
        </section>
      )}

      <div className="flex gap-2.5 rounded-card border border-line bg-panel2/40 p-3 text-[11px] leading-relaxed text-ink2">
        <Info size={14} className="mt-0.5 shrink-0 text-accent2" aria-hidden="true" />
        <p>
          The timetable PDF itself is not bundled with this app, so nothing is pre-filled. Once the structure exists,
          you place lessons by clicking cells in the weekly grid; everything is saved locally and included in backups.
        </p>
      </div>
    </div>
  );
}

/* ————————————————— Entry editor ————————————————— */

function EntryDialog({
  open,
  onClose,
  doc,
  day,
  periodId,
  entry,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  doc: ScheduleDoc;
  day: Weekday | null;
  periodId: string | null;
  entry?: ScheduleEntry;
  onSave: (entry: ScheduleEntry) => void;
  onDelete?: () => void;
}) {
  const [subject, setSubject] = useState<SubjectName>(entry?.subject ?? 'Mathematics');
  const [teacher, setTeacher] = useState(entry?.teacher ?? '');
  const [room, setRoom] = useState(entry?.room ?? '');
  const [key, setKey] = useState('');

  const period = doc.periods.find((item) => item.id === periodId);
  const identity = `${open}-${day ?? ''}-${periodId ?? ''}-${entry?.id ?? ''}`;
  if (identity !== key) {
    setKey(identity);
    setSubject(entry?.subject ?? 'Mathematics');
    setTeacher(entry?.teacher ?? '');
    setRoom(entry?.room ?? '');
  }

  if (!day || !periodId || !period) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={entry ? 'Edit lesson' : 'Add a lesson'}
      description={`${WEEKDAY_LABEL[day]} · ${period.label} · ${period.start}–${period.end}`}
      footer={
        <>
          {entry && onDelete && (
            <Button variant="danger" onClick={onDelete} className="mr-auto">
              <Trash2 size={14} /> Remove lesson
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                id: entry?.id ?? uid('se'),
                classId: doc.activeClassId ?? doc.classes[0]?.id ?? '',
                day,
                periodId,
                subject,
                teacher: teacher.trim() || undefined,
                room: room.trim() || undefined,
              })
            }
          >
            {entry ? 'Save lesson' : 'Add lesson'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Subject" htmlFor="entry-subject">
          <Select
            id="entry-subject"
            className="w-full"
            value={subject}
            onChange={(event) => setSubject(event.target.value as SubjectName)}
          >
            {SUBJECTS.map((item) => (
              <option key={item.slug} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Teacher code" htmlFor="entry-teacher" hint="Optional — only if the document shows it.">
            <Input
              id="entry-teacher"
              value={teacher}
              onChange={(event) => setTeacher(event.target.value)}
              placeholder="e.g. MTH-01"
            />
          </Field>
          <Field label="Room" htmlFor="entry-room" hint="Optional.">
            <Input id="entry-room" value={room} onChange={(event) => setRoom(event.target.value)} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

/* ————————————————— Structure editor ————————————————— */

function StructureDialog({
  open,
  onClose,
  doc,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  doc: ScheduleDoc;
  onSave: (doc: ScheduleDoc) => void;
}) {
  const [periods, setPeriods] = useState<SchedulePeriod[]>(doc.periods);
  const [classes, setClasses] = useState(doc.classes);
  const [key, setKey] = useState('');
  const identity = `${open}-${doc.updatedAt}`;
  if (identity !== key) {
    setKey(identity);
    setPeriods(doc.periods);
    setClasses(doc.classes);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Timetable structure"
      description="Edit class names and period times. Removing a period also removes its lessons."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...doc,
                classes,
                periods: sortPeriods(periods),
                entries: doc.entries.filter(
                  (entry) =>
                    periods.some((period) => period.id === entry.periodId) &&
                    classes.some((item) => item.id === entry.classId),
                ),
                activeClassId: classes.some((item) => item.id === doc.activeClassId)
                  ? doc.activeClassId
                  : classes[0]?.id ?? null,
              })
            }
          >
            Save structure
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Classes</h3>
          <div className="flex flex-col gap-2">
            {classes.map((item) => (
              <div key={item.id} className="flex gap-2">
                <Input
                  value={item.name}
                  onChange={(event) =>
                    setClasses((current) =>
                      current.map((entry) => (entry.id === item.id ? { ...entry, name: event.target.value } : entry)),
                    )
                  }
                  aria-label="Class name"
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted">Periods</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPeriods((current) => [
                  ...current,
                  { id: uid('per'), label: `Period ${current.length + 1}`, start: '10:00', end: '10:40', kind: 'lesson' },
                ])
              }
            >
              <Plus size={13} /> Add period
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {periods.map((period) => (
              <div key={period.id} className="grid grid-cols-2 gap-2 rounded-card border border-line bg-panel2/40 p-2.5 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                <Input
                  value={period.label}
                  aria-label="Period label"
                  onChange={(event) =>
                    setPeriods((current) =>
                      current.map((entry) => (entry.id === period.id ? { ...entry, label: event.target.value } : entry)),
                    )
                  }
                />
                <Input
                  type="time"
                  value={period.start}
                  aria-label="Start time"
                  onChange={(event) =>
                    setPeriods((current) =>
                      current.map((entry) => (entry.id === period.id ? { ...entry, start: event.target.value } : entry)),
                    )
                  }
                />
                <Input
                  type="time"
                  value={period.end}
                  aria-label="End time"
                  onChange={(event) =>
                    setPeriods((current) =>
                      current.map((entry) => (entry.id === period.id ? { ...entry, end: event.target.value } : entry)),
                    )
                  }
                />
                <Select
                  value={period.kind}
                  aria-label="Period kind"
                  className="w-full"
                  onChange={(event) =>
                    setPeriods((current) =>
                      current.map((entry) =>
                        entry.id === period.id ? { ...entry, kind: event.target.value as 'lesson' | 'break' } : entry,
                      ),
                    )
                  }
                >
                  <option value="lesson">Lesson</option>
                  <option value="break">Break</option>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${period.label}`}
                  onClick={() => setPeriods((current) => current.filter((entry) => entry.id !== period.id))}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Dialog>
  );
}

/* ————————————————— Page ————————————————— */

export default function SchedulePage() {
  const { schedule, saveSchedule } = useWorkspace();
  const toast = useToast();
  const [mode, setMode] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState<Weekday>(todayWeekday() ?? 1);
  const [entryTarget, setEntryTarget] = useState<{ day: Weekday; periodId: string } | null>(null);
  const [structureOpen, setStructureOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const activeClassId = schedule.activeClassId ?? schedule.classes[0]?.id ?? null;
  const status = useMemo(
    () => (activeClassId ? scheduleStatus(schedule, activeClassId) : { current: null, next: null, minutesUntilNext: null }),
    [schedule, activeClassId],
  );
  const periods = useMemo(() => sortPeriods(schedule.periods), [schedule.periods]);
  const today = todayWeekday();
  const nowMinutes = minutesNow();

  const entryFor = (classId: string, weekday: Weekday, periodId: string) =>
    schedule.entries.find(
      (entry) => entry.classId === classId && entry.day === weekday && entry.periodId === periodId,
    );

  if (schedule.classes.length === 0) {
    return (
      <SetupWizard
        onDone={async (doc) => {
          await saveSchedule(doc);
          toast.success('Timetable structure created', 'Place lessons by clicking cells in the weekly grid.');
        }}
      />
    );
  }

  const cell = (weekday: Weekday, period: SchedulePeriod, classId: string) => {
    const entry = entryFor(classId, weekday, period.id);
    const start = parseTime(period.start);
    const end = parseTime(period.end);
    const isNow = today === weekday && nowMinutes >= start && nowMinutes < end;
    const isNext =
      status.next &&
      status.next.day === weekday &&
      status.next.entry.id === entry?.id &&
      !isNow;

    if (!entry) {
      return (
        <button
          key={`${weekday}-${period.id}`}
          type="button"
          onClick={() => setEntryTarget({ day: weekday, periodId: period.id })}
          className="group flex min-h-[64px] w-full flex-col justify-center rounded-[5px] border border-dashed border-line/80 px-2 py-1.5 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.04]"
        >
          <span className="flex items-center gap-1 text-[10px] text-muted/50 transition-colors group-hover:text-accent">
            <Plus size={10} aria-hidden="true" /> Lesson
          </span>
        </button>
      );
    }

    const tint = SUBJECT_TINT[entry.subject] ?? '#8BBFA8';
    return (
      <button
        key={`${weekday}-${period.id}`}
        type="button"
        onClick={() => setEntryTarget({ day: weekday, periodId: period.id })}
        style={{ borderColor: `${tint}55`, backgroundColor: `${tint}14` }}
        className={cn(
          'relative flex min-h-[64px] w-full flex-col gap-0.5 rounded-[5px] border px-2 py-1.5 text-left transition-shadow',
          isNow && 'ring-1 ring-inset ring-accent',
          isNext && 'ring-1 ring-inset ring-accent2/50',
        )}
      >
        <span className="flex items-center gap-1">
          <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-ink">{entry.subject}</span>
          {isNow && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Current class" />}
        </span>
        {(entry.teacher || entry.room) && (
          <span className="flex items-center gap-1 text-[9.5px] text-ink2">
            {entry.teacher && <span className="truncate">{entry.teacher}</span>}
            {entry.room && (
              <span className="inline-flex items-center gap-0.5">
                <MapPin size={8} aria-hidden="true" />
                {entry.room}
              </span>
            )}
          </span>
        )}
        {isNext && (
          <span className="absolute bottom-1 right-1 text-[8.5px] uppercase tracking-[0.08em] text-accent2">next</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Personal organisation</p>
          <h1 className="editorial mt-2 text-[28px] leading-tight text-ink sm:text-[34px]">School Schedule.</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink2">
            Three bilingual classes, placed by you. Switch class to see a different week.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-input border border-line bg-panel2 p-0.5">
            {schedule.classes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void saveSchedule({ ...schedule, activeClassId: item.id })}
                className={cn(
                  'rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                  item.id === activeClassId ? 'bg-panel text-ink shadow-sm' : 'text-ink2 hover:text-ink',
                )}
                aria-pressed={item.id === activeClassId}
              >
                {item.name}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setStructureOpen(true)}>
            <Settings2 size={13} /> Structure
          </Button>
          {activeClassId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDay(todayWeekday() ?? 1);
                setMode(today ? 'day' : 'week');
              }}
              title="Jump to today"
            >
              <CalendarDays size={13} /> Today
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-panel border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            <Clock3 size={12} aria-hidden="true" /> Now
          </div>
          {status.current ? (
            <>
              <p className="mt-2 text-[20px] font-semibold leading-tight text-ink">{status.current.entry.subject}</p>
              <p className="mt-1 text-[11.5px] text-ink2">
                Until {status.current.period.end}
                {status.current.teacher ? ` · ${status.current.teacher}` : ''}
                {status.current.room ? ` · ${status.current.room}` : ''}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ink2">
              {today ? 'No class in progress right now.' : 'It is the weekend — no scheduled classes.'}
            </p>
          )}
          <span
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ backgroundColor: status.current ? SUBJECT_TINT[status.current.entry.subject] : '#8BBFA8' }}
            aria-hidden="true"
          />
        </div>

        <div className="rounded-panel border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            <ArrowRight size={12} aria-hidden="true" /> Next class
          </div>
          {status.next ? (
            <>
              <p className="mt-2 text-[20px] font-semibold leading-tight text-ink">{status.next.entry.subject}</p>
              <p className="mt-1 text-[11.5px] text-ink2">
                {WEEKDAY_LABEL[status.next.day]} · {status.next.period.start}–{status.next.period.end}
                {status.minutesUntilNext !== null && status.minutesUntilNext >= 0 && status.minutesUntilNext < 600
                  ? ` · in ${status.minutesUntilNext} min`
                  : ''}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-ink2">No lessons placed yet. Click a grid cell to add one.</p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<'week' | 'day'>
          label="Timetable view"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
          ]}
          size="sm"
        />
        {mode === 'day' && (
          <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-input border border-line bg-panel2 p-0.5">
            {SCHOOL_DAYS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDay(value)}
                className={cn(
                  'whitespace-nowrap rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                  value === day ? 'bg-panel text-ink shadow-sm' : 'text-ink2 hover:text-ink',
                )}
                aria-pressed={value === day}
              >
                {WEEKDAY_LABEL[value].slice(0, 3)}
              </button>
            ))}
          </div>
        )}
        <p className="text-[10.5px] text-muted">
          {schedule.entries.length} lesson{schedule.entries.length === 1 ? '' : 's'} placed · {schedule.periods.length}{' '}
          periods
        </p>
      </div>

      {activeClassId && mode === 'week' && (
        <div className="hidden overflow-hidden rounded-panel border border-line bg-panel md:block">
          <div
            className="grid border-b border-line bg-panel2/50"
            style={{ gridTemplateColumns: `66px repeat(5, minmax(0, 1fr))` }}
          >
            <div className="px-2 py-2 text-[9px] uppercase tracking-[0.12em] text-muted">Time</div>
            {SCHOOL_DAYS.map((value) => (
              <div
                key={value}
                className={cn(
                  'border-l border-line px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em]',
                  today === value ? 'bg-accent/[0.06] text-accent' : 'text-ink2',
                )}
              >
                {WEEKDAY_LABEL[value]}
                {today === value && <span className="ml-1.5 inline-block h-1 w-1 rounded-full bg-accent align-middle" />}
              </div>
            ))}
          </div>

          {periods.map((period) => (
            <div
              key={period.id}
              className={cn(
                'grid border-b border-line/70 last:border-b-0',
                period.kind === 'break' && 'bg-panel2/40',
              )}
              style={{ gridTemplateColumns: `66px repeat(5, minmax(0, 1fr))` }}
            >
              <div className="flex flex-col justify-center px-2 py-1.5 text-[9.5px] leading-tight text-muted">
                <span className="font-semibold text-ink2">{period.start}</span>
                <span>{period.end}</span>
              </div>
              {period.kind === 'break' ? (
                <div className="col-span-5 flex items-center gap-2 border-l border-line px-3 py-2">
                  <Coffee size={12} className="text-accent2" aria-hidden="true" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent2">
                    {period.label}
                  </span>
                  <span className="text-[9.5px] text-muted">
                    {period.start}–{period.end}
                  </span>
                  <span className="ml-auto text-[9px] uppercase tracking-[0.1em] text-muted/70">Break</span>
                </div>
              ) : (
                SCHOOL_DAYS.map((weekday) => (
                  <div
                    key={weekday}
                    className={cn(
                      'border-l border-line p-1',
                      today === weekday && 'bg-accent/[0.03]',
                    )}
                  >
                    {cell(weekday, period, activeClassId)}
                  </div>
                ))
              )}
            </div>
          ))}
          {schedule.periods.length === 0 && (
            <p className="p-6 text-center text-[12px] text-ink2">Add periods in Structure, then place lessons.</p>
          )}
        </div>
      )}

      {activeClassId && mode === 'week' && (
        <div className="md:hidden">
          <div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto">
            {SCHOOL_DAYS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode('day');
                  setDay(value);
                }}
                className={cn(
                  'shrink-0 rounded-btn border px-3 py-1.5 text-[11.5px]',
                  today === value
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-line bg-panel text-ink2',
                )}
              >
                {WEEKDAY_LABEL[value].slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-ink2">Choose a day to see its timeline.</p>
        </div>
      )}

      {activeClassId && mode === 'day' && (
        <div className="overflow-hidden rounded-panel border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink2">
              {WEEKDAY_LABEL[day]}
              {today === day && <span className="ml-2 text-[9.5px] uppercase tracking-[0.1em] text-accent">today</span>}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous day"
                onClick={() => setDay((current) => (current === 1 ? 5 : ((current - 1) as Weekday)))}
              >
                <ChevronLeft size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next day"
                onClick={() => setDay((current) => (current === 5 ? 1 : ((current + 1) as Weekday)))}
              >
                <ChevronRight size={15} />
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-line/70">
            {periods.map((period) => {
              const entry = entryFor(activeClassId, day, period.id);
              const start = parseTime(period.start);
              const end = parseTime(period.end);
              const isNow = today === day && nowMinutes >= start && nowMinutes < end;
              const isNext = status.next?.day === day && status.next.entry.id === entry?.id && !isNow;
              if (period.kind === 'break') {
                return (
                  <li key={period.id} className="flex items-center gap-3 bg-panel2/40 px-3 py-2.5">
                    <span className="w-14 shrink-0 text-[10px] tabular-nums text-muted">
                      <TimeText value={period.start} />
                    </span>
                    <Coffee size={13} className="text-accent2" aria-hidden="true" />
                    <span className="text-[11.5px] font-medium text-accent2">{period.label}</span>
                    <span className="ml-auto text-[10px] text-muted">break</span>
                  </li>
                );
              }
              return (
                <li key={period.id} className={cn('flex gap-3 px-3 py-2.5', isNow && 'bg-accent/[0.06]')}>
                  <span className="w-14 shrink-0 pt-0.5 text-[10.5px] tabular-nums text-muted">
                    {period.start}
                    <span className="block text-[9px] text-muted/70">{period.end}</span>
                  </span>
                  {entry ? (
                    <button
                      type="button"
                      onClick={() => setEntryTarget({ day, periodId: period.id })}
                      className="flex min-w-0 flex-1 flex-col text-left"
                      style={{ borderLeft: `2px solid ${SUBJECT_TINT[entry.subject]}`, paddingLeft: 10 }}
                    >
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                        {entry.subject}
                        {isNow && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="Current class" />}
                        {isNext && <Badge tone="warm">next</Badge>}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-muted">
                        {entry.teacher && (
                          <span className="inline-flex items-center gap-1">
                            <User size={9} aria-hidden="true" /> {entry.teacher}
                          </span>
                        )}
                        {entry.room && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={9} aria-hidden="true" /> {entry.room}
                          </span>
                        )}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEntryTarget({ day, periodId: period.id })}
                      className="flex-1 rounded border border-dashed border-line px-2 py-1 text-left text-[11px] text-muted hover:border-accent/50 hover:text-ink2"
                    >
                      Free · add a lesson
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Info size={11} aria-hidden="true" /> Source: {schedule.source || 'manual entry'} — editable, never overwritten
          by an import.
        </span>
        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="inline-flex items-center gap-1 text-[10.5px] text-muted transition-colors hover:text-danger"
        >
          <X size={11} /> Clear schedule setup
        </button>
      </div>

      <EntryDialog
        open={Boolean(entryTarget)}
        onClose={() => setEntryTarget(null)}
        doc={schedule}
        day={entryTarget?.day ?? null}
        periodId={entryTarget?.periodId ?? null}
        entry={
          entryTarget && activeClassId
            ? entryFor(activeClassId, entryTarget.day, entryTarget.periodId)
            : undefined
        }
        onSave={async (entry) => {
          const exists = schedule.entries.some((item) => item.id === entry.id);
          const entries = exists
            ? schedule.entries.map((item) => (item.id === entry.id ? entry : item))
            : [...schedule.entries, entry];
          await saveSchedule({ ...schedule, entries });
          setEntryTarget(null);
          toast.success(exists ? 'Lesson updated' : 'Lesson added');
        }}
        onDelete={async () => {
          const target = entryTarget && activeClassId
            ? entryFor(activeClassId, entryTarget.day, entryTarget.periodId)
            : undefined;
          if (!target) return;
          await saveSchedule({ ...schedule, entries: schedule.entries.filter((item) => item.id !== target.id) });
          setEntryTarget(null);
          toast.success('Lesson removed');
        }}
      />

      <StructureDialog
        open={structureOpen}
        onClose={() => setStructureOpen(false)}
        doc={schedule}
        onSave={async (next) => {
          await saveSchedule(next);
          setStructureOpen(false);
          toast.success('Structure saved');
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={async () => {
          await saveSchedule({ ...schedule, classes: [], periods: [], entries: [], activeClassId: null, source: '' });
          setResetOpen(false);
        }}
        tone="danger"
        title="Clear the timetable?"
        confirmLabel="Clear schedule"
        message="Classes, periods and placed lessons will be removed. Your library, tasks and videos are untouched."
      />

      {schedule.classes.length > 0 && schedule.periods.filter((period) => period.kind === 'lesson').length === 0 && (
        <EmptyState
          icon={Pencil}
          title="No lesson periods yet"
          description="Open Structure and add the official lesson rows before placing subjects."
          action={
            <Button variant="outline" onClick={() => setStructureOpen(true)}>
              <Settings2 size={14} /> Edit structure
            </Button>
          }
        />
      )}
    </div>
  );
}
