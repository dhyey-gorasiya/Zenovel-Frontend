import { InjectionToken, Signal, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Entity } from '../models';
import { LocalStorageService } from './local-storage.service';

/**
 * Data-access contract used by every domain service.
 * Swap the factory below for an HTTP-backed implementation when the backend exists.
 */
export interface EntityStore<T extends Entity> {
  readonly items: Signal<T[]>;
  readonly changes$: Observable<T[]>;
  get(id: string): T | undefined;
  insert(item: T): T;
  update(id: string, patch: Partial<T>): T | undefined;
  remove(id: string): void;
  reset(): void;
}

export interface StoreIssue {
  key: string;
  message: string;
}

export interface EntityStoreFactory {
  create<T extends Entity>(key: string, seed: () => T[], onIssue: (issue: StoreIssue) => void): EntityStore<T>;
}

const isEntityList = (value: unknown): value is Entity[] =>
  Array.isArray(value) &&
  value.every(v => !!v && typeof v === 'object' && typeof (v as Entity).id === 'string' && typeof (v as Entity).updatedAt === 'string');

class LocalStorageEntityStore<T extends Entity> implements EntityStore<T> {
  private readonly state = signal<T[]>([]);
  private readonly subject = new BehaviorSubject<T[]>([]);
  readonly items = this.state.asReadonly();
  readonly changes$ = this.subject.asObservable();

  constructor(
    private readonly key: string,
    private readonly seed: () => T[],
    private readonly storage: LocalStorageService,
    onIssue: (issue: StoreIssue) => void,
  ) {
    const saved = storage.read<unknown>(key);
    if (saved.status === 'ok' && isEntityList(saved.value)) {
      this.set(saved.value as T[], false);
    } else {
      if (saved.status !== 'missing') {
        onIssue({ key, message: `Stored data for "${key}" was unreadable and has been replaced with demo data.` });
      }
      this.set(seed(), true);
    }
  }

  get(id: string): T | undefined {
    return this.state().find(i => i.id === id);
  }

  insert(item: T): T {
    const created = { ...item, updatedAt: new Date().toISOString() };
    this.set([...this.state(), created], true);
    return created;
  }

  update(id: string, patch: Partial<T>): T | undefined {
    let result: T | undefined;
    this.set(
      this.state().map(i => (i.id === id ? (result = { ...i, ...patch, id, updatedAt: new Date().toISOString() }) : i)),
      true,
    );
    return result;
  }

  remove(id: string): void {
    this.set(this.state().filter(i => i.id !== id), true);
  }

  reset(): void {
    this.set(this.seed(), true);
  }

  private set(list: T[], persist: boolean): void {
    this.state.set(list);
    this.subject.next(list);
    if (persist) this.storage.write(this.key, list);
  }
}

export const ENTITY_STORE_FACTORY = new InjectionToken<EntityStoreFactory>('ENTITY_STORE_FACTORY', {
  providedIn: 'root',
  factory: () => {
    const storage = inject(LocalStorageService);
    return { create: (key, seed, onIssue) => new LocalStorageEntityStore(key, seed, storage, onIssue) };
  },
});
