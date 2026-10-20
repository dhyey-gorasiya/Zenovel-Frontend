import { Injectable, computed, inject } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { DataStore } from '../data/data-store.service';
import { Project } from '../models';
import { ActivityService } from './activity.service';

export type ProjectInput = Omit<Project, 'id' | 'updatedAt' | 'createdAt' | 'createdById'>;

export interface ProjectDependents {
  plans: number;
  delegations: number;
  assignments: number;
  reports: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly scope = inject(AccessScopeService);
  private readonly activity = inject(ActivityService);

  readonly visible = computed(() => this.data.projects.items().filter(p => this.scope.project(p)));

  get(id: string | null | undefined): Project | undefined {
    return id ? this.data.projects.get(id) : undefined;
  }

  /** Visible-to-user lookup used by detail pages (undefined when missing or out of scope). */
  getVisible(id: string | null | undefined): Project | undefined {
    const p = this.get(id);
    return p && this.scope.project(p) ? p : undefined;
  }

  name(id: string | null | undefined): string {
    return this.get(id)?.name ?? '(deleted project)';
  }

  /** Returns a message when protocol / Zenovel / sponsor numbers collide with another project. */
  duplicateMessage(input: Pick<ProjectInput, 'protocolNo' | 'zenovelProjectNo'>, excludeId: string | null): string | null {
    const norm = (s: string) => s.trim().toLowerCase();
    for (const p of this.data.projects.items()) {
      if (p.id === excludeId) continue;
      if (norm(p.protocolNo) === norm(input.protocolNo)) return `Protocol No. "${input.protocolNo}" is already used by ${p.id} (${p.name}).`;
      if (norm(p.zenovelProjectNo) === norm(input.zenovelProjectNo)) return `Zenovel Project No. "${input.zenovelProjectNo}" is already used by ${p.id} (${p.name}).`;
    }
    return null;
  }

  peekNextId(): string {
    const max = this.data.projects.items().reduce((m, p) => Math.max(m, Number(p.id.split('-')[1]) || 0), 0);
    return `PRJ-${String(max + 1).padStart(3, '0')} (assigned on save)`;
  }

  create(input: ProjectInput): Project {
    const dup = this.duplicateMessage(input, null);
    if (dup) throw new Error(dup);
    const now = new Date().toISOString();
    const project = this.data.projects.insert({
      ...input,
      id: this.data.nextId('PRJ', this.data.projects),
      createdAt: now,
      createdById: this.auth.user()?.id ?? 'SYSTEM',
      updatedAt: now,
    });
    this.activity.log('Created', 'Project', project.id, project.id, `Project ${project.id} ${project.name} created`);
    return project;
  }

  update(id: string, input: ProjectInput): Project | undefined {
    const dup = this.duplicateMessage(input, id);
    if (dup) throw new Error(dup);
    const before = this.get(id);
    const updated = this.data.projects.update(id, input);
    if (updated) {
      const statusNote = before && before.status !== updated.status ? ` (status ${before.status} → ${updated.status})` : '';
      this.activity.log('Updated', 'Project', id, id, `Project ${id} updated${statusNote}`);
    }
    return updated;
  }

  dependents(id: string): ProjectDependents {
    const plans = this.data.plans.items().filter(x => x.projectId === id).length;
    const delegations = this.data.delegations.items().filter(x => x.projectId === id).length;
    const assignments = this.data.assignments.items().filter(x => x.projectId === id).length;
    const reports = this.data.reports.items().filter(x => x.projectId === id).length;
    return { plans, delegations, assignments, reports, total: plans + delegations + assignments + reports };
  }

  /**
   * Disclosed cascade-delete policy: deleting a project also deletes its plans,
   * delegations, assignments, reports and notifications that link to them.
   */
  delete(id: string): void {
    const p = this.get(id);
    if (!p) return;
    const linkPrefixes: string[] = [`/projects/${id}`];
    const removeAll = <T extends { id: string; projectId: string }>(items: T[], remove: (id: string) => void, route: string) =>
      items.filter(x => x.projectId === id).forEach(x => {
        linkPrefixes.push(`${route}/${x.id}`);
        remove(x.id);
      });
    removeAll(this.data.reports.items(), i => this.data.reports.remove(i), '/reports');
    removeAll(this.data.assignments.items(), i => this.data.assignments.remove(i), '/assignments');
    removeAll(this.data.delegations.items(), i => this.data.delegations.remove(i), '/delegations');
    removeAll(this.data.plans.items(), i => this.data.plans.remove(i), '/plans');
    this.data.notifications.items().filter(n => linkPrefixes.some(l => n.link === l || n.link.startsWith(l + '/'))).forEach(n => this.data.notifications.remove(n.id));
    this.data.projects.remove(id);
    this.activity.log('Deleted', 'Project', id, null, `Project ${id} ${p.name} deleted with all dependent records`);
  }
}
