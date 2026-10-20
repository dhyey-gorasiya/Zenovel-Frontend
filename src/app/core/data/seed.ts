/**
 * Fictional demo data. No real patients, sponsors, studies or clinical results.
 * Dates are relative to "now" so the demo always has upcoming and past visits.
 */
import { DEFAULT_PLAN_VISITS, defaultPlanVisitTypes } from '../config/domain.config';
import {
  Acknowledgement,
  ActivityItem,
  AppNotification,
  Delegation,
  MonitorAssignment,
  MonitoringPlan,
  MonitoringReport,
  PartyDetails,
  Project,
  ReportContent,
  SimulatedEmail,
  User,
} from '../models';

const at = (days: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const day = (days: number) => at(days).slice(0, 10);

export const DEMO_PASSWORD = 'Zenovel@123';

export const seedUsers = (): User[] => [
  { id: 'USR-001', name: 'Vivek Patel', email: 'vivek.patel@zenovel.test', password: DEMO_PASSWORD, role: 'Project Manager', title: 'Senior Project Manager', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-002', name: 'Neha Joshi', email: 'neha.joshi@zenovel.test', password: DEMO_PASSWORD, role: 'Project Manager', title: 'Project Manager', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-003', name: 'Sanjay Mehta', email: 'sanjay.mehta@zenovel.test', password: DEMO_PASSWORD, role: 'Project Manager', title: 'Back-up Project Manager', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-004', name: 'Anita Rao', email: 'anita.rao@zenovel.test', password: DEMO_PASSWORD, role: 'Monitor', title: 'Clinical Research Associate', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-005', name: 'Rahul Shah', email: 'rahul.shah@zenovel.test', password: DEMO_PASSWORD, role: 'Monitor', title: 'Clinical Research Associate', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-006', name: 'Meera Iyer', email: 'meera.iyer@zenovel.test', password: DEMO_PASSWORD, role: 'Monitor', title: 'Senior CRA', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-007', name: 'Karan Desai', email: 'karan.desai@zenovel.test', password: DEMO_PASSWORD, role: 'Monitor', title: 'Clinical Research Associate', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-008', name: 'Priya Nair', email: 'priya.nair@zenovel.test', password: DEMO_PASSWORD, role: 'Monitor', title: 'Senior CRA', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-009', name: 'Dr. Arvind Kulkarni', email: 'arvind.kulkarni@zenovel.test', password: DEMO_PASSWORD, role: 'HOD/VP', title: 'Head of Clinical Operations', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-010', name: 'Shalini Verma', email: 'shalini.verma@zenovel.test', password: DEMO_PASSWORD, role: 'HOD/VP', title: 'VP, Clinical Services', organization: 'Zenovel', updatedAt: at(-90) },
  { id: 'USR-011', name: 'Laura Mendes', email: 'laura.mendes@altavia.example', password: DEMO_PASSWORD, role: 'Sponsor', title: 'Clinical Lead', organization: 'Altavia Pharma', updatedAt: at(-90) },
  { id: 'USR-012', name: 'Daniel Brooks', email: 'daniel.brooks@helixon.example', password: DEMO_PASSWORD, role: 'Sponsor', title: 'Study Director', organization: 'Helixon Labs', updatedAt: at(-90) },
  { id: 'USR-013', name: 'Sofia Kim', email: 'sofia.kim@medora.example', password: DEMO_PASSWORD, role: 'Sponsor', title: 'QA Manager', organization: 'Medora Generics', updatedAt: at(-90) },
];

const ALTAVIA: PartyDetails = { name: 'Altavia Pharma', contactPerson: 'Laura Mendes', email: 'laura.mendes@altavia.example', phone: '+1 555 0101', address: '12 Harbor Road, Fictional City' };
const HELIXON: PartyDetails = { name: 'Helixon Labs', contactPerson: 'Daniel Brooks', email: 'daniel.brooks@helixon.example', phone: '+1 555 0144', address: '88 Lake Avenue, Sample Town' };
const MEDORA: PartyDetails = { name: 'Medora Generics', contactPerson: 'Sofia Kim', email: 'sofia.kim@medora.example', phone: '+1 555 0177', address: '4 Garden Street, Demo Park' };
const CLINBRIDGE: PartyDetails = { name: 'ClinBridge CRO', contactPerson: 'Ravi Kumar', email: 'ravi.kumar@clinbridge.example', phone: '+91 00000 11111', address: 'Plot 7, Example Industrial Estate' };
const TRIALAXIS: PartyDetails = { name: 'TrialAxis CRO', contactPerson: 'Elena Novak', email: 'elena.novak@trialaxis.example', phone: '+91 00000 22222', address: 'Tower B, Placeholder Business Park' };

const project = (p: Partial<Project> & Pick<Project, 'id' | 'name'>): Project => ({
  protocolNo: '',
  protocolTitle: '',
  zenovelProjectNo: '',
  sponsorProjectNo: '',
  studyType: 'BA/BE',
  blinding: 'Open label',
  sponsor: ALTAVIA,
  cro: CLINBRIDGE,
  projectManagerId: 'USR-001',
  backupProjectManagerId: 'USR-003',
  startDate: day(-30),
  endDate: day(180),
  scope: { monitoring: true, monitoringDetails: '', visits: [], audit: false, auditDetails: '', auditDays: null, auditors: null },
  status: 'Active',
  description: '',
  notes: 'Fictional demo record.',
  protocolDocument: null,
  createdAt: at(-60),
  createdById: 'USR-001',
  updatedAt: at(-2),
  ...p,
});

export const seedProjects = (): Project[] => [
  project({
    id: 'PRJ-001', name: 'Nexora BE Study', protocolNo: 'CRO-BE-2201', zenovelProjectNo: 'ZEN-2201', sponsorProjectNo: 'ALT-77',
    protocolTitle: 'Open-label, two-period crossover fasting BE study of Drug A 10 mg tablets (fictional)',
    studyType: 'BA/BE', blinding: 'Open label', sponsor: ALTAVIA, cro: CLINBRIDGE, projectManagerId: 'USR-001', backupProjectManagerId: 'USR-003',
    startDate: day(-40), endDate: day(150), status: 'Active',
    scope: { monitoring: true, monitoringDetails: 'Onsite monitoring per plan', visits: [{ visitType: 'SIV', days: 1 }, { visitType: 'P01 Check In', days: 2 }, { visitType: 'P02 Check In', days: 2 }], audit: false, auditDetails: '', auditDays: null, auditors: null },
    description: 'Pivotal BE study for a generic tablet formulation (fictional).',
    protocolDocument: { name: 'CRO-BE-2201_Protocol_v1.0.pdf', size: 482113, type: 'application/pdf', uploadedAt: at(-55) },
    updatedAt: at(-2),
  }),
  project({
    id: 'PRJ-002', name: 'Cardiva Phase II', protocolNo: 'CRO-CT-3310', zenovelProjectNo: 'ZEN-3310', sponsorProjectNo: 'HLX-12',
    protocolTitle: 'Randomized, double-blind, placebo-controlled phase II study of Drug B (fictional)',
    studyType: 'Clinical Trial', blinding: 'Blind', sponsor: HELIXON, cro: TRIALAXIS, projectManagerId: 'USR-002', backupProjectManagerId: 'USR-003',
    startDate: day(-10), endDate: day(400), status: 'Active',
    scope: { monitoring: true, monitoringDetails: 'Monitoring and audit', visits: [{ visitType: 'SIV', days: 1 }, { visitType: 'IMV-1/IMV-2', days: 2 }], audit: true, auditDetails: 'Site audit', auditDays: 3, auditors: 2 },
    updatedAt: at(-1),
  }),
  project({
    id: 'PRJ-003', name: 'Orvexa BE Replicate', protocolNo: 'CRO-BE-2307', zenovelProjectNo: 'ZEN-2307', sponsorProjectNo: 'MED-05',
    protocolTitle: 'Replicate-design BE study of Drug C capsules (fictional)',
    studyType: 'BA/BE', blinding: 'Open label', sponsor: MEDORA, cro: CLINBRIDGE, projectManagerId: 'USR-003', backupProjectManagerId: 'USR-001',
    startDate: day(-200), endDate: day(-20), status: 'Completed',
    scope: { monitoring: true, monitoringDetails: 'Full monitoring', visits: [{ visitType: 'SIV', days: 1 }, { visitType: 'SCV', days: 1 }], audit: false, auditDetails: '', auditDays: null, auditors: null },
    updatedAt: at(-20),
  }),
  project({
    id: 'PRJ-004', name: 'Lumira Fed BE Study', protocolNo: 'CRO-BE-2412', zenovelProjectNo: 'ZEN-2412', sponsorProjectNo: 'ALT-81',
    protocolTitle: 'Open-label fed-condition BE study of Drug D 5 mg tablets (fictional)',
    studyType: 'BA/BE', blinding: 'Open label', sponsor: ALTAVIA, cro: CLINBRIDGE, projectManagerId: 'USR-001', backupProjectManagerId: 'USR-002',
    startDate: day(20), endDate: day(220), status: 'Planning', updatedAt: at(-4),
  }),
  project({
    id: 'PRJ-005', name: 'Veltrix Phase III', protocolNo: 'CRO-CT-3402', zenovelProjectNo: 'ZEN-3402', sponsorProjectNo: 'HLX-20',
    protocolTitle: 'Double-blind, active-controlled phase III study of Drug E (fictional)',
    studyType: 'Clinical Trial', blinding: 'Blind', sponsor: HELIXON, cro: TRIALAXIS, projectManagerId: 'USR-001', backupProjectManagerId: 'USR-002',
    startDate: day(-25), endDate: day(500), status: 'Active',
    scope: { monitoring: true, monitoringDetails: 'Blinded and unblinded monitoring', visits: [{ visitType: 'SIV', days: 1 }, { visitType: 'IMV-1/IMV-2', days: 2 }], audit: false, auditDetails: '', auditDays: null, auditors: null },
    updatedAt: at(-3),
  }),
  project({
    id: 'PRJ-006', name: 'Sanovia Pilot BE', protocolNo: 'CRO-BE-2455', zenovelProjectNo: 'ZEN-2455', sponsorProjectNo: 'MED-09',
    protocolTitle: 'Pilot BE study of Drug F oral suspension (fictional)',
    studyType: 'BA/BE', blinding: 'Open label', sponsor: MEDORA, cro: TRIALAXIS, projectManagerId: 'USR-002', backupProjectManagerId: 'USR-001',
    startDate: day(-5), endDate: day(120), status: 'On Hold', notes: 'On hold pending sponsor feedback (fictional).', updatedAt: at(-6),
  }),
];

const plan = (p: Partial<MonitoringPlan> & Pick<MonitoringPlan, 'id' | 'projectId'>): MonitoringPlan => ({
  version: '1.0',
  protocolVersionNo: '1.0',
  protocolVersionDate: day(-70),
  amendmentDetails: 'None',
  regulatoryGuideline: 'ICH E6 (GCP) — placeholder reference',
  referenceProductInfo: 'Reference product details to be confirmed (fictional)',
  sops: ['SOP-01 Clinical Monitoring (placeholder)'],
  scopeOfWork: 'Monitoring of study conduct as per contract (fictional).',
  monitoringApproach: 'Risk-based, combined onsite and remote monitoring.',
  onsite: true,
  remote: true,
  visitFrequency: 'Per study period',
  visitDuration: '1–2 days per visit',
  communicationMethods: 'Email, teleconference',
  monitoringSchedule: 'Aligned with check-in and dosing days',
  otherRequirements: '',
  visitPlan: DEFAULT_PLAN_VISITS.map(v => ({ ...v })),
  additionalVisitNote: '',
  visitTypes: defaultPlanVisitTypes().map(v => (['SIV', 'P01 Check In', 'P01 Dosing', 'SCV'].includes(v.visitType) ? { ...v, applicable: true, checkpoints: 'Standard checklist (placeholder)' } : v)),
  communicationAmongTeam: true,
  communicationWithSponsor: true,
  gradingOfObservations: true,
  contacts: [
    { channel: 'Zenovel Project Manager', name: 'Vivek Patel', details: 'Primary contact' },
    { channel: 'Sponsor', name: 'Laura Mendes', details: 'laura.mendes@altavia.example' },
  ],
  risks: [
    { id: 'R-1', description: 'Delayed reporting of adverse events by site staff', category: 'Subject Safety', severity: 5, likelihood: 2, detectability: 3, mitigation: 'Retrain site staff at SIV; review AE logs at each visit', responsibleRole: 'Primary Monitor', milestone: 'SIV', indicators: 'AE reporting timeliness', escalationTriggers: 'Any AE reported late', residualRisk: 'Low', sourceRef: 'Refer protocol Section No. (to be confirmed)', aiGenerated: false },
  ],
  protocolSummary: [],
  observationGrading: 'Critical / Major / Minor (configurable)',
  reportTimeline: 'Report within 5 working days of visit (placeholder)',
  documentSharing: 'Shared via controlled document system (placeholder)',
  archiving: 'Archive in trial master file at study close (placeholder)',
  communicationProcedures: 'Escalate critical findings to PM within 24 hours (placeholder)',
  additionalProcedures: '',
  protocolDocument: null,
  templateDocument: null,
  status: 'Draft',
  sponsorReview: 'Not Submitted',
  sponsorTo: '',
  sponsorCc: '',
  reviews: [],
  createdById: 'USR-001',
  createdByName: 'Vivek Patel',
  createdAt: at(-30),
  updatedAt: at(-2),
  ...p,
});

export const seedPlans = (): MonitoringPlan[] => [
  plan({
    id: 'MP-001', projectId: 'PRJ-001', version: '1.0', status: 'HOD Approved', sponsorReview: 'Pending',
    sponsorTo: 'laura.mendes@altavia.example', sponsorCc: 'vivek.patel@zenovel.test', createdAt: at(-30), updatedAt: at(-3),
    reviews: [
      { id: 'RV-1', at: at(-8), byId: 'USR-001', byName: 'Vivek Patel', role: 'Project Manager', action: 'Submitted for PM review', comment: '' },
      { id: 'RV-2', at: at(-7), byId: 'USR-001', byName: 'Vivek Patel', role: 'Project Manager', action: 'Final save — prepared by PM', comment: 'Ready for HOD review.' },
      { id: 'RV-3', at: at(-5), byId: 'USR-009', byName: 'Dr. Arvind Kulkarni', role: 'HOD/VP', action: 'HOD approved', comment: 'Approved.' },
      { id: 'RV-4', at: at(-3), byId: 'USR-001', byName: 'Vivek Patel', role: 'Project Manager', action: 'Shared with sponsor for review', comment: 'To: laura.mendes@altavia.example' },
    ],
  }),
  plan({
    id: 'MP-002', projectId: 'PRJ-002', version: '0.2', status: 'Pending HOD Approval', createdById: 'USR-002', createdByName: 'Neha Joshi',
    contacts: [{ channel: 'Zenovel Project Manager', name: 'Neha Joshi', details: 'Primary contact' }], createdAt: at(-12), updatedAt: at(-1),
    reviews: [{ id: 'RV-5', at: at(-1), byId: 'USR-002', byName: 'Neha Joshi', role: 'Project Manager', action: 'Final save — prepared by PM', comment: 'Please review blinded monitoring arrangements.' }],
  }),
  plan({
    id: 'MP-003', projectId: 'PRJ-003', version: '2.0', status: 'Approved', sponsorReview: 'Approved', createdById: 'USR-003', createdByName: 'Sanjay Mehta',
    createdAt: at(-190), updatedAt: at(-150),
    reviews: [
      { id: 'RV-6', at: at(-160), byId: 'USR-009', byName: 'Dr. Arvind Kulkarni', role: 'HOD/VP', action: 'HOD approved', comment: '' },
      { id: 'RV-7', at: at(-150), byId: 'USR-013', byName: 'Sofia Kim', role: 'Sponsor', action: 'Sponsor approved — sign off', comment: 'No further comments.' },
    ],
  }),
  plan({
    id: 'MP-004', projectId: 'PRJ-005', version: '1.0', status: 'Approved', sponsorReview: 'Approved', createdAt: at(-40), updatedAt: at(-20),
    reviews: [
      { id: 'RV-8', at: at(-25), byId: 'USR-010', byName: 'Shalini Verma', role: 'HOD/VP', action: 'HOD approved', comment: '' },
      { id: 'RV-9', at: at(-20), byId: 'USR-012', byName: 'Daniel Brooks', role: 'Sponsor', action: 'Sponsor approved — sign off', comment: '' },
    ],
  }),
  plan({ id: 'MP-005', projectId: 'PRJ-004', version: '0.1', status: 'Draft', risks: [], createdAt: at(-4), updatedAt: at(-4) }),
  plan({
    id: 'MP-006', projectId: 'PRJ-006', version: '1.1', status: 'HOD Approved', sponsorReview: 'Changes Requested', createdById: 'USR-002', createdByName: 'Neha Joshi',
    sponsorTo: 'sofia.kim@medora.example', createdAt: at(-20), updatedAt: at(-6),
    reviews: [
      { id: 'RV-10', at: at(-10), byId: 'USR-009', byName: 'Dr. Arvind Kulkarni', role: 'HOD/VP', action: 'HOD approved', comment: '' },
      { id: 'RV-11', at: at(-6), byId: 'USR-013', byName: 'Sofia Kim', role: 'Sponsor', action: 'Sponsor requested changes', comment: 'Please clarify the archival timeline (fictional feedback).' },
    ],
  }),
  plan({
    id: 'MP-007', projectId: 'PRJ-005', version: '2.0', status: 'In PM Review', amendmentDetails: 'Amendment 1 (fictional)', createdAt: at(-2), updatedAt: at(-1),
    reviews: [{ id: 'RV-12', at: at(-1), byId: 'USR-001', byName: 'Vivek Patel', role: 'Project Manager', action: 'Submitted for PM review', comment: '' }],
  }),
];

const ack = (monitorId: string, duties: Acknowledgement['duties'], state: Acknowledgement['state'], when: number, name = ''): Acknowledgement => ({
  monitorId,
  duties,
  state,
  notifiedAt: state === 'Not Sent' ? null : at(when - 1),
  respondedAt: state === 'Acknowledged' || state === 'Declined' ? at(when) : null,
  signature: state === 'Acknowledged' ? { userId: monitorId, typedName: name, at: at(when) } : null,
  declineReason: state === 'Declined' ? 'Not available for blinded duties during this period (fictional).' : '',
});

const pm = (id: string, name: string) => ({ userId: id, name, details: 'Project Manager' });

export const seedDelegations = (): Delegation[] => [
  {
    id: 'DEL-001', projectId: 'PRJ-001', planId: 'MP-001', protocolVersionDetails: 'Protocol v1.0', meetingDate: day(-6), startTime: '10:00', endTime: '11:00',
    attendees: [pm('USR-001', 'Vivek Patel'), { userId: 'USR-004', name: 'Anita Rao', details: 'CRA' }, { userId: 'USR-005', name: 'Rahul Shah', details: 'CRA' }],
    conductedBy: [pm('USR-001', 'Vivek Patel')],
    discussionDetails: 'Walkthrough of monitoring plan MP-001 and visit schedule (fictional).',
    delegatedResponsibilities: 'Primary: SIV and period visits. Secondary: back-up and source data review.', notes: '',
    monitors: [{ duty: 'Primary', monitorId: 'USR-004' }, { duty: 'Secondary', monitorId: 'USR-005' }],
    acknowledgements: [ack('USR-004', ['Primary'], 'Acknowledged', -5, 'Anita Rao'), ack('USR-005', ['Secondary'], 'Pending', -5)],
    authorization: 'Not Requested', authorizationRequestedAt: null, authorizationSignature: null, authorizationComment: '',
    history: [
      { at: at(-6), byId: 'USR-001', byName: 'Vivek Patel', text: 'Delegation record created' },
      { at: at(-6, 12), byId: 'USR-001', byName: 'Vivek Patel', text: 'Notifications sent to 2 monitor(s)' },
      { at: at(-5), byId: 'USR-004', byName: 'Anita Rao', text: 'Anita Rao acknowledged (Primary) with simulated signature' },
    ],
    createdById: 'USR-001', createdAt: at(-6), updatedAt: at(-5),
  },
  {
    id: 'DEL-002', projectId: 'PRJ-003', planId: 'MP-003', protocolVersionDetails: 'Protocol v2.0', meetingDate: day(-180), startTime: '14:00', endTime: '15:00',
    attendees: [pm('USR-003', 'Sanjay Mehta'), { userId: 'USR-006', name: 'Meera Iyer', details: 'Senior CRA' }, { userId: 'USR-007', name: 'Karan Desai', details: 'CRA' }],
    conductedBy: [pm('USR-003', 'Sanjay Mehta')], discussionDetails: 'Plan training (fictional).', delegatedResponsibilities: 'As per plan.', notes: '',
    monitors: [{ duty: 'Primary', monitorId: 'USR-006' }, { duty: 'Secondary', monitorId: 'USR-007' }],
    acknowledgements: [ack('USR-006', ['Primary'], 'Acknowledged', -179, 'Meera Iyer'), ack('USR-007', ['Secondary'], 'Acknowledged', -179, 'Karan Desai')],
    authorization: 'Authorized', authorizationRequestedAt: at(-178), authorizationSignature: { userId: 'USR-009', typedName: 'Arvind Kulkarni', at: at(-177) }, authorizationComment: 'Authorized.',
    history: [{ at: at(-177), byId: 'USR-009', byName: 'Dr. Arvind Kulkarni', text: 'Delegation authorized by HOD/VP' }],
    createdById: 'USR-003', createdAt: at(-180), updatedAt: at(-177),
  },
  {
    id: 'DEL-003', projectId: 'PRJ-005', planId: 'MP-004', protocolVersionDetails: 'Protocol v1.0', meetingDate: day(-18), startTime: '09:30', endTime: '11:00',
    attendees: [pm('USR-001', 'Vivek Patel'), { userId: 'USR-008', name: 'Priya Nair', details: 'Senior CRA' }, { userId: 'USR-007', name: 'Karan Desai', details: 'CRA' }, { userId: 'USR-004', name: 'Anita Rao', details: 'CRA' }, { userId: 'USR-006', name: 'Meera Iyer', details: 'Senior CRA' }],
    conductedBy: [pm('USR-001', 'Vivek Patel')], discussionDetails: 'Blinded/unblinded role separation training (fictional).', delegatedResponsibilities: 'Unblinded: IP accountability. Blinded: source data verification.', notes: '',
    monitors: [
      { duty: 'Primary Unblinded', monitorId: 'USR-008' }, { duty: 'Secondary Unblinded', monitorId: 'USR-007' },
      { duty: 'Primary Blinded', monitorId: 'USR-004' }, { duty: 'Secondary Blinded', monitorId: 'USR-006' },
    ],
    acknowledgements: [
      ack('USR-008', ['Primary Unblinded'], 'Acknowledged', -16, 'Priya Nair'), ack('USR-007', ['Secondary Unblinded'], 'Acknowledged', -16, 'Karan Desai'),
      ack('USR-004', ['Primary Blinded'], 'Acknowledged', -15, 'Anita Rao'), ack('USR-006', ['Secondary Blinded'], 'Acknowledged', -15, 'Meera Iyer'),
    ],
    authorization: 'Pending', authorizationRequestedAt: at(-14), authorizationSignature: null, authorizationComment: '',
    history: [
      { at: at(-15), byId: 'SYSTEM', byName: 'System', text: 'All required acknowledgements completed' },
      { at: at(-14), byId: 'USR-001', byName: 'Vivek Patel', text: 'HOD/VP authorization initiated' },
    ],
    createdById: 'USR-001', createdAt: at(-18), updatedAt: at(-14),
  },
  {
    id: 'DEL-004', projectId: 'PRJ-002', planId: 'MP-002', protocolVersionDetails: 'Protocol v1.0 draft', meetingDate: day(-2), startTime: '15:00', endTime: '16:30',
    attendees: [pm('USR-002', 'Neha Joshi'), { userId: 'USR-005', name: 'Rahul Shah', details: 'CRA' }, { userId: 'USR-008', name: 'Priya Nair', details: 'Senior CRA' }],
    conductedBy: [pm('USR-002', 'Neha Joshi')], discussionDetails: 'Kick-off and delegation (fictional).', delegatedResponsibilities: 'To be finalised.', notes: '',
    monitors: [{ duty: 'Primary Unblinded', monitorId: 'USR-005' }, { duty: 'Primary Blinded', monitorId: 'USR-008' }, { duty: 'Secondary Blinded', monitorId: 'USR-006' }],
    acknowledgements: [ack('USR-005', ['Primary Unblinded'], 'Pending', -1), ack('USR-008', ['Primary Blinded'], 'Declined', -1), ack('USR-006', ['Secondary Blinded'], 'Pending', -1)],
    authorization: 'Not Requested', authorizationRequestedAt: null, authorizationSignature: null, authorizationComment: '',
    history: [{ at: at(-1), byId: 'USR-008', byName: 'Priya Nair', text: 'Priya Nair declined (Primary Blinded)' }],
    createdById: 'USR-002', createdAt: at(-2), updatedAt: at(-1),
  },
];

const assignment = (a: Partial<MonitorAssignment> & Pick<MonitorAssignment, 'id' | 'projectId' | 'visitType' | 'monitorId' | 'monitorEmail' | 'visitDate'>): MonitorAssignment => ({
  planId: null, reportId: null, notes: '', status: 'Planned', notifiedAt: null, acknowledgedAt: null, history: [],
  createdById: 'USR-001', createdAt: at(-15), updatedAt: at(-2), ...a,
});

export const seedAssignments = (): MonitorAssignment[] => [
  assignment({ id: 'ASG-001', projectId: 'PRJ-001', visitType: 'SIV', monitorId: 'USR-004', monitorEmail: 'anita.rao@zenovel.test', visitDate: day(-20), planId: 'MP-001', reportId: 'RPT-001', status: 'Completed', notifiedAt: at(-25), acknowledgedAt: at(-24), updatedAt: at(-12) }),
  assignment({ id: 'ASG-002', projectId: 'PRJ-001', visitType: 'P01 Check In', monitorId: 'USR-005', monitorEmail: 'rahul.shah@zenovel.test', visitDate: day(6), planId: 'MP-001', status: 'Notified', notifiedAt: at(-1), updatedAt: at(-1) }),
  assignment({ id: 'ASG-003', projectId: 'PRJ-001', visitType: 'P01 Dosing', monitorId: 'USR-004', monitorEmail: 'anita.rao@zenovel.test', visitDate: day(7), planId: 'MP-001', status: 'Acknowledged', notifiedAt: at(-3), acknowledgedAt: at(-2) }),
  assignment({ id: 'ASG-004', projectId: 'PRJ-005', visitType: 'SIV', monitorId: 'USR-008', monitorEmail: 'priya.nair@zenovel.test', visitDate: day(-10), planId: 'MP-004', reportId: 'RPT-002', status: 'Acknowledged', notifiedAt: at(-14), acknowledgedAt: at(-13) }),
  assignment({ id: 'ASG-005', projectId: 'PRJ-005', visitType: 'IMV-1/IMV-2', monitorId: 'USR-004', monitorEmail: 'anita.rao@zenovel.test', visitDate: day(-5), planId: 'MP-004', reportId: 'RPT-003', status: 'Acknowledged', notifiedAt: at(-9), acknowledgedAt: at(-8) }),
  assignment({ id: 'ASG-006', projectId: 'PRJ-003', visitType: 'SCV', monitorId: 'USR-006', monitorEmail: 'meera.iyer@zenovel.test', visitDate: day(-60), planId: 'MP-003', reportId: 'RPT-004', status: 'Completed', createdById: 'USR-003', notifiedAt: at(-65), acknowledgedAt: at(-64), updatedAt: at(-40) }),
  assignment({ id: 'ASG-007', projectId: 'PRJ-002', visitType: 'SIV', monitorId: 'USR-005', monitorEmail: 'rahul.shah@zenovel.test', visitDate: day(14), planId: 'MP-002', status: 'Planned', createdById: 'USR-002' }),
  assignment({ id: 'ASG-008', projectId: 'PRJ-005', visitType: 'IMV-1/IMV-2', monitorId: 'USR-007', monitorEmail: 'karan.desai@zenovel.test', visitDate: day(3), planId: 'MP-004', reportId: 'RPT-005', status: 'Acknowledged', notifiedAt: at(-4), acknowledgedAt: at(-3) }),
];

const content = (summary: string, extra: Partial<ReportContent> = {}): ReportContent => ({
  visitSummary: summary,
  observations: 'Sample observation text for demonstration only. Not actual clinical data.',
  findings: [],
  deviations: [],
  capa: [],
  supportingNotes: '',
  conclusion: 'Demonstration conclusion text (fictional).',
  ...extra,
});

const report = (r: Partial<MonitoringReport> & Pick<MonitoringReport, 'id' | 'projectId' | 'visitType' | 'monitorId' | 'visitDate'>, c: ReportContent): MonitoringReport => ({
  planId: null, assignmentId: null, status: 'Draft', version: 1, reviews: [], versions: [], createdById: r.monitorId, createdAt: at(-10), updatedAt: at(-2),
  ...c, ...r,
});

export const seedReports = (): MonitoringReport[] => [
  report({
    id: 'RPT-001', projectId: 'PRJ-001', planId: 'MP-001', assignmentId: 'ASG-001', visitType: 'SIV', monitorId: 'USR-004', visitDate: day(-20), status: 'Approved', version: 2, createdAt: at(-19), updatedAt: at(-12),
    reviews: [
      { id: 'RV-20', at: at(-16), byId: 'USR-001', byName: 'Vivek Patel', role: 'Project Manager', action: 'Requested changes', comment: 'Please add training log reference (fictional).' },
      { id: 'RV-21', at: at(-12), byId: 'USR-001', byName: 'Vivek Patel', role: 'Project Manager', action: 'Approved', comment: 'Approved.' },
    ],
    versions: [{ version: 1, at: at(-17), byName: 'Anita Rao', status: 'In Review', note: 'Submitted for review', content: content('Initial SIV summary (fictional).') }],
  }, content('Site initiation visit completed as planned (fictional demo text).', {
    findings: [{ id: 'F-1', category: 'Documentation', description: 'Sample finding: delegation log signature pending (fictional).', grade: 'Minor' }],
    capa: [{ id: 'C-1', action: 'Obtain pending signature', responsiblePerson: 'Site coordinator (fictional)', targetDate: day(-15), status: 'Closed' }],
  })),
  report({
    id: 'RPT-002', projectId: 'PRJ-005', planId: 'MP-004', assignmentId: 'ASG-004', visitType: 'SIV', monitorId: 'USR-008', visitDate: day(-10), status: 'In Review', createdAt: at(-9), updatedAt: at(-2),
    versions: [],
  }, content('SIV summary for demonstration (fictional).')),
  report({
    id: 'RPT-003', projectId: 'PRJ-005', planId: 'MP-004', assignmentId: 'ASG-005', visitType: 'IMV-1/IMV-2', monitorId: 'USR-004', visitDate: day(-5), status: 'Changes Requested', createdAt: at(-4), updatedAt: at(-1),
    reviews: [{ id: 'RV-22', at: at(-1), byId: 'USR-001', byName: 'Vivek Patel', role: 'Project Manager', action: 'Requested changes', comment: 'Please complete the CAPA target dates (fictional).' }],
    versions: [{ version: 1, at: at(-3), byName: 'Anita Rao', status: 'In Review', note: 'Submitted for review', content: content('IMV summary draft (fictional).') }],
  }, content('Interim monitoring visit summary (fictional).', {
    deviations: [{ id: 'D-1', description: 'Sample deviation: visit window exceeded by 1 day (fictional).', reference: 'Deviation log #1 (fictional)' }],
    capa: [{ id: 'C-2', action: 'Reinforce visit window tracking', responsiblePerson: 'Site coordinator (fictional)', targetDate: '', status: 'Open' }],
  })),
  report({
    id: 'RPT-004', projectId: 'PRJ-003', planId: 'MP-003', assignmentId: 'ASG-006', visitType: 'SCV', monitorId: 'USR-006', visitDate: day(-60), status: 'Approved', createdAt: at(-58), updatedAt: at(-40),
    reviews: [{ id: 'RV-23', at: at(-40), byId: 'USR-003', byName: 'Sanjay Mehta', role: 'Project Manager', action: 'Approved', comment: '' }],
  }, content('Site close-out visit completed (fictional).')),
  report({
    id: 'RPT-005', projectId: 'PRJ-005', planId: 'MP-004', assignmentId: 'ASG-008', visitType: 'IMV-1/IMV-2', monitorId: 'USR-007', visitDate: day(3), status: 'Draft', createdAt: at(-1), updatedAt: at(-1),
  }, content('Draft — to be completed after the visit (fictional).', { observations: '', conclusion: '' })),
];

const note = (id: string, key: string, recipientId: string, title: string, message: string, link: string, when: number, read = false): AppNotification => ({
  id, key, recipientId, title, message, link, read, createdAt: at(when), updatedAt: at(when),
});

export const seedNotifications = (): AppNotification[] => [
  note('NTF-001', 'seed-1', 'USR-011', 'Monitoring Plan shared for review', 'MP-001 (Nexora BE Study) is awaiting your review.', '/plans/MP-001', -3),
  note('NTF-002', 'seed-2', 'USR-009', 'Plan awaiting HOD approval', 'MP-002 (Cardiva Phase II) was prepared by Neha Joshi.', '/plans/MP-002', -1),
  note('NTF-003', 'seed-3', 'USR-009', 'HOD/VP authorization requested', 'DEL-003 (Veltrix Phase III) — all monitors acknowledged.', '/delegations/DEL-003', -14),
  note('NTF-004', 'seed-4', 'USR-010', 'HOD/VP authorization requested', 'DEL-003 (Veltrix Phase III) — all monitors acknowledged.', '/delegations/DEL-003', -14),
  note('NTF-005', 'seed-5', 'USR-005', 'Delegation acknowledgement pending', 'You were delegated as Secondary monitor on DEL-001.', '/delegations/DEL-001', -5),
  note('NTF-006', 'seed-6', 'USR-005', 'Monitoring visit assigned', 'P01 Check In for Nexora BE Study on ' + day(6) + '.', '/assignments/ASG-002', -1),
  note('NTF-007', 'seed-7', 'USR-001', 'Monitoring Report submitted', 'RPT-002 (Veltrix Phase III SIV) is ready for review.', '/reports/RPT-002', -2),
  note('NTF-008', 'seed-8', 'USR-004', 'Report changes requested', 'RPT-003: Please complete the CAPA target dates.', '/reports/RPT-003', -1),
  note('NTF-009', 'seed-9', 'USR-002', 'Sponsor feedback received', 'Sofia Kim requested changes on MP-006.', '/plans/MP-006', -6),
  note('NTF-010', 'seed-10', 'USR-001', 'All delegation acknowledgements completed', 'DEL-003 is ready for HOD/VP authorization.', '/delegations/DEL-003', -15, true),
];

const act = (id: string, when: number, actorId: string, actorName: string, action: string, entityType: ActivityItem['entityType'], entityId: string, projectId: string | null, text: string): ActivityItem => ({
  id, at: at(when), actorId, actorName, action, entityType, entityId, projectId, text, updatedAt: at(when),
});

export const seedActivity = (): ActivityItem[] => [
  act('ACT-001', -60, 'USR-001', 'Vivek Patel', 'Created', 'Project', 'PRJ-001', 'PRJ-001', 'Project PRJ-001 Nexora BE Study created'),
  act('ACT-002', -30, 'USR-001', 'Vivek Patel', 'Created', 'Monitoring Plan', 'MP-001', 'PRJ-001', 'Monitoring Plan MP-001 created'),
  act('ACT-003', -5, 'USR-009', 'Dr. Arvind Kulkarni', 'Approved', 'Monitoring Plan', 'MP-001', 'PRJ-001', 'MP-001 approved by HOD'),
  act('ACT-004', -3, 'USR-001', 'Vivek Patel', 'Shared', 'Monitoring Plan', 'MP-001', 'PRJ-001', 'MP-001 shared with sponsor for review'),
  act('ACT-005', -6, 'USR-001', 'Vivek Patel', 'Created', 'Delegation', 'DEL-001', 'PRJ-001', 'Delegation DEL-001 created'),
  act('ACT-006', -5, 'USR-004', 'Anita Rao', 'Acknowledged', 'Delegation', 'DEL-001', 'PRJ-001', 'Anita Rao acknowledged DEL-001 (Primary)'),
  act('ACT-007', -1, 'USR-001', 'Vivek Patel', 'Notified', 'Assignment', 'ASG-002', 'PRJ-001', 'Simulated email sent for ASG-002 to Rahul Shah'),
  act('ACT-008', -2, 'USR-008', 'Priya Nair', 'Submitted', 'Report', 'RPT-002', 'PRJ-005', 'Report RPT-002 submitted for review'),
  act('ACT-009', -1, 'USR-001', 'Vivek Patel', 'Requested changes', 'Report', 'RPT-003', 'PRJ-005', 'Changes requested on RPT-003'),
  act('ACT-010', -1, 'USR-002', 'Neha Joshi', 'Final save', 'Monitoring Plan', 'MP-002', 'PRJ-002', 'MP-002 prepared and sent for HOD approval'),
  act('ACT-011', -6, 'USR-013', 'Sofia Kim', 'Feedback', 'Monitoring Plan', 'MP-006', 'PRJ-006', 'Sponsor requested changes on MP-006'),
  act('ACT-012', -14, 'USR-001', 'Vivek Patel', 'Authorization requested', 'Delegation', 'DEL-003', 'PRJ-005', 'HOD/VP authorization initiated for DEL-003'),
];

export const seedEmails = (): SimulatedEmail[] => [
  {
    id: 'EML-001', to: ['rahul.shah@zenovel.test'], cc: [], subject: 'Monitoring visit assigned: P01 Check In — Nexora BE Study',
    body: 'Dear Rahul Shah,\n\nYou have been assigned to the P01 Check In visit. Please open the assignment in Zenovel to acknowledge and prepare the monitoring report.\n\n(Simulated email — not delivered.)',
    projectId: 'PRJ-001', entityType: 'Assignment', entityId: 'ASG-002', link: '/assignments/ASG-002', sentAt: at(-1), sentById: 'USR-001', sentByName: 'Vivek Patel', updatedAt: at(-1),
  },
];
