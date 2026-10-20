import { Injectable, inject } from '@angular/core';
import { MonitorAssignment } from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { EmailService } from '../../core/services/email.service';
import { MonitorAssignmentService } from '../../core/services/monitor-assignment.service';
import { ToastService } from '../../core/services/toast.service';

/** Confirm / email-preview flows shared by the assignment list and detail pages. */
@Injectable({ providedIn: 'root' })
export class AssignmentUiActions {
  private readonly assignments = inject(MonitorAssignmentService);
  private readonly dialogs = inject(DialogService);
  private readonly email = inject(EmailService);
  private readonly toast = inject(ToastService);

  async notify(a: MonitorAssignment): Promise<void> {
    const sent = await this.email.preview(this.assignments.emailDraft(a));
    if (!sent) return;
    this.assignments.markNotified(a.id);
    this.toast.success(`Monitor notified about ${a.id}.`);
  }

  async acknowledge(a: MonitorAssignment): Promise<void> {
    const ok = await this.dialogs.confirm({ title: `Mark ${a.id} as acknowledged?`, message: `${a.visitType} on ${a.visitDate} will be recorded as acknowledged by the assigned monitor.`, confirmText: 'Mark acknowledged' });
    if (!ok) return;
    this.assignments.acknowledge(a.id);
    this.toast.success('Assignment acknowledged.');
  }

  async delete(a: MonitorAssignment): Promise<boolean> {
    const ok = await this.dialogs.confirm({
      title: `Delete assignment ${a.id}?`,
      message: a.reportId ? `Linked report ${a.reportId} will be kept but unlinked from this assignment.` : 'This cannot be undone.',
      confirmText: 'Delete assignment',
      tone: 'danger',
    });
    if (!ok) return false;
    this.assignments.delete(a.id);
    this.toast.success(`Assignment ${a.id} deleted.`);
    return true;
  }
}
