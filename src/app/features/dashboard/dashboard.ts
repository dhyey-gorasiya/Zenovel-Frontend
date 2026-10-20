import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DemoRoleService } from '../../core/auth/demo-role.service';
import { Permission } from '../../core/config/permissions.config';
import { DashboardService } from '../../core/services/dashboard.service';
import { ProjectService } from '../../core/services/project.service';
import { UserDirectoryService } from '../../core/services/user-directory.service';
import { Icon } from '../../shared/icons';
import { ChartView } from '../../shared/ui/chart';
import { EmptyState } from '../../shared/ui/states';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ActivityTimeline } from '../../shared/ui/timeline';

const QUICK_ACTIONS: { label: string; link: string; icon: string; permission: Permission }[] = [
  { label: 'Create Project', link: '/projects/new', icon: 'folder-kanban', permission: 'project.manage' },
  { label: 'Create Monitoring Plan', link: '/plans/new', icon: 'clipboard-list', permission: 'plan.manage' },
  { label: 'Create Delegation Record', link: '/delegations/new', icon: 'graduation-cap', permission: 'delegation.manage' },
  { label: 'Assign Monitor', link: '/assignments/new', icon: 'user-check', permission: 'assignment.manage' },
  { label: 'Create Monitoring Report', link: '/reports/new', icon: 'file-text', permission: 'report.prepare' },
];

@Component({
  imports: [RouterLink, Icon, ChartView, EmptyState, StatusBadge, ActivityTimeline, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly router = inject(Router);
  private readonly roles = inject(DemoRoleService);
  protected readonly auth = inject(AuthService);
  protected readonly dash = inject(DashboardService);
  protected readonly projects = inject(ProjectService);
  protected readonly users = inject(UserDirectoryService);

  protected readonly quickActions = computed(() => {
    this.roles.role();
    return QUICK_ACTIONS.filter(a => this.roles.can(a.permission));
  });
  protected readonly hasPlans = computed(() => this.dash.planStatus().some(s => s.value > 0));
  protected readonly timeline = computed(() =>
    this.dash.recentActivity().map(a => ({ at: a.at, title: a.text, subtitle: a.actorName, link: this.linkFor(a.entityType, a.entityId) })),
  );

  openProjects(status: string): void {
    this.router.navigate(['/projects'], { queryParams: { status } });
  }

  openPlans(status: string): void {
    this.router.navigate(['/plans'], { queryParams: { status } });
  }

  private linkFor(type: string, id: string): string | undefined {
    const base = { Project: '/projects', 'Monitoring Plan': '/plans', Delegation: '/delegations', Assignment: '/assignments', Report: '/reports' }[type];
    return base ? `${base}/${id}` : undefined;
  }
}
