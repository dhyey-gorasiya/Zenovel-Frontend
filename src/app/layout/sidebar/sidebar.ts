import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DemoRoleService } from '../../core/auth/demo-role.service';
import { Permission } from '../../core/config/permissions.config';
import { NotificationService } from '../../core/services/notification.service';
import { Icon } from '../../shared/icons';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
  { path: '/projects', label: 'Projects', icon: 'folder-kanban', permission: 'project.view' },
  { path: '/plans', label: 'Monitoring Plans', icon: 'clipboard-list', permission: 'plan.view' },
  { path: '/delegations', label: 'Training & Delegation', icon: 'graduation-cap', permission: 'delegation.view' },
  { path: '/assignments', label: 'Monitor Assignments', icon: 'user-check', permission: 'assignment.view' },
  { path: '/reports', label: 'Monitoring Reports', icon: 'file-text', permission: 'report.view' },
  { path: '/notifications', label: 'Notifications', icon: 'bell' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly roles = inject(DemoRoleService);
  protected readonly notifications = inject(NotificationService);
  readonly collapsed = input(false);
  readonly mobile = input(false);
  readonly toggle = output<void>();
  readonly navigate = output<void>();
  protected readonly items = computed(() => {
    this.roles.role();
    return NAV.filter(n => !n.permission || this.roles.can(n.permission));
  });
}
