import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

export const REPORT_ROUTES: Routes = [
  { path: '', title: 'Monitoring Reports · Zenovel', data: { title: 'Monitoring Reports' }, loadComponent: () => import('./report-list/report-list').then(m => m.ReportList) },
  { path: 'new', title: 'Create Monitoring Report · Zenovel', canActivate: [permissionGuard], data: { title: 'Create Monitoring Report', permission: 'report.prepare' }, loadComponent: () => import('./report-form/report-form').then(m => m.ReportForm) },
  { path: ':id', title: 'Monitoring Report · Zenovel', data: { title: 'Monitoring Report' }, loadComponent: () => import('./report-detail/report-detail').then(m => m.ReportDetail) },
  { path: ':id/edit', title: 'Edit Monitoring Report · Zenovel', canActivate: [permissionGuard], data: { title: 'Edit Monitoring Report', permission: 'report.prepare' }, loadComponent: () => import('./report-form/report-form').then(m => m.ReportForm) },
  { path: ':id/print', title: 'Print Report · Zenovel', data: { title: 'Printable Report' }, loadComponent: () => import('./report-print/report-print').then(m => m.ReportPrint) },
];
