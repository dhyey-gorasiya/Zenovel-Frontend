import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MonitoringPlanService } from '../../../core/services/monitoring-plan.service';
import { MonitoringReportService } from '../../../core/services/monitoring-report.service';
import { ProjectService } from '../../../core/services/project.service';
import { UserDirectoryService } from '../../../core/services/user-directory.service';
import { Icon } from '../../../shared/icons';
import { ErrorState } from '../../../shared/ui/states';
import { ReportContentView } from '../report-content/report-content';

@Component({
  imports: [RouterLink, Icon, ErrorState, ReportContentView, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-print.html',
})
export class ReportPrint {
  private readonly reports = inject(MonitoringReportService);
  private readonly projects = inject(ProjectService);
  protected readonly plans = inject(MonitoringPlanService);
  protected readonly users = inject(UserDirectoryService);
  protected readonly now = new Date();

  readonly id = input.required<string>();
  protected readonly report = computed(() => this.reports.getVisible(this.id()));
  protected readonly project = computed(() => this.projects.get(this.report()?.projectId));

  print(): void {
    window.print();
  }
}
