import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuditAction } from '../../core/models';
import { ProjectService } from '../../core/services/project.service';
import { ProjectAuditService } from '../../core/services/project-audit.service';
import { DataTable } from '../../shared/data-table/data-table';
import { TableAction, TableColumn } from '../../shared/data-table/data-table.models';
import { Icon } from '../../shared/icons';
import { FilterBar, FilterDef, matches, toOptions } from '../../shared/ui/filter-bar';
import { Modal } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { StatusBadge } from '../../shared/ui/status-badge';

const AUDIT_ACTIONS: AuditAction[] = ['Created', 'Updated', 'Deleted'];

/** One table row per changed field. */
interface AuditRow {
  id: string;
  entryId: string;
  field: string;
  at: string;
  projectId: string;
  projectName: string;
  action: AuditAction;
  label: string;
  previous: string;
  current: string;
  actorName: string;
}

const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const valueCell = 'min-w-48 max-w-sm whitespace-pre-wrap break-words';

@Component({
  imports: [DataTable, FilterBar, PageHeader, RouterLink, Icon, Modal, StatusBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audit-log.html',
})
export class AuditLog {
  private readonly router = inject(Router);
  private readonly locale = inject(LOCALE_ID);
  private readonly audit = inject(ProjectAuditService);
  private readonly projects = inject(ProjectService);

  protected readonly search = signal('');
  protected readonly filterValues = signal<Record<string, string>>({});

  private readonly allRows = computed<AuditRow[]>(() =>
    this.audit.visible().flatMap(e =>
      e.changes.map((c, i) => ({
        id: `${e.id}-${i}`,
        entryId: e.id,
        field: c.field,
        at: e.at,
        projectId: e.projectId,
        projectName: e.projectName,
        action: e.action,
        label: c.label,
        previous: c.previous,
        current: c.current,
        actorName: e.actorName,
      })),
    ),
  );

  protected readonly filters = computed<FilterDef[]>(() => {
    const rows = this.allRows();
    const projectOptions = new Map(rows.map(r => [r.projectId, `${r.projectId} · ${r.projectName}`]));
    return [
      { key: 'project', label: 'Project', options: [...projectOptions].sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label })) },
      { key: 'action', label: 'Action', options: toOptions(AUDIT_ACTIONS) },
      { key: 'field', label: 'Field', options: toOptions(sorted(rows.map(r => r.label))) },
      { key: 'actor', label: 'Changed by', options: toOptions(sorted(rows.map(r => r.actorName))) },
    ];
  });

  protected readonly rows = computed(() => {
    const f = this.filterValues();
    const q = this.search();
    return this.allRows().filter(
      r =>
        (!f['project'] || r.projectId === f['project']) &&
        (!f['action'] || r.action === f['action']) &&
        (!f['field'] || r.label === f['field']) &&
        (!f['actor'] || r.actorName === f['actor']) &&
        matches(q, r.projectId, r.projectName, r.label, r.previous, r.current, r.actorName),
    );
  });

  protected readonly columns: TableColumn<AuditRow>[] = [
    { key: 'at', label: 'Changed on', type: 'muted', value: r => formatDate(r.at, 'yyyy-MM-dd HH:mm:ss', this.locale) },
    { key: 'project', label: 'Project', type: 'strong', value: r => `${r.projectId} · ${r.projectName}` },
    { key: 'action', label: 'Action', type: 'badge' },
    { key: 'label', label: 'Field' },
    { key: 'previous', label: 'Previous value', type: 'muted', cellClass: valueCell },
    { key: 'current', label: 'New value', cellClass: valueCell },
    { key: 'actorName', label: 'Changed by' },
  ];

  protected readonly actions: TableAction<AuditRow>[] = [
    { label: 'View changes', icon: 'view', onClick: r => this.viewing.set(r) },
    { label: 'View project', icon: 'external-link', show: r => !!this.projects.getVisible(r.projectId), onClick: r => this.router.navigate(['/projects', r.projectId]) },
  ];

  /** Row whose old/new data is open in the modal. */
  protected readonly viewing = signal<AuditRow | null>(null);

  /** The full save the viewed row belongs to, so the modal can list every field changed alongside it. */
  protected readonly viewingEntry = computed(() => {
    const row = this.viewing();
    return row ? this.audit.visible().find(e => e.id === row.entryId) ?? null : null;
  });

  protected formatAt(at: string): string {
    return formatDate(at, 'dd MMM yyyy, HH:mm:ss', this.locale);
  }

  /** Project the page was opened for via "Get Audit Log" (`?projectId=`), if it is still selected. */
  protected readonly scopedProject = computed(() => {
    const id = this.routeProjectId();
    if (!id || this.filterValues()['project'] !== id) return null;
    const name = this.projects.getVisible(id)?.name ?? this.allRows().find(r => r.projectId === id)?.projectName;
    return { id, label: name ? `${id} · ${name}` : id, exists: !!this.projects.getVisible(id) };
  });

  private readonly routeProjectId = signal<string | null>(null);

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const project = q.get('projectId');
      this.routeProjectId.set(project);
      this.filterValues.set(project ? { project } : {});
    });
  }
}
