import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EmailService } from '../../core/services/email.service';
import { ProjectService } from '../../core/services/project.service';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../icons';
import { Modal } from './modal';

/** Mock email preview driven by EmailService.preview(). Nothing is delivered. */
@Component({
  selector: 'app-email-preview',
  imports: [Modal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './email-preview.html',
})
export class EmailPreview {
  protected readonly email = inject(EmailService);
  private readonly projects = inject(ProjectService);
  private readonly toast = inject(ToastService);
  protected readonly sending = signal(false);
  protected readonly result = signal('');
  protected readonly projectLabel = computed(() => {
    const id = this.email.pending()?.draft.projectId;
    return id ? `${this.projects.name(id)} (${id})` : '—';
  });

  cancel(): void {
    if (this.sending()) return;
    this.result.set('');
    this.email.complete(null);
  }

  send(): void {
    const p = this.email.pending();
    if (!p) return;
    this.sending.set(true);
    setTimeout(() => {
      const sent = this.email.send(p.draft);
      this.result.set(`Recorded as ${sent.id} for ${p.draft.to.join(', ')}.`);
      this.toast.success(`Simulated email ${sent.id} recorded — no real email was sent.`);
      setTimeout(() => {
        this.sending.set(false);
        this.result.set('');
        this.email.complete(sent);
      }, 900);
    }, 600);
  }
}
