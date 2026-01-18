type DbStoreName = 'kv' | 'haServiceCallQueue';

const DB_NAME = 'hass-dash';
const DB_VERSION = 1;

let openPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (openPromise) return openPromise;

  openPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
      if (!db.objectStoreNames.contains('haServiceCallQueue')) {
        db.createObjectStore('haServiceCallQueue', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB.'));
    };
  });

  return openPromise;
}

function withStore<T>(
  storeName: DbStoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const db = await openDatabase();
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = run(store);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error ?? new Error('IndexedDB request failed.'));
      };
    })().catch(reject);
  });
}

export async function idbKvGet(key: string): Promise<string | null> {
  const value = await withStore<unknown>('kv', 'readonly', (store) => store.get(key));
  return typeof value === 'string' ? value : null;
}

export async function idbKvSet(key: string, value: string): Promise<void> {
  await withStore('kv', 'readwrite', (store) => store.put(value, key));
}

export async function idbKvDelete(key: string): Promise<void> {
  await withStore('kv', 'readwrite', (store) => store.delete(key));
}

export async function idbKvClear(): Promise<void> {
  await withStore('kv', 'readwrite', (store) => store.clear());
}

export async function idbQueueGetAll<T>(): Promise<T[]> {
  const all = await withStore<T[]>('haServiceCallQueue', 'readonly', (store) => store.getAll());
  return Array.isArray(all) ? all : [];
}

export async function idbQueuePut<T extends { id: string }>(value: T): Promise<void> {
  await withStore('haServiceCallQueue', 'readwrite', (store) => store.put(value));
}

export async function idbQueueDelete(id: string): Promise<void> {
  await withStore('haServiceCallQueue', 'readwrite', (store) => store.delete(id));
}

export async function idbQueueClear(): Promise<void> {
  await withStore('haServiceCallQueue', 'readwrite', (store) => store.clear());
}
