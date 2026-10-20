import { Injectable, computed, inject, signal } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { DataStore } from '../data/data-store.service';
import { EmailDraft, SimulatedEmail } from '../models';
import { ActivityService } from './activity.service';

interface PendingEmail {
  draft: EmailDraft;
  resolve: (sent: SimulatedEmail | null) => void;
}

/** Simulated email: previews and records messages in a local outbox. Nothing is ever delivered. */
@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly data = inject(DataStore);
  private readonly auth = inject(AuthService);
  private readonly scope = inject(AccessScopeService);
  private readonly activity = inject(ActivityService);

  readonly pending = signal<PendingEmail | null>(null);

  /** Outbox entries the current user sent, received, or can see through their projects. */
  readonly outbox = computed(() => {
    const u = this.auth.user();
    const ids = this.scope.visibleProjectIds();
    return this.data.emails
      .items()
      .filter(e => e.sentById === u?.id || e.to.includes(u?.email ?? '') || (u?.role !== 'Monitor' && e.projectId && ids.has(e.projectId)))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  });

  /** Opens the preview; resolves with the recorded email when the user clicks "Send (simulated)", or null if cancelled. */
  preview(draft: EmailDraft): Promise<SimulatedEmail | null> {
    this.pending()?.resolve(null);
    return new Promise(resolve => this.pending.set({ draft, resolve }));
  }

  send(draft: EmailDraft): SimulatedEmail {
    const u = this.auth.user();
    const now = new Date().toISOString();
    const email = this.data.emails.insert({
      ...draft,
      id: this.data.nextId('EML', this.data.emails),
      sentAt: now,
      sentById: u?.id ?? 'SYSTEM',
      sentByName: u?.name ?? 'System',
      updatedAt: now,
    });
    this.activity.log('Email simulated', draft.entityType, draft.entityId, draft.projectId, `Simulated email "${draft.subject}" recorded for ${draft.to.join(', ')}`);
    return email;
  }

  complete(result: SimulatedEmail | null): void {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(result);
  }
}
