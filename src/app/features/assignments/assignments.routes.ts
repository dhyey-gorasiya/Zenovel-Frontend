import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

export const ASSIGNMENT_ROUTES: Routes = [
  { path: '', title: 'Monitor Assignments · Zenovel', data: { title: 'Monitor Assignments' }, loadComponent: () => import('./assignment-list/assignment-list').then(m => m.AssignmentList) },
  { path: 'new', title: 'Assign Monitor · Zenovel', canActivate: [permissionGuard], data: { title: 'Assign Monitor', permission: 'assignment.manage' }, loadComponent: () => import('./assignment-form/assignment-form').then(m => m.AssignmentForm) },
  { path: ':id', title: 'Assignment · Zenovel', data: { title: 'Monitor Assignment' }, loadComponent: () => import('./assignment-detail/assignment-detail').then(m => m.AssignmentDetail) },
  { path: ':id/edit', title: 'Edit Assignment · Zenovel', canActivate: [permissionGuard], data: { title: 'Edit Assignment', permission: 'assignment.manage' }, loadComponent: () => import('./assignment-form/assignment-form').then(m => m.AssignmentForm) },
];
