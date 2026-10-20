import { Injectable, computed, inject } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { DemoRoleService } from '../auth/demo-role.service';
import { DEFAULT_PLAN_VISITS, defaultPlanVisitTypes } from '../config/domain.config';
import { AppSettingsService } from '../data/app-settings.service';
import { DataStore } from '../data/data-store.service';
import { MonitoringPlan, Project, RiskItem, SimSignature } from '../models';
import { ActivityService } from './activity.service';
import { NotificationService } from './notification.service';
import { UserDirectoryService } from './user-directory.service';

export type PlanInput = Omit<
  MonitoringPlan,
  'id' | 'updatedAt' | 'createdAt' | 'createdById' | 'createdByName' | 'status' | 'sponsorReview' | 'reviews' | 'sponsorTo' | 'sponsorCc' | 'version'
>;

export interface PlanActions {
  edit: boolean;
  delete: boolean;
  submitForPmReview: boolean;
  pmFinalSave: boolean;
  pmReturn: boolean;
  hodDecide: boolean;
  sendToSponsor: boolean;
  sponsorDecide: boolean;
  pmRespond: boolean;
}

export type RiskPriority = 'High' | 'Medium' | 'Low';

const bumpMinor = (v: string) => {
  const [major, minor] = v.split('.').map(n => Number(n) || 0);
  return `${major}.${minor + 1}`;
};

@Injectable({ providedIn: 'root' })
export class MonitoringPlanService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(DemoRoleService);
  private readonly scope = inject(AccessScopeService);
  private readonly activity = inject(ActivityService);
  private readonly notifications = inject(NotificationService);
  private readonly users = inject(UserDirectoryService);
  private readonly settings = inject(AppSettingsService);

  readonly visible = computed(() => this.data.plans.items().filter(p => this.scope.plan(p)));

  get(id: string | null | undefined): MonitoringPlan | undefined {
    return id ? this.data.plans.get(id) : undefined;
  }

  getVisible(id: string | null | undefined): MonitoringPlan | undefined {
    const p = this.get(id);
    return p && this.scope.plan(p) ? p : undefined;
  }

  forProject(projectId: string): MonitoringPlan[] {
    return this.visible().filter(p => p.projectId === projectId);
  }

  label(id: string | null | undefined): string {
    const p = this.get(id);
    return p ? `${p.id} (v${p.version})` : '—';
  }

  /* ---------- Risk scoring ---------- */

  /** Risk Priority Number = Severity × Likelihood × Detectability (each 1–5, so 1–125). */
  rpn(r: Pick<RiskItem, 'severity' | 'likelihood' | 'detectability'>): number {
    return (Number(r.severity) || 0) * (Number(r.likelihood) || 0) * (Number(r.detectability) || 0);
  }

  priority(rpn: number): RiskPriority {
    const t = this.settings.riskThresholds();
    return rpn >= t.high ? 'High' : rpn >= t.medium ? 'Medium' : 'Low';
  }

  /* ---------- CRUD ---------- */

  defaults(project?: Project): PlanInput {
    const pmName = this.users.name(project?.projectManagerId);
    return {
      projectId: project?.id ?? '',
      protocolVersionNo: '',
      protocolVersionDate: '',
      amendmentDetails: '',
      regulatoryGuideline: '',
      referenceProductInfo: '',
      sops: [],
      scopeOfWork: project?.scope.monitoringDetails ?? '',
      monitoringApproach: '',
      onsite: true,
      remote: false,
      visitFrequency: '',
      visitDuration: '',
      communicationMethods: '',
      monitoringSchedule: '',
      otherRequirements: '',
      visitPlan: DEFAULT_PLAN_VISITS.map(v => ({ ...v })),
      additionalVisitNote: '',
      visitTypes: defaultPlanVisitTypes(),
      communicationAmongTeam: true,
      communicationWithSponsor: true,
      gradingOfObservations: true,
      contacts: project ? [{ channel: 'Zenovel Project Manager', name: pmName, details: this.users.email(project.projectManagerId) }] : [],
      risks: [],
      protocolSummary: [],
      observationGrading: this.settings.observationGrades().join(' / '),
      reportTimeline: '',
      documentSharing: '',
      archiving: '',
      communicationProcedures: '',
      additionalProcedures: '',
      protocolDocument: project?.protocolDocument ?? null,
      templateDocument: null,
    };
  }

  create(input: PlanInput, submit: boolean): MonitoringPlan {
    const u = this.auth.user();
    const now = new Date().toISOString();
    const plan = this.data.plans.insert({
      ...input,
      id: this.data.nextId('MP', this.data.plans),
      version: '0.1',
      status: 'Draft',
      sponsorReview: 'Not Submitted',
      sponsorTo: '',
      sponsorCc: '',
      reviews: [],
      createdById: u?.id ?? 'SYSTEM',
      createdByName: u?.name ?? 'System',
      createdAt: now,
      updatedAt: now,
    });
    this.activity.log('Created', 'Monitoring Plan', plan.id, plan.projectId, `Monitoring Plan ${plan.id} created as draft`);
    if (submit) this.submitForPmReview(plan.id);
    return this.get(plan.id)!;
  }

  update(id: string, input: PlanInput, submit: boolean): MonitoringPlan | undefined {
    const before = this.get(id);
    if (!before) return undefined;
    const version = before.sponsorReview === 'Changes Requested' ? bumpMinor(before.version) : before.version;
    const updated = this.data.plans.update(id, { ...input, version });
    this.activity.log('Updated', 'Monitoring Plan', id, input.projectId, `Monitoring Plan ${id} updated${version !== before.version ? ` (v${version})` : ''}`);
    if (submit && (before.status === 'Draft' || before.status === 'Rejected')) this.submitForPmReview(id);
    return updated;
  }

  dependents(id: string) {
    return {
      delegations: this.data.delegations.items().filter(d => d.planId === id),
      assignments: this.data.assignments.items().filter(a => a.planId === id),
      reports: this.data.reports.items().filter(r => r.planId === id),
    };
  }

  /** Deletes the plan and its delegation records; assignments/reports keep existing but lose the plan link. */
  delete(id: string): void {
    const p = this.get(id);
    if (!p) return;
    const deps = this.dependents(id);
    deps.delegations.forEach(d => this.data.delegations.remove(d.id));
    deps.assignments.forEach(a => this.data.assignments.update(a.id, { planId: null }));
    deps.reports.forEach(r => this.data.reports.update(r.id, { planId: null }));
    this.data.plans.remove(id);
    this.activity.log('Deleted', 'Monitoring Plan', id, p.projectId, `Monitoring Plan ${id} deleted` + (deps.delegations.length ? ` with ${deps.delegations.length} delegation record(s)` : ''));
  }

  /* ---------- Workflow ---------- */

  actions(p: MonitoringPlan): PlanActions {
    const can = (perm: Parameters<DemoRoleService['can']>[0]) => this.roles.can(perm);
    const editableStatus = p.status === 'Draft' || p.status === 'Rejected' || p.status === 'In PM Review';
    return {
      edit: can('plan.manage') && (editableStatus || p.sponsorReview === 'Changes Requested'),
      delete: can('plan.manage') && p.status !== 'Approved',
      submitForPmReview: can('plan.manage') && (p.status === 'Draft' || p.status === 'Rejected'),
      pmFinalSave: can('plan.pmReview') && p.status === 'In PM Review',
      pmReturn: can('plan.pmReview') && p.status === 'In PM Review',
      hodDecide: can('plan.hodApprove') && p.status === 'Pending HOD Approval',
      sendToSponsor: can('plan.sendToSponsor') && p.status === 'HOD Approved' && (p.sponsorReview === 'Not Submitted' || p.sponsorReview === 'Changes Requested'),
      sponsorDecide: can('plan.sponsorReview') && p.sponsorReview === 'Pending',
      pmRespond: can('plan.pmReview') && p.sponsorReview === 'Changes Requested',
    };
  }

  submitForPmReview(id: string): void {
    const p = this.require(id);
    this.transition(p, { status: 'In PM Review' }, 'Submitted for PM review', '');
    this.notifyPms(p, `plan-${id}-pmreview-${p.version}-${p.reviews.length}`, 'Monitoring Plan submitted for review', `${id} (${this.projectName(p)}) is ready for PM review.`);
  }

  pmFinalSave(id: string, comment: string, signature: SimSignature): void {
    const p = this.require(id);
    this.transition(p, { status: 'Pending HOD Approval' }, 'Final save — prepared by PM (simulated signature)', comment, signature);
    this.notifications.notify({
      key: `plan-${id}-hod-${p.version}-${p.reviews.length}`,
      recipientIds: this.users.approvers().map(u => u.id),
      title: 'Monitoring Plan awaiting HOD approval',
      message: `${id} (${this.projectName(p)}) was prepared by ${this.auth.user()?.name}.`,
      link: `/plans/${id}`,
    });
  }

  pmReturn(id: string, comment: string): void {
    const p = this.require(id);
    this.transition(p, { status: 'Rejected' }, 'Returned for rework by PM', comment);
  }

  hodApprove(id: string, comment: string, signature: SimSignature): void {
    const p = this.require(id);
    this.transition(p, { status: 'HOD Approved' }, 'HOD approved (simulated signature)', comment, signature);
    this.notifyPms(p, `plan-${id}-hodok-${p.reviews.length}`, 'Monitoring Plan approved by HOD', `${id} can now be shared with the sponsor.`);
  }

  hodReject(id: string, comment: string): void {
    const p = this.require(id);
    this.transition(p, { status: 'Rejected' }, 'HOD rejected', comment);
    this.notifyPms(p, `plan-${id}-hodno-${p.reviews.length}`, 'Monitoring Plan rejected by HOD', `${id}: ${comment}`);
  }

  sendToSponsor(id: string, to: string, cc: string): void {
    const p = this.require(id);
    this.transition(p, { sponsorReview: 'Pending', sponsorTo: to, sponsorCc: cc }, 'Shared with sponsor for review', `To: ${to}${cc ? ` · CC: ${cc}` : ''}`);
    const project = this.data.projects.get(p.projectId);
    const recipients = this.users.sponsors().filter(u => u.organization === project?.sponsor.name || to.toLowerCase().includes(u.email.toLowerCase()));
    this.notifications.notify({
      key: `plan-${id}-sponsor-${p.version}-${p.reviews.length}`,
      recipientIds: recipients.map(u => u.id),
      title: 'Monitoring Plan submitted for your review',
      message: `${id} v${p.version} (${this.projectName(p)}) is awaiting sponsor review.`,
      link: `/plans/${id}`,
    });
  }

  sponsorApprove(id: string, comment: string, signature: SimSignature): void {
    const p = this.require(id);
    this.transition(p, { sponsorReview: 'Approved', status: 'Approved' }, 'Sponsor approved — sign off (simulated signature)', comment, signature);
    this.notifyTeam(p, `plan-${id}-sponsorok-${p.reviews.length}`, 'Sponsor feedback received', `${id} was approved by the sponsor.`);
  }

  sponsorRequestChanges(id: string, comment: string): void {
    const p = this.require(id);
    this.transition(p, { sponsorReview: 'Changes Requested' }, 'Sponsor requested changes', comment);
    this.notifyTeam(p, `plan-${id}-sponsorchg-${p.reviews.length}`, 'Sponsor feedback received', `${id}: changes requested — "${comment}"`);
  }

  pmRespond(id: string, comment: string): void {
    const p = this.require(id);
    this.transition(p, {}, 'PM response to sponsor comments', comment);
  }

  private transition(p: MonitoringPlan, patch: Partial<MonitoringPlan>, action: string, comment: string, signature?: SimSignature): void {
    const u = this.auth.user();
    const review = {
      id: this.data.localId('RV'),
      at: new Date().toISOString(),
      byId: u?.id ?? 'SYSTEM',
      byName: u?.name ?? 'System',
      role: u?.role ?? 'Project Manager',
      action,
      comment: signature ? `${comment}${comment ? ' — ' : ''}Signed as "${signature.typedName}" (prototype simulation)` : comment,
    };
    this.data.plans.update(p.id, { ...patch, reviews: [...p.reviews, review] });
    this.activity.log(action, 'Monitoring Plan', p.id, p.projectId, `${p.id}: ${action}${comment ? ` — ${comment}` : ''}`);
  }

  private notifyPms(p: MonitoringPlan, key: string, title: string, message: string): void {
    const project = this.data.projects.get(p.projectId);
    this.notifications.notify({ key, recipientIds: [project?.projectManagerId ?? '', p.createdById], title, message, link: `/plans/${p.id}` });
  }

  /** Sponsor feedback goes to the PM and the delegated team for tracking. */
  private notifyTeam(p: MonitoringPlan, key: string, title: string, message: string): void {
    const project = this.data.projects.get(p.projectId);
    const team = this.data.delegations.items().filter(d => d.planId === p.id).flatMap(d => d.monitors.map(m => m.monitorId));
    this.notifications.notify({
      key,
      recipientIds: [project?.projectManagerId ?? '', project?.backupProjectManagerId ?? '', p.createdById, ...team],
      title,
      message,
      link: `/plans/${p.id}`,
    });
  }

  private projectName(p: MonitoringPlan): string {
    return this.data.projects.get(p.projectId)?.name ?? p.projectId;
  }

  private require(id: string): MonitoringPlan {
    const p = this.get(id);
    if (!p) throw new Error(`Monitoring Plan ${id} not found.`);
    return p;
  }
}
