import { Injectable } from '@angular/core';

const DB_NAME = 'zenovel-files';
const DB_STORE = 'contents';

/**
 * Keeps uploaded file contents in IndexedDB (browser only) so documents can be previewed.
 * Records reference them through `FileMeta.contentId`.
 */
@Injectable({ providedIn: 'root' })
export class FileContentStore {
  get supported(): boolean {
    return !!globalThis.indexedDB;
  }

  async save(file: Blob): Promise<string> {
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.run('readwrite', store => store.put(file, id));
    return id;
  }

  async load(id: string): Promise<Blob | null> {
    return (await this.run<Blob | undefined>('readonly', store => store.get(id))) ?? null;
  }

  private async run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await openDb();
    try {
      return await new Promise<T>((resolve, reject) => {
        const req = op(db.transaction(DB_STORE, mode).objectStore(DB_STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
