const DB_NAME = 'noema-library';
const DB_VERSION = 2;

export type StoreName = 'resources' | 'files' | 'annotations' | 'attempts' | 'meta' | 'tasks' | 'folders' | 'schedule';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support IndexedDB.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('resources')) {
        database.createObjectStore('resources', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('files')) {
        database.createObjectStore('files', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('annotations')) {
        database.createObjectStore('annotations', { keyPath: 'pdfId' });
      }
      if (!database.objectStoreNames.contains('attempts')) {
        database.createObjectStore('attempts', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('tasks')) {
        database.createObjectStore('tasks', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('folders')) {
        database.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('schedule')) {
        database.createObjectStore('schedule', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the local library.'));
    request.onblocked = () => reject(new Error('The local library is blocked by another tab.'));
  });
  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
  });
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const database = await openDatabase();
  return requestResult(database.transaction(store, 'readonly').objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function dbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  return requestResult(database.transaction(store, 'readonly').objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(store, 'readwrite');
  transaction.objectStore(store).put(value as unknown as Record<string, unknown>);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save to local storage.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Save cancelled.'));
  });
}

export async function dbPutMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (!values.length) return;
  const database = await openDatabase();
  const transaction = database.transaction(store, 'readwrite');
  const objectStore = transaction.objectStore(store);
  for (const value of values) objectStore.put(value as unknown as Record<string, unknown>);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save to local storage.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Save cancelled.'));
  });
}

export async function dbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(store, 'readwrite');
  transaction.objectStore(store).delete(key);
  await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Unable to delete from local storage.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Delete cancelled.'));
    });
}

export async function dbClear(store: StoreName): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(store, 'readwrite');
  transaction.objectStore(store).clear();
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to clear local storage.'));
  });
}

export async function dbPutBatch(entries: Array<{ store: StoreName; value: unknown }>): Promise<void> {
  if (!entries.length) return;
  const database = await openDatabase();
  const stores = Array.from(new Set(entries.map((entry) => entry.store)));
  const transaction = database.transaction(stores, 'readwrite');
  for (const entry of entries) {
    transaction.objectStore(entry.store).put(entry.value as Record<string, unknown>);
  }
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save to local storage.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Save cancelled.'));
  });
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
  } catch {
    return null;
  }
}
