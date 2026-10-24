import { Injectable, inject } from '@angular/core';
import { LocalStorageService } from '../data/local-storage.service';

const STORAGE_KEY = 'zen.v2.remembered';
const DB_NAME = 'zen.keys';
const DB_STORE = 'keys';
const KEY_ID = 'remembered-credentials';

export interface RememberedCredentials {
  email: string;
  password: string;
}

interface EncryptedPayload {
  iv: string;
  data: string;
}

/**
 * Persists "Remember me" credentials AES-GCM encrypted in localStorage.
 * The key is a non-extractable CryptoKey kept in IndexedDB, so the stored ciphertext is useless outside this browser profile.
 * Prototype convenience only: any script running on this origin can still decrypt it.
 */
@Injectable({ providedIn: 'root' })
export class RememberedCredentialsService {
  private readonly storage = inject(LocalStorageService);

  async save(credentials: RememberedCredentials): Promise<void> {
    try {
      const key = await this.getKey(true);
      if (!key) return;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plain = new TextEncoder().encode(JSON.stringify(credentials));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
      this.storage.write(STORAGE_KEY, { iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) } satisfies EncryptedPayload);
    } catch {
      this.clear();
    }
  }

  async load(): Promise<RememberedCredentials | null> {
    const payload = this.storage.get<EncryptedPayload>(STORAGE_KEY);
    if (!payload?.iv || !payload?.data) return null;
    try {
      const key = await this.getKey(false);
      if (!key) throw new Error('Missing key');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
      const parsed = JSON.parse(new TextDecoder().decode(plain)) as Partial<RememberedCredentials>;
      if (typeof parsed.email !== 'string' || typeof parsed.password !== 'string') throw new Error('Malformed');
      return { email: parsed.email, password: parsed.password };
    } catch {
      this.clear();
      return null;
    }
  }

  clear(): void {
    this.storage.remove(STORAGE_KEY);
  }

  private async getKey(create: boolean): Promise<CryptoKey | null> {
    if (!globalThis.crypto?.subtle || !globalThis.indexedDB) return null;
    const db = await openDb();
    try {
      const existing = await promisify<CryptoKey | undefined>(db.transaction(DB_STORE).objectStore(DB_STORE).get(KEY_ID));
      if (existing || !create) return existing ?? null;
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await promisify(db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(key, KEY_ID));
      return key;
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

function promisify<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
