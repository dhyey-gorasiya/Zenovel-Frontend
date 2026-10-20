import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { AUTHORIZATION_STATUSES, STUDY_TYPES } from '../../../core/config/domain.config';
import { Delegation } from '../../../core/models';
import { DelegationService } from '../../../core/services/delegation.service';
import { DialogService } from '../../../core/services/dialog.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
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
  templateUrl: './delegation-list.html',
})
export class DelegationList {
  private readonly router = inject(Router);
  private readonly delegations = inject(DelegationService);
  private readonly projects = inject(ProjectService);
  private readonly plans = inject(MonitoringPlanService);
  private readonly users = inject(UserDirectoryService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly roles = inject(DemoRoleService);

  protected readonly search = signal('');
  protected readonly filterValues = signal<Record<string, string>>({});

  protected readonly filters = computed<FilterDef[]>(() => [
    { key: 'projectId', label: 'Project', options: this.projects.visible().map(p => ({ value: p.id, label: p.name })) },
    { key: 'studyType', label: 'Study type', options: toOptions(STUDY_TYPES) },
    { key: 'authorization', label: 'Authorization', options: toOptions(AUTHORIZATION_STATUSES) },
    { key: 'ack', label: 'Acknowledgement', options: [{ value: 'pending', label: 'Has pending' }, { value: 'declined', label: 'Has declined' }, { value: 'complete', label: 'All acknowledged' }] },
  ]);

  protected readonly rows = computed(() => {
    const f = this.filterValues();
    const q = this.search();
    return this.delegations.visible().filter(d => {
      const p = this.projects.get(d.projectId);
      const prog = this.delegations.progress(d);
      const ackOk =
        !f['ack'] || (f['ack'] === 'pending' ? prog.pending > 0 : f['ack'] === 'declined' ? prog.declined > 0 : prog.complete);
      return (
        (!f['projectId'] || d.projectId === f['projectId']) &&
        (!f['studyType'] || p?.studyType === f['studyType']) &&
        (!f['authorization'] || d.authorization === f['authorization']) &&
        ackOk &&
        matches(q, d.id, p?.name, d.planId, ...d.monitors.map(m => this.users.name(m.monitorId)))
      );
    });
  });

  protected readonly columns: TableColumn<Delegation>[] = [
    { key: 'id', label: 'Delegation ID', type: 'link', link: d => `/delegations/${d.id}` },
    { key: 'project', label: 'Project', type: 'strong', value: d => this.projects.name(d.projectId) },
    { key: 'planId', label: 'Monitoring Plan', value: d => this.plans.label(d.planId) },
    { key: 'meetingDate', label: 'Meeting Date' },
    { key: 'studyType', label: 'Study Type', value: d => { const p = this.projects.get(d.projectId); return p ? `${p.studyType} · ${p.blinding}` : '—'; } },
    { key: 'monitors', label: 'Assigned Monitors', value: d => [...new Set(d.monitors.map(m => this.users.name(m.monitorId)))].join(', ') },
    { key: 'ack', label: 'Acknowledged', value: d => { const p = this.delegations.progress(d); return `${p.acknowledged}/${p.total} (${p.percent}%)`; } },
    { key: 'authorization', label: 'Authorization', type: 'badge' },
    { key: 'updatedAt', label: 'Last Updated', type: 'muted', value: d => d.updatedAt.slice(0, 10) },
  ];

  protected readonly actions: TableAction<Delegation>[] = [
    { label: 'View', icon: 'view', onClick: d => this.router.navigate(['/delegations', d.id]) },
    { label: 'Edit', icon: 'edit', show: () => this.delegations.canManage(), onClick: d => this.router.navigate(['/delegations', d.id, 'edit']) },
    { label: 'Delete', icon: 'delete', show: () => this.delegations.canManage(), onClick: d => this.remove(d) },
  ];

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const ack = q.get('ack');
      if (ack) this.filterValues.set({ ack });
    });
  }

  private async remove(d: Delegation): Promise<void> {
    const ok = await this.dialogs.confirm({ title: `Delete ${d.id}?`, message: 'The delegation record, its acknowledgements and authorization history will be permanently deleted.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    this.delegations.delete(d.id);
    this.toast.success(`Delegation ${d.id} deleted.`);
  }
}
