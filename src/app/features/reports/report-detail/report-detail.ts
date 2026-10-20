import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MonitoringReport, ReportVersion } from '../../../core/models';
import { DialogService } from '../../../core/services/dialog.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { MonitoringReportService } from '../../../core/services/monitoring-report.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { Modal } from '../../../shared/ui/modal';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { ApprovalHistory } from '../../../shared/ui/timeline';
import { ReportContentView } from '../report-content/report-content';

@Component({
  imports: [RouterLink, Icon, StatusBadge, ErrorState, ApprovalHistory, ReportContentView, Modal, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-detail.html',
})
export class ReportDetail {
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly reports = inject(MonitoringReportService);
  protected readonly projects = inject(ProjectService);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly users = inject(UserDirectoryService);

  readonly id = input.required<string>();
  protected readonly viewing = signal<ReportVersion | null>(null);
  protected readonly report = computed(() => this.reports.getVisible(this.id()));
  protected readonly project = computed(() => this.projects.get(this.report()?.projectId));
  protected readonly actions = computed(() => (this.report() ? this.reports.actions(this.report()!) : { edit: false, delete: false, submit: false, review: false }));
  protected readonly reviews = computed(() => [...(this.report()?.reviews ?? [])].reverse());
  protected readonly versionsDesc = computed(() => [...(this.report()?.versions ?? [])].reverse());
  protected readonly hint = computed(() => {
    const s = this.report()?.status;
    return s === 'In Review' ? 'Awaiting review by the Project Manager.' : s === 'Approved' ? 'This report is approved.' : 'Waiting for the assigned monitor to complete and submit the report.';
  });

  async submit(r: MonitoringReport): Promise<void> {
    if (!(await this.dialogs.confirm({ title: 'Submit for review?', message: 'The report will be locked for editing while under review.', confirmText: 'Submit' }))) return;
    this.reports.submit(r.id);
    this.toast.success('Report submitted for review.');
  }

  async approve(r: MonitoringReport): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Approve report', label: 'Reviewer comments (optional)', confirmText: 'Approve' });
    if (comment === null) return;
    this.reports.approve(r.id, comment);
    this.toast.success('Report approved. The linked assignment is marked completed.');
  }

  async requestChanges(r: MonitoringReport): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Request changes', label: 'What needs to change?', required: true, confirmText: 'Request changes' });
    if (!comment) return;
    this.reports.requestChanges(r.id, comment);
    this.toast.success('Changes requested. The monitor has been notified.');
  }

  async comment(r: MonitoringReport): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Add comment', label: 'Comment', required: true, confirmText: 'Add comment' });
    if (!comment) return;
    this.reports.addComment(r.id, comment);
    this.toast.success('Comment added.');
  }

  async remove(r: MonitoringReport): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Delete ${r.id}?`,
      message: r.assignmentId ? `Assignment ${r.assignmentId} will be kept and unlinked from this report.` : 'This cannot be undone.',
      confirmText: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    this.reports.delete(r.id);
    this.toast.success(`Report ${r.id} deleted.`);
    this.router.navigateByUrl('/reports');
  }
}
