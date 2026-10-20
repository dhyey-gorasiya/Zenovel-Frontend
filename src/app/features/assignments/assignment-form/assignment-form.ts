import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { DemoRoleService } from '../../../core/auth/demo-role.service';
import { ASSIGNMENT_STATUSES, VISIT_TYPES } from '../../../core/config/domain.config';
import { AssignmentStatus, MonitorAssignment } from '../../../core/models';
import { DelegationService } from '../../../core/services/delegation.service';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { AssignmentInput, MonitorAssignmentService } from '../../../core/services/monitor-assignment.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { MonitoringReportService } from '../../../core/services/monitoring-report.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FormField } from '../../../shared/ui/form-field';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchableSelect } from '../../../shared/ui/searchable-select';
import { ErrorState } from '../../../shared/ui/states';
import { StatusBadge } from '../../../shared/ui/status-badge';

const OTHER = '__other__';

@Component({
  imports: [ReactiveFormsModule, RouterLink, Icon, FormField, DatePicker, SearchableSelect, PageHeader, ErrorState, StatusBadge],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './assignment-form.html',
})
export class AssignmentForm {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly drafts = inject(FormDraftService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roles = inject(DemoRoleService);
  protected readonly assignments = inject(MonitorAssignmentService);
  protected readonly projects = inject(ProjectService);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly delegations = inject(DelegationService);
  protected readonly reports = inject(MonitoringReportService);
  protected readonly users = inject(UserDirectoryService);

  readonly id = input<string>();
  readonly projectId = input<string>();

  protected readonly OTHER = OTHER;
  protected readonly visitTypes = VISIT_TYPES;
  protected readonly statuses = ASSIGNMENT_STATUSES;
  protected readonly existing = signal<MonitorAssignment | undefined>(undefined);
  protected readonly blocked = signal(false);
  protected readonly restored = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    projectId: ['', Validators.required],
    visitTypeChoice: ['', Validators.required],
    visitTypeOther: [''],
    monitorId: ['', Validators.required],
    visitDate: ['', Validators.required],
    planId: [''],
    reportId: [''],
    notes: ['', Validators.maxLength(1000)],
    status: ['Planned' as AssignmentStatus, Validators.required],
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  protected readonly project = computed(() => {
    this.value();
    return this.projects.get(this.form.controls.projectId.value);
  });
  protected readonly projectOptions = computed(() => this.projects.visible().map(p => ({ value: p.id, label: `${p.name} (${p.id})`, hint: p.protocolNo })));
  protected readonly relatedPlans = computed(() => (this.project() ? this.plans.forProject(this.project()!.id) : []));
  protected readonly relatedDelegations = computed(() => (this.project() ? this.delegations.forProject(this.project()!.id) : []));
  protected readonly relatedAssignments = computed(() => (this.project() ? this.assignments.forProject(this.project()!.id).filter(a => a.id !== this.id()) : []));
  protected readonly delegatedDuties = computed(() => {
    const map = new Map<string, string[]>();
    this.relatedDelegations().forEach(d => d.monitors.forEach(m => map.set(m.monitorId, [...(map.get(m.monitorId) ?? []), `${m.duty} (${d.id})`])));
    return map;
  });
  protected readonly monitorOptions = computed(() => {
    const delegated = this.delegatedDuties();
    return this.users
      .monitors()
      .map(m => ({ value: m.id, label: m.name, hint: delegated.has(m.id) ? `${m.email} · delegated: ${delegated.get(m.id)!.join(', ')}` : m.email }))
      .sort((a, b) => Number(delegated.has(b.value)) - Number(delegated.has(a.value)));
  });
  protected readonly planOptions = computed(() => this.relatedPlans().map(p => ({ value: p.id, label: `${p.id} · v${p.version}`, hint: p.status })));
  protected readonly reportOptions = computed(() => {
    const pid = this.project()?.id;
    return this.reports
      .visible()
      .filter(r => r.projectId === pid && (!r.assignmentId || r.assignmentId === this.id()))
      .map(r => ({ value: r.id, label: `${r.id} · ${r.visitType}`, hint: `${this.users.name(r.monitorId)} · ${r.status}` }));
  });
  protected readonly monitorEmail = computed(() => {
    this.value();
    return this.users.email(this.form.controls.monitorId.value);
  });

  private get draftKey(): string {
    return `assignment-${this.id() ?? 'new'}`;
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      const a = this.assignments.getVisible(id);
      if (!a || !this.roles.can('assignment.manage')) {
        this.blocked.set(true);
        return;
      }
      this.existing.set(a);
      this.load(a);
    } else if (this.projectId() && this.projects.getVisible(this.projectId())) {
      this.form.controls.projectId.setValue(this.projectId()!);
    }
    const draft = this.drafts.restore<ReturnType<typeof this.form.getRawValue>>(this.draftKey);
    if (draft) {
      this.form.patchValue(draft);
      this.form.markAsDirty();
      this.restored.set(true);
    }
    this.form.controls.projectId.valueChanges.subscribe(() => this.form.patchValue({ planId: '', reportId: '' }));
    this.form.controls.visitTypeChoice.valueChanges.subscribe(v => {
      const other = this.form.controls.visitTypeOther;
      other.setValidators(v === OTHER ? [Validators.required, Validators.maxLength(60)] : null);
      other.updateValueAndValidity();
    });
    this.drafts.track(this.draftKey, this.form, this.destroyRef);
  }

  discardDraft(): void {
    this.drafts.clear(this.draftKey);
    this.restored.set(false);
    this.form.reset();
    const a = this.existing();
    if (a) this.load(a);
    this.form.updateValueAndValidity();
    this.form.markAsPristine();
  }

  private load(a: MonitorAssignment): void {
    const known = (VISIT_TYPES as readonly string[]).includes(a.visitType);
    this.form.patchValue(
      { ...a, planId: a.planId ?? '', reportId: a.reportId ?? '', visitTypeChoice: known ? a.visitType : OTHER, visitTypeOther: known ? '' : a.visitType },
      { emitEvent: false },
    );
  }

  cancel(): void {
    this.drafts.clear(this.draftKey);
    this.router.navigateByUrl(this.id() ? `/assignments/${this.id()}` : '/assignments');
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toast.error('Please complete the required fields.');
      return;
    }
    const v = this.form.getRawValue();
    const input: AssignmentInput = {
      projectId: v.projectId,
      visitType: v.visitTypeChoice === OTHER ? v.visitTypeOther.trim() : v.visitTypeChoice,
      monitorId: v.monitorId,
      visitDate: v.visitDate,
      planId: v.planId || null,
      reportId: v.reportId || null,
      notes: v.notes,
      status: v.status,
    };
    const id = this.id();
    const saved = id ? this.assignments.update(id, input) : this.assignments.create(input);
    this.drafts.clear(this.draftKey);
    this.form.markAsPristine();
    if (!saved) return;
    this.toast.success(id ? `Assignment ${saved.id} updated.` : `Assignment ${saved.id} created. Preview and send the notification from the assignment page.`);
    this.router.navigate(['/assignments', saved.id]);
  }
}
