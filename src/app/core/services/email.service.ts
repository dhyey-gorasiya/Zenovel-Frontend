import { Injectable, computed, inject, signal } from '@angular/core';
import { AccessScopeService } from '../auth/access-scope.service';
import { AuthService } from '../auth/auth.service';
import { EMAILJS_SEND_URL, EMAIL_DELIVERY } from '../config/email.config';
import { DataStore } from '../data/data-store.service';
import { EmailDraft, SimulatedEmail } from '../models';
import { ActivityService } from './activity.service';
import { ToastService } from './toast.service';

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
  private readonly toast = inject(ToastService);

  readonly pending = signal<PendingEmail | null>(null);
  /** True when EmailJS is configured, so each recorded email is also delivered to the redirect address. */
  readonly deliversRealEmail = !!(EMAIL_DELIVERY.serviceId && EMAIL_DELIVERY.templateId && EMAIL_DELIVERY.publicKey && EMAIL_DELIVERY.redirectTo);

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
    if (this.deliversRealEmail) void this.deliver(draft);
    return email;
  }

  private async deliver(draft: EmailDraft): Promise<void> {
    const url = new URL(draft.link, window.location.origin).href;
    const message =
      `Originally addressed to: ${draft.to.join(', ')}` +
      (draft.cc.length ? `\nCC: ${draft.cc.join(', ')}` : '') +
      `\n\n${draft.body}\n\nOpen in Zenovel: ${url}`;
    try {
      const res = await fetch(EMAILJS_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAIL_DELIVERY.serviceId,
          template_id: EMAIL_DELIVERY.templateId,
          user_id: EMAIL_DELIVERY.publicKey,
          template_params: {
            to_email: EMAIL_DELIVERY.redirectTo,
            subject: draft.subject,
            message,
            body: draft.body,
            original_to: draft.to.join(', '),
            original_cc: draft.cc.join(', ') || '—',
            link: url,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      this.toast.error(`Email "${draft.subject}" could not be delivered: ${(e as Error).message}`);
    }
  }

  complete(result: SimulatedEmail | null): void {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(result);
  }
}
