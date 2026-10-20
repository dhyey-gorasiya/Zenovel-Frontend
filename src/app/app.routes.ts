import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], title: 'Sign in · Zenovel', loadComponent: () => import('./features/auth/login').then(m => m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then(m => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · Zenovel', data: { title: 'Dashboard' }, loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard) },
      { path: 'projects', canActivate: [permissionGuard], data: { permission: 'project.view' }, loadChildren: () => import('./features/projects/projects.routes').then(m => m.PROJECT_ROUTES) },
      { path: 'plans', canActivate: [permissionGuard], data: { permission: 'plan.view' }, loadChildren: () => import('./features/plans/plans.routes').then(m => m.PLAN_ROUTES) },
      { path: 'delegations', canActivate: [permissionGuard], data: { permission: 'delegation.view' }, loadChildren: () => import('./features/delegations/delegations.routes').then(m => m.DELEGATION_ROUTES) },
      { path: 'assignments', canActivate: [permissionGuard], data: { permission: 'assignment.view' }, loadChildren: () => import('./features/assignments/assignments.routes').then(m => m.ASSIGNMENT_ROUTES) },
      { path: 'reports', canActivate: [permissionGuard], data: { permission: 'report.view' }, loadChildren: () => import('./features/reports/reports.routes').then(m => m.REPORT_ROUTES) },
      { path: 'notifications', title: 'Notifications · Zenovel', data: { title: 'Notifications' }, loadComponent: () => import('./features/notifications/notifications').then(m => m.Notifications) },
      { path: 'settings', title: 'Settings · Zenovel', data: { title: 'Settings' }, loadComponent: () => import('./features/settings/settings').then(m => m.Settings) },
      { path: '**', title: 'Not found · Zenovel', data: { title: 'Page not found' }, loadComponent: () => import('./features/not-found').then(m => m.NotFound) },
    ],
  },
];
