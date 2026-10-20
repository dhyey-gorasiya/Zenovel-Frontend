import { Injectable, computed, inject } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { DemoRoleService } from '../auth/demo-role.service';
import { DataStore } from '../data/data-store.service';
import { MonitoringReport, ReportContent } from '../models';
import { ActivityService } from './activity.service';
import { NotificationService } from './notification.service';
import { UserDirectoryService } from './user-directory.service';

export type ReportInput = Pick<MonitoringReport, 'projectId' | 'planId' | 'assignmentId' | 'visitType' | 'visitDate' | 'monitorId'> & ReportContent;

export interface ReportActions {
  edit: boolean;
  delete: boolean;
  submit: boolean;
  review: boolean;
}

/**
 * Provisional Monitoring Report workflow (Draft → In Review → Changes Requested / Approved).
 * The client has not confirmed the report specification; adjust once requirements are final.
 */
@Injectable({ providedIn: 'root' })
export class MonitoringReportService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(DemoRoleService);
  private readonly scope = inject(AccessScopeService);
  private readonly activity = inject(ActivityService);
  private readonly notifications = inject(NotificationService);
  private readonly users = inject(UserDirectoryService);

  readonly visible = computed(() => this.data.reports.items().filter(r => this.scope.report(r)));

  get(id: string | null | undefined): MonitoringReport | undefined {
    return id ? this.data.reports.get(id) : undefined;
  }

  getVisible(id: string | null | undefined): MonitoringReport | undefined {
    const r = this.get(id);
    return r && this.scope.report(r) ? r : undefined;
  }

  forProject(projectId: string): MonitoringReport[] {
    return this.visible().filter(r => r.projectId === projectId);
  }

  actions(r: MonitoringReport): ReportActions {
    const me = this.auth.user()?.id;
    const owner = this.roles.can('report.prepare') && r.monitorId === me;
    const editable = r.status === 'Draft' || r.status === 'Changes Requested';
    return {
      edit: owner && editable,
      delete: this.roles.can('report.delete') || (owner && r.status === 'Draft'),
      submit: owner && editable,
      review: this.roles.can('report.review') && r.status === 'In Review',
    };
  }

  /** Assignments the current monitor can start a new report from (no report linked yet). */
  readonly startableAssignments = computed(() => {
    const me = this.auth.user()?.id;
    return this.data.assignments.items().filter(a => a.monitorId === me && !a.reportId && a.status !== 'Cancelled');
  });

  create(input: ReportInput): MonitoringReport {
    const u = this.auth.user();
    const now = new Date().toISOString();
    const r = this.data.reports.insert({
      ...input,
      id: this.data.nextId('RPT', this.data.reports),
      status: 'Draft',
      version: 1,
      reviews: [],
      versions: [],
      createdById: u?.id ?? 'SYSTEM',
      createdAt: now,
      updatedAt: now,
    });
    if (r.assignmentId) this.data.assignments.update(r.assignmentId, { reportId: r.id });
    this.activity.log('Created', 'Report', r.id, r.projectId, `Monitoring Report ${r.id} created (draft)`);
    return r;
  }

  update(id: string, input: ReportInput): MonitoringReport | undefined {
    const before = this.get(id);
    if (!before) return undefined;
    if (before.assignmentId !== input.assignmentId) {
      if (before.assignmentId && this.data.assignments.get(before.assignmentId)?.reportId === id) this.data.assignments.update(before.assignmentId, { reportId: null });
      if (input.assignmentId) this.data.assignments.update(input.assignmentId, { reportId: id });
    }
    const r = this.data.reports.update(id, input);
    this.activity.log('Updated', 'Report', id, input.projectId, `Monitoring Report ${id} draft saved`);
    return r;
  }

  delete(id: string): void {
    const r = this.get(id);
    if (!r) return;
    if (r.assignmentId && this.data.assignments.get(r.assignmentId)?.reportId === id) this.data.assignments.update(r.assignmentId, { reportId: null });
    this.data.reports.remove(id);
    this.activity.log('Deleted', 'Report', id, r.projectId, `Monitoring Report ${id} deleted`);
  }

  submit(id: string): void {
    const r = this.require(id);
    const version = r.status === 'Changes Requested' ? r.version + 1 : r.version;
    const snapshot = { version, at: new Date().toISOString(), byName: this.auth.user()?.name ?? '', status: 'In Review' as const, note: 'Submitted for review', content: this.content(r) };
    this.data.reports.update(id, { status: 'In Review', version, versions: [...r.versions, snapshot] });
    this.activity.log('Submitted', 'Report', id, r.projectId, `Monitoring Report ${id} v${version} submitted for review`);
    const project = this.data.projects.get(r.projectId);
    this.notifications.notify({
      key: `rpt-${id}-submit-v${version}`,
      recipientIds: [project?.projectManagerId ?? '', project?.backupProjectManagerId ?? ''],
      title: 'Monitoring Report submitted',
      message: `${id} (${r.visitType}, ${project?.name}) v${version} from ${this.users.name(r.monitorId)} is ready for review.`,
      link: `/reports/${id}`,
    });
  }

  approve(id: string, comment: string): void {
    const r = this.require(id);
    this.data.reports.update(id, { status: 'Approved', reviews: [...r.reviews, this.review('Approved', comment)] });
    if (r.assignmentId) {
      const a = this.data.assignments.get(r.assignmentId);
      if (a && a.status !== 'Cancelled') {
        this.data.assignments.update(a.id, { status: 'Completed', history: [...a.history, this.entry(`Completed — linked report ${id} approved`)] });
      }
    }
    this.activity.log('Approved', 'Report', id, r.projectId, `Monitoring Report ${id} approved`);
    this.notifications.notify({
      key: `rpt-${id}-approved-v${r.version}`,
      recipientIds: [r.monitorId],
      title: 'Report approved',
      message: `${id} (${r.visitType}) v${r.version} was approved.`,
      link: `/reports/${id}`,
    });
  }

  requestChanges(id: string, comment: string): void {
    const r = this.require(id);
    this.data.reports.update(id, { status: 'Changes Requested', reviews: [...r.reviews, this.review('Requested changes', comment)] });
    this.activity.log('Requested changes', 'Report', id, r.projectId, `Changes requested on ${id}: ${comment}`);
    this.notifications.notify({
      key: `rpt-${id}-changes-v${r.version}`,
      recipientIds: [r.monitorId],
      title: 'Report changes requested',
      message: `${id}: ${comment}`,
      link: `/reports/${id}`,
    });
  }

  addComment(id: string, comment: string): void {
    const r = this.require(id);
    this.data.reports.update(id, { reviews: [...r.reviews, this.review('Comment', comment)] });
  }

  private content(r: MonitoringReport): ReportContent {
    const { visitSummary, observations, findings, deviations, capa, supportingNotes, conclusion } = r;
    return structuredClone({ visitSummary, observations, findings, deviations, capa, supportingNotes, conclusion });
  }

  private review(action: string, comment: string) {
    const u = this.auth.user();
    return { id: this.data.localId('RV'), at: new Date().toISOString(), byId: u?.id ?? '', byName: u?.name ?? '', role: u?.role ?? 'Project Manager', action, comment };
  }

  private entry(text: string) {
    const u = this.auth.user();
    return { at: new Date().toISOString(), byId: u?.id ?? 'SYSTEM', byName: u?.name ?? 'System', text };
  }

  private require(id: string): MonitoringReport {
    const r = this.get(id);
    if (!r) throw new Error(`Report ${id} not found.`);
    return r;
  }
}
