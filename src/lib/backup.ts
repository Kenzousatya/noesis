import JSZip from 'jszip';
import { dbGetAll } from './db';
import type {
  AnnotationRecord,
  AppSettings,
  Attempt,
  PdfFileRecord,
  PdfResource,
  QuizQuestion,
  Resource,
  ScheduleDoc,
  Task,
  VideoFolder,
} from './types';
import { isGrade, isSubjectName } from './constants';
import { validateQuestion } from './quiz';
import { safeFilename } from './utils';

export const APP_VERSION = '1.0.0';

export interface BackupManifest {
  format: 'noema-backup';
  version: 1;
  appVersion: string;
  exportedAt: number;
  settings: AppSettings;
  resources: Resource[];
  attempts: Attempt[];
  annotations: AnnotationRecord[];
  tasks: Task[];
  videoFolders: VideoFolder[];
  schedule: ScheduleDoc | null;
}

export interface ParsedBackup {
  manifest: BackupManifest;
  files: PdfFileRecord[];
  errors: string[];
  warnings: string[];
}

function annotationIds(resources: Resource[]): string[] {
  return resources.filter((resource): resource is PdfResource => resource.type === 'pdf').map((resource) => resource.id);
}

export async function createBackup(resources: Resource[], attempts: Attempt[], settings: AppSettings): Promise<Blob> {
  const zip = new JSZip();
  const files = await dbGetAll<PdfFileRecord>('files');
  const annotations = await dbGetAll<AnnotationRecord>('annotations');
  const [tasks, videoFolders, scheduleRecord] = await Promise.all([
    dbGetAll<Task>('tasks'),
    dbGetAll<VideoFolder>('folders'),
    dbGetAll<ScheduleDoc>('schedule'),
  ]);
  const pdfIds = new Set(annotationIds(resources));
  const storedFiles = files.filter((file) => resources.some((resource) => resource.type === 'pdf' && resource.fileId === file.id));

  const manifest: BackupManifest = {
    format: 'noema-backup',
    version: 1,
    appVersion: APP_VERSION,
    exportedAt: Date.now(),
    settings,
    resources,
    attempts,
    annotations: annotations.filter((record) => pdfIds.has(record.pdfId)),
    tasks,
    videoFolders,
    schedule: scheduleRecord[0] ?? null,
  };

  zip.file('noema-backup.json', JSON.stringify(manifest, null, 2));
  for (const file of storedFiles) {
    zip.file(`files/${file.id}.pdf`, file.blob);
  }
  if (!storedFiles.length) {
    zip.file(
      'README.txt',
      'NOEMA backup. PDF blobs stored in IndexedDB are included under files/. Linked library PDFs are referenced by URL.\n',
    );
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } });
}

export function createMetadataExport(resources: Resource[], attempts: Attempt[], settings: AppSettings): Blob {
  const manifest = {
    format: 'noema-metadata',
    version: 1,
    appVersion: APP_VERSION,
    exportedAt: Date.now(),
    settings,
    resources,
    attempts,
  };
  return new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
}

export function backupFilename(prefix = 'noema-backup'): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return safeFilename(`${prefix}-${stamp}.zip`);
}

function normalizeResource(raw: unknown, index: number, errors: string[]): Resource | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`Resource ${index + 1} is not an object.`);
    return null;
  }
  const input = raw as Record<string, unknown>;
  if (typeof input.id !== 'string' || !input.id) {
    errors.push(`Resource ${index + 1} has no id.`);
    return null;
  }
  if (input.type !== 'pdf' && input.type !== 'quiz' && input.type !== 'video') {
    errors.push(`Resource ${index + 1} has an unsupported type.`);
    return null;
  }
  if (!isSubjectName(input.subject) || !isGrade(Number(input.grade))) {
    errors.push(`Resource ${index + 1} has an invalid subject or grade.`);
    return null;
  }
  if (typeof input.title !== 'string' || !input.title.trim()) {
    errors.push(`Resource ${index + 1} has no title.`);
    return null;
  }
  const base = {
    id: input.id,
    subject: input.subject,
    grade: Number(input.grade) as 7 | 8 | 9,
    title: input.title,
    description: typeof input.description === 'string' ? input.description : '',
    favorite: Boolean(input.favorite),
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now(),
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
    lastOpenedAt: typeof input.lastOpenedAt === 'number' ? input.lastOpenedAt : undefined,
  };
  if (input.type === 'pdf') {
    if (typeof input.filename !== 'string') {
      errors.push(`PDF "${input.title}" has no filename.`);
      return null;
    }
    return {
      ...base,
      type: 'pdf',
      filename: input.filename,
      size: typeof input.size === 'number' ? input.size : 0,
      fileId: typeof input.fileId === 'string' ? input.fileId : undefined,
      sourceUrl: typeof input.sourceUrl === 'string' ? input.sourceUrl : undefined,
      lastPage: typeof input.lastPage === 'number' ? input.lastPage : undefined,
    } as PdfResource;
  }
  if (input.type === 'video') {
    if (typeof input.videoId !== 'string' || !input.videoId) {
      errors.push(`Video "${input.title}" has no video id.`);
      return null;
    }
    return {
      ...base,
      type: 'video',
      videoId: input.videoId,
      url: typeof input.url === 'string' ? input.url : `https://www.youtube.com/watch?v=${input.videoId}`,
      thumbnail: typeof input.thumbnail === 'string' ? input.thumbnail : undefined,
      folderId: typeof input.folderId === 'string' ? input.folderId : undefined,
    };
  }
  if (!Array.isArray(input.questions) || !input.questions.length) {
    errors.push(`Quiz "${input.title}" has no questions.`);
    return null;
  }
  const questions: QuizQuestion[] = [];
  input.questions.forEach((question, questionIndex) => {
    const validated = validateQuestion(question, questionIndex);
    if (validated.question) questions.push(validated.question);
    else
      errors.push(
        ...validated.errors.map((error) => `Quiz "${input.title}": ${error}`),
      );
  });
  if (!questions.length) return null;
  return {
    ...base,
    type: 'quiz',
    difficulty: input.difficulty === 'easy' || input.difficulty === 'hard' ? input.difficulty : 'medium',
    settings: {
      shuffleQuestions: Boolean((input.settings as Record<string, unknown> | undefined)?.shuffleQuestions),
      shuffleOptions: Boolean((input.settings as Record<string, unknown> | undefined)?.shuffleOptions),
      showExplanations: (input.settings as Record<string, unknown> | undefined)?.showExplanations !== false,
      timerMinutes:
        typeof (input.settings as Record<string, unknown> | undefined)?.timerMinutes === 'number'
          ? Number((input.settings as Record<string, unknown>).timerMinutes)
          : null,
      passingScore:
        typeof (input.settings as Record<string, unknown> | undefined)?.passingScore === 'number'
          ? Number((input.settings as Record<string, unknown>).passingScore)
          : 70,
    },
    questions,
  };
}

export function validateManifest(raw: unknown): { manifest?: BackupManifest; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') return { errors: ['The backup manifest is missing.'], warnings };
  const input = raw as Record<string, unknown>;
  if (input.format !== 'noema-backup') {
    return { errors: ['This file is not a NOEMA backup (missing format marker).'], warnings };
  }
  if (input.version !== 1) warnings.push(`Backup version ${String(input.version)} differs from the supported version 1.`);
  if (!Array.isArray(input.resources)) return { errors: ['The backup has no resource list.'], warnings };

  const resources: Resource[] = [];
  input.resources.forEach((entry: unknown, index: number) => {
    const resource = normalizeResource(entry, index, errors);
    if (resource) resources.push(resource);
  });

  const attempts: Attempt[] = Array.isArray(input.attempts)
    ? (input.attempts.filter(
        (entry): entry is Attempt =>
          Boolean(entry) && typeof entry === 'object' && typeof (entry as Attempt).id === 'string',
      ) as Attempt[])
    : [];
  const annotations: AnnotationRecord[] = Array.isArray(input.annotations)
    ? (input.annotations.filter(
        (entry): entry is AnnotationRecord =>
          Boolean(entry) && typeof entry === 'object' && typeof (entry as AnnotationRecord).pdfId === 'string',
      ) as AnnotationRecord[])
    : [];

  const settings: AppSettings = {
    theme: 'dark',
    sidebarCollapsed: false,
    libraryView: 'grid',
    dashboardHidden: [],
    ...((input.settings as Partial<AppSettings>) ?? {}),
  };

  const tasks: Task[] = Array.isArray(input.tasks)
    ? (input.tasks.filter(
        (entry): entry is Task =>
          Boolean(entry) && typeof entry === 'object' && typeof (entry as Task).id === 'string' && typeof (entry as Task).title === 'string',
      ) as Task[])
    : [];
  const videoFolders: VideoFolder[] = Array.isArray(input.videoFolders)
    ? (input.videoFolders.filter(
        (entry): entry is VideoFolder =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof (entry as VideoFolder).id === 'string' &&
          typeof (entry as VideoFolder).name === 'string' &&
          isSubjectName((entry as VideoFolder).subject) &&
          isGrade(Number((entry as VideoFolder).grade)),
      ) as VideoFolder[])
    : [];
  const rawSchedule = input.schedule as ScheduleDoc | null | undefined;
  const schedule: ScheduleDoc | null =
    rawSchedule && typeof rawSchedule === 'object' && Array.isArray(rawSchedule.classes) && Array.isArray(rawSchedule.periods)
      ? { ...rawSchedule, entries: Array.isArray(rawSchedule.entries) ? rawSchedule.entries : [], activeClassId: rawSchedule.activeClassId ?? null }
      : null;

  if (errors.length) return { errors, warnings };
  return {
    manifest: {
      format: 'noema-backup',
      version: 1,
      appVersion: typeof input.appVersion === 'string' ? input.appVersion : 'unknown',
      exportedAt: typeof input.exportedAt === 'number' ? input.exportedAt : Date.now(),
      settings,
      resources,
      attempts,
      annotations,
      tasks,
      videoFolders,
      schedule,
    },
    errors,
    warnings,
  };
}

export async function parseBackupFile(file: File): Promise<ParsedBackup> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const files: PdfFileRecord[] = [];
  let manifestRaw: unknown = null;

  if (file.name.toLowerCase().endsWith('.json')) {
    try {
      manifestRaw = JSON.parse(await file.text());
    } catch (error) {
      return { manifest: {} as BackupManifest, files, errors: [`Invalid JSON: ${(error as Error).message}`], warnings };
    }
  } else {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch (error) {
      return { manifest: {} as BackupManifest, files, errors: [`Could not read the archive: ${(error as Error).message}`], warnings };
    }
    const manifestFile = zip.file('noema-backup.json') ?? zip.file(/backup.*\.json$/)[0];
    if (!manifestFile) {
      return { manifest: {} as BackupManifest, files, errors: ['The archive does not contain noema-backup.json.'], warnings };
    }
    try {
      manifestRaw = JSON.parse(await manifestFile.async('string'));
    } catch (error) {
      return { manifest: {} as BackupManifest, files, errors: [`Invalid manifest JSON: ${(error as Error).message}`], warnings };
    }
    const fileEntries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith('files/'));
    for (const entry of fileEntries) {
      const blob = await entry.async('blob');
      const id = entry.name.replace(/^files\//, '').replace(/\.pdf$/i, '');
      files.push({ id, name: `${id}.pdf`, size: blob.size, mime: 'application/pdf', blob });
    }
  }

  const validated = validateManifest(manifestRaw);
  errors.push(...validated.errors);
  warnings.push(...validated.warnings);
  if (!validated.manifest) {
    return { manifest: {} as BackupManifest, files, errors, warnings };
  }

  const blobIds = new Set(files.map((entry) => entry.id));
  for (const resource of validated.manifest.resources) {
    if (resource.type === 'pdf' && resource.fileId && !blobIds.has(resource.fileId) && !resource.sourceUrl) {
      warnings.push(`No stored file for "${resource.title}" in this backup.`);
    }
  }
  return { manifest: validated.manifest, files, errors, warnings };
}
