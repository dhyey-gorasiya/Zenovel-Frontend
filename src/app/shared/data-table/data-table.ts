import { Component, computed, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../icons';
import { Pagination } from '../ui/pagination';
import { statusTone } from '../ui/status-badge';
import { TableAction, TableColumn } from './data-table.models';

const ICON_ALIASES: Record<string, string> = { view: 'eye', edit: 'pencil', delete: 'trash' };

@Component({
  selector: 'app-data-table',
  imports: [RouterLink, Icon, Pagination],
  templateUrl: './data-table.html',
})
export class DataTable {
  columns = input.required<TableColumn<any>[]>();
  rows = input.required<any[]>();
  actions = input<TableAction<any>[]>([]);
  emptyMessage = input('No records found.');
  pageSizeOptions = input([10, 20, 50]);
  trackKey = input('id');
  initialSortKey = input<string | null>(null);
  initialSortAsc = input(false);

  sortKey = signal<string | null>(null);
  asc = signal(false);
  pg = signal(0);
  size = signal(10);
  filterRow = signal(false);
  columnFilters = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const key = this.initialSortKey();
      if (key != null && this.sortKey() === null) {
        this.sortKey.set(key);
        this.asc.set(this.initialSortAsc());
      }
    });
    effect(() => {
      this.columnFilters();
      this.pg.set(0);
    });
    effect(() => {
      const count = this.pageCount();
      if (this.pg() > count - 1) this.pg.set(count - 1);
    });
  }

  hasColumnFilters = computed(() => Object.values(this.columnFilters()).some(v => v.trim()));

  filtered = computed(() => {
    const key = this.sortKey();
    const dir = this.asc() ? 1 : -1;
    const cols = this.columns();
    const filters = this.columnFilters();

    let list = [...this.rows()];
    for (const col of cols) {
      const term = (filters[col.key] ?? '').trim().toLowerCase();
      if (!term) continue;
      list = list.filter(row => this.cellText(row, col, col.key).toLowerCase().includes(term));
    }
    if (key) {
      const col = cols.find(c => c.key === key);
      list.sort((a, b) => {
        const av = this.cellText(a, col, key);
        const bv = this.cellText(b, col, key);
        return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
    }
    return list;
  });

  pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.size())));

  pageRows = computed(() => {
    const size = this.size();
    const page = Math.min(this.pg(), this.pageCount() - 1);
    return this.filtered().slice(page * size, page * size + size);
  });

  colSpan = computed(() => this.columns().length + (this.actions().length ? 1 : 0));

  sort(key: string) {
    if (this.sortKey() === key) this.asc.set(!this.asc());
    else {
      this.sortKey.set(key);
      this.asc.set(true);
    }
  }

  ariaSort(key: string): 'ascending' | 'descending' | null {
    return this.sortKey() === key ? (this.asc() ? 'ascending' : 'descending') : null;
  }

  cellText(row: any, col: TableColumn | undefined, key: string): string {
    if (col?.value) return col.value(row);
    const v = row[key];
    return v == null ? '' : String(v);
  }

  cellValue(row: any, col: TableColumn): string {
    return this.cellText(row, col, col.key);
  }

  resolveClass(row: any, col: TableColumn): string {
    return typeof col.cellClass === 'function' ? col.cellClass(row) : (col.cellClass ?? '');
  }

  tdClass(row: any, col: TableColumn): string {
    if (col.type === 'badge') return '';
    const base =
      col.type === 'muted' ? 'text-ink-soft whitespace-nowrap' :
      col.type === 'strong' ? 'font-medium text-ink' :
      col.key === 'id' ? 'font-semibold tabular-nums text-ink-soft whitespace-nowrap' : '';
    return [base, this.resolveClass(row, col)].filter(Boolean).join(' ');
  }

  badgeClass(row: any, col: TableColumn): string {
    return ['zn-badge', this.resolveClass(row, col) || statusTone(this.cellValue(row, col))].filter(Boolean).join(' ');
  }

  visibleActions(row: any) {
    return this.actions().filter(a => !a.show || a.show(row));
  }

  actionIcon(a: TableAction): string {
    if (a.icon) return ICON_ALIASES[a.icon] ?? a.icon;
    const key = a.label.trim().toLowerCase();
    if (key.includes('edit')) return 'pencil';
    if (key.includes('delete') || key.includes('remove')) return 'trash';
    return 'eye';
  }

  trackRow(row: any) {
    return row[this.trackKey()] ?? row;
  }

  onColumnFilter(key: string, value: string) {
    this.columnFilters.update(m => ({ ...m, [key]: value }));
  }

  toggleFilterRow() {
    this.filterRow.update(open => !open);
  }

  clearColumnFilters() {
    this.columnFilters.set({});
  }
}
