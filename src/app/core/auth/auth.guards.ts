import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission } from '../config/permissions.config';
import { AuthService } from './auth.service';
import { DemoRoleService } from './demo-role.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;

/** Route data: `{ permission: 'plan.view' }`. Redirects to the dashboard when the role lacks it. */
export const permissionGuard: CanActivateFn = route => {
  const permission = route.data['permission'] as Permission | undefined;
  if (!permission || inject(DemoRoleService).can(permission)) return true;
  return inject(Router).createUrlTree(['/dashboard'], { queryParams: { denied: permission } });
};
