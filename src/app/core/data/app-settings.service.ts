import { Injectable, computed, inject, signal } from '@angular/core';
import { DEFAULT_PERMISSIONS, Permission } from '../config/permissions.config';
import { Role } from '../models';
import { LocalStorageService } from './local-storage.service';

export interface RiskThresholds {
  /** RPN at or above this value is High priority. */
  high: number;
  /** RPN at or above this value is Medium priority; below is Low. */
  medium: number;
}

export interface ReportSectionConfig {
  key: ReportSectionKey;
  label: string;
  enabled: boolean;
  required: boolean;
}

export type ReportSectionKey =
  | 'visitSummary'
  | 'observations'
  | 'findings'
  | 'deviations'
  | 'capa'
  | 'supportingNotes'
  | 'conclusion';

export interface AppSettings {
  riskThresholds: RiskThresholds;
  observationGrades: string[];
  reportSections: ReportSectionConfig[];
  permissions: Record<Role, Permission[]>;
}

const KEY = 'zen.v2.settings';

/** Provisional Monitoring Report sections: the workbook's report sheet is empty, so all of these are configurable. */
export const DEFAULT_REPORT_SECTIONS: ReportSectionConfig[] = [
  { key: 'visitSummary', label: 'Visit Summary', enabled: true, required: true },
  { key: 'observations', label: 'Monitoring Observations', enabled: true, required: false },
  { key: 'findings', label: 'Findings', enabled: true, required: false },
  { key: 'deviations', label: 'Issues and Deviations', enabled: true, required: false },
  { key: 'capa', label: 'Corrective and Preventive Action Items', enabled: true, required: false },
  { key: 'supportingNotes', label: 'Supporting Notes', enabled: true, required: false },
  { key: 'conclusion', label: 'Report Conclusion', enabled: true, required: true },
];

export const defaultSettings = (): AppSettings => ({
  riskThresholds: { high: 45, medium: 18 },
  observationGrades: ['Critical', 'Major', 'Minor', 'Recommendation'],
  reportSections: DEFAULT_REPORT_SECTIONS.map(s => ({ ...s })),
  permissions: structuredClone(DEFAULT_PERMISSIONS),
});

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly storage = inject(LocalStorageService);
  private readonly state = signal<AppSettings>(this.load());

  readonly settings = this.state.asReadonly();
  readonly riskThresholds = computed(() => this.state().riskThresholds);
  readonly observationGrades = computed(() => this.state().observationGrades);
  readonly reportSections = computed(() => this.state().reportSections);
  readonly permissions = computed(() => this.state().permissions);

  update(patch: Partial<AppSettings>): void {
    const next = { ...this.state(), ...patch };
    this.state.set(next);
    this.storage.write(KEY, next);
  }

  reset(): void {
    this.state.set(defaultSettings());
    this.storage.remove(KEY);
  }

  private load(): AppSettings {
    const saved = this.storage.get<Partial<AppSettings>>(KEY);
    const base = defaultSettings();
    if (!saved || typeof saved !== 'object') return base;
    return {
      riskThresholds: saved.riskThresholds ?? base.riskThresholds,
      observationGrades: Array.isArray(saved.observationGrades) ? saved.observationGrades : base.observationGrades,
      reportSections: Array.isArray(saved.reportSections) ? saved.reportSections : base.reportSections,
      permissions: saved.permissions ?? base.permissions,
    };
  }
}
