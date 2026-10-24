import { PartyDetails, Project } from '../models';

/** How a raw project value is turned into readable text in the audit log. */
export type AuditFieldKind = 'text' | 'user' | 'boolean' | 'file' | 'visits';

export interface AuditFieldDef {
  field: string;
  label: string;
  kind: AuditFieldKind;
  read: (p: Project) => unknown;
}

const party = (key: 'sponsor' | 'cro', title: string): AuditFieldDef[] => {
  const fields: [keyof PartyDetails, string][] = [
    ['name', 'Organisation name'],
    ['contactPerson', 'Contact person'],
    ['email', 'Email'],
    ['phone', 'Phone'],
    ['address', 'Address'],
  ];
  return fields.map(([f, label]) => ({ field: `${key}.${f}`, label: `${title} · ${label}`, kind: 'text', read: p => p[key]?.[f] }));
};

/** Every project field tracked by the audit log, labelled as on the project form. System fields (id, timestamps) are excluded. */
export const PROJECT_AUDIT_FIELDS: AuditFieldDef[] = [
  { field: 'name', label: 'Project Name', kind: 'text', read: p => p.name },
  { field: 'status', label: 'Project Status', kind: 'text', read: p => p.status },
  { field: 'zenovelProjectNo', label: 'Zenovel Project No.', kind: 'text', read: p => p.zenovelProjectNo },
  { field: 'protocolNo', label: 'CRO Project No. / Protocol No.', kind: 'text', read: p => p.protocolNo },
  { field: 'sponsorProjectNo', label: 'Sponsor Project No.', kind: 'text', read: p => p.sponsorProjectNo },
  { field: 'protocolTitle', label: 'Project Title / Protocol Title', kind: 'text', read: p => p.protocolTitle },
  { field: 'studyType', label: 'Study Type', kind: 'text', read: p => p.studyType },
  { field: 'blinding', label: 'Type of Study (blinding)', kind: 'text', read: p => p.blinding },
  { field: 'startDate', label: 'Project Start Date', kind: 'text', read: p => p.startDate },
  { field: 'endDate', label: 'Project End Date', kind: 'text', read: p => p.endDate },
  { field: 'description', label: 'Description', kind: 'text', read: p => p.description },
  { field: 'notes', label: 'Notes', kind: 'text', read: p => p.notes },
  { field: 'protocolDocument', label: 'Protocol document', kind: 'file', read: p => p.protocolDocument },
  ...party('sponsor', 'Sponsor'),
  ...party('cro', 'CRO'),
  { field: 'projectManagerId', label: 'Project Manager', kind: 'user', read: p => p.projectManagerId },
  { field: 'backupProjectManagerId', label: 'Back-up Project Manager', kind: 'user', read: p => p.backupProjectManagerId },
  { field: 'scope.monitoring', label: 'Scope · Monitoring', kind: 'boolean', read: p => p.scope?.monitoring },
  { field: 'scope.monitoringDetails', label: 'Scope · Monitoring details', kind: 'text', read: p => p.scope?.monitoringDetails },
  { field: 'scope.visits', label: 'Scope · Visits in scope', kind: 'visits', read: p => p.scope?.visits },
  { field: 'scope.audit', label: 'Scope · Audit', kind: 'boolean', read: p => p.scope?.audit },
  { field: 'scope.auditDetails', label: 'Scope · Audit details', kind: 'text', read: p => p.scope?.auditDetails },
  { field: 'scope.auditDays', label: 'Scope · Audit days', kind: 'text', read: p => p.scope?.auditDays },
  { field: 'scope.auditors', label: 'Scope · Number of auditors', kind: 'text', read: p => p.scope?.auditors },
];
