import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { DelegationService } from '../../../core/services/delegation.service';
import { MonitorAssignmentService } from '../../../core/services/monitor-assignment.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { Icon } from '../../../shared/icons';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { PlanUiActions } from '../plan-ui-actions';
import { PlanView } from '../plan-view/plan-view';
import { PlanWorkflowPanel } from '../plan-workflow-panel/plan-workflow-panel';

@Component({
  imports: [RouterLink, Icon, StatusBadge, ErrorState, PlanView, PlanWorkflowPanel, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-detail.html',
})
export class PlanDetail {
  private readonly router = inject(Router);
  private readonly plans = inject(MonitoringPlanService);
  private readonly delegationService = inject(DelegationService);
  private readonly assignmentService = inject(MonitorAssignmentService);
  private readonly ui = inject(PlanUiActions);
  protected readonly projects = inject(ProjectService);
  protected readonly roles = inject(DemoRoleService);

  readonly id = input.required<string>();
  protected readonly plan = computed(() => this.plans.getVisible(this.id()));
  protected readonly actions = computed(() => (this.plan() ? this.plans.actions(this.plan()!) : { edit: false, delete: false }));
  protected readonly delegations = computed(() => this.delegationService.visible().filter(d => d.planId === this.id()));
  protected readonly assignments = computed(() => this.assignmentService.visible().filter(a => a.planId === this.id()));

  async remove(): Promise<void> {
    const p = this.plan();
    if (p && (await this.ui.delete(p))) this.router.navigateByUrl('/plans');
  }
}
