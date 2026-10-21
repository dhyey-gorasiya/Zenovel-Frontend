import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { BLINDING_TYPES, PROJECT_STATUSES, STUDY_TYPES, VISIT_TYPES } from '../../../core/config/domain.config';
import { Blinding, FileMeta, PartyDetails, Project, ProjectStatus, StudyType } from '../../../core/models';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { ProjectInput, ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FileUpload } from '../../../shared/ui/file-upload';
import { FormField } from '../../../shared/ui/form-field';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchableSelect } from '../../../shared/ui/searchable-select';
import { ErrorState } from '../../../shared/ui/states';
import { emailValidator, rangeValidator } from '../../../shared/validators';

type VisitGroup = FormGroup<{ visitType: FormControl<string>; days: FormControl<number> }>;

/** `setup`: HOD/VP creates or edits the "Project Details" sheet fields. `details`: the assigned PM completes the remaining fields. */
export type ProjectFormMode = 'setup' | 'details';

const SETUP_FIELDS = ['zenovelProjectNo', 'protocolNo', 'sponsorProjectNo', 'protocolTitle', 'sponsor', 'cro', 'projectManagerId', 'backupProjectManagerId', 'scope'] as const;
const DETAILS_FIELDS = ['name', 'status', 'studyType', 'blinding', 'startDate', 'endDate', 'description', 'notes', 'protocolDocument'] as const;

@Component({
  imports: [ReactiveFormsModule, RouterLink, Icon, FormField, DatePicker, FileUpload, SearchableSelect, PageHeader, ErrorState],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './project-form.html',
})
export class ProjectForm {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectService);
  private readonly toast = inject(ToastService);
  private readonly drafts = inject(FormDraftService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly users = inject(UserDirectoryService);

  /** Route param (`/projects/:id/edit`). */
  readonly id = input<string>();
  /** Route data (`/projects/:id/details`); absent on create and HOD/VP edit. */
  readonly mode = input<ProjectFormMode>();
  protected readonly isDetails = computed(() => this.mode() === 'details');

  protected readonly studyTypes = STUDY_TYPES;
  protected readonly blindings = BLINDING_TYPES;
  protected readonly statuses = PROJECT_STATUSES;
  protected readonly visitTypes = VISIT_TYPES;
  protected readonly managerOptions = computed(() => this.users.managers().map(u => ({ value: u.id, label: u.name, hint: u.title })));

  protected readonly existing = signal<Project | undefined>(undefined);
  protected readonly notFound = signal(false);
  protected readonly serverError = signal('');
  protected readonly restored = signal(false);
  protected readonly nextId = signal('');

  private party = (required: boolean) =>
    this.fb.nonNullable.group({
      name: ['', required ? [Validators.required, Validators.maxLength(120)] : [Validators.maxLength(120)]],
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
      sponsor: this.party(true),
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
  }

  cancel(): void {
    this.drafts.clear(this.draftKey);
    const id = this.id();
    this.router.navigateByUrl(id ? `/projects/${id}` : '/projects');
  }

  save(): void {
    this.serverError.set('');
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (v.backupProjectManagerId && v.backupProjectManagerId === v.projectManagerId) {
      this.serverError.set('Back-up Project Manager must be different from the Project Manager.');
      return;
    }
    if (this.form.invalid) {
      this.toast.error('Please correct the highlighted fields.');
      this.focusFirstInvalid();
      return;
    }
    const input: ProjectInput = {
      ...v,
      name: v.name.trim() || v.zenovelProjectNo,
      sponsor: v.sponsor as PartyDetails,
      cro: v.cro as PartyDetails,
      scope: { ...v.scope, visits: v.scope.visits.map(x => ({ visitType: x.visitType, days: Number(x.days) })) },
    };
    try {
      const id = this.id();
      const saved = id ? this.projects.update(id, input) : this.projects.create(input);
      this.drafts.clear(this.draftKey);
      this.form.markAsPristine();
      if (!saved) return;
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

  private patch(p: Partial<ProjectInput>): void {
    this.visits.clear();
    (p.scope?.visits ?? []).forEach(v => this.visits.push(this.visitGroup(v)));
    this.form.patchValue(p as never);
  }

  private focusFirstInvalid(): void {
    setTimeout(() => (document.querySelector('form .ng-invalid:not(form):not([formGroupName]):not([formArrayName])') as HTMLElement | null)?.focus());
  }
}
