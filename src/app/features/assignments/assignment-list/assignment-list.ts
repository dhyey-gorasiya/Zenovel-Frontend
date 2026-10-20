import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { ASSIGNMENT_STATUSES } from '../../../core/config/domain.config';
import { MonitorAssignment } from '../../../core/models';
import { DialogService } from '../../../core/services/dialog.service';
import { EmailService } from '../../../core/services/email.service';
import { MonitorAssignmentService } from '../../../core/services/monitor-assignment.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { DataTable } from '../../../shared/data-table/data-table';
import { TableAction, TableColumn } from '../../../shared/data-table/data-table.models';
import { Icon } from '../../../shared/icons';
import { FilterBar, FilterDef, matches, toOptions } from '../../../shared/ui/filter-bar';
import { PageHeader } from '../../../shared/ui/page-header';

const DAY = 864e5;

@Component({
  imports: [DataTable, FilterBar, PageHeader, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-list.html',
})
export class AssignmentList {
  private readonly router = inject(Router);
  private readonly assignments = inject(MonitorAssignmentService);
  private readonly projects = inject(ProjectService);
  private readonly users = inject(UserDirectoryService);
  private readonly dialogs = inject(DialogService);
  private readonly email = inject(EmailService);
  private readonly toast = inject(ToastService);
  protected readonly roles = inject(DemoRoleService);

  protected readonly search = signal('');
  protected readonly filterValues = signal<Record<string, string>>({});

  protected readonly filters = computed<FilterDef[]>(() => {
    const visible = this.assignments.visible();
    return [
      { key: 'projectId', label: 'Project', options: this.projects.visible().map(p => ({ value: p.id, label: p.name })) },
      { key: 'monitorId', label: 'Monitor', options: [...new Set(visible.map(a => a.monitorId))].map(id => ({ value: id, label: this.users.name(id) })) },
      { key: 'visitType', label: 'Visit type', options: toOptions([...new Set(visible.map(a => a.visitType))].sort()) },
      { key: 'when', label: 'Date', options: [{ value: 'upcoming', label: 'Upcoming' }, { value: '7', label: 'Next 7 days' }, { value: '30', label: 'Next 30 days' }, { value: 'past', label: 'Past' }] },
      { key: 'status', label: 'Status', options: toOptions(ASSIGNMENT_STATUSES) },
    ];
  });

  protected readonly rows = computed(() => {
    const f = this.filterValues();
    const q = this.search();
    const today = new Date().toISOString().slice(0, 10);
    return this.assignments.visible().filter(a => {
      const when = f['when'];
      const dateOk =
        !when ||
        (when === 'upcoming' ? this.assignments.isUpcoming(a) :
          when === 'past' ? a.visitDate < today :
            a.visitDate >= today && a.visitDate <= new Date(Date.now() + Number(when) * DAY).toISOString().slice(0, 10));
      return (
        (!f['projectId'] || a.projectId === f['projectId']) &&
        (!f['monitorId'] || a.monitorId === f['monitorId']) &&
        (!f['visitType'] || a.visitType === f['visitType']) &&
        (!f['status'] || a.status === f['status']) &&
        dateOk &&
        matches(q, a.id, a.visitType, this.projects.name(a.projectId), this.users.name(a.monitorId), a.monitorEmail, a.reportId)
      );
    });
  });

  protected readonly columns: TableColumn<MonitorAssignment>[] = [
    { key: 'id', label: 'Assignment ID', type: 'link', link: a => `/assignments/${a.id}` },
    { key: 'project', label: 'Project', type: 'strong', value: a => this.projects.name(a.projectId) },
    { key: 'visitType', label: 'Visit Type' },
    { key: 'visitDate', label: 'Visit Date' },
    { key: 'monitor', label: 'Assigned Monitor', value: a => this.users.name(a.monitorId) },
    { key: 'monitorEmail', label: 'Monitor Email', type: 'muted' },
    { key: 'reportId', label: 'Linked Report', type: 'link', value: a => a.reportId ?? '—', link: a => (a.reportId ? `/reports/${a.reportId}` : '') },
    { key: 'status', label: 'Status', type: 'badge' },
    { key: 'updatedAt', label: 'Last Updated', type: 'muted', value: a => a.updatedAt.slice(0, 10) },
  ];

  protected readonly actions: TableAction<MonitorAssignment>[] = [
    { label: 'View', icon: 'view', onClick: a => this.router.navigate(['/assignments', a.id]) },
    { label: 'Send email notification', icon: 'mail', show: a => this.assignments.actions(a).notify, onClick: a => this.notify(a) },
    { label: 'Edit', icon: 'edit', show: a => this.assignments.actions(a).edit, onClick: a => this.router.navigate(['/assignments', a.id, 'edit']) },
    { label: 'Delete', icon: 'delete', show: a => this.assignments.actions(a).delete, onClick: a => this.remove(a) },
  ];

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const next: Record<string, string> = {};
      for (const k of ['when', 'status', 'projectId', 'monitorId']) {
        const v = q.get(k);
        if (v) next[k] = v;
      }
      if (Object.keys(next).length) this.filterValues.set(next);
    });
  }

  private async notify(a: MonitorAssignment): Promise<void> {
    const sent = await this.email.preview(this.assignments.emailDraft(a));
    if (!sent) return;
    this.assignments.markNotified(a.id);
    this.toast.success(`${this.users.name(a.monitorId)} notified (simulated).`);
  }

  private async remove(a: MonitorAssignment): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Delete ${a.id}?`,
      message: a.reportId ? `The linked report ${a.reportId} will be kept but unlinked from this assignment.` : 'This cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.assignments.delete(a.id);
    this.toast.success(`Assignment ${a.id} deleted.`);
  }
}
