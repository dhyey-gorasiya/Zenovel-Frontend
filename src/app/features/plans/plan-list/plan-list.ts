import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { PLAN_STATUSES, SPONSOR_REVIEW_STATUSES } from '../../../core/config/domain.config';
import { MonitoringPlan } from '../../../core/models';
import { DashboardService } from '../../../core/services/dashboard.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { DataTable } from '../../../shared/data-table/data-table';
import { TableAction, TableColumn } from '../../../shared/data-table/data-table.models';
import { FilterBar, FilterDef, matches, toOptions } from '../../../shared/ui/filter-bar';
import { PageHeader } from '../../../shared/ui/page-header';
import { PlanUiActions } from '../plan-ui-actions';

@Component({
  imports: [DataTable, FilterBar, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-list.html',
})
export class PlanList {
  private readonly router = inject(Router);
  private readonly plans = inject(MonitoringPlanService);
  private readonly projects = inject(ProjectService);
  private readonly dashboard = inject(DashboardService);
  private readonly ui = inject(PlanUiActions);
  protected readonly roles = inject(DemoRoleService);

  protected readonly search = signal('');
  protected readonly filterValues = signal<Record<string, string>>({});

  protected readonly filters = computed<FilterDef[]>(() => [
    { key: 'status', label: 'Plan status', options: toOptions(PLAN_STATUSES) },
    { key: 'sponsorReview', label: 'Sponsor review', options: toOptions(SPONSOR_REVIEW_STATUSES) },
    { key: 'awaiting', label: 'Approval', options: [{ value: '1', label: 'Awaiting approval' }] },
    { key: 'projectId', label: 'Project', options: this.projects.visible().map(p => ({ value: p.id, label: p.name })) },
  ]);

  protected readonly rows = computed(() => {
    const f = this.filterValues();
    const q = this.search();
    return this.plans.visible().filter(p => {
      const project = this.projects.get(p.projectId);
      return (
        (!f['status'] || p.status === f['status']) &&
        (!f['sponsorReview'] || p.sponsorReview === f['sponsorReview']) &&
        (!f['awaiting'] || this.dashboard.awaitingApproval(p.status, p.sponsorReview)) &&
        (!f['projectId'] || p.projectId === f['projectId']) &&
        matches(q, p.id, project?.name, project?.protocolNo, p.createdByName, p.version)
      );
    });
  });

  protected readonly columns: TableColumn<MonitoringPlan>[] = [
    { key: 'id', label: 'Plan ID', type: 'link', link: p => `/plans/${p.id}` },
    { key: 'project', label: 'Project Name', type: 'strong', value: p => this.projects.name(p.projectId) },
    { key: 'protocolNo', label: 'Protocol No.', value: p => this.projects.get(p.projectId)?.protocolNo ?? '—' },
    { key: 'version', label: 'Version', value: p => `v${p.version}` },
    { key: 'createdByName', label: 'Created By' },
    { key: 'createdAt', label: 'Created Date', type: 'muted', value: p => p.createdAt.slice(0, 10) },
    { key: 'status', label: 'Plan Status', type: 'badge' },
    { key: 'sponsorReview', label: 'Sponsor Review', type: 'badge' },
    { key: 'updatedAt', label: 'Last Updated', type: 'muted', value: p => p.updatedAt.slice(0, 10) },
  ];

  protected readonly actions: TableAction<MonitoringPlan>[] = [
    { label: 'View', icon: 'view', onClick: p => this.router.navigate(['/plans', p.id]) },
    { label: 'Edit', icon: 'edit', show: p => this.plans.actions(p).edit && this.roles.can('project.completeDetails'), onClick: p => this.router.navigate(['/projects', p.projectId, 'details'], { queryParams: { tab: 'plan' } }) },
    { label: 'Delete', icon: 'delete', show: p => this.plans.actions(p).delete, onClick: p => this.ui.delete(p) },
  ];

  constructor() {
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const next: Record<string, string> = {};
      for (const k of ['status', 'awaiting', 'projectId', 'sponsorReview']) {
        const v = q.get(k);
        if (v) next[k] = v;
      }
      if (Object.keys(next).length) this.filterValues.set(next);
    });
  }
}
