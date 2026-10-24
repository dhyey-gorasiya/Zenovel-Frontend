import { Injectable, computed, inject } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { AuditFieldDef, PROJECT_AUDIT_FIELDS } from '../config/project-audit.config';
import { DataStore } from '../data/data-store.service';
import { AuditAction, AuditFieldChange, FileMeta, Project, ProjectAuditEntry, ScopeVisit } from '../models';
import { UserDirectoryService } from './user-directory.service';

const EMPTY = '—';
const byNewest = (a: ProjectAuditEntry, b: ProjectAuditEntry) => b.at.localeCompare(a.at);

/** Treats missing, blank and empty-list values as the same "no value". */
const normalize = (v: unknown): unknown => (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) ? null : v);
const sameValue = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

/** Field-level change history for projects (previous vs. new value on every create, update and delete). */
@Injectable({ providedIn: 'root' })
export class ProjectAuditService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly scope = inject(AccessScopeService);
  private readonly users = inject(UserDirectoryService);

  /**
   * Entries for projects the current user can see, newest first.
   * Deleted projects are no longer in scope, so their history is shown to HOD/VP (who oversee all projects) and to whoever made the change.
   */
  readonly visible = computed(() => {
    const ids = this.scope.visibleProjectIds();
    const u = this.auth.user();
    return this.data.projectAudit
      .items()
      .filter(e => ids.has(e.projectId) || (!this.data.projects.get(e.projectId) && (u?.role === 'HOD/VP' || e.actorId === u?.id)))
      .sort(byNewest);
  });

  forProject(projectId: string): ProjectAuditEntry[] {
    return this.visible().filter(e => e.projectId === projectId);
  }

  /** Records what changed between two versions of a project. Updates with no field changes are not logged. */
  record(action: AuditAction, before: Project | undefined, after: Project | undefined): void {
    const project = after ?? before;
    if (!project) return;
    const changes = this.diff(before, after);
    if (!changes.length) return;
    const u = this.auth.user();
    const now = new Date().toISOString();
    this.data.projectAudit.insert({
      id: this.data.nextId('AUD', this.data.projectAudit),
      at: now,
      actorId: u?.id ?? 'SYSTEM',
      actorName: u?.name ?? 'System',
      action,
      projectId: project.id,
      projectName: project.name,
      changes,
      updatedAt: now,
    });
  }

  private diff(before: Project | undefined, after: Project | undefined): AuditFieldChange[] {
    return PROJECT_AUDIT_FIELDS.flatMap(def => {
      const prev = before ? def.read(before) : undefined;
      const next = after ? def.read(after) : undefined;
      if (sameValue(prev, next)) return [];
      return [{ field: def.field, label: def.label, previous: this.format(def, prev), current: this.format(def, next) }];
    });
  }

  private format(def: AuditFieldDef, value: unknown): string {
    if (normalize(value) === null) return EMPTY;
    switch (def.kind) {
      case 'user':
        return this.users.get(value as string)?.name ?? String(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'file':
        return (value as FileMeta).name || EMPTY;
      case 'visits':
        return (value as ScopeVisit[]).map(v => `${v.visitType || EMPTY} (${v.days ?? EMPTY} day${v.days === 1 ? '' : 's'})`).join('; ');
      default:
        return String(value);
    }
  }
}
