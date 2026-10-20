import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { REPORT_STATUSES } from '../../../core/config/domain.config';
import { MonitoringReport } from '../../../core/models';
import { DialogService } from '../../../core/services/dialog.service';
import { MonitoringReportService } from '../../../core/services/monitoring-report.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { DataTable } from '../../../shared/data-table/data-table';
import { TableAction, TableColumn } from '../../../shared/data-table/data-table.models';
import { Icon } from '../../../shared/icons';
import { FilterBar, FilterDef, matches, toOptions } from '../../../shared/ui/filter-bar';
import { PageHeader } from '../../../shared/ui/page-header';

@Component({
  imports: [DataTable, FilterBar, PageHeader, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-list.html',
})
export class ReportList {
  private readonly router = inject(Router);
  private readonly reports = inject(MonitoringReportService);
  private readonly projects = inject(ProjectService);
  private readonly users = inject(UserDirectoryService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly roles = inject(DemoRoleService);

  protected readonly search = signal('');
  protected readonly filterValues = signal<Record<string, string>>({});

  protected readonly filters = computed<FilterDef[]>(() => {
    const visible = this.reports.visible();
    return [
      { key: 'projectId', label: 'Project', options: this.projects.visible().map(p => ({ value: p.id, label: p.name })) },
      { key: 'status', label: 'Status', options: toOptions(REPORT_STATUSES) },
      { key: 'visitType', label: 'Visit type', options: toOptions([...new Set(visible.map(r => r.visitType))].sort()) },
      { key: 'monitorId', label: 'Monitor', options: [...new Set(visible.map(r => r.monitorId))].map(id => ({ value: id, label: this.users.name(id) })) },
    ];
  });

  protected readonly rows = computed(() => {
    const f = this.filterValues();
    const q = this.search();
    return this.reports.visible().filter(r => {
      const p = this.projects.get(r.projectId);
      return (
        (!f['projectId'] || r.projectId === f['projectId']) &&
        (!f['status'] || r.status === f['status']) &&
        (!f['visitType'] || r.visitType === f['visitType']) &&
        (!f['monitorId'] || r.monitorId === f['monitorId']) &&
        matches(q, r.id, p?.name, p?.protocolNo, r.visitType, this.users.name(r.monitorId))
      );
    });
  });

  protected readonly columns: TableColumn<MonitoringReport>[] = [
    { key: 'id', label: 'Report ID', type: 'link', link: r => `/reports/${r.id}` },
    { key: 'project', label: 'Project', type: 'strong', value: r => this.projects.name(r.projectId) },
    { key: 'protocolNo', label: 'Protocol No.', value: r => this.projects.get(r.projectId)?.protocolNo ?? '—' },
    { key: 'visitType', label: 'Visit Type' },
    { key: 'monitor', label: 'Assigned Monitor', value: r => this.users.name(r.monitorId) },
    { key: 'visitDate', label: 'Visit Date' },
    { key: 'status', label: 'Report Status', type: 'badge' },
    { key: 'updatedAt', label: 'Last Updated', type: 'muted', value: r => r.updatedAt.slice(0, 10) },
  ];

  protected readonly actions: TableAction<MonitoringReport>[] = [
    { label: 'View', icon: 'view', onClick: r => this.router.navigate(['/reports', r.id]) },
    { label: 'Edit draft', icon: 'edit', show: r => this.reports.actions(r).edit, onClick: r => this.router.navigate(['/reports', r.id, 'edit']) },
    { label: 'Print view', icon: 'printer', onClick: r => this.router.navigate(['/reports', r.id, 'print']) },
    { label: 'Delete', icon: 'delete', show: r => this.reports.actions(r).delete, onClick: r => this.remove(r) },
  ];

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const status = q.get('status');
      if (status) this.filterValues.set({ status });
    });
  }

  private async remove(r: MonitoringReport): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Delete ${r.id}?`,
      message: r.assignmentId ? `Assignment ${r.assignmentId} will be kept and unlinked from this report.` : 'This cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.reports.delete(r.id);
    this.toast.success(`Report ${r.id} deleted.`);
  }
}
