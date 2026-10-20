import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AppNotification } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { SearchService } from '../../core/services/search.service';
import { ThemeService } from '../../core/services/theme.service';
import { Icon } from '../../shared/icons';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', projects: 'Projects', plans: 'Monitoring Plans', delegations: 'Training & Delegation',
  assignments: 'Monitor Assignments', reports: 'Monitoring Reports', notifications: 'Notifications', settings: 'Settings',
  new: 'Create', edit: 'Edit', print: 'Print view',
};

@Component({
  selector: 'app-topbar',
  imports: [RouterLink, Icon, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocClick($event)', '(document:keydown.escape)': 'closeAll()' },
  templateUrl: './topbar.html',
})
export class Topbar {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly search = inject(SearchService);
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  protected readonly theme = inject(ThemeService);

  readonly menu = output<void>();
  readonly logout = output<void>();

  protected readonly openMenu = signal<'search' | 'bell' | 'profile' | null>(null);
  protected readonly query = signal('');
  protected readonly results = computed(() => this.search.search(this.query()));
  protected readonly latest = computed(() => this.notifications.mine().slice(0, 6));
  protected readonly initials = computed(() =>
    (this.auth.user()?.name ?? '').replace(/^Dr\.?\s+/, '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(),
  );

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  protected readonly title = computed(() => {
    this.url();
    let r = this.route.snapshot;
    let title = '';
    while (r.firstChild) {
      r = r.firstChild;
      title = (r.data['title'] as string) ?? title;
    }
    return title || 'Zenovel';
  });

  protected readonly crumbs = computed(() => {
    const path = this.url().split('?')[0].split('#')[0];
    const segs = path.split('/').filter(Boolean);
    return segs.map((s, i) => ({ label: SEGMENT_LABELS[s] ?? decodeURIComponent(s), url: '/' + segs.slice(0, i + 1).join('/') }));
  });

  toggleMenu(m: 'bell' | 'profile'): void {
    this.openMenu.update(cur => (cur === m ? null : m));
  }

  closeAll(): void {
    this.openMenu.set(null);
  }

  go(link: string): void {
    this.query.set('');
    this.closeAll();
    this.router.navigateByUrl(link);
  }

  openNotification(n: AppNotification): void {
    this.notifications.markRead(n);
    this.go(n.link);
  }

  onDocClick(e: Event): void {
    const open = this.openMenu();
    if (!open) return;
    const container = this.el.nativeElement.querySelector(`[data-menu="${open}"]`);
    if (container && !container.contains(e.target as Node)) this.closeAll();
  }
}
