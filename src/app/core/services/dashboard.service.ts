import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { DemoRoleService } from '../auth/demo-role.service';
import { PLAN_STATUSES, PROJECT_STATUSES } from '../config/domain.config';
import { ActivityService } from './activity.service';
import { DelegationService } from './delegation.service';
import { MonitorAssignmentService } from './monitor-assignment.service';
import { MonitoringPlanService } from './monitoring-plan.service';
import { MonitoringReportService } from './monitoring-report.service';
import { ProjectService } from './project.service';
import { UserDirectoryService } from './user-directory.service';

export interface Kpi {
  label: string;
  value: number;
  link: string;
  query: Record<string, string>;
  icon: string;
  hint: string;
}

export interface PendingAction {
  label: string;
  detail: string;
  link: string;
  tone: 'warn' | 'info' | 'danger';
}

/** All dashboard figures are derived from the records the signed-in user can see. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly auth = inject(AuthService);
  private readonly roles = inject(DemoRoleService);
  private readonly projects = inject(ProjectService);
  private readonly plans = inject(MonitoringPlanService);
  private readonly delegations = inject(DelegationService);
  private readonly assignments = inject(MonitorAssignmentService);
  private readonly reports = inject(MonitoringReportService);
  private readonly activity = inject(ActivityService);
  private readonly users = inject(UserDirectoryService);

  readonly kpis = computed<Kpi[]>(() => {
    const projects = this.projects.visible();
    const plans = this.plans.visible();
    const kpis: Kpi[] = [
      { label: 'Total Projects', value: projects.length, link: '/projects', query: {}, icon: 'folder-kanban', hint: 'All projects in your scope' },
      { label: 'Active Projects', value: projects.filter(p => p.status === 'Active').length, link: '/projects', query: { status: 'Active' }, icon: 'activity', hint: 'Status: Active' },
      {
        label: 'Plans Awaiting Approval',
        value: plans.filter(p => this.awaitingApproval(p.status, p.sponsorReview)).length,
        link: '/plans', query: { awaiting: '1' }, icon: 'clipboard-list', hint: 'PM, HOD or sponsor review pending',
      },
      {
        label: 'Pending Monitor Acknowledgements',
        value: this.delegations.visible().flatMap(d => d.acknowledgements).filter(a => a.state === 'Pending').length,
        link: '/delegations', query: { ack: 'pending' }, icon: 'user-check', hint: 'Notified, not yet acknowledged',
      },
      {
        label: 'Upcoming Monitoring Visits',
        value: this.assignments.visible().filter(a => this.assignments.isUpcoming(a)).length,
        link: '/assignments', query: { when: 'upcoming' }, icon: 'calendar-clock', hint: 'Visit date today or later',
      },
      {
        label: 'Reports Awaiting Review',
        value: this.reports.visible().filter(r => r.status === 'In Review').length,
        link: '/reports', query: { status: 'In Review' }, icon: 'file-text', hint: 'Status: In Review',
      },
    ];
    return kpis;
  });

  readonly projectStatus = computed(() => {
    const list = this.projects.visible();
    return PROJECT_STATUSES.map(s => ({ label: s, value: list.filter(p => p.status === s).length })).filter(x => x.value > 0);
  });

  readonly planStatus = computed(() => {
    const list = this.plans.visible();
    return PLAN_STATUSES.map(s => ({ label: s, value: list.filter(p => p.status === s).length }));
  });

  readonly upcomingVisits = computed(() =>
    this.assignments.visible().filter(a => this.assignments.isUpcoming(a)).sort((a, b) => a.visitDate.localeCompare(b.visitDate)).slice(0, 6),
  );

  readonly recentProjects = computed(() => [...this.projects.visible()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5));

  readonly recentActivity = computed(() => this.activity.visible().slice(0, 8));

  readonly pendingActions = computed<PendingAction[]>(() => {
    const me = this.auth.user();
    if (!me) return [];
    const out: PendingAction[] = [];
    const pname = (id: string) => this.projects.name(id);

    for (const p of this.plans.visible()) {
      const a = this.plans.actions(p);
      if (a.pmFinalSave) out.push({ label: `Review plan ${p.id}`, detail: `${pname(p.projectId)} · In PM review`, link: `/plans/${p.id}`, tone: 'warn' });
      if (a.hodDecide) out.push({ label: `Approve plan ${p.id}`, detail: `${pname(p.projectId)} · awaiting HOD approval`, link: `/plans/${p.id}`, tone: 'warn' });
      if (a.sendToSponsor) out.push({ label: `Share plan ${p.id} with sponsor`, detail: `${pname(p.projectId)} · sponsor review ${p.sponsorReview.toLowerCase()}`, link: `/plans/${p.id}`, tone: 'info' });
      if (a.sponsorDecide) out.push({ label: `Review plan ${p.id}`, detail: `${pname(p.projectId)} · sponsor feedback requested`, link: `/plans/${p.id}`, tone: 'warn' });
    }
    for (const d of this.delegations.visible()) {
      const mine = this.delegations.myAcknowledgement(d);
      if (mine?.state === 'Pending' && this.roles.can('delegation.acknowledge')) out.push({ label: `Acknowledge ${d.id}`, detail: `${pname(d.projectId)} · ${mine.duties.join(', ')}`, link: `/delegations/${d.id}`, tone: 'warn' });
      if (this.delegations.canManage() && this.delegations.unsentMonitorIds(d).length) out.push({ label: `Notify monitors on ${d.id}`, detail: `${this.delegations.unsentMonitorIds(d).length} not yet notified`, link: `/delegations/${d.id}`, tone: 'info' });
      if (this.delegations.canManage() && d.acknowledgements.some(x => x.state === 'Declined')) out.push({ label: `Reassign declined duty on ${d.id}`, detail: pname(d.projectId), link: `/delegations/${d.id}`, tone: 'danger' });
      if (this.delegations.canRequestAuthorization(d)) out.push({ label: `Request HOD/VP authorization for ${d.id}`, detail: 'All acknowledgements complete', link: `/delegations/${d.id}`, tone: 'info' });
      if (this.delegations.canAuthorize(d)) out.push({ label: `Authorize ${d.id}`, detail: `${pname(d.projectId)} · authorization pending`, link: `/delegations/${d.id}`, tone: 'warn' });
    }
    for (const a of this.assignments.visible()) {
      const act = this.assignments.actions(a);
      if (act.acknowledge && a.monitorId === me.id) out.push({ label: `Acknowledge ${a.visitType} visit`, detail: `${pname(a.projectId)} · ${a.visitDate}`, link: `/assignments/${a.id}`, tone: 'warn' });
      if (act.startReport) out.push({ label: `Start report for ${a.id}`, detail: `${a.visitType} · ${pname(a.projectId)}`, link: `/assignments/${a.id}`, tone: 'info' });
      if (act.notify && a.status === 'Planned') out.push({ label: `Notify ${this.users.name(a.monitorId)} of ${a.id}`, detail: `${a.visitType} · ${a.visitDate}`, link: `/assignments/${a.id}`, tone: 'info' });
    }
    for (const r of this.reports.visible()) {
      const act = this.reports.actions(r);
      if (act.review) out.push({ label: `Review report ${r.id}`, detail: `${r.visitType} · ${this.users.name(r.monitorId)}`, link: `/reports/${r.id}`, tone: 'warn' });
      if (act.submit && r.status === 'Changes Requested') out.push({ label: `Revise report ${r.id}`, detail: 'Changes requested', link: `/reports/${r.id}`, tone: 'danger' });
      if (act.submit && r.status === 'Draft') out.push({ label: `Complete draft ${r.id}`, detail: `${r.visitType} · ${pname(r.projectId)}`, link: `/reports/${r.id}`, tone: 'info' });
    }
    return out;
  });

  awaitingApproval(status: string, sponsorReview: string): boolean {
    return status === 'In PM Review' || status === 'Pending HOD Approval' || sponsorReview === 'Pending';
  }
}
