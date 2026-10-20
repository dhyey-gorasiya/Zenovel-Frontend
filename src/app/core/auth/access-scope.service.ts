import { Injectable, computed, inject } from '@angular/core';
import { DataStore } from '../data/data-store.service';
import { Delegation, MonitorAssignment, MonitoringPlan, MonitoringReport, Project } from '../models';
import { AuthService } from './auth.service';

/**
 * Decides which records the signed-in user can see.
 * - Project Manager: projects they manage or back up.
 * - Monitor: projects where they are delegated or assigned; only their own delegations, assignments and reports.
 * - HOD/VP: all projects (department oversight).
 * - Sponsor: their organisation's projects; only plans that were shared for sponsor review.
 */
@Injectable({ providedIn: 'root' })
export class AccessScopeService {
  private readonly auth = inject(AuthService);
  private readonly data = inject(DataStore);

  readonly visibleProjectIds = computed(() => {
    const u = this.auth.user();
    const projects = this.data.projects.items();
    if (!u) return new Set<string>();
    switch (u.role) {
      case 'HOD/VP':
        return new Set(projects.map(p => p.id));
      case 'Project Manager':
        return new Set(projects.filter(p => p.projectManagerId === u.id || p.backupProjectManagerId === u.id).map(p => p.id));
      case 'Sponsor':
        return new Set(projects.filter(p => p.sponsor.name === u.organization).map(p => p.id));
      case 'Monitor':
        return new Set([
          ...this.data.delegations.items().filter(d => d.monitors.some(m => m.monitorId === u.id)).map(d => d.projectId),
          ...this.data.assignments.items().filter(a => a.monitorId === u.id).map(a => a.projectId),
          ...this.data.reports.items().filter(r => r.monitorId === u.id).map(r => r.projectId),
        ]);
    }
  });

  project(p: Project): boolean {
    return this.visibleProjectIds().has(p.id);
  }

  plan(p: MonitoringPlan): boolean {
    if (!this.visibleProjectIds().has(p.projectId)) return false;
    return this.auth.user()?.role !== 'Sponsor' || p.sponsorReview !== 'Not Submitted';
  }

  delegation(d: Delegation): boolean {
    if (!this.visibleProjectIds().has(d.projectId)) return false;
    const u = this.auth.user();
    return u?.role !== 'Monitor' || d.monitors.some(m => m.monitorId === u.id);
  }

  assignment(a: MonitorAssignment): boolean {
    if (!this.visibleProjectIds().has(a.projectId)) return false;
    const u = this.auth.user();
    return u?.role !== 'Monitor' || a.monitorId === u.id;
  }

  report(r: MonitoringReport): boolean {
    if (!this.visibleProjectIds().has(r.projectId)) return false;
    const u = this.auth.user();
    return u?.role !== 'Monitor' || r.monitorId === u.id;
  }
}
