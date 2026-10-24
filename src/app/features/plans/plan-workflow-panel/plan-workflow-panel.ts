import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/auth/auth.service';
import { MonitoringPlan } from '../../../core/models';
import { DialogService } from '../../../core/services/dialog.service';
import { EmailService } from '../../../core/services/email.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { FormField } from '../../../shared/ui/form-field';
import { Modal } from '../../../shared/ui/modal';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { ApprovalHistory } from '../../../shared/ui/timeline';
import { emailListValidator, splitEmails } from '../../../shared/validators';

const STAGES = ['Prepared by PM', 'Reviewed & approved by HOD', 'Approved by Sponsor'];

/** Review / approval workflow for a monitoring plan: PM review → HOD approval → sponsor review & sign-off. */
@Component({
  selector: 'app-plan-workflow-panel',
  imports: [Icon, StatusBadge, ApprovalHistory, Modal, ReactiveFormsModule, FormField],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './plan-workflow-panel.html',
})
export class PlanWorkflowPanel {
  private readonly plans = inject(MonitoringPlanService);
  private readonly projects = inject(ProjectService);
  private readonly users = inject(UserDirectoryService);
  private readonly dialogs = inject(DialogService);
  private readonly email = inject(EmailService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly plan = input.required<MonitoringPlan>();
  /** Set by the wizard when the form has unsaved edits. */
  readonly disabledReason = input('');

  protected readonly stages = STAGES;
  protected readonly actions = computed(() => this.plans.actions(this.plan()));
  protected readonly noActions = computed(() => !Object.entries(this.actions()).some(([k, v]) => v && k !== 'edit' && k !== 'delete'));
  protected readonly reversedReviews = computed(() => [...this.plan().reviews].reverse());
  protected readonly sharing = signal(false);
  /** The To/CC modal serves both "Share with sponsor for review" and "Direct sign". */
  protected readonly shareMode = signal<'review' | 'direct'>('review');
  protected readonly shareForm = this.fb.nonNullable.group({ to: ['', [Validators.required, emailListValidator]], cc: ['', emailListValidator] });

  stageDone(i: number): boolean {
    const p = this.plan();
    if (i === 0) return ['Final Saved', 'Pending HOD Approval', 'HOD Approved', 'Approved'].includes(p.status);
    if (i === 1) return p.status === 'HOD Approved' || p.status === 'Approved';
    return p.sponsorReview === 'Approved';
  }

  async submitForPmReview(): Promise<void> {
    if (!(await this.dialogs.confirm({ title: 'Submit for PM review?', message: 'The plan will move to "In PM Review". You can still modify it during PM review.', confirmText: 'Submit' }))) return;
    this.run(() => this.plans.submitForPmReview(this.plan().id), 'Plan submitted for PM review.');
  }

  async pmFinalSave(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Final save by Project Manager', label: 'Reviewer comments (optional)', confirmText: 'Continue to sign' });
    if (comment === null) return;
    const sig = await this.sign('Prepared by Project Manager', 'I confirm I have reviewed this monitoring plan and it is ready for HOD review.');
    if (!sig) return;
    this.run(() => this.plans.pmFinalSave(this.plan().id, comment, sig), 'Plan final saved. Share it with the sponsor, or use Direct sign — that step emails them a link to review the project.');
  }

  async pmReturn(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Return plan for rework', label: 'Reason / reviewer comments', required: true, confirmText: 'Return', tone: 'danger' });
    if (comment) this.run(() => this.plans.pmReturn(this.plan().id, comment), 'Plan returned for rework.');
  }

  async hodApprove(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'HOD approval', label: 'Comments (optional)', confirmText: 'Continue to sign' });
    if (comment === null) return;
    const sig = await this.sign('Reviewed and approved by Head of Department', 'I have reviewed and approve this monitoring plan.');
    if (!sig) return;
    this.run(() => this.plans.hodApprove(this.plan().id, comment, sig), 'Plan approved.');
  }

  async hodReject(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Reject plan', label: 'Reason for rejection', required: true, confirmText: 'Reject', tone: 'danger' });
    if (comment) this.run(() => this.plans.hodReject(this.plan().id, comment), 'Plan rejected and returned to the PM.');
  }

  openShare(mode: 'review' | 'direct' = 'review'): void {
    this.shareMode.set(mode);
    const p = this.plan();
    const project = this.projects.get(p.projectId);
    const to = p.sponsorTo || [project?.sponsor.email, ...this.users.sponsorUsers(project?.sponsor.name ?? '').map(u => u.email)].filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i).join(', ');
    this.shareForm.reset({ to, cc: p.sponsorCc || this.auth.user()?.email || '' });
    this.sharing.set(true);
  }

  async share(): Promise<void> {
    this.shareForm.markAllAsTouched();
    if (this.shareForm.invalid) return;
    const { to, cc } = this.shareForm.getRawValue();
    const p = this.plan();
    this.sharing.set(false);
    if (this.shareMode() === 'direct') {
      const sig = await this.sign('Direct sign — prepared by Project Manager', 'I confirm this monitoring plan is ready for HOD approval and sponsor signature.');
      if (sig) this.run(() => this.plans.directSign(p.id, to, cc, sig), 'Plan signed. The HOD has a simulated email with a link to review the project.');
      return;
    }
    const sent = await this.email.preview(this.plans.reviewEmailDraft(p, 'sponsor', splitEmails(to), splitEmails(cc)));
    if (sent) this.run(() => this.plans.sendToSponsor(p.id, to, cc), 'Plan shared with sponsor for review.');
  }

  async pmRespond(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Respond to sponsor comments', message: 'Edit the plan as needed, then resubmit it to the sponsor.', label: 'Response', required: true });
    if (comment) this.run(() => this.plans.pmRespond(this.plan().id, comment), 'Response recorded.');
  }

  async sponsorApprove(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Sponsor approval', label: 'Feedback (optional)', confirmText: 'Continue to sign' });
    if (comment === null) return;
    const sig = await this.sign('Approved by Sponsor — sign off', 'On behalf of the sponsor, I approve this monitoring plan.');
    if (!sig) return;
    this.run(() => this.plans.sponsorApprove(this.plan().id, comment, sig), 'Plan approved and signed off.');
  }

  async sponsorSign(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Sponsor sign-off', label: 'Comments (optional)', confirmText: 'Continue to sign' });
    if (comment === null) return;
    const sig = await this.sign('Approved by Sponsor — sign off', 'On behalf of the sponsor, I approve and sign off this monitoring plan.');
    if (!sig) return;
    this.run(() => this.plans.sponsorSign(this.plan().id, comment, sig), 'Plan signed off and approved.');
  }

  async sponsorChanges(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Request changes', label: 'Sponsor feedback', required: true, confirmText: 'Send feedback' });
    if (comment) this.run(() => this.plans.sponsorRequestChanges(this.plan().id, comment), 'Feedback sent to the Project Manager.');
  }

  private sign(title: string, statement: string) {
    const u = this.auth.user()!;
    return this.dialogs.sign({ title, statement, signerId: u.id, signerName: u.name });
  }

  private run(fn: () => void, message: string): void {
    try {
      fn();
      this.toast.success(message);
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
