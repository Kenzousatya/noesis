import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  FileText,
  Grid2x2,
  List,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import type { Grade, PdfResource, PdfFileRecord, SubjectName, ViewMode } from '../lib/types';
import { useLibrary } from '../state/LibraryProvider';
import { useToast } from '../state/ToastProvider';
import { useSettings } from '../state/SettingsProvider';
import { formatBytes, pluralize, resourceMatches, sortResources, uid, cn } from '../lib/utils';
import { ResourceCard } from '../components/ResourceCard';
import { Button, EmptyState, Field, IconButton, ProgressBar, SearchField, Select } from '../components/ui';
import { Dialog } from '../components/Dialog';

type SortKey = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'reading' | 'saving' | 'done' | 'error' | 'cancelled';
  error?: string;
}

function validatePdf(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'Only PDF files are accepted.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > 120 * 1024 * 1024) return 'Files larger than 120 MB are not supported.';
  return null;
}

function readFileWithProgress(file: File, onProgress: (value: number) => void, readerRef: { current: FileReader | null }) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    reader.readAsArrayBuffer(file);
  });
}

function PdfUploaderDialog({
  open,
  onClose,
  subject,
  grade,
  initialFiles,
}: {
  open: boolean;
  onClose: () => void;
  subject: SubjectName;
  grade: Grade;
  initialFiles: File[];
}) {
  const { addResources } = useLibrary();
  const toast = useToast();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeReader = useRef<FileReader | null>(null);
  const cancelled = useRef(false);

  const addFiles = (files: File[]) => {
    const accepted: UploadItem[] = [];
    const problems: string[] = [];
    for (const file of files) {
      const problem = validatePdf(file);
      if (problem) problems.push(`${file.name} — ${problem}`);
      else accepted.push({ id: uid('u'), file, progress: 0, status: 'queued' });
    }
    if (accepted.length) setItems((current) => [...current, ...accepted]);
    setRejected(problems);
  };

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setRejected([]);
    setUploading(false);
    cancelled.current = false;
    if (initialFiles.length) addFiles(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const startUpload = async () => {
    const pending = items.filter((item) => item.status === 'queued' || item.status === 'error');
    if (!pending.length) return;
    setUploading(true);
    cancelled.current = false;
    const createdResources: PdfResource[] = [];
    const createdFiles: PdfFileRecord[] = [];
    let failed = 0;

    for (const item of pending) {
      if (cancelled.current) break;
      updateItem(item.id, { status: 'reading', progress: 0, error: undefined });
      try {
        const buffer = await readFileWithProgress(
          item.file,
          (value) => updateItem(item.id, { progress: value }),
          activeReader,
        );
        if (cancelled.current) {
          updateItem(item.id, { status: 'cancelled' });
          break;
        }
        updateItem(item.id, { status: 'saving', progress: 100 });
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const fileId = uid('f');
        const now = Date.now();
        createdFiles.push({
          id: fileId,
          name: item.file.name,
          size: blob.size,
          mime: 'application/pdf',
          blob,
        });
        createdResources.push({
          id: uid('p'),
          type: 'pdf',
          subject,
          grade,
          title: item.file.name.replace(/\.pdf$/i, ''),
          filename: item.file.name,
          size: blob.size,
          fileId,
          favorite: false,
          createdAt: now,
          updatedAt: now,
        });
        updateItem(item.id, { status: 'done', progress: 100 });
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          updateItem(item.id, { status: 'cancelled' });
          break;
        }
        failed += 1;
        updateItem(item.id, { status: 'error', error: (error as Error).message });
      } finally {
        activeReader.current = null;
      }
    }

    if (createdResources.length) {
      try {
        await addResources(createdResources, createdFiles);
        toast.success(
          `${pluralize(createdResources.length, 'PDF')} added`,
          `${subject} · Grade ${grade}`,
        );
      } catch (error) {
        toast.error('Could not save the PDFs', (error as Error).message);
        setUploading(false);
        return;
      }
    }
    if (failed) toast.error(`${pluralize(failed, 'file')} failed to upload`);
    setUploading(false);
    if (!cancelled.current || createdResources.length) {
      window.setTimeout(() => {
        onClose();
      }, createdResources.length ? 350 : 0);
    }
  };

  const cancel = () => {
    cancelled.current = true;
    activeReader.current?.abort();
    setUploading(false);
    toast.info('Upload cancelled', 'Files already saved remain in the library.');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (uploading) return;
    addFiles(Array.from(event.dataTransfer.files));
  };

  const removable = !uploading;

  return (
    <Dialog
      open={open}
      onClose={uploading ? cancel : onClose}
      title="Add study materials"
      description={`Files are stored in this browser for ${subject} · Grade ${grade}.`}
      size="lg"
      footer={
        <>
          {uploading ? (
            <Button variant="danger" onClick={cancel}>
              Cancel upload
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
          <Button onClick={startUpload} loading={uploading} disabled={!items.some((item) => item.status === 'queued' || item.status === 'error')}>
            <Upload size={15} /> Upload {items.filter((item) => item.status === 'queued').length || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed px-5 py-8 text-center transition-colors',
            dragActive ? 'border-accent bg-accent/10' : 'border-line bg-panel2/50',
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-accent">
            <FileText size={18} aria-hidden="true" />
          </span>
          <p className="text-[13px] font-medium text-ink">Drag PDFs here, or choose files</p>
          <p className="text-[11.5px] text-muted">PDF only · multiple files supported · up to 120 MB each</p>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-1">
            Choose PDF files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) addFiles(Array.from(event.target.files));
              event.target.value = '';
            }}
          />
        </div>

        {rejected.length > 0 && (
          <div className="rounded-card border border-danger/30 bg-danger/10 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-danger">
              <AlertTriangle size={13} aria-hidden="true" /> Unsupported files were not added
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[11.5px] leading-relaxed text-danger/90">
              {rejected.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-card border border-line bg-panel2/60 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <FileText size={15} className="shrink-0 text-accent2" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{item.file.name}</p>
                    <p className="text-[10.5px] text-muted">
                      {formatBytes(item.file.size)}
                      {item.status === 'reading' && ` · reading ${item.progress}%`}
                      {item.status === 'saving' && ' · saving to library'}
                      {item.status === 'done' && ' · saved'}
                      {item.status === 'cancelled' && ' · cancelled'}
                      {item.error ? ` · ${item.error}` : ''}
                    </p>
                  </div>
                  {item.status === 'done' && <CheckCircle2 size={15} className="text-success" aria-hidden="true" />}
                  {item.status === 'cancelled' && <Ban size={15} className="text-muted" aria-hidden="true" />}
                  {removable && (
                    <IconButton
                      label={`Remove ${item.file.name}`}
                      onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                    >
                      <X size={14} />
                    </IconButton>
                  )}
                </div>
                {(item.status === 'reading' || item.status === 'saving' || item.status === 'done') && (
                  <ProgressBar value={item.progress} className="mt-2" tone={item.status === 'done' ? 'accent' : 'accent'} />
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] leading-relaxed text-muted">
          Files are written to IndexedDB in this browser. Nothing is uploaded to a server. Use Settings → Backup to
          keep a portable copy.
        </p>
      </div>
    </Dialog>
  );
}

export default function PdfSection({ subject, grade }: { subject: SubjectName; grade: Grade }) {
  const { resources } = useLibrary();
  const { settings, setLibraryView } = useSettings();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('date-desc');
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const view: ViewMode = settings.libraryView;

  const materials = useMemo(
    () =>
      resources.filter(
        (resource): resource is PdfResource =>
          resource.type === 'pdf' &&
          resource.subject === subject &&
          resource.grade === grade &&
          resourceMatches(resource, query),
      ),
    [resources, subject, grade, query],
  );

  const sorted = useMemo(() => sortResources(materials, sort), [materials, sort]);
  const totalSize = materials.reduce((sum, resource) => sum + resource.size, 0);

  const openUploader = (files: File[] = []) => {
    setPendingFiles(files);
    setUploaderOpen(true);
  };

  return (
    <div
      className="relative"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragActive(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files?.length) return;
        event.preventDefault();
        setDragActive(false);
        openUploader(Array.from(event.dataTransfer.files));
      }}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-panel border border-dashed border-accent bg-accent/10">
          <p className="text-[13px] font-medium text-accent">Drop PDFs to add them to Grade {grade}</p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search this collection…"
            className="w-full sm:max-w-xs"
            ariaLabel="Search study materials"
          />
          <Select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort study materials">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="size-desc">Largest first</option>
            <option value="size-asc">Smallest first</option>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5 rounded-input border border-line bg-panel2 p-0.5">
            <IconButton label="Grid view" active={view === 'grid'} onClick={() => setLibraryView('grid')}>
              <Grid2x2 size={15} />
            </IconButton>
            <IconButton label="List view" active={view === 'list'} onClick={() => setLibraryView('list')}>
              <List size={15} />
            </IconButton>
          </div>
          <Button onClick={() => openUploader()}>
            <Upload size={15} /> Upload PDF
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-[11px] text-muted">
        <span>
          {materials.length} {materials.length === 1 ? 'document' : 'documents'}
          {totalSize > 0 ? ` · ${formatBytes(totalSize)}` : ''}
        </span>
        <span className="hidden sm:inline">Drop PDFs anywhere in this panel to upload</span>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={query ? 'No study materials match' : 'No study materials yet'}
          description={
            query
              ? 'Try a different search term, or clear the field to see the full collection.'
              : `Add your first PDF to start building the Grade ${grade} ${subject} collection.`
          }
          action={
            query ? (
              <Button variant="outline" onClick={() => setQuery('')}>
                Clear search
              </Button>
            ) : (
              <Button onClick={() => openUploader()}>
                <Upload size={15} /> Upload PDF
              </Button>
            )
          }
        />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-2'}>
          {sorted.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} view={view} showSubject={false} />
          ))}
        </div>
      )}

      <PdfUploaderDialog
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        subject={subject}
        grade={grade}
        initialFiles={pendingFiles}
      />
    </div>
  );
}
