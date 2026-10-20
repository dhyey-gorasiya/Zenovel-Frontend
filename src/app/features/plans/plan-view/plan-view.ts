import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, inject } from '@angular/core';
import { Project } from '../../../core/models';
import { MonitoringPlanService, PlanInput } from '../../../core/services/monitoring-plan.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { StatusBadge } from '../../../shared/ui/status-badge';

/** Read-only rendering of monitoring plan content. Used on the plan page and in the wizard's review step. */
@Component({
  selector: 'app-plan-view',
  imports: [Icon, StatusBadge, DatePipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './plan-view.html',
})
export class PlanView {
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly users = inject(UserDirectoryService);
  readonly plan = input.required<PlanInput>();
  readonly project = input<Project | undefined>();
  readonly editable = input(false);
  readonly editStep = output<number>();
}
