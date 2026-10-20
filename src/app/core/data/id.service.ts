import { Injectable, inject } from '@angular/core';
import { Entity } from '../models';
import { LocalStorageService } from './local-storage.service';

const KEY = 'zen.v2.sequences';

/** Issues stable, never-reused IDs (e.g. PRJ-007) even after records are deleted. */
@Injectable({ providedIn: 'root' })
export class IdService {
  private readonly storage = inject(LocalStorageService);
  private counters: Record<string, number> = this.storage.get<Record<string, number>>(KEY) ?? {};

  next(prefix: string, existing: readonly Entity[]): string {
    const maxExisting = existing.reduce((max, e) => {
      if (!e.id.startsWith(prefix + '-')) return max;
      const n = Number(e.id.slice(prefix.length + 1));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    const n = Math.max(this.counters[prefix] ?? 0, maxExisting) + 1;
    this.counters = { ...this.counters, [prefix]: n };
    this.storage.write(KEY, this.counters);
    return `${prefix}-${String(n).padStart(3, '0')}`;
  }

  /** Short unique id for nested rows (risks, findings, etc.). */
  local(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  reset(): void {
    this.counters = {};
    this.storage.remove(KEY);
  }
}
