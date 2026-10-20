import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MonitorAssignment } from '../../../core/models';
import { DialogService } from '../../../core/services/dialog.service';
import { EmailService } from '../../../core/services/email.service';
import { MonitorAssignmentService } from '../../../core/services/monitor-assignment.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { MonitoringReportService } from '../../../core/services/monitoring-report.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { ActivityTimeline } from '../../../shared/ui/timeline';

@Component({
  imports: [RouterLink, Icon, StatusBadge, ErrorState, ActivityTimeline, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assignment-detail.html',
})
export class AssignmentDetail {
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly email = inject(EmailService);
  private readonly toast = inject(ToastService);
  private readonly assignments = inject(MonitorAssignmentService);
  protected readonly projects = inject(ProjectService);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly reports = inject(MonitoringReportService);
  protected readonly users = inject(UserDirectoryService);

  readonly id = input.required<string>();
  protected readonly assignment = computed(() => this.assignments.getVisible(this.id()));
  protected readonly actions = computed(() =>
    this.assignment() ? this.assignments.actions(this.assignment()!) : { edit: false, delete: false, notify: false, acknowledge: false, startReport: false },
  );
  protected readonly history = computed(() => [...(this.assignment()?.history ?? [])].reverse().map(h => ({ at: h.at, title: h.text, subtitle: h.byName })));

  async notify(a: MonitorAssignment): Promise<void> {
    const sent = await this.email.preview(this.assignments.emailDraft(a));
    if (!sent) return;
    this.assignments.markNotified(a.id);
    this.toast.success(`${this.users.name(a.monitorId)} notified (simulated).`);
  }

  async acknowledge(a: MonitorAssignment): Promise<void> {
    const ok = await this.dialogs.confirm({ title: 'Mark assignment as acknowledged?', message: `${a.visitType} on ${a.visitDate} for ${this.users.name(a.monitorId)}.`, confirmText: 'Mark acknowledged' });
    if (!ok) return;
    this.assignments.acknowledge(a.id);
    this.toast.success('Assignment acknowledged.');
  }

  async remove(a: MonitorAssignment): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Delete ${a.id}?`,
      message: a.reportId ? `The linked report ${a.reportId} will be kept but unlinked from this assignment.` : 'This cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.assignments.delete(a.id);
    this.toast.success(`Assignment ${a.id} deleted.`);
    this.router.navigateByUrl('/assignments');
  }
}
