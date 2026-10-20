import { Injectable, computed, inject } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { DataStore } from '../data/data-store.service';
import { ActivityItem, EntityType } from '../models';

const byNewest = (a: ActivityItem, b: ActivityItem) => b.at.localeCompare(a.at);

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly scope = inject(AccessScopeService);

  /** Activity on projects the current user can see, newest first. */
  readonly visible = computed(() => {
    const ids = this.scope.visibleProjectIds();
    const me = this.auth.user()?.id;
    return this.data.activity.items().filter(a => (a.projectId ? ids.has(a.projectId) : a.actorId === me)).sort(byNewest);
  });

  log(action: string, entityType: EntityType, entityId: string, projectId: string | null, text: string): void {
    const u = this.auth.user();
    const now = new Date().toISOString();
    this.data.activity.insert({
      id: this.data.nextId('ACT', this.data.activity),
      at: now,
      actorId: u?.id ?? 'SYSTEM',
      actorName: u?.name ?? 'System',
      action,
      entityType,
      entityId,
      projectId,
      text,
      updatedAt: now,
    });
  }

  forProject(projectId: string): ActivityItem[] {
    return this.data.activity.items().filter(a => a.projectId === projectId).sort(byNewest);
  }

  forEntity(entityType: EntityType, entityId: string): ActivityItem[] {
    return this.data.activity.items().filter(a => a.entityType === entityType && a.entityId === entityId).sort(byNewest);
  }

  removeForEntity(entityType: EntityType, entityId: string): void {
    this.data.activity.items().filter(a => a.entityType === entityType && a.entityId === entityId).forEach(a => this.data.activity.remove(a.id));
  }
}
