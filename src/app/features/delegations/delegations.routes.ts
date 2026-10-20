import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

export const DELEGATION_ROUTES: Routes = [
  { path: '', title: 'Training & Delegation · Zenovel', data: { title: 'Training & Delegation' }, loadComponent: () => import('./delegation-list/delegation-list').then(m => m.DelegationList) },
  { path: 'new', title: 'Create Delegation · Zenovel', canActivate: [permissionGuard], data: { title: 'Create Delegation Record', permission: 'delegation.manage' }, loadComponent: () => import('./delegation-form/delegation-form').then(m => m.DelegationForm) },
  { path: ':id', title: 'Delegation · Zenovel', data: { title: 'Delegation Record' }, loadComponent: () => import('./delegation-detail/delegation-detail').then(m => m.DelegationDetail) },
  { path: ':id/edit', title: 'Edit Delegation · Zenovel', canActivate: [permissionGuard], data: { title: 'Edit Delegation Record', permission: 'delegation.manage' }, loadComponent: () => import('./delegation-form/delegation-form').then(m => m.DelegationForm) },
];
