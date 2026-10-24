import { Role } from '../models';

export const PERMISSIONS = [
  { key: 'project.view', label: 'View projects', group: 'Projects' },
  { key: 'project.manage', label: 'Create / edit / delete projects', group: 'Projects' },
  { key: 'project.completeDetails', label: 'Complete project details (assigned PM)', group: 'Projects' },
  { key: 'plan.view', label: 'View monitoring plans', group: 'Monitoring Plans' },
  { key: 'plan.manage', label: 'Create / edit / delete plans', group: 'Monitoring Plans' },
  { key: 'plan.pmReview', label: 'PM review and final save', group: 'Monitoring Plans' },
  { key: 'plan.hodApprove', label: 'HOD approve / reject plans', group: 'Monitoring Plans' },
  { key: 'plan.sendToSponsor', label: 'Share plan with sponsor', group: 'Monitoring Plans' },
  { key: 'plan.sponsorReview', label: 'Sponsor review and feedback', group: 'Monitoring Plans' },
  { key: 'delegation.view', label: 'View delegation records', group: 'Training & Delegation' },
  { key: 'delegation.manage', label: 'Create / edit / delete delegations', group: 'Training & Delegation' },
  { key: 'delegation.acknowledge', label: 'Acknowledge own delegated duties', group: 'Training & Delegation' },
  { key: 'delegation.requestAuthorization', label: 'Initiate HOD/VP authorization', group: 'Training & Delegation' },
  { key: 'delegation.authorize', label: 'Authorize / reject delegation', group: 'Training & Delegation' },
  { key: 'assignment.view', label: 'View monitor assignments', group: 'Monitor Assignments' },
  { key: 'assignment.manage', label: 'Create / edit / delete assignments', group: 'Monitor Assignments' },
  { key: 'assignment.acknowledge', label: 'Mark assignment acknowledged', group: 'Monitor Assignments' },
  { key: 'report.view', label: 'View monitoring reports', group: 'Monitoring Reports' },
  { key: 'report.prepare', label: 'Prepare and submit reports', group: 'Monitoring Reports' },
  { key: 'report.review', label: 'Approve / request changes', group: 'Monitoring Reports' },
  { key: 'report.delete', label: 'Delete any report', group: 'Monitoring Reports' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];

export const ROLES: Role[] = ['Project Manager', 'Monitor', 'HOD/VP', 'Sponsor'];

/** Fixed by role (not the editable matrix) so the matrix editor can't lock HOD out or grant itself to others. */
export const SETTINGS_ROLES: Role[] = ['HOD/VP'];

/**
 * Default demo capabilities. The workbook does not define every permission,
 * so this matrix is editable in Settings and persisted in the browser.
 */
export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  'Project Manager': [
    'project.view', 'project.completeDetails',
    'plan.view', 'plan.manage', 'plan.pmReview', 'plan.sendToSponsor',
    'delegation.view', 'delegation.manage', 'delegation.requestAuthorization',
    'assignment.view', 'assignment.manage', 'assignment.acknowledge',
    'report.view', 'report.review', 'report.delete',
  ],
  Monitor: [
    'project.view', 'plan.view',
    'delegation.view', 'delegation.acknowledge',
    'assignment.view', 'assignment.acknowledge',
    'report.view', 'report.prepare',
  ],
  'HOD/VP': [
    'project.view', 'project.manage', 'plan.view', 'plan.hodApprove',
    'delegation.view', 'delegation.authorize',
    'assignment.view', 'report.view',
  ],
  Sponsor: ['project.view', 'plan.view', 'plan.sponsorReview'],
};
