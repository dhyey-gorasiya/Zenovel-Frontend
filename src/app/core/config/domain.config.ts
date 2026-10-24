import {
  AssignmentStatus,
  AuthorizationStatus,
  Blinding,
  CheckpointStatus,
  CommunicationChannel,
  MonitorDuty,
  PlanStatus,
  PlanVisit,
  PlanVisitType,
  ProjectStatus,
  ReportStatus,
  SponsorReviewStatus,
  StudyType,
} from '../models';

export const STUDY_TYPES: StudyType[] = ['Clinical Trial', 'BA/BE'];
export const BLINDING_TYPES: Blinding[] = ['Open label', 'Blind'];
export const PROJECT_STATUSES: ProjectStatus[] = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];
export const PLAN_STATUSES: PlanStatus[] = ['Draft', 'In PM Review', 'Final Saved', 'Pending HOD Approval', 'HOD Approved', 'Rejected', 'Approved'];
export const SPONSOR_REVIEW_STATUSES: SponsorReviewStatus[] = ['Not Submitted', 'Pending', 'Changes Requested', 'Approved', 'Direct Sign'];
export const AUTHORIZATION_STATUSES: AuthorizationStatus[] = ['Not Requested', 'Pending', 'Authorized', 'Rejected'];
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['Planned', 'Notified', 'Acknowledged', 'Completed', 'Cancelled'];
export const REPORT_STATUSES: ReportStatus[] = ['Draft', 'In Review', 'Changes Requested', 'Approved'];

/** "Type of Monitoring Visit" list from the workbook (Up to MP / Monitor assign sheets). */
export const VISIT_TYPES = [
  'SIV',
  'P01 Check In',
  'P01 Dosing',
  'P02 Check In',
  'P02 Dosing',
  'P03 Check In',
  'P03 Dosing',
  'P04 Check In',
  'P04 Dosing',
  'IMV-1/IMV-2',
  'IPBM',
  'RTBM',
  'QA Visit',
  'SCV',
] as const;

/** "Strategy and Scope of Monitoring" visit table defaults from the workbook. */
export const DEFAULT_PLAN_VISITS: PlanVisit[] = [
  { visitType: 'Site Initiation Visit', days: 1, applicable: true, remote: false, comments: '' },
  { visitType: 'Check In and Dosing Day (Period 01)', days: 2, applicable: true, remote: false, comments: '' },
  { visitType: 'Check In and Dosing Day (Period 02)', days: 2, applicable: true, remote: false, comments: '' },
  { visitType: 'In-Process Bioanalytical / Phase', days: 2, applicable: false, remote: false, comments: '' },
  { visitType: 'Retrospective Bioanalytical / Phase', days: 2, applicable: false, remote: false, comments: '' },
  { visitType: 'Site Closeout Visit', days: 1, applicable: true, remote: false, comments: '' },
];

/** "Checkpoints" options of the Type of Monitoring Visit table. */
export const CHECKPOINT_STATUSES: CheckpointStatus[] = ['Yes', 'No', 'N/A'];

export const defaultPlanVisitTypes = (): PlanVisitType[] =>
  VISIT_TYPES.map(visitType => ({ visitType, applicable: false, checkpointStatus: '', checkpoints: '' }));

/** Placeholder SOP references. Replace with the client's controlled SOP list. */
export const ZENOVEL_SOPS = [
  'SOP-01 Clinical Monitoring (placeholder)',
  'SOP-02 Communication and Escalation (placeholder)',
  'SOP-03 Document Management and Archival (placeholder)',
];

export const COMMUNICATION_CHANNELS: CommunicationChannel[] = [
  'Zenovel CRA',
  'Zenovel Project Manager',
  'Zenovel Back Up Project Manager',
  'Zenovel Management',
  'Sponsor',
];

/** Monitor duties per study blinding, as defined on the Training and Delegation sheet. */
export const DUTIES_BY_BLINDING: Record<Blinding, MonitorDuty[]> = {
  'Open label': ['Primary', 'Secondary'],
  Blind: ['Primary Unblinded', 'Secondary Unblinded', 'Primary Blinded', 'Secondary Blinded'],
};

/** "Type of Study" descriptions from the Training and Delegation sheet. */
export const BLINDING_DESCRIPTIONS: Record<Blinding, string> = {
  'Open label': 'If Open Label is selected, Training and Delegation only requires the Primary Monitor and Secondary Monitor.',
  Blind: 'If any blind study is selected, Training and Delegation requires the Primary Unblinded Monitor, Secondary Unblinded Monitor, Primary Blinded Monitor and Secondary Blinded Monitor.',
};

/** Column groups of the "Delegation of Monitor(s)" grid on the sheet. */
export const DUTY_GROUPS: { label: string; blinding: Blinding; duties: MonitorDuty[] }[] = [
  { label: 'Duty (Open Label)', blinding: 'Open label', duties: DUTIES_BY_BLINDING['Open label'] },
  { label: 'Duty (Blind)', blinding: 'Blind', duties: DUTIES_BY_BLINDING.Blind },
];

/**
 * Duties that must be filled before a delegation can be saved.
 * Assumption: the workbook does not state which duties are mandatory, so only primary duties are required.
 */
export const REQUIRED_DUTIES: MonitorDuty[] = ['Primary', 'Primary Unblinded', 'Primary Blinded'];

export const isBlindedDuty = (d: MonitorDuty) => d === 'Primary Blinded' || d === 'Secondary Blinded';
export const isUnblindedDuty = (d: MonitorDuty) => d === 'Primary Unblinded' || d === 'Secondary Unblinded';

export const RISK_CATEGORIES = [
  'Subject Safety',
  'Data Integrity',
  'Protocol Compliance',
  'Investigational Product',
  'Bioanalytical',
  'Informed Consent',
  'Site Operations',
  'Regulatory / Documentation',
  'Other',
];

export const RISK_SCALE = [1, 2, 3, 4, 5];

export const RESPONSIBLE_ROLES = ['Project Manager', 'Primary Monitor', 'Secondary Monitor', 'Site Staff', 'Sponsor', 'QA', 'Other'];
