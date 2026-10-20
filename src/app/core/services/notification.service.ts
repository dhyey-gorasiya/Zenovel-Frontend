import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { DataStore } from '../data/data-store.service';
import { AppNotification } from '../models';

export interface NotifyRequest {
  /** Unique event key. A recipient never receives two notifications with the same key. */
  key: string;
  recipientIds: string[];
  title: string;
  message: string;
  link: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);

  readonly mine = computed(() => {
    const me = this.auth.user()?.id;
    return this.data.notifications
      .items()
      .filter(n => n.recipientId === me)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  readonly unreadCount = computed(() => this.mine().filter(n => !n.read).length);

  notify(req: NotifyRequest): number {
    const existing = new Set(this.data.notifications.items().map(n => `${n.key}|${n.recipientId}`));
    const now = new Date().toISOString();
    let created = 0;
    for (const recipientId of new Set(req.recipientIds)) {
      if (!recipientId || existing.has(`${req.key}|${recipientId}`)) continue;
      this.data.notifications.insert({
        id: this.data.nextId('NTF', this.data.notifications),
        key: req.key,
        recipientId,
        title: req.title,
        message: req.message,
        link: req.link,
        read: false,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
    return created;
  }

  markRead(n: AppNotification): void {
    if (!n.read) this.data.notifications.update(n.id, { read: true });
  }

  markAllRead(): void {
    this.mine().filter(n => !n.read).forEach(n => this.data.notifications.update(n.id, { read: true }));
  }

  remove(id: string): void {
    this.data.notifications.remove(id);
  }
}
