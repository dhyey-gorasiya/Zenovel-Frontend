import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { BLINDING_TYPES, PROJECT_STATUSES, STUDY_TYPES, VISIT_TYPES } from '../../../core/config/domain.config';
import { Blinding, FileMeta, MonitoringPlan, PartyDetails, Project, ProjectStatus, StudyType } from '../../../core/models';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ProjectInput, ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FormField } from '../../../shared/ui/form-field';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchableSelect, SelectOption } from '../../../shared/ui/searchable-select';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { TabItem, Tabs } from '../../../shared/ui/tabs';
import { emailValidator, rangeValidator } from '../../../shared/validators';
import { PLAN_SECTION_LABELS, PlanFormModel, PlanFormValue } from '../../plans/plan-form.model';
import { ProjectPlanFields } from '../project-plan-fields/project-plan-fields';

type VisitGroup = FormGroup<{ visitType: FormControl<string>; days: FormControl<number> }>;

/** `setup`: HOD/VP creates or edits the "Project Details" sheet fields. `details`: the assigned PM completes the remaining fields. */
export type ProjectFormMode = 'setup' | 'details';

const SETUP_FIELDS = ['zenovelProjectNo', 'protocolNo', 'sponsorProjectNo', 'protocolTitle', 'sponsor', 'cro', 'projectManagerId', 'backupProjectManagerId', 'scope'] as const;
const DETAILS_FIELDS = ['name', 'status', 'studyType', 'blinding', 'startDate', 'endDate', 'description', 'notes', 'protocolDocument'] as const;

type DetailsTab = 'project' | 'plan';
const DETAILS_TABS: DetailsTab[] = ['project', 'plan'];

@Component({
  imports: [ReactiveFormsModule, RouterLink, Icon, FormField, DatePicker, SearchableSelect, PageHeader, ErrorState, StatusBadge, Tabs, ProjectPlanFields],
  providers: [PlanFormModel],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './project-form.html',
  host: { class: 'flex flex-1 flex-col' },
})
export class ProjectForm {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectService);
  private readonly plans = inject(MonitoringPlanService);
  private readonly roles = inject(DemoRoleService);
  private readonly toast = inject(ToastService);
  private readonly drafts = inject(FormDraftService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly users = inject(UserDirectoryService);
  protected readonly planForm = inject(PlanFormModel);

  /** Route param (`/projects/:id/edit`). */
  readonly id = input<string>();
  /** Route data (`/projects/:id/details`); absent on create and HOD/VP edit. */
  readonly mode = input<ProjectFormMode>();
  /** Query param selecting the initial tab in details mode (`?tab=plan`). */
  readonly tab = input<string>();
  protected readonly isDetails = computed(() => this.mode() === 'details');

  protected readonly activeTab = linkedSignal<string>(() => (DETAILS_TABS.includes(this.tab() as DetailsTab) ? this.tab()! : 'project'));
  protected readonly plan = signal<MonitoringPlan | undefined>(undefined);
  /** Why the plan tabs are read-only; empty when the user can edit the plan. */
  protected readonly planLockReason = signal('');
  protected readonly attemptedPlanSubmit = signal(false);
  protected readonly canSubmitPlan = computed(() => {
    const p = this.plan();
    return !this.planLockReason() && (!p || p.status === 'Draft' || p.status === 'Rejected');
  });
  protected readonly tabs: TabItem[] = [
    { key: 'project', label: 'Project details' },
    { key: 'plan', label: PLAN_SECTION_LABELS.plan },
  ];

  protected readonly studyTypes = STUDY_TYPES;
  protected readonly blindings = BLINDING_TYPES;
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly visitTypes = VISIT_TYPES;
  protected readonly managerOptions = computed(() => this.users.managers().map(u => ({ value: u.id, label: u.name, hint: u.title })));
  /** Sponsor users see a project only when its sponsor name equals their organisation, so only those organisations are selectable. */
  private readonly sponsorOrgs = computed(() => [...new Set(this.users.sponsors().map(u => u.organization))].sort());
  protected readonly sponsorOptions = computed<SelectOption[]>(() => {
    const options = this.sponsorOrgs().map(org => ({ value: org, label: org, hint: this.users.sponsorUsers(org).map(u => u.name).join(', ') }));
    const current = this.existing()?.sponsor.name;
    return current && !this.sponsorOrgs().includes(current) ? [...options, { value: current, label: `${current} (no sponsor login)`, disabled: true }] : options;
  });

  protected readonly existing = signal<Project | undefined>(undefined);
  protected readonly notFound = signal(false);
  protected readonly serverError = signal('');
  protected readonly restored = signal(false);
  protected readonly nextId = signal('');

  private readonly knownSponsor: ValidatorFn = c =>
    !c.value || this.sponsorOrgs().includes(c.value)
      ? null
      : { unknownSponsor: `No sponsor login exists for "${c.value}". Select a sponsor organisation from the list.` };

  private party = (required: boolean, nameValidators: ValidatorFn[] = []) =>
    this.fb.nonNullable.group({
      name: ['', [...(required ? [Validators.required] : []), Validators.maxLength(120), ...nameValidators]],
      contactPerson: [''],
      email: ['', required ? [Validators.required, emailValidator] : [emailValidator]],
      phone: ['', Validators.pattern(/^[+\d\s()-]{0,20}$/)],
      address: [''],
    });

  protected readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(120)]],
      zenovelProjectNo: ['', [Validators.required, Validators.maxLength(40)]],
      protocolNo: ['', [Validators.required, Validators.maxLength(40)]],
      sponsorProjectNo: ['', Validators.maxLength(40)],
      protocolTitle: ['', [Validators.required, Validators.maxLength(300)]],
      studyType: ['BA/BE' as StudyType, Validators.required],
      blinding: ['Open label' as Blinding, Validators.required],
      status: ['Planning' as ProjectStatus, Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      sponsor: this.party(true, [this.knownSponsor]),
      cro: this.party(true),
      projectManagerId: ['', Validators.required],
      backupProjectManagerId: [''],
      scope: this.fb.nonNullable.group({
        monitoring: [true],
        monitoringDetails: [''],
        visits: this.fb.array<VisitGroup>([]),
        audit: [false],
        auditDetails: [''],
        auditDays: [null as number | null, [Validators.min(1), Validators.max(60)]],
        auditors: [null as number | null, [Validators.min(1), Validators.max(20)]],
      }),
      description: ['', Validators.maxLength(2000)],
      notes: ['', Validators.maxLength(2000)],
      protocolDocument: [null as FileMeta | null],
    },
    { validators: [rangeValidator('startDate', 'endDate', 'End date must be on or after the start date.')] },
  );

  get visits(): FormArray<VisitGroup> {
    return this.form.controls.scope.controls.visits;
  }

  private visitGroup(v: { visitType: string; days: number } = { visitType: 'SIV', days: 1 }): VisitGroup {
    return this.fb.nonNullable.group({ visitType: [v.visitType, Validators.required], days: [v.days, [Validators.required, Validators.min(1), Validators.max(30)]] });
  }

  private get draftKey(): string {
    return this.isDetails() ? `project-details-${this.id()}` : `project-${this.id() ?? 'new'}`;
  }

  private get planDraftKey(): string {
    return `project-details-${this.id()}-plan`;
  }

  ngOnInit(): void {
    const locked = this.isDetails() ? SETUP_FIELDS : DETAILS_FIELDS;
    locked.forEach(key => this.form.controls[key].disable({ emitEvent: false }));
    const id = this.id();
    if (id) {
      const p = this.projects.getVisible(id);
      if (!p) {
        this.notFound.set(true);
        return;
      }
      this.existing.set(p);
      this.patch(p);
      if (this.isDetails()) this.initPlan(p);
    } else {
      this.nextId.set(this.projects.peekNextId());
      this.form.controls.projectManagerId.setValue(this.auth.user()?.role === 'Project Manager' ? this.auth.user()!.id : '');
    }
    const draft = this.drafts.restore<ProjectInput>(this.draftKey);
    if (draft) {
      this.patch(draft);
      this.form.markAsDirty();
      this.restored.set(true);
    }
    this.drafts.track(this.draftKey, this.form, this.destroyRef);
  }

  private initPlan(project: Project): void {
    const plan = this.plans.planFor(project.id);
    this.plan.set(plan);
    this.planForm.load(plan ?? this.plans.defaults(project));
    if (!this.roles.can('plan.manage')) this.planLockReason.set('Your role can view but not edit the Monitoring Plan.');
    else if (plan && !this.plans.actions(plan).edit) this.planLockReason.set(`Monitoring Plan ${plan.id} cannot be edited while its status is "${plan.status}" / sponsor review "${plan.sponsorReview}".`);
    if (this.planLockReason()) {
      this.planForm.form.disable({ emitEvent: false });
      return;
    }
    const draft = this.drafts.restore<PlanFormValue>(this.planDraftKey);
    if (draft) {
      this.planForm.load({ ...this.planForm.toInput(draft), projectId: project.id });
      this.planForm.form.markAsDirty();
      this.restored.set(true);
    }
    this.drafts.track(this.planDraftKey, this.planForm.form, this.destroyRef);
  }

  addVisit(): void {
    this.visits.push(this.visitGroup());
    this.form.markAsDirty();
  }

  removeVisit(i: number): void {
    this.visits.removeAt(i);
    this.form.markAsDirty();
  }

  discardDraft(): void {
    this.drafts.clear(this.draftKey);
    this.restored.set(false);
    const p = this.existing();
    this.visits.clear();
    if (p) this.patch(p);
    else this.form.reset();
    this.form.markAsPristine();
    if (this.isDetails() && p && !this.planLockReason()) {
      this.drafts.clear(this.planDraftKey);
      this.planForm.load(this.plan() ?? this.plans.defaults(p));
      this.planForm.form.markAsPristine();
    }
  }

  cancel(): void {
    this.drafts.clear(this.draftKey);
    if (this.isDetails()) this.drafts.clear(this.planDraftKey);
    const id = this.id();
    this.router.navigateByUrl(id ? `/projects/${id}` : '/projects');
  }

  /** `submitPlan` validates every plan tab and moves a draft/rejected plan to PM review. */
  save(submitPlan = false): void {
    this.serverError.set('');
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (v.backupProjectManagerId && v.backupProjectManagerId === v.projectManagerId) {
      this.serverError.set('Back-up Project Manager must be different from the Project Manager.');
      return;
    }
    if (this.form.invalid) {
      this.toast.error('Please correct the highlighted fields.');
      this.activeTab.set('project');
      this.focusFirstInvalid();
      return;
    }
    if (submitPlan) {
      this.attemptedPlanSubmit.set(true);
      this.planForm.form.markAllAsTouched();
      const invalid = this.planForm.invalidSections();
      if (invalid.length) {
        this.activeTab.set('plan');
        this.toast.error(`Complete the highlighted section(s): ${invalid.map(s => PLAN_SECTION_LABELS[s]).join(', ')}.`);
        setTimeout(() => document.getElementById(`mp-section-${invalid[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        return;
      }
    }
    const input: ProjectInput = {
      ...v,
      name: v.name.trim() || v.zenovelProjectNo,
      sponsor: v.sponsor as PartyDetails,
      cro: v.cro as PartyDetails,
      scope: { ...v.scope, visits: v.scope.visits.map(x => ({ visitType: x.visitType, days: Number(x.days) })) },
      protocolDocument: this.isDetails() && !this.planLockReason() ? this.planForm.form.controls.details.controls.protocolDocument.value : v.protocolDocument,
    };
    try {
      const id = this.id();
      const saved = id ? this.projects.update(id, input) : this.projects.create(input);
      this.drafts.clear(this.draftKey);
      this.form.markAsPristine();
      if (!saved) return;
      if (this.isDetails()) this.savePlan(saved, submitPlan);
      this.toast.success(id ? `Project ${saved.id} updated.` : `Project ${saved.id} created.`);
      if (this.projects.getVisible(saved.id)) this.router.navigate(['/projects', saved.id]);
      else {
        this.toast.info('The project is assigned to another Project Manager, so it is no longer in your list.');
        this.router.navigateByUrl('/projects');
      }
    } catch (e) {
      this.serverError.set((e as Error).message);
    }
  }

  /** Creates the project's plan on first edit or submit; afterwards updates it only when changed or submitted. */
  private savePlan(project: Project, submit: boolean): void {
    const before = this.plan();
    if (this.planLockReason() || (!submit && !this.planForm.form.dirty)) return;
    const input = { ...this.planForm.toInput(), projectId: project.id };
    const saved = before ? this.plans.update(before.id, input, submit) : this.plans.create(input, submit);
    this.drafts.clear(this.planDraftKey);
    this.planForm.form.markAsPristine();
    if (!saved) return;
    this.plan.set(saved);
    const submitted = submit && (!before || before.status === 'Draft' || before.status === 'Rejected');
    this.toast.success(submitted ? `Monitoring Plan ${saved.id} submitted for PM review.` : `Monitoring Plan ${saved.id} saved.`);
  }

  private patch(p: Partial<ProjectInput>): void {
    this.visits.clear();
    (p.scope?.visits ?? []).forEach(v => this.visits.push(this.visitGroup(v)));
    this.form.patchValue(p as never);
  }

  private focusFirstInvalid(): void {
    setTimeout(() => (document.querySelector('form .ng-invalid:not(form):not([formGroupName]):not([formArrayName])') as HTMLElement | null)?.focus());
  }
}
