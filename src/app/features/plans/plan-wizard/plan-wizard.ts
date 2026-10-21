import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { startWith } from 'rxjs';
import { COMMUNICATION_CHANNELS, RESPONSIBLE_ROLES, RISK_CATEGORIES, RISK_SCALE, ZENOVEL_SOPS } from '../../../core/config/domain.config';
import { CommunicationChannel, CommunicationContact, FileMeta, MonitoringPlan, PlanVisit, PlanVisitType, ProtocolSummaryItem, RiskItem, SessionUser } from '../../../core/models';
import { AiContext } from '../../../core/services/ai-assist.service';
import { DataStore } from '../../../core/data/data-store.service';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { MonitoringPlanService, PlanInput } from '../../../core/services/monitoring-plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FileUpload } from '../../../shared/ui/file-upload';
import { FormField } from '../../../shared/ui/form-field';
import { SearchableSelect, SelectOption } from '../../../shared/ui/searchable-select';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { Step, Stepper } from '../../../shared/ui/stepper';
import { PlanAiPanel } from '../plan-ai-panel/plan-ai-panel';
import { PlanView } from '../plan-view/plan-view';
import { PlanWorkflowPanel } from '../plan-workflow-panel/plan-workflow-panel';

type FC<T> = FormControl<T>;
type SummaryGroup = FormGroup<{ id: FC<string>; heading: FC<string>; summary: FC<string>; sourceSection: FC<string>; aiGenerated: FC<boolean> }>;
type RiskGroup = FormGroup<{
  id: FC<string>; description: FC<string>; category: FC<string>; severity: FC<number>; likelihood: FC<number>; detectability: FC<number>;
  mitigation: FC<string>; responsibleRole: FC<string>; milestone: FC<string>; indicators: FC<string>; escalationTriggers: FC<string>;
  residualRisk: FC<string>; sourceRef: FC<string>; aiGenerated: FC<boolean>;
}>;
type VisitPlanGroup = FormGroup<{ visitType: FC<string>; days: FC<number>; applicable: FC<boolean>; comments: FC<string> }>;
type VisitTypeGroup = FormGroup<{ visitType: FC<string>; applicable: FC<boolean>; checkpoints: FC<string> }>;
type ContactGroup = FormGroup<{ channel: FC<CommunicationChannel>; userId: FC<string>; name: FC<string>; details: FC<string> }>;

const onsiteOrRemote = (g: AbstractControl): ValidationErrors | null =>
  g.get('onsite')?.value || g.get('remote')?.value ? null : { mode: 'Select onsite and/or remote monitoring.' };

const STEP_LABELS = ['Project Details', 'Scope & Strategy', 'Risk Assessment', 'Reporting & Documentation', 'Review & Submit'];

@Component({
  imports: [ReactiveFormsModule, Icon, FormField, DatePicker, FileUpload, SearchableSelect, Stepper, ErrorState, StatusBadge, PlanAiPanel, PlanView, PlanWorkflowPanel],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './plan-wizard.html',
})
export class PlanWizard {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly data = inject(DataStore);
  private readonly drafts = inject(FormDraftService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly projects = inject(ProjectService);
  protected readonly users = inject(UserDirectoryService);

  readonly id = input<string>();
  readonly projectId = input<string>();

  protected readonly sops = ZENOVEL_SOPS;
  protected readonly channels = COMMUNICATION_CHANNELS;
  protected readonly categories = RISK_CATEGORIES;
  protected readonly scale = RISK_SCALE;
  protected readonly responsibleRoles = RESPONSIBLE_ROLES;

  protected readonly step = signal(0);
  protected readonly attemptedSubmit = signal(false);
  protected readonly existing = signal<MonitoringPlan | undefined>(undefined);
  protected readonly blocked = signal('');
  protected readonly restored = signal(false);

  protected readonly form = this.fb.nonNullable.group({
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
    strategy: this.fb.nonNullable.group(
      {
        scopeOfWork: ['', Validators.required],
        monitoringApproach: ['', Validators.required],
        onsite: [true],
        remote: [false],
        visitFrequency: ['', Validators.required],
        visitDuration: ['', Validators.required],
        communicationMethods: ['', Validators.required],
        monitoringSchedule: [''],
        otherRequirements: [''],
        visitPlan: this.fb.array<VisitPlanGroup>([]),
        additionalVisitNote: [''],
        visitTypes: this.fb.array<VisitTypeGroup>([]),
      },
      { validators: onsiteOrRemote },
    ),
    risk: this.fb.nonNullable.group({ risks: this.fb.array<RiskGroup>([]) }),
    reporting: this.fb.nonNullable.group({
      communicationAmongTeam: [true],
      communicationWithSponsor: [true],
      gradingOfObservations: [true],
      contacts: this.fb.array<ContactGroup>([]),
      observationGrading: ['', Validators.required],
      reportTimeline: ['', Validators.required],
      documentSharing: ['', Validators.required],
      archiving: ['', Validators.required],
      communicationProcedures: [''],
      additionalProcedures: [''],
      templateDocument: [null as FileMeta | null],
    }),
  });

  protected readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  protected readonly selectedProject = computed(() => {
    this.value();
    return this.projects.get(this.form.controls.details.controls.projectId.value);
  });
  protected readonly projectOptions = computed(() =>
    this.projects.visible().map(p => ({ value: p.id, label: `${p.name} (${p.id})`, hint: `${p.protocolNo} · ${p.studyType} · ${p.blinding}` })),
  );
  protected readonly aiContext = computed<AiContext | null>(() => {
    this.value();
    const project = this.selectedProject();
    if (!project) return null;
    const d = this.form.controls.details.getRawValue();
    return { project, protocolDocument: d.protocolDocument, protocolVersionNo: d.protocolVersionNo, referenceProductInfo: d.referenceProductInfo, regulatoryGuideline: d.regulatoryGuideline };
  });
  protected readonly preview = computed(() => {
    this.value();
    return this.toInput();
  });
  protected readonly steps = computed<Step[]>(() => {
    this.value();
    const invalid = this.attemptedSubmit() ? this.invalidSteps() : [];
    return STEP_LABELS.map((label, i) => ({ label, invalid: invalid.includes(i) }));
  });
  protected readonly liveExisting = computed(() => (this.existing() ? this.plans.get(this.existing()!.id) : undefined));
  /** Sponsor contacts are entered manually, so the Sponsor channel has no picker options. */
  protected readonly contactOptions = computed<Record<CommunicationChannel, SelectOption[]>>(() => {
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

  private get draftKey(): string {
    return `plan-${this.id() ?? 'new'}`;
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      const plan = this.plans.getVisible(id);
      if (!plan) {
        this.blocked.set('not-found');
        return;
      }
      if (!this.plans.actions(plan).edit) {
        this.blocked.set(`Plan ${plan.id} cannot be edited while its status is "${plan.status}" / sponsor review "${plan.sponsorReview}".`);
        return;
      }
      this.existing.set(plan);
      this.load(plan);
      this.form.controls.details.controls.projectId.disable();
    } else {
      const pre = this.projectId() && this.projects.getVisible(this.projectId()) ? this.projectId()! : '';
      this.load(this.plans.defaults(this.projects.get(pre)));
    }
    const draft = this.drafts.restore<PlanInput>(this.draftKey);
    if (draft) {
      this.load(draft);
      this.form.markAsDirty();
      this.restored.set(true);
    }
    this.form.controls.details.controls.projectId.valueChanges.subscribe(pid => this.onProjectSelected(pid));
    this.drafts.track(this.draftKey, this.form, this.destroyRef);
  }

  /* ---------- navigation ---------- */

  goTo(i: number): void {
    this.step.set(i);
    window.scrollTo?.({ top: 0 });
  }

  next(): void {
    const group = this.stepGroup(this.step());
    if (group) {
      group.markAllAsTouched();
      if (this.stepInvalid(this.step())) {
        this.toast.error('Please complete the required fields in this step.');
        return;
      }
    }
    this.goTo(Math.min(this.step() + 1, STEP_LABELS.length - 1));
  }

  back(): void {
    this.goTo(Math.max(0, this.step() - 1));
  }

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

  addContact(): void {
    this.contacts.push(this.contactGroup({ channel: 'Zenovel CRA', name: '', details: '' }));
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
    this.toast.info(`${items.length} simulated suggestion(s) added. Review and edit them before submitting.`);
  }

  toggleSop(sop: string, on: boolean): void {
    const c = this.form.controls.details.controls.sops;
    c.setValue(on ? [...new Set([...c.value, sop])] : c.value.filter(s => s !== sop));
    c.markAsDirty();
  }

  rpnOf(g: RiskGroup): number {
    return this.plans.rpn(g.getRawValue());
  }

  /* ---------- save / submit ---------- */

  saveDraft(): void {
    const pid = this.form.controls.details.controls.projectId;
    pid.markAsTouched();
    if (!pid.value) {
      this.goTo(0);
      this.toast.error('Select a project before saving the draft.');
      return;
    }
    const id = this.id();
    const saved = id ? this.plans.update(id, this.toInput(), false) : this.plans.create(this.toInput(), false);
    this.finishSave();
    if (!saved) return;
    this.toast.success(`Draft ${saved.id} saved.`);
    if (!id) this.router.navigate(['/plans', saved.id, 'edit'], { replaceUrl: true });
    else this.existing.set(saved);
  }

  submit(): void {
    this.attemptedSubmit.set(true);
    this.form.markAllAsTouched();
    const invalid = this.invalidSteps();
    if (invalid.length) {
      this.goTo(invalid[0]);
      this.toast.error(`Complete the highlighted step(s): ${invalid.map(i => STEP_LABELS[i]).join(', ')}.`);
      return;
    }
    const id = this.id();
    const before = this.existing();
    const saved = id ? this.plans.update(id, this.toInput(), true) : this.plans.create(this.toInput(), true);
    this.finishSave();
    if (!saved) return;
    const submitted = !before || before.status === 'Draft' || before.status === 'Rejected';
    this.toast.success(submitted ? `Plan ${saved.id} submitted for PM review.` : `Plan ${saved.id} saved.`);
    this.router.navigate(['/plans', saved.id]);
  }

  discardDraft(): void {
    this.drafts.clear(this.draftKey);
    this.restored.set(false);
    const e = this.existing();
    this.load(e ?? this.plans.defaults(this.projects.get(this.projectId())));
    this.form.markAsPristine();
  }

  cancel(): void {
    this.drafts.clear(this.draftKey);
    const id = this.id();
    this.router.navigateByUrl(id ? `/plans/${id}` : '/plans');
  }

  invalidSteps(): number[] {
    return [0, 1, 2, 3].filter(i => this.stepInvalid(i));
  }

  stepInvalid(i: number): boolean {
    if (i === 2) return this.risks.length === 0 || this.risks.invalid;
    return !!this.stepGroup(i)?.invalid;
  }

  /* ---------- helpers ---------- */

  private stepGroup(i: number): AbstractControl | undefined {
    const c = this.form.controls;
    return [c.details, c.strategy, c.risk, c.reporting][i];
  }

  private finishSave(): void {
    this.drafts.clear(this.draftKey);
    this.form.markAsPristine();
    this.restored.set(false);
  }

  private onProjectSelected(projectId: string): void {
    const project = this.projects.get(projectId);
    if (!project) return;
    const d = this.form.controls.details.controls;
    const s = this.form.controls.strategy.controls;
    if (!d.protocolDocument.value && project.protocolDocument) d.protocolDocument.setValue(project.protocolDocument);
    if (!s.scopeOfWork.value && project.scope.monitoringDetails) s.scopeOfWork.setValue(project.scope.monitoringDetails);
    if (!this.contacts.length) {
      const person = (channel: CommunicationChannel, userId = '') => ({ channel, userId, name: userId ? this.users.name(userId) : '', details: this.users.email(userId) });
      const defaults = [
        person('Zenovel CRA'),
        person('Zenovel Project Manager', project.projectManagerId),
        ...(project.backupProjectManagerId ? [person('Zenovel Back Up Project Manager', project.backupProjectManagerId)] : []),
        person('Zenovel Management'),
        { channel: 'Sponsor' as const, name: project.sponsor.contactPerson || project.sponsor.name, details: project.sponsor.email },
      ];
      defaults.forEach(c => this.contacts.push(this.contactGroup(c)));
    }
  }

  private load(p: PlanInput): void {
    const rebuild = <T, G extends AbstractControl>(arr: FormArray<G>, items: T[], make: (x: T) => G) => {
      arr.clear();
      items.forEach(x => arr.push(make(x)));
    };
    rebuild(this.summary, p.protocolSummary ?? [], x => this.summaryGroup(x));
    rebuild(this.risks, p.risks ?? [], x => this.riskGroup(x));
    rebuild(this.visitPlan, p.visitPlan ?? [], x => this.visitPlanGroup(x));
    rebuild(this.visitTypes, p.visitTypes ?? [], x => this.visitTypeGroup(x));
    rebuild(this.contacts, p.contacts ?? [], x => this.contactGroup(x));
    const { protocolSummary: _a, risks: _b, visitPlan: _c, visitTypes: _d, contacts: _e, ...rest } = p;
    this.form.patchValue({ details: rest, strategy: rest, reporting: rest } as never);
  }

  private toInput(): PlanInput {
    const v = this.form.getRawValue();
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
    return this.fb.nonNullable.group({ visitType: [v.visitType], days: [v.days, [Validators.min(0), Validators.max(30)]], applicable: [v.applicable], comments: [v.comments] });
  }

  private visitTypeGroup(v: PlanVisitType): VisitTypeGroup {
    return this.fb.nonNullable.group({ visitType: [v.visitType], applicable: [v.applicable], checkpoints: [v.checkpoints] });
  }

  private contactGroup(c: CommunicationContact & { userId?: string }): ContactGroup {
    const userId = c.userId ?? this.contactOptions()[c.channel]?.find(o => o.label === c.name)?.value ?? '';
    const g = this.fb.nonNullable.group({ channel: [c.channel], userId: [userId], name: [c.name, Validators.required], details: [c.details] });
    g.controls.channel.valueChanges.subscribe(() => g.controls.userId.setValue('', { emitEvent: false }));
    g.controls.userId.valueChanges.subscribe(id => {
      const u = this.users.get(id);
      if (u) g.patchValue({ name: u.name, details: u.email });
    });
    return g;
  }
}
