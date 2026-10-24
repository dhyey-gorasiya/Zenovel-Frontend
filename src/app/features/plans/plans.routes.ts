import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { MonitoringPlanService } from '../../core/services/monitoring-plan.service';

/** The plan is prepared inside the project's Complete details form; older plan form links land there. */
const projectPlanForm = (projectId: string | undefined) =>
  projectId ? inject(Router).createUrlTree(['/projects', projectId, 'details'], { queryParams: { tab: 'plan' } }) : inject(Router).createUrlTree(['/projects']);

export const PLAN_ROUTES: Routes = [
  { path: '', title: 'Monitoring Plans · Zenovel', data: { title: 'Monitoring Plans' }, loadComponent: () => import('./plan-list/plan-list').then(m => m.PlanList) },
  { path: 'new', redirectTo: ({ queryParams }) => projectPlanForm(queryParams['projectId']) },
  { path: ':id', title: 'Monitoring Plan · Zenovel', data: { title: 'Monitoring Plan' }, loadComponent: () => import('./plan-detail/plan-detail').then(m => m.PlanDetail) },
  { path: ':id/edit', redirectTo: ({ params }) => projectPlanForm(inject(MonitoringPlanService).get(params['id'])?.projectId) },
];
