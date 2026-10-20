import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS, Permission, ROLES } from '../../core/config/permissions.config';
import { AppSettingsService, ReportSectionConfig } from '../../core/data/app-settings.service';
import { DataStore } from '../../core/data/data-store.service';
import { LocalStorageService } from '../../core/data/local-storage.service';
import { Role } from '../../core/models';
import { DialogService } from '../../core/services/dialog.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../../shared/icons';
import { PageHeader } from '../../shared/ui/page-header';

@Component({
  imports: [FormsModule, Icon, PageHeader],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './settings.html',
})
export class Settings {
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly settings = inject(AppSettingsService);
  protected readonly data = inject(DataStore);
  protected readonly storage = inject(LocalStorageService);

  protected readonly roles = ROLES;
  protected readonly groups = computed(() => {
    const map = new Map<string, (typeof PERMISSIONS)[number][]>();
    PERMISSIONS.forEach(p => map.set(p.group, [...(map.get(p.group) ?? []), p]));
    return [...map.entries()].map(([group, items]) => ({ group, items }));
  });

  protected high = this.settings.riskThresholds().high;
  protected medium = this.settings.riskThresholds().medium;
  protected grades = this.settings.observationGrades().join(', ');
  protected readonly sections = signal<ReportSectionConfig[]>(this.settings.reportSections().map(s => ({ ...s })));
  protected readonly thresholdError = signal('');

  has(role: Role, p: Permission): boolean {
    return this.settings.permissions()[role]?.includes(p) ?? false;
  }

  togglePermission(role: Role, p: Permission, on: boolean): void {
    const current = this.settings.permissions();
    const list = new Set(current[role] ?? []);
    if (on) list.add(p);
    else list.delete(p);
    this.settings.update({ permissions: { ...current, [role]: [...list] } });
    this.toast.info(`${role}: "${PERMISSIONS.find(x => x.key === p)?.label}" ${on ? 'granted' : 'removed'}.`);
  }

  saveThresholds(): void {
    const high = Number(this.high);
    const medium = Number(this.medium);
    if (!Number.isInteger(high) || !Number.isInteger(medium) || medium < 1 || high > 125 || medium >= high) {
      this.thresholdError.set('Use whole numbers with 1 ≤ Medium < High ≤ 125.');
      return;
    }
    this.thresholdError.set('');
    this.settings.update({ riskThresholds: { high, medium } });
    this.toast.success('Risk priority thresholds saved.');
  }

  saveGrades(): void {
    const list = this.grades.split(',').map(s => s.trim()).filter(Boolean);
    if (!list.length) {
      this.toast.error('Enter at least one observation grade.');
      return;
    }
    this.settings.update({ observationGrades: list });
    this.toast.success('Observation grades saved.');
  }

  saveSections(): void {
    if (this.sections().some(s => !s.label.trim())) {
      this.toast.error('Section labels cannot be empty.');
      return;
    }
    this.settings.update({ reportSections: this.sections().map(s => ({ ...s, label: s.label.trim(), required: s.enabled && s.required })) });
    this.toast.success('Monitoring Report configuration saved.');
  }

  updateSection(i: number, patch: Partial<ReportSectionConfig>): void {
    this.sections.update(list => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async resetSettings(): Promise<void> {
    const ok = await this.dialogs.confirm({ title: 'Reset configuration?', message: 'Permissions, risk thresholds, observation grades and report sections return to their defaults.', confirmText: 'Reset configuration', tone: 'danger' });
    if (!ok) return;
    this.settings.reset();
    const s = this.settings.settings();
    this.high = s.riskThresholds.high;
    this.medium = s.riskThresholds.medium;
    this.grades = s.observationGrades.join(', ');
    this.sections.set(s.reportSections.map(x => ({ ...x })));
    this.toast.success('Configuration reset to defaults.');
  }

  async resetData(): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Reset demo data?',
      message: 'All projects, plans, delegations, assignments, reports, notifications, activity and simulated emails in this browser will be replaced with the original sample data. Records you created will be lost.',
      confirmText: 'Reset demo data',
      tone: 'danger',
    });
    if (!ok) return;
    this.data.resetAll();
    this.toast.success('Demo data restored.');
    if (!this.auth.user()) this.router.navigateByUrl('/login');
    else this.router.navigateByUrl('/dashboard');
  }
}
