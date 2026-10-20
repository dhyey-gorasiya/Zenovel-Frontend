export type TableCellType = 'text' | 'badge' | 'muted' | 'strong' | 'link';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  type?: TableCellType;
  /** Custom display value; defaults to row[key]. */
  value?: (row: T) => string;
  /** Router link for `link` cells. */
  link?: (row: T) => string;
  /** Extra CSS classes for the cell or badge. Badges default to a tone based on the status text. */
  cellClass?: string | ((row: T) => string);
}

/** Built-in aliases, or any registered Lucide icon name. */
export type TableActionIcon = 'view' | 'edit' | 'delete' | (string & {});

export interface TableAction<T = Record<string, unknown>> {
  label: string;
  icon?: TableActionIcon;
  class?: string;
  show?: (row: T) => boolean;
  onClick: (row: T) => void;
}
