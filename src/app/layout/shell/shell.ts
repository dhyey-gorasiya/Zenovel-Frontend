import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS } from '../../core/config/permissions.config';
import { DataStore } from '../../core/data/data-store.service';
import { LocalStorageService } from '../../core/data/local-storage.service';
import { DialogService } from '../../core/services/dialog.service';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../../shared/icons';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  protected readonly storage = inject(LocalStorageService);
  protected readonly collapsed = signal(false);
  protected readonly mobileOpen = signal(false);

  constructor() {
    const issues = inject(DataStore).issues();
    if (issues.length) this.toast.warn(`${issues.length} stored data set(s) were unreadable and were restored from demo data. See Settings.`);

    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(q => {
      const denied = q.get('denied');
      if (denied) {
        const label = PERMISSIONS.find(p => p.key === denied)?.label ?? denied;
        this.toast.warn(`Your role does not have access to that page (${label}).`);
      }
    });
  }

  async logout(): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Sign out?',
      message: 'You\'ll be signed out of Zenovel and taken back to the sign-in page.',
      confirmText: 'sign out',
    });
    if (!ok) return;
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
