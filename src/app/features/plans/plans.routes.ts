import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

export const PLAN_ROUTES: Routes = [
  { path: '', title: 'Monitoring Plans · Zenovel', data: { title: 'Monitoring Plans' }, loadComponent: () => import('./plan-list/plan-list').then(m => m.PlanList) },
  { path: 'new', title: 'Create Monitoring Plan · Zenovel', canActivate: [permissionGuard], data: { title: 'Create Monitoring Plan', permission: 'plan.manage' }, loadComponent: () => import('./plan-wizard/plan-wizard').then(m => m.PlanWizard) },
  { path: ':id', title: 'Monitoring Plan · Zenovel', data: { title: 'Monitoring Plan' }, loadComponent: () => import('./plan-detail/plan-detail').then(m => m.PlanDetail) },
  { path: ':id/edit', title: 'Edit Monitoring Plan · Zenovel', canActivate: [permissionGuard], data: { title: 'Edit Monitoring Plan', permission: 'plan.manage' }, loadComponent: () => import('./plan-wizard/plan-wizard').then(m => m.PlanWizard) },
];
