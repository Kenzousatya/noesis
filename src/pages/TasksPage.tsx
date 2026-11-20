import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ListTodo,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { SubjectName, Task, TaskCategory, TaskImportance } from '../lib/types';
import { SUBJECTS } from '../lib/constants';
import { useWorkspace } from '../state/WorkspaceProvider';
import {
  CATEGORY_LABEL,
  IMPORTANCE_LABEL,
  addDays,
  isDueToday,
  isOverdue,
  priorityOf,
  sortByPriority,
  startOfDay,
  toDateKey,
  upcomingGroup,
  wholeDaysUntil,
} from '../lib/tasks';
import { cn } from '../lib/utils';
import { TaskCard, TaskDialog } from '../components/TaskDialog';
import { Button, EmptyState, Input, Segmented, Select } from '../components/ui';

type ViewKey = 'priority' | 'upcoming' | 'calendar' | 'completed';

const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'priority', label: 'Priority' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'completed', label: 'Completed' },
];

const UPCOMING_GROUPS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
  { key: 'next', label: 'Next week' },
  { key: 'later', label: 'Later' },
  { key: 'unscheduled', label: 'No deadline' },
] as const;

function StatChip({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: typeof Sun;
  label: string;
  value: number;
  tone?: 'neutral' | 'danger' | 'warm' | 'accent';
}) {
  const tones = {
    neutral: 'text-ink2',
    danger: 'text-danger',
    warm: 'text-accent2',
    accent: 'text-accent',
  } as const;
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-line bg-panel px-3 py-2">
      <Icon size={14} className={tones[tone]} aria-hidden="true" />
      <span className="text-[15px] font-semibold leading-none tabular-nums text-ink">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</span>
    </div>
  );
}

function DayCell({
  date,
  tasks,
  inMonth,
  onSelect,
  selected,
}: {
  date: Date;
  tasks: Task[];
  inMonth: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  const today = toDateKey(new Date()) === toDateKey(date);
  const overdue = tasks.some((task) => isOverdue(task));
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-[62px] flex-col items-stretch gap-1 border-b border-r border-line/70 p-1 text-left transition-colors sm:min-h-[86px] sm:p-1.5',
        inMonth ? 'bg-panel hover:bg-panel2' : 'bg-panel/40 text-muted hover:bg-panel2/60',
        selected && 'ring-1 ring-inset ring-accent/50',
      )}
    >
      <span className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium tabular-nums',
            today ? 'bg-accent text-onaccent' : inMonth ? 'text-ink2' : 'text-muted/70',
          )}
        >
          {date.getDate()}
        </span>
        {overdue && <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="Overdue tasks" />}
      </span>
      <span className="hidden flex-col gap-0.5 sm:flex">
        {tasks.slice(0, 3).map((task) => (
          <span
            key={task.id}
            className={cn(
              'truncate rounded-[3px] border-l-2 px-1 py-px text-[10px]',
              task.status === 'done'
                ? 'border-line bg-panel2 text-muted line-through'
                : task.importance === 'critical' || isOverdue(task)
                  ? 'border-danger bg-danger/10 text-ink2'
                  : task.importance === 'high'
                    ? 'border-accent2 bg-accent2/10 text-ink2'
                    : 'border-accent/60 bg-accent/[0.07] text-ink2',
            )}
          >
            {task.title}
          </span>
        ))}
        {tasks.length > 3 && (
          <span className="px-1 text-[9.5px] text-muted">+{tasks.length - 3} more</span>
        )}
      </span>
    </button>
  );
}

export default function TasksPage() {
  const { tasks } = useWorkspace();
  const [view, setView] = useState<ViewKey>('priority');
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<'all' | 'general' | SubjectName>('all');
  const [category, setCategory] = useState<'all' | TaskCategory>('all');
  const [importance, setImportance] = useState<'all' | TaskImportance>('all');
  const [status, setStatus] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [newTaskDate, setNewTaskDate] = useState<string | undefined>();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (q && !`${task.title} ${task.description ?? ''} ${task.notes ?? ''}`.toLowerCase().includes(q)) return false;
      if (subject === 'general' && task.subject !== null) return false;
      if (subject !== 'all' && subject !== 'general' && task.subject !== subject) return false;
      if (category !== 'all' && task.category !== category) return false;
      if (importance !== 'all' && task.importance !== importance) return false;
      if (status !== 'all' && task.status !== status) return false;
      return true;
    });
  }, [tasks, query, subject, category, importance, status]);

  const active = filtered.filter((task) => task.status !== 'done');
  const completed = useMemo(
    () =>
      filtered
        .filter((task) => task.status === 'done')
        .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt)),
    [filtered],
  );
  const priorityList = useMemo(() => sortByPriority(active), [active]);

  const stats = useMemo(() => {
    const open = tasks.filter((task) => task.status !== 'done');
    const weekAhead = open.filter((task) => {
      const days = wholeDaysUntil(task);
      return days !== null && days >= 0 && days <= 7;
    });
    const weekAgo = Date.now() - 7 * 86_400_000;
    return {
      open: open.length,
      overdue: open.filter(isOverdue).length,
      today: open.filter(isDueToday).length,
      week: weekAhead.length,
      completed: tasks.filter((task) => task.status === 'done' && (task.completedAt ?? 0) >= weekAgo).length,
    };
  }, [tasks]);

  const filtersActive =
    subject !== 'all' || category !== 'all' || importance !== 'all' || status !== 'all' || Boolean(query.trim());

  const resetFilters = () => {
    setSubject('all');
    setCategory('all');
    setImportance('all');
    setStatus('all');
    setQuery('');
  };

  const openNew = (date?: string) => {
    setEditing(undefined);
    setNewTaskDate(date);
    setDialogOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditing(task);
    setNewTaskDate(undefined);
    setDialogOpen(true);
  };

  const calendarStart = useMemo(() => {
    if (calendarMode === 'week') {
      const today = startOfDay(new Date());
      const weekday = today.getDay();
      const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
      return addDays(today, mondayOffset);
    }
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const weekday = first.getDay();
    return addDays(first, weekday === 0 ? -6 : 1 - weekday);
  }, [calendarMode, month]);

  const calendarDays = useMemo(() => {
    const count = calendarMode === 'week' ? 7 : 42;
    return Array.from({ length: count }, (_, index) => addDays(calendarStart, index));
  }, [calendarMode, calendarStart]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of filtered) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [filtered]);

  const selectedTasks = selectedDay ? tasksByDay.get(selectedDay) ?? [] : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Personal organisation</p>
          <h1 className="editorial mt-2 text-[28px] leading-tight text-ink sm:text-[34px]">
            Homework &amp; Tasks.
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink2">
            Everything you owe a deadline to — ordered by what actually needs attention, with the reasoning shown.
          </p>
        </div>
        <Button onClick={() => openNew()}>
          <Plus size={15} /> Add task
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip icon={ListTodo} label="Open" value={stats.open} />
        <StatChip icon={CircleAlert} label="Overdue" value={stats.overdue} tone="danger" />
        <StatChip icon={Sun} label="Due today" value={stats.today} tone="warm" />
        <StatChip icon={CheckCircle2} label="Done this week" value={stats.completed} tone="accent" />
      </div>

      <div className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <div className="relative flex items-center">
              <Search size={14} className="pointer-events-none absolute left-3 text-muted" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks"
                className="pl-8"
              />
            </div>
          </div>
          <Segmented<ViewKey>
            label="Task view"
            value={view}
            onChange={setView}
            options={VIEWS.map((entry) => ({ value: entry.key, label: entry.label }))}
            size="sm"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            className={cn('ml-auto', filtersActive && 'text-accent')}
          >
            <SlidersHorizontal size={13} /> Filters
            {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />}
          </Button>
        </div>

        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value as typeof subject)}
                  aria-label="Filter by subject"
                >
                  <option value="all">All subjects</option>
                  <option value="general">General only</option>
                  {SUBJECTS.map((entry) => (
                    <option key={entry.slug} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as typeof category)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABEL[key]}
                    </option>
                  ))}
                </Select>
                <Select
                  value={importance}
                  onChange={(event) => setImportance(event.target.value as typeof importance)}
                  aria-label="Filter by importance"
                >
                  <option value="all">Any importance</option>
                  {(Object.keys(IMPORTANCE_LABEL) as TaskImportance[]).map((key) => (
                    <option key={key} value={key}>
                      {IMPORTANCE_LABEL[key]}
                    </option>
                  ))}
                </Select>
                <Select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as typeof status)}
                  aria-label="Filter by status"
                >
                  <option value="all">Any status</option>
                  <option value="todo">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Completed</option>
                </Select>
                {filtersActive && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Clear
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {view === 'priority' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Ranked by deadline urgency, importance and workload
                </p>
                <span className="hidden items-center gap-1 text-[10.5px] text-muted sm:inline-flex">
                  <Sparkles size={11} aria-hidden="true" /> Recalculated as time passes
                </span>
              </div>
              {priorityList.length === 0 ? (
                <EmptyState
                  icon={ListTodo}
                  title={filtersActive ? 'No tasks match these filters' : 'Nothing is demanding attention'}
                  description={
                    filtersActive
                      ? 'Clear the filters to see the full queue.'
                      : 'Add homework, projects or revision tasks and NOEMA will keep them in priority order.'
                  }
                  action={
                    filtersActive ? (
                      <Button variant="outline" onClick={resetFilters}>
                        Clear filters
                      </Button>
                    ) : (
                      <Button onClick={() => openNew()}>
                        <Plus size={15} /> Add task
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {priorityList.map((task) => (
                    <TaskCard key={task.id} task={task} onEdit={openEdit} />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'upcoming' && (
            <div className="flex flex-col gap-6">
              {UPCOMING_GROUPS.map((group) => {
                const groupTasks = active
                  .filter((task) => upcomingGroup(task) === group.key)
                  .sort((a, b) => priorityOf(b).score - priorityOf(a).score);
                if (!groupTasks.length) return null;
                return (
                  <section key={group.key}>
                    <div className="mb-2 flex items-baseline justify-between border-b border-line pb-1.5">
                      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink2">
                        {group.label}
                      </h2>
                      <span className="text-[10.5px] text-muted">{groupTasks.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {groupTasks.map((task) => (
                        <TaskCard key={task.id} task={task} onEdit={openEdit} />
                      ))}
                    </div>
                  </section>
                );
              })}
              {active.length === 0 && (
                <EmptyState
                  icon={CalendarDays}
                  title="Nothing scheduled"
                  description="Tasks with deadlines will appear here, grouped by when they are due."
                  action={
                    <Button onClick={() => openNew()}>
                      <Plus size={15} /> Add task
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {view === 'calendar' && (
            <div className="overflow-hidden rounded-panel border border-line bg-panel">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous period"
                    onClick={() =>
                      setMonth(
                        calendarMode === 'month'
                          ? new Date(month.getFullYear(), month.getMonth() - 1, 1)
                          : month,
                      )
                    }
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <p className="min-w-[140px] text-center text-[12.5px] font-semibold text-ink">
                    {calendarMode === 'month'
                      ? month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                      : `Week of ${calendarStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next period"
                    onClick={() =>
                      setMonth(
                        calendarMode === 'month'
                          ? new Date(month.getFullYear(), month.getMonth() + 1, 1)
                          : month,
                      )
                    }
                  >
                    <ChevronRight size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                      setSelectedDay(toDateKey(now));
                    }}
                  >
                    Today
                  </Button>
                </div>
                <Segmented<'month' | 'week'>
                  label="Calendar scale"
                  value={calendarMode}
                  onChange={setCalendarMode}
                  options={[
                    { value: 'month', label: 'Month' },
                    { value: 'week', label: 'Week' },
                  ]}
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-7 border-b border-line bg-panel2/60">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <div
                    key={label}
                    className="border-r border-line/70 px-1 py-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-muted last:border-r-0 sm:text-[9.5px] sm:tracking-[0.14em]"
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((date) => {
                  const key = toDateKey(date);
                  return (
                    <DayCell
                      key={key}
                      date={date}
                      inMonth={date.getMonth() === month.getMonth() || calendarMode === 'week'}
                      tasks={tasksByDay.get(key) ?? []}
                      selected={selectedDay === key}
                      onSelect={() => setSelectedDay(key)}
                    />
                  );
                })}
              </div>

              {selectedDay && (
                <div className="border-t border-line bg-panel2/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink2">
                      {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => openNew(selectedDay)}>
                      <Plus size={13} /> Add on this day
                    </Button>
                  </div>
                  {selectedTasks.length === 0 ? (
                    <p className="text-[12px] text-muted">No tasks due on this day.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedTasks.map((task) => (
                        <TaskCard key={task.id} task={task} onEdit={openEdit} compact />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'completed' && (
            <div className="flex flex-col gap-2">
              {completed.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Nothing completed yet"
                  description="Finished tasks are kept here so you can reopen them if something needs another pass."
                />
              ) : (
                completed.map((task) => <TaskCard key={task.id} task={task} onEdit={openEdit} />)
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <TaskDialog
        open={dialogOpen}
        task={editing}
        initialDate={newTaskDate}
        onClose={() => {
          setDialogOpen(false);
          setEditing(undefined);
          setNewTaskDate(undefined);
        }}
      />

      <p className="pb-1 text-[10.5px] leading-relaxed text-muted">
        Priority is a score, not a verdict — each card shows the reasoning behind its rank.
      </p>
    </div>
  );
}
