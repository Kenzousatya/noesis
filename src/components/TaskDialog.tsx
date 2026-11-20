import { useMemo, useState } from 'react';
import type { Task, TaskCategory, TaskImportance, TaskStatus, SubjectName } from '../lib/types';
import { SUBJECTS } from '../lib/constants';
import { useWorkspace } from '../state/WorkspaceProvider';
import {
  CATEGORY_LABEL,
  IMPORTANCE_LABEL,
  STATUS_LABEL,
  checklistProgress,
  formatEstimate,
  formatDueLabel,
  isDueToday,
  isOverdue,
  priorityOf,
  toDateKey,
} from '../lib/tasks';
import { cn, uid } from '../lib/utils';
import { Button, Field, Input, Menu, Select, Textarea, ProgressBar } from './ui';
import type { MenuItem } from './ui';
import { Dialog, ConfirmDialog } from './Dialog';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Flag,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';

const IMPORTANCE_TONE: Record<TaskImportance, string> = {
  low: 'border-line bg-panel2 text-muted',
  normal: 'border-accent/25 bg-accent/[0.07] text-ink2',
  high: 'border-accent2/35 bg-accent2/10 text-accent2',
  critical: 'border-danger/35 bg-danger/10 text-danger',
};

const ESTIMATE_PRESETS = [15, 30, 45, 60, 90, 120, 180];

export function TaskCard({
  task,
  onEdit,
  compact = false,
  showSubject = true,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  compact?: boolean;
  showSubject?: boolean;
}) {
  const { setTaskStatus, deleteTask, toggleSubtask } = useWorkspace();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const priority = useMemo(() => priorityOf(task), [task]);
  const progress = checklistProgress(task);
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const dueToday = isDueToday(task);

  const items: MenuItem[] = [
    { label: 'Edit task', icon: Pencil, onClick: () => onEdit(task) },
    {
      label: done ? 'Reopen task' : 'Mark complete',
      icon: done ? RotateCcw : CheckCircle2,
      onClick: () => void setTaskStatus(task.id, done ? 'todo' : 'done'),
    },
    { label: 'In progress', icon: Clock3, onClick: () => void setTaskStatus(task.id, 'in_progress'), disabled: done },
    { separator: true },
    { label: 'Delete task', icon: Trash2, danger: true, onClick: () => setConfirmOpen(true) },
  ];

  return (
    <>
      <article
        className={cn(
          'group relative flex gap-3 rounded-card border bg-panel p-3.5 transition-[border-color,background-color] duration-200',
          done ? 'border-line/70 bg-panel/60' : overdue ? 'border-danger/30' : 'border-line hover:border-muted/45',
          compact && 'p-3',
        )}
      >
        <button
          type="button"
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          aria-pressed={done}
          onClick={() => void setTaskStatus(task.id, done ? 'todo' : 'done')}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
            done
              ? 'border-accent bg-accent text-onaccent'
              : 'border-line bg-panel2 text-transparent hover:border-accent hover:text-accent/60',
          )}
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className={cn(
                  'truncate text-[13.5px] font-semibold leading-snug',
                  done ? 'text-muted line-through' : 'text-ink',
                )}
                title={task.title}
              >
                {task.title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-muted">
                {showSubject && (
                  <>
                    <span className="text-ink2">{task.subject ?? 'General'}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{CATEGORY_LABEL[task.category]}</span>
                {task.estimatedMinutes ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Clock3 size={10} aria-hidden="true" />
                      {formatEstimate(task.estimatedMinutes)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="relative z-10 -mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
              <span
                className={cn(
                  'hidden rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.09em] sm:inline',
                  IMPORTANCE_TONE[task.importance],
                )}
              >
                {IMPORTANCE_LABEL[task.importance]}
              </span>
              <Menu items={items} label={`Actions for ${task.title}`} />
            </div>
          </div>

          {!compact && task.description?.trim() && (
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink2">{task.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
            <span
              className={cn(
                'inline-flex items-center gap-1',
                done ? 'text-muted' : overdue ? 'text-danger' : dueToday ? 'text-accent2' : 'text-ink2',
              )}
            >
              {overdue ? <AlertTriangle size={11} aria-hidden="true" /> : <Clock3 size={11} aria-hidden="true" />}
              {formatDueLabel(task)}
            </span>
            {!done && (
              <span className="inline-flex items-center gap-1 text-muted" title={`Priority score ${priority.score}`}>
                <Flag size={10} aria-hidden="true" />
                {priority.label}
              </span>
            )}
            {task.status === 'in_progress' && (
              <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-px text-[10px] text-accent">
                In progress
              </span>
            )}
          </div>

          {task.subtasks.length > 0 && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="flex w-full items-center gap-2 text-left"
                aria-expanded={expanded}
              >
                <ProgressBar value={progress.percent} className="h-1 flex-1" />
                <span className="shrink-0 text-[10px] tabular-nums text-muted">
                  {progress.done}/{progress.total}
                </span>
              </button>
              {expanded && (
                <ul className="mt-2 space-y-1 border-t border-line/70 pt-2">
                  {task.subtasks.map((subtask) => (
                    <li key={subtask.id}>
                      <button
                        type="button"
                        onClick={() => void toggleSubtask(task.id, subtask.id)}
                        className="flex items-start gap-2 text-left text-[11.5px] text-ink2 hover:text-ink"
                      >
                        <span
                          className={cn(
                            'mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                            subtask.done
                              ? 'border-accent bg-accent text-onaccent'
                              : 'border-line bg-panel2 text-transparent',
                          )}
                        >
                          <Check size={9} strokeWidth={3} aria-hidden="true" />
                        </span>
                        <span className={subtask.done ? 'text-muted line-through' : undefined}>{subtask.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </article>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await deleteTask(task.id);
          setConfirmOpen(false);
        }}
        tone="danger"
        title="Delete this task?"
        confirmLabel="Delete task"
        message={`"${task.title}" and its checklist will be removed from this device.`}
      />
    </>
  );
}

interface DraftState {
  title: string;
  description: string;
  subject: SubjectName | 'general';
  category: TaskCategory;
  important: TaskImportance;
  dueDate: string;
  dueTime: string;
  unscheduled: boolean;
  estimatedMinutes: number | null;
  status: TaskStatus;
  notes: string;
  subtasks: { id: string; title: string; done: boolean }[];
  attachments: { id: string; label: string; url: string }[];
}

function toDraft(task?: Task, initialDate?: string): DraftState {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    subject: task?.subject ?? 'general',
    category: task?.category ?? 'homework',
    important: task?.importance ?? 'normal',
    dueDate: task?.dueDate ?? initialDate ?? toDateKey(new Date()),
    dueTime: task?.dueTime ?? '',
    unscheduled: task ? !task.dueDate : false,
    estimatedMinutes: task ? task.estimatedMinutes : 60,
    status: task?.status ?? 'todo',
    notes: task?.notes ?? '',
    subtasks: task?.subtasks ?? [],
    attachments: task?.attachments ?? [],
  };
}

export function TaskDialog({
  open,
  task,
  initialDate,
  onClose,
}: {
  open: boolean;
  task?: Task;
  initialDate?: string;
  onClose: () => void;
}) {
  const { addTask, saveTask } = useWorkspace();
  const [draft, setDraft] = useState<DraftState>(() => toDraft(task, initialDate));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Reset the form whenever a different task is opened.
  const [formKey, setFormKey] = useState('');
  const key = `${open}-${task?.id ?? 'new'}-${task?.updatedAt ?? 0}-${initialDate ?? ''}`;
  if (key !== formKey) {
    setFormKey(key);
    if (open) {
      setDraft(toDraft(task, initialDate));
      setError('');
      setSubtaskInput('');
      setAttachmentLabel('');
      setAttachmentUrl('');
    }
  }

  const patch = (next: Partial<DraftState>) => setDraft((current) => ({ ...current, ...next }));

  const submit = async () => {
    if (!draft.title.trim()) {
      setError('Give the task a title.');
      return;
    }
    if (!draft.unscheduled && !draft.dueDate) {
      setError('Choose a due date, or mark the task as unscheduled.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim(),
        subject: draft.subject === 'general' ? null : draft.subject,
        category: draft.category,
        dueDate: draft.unscheduled ? null : draft.dueDate,
        dueTime: draft.unscheduled || !draft.dueTime ? null : draft.dueTime,
        importance: draft.important,
        estimatedMinutes: draft.estimatedMinutes,
        status: draft.status,
        subtasks: draft.subtasks,
        notes: draft.notes.trim(),
        attachments: draft.attachments,
        completedAt: draft.status === 'done' ? task?.completedAt ?? Date.now() : null,
      };
      if (task) {
        await saveTask({ ...task, ...payload, updatedAt: Date.now() });
      } else {
        await addTask(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'Add a task'}
      description={
        task
          ? 'Deadlines, importance and workload all feed the automatic priority order.'
          : 'A task belongs to a subject, a category and a deadline. Priority is calculated for you.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {task ? 'Save task' : 'Add task'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Task title" htmlFor="task-title" error={error && !draft.title.trim() ? error : undefined}>
          <Input
            id="task-title"
            value={draft.title}
            onChange={(event) => {
              patch({ title: event.target.value });
              setError('');
            }}
            placeholder="e.g. Prepare Physics presentation"
            autoFocus
          />
        </Field>

        <Field label="Description" htmlFor="task-description" hint="Optional — what exactly needs doing.">
          <Textarea
            id="task-description"
            rows={2}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subject" htmlFor="task-subject">
            <Select
              id="task-subject"
              className="w-full"
              value={draft.subject}
              onChange={(event) => patch({ subject: event.target.value as SubjectName | 'general' })}
            >
              <option value="general">General / multiple subjects</option>
              {SUBJECTS.map((subject) => (
                <option key={subject.slug} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" htmlFor="task-category">
            <Select
              id="task-category"
              className="w-full"
              value={draft.category}
              onChange={(event) => patch({ category: event.target.value as TaskCategory })}
            >
              {(Object.keys(CATEGORY_LABEL) as TaskCategory[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABEL[key]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Importance" htmlFor="task-importance">
            <Select
              id="task-importance"
              className="w-full"
              value={draft.important}
              onChange={(event) => patch({ important: event.target.value as TaskImportance })}
            >
              {(Object.keys(IMPORTANCE_LABEL) as TaskImportance[]).map((key) => (
                <option key={key} value={key}>
                  {IMPORTANCE_LABEL[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="task-status">
            <Select
              id="task-status"
              className="w-full"
              value={draft.status}
              onChange={(event) => patch({ status: event.target.value as TaskStatus })}
            >
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABEL[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimated time" htmlFor="task-estimate">
            <Select
              id="task-estimate"
              className="w-full"
              value={draft.estimatedMinutes ?? ''}
              onChange={(event) =>
                patch({ estimatedMinutes: event.target.value ? Number(event.target.value) : null })
              }
            >
              <option value="">Not estimated</option>
              {ESTIMATE_PRESETS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatEstimate(minutes)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Due date" htmlFor="task-due" error={error && !draft.unscheduled && !draft.dueDate ? error : undefined}>
            <Input
              id="task-due"
              type="date"
              value={draft.dueDate}
              disabled={draft.unscheduled}
              onChange={(event) => patch({ dueDate: event.target.value })}
            />
          </Field>
          <Field label="Due time" htmlFor="task-due-time" hint="Optional.">
            <Input
              id="task-due-time"
              type="time"
              value={draft.dueTime}
              disabled={draft.unscheduled}
              onChange={(event) => patch({ dueTime: event.target.value })}
            />
          </Field>
        </div>

        <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-[12px] text-ink2">
          <input
            type="checkbox"
            checked={draft.unscheduled}
            onChange={(event) => {
              patch({ unscheduled: event.target.checked });
              setError('');
            }}
            className="accent-[rgb(var(--accent))]"
          />
          This task has no fixed deadline
        </label>

        <fieldset className="rounded-card border border-line bg-panel2/40 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Checklist
          </legend>
          {draft.subtasks.length > 0 && (
            <ul className="mb-2 space-y-1">
              {draft.subtasks.map((subtask) => (
                <li key={subtask.id} className="flex items-center gap-2 text-[12.5px] text-ink2">
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        subtasks: draft.subtasks.map((entry) =>
                          entry.id === subtask.id ? { ...entry, done: !entry.done } : entry,
                        ),
                      })
                    }
                    aria-label={subtask.done ? `Mark ${subtask.title} incomplete` : `Mark ${subtask.title} complete`}
                    className={cn(
                      'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                      subtask.done ? 'border-accent bg-accent text-onaccent' : 'border-line bg-panel text-transparent',
                    )}
                  >
                    <Check size={9} strokeWidth={3} aria-hidden="true" />
                  </button>
                  <span className={cn('flex-1', subtask.done && 'text-muted line-through')}>{subtask.title}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${subtask.title}`}
                    onClick={() =>
                      patch({ subtasks: draft.subtasks.filter((entry) => entry.id !== subtask.id) })
                    }
                    className="rounded p-1 text-muted hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={subtaskInput}
              onChange={(event) => setSubtaskInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (!subtaskInput.trim()) return;
                  patch({
                    subtasks: [...draft.subtasks, { id: uid('s'), title: subtaskInput.trim(), done: false }],
                  });
                  setSubtaskInput('');
                }
              }}
              placeholder="Add a step and press Enter"
              aria-label="New checklist step"
            />
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                if (!subtaskInput.trim()) return;
                patch({
                  subtasks: [...draft.subtasks, { id: uid('s'), title: subtaskInput.trim(), done: false }],
                });
                setSubtaskInput('');
              }}
            >
              <Plus size={14} /> Add
            </Button>
          </div>
        </fieldset>

        <Field label="Notes" htmlFor="task-notes" hint="Optional — instructions, page numbers, teacher notes.">
          <Textarea
            id="task-notes"
            rows={2}
            value={draft.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>

        <fieldset className="rounded-card border border-line bg-panel2/40 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Attachments
          </legend>
          {draft.attachments.length > 0 ? (
            <ul className="mb-2 space-y-1">
              {draft.attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center gap-2 text-[12px]">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-accent hover:underline"
                  >
                    {attachment.label || attachment.url}
                  </a>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.label}`}
                    onClick={() =>
                      patch({ attachments: draft.attachments.filter((entry) => entry.id !== attachment.id) })
                    }
                    className="ml-auto rounded p-1 text-muted hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-[11.5px] text-muted">Link a document, slide deck or reference.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={attachmentLabel}
              onChange={(event) => setAttachmentLabel(event.target.value)}
              placeholder="Label"
              aria-label="Attachment label"
            />
            <Input
              value={attachmentUrl}
              onChange={(event) => setAttachmentUrl(event.target.value)}
              placeholder="https://…"
              aria-label="Attachment URL"
            />
            <Button
              variant="outline"
              onClick={() => {
                if (!attachmentUrl.trim()) return;
                patch({
                  attachments: [
                    ...draft.attachments,
                    {
                      id: uid('att'),
                      label: attachmentLabel.trim() || attachmentUrl.trim(),
                      url: attachmentUrl.trim(),
                    },
                  ],
                });
                setAttachmentLabel('');
                setAttachmentUrl('');
              }}
            >
              Add link
            </Button>
          </div>
        </fieldset>

        {error && <p className="text-[11.5px] text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
