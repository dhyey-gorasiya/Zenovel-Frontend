import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { startWith } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { BLINDING_DESCRIPTIONS, BLINDING_TYPES, DUTIES_BY_BLINDING, DUTY_GROUPS, isBlindedDuty, isUnblindedDuty } from '../../../core/config/domain.config';
import { Attendee, DelegatedMonitor, Delegation, MonitorDuty, SessionUser } from '../../../core/models';
import { DelegationInput, DelegationService } from '../../../core/services/delegation.service';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FormField, errorMessage } from '../../../shared/ui/form-field';
import { PageHeader } from '../../../shared/ui/page-header';
import { PartyDetails } from '../../../shared/ui/party-details';
import { SearchableSelect } from '../../../shared/ui/searchable-select';
import { SheetRow } from '../../../shared/ui/sheet-row';
import { ErrorState } from '../../../shared/ui/states';
import { rangeValidator } from '../../../shared/validators';

type PersonGroup = FormGroup<{ userId: FormControl<string>; name: FormControl<string>; details: FormControl<string> }>;
type DutyFlags = Record<MonitorDuty, boolean>;
type MonitorRow = FormGroup<{ monitorId: FormControl<string>; duties: FormGroup<Record<MonitorDuty, FormControl<boolean>>> }>;
interface MonitorRowValue {
  monitorId: string;
  duties: DutyFlags;
}
const ALL_DUTIES: MonitorDuty[] = [...DUTIES_BY_BLINDING['Open label'], ...DUTIES_BY_BLINDING.Blind];

@Component({
  imports: [ReactiveFormsModule, Icon, FormField, DatePicker, SearchableSelect, PageHeader, ErrorState, SheetRow, PartyDetails],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './delegation-form.html',
})
export class DelegationForm {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
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
  protected readonly blindingTypes = BLINDING_TYPES;
  protected readonly blindingDescriptions = BLINDING_DESCRIPTIONS;
  protected readonly dutyGroups = DUTY_GROUPS;

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
      discussionDetails: [''],
      delegatedResponsibilities: [''],
      notes: [''],
      monitors: this.fb.array<MonitorRow>([]),
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
  protected readonly planOptions = computed(() => {
    const p = this.project();
    if (!p) return [];
    const linked = this.existing()?.planId;
    return this.plans
      .forProject(p.id)
      .filter(mp => this.plans.isFinallyApproved(mp) || mp.id === linked)
      .map(mp => ({ value: mp.id, label: `${mp.id} · v${mp.version}`, hint: `${mp.status} · sponsor ${mp.sponsorReview}` }));
  });
  protected readonly monitorOptions = computed(() => this.users.monitors().map(m => ({ value: m.id, label: m.name, hint: m.email })));
  protected readonly people = computed(() => this.users.all().filter(u => u.organization === 'Zenovel'));
  protected readonly separationWarning = computed(() => {
    this.value();
    const applicable = this.duties();
    const both = this.monitorRows
      .getRawValue()
      .filter(r => r.monitorId && applicable.some(d => isBlindedDuty(d) && r.duties[d]) && applicable.some(d => isUnblindedDuty(d) && r.duties[d]))
      .map(r => r.monitorId);
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
  get monitorRows(): FormArray<MonitorRow> { return this.form.controls.monitors; }

  private get draftKey(): string {
    return `delegation-${this.id() ?? 'new'}`;
  }

  ngOnInit(): void {
    this.monitorRows.addValidators(() => (this.gridIssues(this.monitorRows.getRawValue()).length ? { monitorGrid: true } : null));
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
      const planId = this.planId();
      if (planId && this.plans.get(planId)?.projectId === pid && this.delegations.canStartFor(planId)) {
        this.form.controls.planId.setValue(planId);
        this.onPlan(planId);
      }
      const me = this.people().find(u => u.id === this.auth.user()?.id);
      if (me) this.addPerson(this.conductedBy, { userId: me.id, name: me.name, details: me.title });
      this.addMonitorRow();
    }
    const draft = this.drafts.restore<ReturnType<typeof this.form.getRawValue>>(this.draftKey);
    if (draft) {
      const { attendees, conductedBy, monitors, ...rest } = draft;
      this.rebuildPeople(this.attendees, attendees);
      this.rebuildPeople(this.conductedBy, conductedBy);
      this.rebuildMonitorRows(Array.isArray(monitors) ? monitors : this.rowsFromAssignments(this.legacyDraftMonitors(monitors)));
      this.form.patchValue(rest);
      this.form.markAsDirty();
      this.restored.set(true);
    }
    this.form.controls.projectId.valueChanges.subscribe(p => this.onProject(p));
    this.form.controls.planId.valueChanges.subscribe(p => this.onPlan(p));
    this.applyDutyValidators();
    this.drafts.track(this.draftKey, this.form, this.destroyRef);
  }

  /* ---------- Attendees / discussion conducted by ---------- */

  addPerson(arr: FormArray<PersonGroup>, p: Partial<Attendee> = {}): void {
    arr.push(this.fb.nonNullable.group({ userId: [p.userId ?? ''], name: [p.name ?? '', Validators.required], details: [p.details ?? ''] }));
  }

  removePerson(arr: FormArray<PersonGroup>, i: number): void {
    arr.removeAt(i);
    this.form.markAsDirty();
  }

  isTicked(arr: FormArray<PersonGroup>, userId: string): boolean {
    return arr.controls.some(g => g.controls.userId.value === userId);
  }

  /** Users outside the tick list (or typed in manually) are edited as free-text rows. */
  isListed(userId: string): boolean {
    return !!userId && this.people().some(u => u.id === userId);
  }

  togglePerson(arr: FormArray<PersonGroup>, user: SessionUser, checked: boolean): void {
    const i = arr.controls.findIndex(g => g.controls.userId.value === user.id);
    if (checked && i < 0) this.addPerson(arr, { userId: user.id, name: user.name, details: user.title });
    if (!checked && i >= 0) arr.removeAt(i);
    this.form.markAsDirty();
  }

  /* ---------- Delegation of monitor(s) ---------- */

  addMonitorRow(row?: MonitorRowValue): void {
    const flags = Object.fromEntries(ALL_DUTIES.map(d => [d, [row?.duties[d] ?? false]])) as Record<MonitorDuty, [boolean]>;
    this.monitorRows.push(this.fb.nonNullable.group({ monitorId: [row?.monitorId ?? ''], duties: this.fb.nonNullable.group(flags) }));
  }

  removeMonitorRow(i: number): void {
    this.monitorRows.removeAt(i);
    this.form.markAsDirty();
  }

  protected monitorIssues(): string[] {
    return this.gridIssues(this.monitorRows.getRawValue());
  }

  protected delegatedMonitorIds(): string[] {
    const applicable = this.duties();
    return [...new Set(this.monitorRows.getRawValue().filter(r => r.monitorId && applicable.some(d => r.duties[d])).map(r => r.monitorId))];
  }

  protected ackStateLabel(monitorId: string): string {
    const state = this.existing()?.acknowledgements.find(a => a.monitorId === monitorId)?.state ?? 'Not Sent';
    return state === 'Not Sent' ? 'Awaiting notification' : state;
  }

  protected errorOf(c: AbstractControl): string {
    return c.touched ? errorMessage(c) : '';
  }

  /* ---------- Draft / navigation / save ---------- */

  discardDraft(): void {
    this.drafts.clear(this.draftKey);
    this.restored.set(false);
    const e = this.existing();
    if (e) this.load(e);
    else {
      this.form.reset();
      this.attendees.clear();
      this.conductedBy.clear();
      this.monitorRows.clear();
      this.addMonitorRow();
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
    const id = this.id();
    if (!id && !this.delegations.canStartFor(v.planId)) {
      this.toast.error('Training & Delegation can start only after the monitoring plan is finally approved.');
      return;
    }
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
      monitors: this.duties().flatMap(duty => v.monitors.filter(r => r.monitorId && r.duties[duty]).map(r => ({ duty, monitorId: r.monitorId }))),
    };
    const saved = id ? this.delegations.update(id, input) : this.delegations.create(input);
    this.drafts.clear(this.draftKey);
    this.form.markAsPristine();
    if (!saved) return;
    this.toast.success(id ? `Delegation ${saved.id} updated.` : `Delegation ${saved.id} created. Send notifications to the monitors from the record page.`);
    this.router.navigate(['/delegations', saved.id]);
  }

  private onProject(projectId: string): void {
    const planCtrl = this.form.controls.planId;
    if (planCtrl.value && !this.isSelectablePlan(planCtrl.value, projectId)) planCtrl.setValue('');
    const approved = this.plans.approvedForProject(projectId);
    if (!planCtrl.value && approved.length === 1) planCtrl.setValue(approved[0].id);
    this.applyDutyValidators();
  }

  private onPlan(planId: string): void {
    const p = this.plans.get(planId);
    const ctrl = this.form.controls.protocolVersionDetails;
    if (p && !ctrl.value) {
      ctrl.setValue([p.protocolVersionNo && `Protocol v${p.protocolVersionNo}`, p.protocolVersionDate, p.amendmentDetails && p.amendmentDetails !== 'None' ? p.amendmentDetails : ''].filter(Boolean).join('; '));
    }
  }

  private isSelectablePlan(planId: string, projectId: string): boolean {
    const p = this.plans.get(planId);
    return p?.projectId === projectId && (this.plans.isFinallyApproved(p) || p.id === this.existing()?.planId);
  }

  private applicableDuties(): MonitorDuty[] {
    const p = this.projects.get(this.form.controls.projectId.value);
    return p ? this.delegations.dutiesFor(p.blinding) : [];
  }

  /** Only the duties applicable to the project's blinding are validated; ticks on other duties are kept but ignored. */
  private applyDutyValidators(): void {
    this.monitorRows.updateValueAndValidity({ emitEvent: false });
  }

  private gridIssues(rows: MonitorRowValue[]): string[] {
    const applicable = this.applicableDuties();
    const issues: string[] = [];
    rows.forEach((r, i) => {
      const ticked = applicable.some(d => r.duties[d]);
      if (!r.monitorId && ticked) issues.push(`Row ${i + 1}: select the monitor for the ticked duty.`);
      if (r.monitorId && !ticked) issues.push(`${this.users.name(r.monitorId)}: tick at least one duty.`);
    });
    const ids = rows.map(r => r.monitorId).filter(Boolean);
    new Set(ids.filter((m, i) => ids.indexOf(m) !== i)).forEach(m => issues.push(`${this.users.name(m)} is listed more than once.`));
    for (const duty of applicable) {
      const count = rows.filter(r => r.monitorId && r.duties[duty]).length;
      if (!count && this.delegations.isRequired(duty)) issues.push(`${duty} Monitor is required.`);
      if (count > 1) issues.push(`${duty} can be delegated to only one monitor.`);
    }
    return issues;
  }

  private load(d: Delegation): void {
    this.rebuildPeople(this.attendees, d.attendees);
    this.rebuildPeople(this.conductedBy, d.conductedBy);
    this.rebuildMonitorRows(this.rowsFromAssignments(d.monitors));
    const { attendees: _a, conductedBy: _c, monitors: _m, ...rest } = d;
    this.form.patchValue(rest);
  }

  private rebuildPeople(arr: FormArray<PersonGroup>, list: Attendee[] = []): void {
    arr.clear();
    list.forEach(p => this.addPerson(arr, p));
  }

  private rebuildMonitorRows(rows: MonitorRowValue[]): void {
    this.monitorRows.clear();
    rows.forEach(r => this.addMonitorRow(r));
    if (!rows.length) this.addMonitorRow();
  }

  /** One row per monitor, in the order the monitor first appears. */
  private rowsFromAssignments(list: DelegatedMonitor[]): MonitorRowValue[] {
    const byMonitor = new Map<string, DutyFlags>();
    for (const m of list) {
      const flags = byMonitor.get(m.monitorId) ?? (Object.fromEntries(ALL_DUTIES.map(d => [d, false])) as DutyFlags);
      flags[m.duty] = true;
      byMonitor.set(m.monitorId, flags);
    }
    return [...byMonitor.entries()].map(([monitorId, duties]) => ({ monitorId, duties }));
  }

  /** Drafts saved before the monitor grid stored one monitor id per duty. */
  private legacyDraftMonitors(value: unknown): DelegatedMonitor[] {
    if (!value || typeof value !== 'object') return [];
    return ALL_DUTIES.map(duty => ({ duty, monitorId: String((value as Record<string, unknown>)[duty] ?? '') })).filter(m => !!m.monitorId);
  }
}
