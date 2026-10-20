import { Injectable, computed, inject } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { DemoRoleService } from '../auth/demo-role.service';
import { DUTIES_BY_BLINDING, REQUIRED_DUTIES } from '../config/domain.config';
import { DataStore } from '../data/data-store.service';
import { Acknowledgement, Blinding, DelegatedMonitor, Delegation, MonitorDuty, SimSignature } from '../models';
import { ActivityService } from './activity.service';
import { NotificationService } from './notification.service';
import { UserDirectoryService } from './user-directory.service';

export type DelegationInput = Pick<
  Delegation,
  | 'projectId'
  | 'planId'
  | 'protocolVersionDetails'
  | 'meetingDate'
  | 'startTime'
  | 'endTime'
  | 'attendees'
  | 'conductedBy'
  | 'discussionDetails'
  | 'delegatedResponsibilities'
  | 'notes'
  | 'monitors'
>;

export interface AckProgress {
  acknowledged: number;
  declined: number;
  pending: number;
  notSent: number;
  total: number;
  percent: number;
  complete: boolean;
}

@Injectable({ providedIn: 'root' })
export class DelegationService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(DemoRoleService);
  private readonly scope = inject(AccessScopeService);
  private readonly activity = inject(ActivityService);
  private readonly notifications = inject(NotificationService);
  private readonly users = inject(UserDirectoryService);

  readonly visible = computed(() => this.data.delegations.items().filter(d => this.scope.delegation(d)));

  get(id: string | null | undefined): Delegation | undefined {
    return id ? this.data.delegations.get(id) : undefined;
  }

  getVisible(id: string | null | undefined): Delegation | undefined {
    const d = this.get(id);
    return d && this.scope.delegation(d) ? d : undefined;
  }

  forProject(projectId: string): Delegation[] {
    return this.visible().filter(d => d.projectId === projectId);
  }

  dutiesFor(blinding: Blinding): MonitorDuty[] {
    return DUTIES_BY_BLINDING[blinding];
  }

  isRequired(duty: MonitorDuty): boolean {
    return REQUIRED_DUTIES.includes(duty);
  }

  progress(d: Delegation): AckProgress {
    const count = (s: Acknowledgement['state']) => d.acknowledgements.filter(a => a.state === s).length;
    const total = d.acknowledgements.length;
    const acknowledged = count('Acknowledged');
    return {
      acknowledged,
      declined: count('Declined'),
      pending: count('Pending'),
      notSent: count('Not Sent'),
      total,
      percent: total ? Math.round((acknowledged / total) * 100) : 0,
      complete: total > 0 && acknowledged === total,
    };
  }

  myAcknowledgement(d: Delegation): Acknowledgement | undefined {
    const me = this.auth.user()?.id;
    return d.acknowledgements.find(a => a.monitorId === me);
  }

  /* ---------- CRUD ---------- */

  create(input: DelegationInput): Delegation {
    const u = this.auth.user();
    const now = new Date().toISOString();
    const d = this.data.delegations.insert({
      ...input,
      monitors: this.cleanMonitors(input.monitors),
      id: this.data.nextId('DEL', this.data.delegations),
      acknowledgements: this.buildAcks(this.cleanMonitors(input.monitors), []),
      authorization: 'Not Requested',
      authorizationRequestedAt: null,
      authorizationSignature: null,
      authorizationComment: '',
      history: [this.entry('Delegation record created')],
      createdById: u?.id ?? 'SYSTEM',
      createdAt: now,
      updatedAt: now,
    });
    this.activity.log('Created', 'Delegation', d.id, d.projectId, `Delegation ${d.id} created`);
    return d;
  }

  /** Re-uses acknowledgements for monitors whose duties are unchanged; changed monitors must acknowledge again. */
  update(id: string, input: DelegationInput): Delegation | undefined {
    const before = this.get(id);
    if (!before) return undefined;
    const monitors = this.cleanMonitors(input.monitors);
    const acknowledgements = this.buildAcks(monitors, before.acknowledgements);
    const changed = JSON.stringify(acknowledgements.map(a => [a.monitorId, a.duties])) !== JSON.stringify(before.acknowledgements.map(a => [a.monitorId, a.duties]));
    const resetAuth = changed && before.authorization !== 'Not Requested';
    const d = this.data.delegations.update(id, {
      ...input,
      monitors,
      acknowledgements,
      ...(resetAuth ? { authorization: 'Not Requested' as const, authorizationRequestedAt: null, authorizationSignature: null, authorizationComment: '' } : {}),
      history: [...before.history, this.entry(changed ? 'Delegation updated — monitor assignments changed' : 'Delegation updated')],
    });
    this.activity.log('Updated', 'Delegation', id, input.projectId, `Delegation ${id} updated${resetAuth ? ' (authorization reset)' : ''}`);
    return d;
  }

  delete(id: string): void {
    const d = this.get(id);
    if (!d) return;
    this.data.delegations.remove(id);
    this.activity.log('Deleted', 'Delegation', id, d.projectId, `Delegation ${id} deleted`);
  }

  /* ---------- Acknowledgement workflow ---------- */

  canManage(): boolean {
    return this.roles.can('delegation.manage');
  }

  /** Monitors who have not yet been notified (or were reassigned after declining). */
  unsentMonitorIds(d: Delegation): string[] {
    return d.acknowledgements.filter(a => a.state === 'Not Sent').map(a => a.monitorId);
  }

  markNotified(id: string): number {
    const d = this.require(id);
    const now = new Date().toISOString();
    const targets = this.unsentMonitorIds(d);
    if (!targets.length) return 0;
    const acknowledgements = d.acknowledgements.map(a => (a.state === 'Not Sent' ? { ...a, state: 'Pending' as const, notifiedAt: now } : a));
    this.data.delegations.update(id, { acknowledgements, history: [...d.history, this.entry(`Notifications sent to ${targets.length} monitor(s)`)] });
    for (const a of acknowledgements.filter(x => targets.includes(x.monitorId))) {
      this.notifications.notify({
        key: `del-${id}-ack-${a.monitorId}-${a.duties.join('+')}`,
        recipientIds: [a.monitorId],
        title: 'Monitor acknowledgement pending',
        message: `You were delegated as ${a.duties.join(', ')} monitor on ${id} (${this.projectName(d.projectId)}). Please acknowledge and sign.`,
        link: `/delegations/${id}`,
      });
    }
    this.activity.log('Notified', 'Delegation', id, d.projectId, `Acknowledgement requests sent for ${id} to ${targets.map(t => this.users.name(t)).join(', ')}`);
    return targets.length;
  }

  acknowledge(id: string, monitorId: string, signature: SimSignature): void {
    const d = this.require(id);
    const now = new Date().toISOString();
    const acknowledgements = d.acknowledgements.map(a =>
      a.monitorId === monitorId ? { ...a, state: 'Acknowledged' as const, respondedAt: now, signature, declineReason: '' } : a,
    );
    const ack = acknowledgements.find(a => a.monitorId === monitorId);
    const history = [...d.history, this.entry(`${this.users.name(monitorId)} acknowledged (${ack?.duties.join(', ')}) with simulated signature`)];
    const allDone = acknowledgements.length > 0 && acknowledgements.every(a => a.state === 'Acknowledged');
    if (allDone) history.push({ at: now, byId: 'SYSTEM', byName: 'System', text: 'All required acknowledgements completed' });
    this.data.delegations.update(id, { acknowledgements, history });
    this.activity.log('Acknowledged', 'Delegation', id, d.projectId, `${this.users.name(monitorId)} acknowledged ${id}`);
    if (allDone) {
      this.notifications.notify({
        key: `del-${id}-allack-${acknowledgements.map(a => a.respondedAt).join('|')}`,
        recipientIds: this.pmRecipients(d),
        title: 'All delegation acknowledgements completed',
        message: `${id} (${this.projectName(d.projectId)}) is ready for HOD/VP authorization.`,
        link: `/delegations/${id}`,
      });
    }
  }

  decline(id: string, monitorId: string, reason: string): void {
    const d = this.require(id);
    const now = new Date().toISOString();
    const acknowledgements = d.acknowledgements.map(a =>
      a.monitorId === monitorId ? { ...a, state: 'Declined' as const, respondedAt: now, signature: null, declineReason: reason } : a,
    );
    this.data.delegations.update(id, { acknowledgements, history: [...d.history, this.entry(`${this.users.name(monitorId)} declined: ${reason}`)] });
    this.activity.log('Declined', 'Delegation', id, d.projectId, `${this.users.name(monitorId)} declined ${id}`);
    this.notifications.notify({
      key: `del-${id}-decline-${monitorId}-${now}`,
      recipientIds: this.pmRecipients(d),
      title: 'Delegation declined',
      message: `${this.users.name(monitorId)} declined their duty on ${id}. Reassign the monitor to continue.`,
      link: `/delegations/${id}`,
    });
  }

  canRequestAuthorization(d: Delegation): boolean {
    return this.roles.can('delegation.requestAuthorization') && this.progress(d).complete && (d.authorization === 'Not Requested' || d.authorization === 'Rejected');
  }

  requestAuthorization(id: string): void {
    const d = this.require(id);
    if (!this.progress(d).complete) throw new Error('All monitors must acknowledge before requesting authorization.');
    const now = new Date().toISOString();
    this.data.delegations.update(id, {
      authorization: 'Pending',
      authorizationRequestedAt: now,
      authorizationComment: '',
      history: [...d.history, this.entry('HOD/VP authorization initiated')],
    });
    this.activity.log('Authorization requested', 'Delegation', id, d.projectId, `HOD/VP authorization initiated for ${id}`);
    this.notifications.notify({
      key: `del-${id}-authreq-${now}`,
      recipientIds: this.users.approvers().map(u => u.id),
      title: 'HOD/VP authorization requested',
      message: `${id} (${this.projectName(d.projectId)}) — all delegated monitors have acknowledged.`,
      link: `/delegations/${id}`,
    });
  }

  canAuthorize(d: Delegation): boolean {
    return this.roles.can('delegation.authorize') && d.authorization === 'Pending';
  }

  authorize(id: string, signature: SimSignature, comment: string): void {
    const d = this.require(id);
    this.data.delegations.update(id, {
      authorization: 'Authorized',
      authorizationSignature: signature,
      authorizationComment: comment,
      history: [...d.history, this.entry(`Delegation authorized by ${signature.typedName} (simulated signature)`)],
    });
    this.activity.log('Authorized', 'Delegation', id, d.projectId, `Delegation ${id} authorized`);
    this.notifications.notify({
      key: `del-${id}-authok-${signature.at}`,
      recipientIds: this.pmRecipients(d),
      title: 'Delegation authorized',
      message: `${id} was authorized by ${this.auth.user()?.name}.`,
      link: `/delegations/${id}`,
    });
  }

  rejectAuthorization(id: string, comment: string): void {
    const d = this.require(id);
    const now = new Date().toISOString();
    this.data.delegations.update(id, {
      authorization: 'Rejected',
      authorizationComment: comment,
      history: [...d.history, this.entry(`Authorization rejected: ${comment}`)],
    });
    this.activity.log('Authorization rejected', 'Delegation', id, d.projectId, `Delegation ${id} authorization rejected`);
    this.notifications.notify({
      key: `del-${id}-authno-${now}`,
      recipientIds: this.pmRecipients(d),
      title: 'Delegation authorization rejected',
      message: `${id}: ${comment}`,
      link: `/delegations/${id}`,
    });
  }

  /* ---------- helpers ---------- */

  private cleanMonitors(monitors: DelegatedMonitor[]): DelegatedMonitor[] {
    return monitors.filter(m => !!m.monitorId);
  }

  private buildAcks(monitors: DelegatedMonitor[], previous: Acknowledgement[]): Acknowledgement[] {
    const byMonitor = new Map<string, MonitorDuty[]>();
    monitors.forEach(m => byMonitor.set(m.monitorId, [...(byMonitor.get(m.monitorId) ?? []), m.duty]));
    return [...byMonitor.entries()].map(([monitorId, duties]) => {
      const prev = previous.find(p => p.monitorId === monitorId);
      if (prev && prev.duties.join('|') === duties.join('|') && prev.state !== 'Declined') return prev;
      return { monitorId, duties, state: 'Not Sent', notifiedAt: null, respondedAt: null, signature: null, declineReason: '' };
    });
  }

  private pmRecipients(d: Delegation): string[] {
    const project = this.data.projects.get(d.projectId);
    return [...d.conductedBy.map(c => c.userId), project?.projectManagerId ?? '', d.createdById].filter(id => this.users.get(id)?.role === 'Project Manager');
  }

  private projectName(projectId: string): string {
    return this.data.projects.get(projectId)?.name ?? projectId;
  }

  private entry(text: string) {
    const u = this.auth.user();
    return { at: new Date().toISOString(), byId: u?.id ?? 'SYSTEM', byName: u?.name ?? 'System', text };
  }

  private require(id: string): Delegation {
    const d = this.get(id);
    if (!d) throw new Error(`Delegation ${id} not found.`);
    return d;
  }
}
