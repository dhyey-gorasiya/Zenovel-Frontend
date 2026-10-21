import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

export const PROJECT_ROUTES: Routes = [
  { path: '', title: 'Projects · Zenovel', data: { title: 'Projects' }, loadComponent: () => import('./project-list/project-list').then(m => m.ProjectList) },
  { path: 'new', title: 'Create Project · Zenovel', canActivate: [permissionGuard], data: { title: 'Create Project', permission: 'project.manage' }, loadComponent: () => import('./project-form/project-form').then(m => m.ProjectForm) },
  { path: ':id', title: 'Project · Zenovel', data: { title: 'Project Details' }, loadComponent: () => import('./project-detail/project-detail').then(m => m.ProjectDetail) },
  { path: ':id/edit', title: 'Edit Project · Zenovel', canActivate: [permissionGuard], data: { title: 'Edit Project', permission: 'project.manage' }, loadComponent: () => import('./project-form/project-form').then(m => m.ProjectForm) },
  { path: ':id/details', title: 'Complete Project Details · Zenovel', canActivate: [permissionGuard], data: { title: 'Complete Project Details', permission: 'project.completeDetails', mode: 'details' }, loadComponent: () => import('./project-form/project-form').then(m => m.ProjectForm) },
];
