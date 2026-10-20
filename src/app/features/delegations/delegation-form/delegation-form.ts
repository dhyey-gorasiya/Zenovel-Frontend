import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { startWith } from 'rxjs';
import { DUTIES_BY_BLINDING, isBlindedDuty, isUnblindedDuty } from '../../../core/config/domain.config';
import { Attendee, Delegation, MonitorDuty } from '../../../core/models';
import { DelegationInput, DelegationService } from '../../../core/services/delegation.service';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FormField } from '../../../shared/ui/form-field';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchableSelect } from '../../../shared/ui/searchable-select';
import { ErrorState } from '../../../shared/ui/states';
import { rangeValidator } from '../../../shared/validators';

type PersonGroup = FormGroup<{ userId: FormControl<string>; name: FormControl<string>; details: FormControl<string> }>;
const ALL_DUTIES: MonitorDuty[] = [...DUTIES_BY_BLINDING['Open label'], ...DUTIES_BY_BLINDING.Blind];

@Component({
  imports: [ReactiveFormsModule, Icon, FormField, DatePicker, SearchableSelect, PageHeader, ErrorState],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './delegation-form.html',
})
export class DelegationForm {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly drafts = inject(FormDraftService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly delegations = inject(DelegationService);
  protected readonly projects = inject(ProjectService);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly users = inject(UserDirectoryService);

  readonly id = input<string>();
  readonly projectId = input<string>();
  readonly planId = input<string>();

  protected readonly existing = signal<Delegation | undefined>(undefined);
  protected readonly blocked = signal(false);
  protected readonly restored = signal(false);
  protected readonly isBlinded = isBlindedDuty;
  protected readonly isUnblinded = isUnblindedDuty;

  protected readonly form = this.fb.nonNullable.group(
    {
      projectId: ['', Validators.required],
      planId: ['', Validators.required],
      protocolVersionDetails: ['', Validators.maxLength(200)],
      meetingDate: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      attendees: this.fb.array<PersonGroup>([]),
      conductedBy: this.fb.array<PersonGroup>([]),
      discussionDetails: ['', Validators.required],
      delegatedResponsibilities: ['', Validators.required],
      notes: [''],
      monitors: this.fb.nonNullable.group(Object.fromEntries(ALL_DUTIES.map(d => [d, ['']])) as Record<MonitorDuty, [string]>),
    },
    { validators: rangeValidator('startTime', 'endTime', 'End time must be after the start time.') },
  );

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  protected readonly project = computed(() => {
    this.value();
    return this.projects.get(this.form.controls.projectId.value);
  });
  protected readonly plan = computed(() => {
    this.value();
    return this.plans.get(this.form.controls.planId.value);
  });
  protected readonly duties = computed(() => (this.project() ? this.delegations.dutiesFor(this.project()!.blinding) : []));
  protected readonly projectOptions = computed(() => this.projects.visible().map(p => ({ value: p.id, label: `${p.name} (${p.id})`, hint: `${p.protocolNo} · ${p.blinding}` })));
  protected readonly planOptions = computed(() =>
    this.project() ? this.plans.forProject(this.project()!.id).map(p => ({ value: p.id, label: `${p.id} · v${p.version}`, hint: `${p.status} · sponsor ${p.sponsorReview}` })) : [],
  );
  protected readonly monitorOptions = computed(() => this.users.monitors().map(m => ({ value: m.id, label: m.name, hint: m.email })));
  protected readonly peopleOptions = computed(() => this.users.all().filter(u => u.organization === 'Zenovel').map(u => ({ value: u.id, label: u.name, hint: `${u.role} · ${u.title}` })));
  protected readonly separationWarning = computed(() => {
    this.value();
    const m = this.form.controls.monitors.getRawValue();
    const applicable = this.duties();
    const blinded = applicable.filter(isBlindedDuty).map(d => m[d]).filter(Boolean);
    const unblinded = applicable.filter(isUnblindedDuty).map(d => m[d]).filter(Boolean);
    const both = blinded.filter(id => unblinded.includes(id));
    return both.length ? `${both.map(id => this.users.name(id)).join(', ')} assigned to both blinded and unblinded duties. Please confirm this is intended.` : '';
  });
  protected readonly ackWarning = computed(() => {
    const e = this.existing();
    return e && e.acknowledgements.some(a => a.state !== 'Not Sent')
      ? 'Monitors already notified keep their acknowledgement only if their duties are unchanged. Changed or new monitors must acknowledge again' + (e.authorization !== 'Not Requested' ? ', and the HOD/VP authorization will be reset.' : '.')
      : '';
  });

  get attendees(): FormArray<PersonGroup> { return this.form.controls.attendees; }
  get conductedBy(): FormArray<PersonGroup> { return this.form.controls.conductedBy; }

  private get draftKey(): string {
    return `delegation-${this.id() ?? 'new'}`;
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      const d = this.delegations.getVisible(id);
      if (!d || !this.delegations.canManage()) {
        this.blocked.set(true);
        return;
      }
      this.existing.set(d);
      this.load(d);
    } else {
      const pid = this.projectId() && this.projects.getVisible(this.projectId()) ? this.projectId()! : '';
      this.form.controls.projectId.setValue(pid);
      if (pid) this.onProject(pid);
      if (this.planId() && this.plans.get(this.planId())?.projectId === pid) this.onPlan(this.planId()!);
      this.addPerson(this.conductedBy);
    }
    const draft = this.drafts.restore<ReturnType<typeof this.form.getRawValue>>(this.draftKey);
    if (draft) {
      this.rebuildPeople(this.attendees, draft.attendees);
      this.rebuildPeople(this.conductedBy, draft.conductedBy);
      this.form.patchValue(draft);
      this.form.markAsDirty();
      this.restored.set(true);
    }
    this.form.controls.projectId.valueChanges.subscribe(p => this.onProject(p));
    this.form.controls.planId.valueChanges.subscribe(p => this.onPlan(p));
    this.applyDutyValidators();
    this.drafts.track(this.draftKey, this.form, this.destroyRef);
  }

  addPerson(arr: FormArray<PersonGroup>, p: Partial<Attendee> = {}): void {
    const g = this.fb.nonNullable.group({ userId: [p.userId ?? ''], name: [p.name ?? '', Validators.required], details: [p.details ?? ''] });
    g.controls.userId.valueChanges.subscribe(id => this.pickPerson(g, id));
    arr.push(g);
  }

  removePerson(arr: FormArray<PersonGroup>, i: number): void {
    arr.removeAt(i);
    this.form.markAsDirty();
  }

  pickPerson(g: PersonGroup, userId: string): void {
    const u = this.users.get(userId);
    if (u) g.patchValue({ name: u.name, details: g.controls.details.value || u.title }, { emitEvent: false });
  }

  discardDraft(): void {
    this.drafts.clear(this.draftKey);
    this.restored.set(false);
    const e = this.existing();
    if (e) this.load(e);
    else {
      this.form.reset();
      this.attendees.clear();
      this.conductedBy.clear();
    }
    this.form.markAsPristine();
  }

  cancel(): void {
    this.drafts.clear(this.draftKey);
    this.router.navigateByUrl(this.id() ? `/delegations/${this.id()}` : '/delegations');
  }

  save(): void {
    this.applyDutyValidators();
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toast.error('Please complete the required fields, including the required monitor duties.');
      return;
    }
    const v = this.form.getRawValue();
    const input: DelegationInput = {
      projectId: v.projectId,
      planId: v.planId,
      protocolVersionDetails: v.protocolVersionDetails,
      meetingDate: v.meetingDate,
      startTime: v.startTime,
      endTime: v.endTime,
      attendees: v.attendees,
      conductedBy: v.conductedBy,
      discussionDetails: v.discussionDetails,
      delegatedResponsibilities: v.delegatedResponsibilities,
      notes: v.notes,
      monitors: this.duties().map(duty => ({ duty, monitorId: v.monitors[duty] })).filter(m => !!m.monitorId),
    };
    const id = this.id();
    const saved = id ? this.delegations.update(id, input) : this.delegations.create(input);
    this.drafts.clear(this.draftKey);
    this.form.markAsPristine();
    if (!saved) return;
    this.toast.success(id ? `Delegation ${saved.id} updated.` : `Delegation ${saved.id} created. Send notifications to the monitors from the record page.`);
    this.router.navigate(['/delegations', saved.id]);
  }

  private onProject(projectId: string): void {
    const planCtrl = this.form.controls.planId;
    if (planCtrl.value && this.plans.get(planCtrl.value)?.projectId !== projectId) planCtrl.setValue('');
    const onlyPlan = this.plans.forProject(projectId);
    if (!planCtrl.value && onlyPlan.length === 1) planCtrl.setValue(onlyPlan[0].id);
    this.applyDutyValidators();
  }

  private onPlan(planId: string): void {
    const p = this.plans.get(planId);
    const ctrl = this.form.controls.protocolVersionDetails;
    if (p && !ctrl.value) {
      ctrl.setValue([p.protocolVersionNo && `Protocol v${p.protocolVersionNo}`, p.protocolVersionDate, p.amendmentDetails && p.amendmentDetails !== 'None' ? p.amendmentDetails : ''].filter(Boolean).join('; '));
    }
  }

  /** Only the duties applicable to the project's blinding are validated; values for other duties are kept but ignored. */
  private applyDutyValidators(): void {
    const applicable = this.duties();
    for (const duty of ALL_DUTIES) {
      const c = this.form.controls.monitors.controls[duty];
      c.setValidators(applicable.includes(duty) && this.delegations.isRequired(duty) ? Validators.required : null);
      c.updateValueAndValidity({ emitEvent: false });
    }
    this.form.controls.monitors.updateValueAndValidity({ emitEvent: false });
  }

  private load(d: Delegation): void {
    this.rebuildPeople(this.attendees, d.attendees);
    this.rebuildPeople(this.conductedBy, d.conductedBy);
    const monitors = Object.fromEntries(ALL_DUTIES.map(duty => [duty, d.monitors.find(m => m.duty === duty)?.monitorId ?? '']));
    this.form.patchValue({ ...d, monitors } as never);
  }

  private rebuildPeople(arr: FormArray<PersonGroup>, list: Attendee[] = []): void {
    arr.clear();
    list.forEach(p => this.addPerson(arr, p));
  }
}
