import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Pencil,
  Play,
  Star,
  Trash2,
  Youtube,
} from 'lucide-react';
import type { QuizResource, Resource, ViewMode } from '../lib/types';
import { formatBytes, formatDate, relativeTime, cn, downloadBlob, downloadJson, safeFilename } from '../lib/utils';
import { subjectMeta, RESOURCE_TYPE_LABEL } from '../lib/constants';
import { useLibrary } from '../state/LibraryProvider';
import { useToast } from '../state/ToastProvider';
import { Badge, IconButton, Menu } from './ui';
import type { MenuItem } from './ui';
import { Dialog, ConfirmDialog } from './Dialog';
import { Field, Input, Textarea, Button } from './ui';
import { cloneQuiz, exportQuizJson, quizDurationMinutes } from '../lib/quiz';
import { parseYouTubeId, youtubeThumbnail, youtubeWatchUrl } from '../lib/youtube';

function TypeGlyph({ type }: { type: Resource['type'] }) {
  const Icon = type === 'pdf' ? FileText : type === 'quiz' ? HelpCircle : Youtube;
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-card border',
        type === 'pdf'
          ? 'border-accent2/25 bg-accent2/10 text-accent2'
          : type === 'quiz'
            ? 'border-accent/25 bg-accent/10 text-accent'
            : 'border-danger/25 bg-danger/10 text-danger',
      )}
      aria-hidden="true"
    >
      <Icon size={17} />
    </span>
  );
}

export function ResourceCard({
  resource,
  view = 'grid',
  extraMenu = [],
  showSubject = true,
  className,
  onPreview,
}: {
  resource: Resource;
  view?: ViewMode;
  extraMenu?: MenuItem[];
  showSubject?: boolean;
  className?: string;
  onPreview?: (quiz: QuizResource) => void;
}) {
  const navigate = useNavigate();
  const { attempts, updateResource, deleteResource, toggleFavorite, addResources, getPdfBlob } = useLibrary();
  const toast = useToast();
  const subject = subjectMeta(resource.subject);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [title, setTitle] = useState(resource.title);
  const [description, setDescription] = useState(resource.description ?? '');
  const [url, setUrl] = useState(resource.type === 'video' ? resource.url : '');
  const [urlError, setUrlError] = useState('');
  const [copied, setCopied] = useState(false);

  const quizAttempts = useMemo(
    () => (resource.type === 'quiz' ? attempts.filter((attempt) => attempt.quizId === resource.id) : []),
    [attempts, resource],
  );
  const bestPercentage = quizAttempts.length
    ? Math.max(...quizAttempts.map((attempt) => attempt.percentage))
    : null;

  const open = () => {
    if (resource.type === 'pdf') navigate(`/pdf/${resource.id}`);
    else if (resource.type === 'quiz') navigate(`/quiz/${resource.id}`);
    else navigate(`/video/${resource.id}`);
  };

  const openEditor = () => {
    setTitle(resource.title);
    setDescription(resource.description ?? '');
    setUrl(resource.type === 'video' ? resource.url : '');
    setUrlError('');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!title.trim()) {
      toast.error('A title is required.');
      return;
    }
    const patch: Partial<Resource> = { title: title.trim(), description: description.trim() } as Partial<Resource>;
    if (resource.type === 'video') {
      const videoId = parseYouTubeId(url);
      if (!videoId) {
        setUrlError('Enter a valid YouTube URL or 11-character video id.');
        return;
      }
      Object.assign(patch, {
        videoId,
        url: youtubeWatchUrl(videoId),
        thumbnail: youtubeThumbnail(videoId),
      });
    }
    setSaving(true);
    await updateResource(resource.id, patch);
    setSaving(false);
    setEditOpen(false);
    toast.success('Resource updated');
  };

  const remove = async () => {
    setDeleting(true);
    await deleteResource(resource.id);
    setDeleting(false);
    setConfirmOpen(false);
    toast.success('Resource deleted', `"${resource.title}" was removed from your library.`);
  };

  const download = async () => {
    if (resource.type !== 'pdf') return;
    try {
      if (resource.fileId) {
        const blob = await getPdfBlob(resource);
        if (!blob) throw new Error('The stored file could not be found.');
        downloadBlob(blob, resource.filename);
      } else if (resource.sourceUrl) {
        const anchor = document.createElement('a');
        anchor.href = resource.sourceUrl;
        anchor.download = resource.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      toast.success('Download started', resource.filename);
    } catch (error) {
      toast.error('Download failed', (error as Error).message);
    }
  };

  const copyUrl = async () => {
    if (resource.type !== 'video') return;
    try {
      await navigator.clipboard.writeText(youtubeWatchUrl(resource.videoId));
      setCopied(true);
      toast.success('URL copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the URL', youtubeWatchUrl(resource.videoId));
    }
  };

  const duplicate = async () => {
    if (resource.type !== 'quiz') return;
    const copy = cloneQuiz(resource);
    await addResources([copy]);
    toast.success('Questionnaire duplicated', copy.title);
  };

  const exportJson = () => {
    if (resource.type !== 'quiz') return;
    downloadJson(exportQuizJson(resource), `${safeFilename(resource.title)}.json`);
    toast.success('JSON exported');
  };

  const items: MenuItem[] = [];
  if (resource.type === 'pdf') {
    items.push(
      { label: 'Open reader', icon: FileText, onClick: open },
      { label: 'Download', icon: Download, onClick: download },
      { label: 'Rename & describe', icon: Pencil, onClick: openEditor },
    );
  }
  if (resource.type === 'quiz') {
    items.push(
      { label: 'Start questionnaire', icon: Play, onClick: open },
      ...(onPreview ? [{ label: 'Preview questions', icon: HelpCircle, onClick: () => onPreview(resource) }] : []),
      { label: 'Edit questionnaire', icon: Pencil, onClick: () => navigate(`/quiz/${resource.id}/edit`) },
      { label: 'Duplicate', icon: Copy, onClick: duplicate },
      { label: 'Export JSON', icon: Download, onClick: exportJson },
    );
  }
  if (resource.type === 'video') {
    items.push(
      { label: 'Play video', icon: Play, onClick: open },
      { label: 'Edit metadata', icon: Pencil, onClick: openEditor },
      { label: copied ? 'URL copied' : 'Copy URL', icon: copied ? Check : Copy, onClick: copyUrl },
      {
        label: 'Open on YouTube',
        icon: ExternalLink,
        onClick: () => window.open(youtubeWatchUrl(resource.videoId), '_blank', 'noopener,noreferrer'),
      },
    );
  }
  items.push(...extraMenu);
  items.push(
    {
      label: resource.favorite ? 'Remove from favorites' : 'Add to favorites',
      icon: Star,
      onClick: () => void toggleFavorite(resource.id),
    },
    { separator: true },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirmOpen(true) },
  );

  const metaLine =
    resource.type === 'pdf'
      ? `${resource.size ? formatBytes(resource.size) : 'Linked file'} · Added ${formatDate(resource.createdAt)}`
      : resource.type === 'quiz'
        ? `${resource.questions.length} questions · ~${quizDurationMinutes(resource)} min${
            bestPercentage !== null ? ` · Best ${bestPercentage}%` : ''
          }`
        : `Added ${relativeTime(resource.createdAt)}`;

  const descriptionText = resource.description?.trim();

  return (
    <>
      <article
        className={cn(
          'group relative flex flex-col rounded-card border border-line bg-panel transition-[transform,border-color,box-shadow] duration-200 ease-calm hover:-translate-y-0.5 hover:border-muted/45 hover:shadow-lift focus-within:border-accent/50',
          view === 'list' ? 'gap-3 p-3.5 sm:flex-row sm:items-center' : 'gap-3 p-4',
          className,
        )}
      >
        <button
          type="button"
          onClick={open}
          aria-label={`Open ${RESOURCE_TYPE_LABEL[resource.type].toLowerCase()} ${resource.title}`}
          className="absolute inset-0 z-[1] rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />

        {resource.type === 'video' ? (
          <div
            className={cn(
              'pointer-events-none relative overflow-hidden rounded-[9px] border border-line bg-panel2',
              view === 'list' ? 'aspect-video w-full shrink-0 sm:w-40' : 'aspect-video w-full',
            )}
          >
            {!thumbFailed ? (
              <img
                src={resource.thumbnail || youtubeThumbnail(resource.videoId)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setThumbFailed(true)}
                className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted">
                <Youtube size={26} aria-hidden="true" />
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/50 text-white">
                <Play size={15} fill="currentColor" />
              </span>
            </span>
          </div>
        ) : (
          <div className={cn('flex items-start gap-3', view === 'list' && 'sm:w-40 sm:shrink-0')}>
            <TypeGlyph type={resource.type} />
            <div className="flex flex-wrap gap-1.5">
              <Badge>{RESOURCE_TYPE_LABEL[resource.type]}</Badge>
              {resource.type === 'quiz' && quizAttempts.length > 0 && (
                <Badge tone="warm">{quizAttempts.length} attempt{quizAttempts.length === 1 ? '' : 's'}</Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn('min-w-0 font-semibold leading-snug text-ink', view === 'list' ? 'text-[13.5px]' : 'text-[14px]')}>
              <span className="line-clamp-2">{resource.title}</span>
            </h3>
            <div className="relative z-20 -mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
              <IconButton
                label={resource.favorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() => void toggleFavorite(resource.id)}
                className={resource.favorite ? 'text-accent2' : undefined}
              >
                <Star size={15} fill={resource.favorite ? 'currentColor' : 'none'} />
              </IconButton>
              <Menu items={items} label={`Actions for ${resource.title}`} />
            </div>
          </div>

          {descriptionText && (
            <p className={cn('text-[12.5px] leading-relaxed text-ink2', view === 'list' ? 'line-clamp-1' : 'line-clamp-2')}>
              {descriptionText}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[11px] text-muted">
            {showSubject && (
              <>
                <span className="text-ink2">{resource.subject}</span>
                <span aria-hidden="true">·</span>
                <span>Grade {resource.grade}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{metaLine}</span>
            {resource.favorite && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-0.5 text-accent2">
                  <Star size={10} fill="currentColor" aria-hidden="true" /> Favorite
                </span>
              </>
            )}
          </div>
        </div>
      </article>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit resource"
        description="Titles and descriptions are yours to shape; the file itself stays untouched."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Title" htmlFor="resource-title">
            <Input id="resource-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          {resource.type === 'video' && (
            <Field label="YouTube URL" htmlFor="resource-url" error={urlError} hint="Standard, youtu.be, Shorts and embed links are accepted.">
              <Input
                id="resource-url"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setUrlError('');
                }}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </Field>
          )}
          <Field label="Description" htmlFor="resource-description" hint="Optional. Useful for exam scope, chapter or notes.">
            <Textarea
              id="resource-description"
              value={description}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={remove}
        loading={deleting}
        tone="danger"
        title="Delete this resource?"
        confirmLabel="Delete permanently"
        message={
          resource.type === 'pdf'
            ? `"${resource.title}" and its stored file${resource.fileId ? ' and annotations' : ''} will be removed from this device. This cannot be undone.`
            : resource.type === 'quiz'
              ? `"${resource.title}" and its recorded attempts will be removed from this device. This cannot be undone.`
              : `"${resource.title}" will be removed from your library. The video stays on YouTube.`
        }
      />
    </>
  );
}
