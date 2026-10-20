import { Injectable, computed, inject } from '@angular/core';
import { Permission } from '../config/permissions.config';
import { AppSettingsService } from '../data/app-settings.service';
import { Role } from '../models';
import { AuthService } from './auth.service';

/** Client-side permission checks for the demo. Not a substitute for server-side authorization. */
@Injectable({ providedIn: 'root' })
export class DemoRoleService {
  private readonly auth = inject(AuthService);
  private readonly settings = inject(AppSettingsService);

  readonly role = computed<Role | null>(() => this.auth.user()?.role ?? null);
  private readonly granted = computed(() => {
    const role = this.role();
    return new Set<Permission>(role ? this.settings.permissions()[role] ?? [] : []);
  });

  can(permission: Permission): boolean {
    return this.granted().has(permission);
  }

  is(role: Role): boolean {
    return this.role() === role;
  }
}
