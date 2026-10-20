import { Injectable, inject } from '@angular/core';
import { DemoRoleService } from '../auth/demo-role.service';
import { DelegationService } from './delegation.service';
import { MonitorAssignmentService } from './monitor-assignment.service';
import { MonitoringPlanService } from './monitoring-plan.service';
import { MonitoringReportService } from './monitoring-report.service';
import { ProjectService } from './project.service';
import { UserDirectoryService } from './user-directory.service';

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

/** Global search across records the current user is allowed to see. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly roles = inject(DemoRoleService);
  private readonly projects = inject(ProjectService);
  private readonly plans = inject(MonitoringPlanService);
  private readonly delegations = inject(DelegationService);
  private readonly assignments = inject(MonitorAssignmentService);
  private readonly reports = inject(MonitoringReportService);
  private readonly users = inject(UserDirectoryService);

  search(term: string, limit = 12): SearchResult[] {
    const q = term.trim().toLowerCase();
    if (q.length < 2) return [];
    const hit = (...fields: (string | null | undefined)[]) => fields.some(f => f?.toLowerCase().includes(q));
    const out: SearchResult[] = [];
    const pname = (id: string) => this.projects.name(id);

    if (this.roles.can('project.view')) {
      this.projects.visible().filter(p => hit(p.id, p.name, p.protocolNo, p.zenovelProjectNo, p.sponsor.name, p.protocolTitle))
        .forEach(p => out.push({ type: 'Project', id: p.id, title: p.name, subtitle: `${p.protocolNo} · ${p.status}`, link: `/projects/${p.id}` }));
    }
    if (this.roles.can('plan.view')) {
      this.plans.visible().filter(p => hit(p.id, pname(p.projectId), p.status))
        .forEach(p => out.push({ type: 'Monitoring Plan', id: p.id, title: `${p.id} v${p.version}`, subtitle: `${pname(p.projectId)} · ${p.status}`, link: `/plans/${p.id}` }));
    }
    if (this.roles.can('delegation.view')) {
      this.delegations.visible().filter(d => hit(d.id, pname(d.projectId), ...d.monitors.map(m => this.users.name(m.monitorId))))
        .forEach(d => out.push({ type: 'Delegation', id: d.id, title: d.id, subtitle: `${pname(d.projectId)} · ${d.authorization}`, link: `/delegations/${d.id}` }));
    }
    if (this.roles.can('assignment.view')) {
      this.assignments.visible().filter(a => hit(a.id, a.visitType, pname(a.projectId), this.users.name(a.monitorId)))
        .forEach(a => out.push({ type: 'Assignment', id: a.id, title: `${a.id} · ${a.visitType}`, subtitle: `${pname(a.projectId)} · ${this.users.name(a.monitorId)}`, link: `/assignments/${a.id}` }));
    }
    if (this.roles.can('report.view')) {
      this.reports.visible().filter(r => hit(r.id, r.visitType, pname(r.projectId), this.users.name(r.monitorId)))
        .forEach(r => out.push({ type: 'Report', id: r.id, title: `${r.id} · ${r.visitType}`, subtitle: `${pname(r.projectId)} · ${r.status}`, link: `/reports/${r.id}` }));
    }
    return out.slice(0, limit);
  }
}
