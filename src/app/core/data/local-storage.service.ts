import { Injectable, signal } from '@angular/core';

export type ReadResult<T> = { status: 'ok'; value: T } | { status: 'missing' } | { status: 'malformed' };

@Injectable({ providedIn: 'root' })
export class LocalStorageService {
  /** False when the browser blocks storage (e.g. strict privacy mode); data then lives in memory only. */
  readonly available = signal(this.probe());

  read<T>(key: string): ReadResult<T> {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { status: 'missing' };
      return { status: 'ok', value: JSON.parse(raw) as T };
    } catch {
      return this.available() ? { status: 'malformed' } : { status: 'missing' };
    }
  }

  get<T>(key: string): T | null {
    const r = this.read<T>(key);
    return r.status === 'ok' ? r.value : null;
  }

  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      this.available.set(false);
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }

  private probe(): boolean {
    try {
      const k = '__zen_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }
}
