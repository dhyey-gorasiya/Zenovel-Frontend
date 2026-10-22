import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { BLINDING_DESCRIPTIONS, BLINDING_TYPES, DUTY_GROUPS, isBlindedDuty, isUnblindedDuty } from '../../../core/config/domain.config';
import { Acknowledgement, MonitorDuty } from '../../../core/models';
import { DelegationService } from '../../../core/services/delegation.service';
import { DialogService } from '../../../core/services/dialog.service';
import { EmailService } from '../../../core/services/email.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { PartyDetails } from '../../../shared/ui/party-details';
import { SheetRow } from '../../../shared/ui/sheet-row';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { ActivityTimeline } from '../../../shared/ui/timeline';

@Component({
  imports: [RouterLink, Icon, StatusBadge, ErrorState, ActivityTimeline, DatePipe, SheetRow, PartyDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delegation-detail.html',
})
export class DelegationDetail {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly email = inject(EmailService);
  private readonly toast = inject(ToastService);
  protected readonly roles = inject(DemoRoleService);
  protected readonly delegations = inject(DelegationService);
  protected readonly projects = inject(ProjectService);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly users = inject(UserDirectoryService);

  readonly id = input.required<string>();
  protected readonly authorizeChecked = signal(false);
  protected readonly isBlinded = isBlindedDuty;
  protected readonly isUnblinded = isUnblindedDuty;
  protected readonly blindingTypes = BLINDING_TYPES;
  protected readonly blindingDescriptions = BLINDING_DESCRIPTIONS;
  protected readonly dutyGroups = DUTY_GROUPS;

  protected readonly delegation = computed(() => this.delegations.getVisible(this.id()));
  protected readonly project = computed(() => this.projects.get(this.delegation()?.projectId));
  protected readonly plan = computed(() => this.plans.get(this.delegation()?.planId));
  protected readonly duties = computed<MonitorDuty[]>(() => (this.project() ? this.delegations.dutiesFor(this.project()!.blinding) : []));
  protected readonly progress = computed(() => (this.delegation() ? this.delegations.progress(this.delegation()!) : null));
  protected readonly unsent = computed(() => (this.delegation() ? this.delegations.unsentMonitorIds(this.delegation()!) : []));
  protected readonly myAck = computed(() => (this.delegation() && this.roles.can('delegation.acknowledge') ? this.delegations.myAcknowledgement(this.delegation()!) : undefined));
  protected readonly canRequestAuth = computed(() => !!this.delegation() && this.delegations.canRequestAuthorization(this.delegation()!));
  protected readonly canAuthorize = computed(() => !!this.delegation() && this.delegations.canAuthorize(this.delegation()!));
  protected readonly history = computed(() => [...(this.delegation()?.history ?? [])].reverse().map(h => ({ at: h.at, title: h.text, subtitle: h.byName })));

  async sendNotifications(): Promise<void> {
    const d = this.delegation()!;
    const p = this.project();
    const acks = d.acknowledgements.filter(a => this.unsent().includes(a.monitorId));
    const sent = await this.email.preview({
      to: acks.map(a => this.users.email(a.monitorId)),
      cc: [this.auth.user()?.email ?? ''].filter(Boolean),
      subject: `Delegation of monitoring responsibilities — ${p?.name} (${d.id})`,
      body:
        `Dear monitor(s),\n\nYou have been delegated monitoring responsibilities for ${p?.name} (protocol ${p?.protocolNo}):\n` +
        acks.map(a => `  • ${this.users.name(a.monitorId)} — ${a.duties.join(', ')}`).join('\n') +
        `\n\nPlease sign in to Zenovel, open ${d.id} and acknowledge the delegation with your signature.\n\nRegards,\n${this.auth.user()?.name}`,
      projectId: d.projectId,
      entityType: 'Delegation',
      entityId: d.id,
      link: `/delegations/${d.id}`,
    });
    if (!sent) return;
    const n = this.delegations.markNotified(d.id);
    this.toast.success(`Acknowledgement requests sent to ${n} monitor(s).`);
  }

  async acknowledge(a: Acknowledgement): Promise<void> {
    const u = this.auth.user()!;
    const sig = await this.dialogs.sign({
      title: 'Acknowledge delegation',
      statement: `I acknowledge my delegated duty as ${a.duties.join(', ')} monitor for ${this.delegation()!.id} and confirm I attended the training.`,
      signerId: u.id,
      signerName: u.name,
      confirmText: 'Acknowledge & sign (simulated)',
    });
    if (!sig) return;
    this.delegations.acknowledge(this.delegation()!.id, a.monitorId, sig);
    this.toast.success('Acknowledgement recorded.');
  }

  async decline(a: Acknowledgement): Promise<void> {
    const reason = await this.dialogs.prompt({ title: 'Decline delegation', label: 'Reason', required: true, confirmText: 'Decline', tone: 'danger' });
    if (!reason) return;
    this.delegations.decline(this.delegation()!.id, a.monitorId, reason);
    this.toast.info('Declined. The Project Manager has been notified.');
  }

  async requestAuthorization(): Promise<void> {
    if (!this.authorizeChecked()) return;
    const ok = await this.dialogs.confirm({ title: 'Initiate HOD/VP authorization?', message: 'All HOD/VP users will be notified to authorize this delegation.', confirmText: 'Initiate authorization' });
    if (!ok) return;
    this.delegations.requestAuthorization(this.delegation()!.id);
    this.authorizeChecked.set(false);
    this.toast.success('Authorization requested from HOD/VP.');
  }

  async authorize(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Authorize delegation', label: 'Comments (optional)', confirmText: 'Continue to sign' });
    if (comment === null) return;
    const u = this.auth.user()!;
    const sig = await this.dialogs.sign({ title: 'Delegated monitor authorization', statement: 'As Head of Department / VP, I authorize the delegated monitors for this study.', signerId: u.id, signerName: u.name, confirmText: 'Authorize & sign (simulated)' });
    if (!sig) return;
    this.delegations.authorize(this.delegation()!.id, sig, comment);
    this.toast.success('Delegation authorized.');
  }

  async rejectAuthorization(): Promise<void> {
    const comment = await this.dialogs.prompt({ title: 'Reject authorization', label: 'Reason', required: true, confirmText: 'Reject', tone: 'danger' });
    if (!comment) return;
    this.delegations.rejectAuthorization(this.delegation()!.id, comment);
    this.toast.info('Authorization rejected. The Project Manager has been notified.');
  }

  async remove(): Promise<void> {
    const d = this.delegation()!;
    const ok = await this.dialogs.confirm({ title: `Delete ${d.id}?`, message: 'The delegation record, its acknowledgements and authorization history will be permanently deleted.', confirmText: 'Delete', tone: 'danger' });
    if (!ok) return;
    this.delegations.delete(d.id);
    this.toast.success(`Delegation ${d.id} deleted.`);
    this.router.navigateByUrl('/delegations');
  }
}
