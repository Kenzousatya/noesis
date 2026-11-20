import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { dbClear, dbGet, dbGetAll, dbPut, dbPutMany, dbDelete } from '../lib/db';
import type { ScheduleDoc, Task, TaskStatus, VideoFolder } from '../lib/types';
import { emptySchedule } from '../lib/schedule';
import { uid } from '../lib/utils';
import { useLibrary } from './LibraryProvider';

export interface WorkspacePayload {
  tasks: Task[];
  folders: VideoFolder[];
  schedule: ScheduleDoc | null;
}

interface WorkspaceContextValue extends Omit<WorkspacePayload, 'schedule'> {
  schedule: ScheduleDoc;
  ready: boolean;
  saveTask: (task: Task) => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  createFolder: (input: Omit<VideoFolder, 'id' | 'createdAt' | 'updatedAt' | 'order'> & { order?: number }) => Promise<VideoFolder>;
  updateFolder: (id: string, patch: Partial<Omit<VideoFolder, 'id'>>) => Promise<void>;
  moveFolder: (id: string, direction: -1 | 1) => Promise<void>;
  deleteFolder: (id: string, mode: 'keep' | 'delete') => Promise<void>;
  saveSchedule: (next: ScheduleDoc) => Promise<void>;
  importWorkspace: (payload: WorkspacePayload, mode: 'merge' | 'replace') => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const emptyPayload: WorkspacePayload = { tasks: [], folders: [], schedule: null };

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { resources, updateResource, deleteResource } = useLibrary();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<VideoFolder[]>([]);
  const [schedule, setSchedule] = useState<ScheduleDoc>(emptySchedule);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedTasks, storedFolders, storedSchedule] = await Promise.all([
          dbGetAll<Task>('tasks'),
          dbGetAll<VideoFolder>('folders'),
          dbGet<ScheduleDoc>('schedule', 'school-schedule'),
        ]);
        if (cancelled) return;
        setTasks(storedTasks);
        setFolders(storedFolders);
        if (storedSchedule) {
          setSchedule({ ...emptySchedule(), ...storedSchedule, activeClassId: storedSchedule.activeClassId ?? null });
        }
      } catch {
        // A failed read leaves the workspace empty but usable; writes will surface their own errors.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveTask = useCallback(async (task: Task) => {
    const next = { ...task, updatedAt: Date.now() };
    await dbPut('tasks', next);
    setTasks((current) => {
      const exists = current.some((entry) => entry.id === task.id);
      return exists ? current.map((entry) => (entry.id === task.id ? next : entry)) : [next, ...current];
    });
  }, []);

  const addTask = useCallback(
    async (input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = Date.now();
      const task: Task = { ...input, id: uid('t'), createdAt: now, updatedAt: now };
      await dbPut('tasks', task);
      setTasks((current) => [task, ...current]);
      return task;
    },
    [],
  );

  const deleteTask = useCallback(async (id: string) => {
    await dbDelete('tasks', id);
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const setTaskStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const target = tasks.find((task) => task.id === id);
      if (!target) return;
      const next: Task = {
        ...target,
        status,
        completedAt: status === 'done' ? Date.now() : null,
        updatedAt: Date.now(),
      };
      await dbPut('tasks', next);
      setTasks((current) => current.map((task) => (task.id === id ? next : task)));
    },
    [tasks],
  );

  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      const target = tasks.find((task) => task.id === taskId);
      if (!target) return;
      const subtasks = target.subtasks.map((entry) =>
        entry.id === subtaskId ? { ...entry, done: !entry.done } : entry,
      );
      const allDone = subtasks.length > 0 && subtasks.every((entry) => entry.done);
      const next: Task = {
        ...target,
        subtasks,
        status: allDone && target.status !== 'done' ? 'in_progress' : target.status,
        updatedAt: Date.now(),
      };
      await dbPut('tasks', next);
      setTasks((current) => current.map((task) => (task.id === taskId ? next : task)));
    },
    [tasks],
  );

  const createFolder = useCallback(
    async (input: Omit<VideoFolder, 'id' | 'createdAt' | 'updatedAt' | 'order'> & { order?: number }) => {
      const now = Date.now();
      const siblings = folders.filter(
        (folder) => folder.subject === input.subject && folder.grade === input.grade,
      );
      const folder: VideoFolder = {
        ...input,
        id: uid('vf'),
        order: input.order ?? siblings.reduce((max, entry) => Math.max(max, entry.order), 0) + 1,
        createdAt: now,
        updatedAt: now,
      };
      await dbPut('folders', folder);
      setFolders((current) => [...current, folder]);
      return folder;
    },
    [folders],
  );

  const updateFolder = useCallback(async (id: string, patch: Partial<Omit<VideoFolder, 'id'>>) => {
    const target = folders.find((folder) => folder.id === id);
    if (!target) return;
    const next = { ...target, ...patch, updatedAt: Date.now() };
    await dbPut('folders', next);
    setFolders((current) => current.map((folder) => (folder.id === id ? next : folder)));
  }, [folders]);

  const moveFolder = useCallback(
    async (id: string, direction: -1 | 1) => {
      const target = folders.find((folder) => folder.id === id);
      if (!target) return;
      const siblings = folders
        .filter((folder) => folder.subject === target.subject && folder.grade === target.grade)
        .sort((a, b) => a.order - b.order);
      const index = siblings.findIndex((folder) => folder.id === id);
      const swapWith = siblings[index + direction];
      if (!swapWith) return;
      const reordered = siblings.map((folder, position) => {
        if (position === index) return { ...folder, order: swapWith.order };
        if (position === index + direction) return { ...folder, order: target.order };
        return folder;
      });
      await dbPutMany('folders', reordered);
      setFolders((current) => {
        const byId = new Map(reordered.map((folder) => [folder.id, folder]));
        return current.map((folder) => byId.get(folder.id) ?? folder);
      });
    },
    [folders],
  );

  const deleteFolder = useCallback(
    async (id: string, mode: 'keep' | 'delete') => {
      const affected = resources.filter(
        (resource) => resource.type === 'video' && resource.folderId === id,
      );
      for (const video of affected) {
        if (mode === 'delete') await deleteResource(video.id);
        else await updateResource(video.id, { folderId: undefined } as never);
      }
      await dbDelete('folders', id);
      setFolders((current) => current.filter((folder) => folder.id !== id));
    },
    [deleteResource, resources, updateResource],
  );

  const saveSchedule = useCallback(async (next: ScheduleDoc) => {
    const stored = { ...next, updatedAt: Date.now() };
    await dbPut('schedule', stored);
    setSchedule(stored);
  }, []);

  const importWorkspace = useCallback(
    async (payload: WorkspacePayload, mode: 'merge' | 'replace') => {
      if (mode === 'replace') {
        await Promise.all([dbClear('tasks'), dbClear('folders'), dbClear('schedule')]);
        const importedTasks = payload.tasks ?? [];
        const importedFolders = payload.folders ?? [];
        const importedSchedule = payload.schedule ?? null;
        await dbPutMany('tasks', importedTasks);
        await dbPutMany('folders', importedFolders);
        if (importedSchedule) await dbPut('schedule', importedSchedule);
        setTasks(importedTasks);
        setFolders(importedFolders);
        setSchedule(importedSchedule ? { ...emptySchedule(), ...importedSchedule } : emptySchedule());
        return;
      }

      const existingTaskIds = new Set(tasks.map((task) => task.id));
      const importedTasks = (payload.tasks ?? []).map((task) =>
        existingTaskIds.has(task.id) ? { ...task, id: uid('t') } : task,
      );
      const existingFolderIds = new Set(folders.map((folder) => folder.id));
      const importedFolders = (payload.folders ?? []).filter(
        (folder) => !existingFolderIds.has(folder.id),
      );

      await dbPutMany('tasks', importedTasks);
      await dbPutMany('folders', importedFolders);
      setTasks((current) => [...importedTasks, ...current]);
      setFolders((current) => [...importedFolders, ...current]);

      const hasLocalSchedule = schedule.classes.length > 0;
      if (payload.schedule && !hasLocalSchedule) {
        await dbPut('schedule', payload.schedule);
        setSchedule({ ...emptySchedule(), ...payload.schedule });
      }
    },
    [folders, schedule.classes.length, tasks],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ready,
      tasks,
      folders,
      schedule,
      saveTask,
      addTask,
      deleteTask,
      setTaskStatus,
      toggleSubtask,
      createFolder,
      updateFolder,
      moveFolder,
      deleteFolder,
      saveSchedule,
      importWorkspace,
    }),
    [
      ready,
      tasks,
      folders,
      schedule,
      saveTask,
      addTask,
      deleteTask,
      setTaskStatus,
      toggleSubtask,
      createFolder,
      updateFolder,
      moveFolder,
      deleteFolder,
      saveSchedule,
      importWorkspace,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}

export const EMPTY_WORKSPACE = emptyPayload;
