/** Domain model for the Zenovel prototype. All records are fictional demo data. */

export interface Entity {
  id: string;
  updatedAt: string;
}

export type Role = 'Project Manager' | 'Monitor' | 'HOD/VP' | 'Sponsor';

export interface User extends Entity {
  name: string;
  email: string;
  /** Prototype-only credential. Real authentication will replace this. */
  password: string;
  role: Role;
  title: string;
  organization: string;
}

export type SessionUser = Omit<User, 'password'>;

export interface FileMeta {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  /** Key of the stored file contents (`FileContentStore`); absent when only metadata was kept. */
  contentId?: string;
}

export interface SimSignature {
  userId: string;
  typedName: string;
  at: string;
}

export interface HistoryEntry {
  at: string;
  byId: string;
  byName: string;
  text: string;
}

export interface ReviewEntry {
  id: string;
  at: string;
  byId: string;
  byName: string;
  role: Role;
  action: string;
  comment: string;
}

/* ---------- Projects ---------- */

export type StudyType = 'Clinical Trial' | 'BA/BE';
export type Blinding = 'Open label' | 'Blind';
export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled';

export interface PartyDetails {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

export interface ScopeVisit {
  visitType: string;
  days: number;
}

export interface ScopeOfWork {
  monitoring: boolean;
  monitoringDetails: string;
  visits: ScopeVisit[];
  audit: boolean;
  auditDetails: string;
  auditDays: number | null;
  auditors: number | null;
}

export interface Project extends Entity {
  name: string;
  protocolNo: string;
  protocolTitle: string;
  zenovelProjectNo: string;
  sponsorProjectNo: string;
  studyType: StudyType;
  blinding: Blinding;
  sponsor: PartyDetails;
  cro: PartyDetails;
  projectManagerId: string;
  backupProjectManagerId: string;
  startDate: string;
  endDate: string;
  scope: ScopeOfWork;
  status: ProjectStatus;
  description: string;
  notes: string;
  protocolDocument: FileMeta | null;
  createdAt: string;
  createdById: string;
}

/* ---------- Monitoring Plans ---------- */

/**
 * 'HOD Approved' = HOD signed on the Direct Sign route and the sponsor signature is pending.
 * Plans persisted before this workflow may also carry it with any sponsor review state.
 */
export type PlanStatus = 'Draft' | 'In PM Review' | 'Final Saved' | 'Pending HOD Approval' | 'HOD Approved' | 'Rejected' | 'Approved';
/** 'Direct Sign' marks the Direct Sign route (no sponsor comment loop) until the sponsor signs. */
export type SponsorReviewStatus = 'Not Submitted' | 'Pending' | 'Changes Requested' | 'Approved' | 'Direct Sign';

/*
 * Optional ticks on plan records (`remote`, `checkpointStatus`, `additionalVisit`, `*Applicable`)
 * are absent on plans saved before the template sheet's tick fields were added.
 */

export interface PlanVisit {
  visitType: string;
  /** Onsite number of days. */
  days: number;
  applicable: boolean;
  remote?: boolean;
  comments: string;
}

export type CheckpointStatus = 'Yes' | 'No' | 'N/A';

export interface PlanVisitType {
  visitType: string;
  applicable: boolean;
  checkpointStatus?: CheckpointStatus | '';
  /** Checkpoint notes. */
  checkpoints: string;
}

export type CommunicationChannel =
  | 'Zenovel CRA'
  | 'Zenovel Project Manager'
  | 'Zenovel Back Up Project Manager'
  | 'Zenovel Management'
  | 'Sponsor';

export interface CommunicationContact {
  channel: CommunicationChannel;
  name: string;
  details: string;
}

export interface RiskItem {
  id: string;
  description: string;
  category: string;
  severity: number;
  likelihood: number;
  detectability: number;
  mitigation: string;
  responsibleRole: string;
  milestone: string;
  indicators: string;
  escalationTriggers: string;
  residualRisk: string;
  sourceRef: string;
  aiGenerated: boolean;
}

export interface ProtocolSummaryItem {
  id: string;
  heading: string;
  summary: string;
  sourceSection: string;
  aiGenerated: boolean;
}

export interface MonitoringPlan extends Entity {
  projectId: string;
  version: string;
  protocolVersionNo: string;
  protocolVersionDate: string;
  amendmentDetails: string;
  regulatoryGuideline: string;
  referenceProductInfo: string;
  sops: string[];
  scopeOfWork: string;
  monitoringApproach: string;
  onsite: boolean;
  remote: boolean;
  visitFrequency: string;
  visitDuration: string;
  communicationMethods: string;
  monitoringSchedule: string;
  otherRequirements: string;
  visitPlan: PlanVisit[];
  additionalVisit?: boolean;
  additionalVisitNote: string;
  visitTypes: PlanVisitType[];
  communicationAmongTeam: boolean;
  communicationWithSponsor: boolean;
  gradingOfObservations: boolean;
  contacts: CommunicationContact[];
  risks: RiskItem[];
  protocolSummary: ProtocolSummaryItem[];
  observationGrading: string;
  reportTimelineApplicable?: boolean;
  reportTimeline: string;
  documentSharingApplicable?: boolean;
  documentSharing: string;
  archivingApplicable?: boolean;
  archiving: string;
  communicationProcedures: string;
  additionalProcedures: string;
  protocolDocument: FileMeta | null;
  templateDocument: FileMeta | null;
  status: PlanStatus;
  sponsorReview: SponsorReviewStatus;
  sponsorTo: string;
  sponsorCc: string;
  reviews: ReviewEntry[];
  createdById: string;
  createdByName: string;
  createdAt: string;
}

/* ---------- Training & Delegation ---------- */

export type MonitorDuty =
  | 'Primary'
  | 'Secondary'
  | 'Primary Unblinded'
  | 'Secondary Unblinded'
  | 'Primary Blinded'
  | 'Secondary Blinded';

export interface DelegatedMonitor {
  duty: MonitorDuty;
  monitorId: string;
}

export interface Attendee {
  userId: string;
  name: string;
  details: string;
}

export type AckState = 'Not Sent' | 'Pending' | 'Acknowledged' | 'Declined';

export interface Acknowledgement {
  monitorId: string;
  duties: MonitorDuty[];
  state: AckState;
  notifiedAt: string | null;
  respondedAt: string | null;
  signature: SimSignature | null;
  declineReason: string;
}

export type AuthorizationStatus = 'Not Requested' | 'Pending' | 'Authorized' | 'Rejected';

export interface Delegation extends Entity {
  projectId: string;
  planId: string;
  protocolVersionDetails: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  attendees: Attendee[];
  conductedBy: Attendee[];
  discussionDetails: string;
  delegatedResponsibilities: string;
  notes: string;
  monitors: DelegatedMonitor[];
  acknowledgements: Acknowledgement[];
  authorization: AuthorizationStatus;
  authorizationRequestedAt: string | null;
  authorizationSignature: SimSignature | null;
  authorizationComment: string;
  history: HistoryEntry[];
  createdById: string;
  createdAt: string;
}

/* ---------- Monitor Assignments ---------- */

export type AssignmentStatus = 'Planned' | 'Notified' | 'Acknowledged' | 'Completed' | 'Cancelled';

export interface MonitorAssignment extends Entity {
  projectId: string;
  visitType: string;
  monitorId: string;
  monitorEmail: string;
  visitDate: string;
  planId: string | null;
  reportId: string | null;
  notes: string;
  status: AssignmentStatus;
  notifiedAt: string | null;
  acknowledgedAt: string | null;
  history: HistoryEntry[];
  createdById: string;
  createdAt: string;
}

/* ---------- Monitoring Reports (provisional structure) ---------- */

export type ReportStatus = 'Draft' | 'In Review' | 'Changes Requested' | 'Approved';

export interface Finding {
  id: string;
  category: string;
  description: string;
  grade: string;
}

export interface Deviation {
  id: string;
  description: string;
  reference: string;
}

export interface CapaItem {
  id: string;
  action: string;
  responsiblePerson: string;
  targetDate: string;
  status: 'Open' | 'Closed';
}

export interface ReportContent {
  visitSummary: string;
  observations: string;
  findings: Finding[];
  deviations: Deviation[];
  capa: CapaItem[];
  supportingNotes: string;
  conclusion: string;
}

export interface ReportVersion {
  version: number;
  at: string;
  byName: string;
  status: ReportStatus;
  note: string;
  content: ReportContent;
}

export interface MonitoringReport extends Entity, ReportContent {
  projectId: string;
  planId: string | null;
  assignmentId: string | null;
  visitType: string;
  visitDate: string;
  monitorId: string;
  status: ReportStatus;
  version: number;
  reviews: ReviewEntry[];
  versions: ReportVersion[];
  createdById: string;
  createdAt: string;
}

/* ---------- Notifications, activity, simulated email ---------- */

export type EntityType = 'Project' | 'Monitoring Plan' | 'Delegation' | 'Assignment' | 'Report' | 'System';

export interface AppNotification extends Entity {
  /** Event key used to prevent duplicate notifications for the same event. */
  key: string;
  recipientId: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityItem extends Entity {
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  projectId: string | null;
  text: string;
}

/* ---------- Project audit log ---------- */

export type AuditAction = 'Created' | 'Updated' | 'Deleted';

/** Display values are captured at save time so the log stays accurate after users or projects change. */
export interface AuditFieldChange {
  field: string;
  label: string;
  previous: string;
  current: string;
}

export interface ProjectAuditEntry extends Entity {
  at: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  projectId: string;
  projectName: string;
  changes: AuditFieldChange[];
}

export interface EmailDraft {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  projectId: string | null;
  entityType: EntityType;
  entityId: string;
  link: string;
}

export interface SimulatedEmail extends Entity, EmailDraft {
  sentAt: string;
  sentById: string;
  sentByName: string;
}
