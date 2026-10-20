import { Injectable, computed, inject } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { DemoRoleService } from '../auth/demo-role.service';
import { DataStore } from '../data/data-store.service';
import { EmailDraft, MonitorAssignment } from '../models';
import { ActivityService } from './activity.service';
import { NotificationService } from './notification.service';
import { UserDirectoryService } from './user-directory.service';

export type AssignmentInput = Pick<MonitorAssignment, 'projectId' | 'visitType' | 'monitorId' | 'visitDate' | 'planId' | 'reportId' | 'notes' | 'status'>;

export interface AssignmentActions {
  edit: boolean;
  delete: boolean;
  notify: boolean;
  acknowledge: boolean;
  startReport: boolean;
}

@Injectable({ providedIn: 'root' })
export class MonitorAssignmentService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(DemoRoleService);
  private readonly scope = inject(AccessScopeService);
  private readonly activity = inject(ActivityService);
  private readonly notifications = inject(NotificationService);
  private readonly users = inject(UserDirectoryService);

  readonly visible = computed(() => this.data.assignments.items().filter(a => this.scope.assignment(a)));

  get(id: string | null | undefined): MonitorAssignment | undefined {
    return id ? this.data.assignments.get(id) : undefined;
  }

  getVisible(id: string | null | undefined): MonitorAssignment | undefined {
    const a = this.get(id);
    return a && this.scope.assignment(a) ? a : undefined;
  }

  forProject(projectId: string): MonitorAssignment[] {
    return this.visible().filter(a => a.projectId === projectId);
  }

  isUpcoming(a: MonitorAssignment): boolean {
    return a.visitDate >= new Date().toISOString().slice(0, 10) && a.status !== 'Completed' && a.status !== 'Cancelled';
  }

  actions(a: MonitorAssignment): AssignmentActions {
    const me = this.auth.user()?.id;
    const manage = this.roles.can('assignment.manage');
    const open = a.status !== 'Completed' && a.status !== 'Cancelled';
    return {
      edit: manage,
      delete: manage,
      notify: manage && open,
      acknowledge: this.roles.can('assignment.acknowledge') && (a.status === 'Planned' || a.status === 'Notified') && (manage || a.monitorId === me),
      startReport: this.roles.can('report.prepare') && a.monitorId === me && !a.reportId && a.status !== 'Cancelled',
    };
  }

  create(input: AssignmentInput): MonitorAssignment {
    const now = new Date().toISOString();
    const a = this.data.assignments.insert({
      ...input,
      monitorEmail: this.users.email(input.monitorId),
      id: this.data.nextId('ASG', this.data.assignments),
      notifiedAt: null,
      acknowledgedAt: null,
      history: [this.entry(`Assignment created for ${this.users.name(input.monitorId)}`)],
      createdById: this.auth.user()?.id ?? 'SYSTEM',
      createdAt: now,
      updatedAt: now,
    });
    this.syncReportLink(a.id, null, a.reportId);
    this.activity.log('Created', 'Assignment', a.id, a.projectId, `Assignment ${a.id} (${a.visitType}) created for ${this.users.name(a.monitorId)}`);
    return a;
  }

  update(id: string, input: AssignmentInput): MonitorAssignment | undefined {
    const before = this.get(id);
    if (!before) return undefined;
    const monitorChanged = before.monitorId !== input.monitorId;
    const a = this.data.assignments.update(id, {
      ...input,
      monitorEmail: this.users.email(input.monitorId),
      ...(monitorChanged && input.status !== 'Completed' && input.status !== 'Cancelled' ? { status: 'Planned' as const, notifiedAt: null, acknowledgedAt: null } : {}),
      history: [...before.history, this.entry(monitorChanged ? `Monitor changed to ${this.users.name(input.monitorId)}` : 'Assignment updated')],
    });
    this.syncReportLink(id, before.reportId, input.reportId);
    this.activity.log('Updated', 'Assignment', id, input.projectId, `Assignment ${id} updated`);
    return a;
  }

  delete(id: string): void {
    const a = this.get(id);
    if (!a) return;
    this.syncReportLink(id, a.reportId, null);
    this.data.assignments.remove(id);
    this.activity.log('Deleted', 'Assignment', id, a.projectId, `Assignment ${id} deleted`);
  }

  emailDraft(a: MonitorAssignment): EmailDraft {
    const project = this.data.projects.get(a.projectId);
    const monitor = this.users.get(a.monitorId);
    return {
      to: [a.monitorEmail],
      cc: [this.auth.user()?.email ?? ''].filter(Boolean),
      subject: `Monitoring visit assigned: ${a.visitType} — ${project?.name ?? a.projectId}`,
      body:
        `Dear ${monitor?.name ?? 'Monitor'},\n\n` +
        `You have been assigned to the ${a.visitType} monitoring visit for ${project?.name} (Protocol ${project?.protocolNo}) on ${a.visitDate}.\n\n` +
        `Open assignment ${a.id} in Zenovel to acknowledge it and access the monitoring report for preparation.\n\n` +
        `Regards,\n${this.auth.user()?.name ?? 'Project Manager'}`,
      projectId: a.projectId,
      entityType: 'Assignment',
      entityId: a.id,
      link: `/assignments/${a.id}`,
    };
  }

  /** Called after the simulated email is "sent": notifies the monitor with a link to the assignment/report. */
  markNotified(id: string): void {
    const a = this.require(id);
    const now = new Date().toISOString();
    this.data.assignments.update(id, {
      status: a.status === 'Planned' ? 'Notified' : a.status,
      notifiedAt: now,
      history: [...a.history, this.entry(`Simulated email notification sent to ${a.monitorEmail}`)],
    });
    this.notifications.notify({
      key: `asg-${id}-assigned-${a.monitorId}-${a.visitDate}`,
      recipientIds: [a.monitorId],
      title: 'Monitoring visit assigned',
      message: `${a.visitType} for ${this.projectName(a.projectId)} on ${a.visitDate}. You can now prepare the monitoring report.`,
      link: `/assignments/${id}`,
    });
  }

  acknowledge(id: string): void {
    const a = this.require(id);
    const me = this.auth.user();
    const now = new Date().toISOString();
    const onBehalf = me?.id !== a.monitorId;
    this.data.assignments.update(id, {
      status: 'Acknowledged',
      acknowledgedAt: now,
      history: [...a.history, this.entry(onBehalf ? `Marked acknowledged by ${me?.name} on behalf of ${this.users.name(a.monitorId)}` : 'Acknowledged by monitor')],
    });
    this.activity.log('Acknowledged', 'Assignment', id, a.projectId, `Assignment ${id} acknowledged`);
    const project = this.data.projects.get(a.projectId);
    this.notifications.notify({
      key: `asg-${id}-ack-${a.monitorId}`,
      recipientIds: [project?.projectManagerId ?? '', a.createdById].filter(x => x !== me?.id),
      title: 'Assignment acknowledged',
      message: `${this.users.name(a.monitorId)} acknowledged ${a.visitType} (${id}).`,
      link: `/assignments/${id}`,
    });
  }

  /** Keeps report.assignmentId consistent with assignment.reportId. */
  private syncReportLink(assignmentId: string, oldReportId: string | null, newReportId: string | null): void {
    if (oldReportId === newReportId) return;
    if (oldReportId && this.data.reports.get(oldReportId)?.assignmentId === assignmentId) this.data.reports.update(oldReportId, { assignmentId: null });
    if (newReportId) {
      const other = this.data.assignments.items().find(x => x.id !== assignmentId && x.reportId === newReportId);
      if (other) this.data.assignments.update(other.id, { reportId: null });
      this.data.reports.update(newReportId, { assignmentId });
    }
  }

  private projectName(projectId: string): string {
    return this.data.projects.get(projectId)?.name ?? projectId;
  }

  private entry(text: string) {
    const u = this.auth.user();
    return { at: new Date().toISOString(), byId: u?.id ?? 'SYSTEM', byName: u?.name ?? 'System', text };
  }

  private require(id: string): MonitorAssignment {
    const a = this.get(id);
    if (!a) throw new Error(`Assignment ${id} not found.`);
    return a;
  }
}
