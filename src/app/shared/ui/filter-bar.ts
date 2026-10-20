import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { Icon } from '../icons';

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/** Search box + dropdown filters above a list. Values are two-way bound so pages can seed them from query params. */
@Component({
  selector: 'app-filter-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-bar.html',
})
export class FilterBar {
  readonly filters = input<FilterDef[]>([]);
  readonly placeholder = input('Search…');
  readonly search = model('');
  readonly values = model<Record<string, string>>({});
  readonly active = computed(() => !!this.search().trim() || Object.values(this.values()).some(Boolean));

  set(key: string, value: string): void {
    this.values.update(v => ({ ...v, [key]: value }));
  }

  clear(): void {
    this.search.set('');
    this.values.set({});
  }
}

/** Helper for pages: case-insensitive match of a search term against several fields. */
export const matches = (term: string, ...fields: (string | number | null | undefined)[]): boolean => {
  const q = term.trim().toLowerCase();
  return !q || fields.some(f => String(f ?? '').toLowerCase().includes(q));
};

export const toOptions = (values: readonly string[]) => values.map(v => ({ value: v, label: v }));
