import { DatePipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, SimulatedEmail } from '../../core/models';
import { EmailService } from '../../core/services/email.service';
import { NotificationService } from '../../core/services/notification.service';
import { ProjectService } from '../../core/services/project.service';
import { Icon } from '../../shared/icons';
import { Modal } from '../../shared/ui/modal';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { EmptyState } from '../../shared/ui/states';
import { Tabs } from '../../shared/ui/tabs';

@Component({
  imports: [DatePipe, TitleCasePipe, Icon, PageHeader, Tabs, EmptyState, Pagination, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications.html',
})
export class Notifications {
  private readonly router = inject(Router);
  protected readonly notifications = inject(NotificationService);
  protected readonly email = inject(EmailService);
  protected readonly projects = inject(ProjectService);

  protected readonly tab = signal('inbox');
  protected readonly filter = signal('all');
  protected readonly page = signal(0);
  protected readonly size = signal(10);
  protected readonly viewing = signal<SimulatedEmail | null>(null);

  protected readonly filtered = computed(() => {
    const f = this.filter();
    return this.notifications.mine().filter(n => f === 'all' || (f === 'read' ? n.read : !n.read));
  });
  protected readonly pageItems = computed(() => this.filtered().slice(this.page() * this.size(), (this.page() + 1) * this.size()));

  open(n: AppNotification): void {
    this.notifications.markRead(n);
    this.router.navigateByUrl(n.link);
  }

  openRecord(e: SimulatedEmail): void {
    this.viewing.set(null);
    this.router.navigateByUrl(e.link);
  }
}
