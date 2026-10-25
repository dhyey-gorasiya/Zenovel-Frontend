import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { CHECKPOINT_STATUSES, COMMUNICATION_CHANNELS, RESPONSIBLE_ROLES, RISK_CATEGORIES, RISK_SCALE, ZENOVEL_SOPS } from '../../../core/config/domain.config';
import { Project, ProtocolSummaryItem, RiskItem } from '../../../core/models';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FileUpload } from '../../../shared/ui/file-upload';
import { errorMessage } from '../../../shared/ui/form-field';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { PlanAiPanel } from '../../plans/plan-ai-panel/plan-ai-panel';
import { PlanFormModel } from '../../plans/plan-form.model';

/** Monitoring Plan tab of the project form: the plan preparation template sheet followed by the AI-assisted risk assessment and protocol summary. */
@Component({
  selector: 'app-project-plan-fields',
  imports: [ReactiveFormsModule, Icon, DatePicker, FileUpload, StatusBadge, PlanAiPanel],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './project-plan-fields.html',
})
export class ProjectPlanFields {
  private readonly toast = inject(ToastService);
  protected readonly plans = inject(MonitoringPlanService);

  readonly model = input.required<PlanFormModel>();
  readonly project = input.required<Project>();
  /** Hides add/remove/AI controls while the plan cannot be edited. */
  readonly locked = input(false);
  readonly attemptedSubmit = input(false);

  protected readonly sops = ZENOVEL_SOPS;
  protected readonly channels = COMMUNICATION_CHANNELS;
  protected readonly checkpointStatuses = CHECKPOINT_STATUSES;
  protected readonly categories = RISK_CATEGORIES;
  protected readonly scale = RISK_SCALE;
  protected readonly responsibleRoles = RESPONSIBLE_ROLES;

  protected readonly aiContext = computed(() => {
    this.model().value();
    return this.model().aiContext(this.project());
  });

  acceptAi(kind: 'summary' | 'risk', items: (ProtocolSummaryItem | RiskItem)[], replace: boolean): void {
    this.model().acceptAi(kind, items, replace);
    this.toast.info(`${items.length} simulated suggestion(s) added. Review and edit them before submitting.`);
  }

  error(c: AbstractControl): string {
    return c.invalid && (c.touched || c.dirty) ? errorMessage(c) : '';
  }
}
