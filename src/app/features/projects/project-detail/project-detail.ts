import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { Delegation, MonitorAssignment, MonitoringPlan, MonitoringReport } from '../../../core/models';
import { ActivityService } from '../../../core/services/activity.service';
import { DelegationService } from '../../../core/services/delegation.service';
import { MonitorAssignmentService } from '../../../core/services/monitor-assignment.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { MonitoringReportService } from '../../../core/services/monitoring-report.service';
import { ProjectService } from '../../../core/services/project.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { DataTable } from '../../../shared/data-table/data-table';
import { TableColumn } from '../../../shared/data-table/data-table.models';
import { Icon } from '../../../shared/icons';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { TabItem, Tabs } from '../../../shared/ui/tabs';
import { ActivityTimeline } from '../../../shared/ui/timeline';
import { ProjectUiActions } from '../project-ui-actions';

@Component({
  imports: [RouterLink, Icon, Tabs, DataTable, StatusBadge, ErrorState, ActivityTimeline, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-detail.html',
})
export class ProjectDetail {
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectService);
  private readonly plans = inject(MonitoringPlanService);
  private readonly delegations = inject(DelegationService);
  private readonly assignments = inject(MonitorAssignmentService);
  private readonly reports = inject(MonitoringReportService);
  private readonly activity = inject(ActivityService);
  private readonly ui = inject(ProjectUiActions);
  protected readonly users = inject(UserDirectoryService);
  protected readonly roles = inject(DemoRoleService);

  readonly id = input.required<string>();
  readonly tab = input<string>();

  protected readonly project = computed(() => this.projects.getVisible(this.id()));
  protected readonly activeTab = linkedSignal(() => this.tab() ?? 'overview');

  protected readonly relatedPlans = computed(() => this.plans.forProject(this.id()));
  protected readonly relatedDelegations = computed(() => this.delegations.forProject(this.id()));
  protected readonly delegationUnlocked = computed(() => this.plans.approvedForProject(this.id()).length > 0);
  protected readonly relatedAssignments = computed(() => this.assignments.forProject(this.id()));
  protected readonly relatedReports = computed(() => this.reports.forProject(this.id()));
  protected readonly history = computed(() =>
    this.activity.forProject(this.id()).map(a => ({ at: a.at, title: a.text, subtitle: `${a.actorName} · ${a.entityType} ${a.entityId}` })),
  );

  protected readonly tabs = computed<TabItem[]>(() => {
    const t: TabItem[] = [{ key: 'overview', label: 'Overview' }];
    if (this.roles.can('plan.view')) t.push({ key: 'plans', label: 'Monitoring Plans', count: this.relatedPlans().length });
    if (this.roles.can('delegation.view')) t.push({ key: 'delegations', label: 'Training & Delegation', count: this.relatedDelegations().length });
    if (this.roles.can('assignment.view')) t.push({ key: 'assignments', label: 'Monitor Assignments', count: this.relatedAssignments().length });
    if (this.roles.can('report.view')) t.push({ key: 'reports', label: 'Monitoring Reports', count: this.relatedReports().length });
    t.push({ key: 'activity', label: 'Activity History', count: this.history().length });
    return t;
  });

  protected readonly planColumns: TableColumn<MonitoringPlan>[] = [
    { key: 'id', label: 'Plan ID', type: 'link', link: p => `/plans/${p.id}` },
    { key: 'version', label: 'Version', value: p => `v${p.version}` },
    { key: 'createdByName', label: 'Created By' },
    { key: 'status', label: 'Plan Status', type: 'badge' },
    { key: 'sponsorReview', label: 'Sponsor Review', type: 'badge' },
    { key: 'updatedAt', label: 'Last Updated', type: 'muted', value: p => p.updatedAt.slice(0, 10) },
  ];

  protected readonly delegationColumns: TableColumn<Delegation>[] = [
    { key: 'id', label: 'Delegation ID', type: 'link', link: d => `/delegations/${d.id}` },
    { key: 'planId', label: 'Monitoring Plan' },
    { key: 'meetingDate', label: 'Meeting Date' },
    { key: 'monitors', label: 'Monitors', value: d => d.monitors.map(m => `${this.users.name(m.monitorId)} (${m.duty})`).join(', ') },
    { key: 'ack', label: 'Acknowledged', value: d => { const p = this.delegations.progress(d); return `${p.acknowledged}/${p.total}`; } },
    { key: 'authorization', label: 'Authorization', type: 'badge' },
  ];

  protected readonly assignmentColumns: TableColumn<MonitorAssignment>[] = [
    { key: 'id', label: 'Assignment ID', type: 'link', link: a => `/assignments/${a.id}` },
    { key: 'visitType', label: 'Visit Type' },
    { key: 'visitDate', label: 'Visit Date' },
    { key: 'monitor', label: 'Monitor', value: a => this.users.name(a.monitorId) },
    { key: 'reportId', label: 'Report', type: 'link', value: a => a.reportId ?? '—', link: a => (a.reportId ? `/reports/${a.reportId}` : '') },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  protected readonly reportColumns: TableColumn<MonitoringReport>[] = [
    { key: 'id', label: 'Report ID', type: 'link', link: r => `/reports/${r.id}` },
    { key: 'visitType', label: 'Visit Type' },
    { key: 'visitDate', label: 'Visit Date' },
    { key: 'monitor', label: 'Monitor', value: r => this.users.name(r.monitorId) },
    { key: 'version', label: 'Version', value: r => `v${r.version}` },
    { key: 'status', label: 'Status', type: 'badge' },
  ];

  async remove(): Promise<void> {
    const p = this.project();
    if (p && (await this.ui.delete(p))) this.router.navigateByUrl('/projects');
  }
}
