import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { CheckpointStatus, CommunicationChannel, CommunicationContact, FileMeta, PlanVisit, PlanVisitType, Project, ProtocolSummaryItem, RiskItem, SessionUser } from '../../core/models';
import { DataStore } from '../../core/data/data-store.service';
import { AiContext } from '../../core/services/ai-assist.service';
import { MonitoringPlanService, PlanInput } from '../../core/services/monitoring-plan.service';
import { UserDirectoryService } from '../../core/services/user-directory.service';
import { SelectOption } from '../../shared/ui/searchable-select';

type FC<T> = FormControl<T>;
export type SummaryGroup = FormGroup<{ id: FC<string>; heading: FC<string>; summary: FC<string>; sourceSection: FC<string>; aiGenerated: FC<boolean> }>;
export type RiskGroup = FormGroup<{
  id: FC<string>; description: FC<string>; category: FC<string>; severity: FC<number>; likelihood: FC<number>; detectability: FC<number>;
  mitigation: FC<string>; responsibleRole: FC<string>; milestone: FC<string>; indicators: FC<string>; escalationTriggers: FC<string>;
  residualRisk: FC<string>; sourceRef: FC<string>; aiGenerated: FC<boolean>;
}>;
export type VisitPlanGroup = FormGroup<{ visitType: FC<string>; days: FC<number>; applicable: FC<boolean>; remote: FC<boolean>; comments: FC<string> }>;
export type VisitTypeGroup = FormGroup<{ visitType: FC<string>; applicable: FC<boolean>; checkpointStatus: FC<CheckpointStatus | ''>; checkpoints: FC<string> }>;
export type ContactGroup = FormGroup<{ channel: FC<CommunicationChannel>; userId: FC<string>; name: FC<string>; details: FC<string> }>;

/** Tabs of the plan inside the project form: the template sheet, the risk assessment and the protocol summary. */
export type PlanSection = 'plan' | 'risk' | 'summary';
export const PLAN_SECTION_LABELS: Record<PlanSection, string> = { plan: 'Monitoring Plan', risk: 'Risk Assessment', summary: 'Protocol Summary' };

export type PlanFormValue = ReturnType<PlanFormModel['form']['getRawValue']>;

/** Form state and mapping for a project's single Monitoring Plan. Provided per component that edits a plan. */
@Injectable()
export class PlanFormModel {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject(DataStore);
  private readonly users = inject(UserDirectoryService);
  private readonly plans = inject(MonitoringPlanService);

  readonly form = this.fb.nonNullable.group({
    details: this.fb.nonNullable.group({
      projectId: ['', Validators.required],
      protocolVersionNo: ['', [Validators.required, Validators.maxLength(30)]],
      protocolVersionDate: [''],
      amendmentDetails: [''],
      regulatoryGuideline: ['', Validators.required],
      referenceProductInfo: [''],
      sops: [[] as string[]],
      protocolDocument: [null as FileMeta | null],
      protocolSummary: this.fb.array<SummaryGroup>([]),
    }),
    strategy: this.fb.nonNullable.group({
      scopeOfWork: [''],
      monitoringApproach: [''],
      onsite: [true],
      remote: [false],
      visitFrequency: [''],
      visitDuration: [''],
      communicationMethods: [''],
      monitoringSchedule: [''],
      otherRequirements: [''],
      visitPlan: this.fb.array<VisitPlanGroup>([]),
      additionalVisit: [false],
      additionalVisitNote: [''],
      visitTypes: this.fb.array<VisitTypeGroup>([]),
    }),
    risk: this.fb.nonNullable.group({ risks: this.fb.array<RiskGroup>([]) }),
    reporting: this.fb.nonNullable.group({
      communicationAmongTeam: [true],
      communicationWithSponsor: [true],
      gradingOfObservations: [true],
      contacts: this.fb.array<ContactGroup>([]),
      observationGrading: [''],
      reportTimelineApplicable: [false],
      reportTimeline: [''],
      documentSharingApplicable: [false],
      documentSharing: [''],
      archivingApplicable: [false],
      archiving: [''],
      communicationProcedures: [''],
      additionalProcedures: [''],
      templateDocument: [null as FileMeta | null],
    }),
  });

  readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });

  /** Sponsor contacts are entered manually, so the Sponsor channel has no picker options. */
  readonly contactOptions = computed<Record<CommunicationChannel, SelectOption[]>>(() => {
    const toOptions = (list: SessionUser[]) => list.map(u => ({ value: u.id, label: u.name, hint: u.email }));
    const managers = toOptions(this.users.managers());
    return {
      'Zenovel CRA': toOptions(this.users.monitors()),
      'Zenovel Project Manager': managers,
      'Zenovel Back Up Project Manager': managers,
      'Zenovel Management': toOptions(this.users.approvers()),
      Sponsor: [],
    };
  });

  get summary(): FormArray<SummaryGroup> { return this.form.controls.details.controls.protocolSummary; }
  get risks(): FormArray<RiskGroup> { return this.form.controls.risk.controls.risks; }
  get visitPlan(): FormArray<VisitPlanGroup> { return this.form.controls.strategy.controls.visitPlan; }
  get visitTypes(): FormArray<VisitTypeGroup> { return this.form.controls.strategy.controls.visitTypes; }
  get contacts(): FormArray<ContactGroup> { return this.form.controls.reporting.controls.contacts; }

  /* ---------- arrays ---------- */

  addSummary(s?: Partial<ProtocolSummaryItem>): void {
    this.summary.push(this.summaryGroup({ id: this.data.localId('PS'), heading: '', summary: '', sourceSection: '', aiGenerated: false, ...s }));
    this.form.markAsDirty();
  }

  addRisk(r?: Partial<RiskItem>): void {
    this.risks.push(this.riskGroup({
      id: this.data.localId('R'), description: '', category: '', severity: 3, likelihood: 3, detectability: 3, mitigation: '', responsibleRole: '',
      milestone: '', indicators: '', escalationTriggers: '', residualRisk: '', sourceRef: '', aiGenerated: false, ...r,
    }));
    this.form.markAsDirty();
  }

  /** Adds a manually entered contact (name + details) to a channel. */
  addContact(channel: CommunicationChannel = 'Zenovel CRA'): void {
    this.contacts.push(this.contactGroup({ channel, name: '', details: '' }));
    this.form.markAsDirty();
  }

  contactsFor(channel: CommunicationChannel): ContactGroup[] {
    return this.contacts.controls.filter(g => g.controls.channel.value === channel);
  }

  isPicked(channel: CommunicationChannel, userId: string): boolean {
    return this.contacts.controls.some(g => g.controls.channel.value === channel && g.controls.userId.value === userId);
  }

  /** Ticking a name adds the person to the channel with their email as details; unticking removes them. */
  togglePick(channel: CommunicationChannel, userId: string, on: boolean): void {
    if (on) {
      const u = this.users.get(userId);
      if (!u || this.isPicked(channel, userId)) return;
      this.contacts.push(this.contactGroup({ channel, userId, name: u.name, details: u.email }));
    } else {
      const i = this.contacts.controls.findIndex(g => g.controls.channel.value === channel && g.controls.userId.value === userId);
      if (i >= 0) this.contacts.removeAt(i);
    }
    this.form.markAsDirty();
  }

  remove(arr: FormArray, i: number): void {
    arr.removeAt(i);
    this.form.markAsDirty();
  }

  acceptAi(kind: 'summary' | 'risk', items: (ProtocolSummaryItem | RiskItem)[], replace: boolean): void {
    const arr = kind === 'summary' ? this.summary : this.risks;
    if (replace) arr.clear();
    items.forEach(i => (kind === 'summary' ? this.addSummary(i as ProtocolSummaryItem) : this.addRisk(i as RiskItem)));
  }

  toggleSop(sop: string, on: boolean): void {
    const c = this.form.controls.details.controls.sops;
    c.setValue(on ? [...new Set([...c.value, sop])] : c.value.filter(s => s !== sop));
    c.markAsDirty();
  }

  rpnOf(g: RiskGroup): number {
    return this.plans.rpn(g.getRawValue());
  }

  aiContext(project: Project | undefined): AiContext | null {
    if (!project) return null;
    const d = this.form.controls.details.getRawValue();
    return { project, protocolDocument: d.protocolDocument, protocolVersionNo: d.protocolVersionNo, referenceProductInfo: d.referenceProductInfo, regulatoryGuideline: d.regulatoryGuideline };
  }

  /* ---------- validation ---------- */

  sectionInvalid(section: PlanSection): boolean {
    if (section === 'risk') return this.risks.length === 0 || this.risks.invalid;
    if (section === 'summary') return this.summary.invalid;
    const { protocolSummary: _summary, ...details } = this.form.controls.details.controls;
    return Object.values(details).some(c => c.invalid) || this.form.controls.strategy.invalid || this.form.controls.reporting.invalid;
  }

  invalidSections(): PlanSection[] {
    return (['plan', 'risk', 'summary'] as const).filter(s => this.sectionInvalid(s));
  }

  /* ---------- load / map ---------- */

  load(p: PlanInput): void {
    const rebuild = <T, G extends AbstractControl>(arr: FormArray<G>, items: T[], make: (x: T) => G) => {
      arr.clear();
      items.forEach(x => arr.push(make(x)));
    };
    rebuild(this.summary, p.protocolSummary ?? [], x => this.summaryGroup(x));
    rebuild(this.risks, p.risks ?? [], x => this.riskGroup(x));
    rebuild(this.visitPlan, p.visitPlan ?? [], x => this.visitPlanGroup(x));
    rebuild(this.visitTypes, p.visitTypes ?? [], x => this.visitTypeGroup(x));
    rebuild(this.contacts, p.contacts ?? [], x => this.contactGroup(x));
    const { protocolSummary: _a, risks: _b, visitPlan: _c, visitTypes: _d, contacts: _e, ...fields } = p;
    const rest = {
      ...fields,
      additionalVisit: p.additionalVisit ?? !!p.additionalVisitNote,
      reportTimelineApplicable: p.reportTimelineApplicable ?? !!p.reportTimeline,
      documentSharingApplicable: p.documentSharingApplicable ?? !!p.documentSharing,
      archivingApplicable: p.archivingApplicable ?? !!p.archiving,
    };
    this.form.patchValue({ details: rest, strategy: rest, reporting: rest } as never);
  }

  /** Maps the raw form value (current, or a saved form draft) to a plan input. */
  toInput(v: PlanFormValue = this.form.getRawValue()): PlanInput {
    const { protocolSummary, ...details } = v.details;
    return {
      ...details,
      ...v.strategy,
      ...v.reporting,
      contacts: v.reporting.contacts.map(({ userId: _userId, ...c }) => c),
      protocolSummary,
      risks: v.risk.risks.map(r => ({ ...r, severity: Number(r.severity), likelihood: Number(r.likelihood), detectability: Number(r.detectability) })),
    };
  }

  /* ---------- groups ---------- */

  private summaryGroup(s: ProtocolSummaryItem): SummaryGroup {
    return this.fb.nonNullable.group({
      id: [s.id], heading: [s.heading, Validators.required], summary: [s.summary, Validators.required], sourceSection: [s.sourceSection], aiGenerated: [s.aiGenerated],
    });
  }

  private riskGroup(r: RiskItem): RiskGroup {
    const score = [Validators.required, Validators.min(1), Validators.max(5)];
    return this.fb.nonNullable.group({
      id: [r.id], description: [r.description, Validators.required], category: [r.category, Validators.required],
      severity: [r.severity, score], likelihood: [r.likelihood, score], detectability: [r.detectability, score],
      mitigation: [r.mitigation, Validators.required], responsibleRole: [r.responsibleRole, Validators.required], milestone: [r.milestone],
      indicators: [r.indicators], escalationTriggers: [r.escalationTriggers], residualRisk: [r.residualRisk], sourceRef: [r.sourceRef], aiGenerated: [r.aiGenerated],
    });
  }

  private visitPlanGroup(v: PlanVisit): VisitPlanGroup {
    return this.fb.nonNullable.group({
      visitType: [v.visitType], days: [v.days, [Validators.min(0), Validators.max(30)]], applicable: [v.applicable], remote: [v.remote ?? false], comments: [v.comments],
    });
  }

  private visitTypeGroup(v: PlanVisitType): VisitTypeGroup {
    return this.fb.nonNullable.group({ visitType: [v.visitType], applicable: [v.applicable], checkpointStatus: [v.checkpointStatus ?? ''], checkpoints: [v.checkpoints] });
  }

  /** A contact whose name matches a directory user of its channel is shown as a ticked name; any other is a manual entry. */
  private contactGroup(c: CommunicationContact & { userId?: string }): ContactGroup {
    const userId = c.userId ?? this.contactOptions()[c.channel]?.find(o => o.label === c.name)?.value ?? '';
    return this.fb.nonNullable.group({ channel: [c.channel], userId: [userId], name: [c.name, Validators.required], details: [c.details] });
  }
}
