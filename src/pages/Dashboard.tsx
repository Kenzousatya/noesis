import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Database,
  FileText,
  Flag,
  HelpCircle,
  ListTodo,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Star,
  Sun,
  Youtube,
} from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { useWorkspace } from '../state/WorkspaceProvider';
import { useToast } from '../state/ToastProvider';
import { useSettings } from '../state/SettingsProvider';
import { SUBJECTS, RESOURCE_TYPE_LABEL } from '../lib/constants';
import { countBySubject, formatBytes, relativeTime, sortResources } from '../lib/utils';
import { resourceHref } from '../lib/search';
import { ResourceCard } from '../components/ResourceCard';
import { SearchResultsList } from '../components/SearchResults';
import { TaskCard } from '../components/TaskDialog';
import type { DashboardSectionKey, Task } from '../lib/types';
import { Button, EmptyState, ProgressBar } from '../components/ui';
import { SUBJECT_TINT, minutesNow, parseTime, scheduleStatus, sortPeriods, todayWeekday } from '../lib/schedule';
import { WEEKDAY_LABEL, dueTimestamp, formatDueLabel, isOverdue, sortByPriority } from '../lib/tasks';

const iconFor = { pdf: FileText, quiz: HelpCircle, video: Youtube } as const;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
        <h2 className="mt-1 text-[16px] font-semibold text-ink">{title}</h2>
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-1 text-[12px] text-ink2 transition-colors hover:text-accent"
        >
          {action.label}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
  to,
}: {
  icon: typeof Sun;
  label: string;
  value: string;
  hint: string;
  tone?: 'neutral' | 'warm' | 'danger' | 'accent';
  to?: string;
}) {
  const tones = {
    neutral: 'text-ink',
    warm: 'text-accent2',
    danger: 'text-danger',
    accent: 'text-accent',
  } as const;
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
        <Icon size={11} aria-hidden="true" /> {label}
      </p>
      <p className={`mt-1.5 text-[15px] font-semibold leading-snug ${tones[tone]}`}>{value}</p>
      <p className="mt-0.5 line-clamp-1 text-[10.5px] text-muted">{hint}</p>
    </>
  );
  return to ? (
    <Link
      to={to}
      className="group border-line bg-panel px-3.5 py-3 transition-colors hover:bg-panel2"
    >
      {body}
    </Link>
  ) : (
    <div className="bg-panel px-3.5 py-3">{body}</div>
  );
}

export default function Dashboard() {
  const { resources, attempts, bundledImported, importBundled } = useLibrary();
  const { tasks, schedule } = useWorkspace();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('noema.bundled-banner-dismissed') === '1';
    } catch {
      return false;
    }
  });

  const now = new Date();
  const hidden = settings.dashboardHidden;
  const show = (key: DashboardSectionKey) => !hidden.includes(key);

  const counts = useMemo(() => countBySubject(resources), [resources]);
  const stats = useMemo(() => {
    const pdfs = resources.filter((resource) => resource.type === 'pdf');
    return {
      pdfs: pdfs.length,
      quizzes: resources.filter((resource) => resource.type === 'quiz').length,
      videos: resources.filter((resource) => resource.type === 'video').length,
      attempts: attempts.length,
      bytes: pdfs.reduce((sum, resource) => sum + (resource.type === 'pdf' ? resource.size : 0), 0),
    };
  }, [resources, attempts]);

  const openTasks = useMemo(() => tasks.filter((task) => task.status !== 'done'), [tasks]);
  const priority = useMemo(() => sortByPriority(openTasks).slice(0, 4), [openTasks]);
  const overdue = openTasks.filter(isOverdue);
  const nextDeadline = useMemo(
    () =>
      [...openTasks]
        .filter((task) => task.dueDate)
        .sort((a, b) => (dueTimestamp(a) ?? 0) - (dueTimestamp(b) ?? 0))[0] ?? null,
    [openTasks],
  );

  const activeClassId = schedule.activeClassId ?? schedule.classes[0]?.id ?? null;
  const activeClass = schedule.classes.find((entry) => entry.id === activeClassId);
  const status = useMemo(
    () =>
      activeClassId
        ? scheduleStatus(schedule, activeClassId)
        : { current: null, next: null, minutesUntilNext: null },
    [schedule, activeClassId],
  );
  const today = todayWeekday();
  const nowMinutes = minutesNow();
  const todaySchedule = useMemo(() => {
    if (!activeClassId || !today) return [];
    const periods = sortPeriods(schedule.periods);
    return periods
      .map((period) => ({
        period,
        entry: schedule.entries.find(
          (item) => item.classId === activeClassId && item.day === today && item.periodId === period.id,
        ),
      }))
      .filter((row) => row.entry || row.period.kind === 'break');
  }, [schedule, activeClassId, today]);

  const recent = useMemo(
    () =>
      resources
        .filter((resource) => resource.lastOpenedAt)
        .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
        .slice(0, 3),
    [resources],
  );
  const newest = useMemo(() => sortResources(resources, 'date-desc').slice(0, 5), [resources]);
  const subjectOrder = useMemo(
    () =>
      [...SUBJECTS].sort(
        (a, b) => (counts[b.name]?.total ?? 0) - (counts[a.name]?.total ?? 0),
      ),
    [counts],
  );

  const activity = useMemo(() => {
    const recentAttempts = [...attempts]
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 3);
    const completed = tasks
      .filter((task) => task.status === 'done')
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 3);
    const opened = [...resources]
      .filter((resource) => resource.lastOpenedAt)
      .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
      .slice(0, 3);
    return { recentAttempts, completed, opened };
  }, [attempts, tasks, resources]);

  const handleBundledImport = async () => {
    setImporting(true);
    try {
      const result = await importBundled();
      toast.success(
        'Bundled library imported',
        `${result.pdfs} study materials and ${result.quizzes} questionnaires are now in your archive${
          result.skipped ? `, ${result.skipped} unavailable file(s) skipped` : ''
        }.`,
      );
    } catch (error) {
      toast.error('Could not import the bundled library', (error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const dismissBanner = () => {
    setDismissed(true);
    try {
      localStorage.setItem('noema.bundled-banner-dismissed', '1');
    } catch {
      // Ignore blocked storage.
    }
  };

  const completedToday = tasks.filter(
    (task) => task.status === 'done' && task.completedAt && new Date(task.completedAt).toDateString() === now.toDateString(),
  ).length;

  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-panel border border-line bg-panel/70 px-5 py-6 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0 opacity-[0.5]" aria-hidden="true">
          <svg className="h-full w-full" viewBox="0 0 600 260" preserveAspectRatio="xMaxYMid slice" fill="none">
            <g stroke="rgb(var(--accent))" strokeOpacity="0.16" strokeWidth="1">
              <path d="M360 0V260M440 0V260M520 0V260M600 0V260" />
              <path d="M300 60H600M300 130H600M300 200H600" />
              <circle cx="470" cy="128" r="96" strokeOpacity="0.12" />
              <circle cx="470" cy="128" r="132" strokeOpacity="0.07" />
            </g>
            <path
              d="M470 44 L530 60 L600 214 H560 L498 84 L436 214 H396 Z"
              fill="rgb(var(--accent))"
              fillOpacity="0.07"
            />
          </svg>
        </div>

        <div className="relative">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            <span className="inline-flex items-center gap-1.5 text-accent2">
              <Sun size={11} aria-hidden="true" /> {greeting()}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          <h1 className="editorial mt-2.5 max-w-2xl text-[30px] leading-[1.05] text-ink sm:text-[38px] lg:text-[42px]">
            Your knowledge, in one place.
          </h1>
          <p className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed text-ink2">
            Collect knowledge · Cultivate thought. {openTasks.length > 0
              ? `${openTasks.length} task${openTasks.length === 1 ? '' : 's'} open${overdue.length ? `, ${overdue.length} overdue` : ''}.`
              : 'Nothing is overdue.'}
          </p>

          <div className="relative z-20 mt-5 max-w-lg">
            <div className="relative flex items-center">
              <Search size={16} className="pointer-events-none absolute left-3.5 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setQuery('');
                }}
                placeholder="Search materials, questionnaires, videos…"
                aria-label="Search your library"
                className="h-11 w-full rounded-input border border-line bg-panel pl-10 pr-4 text-[13px] text-ink shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors placeholder:text-muted/80 hover:border-muted/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            {query.trim() && (
              <div className="absolute inset-x-0 top-[calc(100%+6px)] overflow-hidden rounded-card border border-line bg-panel shadow-modal">
                <SearchResultsList query={query} onNavigate={() => setQuery('')} limit={7} />
              </div>
            )}
          </div>
        </div>
      </section>

      {!bundledImported && !dismissed && (
        <section className="-mt-2 rounded-card border border-accent/25 bg-accent/[0.05] p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-card border border-accent/30 bg-accent/10 text-accent">
                <Database size={15} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[13px] font-semibold text-ink">Your repository library is available</h2>
                <p className="mt-0.5 max-w-xl text-[11.5px] leading-relaxed text-ink2">
                  Link the bundled PDFs and questionnaires into your archive. They stay linked to the app, not copied.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={dismissBanner}>
                Not now
              </Button>
              <Button size="sm" onClick={handleBundledImport} loading={importing}>
                Import library
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Today overview */}
      {show('today') && (
        <motion.section {...fade} transition={{ duration: 0.25, delay: 0.02 }}>
          <SectionHeading eyebrow="Today at a glance" title="The day on one line" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-4">
            <MiniStat
              icon={CalendarDays}
              label="Next class"
              value={status.current ? `${status.current.entry.subject} now` : status.next ? status.next.entry.subject : '—'}
              hint={
                status.current
                  ? `Until ${status.current.period.end}`
                  : status.next
                    ? `${WEEKDAY_LABEL[status.next.day]} · ${status.next.period.start}`
                    : 'No timetable yet'
              }
              tone={status.current ? 'accent' : 'neutral'}
              to="/schedule"
            />
            <MiniStat
              icon={Flag}
              label="Next deadline"
              value={nextDeadline ? nextDeadline.title : 'Nothing scheduled'}
              hint={nextDeadline ? `${formatDueLabel(nextDeadline)}${nextDeadline.subject ? ` · ${nextDeadline.subject}` : ''}` : 'Add homework or a project'}
              tone={nextDeadline && isOverdue(nextDeadline) ? 'danger' : 'warm'}
              to="/tasks"
            />
            <MiniStat
              icon={ListTodo}
              label="Open tasks"
              value={`${openTasks.length}`}
              hint={overdue.length ? `${overdue.length} overdue · ${completedToday} done today` : `${completedToday} completed today`}
              tone={overdue.length ? 'danger' : 'neutral'}
              to="/tasks"
            />
            <MiniStat
              icon={BookOpen}
              label="In the archive"
              value={`${resources.length} item${resources.length === 1 ? '' : 's'}`}
              hint={`${stats.pdfs} materials · ${stats.quizzes} quizzes · ${stats.videos} videos`}
              to="/recent"
            />
          </div>
        </motion.section>
      )}

      {/* Priority + timetable */}
      <div className="grid gap-7 lg:grid-cols-[1.5fr_1fr]">
        {show('priority') && (
          <motion.section {...fade} transition={{ duration: 0.25, delay: 0.06 }}>
            <SectionHeading
              eyebrow="Needs attention"
              title="Priority tasks"
              action={{ label: 'All tasks', to: '/tasks' }}
            />
            {priority.length === 0 ? (
              <div className="rounded-panel border border-dashed border-line bg-panel/40 px-5 py-8">
                <p className="text-[13px] font-medium text-ink">Nothing is forcing its way to the top.</p>
                <p className="mt-1 text-[12px] text-ink2">
                  Add homework, a project or revision and NOEMA will rank it by deadline and importance.
                </p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/tasks')}>
                  <Plus size={13} /> Add a task
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {priority.map((task: Task) => (
                  <TaskCard key={task.id} task={task} compact onEdit={() => navigate('/tasks')} />
                ))}
              </div>
            )}
            {priority.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted">
                <Sparkles size={10} aria-hidden="true" />
                Sorted by urgency, importance and workload — recalculated continuously.
              </p>
            )}
          </motion.section>
        )}

        {show('timetable') && (
          <motion.section {...fade} transition={{ duration: 0.25, delay: 0.1 }}>
            <SectionHeading eyebrow="Rhythm" title="Today’s timetable" action={{ label: 'Full week', to: '/schedule' }} />
            <div className="overflow-hidden rounded-panel border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink2">
                  {today ? WEEKDAY_LABEL[today] : 'Weekend'}
                </p>
                {activeClass && <span className="text-[10px] text-muted">{activeClass.name}</span>}
              </div>
              {todaySchedule.length === 0 ? (
                <div className="px-4 py-6">
                  <p className="text-[12px] text-ink2">
                    {!activeClassId
                      ? 'Set up your school timetable to see today’s classes here.'
                      : today
                        ? 'No lessons placed for today.'
                        : 'No classes on the weekend.'}
                  </p>
                  <Link
                    to="/schedule"
                    className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline"
                  >
                    {activeClassId ? 'Open schedule' : 'Build the timetable'}
                    <ChevronRight size={12} />
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-line/70">
                  {todaySchedule.map(({ period, entry }) => {
                    const start = parseTime(period.start);
                    const end = parseTime(period.end);
                    const isNow = nowMinutes >= start && nowMinutes < end;
                    const isNext =
                      status.next?.day === today && entry && status.next.entry.id === entry.id && !isNow;
                    return (
                      <li key={period.id} className={`flex gap-2.5 px-3.5 py-2 ${isNow ? 'bg-accent/[0.06]' : ''}`}>
                        <span className="w-10 shrink-0 pt-0.5 text-[10px] tabular-nums text-muted">
                          {period.start}
                        </span>
                        {period.kind === 'break' ? (
                          <span className="flex flex-1 items-center gap-1.5 text-[11px] text-accent2">
                            <Coffee size={11} aria-hidden="true" /> {period.label}
                          </span>
                        ) : entry ? (
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span
                              className="h-6 w-[2px] shrink-0 rounded-full"
                              style={{ backgroundColor: SUBJECT_TINT[entry.subject] }}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] font-medium text-ink">{entry.subject}</span>
                              {(entry.room || entry.teacher) && (
                                <span className="flex items-center gap-1 text-[9.5px] text-muted">
                                  {entry.room && <MapPin size={8} aria-hidden="true" />}
                                  {entry.room ?? entry.teacher}
                                </span>
                              )}
                            </span>
                            {isNow && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="Now" />}
                            {isNext && (
                              <span className="shrink-0 text-[8.5px] uppercase tracking-[0.08em] text-accent2">next</span>
                            )}
                          </span>
                        ) : (
                          <span className="flex-1 text-[11px] text-muted">Free</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.section>
        )}
      </div>

      {/* Continue studying */}
      {show('continue') && (
        <motion.section {...fade} transition={{ duration: 0.25, delay: 0.12 }}>
          <SectionHeading eyebrow="Pick up where you left off" title="Continue studying" action={{ label: 'Recently added', to: '/recent' }} />
          {recent.length === 0 ? (
            <div className="rounded-panel border border-dashed border-line bg-panel/40 px-5 py-6 text-[12.5px] text-ink2">
              Nothing opened yet. Open a study material, questionnaire or video and it will reappear here.
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-3">
              {recent.map((resource) => {
                const Icon = iconFor[resource.type];
                return (
                  <button
                    key={resource.id}
                    type="button"
                    onClick={() => navigate(resourceHref(resource))}
                    className="group flex flex-col gap-3 rounded-card border border-line bg-panel p-4 text-left transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent/40"
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-panel2 text-accent">
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <span className="text-[9.5px] uppercase tracking-[0.12em] text-muted">
                        {RESOURCE_TYPE_LABEL[resource.type]}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-[13px] font-semibold leading-snug text-ink">
                        {resource.title}
                      </span>
                      <span className="mt-1 block truncate text-[10.5px] text-muted">
                        {resource.subject} · Grade {resource.grade}
                        {resource.type === 'pdf' && resource.lastPage ? ` · page ${resource.lastPage}` : ''}
                      </span>
                    </span>
                    <span className="mt-auto flex items-center justify-between text-[10.5px] text-muted">
                      {resource.lastOpenedAt ? relativeTime(resource.lastOpenedAt) : ''}
                      <ArrowUpRight
                        size={13}
                        className="text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </motion.section>
      )}

      {/* Subjects */}
      {show('subjects') && (
        <motion.section {...fade} transition={{ duration: 0.25, delay: 0.14 }}>
          <SectionHeading eyebrow="The archive" title="Your subjects" action={{ label: 'All subjects', to: '/subjects' }} />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {subjectOrder.map((subject, index) => {
              const entry = counts[subject.name] ?? { pdf: 0, quiz: 0, video: 0, total: 0 };
              const featured = index === 0 && entry.total > 0;
              return (
                <Link
                  key={subject.slug}
                  to={`/subject/${subject.slug}`}
                  className={`group relative flex flex-col rounded-card border border-line bg-panel transition-[transform,border-color] duration-200 ease-calm hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-lift ${
                    featured ? 'col-span-2 p-4 sm:col-span-1 lg:col-span-2' : 'p-3'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`flex items-center justify-center rounded-lg border border-line bg-panel2 text-accent ${
                        featured ? 'h-10 w-10' : 'h-7 w-7'
                      }`}
                    >
                      <subject.icon size={featured ? 18 : 14} aria-hidden="true" />
                    </span>
                    <span className="font-serif text-[13px] text-muted/60">
                      {String(SUBJECTS.findIndex((entry) => entry.slug === subject.slug) + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className={`mt-2 truncate font-semibold text-ink ${featured ? 'text-[16px]' : 'text-[12.5px]'}`}>
                    {subject.name}
                  </h3>
                  <p className="mt-0.5 truncate text-[10px] text-muted">{subject.greek}</p>
                  {featured && (
                    <p className="mt-2 text-[11.5px] leading-relaxed text-ink2">
                      {subject.blurb}. {entry.total} item{entry.total === 1 ? '' : 's'} across three grades.
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-x-2 gap-y-0.5 pt-2 text-[10px] text-muted">
                    <span>{entry.pdf} PDF</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.quiz} quiz</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.video} video</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Recently added */}
      {show('recent') && (
        <motion.section {...fade} transition={{ duration: 0.25, delay: 0.16 }}>
          <SectionHeading eyebrow="Fresh in the archive" title="Recently added" action={{ label: 'See all', to: '/recent' }} />
          {newest.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Your archive is empty"
              description="Add your first study material, import a questionnaire, or save a video to begin."
              action={<Button onClick={() => navigate('/subjects')}>Choose a subject</Button>}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {newest.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} view="list" />
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* Activity */}
      {show('activity') && (
        <motion.section {...fade} transition={{ duration: 0.25, delay: 0.18 }}>
          <SectionHeading eyebrow="Evidence of work" title="Academic activity" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-panel border border-line bg-panel p-4">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                <HelpCircle size={11} aria-hidden="true" /> Recent attempts
              </p>
              {activity.recentAttempts.length === 0 ? (
                <p className="mt-2 text-[11.5px] text-muted">No questionnaire attempts recorded.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {activity.recentAttempts.map((attempt) => (
                    <li key={attempt.id} className="text-[11.5px]">
                      <Link to={`/quiz/${attempt.quizId}`} className="line-clamp-1 text-ink2 hover:text-accent">
                        {attempt.quizTitle}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <ProgressBar
                          value={attempt.percentage}
                          className="h-1 flex-1"
                          tone={attempt.percentage >= 70 ? 'accent' : 'warm'}
                        />
                        <span className="text-[10px] tabular-nums text-muted">{Math.round(attempt.percentage)}%</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-panel border border-line bg-panel p-4">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                <CheckCircle2 size={11} aria-hidden="true" /> Completed tasks
              </p>
              {activity.completed.length === 0 ? (
                <p className="mt-2 text-[11.5px] text-muted">Nothing completed yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {activity.completed.map((task) => (
                    <li key={task.id} className="line-clamp-1 text-[11.5px] text-ink2">
                      <span className="mr-1.5 text-accent">✓</span>
                      {task.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-panel border border-line bg-panel p-4">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">
                <Clock3 size={11} aria-hidden="true" /> Recently opened
              </p>
              {activity.opened.length === 0 ? (
                <p className="mt-2 text-[11.5px] text-muted">Nothing opened recently.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {activity.opened.map((resource) => (
                    <li key={resource.id} className="text-[11.5px]">
                      <Link to={resourceHref(resource)} className="line-clamp-1 text-ink2 hover:text-accent">
                        {resource.title}
                      </Link>
                      <span className="text-[10px] text-muted">
                        {resource.lastOpenedAt ? relativeTime(resource.lastOpenedAt) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.section>
      )}

      <footer className="flex flex-col gap-2 border-t border-line pt-5 text-[11px] leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-1.5">
          <Star size={11} aria-hidden="true" /> Stored locally in this browser · {formatBytes(stats.bytes)} of PDF
          content · {stats.attempts} quiz attempt{stats.attempts === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
          <span className="h-px w-6 bg-line" aria-hidden="true" /> Noema · Νόημα
        </span>
      </footer>
    </div>
  );
}
