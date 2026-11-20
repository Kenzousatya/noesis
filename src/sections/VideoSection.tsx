import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Folder,
  FolderInput,
  FolderPlus,
  Grid2x2,
  List,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Youtube,
} from 'lucide-react';
import type { FolderAccent, Grade, SubjectName, VideoFolder, VideoResource } from '../lib/types';
import { GRADES } from '../lib/types';
import { SUBJECTS } from '../lib/constants';
import { parseYouTubeId, fetchVideoMetadata, youtubeThumbnail, youtubeWatchUrl } from '../lib/youtube';
import { resourceMatches, sortResources, cn } from '../lib/utils';
import { useLibrary } from '../state/LibraryProvider';
import { useWorkspace } from '../state/WorkspaceProvider';
import { useToast } from '../state/ToastProvider';
import { useSettings } from '../state/SettingsProvider';
import { ResourceCard } from '../components/ResourceCard';
import { Button, EmptyState, Field, IconButton, Input, SearchField, Select, Textarea, Badge, Menu } from '../components/ui';
import { Dialog } from '../components/Dialog';

export const FOLDER_ACCENTS: Record<FolderAccent, string> = {
  sage: '#8BBFA8',
  brass: '#C4AD84',
  slate: '#8FA6C4',
  clay: '#D57C77',
  olive: '#B6C48B',
};

export function VideoDialog({
  open,
  onClose,
  subject,
  grade,
  video,
  folderId,
}: {
  open: boolean;
  onClose: () => void;
  subject: SubjectName;
  grade: Grade;
  video?: VideoResource;
  folderId?: string | null;
}) {
  const { addResources, updateResource } = useLibrary();
  const { folders } = useWorkspace();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selSubject, setSelSubject] = useState<SubjectName>(subject);
  const [selGrade, setSelGrade] = useState<Grade>(grade);
  const [selFolder, setSelFolder] = useState<string>('');
  const [customThumb, setCustomThumb] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaFailed, setMetaFailed] = useState(false);
  const titleTouched = useRef(false);

  const videoId = useMemo(() => parseYouTubeId(url), [url]);
  const subjectFolders = useMemo(
    () =>
      folders
        .filter((folder) => folder.subject === selSubject && folder.grade === selGrade)
        .sort((a, b) => a.order - b.order),
    [folders, selSubject, selGrade],
  );

  useEffect(() => {
    if (!open) return;
    setUrl(video?.url ?? '');
    setTitle(video?.title ?? '');
    setDescription(video?.description ?? '');
    setSelSubject(video?.subject ?? subject);
    setSelGrade(video?.grade ?? grade);
    setSelFolder(video?.folderId ?? folderId ?? '');
    setCustomThumb(video?.thumbnail && !video.thumbnail.includes('i.ytimg.com') ? video.thumbnail : '');
    setError('');
    setSaving(false);
    setMetaFailed(false);
    setMetaLoading(false);
    titleTouched.current = Boolean(video);
  }, [open, video, subject, grade, folderId]);

  useEffect(() => {
    if (!open || !videoId || video) return;
    let cancelled = false;
    setMetaLoading(true);
    setMetaFailed(false);
    const timer = window.setTimeout(async () => {
      const metadata = await fetchVideoMetadata(videoId);
      if (cancelled) return;
      if (metadata) {
        if (!titleTouched.current && metadata.title) setTitle(metadata.title);
      } else {
        setMetaFailed(true);
      }
      setMetaLoading(false);
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [videoId, open, video]);

  const save = async () => {
    if (!videoId) {
      setError('Paste a valid YouTube URL — standard, youtu.be, Shorts or embed links all work.');
      return;
    }
    if (!title.trim()) {
      setError('Add a title for this video.');
      return;
    }
    setSaving(true);
    try {
      const patch = {
        title: title.trim(),
        description: description.trim(),
        subject: selSubject,
        grade: selGrade,
        videoId,
        url: youtubeWatchUrl(videoId),
        thumbnail: customThumb.trim() || youtubeThumbnail(videoId),
        folderId: selFolder || undefined,
      };
      if (video) {
        await updateResource(video.id, patch);
        toast.success('Video updated');
      } else {
        const now = Date.now();
        const resource: VideoResource = {
          id: `v${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          type: 'video',
          favorite: false,
          createdAt: now,
          updatedAt: now,
          ...patch,
        };
        await addResources([resource]);
        toast.success('Video added', `${selSubject} · Grade ${selGrade}`);
      }
      onClose();
    } catch (err) {
      toast.error('Could not save the video', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={video ? 'Edit video' : 'Add a video'}
      description="NOEMA stores the link and its details. Playback uses YouTube's official embed."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {video ? 'Save changes' : 'Add video'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="YouTube URL"
          htmlFor="video-url"
          error={error && !videoId ? error : undefined}
          hint="Standard, youtu.be, Shorts and /embed/ links are recognised automatically."
        >
          <Input
            id="video-url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError('');
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            autoFocus
          />
        </Field>

        {videoId && (
          <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-panel2/50 p-2.5">
            <div className="flex items-center gap-2.5">
              <img
                src={customThumb.trim() || youtubeThumbnail(videoId)}
                alt=""
                className="h-12 w-20 rounded-md border border-line object-cover"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                }}
              />
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent">
                  <CheckCircle2 size={12} aria-hidden="true" /> Video ID
                </p>
                <p className="text-[11.5px] text-ink2">{videoId}</p>
              </div>
            </div>
            <Badge>youtube</Badge>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px]">
          {metaLoading ? (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Looking up the video title…
            </span>
          ) : metaFailed ? (
            <span className="inline-flex items-center gap-1.5 text-accent2">
              <AlertTriangle size={12} aria-hidden="true" /> Metadata lookup unavailable — enter the title manually.
            </span>
          ) : videoId ? (
            <span className="text-muted">Metadata is best effort; you can always edit the details.</span>
          ) : null}
        </div>

        <Field label="Title" htmlFor="video-title" error={error && videoId && !title.trim() ? error : undefined}>
          <Input
            id="video-title"
            value={title}
            onChange={(event) => {
              titleTouched.current = true;
              setTitle(event.target.value);
              setError('');
            }}
            placeholder="Video title"
          />
        </Field>

        <Field label="Description" htmlFor="video-description" hint="Optional — topic, chapter or why it is useful.">
          <Textarea
            id="video-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject" htmlFor="video-subject">
            <Select
              id="video-subject"
              value={selSubject}
              onChange={(event) => {
                setSelSubject(event.target.value as SubjectName);
                setSelFolder('');
              }}
              className="w-full"
            >
              {SUBJECTS.map((entry) => (
                <option key={entry.slug} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grade" htmlFor="video-grade">
            <Select
              id="video-grade"
              value={selGrade}
              onChange={(event) => {
                setSelGrade(Number(event.target.value) as Grade);
                setSelFolder('');
              }}
              className="w-full"
            >
              {GRADES.map((entry) => (
                <option key={entry} value={entry}>
                  Grade {entry}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Folder" htmlFor="video-folder" hint="Optional — the root collection is always available.">
          <Select
            id="video-folder"
            value={selFolder}
            onChange={(event) => setSelFolder(event.target.value)}
            className="w-full"
          >
            <option value="">Root collection (no folder)</option>
            {subjectFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Custom thumbnail URL" htmlFor="video-thumb" hint="Optional. Leave empty to use the YouTube thumbnail.">
          <Input
            id="video-thumb"
            value={customThumb}
            onChange={(event) => setCustomThumb(event.target.value)}
            placeholder="https://…"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function FolderDialog({
  open,
  onClose,
  subject,
  grade,
  folder,
}: {
  open: boolean;
  onClose: () => void;
  subject: SubjectName;
  grade: Grade;
  folder?: VideoFolder;
}) {
  const { createFolder, updateFolder } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState(folder?.name ?? '');
  const [description, setDescription] = useState(folder?.description ?? '');
  const [accent, setAccent] = useState<FolderAccent>(folder?.accent ?? 'sage');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState('');

  const identity = `${open}-${folder?.id ?? 'new'}`;
  if (identity !== key) {
    setKey(identity);
    setName(folder?.name ?? '');
    setDescription(folder?.description ?? '');
    setAccent(folder?.accent ?? 'sage');
    setError('');
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Give the folder a name.');
      return;
    }
    setSaving(true);
    try {
      if (folder) {
        await updateFolder(folder.id, { name: name.trim(), description: description.trim(), accent });
        toast.success('Folder updated');
      } else {
        await createFolder({
          name: name.trim(),
          description: description.trim(),
          accent,
          subject,
          grade,
        });
        toast.success('Folder created', `${subject} · Grade ${grade}`);
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
      title={folder ? 'Rename folder' : 'New folder'}
      description={`${subject} · Grade ${grade}. Folders are local to this subject and grade.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {folder ? 'Save folder' : 'Create folder'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Folder name" htmlFor="folder-name" error={error || undefined}>
          <Input
            id="folder-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
            placeholder="e.g. Algebra"
            autoFocus
          />
        </Field>
        <Field label="Description" htmlFor="folder-description" hint="Optional.">
          <Textarea id="folder-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div>
          <p className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink2">Accent</p>
          <div className="flex gap-1.5">
            {(Object.keys(FOLDER_ACCENTS) as FolderAccent[]).map((tone) => (
              <button
                key={tone}
                type="button"
                aria-label={`Use ${tone} accent`}
                aria-pressed={accent === tone}
                onClick={() => setAccent(tone)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-transform',
                  accent === tone ? 'scale-110 border-ink/60' : 'border-transparent opacity-80 hover:opacity-100',
                )}
                style={{ backgroundColor: FOLDER_ACCENTS[tone] }}
              />
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function DeleteFolderDialog({
  open,
  onClose,
  folder,
  count,
}: {
  open: boolean;
  onClose: () => void;
  folder: VideoFolder | null;
  count: number;
}) {
  const { deleteFolder } = useWorkspace();
  const toast = useToast();
  const [busy, setBusy] = useState<'keep' | 'delete' | null>(null);
  if (!folder) return null;

  const run = async (mode: 'keep' | 'delete') => {
    setBusy(mode);
    try {
      await deleteFolder(folder.id, mode);
      toast.success('Folder deleted', mode === 'keep' ? 'Videos moved to the root collection.' : 'Its videos were deleted too.');
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Delete “${folder.name}”?`}
      description="Nothing is removed silently — choose what happens to the videos inside."
      size="sm"
      footer={
        <Button variant="ghost" onClick={onClose} disabled={Boolean(busy)}>
          Cancel
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] leading-relaxed text-ink2">
          This folder contains {count} video{count === 1 ? '' : 's'}.
        </p>
        <button
          type="button"
          onClick={() => void run('keep')}
          disabled={Boolean(busy)}
          className="flex items-start gap-2.5 rounded-card border border-line p-3 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.05] disabled:opacity-60"
        >
          <FolderInput size={16} className="mt-0.5 text-accent" aria-hidden="true" />
          <span>
            <span className="block text-[12.5px] font-semibold text-ink">
              {busy === 'keep' ? 'Moving…' : 'Keep the videos'}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-ink2">Move them back to the root collection.</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => void run('delete')}
          disabled={Boolean(busy)}
          className="flex items-start gap-2.5 rounded-card border border-danger/35 bg-danger/[0.06] p-3 text-left transition-colors hover:bg-danger/10 disabled:opacity-60"
        >
          <Trash2 size={16} className="mt-0.5 text-danger" aria-hidden="true" />
          <span>
            <span className="block text-[12.5px] font-semibold text-danger">
              {busy === 'delete' ? 'Deleting…' : 'Delete the videos too'}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-ink2">
              Removes the folder and every video inside it from your library.
            </span>
          </span>
        </button>
      </div>
    </Dialog>
  );
}

function MoveVideoDialog({
  open,
  onClose,
  video,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  video: VideoResource | null;
  folders: VideoFolder[];
}) {
  const { updateResource } = useLibrary();
  const toast = useToast();
  const [target, setTarget] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setTarget(video?.folderId ?? '');
  }, [open, video]);

  if (!video) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Move video"
      description={`“${video.title}” — moving never copies the video.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await updateResource(video.id, { folderId: target || undefined } as never);
                toast.success(target ? 'Video moved' : 'Video moved to the root collection');
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            Move video
          </Button>
        </>
      }
    >
      <Field label="Destination" htmlFor="move-target">
        <Select id="move-target" className="w-full" value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="">Root collection (no folder)</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}

export default function VideoSection({ subject, grade }: { subject: SubjectName; grade: Grade }) {
  const { resources } = useLibrary();
  const { folders, moveFolder } = useWorkspace();
  const { settings, setLibraryView } = useSettings();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'date-desc' | 'date-asc' | 'name-asc'>('date-desc');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VideoFolder | undefined>();
  const [deletingFolder, setDeletingFolder] = useState<VideoFolder | null>(null);
  const [movingVideo, setMovingVideo] = useState<VideoResource | null>(null);

  useEffect(() => {
    setFolderId(null);
    setQuery('');
  }, [subject, grade]);

  const subjectFolders = useMemo(
    () =>
      folders
        .filter((folder) => folder.subject === subject && folder.grade === grade)
        .sort((a, b) => a.order - b.order),
    [folders, subject, grade],
  );

  const allVideos = useMemo(
    () =>
      resources.filter(
        (resource): resource is VideoResource => resource.type === 'video' && resource.subject === subject && resource.grade === grade,
      ),
    [resources, subject, grade],
  );

  const activeFolder = subjectFolders.find((folder) => folder.id === folderId) ?? null;

  useEffect(() => {
    if (folderId && !subjectFolders.some((folder) => folder.id === folderId)) setFolderId(null);
  }, [folderId, subjectFolders]);

  const visibleVideos = useMemo(() => {
    const scoped = query.trim()
      ? allVideos
      : allVideos.filter((video) => (folderId ? video.folderId === folderId : !video.folderId));
    return sortResources(scoped.filter((video) => resourceMatches(video, query)), sort);
  }, [allVideos, query, folderId, sort]);

  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const video of allVideos) {
      if (!video.folderId) continue;
      map.set(video.folderId, (map.get(video.folderId) ?? 0) + 1);
    }
    return map;
  }, [allVideos]);

  const unfiled = allVideos.filter((video) => !video.folderId).length;

  const openFolder = (folder: VideoFolder) => {
    setFolderId(folder.id);
    setQuery('');
  };

  return (
    <div>
      <nav aria-label="Video bank breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-muted">
        <button
          type="button"
          onClick={() => {
            setFolderId(null);
            setQuery('');
          }}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-accent',
            folderId ? 'text-ink2' : 'text-ink',
          )}
        >
          <Youtube size={12} aria-hidden="true" /> Video Bank
        </button>
        <ChevronRight size={11} aria-hidden="true" />
        <span className="text-ink2">Grade {grade}</span>
        {activeFolder && (
          <>
            <ChevronRight size={11} aria-hidden="true" />
            <span className="text-ink">{activeFolder.name}</span>
          </>
        )}
      </nav>

      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={query && folderId ? 'Searching all folders…' : 'Search videos and folders…'}
            className="w-full sm:max-w-xs"
            ariaLabel="Search videos"
          />
          <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort videos">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
          </Select>
          {folderId && (
            <span className="text-[10.5px] text-muted">Searching searches the whole bank</span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-0.5 rounded-input border border-line bg-panel2 p-0.5">
            <IconButton label="Grid view" active={settings.libraryView === 'grid'} onClick={() => setLibraryView('grid')}>
              <Grid2x2 size={15} />
            </IconButton>
            <IconButton label="List view" active={settings.libraryView === 'list'} onClick={() => setLibraryView('list')}>
              <List size={15} />
            </IconButton>
          </div>
          <Button variant="outline" onClick={() => setFolderDialogOpen(true)}>
            <FolderPlus size={15} /> New Folder
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus size={15} /> Add video
          </Button>
        </div>
      </div>

      {!folderId && !query.trim() && (
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Folders</h3>
            <span className="text-[10.5px] text-muted">{subjectFolders.length} · {unfiled} unfiled</span>
          </div>
          {subjectFolders.length === 0 ? (
            <button
              type="button"
              onClick={() => setFolderDialogOpen(true)}
              className="flex w-full items-center gap-3 rounded-card border border-dashed border-line bg-panel/40 px-4 py-3 text-left transition-colors hover:border-accent/40"
            >
              <FolderPlus size={16} className="text-accent" aria-hidden="true" />
              <span>
                <span className="block text-[12.5px] font-medium text-ink">Create your first folder</span>
                <span className="text-[11px] text-muted">Group videos by topic inside this subject and grade.</span>
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {subjectFolders.map((folder, index) => (
                <div
                  key={folder.id}
                  className="group relative flex items-start gap-3 rounded-card border border-line bg-panel p-3.5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/35"
                >
                  <button type="button" onClick={() => openFolder(folder)} className="absolute inset-0 rounded-card" aria-label={`Open folder ${folder.name}`} />
                  <span
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                    style={{
                      borderColor: `${FOLDER_ACCENTS[folder.accent]}44`,
                      backgroundColor: `${FOLDER_ACCENTS[folder.accent]}16`,
                      color: FOLDER_ACCENTS[folder.accent],
                    }}
                  >
                    <Folder size={16} aria-hidden="true" />
                  </span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{folder.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {folderCounts.get(folder.id) ?? 0} video{(folderCounts.get(folder.id) ?? 0) === 1 ? '' : 's'}
                      {folder.description ? ` · ${folder.description}` : ''}
                    </span>
                  </span>
                  <span className="relative z-10 flex shrink-0 items-center gap-0.5">
                    <Menu
                      label={`Actions for ${folder.name}`}
                      items={[
                        { label: 'Open folder', icon: Folder, onClick: () => openFolder(folder) },
                        {
                          label: 'Rename & describe',
                          icon: Pencil,
                          onClick: () => {
                            setEditingFolder(folder);
                            setFolderDialogOpen(true);
                          },
                        },
                        { label: 'Move earlier', onClick: () => void moveFolder(folder.id, -1), disabled: index === 0 },
                        {
                          label: 'Move later',
                          onClick: () => void moveFolder(folder.id, 1),
                          disabled: index === subjectFolders.length - 1,
                        },
                        { separator: true },
                        { label: 'Delete folder', icon: Trash2, danger: true, onClick: () => setDeletingFolder(folder) },
                      ]}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
        <span>
          {query.trim() ? `${visibleVideos.length} result${visibleVideos.length === 1 ? '' : 's'} across the bank` : `${visibleVideos.length} video${visibleVideos.length === 1 ? '' : 's'}`}
          {activeFolder && !query.trim() ? ` in ${activeFolder.name}` : ''}
        </span>
        <span className="hidden sm:inline">Playback stays inside NOEMA</span>
      </div>

      {visibleVideos.length === 0 ? (
        <EmptyState
          icon={Youtube}
          title={query.trim() ? 'No videos match' : activeFolder ? 'This folder is empty' : 'No videos yet'}
          description={
            query.trim()
              ? 'Try another search term, or clear the field to see the collection.'
              : activeFolder
                ? 'Add a video straight into this folder, or move an existing one here.'
                : `Save a YouTube video for Grade ${grade} ${subject} — lectures, explanations or worked examples.`
          }
          action={
            query.trim() ? (
              <Button variant="outline" onClick={() => setQuery('')}>
                Clear search
              </Button>
            ) : (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus size={15} /> Add video
              </Button>
            )
          }
        />
      ) : (
        <div
          className={
            settings.libraryView === 'grid'
              ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3'
              : 'flex flex-col gap-2'
          }
        >
          {visibleVideos.map((video) => {
            const folder = video.folderId ? subjectFolders.find((entry) => entry.id === video.folderId) : undefined;
            return (
              <div key={video.id} className="flex flex-col gap-1">
                <ResourceCard
                  resource={video}
                  view={settings.libraryView}
                  showSubject={false}
                  extraMenu={[
                    { label: 'Move to folder…', icon: FolderInput, onClick: () => setMovingVideo(video) },
                    ...(folder
                      ? [{ label: 'Open folder', icon: Folder, onClick: () => openFolder(folder) }]
                      : []),
                  ]}
                />
                {query.trim() && folder && (
                  <p className="px-1 text-[10px] text-muted">
                    in <span className="text-ink2">{folder.name}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!folderId && query.trim() && unfiled > 0 && (
        <p className="mt-3 text-[11px] text-muted">
          {unfiled} video{unfiled === 1 ? '' : 's'} in this grade are not in a folder yet.
        </p>
      )}

      <VideoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        subject={subject}
        grade={grade}
        folderId={folderId}
      />

      <FolderDialog
        open={folderDialogOpen}
        onClose={() => {
          setFolderDialogOpen(false);
          setEditingFolder(undefined);
        }}
        subject={subject}
        grade={grade}
        folder={editingFolder}
      />

      <DeleteFolderDialog
        open={Boolean(deletingFolder)}
        onClose={() => setDeletingFolder(null)}
        folder={deletingFolder}
        count={deletingFolder ? folderCounts.get(deletingFolder.id) ?? 0 : 0}
      />

      <MoveVideoDialog
        open={Boolean(movingVideo)}
        onClose={() => setMovingVideo(null)}
        video={movingVideo}
        folders={subjectFolders}
      />

    </div>
  );
}
