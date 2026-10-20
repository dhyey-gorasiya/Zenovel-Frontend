import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { AppSettingsService, ReportSectionKey } from '../../../core/data/app-settings.service';
import { CapaItem, Deviation, Finding, MonitoringReport } from '../../../core/models';
import { DataStore } from '../../../core/data/data-store.service';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { MonitorAssignmentService } from '../../../core/services/monitor-assignment.service';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { MonitoringReportService, ReportInput } from '../../../core/services/monitoring-report.service';
import { ProjectService } from '../../../core/services/project.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { DatePicker } from '../../../shared/ui/date-picker';
import { FormField } from '../../../shared/ui/form-field';
import { PageHeader } from '../../../shared/ui/page-header';
import { SearchableSelect } from '../../../shared/ui/searchable-select';
import { EmptyState, ErrorState } from '../../../shared/ui/states';
import { ApprovalHistory } from '../../../shared/ui/timeline';

type FC<T> = FormControl<T>;
type FindingGroup = FormGroup<{ id: FC<string>; category: FC<string>; description: FC<string>; grade: FC<string> }>;
type DeviationGroup = FormGroup<{ id: FC<string>; description: FC<string>; reference: FC<string> }>;
type CapaGroup = FormGroup<{ id: FC<string>; action: FC<string>; responsiblePerson: FC<string>; targetDate: FC<string>; status: FC<'Open' | 'Closed'> }>;

@Component({
  imports: [ReactiveFormsModule, RouterLink, Icon, FormField, DatePicker, SearchableSelect, PageHeader, ErrorState, EmptyState, ApprovalHistory],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './report-form.html',
})
export class ReportForm {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly data = inject(DataStore);
  private readonly drafts = inject(FormDraftService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settings = inject(AppSettingsService);
  protected readonly reports = inject(MonitoringReportService);
  protected readonly assignments = inject(MonitorAssignmentService);
  protected readonly projects = inject(ProjectService);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly users = inject(UserDirectoryService);

  readonly id = input<string>();
  readonly assignmentId = input<string>();

  protected readonly existing = signal<MonitoringReport | undefined>(undefined);
  protected readonly blocked = signal('');
  protected readonly restored = signal(false);
  protected readonly grades = this.settings.observationGrades;
  protected readonly sections = computed(() => new Map(this.settings.reportSections().map(s => [s.key, s])));

  protected readonly form = this.fb.nonNullable.group({
    assignmentId: ['', Validators.required],
    planId: [''],
    visitType: ['', Validators.required],
    visitDate: ['', Validators.required],
    visitSummary: [''],
    observations: [''],
    findings: this.fb.array<FindingGroup>([]),
    deviations: this.fb.array<DeviationGroup>([]),
    capa: this.fb.array<CapaGroup>([]),
    supportingNotes: [''],
    conclusion: [''],
  });

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  protected readonly assignment = computed(() => {
    this.value();
    return this.assignments.get(this.form.controls.assignmentId.value);
  });
  protected readonly project = computed(() => this.projects.get(this.assignment()?.projectId ?? this.existing()?.projectId));
  protected readonly assignmentOptions = computed(() => {
    const current = this.existing()?.assignmentId;
    const list = this.reports.startableAssignments().filter(a => !a.reportId || a.id === current);
    const linked = current ? this.assignments.get(current) : undefined;
    const all = linked && !list.some(a => a.id === linked.id) ? [linked, ...list] : list;
    return all.map(a => ({ value: a.id, label: `${a.id} · ${a.visitType} · ${a.visitDate}`, hint: this.projects.name(a.projectId) }));
  });
  protected readonly planOptions = computed(() => (this.project() ? this.plans.forProject(this.project()!.id).map(p => ({ value: p.id, label: `${p.id} · v${p.version}`, hint: p.status })) : []));

  get findings(): FormArray<FindingGroup> { return this.form.controls.findings; }
  get deviations(): FormArray<DeviationGroup> { return this.form.controls.deviations; }
  get capa(): FormArray<CapaGroup> { return this.form.controls.capa; }

  private get draftKey(): string {
    return `report-${this.id() ?? 'new'}`;
  }

  enabled(key: ReportSectionKey): boolean {
    return this.sections().get(key)?.enabled ?? false;
  }

  label(key: ReportSectionKey): string {
    return this.sections().get(key)?.label ?? key;
  }

  required(key: ReportSectionKey): boolean {
    return !!(this.sections().get(key)?.enabled && this.sections().get(key)?.required);
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      const r = this.reports.getVisible(id);
      if (!r) return this.blocked.set('Report not found or outside your access.');
      if (!this.reports.actions(r).edit) return this.blocked.set(`Report ${r.id} can only be edited by its monitor while in Draft or Changes Requested (current: ${r.status}).`);
      this.existing.set(r);
      this.load(r);
      if (!r.assignmentId) this.form.controls.assignmentId.clearValidators();
    } else if (this.assignmentId()) {
      const a = this.reports.startableAssignments().find(x => x.id === this.assignmentId());
      if (a) this.form.controls.assignmentId.setValue(a.id);
      this.prefill(a?.id ?? '');
    }
    const draft = this.drafts.restore<ReturnType<typeof this.form.getRawValue>>(this.draftKey);
    if (draft) {
      this.load(draft);
      this.form.markAsDirty();
      this.restored.set(true);
    }
    this.form.controls.assignmentId.valueChanges.subscribe(v => this.prefill(v));
    this.applySectionValidators();
    this.drafts.track(this.draftKey, this.form, this.destroyRef);
  }

  addFinding(): void {
    this.findings.push(this.findingGroup({ id: this.data.localId('F'), category: '', description: '', grade: this.grades()[0] ?? '' }));
  }
  addDeviation(): void {
    this.deviations.push(this.deviationGroup({ id: this.data.localId('D'), description: '', reference: '' }));
  }
  addCapa(): void {
    this.capa.push(this.capaGroup({ id: this.data.localId('C'), action: '', responsiblePerson: '', targetDate: '', status: 'Open' }));
  }
  remove(arr: FormArray, i: number): void {
    arr.removeAt(i);
    this.form.markAsDirty();
  }

  saveDraft(): void {
    this.form.controls.assignmentId.markAsTouched();
    if (!this.existing() && !this.form.controls.assignmentId.value) {
      this.toast.error('Select the monitor assignment this report belongs to.');
      return;
    }
    const saved = this.persist();
    if (!saved) return;
    this.toast.success(`Draft ${saved.id} saved.`);
    if (!this.id()) this.router.navigate(['/reports', saved.id, 'edit'], { replaceUrl: true });
    else this.existing.set(saved);
  }

  submit(): void {
    this.form.markAllAsTouched();
    const missingArrays = (['findings', 'deviations', 'capa'] as const).filter(k => this.required(k) && this.form.controls[k].length === 0);
    if (this.form.invalid || missingArrays.length) {
      this.toast.error(missingArrays.length ? `Add at least one entry to: ${missingArrays.map(k => this.label(k)).join(', ')}.` : 'Please complete the required sections.');
      return;
    }
    const saved = this.persist();
    if (!saved) return;
    this.reports.submit(saved.id);
    this.toast.success(`Report ${saved.id} submitted for review.`);
    this.router.navigate(['/reports', saved.id]);
  }

  cancel(): void {
    this.drafts.clear(this.draftKey);
    this.router.navigateByUrl(this.id() ? `/reports/${this.id()}` : '/reports');
  }

  discardDraft(): void {
    this.drafts.clear(this.draftKey);
    this.restored.set(false);
    const r = this.existing();
    if (r) this.load(r);
    this.form.markAsPristine();
  }

  private persist(): MonitoringReport | undefined {
    const v = this.form.getRawValue();
    const a = this.assignments.get(v.assignmentId);
    const e = this.existing();
    const input: ReportInput = {
      projectId: a?.projectId ?? e!.projectId,
      monitorId: a?.monitorId ?? e!.monitorId,
      assignmentId: v.assignmentId || null,
      planId: v.planId || null,
      visitType: v.visitType,
      visitDate: v.visitDate,
      visitSummary: v.visitSummary,
      observations: v.observations,
      findings: v.findings,
      deviations: v.deviations,
      capa: v.capa,
      supportingNotes: v.supportingNotes,
      conclusion: v.conclusion,
    };
    const saved = e ? this.reports.update(e.id, input) : this.reports.create(input);
    this.drafts.clear(this.draftKey);
    this.form.markAsPristine();
    this.restored.set(false);
    return saved;
  }

  private prefill(assignmentId: string): void {
    const a = this.assignments.get(assignmentId);
    if (!a) return;
    this.form.patchValue({ visitType: a.visitType, visitDate: a.visitDate, planId: a.planId ?? '' });
  }

  private applySectionValidators(): void {
    for (const key of ['visitSummary', 'observations', 'supportingNotes', 'conclusion'] as const) {
      this.form.controls[key].setValidators(this.required(key) ? Validators.required : null);
      this.form.controls[key].updateValueAndValidity({ emitEvent: false });
    }
  }

  private load(r: Partial<MonitoringReport> & { findings?: Finding[]; deviations?: Deviation[]; capa?: CapaItem[] }): void {
    this.findings.clear();
    this.deviations.clear();
    this.capa.clear();
    (r.findings ?? []).forEach(x => this.findings.push(this.findingGroup(x)));
    (r.deviations ?? []).forEach(x => this.deviations.push(this.deviationGroup(x)));
    (r.capa ?? []).forEach(x => this.capa.push(this.capaGroup(x)));
    const { findings: _f, deviations: _d, capa: _c, ...rest } = r;
    this.form.patchValue({ ...rest, assignmentId: rest.assignmentId ?? '', planId: rest.planId ?? '' } as never, { emitEvent: false });
    this.form.updateValueAndValidity();
  }

  private findingGroup(f: Finding): FindingGroup {
    return this.fb.nonNullable.group({ id: [f.id], category: [f.category], description: [f.description, Validators.required], grade: [f.grade, Validators.required] });
  }
  private deviationGroup(d: Deviation): DeviationGroup {
    return this.fb.nonNullable.group({ id: [d.id], description: [d.description, Validators.required], reference: [d.reference] });
  }
  private capaGroup(c: CapaItem): CapaGroup {
    return this.fb.nonNullable.group({
      id: [c.id], action: [c.action, Validators.required], responsiblePerson: [c.responsiblePerson, Validators.required], targetDate: [c.targetDate, Validators.required], status: [c.status],
    });
  }
}
