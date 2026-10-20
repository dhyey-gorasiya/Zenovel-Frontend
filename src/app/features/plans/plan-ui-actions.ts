import { Injectable, inject } from '@angular/core';
import { MonitoringPlan } from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { MonitoringPlanService } from '../../core/services/monitoring-plan.service';
import { ToastService } from '../../core/services/toast.service';

@Injectable({ providedIn: 'root' })
export class PlanUiActions {
  private readonly plans = inject(MonitoringPlanService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  async delete(p: MonitoringPlan): Promise<boolean> {
    const deps = this.plans.dependents(p.id);
    const details = [
      deps.delegations.length ? `${deps.delegations.length} delegation record(s) will be deleted: ${deps.delegations.map(d => d.id).join(', ')}` : '',
      deps.assignments.length ? `${deps.assignments.length} assignment(s) will keep existing but lose their plan link` : '',
      deps.reports.length ? `${deps.reports.length} report(s) will keep existing but lose their plan link` : '',
    ].filter(Boolean);
    const ok = await this.dialogs.confirm({
      title: `Delete Monitoring Plan ${p.id}?`,
      message: details.length ? 'This plan has linked records:' : 'This plan has no linked records. This cannot be undone.',
      details: details.length ? details : undefined,
      confirmText: 'Delete plan',
      tone: 'danger',
    });
    if (!ok) return false;
    this.plans.delete(p.id);
    this.toast.success(`Monitoring Plan ${p.id} deleted.`);
    return true;
  }
}
