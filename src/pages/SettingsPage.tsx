import { useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  Check,
  Database,
  Download,
  FileJson,
  HardDrive,
  Info,
  LayoutDashboard,
  Library,
  Monitor,
  Moon,
  PanelLeft,
  RotateCcw,
  ShieldCheck,
  Sun,
  Upload,
} from 'lucide-react';
import { useLibrary } from '../state/LibraryProvider';
import { useSettings } from '../state/SettingsProvider';
import { useWorkspace } from '../state/WorkspaceProvider';
import { useToast } from '../state/ToastProvider';
import { formatBytes } from '../lib/utils';
import { APP_VERSION, backupFilename, createBackup, createMetadataExport, parseBackupFile } from '../lib/backup';
import type { ParsedBackup } from '../lib/backup';
import { downloadBlob } from '../lib/utils';
import { Dialog, ConfirmDialog } from '../components/Dialog';
import { Badge, Button, CheckRow, ProgressBar, Segmented } from '../components/ui';
import { LambdaMark, Wordmark } from '../components/Logo';
import type { DashboardSectionKey, ThemeMode, ViewMode } from '../lib/types';

function Section({
  title,
  description,
  children,
  icon: Icon,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <section className="rounded-panel border border-line bg-panel">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-panel2 text-accent">
          <Icon size={15} />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink2">{description}</p>
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const DASHBOARD_SECTIONS: Array<{ key: DashboardSectionKey; label: string }> = [
  { key: 'today', label: 'Today at a glance' },
  { key: 'priority', label: 'Priority tasks' },
  { key: 'timetable', label: "Today's timetable" },
  { key: 'continue', label: 'Continue studying' },
  { key: 'subjects', label: 'Subject overview' },
  { key: 'recent', label: 'Recently added' },
  { key: 'activity', label: 'Academic activity' },
];

const THEMES: Array<{ value: ThemeMode; label: string; icon: typeof Sun; swatch: string[] }> = [
  { value: 'dark', label: 'Dark', icon: Moon, swatch: ['#101411', '#1A211D', '#8BBFA8'] },
  { value: 'light', label: 'Light', icon: Sun, swatch: ['#F1F0EA', '#FFFFFF', '#527F69'] },
  { value: 'system', label: 'System', icon: Monitor, swatch: ['#101411', '#F1F0EA', '#8BBFA8'] },
];

export default function SettingsPage() {
  const { resources, attempts, storage, storageError, refreshStorage, importBackup, importBundled, bundledImported } =
    useLibrary();
  const { settings, update, setTheme, setLibraryView, setSidebarCollapsed } = useSettings();
  const { tasks, folders, schedule, importWorkspace } = useWorkspace();
  const toast = useToast();
  const restoreInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importingBundle, setImportingBundle] = useState(false);

  const counts = useMemo(() => {
    const pdfs = resources.filter((resource) => resource.type === 'pdf');
    return {
      pdfs: pdfs.length,
      quizzes: resources.filter((resource) => resource.type === 'quiz').length,
      videos: resources.filter((resource) => resource.type === 'video').length,
      files: pdfs.filter((resource) => resource.fileId).length,
      bytes: pdfs.reduce((sum, resource) => sum + (resource.type === 'pdf' ? resource.size : 0), 0),
      attempts: attempts.length,
      tasks: tasks.length,
      folders: folders.length,
      lessons: schedule.entries.length,
    };
  }, [resources, attempts, tasks, folders, schedule]);

  const usedPercent = storage && storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  const exportBackup = async () => {
    setExporting(true);
    try {
      const blob = await createBackup(resources, attempts, settings);
      downloadBlob(blob, backupFilename());
      toast.success('Backup exported', 'Metadata and stored PDF files were packaged as a ZIP archive.');
    } catch (error) {
      toast.error('Backup failed', (error as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const exportMetadata = () => {
    const blob = createMetadataExport(resources, attempts, settings);
    downloadBlob(blob, `noema-metadata-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success('Metadata exported', 'A JSON file with resources and attempt history.');
  };

  const chooseRestore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await parseBackupFile(file);
      if (parsed.errors.length || !parsed.manifest?.resources) {
        toast.error('This backup cannot be restored', parsed.errors[0] ?? 'The manifest is incomplete.');
        return;
      }
      setPending(parsed);
      setMode('merge');
    } catch (error) {
      toast.error('Could not read the backup', (error as Error).message);
    }
  };

  const confirmRestore = async () => {
    if (!pending) return;
    setRestoring(true);
    try {
      const result = await importBackup(
        pending.manifest.resources,
        pending.files,
        pending.manifest.attempts,
        pending.manifest.annotations,
        mode,
        mode === 'replace' ? pending.manifest.settings : undefined,
      );
      await importWorkspace(
        {
          tasks: pending.manifest.tasks ?? [],
          folders: pending.manifest.videoFolders ?? [],
          schedule: pending.manifest.schedule ?? null,
        },
        mode,
      );
      toast.success(
        mode === 'replace' ? 'Library restored' : 'Backup merged',
        `${result.added} resource${result.added === 1 ? '' : 's'} and ${
          (pending.manifest.tasks ?? []).length
        } task${(pending.manifest.tasks ?? []).length === 1 ? '' : 's'} written to this browser.`,
      );
      setPending(null);
      await refreshStorage();
    } catch (error) {
      toast.error('Restore failed', (error as Error).message);
    } finally {
      setRestoring(false);
    }
  };

  const runBundledImport = async () => {
    setImportingBundle(true);
    try {
      const result = await importBundled();
      toast.success(
        'Bundled library imported',
        `${result.pdfs} PDFs and ${result.quizzes} questionnaires added${result.skipped ? `, ${result.skipped} skipped` : ''}.`,
      );
    } catch (error) {
      toast.error('Bundled import failed', (error as Error).message);
    } finally {
      setImportingBundle(false);
    }
  };

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Preferences</p>
        <h1 className="editorial mt-2 text-[28px] leading-tight text-ink sm:text-[34px]">Settings.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink2">
          Appearance, sidebar behaviour, local storage and portable copies of your archive.
        </p>
      </header>

      <Section
        icon={Sun}
        title="Appearance"
        description="NOEMA is dark-first, with an equally considered light theme. The choice persists in this browser."
      >
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {THEMES.map((theme) => {
            const active = settings.theme === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                onClick={() => setTheme(theme.value)}
                aria-pressed={active}
                className={`rounded-card border p-3 text-left transition-colors ${
                  active ? 'border-accent bg-accent/[0.06]' : 'border-line hover:border-muted/45'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink">
                    <theme.icon size={14} className={active ? 'text-accent' : 'text-muted'} />
                    {theme.label}
                  </span>
                  {active && <Check size={14} className="text-accent" aria-hidden="true" />}
                </span>
                <span className="mt-2.5 flex gap-1" aria-hidden="true">
                  {theme.swatch.map((color) => (
                    <span
                      key={color}
                      className="h-5 flex-1 rounded-[3px] border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-ink2">Start with the sidebar</p>
            <Segmented
              label="Sidebar default"
              value={settings.sidebarCollapsed ? 'collapsed' : 'expanded'}
              onChange={(value) => setSidebarCollapsed(value === 'collapsed')}
              options={[
                { value: 'expanded', label: 'Expanded' },
                { value: 'collapsed', label: 'Collapsed' },
              ]}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              Applies immediately and when NOEMA is reopened.
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-ink2">Library layout</p>
            <Segmented<ViewMode>
              label="Library view"
              value={settings.libraryView}
              onChange={setLibraryView}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ]}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              The default for collections in every subject.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink2">
            <LayoutDashboard size={13} className="text-accent" aria-hidden="true" /> Dashboard sections
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            Hide any part of the command centre. The archive and tasks themselves are untouched.
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {DASHBOARD_SECTIONS.map((section) => (
              <CheckRow
                key={section.key}
                id={`dash-${section.key}`}
                checked={!settings.dashboardHidden.includes(section.key)}
                onChange={(checked) =>
                  update({
                    dashboardHidden: checked
                      ? settings.dashboardHidden.filter((key) => key !== section.key)
                      : [...settings.dashboardHidden, section.key],
                  })
                }
              >
                {section.label}
              </CheckRow>
            ))}
          </div>
        </div>
      </Section>

      <Section
        icon={HardDrive}
        title="Library management"
        description="Local-first storage: files and annotations stay in this browser profile."
      >
        <div className="rounded-card border border-line bg-panel2/50 p-3.5">
          <div className="flex items-center justify-between gap-3 text-[12px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <Database size={13} className="text-accent" /> Browser storage
            </span>
            <span className="text-[11px] text-muted">
              {storage ? `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)} used` : 'Estimate unavailable'}
            </span>
          </div>
          <ProgressBar value={usedPercent} className="mt-2.5" />
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            {storage
              ? `About ${usedPercent.toFixed(1)}% of the storage quota granted to this site.`
              : 'This browser does not expose a storage estimate. Resource counts are still accurate.'}
            {storageError ? ` ${storageError}` : ''}
          </p>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
          {[
            { label: 'PDFs', value: counts.pdfs },
            { label: 'Stored files', value: counts.files },
            { label: 'Quizzes', value: counts.quizzes },
            { label: 'Videos', value: counts.videos },
            { label: 'Tasks', value: counts.tasks },
            { label: 'Video folders', value: counts.folders },
            { label: 'Lessons', value: counts.lessons },
            { label: 'Attempts', value: counts.attempts },
          ].map((item) => (
            <div key={item.label} className="bg-panel px-3 py-2.5">
              <dt className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted">{item.label}</dt>
              <dd className="mt-1 text-[18px] font-semibold leading-none tabular-nums text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] text-muted">
          {formatBytes(counts.bytes)} of PDF content recorded · {counts.attempts} quiz attempt
          {counts.attempts === 1 ? '' : 's'}
        </p>
      </Section>

      <Section
        icon={Archive}
        title="Backup and restore"
        description="A ZIP archive contains resources, annotations, PDF files, tasks, video folders and the timetable. JSON export contains library metadata only."
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportBackup} loading={exporting}>
            <Download size={14} /> Export library backup
          </Button>
          <Button variant="outline" onClick={exportMetadata}>
            <FileJson size={14} /> Export metadata JSON
          </Button>
          <Button variant="outline" onClick={() => restoreInput.current?.click()}>
            <Upload size={14} /> Import backup
          </Button>
          <input
            ref={restoreInput}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            className="sr-only"
            onChange={(event) => {
              void chooseRestore(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          Restoring never overwrites silently: choose merge (adds with fresh IDs) or replace (clears this browser’s
          library first) after reviewing what the archive contains.
        </p>
      </Section>

      <Section
        icon={Library}
        title="Bundled repository library"
        description="The PDFs and questionnaires shipped with this application can be linked into your archive."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-medium text-ink">
              {bundledImported ? 'Bundled library is already linked' : 'Repository library available'}
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink2">
              Links reference the files in <code className="rounded bg-panel2 px-1">public/library</code>. They are not
              copied into IndexedDB, so they do not count toward your storage quota.
            </p>
          </div>
          <Button variant="outline" onClick={runBundledImport} loading={importingBundle} disabled={bundledImported}>
            {bundledImported ? (
              <>
                <Check size={14} /> Imported
              </>
            ) : (
              <>
                <Download size={14} /> Import library
              </>
            )}
          </Button>
        </div>
      </Section>

      <Section
        icon={Info}
        title="About NOEMA"
        description="Collect knowledge. Cultivate thought."
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-card border border-line bg-panel2 text-accent">
              <LambdaMark size={24} />
            </span>
            <div>
              <p className="flex items-baseline gap-2 text-ink">
                <Wordmark size="sm" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted">ΝΟΗΜΑ</span>
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted">Version {APP_VERSION}</p>
              <p className="mt-2 max-w-md text-[12px] leading-relaxed text-ink2">
                A personal academic library for study materials, practice questionnaires and video resources —
                organised by the ten subjects and three grades of your curriculum.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <Badge tone="accent">Local-first</Badge>
            <Badge>IndexedDB</Badge>
            <Badge>No cloud sync</Badge>
          </div>
        </div>
        <div className="mt-4 flex gap-2.5 rounded-card border border-line bg-panel2/50 p-3 text-[11px] leading-relaxed text-ink2">
          <PanelLeft size={14} className="mt-0.5 shrink-0 text-accent2" aria-hidden="true" />
          <p>
            Your library belongs to this browser and device. It is not synced to a server, so clearing site data or
            switching browsers will not carry it over. Export a backup regularly and restore it wherever you need it.
          </p>
        </div>
      </Section>

      <Dialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Restore this backup?"
        description="Review the archive contents before writing anything to this browser."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={restoring}>
              Cancel
            </Button>
            <Button
              variant={mode === 'replace' ? 'danger' : 'primary'}
              onClick={confirmRestore}
              loading={restoring}
            >
              {mode === 'replace' ? 'Replace library' : 'Merge into library'}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
              {[
                { label: 'PDFs', value: pending.manifest.resources.filter((resource) => resource.type === 'pdf').length },
                { label: 'Quizzes', value: pending.manifest.resources.filter((resource) => resource.type === 'quiz').length },
                { label: 'Videos', value: pending.manifest.resources.filter((resource) => resource.type === 'video').length },
                { label: 'Files', value: pending.files.length },
              ].map((entry) => (
                <div key={entry.label} className="rounded-md border border-line bg-panel2/60 px-2.5 py-2">
                  <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted">{entry.label}</p>
                  <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{entry.value}</p>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] text-ink2">
              Exported {new Date(pending.manifest.exportedAt).toLocaleString()} · {pending.manifest.attempts.length}{' '}
              attempt{pending.manifest.attempts.length === 1 ? '' : 's'} ·{' '}
              {(pending.manifest.tasks ?? []).length} task{(pending.manifest.tasks ?? []).length === 1 ? '' : 's'} ·{' '}
              {(pending.manifest.videoFolders ?? []).length} folder
              {(pending.manifest.videoFolders ?? []).length === 1 ? '' : 's'} ·{' '}
              {pending.manifest.schedule?.entries.length ?? 0} lessons · {pending.files.length} stored PDF file
              {pending.files.length === 1 ? '' : 's'}.
            </p>

            {pending.warnings.length > 0 && (
              <div className="rounded-card border border-accent2/30 bg-accent2/10 p-3 text-[11.5px] leading-relaxed text-accent2">
                <p className="font-semibold">Warnings</p>
                <ul className="mt-1 space-y-0.5">
                  {pending.warnings.slice(0, 6).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[12px] font-semibold text-ink2">Restore mode</legend>
              {[
                {
                  value: 'merge' as const,
                  title: 'Merge',
                  description: 'Keeps your current library and adds the backup with fresh IDs where needed.',
                },
                {
                  value: 'replace' as const,
                  title: 'Replace',
                  description: 'Clears this browser’s resources, annotations and attempts, then writes the backup.',
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-2.5 rounded-card border p-3 transition-colors ${
                    mode === option.value ? 'border-accent bg-accent/[0.06]' : 'border-line hover:border-muted/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="restore-mode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => setMode(option.value)}
                    className="mt-0.5 accent-[rgb(var(--accent))]"
                  />
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink">{option.title}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink2">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {mode === 'replace' && (
              <p className="rounded-card border border-danger/30 bg-danger/10 p-2.5 text-[11.5px] leading-relaxed text-danger">
                Replace mode removes {resources.length} current resource{resources.length === 1 ? '' : 's'} from this
                browser. Export a backup first if you might need them.
              </p>
            )}
          </div>
        )}
      </Dialog>

      <div className="flex items-center gap-2 pb-2 text-[10.5px] text-muted">
        <RotateCcw size={12} aria-hidden="true" />
        Settings are stored locally and applied instantly.
      </div>
    </div>
  );
}
