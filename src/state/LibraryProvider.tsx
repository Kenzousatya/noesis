import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  dbClear,
  dbDelete,
  dbGet,
  dbGetAll,
  dbPut,
  dbPutBatch,
  dbPutMany,
  storageEstimate,
} from '../lib/db';
import type {
  Annotation,
  AnnotationRecord,
  Attempt,
  PdfFileRecord,
  PdfResource,
  Resource,
} from '../lib/types';
import { uid } from '../lib/utils';
import { fetchBundledLibrary } from '../lib/legacy';
import { useSettings } from './SettingsProvider';
import type { AppSettings } from '../lib/types';

interface StorageState {
  usage: number;
  quota: number;
}

interface LibraryContextValue {
  resources: Resource[];
  attempts: Attempt[];
  ready: boolean;
  storageError: string | null;
  storage: StorageState | null;
  bundledImported: boolean;
  addResources: (resources: Resource[], files?: PdfFileRecord[]) => Promise<void>;
  updateResource: (id: string, patch: Partial<Resource>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  markOpened: (id: string, page?: number) => Promise<void>;
  getPdfBlob: (resource: PdfResource) => Promise<Blob | undefined>;
  loadAnnotations: (pdfId: string) => Promise<Annotation[]>;
  saveAnnotations: (pdfId: string, annotations: Annotation[]) => Promise<void>;
  addAttempt: (attempt: Attempt) => Promise<void>;
  refreshStorage: () => Promise<void>;
  importBackup: (
    resources: Resource[],
    files: PdfFileRecord[],
    attempts: Attempt[],
    annotations: AnnotationRecord[],
    mode: 'merge' | 'replace',
    settings?: AppSettings,
  ) => Promise<{ added: number }>;
  importBundled: () => Promise<{ pdfs: number; quizzes: number; skipped: number }>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { update } = useSettings();
  const [resources, setResources] = useState<Resource[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageState | null>(null);

  const refreshStorage = useCallback(async () => {
    const estimate = await storageEstimate();
    if (estimate) setStorage(estimate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedResources, storedAttempts] = await Promise.all([
          dbGetAll<Resource>('resources'),
          dbGetAll<Attempt>('attempts'),
        ]);
        if (!cancelled) {
          setResources(storedResources);
          setAttempts(storedAttempts);
        }
      } catch (error) {
        if (!cancelled) setStorageError((error as Error).message);
      } finally {
        if (!cancelled) {
          setReady(true);
          void refreshStorage();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStorage]);

  const addResources = useCallback(
    async (incoming: Resource[], files: PdfFileRecord[] = []) => {
      await dbPutMany('resources', incoming);
      if (files.length) await dbPutMany('files', files);
      setResources((current) => [...incoming, ...current]);
      void refreshStorage();
    },
    [refreshStorage],
  );

  const updateResource = useCallback(
    async (id: string, patch: Partial<Resource>) => {
      const existing = await dbGet<Resource>('resources', id);
      if (!existing) return;
      const merged = { ...existing, ...patch, updatedAt: Date.now() } as Resource;
      await dbPut('resources', merged);
      setResources((current) => current.map((resource) => (resource.id === id ? merged : resource)));
      void refreshStorage();
    },
    [refreshStorage],
  );

  const deleteResource = useCallback(
    async (id: string) => {
      const target = resources.find((resource) => resource.id === id);
      await dbDelete('resources', id);
      if (target?.type === 'pdf') {
        if (target.fileId) await dbDelete('files', target.fileId).catch(() => undefined);
        await dbDelete('annotations', id).catch(() => undefined);
      }
      if (target?.type === 'quiz') {
        const related = attempts.filter((attempt) => attempt.quizId === id);
        await Promise.all(related.map((attempt) => dbDelete('attempts', attempt.id)));
        setAttempts((current) => current.filter((attempt) => attempt.quizId !== id));
      }
      setResources((current) => current.filter((resource) => resource.id !== id));
      void refreshStorage();
    },
    [attempts, refreshStorage, resources],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const target = resources.find((resource) => resource.id === id);
      if (!target) return;
      await updateResource(id, { favorite: !target.favorite } as Partial<Resource>);
    },
    [resources, updateResource],
  );

  const markOpened = useCallback(
    async (id: string, page?: number) => {
      const patch: Partial<Resource> = { lastOpenedAt: Date.now() } as Partial<Resource>;
      if (page !== undefined) (patch as { lastPage?: number }).lastPage = page;
      const existing = await dbGet<Resource>('resources', id);
      if (!existing) return;
      const merged = { ...existing, ...patch } as Resource;
      await dbPut('resources', merged);
      setResources((current) => current.map((resource) => (resource.id === id ? merged : resource)));
    },
    [],
  );

  const getPdfBlob = useCallback(async (resource: PdfResource) => {
    if (resource.fileId) {
      const record = await dbGet<PdfFileRecord>('files', resource.fileId);
      if (record) return record.blob;
    }
    if (resource.sourceUrl) {
      const response = await fetch(resource.sourceUrl);
      if (!response.ok) throw new Error(`The linked file could not be loaded (${response.status}).`);
      const type = response.headers.get('content-type') ?? '';
      if (!type.includes('pdf') && !type.includes('octet-stream')) {
        throw new Error('The linked file is missing from the bundled library. Upload a copy or remove this entry.');
      }
      return response.blob();
    }
    return undefined;
  }, []);

  const loadAnnotations = useCallback(async (pdfId: string): Promise<Annotation[]> => {
    const record = await dbGet<AnnotationRecord>('annotations', pdfId);
    return record?.annotations ?? [];
  }, []);

  const saveAnnotations = useCallback(async (pdfId: string, annotations: Annotation[]) => {
    await dbPut<AnnotationRecord>('annotations', {
      pdfId,
      annotations,
      updatedAt: Date.now(),
    });
    void refreshStorage();
  }, [refreshStorage]);

  const addAttempt = useCallback(async (attempt: Attempt) => {
    await dbPut('attempts', attempt);
    setAttempts((current) => [attempt, ...current]);
  }, []);

  const importBackup = useCallback(
    async (
      incomingResources: Resource[],
      files: PdfFileRecord[],
      incomingAttempts: Attempt[],
      annotations: AnnotationRecord[],
      mode: 'merge' | 'replace',
      settings?: AppSettings,
    ) => {
      if (mode === 'replace') {
        await Promise.all([
          dbClear('resources'),
          dbClear('files'),
          dbClear('annotations'),
          dbClear('attempts'),
        ]);
        await dbPutMany('resources', incomingResources);
        await dbPutMany('files', files);
        await dbPutMany('attempts', incomingAttempts);
        await dbPutMany('annotations', annotations);
        setResources(incomingResources);
        setAttempts(incomingAttempts);
        if (settings) update(settings);
        void refreshStorage();
        return { added: incomingResources.length };
      }

      const existingIds = new Set(resources.map((resource) => resource.id));
      const usedFileIds = new Set(
        resources.flatMap((resource) =>
          resource.type === 'pdf' && resource.fileId ? [resource.fileId] : [],
        ),
      );
      const fileIdMap = new Map<string, string>();
      const resourceIdMap = new Map<string, string>();
      const storedFiles: PdfFileRecord[] = files.map((file) => {
        if (!usedFileIds.has(file.id)) return file;
        const newId = uid('f');
        fileIdMap.set(file.id, newId);
        return { ...file, id: newId };
      });
      const storedResources = incomingResources.map((resource) => {
        let next = resource;
        if (resource.type === 'pdf' && resource.fileId && fileIdMap.has(resource.fileId)) {
          next = { ...resource, fileId: fileIdMap.get(resource.fileId) };
        }
        if (existingIds.has(resource.id)) {
          const newId = uid(resource.type === 'pdf' ? 'p' : resource.type === 'quiz' ? 'q' : 'v');
          resourceIdMap.set(resource.id, newId);
          next = { ...next, id: newId };
        }
        return next;
      });
      const storedAttempts = incomingAttempts.map((attempt) => ({
        ...attempt,
        id: uid('a'),
        quizId: resourceIdMap.get(attempt.quizId) ?? attempt.quizId,
      }));
      const annotationRecords = annotations
        .map((record) => ({
          ...record,
          pdfId: resourceIdMap.get(record.pdfId) ?? record.pdfId,
        }))
        .filter((record) => storedResources.some((resource) => resource.type === 'pdf' && resource.id === record.pdfId));

      await Promise.all([
        dbPutMany('resources', storedResources),
        dbPutMany('files', storedFiles),
        dbPutMany('attempts', storedAttempts),
      ]);
      await Promise.allSettled(annotationRecords.map((record) => dbPut('annotations', record)));
      setResources((current) => [...storedResources, ...current]);
      setAttempts((current) => [...storedAttempts, ...current]);
      void refreshStorage();
      return { added: storedResources.length };
    },
    [refreshStorage, resources, update],
  );

  const bundledImported = useMemo(
    () => resources.some((resource) => resource.type === 'pdf' && Boolean(resource.sourceUrl)),
    [resources],
  );

  const importBundled = useCallback(async () => {
    const bundled = await fetchBundledLibrary(import.meta.env.BASE_URL);
    const all = [...bundled.pdfs, ...bundled.quizzes];
    if (!all.length) return { pdfs: 0, quizzes: 0, skipped: bundled.skipped.length };
    await importBackup(all, [], [], [], 'merge');
    return { pdfs: bundled.pdfs.length, quizzes: bundled.quizzes.length, skipped: bundled.skipped.length };
  }, [importBackup]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      resources,
      attempts,
      ready,
      storageError,
      storage,
      bundledImported,
      addResources,
      updateResource,
      deleteResource,
      toggleFavorite,
      markOpened,
      getPdfBlob,
      loadAnnotations,
      saveAnnotations,
      addAttempt,
      refreshStorage,
      importBackup,
      importBundled,
    }),
    [
      resources,
      attempts,
      ready,
      storageError,
      storage,
      bundledImported,
      addResources,
      updateResource,
      deleteResource,
      toggleFavorite,
      markOpened,
      getPdfBlob,
      loadAnnotations,
      saveAnnotations,
      addAttempt,
      refreshStorage,
      importBackup,
      importBundled,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider');
  return context;
}
